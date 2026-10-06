import assert from "node:assert/strict";
import crypto from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

function response(): any {
  const headers: Record<string, any> = {};
  return {
    headers,
    setHeader(name: string, value: any) { headers[name.toLowerCase()] = value; },
    getHeader(name: string) { return headers[name.toLowerCase()]; },
  };
}

function sessionCookie(headers: Record<string, any>) {
  const raw = headers["set-cookie"];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.map(String).find((value) => value.startsWith("smm_up_session="))?.split(";")[0] || "";
}

function request(cookie = ""): any {
  return {
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie, "user-agent": "redeploy-test", "x-forwarded-for": "203.0.113.40" },
    socket: { remoteAddress: "203.0.113.40" },
  };
}

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  let dbLib: any = null;
  const secondClient = new MongoClient(repl.getUri());
  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "session_redeploy";
    process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
    process.env.NODE_ENV = "test";

    const auth = await import("../server/lib/auth.js");
    dbLib = await import("../server/lib/db.js");
    const db = await dbLib.getDb();
    const user = {
      _id: new ObjectId(),
      username: "persistent-member",
      email: "persistent@example.com",
      role: "user",
      account_locked: false,
      created_at: new Date(),
    };
    await db.collection("users").insertOne(user);

    const created = response();
    await auth.createUserSession(db, request(), created, user);
    const cookie = sessionCookie(created.headers);
    assert.match(cookie, /^smm_up_session=sms_/);
    assert.equal(await db.collection("sessions").countDocuments({ user_id: user._id, revoked_at: null }), 1);

    // A new deployment instance reads the opaque token from shared MongoDB.
    // JWT signing-key changes do not affect opaque sms_ sessions.
    await secondClient.connect();
    process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
    const secondInstanceDb = secondClient.db("session_redeploy");
    const restored = await auth.getUserFromRequest(request(cookie), secondInstanceDb);
    assert.equal(restored?.userId, user._id.toString());
    assert.equal(restored?.username, "persistent-member");
    assert.equal(restored?.legacyJwt, undefined);

    const persisted: any = await secondInstanceDb.collection("sessions").findOne({ user_id: user._id });
    assert.ok(persisted?.token_hash && !JSON.stringify(persisted).includes(cookie.split("=")[1]), "only the session hash may persist");
    console.log("Opaque MongoDB session survived an independent deployment instance and signing-key change.");
  } finally {
    await secondClient.close().catch(() => {});
    if (dbLib) await (await dbLib.getMongoClient()).close().catch(() => {});
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
