/**
 * Round 45 — the options inside the trip page, checked on their own numbers.
 *
 * Every one of these is a control a traveller can press: split the money with the
 * group, add an expense, watch a price, read the packing list, compare two cities,
 * keep the offline copy. The page's buttons are ours to trust only if the engines
 * under them add up, so this suite does the arithmetic the way the screen does it.
 */

import { splitAmount, defaultMembers, normalizeMembers, groupSummary, MAX_MEMBERS } from "../lib/group-trip";
import { robinPlan } from "../lib/budget-robin";
import { trendFrom, isNoteworthy, priceWatchKey } from "../lib/price-watch";
import { smartPacking, packingToChecklist } from "../lib/packing";
import { cityFacts, compareLocally } from "../lib/city-compare";
import { sanitizeState, allItems, checklistProgress } from "../lib/checklist";

let failures = 0;
function check(label: string, value: boolean, detail?: string) {
  if (value) console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures += 1;
    console.log(`  fail ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("۴۵ — آپشن‌های داخل سفر، روی حساب‌های خودشان");

// ── چند نفر، یک پول ─────────────────────────────────────────────────────────
const family = defaultMembers(3, 1);
check("گروه پیش‌فرض به تعداد مسافران ساخته می‌شود", family.length === 4, `${family.length} نفر`);
const split = splitAmount(10_000_000, family);
const rowsTotal = split.rows.reduce((sum, row) => sum + row.amount, 0);
check("جمع سهم‌ها دقیقاً برابر کل پول است", rowsTotal + split.remainder === 10_000_000, `${rowsTotal} + باقی ${split.remainder}`);
const adultShares = split.rows.slice(0, 3).map((row) => row.amount);
check("بزرگسال‌ها سهم برابر می‌گیرند", new Set(adultShares).size === 1, adultShares.join(" / "));
const childRow = split.rows[3];
check("کودک نیم‌سهم می‌پردازد", Math.abs(childRow.amount * 2 - adultShares[0]) <= 1, `${childRow.amount} در برابر ${adultShares[0]}`);
check("درصد سهم‌ها به صد می‌رسد", Math.abs(split.rows.reduce((sum, row) => sum + row.sharePct, 0) - 100) <= 1,
  split.rows.map((row) => row.sharePct).join("+"));
const heavy = normalizeMembers([
  { id: "1", name: "علی", weight: 1 },
  { id: "2", name: "سارا", weight: 2 },
]);
const weighted = splitAmount(9_000_000, heavy);
check("سهم سنگین‌تر بیشتر می‌پردازد", weighted.rows[1].amount > weighted.rows[0].amount,
  weighted.rows.map((row) => `${row.name}:${row.amount}`).join(" · "));
check("وزن‌های نامعتبر پاک می‌شوند", normalizeMembers([{ name: "x", weight: 99 }, { name: "" }]).every((member) => member.weight >= 1 && member.weight <= 3));
check("هیچ گروهی از سقف اعضا بیشتر نمی‌شود", defaultMembers(30).length <= MAX_MEMBERS, `${defaultMembers(30).length}`);
check("گروه خالی تقسیم را نمی‌شکند", splitAmount(5_000_000, []).rows.length === 0);

const summary = groupSummary({ budget: 20_000_000, planned: 14_000_000, spent: 3_000_000 }, family);
check("خلاصهٔ گروه باقی پول را از خرج‌شده حساب می‌کند", summary.totals.remaining === 17_000_000, `باقی ${summary.totals.remaining}`);
check("خلاصه عدد پول را همان‌طور که هست نگه می‌دارد", summary.totals.budget === 20_000_000 && summary.totals.planned === 14_000_000);
check("خلاصه برای هر نفر یک ردیف دارد", summary.rows.length === family.length);

// ── پول، درست همان‌جا که هست ────────────────────────────────────────────────
const robinInput = {
  budgetToman: 20_000_000,
  transportToman: 4_000_000,
  foodToman: 3_000_000,
  currentStayToman: 6_000_000,
  offers: [
    { id: "a", name: "اتاق رو به حیاط", typeLabel: "هتل", priceToman: 6_500_000, rating: 3.9 },
    { id: "b", name: "سوئیت شاهانه", typeLabel: "هتل", priceToman: 40_000_000, rating: 4.9 },
  ],
};
const robin = robinPlan(robinInput);
check("پیشنهاد بودجه از میان گزینه‌های واقعی است", Boolean(robin) && robin!.offerId === "a", robin?.name);
check("پیشنهاد هرگز از باقی پول بیشتر نیست", Boolean(robin) && robin!.priceToman <= 20_000_000 - 4_000_000 - 3_000_000, `${robin?.priceToman}`);
check("گزینهٔ گران‌تر از بودجه پیشنهاد نمی‌شود", robin?.offerId !== "b");
check("با پولی که به اقامت نمی‌رسد، پیشنهادی هم نیست",
  robinPlan({ ...robinInput, transportToman: 18_000_000, currentStayToman: 0 }) === null);
check("گران‌تر از انتخاب فعلی، ارتقا حساب می‌شود", robin?.tone === "upgrade" && Boolean(robin?.extraToman));

const history = [
  { at: "2026-11-16T09:00:00Z", priceToman: 5_000_000, offers: 12 },
  { at: "2026-11-17T09:00:00Z", priceToman: 4_600_000, offers: 9 },
];
const trend = trendFrom(history);
check("روند قیمت پایین‌آمدن را می‌فهمد", Boolean(trend) && trend!.direction === "down", `${trend?.deltaPct}٪`);
check("بدون هیچ خواندنی روندی ساخته نمی‌شود", trendFrom([]) === null);
check("یک خواندن تنها، ادعای روند نمی‌کند", trendFrom([{ at: "2026-11-17T09:00:00Z", priceToman: 5, offers: 1 }])!.readings === 1
  && trendFrom([{ at: "2026-11-17T09:00:00Z", priceToman: 5, offers: 1 }])!.direction === "flat");
check("افت کوچک اعلان نمی‌شود", isNoteworthy(trendFrom([{ at: "2026-11-16T09:00:00Z", priceToman: 5_000_000, offers: 4 }, { at: "2026-11-17T09:00:00Z", priceToman: 4_950_000, offers: 4 }])) === false);
check("افت واقعی اعلان می‌شود", isNoteworthy(trend) === true);
check("پیام روند عدد واقعی دارد", String(trend?.message).includes(new Intl.NumberFormat("fa-IR").format(4_600_000)), trend?.message);
check("کلید روند بدون تاریخ هم یکتا است", priceWatchKey("transport", { from: "تهران", to: "شیراز" }).length > 20);

// ── فهرست وسایل ─────────────────────────────────────────────────────────────
const cold = smartPacking({
  destination: "مشهد", days: 3, weatherMode: "forecast", children: 0, mode: "train",
  weather: [
    { date: "2026-12-01", code: 71, label: "برف", icon: "❄️", maxC: 2, minC: -5, rainProbability: 70, rainMm: 4, windKmh: 12, score: 40, advice: "", tone: "bad" },
    { date: "2026-12-02", code: 3, label: "ابری", icon: "☁️", maxC: 4, minC: -3, rainProbability: 30, rainMm: 0, windKmh: 9, score: 60, advice: "", tone: "ok" },
  ] as any,
});
const warm = smartPacking({
  destination: "کیش", days: 3, weatherMode: "forecast", children: 0, mode: "plane",
  weather: [
    { date: "2026-07-10", code: 0, label: "آفتابی", icon: "☀️", maxC: 39, minC: 29, rainProbability: 0, rainMm: 0, windKmh: 8, score: 70, advice: "", tone: "ok" },
  ] as any,
});
const titles = (plan: typeof cold) => plan.items.map((item) => item.title);
check("فهرست وسایل خالی نیست", cold.items.length > 5, `${cold.items.length} قلم`);
check("سرمای برفی لباس گرم می‌خواهد", titles(cold).some((item) => /گرم|پالتو|کلاه|دستکش/.test(item)), titles(cold).slice(0, 3).join("، "));
check("سفر گرم لباس زمستانی نمی‌خواهد", !titles(warm).some((item) => /پالتو|دستکش/.test(item)));
check("هر قلم دلیل خودش را می‌گوید", cold.items.every((item) => typeof item.reason === "string" && item.reason.length > 3));
const withKids = smartPacking({
  destination: "شیراز", days: 2, weatherMode: "none", children: 1, mode: "train", month: 4, weather: [],
});
check("سفر با کودک وسایل کودک را اضافه می‌کند", titles(withKids).some((item) => /کودک/.test(item)));
check("مبنای فهرست گفته می‌شود", cold.basis.length > 10 && warm.basis.length > 10, cold.basis.slice(0, 40));
const fromPacking = packingToChecklist(cold, 5);
check("چک‌لیست از فهرست وسایل ساخته می‌شود", fromPacking.length === 5 && fromPacking.every((item) => item.group === "packing"));

// ── چک‌لیست سفر ─────────────────────────────────────────────────────────────
const state = sanitizeState({
  done: ["id-card"],
  custom: [{ id: "custom:pills", title: "قرص سفر", group: "packing", daysBefore: 2 }],
});
const items = allItems(state);
check("چک‌لیست ردیف تکراری ندارد", new Set(items.map((item) => item.id)).size === items.length, `${items.length} مورد`);
check("همهٔ ردیف‌ها گروه و روز مشخص دارند", items.every((item) => item.group && item.daysBefore >= 0 && item.daysBefore <= 30));
check("سند و رزرو در فهرست هست", items.some((item) => item.group === "documents") && items.some((item) => item.group === "bookings"));
check("مورد دلخواه خود مسافر هم در فهرست است", items.some((item) => item.title.includes("قرص سفر")));
const progress = checklistProgress(state, 2);
check("پیشرفت با کاری که مانده حساب می‌شود", progress.done === 1 && progress.total >= items.length, `${progress.done}/${progress.total}`);
const broken = sanitizeState({ done: ["a b"], custom: [{ title: "" }] });
check("ذخیرهٔ خراب، فهرست را نمی‌شکند", broken.done.length === 0 && broken.custom.length === 0);

// ── کدام شهر؟ ───────────────────────────────────────────────────────────────
const shiraz = cityFacts("شیراز", 2, 3);
const dubai = cityFacts("دبی", 2, 3);
check("شهر واقعی اطلاعات دارد", Boolean(shiraz) && Number(shiraz!.dailyTotal) > 0, `${shiraz?.dailyTotal}`);
check("شهر بیرون از ایران پذیرفته نمی‌شود", dubai === null);
const verdict = compareLocally(shiraz!, cityFacts("یزد", 2, 3)!, { moods: ["تاریخی"], budgetToman: 30_000_000, travellers: 2, days: 3 });
check("مقایسه برنده یا تساوی اعلام می‌کند", ["a", "b", "tie"].includes(verdict.winner), verdict.winner);
check("دلیل مقایسه نوشته شده است", verdict.reason.length > 30, verdict.reason.slice(0, 40));

console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ round 45: تقسیم پول، چک‌لیست، وسایل، روند قیمت و مقایسهٔ شهر با عدد خودشان جواب می‌دهند");
process.exit(failures ? 1 : 0);
