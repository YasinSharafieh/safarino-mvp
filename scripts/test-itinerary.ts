/**
 * The day-by-day plan must be geographically sensible, ordered sanely, and
 * must never invent a place. These checks lock that in.
 */
import { buildItinerary, distanceKm, rescheduleDay, visitMinutes } from "../lib/itinerary";
import { drawDayMap } from "../lib/day-map";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const stay = { latitude: 36.2933, longitude: 59.6274 };
const places = [
  { id: "haram", name: "حرم امام رضا", category: "زیارتی و مسجد", latitude: 36.2878, longitude: 59.6153, wikipediaUrl: "x" },
  { id: "goharshad", name: "مسجد گوهرشاد", category: "زیارتی و مسجد", latitude: 36.2879, longitude: 59.6156 },
  { id: "nader", name: "آرامگاه نادرشاه", category: "آرامگاه و مقبره", latitude: 36.2965, longitude: 59.6177 },
  { id: "bazaar", name: "بازار رضا", category: "بازار", latitude: 36.2882, longitude: 59.6116 },
  { id: "museum", name: "موزهٔ آستان قدس", category: "موزه", latitude: 36.2886, longitude: 59.6159 },
  { id: "far", name: "بوستان ملت", category: "پارک و بوستان", latitude: 36.3350, longitude: 59.5300 },
  { id: "farther", name: "کوهسنگی", category: "پارک و بوستان", latitude: 36.2730, longitude: 59.5300 },
];

console.log("Splitting days");
const plan = buildItinerary(places, { days: 2, stopsPerDay: 4, origin: stay });
check("two days were built", plan.days.length === 2, `${plan.days.length}`);
check("no place is used twice", new Set(plan.days.flatMap((day) => day.stops.map((stop) => stop.place.id))).size === plan.days.flatMap((day) => day.stops.length > 0 ? day.stops.map((stop) => stop.place.id) : []).length);
check("no day is overloaded", plan.days.every((day) => day.stops.length <= 4));
const counts = plan.days.map((day) => day.stops.length);
check("days are balanced, not one heavy and one empty", Math.max(...counts) - Math.min(...counts) <= 1, counts.join(" / "));
check("every stop keeps its real coordinates", plan.days.flatMap((day) => day.stops).every((stop) => stop.place.latitude !== 0));
check("nothing was invented", plan.days.flatMap((day) => day.stops).every((stop) => places.some((place) => place.id === stop.place.id)));

console.log("Geography: a day should stay in one part of town");
const daySpread = (dayIndex: number) => {
  const stops = plan.days[dayIndex].stops;
  let worst = 0;
  stops.forEach((a) => stops.forEach((b) => { worst = Math.max(worst, distanceKm(a.place, b.place)); }));
  return worst;
};
check("stops of one day are mostly close together", Math.min(daySpread(0), daySpread(1)) < 4, `${daySpread(0).toFixed(1)} / ${daySpread(1).toFixed(1)} km`);

console.log("Ordering: each next stop is the nearest remaining one");
plan.days.forEach((day) => {
  let previous: { latitude: number; longitude: number } = stay;
  let nearestEachTime = true;
  const remaining = [...day.stops];
  day.stops.forEach((stop) => {
    const leg = distanceKm(previous, stop.place);
    const bestPossible = Math.min(...remaining.map((candidate) => distanceKm(previous, candidate.place)));
    if (leg > bestPossible + 0.05) nearestEachTime = false;
    const index = remaining.findIndex((candidate) => candidate.place.id === stop.place.id);
    if (index >= 0) remaining.splice(index, 1);
    previous = stop.place;
  });
  check(`day ${day.day} takes the nearest next stop`, nearestEachTime);
});

console.log("Visit time by kind of place");
check("a museum gets more time than a shrine", visitMinutes("موزه") > visitMinutes("زیارتی و مسجد"));
check("a bridge gets little time", visitMinutes("پل") <= 30);

console.log("Clock after real driving times are known");
const withLegs = rescheduleDay({
  ...plan.days[0],
  stops: plan.days[0].stops.map((stop, index) => ({ ...stop, legKm: 2, legMinutes: index === 0 ? 10 : 6 })),
});
check("day total sums the legs", withLegs.totalKm === plan.days[0].stops.length * 2, `${withLegs.totalKm}`);
check("times are Persian digits", /^[۰-۹]{2}:[۰-۹]{2}$/.test(withLegs.stops[0].startTime), withLegs.stops[0].startTime);
check("later stops start later", withLegs.stops.every((stop, index) => index === 0 || stop.startTime > withLegs.stops[index - 1].startTime));

console.log("Empty and broken input");
check("no places means no fake plan", buildItinerary([], { days: 3 }).days.length === 0);
check("useless coordinates are dropped", buildItinerary([{ id: "x", name: "جای نامعلوم", category: "جاذبه", latitude: 0, longitude: 0 }], { days: 1 }).days.length === 0);

console.log("Day map drawing");
const map = drawDayMap(plan.days[0].stops.map((stop, index) => ({ latitude: stop.place.latitude, longitude: stop.place.longitude, label: `${index + 1} ${stop.place.name}` })), { title: "روز ۱" });
check("map is drawn", Boolean(map && map.svg.startsWith("<svg")));
check("map shows every stop", Boolean(map && (map.svg.match(/<circle/g) || []).length === plan.days[0].stops.length));
check("map contains a scale bar and north arrow", Boolean(map && map.svg.includes("کیلومتر") && map.svg.includes("شمال")));
check("no map without coordinates", drawDayMap([]) === null);

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nItinerary tests passed.");
