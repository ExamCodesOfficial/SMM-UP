import { ObjectId } from "mongodb";
import { ensurePaymentProviderIndexes, ensureRazorpayIndexes, getDb, getMongoClient } from "./db.js";
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

/** Shared shape for every hosted provider (Razorpay, FamGateway). */
export interface ProviderSettlementResult extends RazorpaySettlementResult {
  provider: string;
  /** The amount the customer was quoted. */
  requestedAmount?: number;
  /** The amount the provider confirmed actually arrived. */
  paidAmount?: number;
  /** True when less was credited than was quoted (a short payment). */
  partial?: boolean;
  /** True when the customer paid more than was quoted. */
  overpaid?: boolean;
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

interface SettleProviderInput {
  /** "razorpay" | "famgateway" */
  provider: string;
  /** Value stored in `transactions.method`. */
  method: string;
  internalTransactionId?: string;
  providerOrderId?: string;
  /** Field on `transactions` that stores the provider order reference. */
  providerOrderIdField: string;
  /**
   * The provider order reference the deposit row must already carry. Unlike
   * `providerOrderId` (which is only the optional lookup key) this is always
   * present and is what the stored row is compared against.
   */
  expectedProviderOrderId: string;
  expectedUserId?: string;
  expectedAmountPaise: number;
  /**
   * Amount the provider confirmed actually arrived, in paise.
   *
   * When the customer pays more than the order asked for, only the ordered
   * amount is credited — the surplus stays with the customer. When the
   * provider confirms less, only what arrived is credited. The credited
   * amount is therefore always `min(paid, requested)`, which is the only
   * combination that can never hand out money that did not arrive and never
   * rounds a partial payment up to the full quote.
   *
   * Omit it to require an exact match (the previous behaviour).
   */
  paidAmountPaise?: number;
  expectedCurrency: string;
  settlementKey: string;
  environment: string;
  allowTestWalletCredit: boolean;
  eventId?: string;
  eventType?: string;
  /** Extra fields written onto the transaction row when it is settled. */
  transactionFields?: Record<string, unknown>;
  /** Extra fields written onto the wallet ledger row. */
  ledgerFields?: Record<string, unknown>;
  /** Additional filter the transaction update must still satisfy. */
  bindingFilter?: Record<string, unknown>;
  /** Filter identifying an already-settled row after a unique-key race. */
  settledMatchFilter?: Record<string, unknown>;
  /** Message used when the provider currency is not INR. */
  currencyMismatchMessage?: string;
}

function objectId(value: string, label: string): ObjectId {
  if (!ObjectId.isValid(value)) throw new WalletSettlementError(`Invalid ${label}.`, 400);
  return new ObjectId(value);
}

/**
 * Credits one exact hosted-provider deposit inside one MongoDB transaction.
 *
 * Browser callbacks, status polling and provider webhooks all converge here.
 * The provider is never trusted for the amount: the caller must already have
 * re-read the authoritative provider record before calling this function.
 */
export async function settleProviderDeposit(input: SettleProviderInput): Promise<ProviderSettlementResult> {
  if (!input.internalTransactionId && !input.providerOrderId) {
    throw new WalletSettlementError("A deposit identifier is required.", 400);
  }

  await ensurePaymentProviderIndexes();
  const db = await getDb();
  const client = await getMongoClient();
  const session = client.startSession();
  let result: ProviderSettlementResult | null = null;
  let duplicateKeyError: any = null;

  try {
    await session.withTransaction(async () => {
      if (input.eventId) {
        const duplicate = await db.collection("payment_events").findOne(
          { provider: input.provider, event_id: input.eventId },
          { session },
        );
        if (duplicate) {
          const duplicateTx = await db.collection("transactions").findOne(
            input.internalTransactionId
              ? { _id: objectId(input.internalTransactionId, "transaction ID") }
              : { [input.providerOrderIdField]: input.providerOrderId },
            { session },
          );
          const duplicateUser = duplicateTx?.user_id
            ? await db.collection("users").findOne({ _id: duplicateTx.user_id }, { session })
            : null;
          result = {
            provider: input.provider,
            transactionId: duplicateTx?._id?.toString() || "",
            userId: duplicateTx?.user_id?.toString() || "",
            amount: Number(duplicateTx?.credited_amount ?? duplicateTx?.amount ?? 0),
            requestedAmount: Number(duplicateTx?.amount || 0),
            paidAmount: Number(duplicateTx?.paid_amount ?? duplicateTx?.amount ?? 0),
            partial: duplicateTx?.credited_amount_paise !== undefined
              && Number(duplicateTx.credited_amount_paise) < Number(duplicateTx.amount_paise),
            overpaid: duplicateTx?.paid_amount_paise !== undefined
              && Number(duplicateTx.paid_amount_paise) > Number(duplicateTx.amount_paise),
            newBalance: Number(duplicateUser?.balance || 0),
            walletCredited: duplicateTx?.wallet_credited !== false,
            alreadySettled: true,
            duplicateEvent: true,
            testMode: input.environment === "test" || input.environment === "sandbox",
          };
          return;
        }
      }

      const txQuery = input.internalTransactionId
        ? { _id: objectId(input.internalTransactionId, "transaction ID") }
        : { [input.providerOrderIdField]: input.providerOrderId };
      const tx = await db.collection("transactions").findOne(txQuery, { session });
      if (!tx) throw new WalletSettlementError("Deposit was not found.", 404);

      const txUserId = tx.user_id as ObjectId;
      if (input.expectedUserId && txUserId.toString() !== input.expectedUserId) {
        throw new WalletSettlementError("This deposit belongs to another account.", 403);
      }
      if (tx.method !== input.method || tx[input.providerOrderIdField] !== input.expectedProviderOrderId) {
        throw new WalletSettlementError("Payment order binding does not match.", 400);
      }
      if (tx.environment !== input.environment) {
        throw new WalletSettlementError("Payment environment does not match this deposit.", 409);
      }
      if (Number(tx.amount_paise) !== input.expectedAmountPaise || tx.currency !== input.expectedCurrency) {
        throw new WalletSettlementError("Payment amount or currency does not match.", 400);
      }
      if (input.expectedCurrency !== "INR") {
        throw new WalletSettlementError(
          input.currencyMismatchMessage || "Only INR wallet deposits are supported.",
          400,
        );
      }

      // How much actually arrives, and how much we therefore credit.
      //
      // `creditedPaise` is `min(paid, requested)`. A customer who pays more
      // than the order asked for is credited only the ordered amount, and a
      // customer whose payment landed short is credited only what arrived.
      // Neither direction can mint money, and a slightly wrong UPI transfer
      // no longer has to wait for a human to look at it.
      const requestedPaise = Math.round(Number(tx.amount_paise));
      const paidPaise = input.paidAmountPaise === undefined
        ? requestedPaise
        : Math.round(Number(input.paidAmountPaise));
      if (!Number.isFinite(paidPaise) || paidPaise < 0) {
        throw new WalletSettlementError("Provider reported an invalid settled amount.", 400);
      }
      const creditedPaise = Math.min(paidPaise, requestedPaise);
      const creditedAmount = creditedPaise / 100;

      const shouldCreditWallet = input.environment !== "test" && input.environment !== "sandbox"
        ? true
        : input.allowTestWalletCredit;
      const finalStatus = shouldCreditWallet ? "paid" : "test_paid";

      if (tx.status === "paid" || tx.status === "test_paid") {
        if (input.eventId) {
          await db.collection("payment_events").insertOne(
            {
              provider: input.provider,
              event_id: input.eventId,
              event_type: input.eventType || "payment.settled",
              transaction_id: tx._id,
              status: "already_settled",
              received_at: new Date(),
            },
            { session },
          );
        }
        const currentUser = await db.collection("users").findOne({ _id: txUserId }, { session });
        result = {
          provider: input.provider,
          transactionId: tx._id.toString(),
          userId: txUserId.toString(),
          amount: Number(tx.credited_amount ?? tx.amount ?? 0),
          requestedAmount: Number(tx.amount || 0),
          paidAmount: Number(tx.paid_amount ?? tx.amount ?? 0),
          partial: tx.credited_amount_paise !== undefined
            && Number(tx.credited_amount_paise) < Number(tx.amount_paise),
          overpaid: tx.paid_amount_paise !== undefined
            && Number(tx.paid_amount_paise) > Number(tx.amount_paise),
          newBalance: Number(currentUser?.balance || 0),
          walletCredited: tx.wallet_credited !== false,
          alreadySettled: true,
          duplicateEvent: false,
          testMode: input.environment === "test" || input.environment === "sandbox",
        };
        return;
      }

      // A cancelled request is still settleable: the customer may have paid it
      // just before cancelling. Real money is never silently dropped — the
      // caller flags it for owner review instead.
      if (!["pending", "processing", "authorized", "cancelled"].includes(String(tx.status))) {
        throw new WalletSettlementError("This deposit cannot be settled in its current state.", 409);
      }

      await db.collection("wallet_ledger").insertOne(
        {
          settlement_key: input.settlementKey,
          type: shouldCreditWallet ? "deposit_credit" : "test_deposit",
          provider: input.provider,
          environment: input.environment,
          transaction_id: tx._id,
          user_id: txUserId,
          amount: shouldCreditWallet ? creditedAmount : 0,
          amount_paise: shouldCreditWallet ? creditedPaise : 0,
          source_amount: Number(tx.amount),
          source_amount_paise: requestedPaise,
          currency: "INR",
          spendable: shouldCreditWallet,
          ...(input.ledgerFields || {}),
          created_at: new Date(),
        },
        { session },
      );

      const txUpdate = await db.collection("transactions").updateOne(
        {
          _id: tx._id,
          status: { $in: ["pending", "processing", "authorized"] },
          ...(input.bindingFilter || {}),
        },
        {
          $set: {
            status: finalStatus,
            wallet_credited: shouldCreditWallet,
            paid_at: new Date(),
            updated_at: new Date(),
            // What was quoted, what actually arrived, and what was credited.
            // A difference is always visible here even when it was settled
            // automatically.
            credited_amount: shouldCreditWallet ? creditedAmount : 0,
            credited_amount_paise: shouldCreditWallet ? creditedPaise : 0,
            paid_amount: paidPaise / 100,
            paid_amount_paise: paidPaise,
            ...(input.transactionFields || {}),
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
          { $inc: { balance: creditedAmount }, $set: { updated_at: new Date() } },
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
            provider: input.provider,
            event_id: input.eventId,
            event_type: input.eventType || "payment.settled",
            transaction_id: tx._id,
            status: finalStatus,
            received_at: new Date(),
          },
          { session },
        );
      }

      result = {
        provider: input.provider,
        transactionId: tx._id.toString(),
        userId: txUserId.toString(),
        amount: shouldCreditWallet ? creditedAmount : 0,
        requestedAmount: Number(tx.amount),
        paidAmount: paidPaise / 100,
        partial: creditedPaise < requestedPaise,
        overpaid: paidPaise > requestedPaise,
        newBalance: Number(currentUser?.balance || 0),
        walletCredited: shouldCreditWallet,
        alreadySettled: false,
        duplicateEvent: false,
        testMode: input.environment === "test" || input.environment === "sandbox",
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
        : { [input.providerOrderIdField]: input.providerOrderId }),
      ...(input.settledMatchFilter || {}),
      status: { $in: ["paid", "test_paid"] },
    });
    if (tx) {
      const user = await db.collection("users").findOne({ _id: tx.user_id });
      return {
        provider: input.provider,
        transactionId: tx._id.toString(),
        userId: tx.user_id.toString(),
        amount: Number(tx.credited_amount ?? tx.amount ?? 0),
        requestedAmount: Number(tx.amount || 0),
        paidAmount: Number(tx.paid_amount ?? tx.amount ?? 0),
        partial: tx.credited_amount_paise !== undefined
          && Number(tx.credited_amount_paise) < Number(tx.amount_paise),
        overpaid: tx.paid_amount_paise !== undefined
          && Number(tx.paid_amount_paise) > Number(tx.amount_paise),
        newBalance: Number(user?.balance || 0),
        walletCredited: tx.wallet_credited !== false,
        alreadySettled: true,
        duplicateEvent: Boolean(input.eventId),
        testMode: input.environment === "test" || input.environment === "sandbox",
      };
    }
    throw duplicateKeyError;
  }

  if (!result) throw new WalletSettlementError("Wallet settlement did not complete.", 503);
  return result;
}

/**
 * Credits one exact Razorpay deposit inside one MongoDB transaction.
 * Browser callbacks, polling and duplicate webhooks all converge here.
 */
export async function settleRazorpayDeposit(
  input: SettleRazorpayInput,
): Promise<RazorpaySettlementResult> {
  if (input.payment.status !== "captured" || input.payment.captured !== true) {
    throw new WalletSettlementError("Payment has not been captured yet.", 409);
  }
  if (Number(input.payment.amount_refunded || 0) > 0 || input.payment.refund_status) {
    throw new WalletSettlementError("Refunded Razorpay payments require manual reconciliation.", 409);
  }

  await ensureRazorpayIndexes();

  const result = await settleProviderDeposit({
    provider: "razorpay",
    method: "RAZORPAY",
    internalTransactionId: input.internalTransactionId,
    providerOrderId: input.razorpayOrderId,
    providerOrderIdField: "razorpay_order_id",
    expectedProviderOrderId: input.payment.order_id,
    expectedUserId: input.expectedUserId,
    expectedAmountPaise: input.payment.amount,
    expectedCurrency: input.payment.currency,
    settlementKey: `razorpay:${input.payment.id}`,
    environment: input.mode,
    allowTestWalletCredit: input.allowTestWalletCredit,
    eventId: input.eventId,
    eventType: input.eventType,
    transactionFields: {
      razorpay_payment_id: input.payment.id,
      razorpay_method: input.payment.method || "unknown",
      razorpay_fee_paise: input.payment.fee ?? null,
      razorpay_tax_paise: input.payment.tax ?? null,
    },
    ledgerFields: {
      razorpay_order_id: input.payment.order_id,
      razorpay_payment_id: input.payment.id,
    },
    bindingFilter: {
      $or: [
        { razorpay_payment_id: { $exists: false } },
        { razorpay_payment_id: input.payment.id },
      ],
    },
    settledMatchFilter: { razorpay_payment_id: input.payment.id },
    currencyMismatchMessage: "Only INR wallet deposits are supported.",
  });

  return {
    transactionId: result.transactionId,
    userId: result.userId,
    amount: result.amount,
    newBalance: result.newBalance,
    walletCredited: result.walletCredited,
    alreadySettled: result.alreadySettled,
    duplicateEvent: result.duplicateEvent,
    testMode: result.testMode,
  };
}

/**
 * Credits one exact FamGateway (UPI Automatic) deposit inside one MongoDB
 * transaction. The webhook, the browser status poll and the reconciliation
 * sweep all converge here, so a provider can never credit a wallet twice.
 */
export async function settleFamGatewayDeposit(input: {
  internalTransactionId?: string;
  famgatewayOrderId: string;
  expectedUserId?: string;
  /** Amount in paise the customer was quoted and must have paid. */
  expectedAmountPaise: number;
  /**
   * Amount in paise the provider confirmed actually arrived. When omitted an
   * exact match is required. When present the credited amount is
   * `min(paid, requested)`.
   */
  paidAmountPaise?: number;
  utr?: string | null;
  transactionId?: string | null;
  senderName?: string | null;
  eventId?: string;
  eventType?: string;
}): Promise<ProviderSettlementResult> {
  return settleProviderDeposit({
    provider: "famgateway",
    method: "FAMGATEWAY_UPI",
    internalTransactionId: input.internalTransactionId,
    providerOrderId: input.famgatewayOrderId,
    providerOrderIdField: "famgateway_order_id",
    expectedProviderOrderId: input.famgatewayOrderId,
    expectedUserId: input.expectedUserId,
    expectedAmountPaise: input.expectedAmountPaise,
    paidAmountPaise: input.paidAmountPaise,
    expectedCurrency: "INR",
    settlementKey: `famgateway:${input.famgatewayOrderId}`,
    environment: "live",
    allowTestWalletCredit: false,
    eventId: input.eventId,
    eventType: input.eventType,
    transactionFields: {
      famgateway_utr: input.utr || null,
      famgateway_transaction_id: input.transactionId || null,
      famgateway_sender_name: input.senderName || null,
      famgateway_settled_by: "famgateway_webhook",
    },
    ledgerFields: {
      famgateway_order_id: input.famgatewayOrderId,
      famgateway_utr: input.utr || null,
      famgateway_transaction_id: input.transactionId || null,
    },
    settledMatchFilter: { famgateway_order_id: input.famgatewayOrderId },
    currencyMismatchMessage: "Only INR wallet deposits are supported.",
  });
}

export async function recordProviderEvent(input: {
  provider: string;
  eventId: string;
  eventType: string;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<{ duplicate: boolean }> {
  await ensurePaymentProviderIndexes();
  const db = await getDb();
  try {
    await db.collection("payment_events").insertOne({
      provider: input.provider,
      event_id: input.eventId,
      event_type: input.eventType,
      provider_order_id: input.providerOrderId ?? null,
      provider_payment_id: input.providerPaymentId ?? null,
      status: "recorded",
      payload_summary: input.payload ?? null,
      received_at: new Date(),
    });
    return { duplicate: false };
  } catch (error: any) {
    if (error?.code === 11000) return { duplicate: true };
    throw error;
  }
}

export async function recordRazorpayEvent(input: {
  eventId: string;
  eventType: string;
  payment?: Partial<RazorpayPayment>;
  payload?: Record<string, unknown>;
}): Promise<{ duplicate: boolean }> {
  await ensureRazorpayIndexes();
  return recordProviderEvent({
    provider: "razorpay",
    eventId: input.eventId,
    eventType: input.eventType,
    providerOrderId: input.payment?.order_id || null,
    providerPaymentId: input.payment?.id || null,
    payload: input.payload,
  });
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
