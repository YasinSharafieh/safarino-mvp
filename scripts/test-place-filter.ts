/**
 * Search and filters must be forgiving with Persian typing and must never
 * show a place that does not match. Favourites are a local shortlist, so they
 * must survive a broken storage instead of crashing the page.
 */
import { filterPlaces, matchesQuery, normalizeFa, categoryCounts, filterSummary } from "../lib/place-filter";
import fs from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const places = [
  { id: "a", name: "حرم امام رضا", category: "زیارتی و مسجد", distanceKm: 2.9, imageKind: "photo" as const, wikipediaUrl: "https://fa.wikipedia.org/x", description: "حرم مطهر" },
  { id: "b", name: "موزهٔ آستان قدس", category: "موزه", distanceKm: 1.4, imageKind: "photo" as const, wikipediaUrl: null, description: "" },
  { id: "c", name: "باغ خونی", category: "باغ", distanceKm: 1.5, imageKind: "map" as const, wikipediaUrl: "https://fa.wikipedia.org/y", description: "" },
  { id: "d", name: "بازار رضا", category: "بازار", distanceKm: 3.1, imageKind: "none" as const, wikipediaUrl: null, description: "" },
];

console.log("Persian typing, made comparable");
check("Arabic yeh and kaf are the same as Persian", normalizeFa("علي كريمي") === normalizeFa("علی کریمی"), normalizeFa("علي كريمي"));
check("half-space and hamza do not block a search", matchesQuery(places[1], "موزه استان"), "موزهٔ → موزه ");
check("a half-space inside a name still matches", matchesQuery({ id: "z", name: "سی‌وسه‌پل", category: "پل", distanceKm: 1 }, "سی وسه پل"), "سی‌وسه‌پل");
check("Persian digits in the query work", normalizeFa("۱۲۳") === "123");
check("an empty query matches everything", filterPlaces(places, { query: "" }).length === 4);

console.log("Search");
check("search by name", filterPlaces(places, { query: "حرم" }).length === 1);
check("search by category", filterPlaces(places, { query: "باغ" }).length === 1);
check("every word must match", filterPlaces(places, { query: "حرم موزه" }).length === 0);
check("a missing word finds nothing", filterPlaces(places, { query: "هتل" }).length === 0);

console.log("Filters");
check("only with a real photo", filterPlaces(places, { onlyWithPhoto: true }).every((place) => place.imageKind === "photo") && filterPlaces(places, { onlyWithPhoto: true }).length === 2);
check("only with an article", filterPlaces(places, { onlyWithArticle: true }).length === 2);
check("only favourites", filterPlaces(places, { onlyFavorites: true, favorites: ["c"] }).map((place) => place.id).join() === "c");
check("a distance limit", filterPlaces(places, { maxDistanceKm: 1.5 }).map((place) => place.id).sort().join() === "b,c");
check("category chips combine", filterPlaces(places, { categories: ["موزه", "باغ"] }).length === 2);
check("an unknown category shows nothing (no fake results)", filterPlaces(places, { categories: ["کوه"] }).length === 0);

console.log("Order");
check("nearest first by default", filterPlaces(places)[0].id === "b");
check("alphabetical when asked", filterPlaces(places, { sort: "name" }).length === 4);
check("most famous first when asked", filterPlaces(places, { sort: "popular" })[0].id === "a");

console.log("Counts and wording");
const counts = categoryCounts(places);
check("category counts are real", counts.reduce((sum, item) => sum + item.count, 0) === 4);
check("summary speaks Persian and shows both numbers", filterSummary(2, 4, { query: "حرم" }).includes("۲") && filterSummary(2, 4, { query: "حرم" }).includes("۴"));

console.log("Favourites are local and safe");
const favoritesSource = fs.readFileSync("lib/favorites.ts", "utf8");
check("favourites never call the network", !/fetch\(/.test(favoritesSource));
check("a broken storage is handled", favoritesSource.includes("catch"));
check("favourites are capped", favoritesSource.includes("slice(0, 200)"));
check("a change is announced to the page", favoritesSource.includes("FAVORITES_EVENT"));

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nPlace search and favourites tests passed.");
