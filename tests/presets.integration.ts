import assert from "node:assert/strict";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";

function mockResponse(): any {
  const result: any = { statusCode: 200, body: undefined, headers: {} };
  return {
    result,
    status(code: number) { result.statusCode = code; return this; },
    json(body: any) { result.body = body; return this; },
    end(body?: any) { result.body = body; return this; },
    setHeader(name: string, value: any) { result.headers[name.toLowerCase()] = value; },
    getHeader(name: string) { return result.headers[name.toLowerCase()]; },
  };
}

async function run() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  let dbLib: any;
  try {
    process.env.MONGODB_URI = repl.getUri();
    process.env.DATABASE_NAME = "presets_integration";
    process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
    process.env.NODE_ENV = "test";
    const [{ default: handler }, auth, loadedDbLib] = await Promise.all([
      import("../api/presets/[action].js"),
      import("../server/lib/auth.js"),
      import("../server/lib/db.js"),
    ]);
    dbLib = loadedDbLib;
    const db = await dbLib.getDb();
    const user = { _id: new ObjectId(), email: "preset@example.com", username: "preset-user", role: "user", balance: 0 };
    await db.collection("users").insertOne(user);
    const token = auth.signUserToken(user);

    const invoke = async (action: string, method: string, body: any = {}) => {
      const req: any = {
        method,
        query: { action },
        body,
        headers: { authorization: `Bearer ${token}`, origin: "https://smmup.co.in", host: "smmup.co.in", "x-forwarded-for": "203.0.113.14" },
        socket: { remoteAddress: "203.0.113.14" },
      };
      const res = mockResponse();
      await handler(req, res);
      return res.result;
    };

    const firstFavorite = await invoke("toggle-favorite", "POST", { serviceId: "101" });
    assert.equal(firstFavorite.statusCode, 200);
    assert.equal(firstFavorite.body.favorite, true);
    assert.equal((await invoke("toggle-favorite", "POST", { serviceId: "101" })).body.favorite, false);
    await invoke("toggle-favorite", "POST", { serviceId: "101" });

    const saved = await invoke("save-template", "POST", {
      serviceId: "101",
      name: "Safe starter",
      quantity: 500,
      link: "https://example.com/must-not-save",
      comments: "must-not-save",
    });
    assert.equal(saved.statusCode, 201);
    const rawTemplate = await db.collection("order_templates").findOne({ _id: new ObjectId(saved.body.template.id) });
    assert.equal(rawTemplate?.quantity, 500);
    assert.equal(rawTemplate?.link, undefined);
    assert.equal(rawTemplate?.comments, undefined);

    const listed = await invoke("list", "GET");
    assert.deepEqual(listed.body.favorites, ["101"]);
    assert.equal(listed.body.templates[0].name, "Safe starter");
    assert.match(listed.body.privacy, /never store targets/i);

    const removed = await invoke("delete-template", "POST", { templateId: saved.body.template.id });
    assert.equal(removed.statusCode, 200);
    assert.equal(await db.collection("order_templates").countDocuments({ user_id: user._id }), 0);

    const crossOrigin = mockResponse();
    await handler({
      method: "POST",
      query: { action: "toggle-favorite" },
      body: { serviceId: "102" },
      headers: { authorization: `Bearer ${token}`, origin: "https://evil.example", host: "smmup.co.in" },
      socket: {},
    } as any, crossOrigin);
    assert.equal(crossOrigin.result.statusCode, 403);

    console.log("Favourite and privacy-safe order-template integration checks passed.");
  } finally {
    if (dbLib) await (await dbLib.getMongoClient()).close().catch(() => {});
    await repl.stop();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
