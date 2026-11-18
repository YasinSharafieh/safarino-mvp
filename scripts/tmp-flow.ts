import { chromium } from "playwright";
const B = "https://safarino-mvp.vercel.app";
function d(n: number) { const x = new Date(Date.now() + 3.5 * 3600e3 + n * 864e5); return x.toISOString().slice(0, 10); }
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(B + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate((iso: string) => {
    localStorage.setItem("safarino-travel-data-v1", JSON.stringify({
      origin: "تهران", destination: "مشهد", budget: 25, days: 3,
      departureDate: iso, returnDate: "", travelers: 2, children: 0, infants: 0,
      tripStyle: "", quizResult: "", quizStep: 0, quizAnswers: {}, preferredMode: "plane",
      tasteMoods: ["تاریخی"], transport: null, accommodation: null,
    }));
  }, d(2));
  await page.goto(B + "/transport", { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(9000);
  const body = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const idx = body.indexOf("چه وسیله‌ای");
  console.log("MODES:", body.slice(idx, idx + 420));
  await page.screenshot({ path: "/tmp/f-modes.png", fullPage: false });
  // open the trip editor and its calendar
  await page.locator('button:has-text("ویرایش سفر")').first().click();
  await page.waitForTimeout(1200);
  const handles = await page.locator('button[aria-haspopup="dialog"]').count();
  console.log("calendar handles:", handles);
  if (handles) {
    await page.locator('button[aria-haspopup="dialog"]').first().click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: "/tmp/f-cal.png" });
    const dlg = page.locator('[role="dialog"]');
    const all = dlg.locator("button");
    const n = await all.count();
    let picked = false;
    for (let i = 0; i < n; i += 1) {
      const b = all.nth(i);
      const label = await b.getAttribute("aria-label");
      if (!label || !/آبان|آذر/.test(label)) continue;
      if (await b.isEnabled()) { await b.click(); picked = true; break; }
    }
    console.log("picked day:", picked);
    await page.waitForTimeout(8000);
    const after = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    const i2 = after.indexOf("چه وسیله‌ای");
    console.log("AFTER-PICK MODES:", after.slice(i2, i2 + 260));
    console.log("errors:", errors.length ? errors : "none");
  }
  await browser.close();
})();
