/**
 * «کشف» is the public front door: the city advice is ours, but every
 * attraction must still come from a real source, and every city page must be
 * a real, indexable page.
 */
import fs from "node:fs";
import { DISCOVER_CITIES, DISCOVER_MOODS, filterCities, findCity } from "../lib/discover";
import { cityCoordinate } from "../lib/poi-search";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

console.log("The city advice is complete and consistent");
check("there are enough cities to browse", DISCOVER_CITIES.length >= 10, String(DISCOVER_CITIES.length));
check("every city has a province", DISCOVER_CITIES.every((city) => city.province.trim().length > 1));
check("every city has a tagline", DISCOVER_CITIES.every((city) => city.tagline.length > 10));
check("every city has real reasons", DISCOVER_CITIES.every((city) => city.highlights.length >= 2));
check("every city says who it suits", DISCOVER_CITIES.every((city) => city.bestFor.length >= 1));
check("every city has a season", DISCOVER_CITIES.every((city) => city.bestSeason.length > 5));
check("suggested days are sane", DISCOVER_CITIES.every((city) => city.suggestedDays >= 1 && city.suggestedDays <= 7));
check("moods come from the known list", DISCOVER_CITIES.every((city) => city.moods.length > 0 && city.moods.every((mood) => DISCOVER_MOODS.includes(mood))));
const names = DISCOVER_CITIES.map((city) => city.name);
check("no duplicate cities", new Set(names).size === names.length);
check("every mood is used by some city", DISCOVER_MOODS.every((mood) => DISCOVER_CITIES.some((city) => city.moods.includes(mood))));

console.log("Every recommended city really has coordinates");
const missing = DISCOVER_CITIES.filter((city) => {
  const point = cityCoordinate(city.name);
  return !point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || point.latitude === 0;
});
check("all cities are found by the same coordinate source as the rest of the site", missing.length === 0, missing.map((city) => city.name).join(", ") || "none");

console.log("Looking a city up");
check("a known city is found", findCity("مشهد")?.province === "خراسان رضوی");
check("an unknown city gives nothing", findCity("آتلانتیس") === null && findCity("") === null && findCity(null) === null);
check("spaces are tolerated", findCity("  شیراز  ")?.name === "شیراز");

console.log("Filtering the grid");
check("no filter shows everything", filterCities(DISCOVER_CITIES, {}).length === DISCOVER_CITIES.length);
check("a mood filters", filterCities(DISCOVER_CITIES, { mood: "ساحلی" }).every((city) => city.moods.includes("ساحلی")));
check("a mood really narrows", filterCities(DISCOVER_CITIES, { mood: "ساحلی" }).length < DISCOVER_CITIES.length);
check("the Persian yeh and kaf are forgiven", filterCities(DISCOVER_CITIES, { query: "كيش" }).length === 1);
check("a province can be searched", filterCities(DISCOVER_CITIES, { query: "هرمزگان" }).length >= 2);
check("nonsense finds nothing", filterCities(DISCOVER_CITIES, { query: "قطب شمال" }).length === 0);
check("query and mood combine", filterCities(DISCOVER_CITIES, { query: "جزیره", mood: "ساحلی" }).length <= 2);

console.log("The pages exist and are honest");
const list = fs.readFileSync("app/discover/page.tsx", "utf8");
const detail = fs.readFileSync("app/discover/[city]/page.tsx", "utf8");
const attractions = fs.readFileSync("components/CityAttractions.tsx", "utf8");
const mapRoute = fs.readFileSync("app/api/discover/map/route.ts", "utf8");
const grid = fs.readFileSync("components/DiscoverGrid.tsx", "utf8");
check("the list page has its own title and canonical address", list.includes('canonical: "/discover"'));
check("the list page is readable by search engines", list.includes("ItemList"));
check("every city gets a page", detail.includes("generateStaticParams"));
check(
  "the static paths are plain names, not encoded twice",
  /return DISCOVER_CITIES\.map\(\(city\) => \(\{ city: city\.name \}\)\)/.test(detail),
  "Next encodes the segment itself",
);
check("a city name is read whether or not it arrives encoded", detail.includes("cityFromParam"));
check("each city page has its own metadata", detail.includes("generateMetadata") && detail.includes("canonical"));
check("each city page describes the destination for search engines", detail.includes("TouristDestination"));
check("the city page says whose advice it is", detail.includes("پیشنهاد سفرینو"));
check("attractions come from the shared provider route", attractions.includes('fetch("/api/providers/pois/search"'));
check("attractions are never typed by hand", !attractions.includes("const places = [") && !detail.includes("حرم امام رضا"));
check("an empty city says so instead of inventing places", attractions.includes("هیچ مکانی از خودمان نمی‌سازیم"));
check("search and filters are reused, not rewritten", attractions.includes("PlaceToolbar") && attractions.includes("filterPlaces"));
check("the city page leads into building a plan", attractions.includes("/itinerary?city="));
check("the card picture is a real map, not a stock photo", grid.includes("/api/discover/map?city=") && grid.includes("نقشهٔ واقعی"));
check("the map route refuses unknown cities", mapRoute.includes("404"));
check("the map route never puts the key in the browser", !mapRoute.includes("Api-Key") && !mapRoute.includes("neshanApiKey"));
check("the map route uses the site's own picture proxy", mapRoute.includes("/api/neshan/static"));
const sitemap = fs.readFileSync("app/sitemap.ts", "utf8");
const robots = fs.readFileSync("app/robots.ts", "utf8");
check("discover is in the sitemap", sitemap.includes('"/discover"'));
check("discover is allowed for search engines", robots.includes('"/discover"'));
const home = fs.readFileSync("app/page.tsx", "utf8");
check("the home page links to it", home.includes('href: "/discover"'));

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nDiscover tests passed.");
