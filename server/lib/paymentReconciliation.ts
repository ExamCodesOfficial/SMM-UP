import { fetchFamGatewayOrder, isFamGatewayOrderId } from "./famgateway.js";
import { fetchOxaPayPayment, isOxaPayTrackId } from "./oxapay.js";
import { settleFamGatewayDeposit } from "./wallet.js";
import { flagCryptoPaymentForReview, settleCryptoDeposit } from "./cryptoSettlement.js";
import { getDb } from "./db.js";
import { sendPaymentSuccessAlert } from "./telegram.js";

/**
 * Provider reconciliation.
 *
 * The webhook is the primary settlement trigger. This module is the safety
 * net: it re-reads the authoritative provider state for an order whose webhook
 * never arrived (network loss, a deploy during the callback, a provider
 * outage) and settles it through exactly the same code path the webhook uses.
 *
 * It is deliberately idempotent — running it twice can never credit twice.
 */

export type ReconcileOutcome =
  | "settled"
  | "already_settled"
  | "pending"
  | "expired"
  | "review_required"
  | "skipped"
  | "error";

export interface ReconcileResult {
  outcome: ReconcileOutcome;
  transactionId: string;
  amount?: number;
  newBalance?: number;
  detail?: string;
}

export async function reconcileFamGatewayTransaction(tx: any): Promise<ReconcileResult> {
  const transactionId = String(tx?._id || "");
  const orderId = tx?.famgateway_order_id;

  if (!isFamGatewayOrderId(orderId)) {
    return { outcome: "skipped", transactionId, detail: "no_provider_reference" };
  }
  if (tx.status === "paid" || tx.status === "test_paid") {
    return { outcome: "already_settled", transactionId, amount: Number(tx.amount || 0) };
  }

  try {
    const order = await fetchFamGatewayOrder(orderId);

    if (order.status === "expired") {
      if (tx.status === "pending") {
        const db = await getDb();
        await db.collection("transactions").updateOne(
          { _id: tx._id, status: "pending" },
          { $set: { status: "expired", expired_at: new Date(), updated_at: new Date() } },
        );
      }
      return { outcome: "expired", transactionId };
    }

    if (order.status !== "success") {
      return { outcome: "pending", transactionId };
    }

    const expectedAmountPaise = Math.round(Number(tx.amount_paise));
    const settledAmountPaise = order.payableAmount !== null
      ? Math.round(order.payableAmount * 100)
      : order.amount !== null
        ? Math.round(order.amount * 100)
        : expectedAmountPaise;

    if (settledAmountPaise !== expectedAmountPaise) {
      const db = await getDb();
      await db.collection("transactions").updateOne(
        { _id: tx._id },
        {
          $set: {
            payment_review_required: true,
            payment_review_reason: `FamGateway settled ${settledAmountPaise} paise but ${expectedAmountPaise} paise was expected.`,
            updated_at: new Date(),
          },
        },
      );
      return { outcome: "review_required", transactionId, detail: "amount_mismatch" };
    }

    const result = await settleFamGatewayDeposit({
      internalTransactionId: transactionId,
      famgatewayOrderId: orderId,
      expectedUserId: tx.user_id?.toString(),
      expectedAmountPaise,
      utr: order.utr,
      transactionId: order.transactionId,
      senderName: order.senderName,
      eventId: orderId,
      eventType: "payment.reconciled",
    });

    if (!result.alreadySettled && result.walletCredited) {
      sendPaymentSuccessAlert({
        userEmail: String(tx.user_email || "unknown"),
        amount: result.amount,
        method: "UPI Automatic (FamGateway, reconciled)",
        utr: order.utr || undefined,
        transactionId: order.transactionId || orderId,
        memo: orderId,
        newBalance: result.newBalance,
      }).catch((error) => console.error("FamGateway reconcile alert error:", error));
    }

    return {
      outcome: result.alreadySettled ? "already_settled" : "settled",
      transactionId,
      amount: result.amount,
      newBalance: result.newBalance,
    };
  } catch (error: any) {
    console.error("FamGateway reconciliation error:", error?.message || error);
    return { outcome: "error", transactionId, detail: "provider_unavailable" };
  }
}

