import { ObjectId, type Document } from "mongodb";
import { ensurePaymentProviderIndexes, getDb } from "./db.js";
import { settleProviderDeposit, type ProviderSettlementResult } from "./wallet.js";
import type { OxaPayPaymentInfo, OxaPayStatus, OxaPayTransaction } from "./oxapay.js";

/**
 * Crypto (OxaPay) settlement.
 *
 * The SMM UP wallet is denominated in INR, so a crypto deposit credits the INR
 * figure that was LOCKED when the invoice was created — never the live crypto
 * value. A customer who was quoted ₹250.00 receives ₹250.00 regardless of what
 * the coin did between invoice creation and on-chain confirmation.
 *
 * Two rules differ from a plain hosted provider:
 *   1. `underpaid` is a first-class provider status and is NEVER auto-credited.
 *      It is flagged for owner review.
 *   2. A single invoice may be settled by several on-chain transactions
 *      (mixed payment). Every `tx_hash` is recorded in `crypto_payment_txs`
 *      with a unique `_id`, so the same chain transaction can never credit a
 *      wallet twice — not even across two different invoices.
 */

export class CryptoSettlementError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "CryptoSettlementError";
    this.code = code;
    this.status = status;
  }
}

export interface CryptoSettlementResult extends ProviderSettlementResult {
  cryptoTransactions: number;
  reviewRequired: boolean;
}

const CREDITABLE_STATUSES: OxaPayStatus[] = ["paid", "manual_accept"];

/**
 * One row per on-chain transaction. The `_id` IS the chain transaction hash,
 * which is what makes a replayed or duplicated transfer a no-op instead of a
 * second wallet credit.
 */
interface CryptoPaymentTxDocument extends Document {
  _id: string;
  track_id: string;
  transaction_id: ObjectId;
  network?: string | null;
  currency?: string | null;
  amount?: number | null;
  sent_amount?: number | null;
  received_amount?: number | null;
  rate?: number | null;
  confirmations?: number | null;
  provider_status?: string | null;
  address?: string | null;
  created_at: Date;
}

export function isCreditableCryptoStatus(status: OxaPayStatus): boolean {
  return CREDITABLE_STATUSES.includes(status);
}

function summarizeTransactions(transactions: OxaPayTransaction[]) {
  const amounts = transactions
    .map((tx) => tx.amount ?? tx.sentAmount)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const total = amounts.length ? amounts.reduce((sum, value) => sum + value, 0) : null;
  const currencies = Array.from(new Set(transactions.map((tx) => tx.currency).filter(Boolean))) as string[];
  const networks = Array.from(new Set(transactions.map((tx) => tx.network).filter(Boolean))) as string[];
  return {
    total,
    currency: currencies[0] || null,
    currencies,
    networks,
    rate: transactions.find((tx) => typeof tx.rate === "number")?.rate ?? null,
  };
}

/**
 * Records every on-chain transaction for an invoice. The unique `_id` on
 * `crypto_payment_txs` makes a replayed or duplicated chain transaction a
 * no-op instead of a second credit.
 */
export async function recordCryptoTransactions(input: {
  trackId: string;
  transactionId: ObjectId;
  transactions: OxaPayTransaction[];
}): Promise<{ recorded: number; alreadyKnown: number }> {
  await ensurePaymentProviderIndexes();
  const db = await getDb();
  let recorded = 0;
  let alreadyKnown = 0;

  for (const tx of input.transactions) {
    if (!tx.txHash) continue;
    try {
      await db.collection<CryptoPaymentTxDocument>("crypto_payment_txs").insertOne({
        _id: tx.txHash,
        track_id: input.trackId,
        transaction_id: input.transactionId,
        network: tx.network || null,
        currency: tx.currency || null,
        amount: tx.amount ?? null,
        sent_amount: tx.sentAmount ?? null,
        received_amount: tx.receivedAmount ?? null,
        rate: tx.rate ?? null,
        confirmations: tx.confirmations ?? null,
        provider_status: tx.status || null,
        address: tx.address || null,
        created_at: new Date(),
      });
      recorded += 1;
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      alreadyKnown += 1;
    }
  }

  return { recorded, alreadyKnown };
}

