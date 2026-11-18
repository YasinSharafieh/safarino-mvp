import { chromium } from "playwright";
const B = "https://safarino-mvp.vercel.app";
function d(n: number) { const x = new Date(Date.now() + 3.5 * 3600e3 + n * 864e5); return x.toISOString().slice(0, 10); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  // Seed the trip the way the quiz would, so every phase has real inputs.
  await page.goto(B + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate((iso: string) => {
    localStorage.setItem("safarino-travel-data-v1", JSON.stringify({
      origin: "تهران", destination: "مشهد", budget: 20, days: 3,
      departureDate: iso, returnDate: "", travelers: 2, children: 0, infants: 0,
      tripStyle: "", quizResult: "", quizStep: 0, quizAnswers: {}, preferredMode: "train",
      tasteMoods: ["تاریخی"], transport: null, accommodation: null,
    }));
  }, d(2));

  const shots: string[] = [];
  // 1) header trip bar
  await page.goto(B + "/transport", { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);
  const headerText = (await page.locator("header").first().innerText()).replace(/\s+/g, " ");
  console.log("HEADER:", headerText.slice(0, 120));
  await page.screenshot({ path: "/tmp/v-header.png" });

  // 2) mode counts
  const counts = await page.locator("text=بلیت برای همین تاریخ").count();
  console.log("mode count chips:", counts);

  // 3) the calendar must be fully visible at 768px height
  const depBtn = page.locator('button:has-text("تاریخ رفت")').first();
  await depBtn.click();
  await page.waitForTimeout(700);
  const dlg = page.locator('[role="dialog"]');
  const box = await dlg.boundingBox();
  console.log("calendar box:", box);
  const dayButtons = dlg.locator("button[aria-label]");
  const lastDay = dlg.locator("button").nth(20);
  const lb = await lastDay.boundingBox();
  console.log("a late day fully visible:", lb ? lb.y + lb.height <= 768 : "n/a");
  await page.screenshot({ path: "/tmp/v-calendar.png" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  console.log("dialog closed by Escape:", (await page.locator('[role="dialog"]').count()) === 0);

  // 4) accommodation opens with prices on its own
  await page.goto(B + "/accommodation", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(22000);
  const cards = await page.locator('article').count();
  const emptyText = await page.locator("text=برای این تاریخ و مسافران گزینه‌ای با قیمت پیدا نشد").count();
  console.log("accommodation cards:", cards, "empty-state:", emptyText);
  await page.screenshot({ path: "/tmp/v-stay.png" });

  await browser.close();
})();
