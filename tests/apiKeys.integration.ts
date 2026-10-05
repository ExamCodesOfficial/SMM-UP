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
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.PANEL_URL = "https://invalid.test";
    process.env.PANEL_KEY = crypto.randomBytes(16).toString("hex");
    process.env.TIER1_MARKUP = String(1 + Math.random());
    process.env.TIER2_MARKUP = String(2 + Math.random());

    // The database and authentication modules read environment at import time.
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

    const activityOrderId = new ObjectId();
    await keys.recordApiKeyActivity(db, authenticated, {
      action: "add",
      scope: "orders:create",
      httpStatus: 200,
      result: "success",
      requestId: crypto.randomUUID(),
      orderId: activityOrderId,
      serviceId: 123,
      serviceName: "Integration service",
      target: "https://example.com/public-target",
      quantity: 100,
      grossChargeInr: 7,
      refundInr: 0,
      netChargeInr: 7,
      startedAt: new Date(Date.now() - 25),
    });
    const activity = await db.collection("api_key_activity").findOne({ api_key_id: first.key._id });
    assert.equal(activity?.service_id, 123);
    assert.equal(activity?.gross_charge_inr, 7);
    assert.equal(activity?.net_charge_inr, 7);
    assert.equal(JSON.stringify(activity).includes(first.raw!), false);
    await db.collection("orders").insertOne({
      _id: activityOrderId,
      user_id: userId,
      api_key_id: first.key._id,
      api_key_version: 1,
      service_id: 123,
      service_name: "Integration service",
      link: "https://example.com/public-target",
      quantity: 100,
      charge: 7,
      status: "Pending",
      created_at: new Date(),
    });

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

    const { signUserToken } = await import("../server/lib/auth.js");
    const authHandler = (await import("../api/auth/[action].js")).default;
    const token = signUserToken({
      _id: userId,
      email: "phase1@example.com",
      username: "phase1",
      role: "user",
    });
    const makeResponse = () => {
      const response: any = {
        statusCode: 200,
        body: null,
        headers: {},
        status(code: number) { this.statusCode = code; return this; },
        json(body: any) { this.body = body; return body; },
        setHeader(name: string, value: any) { this.headers[name] = value; },
      };
      return response;
    };
    const reportResponse = makeResponse();
    await authHandler({
      method: "GET",
      query: { action: "api-key-report", keyId: first.key._id.toString() },
      headers: { cookie: `smm_up_session=${token}` },
      socket: { remoteAddress: "127.0.0.1" },
    } as any, reportResponse);
    assert.equal(reportResponse.statusCode, 200);
    assert.equal(reportResponse.body.summaries[0].key.status, "archived");
    assert.equal(reportResponse.body.summaries[0].grossChargeInr, 7);
    assert.equal(reportResponse.body.summaries[0].netChargeInr, 7);
    assert.equal(reportResponse.body.orders[0].target, "https://example.com/public-target");

    const activityResponse = makeResponse();
    await authHandler({
      method: "GET",
      query: {
        action: "api-key-activity",
        keyId: first.key._id.toString(),
        serviceId: "123",
        outcome: "success",
      },
      headers: { cookie: `smm_up_session=${token}` },
      socket: { remoteAddress: "127.0.0.1" },
    } as any, activityResponse);
    assert.equal(activityResponse.statusCode, 200);
    assert.equal(activityResponse.body.activity.length, 1);
    assert.equal(activityResponse.body.activity[0].serviceId, 123);
    assert.equal(activityResponse.body.retentionDays, 90);

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
