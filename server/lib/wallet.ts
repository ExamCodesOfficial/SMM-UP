import { ObjectId } from "mongodb";
import { ensureRazorpayIndexes, getDb, getMongoClient } from "./db.js";
import type { RazorpayMode, RazorpayPayment } from "./razorpay.js";

export class WalletSettlementError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "WalletSettlementError";
    this.status = status;
  }
}

export interface RazorpaySettlementResult {
  transactionId: string;
  userId: string;
  amount: number;
  newBalance: number;
  walletCredited: boolean;
  alreadySettled: boolean;
  duplicateEvent: boolean;
  testMode: boolean;
}

interface SettleRazorpayInput {
  internalTransactionId?: string;
  razorpayOrderId?: string;
  expectedUserId?: string;
  payment: RazorpayPayment;
  mode: RazorpayMode;
  allowTestWalletCredit: boolean;
  eventId?: string;
  eventType?: string;
}

function objectId(value: string, label: string): ObjectId {
  if (!ObjectId.isValid(value)) throw new WalletSettlementError(`Invalid ${label}.`, 400);
  return new ObjectId(value);
}

/**
 * Credits one exact Razorpay deposit inside one MongoDB transaction.
 * Browser callbacks, polling and duplicate webhooks all converge here.
 */
export async function settleRazorpayDeposit(
  input: SettleRazorpayInput,
): Promise<RazorpaySettlementResult> {
  if (!input.internalTransactionId && !input.razorpayOrderId) {
    throw new WalletSettlementError("A deposit identifier is required.", 400);
  }
  if (input.payment.status !== "captured" || input.payment.captured !== true) {
    throw new WalletSettlementError("Payment has not been captured yet.", 409);
  }
  if (Number(input.payment.amount_refunded || 0) > 0 || input.payment.refund_status) {
    throw new WalletSettlementError("Refunded Razorpay payments require manual reconciliation.", 409);
  }

  await ensureRazorpayIndexes();
  const db = await getDb();
  const client = await getMongoClient();
  const session = client.startSession();
  let result: RazorpaySettlementResult | null = null;
  let duplicateKeyError: any = null;

  try {
    await session.withTransaction(async () => {
      if (input.eventId) {
        const duplicate = await db.collection("payment_events").findOne(
          { provider: "razorpay", event_id: input.eventId },
          { session },
        );
        if (duplicate) {
          const duplicateTx = await db.collection("transactions").findOne(
            input.internalTransactionId
              ? { _id: objectId(input.internalTransactionId, "transaction ID") }
              : { razorpay_order_id: input.razorpayOrderId },
            { session },
          );
          const duplicateUser = duplicateTx?.user_id
            ? await db.collection("users").findOne({ _id: duplicateTx.user_id }, { session })
            : null;
          result = {
            transactionId: duplicateTx?._id?.toString() || "",
            userId: duplicateTx?.user_id?.toString() || "",
            amount: Number(duplicateTx?.amount || 0),
            newBalance: Number(duplicateUser?.balance || 0),
            walletCredited: duplicateTx?.wallet_credited !== false,
            alreadySettled: true,
            duplicateEvent: true,
            testMode: input.mode === "test",
          };
          return;
        }
      }

      const txQuery = input.internalTransactionId
        ? { _id: objectId(input.internalTransactionId, "transaction ID") }
        : { razorpay_order_id: input.razorpayOrderId };
      const tx = await db.collection("transactions").findOne(txQuery, { session });
      if (!tx) throw new WalletSettlementError("Razorpay deposit was not found.", 404);

      const txUserId = tx.user_id as ObjectId;
      if (input.expectedUserId && txUserId.toString() !== input.expectedUserId) {
        throw new WalletSettlementError("This deposit belongs to another account.", 403);
      }
      if (tx.method !== "RAZORPAY" || tx.razorpay_order_id !== input.payment.order_id) {
        throw new WalletSettlementError("Razorpay order binding does not match.", 400);
      }
      if (tx.environment !== input.mode) {
        throw new WalletSettlementError("Razorpay payment environment does not match this deposit.", 409);
      }
      if (Number(tx.amount_paise) !== input.payment.amount || tx.currency !== input.payment.currency) {
        throw new WalletSettlementError("Razorpay payment amount or currency does not match.", 400);
      }
      if (input.payment.currency !== "INR") {
        throw new WalletSettlementError("Only INR wallet deposits are supported.", 400);
      }

      const shouldCreditWallet = input.mode === "live" || input.allowTestWalletCredit;
      const finalStatus = shouldCreditWallet ? "paid" : "test_paid";

      if (tx.status === "paid" || tx.status === "test_paid") {
        if (tx.razorpay_payment_id && tx.razorpay_payment_id !== input.payment.id) {
          throw new WalletSettlementError("Deposit is already bound to another payment.", 409);
        }
        if (input.eventId) {
          await db.collection("payment_events").insertOne(
            {
              provider: "razorpay",
              event_id: input.eventId,
              event_type: input.eventType || "payment.captured",
              razorpay_order_id: input.payment.order_id,
              razorpay_payment_id: input.payment.id,
              transaction_id: tx._id,
              status: "already_settled",
              received_at: new Date(),
            },
            { session },
          );
        }
        const currentUser = await db.collection("users").findOne({ _id: txUserId }, { session });
        result = {
          transactionId: tx._id.toString(),
          userId: txUserId.toString(),
          amount: Number(tx.amount),
          newBalance: Number(currentUser?.balance || 0),
          walletCredited: tx.wallet_credited !== false,
          alreadySettled: true,
          duplicateEvent: false,
          testMode: input.mode === "test",
        };
        return;
      }

      if (!["pending", "processing", "authorized"].includes(String(tx.status))) {
        throw new WalletSettlementError("This deposit cannot be settled in its current state.", 409);
      }

      const settlementKey = `razorpay:${input.payment.id}`;
      await db.collection("wallet_ledger").insertOne(
        {
          settlement_key: settlementKey,
          type: shouldCreditWallet ? "deposit_credit" : "test_deposit",
          provider: "razorpay",
          environment: input.mode,
          transaction_id: tx._id,
          user_id: txUserId,
          amount: shouldCreditWallet ? Number(tx.amount) : 0,
          amount_paise: shouldCreditWallet ? Number(tx.amount_paise) : 0,
          source_amount: Number(tx.amount),
          source_amount_paise: Number(tx.amount_paise),
          currency: "INR",
          spendable: shouldCreditWallet,
          razorpay_order_id: input.payment.order_id,
          razorpay_payment_id: input.payment.id,
          created_at: new Date(),
        },
        { session },
      );

      const txUpdate = await db.collection("transactions").updateOne(
        {
          _id: tx._id,
          status: { $in: ["pending", "processing", "authorized"] },
          $or: [
            { razorpay_payment_id: { $exists: false } },
            { razorpay_payment_id: input.payment.id },
          ],
        },
        {
          $set: {
            status: finalStatus,
            wallet_credited: shouldCreditWallet,
            razorpay_payment_id: input.payment.id,
            razorpay_method: input.payment.method || "unknown",
            razorpay_fee_paise: input.payment.fee ?? null,
            razorpay_tax_paise: input.payment.tax ?? null,
            paid_at: new Date(),
            updated_at: new Date(),
          },
        },
        { session },
      );
      if (txUpdate.modifiedCount !== 1) {
        throw new WalletSettlementError("Deposit was settled concurrently. Please refresh.", 409);
      }

      let currentUser: any;
      if (shouldCreditWallet) {
        currentUser = await db.collection("users").findOneAndUpdate(
          { _id: txUserId, payment_hold: { $ne: true } },
          { $inc: { balance: Number(tx.amount) }, $set: { updated_at: new Date() } },
          { returnDocument: "after", session },
        );
        if (!currentUser) {
          throw new WalletSettlementError(
            "This account is under payment review. Contact support.",
            409,
          );
        }
      } else {
        currentUser = await db.collection("users").findOne({ _id: txUserId }, { session });
      }

      if (input.eventId) {
        await db.collection("payment_events").insertOne(
          {
            provider: "razorpay",
            event_id: input.eventId,
            event_type: input.eventType || "payment.captured",
            razorpay_order_id: input.payment.order_id,
            razorpay_payment_id: input.payment.id,
            transaction_id: tx._id,
            status: finalStatus,
            received_at: new Date(),
          },
          { session },
        );
      }

      result = {
        transactionId: tx._id.toString(),
        userId: txUserId.toString(),
        amount: Number(tx.amount),
        newBalance: Number(currentUser?.balance || 0),
        walletCredited: shouldCreditWallet,
        alreadySettled: false,
        duplicateEvent: false,
        testMode: input.mode === "test",
      };
    });
  } catch (error: any) {
    if (error?.code === 11000) duplicateKeyError = error;
    else throw error;
  } finally {
    await session.endSession();
  }

  // A browser callback and webhook can settle simultaneously. If our transaction
  // lost a unique-key race, return the winner only when it settled this exact payment.
  if (!result && duplicateKeyError) {
    const tx = await db.collection("transactions").findOne({
      ...(input.internalTransactionId
        ? { _id: objectId(input.internalTransactionId, "transaction ID") }
        : { razorpay_order_id: input.razorpayOrderId }),
      razorpay_payment_id: input.payment.id,
      status: { $in: ["paid", "test_paid"] },
    });
    if (tx) {
      const user = await db.collection("users").findOne({ _id: tx.user_id });
      return {
        transactionId: tx._id.toString(),
        userId: tx.user_id.toString(),
        amount: Number(tx.amount),
        newBalance: Number(user?.balance || 0),
        walletCredited: tx.wallet_credited !== false,
        alreadySettled: true,
        duplicateEvent: Boolean(input.eventId),
        testMode: input.mode === "test",
      };
    }
    throw duplicateKeyError;
  }

  if (!result) throw new WalletSettlementError("Wallet settlement did not complete.", 503);
  return result;
}

