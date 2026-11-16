/**
 * The «smarter site» round: the package shelf, the budget hand-off, the crisis
 * plan, the destination colours, the story scenes and the companion's answers.
 *
 * Every check has the same purpose: the app may only use numbers it really has,
 * and it must visibly change when those numbers change.
 */
import assert from "node:assert/strict";
import { ambientCss, ambientFor } from "../lib/ambient";
import { robinPlan } from "../lib/budget-robin";
import { answerLocally, keepOnlyRealNumbers, type AskFacts } from "../lib/companion-ask";
import { buildCrisisPlan, crisisNeeded } from "../lib/crisis-plan";
import { curatePackages, sanitizePackageAnswer, shelfSummary, tierFor, type CuratedPackage } from "../lib/package-curator";
import { storyScenes } from "../lib/story-plan";
import type { TripPackage } from "../lib/trip-packages";

function pkg(partial: Partial<TripPackage> & { id: string; totalToman: number; mode: "plane" | "train" | "bus" }): TripPackage {
  return {
    id: partial.id,
    origin: "تهران",
    destination: partial.destination || "یزد",
    days: partial.days || 3,
    nights: (partial.days || 3) - 1,
    departureDate: "2026-11-10",
    returnDate: "2026-11-12",
    travellers: partial.travellers || 2,
    ticket: {
      mode: partial.mode,
      modeLabel: partial.mode === "plane" ? "هواپیما" : partial.mode === "train" ? "قطار" : "اتوبوس",
      operator: "آزمون",
      serviceLabel: "کلاس ۱",
      departure: "2026-11-10T07:00:00",
      arrival: "2026-11-10T13:00:00",
      priceToman: Math.round(partial.totalToman * 0.4),
      providerLabel: "منبع",
      bookingUrl: "https://example.com",
      returnEstimated: false,
    },
    stay: {
      name: `اقامت ${partial.id}`,
      typeLabel: "هتل",
      location: "مرکز شهر",
      provider: "provider",
      providerLabel: "منبع",
      photo: null,
      rating: partial.id === "lux" ? 4.6 : 3.9,
      reviewCount: 10,
      pricePerNightToman: Math.round((partial.totalToman * 0.6) / Math.max(1, (partial.days || 3) - 1)),
      priceTotalToman: Math.round(partial.totalToman * 0.6),
      bookingUrl: "https://example.com",
    },
    ticketTotalToman: Math.round(partial.totalToman * 0.4),
    stayTotalToman: Math.round(partial.totalToman * 0.6),
    totalToman: partial.totalToman,
    continueUrl: "/transport",
    fetchedAt: "2026-11-05T00:00:00Z",
    fromStoredCopy: false,
  };
}

const shelf = [
  pkg({ id: "cheap-bus", totalToman: 4_000_000, mode: "bus" }),
  pkg({ id: "mid-train", totalToman: 9_000_000, mode: "train" }),
  pkg({ id: "lux", totalToman: 26_000_000, mode: "plane" }),
  pkg({ id: "cheap-plane", totalToman: 6_000_000, mode: "plane" }),
];

/* ------------------------------------------------------------ packages */

assert.equal(tierFor(300_000, 2_000_000), "economy");
assert.equal(tierFor(1_500_000, 2_000_000), "balanced");
assert.equal(tierFor(4_000_000, 2_000_000), "premium");

const curated = curatePackages(shelf, { budgetMillions: 15, travellers: 2, days: 3 });
assert.ok(curated.length >= 3);
assert.ok(curated.every((item) => item.reason.length > 20), "every card explains itself");
assert.ok(curated.every((item) => ["economy", "balanced", "premium"].includes(item.tier)));

// The shelf spreads vehicles instead of showing four near-identical cheapest trips.
const modesInFirstThree = new Set(curated.slice(0, 3).map((item) => item.ticket.mode));
assert.ok(modesInFirstThree.size >= 2, "the first three cards are not all the same vehicle");

// A refresh really changes the mix.
const again = curatePackages(shelf, { budgetMillions: 15, travellers: 2, days: 3, seed: 2 });
assert.notDeepEqual(curated.map((item) => item.id), again.map((item) => item.id), "a refresh shows a different mix");

// A vehicle filter only keeps that vehicle.
const planes = curatePackages(shelf, { budgetMillions: 15, travellers: 2, days: 3, mode: "plane" });
assert.ok(planes.every((item) => item.ticket.mode === "plane"));
assert.ok(planes.length >= 1);

