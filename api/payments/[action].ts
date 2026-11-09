import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { ensureDirectUpiIndexes, getDb, getMongoClient } from "../../server/lib/db.js";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import { normalizeDirectUpiReceiptMemo, settleDirectUpiPayment } from "../../server/lib/directUpiSettlement.js";
import {
  releaseDirectUpiAmountReservation,
  reserveUniqueDirectUpiAmount,
} from "../../server/lib/directUpiQuote.js";
import { searchFamPayPaymentDetailed } from "../../server/lib/imap.js";
import { notifyMoneyAdded, notifyPaymentDelayed, notifyOrderPlaced } from "../../server/lib/paymentNotifications.js";
import { getEnabledPaymentMethods } from "../../server/lib/paymentMethods.js";

/**
 * Generates SUP + 5-character uppercase alphanumeric memo
 * Total combinations: 36^5 = 60,466,176
 */
const MIN_DIRECT_UPI_AMOUNT_INR = 10;

function sameOriginIfPresent(req: VercelRequest): boolean {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const host = typeof req.headers.host === "string" ? req.headers.host : "";
  if (!origin) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

function maxDirectUpiAmountInr(): number {
  return Math.max(
    MIN_DIRECT_UPI_AMOUNT_INR,
    Math.min(Number(process.env.DIRECT_UPI_MAX_AMOUNT_INR || 100_000), 1_000_000),
  );
}

function lateVerificationHours(): number {
  const configured = Number.parseInt(String(process.env.DIRECT_UPI_LATE_VERIFICATION_HOURS || "24"), 10);
  return Number.isFinite(configured) ? Math.max(1, Math.min(configured, 72)) : 24;
}

function generateDynamicMemo(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    const idx = crypto.randomInt(0, chars.length);
    suffix += chars[idx];
  }
  return "SUP" + suffix;
}