export async function reconcileOxaPayTransaction(tx: any): Promise<ReconcileResult> {
  const transactionId = String(tx?._id || "");
  const trackId = tx?.oxapay_track_id;

  if (!isOxaPayTrackId(trackId)) {
    return { outcome: "skipped", transactionId, detail: "no_provider_reference" };
  }
  if (tx.status === "paid" || tx.status === "test_paid") {
    return { outcome: "already_settled", transactionId, amount: Number(tx.amount || 0) };
  }

  try {
    const payment = await fetchOxaPayPayment(trackId);

    if (payment.status === "underpaid" || payment.status === "refunding" || payment.status === "refunded") {
      await flagCryptoPaymentForReview({
        trackId,
        providerStatus: payment.status,
        observedAmountPaise: payment.amount !== null ? Math.round(payment.amount * 100) : null,
        reason: `OxaPay reported a ${payment.status} crypto invoice. Wallet reconciliation is required.`,
      });
      return { outcome: "review_required", transactionId, detail: payment.status };
    }

    if (payment.status === "expired") {
      if (tx.status === "pending") {
        const db = await getDb();
        await db.collection("transactions").updateOne(
          { _id: tx._id, status: "pending" },
          { $set: { status: "expired", expired_at: new Date(), oxapay_status: payment.status, updated_at: new Date() } },
        );
      }
      return { outcome: "expired", transactionId };
    }

    if (payment.status !== "paid" && payment.status !== "manual_accept") {
      return { outcome: "pending", transactionId };
    }

    const result = await settleCryptoDeposit({
      internalTransactionId: transactionId,
      trackId,
      expectedUserId: tx.user_id?.toString(),
      expectedAmountPaise: Math.round(Number(tx.amount_paise)),
      payment,
      eventId: `oxapay:${trackId}`,
      eventType: `invoice.${payment.status}`,
      sandbox: tx.environment === "sandbox",
      allowSandboxCredit: String(process.env.OXAPAY_ALLOW_SANDBOX_CREDIT || "false").trim() === "true",
    });

    if (!result.alreadySettled && result.walletCredited) {
      sendPaymentSuccessAlert({
        userEmail: String(tx.user_email || "unknown"),
        amount: result.amount,
        method: "Crypto (OxaPay, reconciled)",
        transactionId: trackId,
        memo: trackId,
        newBalance: result.newBalance,
      }).catch((error) => console.error("OxaPay reconcile alert error:", error));
    }

    return {
      outcome: result.alreadySettled ? "already_settled" : "settled",
      transactionId,
      amount: result.amount,
      newBalance: result.newBalance,
    };
  } catch (error: any) {
    console.error("OxaPay reconciliation error:", error?.message || error);
    return { outcome: "error", transactionId, detail: "provider_unavailable" };
  }
}

export type ReconciliationProvider = "famgateway" | "oxapay";

/**
 * Sweeps pending deposits for one provider and re-checks them against the
 * provider. Returns counts only — never amounts, references or provider
 * payloads — so it can be safely exposed over the internal channel.
 */
export async function reconcilePendingDeposits(input: {
  provider: ReconciliationProvider;
  limit?: number;
  minAgeSeconds?: number;
}): Promise<{ scanned: number; settled: number; expired: number; review: number; stillPending: number; errors: number }> {
  const db = await getDb();
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  const minAgeSeconds = Math.max(0, Math.min(input.minAgeSeconds ?? 30, 86_400));

  const query = input.provider === "famgateway"
    ? { method: "FAMGATEWAY_UPI", status: "pending", famgateway_order_id: { $exists: true } }
    : { method: "OXAPAY_CRYPTO", status: "pending", oxapay_track_id: { $exists: true } };

  const cutoff = new Date(Date.now() - minAgeSeconds * 1000);
  const candidates = await db
    .collection("transactions")
    .find({ ...query, created_at: { $lte: cutoff } })
    .sort({ created_at: 1 })
    .limit(limit)
    .toArray();

  const summary = { scanned: 0, settled: 0, expired: 0, review: 0, stillPending: 0, errors: 0 };

  for (const tx of candidates) {
    summary.scanned += 1;
    const result = input.provider === "famgateway"
      ? await reconcileFamGatewayTransaction(tx)
      : await reconcileOxaPayTransaction(tx);

    if (result.outcome === "settled") summary.settled += 1;
    else if (result.outcome === "expired") summary.expired += 1;
    else if (result.outcome === "review_required") summary.review += 1;
    else if (result.outcome === "pending") summary.stillPending += 1;
    else if (result.outcome === "error") summary.errors += 1;
  }

  return summary;
}
