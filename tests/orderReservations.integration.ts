import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { MongoClient, ObjectId } from "mongodb";

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  let client: MongoClient | null = null;
  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "order_reservations_integration";
    const [{ reserveWebsiteOrder }, dbLib] = await Promise.all([
      import("../server/lib/orderReservations.js"),
      import("../server/lib/db.js"),
    ]);

    client = await dbLib.getMongoClient();
    const db = await dbLib.getDb();

    const userId = new ObjectId();
    await db.collection("users").insertOne({
      _id: userId,
      email: "web-order@example.com",
      username: "web-order",
      balance: 10,
      total_spent: 0,
      total_orders: 0,
    });

    const reserved = await reserveWebsiteOrder(db, {
      userId,
      userEmail: "web-order@example.com",
      amountInr: 7,
      draft: { service_id: 101, service_name: "Audit service", link: "https://example.com/public", quantity: 100 },
    });
    assert.equal(reserved.newBalance, 3);
    assert.equal((await db.collection("users").findOne({ _id: userId }))?.balance, 3);
    assert.equal(await db.collection("orders").countDocuments({ _id: reserved.orderId, status: "Submitting" }), 1);
    assert.equal(await db.collection("wallet_ledger").countDocuments({
      settlement_key: `web_order_charge:${reserved.orderId.toString()}`,
      order_id: reserved.orderId,
    }), 1);

    await assert.rejects(() => reserveWebsiteOrder(db, {
      userId,
      userEmail: "web-order@example.com",
      amountInr: 5,
      draft: { service_id: 102, service_name: "Must roll back", link: "https://example.com/public", quantity: 100 },
    }), /Insufficient funds/);
    assert.equal((await db.collection("users").findOne({ _id: userId }))?.balance, 3);
    assert.equal(await db.collection("orders").countDocuments({ user_id: userId }), 1);
    assert.equal(await db.collection("wallet_ledger").countDocuments({ user_id: userId }), 1);

    const concurrentUserId = new ObjectId();
    await db.collection("users").insertOne({
      _id: concurrentUserId,
      email: "concurrent-order@example.com",
      username: "concurrent-order",
      balance: 5,
      total_spent: 0,
      total_orders: 0,
    });
    const concurrent = await Promise.allSettled([
      reserveWebsiteOrder(db, {
        userId: concurrentUserId,
        userEmail: "concurrent-order@example.com",
        amountInr: 3,
        draft: { service_id: 201, service_name: "Concurrent A", link: "https://example.com/a", quantity: 100 },
      }),
      reserveWebsiteOrder(db, {
        userId: concurrentUserId,
        userEmail: "concurrent-order@example.com",
        amountInr: 3,
        draft: { service_id: 202, service_name: "Concurrent B", link: "https://example.com/b", quantity: 100 },
      }),
    ]);
    assert.equal(concurrent.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal((await db.collection("users").findOne({ _id: concurrentUserId }))?.balance, 2);
    assert.equal(await db.collection("orders").countDocuments({ user_id: concurrentUserId }), 1);
    assert.equal(await db.collection("wallet_ledger").countDocuments({ user_id: concurrentUserId }), 1);

    console.log("Website order reservation integration checks passed.");
  } finally {
    await client?.close().catch(() => {});
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
