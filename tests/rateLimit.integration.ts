import assert from "node:assert/strict";
import crypto from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  let dbLib: any = null;
  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "rate_limit_integration";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    dbLib = await import("../server/lib/db.js");
    const limiter = await import("../server/lib/rateLimit.js");
    const db = await dbLib.getDb();
    const key = `concurrent_${crypto.randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 20 }, () => limiter.checkRateLimit(key, 5, 60, db)));
    assert.equal(results.filter((item) => item.allowed).length, 5, "only five concurrent attempts may pass");
    assert.equal(results.filter((item) => !item.allowed).length, 15);
    assert.ok(results.filter((item) => !item.allowed).every((item) => item.remainingSec > 0));
    assert.equal(await db.collection("rate_limits").countDocuments(), 1);
    const record: any = await db.collection("rate_limits").findOne({});
    assert.equal(record.count, 5);
    assert.equal(JSON.stringify(record).includes(key), false, "raw limiter keys must not be stored");
    await limiter.resetRateLimit(key, db);
    assert.equal((await limiter.checkRateLimit(key, 5, 60, db)).allowed, true);
    console.log("Persistent shared rate-limit integration checks passed.");
  } finally {
    if (dbLib) await (await dbLib.getMongoClient()).close().catch(() => {});
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
