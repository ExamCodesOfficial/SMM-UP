import type { VercelRequest, VercelResponse } from "../../server/lib/http.js";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import { ensureDirectUpiIndexes, getDb, getMongoClient } from "../../server/lib/db.js";
import { denySupportMutation, getUserFromRequest } from "../../server/lib/auth.js";
import { checkRateLimit } from "../../server/lib/rateLimit.js";
import { settleDirectUpiPayment } from "../../server/lib/directUpiSettlement.js";
import { searchFamPayPaymentDetailed } from "../../server/lib/imap.js";
import { sendPaymentSuccessAlert, sendPaymentDelayAlert } from "../../server/lib/telegram.js";

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
  const readOnlyAction = ["history", "config"].includes(String(action)) && req.method === "GET";
  if (denySupportMutation(authUser, res, readOnlyAction)) return;

  if (action === "config") {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({
      minAmount: MIN_DIRECT_UPI_AMOUNT_INR,
      maxAmount: maxDirectUpiAmountInr(),
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
    const numAmount = parseFloat(amount);

    const maxDirectUpiAmount = maxDirectUpiAmountInr();
    if (!Number.isFinite(numAmount) || numAmount < MIN_DIRECT_UPI_AMOUNT_INR || numAmount > maxDirectUpiAmount || Math.abs(numAmount - Math.round(numAmount * 100) / 100) > 0.000001) {
      return res.status(400).json({ error: `Deposit amount must be between ₹${MIN_DIRECT_UPI_AMOUNT_INR} and ₹${maxDirectUpiAmount.toLocaleString("en-IN")} with at most two decimals.` });
    }

    const upiVpa = String(process.env.UPI_VPA || "").trim();
    const merchantName = String(process.env.UPI_MERCHANT_NAME || "SMM UP").trim().slice(0, 80);
    if (!upiVpa) return res.status(500).json({ error: "Payment configuration missing. Contact support." });

    try {
      const pendingTtlMinutes = Math.max(5, Math.min(Number.parseInt(String(process.env.DIRECT_UPI_PENDING_TTL_MINUTES || "30"), 10) || 30, 180));
      let memo = "";
      let transactionId = "";
      for (let attempt = 0; attempt < 6; attempt += 1) {
        memo = generateDynamicMemo();
        const createdAt = new Date();
        try {
          const inserted = await db.collection("transactions").insertOne({
            user_id: userObjectId,
            user_email: authUser.email,
            amount: numAmount,
            method: "FAMPAY_UPI",
            upi_id: upiVpa,
            memo,
            status: "pending",
            delay_alert_sent: false,
            created_at: createdAt,
            expires_at: new Date(createdAt.getTime() + pendingTtlMinutes * 60_000),
          });
          transactionId = inserted.insertedId.toString();
          break;
        } catch (error: any) {
          if (error?.code === 11000) continue;
          throw error;
        }
      }
      if (!transactionId) throw new Error("Unable to allocate a unique payment reference.");

      const upiQuery = new URLSearchParams({
        pa: upiVpa,
        pn: merchantName,
        am: numAmount.toFixed(2),
        tn: memo,
        tr: memo,
        cu: "INR",
      });
      const upiUrl = `upi://pay?${upiQuery.toString()}`;

      return res.status(200).json({
        success: true,
        transactionId,
        amount: numAmount,
        memo,
        upiVpa,
        upiUrl,
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
          const alertSent = await sendPaymentDelayAlert({
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
    const requestedAmount = parseFloat(amount);

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

      const receiptLookup = await searchFamPayPaymentDetailed({
        identifier: cleanInput,
        memo: storedMemo,
        expectedAmount: requestedAmount,
        minDate: new Date(pendingDeposit.created_at),
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
      if (Math.round(parsedPayment.amount * 100) !== Math.round(requestedAmount * 100)) {
        return res.status(400).json({
          error: `Amount mismatch: Receipt indicates ₹${parsedPayment.amount.toFixed(2)}, but ₹${requestedAmount.toFixed(2)} was selected. Contact support with proof.`,
        });
      }
      if (!parsedPayment.purpose) {
        await db.collection("payment_reconciliation").updateOne(
          { memo: storedMemo, status: "open", reason: "receipt_memo_missing" },
          {
            $set: { pending_transaction_id: pendingId, user_id: userObjectId, identifier: cleanInput, last_seen_at: new Date() },
            $inc: { attempts: 1 },
            $setOnInsert: { created_at: new Date(), status: "open" },
          },
          { upsert: true },
        );
        return res.status(409).json({
          errorCode: "RECEIPT_REFERENCE_MISSING",
          error: "The trusted bank receipt was found, but it did not contain the exact payment reference. The payment has been flagged for reconciliation; do not pay again and contact support with this receipt.",
        });
      }
      const receiptMemo = String(parsedPayment.purpose).trim().toUpperCase();
      if (receiptMemo !== storedMemo) {
        await db.collection("payment_reconciliation").updateOne(
          { memo: storedMemo, status: "open", reason: "receipt_memo_mismatch" },
          {
            $set: {
              pending_transaction_id: pendingId,
              user_id: userObjectId,
              identifier: cleanInput,
              observed_memo: receiptMemo,
              last_seen_at: new Date(),
            },
            $inc: { attempts: 1 },
            $setOnInsert: { created_at: new Date(), status: "open" },
          },
          { upsert: true },
        );
        return res.status(409).json({ error: "The trusted receipt was found, but its payment reference does not match this deposit. It has been flagged for reconciliation; do not pay again and contact support." });
      }

      const finalUtr = String(parsedPayment.utr || rawInput).replace(/[^A-Za-z0-9]/g, "");
      const finalTxId = String(parsedPayment.transactionId || rawInput).replace(/[^A-Za-z0-9]/g, "");
      const client = await getMongoClient();
      const { newBalance } = await settleDirectUpiPayment({
        db,
        client,
        userId: userObjectId,
        userEmail: authUser.email,
        pendingId,
        expectedAmount: requestedAmount,
        expectedMemo: storedMemo,
        receivedAmount: parsedPayment.amount,
        receiptMemo: parsedPayment.purpose,
        utr: finalUtr,
        transactionId: finalTxId,
        sender: parsedPayment.sender,
        source: "manual_identifier_verify",
        allowExpiredWithinHours: lateVerificationHours(),
      });

      sendPaymentSuccessAlert({
        userEmail: authUser.email,
        amount: parsedPayment.amount,
        method: "Manual UTR/TxID Submission",
        utr: finalUtr,
        transactionId: finalTxId,
        memo: parsedPayment.purpose || storedMemo,
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
        return res.status(400).json({ error: "The receipt does not match this pending deposit." });
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