export async function recordRazorpayEvent(input: {
  eventId: string;
  eventType: string;
  payment?: Partial<RazorpayPayment>;
  payload?: Record<string, unknown>;
}): Promise<{ duplicate: boolean }> {
  await ensureRazorpayIndexes();
  const db = await getDb();
  try {
    await db.collection("payment_events").insertOne({
      provider: "razorpay",
      event_id: input.eventId,
      event_type: input.eventType,
      razorpay_order_id: input.payment?.order_id || null,
      razorpay_payment_id: input.payment?.id || null,
      status: "recorded",
      payload_summary: input.payload || null,
      received_at: new Date(),
    });
    return { duplicate: false };
  } catch (error: any) {
    if (error?.code === 11000) return { duplicate: true };
    throw error;
  }
}

/** Refunds and disputes are fail-closed: stop new ordering and require review. */
export async function flagRazorpayPaymentForReview(input: {
  eventId: string;
  eventType: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  reason: string;
  refundedAmountPaise?: number;
}): Promise<{ duplicate: boolean; transactionFound: boolean }> {
  await ensureRazorpayIndexes();
  const db = await getDb();
  const client = await getMongoClient();
  const session = client.startSession();
  let duplicate = false;
  let transactionFound = false;

  try {
    await session.withTransaction(async () => {
      const seen = await db.collection("payment_events").findOne(
        { provider: "razorpay", event_id: input.eventId },
        { session },
      );
      if (seen) {
        duplicate = true;
        return;
      }

      const providerQuery = input.razorpayOrderId
        ? { razorpay_order_id: input.razorpayOrderId }
        : input.razorpayPaymentId
          ? { razorpay_payment_id: input.razorpayPaymentId }
          : { _id: null };
      const tx = await db.collection("transactions").findOne(
        { method: "RAZORPAY", ...providerQuery },
        { session },
      );
      transactionFound = Boolean(tx);

      if (tx) {
        await db.collection("transactions").updateOne(
          { _id: tx._id },
          {
            $set: {
              payment_review_required: true,
              payment_review_reason: input.reason,
              razorpay_refunded_amount_paise: input.refundedAmountPaise || 0,
              updated_at: new Date(),
            },
          },
          { session },
        );
        await db.collection("users").updateOne(
          { _id: tx.user_id },
          {
            $set: {
              payment_hold: true,
              payment_hold_reason: input.reason,
              payment_hold_at: new Date(),
            },
          },
          { session },
        );
      }

      await db.collection("payment_events").insertOne(
        {
          provider: "razorpay",
          event_id: input.eventId,
          event_type: input.eventType,
          razorpay_order_id: input.razorpayOrderId || null,
          razorpay_payment_id: input.razorpayPaymentId || null,
          transaction_id: tx?._id || null,
          status: tx ? "review_required" : "orphaned",
          reason: input.reason,
          received_at: new Date(),
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return { duplicate, transactionFound };
}
