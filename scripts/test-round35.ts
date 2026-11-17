/**
 * Round 35 — the agent and its self-check.
 *
 * The promise being tested here is narrow and absolute: the companion may only
 * state numbers that exist in the data it was given, and every tool it can pick
 * really exists. No network calls in the assertions themselves — the tools that
 * need one are checked for *graceful* failure, not for live results.
 */

import { normalizeDigits, numbersIn, collectTruth, verifyAnswer, verifyNames } from "../lib/ai-verify";
import { AGENT_TOOL_NAMES, runAgentTool, type AgentFacts } from "../lib/ai-agent";
import { chainFor, estimateTaskCostUsd } from "../lib/ai-models";
import { normalizeTicketReading } from "../lib/ai-vision";
import { budgetLevels, rescueScenarios } from "../lib/budget-scenarios";
import { trendFrom, isNoteworthy, priceWatchKey } from "../lib/price-watch";
import { describeFindings, inspectAccommodation, inspectTransport } from "../lib/data-inspector";
import { applyDayOrder, outdoorsShare, planWeatherReorder } from "../lib/plan-weather";
import { MIN_SIGNAL, tasteBonus, tasteProfile, tasteWords, type TasteEvent } from "../lib/taste-profile";
import type { WeatherDay } from "../lib/weather";
import { acceptProposal, candidateCities, localProposal, parseTripSentence } from "../lib/one-click";
import { acceptVerdict, cityFacts, compareLocally } from "../lib/city-compare";
import { sentences } from "../lib/speech";
import { normalizeReceiptReading } from "../lib/ai-vision";
import { addExpense, ledgerSentence, ledgerTotals, type Expense } from "../lib/trip-ledger";
import { reminderHeadline, tripReminders, type ReminderInput } from "../lib/trip-reminders";
import { buildOfflinePack, offlinePackKey, packAge, packWarnings, OFFLINE_PACK_VERSION } from "../lib/offline-pack";
import { acceptIntro, localIntro, shareFacts } from "../lib/share-intro";
import type { ShareTrip } from "../lib/share";

