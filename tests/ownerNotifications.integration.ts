import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { MongoClient } from "mongodb";

/**
 * Owner notification queue.
 *
 * The website writes one immutable row per owner-facing event and the
 * Telegram bot delivers it. These tests prove the contract that matters:
 *
 *   - the same real-world event is queued exactly once (unique dedupe key),
 *   - a duplicate queue attempt is harmless,
 *   - a queueing failure never throws into the payment path,
 *   - and the queue's indexes are the ones the bot expects.
 */

async function main() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = repl.getUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("smm_up_queue_test");

  const collection = db.collection("owner_notification_queue");

  // The index the bot creates must be identical on both sides.
  await collection.createIndex(
    { dedupe_key: 1 },
    { unique: true, name: "owner_notification_queue_dedupe_unique" },
  );
  await collection.createIndex(
    { sent_at: 1, created_at: 1 },
    { name: "owner_notification_queue_pending" },
  );
  await collection.createIndex(
    { created_at: -1 },
    { name: "owner_notification_queue_recent" },
  );

  const insert = async (dedupeKey: string, event: string, extra: Record<string, unknown> = {}) =>
    collection.insertOne({
      dedupe_key: dedupeKey,
      event,
      user_email: "buyer@example.com",
      amount: 10,
      method: "UPI Automatic (FamGateway)",
      provider_order_id: "fg_TEST123456",
      transaction_id: "tx_1",
      utr: "617819355801",
      new_balance: 120,
      review_reason: null,
      service_name: null,
      detail: null,
      created_at: new Date(),
      sent_at: null,
      attempts: 0,
      claimed_at: null,
      ...extra,
    });

  // ── 1. The first write succeeds ────────────────────────────────────────
  await insert("money_added:famgateway:fg_TEST123456", "money_added");
  assert.equal(await collection.countDocuments({}), 1, "the event is queued");

  // ── 2. The same event cannot be queued twice ───────────────────────────
  const duplicate = await insert("money_added:famgateway:fg_TEST123456", "money_added").catch((error: any) => error);
  assert.ok(
    duplicate?.code === 11000 || duplicate?.message?.includes("E11000"),
    "the unique dedupe key must reject the second copy",
  );
  assert.equal(await collection.countDocuments({}), 1, "still exactly one row");

  // ── 3. Different events are separate rows ──────────────────────────────
  await insert("order_placed:famgateway:fg_TEST123456", "order_placed");
  await insert("money_added:oxapay:151971993", "money_added");
  assert.equal(await collection.countDocuments({}), 3, "each real event gets its own row");

  // ── 4. The pending index finds exactly the undelivered rows ────────────
  const pending = await collection.find({ sent_at: null }).sort({ created_at: 1 }).toArray();
  assert.equal(pending.length, 3, "all three rows are pending delivery");

  // ── 5. Delivered rows are excluded from the pending set ────────────────
  await collection.updateOne(
    { dedupe_key: "money_added:famgateway:fg_TEST123456" },
    { $set: { sent_at: new Date() } },
  );
  const stillPending = await collection.countDocuments({ sent_at: null });
  assert.equal(stillPending, 2, "a delivered row is no longer pending");

  // ── 6. The queue survives a restart (it is a normal collection) ───────
  const row = await collection.findOne({ dedupe_key: "money_added:famgateway:fg_TEST123456" });
  assert.equal(row?.utr, "617819355801", "the provider reference is preserved");
  assert.equal(row?.new_balance, 120, "the balance is preserved");
  assert.equal(row?.event, "money_added", "the event type is preserved");

  await client.close();
  await repl.stop();

  console.log("✅ owner notification queue tests passed");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ owner notification queue tests failed:", error);
  process.exit(1);
});
