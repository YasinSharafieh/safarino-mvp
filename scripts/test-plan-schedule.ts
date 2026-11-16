/**
 * «برنامه از انتخاب‌های من» — the schedule must obey the traveller, not a percentage.
 */
import assert from "node:assert/strict";
import { distributePlaces, slotDays, tastePlaces, tasteProfile, type SchedulePlace } from "../lib/plan-schedule";

const place = (id: string, name: string, category: string, km: number, minutes: number | null = null): SchedulePlace => ({
  id,
  name,
  category,
  latitude: 0,
  longitude: 0,
  distanceKm: km,
  fromStayKm: km,
  fromStayMinutes: minutes,
  wikipediaUrl: null,
  sourceUrl: `https://fa.wikipedia.org/wiki/${encodeURIComponent(name)}`,
});

const picks = [
  place("a", "موزهٔ ملی", "موزه", 1.2, 8),
  place("b", "بازار بزرگ", "بازار", 0.8, 6),
  place("c", "پارک شهر", "پارک", 3.4, 15),
  place("d", "مسجد جامع", "مسجد", 2.1, 10),
  place("e", "قلعهٔ قدیم", "قلعه", 6.5, 22),
  place("f", "باغ فین", "باغ", 8.2, 25),
  place("g", "حرم مطهر", "زیارتگاه", 4.4, 18),
  place("h", "کاروانسرای عباسی", "کاروانسرا", 9.9, 30),
];

// 1) Every chosen place is scheduled — no silent dropping, even on a short trip.
const twoDays = slotDays({ destination: "کاشان", days: 2, places: picks, arrivalTime: "09:15", respectAll: true, maxPerDay: picks.length });
const scheduled = twoDays.flatMap((day) => day.items.filter((item) => item.poiId).map((item) => item.poiId));
assert.equal(scheduled.length, picks.length, "all eight chosen places appear");
assert.equal(new Set(scheduled).size, picks.length, "no place appears twice");
assert.equal(twoDays.length, 2, "two days, as booked");

// 2) A day starts when the ticket says, and the first visit follows the arrival.
const first = twoDays[0].items;
assert.match(first[0].time, /^09:15$/, "day one starts at the ticket's arrival time");
assert.ok(first.some((item) => item.title === "رسیدن به اقامتگاه"), "the transfer to the stay is in the plan");

// 3) Lunch and dinner happen where a person expects them.
const allTimes = twoDays.flatMap((day) => day.items);
const lunch = allTimes.filter((item) => /ناهار/.test(item.title));
const dinner = allTimes.filter((item) => /شام/.test(item.title));
assert.equal(lunch.length, 2, "one lunch a day");
assert.equal(dinner.length, 2, "one dinner a day");
for (const item of dinner) assert.ok(item.time >= "20:30", `dinner never before 20:30 (was ${item.time})`);

// 4) Items are in clock order inside a day.
for (const day of twoDays) {
  const times = day.items.map((item) => item.time);
  assert.deepEqual(times, [...times].sort(), "a day reads top to bottom");
}

// 5) An even spread: with 8 places over 2 days nobody gets an empty day.
const buckets = distributePlaces(picks, 2, true);
assert.equal(buckets[0].length, 4);
assert.equal(buckets[1].length, 4);
// …and the first day gets the closest one, because that is the least driving.
assert.equal(buckets.flat()[0].id, "b", "nearest to the stay comes first");

// 6) Without a chosen list, the automatic day stops at three stops.
const automatic = slotDays({ destination: "کاشان", days: 1, places: picks, arrivalTime: null });
assert.ok(automatic[0].items.filter((item) => item.poiId).length <= 3, "an automatic day is not packed");

// 7) The taste suggestion prefers what the traveller said they like.
const history = tastePlaces(picks, tasteProfile({ moods: ["تاریخی"] }), { days: 1, maxPerDay: 3 });
assert.ok(history.length === 3);
assert.ok(
  history.every((item) => /موزه|قلعه|بازار|کاروانسرا|مسجد/.test(`${item.category} ${item.name}`)),
  `history lovers get historic places, got ${history.map((item) => item.name).join("، ")}`,
);

const nature = tastePlaces(picks, tasteProfile({ moods: ["طبیعت"] }), { days: 1, maxPerDay: 2 });
assert.ok(nature.every((item) => /پارک|باغ/.test(`${item.category} ${item.name}`)), "nature lovers get parks and gardens");

// 8) No taste and no words still yields a sane, varied list — never an invented one.
const plain = tastePlaces(picks, tasteProfile({}), { days: 2, maxPerDay: 3 });
assert.ok(plain.length === 6, "six stops for two days");
assert.ok(plain.every((item) => picks.includes(item)));
const families = plain.map((item) => item.category);
assert.ok(new Set(families).size >= 3, "the plain suggestion is varied, not six of a kind");

// 9) Two days of taste suggestions do not repeat a place.
const spread = tastePlaces(picks, tasteProfile({ moods: ["تاریخی", "طبیعت"] }), { days: 2, maxPerDay: 3 });
assert.equal(new Set(spread.map((item) => item.id)).size, spread.length);

console.log("Plan schedule and taste suggestion tests passed.");