// The summary talks about the traveller's own budget.
const summary = shelfSummary(curated, { budgetMillions: 15, travellers: 2, days: 3 });
assert.ok(/تومان/.test(summary));
const poorSummary = shelfSummary(curated, { budgetMillions: 2, travellers: 2, days: 3 });
assert.ok(/جا نمی‌شود/.test(poorSummary), "an unreachable budget is said plainly");

// An AI sentence may only repeat the numbers the card already has.
const sanitized = sanitizePackageAnswer(
  {
    items: [
      { id: "cheap-bus", why: "با ۴٬۰۰۰٬۰۰۰ تومان، ارزان‌ترین راه رسیدن به یزد است." },
      { id: "mid-train", why: "ورودی موزه ۵۰٬۰۰۰ تومان است و ساعت کاری از ۹ باز است." },
      { id: "ghost", why: "یک بستهٔ ساختگی." },
    ],
    summary: "این‌ها ارزان‌ترین ترکیب‌های موجودند.",
  },
  curated,
);
assert.equal(sanitized.source, "ai");
assert.ok(sanitized.items.find((item) => item.id === "cheap-bus")?.aiWhy);
assert.equal(sanitized.items.find((item) => item.id === "mid-train")?.aiWhy, undefined, "an invented price/hours is refused");
assert.ok(!sanitized.items.some((item) => item.id === "ghost"));

/* -------------------------------------------------------- budget robin */

const robin = robinPlan({
  budgetToman: 15_000_000,
  transportToman: 2_000_000,
  foodToman: 4_800_000,
  currentStayToman: 3_000_000,
  offers: [
    { id: "a", name: "هتل الف", typeLabel: "هتل ۳ ستاره", priceToman: 3_000_000, rating: 3.5 },
    { id: "b", name: "هتل ب", typeLabel: "هتل ۴ ستاره", priceToman: 6_000_000, rating: 4.4 },
    { id: "c", name: "هتل ج", typeLabel: "هتل ۵ ستاره", priceToman: 20_000_000, rating: 4.8 },
  ],
});
assert.ok(robin, "there is something better within the money");
assert.equal(robin.offerId, "b", "the best-rated option that still fits wins");
assert.ok(robin.priceToman <= 15_000_000 - 2_000_000 - 4_800_000, "never suggests something over the room budget");
assert.ok(robin.text.includes("تومان"));

const tight = robinPlan({
  budgetToman: 5_000_000,
  transportToman: 2_000_000,
  foodToman: 4_800_000,
  currentStayToman: 0,
  offers: [{ id: "x", name: "هتل", typeLabel: "هتل", priceToman: 9_000_000, rating: 4 }],
});
assert.equal(tight, null, "when nothing fits, nothing is suggested");

/* --------------------------------------------------------- crisis plan */

assert.equal(crisisNeeded({ code: 0, label: "صاف", rainProbability: 5, minC: 15, maxC: 25, windKmh: 10 }).needed, false);
assert.equal(crisisNeeded({ code: 63, label: "باران", rainProbability: 85, minC: 12, maxC: 18, windKmh: 20 }).needed, true);
assert.equal(crisisNeeded({ code: 0, label: "صاف", rainProbability: 0, minC: -3, maxC: 4, windKmh: 10 }).needed, true);
assert.equal(crisisNeeded(null).needed, false, "no forecast never triggers a plan B");

const crisis = buildCrisisPlan({
  stops: [
    { time: "۰۹:۰۰", title: "جنگل سراوان", type: "sightseeing", category: "پارک" },
    { time: "۱۳:۰۰", title: "ناهار", type: "food" },
    { time: "۱۶:۰۰", title: "موزهٔ میراث روستایی", type: "sightseeing", category: "موزه" },
  ],
  places: [
    { id: "m1", name: "موزهٔ میراث روستایی گیلان", category: "موزه", km: 4 },
    { id: "m2", name: "بازار رشت", category: "بازار", km: 1 },
  ],
  weather: { code: 65, label: "باران شدید", rainProbability: 90, minC: 13, maxC: 17, windKmh: 20 },
});
assert.equal(crisis.needed, true);
assert.ok(crisis.reason.includes("باران"));
assert.ok(crisis.stops[0].replaced === "جنگل سراوان");
assert.ok(crisis.stops[0].title.length > 0 && crisis.stops[0].title !== "جنگل سراوان", "the outdoor stop was swapped");
assert.equal(crisis.stops[1].title, "ناهار", "lunch is untouched");
assert.equal(crisis.stops[2].title, "موزهٔ میراث روستایی", "an indoor stop is kept as it is");
assert.ok(crisis.note.includes("سرپوشیده"));