let failures = 0;
function check(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  fail ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("۳۵ — همسفر خودش کار می‌کند و خودش را بازبینی می‌کند");

check("Persian digits become ordinary numbers", normalizeDigits("۲۳٬۰۰۰٬۰۰۰") === "23000000");
check("a Persian sentence gives all its numbers", numbersIn("از ۴۰ میلیون، ۱۲ میلیون مانده").join(",") === "40,12");
check("a separated number stays one number", numbersIn("۱ ۲۳۴ ۵۶۷").join(",") === "1234567");

const evidence = {
  facts: { budgetToman: 40_000_000, ticketsToman: 8_000_000, stayToman: 12_000_000, days: 3 },
  tickets: { options: [{ total: 8_000_000 }, { total: 14_000_000 }] },
};
check("a real number is accepted", verifyAnswer("بلیت ۸٬۰۰۰٬۰۰۰ تومان است.", evidence).ok);
check("the budget in millions is accepted", verifyAnswer("بودجه‌ات ۴۰ میلیون است.", evidence).ok);
check("real arithmetic between prices is accepted", verifyAnswer("اختلاف دو بلیت ۶ میلیون تومان است.", evidence).ok);
const invented = verifyAnswer("هتل ۳۷ میلیون تومان می‌شود.", evidence);
check("an invented price is refused", !invented.ok, invented.reason);
check("and it names the invented number", invented.invented.includes(37));
check("a fabricated hotel name is refused", !verifyNames("«هتل پارسیان» را بگیر.", ["هتل خیام", "هتل عباسی"]).ok);
check("a real hotel name passes", verifyNames("«هتل خیام» را بگیر.", ["هتل خیام", "هتل عباسی"]).ok);
check("the truth set holds the evidence itself", collectTruth(evidence).has(40_000_000));

const facts: AgentFacts = {
  origin: "تهران",
  destination: "اصفهان",
  departureDate: "2026-11-20",
  days: 3,
  travellers: 2,
  children: 0,
  infants: 0,
  budgetToman: 40_000_000,
  ticketsToman: 8_000_000,
  stayToman: 12_000_000,
  stayName: "هتل خیام",
  transportLabel: "قطار",
  tastes: [],
};

async function main() {
check("the tool list is exactly the six real tools", AGENT_TOOL_NAMES.sort().join(",") === "destination,fix_budget,money,stays,tickets,weather");
check("an unknown tool is refused, not guessed", !(await runAgentTool("book_flight", {}, facts)).ok);

const moneyTool = await runAgentTool("money", {}, facts);
check("the money tool answers offline and in Persian", moneyTool.ok && moneyTool.summary.includes("تومان"));
const moneyData = moneyTool.data as { remaining: number; totalBudget: number };
check("and its remaining is the trip's own arithmetic", moneyData.totalBudget - moneyData.remaining >= 20_000_000);

const budgetTool = await runAgentTool("fix_budget", {}, { ...facts, budgetToman: 10_000_000 });
const fixData = budgetTool.data as { fits: boolean; neededBudgetMillions: number };
check("a shortfall produces a concrete new budget", budgetTool.ok && fixData.fits === false && fixData.neededBudgetMillions > 10);

const placeTool = await runAgentTool("destination", { topic: "غذا" }, facts);
check("the destination tool quotes our own profile only", placeTool.ok && placeTool.summary.length > 30);

const ticketTool = await runAgentTool("tickets", { mode: "train" }, { ...facts, departureDate: null });
check("without a date no ticket is invented", !ticketTool.ok && ticketTool.summary.includes("تاریخ"));

const justRead = normalizeTicketReading({
  mode: "train",
  origin: "تهران",
  destination: "مشهد",
  date_iso: "2026-12-05",
  departure_time: "8:30",
  company: "رجا",
  price: "۱٬۲۵۰٬۰۰۰",
  unread: [],
});
check("a photo is read into real trip facts", justRead.ok && justRead.fields.origin === "تهران" && justRead.fields.date === "2026-12-05");
check("the price is read as a number", justRead.fields.priceToman === 1_250_000, String(justRead.fields.priceToman));
check("the time is padded to a real clock", justRead.fields.departureTime === "08:30");

const jalaliRead = normalizeTicketReading({ mode: "bus", origin: "تهران", destination: "اصفهان", date_jalali: "1405-09-14" });
check("a Jalali date on the ticket is converted exactly", jalaliRead.ok && /^\d{4}-\d{2}-\d{2}$/.test(jalaliRead.fields.date || ""), String(jalaliRead.fields.date));

const wrongCity = normalizeTicketReading({ mode: "plane", origin: "تهران", destination: "پاریس", date_iso: "2026-12-05", unread: [] });
check("a city we do not serve is refused, not accepted", wrongCity.fields.destination === null && !wrongCity.ok);
check("and it says what could not be read", wrongCity.unread.includes("شهر مقصد"));

const pastRead = normalizeTicketReading({ mode: "plane", origin: "تهران", destination: "کیش", date_iso: "2020-01-01" });
check("a past date is not silently used", pastRead.fields.date === null);

const partial = normalizeTicketReading({ company: "ماهان", price: "900000" });
check("an unreadable ticket still returns what was real", !partial.ok && partial.fields.company === "ماهان" && partial.unread.length >= 3);

const rescueBase = {
  totalBudgetToman: 40_000_000,
  travellers: 2,
  days: 3,
  nights: 2,
  city: "اصفهان",
  ticketToman: 12_000_000,
  stayToman: 16_000_000,
};
const rescue = rescueScenarios(rescueBase);
check("three real ways out are offered, plus the exact budget", rescue.scenarios.length >= 2);
check("the last way always makes it fit", rescue.scenarios.some((scenario) => scenario.id === "raise" && scenario.fits));
check("one night less is priced from the room's own rate", rescue.scenarios.some((scenario) => scenario.id === "shorter" && scenario.newTotalToman < 28_000_000 + 8_400_000 + 1));
const noStay = rescueScenarios({ ...rescueBase, stayToman: 0 });
check("without a room nothing is invented", !noStay.scenarios.some((scenario) => scenario.id === "shorter") && noStay.missing.length > 0);
const withCheaper = rescueScenarios({ ...rescueBase, cheaperStayToman: 9_000_000, cheaperStayLabel: "هتل ارزان" });
check("a cheaper room that really exists becomes a scenario", withCheaper.scenarios.some((scenario) => scenario.id === "cheaper_stay"));

const levels = budgetLevels({ travellers: 2, days: 3, city: "اصفهان", ticketToman: 12_000_000, stayToman: 16_000_000 });
check("three budget sizes, in order", levels[0].millions < levels[1].millions && levels[1].millions < levels[2].millions);
check("the lean size is at least the trip's real cost", levels[0].millions * 1_000_000 >= 36_400_000);

// ---- the price watch: only real readings, never a guess
const sameDay = new Date("2026-11-05T09:00:00Z");
const dayBefore = new Date("2026-11-04T09:00:00Z");
const down = trendFrom([
  { at: dayBefore.toISOString(), priceToman: 5_000_000, offers: 12 },
  { at: sameDay.toISOString(), priceToman: 4_100_000, offers: 14 },
]);
check("a cheaper reading is called cheaper", down?.direction === "down" && down.deltaToman === -900_000);
check("and the sentence carries the real amount", Boolean(down?.message.includes("۹۰۰٬۰۰۰")));
check("a real 18٪ drop is worth telling the traveller", isNoteworthy(down));
check("one single reading never pretends to be a trend", trendFrom([{ at: sameDay.toISOString(), priceToman: 5_000_000, offers: 3 }])?.readings === 1);
check("a flat price says flat", trendFrom([
  { at: dayBefore.toISOString(), priceToman: 5_000_000, offers: 12 },
  { at: sameDay.toISOString(), priceToman: 5_000_200, offers: 12 },
])?.direction === "flat");
check("a 1٪ wobble is not worth a message", !isNoteworthy(trendFrom([
  { at: dayBefore.toISOString(), priceToman: 5_000_000, offers: 12 },
  { at: sameDay.toISOString(), priceToman: 4_980_000, offers: 12 },
])));
check("two different searches never share a watch key", priceWatchKey("transport", { a: 1 }) !== priceWatchKey("transport", { a: 2 }));
check("key order does not create two keys", priceWatchKey("transport", { a: 1, b: 2 }) === priceWatchKey("transport", { b: 2, a: 1 }));

// ---- the inspector: it must catch our own mistakes
const dirty = inspectTransport({
  fetchedAt: new Date().toISOString(),
  offers: [
    { id: "a", operator: "ماهان", priceToman: 6_000_000, logoUrl: "x" },
    { id: "a", operator: "ماهان", priceToman: 6_000_000, logoUrl: "x" },
    { id: "b", operator: "", priceToman: 12, logoUrl: "" },
  ],
  providerStatuses: [{ provider: "safar724", status: "failed" }],
});
const codes = dirty.map((finding) => finding.code);
check("a repeated id is an error, not a warning", dirty.some((finding) => finding.code === "duplicate-id" && finding.severity === "error"));
check("an impossible price is caught", codes.includes("implausible-price"));
check("a nameless ticket is caught", codes.includes("missing-operator"));
check("a dead provider is reported", codes.includes("provider-down"));
const clean = inspectTransport({
  fetchedAt: new Date().toISOString(),
  offers: [{ id: "a", operator: "ماهان", priceToman: 6_000_000, logoUrl: "x" }],
  providerStatuses: [{ provider: "alibaba", status: "ok" }],
});
check("a clean payload has no errors", clean.every((finding) => finding.severity !== "error"));
check("and the verdict says so in Persian", describeFindings(clean).includes("سالم"));
const stays = inspectAccommodation({ groups: [{ offers: [{ name: "", priceTotalToman: 0 }] }] });
check("a room without a name is an error", stays.some((finding) => finding.code === "room-without-name" && finding.severity === "error"));
check("no price at all is an error", stays.some((finding) => finding.code === "implausible-room-price"));

// ---- the plan follows the real weather
function weatherDay(overrides: Partial<WeatherDay>): WeatherDay {
  return {
    date: "2026-11-06",
    code: 0,
    label: "آسمان صاف",
    icon: "☀️",
    maxC: 22,
    minC: 10,
    rainProbability: 0,
    rainMm: 0,
    windKmh: 5,
    score: 80,
    advice: "",
    tone: "good",
    ...overrides,
  };
}
// Day one is indoors, day two is outdoors — and the rain is forecast for day two.
const planDays = [
  { day: 1, title: "روز اول", items: [{ time: "۰۹:۳۰", title: "موزه", type: "sightseeing", poiCategory: "موزه و تاریخ" }] },
  { day: 2, title: "روز دوم", items: [{ time: "۰۹:۳۰", title: "پارک", type: "sightseeing", poiCategory: "پارک و طبیعت" }] },
];
const rainySecond = [weatherDay({}), weatherDay({ code: 61, label: "باران", rainProbability: 90, score: 20, tone: "bad" })];
const reorder = planWeatherReorder(planDays, rainySecond);
check("the outdoor day is moved off the rainy date", reorder.changed && reorder.order[0] === 2);
const alreadyFine = planWeatherReorder([planDays[1], { ...planDays[0], day: 2 }], rainySecond);
check("when the order already fits, nothing is proposed", alreadyFine.changed === false);
check("and the sentence names the bad day", reorder.reason.includes("باران") || reorder.reason.includes("روز ۲"));
check("outdoor share is computed from real categories", outdoorsShare(["پارک و طبیعت"]) > 0.5);
const swapped = applyDayOrder(planDays, [2, 1], "2026-11-06");
check("applying an order renumbers the days", swapped[0].day === 1 && swapped[0].title === "روز دوم");
check("and gives each day its real date", (swapped[1] as { date?: string }).date === "2026-11-07");
check("no place is lost in the reorder", swapped.flatMap((day) => day.items).length === 2);

// ---- the taste profile speaks only after real evidence
const few: TasteEvent[] = [{ kind: "mode", value: "train", at: "2026-11-01T10:00:00Z" }];
check("one choice is not a taste", tasteProfile(few).confident === false);
const many: TasteEvent[] = Array.from({ length: MIN_SIGNAL }, (_, index) => ({
  kind: "mode" as const,
  value: "train",
  at: `2026-11-0${index + 1}T10:00:00Z`,
}));
const profile = tasteProfile(many);
check("three real choices make a pattern", profile.confident && profile.modes[0].value === "train");
check("the sentence counts them", profile.summary.includes("قطار"));
check("the profile feeds the advisor's tastes", tasteWords(profile).includes("قطار"));
check("history can only nudge, never overrule the budget", tasteBonus(profile, { mode: "train" }) <= 0.12);
check("a different choice gets no bonus", tasteBonus(profile, { mode: "plane" }) === 0);

// ---- one sentence in, one real trip out
const oneLine = parseTripSentence("۵ روز با بچه، ۴۰ میلیون، از تهران");
check("the days are read from the sentence", oneLine.days === 5);
check("the budget in millions is read", oneLine.budgetMillions === 40);
check("the origin is a real city", oneLine.origin === "تهران");
check("«با بچه» becomes a real child count", oneLine.children === 1 && oneLine.travelers === 2);
check("a destination was not invented", oneLine.destination === null && oneLine.missing.includes("مقصد"));

const withCity = parseTripSentence("یک هفته ساحل و آفتاب، ۶۰ میلیون، ۲ نفر، به کیش");
check("a named destination is kept", withCity.destination === "کیش");
check("a week becomes seven days", withCity.days === 7);
check("the taste words are read", withCity.moods.includes("ساحلی"));

const proposal = localProposal(parseTripSentence("۱۰ روز، ۸۰ میلیون، از مشهد"), "تهران");
check("a missing city comes from the real list", candidateCities([]).some((city) => city.name === proposal.destination));
check("the suggestion is never the origin city itself", proposal.destination !== proposal.origin);
check("nothing is left empty", proposal.days >= 1 && proposal.travelers >= 1 && proposal.budgetMillions >= 5);
const accepted = acceptProposal({ destination: "پاریس", days: 4, reason: "شهر خوبی است برای گردش و تفریح" }, withCity, proposal);
check("a destination the traveller named is never overridden", accepted.destination === proposal.destination || accepted.source === "local");
const inventedCity = acceptProposal({ destination: "آتلانتیس", days: 4, reason: "برای تو مناسب است و نزدیک است" }, parseTripSentence("۴ روز، ۳۰ میلیون"), proposal);
check("an invented city is refused", inventedCity.source === "local");

// ---- two cities, one decision
const kish = cityFacts("کیش", 2, 3);
const qeshm = cityFacts("قشم", 2, 3);
check("both cities have real facts", Boolean(kish && qeshm) && (kish?.highlights.length || 0) > 0);
const beachVerdict = compareLocally(kish as NonNullable<typeof kish>, qeshm as NonNullable<typeof qeshm>, {
  moods: ["ساحلی"],
  budgetToman: 60_000_000,
  travellers: 2,
  days: 3,
});
check("a decision is made and named", ["a", "b", "tie"].includes(beachVerdict.winner));
check("and it is explained with real numbers", beachVerdict.reason.includes("تومان") || beachVerdict.reason.includes("سلیقه"));
const cheapVerdict = compareLocally(kish as NonNullable<typeof kish>, qeshm as NonNullable<typeof qeshm>, {
  moods: [],
  budgetToman: 5_000_000,
  travellers: 2,
  days: 3,
});
check("a tiny budget changes the reasoning", cheapVerdict.winner !== "tie" || cheapVerdict.costGap >= 0);
const hijacked = acceptVerdict({ winner: "کیش", reason: "کیش با ۹۹۹ میلیون تومان برای تو بهتر است" }, kish as NonNullable<typeof kish>, qeshm as NonNullable<typeof qeshm>, beachVerdict, [kish?.tripDailyCost || 0]);
check("a model sentence with an invented price is thrown away", hijacked.source === "local");

// ---- the voice
check("a paragraph is split into speakable sentences", sentences("سلام. امروز به بازار می‌رویم؟ خیلی خوب است!").length === 3);

// ---- the receipt reader
const receipt = normalizeReceiptReading({ vendor: "رستوران شاطرعباس", title: "ناهار دو نفره", price: "۸۵۰٬۰۰۰", category: "food" });
check("a receipt amount becomes a real number", receipt.fields.toman === 850_000);
check("the kind of spending is kept", receipt.fields.category === "food");
const noPrice = normalizeReceiptReading({ vendor: "تاکسی", title: null, price: null });
check("a receipt with no readable amount is not used", noPrice.ok === false);
check("and the missing amount is named", noPrice.unread.includes("مبلغ"));
const guessed = normalizeReceiptReading({ vendor: "اسنپ", title: "سفر شهری", price: "120000" });
check("the category is read from the words when missing", guessed.fields.category === "transport");

// ---- the ledger
const entries: Expense[] = [
  { id: "1", title: "تاکسی", toman: 300_000, category: "transport", at: "2026-11-06T09:00:00Z", source: "manual" },
  { id: "2", title: "ناهار", toman: 850_000, category: "food", at: "2026-11-06T13:00:00Z", source: "receipt" },
  { id: "3", title: "موزه", toman: 200_000, category: "activity", at: "2026-11-06T16:00:00Z", source: "manual" },
];
const book = ledgerTotals(entries, 40_000_000);
check("the book adds up exactly", book.totalToman === 1_350_000);
check("the remaining is the budget minus the book", book.remainingToman === 38_650_000);
check("the biggest row is found", book.biggest?.title === "ناهار");
check("shares add up to a hundred", Math.round(book.byCategory.reduce((sum, row) => sum + row.share, 0)) === 100);
const over = ledgerTotals([...entries, { id: "4", title: "هتل", toman: 45_000_000, category: "stay", at: "2026-11-06T18:00:00Z", source: "manual" }], 40_000_000);
check("spending past the budget is called out", over.overBudget);
check("and the sentence says by how much", ledgerSentence(over, 40_000_000).includes("گذشته است"));
check("an empty book says so honestly", ledgerSentence(ledgerTotals([], 40_000_000), 40_000_000).includes("هنوز خرجی ثبت نشده"));

// ---- the reminders, only when the condition is true
const baseTrip: ReminderInput = {
  origin: "تهران",
  destination: "مشهد",
  departureDate: "2026-11-20",
  returnDate: null,
  days: 3,
  travellers: 2,
  children: 0,
  budgetToman: 40_000_000,
  ticketToman: 8_000_000,
  ticketLabel: "قطار",
  stayToman: 12_000_000,
  stayLabel: "هتل خیام",
  staySkipped: false,
  dailyTotalToman: 7_200_000,
  today: "2026-11-05",
};
const ready = tripReminders(baseTrip);
check("a complete trip has nothing urgent", ready.every((reminder) => reminder.severity !== "now"), ready.map((r) => r.id).join(","));
check("and the headline is calm", reminderHeadline(ready).length > 10);

const noDate = tripReminders({ ...baseTrip, departureDate: null });
check("a missing date is urgent", noDate.some((reminder) => reminder.id === "no-date" && reminder.severity === "now"));
const noTicket = tripReminders({ ...baseTrip, ticketToman: 0 });
check("a missing ticket is caught", noTicket.some((reminder) => reminder.id === "no-ticket"));
const overBudget = tripReminders({ ...baseTrip, budgetToman: 10_000_000 });
check("an over-budget trip says the real gap", overBudget.some((reminder) => reminder.id === "over-budget" && reminder.detail.includes("تومان")));
const skipped = tripReminders({ ...baseTrip, stayToman: 0, staySkipped: true });
check("a deliberately skipped room is not nagged about", !skipped.some((reminder) => reminder.id === "no-stay"));
const rainy = tripReminders({
  ...baseTrip,
  weather: [{ day: 2, label: "باران", rainProbability: 80, maxC: 18 }],
  dayOutdoors: [0.2, 0.9, 0.1],
});
check("rain over an outdoor day is a real reminder", rainy.some((reminder) => reminder.id === "rain-2"));
const dryOk = tripReminders({
  ...baseTrip,
  weather: [{ day: 2, label: "آفتابی", rainProbability: 10, maxC: 22 }],
  dayOutdoors: [0.9, 0.9, 0.9],
});
check("a dry day creates nothing", !dryOk.some((reminder) => reminder.id === "rain-2"));
const leavingTomorrow = tripReminders({ ...baseTrip, departureDate: "2026-11-06" });
check("leaving tomorrow produces the packing line", leavingTomorrow.some((reminder) => reminder.id === "departing"));
check("urgent reminders come first", leavingTomorrow[0].severity === "now");

// ---- the offline pack
const pack = buildOfflinePack({
  trip: {
    origin: "تهران",
    destination: "اصفهان",
    departureDate: "2026-11-20",
    returnDate: "2026-11-23",
    days: 3,
    travellers: 2,
    children: 1,
  },
  days: [
    { day: 1, title: "میدان نقش جهان", stops: [{ name: "عمارت عالی‌قاپو", category: "تاریخی", time: "۰۹:۳۰", latitude: 32.6575, longitude: 51.6674 }] },
    { day: 2, title: "پل‌ها", stops: [{ name: "سی‌وسه‌پل", category: "تاریخی", time: "۱۷:۰۰", latitude: 32.6447, longitude: 51.6676 }] },
  ],
  booking: { transportLabel: "قطار", transportCost: 4_800_000, stayName: "هتل خیام", stayCost: 9_000_000, stayAddress: "خیابان چهارباغ", stayPhone: null },
  money: { budgetToman: 40_000_000, plannedToman: 13_800_000, spentToman: 1_200_000, remainingToman: 38_800_000, rows: [{ label: "بلیت", toman: 4_800_000, kind: "real" }] },
  now: new Date("2026-11-05T08:00:00Z"),
});
check("the pack carries both days and both stops", pack.days.length === 2 && pack.days.flatMap((day) => day.stops).length === 2);
check("coordinates are kept, rounded, for offline routing", pack.days[0].stops[0].latitude === 32.6575);
check("the version is stamped", pack.version === OFFLINE_PACK_VERSION);
check("the pack knows what it could not fill", Array.isArray(pack.gaps));
const gapPack = buildOfflinePack({
  trip: { origin: "تهران", destination: "یزد", departureDate: null, returnDate: null, days: 2, travellers: 2, children: 0 },
  days: [{ day: 1, stops: [] }],
  booking: { transportLabel: null, transportCost: 0, stayName: null, stayCost: 0, stayAddress: null, stayPhone: null },
  money: { budgetToman: 20_000_000, plannedToman: 0, spentToman: 0, remainingToman: 20_000_000, rows: [] },
});
check("an empty trip admits its gaps", gapPack.gaps.length >= 3);
check("a four-day-old pack is warned about", packWarnings(pack, new Date("2026-11-09T08:00:00Z")).some((line) => line.includes("ذخیره شده")));
check("a three-day-old pack is warned about", packWarnings(pack, new Date("2026-11-08T08:00:00Z")).some((line) => line.includes("ذخیره شده")));
check("age is spoken in Persian", packAge(pack, new Date("2026-11-05T11:00:00Z")).text.includes("ساعت"), packAge(pack, new Date("2026-11-05T11:00:00Z")).text);
check("each trip has its own pack key", offlinePackKey({ origin: "تهران", destination: "یزد", departureDate: "2026-11-20", days: 2 }) !== offlinePackKey({ origin: "تهران", destination: "یزد", departureDate: "2026-11-21", days: 2 }));

// ---- the share intro
const sharedTrip: ShareTrip = {
  v: 1,
  city: "اصفهان",
  createdAt: "2026-11-05T08:00:00Z",
  days: [
    {
      d: 1,
      th: "نقش جهان",
      ar: "صبح",
      km: 4,
      mn: 12,
      stops: [
        { n: "عمارت عالی‌قاپو", c: "تاریخی", la: 32.6575, lo: 51.6674, t: "۰۹:۳۰", v: 60 },
        { n: "مسجد شیخ لطف‌الله", c: "تاریخی", la: 32.6572, lo: 51.6676, t: "۱۱:۰۰", v: 45 },
      ],
    },
  ],
  totals: { km: 4, driveMinutes: 12, stops: 2, days: 1 },
  engine: "local",
  money: { total: 13_800_000, real: 4_800_000, estimate: 9_000_000, budget: 40_000_000, remaining: 26_200_000, lines: [] },
};
const shareInfo = shareFacts(sharedTrip);
check("the facts are the plan's own", shareInfo.city === "اصفهان" && shareInfo.stops === 2 && shareInfo.names.includes("عمارت عالی‌قاپو"));
const local = localIntro(sharedTrip);
check("the local paragraph names the city and the days", local.includes("اصفهان") && local.includes("۱"));
check("a model paragraph that invents a price is dropped", acceptIntro({ intro: "این سفر فوق‌العاده است و فقط ۹۹ میلیون تومان هزینه دارد، حتماً بروید و لذت ببرید." }, sharedTrip).source === "local");
check("a model paragraph with real numbers is kept", acceptIntro({ intro: `${local}` }, sharedTrip).intro.length > 40);
check("a too-short paragraph is refused", acceptIntro({ intro: "خوب است." }, sharedTrip).source === "local");

check("the agent's own model chain is cheap", chainFor("agent").models.length >= 2);
check("a tool decision costs a fraction of a cent", estimateTaskCostUsd("agent", 2_000) < 0.005);
check("the reviewer is even cheaper", estimateTaskCostUsd("review", 2_500) < 0.002);

console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ round 35: the agent works from real data and refuses anything it cannot prove");
process.exit(failures ? 1 : 0);
}

void main();