/**
 * Detects a chain transaction that was already credited under a DIFFERENT
 * invoice. The same on-chain hash can never fund two wallet credits.
 */
export async function findConflictingCryptoHashes(input: {
  transactionId: ObjectId;
  hashes: string[];
}): Promise<string[]> {
  const usable = input.hashes.filter(Boolean);
  if (!usable.length) return [];
  const db = await getDb();
  const existing = await db
    .collection<CryptoPaymentTxDocument>("crypto_payment_txs")
    .find({ _id: { $in: usable } })
    .toArray();
  return existing
    .filter((row) => row.transaction_id?.toString() !== input.transactionId.toString())
    .map((row) => row._id);
}

/**
 * Credits a crypto deposit. The caller must already hold the authoritative
 * provider state; this function re-checks the status and amount before it
 * moves any money.
 */
export async function settleCryptoDeposit(input: {
  internalTransactionId: string;
  trackId: string;
  expectedUserId?: string;
  expectedAmountPaise: number;
  payment: OxaPayPaymentInfo;
  eventId: string;
  eventType: string;
  sandbox: boolean;
  allowSandboxCredit: boolean;
}): Promise<CryptoSettlementResult> {
  await ensurePaymentProviderIndexes();
  const db = await getDb();

  const tx: any = await db.collection("transactions").findOne({
    _id: new ObjectId(input.internalTransactionId),
  });
  if (!tx) throw new CryptoSettlementError("TX_NOT_FOUND", "Deposit was not found.", 404);
  if (tx.method !== "OXAPAY_CRYPTO" || tx.oxapay_track_id !== input.trackId) {
    throw new CryptoSettlementError("BINDING_MISMATCH", "Payment order binding does not match.", 400);
  }
  if (input.expectedUserId && tx.user_id?.toString() !== input.expectedUserId) {
    throw new CryptoSettlementError("WRONG_ACCOUNT", "This deposit belongs to another account.", 403);
  }

  const status = input.payment.status;
  if (!isCreditableCryptoStatus(status)) {
    throw new CryptoSettlementError(
      "NOT_PAID",
      status === "underpaid"
        ? "The crypto payment was underpaid and needs owner review."
        : `The crypto payment is not settled yet (${status}).`,
      409,
    );
  }

  const expectedAmountPaise = Math.round(Number(tx.amount_paise));
  if (expectedAmountPaise !== input.expectedAmountPaise) {
    throw new CryptoSettlementError("AMOUNT_MISMATCH", "The invoice amount does not match this deposit.", 400);
  }

  // The provider reports the amount in the INVOICE currency. It must equal the
  // amount we invoiced. The wallet credit is the INR figure locked when the
  // invoice was created, so it never moves with a live exchange rate.
  const invoiceCurrency = String(tx.oxapay_invoice_currency || "INR").trim().toUpperCase() || "INR";
  const lockedRate = Number(tx.oxapay_fiat_rate_locked);
  const rate = invoiceCurrency === "INR" ? 1 : (Number.isFinite(lockedRate) && lockedRate > 0 ? lockedRate : 1);
  const providerAmount = input.payment.amount;
  const invoicedAmount = Number(tx.oxapay_invoice_amount);

  if (providerAmount !== null && Number.isFinite(invoicedAmount) && invoicedAmount > 0) {
    const providerScaled = Math.round(providerAmount * 100);
    const invoicedScaled = Math.round(invoicedAmount * 100);
    if (providerScaled !== invoicedScaled) {
      throw new CryptoSettlementError("AMOUNT_MISMATCH", "The settled amount does not match this deposit.", 400);
    }
  } else if (providerAmount !== null) {
    const observedInrPaise = Math.round(providerAmount * rate * 100);
    if (observedInrPaise !== expectedAmountPaise) {
      throw new CryptoSettlementError("AMOUNT_MISMATCH", "The settled amount does not match this deposit.", 400);
    }
  }
  const observedInrPaise = expectedAmountPaise;

  // A chain transaction that already funded another invoice is a replay.
  const hashes = input.payment.transactions.map((item) => item.txHash).filter(Boolean);
  const conflicting = await findConflictingCryptoHashes({ transactionId: tx._id, hashes });
  if (conflicting.length) {
    throw new CryptoSettlementError(
      "DUPLICATE_CHAIN_TRANSACTION",
      "This on-chain transaction was already credited under another invoice.",
      409,
    );
  }

  const { recorded, alreadyKnown } = await recordCryptoTransactions({
    trackId: input.trackId,
    transactionId: tx._id,
    transactions: input.payment.transactions,
  });

  const summary = summarizeTransactions(input.payment.transactions);
  const cryptoTxHashes = input.payment.transactions.map((item) => item.txHash).filter(Boolean);

  const result = await settleProviderDeposit({
    provider: "oxapay",
    method: "OXAPAY_CRYPTO",
    internalTransactionId: input.internalTransactionId,
    providerOrderId: input.trackId,
    providerOrderIdField: "oxapay_track_id",
    expectedProviderOrderId: input.trackId,
    expectedUserId: input.expectedUserId,
    expectedAmountPaise,
    expectedCurrency: "INR",
    settlementKey: `oxapay:${input.trackId}`,
    environment: input.sandbox ? "sandbox" : "live",
    allowTestWalletCredit: input.allowSandboxCredit,
    eventId: input.eventId,
    eventType: input.eventType,
    transactionFields: {
      oxapay_status: status,
      oxapay_settled_amount: providerAmount,
      oxapay_settled_currency: invoiceCurrency,
      oxapay_settled_inr: observedInrPaise / 100,
      crypto_paid_amount: summary.total,
      crypto_paid_currency: summary.currency,
      crypto_tx_hashes: cryptoTxHashes,
      oxapay_settled_by: "oxapay_webhook",
    },
    ledgerFields: {
      crypto_amount: summary.total,
      crypto_currency: summary.currency,
      crypto_currencies: summary.currencies,
      crypto_networks: summary.networks,
      crypto_rate: summary.rate,
      crypto_tx_hashes: cryptoTxHashes,
    },
    settledMatchFilter: { oxapay_track_id: input.trackId },
    currencyMismatchMessage: "Only INR wallet deposits are supported.",
  });

  return {
    ...result,
    cryptoTransactions: recorded + alreadyKnown,
    reviewRequired: false,
  };
}

