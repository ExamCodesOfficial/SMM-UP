import assert from "node:assert/strict";
import { probePersistentSession } from "../src/lib/sessionBootstrap.js";

function jsonResponse(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const noWait = async () => {};

{
  let attempts = 0;
  const result = await probePersistentSession({
    delaysMs: [0, 1, 1],
    wait: noWait,
    fetchImpl: (async () => {
      attempts += 1;
      if (attempts === 1) return jsonResponse(503, { code: "AUTH_SERVICE_UNAVAILABLE" });
      if (attempts === 2) throw new TypeError("deployment connection reset");
      return jsonResponse(200, { authenticated: true, user: { userId: "user-1", username: "member" } });
    }) as typeof fetch,
  });
  assert.equal(result.status, "authenticated");
  assert.equal(result.status === "authenticated" ? result.user.userId : "", "user-1");
  assert.equal(attempts, 3, "transient deployment failures must be retried");
}

{
  let attempts = 0;
  const result = await probePersistentSession({
    delaysMs: [0, 1, 1],
    wait: noWait,
    fetchImpl: (async () => {
      attempts += 1;
      return jsonResponse(401, { authenticated: false });
    }) as typeof fetch,
  });
  assert.equal(result.status, "anonymous");
  assert.equal(attempts, 1, "an authoritative unauthenticated response must not be retried");
}

{
  let attempts = 0;
  const result = await probePersistentSession({
    delaysMs: [0, 1, 1],
    wait: noWait,
    fetchImpl: (async () => {
      attempts += 1;
      return new Response("deployment transition", { status: 503, headers: { "Content-Type": "text/plain" } });
    }) as typeof fetch,
  });
  assert.equal(result.status, "unavailable");
  assert.equal(attempts, 3);
}

console.log("Deployment-resilient session bootstrap retry and authoritative-logout checks passed.");
