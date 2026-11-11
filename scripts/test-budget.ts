/**
 * The money split must be honest: real prices stay real, assumptions stay
 * labelled, and a missing price is said out loud instead of invented.
 * Every amount must be safe with weird inputs (zero days, zero travellers).
 */
import {
  BUDGET_ASSUMPTIONS_KEY,
  DEFAULT_BUDGET_ASSUMPTIONS,
  buildBudgetPlan,
  formatToman,
  formatTomanShort,
  readBudgetAssumptions,
  sanitizeAssumptions,
  saveBudgetAssumptions,
  type BudgetAssumptions,
} from "../lib/budget";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const assumptions: BudgetAssumptions = {
  cityCostPerKm: 1500,
  foodPerPersonPerDay: 600_000,
  ticketPerStop: 120_000,
  extrasPerPersonPerDay: 200_000,
};

const base = {
  days: 3,
  stops: 12,
  cityKm: 37.8,
  people: 2,
  children: 0,
  budgetToman: 15_000_000,
  accommodation: { name: "هتل آپارتمان زاگرس مشهد", nights: 3, totalToman: 4_800_000 },
  transport: { label: "خودروی شخصی", totalToman: 2_000_000 },
  assumptions,
};

console.log("A complete trip");
const full = buildBudgetPlan(base);
const byId = (plan: typeof full, id: string) => plan.lines.find((line) => line.id === id)!;
check("six clear lines", full.lines.length === 6, full.lines.map((line) => line.label).join(" / "));
check("accommodation is a real price", byId(full, "stay").kind === "real" && byId(full, "stay").amount === 4_800_000);
check("transport is a real price", byId(full, "transport").kind === "real" && byId(full, "transport").amount === 2_000_000);
check("city driving uses measured km × rate", byId(full, "city-drive").amount === Math.round(37.8 * 1500 / 1000) * 1000, String(byId(full, "city-drive").amount));
check("food is people × days × rate", byId(full, "food").amount === 2 * 3 * 600_000);
check("tickets are stops × people × rate", byId(full, "tickets").amount === 12 * 2 * 120_000);
check("extras are people × days × rate", byId(full, "extras").amount === 2 * 3 * 200_000);
check(
  "total is the sum of the lines",
  full.total === full.lines.reduce((sum, line) => sum + (line.amount || 0), 0),
  String(full.total),
);
check("real and estimate are separated", full.realTotal === 6_800_000 && full.estimateTotal === full.total - 6_800_000);
check("remaining is budget minus total", full.remaining === 15_000_000 - full.total);
check("nothing is missing", full.missing.length === 0);
check("per day and per person are computed", full.perDay === Math.round(full.total / 3) && full.perTraveler === Math.round(full.total / 2));
check("shares add up to about 100%", Math.abs(full.shares.reduce((sum, item) => sum + item.percent, 0) - 100) < 0.5, String(full.shares.reduce((sum, item) => sum + item.percent, 0)));

console.log("Missing real prices are said out loud");
const bare = buildBudgetPlan({ ...base, accommodation: null, transport: null, budgetToman: null });
check("no accommodation is flagged", byId(bare, "stay").kind === "missing" && byId(bare, "stay").amount === null);
check("no transport is flagged", byId(bare, "transport").kind === "missing" && byId(bare, "transport").amount === null);
check("the total only counts known lines", bare.total === full.total - 6_800_000);
check("the page is told what is missing", bare.missing.includes("stay") && bare.missing.includes("transport"));
check("a note explains the gap", bare.notes.some((note) => note.includes("اقامتگاه")));
check("no budget means no remaining", bare.remaining === null && bare.over === false);

console.log("Never a made-up number");
const unmeasured = buildBudgetPlan({ ...base, cityKm: null });
check("unmeasured driving is missing, not zero", byId(unmeasured, "city-drive").kind === "missing" && byId(unmeasured, "city-drive").amount === null);
check("a zero-kilometre trip costs nothing for driving", byId(buildBudgetPlan({ ...base, cityKm: 0 }), "city-drive").amount === 0);

console.log("Over budget is told as it is");
const tight = buildBudgetPlan({ ...base, budgetToman: 5_000_000 });
check("over budget is flagged", tight.over === true);
check("remaining is negative", (tight.remaining || 0) < 0);
const exact = buildBudgetPlan({ ...base, budgetToman: full.total });
check("exactly on budget is not over", exact.over === false && exact.remaining === 0);

