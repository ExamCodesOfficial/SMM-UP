const { chromium } = require("playwright-core");
const routes = ["/","/order","/catalog","/mass","/logs","/auth","/api","/playground","/account","/transactions","/faq","/support","/about","/terms","/privacy","/refunds","/acceptable-use","/cookie-policy","/security","/abuse","/press","/status","/changelog","/sitemap","/telegram-smm-panel","/instagram-smm-panel","/youtube-smm-panel","/twitter-smm-panel","/tiktok-smm-panel","/spotify-smm-panel","/definitely-not-a-page"];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const titles = {};
  const seen = {};
  console.log("ROUTE | TITLE | DESC_LEN | H1 | CONSOLE_ERRS | NOTFOUND");
  for (const r of routes) {
    const errs = [];
    const handler = (m) => { if (m.type() === "error" && !m.text().includes("not valid JSON")) errs.push(m.text().slice(0,90)); };
    p.on("console", handler);
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.goto("http://localhost:5173" + r, { waitUntil: "networkidle", timeout: 30000 }).catch(()=>{});
    await p.waitForTimeout(900);
    const t = await p.title();
    const desc = await p.evaluate(() => document.querySelector('meta[name="description"]')?.content || "");
    const h1 = await p.evaluate(() => (document.querySelector("h1")?.innerText || "").replace(/\s+/g," ").slice(0,50));
    const body = await p.evaluate(() => document.body.innerText.slice(0, 3000));
    const nf = /not found|404/i.test(body) && !/order|service|category|search/i.test(body.replace(/no (orders|services|categories|results).{0,40}/gi,""));
    titles[r] = t;
    seen[t] = (seen[t]||[]); seen[t].push(r);
    console.log(`${r} | ${t.slice(0,55)} | ${desc.length} | ${h1.slice(0,38)} | ${errs.length}${errs.length?":"+errs[0]:""} | ${nf?"NOTFOUND":""}`);
    p.off("console", handler);
  }
  console.log("\nDUPLICATE TITLES:");
  Object.entries(seen).forEach(([t, rs]) => { if (rs.length > 1) console.log(" DUP:", t, "->", rs.join(", ")); });
  await b.close();
})();
