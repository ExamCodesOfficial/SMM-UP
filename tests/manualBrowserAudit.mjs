import { chromium } from "playwright-core";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("favicon")) errors.push(`console: ${message.text()}`);
});
await page.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === "/api/auth/me") {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: false }) });
  }
  if (url.pathname === "/api/auth/verify-email") {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, message: "Email verified." }) });
  }
  if (url.pathname === "/api/services/list") {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ services: [] }) });
  }
  if (url.pathname === "/api/reviews/list") {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reviews: [] }) });
  }
  return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Mocked API route" }) });
});

await page.goto("http://127.0.0.1:3000/404.html", { waitUntil: "networkidle" });
if ((await page.title()) !== "Page Not Found | SMM UP") throw new Error("Static 404 title is incorrect");
if (!(await page.locator('meta[name="robots"][content="noindex,nofollow"]').count())) throw new Error("Static 404 must remain noindex,nofollow");
const boostButton = page.getByRole("button", { name: /Boost the rocket/i });
// The rocket continuously orbits, so dispatch the activation without waiting
// for Playwright's stationary-element check.
await boostButton.evaluate((element) => element.click());
if (Number(await page.locator("#count").innerText()) < 1) throw new Error("Static 404 boost interaction did not respond");

const publicRoutes = ["/", "/catalog", "/faq", "/support", "/status", "/review", "/telegram-smm-panel", "/instagram-smm-panel", "/youtube-smm-panel", "/twitter-smm-panel", "/tiktok-smm-panel", "/spotify-smm-panel"];
for (const route of publicRoutes) {
  await page.goto(`http://127.0.0.1:3000${route}`, { waitUntil: "networkidle" });
  const main = await page.locator("main").count();
  if (!main) throw new Error(`No main landmark on ${route}`);
  if ((await page.title()).trim() === "") throw new Error(`No title on ${route}`);
}

await page.goto("http://127.0.0.1:3000/account", { waitUntil: "networkidle" });
await page.waitForURL(/\/auth\?next=%2Faccount/);
if ((await page.title()) !== "Sign In or Create Free Account | SMM UP") throw new Error("Guarded account route did not settle on auth metadata");

await page.goto("http://127.0.0.1:3000/auth?verify_token=super-secret&next=%2Faccount", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !window.location.search.includes("verify_token"));
if ((await page.url()).includes("super-secret")) throw new Error("Verification token remained in URL");

await page.setViewportSize({ width: 375, height: 760 });
await page.goto("http://127.0.0.1:3000/faq", { waitUntil: "networkidle" });
const opener = page.getByRole("button", { name: "Open navigation menu" });
await opener.click();
const dialog = page.getByRole("dialog", { name: "Site navigation" });
if (!(await dialog.isVisible())) throw new Error("Mobile navigation dialog did not open");
const activeLabel = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
if (activeLabel !== "Close menu") throw new Error(`Initial mobile-dialog focus was ${activeLabel || "missing"}`);
await page.keyboard.press("Escape");
if (await dialog.isVisible()) throw new Error("Escape did not close mobile navigation");
const restoredLabel = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
if (restoredLabel !== "Open navigation menu") throw new Error("Mobile navigation focus was not restored");

await page.close();

const authenticatedPage = await context.newPage();
authenticatedPage.on("pageerror", (error) => errors.push(`authenticated pageerror: ${error.message}`));
authenticatedPage.on("console", (message) => {
  if (message.type() === "error") errors.push(`authenticated console: ${message.text()}`);
});
await authenticatedPage.route("**/api/**", async (route) => {
  const url = new URL(route.request().url());
  const user = { userId: "507f1f77bcf86cd799439011", username: "audituser", displayName: "Audit User", avatarColor: "blue", email: "audit@example.com", balance: 0, total_spent: 25, total_orders: 1, role: "user", supportSession: null };
  const service = { service: 101, name: "Telegram Post Views", type: "Default", category: "Telegram Views", platform: "Telegram", rate: 10, min: 100, max: 10000, dripfeed: false, refill: true, refill_days: 30, cancel: true, average_time: "1 hour", description: "Public post views" };
  const bodies = {
    "/api/auth/me": { authenticated: true, user },
    "/api/services/list": { services: [service] },
    "/api/orders/list": { orders: [{ id: "o1", provider_order_id: "12345", service_id: 101, service_name: service.name, quantity: 500, charge: 5, status: "Pending", created_at: new Date().toISOString(), refill: true, cancel: true }] },
    "/api/auth/list-api-keys": { keys: [], scopes: ["services:read", "orders:write"], creationFeeInr: 29, maxKeys: 10, balance: 0 },
    "/api/auth/api-key-report": { summaries: [] },
    "/api/auth/list-sessions": { sessions: [], legacyCurrentSession: false },
    "/api/payments/config": { minAmount: 10, maxAmount: 50000 },
    "/api/razorpay/config": { enabled: true, mode: "test", minAmount: 10, maxAmount: 100000, testWalletCreditEnabled: false },
    "/api/payments/history": { transactions: [] },
    "/api/presets/list": { favorites: ["101"], templates: [{ id: "507f1f77bcf86cd799439012", name: "Views", serviceId: "101", quantity: 500 }] },
  };
  const body = bodies[url.pathname] || { error: "Mocked API route" };
  return route.fulfill({ status: bodies[url.pathname] ? 200 : 404, contentType: "application/json", body: JSON.stringify(body) });
});
for (const route of ["/account", "/logs", "/order", "/add-funds"]) {
  await authenticatedPage.goto(`http://127.0.0.1:3000${route}`, { waitUntil: "networkidle" });
  if (!(await authenticatedPage.locator("main").count())) throw new Error(`No authenticated main landmark on ${route}`);
  if (new URL(authenticatedPage.url()).pathname !== route) throw new Error(`Authenticated route ${route} redirected unexpectedly`);
}

if (errors.length) throw new Error(`Browser runtime errors:\n${errors.join("\n")}`);
console.log("Manual browser route, auth-scrubbing, authenticated-page, metadata, and mobile-dialog checks passed.");
await browser.close();
