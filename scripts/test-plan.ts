import assert from "node:assert/strict";
import { assembleItinerary, sanitizePois, synchronizeBudget, type PlanPoi } from "../lib/plan-itinerary";

const pois: PlanPoi[] = [
  { id: "wikipedia:1", name: "میدان نقش جهان", category: "بنای تاریخی", latitude: 32.6575, longitude: 51.6776, distanceKm: 1.2, sourceUrl: "https://fa.wikipedia.org/wiki/میدان_نقش_جهان", wikipediaUrl: "https://fa.wikipedia.org/wiki/میدان_نقش_جهان" },
  { id: "wikidata:Q2", name: "چهل‌ستون", category: "بنای تاریخی", latitude: 32.6573, longitude: 51.6719, distanceKm: 0.7, sourceUrl: "https://www.wikidata.org/wiki/Q2" },
  { id: "osm:node/3", name: "سی‌وسه‌پل", category: "بنای تاریخی", latitude: 32.6447, longitude: 51.6647, distanceKm: 1, sourceUrl: "https://www.openstreetmap.org/node/3" },
  { id: "wikidata:Q4", name: "باغ ارم", category: "باغ", latitude: 29.6396, longitude: 52.5253, distanceKm: 7.5, wikipediaUrl: "https://fa.wikipedia.org/wiki/باغ_ارم" },
];

const draft = [
  {
    day: 1,
    title: "روز اول",
    items: [
      { time: "۰۹:۰۰", title: "بازدید از میدان نقش جهان", description: "گشت صبحگاهی", type: "sightseeing" as const, poiId: "wikipedia:1" },
      { time: "۱۱:۰۰", title: "موزهٔ ساختگی", description: "جاذبه‌ای که وجود ندارد", type: "sightseeing" as const, poiId: "invented:99" },
      { time: "۱۳:۰۰", title: "ناهار", description: "غذای محلی", type: "food" as const },
    ],
  },
  { day: 2, title: "روز دوم", items: [{ time: "۱۰:۰۰", title: "استراحت", description: "استراحت", type: "rest" as const }] },
];

const result = assembleItinerary(draft, pois, 2);
assert.equal(result.droppedStops, 1, "an invented attraction must be dropped");
assert.equal(result.days[0].items.filter((item) => item.type === "sightseeing").length, 1);
assert.equal(result.days[0].items.find((item) => item.type === "sightseeing")?.poiId, "wikipedia:1");
const day2Stops = result.days[1].items.filter((item) => item.type === "sightseeing");
assert.ok(day2Stops.length >= 1, "a day without real stops is filled from the real POI list");
for (const stop of day2Stops) {
  assert.ok(pois.some((poi) => poi.id === stop.poiId), "filled stops must come from the offered POIs");
  assert.ok(stop.poiSourceUrl, "every filled stop carries a public source link");
}
const dayOneTimes = result.days[0].items.map((item) => item.time);
assert.deepEqual(dayOneTimes, [...dayOneTimes].sort((a, b) => a.localeCompare(b, "fa")), "items stay in time order");
assert.equal(new Set(result.days.flatMap((day) => day.items.filter((i) => i.poiId).map((i) => i.poiId))).size, result.usedPois, "no POI is shown twice");

const budget = synchronizeBudget({ totalBudget: 20_000_000, transportCost: 3_000_000, accommodationCost: 6_000_000, aiFood: 5_000_000, aiActivities: 4_000_000 });
assert.equal(budget.transport, 3_000_000);
assert.equal(budget.accommodation, 6_000_000);
assert.equal(budget.food + budget.activities + budget.remaining, 20_000_000 - 9_000_000);
assert.ok(budget.food >= Math.round((20_000_000 - 9_000_000) * 0.15) - 1, "food stays realistic");
assert.ok(budget.food + budget.activities <= 11_000_000, "food and activities never exceed the free budget");

const skipped = synchronizeBudget({ totalBudget: 10_000_000, transportCost: 2_000_000, accommodationCost: 0, aiFood: 3_000_000, aiActivities: 1_000_000 });
assert.equal(skipped.accommodation, 0, "a skipped accommodation adds no cost");
assert.equal(skipped.food + skipped.activities + skipped.remaining + skipped.transport, 10_000_000);

const dirty = sanitizePois([
  { id: "a", name: "جاذبه", category: "موزه", latitude: 1, longitude: 2, sourceUrl: "javascript:alert(1)" },
  { id: "a", name: "تکراری", latitude: 1, longitude: 2 },
  { id: "", name: "بدون شناسه", latitude: 1, longitude: 2 },
  "not-an-object",
]);
assert.equal(dirty.length, 1);
assert.equal(dirty[0].sourceUrl, undefined, "unsafe links are rejected");

console.log("Plan itinerary validation and budget synchronization tests passed.");
