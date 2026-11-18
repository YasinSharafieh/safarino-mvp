import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { tripStatus } from "../lib/trip-status";
import { JOURNEY_STEPS } from "../lib/site-facts";

/**
 * Round 49 — the trip strip, the step counter and the real source logos.
 *
 * Three promises are checked here, because each one can quietly regress:
 *  ۱. the home page no longer prints the trip strip (route/date/budget chips);
 *  ۲. every phase counts its progress in words — «۲ از ۵» — from the shared trip;
 *  ۳. the six accommodation sources and the two ticket sources show their real
 *     downloaded mark, not a letter in a circle.
 */

// ۱. home page: the strip is filtered out on «/» only.
const tripStatusSource = readFileSync("components/TripStatus.tsx", "utf8");
assert.match(tripStatusSource, /const isHome = pathname === "\/"/, "the status bar must know when it is on the home page");
assert.match(tripStatusSource, /status\.chips\.filter\(\(\) => !isHome\)/, "home must not print the trip chips");
assert.match(tripStatusSource, /status\.stageLabel/, "home keeps the progress readout");
assert.match(tripStatusSource, /status\.chips\.filter/, "no chip row may survive on the home page");

// ۲. «X از ۵» from the shared trip.
const stepSource = readFileSync("components/TravelSteps.tsx", "utf8");
assert.match(stepSource, /از ۵/, "the stepper must say «X از ۵» in words");
assert.match(stepSource, /JOURNEY_STEPS\[current - 1\]/, "the stepper must name the phase it is on");
assert.match(stepSource, /const reached = Math\.min\(5, Math\.max\(1, current\)\)/, "the stepper counts the phase you are on, not a different number");

const empty = tripStatus({ origin: "", destination: "", departureDate: "", days: 0, travelers: 1, children: 0, infants: 0, budgetMillions: 0 });
assert.equal(empty.exists, false, "with no destination there is no status at all");

const base = {
  origin: "تهران",
  destination: "مشهد",
  departureDate: "2026-12-01",
  days: 3,
  travelers: 2,
  children: 0,
  infants: 0,
  budgetMillions: 20,
};
const routeOnly = tripStatus({ ...base });
assert.equal(routeOnly.doneCount, 1, "route + date is exactly one finished step");
assert.equal(routeOnly.progressShort, "۱ از ۵");

const ticketed = tripStatus({ ...base, transport: { cost: 1_200_000, mode: "train", name: "قطار" } });
assert.equal(ticketed.doneCount, 2, "a chosen ticket is the second step");
assert.equal(ticketed.progressShort, "۲ از ۵");

const stayed = tripStatus({ ...base, transport: { cost: 1_200_000, mode: "train", name: "قطار" }, accommodation: { status: "skipped" } });
assert.equal(stayed.doneCount, 3, "«بدون اقامتگاه» is a decision and counts as the stay step");

const planned = tripStatus({ ...base, transport: { cost: 1_200_000, mode: "train", name: "قطار" }, accommodation: { status: "skipped" }, hasPlan: true });
assert.equal(planned.doneCount, 5, "a plan plus a ticket finishes all five steps, the book included");
assert.equal(planned.progressShort, "۵ از ۵");
assert.equal(routeOnly.stageLabel, "۲ از ۵", "standing on the ticket phase is «۲ از ۵» everywhere");
assert.equal(stayed.stage, 4);
assert.equal(planned.stage, 5, "a finished trip stands on the last phase");
assert.equal(planned.total, JOURNEY_STEPS.length, "the counter is out of the real number of phases");

// ۳. real logos, self-hosted.
const logos = ["alibaba", "safar724", "jabama", "jajiga", "otaghak", "snapptrip", "eghamat24"];
for (const name of logos) {
  const path = `public/providers/${name}.png`;
  assert.ok(existsSync(path), `missing real logo: ${path}`);
  const bytes = readFileSync(path);
  assert.ok(bytes.length > 1000, `${path} is suspiciously small (${bytes.length} bytes)`);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${path} must be a real PNG`);
}
const sourceLogo = readFileSync("components/SourceLogo.tsx", "utf8");
for (const name of logos) {
  assert.match(sourceLogo, new RegExp(`/providers/${name}\\.png`), `${name} must point at its local file`);
}
const ticketSearch = readFileSync("components/transport/TicketSearch.tsx", "utf8");
assert.match(ticketSearch, /ProviderTag/, "ticket rows must name their source with the real mark");
assert.doesNotMatch(ticketSearch, /PROVIDER_MARKS\[/, "the circled letter is gone from the ticket list");

// Provider outages must not be reported as dead sites.
const searchSource = readFileSync("lib/transport-search.ts", "utf8");
assert.match(searchSource, /ALIBABA_SEARCH_INCOMPLETE: "/, "a slow provider gets its own sentence, not «پاسخ نداد»");

console.log("✅ round 49: the home strip is gone, every phase counts «X از ۵», and the real logos are in place");
