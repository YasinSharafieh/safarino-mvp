/**
 * Round 42 — «وضعیت سفر» on every phase.
 *
 * The bar is only useful if it can never lie. So this suite checks the three
 * things that make it trustworthy:
 *
 *   1. a step is «done» only when the shared trip really holds that choice
 *      (a ticket needs a mode *and* a price; a stay can be chosen, skipped or
 *      already booked — undecided is not done);
 *   2. the next step is the first unfinished one, and a date the traveller never
 *      picked is reported as «انتخاب نشده» instead of being invented;
 *   3. it is mounted once, globally, and hides itself on the screens where a
 *      traveller's own status does not belong.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { accommodationState, hasChosenTransport, staySummary, tripStatus } from "../lib/trip-status";
import { CAPABILITIES, PHASES } from "../lib/phase-coverage";

let failures = 0;
function check(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  fail ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  try {
    return readFileSync(join(process.cwd(), path), "utf8");
  } catch {
    return "";
  }
}

console.log("۴۲ — نوار «وضعیت سفر» همه‌جا هست و هیچ‌وقت دروغ نمی‌گوید");

// ── 1) Nothing to show without a destination ──────────────────────────────────

const empty = tripStatus({ origin: "تهران", destination: "", days: 3, travelers: 2, budgetMillions: 15 });
check("with no destination the bar does not exist", empty.exists === false);
check("and it still counts zero done steps", empty.doneCount === 0);
check("its next step is the destination itself", empty.next.id === "route" && empty.next.href === "/start/cities");
check("nothing is marked done in an empty trip", empty.steps.every((step) => !step.done));

// ── 2) A date is never invented ──────────────────────────────────────────────

const noDate = tripStatus({ origin: "تهران", destination: "شیراز", days: 3, travelers: 2, budgetMillions: 20 });
check("a trip with no date is not 'route done'", noDate.steps.find((step) => step.id === "route")?.done === false);
check("the next step asks for the date", noDate.next.id === "route" && noDate.next.cta.includes("تاریخ"));
check("the date chip says it is not chosen", noDate.chips.find((chip) => chip.id === "date")?.value === "انتخاب نشده");
check("an empty chip is marked as empty, not as an error", noDate.chips.find((chip) => chip.id === "date")?.tone === "empty");
check("the next-step sentence says the date is the traveller's own choice", noDate.next.why.includes("خودت"));

const withDate = tripStatus({ origin: "تهران", destination: "شیراز", departureDate: "2026-11-12", dateLabel: "۲۱ آبان", days: 3, travelers: 2, budgetMillions: 20 });
check("with a real date, route is done", withDate.steps.find((step) => step.id === "route")?.done === true);
check("the date chip shows the Jalali label the page already has", withDate.chips.find((chip) => chip.id === "date")?.value === "۲۱ آبان");
check("the next step is now the ticket", withDate.next.id === "ticket" && withDate.next.href === "/transport");

// ── 3) A ticket is a real offer, not a toggle ────────────────────────────────

check("an empty object is not a ticket", hasChosenTransport({}) === false);
check("a price without a mode is not a ticket", hasChosenTransport({ cost: 3_000_000 }) === false);
check("a mode with a real price is a ticket", hasChosenTransport({ cost: 3_000_000, mode: "train" }) === true);
check("the traveller's own car counts as a choice", hasChosenTransport({ cost: 1_800_000, vehicleId: "car" }) === true);
check("null is not a ticket", hasChosenTransport(null) === false);

// ── 4) A stay can be decided in three honest ways ────────────────────────────

check("no stay records means undecided", accommodationState(null) === "undecided");
check("an empty object is undecided too", accommodationState({}) === "undecided");
check("a chosen room is a decision", accommodationState({ status: "selected", name: "هتل زندیه" }) === "chosen");
check("«بدون اقامتگاه» is a decision, not a gap", accommodationState({ status: "skipped" }) === "none");
check("an already-booked stay is a decision", accommodationState({ status: "booked" }) === "none");
check("a name alone is a decision", accommodationState({ name: "خانهٔ سنتی" }) === "chosen");
check("the skip is worded as the traveller's own choice", staySummary({ status: "skipped" }).includes("خودت"));
check("an undecided stay is worded as such", staySummary(null) === "انتخاب نشده");

const skipped = tripStatus({ origin: "تهران", destination: "یزد", departureDate: "2026-11-12", days: 3, travelers: 2, budgetMillions: 20, transport: { cost: 2_000_000, mode: "bus" }, accommodation: { status: "skipped" } });
check("skipping the stay finishes that step", skipped.steps.find((step) => step.id === "stay")?.done === true);
check("and the traveller moves on to the plan", skipped.next.id === "plan");
check("three steps are counted as done", skipped.doneCount === 3, skipped.progressLabel);

// ── 5) The plan and the book ─────────────────────────────────────────────────

const ready = tripStatus({ origin: "تهران", destination: "یزد", departureDate: "2026-11-12", days: 3, travelers: 2, budgetMillions: 20, transport: { cost: 2_000_000, mode: "bus" }, accommodation: { name: "هتل داد" }, hasPlan: true });
check("a built plan finishes the plan step", ready.steps.find((step) => step.id === "plan")?.done === true);
check("with a ticket and a plan, the book is ready", ready.steps.find((step) => step.id === "book")?.done === true);
check("all five steps are done", ready.doneCount === 5, ready.progressLabel);
check("the last next-step is the book, not a warning", ready.next.id === "book" && ready.next.cta.includes("دفترچه"));

const planNoTicket = tripStatus({ origin: "تهران", destination: "یزد", departureDate: "2026-11-12", days: 3, travelers: 2, budgetMillions: 20, accommodation: { name: "هتل داد" }, hasPlan: true });
check("a plan without a ticket does not finish the book step", planNoTicket.steps.find((step) => step.id === "book")?.done === false);
check("and the next step is still the ticket", planNoTicket.next.id === "ticket");

// ── 6) The chips describe the real trip ──────────────────────────────────────

const family = tripStatus({ origin: "تهران", destination: "مشهد", departureDate: "2026-12-01", days: 5, travelers: 2, children: 1, infants: 0, budgetMillions: 40 });
check("the route chip keeps both cities", family.chips.find((chip) => chip.id === "route")?.value === "تهران → مشهد");
check("the people chip separates adults and children", /۲ بزرگسال/.test(family.chips.find((chip) => chip.id === "people")?.value || "") && /۱ کودک/.test(family.chips.find((chip) => chip.id === "people")?.value || ""));
check("the budget chip is in toman, not millions", (family.chips.find((chip) => chip.id === "budget")?.value || "").includes("۴۰٬۰۰۰٬۰۰۰"));
check("the length chip counts days", (family.chips.find((chip) => chip.id === "length")?.value || "").includes("۵"));
check("every chip has a Persian label", family.chips.every((chip) => chip.label.length > 1 && chip.value.length > 0));
check("the progress sentence is in words", /از/.test(family.progressLabel) && family.progressLabel.includes("۵"));

const sameCity = tripStatus({ origin: "شیراز", destination: "شیراز", days: 2, travelers: 1, budgetMillions: 10 });
check("a same-city trip is not written as an arrow", sameCity.chips.find((chip) => chip.id === "route")?.value === "شیراز");

// ── 7) It is mounted once, everywhere, and hides itself where it should ──────

const layout = read("app/layout.tsx");
check("the bar is mounted in the global layout", layout.includes("<TripStatus"));
check("it sits inside the shared trip provider", layout.indexOf("<TripStatus") > layout.indexOf("<TravelProvider>"));

const component = read("components/TripStatus.tsx");
check("it hides itself with no destination", component.includes("!status.exists"));
check("it is kept off the printed book", component.includes('"/itinerary/print"'));
check("it is kept off a shared link", component.includes('"/s/"'));
check("it is kept off the offline reader", component.includes('"/offline"'));
// Comments are stripped first: the file explains that it avoids `fixed`, which
// is not the same as using it.
const componentCode = component.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
check("it never floats over the page", !/className="[^"]*\bfixed\b/.test(componentCode));
check("it disappears in print", component.includes("print:hidden"));
check("its plan flag is read from this device, never assumed", component.includes("ITINERARY_STORAGE_KEY"));

const declared = CAPABILITIES.find((capability) => capability.id === "trip-status");
check("the contract declares it for every phase", Boolean(declared) && declared!.phases === "all" && declared!.global === true);
check("the contract explains why it is absent somewhere", Boolean(declared?.note) && declared!.note!.length > 20);
check("every phase still exists in the contract", PHASES.length === 14);

console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ round 42: the trip status is on every phase and can never claim something the trip does not hold");
process.exit(failures ? 1 : 0);
