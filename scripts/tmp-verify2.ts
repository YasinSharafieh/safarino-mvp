import { chromium } from "playwright";
const B = "https://safarino-mvp.vercel.app";
function d(n: number) { const x = new Date(Date.now() + 3.5 * 3600e3 + n * 864e5); return x.toISOString().slice(0, 10); }
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 700 } });
  const page = await ctx.newPage();
  await page.goto(B + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate((iso: string) => {
    localStorage.setItem("safarino-travel-data-v1", JSON.stringify({
      origin: "تهران", destination: "کاشان", budget: 20, days: 3,
      departureDate: iso, returnDate: "", travelers: 2, children: 0, infants: 0,
      tripStyle: "", quizResult: "", quizStep: 0, quizAnswers: {}, preferredMode: "train",
      tasteMoods: ["تاریخی"], transport: null, accommodation: null,
    }));
  }, d(2));
  await page.goto(B + "/accommodation", { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2000);
  const btn = page.locator('button:has-text("تاریخ ورود")').first();
  await btn.click();
  await page.waitForTimeout(800);
  const dlg = page.locator('[role="dialog"]');
  const box = await dlg.boundingBox();
  console.log("calendar box:", box, "viewport 1366x700");
  const dayButtons = await dlg.locator("button").all();
  let worstBottom = 0;
  for (const b of dayButtons) { const bb = await b.boundingBox(); if (bb) worstBottom = Math.max(worstBottom, bb.y + bb.height); }
  console.log("lowest element bottom:", Math.round(worstBottom), "| fully visible:", worstBottom <= 700);
  const scroll = await dlg.locator("div").first().evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  console.log("panel scroll:", scroll);
  await page.screenshot({ path: "/tmp/v-cal.png" });
  // pick a day in the next month to prove the grid is clickable at the bottom rows
  const day = dlg.locator("button").filter({ hasText: "۱۵" }).first();
  if (await day.count()) { await day.click(); await page.waitForTimeout(500); }
  console.log("dialog closed after pick:", (await page.locator('[role="dialog"]').count()) === 0);
  await page.screenshot({ path: "/tmp/v-after.png" });
  // past days must be disabled
  await page.locator('button:has-text("تاریخ ورود")').first().click();
  await page.waitForTimeout(600);
  const disabled = await page.locator('[role="dialog"] button[disabled]').count();
  console.log("disabled (past / invalid) day buttons:", disabled);
  const prevDisabled = await page.locator('[role="dialog"] button[aria-label="ماه قبل"]').isDisabled();
  console.log("previous-month button disabled on the current month:", prevDisabled);
  await browser.close();
})();
