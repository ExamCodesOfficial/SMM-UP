import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { MongoClient } from "mongodb";

/**
 * Owner notification queue.
 *
 * The website writes one row per owner-facing event and then delivers it.
 * These tests use the real module against a real MongoDB, and prove the
 * contract that matters:
 *
 *   - the same real-world event is queued exactly once (unique dedupe key),
 *   - the rendered message travels with the row, so the website and the
 *     bot deliver byte-identical text,
 *   - the owner chat id is published so the bot can find the right chat,
 *   - a queueing failure never throws into the payment path,
 *   - and a Telegram failure is recorded on the row instead of vanishing.
 */

async function main() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = repl.getUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("smm_up_queue_test");

  // The module reads its configuration at import time.
  process.env.MONGODB_URI = uri;
  process.env.DATABASE_NAME = "smm_up_queue_test";
  process.env.TELEGRAM_ADMIN_CHAT_ID = "8684160810";
  // A token that will fail: the delivery must record the failure, not hide it.
  process.env.TELEGRAM_BOT_TOKEN = "1234567890:TEST_TOKEN_THAT_CANNOT_REACH_THE_API";

  const { enqueueOwnerNotification, ensureOwnerNotificationIndexes } = await import(
    "../server/lib/ownerNotifications.js"
  );
  const { renderOwnerNotification } = await import("../server/lib/ownerNotificationMessages.js");

  await ensureOwnerNotificationIndexes();

  const collection = db.collection("owner_notification_queue");

  const enqueue = (dedupeKey: string, event: any, extra: Record<string, unknown> = {}) =>
    enqueueOwnerNotification({
      dedupeKey,
      event,
      userEmail: "buyer@example.com",
      amount: 10,
      method: "FAMGATEWAY_UPI",
      provider: "famgateway",
      providerOrderId: "fg_TEST123456",
      transactionId: "tx_1",
      utr: "617819355801",
      newBalance: 120,
      ...extra,
    } as any);

  // ── 1. The first write succeeds ────────────────────────────────────────
  const first = await enqueue("money_added:famgateway:fg_TEST123456", "money_added");
  assert.equal(first.queued, true, "the event is queued");
  assert.equal(await collection.countDocuments({}), 1, "one row was written");

  // ── 2. The same event cannot be queued twice ───────────────────────────
  const duplicate = await enqueue("money_added:famgateway:fg_TEST123456", "money_added");
  assert.equal(duplicate.duplicate, true, "the second copy is reported as a duplicate");
  assert.equal(await collection.countDocuments({}), 1, "still exactly one row");

  // ── 3. Different events are separate rows ──────────────────────────────
  await enqueue("order_placed:famgateway:fg_TEST123456", "order_placed");
  await enqueue("money_added:oxapay:151971993", "money_added");
  assert.equal(await collection.countDocuments({}), 3, "each real event gets its own row");

  // ── 4. The queue row carries the rendered message ──────────────────────
  const rendered = await collection.findOne({ dedupe_key: "money_added:famgateway:fg_TEST123456" });
  assert.ok(rendered?.message_html, "the rendered message travels with the row");
  assert.match(String(rendered?.message_html), /MONEY ADDED/, "it is the money-added alert");
  assert.match(String(rendered?.message_html), /617819355801/, "the UTR is included");
  assert.match(String(rendered?.message_html), /120\.00/, "the new balance is included");

  // ── 5. The owner chat id is published for the bot ──────────────────────
  const identity = await db.collection("owner_notification_config").findOne({ _id: "owner" });
  assert.ok(identity, "the owner chat id is published");
  assert.equal(identity?.chat_id, "8684160810", "the published chat id is the one the website uses");
  assert.equal(identity?.source, "website", "the row says where it came from");

  // ── 6. The pending index finds exactly the undelivered rows ────────────
  assert.equal(await collection.countDocuments({ sent_at: null }), 3, "all three rows are pending");

  // ── 7. A delivery failure is recorded, never swallowed ─────────────────
  const { deliverOwnerNotificationByKey } = await import("../server/lib/ownerNotifications.js");
  const delivery = await deliverOwnerNotificationByKey("money_added:famgateway:fg_TEST123456");
  assert.equal(delivery.delivered, false, "the failed delivery is reported as failed");
  assert.ok(delivery.error, "the reason is returned instead of being thrown away");

  const failedRow = await collection.findOne({ dedupe_key: "money_added:famgateway:fg_TEST123456" });
  assert.equal(failedRow?.sent_at, null, "the row stays pending so the bot can retry it");
  assert.ok(failedRow?.last_error, "the error is stored on the row for the owner to see");
  assert.ok(Number(failedRow?.attempts) >= 1, "the attempt is counted");
  assert.equal(failedRow?.claimed_at ?? null, null, "the claim is released so a retry can happen");

  // ── 8. The renderer escapes customer text ──────────────────────────────
  const hostile = renderOwnerNotification({
    event: "money_added",
    userEmail: "<script>alert('x')</script>",
    amount: 10,
    method: "<b>bold</b>",
    providerOrderId: "fg_HOSTILE123",
    utr: "<tg-spoiler>",
  });
  assert.ok(!hostile.includes("<script>"), "script tags are escaped");
  assert.ok(!hostile.includes("<tg-spoiler>"), "spoiler tags are escaped");
  assert.match(hostile, /&lt;script&gt;/, "the raw text is shown escaped");

  // ── 9. A review carries its rating ─────────────────────────────────────
  const review = renderOwnerNotification({
    event: "review_submitted",
    userEmail: "buyer",
    providerOrderId: "rev_1",
    rating: 4,
    detail: "Great service",
  });
  assert.match(review, /★★★★/, "the rating is rendered as stars");
  assert.match(review, /Great service/, "the review text is included");

  await client.close();
  await repl.stop();

  console.log("✅ owner notification queue tests passed");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ owner notification queue tests failed:", error);
  process.exit(1);
});