console.log("Weird input cannot break the page");
const weird = buildBudgetPlan({ ...base, days: 0, people: 0, stops: 0, budgetToman: 0 });
check("no NaN or Infinity anywhere", [weird.total, weird.perDay, weird.perTraveler, weird.realTotal].every((value) => Number.isFinite(value)));
check("zero days is treated as one day", weird.perDay === weird.total);
check("a zero budget is not a budget", weird.budget === null && weird.remaining === null);
check("no stops means no ticket line", weird.lines.find((line) => line.id === "tickets")?.kind === "missing");
const negative = buildBudgetPlan({ ...base, budgetToman: -5, cityKm: -20, accommodation: { totalToman: -1 } });
check("negative money is ignored", negative.budget === null && negative.lines.find((line) => line.id === "stay")?.kind === "missing");
check("negative km is ignored", negative.lines.find((line) => line.id === "city-drive")?.amount === null);

console.log("Assumptions are clamped, not trusted");
check("a sane answer passes as it is", sanitizeAssumptions(assumptions).foodPerPersonPerDay === 600_000);
check("text is replaced by the default", sanitizeAssumptions({ foodPerPersonPerDay: "abc" as unknown as number }).foodPerPersonPerDay === DEFAULT_BUDGET_ASSUMPTIONS.foodPerPersonPerDay);
check("a negative value falls back", sanitizeAssumptions({ ticketPerStop: -1 }).ticketPerStop === DEFAULT_BUDGET_ASSUMPTIONS.ticketPerStop);
check("an absurd value is capped", sanitizeAssumptions({ foodPerPersonPerDay: 9_999_999_999 }).foodPerPersonPerDay === 50_000_000);
check("empty input gives the defaults", JSON.stringify(sanitizeAssumptions(null)) === JSON.stringify(DEFAULT_BUDGET_ASSUMPTIONS));

console.log("Assumptions survive storage problems");
const memory = new Map<string, string>();
const store = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value); },
};
check("saving works", saveBudgetAssumptions({ ...assumptions, foodPerPersonPerDay: 750_000 }, store) === true);
check("reading gives back what was saved", readBudgetAssumptions(store).foodPerPersonPerDay === 750_000);
memory.set(BUDGET_ASSUMPTIONS_KEY, "{broken json");
check("broken storage gives the defaults", readBudgetAssumptions(store).foodPerPersonPerDay === DEFAULT_BUDGET_ASSUMPTIONS.foodPerPersonPerDay);
const brokenStore = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
};
check("a blocked storage never crashes the page", readBudgetAssumptions(brokenStore).cityCostPerKm === DEFAULT_BUDGET_ASSUMPTIONS.cityCostPerKm);
check("saving into a blocked storage just fails", saveBudgetAssumptions(assumptions, brokenStore) === false);
check("no storage at all still works", readBudgetAssumptions(null).ticketPerStop === DEFAULT_BUDGET_ASSUMPTIONS.ticketPerStop);

console.log("Money is written in Persian");
check("thousands are separated", formatToman(1234000).includes("۱") && formatToman(1234000).includes("تومان"), formatToman(1234000));
check("no latin digits leak out", !/[0-9]/.test(formatToman(4_850_000)), formatToman(4_850_000));
check("the short form uses millions", formatTomanShort(4_850_000).includes("میلیون"), formatTomanShort(4_850_000));
check("small money stays exact", formatTomanShort(450_000).includes("تومان") && !formatTomanShort(450_000).includes("میلیون"), formatTomanShort(450_000));

console.log("The pages actually use the shared engine");
import fs from "node:fs";
const itinerary = fs.readFileSync("app/itinerary/page.tsx", "utf8");
const print = fs.readFileSync("app/itinerary/print/page.tsx", "utf8");
const component = fs.readFileSync("components/BudgetBreakdown.tsx", "utf8");
check("the plan page builds the budget", itinerary.includes("buildBudgetPlan("));
check("the printed book builds the same budget", print.includes("buildBudgetPlan("));
check("the printed book reads the traveller's own assumptions", print.includes("readBudgetAssumptions("));
check("the online card is editable", component.includes("onAssumptionsChange("));
check("the card labels estimates as estimates", component.includes("تخمین با فرض شما"));
check("the printable payload follows the edits", itinerary.includes("JSON.stringify(payload)") && itinerary.includes("[data, weather]"));

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nBudget breakdown tests passed.");