/**
 * Fail-closed review marker for an underpaid, refunded or otherwise ambiguous
 * crypto payment. The account is held and the owner is notified; nothing is
 * credited automatically.
 */
export async function flagCryptoPaymentForReview(input: {
  trackId: string;
  reason: string;
  providerStatus: OxaPayStatus;
  observedAmountPaise?: number | null;
}): Promise<{ transactionFound: boolean }> {
  await ensurePaymentProviderIndexes();
  const db = await getDb();

  const tx: any = await db.collection("transactions").findOne({ oxapay_track_id: input.trackId });
  if (!tx) return { transactionFound: false };

  await db.collection("transactions").updateOne(
    { _id: tx._id },
    {
      $set: {
        payment_review_required: true,
        payment_review_reason: input.reason,
        oxapay_status: input.providerStatus,
        observed_amount_paise: input.observedAmountPaise ?? null,
        updated_at: new Date(),
      },
    },
  );

  // A held account cannot keep depositing while an ambiguous crypto payment
  // is unresolved. The owner can lift the hold from the Telegram control panel.
  await db.collection("users").updateOne(
    { _id: tx.user_id },
    {
      $set: {
        payment_hold: true,
        payment_hold_reason: input.reason,
        payment_hold_at: new Date(),
      },
    },
  );

  return { transactionFound: true };
}
