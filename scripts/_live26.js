const { chromium } = require("playwright");
const BASE = "https://safarino-mvp.vercel.app";
(async () => {
  const b = await chromium.launch();
  const r = {};
  const errors = [];
  const seed = async (p, date) => {
    await p.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await p.evaluate((d) => localStorage.setItem("safarino-travel-data-v1", JSON.stringify({
      origin: "تهران", destination: "یزد", budget: 15, days: 3, departureDate: d, returnDate: "",
      travelers: 2, children: 0, infants: 0, tripStyle: "", quizResult: "", quizStep: 0, quizAnswers: {}, transport: null, accommodation: null })), date);
  };
  // 1) a date WITH trains
  const p1 = await b.newPage({ viewport: { width: 1440, height: 950 } });
  p1.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  await seed(p1, "2026-11-18");
  await p1.goto(BASE + "/transport", { waitUntil: "domcontentloaded" });
  await p1.waitForTimeout(2000);
  await p1.getByRole("button", { name: /قطار/ }).first().click();
  await p1.waitForTimeout(22000);
  r.withTrains = {
    offers: await p1.locator("div.divide-y > div").count(),
    searchBox: await p1.locator('input[aria-label="جست‌وجو در بلیت‌های یافته‌شده"]').count(),
    firstRow: (await p1.locator("div.divide-y > div").first().innerText().catch(() => "")).slice(0, 80).replace(/\n/g, " | "),
    carPanel: await p1.getByText("هزینهٔ کامل ماشینت را ببین").count(),
  };
  await p1.screenshot({ path: "/home/user/live-transport-train.png" });

  // 2) a date WITHOUT trains → nearby dates
  const p2 = await b.newPage({ viewport: { width: 1440, height: 950 } });
  p2.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));
  await seed(p2, "2026-11-25");
  await p2.goto(BASE + "/transport", { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(2000);
  await p2.getByRole("button", { name: /قطار/ }).first().click();
  await p2.waitForTimeout(40000);
  const t2 = await p2.locator("main").innerText();
  r.withoutTrains = {
    emptyMessage: /بلیتی با صندلی و قیمت پیدا نشد/.test(t2),
    nearbySection: /این روزها بلیت دارند/.test(t2),
    nearbyChips: await p2.locator('div:has-text("این روزها بلیت دارند") button').count(),
  };
  await p2.screenshot({ path: "/home/user/live-transport-nearby.png" });
  r.errors = errors.slice(0, 5);
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
