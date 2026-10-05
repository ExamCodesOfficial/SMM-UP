const { chromium } = require("playwright-core");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto("http://localhost:5173/", { waitUntil: "networkidle", timeout: 30000 }).catch(()=>{});
  await p.waitForTimeout(1800);
  await p.screenshot({ path: "/home/user/qa-ec-style.png" });
  console.log("done");
  await b.close();
})();
