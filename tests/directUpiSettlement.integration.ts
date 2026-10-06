import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { settleDirectUpiPayment } from "../server/lib/directUpiSettlement.js";

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
    ]);

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
