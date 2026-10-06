import assert from "node:assert/strict";
import crypto from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

interface Result { statusCode: number; body: any; headers: Record<string, any> }

function mockResponse(): any {
  const result: Result = { statusCode: 200, body: undefined, headers: {} };
  return {
    result,
    status(code: number) { result.statusCode = code; return this; },
    json(body: any) { result.body = body; return this; },
    end(body?: any) { result.body = body; return this; },
    setHeader(name: string, value: any) { result.headers[name.toLowerCase()] = value; },
    getHeader(name: string) { return result.headers[name.toLowerCase()]; },
  };
}

function cookieFrom(result: Result) {
  const raw = result.headers["set-cookie"];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return values.map(String).find((item) => item.startsWith("smm_up_session="))?.split(";")[0] || "";
}

function tokenFromEmail(deliveries: any[], parameter: "verify_token" | "reset_token") {
  const text = JSON.stringify(deliveries.at(-1));
  const match = text.match(new RegExp(`${parameter}=(sme_[A-Za-z0-9_-]+)`));
  assert.ok(match?.[1], `${parameter} must be delivered by email`);
  return match[1];
}

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  let dbLib: any = null;
  const originalFetch = globalThis.fetch;
  const deliveries: any[] = [];
  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "email_auth_flows";
    process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
    process.env.RESEND_API_KEY = "re_test_only";
    process.env.EMAIL_FROM = "SMM UP <security@smmup.co.in>";
    process.env.PUBLIC_SITE_URL = "https://smmup.co.in";
    process.env.PANEL_URL = "https://panel.invalid/api/v2";
    process.env.PANEL_API_KEY = "integration-test-key";
    process.env.PANEL_KEY = "integration-test-key";
    process.env.NODE_ENV = "test";
    globalThis.fetch = (async (_url: any, init: any) => {
      deliveries.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: `email_${deliveries.length}` }), { status: 200 });
    }) as typeof fetch;

    const { default: handler } = await import("../api/auth/[action].js");
    dbLib = await import("../server/lib/db.js");
    const invoke = async (action: string, body: any = {}, cookie = "") => {
      const req: any = {
        method: "POST",
        query: { action },
        body,
        headers: { cookie, "user-agent": "integration-test", "x-forwarded-for": "203.0.113.8" },
        socket: { remoteAddress: "203.0.113.8" },
      };
      const res = mockResponse();
      await handler(req, res);
      return res.result as Result;
    };

    const originalPassword = "Original!Pass123";
    const registration = await invoke("register", {
      username: "verified-member",
      email: "member@example.com",
      password: originalPassword,
    });
    assert.equal(registration.statusCode, 201);
    assert.equal(registration.body.verificationRequired, true);
    assert.equal(cookieFrom(registration), "", "registration must not create a session before verification");
    const db = await dbLib.getDb();
    const unverified: any = await db.collection("users").findOne({ email: "member@example.com" });
    assert.equal(unverified.email_verification_required, true);
    assert.equal(unverified.email_verified_at, null);

    const blockedLogin = await invoke("login", { identifier: "member@example.com", password: originalPassword });
    assert.equal(blockedLogin.statusCode, 403);
    assert.equal(blockedLogin.body.verificationRequired, true);

    const registrationToken = tokenFromEmail(deliveries, "verify_token");
    const verification = await invoke("verify-email", { token: registrationToken });
    assert.equal(verification.statusCode, 200);
    assert.equal(verification.body.signedIn, true);
    assert.ok(cookieFrom(verification));
    assert.equal((await invoke("verify-email", { token: registrationToken })).statusCode, 400, "verification token must be one-time");

    const forgot = await invoke("forgot-password", { email: "member@example.com" });
    assert.equal(forgot.statusCode, 200);
    const resetToken = tokenFromEmail(deliveries, "reset_token");
    const newPassword = "Changed!Pass456";
    const reset = await invoke("reset-password-email", { token: resetToken, password: newPassword });
    assert.equal(reset.statusCode, 200);
    assert.equal((await invoke("reset-password-email", { token: resetToken, password: "Another!Pass789" })).statusCode, 400, "reset token must be one-time");
    assert.equal((await invoke("login", { identifier: "member@example.com", password: originalPassword })).statusCode, 401);

    const newLogin = await invoke("login", { identifier: "member@example.com", password: newPassword });
    assert.equal(newLogin.statusCode, 200);
    const authenticatedCookie = cookieFrom(newLogin);
    assert.ok(authenticatedCookie);

    const emailChange = await invoke("request-email-change", {
      newEmail: "changed@example.com",
      password: newPassword,
    }, authenticatedCookie);
    assert.equal(emailChange.statusCode, 200);
    assert.equal((await db.collection("users").findOne({ _id: unverified._id }))?.email, "member@example.com", "email must not change before confirmation");
    const emailChangeToken = tokenFromEmail(deliveries, "verify_token");
    const emailConfirmation = await invoke("verify-email", { token: emailChangeToken }, authenticatedCookie);
    assert.equal(emailConfirmation.statusCode, 200);
    assert.equal(emailConfirmation.body.signedIn, false);
    assert.equal((await db.collection("users").findOne({ _id: unverified._id }))?.email, "changed@example.com");
    assert.equal((await invoke("verify-email", { token: emailChangeToken })).statusCode, 400);
    assert.equal((await invoke("login", { identifier: "changed@example.com", password: newPassword })).statusCode, 200);

    console.log("Verified registration, recovery, and email-change integration checks passed.");
  } finally {
    globalThis.fetch = originalFetch;
    if (dbLib) await (await dbLib.getMongoClient()).close().catch(() => {});
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
