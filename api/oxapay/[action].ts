import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import { headerValue, readJsonBody, readRawBody } from "../../server/lib/http.js";
import { createHash } from "crypto";
import { ObjectId } from "mongodb";
import { ensurePaymentProviderIndexes, getDb } from "../../server/lib/db.js";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import {
  OxaPayApiError,
  normalizeOxaPayStatus,
  verifyOxaPayWebhookSignature,
  createOxaPayInvoice,
  fetchOxaPayPayment,
  fetchOxaPaySupportedFiats,
  getOxaPayConfig,
  hasOxaPayConfig,
  isOxaPayTrackId,
} from "../../server/lib/oxapay.js";
import { getPaymentMethodSettings, isPaymentMethodEnabled } from "../../server/lib/paymentMethods.js";
import { sendPaymentSuccessAlert } from "../../server/lib/telegram.js";
import { recordProviderEvent } from "../../server/lib/wallet.js";
import { flagCryptoPaymentForReview, settleCryptoDeposit } from "../../server/lib/cryptoSettlement.js";

/**
 * Crypto (OxaPay).
 *
 * The wallet is denominated in INR. The invoice currency is configurable but
 * defaults to INR, which is the only path where no conversion is required at
 * all: the customer is quoted ₹X, OxaPay locks the coin rate, and we credit
 * exactly ₹X.
 *
 * If INR invoices are not supported by the merchant account, the invoice is
 * created in a configured fiat currency using a configured static rate, and
 * the INR credit amount is still the figure the customer was quoted.
 */

const METHOD_ID = "oxapay_crypto" as const;

/**
 * The body parser is off for this file because the provider webhook signs the
 * exact bytes it sent (HMAC-SHA512). Ordinary JSON actions parse their own
 * body from the same raw stream, so nothing is ever double-read.
 */
export const config = {
  api: {
    bodyParser: false,
  },
};

