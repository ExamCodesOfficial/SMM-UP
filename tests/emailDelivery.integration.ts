import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { issueEmailToken } from "../server/lib/email.js";

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  const client = new MongoClient(repl.getUri());
  const originalFetch = globalThis.fetch;
  try {
    await client.connect();
    process.env.RESEND_API_KEY = "re_test_only";
    process.env.EMAIL_FROM = "SMM UP <security@smmup.co.in>";
    process.env.PUBLIC_SITE_URL = "https://smmup.co.in";
    let requestBody: any = null;
    globalThis.fetch = (async (url: any, init: any) => {
      assert.equal(String(url), "https://api.resend.com/emails");
      assert.equal(init.headers.Authorization, "Bearer re_test_only");
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
    }) as typeof fetch;

    const db = client.db("email_delivery_integration");
    const userId = new ObjectId();
    await issueEmailToken(db, { userId, email: "member@example.com", purpose: "registration" });
    const token: any = await db.collection("email_verification_tokens").findOne({ user_id: userId });
    assert.ok(token?.token_hash?.length === 64);
    assert.equal(token.email, "member@example.com");
    assert.ok(token.sent_at instanceof Date);
    const deliveryText = JSON.stringify(requestBody);
    assert.match(deliveryText, /https:\/\/smmup\.co\.in\/auth\?verify_token=sme_/);
    assert.equal(deliveryText.includes(token.token_hash), false, "the hash must not be emailed");
    const deliveredRawToken = deliveryText.match(/verify_token=(sme_[A-Za-z0-9_-]+)/)?.[1];
    assert.ok(deliveredRawToken);
    assert.equal(JSON.stringify(token).includes(deliveredRawToken!), false, "raw verification tokens must never be stored");

    await issueEmailToken(db, { userId, email: "member@example.com", purpose: "registration" });
    const records: any[] = await db.collection("email_verification_tokens").find({ user_id: userId }).sort({ created_at: 1 }).toArray();
    assert.equal(records.length, 2);
    assert.equal(records[0].invalidation_reason, "superseded");
    assert.ok(records[0].invalidated_at instanceof Date);
    assert.equal(records[1].invalidated_at, null);
    console.log("Transactional email delivery integration checks passed.");
  } finally {
    globalThis.fetch = originalFetch;
    await client.close();
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
