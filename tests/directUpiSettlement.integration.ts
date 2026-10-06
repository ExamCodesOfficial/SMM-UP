import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { normalizeDirectUpiReceiptMemo, settleDirectUpiPayment } from "../server/lib/directUpiSettlement.js";
import { buildUniquePayableCandidates, reserveUniqueDirectUpiAmount } from "../server/lib/directUpiQuote.js";

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const client = new MongoClient(repl.getUri());
  try {
    await client.connect();
    const db = client.db("direct_upi_integration");
    await Promise.all([
      db.collection("processed_transactions").createIndex({ utr: 1 }, { unique: true, sparse: true }),
      db.collection("processed_transactions").createIndex({ transaction_id: 1 }, { unique: true, sparse: true }),
      db.collection("processed_transactions").createIndex({ memo: 1 }, { unique: true, sparse: true }),
      db.collection("transactions").createIndex({ direct_upi_settlement_key: 1 }, { unique: true, sparse: true }),
      db.collection("wallet_ledger").createIndex({ settlement_key: 1 }, { unique: true }),
      db.collection("direct_upi_amount_reservations").createIndex({ amount_paise: 1 }, { unique: true }),
      db.collection("direct_upi_amount_reservations").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    ]);

    assert.deepEqual(buildUniquePayableCandidates(5_000, 1_000, 100_000, 0).slice(0, 3), [5_001, 5_002, 5_003]);
    assert.equal(buildUniquePayableCandidates(100_000, 1_000, 100_000, 0)[0], 99_999, "maximum quote must safely fall below the cap");
    assert.equal(buildUniquePayableCandidates(5_050, 1_000, 100_000, 49).some((value) => value % 100 === 0), false, "legacy whole-rupee amounts must never become reserved fallback quotes");
    assert.equal(normalizeDirectUpiReceiptMemo("SUPAB123"), "SUPAB123");
    assert.equal(normalizeDirectUpiReceiptMemo("Paid via CRED"), undefined, "a provider replacement purpose is an absent SUP, not a mismatching SUP");
    const reservedUntil = new Date(Date.now() + 24 * 60 * 60_000);
    const quoteIds = [new ObjectId(), new ObjectId()];
    const concurrentQuotes = await Promise.all(quoteIds.map((pendingId) => reserveUniqueDirectUpiAmount(db, {
      pendingId,
      requestedAmountPaise: 5_000,
      minAmountPaise: 1_000,
      maxAmountPaise: 100_000,
      reservedUntil,
    })));
    assert.notEqual(concurrentQuotes[0].amountPaise, concurrentQuotes[1].amountPaise, "concurrent deposits must receive globally distinct payable paise");

    const userId = new ObjectId();
    const otherUserId = new ObjectId();
    await db.collection("users").insertMany([
      { _id: userId, email: "payer@example.com", balance: 0 },
      { _id: otherUserId, email: "other@example.com", balance: 0 },
    ]);
    const pendingId = new ObjectId();
    await db.collection("transactions").insertOne({
      _id: pendingId,
      user_id: userId,
      user_email: "payer@example.com",
      method: "FAMPAY_UPI",
      amount: 100,
      memo: "SUPABCDE",
      status: "pending",
      expires_at: new Date(Date.now() + 60_000),
    });

    const exact = {
      db, client, userId, userEmail: "payer@example.com", pendingId,
      expectedAmount: 100, expectedMemo: "SUPABCDE", receivedAmount: 100,
      receiptMemo: "SUPABCDE", utr: "123456789012", transactionId: "FMPIBEXACT1",
      source: "manual_identifier_verify" as const,
    };
    const concurrent = await Promise.allSettled([
      settleDirectUpiPayment(exact),
      settleDirectUpiPayment(exact),
    ]);
    assert.equal(concurrent.filter((item) => item.status === "fulfilled").length, 1, "exactly one concurrent settlement must commit");
    assert.equal(concurrent.filter((item) => item.status === "rejected").length, 1);
    assert.equal((await db.collection("users").findOne({ _id: userId }))?.balance, 100);
    assert.equal(await db.collection("processed_transactions").countDocuments({ pending_transaction_id: pendingId }), 1);
    assert.equal(await db.collection("wallet_ledger").countDocuments({ transaction_id: pendingId }), 1);
    assert.equal((await db.collection("transactions").findOne({ _id: pendingId }))?.status, "paid");

    const heldPendingId = new ObjectId();
    await db.collection("users").updateOne({ _id: userId }, { $set: { payment_hold: true } });
    await db.collection("transactions").insertOne({
      _id: heldPendingId, user_id: userId, method: "FAMPAY_UPI", amount: 50,
      memo: "SUPHELD1", status: "pending", expires_at: new Date(Date.now() + 60_000),
    });
    await assert.rejects(() => settleDirectUpiPayment({
      ...exact, pendingId: heldPendingId, expectedAmount: 50, receivedAmount: 50,
      expectedMemo: "SUPHELD1", receiptMemo: "SUPHELD1", utr: "123456789013", transactionId: "FMPIBHELD1",
    }), (error: any) => error?.code === "PAYMENT_HOLD_ACTIVE");
    assert.equal((await db.collection("transactions").findOne({ _id: heldPendingId }))?.status, "pending", "failed credit must roll the claim back");
    assert.equal(await db.collection("processed_transactions").countDocuments({ pending_transaction_id: heldPendingId }), 0);

    const expiredPendingId = new ObjectId();
    await db.collection("transactions").insertOne({
      _id: expiredPendingId, user_id: userId, method: "FAMPAY_UPI", amount: 20,
      memo: "SUPEXPR1", status: "pending", expires_at: new Date(Date.now() - 1_000),
    });
    await assert.rejects(() => settleDirectUpiPayment({
      ...exact, pendingId: expiredPendingId, expectedAmount: 20, receivedAmount: 20,
      expectedMemo: "SUPEXPR1", receiptMemo: "SUPEXPR1", utr: "123456789014", transactionId: "FMPIBEXPR1",
    }), (error: any) => error?.code === "PENDING_DEPOSIT_STALE");

    // Website-side exact receipt verification may safely recover a recently
    // expired request; the background worker never receives this exception.
    await db.collection("users").updateOne({ _id: userId }, { $unset: { payment_hold: "" } });
    const latePendingId = new ObjectId();
    await db.collection("transactions").insertOne({
      _id: latePendingId, user_id: userId, method: "FAMPAY_UPI", amount: 20,
      memo: "SUPLATE1", status: "expired", created_at: new Date(Date.now() - 60 * 60_000),
      expires_at: new Date(Date.now() - 30 * 60_000),
    });
    const lateResult = await settleDirectUpiPayment({
      ...exact, pendingId: latePendingId, expectedAmount: 20, receivedAmount: 20,
      expectedMemo: "SUPLATE1", receiptMemo: "SUPLATE1", utr: "123456789018", transactionId: "FMPIBLATE1",
      allowExpiredWithinHours: 24,
    });
    assert.equal(lateResult.newBalance, 120);
    assert.equal((await db.collection("transactions").findOne({ _id: latePendingId }))?.status, "paid");

    const uniquePendingId = new ObjectId();
    const uniqueQuote = await reserveUniqueDirectUpiAmount(db, {
      pendingId: uniquePendingId,
      requestedAmountPaise: 3_000,
      minAmountPaise: 1_000,
      maxAmountPaise: 100_000,
      reservedUntil,
    });
    await db.collection("transactions").insertOne({
      _id: uniquePendingId, user_id: userId, method: "FAMPAY_UPI", amount: uniqueQuote.amount,
      quoted_amount_paise: uniqueQuote.amountPaise, unique_amount_reservation: true,
      memo: "SUPUNIQ1", status: "expired", created_at: new Date(Date.now() - 30 * 60_000),
      expires_at: new Date(Date.now() - 5 * 60_000),
    });
    await assert.rejects(() => settleDirectUpiPayment({
      ...exact,
      pendingId: uniquePendingId,
      expectedAmount: uniqueQuote.amount,
      receivedAmount: uniqueQuote.amount,
      expectedMemo: "SUPUNIQ1",
      receiptMemo: "Paid via CRED",
      receiptDate: new Date(Date.now() - 60 * 60_000),
      utr: "123456789018",
      transactionId: "FMPIBLEGACY1",
      allowExpiredWithinHours: 24,
      allowMissingMemoWithUniqueAmount: true,
    }), /reservation is missing or expired/, "a receipt predating its reservation must never be rebound by amount");
    const uniqueResult = await settleDirectUpiPayment({
      ...exact,
      pendingId: uniquePendingId,
      expectedAmount: uniqueQuote.amount,
      receivedAmount: uniqueQuote.amount,
      expectedMemo: "SUPUNIQ1",
      receiptMemo: "Paid via CRED",
      receiptDate: new Date(),
      utr: "123456789019",
      transactionId: "FMPIBUNIQUE1",
      allowExpiredWithinHours: 24,
      allowMissingMemoWithUniqueAmount: true,
    });
    assert.equal(uniqueResult.newBalance, 120 + uniqueQuote.amount);
    assert.equal((await db.collection("transactions").findOne({ _id: uniquePendingId }))?.status, "paid");

    await assert.rejects(() => settleDirectUpiPayment({
      ...exact, pendingId, userId: otherUserId,
      utr: "123456789015", transactionId: "FMPIBWRONG1",
    }), (error: any) => error?.code === "PENDING_DEPOSIT_STALE");

    await assert.rejects(() => settleDirectUpiPayment({
      ...exact, receiptMemo: "SUPWRONG",
      utr: "123456789016", transactionId: "FMPIBWRONG2",
    }), (error: any) => error?.code === "RECEIPT_MISMATCH");
    await assert.rejects(() => settleDirectUpiPayment({
      ...exact, receiptMemo: undefined,
      utr: "123456789017", transactionId: "FMPIBNOMEMO",
    }), (error: any) => error?.code === "RECEIPT_MISMATCH");

    console.log("Exact Direct UPI settlement integration checks passed.");
  } finally {
    await client.close();
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
