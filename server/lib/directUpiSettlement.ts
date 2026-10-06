import type { Db, MongoClient } from "mongodb";
import { ObjectId } from "mongodb";

export class DirectUpiSettlementError extends Error {
  code: "PENDING_DEPOSIT_STALE" | "PAYMENT_HOLD_ACTIVE" | "RECEIPT_MISMATCH";

  constructor(code: DirectUpiSettlementError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

interface SettlementInput {
  db: Db;
  client: MongoClient;
  userId: ObjectId;
  userEmail: string;
  pendingId: ObjectId;
  expectedAmount: number;
  expectedMemo: string;
  receivedAmount: number;
  receiptMemo?: string;
  utr: string;
  transactionId: string;
  sender?: string;
  source: "manual_identifier_verify" | "railway_imap_worker";
  /** Manual website verification may recover a recently expired request only after exact receipt checks. */
  allowExpiredWithinHours?: number;
}

/** Atomically claims one exact Direct UPI deposit and credits it once. */
export async function settleDirectUpiPayment(input: SettlementInput): Promise<{ newBalance: number }> {
  const expectedMemo = input.expectedMemo.trim().toUpperCase();
  const receiptMemo = input.receiptMemo?.trim().toUpperCase();
  if (!expectedMemo || !receiptMemo || Math.round(input.receivedAmount * 100) !== Math.round(input.expectedAmount * 100)) {
    throw new DirectUpiSettlementError("RECEIPT_MISMATCH", "Receipt amount or memo is invalid.");
  }
  if (receiptMemo !== expectedMemo) {
    throw new DirectUpiSettlementError("RECEIPT_MISMATCH", "Receipt memo does not match the pending deposit.");
  }

  const settlementKey = `direct_upi:${input.pendingId.toString()}`;
  const session = input.client.startSession();
  const now = new Date();
  const lateHours = input.source === "manual_identifier_verify"
    ? Math.max(0, Math.min(Number(input.allowExpiredWithinHours || 0), 72))
    : 0;
  const eligibleStatus = lateHours > 0 ? { $in: ["pending", "expired"] } : "pending";
  const eligibleTime = lateHours > 0
    ? { created_at: { $gt: new Date(now.getTime() - lateHours * 60 * 60_000) } }
    : { expires_at: { $gt: now } };
  let newBalance = 0;
  try {
    await session.withTransaction(async () => {
      const pending: any = await input.db.collection("transactions").findOne({
        _id: input.pendingId,
        user_id: input.userId,
        method: "FAMPAY_UPI",
        amount: input.expectedAmount,
        memo: expectedMemo,
        status: eligibleStatus,
        ...eligibleTime,
      }, { session });
      if (!pending) {
        throw new DirectUpiSettlementError("PENDING_DEPOSIT_STALE", "Pending deposit is missing, expired, or already settled.");
      }

      await input.db.collection("processed_transactions").insertOne({
        utr: input.utr,
        transaction_id: input.transactionId,
        ...(receiptMemo ? { memo: receiptMemo } : {}),
        amount: input.receivedAmount,
        pending_transaction_id: input.pendingId,
        user_id: input.userId,
        user_email: input.userEmail,
        sender: input.sender || "",
        method: input.source === "railway_imap_worker" ? "IMAP_AUTO_SETTLEMENT" : "MANUAL_IDENTIFIER_VERIFY",
        processed_at: new Date(),
      }, { session });

      const claimed = await input.db.collection("transactions").updateOne(
        { _id: input.pendingId, status: pending.status },
        {
          $set: {
            status: "paid",
            direct_upi_settlement_key: settlementKey,
            utr: input.utr,
            transaction_id: input.transactionId,
            sender: input.sender || "",
            verified_amount: input.receivedAmount,
            settled_by: input.source,
            paid_at: new Date(),
          },
        },
        { session },
      );
      if (claimed.modifiedCount !== 1) {
        throw new DirectUpiSettlementError("PENDING_DEPOSIT_STALE", "Pending deposit was claimed concurrently.");
      }

      const user: any = await input.db.collection("users").findOneAndUpdate(
        { _id: input.userId, payment_hold: { $ne: true } },
        { $inc: { balance: input.receivedAmount }, $set: { updated_at: new Date() } },
        { returnDocument: "after", session },
      );
      if (!user) {
        throw new DirectUpiSettlementError("PAYMENT_HOLD_ACTIVE", "Deposits are disabled for this account.");
      }
      newBalance = Number(user.balance || 0);

      await input.db.collection("wallet_ledger").insertOne({
        settlement_key: settlementKey,
        user_id: input.userId,
        type: "credit",
        amount: input.receivedAmount,
        balance_after: newBalance,
        source: "direct_upi",
        transaction_id: input.pendingId,
        created_at: new Date(),
      }, { session });
      await input.db.collection("security_events").insertOne({
        user_id: input.userId,
        type: "direct_upi_verified",
        source: input.source,
        pending_transaction_id: input.pendingId,
        created_at: new Date(),
      }, { session });
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
    return { newBalance };
  } finally {
    await session.endSession();
  }
}