function cleanText(value: unknown, maxLength = 200): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function sameOriginIfPresent(req: VercelRequest): boolean {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const host = typeof req.headers.host === "string" ? req.headers.host : "";
  if (!origin) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

function siteUrl(): string {
  const configured = String(process.env.PUBLIC_SITE_URL || process.env.SITE_URL || "").trim();
  if (!configured) return "https://smmup.co.in";
  return configured.replace(/\/+$/, "");
}

function formatRange(currency: string): string {
  return currency === "INR" ? "₹" : "$";
}

/**
 * The limits, currency, rate and lifetimes the customer was shown. They come
 * from the shared registry (Mongo override > env > default) so the amount the
 * UI accepted is always exactly the amount the API enforces.
 */
async function resolveSettings(db: any) {
  return getPaymentMethodSettings(db, "oxapay_crypto");
}

function allowSandboxCredit(): boolean {
  return String(process.env.OXAPAY_ALLOW_SANDBOX_CREDIT || "false").trim() === "true";
}

/**
 * The customer picks the amount in the method's own currency. For INR that is
 * the wallet currency exactly; for USD the INR credit is computed once, at
 * invoice creation, and locked for the life of the invoice.
 */
function computeInvoice(input: { amount: number; currency: string; inrRate: number }): {
  invoiceAmount: number;
  creditPaise: number;
  rate: number;
} {
  const currency = input.currency.toUpperCase();
  if (currency === "INR") {
    const paise = Math.round(input.amount * 100);
    return { invoiceAmount: input.amount, creditPaise: paise, rate: 1 };
  }
  if (currency !== "USD") {
    throw new OxaPayApiError("Unsupported crypto invoice currency.", 400);
  }
  const rate = input.inrRate;
  const creditPaise = Math.round(input.amount * rate * 100);
  if (!Number.isFinite(creditPaise) || creditPaise <= 0) {
    throw new OxaPayApiError("The crypto invoice amount could not be calculated.", 503);
  }
  return { invoiceAmount: input.amount, creditPaise, rate };
}

async function handleOxaPayRequest(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action || "");

  // The provider callback shares this file with the customer-facing actions.
  if (action === "webhook") {
    return handleOxaPayWebhook(req, res);
  }

  // Every other action speaks JSON.
  await readJsonBody(req);
  const db = await getDb();
  const authUser = await getUserFromRequest(req, db);
  if (!authUser) return res.status(401).json({ error: "Unauthorized. Please sign in." });
  if (denySupportMutation(authUser, res, action === "config" && req.method === "GET")) return;

  if (action === "config") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const configured = hasOxaPayConfig();
    let sandbox = false;
    try {
      sandbox = getOxaPayConfig().sandbox;
    } catch {
      sandbox = false;
    }
    const settings = await resolveSettings(db);
    return res.status(200).json({
      enabled: configured,
      configured,
      sandbox,
      minAmount: settings.minAmount,
      maxAmount: settings.maxAmount,
      currency: settings.currency,
      invoiceCurrency: settings.currency,
      inrRate: settings.inrRate,
      feePayer: settings.feePayer,
      message: configured ? undefined : "Crypto payments are awaiting activation.",
    });
  }

  /** Diagnostic: confirms whether the merchant account can invoice in INR. */
  if (action === "fiats") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    try {
      const fiats = await fetchOxaPaySupportedFiats();
      return res.status(200).json({ success: true, fiats, supportsInr: fiats.includes("INR") });
    } catch (error: any) {
      const status = error instanceof OxaPayApiError ? error.status : 502;
      return res.status(status).json({ error: "Could not read the supported fiat currencies." });
    }
  }

  if (action === "create-invoice") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!sameOriginIfPresent(req)) return res.status(403).json({ error: "Invalid request origin." });

    if (!(await isPaymentMethodEnabled(db, METHOD_ID))) {
      return res.status(403).json({ error: "Crypto payments are currently unavailable. Please choose another payment method." });
    }

    const rate = await checkRateLimit(`oxapay_create_${authUser.userId}`, 8, 300, db);
    if (!rate.allowed) {
      return res.status(429).json({ error: `Too many payment attempts. Please wait ${rate.remainingSec} seconds.` });
    }

    const settings = await resolveSettings(db);
    const currency = String(req.body?.currency || settings.currency).trim().toUpperCase() || settings.currency;
    if (currency !== settings.currency) {
      return res.status(400).json({ error: "That currency is not available for crypto deposits right now." });
    }

    const amountRaw = Number(req.body?.amount);
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
      return res.status(400).json({ error: "Enter a valid deposit amount." });
    }
    // USD invoices accept cents; INR invoices accept paise.
    const decimals = currency === "USD" ? 2 : 2;
    const scaled = amountRaw * 10 ** decimals;
    if (Math.abs(scaled - Math.round(scaled)) > 0.0001) {
      return res.status(400).json({ error: "The deposit amount may have at most two decimal places." });
    }
    if (amountRaw < settings.minAmount || amountRaw > settings.maxAmount) {
      return res.status(400).json({
        error: `Crypto deposits are between ${formatRange(currency)}${settings.minAmount.toLocaleString("en-US")} and ${formatRange(currency)}${settings.maxAmount.toLocaleString("en-US")}.`,
      });
    }

    const hold = await db.collection("users").findOne(
      { _id: new ObjectId(authUser.userId) },
      { projection: { payment_hold: 1 } },
    );
    if (hold?.payment_hold) {
      return res.status(403).json({ error: "Deposits are temporarily paused on this account. Please contact support." });
    }

    let transactionId: ObjectId | null = null;
    try {
      await ensurePaymentProviderIndexes();
      const config = getOxaPayConfig();
      const { invoiceAmount, creditPaise, rate } = computeInvoice({
        amount: amountRaw,
        currency,
        inrRate: settings.inrRate,
      });
      const creditInr = creditPaise / 100;

      const now = new Date();
      const insert = await db.collection("transactions").insertOne({
        user_id: new ObjectId(authUser.userId),
        user_email: authUser.email,
        // `amount` is always the INR amount credited to the wallet.
        amount: creditInr,
        amount_paise: creditPaise,
        currency: "INR",
        method: "OXAPAY_CRYPTO",
        provider: "oxapay",
        environment: config.sandbox ? "sandbox" : "live",
        status: "creating",
        wallet_credited: false,
        oxapay_invoice_currency: currency,
        oxapay_invoice_amount: invoiceAmount,
        oxapay_fiat_rate_locked: rate,
        created_at: now,
        updated_at: now,
        expires_at: new Date(now.getTime() + settings.invoiceLifetimeMinutes * 60_000),
      });
      transactionId = insert.insertedId;

      const invoice = await createOxaPayInvoice({
        amount: invoiceAmount,
        currency,
        orderId: transactionId.toString(),
        callbackUrl: `${siteUrl()}/api/oxapay/webhook`,
        returnUrl: `${siteUrl()}/add-funds?paid=1&tx=${transactionId.toString()}`,
        email: authUser.email,
        lifetimeMinutes: settings.invoiceLifetimeMinutes,
        feePaidByPayer: settings.feePaidByPayer,
        underPaidCoverage: settings.underPaidCoverage,
        sandbox: config.sandbox,
      });

      await db.collection("transactions").updateOne(
        { _id: transactionId, status: "creating" },
        {
          $set: {
            status: "pending",
            oxapay_track_id: invoice.trackId,
            oxapay_payment_url: invoice.paymentUrl,
            oxapay_expires_at: invoice.expiresAt ? new Date(invoice.expiresAt * 1000) : null,
            oxapay_status: "new",
            updated_at: new Date(),
          },
        },
      );

      return res.status(200).json({
        success: true,
        transactionId: transactionId.toString(),
        trackId: invoice.trackId,
        paymentUrl: invoice.paymentUrl,
        // The wallet credit, always in INR.
        amount: creditInr,
        currency: "INR",
        invoiceCurrency: currency,
        invoiceAmount,
        rate,
        feePayer: settings.feePayer,
        sandbox: config.sandbox,
        expiresInSeconds: settings.invoiceLifetimeMinutes * 60,
        message: "Complete the crypto payment on the next screen. Your wallet is credited automatically once the network confirms.",
      });
    } catch (error: any) {
      if (transactionId) {
        await db.collection("transactions").updateOne(
          { _id: transactionId, status: "creating" },
          { $set: { status: "failed", failure_stage: "oxapay_invoice_creation", updated_at: new Date() } },
        ).catch(() => {});
      }
      const status = error instanceof OxaPayApiError ? error.status : 502;
      console.error("OxaPay create-invoice error:", error?.message || error);
      return res.status(status).json({
        error: error instanceof OxaPayApiError
          ? error.message
          : "Unable to start a crypto payment. Please try again.",
      });
    }
  }

  if (action === "status") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");

    const rate = await checkRateLimit(`oxapay_status_${authUser.userId}`, 90, 300, db);
    if (!rate.allowed) {
      return res.status(429).json({ error: `Too many status checks. Please wait ${rate.remainingSec} seconds.` });
    }

    const transactionId = String(req.query.transactionId || "").trim();
    if (!ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: "Invalid transaction ID." });
    }

    try {
      const tx = await db.collection("transactions").findOne({
        _id: new ObjectId(transactionId),
        user_id: new ObjectId(authUser.userId),
        method: "OXAPAY_CRYPTO",
      });
      if (!tx) return res.status(404).json({ error: "Payment request not found." });

      if (tx.status === "paid" || tx.status === "test_paid") {
        const user = await db.collection("users").findOne({ _id: new ObjectId(authUser.userId) });
        return res.status(200).json({
          success: true,
          status: tx.status,
          amount: tx.amount,
          newBalance: Number(user?.balance || 0),
          walletCredited: tx.wallet_credited !== false,
          message: tx.wallet_credited === false
            ? "Crypto payment verified in sandbox mode. No live wallet balance was added."
            : "Payment confirmed and credited to your wallet.",
        });
      }

      if (tx.payment_review_required) {
        return res.status(200).json({
          success: true,
          status: "review",
          message: "Your payment needs a quick review by our team. It is safe — please do not pay again.",
        });
      }

      if (tx.status === "pending" && tx.expires_at && new Date(tx.expires_at) <= new Date()) {
        await db.collection("transactions").updateOne(
          { _id: tx._id, status: "pending" },
          { $set: { status: "expired", expired_at: new Date(), updated_at: new Date() } },
        );
        return res.status(200).json({ success: true, status: "expired", message: "This payment request expired. Please start a new one." });
      }

      return res.status(200).json({
        success: true,
        status: tx.status || "pending",
        amount: tx.amount,
        // The hosted checkout link, so a restored session can resume paying.
        paymentUrl: tx.oxapay_payment_url || null,
        trackId: tx.oxapay_track_id || null,
      });
    } catch (error: any) {
      console.error("OxaPay status error:", error?.message || error);
      return res.status(500).json({ error: "Unable to check payment status." });
    }
  }

  /**
   * Authoritative re-check. The webhook settles the invoice; this exists so a
   * lost webhook can still be recovered from the browser.
   */
  if (action === "verify") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!sameOriginIfPresent(req)) return res.status(403).json({ error: "Invalid request origin." });

    const rate = await checkRateLimit(`oxapay_verify_${authUser.userId}`, 12, 300, db);
    if (!rate.allowed) {
      return res.status(429).json({ error: `Too many verification attempts. Please wait ${rate.remainingSec} seconds.` });
    }

    const transactionId = String(req.body?.transactionId || "").trim();
    if (!ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: "Invalid transaction ID." });
    }

    try {
      const tx = await db.collection("transactions").findOne({
        _id: new ObjectId(transactionId),
        user_id: new ObjectId(authUser.userId),
        method: "OXAPAY_CRYPTO",
      });
      if (!tx) return res.status(404).json({ error: "Payment request not found." });
      if (!tx.oxapay_track_id || !isOxaPayTrackId(tx.oxapay_track_id)) {
        return res.status(400).json({ error: "This payment request has no provider reference." });
      }

      const config = getOxaPayConfig();
      const payment = await fetchOxaPayPayment(tx.oxapay_track_id);

      if (payment.status !== "paid" && payment.status !== "manual_accept") {
        return res.status(200).json({
          success: true,
          status: payment.status,
          message: payment.status === "underpaid"
            ? "Your payment was short by a small amount and is being reviewed by our team."
            : "Waiting for the network to confirm your payment.",
        });
      }

      const result = await settleCryptoDeposit({
        internalTransactionId: transactionId,
        trackId: tx.oxapay_track_id,
        expectedUserId: authUser.userId,
        expectedAmountPaise: Math.round(Number(tx.amount_paise)),
        payment,
        eventId: `oxapay_verify:${tx.oxapay_track_id}`,
        eventType: "invoice.paid",
        sandbox: config.sandbox,
        allowSandboxCredit: allowSandboxCredit(),
      });

      if (!result.alreadySettled && result.walletCredited) {
        sendPaymentSuccessAlert({
          userEmail: authUser.email,
          amount: result.amount,
          method: "Crypto (OxaPay)",
          transactionId: tx.oxapay_track_id,
          memo: tx.oxapay_track_id,
          newBalance: result.newBalance,
        }).catch((error) => console.error("OxaPay Telegram log error:", error));
      }

      return res.status(200).json({
        success: true,
        status: result.walletCredited ? "paid" : "test_paid",
        newBalance: result.newBalance,
        walletCredited: result.walletCredited,
        message: result.alreadySettled
          ? "Payment was already verified and credited to your wallet."
          : `Payment verified! ₹${result.amount.toFixed(2)} added to your wallet balance.`,
      });
    } catch (error: any) {
      const status = error instanceof OxaPayApiError || error instanceof Error ? (error as any).status || 500 : 500;
      console.error("OxaPay verify error:", error?.message || error);
      return res.status(status).json({
        error: "Unable to verify the crypto payment. It remains safe for reconciliation.",
      });
    }
  }

  return res.status(404).json({ error: "Crypto payment action not found." });
}

