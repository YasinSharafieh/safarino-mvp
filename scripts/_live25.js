const { chromium } = require("playwright");
const BASE = "https://safarino-mvp.vercel.app";
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message.slice(0, 150)));
  p.on("console", (m) => { if (m.type() === "error") errors.push("c:" + m.text().slice(0, 100)); });
  const r = {};
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await p.evaluate(() => localStorage.setItem("safarino-travel-data-v1", JSON.stringify({
    origin: "تهران", destination: "یزد", budget: 15, days: 3, departureDate: "2026-11-20", returnDate: "2026-11-23",
    travelers: 2, children: 0, infants: 0, tripStyle: "", quizResult: "", quizStep: 0, quizAnswers: {}, transport: null, accommodation: null })));
  await p.goto(BASE + "/transport", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  r.chooser = await p.getByText("با چه وسیله‌ای می‌روی؟").isVisible();
  r.distance = (await p.locator("main").innerText()).match(/([\d۰-۹٫.]+) کیلومتر/)?.[0] || "";
  r.carPanelBefore = await p.getByText("هزینهٔ کامل ماشینت را ببین").count();
  // car
  await p.getByRole("button", { name: /ماشین شخصی/ }).first().click();
  await p.waitForTimeout(1200);
  await p.locator('input[aria-label="جست‌وجوی مدل خودرو"]').click();
  await p.locator('input[aria-label="جست‌وجوی مدل خودرو"]').fill("سمند");
  await p.waitForTimeout(500);
  r.carResults = await p.locator('[role="option"]').count();
  await p.locator('[role="option"]').first().click();
  await p.waitForTimeout(800);
  r.carTotal = (await p.locator("main").innerText()).match(/سهم هر سرنشین/)?.[0] || "";
  r.lines = (await p.locator("main").innerText()).match(/بنزین|استهلاک خودرو|سرویس و نگهداری|عوارض آزادراهی|پارکینگ/g)?.length || 0;
  await p.screenshot({ path: "/home/user/live-transport-car.png" });
  // train
  await p.getByRole("button", { name: /قطار/ }).first().click();
  await p.waitForTimeout(9000);
  r.train = {
    carPanel: await p.getByText("هزینهٔ کامل ماشینت را ببین").count(),
    searchBox: await p.locator('input[aria-label="جست‌وجو در بلیت‌های یافته‌شده"]').count(),
    offers: await p.locator("div.divide-y > div").count(),
    text: (await p.locator("main").innerText()).match(/بلیت قطار[\s\S]{0,80}/)?.[0].replace(/\n/g, " | ") || "",
  };
  await p.screenshot({ path: "/home/user/live-transport-train.png" });
  // quiz path → transport
  const q = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await q.goto(BASE + "/quiz", { waitUntil: "domcontentloaded" });
  await q.waitForTimeout(2200);
  for (let i = 0; i < 4; i += 1) {
    const n = await q.locator('[role="radio"]').count();
    if (!n) break;
    await q.locator('[role="radio"]').nth(0).click();
    await q.waitForTimeout(200);
    await q.getByRole("button", { name: /سؤال بعدی|دیدن پیشنهادها/ }).click();
    await q.waitForTimeout(600);
  }
  await q.waitForTimeout(900);
  const pick = q.locator("main button").filter({ hasText: /روز/ }).first();
  if (await pick.count()) {
    await pick.click();
    await q.waitForTimeout(300);
    await q.locator("main button").filter({ hasText: /برنامه‌ریزی سفر به/ }).click();
    await q.waitForTimeout(3000);
    r.quizPath = { url: q.url(), chooser: await q.getByText("با چه وسیله‌ای می‌روی؟").isVisible().catch(() => false), summary: (await q.locator("main").innerText()).match(/مبدأ|مقصد/)?.[0] || "" };
  }
  const m = await b.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto(BASE + "/transport", { waitUntil: "domcontentloaded" });
  await m.waitForTimeout(2500);
  await m.getByRole("button", { name: /ماشین شخصی/ }).first().click();
  await m.waitForTimeout(1200);
  r.mobileOverflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await m.screenshot({ path: "/home/user/live-transport-mobile.png" });
  r.errors = errors.slice(0, 8);
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
