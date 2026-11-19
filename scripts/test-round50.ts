/**
 * Round 50 — «live tickets, richer».
 *
 * The user's complaint was concrete: «اطلاعات قطارهایی که می‌آورد کمه». The cause
 * was concrete too: the providers publish dozens of facts about a train, a flight
 * and a coach, and the normalisers kept four of them. These assertions pin every
 * fact the adapters must now carry — and pin the promise that nothing is
 * invented when the provider stays silent.
 */
import assert from "node:assert/strict";
import { cleanFacts, clockWithDay, faDigits, flagOn, journeyText, pickFlag, pickText } from "../lib/service-facts";
import { normalizeTrains } from "../lib/alibaba-ground";

/** A row shaped exactly like علی‌بابا's live train payload. */
const train = (overrides: Record<string, unknown> = {}) => ({
  proposalId: "23375982634",
  cost: 9_150_500,
  seat: 336,
  departureDateTime: "2026-12-08T09:10:00",
  arrivalDateTime: "2026-12-09T01:15:00",
  companyName: "رجا",
  trainNumber: "318",
  wagonName: "اتوبوسي صبا",
  logoSuffix: "1",
  isCompartment: true,
  compartmentCapacity: 4,
  hasAirCondition: true,
  hasMedia: true,
  nonRefundable: false,
  maxDiscount: 14,
  originStationName: "تهران",
  destinationStationName: "مشهد",
  ...overrides,
});

const [rich] = normalizeTrains([train()]);
assert.ok(rich, "a real row must survive normalisation");
assert.equal(rich.priceToman, 915_050, "rial → toman, as the provider states it");
assert.equal(rich.seatsLeft, 336);
assert.equal(rich.companyName, "رجا", "the company is kept apart from the service number");
assert.equal(rich.originStation, "تهران");
assert.equal(rich.destinationStation, "مشهد");
assert.equal(rich.title, "رجا · قطار 318");
assert.equal(rich.subtitle, "اتوبوسي صبا");

// The adapter keeps the provider's own digits; the shared layer turns them into
// Persian ones before the card ever sees them, so both are asserted.
const facts = faDigits(rich.details.join(" | "));
assert.match(facts, /کوپهٔ ۴ نفره/, "compartment size is a fact the provider sent");
assert.match(facts, /سرمایش و گرمایش/);
assert.match(facts, /نمایشگر و سرگرمی/);
assert.match(facts, /قابل استرداد/, "a refundable ticket must say so, not stay silent");
assert.match(facts, /۱۴٪ تخفیف/);
assert.match(facts, /ایستگاه مبدأ: تهران/);
assert.match(facts, /ایستگاه مقصد: مشهد/);
assert.ok(faDigits(rich.amenities!.join(" | ")).includes("کوپهٔ ۴ نفره"), "the chip list carries the same facts");

// Nothing the provider did not send may appear.
const [bare] = normalizeTrains([train({ hasAirCondition: false, hasMedia: false, isCompartment: false, maxDiscount: 0, nonRefundable: undefined, originStationName: undefined, destinationStationName: undefined })]);
const bareFacts = faDigits(bare.details.join(" | "));
assert.doesNotMatch(bareFacts, /سرمایش/, "an unstated facility is never printed");
assert.doesNotMatch(bareFacts, /نمایشگر/);
assert.doesNotMatch(bareFacts, /تخفیف/);
assert.doesNotMatch(bareFacts, /استرداد/, "no refund claim when the provider gave no answer");
assert.doesNotMatch(bareFacts, /ایستگاه مبدأ/, "no station when none was sent");

// A sold-out or priceless row is not a ticket.
assert.equal(normalizeTrains([train({ seat: 0 })]).length, 0, "no seats left → not offered");
assert.equal(normalizeTrains([train({ cost: 0 })]).length, 0, "no price → not offered");

// Provider flags arrive as true / 1 / "1" / "yes".
for (const value of [true, 1, "1", "true", "yes"]) assert.equal(flagOn(value), true, `${String(value)} means on`);
for (const value of [false, 0, "0", "false", null, undefined, ""]) assert.equal(flagOn(value), false);
assert.equal(pickFlag({ hasAirCondition: "1" }, ["hasAirCondition", "hasAircondition"]), true, "either spelling of one flag");
assert.equal(pickText({ orginTerminal: "", originTerminal: "پایانهٔ جنوب" }, ["orginTerminal", "originTerminal"]), "پایانهٔ جنوب", "a provider typo must not lose a station");

// Facts: no empties, no repeats, no substring noise.
assert.deepEqual(cleanFacts(["سرمایش", "", "سرمایش", "سرمایش و گرمایش"]), ["سرمایش و گرمایش"]);
assert.deepEqual(cleanFacts(["VIP", "VIP 2+1"]), ["VIP 2+1"]);
assert.deepEqual(cleanFacts(["اتوبوسي صبا", "سرمایش"], { drop: ["اتوبوسي صبا"] }), ["سرمایش"]);

// Time text is measured, never assumed.
assert.equal(journeyText("2026-12-08T09:10:00", "2026-12-08T21:30:00"), "۱۲ ساعت و ۲۰ دقیقه");
assert.equal(journeyText("2026-12-08T09:10:00", null), "", "no arrival → no duration claim");
assert.equal(clockWithDay("2026-12-08T20:00:00", "2026-12-09T01:15:00"), "۱ روز بعد");
assert.equal(clockWithDay("2026-12-08T08:00:00", "2026-12-08T10:00:00"), "");

assert.equal(faDigits("4 ستاره · 25%"), "۴ ستاره · ۲۵٪");

console.log("✅ round 50: every fact the ticket sources publish reaches the traveller — and nothing they did not publish");