async function handleOxaPayWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid request body." });
  }

  const signature = headerValue(req, "hmac");
  if (!signature) return res.status(400).json({ error: "Missing OxaPay signature." });
  if (!verifyOxaPayWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid OxaPay webhook signature." });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid webhook JSON." });
  }

  const trackId = cleanText(event?.track_id, 64);
  if (!trackId || !isOxaPayTrackId(trackId)) {
    return res.status(200).json({ received: true, ignored: true });
  }

  // OxaPay provides no event identifier and may re-deliver the same logical
  // event with a different body, so the raw-body fingerprint is the event id.
  const eventId = `oxapay:${createHash("sha256").update(rawBody).digest("hex")}`;
  const providerStatus = normalizeOxaPayStatus(event?.status);

  try {
    await ensurePaymentProviderIndexes();
    const db = await getDb();

    const tx: any = await db.collection("transactions").findOne({ oxapay_track_id: trackId });
    if (!tx) {
      await recordProviderEvent({
        provider: "oxapay",
        eventId,
        eventType: `invoice.${providerStatus}`,
        providerOrderId: trackId,
        payload: { outcome: "orphan" },
      });
      return res.status(200).json({ received: true, ignored: true });
    }

    if (tx.status === "paid" || tx.status === "test_paid") {
      return res.status(200).json({ received: true, settled: true, duplicate: true });
    }

    // Authoritative provider state — the body above is never trusted.
    const payment = await fetchOxaPayPayment(trackId);
    const status = payment.status;

    if (status === "underpaid") {
      const observedAmountPaise = payment.amount !== null ? Math.round(payment.amount * 100) : null;
      await flagCryptoPaymentForReview({
        trackId,
        providerStatus: status,
        observedAmountPaise,
        reason: `OxaPay reported an underpaid invoice (${observedAmountPaise ?? "unknown"} of ${Math.round(Number(tx.amount_paise))} paise expected).`,
      });
      await recordProviderEvent({
        provider: "oxapay",
        eventId,
        eventType: "invoice.underpaid",
        providerOrderId: trackId,
        payload: { outcome: "underpaid", observed_amount_paise: observedAmountPaise },
      });
      return res.status(200).json({ received: true, settled: false, reviewRequired: true });
    }

    if (status === "refunding" || status === "refunded") {
      await flagCryptoPaymentForReview({
        trackId,
        providerStatus: status,
        reason: `OxaPay reported a ${status} crypto invoice. Wallet reconciliation is required.`,
      });
      await recordProviderEvent({
        provider: "oxapay",
        eventId,
        eventType: `invoice.${status}`,
        providerOrderId: trackId,
        payload: { outcome: status },
      });
      return res.status(200).json({ received: true, settled: false, reviewRequired: true });
    }

    if (status !== "paid" && status !== "manual_accept") {
      if (status === "expired" && tx.status === "pending") {
        await db.collection("transactions").updateOne(
          { _id: tx._id, status: "pending" },
          { $set: { status: "expired", expired_at: new Date(), oxapay_status: status, updated_at: new Date() } },
        );
      }
      await recordProviderEvent({
        provider: "oxapay",
        eventId,
        eventType: `invoice.${status}`,
        providerOrderId: trackId,
        payload: { outcome: "not_paid", provider_status: status },
      });
      return res.status(200).json({ received: true, settled: false, providerStatus: status });
    }

    const result = await settleCryptoDeposit({
      internalTransactionId: tx._id.toString(),
      trackId,
      expectedUserId: tx.user_id?.toString(),
      expectedAmountPaise: Math.round(Number(tx.amount_paise)),
      payment,
      eventId,
      eventType: `invoice.${status}`,
      sandbox: tx.environment === "sandbox",
      allowSandboxCredit: String(process.env.OXAPAY_ALLOW_SANDBOX_CREDIT || "false").trim() === "true",
    });

    // The customer cancelled this invoice but the money still arrived. It is
    // credited (never dropped) and flagged so the owner can reconcile.
    if (tx.status === "cancelled" && !result.alreadySettled && result.walletCredited) {
      await db.collection("transactions").updateOne(
        { _id: tx._id },
        {
          $set: {
            payment_review_required: true,
            payment_review_reason: "A cancelled crypto invoice was paid after cancellation.",
            updated_at: new Date(),
          },
        },
      );
    }

    if (!result.alreadySettled && result.walletCredited) {
      const settledUser = await db.collection("users").findOne(
        { _id: new ObjectId(result.userId) },
        { projection: { email: 1 } },
      );
      sendPaymentSuccessAlert({
        userEmail: String(settledUser?.email || tx.user_email || "unknown"),
        amount: result.amount,
        method: "Crypto (OxaPay)",
        transactionId: trackId,
        memo: trackId,
        newBalance: result.newBalance,
      }).catch((error) => console.error("OxaPay webhook alert error:", error));
    }

    return res.status(200).json({ received: true, settled: true, duplicate: result.alreadySettled });
  } catch (error: any) {
    const known = error instanceof OxaPayApiError;
    console.error("OxaPay webhook error:", error?.message || error);
    // Acknowledge so OxaPay does not retry-storm; the reconciliation sweep
    // re-checks this invoice shortly.
    return res.status(200).json({ received: true, settled: false, deferred: true, error: known ? error.message : "Deferred to reconciliation." });
  }
}


export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleOxaPayRequest(req, res);
  } catch (error: any) {
    console.error("handleOxaPayRequest uncaught error:", error?.message || error);
    if (res.headersSent) return;
    return res.status(503).json({ error: "Service temporarily unavailable. Please try again shortly." });
  }
}
