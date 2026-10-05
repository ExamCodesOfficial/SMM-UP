import assert from "node:assert/strict";
import crypto from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { ObjectId } from "mongodb";

async function run() {
  const repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });

  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "api_key_integration_test";
    process.env.API_KEY_CREATION_FEE_INR = "29";
    process.env.API_KEY_MAX_IDENTITIES = "10";

    // The database module reads its environment at import time.
    const dbLib = await import("../server/lib/db.js");
    const keys = await import("../server/lib/apiKeys.js");
    await dbLib.ensureApiKeyIndexes();
    const db = await dbLib.getDb();
    const now = new Date();

    const userId = new ObjectId();
    await db.collection("users").insertOne({
      _id: userId,
      email: "phase1@example.com",
      username: "phase1",
      balance: 200,
      total_spent: 0,
      total_orders: 0,
      role: "user",
      created_at: now,
      updated_at: now,
    });

    const creationInput = {
      name: "Production Panel",
      scopes: [...keys.API_KEY_SCOPES],
      dailyLimitInr: 10,
      monthlyLimitInr: 20,
      expiresAt: null,
      idempotencyKey: "phase1-create-0001",
    };
    const first = await keys.createApiKey(db, userId, creationInput);
    assert.equal(first.created, true);
    assert.ok(first.raw?.startsWith("sup_"));
    assert.equal(first.balance, 171);
    assert.equal(
      await db.collection("wallet_ledger").countDocuments({ type: "api_key_creation_fee" }),
      1,
    );

    const [storedKey, storedVersion] = await Promise.all([
      db.collection("api_keys").findOne({ _id: first.key._id }),
      db.collection("api_key_versions").findOne({ key_id: first.key._id }),
    ]);
    assert.equal(storedKey?.secret_hash, undefined);
    assert.equal(storedVersion?.secret_hash, keys.hashApiKey(first.raw!));
    assert.equal(JSON.stringify(storedKey).includes(first.raw!), false);
    assert.equal(JSON.stringify(storedVersion).includes(first.raw!), false);

    const replay = await keys.createApiKey(db, userId, creationInput);
    assert.equal(replay.created, false);
    assert.equal(replay.raw, null);
    assert.equal(replay.balance, 171);
    assert.equal(
      await db.collection("wallet_ledger").countDocuments({ type: "api_key_creation_fee" }),
      1,
    );

    await assert.rejects(
      () => keys.createApiKey(db, userId, {
        ...creationInput,
        idempotencyKey: "phase1-create-0002",
      }),
      (error: any) => error?.code === "DUPLICATE_KEY",
    );
    assert.throws(
      () => keys.normalizeScopes([]),
      (error: any) => error?.code === "API_KEY_ERROR",
    );

    const authenticated = await keys.authenticateApiKey(db, first.raw!);
    assert.equal(authenticated.key._id.toString(), first.key._id.toString());
    assert.equal(keys.requireApiKeyScope(authenticated.key, "add"), "orders:create");

    await keys.reserveApiKeyOrderSpend(db, authenticated, 7, crypto.randomUUID());
    let user = await db.collection("users").findOne({ _id: userId });
    assert.equal(user?.balance, 164);
    assert.equal(user?.total_spent, 7);
    await assert.rejects(
      () => keys.reserveApiKeyOrderSpend(db, authenticated, 4, crypto.randomUUID()),
      (error: any) => error?.code === "SPEND_LIMIT_REACHED",
    );
    user = await db.collection("users").findOne({ _id: userId });
    assert.equal(user?.balance, 164);
    assert.equal(
      await db.collection("wallet_ledger").countDocuments({ type: "api_order_charge" }),
      1,
    );

    await keys.setApiKeyPaused(db, userId, first.key._id, true);
    await assert.rejects(
      () => keys.authenticateApiKey(db, first.raw!),
      (error: any) => error?.code === "KEY_PAUSED",
    );
    await keys.setApiKeyPaused(db, userId, first.key._id, false);

    const rotated = await keys.rotateApiKey(db, userId, first.key._id);
    assert.ok(rotated.raw.startsWith(`${first.key.prefix}_`));
    await assert.rejects(
      () => keys.authenticateApiKey(db, first.raw!),
      (error: any) => error?.code === "INVALID_KEY",
    );
    const rotatedAuth = await keys.authenticateApiKey(db, rotated.raw);
    assert.equal(rotatedAuth.version.version, 2);
    assert.equal(
      JSON.stringify(await db.collection("api_key_versions").find({ key_id: first.key._id }).toArray())
        .includes(rotated.raw),
      false,
    );

    await assert.rejects(
      () => keys.archiveApiKey(db, userId, first.key._id, "wrong name"),
      (error: any) => error?.code === "NAME_CONFIRMATION_REQUIRED",
    );
    await keys.archiveApiKey(db, userId, first.key._id, "Production Panel");
    await assert.rejects(
      () => keys.authenticateApiKey(db, rotated.raw),
      (error: any) => error?.code === "INVALID_KEY",
    );

    const legacyUserId = new ObjectId();
    const legacyRaw = `sup_${crypto.randomBytes(24).toString("hex")}`;
    await db.collection("users").insertOne({
      _id: legacyUserId,
      email: "legacy@example.com",
      username: "legacy",
      balance: 50,
      api_key: legacyRaw,
      api_key_hash: keys.hashApiKey(legacyRaw),
      created_at: now,
      updated_at: now,
    });
    const legacyAuth = await keys.authenticateApiKey(db, legacyRaw);
    assert.equal(legacyAuth.key.legacy_migrated, true);
    assert.equal(legacyAuth.key.creation_fee_inr, 0);
    const migratedUser = await db.collection("users").findOne({ _id: legacyUserId });
    assert.equal(migratedUser?.api_key, undefined);
    assert.equal(migratedUser?.api_key_hash, undefined);
    assert.equal(migratedUser?.balance, 50);
    assert.equal(
      JSON.stringify(await db.collection("api_keys").findOne({ user_id: legacyUserId })).includes(legacyRaw),
      false,
    );

    const concurrentUserId = new ObjectId();
    await db.collection("users").insertOne({
      _id: concurrentUserId,
      email: "concurrent@example.com",
      username: "concurrent",
      balance: 100,
      total_spent: 0,
      total_orders: 0,
      created_at: now,
      updated_at: now,
    });
    const concurrentKey = await keys.createApiKey(db, concurrentUserId, {
      name: "Concurrent Key",
      scopes: [...keys.API_KEY_SCOPES],
      dailyLimitInr: 12,
      monthlyLimitInr: 12,
      expiresAt: null,
      idempotencyKey: "concurrent-create-01",
    });
    const concurrentAuth = await keys.authenticateApiKey(db, concurrentKey.raw!);
    const spendRace = await Promise.allSettled([
      keys.reserveApiKeyOrderSpend(db, concurrentAuth, 8, crypto.randomUUID()),
      keys.reserveApiKeyOrderSpend(db, concurrentAuth, 8, crypto.randomUUID()),
    ]);
    assert.equal(spendRace.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(spendRace.filter((item) => item.status === "rejected").length, 1);
    const concurrentUser = await db.collection("users").findOne({ _id: concurrentUserId });
    assert.equal(concurrentUser?.balance, 63); // ₹29 fee + exactly one ₹8 order.
    assert.equal(
      await db.collection("wallet_ledger").countDocuments({
        user_id: concurrentUserId,
        type: "api_order_charge",
      }),
      1,
    );

    const idempotentUserId = new ObjectId();
    await db.collection("users").insertOne({
      _id: idempotentUserId,
      email: "idempotent@example.com",
      username: "idempotent",
      balance: 100,
    });
    const duplicateRequest = {
      name: "Same Request",
      scopes: [...keys.API_KEY_SCOPES],
      idempotencyKey: "same-request-0001",
    };
    const creationRace = await Promise.allSettled([
      keys.createApiKey(db, idempotentUserId, duplicateRequest),
      keys.createApiKey(db, idempotentUserId, duplicateRequest),
    ]);
    assert.equal(creationRace.filter((item) => item.status === "fulfilled").length, 2);
    const creationResults = creationRace.map((item: any) => item.value);
    assert.equal(creationResults.filter((item: any) => item.created).length, 1);
    assert.equal(creationResults.filter((item: any) => item.raw === null).length, 1);
    assert.equal((await db.collection("users").findOne({ _id: idempotentUserId }))?.balance, 71);
    assert.equal(await db.collection("api_keys").countDocuments({ user_id: idempotentUserId }), 1);
    assert.equal(
      await db.collection("wallet_ledger").countDocuments({
        user_id: idempotentUserId,
        type: "api_key_creation_fee",
      }),
      1,
    );

    assert.ok(await db.collection("api_key_audit").countDocuments({ action: "created" }) >= 3);
    assert.ok(await db.collection("api_key_audit").countDocuments({ action: "secret_rotated" }) >= 1);
    assert.ok(await db.collection("api_key_audit").countDocuments({ action: "archived" }) >= 1);

    await (await dbLib.getMongoClient()).close();
    console.log("API-key replica-set integration tests passed.");
  } finally {
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