async function handlePaymentsRequest(req: VercelRequest, res: VercelResponse) {
  const { action } = req.query;
  if (!["GET", "HEAD", "OPTIONS"].includes(String(req.method || "GET").toUpperCase()) && !sameOriginIfPresent(req)) {
    return res.status(403).json({ error: "Invalid request origin." });
  }
  const db = await getDb();
  const authUser = await getUserFromRequest(req, db);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const readOnlyAction = ["history", "config", "methods"].includes(String(action)) && req.method === "GET";
  if (denySupportMutation(authUser, res, readOnlyAction)) return;

  if (action === "config") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({
      minAmount: MIN_DIRECT_UPI_AMOUNT_INR,
      maxAmount: maxDirectUpiAmountInr(),
    });
  }

  // ── Payment method catalogue ──────────────────────────────────────────────
  // The single source of truth for which methods a customer may use. Only
  // ENABLED and CONFIGURED methods are returned, so a disabled method is
  // absent from the list entirely: the website never renders it, never
  // includes it in the amount maths, and never names it in an error.
  if (action === "methods") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    try {
      const methods = await getEnabledPaymentMethods(db);
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return res.status(200).json({ success: true, methods });
    } catch (error: any) {
      console.error("Payment methods error:", error?.message || error);
      return res.status(503).json({ error: "Payment methods are temporarily unavailable." });
    }
  }

  // ── Cancel a pending request (wrong amount, customer changed their mind) ──
  // Cancelling only closes OUR record. The provider order is left alone,
  // because the money may still arrive and must never be silently dropped:
  // if a payment lands on a cancelled order the webhook still settles it and
  // flags it for owner review. A credited deposit can never be cancelled.
  if (action === "cancel") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const rate = await checkRateLimit(`payment_cancel_${authUser.userId}`, 20, 300, db);
    if (!rate.allowed) {
      return res.status(429).json({ error: `Too many cancellation attempts. Please wait ${rate.remainingSec} seconds.` });
    }

    const transactionId = String(req.body?.transactionId || "").trim();
    if (!ObjectId.isValid(transactionId)) {
      return res.status(400).json({ error: "Invalid transaction ID." });
    }

    const tx: any = await db.collection("transactions").findOne({
      _id: new ObjectId(transactionId),
      user_id: new ObjectId(authUser.userId),
    });

    if (!tx) return res.status(404).json({ error: "Payment request not found." });

    if (tx.status === "paid" || tx.status === "test_paid") {
      return res.status(409).json({
        error: "This deposit is already credited, so it cannot be cancelled. If the amount is wrong, contact support.",
      });
    }
    if (tx.status === "cancelled") {
      return res.status(200).json({ success: true, alreadyCancelled: true, message: "This payment request was already cancelled." });
    }
    if (!["FAMPAY_UPI", "FAMGATEWAY_UPI", "OXAPAY_CRYPTO"].includes(String(tx.method))) {
      return res.status(409).json({ error: "This payment request cannot be cancelled." });
    }
    if (!["pending", "creating", "expired"].includes(String(tx.status))) {
      return res.status(409).json({ error: "This payment request is not in a cancellable state." });
    }

    const updated = await db.collection("transactions").updateOne(
      { _id: tx._id, status: tx.status, wallet_credited: { $ne: true } },
      {
        $set: {
          status: "cancelled",
          cancelled_at: new Date(),
          cancelled_by: "customer",
          updated_at: new Date(),
        },
      },
    );

    if (updated.modifiedCount !== 1) {
      return res.status(409).json({ error: "This payment request changed while cancelling. Please refresh and try again." });
    }

    // Release the unique direct-UPI amount reservation so the money is free again.
    if (tx.method === "FAMPAY_UPI" && tx.memo) {
      await db.collection("direct_upi_amount_reservations").updateMany(
        { memo: tx.memo, status: "reserved" },
        { $set: { status: "released", released_at: new Date() } },
      ).catch(() => {});
    }

    await db.collection("payment_events").insertOne({
      provider: "site",
      event_id: `cancel:${transactionId}`,
      event_type: "payment.cancelled",
      transaction_id: tx._id,
      status: "cancelled",
      received_at: new Date(),
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Payment request cancelled. You can create a new one with the correct amount.",
    });
  }

  const userObjectId = new ObjectId(authUser.userId);
  if (["create-order", "verify-identifier", "verify-utr"].includes(String(action))) {
    // Do not let legacy memo migration block read-only history or authentication,
    // but fail closed before creating or settling a Direct-UPI payment.
    await ensureDirectUpiIndexes(db);
    const hold = await db.collection("users").findOne(
      { _id: userObjectId },
      { projection: { payment_hold: 1 } },
    );
    if (hold?.payment_hold) {
      return res.status(403).json({ error: "Deposits are temporarily paused on this account. Please contact support." });
    }
  }

  // ── 1. CREATE PAYMENT ORDER (DYNAMIC QR WITH SUP + 5-CHAR ALPHANUMERIC MEMO) ──
  if (action === "create-order") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const createRate = await checkRateLimit(`payment_create_${authUser.userId}`, 8, 300, db);
    if (!createRate.allowed) return res.status(429).json({ error: `Too many payment requests. Try again in ${createRate.remainingSec}s.` });
    const { amount } = req.body || {};
    const numAmount = Number(amount);

    const maxDirectUpiAmount = maxDirectUpiAmountInr();
    if (!Number.isFinite(numAmount) || numAmount < MIN_DIRECT_UPI_AMOUNT_INR || numAmount > maxDirectUpiAmount || Math.abs(numAmount - Math.round(numAmount * 100) / 100) > 0.000001) {
      return res.status(400).json({ error: `Deposit amount must be between ₹${MIN_DIRECT_UPI_AMOUNT_INR} and ₹${maxDirectUpiAmount.toLocaleString("en-IN")} with at most two decimals.` });
    }

    const upiVpa = String(process.env.UPI_VPA || "").trim();
    const merchantName = String(process.env.UPI_MERCHANT_NAME || "SMM UP").trim().slice(0, 80);
    if (!upiVpa) return res.status(500).json({ error: "Payment configuration missing. Contact support." });

    try {
      const pendingTtlMinutes = Math.max(5, Math.min(Number.parseInt(String(process.env.DIRECT_UPI_PENDING_TTL_MINUTES || "30"), 10) || 30, 180));
      const requestedAmountPaise = Math.round(numAmount * 100);
      const minAmountPaise = Math.round(MIN_DIRECT_UPI_AMOUNT_INR * 100);
      const maxAmountPaise = Math.round(maxDirectUpiAmount * 100);
      let memo = "";
      let transactionId = "";
      let payableAmount = 0;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        memo = generateDynamicMemo();
        const createdAt = new Date();
        const pendingId = new ObjectId();
        const reservation = await reserveUniqueDirectUpiAmount(db, {
          pendingId,
          requestedAmountPaise,
          minAmountPaise,
          maxAmountPaise,
          reservedUntil: new Date(createdAt.getTime() + lateVerificationHours() * 60 * 60_000),
        });
        try {
          await db.collection("transactions").insertOne({
            _id: pendingId,
            user_id: userObjectId,
            user_email: authUser.email,
            requested_amount: numAmount,
            amount: reservation.amount,
            quoted_amount_paise: reservation.amountPaise,
            unique_amount_reservation: true,
            direct_upi_amount_reservation_expires_at: reservation.expiresAt,
            method: "FAMPAY_UPI",
            upi_id: upiVpa,
            memo,
            status: "pending",
            delay_alert_sent: false,
            created_at: createdAt,
            expires_at: new Date(createdAt.getTime() + pendingTtlMinutes * 60_000),
          });
          transactionId = pendingId.toString();
          payableAmount = reservation.amount;
          break;
        } catch (error: any) {
          await releaseDirectUpiAmountReservation(db, pendingId).catch(() => {});
          if (error?.code === 11000) continue;
          throw error;
        }
      }
      if (!transactionId || !payableAmount) throw new Error("Unable to allocate a unique payment reference and amount.");

      const upiQuery = new URLSearchParams({
        pa: upiVpa,
        pn: merchantName,
        am: payableAmount.toFixed(2),
        tn: memo,
        tr: memo,
        cu: "INR",
      });
      const upiUrl = `upi://pay?${upiQuery.toString()}`;

      notifyOrderPlaced({
        userEmail: authUser.email,
        amount: payableAmount,
        method: "FAMPAY_UPI",
        provider: "direct_upi",
        providerOrderId: memo,
        transactionId,
      }).catch((error) => console.error("Direct UPI order-placed notify error:", error));

      return res.status(200).json({
        success: true,
        transactionId,
        requestedAmount: numAmount,
        amount: payableAmount,
        memo,
        upiVpa,
        upiUrl,
        // The customer needs to know when this QR stops working.
        expiresInSeconds: pendingTtlMinutes * 60,
        message: `Pay exactly ₹${payableAmount.toFixed(2)}. The unique paise safely identifies this deposit if the UPI app removes the payment note.`,
      });
    } catch (err: any) {
      console.error("Create deposit order error:", err);
      return res.status(500).json({ error: "Failed to generate payment QR" });
    }
  }

  // ── 2. CHECK STATUS / LIVE POLLING (ZERO-CLICK AUTO-CREDIT VIA MEMO) ──
  if (action === "check-status") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    const memo = String(req.query.memo || req.body?.memo || "").trim().toUpperCase();
    const txnId = String(req.query.transactionId || req.body?.transactionId || "").trim();

    if (!memo && !txnId) {
      return res.status(400).json({ error: "memo or transactionId is required" });
    }
    if (!memo && !ObjectId.isValid(txnId)) {
      return res.status(400).json({ error: "Invalid Direct UPI transaction ID" });
    }

    try {
      const tx = await db.collection("transactions").findOne({
        user_id: userObjectId,
        method: "FAMPAY_UPI",
        ...(memo ? { memo } : { _id: new ObjectId(txnId) }),
      });

      if (!tx) {
        return res.status(404).json({ error: "Deposit order not found" });
      }

      // Case 1: Already paid and credited
      if (tx.status === "paid") {
        const currentUser = await db.collection("users").findOne({ _id: userObjectId });
        return res.status(200).json({
          status: "paid",
          amount: tx.amount,
          utr: tx.utr,
          transactionId: tx.transaction_id,
          newBalance: currentUser?.balance || 0,
          alreadyCredited: true,
          message: "Payment confirmed and credited to wallet.",
        });
      }

      if (tx.status === "expired" || (tx.expires_at && new Date(tx.expires_at) <= new Date())) {
        if (tx.status === "pending") {
          await db.collection("transactions").updateOne(
            { _id: tx._id, status: "pending" },
            { $set: { status: "expired", expired_at: new Date() } },
          );
        }
        return res.status(200).json({ status: "expired", message: "This payment request expired. Generate a fresh QR." });
      }

      // Calculate elapsed waiting time
      const createdAt = new Date(tx.created_at).getTime();
      const elapsedSeconds = Math.max(0, (Date.now() - createdAt) / 1000);

      // Trigger Delayed Payment Alert to Telegram Admin Group (between 60-90s, sent once)
      if (elapsedSeconds >= 75 && !tx.delay_alert_sent) {
        const claimId = crypto.randomBytes(16).toString("hex");
        const claimCutoff = new Date(Date.now() - 2 * 60_000);
        const claimedAlert = await db.collection("transactions").findOneAndUpdate(
          {
            _id: tx._id,
            status: "pending",
            delay_alert_sent: { $ne: true },
            $or: [
              { delay_alert_claimed_at: { $exists: false } },
              { delay_alert_claimed_at: { $lt: claimCutoff } },
            ],
          },
          { $set: { delay_alert_claim_id: claimId, delay_alert_claimed_at: new Date() } },
          { returnDocument: "after" },
        );

        if (claimedAlert) {
          const alertSent = await notifyPaymentDelayed({
            userEmail: authUser.email,
            amount: tx.amount,
            memo: tx.memo,
            elapsedSeconds,
            upiVpa: tx.upi_id,
          });
          if (alertSent) {
            await db.collection("transactions").updateOne(
              { _id: tx._id, delay_alert_claim_id: claimId },
              {
                $set: { delay_alert_sent: true, delay_alert_at: new Date() },
                $unset: { delay_alert_claim_id: "", delay_alert_claimed_at: "" },
              },
            );
          } else {
            await db.collection("transactions").updateOne(
              { _id: tx._id, delay_alert_claim_id: claimId, delay_alert_sent: { $ne: true } },
              { $unset: { delay_alert_claim_id: "", delay_alert_claimed_at: "" } },
            );
          }
        }
      }

      // MongoDB poll only: instant 1ms response, 0 Gmail IMAP connections
      return res.status(200).json({
        status: "pending",
        elapsedSeconds: Math.round(elapsedSeconds),
        memo: tx.memo,
      });
    } catch (err: any) {
      console.error("Check status error:", err);
      return res.status(500).json({ error: "Failed to check payment status" });
    }
  }

  // ── 3. MANUAL VERIFICATION: ACCEPTS 12-DIGIT UTR, FAMPAY TX ID, OR REF ──────
  if (action === "verify-identifier" || action === "verify-utr") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Rate limit: max 5 verification attempts per 3 minutes (cooldown guard)
    const rateLimitKey = `payment_verify_${authUser.userId}`;
    const { allowed, remainingSec } = await checkRateLimit(rateLimitKey, 5, 180, db);
    if (!allowed) {
      return res.status(429).json({
        error: `Too many verification requests. Please wait ${remainingSec} seconds before submitting again.`,
      });
    }

    const { identifier, utr, amount, transactionId, memo } = req.body || {};
    const pendingTransactionId = String(transactionId || "").trim();
    const expectedMemo = String(memo || "").trim().toUpperCase();
    const rawInput = String(identifier || utr || "").trim();
    // Sanitize strictly to alphanumeric characters
    const cleanInput = rawInput.replace(/[^A-Za-z0-9]/g, "");
    const requestedAmount = Number(amount);

    if (!cleanInput || cleanInput.length < 6 || cleanInput.length > 40) {
      return res.status(400).json({
        error: "Please enter a valid 12-digit UTR, FamPay Transaction ID, or Bank Reference number.",
      });
    }

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount specified." });
    }

    if (!ObjectId.isValid(pendingTransactionId)) {
      return res.status(400).json({ error: "The pending deposit reference is missing or invalid. Please create a fresh payment request." });
    }

    try {
      const pendingId = new ObjectId(pendingTransactionId);
      const pendingDeposit: any = await db.collection("transactions").findOne({
        _id: pendingId,
        user_id: userObjectId,
        method: "FAMPAY_UPI",
      });
      if (!pendingDeposit || Math.round(Number(pendingDeposit.amount) * 100) !== Math.round(requestedAmount * 100)) {
        return res.status(400).json({
          error: "This payment request does not match your account and amount. Do not pay again; contact support with the receipt.",
        });
      }
      if (pendingDeposit.status === "paid") {
        const currentUser = await db.collection("users").findOne({ _id: userObjectId }, { projection: { balance: 1 } });
        return res.status(200).json({
          success: true,
          alreadyCredited: true,
          amount: Number(pendingDeposit.amount),
          utr: pendingDeposit.utr,
          transactionId: pendingDeposit.transaction_id,
          newBalance: Number(currentUser?.balance || 0),
          message: "This payment was already verified and credited to your wallet.",
        });
      }
      const verificationCutoff = new Date(Date.now() - lateVerificationHours() * 60 * 60_000);
      if (!["pending", "expired"].includes(String(pendingDeposit.status)) || new Date(pendingDeposit.created_at) <= verificationCutoff) {
        return res.status(409).json({
          error: "This paid request is outside automatic verification time. Do not pay again; contact support with this UTR and receipt for reconciliation.",
        });
      }
      const storedMemo = String(pendingDeposit.memo || "").trim().toUpperCase();
      if (!expectedMemo || expectedMemo !== storedMemo) {
        return res.status(400).json({ error: "The payment memo does not match this pending deposit." });
      }

      // Search the full bounded recovery window rather than only the newly
      // displayed QR. This allows an exact UTR to restore its original pending
      // request after a browser refresh/redeployment.
      const receiptLookup = await searchFamPayPaymentDetailed({
        identifier: cleanInput,
        memo: storedMemo,
        minDate: verificationCutoff,
      });
      const parsedPayment = receiptLookup.payment;
      if (!parsedPayment) {
        const reconciliationReason = `receipt_${receiptLookup.reason}`;
        await db.collection("payment_reconciliation").updateOne(
          {
            pending_transaction_id: pendingId,
            identifier: cleanInput,
            status: "open",
            reason: reconciliationReason,
          },
          {
            $set: {
              user_id: userObjectId,
              expected_amount: requestedAmount,
              memo: storedMemo,
              trusted_receipt_count: receiptLookup.trustedReceiptCount,
              parsed_receipt_count: receiptLookup.parsedReceiptCount,
              mailboxes_scanned: receiptLookup.mailboxesScanned,
              last_seen_at: new Date(),
            },
            $inc: { attempts: 1 },
            $setOnInsert: { created_at: new Date(), status: "open" },
          },
          { upsert: true },
        );

        const failure = receiptLookup.reason === "no_trusted_receipts"
          ? {
              status: 404,
              errorCode: "TRUSTED_RECEIPT_NOT_DELIVERED",
              error: "The payment mailbox is reachable, but no trusted FamApp receipt is present in Inbox or All Mail for this payment yet. Do not pay again. Check that the receiving FamApp account sent its email alert, then retry this same UTR.",
            }
          : receiptLookup.reason === "trusted_receipts_unreadable"
            ? {
                status: 422,
                errorCode: "TRUSTED_RECEIPT_FORMAT_UNREADABLE",
                error: "A trusted FamApp alert exists, but its current receipt format could not be read safely. The payment is flagged for reconciliation; do not pay again and contact support with the receipt.",
              }
            : {
                status: 404,
                errorCode: "EXACT_IDENTIFIER_NOT_FOUND",
                error: "Trusted FamApp receipts were found, but none contains this exact UTR or transaction ID. Recheck the identifier from the successful payment receipt; do not pay again.",
              };
        return res.status(failure.status).json({ error: failure.error, errorCode: failure.errorCode });
      }

      const parsedAmountPaise = Math.round(parsedPayment.amount * 100);
      const receiptDate = parsedPayment.date instanceof Date ? parsedPayment.date : null;
      if (!receiptDate || !Number.isFinite(receiptDate.getTime()) || receiptDate < verificationCutoff) {
        return res.status(409).json({
          errorCode: "RECEIPT_OUTSIDE_VERIFICATION_WINDOW",
          error: "The trusted receipt is outside the bounded verification window. Do not pay again; contact support for reconciliation.",
        });
      }

      const observedReceiptReference = String(parsedPayment.purpose || "").trim().toUpperCase();
      const receiptMemo = normalizeDirectUpiReceiptMemo(observedReceiptReference);
      let settlementDeposit: any = null;
      let allowMissingMemoWithUniqueAmount = false;
      let allowMissingMemoWithExactIdentifierAmount = false;

      if (receiptMemo) {
        // A transmitted SUP reference is authoritative and can restore the
        // original request even if the browser currently holds a newer QR.
        settlementDeposit = await db.collection("transactions").findOne({
          user_id: userObjectId,
          method: "FAMPAY_UPI",
          memo: receiptMemo,
          status: { $in: ["pending", "expired"] },
          created_at: { $gt: verificationCutoff },
        });
        if (settlementDeposit && Math.round(Number(settlementDeposit.amount) * 100) !== parsedAmountPaise) {
          return res.status(400).json({
            errorCode: "RECEIPT_AMOUNT_MISMATCH",
            error: `Amount mismatch: Receipt indicates ₹${parsedPayment.amount.toFixed(2)}, but the referenced request requires ₹${Number(settlementDeposit.amount).toFixed(2)}. Do not pay again; contact support.`,
          });
        }
      } else {
        // FamApp/CRED can remove tn/tr from its receipt. Missing SUP may settle
        // only when the server reserved this exact paise amount globally for one
        // pending transaction throughout the late-verification window.
        const reservation: any = await db.collection("direct_upi_amount_reservations").findOne({
          amount_paise: parsedAmountPaise,
          expires_at: { $gt: new Date() },
          created_at: { $lte: receiptDate },
        });
        if (reservation?.pending_transaction_id) {
          settlementDeposit = await db.collection("transactions").findOne({
            _id: reservation.pending_transaction_id,
            user_id: userObjectId,
            method: "FAMPAY_UPI",
            status: { $in: ["pending", "expired"] },
            unique_amount_reservation: true,
            quoted_amount_paise: parsedAmountPaise,
            created_at: { $gt: verificationCutoff },
          });
          allowMissingMemoWithUniqueAmount = Boolean(settlementDeposit);
        }

        // An exact UTR/reference/FMPIB identifier is itself replay-protected.
        // If no reservation exists (for example, a legacy whole-rupee request),
        // bind it to the latest eligible request for this same account and exact
        // amount that existed when the trusted receipt arrived.
        if (!settlementDeposit) {
          settlementDeposit = await db.collection("transactions").findOne({
            user_id: userObjectId,
            method: "FAMPAY_UPI",
            amount: parsedPayment.amount,
            status: { $in: ["pending", "expired"] },
            created_at: {
              $gt: verificationCutoff,
              $lte: new Date(receiptDate.getTime() + 5 * 60_000),
            },
          }, { sort: { created_at: -1 } });
          allowMissingMemoWithExactIdentifierAmount = Boolean(settlementDeposit);
        }
      }

      const settlementCreatedAt = settlementDeposit ? new Date(settlementDeposit.created_at) : null;
      if (
        !settlementDeposit
        || !settlementCreatedAt
        || !Number.isFinite(settlementCreatedAt.getTime())
        || receiptDate.getTime() < settlementCreatedAt.getTime() - 5 * 60_000
      ) {
        const reason = receiptMemo ? "receipt_memo_mismatch" : "receipt_memo_missing_without_owned_amount_match";
        await db.collection("payment_reconciliation").updateOne(
          { memo: storedMemo, status: "open", reason },
          {
            $set: {
              pending_transaction_id: pendingId,
              user_id: userObjectId,
              identifier: cleanInput,
              ...(observedReceiptReference ? { observed_reference: observedReceiptReference } : {}),
              observed_amount: parsedPayment.amount,
              receipt_date: receiptDate,
              last_seen_at: new Date(),
            },
            $inc: { attempts: 1 },
            $setOnInsert: { created_at: new Date(), status: "open" },
          },
          { upsert: true },
        );
        return res.status(409).json({
          errorCode: receiptMemo ? "RECEIPT_REFERENCE_MISMATCH" : "RECEIPT_REFERENCE_MISSING",
          error: receiptMemo
            ? "The trusted receipt reference does not match an eligible deposit owned by this account. It has been flagged for reconciliation; do not pay again."
            : "The exact identifier was found, but no eligible request on this account has the same amount and receipt timing. The payment is flagged for owner reconciliation; do not pay again.",
        });
      }

      const finalUtr = String(parsedPayment.utr || rawInput).replace(/[^A-Za-z0-9]/g, "");
      const finalTxId = String(parsedPayment.transactionId || rawInput).replace(/[^A-Za-z0-9]/g, "");
      const client = await getMongoClient();
      const { newBalance } = await settleDirectUpiPayment({
        db,
        client,
        userId: userObjectId,
        userEmail: authUser.email,
        pendingId: settlementDeposit._id,
        expectedAmount: Number(settlementDeposit.amount),
        expectedMemo: String(settlementDeposit.memo || "").trim().toUpperCase(),
        receivedAmount: parsedPayment.amount,
        receiptMemo: parsedPayment.purpose,
        receiptDate,
        allowMissingMemoWithUniqueAmount,
        allowMissingMemoWithExactIdentifierAmount,
        utr: finalUtr,
        transactionId: finalTxId,
        sender: parsedPayment.sender,
        source: "manual_identifier_verify",
        allowExpiredWithinHours: lateVerificationHours(),
      });

      notifyMoneyAdded({
        userEmail: authUser.email,
        amount: parsedPayment.amount,
        method: "FAMPAY_UPI",
        provider: "direct_upi",
        providerOrderId: String(settlementDeposit.memo || storedMemo),
        transactionId: finalTxId,
        utr: finalUtr,
        newBalance,
      }).catch((e) => console.error("Telegram log error:", e));

      return res.status(200).json({
        success: true,
        amount: parsedPayment.amount,
        utr: finalUtr,
        transactionId: finalTxId,
        newBalance,
        message: `Payment verified! ₹${parsedPayment.amount.toFixed(2)} added to your wallet balance.`,
      });
    } catch (err: any) {
      if (err?.code === "PAYMENT_MAILBOX_UNAVAILABLE") {
        return res.status(503).json({
          errorCode: "PAYMENT_MAILBOX_UNAVAILABLE",
          error: "Bank verification is temporarily unavailable. Your payment is not lost—do not pay again. Retry the same UTR shortly or contact support.",
        });
      }
      if (err?.code === 11000) {
        return res.status(409).json({ error: "This payment has already been claimed or settled." });
      }
      if (err?.code === "PENDING_DEPOSIT_STALE") {
        return res.status(409).json({ error: "This pending deposit expired or was settled by another request." });
      }
      if (err?.code === "PAYMENT_HOLD_ACTIVE") {
        return res.status(403).json({ error: "Deposits are temporarily disabled for this account." });
      }
      if (err?.code === "RECEIPT_MISMATCH") {
        return res.status(400).json({ errorCode: "RECEIPT_MISMATCH", error: "The receipt does not match this pending deposit." });
      }
      console.error("Manual verify error:", err);
      return res.status(500).json({ error: "Internal error checking bank records. Please try again in a few moments." });
    }
  }

  // ── 4. TRANSACTION HISTORY ───────────────────────────────────
  if (action === "history") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    try {
      const transactions = await db
        .collection("transactions")
        .find({ user_id: userObjectId })
        .sort({ created_at: -1 })
        .limit(30)
        .toArray();

      const formatted = transactions.map((t) => ({
        id: t._id.toString(),
        amount: t.amount,
        method: t.method || "UPI",
        memo: t.memo,
        utr: t.utr || "—",
        transactionId: t.transaction_id || t.razorpay_payment_id || t.razorpay_order_id || "—",
        environment: t.environment,
        status: t.status,
        createdAt: t.created_at,
        paidAt: t.paid_at,
      }));

      return res.status(200).json({ success: true, transactions: formatted });
    } catch {
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }
  }

  return res.status(404).json({ error: "Payments action not found" });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handlePaymentsRequest(req, res);
  } catch (error: any) {
    console.error("handlePaymentsRequest uncaught error:", error?.message || error);
    if (res.headersSent) return;
    return res.status(503).json({ error: "Service temporarily unavailable. Please try again shortly." });
  }
}
