import assert from "node:assert/strict";
import crypto from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { ObjectId } from "mongodb";

function mockResponse() {
  const headers = new Map<string, any>();
  return {
    headers,
    setHeader(name: string, value: any) { headers.set(name.toLowerCase(), value); },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
  } as any;
}

function cookiesFrom(response: any): string[] {
  const value = response.getHeader("Set-Cookie");
  return value ? (Array.isArray(value) ? value : [String(value)]) : [];
}

function cookieValue(cookies: string[], name: string): string {
  const prefix = `${name}=`;
  const entry = cookies.find((cookie) => cookie.startsWith(prefix));
  return entry ? entry.slice(prefix.length).split(";")[0] : "";
}

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "recovery_integration_test";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.TEMP_PASSWORD_TTL_MINUTES = "180";
    process.env.TEMP_PASSWORD_MAX_USES = "2";
    process.env.TEMP_PASSWORD_SESSION_TTL_MINUTES = "15";

    const dbLib = await import("../server/lib/db.js");
    const auth = await import("../server/lib/auth.js");
    const recovery = await import("../server/lib/recovery.js");
    await dbLib.ensureSessionIndexes();
    const db = await dbLib.getDb();
    const now = new Date();
    const userId = new ObjectId();
    const oldPassword = "Old-Permanent-Password-42";
    const temporaryPassword = "Temp-Recovery-Password-42!";
    await db.collection("users").insertOne({
      _id: userId,
      email: "recovery@example.com",
      username: "recovery-user",
      password_hash: await auth.hashPassword(oldPassword),
      role: "user",
      balance: 25,
      created_at: now,
      updated_at: now,
    });
    const temporaryId = new ObjectId();
    await db.collection("temporary_passwords").insertOne({
      _id: temporaryId,
      user_id: userId,
      user_email: "recovery@example.com",
      username: "recovery-user",
      password_hash: await auth.hashPassword(temporaryPassword),
      status: "active",
      used_count: 0,
      max_uses: 2,
      created_at: now,
      expires_at: new Date(now.getTime() + 180 * 60_000),
      invalidated_at: null,
      invalidation_reason: null,
      reason: "Integration recovery test",
      usage_events: [],
    });
    const user = await db.collection("users").findOne({ _id: userId });
    const request: any = {
      headers: { "user-agent": "Recovery Integration Browser", "x-forwarded-for": "203.0.113.10" },
      socket: { remoteAddress: "203.0.113.10" },
    };

    const wrongResponse = mockResponse();
    const wrong = await recovery.tryTemporaryPasswordLogin(db, request, wrongResponse, user, "wrong-password");
    assert.equal(wrong.accepted, false);
    assert.equal((await db.collection("temporary_passwords").findOne({ _id: temporaryId }))?.used_count, 0);

    const firstResponse = mockResponse();
    const first = await recovery.tryTemporaryPasswordLogin(db, request, firstResponse, user, temporaryPassword);
    assert.equal(first.accepted, true);
    assert.equal(first.usesRemaining, 1);
    const firstRecoveryRaw = cookieValue(cookiesFrom(firstResponse), "smm_up_recovery");
    assert.ok(firstRecoveryRaw.startsWith("smr_"));
    assert.equal(await db.collection("restricted_sessions").countDocuments({ user_id: userId }), 1);
    assert.equal(JSON.stringify(await db.collection("restricted_sessions").findOne({ user_id: userId })).includes(firstRecoveryRaw), false);

    const secondResponse = mockResponse();
    const second = await recovery.tryTemporaryPasswordLogin(db, request, secondResponse, user, temporaryPassword);
    assert.equal(second.accepted, true);
    assert.equal(second.usesRemaining, 0);
    const exhausted = await db.collection("temporary_passwords").findOne({ _id: temporaryId });
    assert.equal(exhausted?.used_count, 2);
    assert.equal(exhausted?.status, "exhausted");
    assert.equal(exhausted?.invalidation_reason, "uses_exhausted");

    const thirdResponse = mockResponse();
    const third = await recovery.tryTemporaryPasswordLogin(db, request, thirdResponse, user, temporaryPassword);
    assert.equal(third.accepted, false);

    const newPassword = "New-Permanent-Password-84!";
    const completionResponse = mockResponse();
    const completionRequest: any = {
      headers: {
        cookie: `smm_up_recovery=${firstRecoveryRaw}`,
        "user-agent": "Recovery Integration Browser",
        "x-forwarded-for": "203.0.113.10",
      },
      socket: { remoteAddress: "203.0.113.10" },
    };
    await recovery.completePasswordChange(db, completionRequest, completionResponse, newPassword);
    const changedUser = await db.collection("users").findOne({ _id: userId });
    assert.equal(await auth.verifyPassword(newPassword, String(changedUser?.password_hash)), true);
    assert.equal(await auth.verifyPassword(oldPassword, String(changedUser?.password_hash)), false);
    const completedTemporary = await db.collection("temporary_passwords").findOne({ _id: temporaryId });
    assert.equal(completedTemporary?.status, "completed");
    assert.equal(completedTemporary?.invalidation_reason, "password_changed");
    assert.equal(await db.collection("restricted_sessions").countDocuments({ user_id: userId, invalidated_at: null }), 0);

    const completionCookies = cookiesFrom(completionResponse);
    const normalRaw = cookieValue(completionCookies, "smm_up_session");
    assert.ok(normalRaw.startsWith("sms_"));
    assert.equal(JSON.stringify(await db.collection("sessions").findOne({ user_id: userId })).includes(normalRaw), false);
    const authenticated = await auth.getUserFromRequest({
      headers: { cookie: `smm_up_session=${normalRaw}` },
      socket: { remoteAddress: "203.0.113.10" },
    } as any, db);
    assert.equal(authenticated?.userId, userId.toString());
    assert.equal(authenticated?.purpose, "normal");

    const oneUseUserId = new ObjectId();
    const oneUsePassword = "One-Use-Temporary-42!";
    const oneUseUser = {
      _id: oneUseUserId,
      email: "one-use@example.com",
      username: "one-use",
      password_hash: await auth.hashPassword("Permanent-One-Use-42!"),
      role: "user",
    };
    await db.collection("users").insertOne(oneUseUser);
    await db.collection("temporary_passwords").insertOne({
      user_id: oneUseUserId,
      user_email: oneUseUser.email,
      username: oneUseUser.username,
      password_hash: await auth.hashPassword(oneUsePassword),
      status: "active",
      used_count: 0,
      max_uses: 1,
      created_at: now,
      expires_at: new Date(now.getTime() + 60_000),
      invalidated_at: null,
    });
    const concurrent = await Promise.all([
      recovery.tryTemporaryPasswordLogin(db, request, mockResponse(), oneUseUser, oneUsePassword),
      recovery.tryTemporaryPasswordLogin(db, request, mockResponse(), oneUseUser, oneUsePassword),
    ]);
    assert.equal(concurrent.filter((item) => item.accepted).length, 1);
    assert.equal(
      (await db.collection("temporary_passwords").findOne({ user_id: oneUseUserId }))?.used_count,
      1,
    );

    await (await dbLib.getMongoClient()).close();
    console.log("Temporary-password and revocable-session integration tests passed.");
  } finally {
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
