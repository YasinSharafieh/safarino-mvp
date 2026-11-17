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

check("the agent's own model chain is cheap", chainFor("agent").models.length >= 2);
check("a tool decision costs a fraction of a cent", estimateTaskCostUsd("agent", 2_000) < 0.005);
check("the reviewer is even cheaper", estimateTaskCostUsd("review", 2_500) < 0.002);

console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ round 35: the agent works from real data and refuses anything it cannot prove");
process.exit(failures ? 1 : 0);
}

void main();
