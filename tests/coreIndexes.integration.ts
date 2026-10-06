import assert from "node:assert/strict";
import crypto from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  let dbLib: any = null;
  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "core_indexes_integration";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    dbLib = await import("../server/lib/db.js");
    const db = await dbLib.getDb();
    const required = [
      ["users", "email_1", true],
      ["processed_transactions", "utr_1", true],
      ["processed_transactions", "transaction_id_1", true],
      ["processed_transactions", "memo_1", true],
      ["transactions", "direct_upi_settlement_key_1", true],
      ["wallet_ledger", "settlement_key_1", true],
      ["payment_events", "provider_1_event_id_1", true],
      ["email_verification_tokens", "token_hash_1", true],
      ["email_verification_tokens", "expires_at_1", false],
    ] as const;
    for (const [collectionName, indexName, unique] of required) {
      const indexes: any[] = await db.collection(collectionName).indexes();
      const index = indexes.find((item) => item.name === indexName);
      assert.ok(index, `${collectionName}.${indexName} must exist before getDb resolves`);
      if (unique) assert.equal(index.unique, true, `${collectionName}.${indexName} must be unique`);
    }
    const tokenIndexes: any[] = await db.collection("email_verification_tokens").indexes();
    assert.equal(tokenIndexes.find((item) => item.name === "expires_at_1")?.expireAfterSeconds, 0);
    console.log("Critical MongoDB index validation checks passed.");
  } finally {
    if (dbLib) await (await dbLib.getMongoClient()).close().catch(() => {});
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