// With nothing indoors, the app says so instead of inventing a place.
const noReplacement = buildCrisisPlan({
  stops: [{ time: "۰۹:۰۰", title: "کویر", type: "sightseeing", category: "کویر" }],
  places: [],
  weather: { code: 71, label: "برف", rainProbability: 60, minC: -2, maxC: 2, windKmh: 15 },
});
assert.equal(noReplacement.stops[0].replaced, null);
assert.deepEqual(noReplacement.unresolved, ["کویر"]);

/* ------------------------------------------------------------- ambient */

const coast = ambientFor("کیش", ["ساحلی", "شهری"]);
assert.equal(coast.id, "coast");
assert.ok(coast.colors[0].includes("56,200,255"));
assert.equal(coast.sound, "waves");
assert.equal(ambientFor("یزد", ["کویری"]).id, "desert");
assert.equal(ambientFor("رشت", ["طبیعت"]).id, "forest");
assert.equal(ambientFor("", []).id, "violet");
assert.deepEqual(Object.keys(ambientCss(coast)).sort(), ["--glow-a", "--glow-b", "--glow-c"]);

/* -------------------------------------------------------------- stories */

const scenes = storyScenes({
  destination: "یزد",
  origin: "تهران",
  days: 3,
  travellers: 2,
  totalToman: 12_000_000,
  budgetToman: 15_000_000,
  transportLabel: "قطار",
  stayName: "خانهٔ تاریخی",
  archetypeName: "کاشف تاریخ",
  topPlaces: ["باغ دولت‌آباد", "مسجد جامع", "بازار خان"],
  days_: [
    { day: 1, title: "روز ۱", stops: [{ time: "۰۹:۰۰", title: "باغ دولت‌آباد" }] },
    { day: 2, title: "روز ۲", stops: [{ time: "۰۹:۰۰", title: "مسجد جامع" }] },
  ],
});
assert.equal(scenes.length, 3);
assert.equal(scenes[0].title, "یزد");
assert.ok(scenes[1].lines[0].includes("باغ دولت‌آباد"));
assert.ok(scenes[2].lines[0].includes("تومان"), "the money scene only quotes real money");
assert.equal(storyScenes({ ...{ destination: "یزد", origin: "تهران", days: 3, travellers: 2, totalToman: 0, budgetToman: 0, transportLabel: "", stayName: "", topPlaces: [], days_: [] } })[2].lines.length, 0);

/* ------------------------------------------------- companion questions */

const facts: AskFacts = {
  origin: "تهران",
  destination: "یزد",
  days: 3,
  travellers: 2,
  children: 0,
  budgetToman: 15_000_000,
  transportToman: 2_000_000,
  transportLabel: "قطار",
  stayToman: 3_000_000,
  stayName: "خانهٔ تاریخی",
  foodToman: 4_800_000,
  remainingToman: 5_200_000,
  departureDate: "2026-11-10",
  placeNames: ["باغ دولت‌آباد", "مسجد جامع"],
  weather: [{ label: "باران", minC: 11, maxC: 17, rainProbability: 70 }],
};

const money1 = answerLocally("چقدر پول دارم؟", facts);
assert.ok(money1.includes("۱۵٬۰۰۰٬۰۰۰") || money1.includes("15") || money1.includes("۱۵"));
assert.ok(answerLocally("هوا چطوره؟", facts).includes("باران"));
assert.ok(answerLocally("کجا برم؟", facts).includes("باغ دولت‌آباد"));

// The answer may repeat real numbers, and is refused the moment it invents one.
assert.ok(keepOnlyRealNumbers("بودجه‌ات ۱۵٬۰۰۰٬۰۰۰ تومان است و ۳ روز سفر داری.", facts));
assert.equal(keepOnlyRealNumbers("هتل تو ۹٬۹۹۹٬۰۰۰ تومان می‌شود.", facts), null, "an invented price is refused");
assert.equal(keepOnlyRealNumbers("ساعت کاری موزه از ۹ صبح است.", facts), null, "an invented opening hour is refused");

console.log("Smart round tests passed.");
