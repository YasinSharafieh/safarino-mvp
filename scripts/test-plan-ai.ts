/**
 * The two AI helpers on the plan page, tested without any network call:
 * what the model may decide, and what is refused.
 */
import assert from "node:assert/strict";
import { applyAssignment } from "../lib/plan-schedule";
import {
  curatePrompt,
  guidePrompt,
  localCuration,
  localGuides,
  sanitizeCuration,
  sanitizeGuide,
  type CurateInput,
  type GuideInput,
} from "../lib/plan-ai";

const places = [
  { id: "a", name: "موزهٔ ملی", category: "موزه", km: 1.2, minutes: 8 },
  { id: "b", name: "بازار بزرگ", category: "بازار", km: 0.8, minutes: 6 },
  { id: "c", name: "پارک شهر", category: "پارک", km: 3.4, minutes: 15 },
  { id: "d", name: "مسجد جامع", category: "مسجد", km: 2.1, minutes: 10 },
];
/** The same four places shaped the way the scheduler expects them. */
const scheduled = places.map((place, index) => ({
  ...place,
  latitude: 34 + index / 100,
  longitude: 51 + index / 100,
  distanceKm: place.km,
  fromStayKm: place.km,
}));
const base: CurateInput = { destination: "کاشان", days: 2, places, taste: { moods: ["تاریخی"], words: "" } };

// 1) The prompt carries only real places and forbids invention.
const prompt = curatePrompt(base);
for (const place of places) assert.ok(prompt.includes(place.name), "every real place is offered to the model");
assert.ok(prompt.includes("بدون ساختن ساعت کار، قیمت"), "the prompt forbids inventing facts");
assert.ok(prompt.includes("فقط JSON"));

// 2) A good answer is kept exactly, with its reasons.
const good = sanitizeCuration(
  { days: [{ day: 1, stops: [{ id: "b", why: "صبح خلوت‌تر است" }, { id: "a", why: "نزدیک بازار" }] }, { day: 2, stops: [{ id: "c", why: "" }, { id: "d", why: "" }] }] },
  base,
);
assert.equal(good.source, "ai");
assert.deepEqual(good.days[0].stops.map((stop) => stop.id), ["b", "a"]);
assert.equal(good.days[0].stops[0].why, "صبح خلوت‌تر است");

// 3) An invented place is refused — the model may not add anything.
const invented = sanitizeCuration({ days: [{ day: 1, stops: [{ id: "زورگاهای-خیالی", why: "عالی" }, { id: "a", why: "" }] }] }, base);
assert.ok(!JSON.stringify(invented).includes("خیالی"), "an id that was never offered never appears");

// 4) Duplicates are removed.
const dupes = sanitizeCuration({ days: [{ day: 1, stops: [{ id: "a", why: "" }, { id: "a", why: "" }, { id: "b", why: "" }] }] }, base);
const allIds = dupes.days.flatMap((day) => day.stops.map((stop) => stop.id));
assert.equal(new Set(allIds).size, allIds.length, "no place is scheduled twice");

// 5) A chosen list survives a model answer that "forgets" places.
const forgetful = sanitizeCuration(
  { days: [{ day: 1, stops: [{ id: "a", why: "" }, { id: "b", why: "" }, { id: "c", why: "" }] }] },
  { ...base, mustIncludeAll: true },
);
const kept = forgetful.days.flatMap((day) => day.stops.map((stop) => stop.id));
assert.equal(kept.length, places.length, "every chosen place is still scheduled");
assert.ok(kept.includes("d"));

// 6) Nothing usable from the model → local order, never an empty plan.
for (const raw of [null, {}, { days: [] }, { days: [{ day: 1, stops: "nope" }] }]) {
  const fallback = sanitizeCuration(raw, base);
  assert.equal(fallback.source, "local");
  assert.ok(fallback.days.flatMap((day) => day.stops).length >= 2);
}
assert.equal(localCuration(base).days.length, 2, "the local plan spreads over the booked days");

// 7) The assignment is obeyed, and nothing is lost on the way.
const grouped = applyAssignment(scheduled, [["d", "c"], ["a", "b"]], 2);
assert.deepEqual(grouped[0].map((place) => place.id), ["d", "c"]);
assert.deepEqual(grouped[1].map((place) => place.id), ["a", "b"]);
const partial = applyAssignment(scheduled, [["a"]], 2);
assert.equal(partial.flat().length, places.length, "a forgotten place is added, not dropped");

// 8) Day guides: only the places that day, and no invented prices or hours.
const guideInput: GuideInput = {
  destination: "کاشان",
  days: [
    { day: 1, stops: [{ time: "09:00", title: "بازار بزرگ", kind: "sightseeing" }, { time: "13:00", title: "ناهار", kind: "food" }] },
    { day: 2, stops: [{ time: "09:30", title: "باغ فین", kind: "sightseeing" }] },
  ],
};
const guidePromptText = guidePrompt(guideInput);
assert.ok(guidePromptText.includes("بازار بزرگ") && guidePromptText.includes("باغ فین"));
assert.ok(guidePromptText.includes("هیچ قیمت"));

const guides = sanitizeGuide(
  {
    guides: [
      { day: 1, text: "روز اول را با بازار شروع کنید؛ صبح‌ها خلوتی بیشتری دارد.", tip: "پول خرد همراه داشته باشید." },
      { day: 2, text: "ورودی باغ ۲۰۰۰۰ تومان است و ساعت کاری از ۸ باز است.", tip: "زود بروید." },
    ],
  },
  guideInput,
);
assert.equal(guides.source, "ai");
assert.ok(guides.guides[0].text.includes("بازار"));
// The second paragraph invents a price → refused, replaced by the local one.
assert.ok(!guides.guides[1].text.includes("تومان"), "a price the model cannot know is refused");
assert.ok(guides.guides[1].text.length > 0);

// 9) No answer at all still writes a real guide for every day.
const local = sanitizeGuide(null, guideInput);
assert.equal(local.source, "local");
assert.equal(local.guides.length, 2);
assert.ok(local.guides[0].text.includes("بازار بزرگ"));
assert.ok(localGuides(guideInput).guides.every((entry) => entry.tip.length > 0));

console.log("Plan AI curation and guide tests passed.");
