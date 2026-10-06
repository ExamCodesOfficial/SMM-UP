import assert from "node:assert/strict";
import crypto from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { MongoClient } from "mongodb";

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  let dbLib: any = null;
  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "core_indexes_integration";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");

    // Reproduce the legacy production schema that caused IndexKeySpecsConflict:
    // non-unique default-named indexes plus repeated null credential/memo fields.
    const bootstrap = new MongoClient(repl.getUri());
    await bootstrap.connect();
    const legacyDb = bootstrap.db(process.env.DATABASE_NAME);
    await legacyDb.collection("users").insertMany([
      { email: "one@example.com", username: "one", api_key: null },
      { email: "two@example.com", username: "two", api_key: null },
    ]);
    await legacyDb.collection("users").createIndex({ username: 1 });
    await legacyDb.collection("users").createIndex({ api_key: 1 });
    await legacyDb.collection("transactions").insertMany([{ memo: null }, { memo: null }]);
    await legacyDb.collection("transactions").createIndex({ memo: 1 });
    await bootstrap.close();

    dbLib = await import("../server/lib/db.js");
    const db = await dbLib.getDb();
    await Promise.all([
      dbLib.ensureCoreIndexes(db),
      dbLib.ensureIdentityIndexes(db),
      dbLib.ensureLegacyCredentialIndexes(db),
      dbLib.ensureDirectUpiIndexes(db),
    ]);
    const required = [
      ["users", "email_1", true],
      ["users", "users_username_normalized_unique_v2", true],
      ["users", "users_legacy_api_key_unique_v2", true],
      ["users", "users_legacy_api_key_hash_unique_v2", true],
      ["transactions", "transactions_memo_unique_v2", true],
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
      assert.ok(index, `${collectionName}.${indexName} must exist after explicit index provisioning`);
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
