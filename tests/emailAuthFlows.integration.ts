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
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
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
      username: "instant-member",
      email: "member@example.com",
      password: originalPassword,
    });
    assert.equal(registration.statusCode, 201);
    assert.equal("verificationRequired" in registration.body, false, "signup must not expose verification state");
    assert.ok(cookieFrom(registration), "registration must create an authenticated session immediately");
    assert.equal(deliveries.length, 0, "registration must not call the email provider");

    const db = await dbLib.getDb();
    const createdUser: any = await db.collection("users").findOne({ email: "member@example.com" });
    assert.equal(createdUser.email_verification_required, false);
    assert.equal(createdUser.email_verified_at, null, "immediate signup must not falsely mark the mailbox as verified");
    assert.equal(
      await db.collection("sessions").countDocuments({ user_id: createdUser._id, purpose: "normal", revoked_at: null }),
      1,
      "registration must persist one revocable normal session",
    );
    assert.equal(
      await db.collection("email_verification_tokens").countDocuments({ user_id: createdUser._id, purpose: "registration" }),
      0,
      "registration must not create a verification token",
    );

    const directLogin = await invoke("login", { identifier: "member@example.com", password: originalPassword });
    assert.equal(directLogin.statusCode, 200);
    assert.ok(cookieFrom(directLogin));

    // Accounts left behind by the retired verification gate must recover through
    // ordinary correct-password login, without sending or requiring email.
    await db.collection("users").updateOne(
      { _id: createdUser._id },
      { $set: { email_verification_required: true, email_verified_at: null } },
    );
    await db.collection("email_verification_tokens").insertOne({
      user_id: createdUser._id,
      email: createdUser.email,
      purpose: "registration",
      token_hash: "legacy-registration-token",
      used_at: null,
      invalidated_at: null,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 3_600_000),
    });
    const legacyLogin = await invoke("login", { identifier: "member@example.com", password: originalPassword });
    assert.equal(legacyLogin.statusCode, 200);
    assert.equal(deliveries.length, 0, "legacy pending-account login must not call the email provider");
    const repaired: any = await db.collection("users").findOne({ _id: createdUser._id });
    assert.equal(repaired.email_verification_required, false);
    assert.ok(repaired.signup_verification_bypassed_at instanceof Date);
    assert.equal(
      await db.collection("email_verification_tokens").countDocuments({
        user_id: createdUser._id,
        purpose: "registration",
        invalidation_reason: "signup_verification_retired",
      }),
      1,
      "obsolete registration tokens must be invalidated after authenticated access",
    );

    const retiredResend = await invoke("resend-verification", { email: "member@example.com" });
    assert.equal(retiredResend.statusCode, 404, "resend-verification must not remain an exposed auth action");
    assert.equal(deliveries.length, 0, "retired resend action must not send email");

    // Only the separate, user-requested email workflows need provider config.
    process.env.RESEND_API_KEY = "re_test_only";
    process.env.EMAIL_FROM = "SMM UP <security@smmup.co.in>";
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
    assert.equal((await db.collection("users").findOne({ _id: createdUser._id }))?.email, "member@example.com", "email must not change before confirmation");
    const emailChangeToken = tokenFromEmail(deliveries, "verify_token");
    const emailConfirmation = await invoke("verify-email", { token: emailChangeToken }, authenticatedCookie);
    assert.equal(emailConfirmation.statusCode, 200);
    assert.equal(emailConfirmation.body.signedIn, false);
    assert.equal((await db.collection("users").findOne({ _id: createdUser._id }))?.email, "changed@example.com");
    assert.equal((await invoke("verify-email", { token: emailChangeToken })).statusCode, 400);
    const finalLogin = await invoke("login", { identifier: "changed@example.com", password: newPassword });
    assert.equal(finalLogin.statusCode, 200);
    const finalCookie = cookieFrom(finalLogin);

    const profileUpdate = await invoke("update-profile", {
      username: "updated-member",
      displayName: "Updated Member",
      avatarColor: "blue",
      password: newPassword,
    }, finalCookie);
    assert.equal(profileUpdate.statusCode, 200);
    assert.equal(profileUpdate.body.profile.username, "updated-member");
    const updatedUser: any = await db.collection("users").findOne({ _id: createdUser._id });
    assert.equal(updatedUser.display_name, "Updated Member");
    assert.equal(updatedUser.avatar_color, "blue");

    await Promise.all([
      db.collection("orders").insertOne({ user_id: createdUser._id, user_email: "changed@example.com", status: "Completed", link: "https://example.com/private-target", comments: "private", created_at: new Date() }),
      db.collection("service_favorites").insertOne({ user_id: createdUser._id, service_id: "101", created_at: new Date() }),
      db.collection("order_templates").insertOne({ user_id: createdUser._id, service_id: "101", name: "Template", created_at: new Date() }),
    ]);
    const deletion = await invoke("delete-account", {
      password: newPassword,
      confirmation: "DELETE updated-member",
    }, finalCookie);
    assert.equal(deletion.statusCode, 200);
    const deletedUser: any = await db.collection("users").findOne({ _id: createdUser._id });
    assert.ok(deletedUser.account_deleted_at instanceof Date);
    assert.equal(deletedUser.account_locked, true);
    assert.match(deletedUser.email, /^deleted\+.+@deleted\.invalid$/);
    const retainedOrder: any = await db.collection("orders").findOne({ user_id: createdUser._id });
    assert.equal(retainedOrder.link, undefined, "account deletion must erase sensitive order targets");
    assert.equal(retainedOrder.comments, undefined, "account deletion must erase private comments");
    assert.equal(await db.collection("service_favorites").countDocuments({ user_id: createdUser._id }), 0);
    assert.equal(await db.collection("order_templates").countDocuments({ user_id: createdUser._id }), 0);
    assert.equal(await db.collection("sessions").countDocuments({ user_id: createdUser._id, revoked_at: null }), 0, "deleted account sessions must be revoked");

    console.log("Immediate registration, legacy-account recovery, email-change, password-reset, profile-update, and account-erasure integration checks passed.");
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
