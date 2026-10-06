import assert from "node:assert/strict";
import crypto from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { ObjectId } from "mongodb";

function mockResponse() {
  const headers = new Map<string, any>();
  let statusCode = 200;
  let body: any;
  const response: any = {
    headers,
    setHeader(name: string, value: any) { headers.set(name.toLowerCase(), value); return response; },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
    status(code: number) { statusCode = code; return response; },
    json(value: any) { body = value; return response; },
    end(value?: any) { if (value !== undefined) body = value; return response; },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
  return response;
}

function cookieValue(response: any, name: string): string {
  const value = response.getHeader("Set-Cookie");
  const cookies = value ? (Array.isArray(value) ? value : [String(value)]) : [];
  const match = cookies.find((cookie: string) => cookie.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1).split(";")[0] : "";
}

function request(cookie = "", method = "GET", url = "/api/auth/me") {
  return {
    method,
    url,
    headers: {
      cookie,
      "user-agent": "Support Access Integration Browser",
      "x-forwarded-for": "203.0.113.44",
    },
    socket: { remoteAddress: "203.0.113.44" },
  } as any;
}

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  let dbLib: any = null;
  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "support_access_integration_test";
    process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.SESSION_METADATA_HASH_SECRET = crypto.randomBytes(32).toString("hex");
    process.env.PANEL_URL = "https://panel.invalid/api/v2";
    process.env.PANEL_KEY = "integration-test-panel-key";
    process.env.TIER1_MARKUP = String(1 + Math.random());
    process.env.TIER2_MARKUP = String(2 + Math.random());

    dbLib = await import("../server/lib/db.js");
    const auth = await import("../server/lib/auth.js");
    await dbLib.ensureSessionIndexes();
    const db = await dbLib.getDb();
    const now = new Date();
    const owner = {
      _id: new ObjectId(),
      email: "owner@example.com",
      username: "owner",
      role: "admin",
      password_hash: await auth.hashPassword("Owner-Secure-Password-42!"),
      created_at: now,
    };
    const subject = {
      _id: new ObjectId(),
      email: "customer@example.com",
      username: "customer",
      role: "user",
      password_hash: await auth.hashPassword("Customer-Secure-Password-42!"),
      balance: 500,
      created_at: now,
    };
    await db.collection("users").insertMany([owner, subject]);

    const ownerResponse = mockResponse();
    await auth.createUserSession(db, request(), ownerResponse, owner);
    const ownerRaw = cookieValue(ownerResponse, "smm_up_session");
    assert.ok(ownerRaw.startsWith("sms_"));

    const rawCode = "SUP-ABCD-2345-EFGH-6789";
    const supportCodeId = new ObjectId();
    await db.collection("support_access_codes").insertOne({
      _id: supportCodeId,
      code_hash: auth.hashSessionToken(rawCode),
      subject_user_id: subject._id,
      subject_username: subject.username,
      subject_email: subject.email,
      reason: "Investigate customer order display",
      created_at: now,
      expires_at: new Date(now.getTime() + 5 * 60_000),
      consumed_at: null,
      invalidated_at: null,
    });
    await assert.rejects(() => db.collection("support_access_codes").insertOne({
      code_hash: auth.hashSessionToken("SUP-ZZZZ-9999-YYYY-8888"),
      subject_user_id: subject._id,
      reason: "Concurrent duplicate active code",
      created_at: now,
      expires_at: new Date(now.getTime() + 5 * 60_000),
      consumed_at: null,
      invalidated_at: null,
    }), "a subject may have only one active Support Access code");

    const exchangeResponses = [mockResponse(), mockResponse()];
    const exchangeResults = await Promise.allSettled(exchangeResponses.map((response) =>
      auth.exchangeSupportAccessCode(db, request(`smm_up_session=${ownerRaw}`, "POST", "/api/auth/exchange-support-access"), response, owner, rawCode),
    ));
    assert.equal(exchangeResults.filter((result) => result.status === "fulfilled").length, 1, "one concurrent exchange must succeed");
    assert.equal(exchangeResults.filter((result) => result.status === "rejected").length, 1, "one concurrent exchange must fail");
    const winningIndex = exchangeResults.findIndex((result) => result.status === "fulfilled");
    const supportRaw = cookieValue(exchangeResponses[winningIndex], "smm_up_support");
    assert.ok(supportRaw.startsWith("smi_"));

    const storedCode = await db.collection("support_access_codes").findOne({ _id: supportCodeId });
    const storedSession = await db.collection("sessions").findOne({ _id: storedCode?.support_session_id });
    assert.equal(storedCode?.consumed_at instanceof Date, true);
    assert.equal(storedSession?.purpose, "admin_impersonation");
    assert.equal(storedSession?.read_only, true);
    assert.equal(storedSession?.actor_admin_id.toString(), owner._id.toString());
    assert.equal(storedSession?.subject_user_id.toString(), subject._id.toString());
    assert.equal(JSON.stringify(storedCode).includes(rawCode), false, "raw exchange code must not be persisted");
    assert.equal(JSON.stringify(storedSession).includes(supportRaw), false, "raw support token must not be persisted");

    const combinedCookie = `smm_up_session=${ownerRaw}; smm_up_support=${supportRaw}`;
    const supportIdentity = await auth.getUserFromRequest(request(combinedCookie));
    assert.equal(supportIdentity?.purpose, "admin_impersonation");
    assert.equal(supportIdentity?.userId, subject._id.toString());
    assert.equal(supportIdentity?.actorAdminId, owner._id.toString());
    assert.ok(supportIdentity?.sessionExpiresAt);
    assert.equal(await db.collection("support_access_audit").countDocuments({ event: "request", session_id: storedSession?._id }), 1);

    const blockedResponse = mockResponse();
    assert.equal(auth.denySupportMutation(supportIdentity, blockedResponse, false), true);
    assert.equal(blockedResponse.statusCode, 403);
    assert.equal(blockedResponse.body.code, "SUPPORT_READ_ONLY");
    assert.equal(auth.denySupportMutation(supportIdentity, mockResponse(), true), false);

    // Every customer-facing mutation surface fails closed under the support cookie.
    const [authHandler, ordersHandler, paymentsHandler, razorpayHandler, reviewsHandler] = await Promise.all([
      import("../api/auth/[action].js").then((module) => module.default),
      import("../api/orders/[action].js").then((module) => module.default),
      import("../api/payments/[action].js").then((module) => module.default),
      import("../api/razorpay/[action].js").then((module) => module.default),
      import("../api/reviews/[action].js").then((module) => module.default),
    ]);
    const blockedRoutes: Array<[string, any, string, any]> = [
      ["auth key creation", authHandler, "create-api-key", { name: "blocked" }],
      ["password completion", authHandler, "complete-password-change", { password: "Blocked-Password-42!" }],
      ["registration", authHandler, "register", { email: "blocked@example.com", username: "blocked", password: "Blocked-Password-42!" }],
      ["login", authHandler, "login", { email: subject.email, password: "Customer-Secure-Password-42!" }],
      ["order creation", ordersHandler, "create", { serviceId: 1, quantity: 100, link: "https://example.com" }],
      ["deposit creation", paymentsHandler, "create-order", { amount: 100 }],
      ["Razorpay creation", razorpayHandler, "create-order", { amount: 100 }],
      ["review submission", reviewsHandler, "submit", { rating: 5, text: "Blocked support write" }],
    ];
    for (const [label, handler, action, body] of blockedRoutes) {
      const response = mockResponse();
      const blockedRequest: any = request(combinedCookie, "POST", `/api/test/${action}`);
      blockedRequest.query = { action };
      blockedRequest.body = body;
      await handler(blockedRequest, response);
      assert.equal(response.statusCode, 403, `${label} must be blocked`);
      assert.equal(response.body?.code, "SUPPORT_READ_ONLY", `${label} must use centralized read-only denial`);
    }

    // Cookie namespaces and token prefixes cannot be interchanged.
    assert.equal(await auth.getUserFromRequest(request(`smm_up_support=${ownerRaw}`)), null);
    assert.equal(await auth.getUserFromRequest(request(`smm_up_session=${supportRaw}`)), null);

    // Removing the support cookie reveals the preserved owner session again.
    const restoredOwner = await auth.getUserFromRequest(request(`smm_up_session=${ownerRaw}`));
    assert.equal(restoredOwner?.userId, owner._id.toString());
    assert.equal(restoredOwner?.purpose, "normal");

    // Explicit page-view auditing and early exit are durable and preserve the owner cookie.
    const pageViewResponse = mockResponse();
    const pageViewRequest: any = request(combinedCookie, "POST", "/api/auth/support-page-view");
    pageViewRequest.query = { action: "support-page-view" };
    pageViewRequest.body = { path: "/account" };
    await authHandler(pageViewRequest, pageViewResponse);
    assert.equal(pageViewResponse.statusCode, 204);
    assert.equal(await db.collection("support_access_audit").countDocuments({ event: "page_view", path: "/account" }), 1);

    const exitResponse = mockResponse();
    const exitRequest: any = request(combinedCookie, "POST", "/api/auth/exit-support-access");
    exitRequest.query = { action: "exit-support-access" };
    exitRequest.body = {};
    await authHandler(exitRequest, exitResponse);
    assert.equal(exitResponse.statusCode, 200);
    assert.equal((await db.collection("sessions").findOne({ _id: storedSession?._id }))?.revoked_reason, "support_exit");
    assert.equal((await db.collection("support_access_codes").findOne({ _id: supportCodeId }))?.support_session_status, "exited");
    assert.equal(cookieValue(exitResponse, "smm_up_session"), "", "exit must not overwrite the owner cookie");
    assert.equal(cookieValue(exitResponse, "smm_up_support"), "", "exit must clear the support cookie");
    assert.equal((await auth.getUserFromRequest(request(`smm_up_session=${ownerRaw}`)))?.userId, owner._id.toString());

    // Expired, consumed and non-admin exchanges all fail.
    await assert.rejects(() => auth.exchangeSupportAccessCode(db, request(), mockResponse(), owner, rawCode));
    const expiredRaw = "SUP-WXYZ-6789-JKLM-3456";
    const expiredCodeId = new ObjectId();
    await db.collection("support_access_codes").insertOne({
      _id: expiredCodeId,
      code_hash: auth.hashSessionToken(expiredRaw),
      subject_user_id: subject._id,
      reason: "Expired test code",
      created_at: new Date(now.getTime() - 10 * 60_000),
      expires_at: new Date(now.getTime() - 5 * 60_000),
      consumed_at: null,
      invalidated_at: null,
    });
    await assert.rejects(() => auth.exchangeSupportAccessCode(db, request(), mockResponse(), owner, expiredRaw));
    await db.collection("support_access_codes").updateOne(
      { _id: expiredCodeId },
      { $set: { invalidated_at: new Date(), invalidation_reason: "expired" } },
    );
    await assert.rejects(() => auth.exchangeSupportAccessCode(db, request(), mockResponse(), subject, "SUP-AAAA-2222-BBBB-3333"));

    // Locking or globally revoking the actor invalidates a fresh impersonation immediately.
    const secondRawCode = "SUP-CCCC-4444-DDDD-5555";
    await db.collection("support_access_codes").insertOne({
      code_hash: auth.hashSessionToken(secondRawCode),
      subject_user_id: subject._id,
      subject_username: subject.username,
      subject_email: subject.email,
      reason: "Actor revocation test",
      created_at: new Date(),
      expires_at: new Date(Date.now() + 5 * 60_000),
      consumed_at: null,
      invalidated_at: null,
    });
    const secondResponse = mockResponse();
    const secondExchange = await auth.exchangeSupportAccessCode(db, request(), secondResponse, owner, secondRawCode);
    const secondSupportRaw = cookieValue(secondResponse, "smm_up_support");
    const secondCombinedCookie = `smm_up_session=${ownerRaw}; smm_up_support=${secondSupportRaw}`;
    await db.collection("users").updateOne({ _id: owner._id }, { $set: { sessions_revoked_before: new Date() } });
    assert.equal(await auth.getUserFromRequest(request(secondCombinedCookie)), null);
    assert.equal((await db.collection("sessions").findOne({ _id: secondExchange.sessionId }))?.revoked_reason, "invalid_admin_actor");

    console.log("Support Access integration checks passed.");
  } finally {
    if (dbLib) await (await dbLib.getMongoClient()).close().catch(() => {});
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
