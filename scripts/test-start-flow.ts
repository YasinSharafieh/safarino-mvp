/**
 * Checks for the first page and the start flow (step 21).
 *
 * The rules under test are the promises the start flow makes to the traveller:
 * every origin and destination is an Iranian city, the quiz never repeats the
 * same questions, its suggestions are Iranian and always have a reason, and the
 * review form refuses anything that is not a real, clean, Iran-only review.
 */

let failures = 0;
function assert(ok: boolean, label: string, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}
function assertEqual<T>(actual: T, expected: T, label: string) {
  assert(actual === expected, label, actual === expected ? "" : `دریافت ${String(actual)} به‌جای ${String(expected)}`);
}
import {
  QUESTION_POOL,
  budgetFromDaily,
  drawQuestions,
  iranianTravelCities,
  isIranianTravelCity,
  scoreAnswers,
  suggestCities,
} from "../lib/start-flow";
import { DISCOVER_CITIES } from "../lib/discover";
import { cleanReviewText, parseReviewInput, validRating } from "../lib/reviews";
import { resolveIranianCity } from "../lib/iran-cities";
import { readFileSync } from "node:fs";
import { todaysPackageDestinations } from "../lib/trip-packages";
import { describeTrip } from "../lib/start-flow";
import { parseTripLink } from "../lib/link-prefill";

const FOREIGN = ["استانبول", "دبی", "آنتالیا", "کاپادوکیه", "کیش ", "ترکیه", "امارات"];
const cityNames = iranianTravelCities();

assert(cityNames.length >= 100, `the Iranian city list has ${cityNames.length} cities`);
assertEqual(new Set(cityNames.map((city) => city.name)).size, cityNames.length, "city names are unique");
for (const city of cityNames) {
  assert(city.name.length >= 2, `a city name is not empty (${city.name})`);
  assert(typeof city.code === "string" && city.code.length > 0, `every city has a provider code (${city.name})`);
  assert(!FOREIGN.includes(city.name), `no foreign city in the list (${city.name})`);
}
assert(isIranianTravelCity("تهران"), "تهران is a travel city");
assert(isIranianTravelCity("شیراز"), "شیراز is a travel city");
assert(!isIranianTravelCity("استانبول"), "استانبول is not a travel city");
assert(!isIranianTravelCity(""), "an empty name is not a travel city");

assertEqual(resolveIranianCity(""), undefined, "an empty city value resolves to nothing");
assertEqual(resolveIranianCity("   "), undefined, "a blank city value resolves to nothing");
assertEqual(resolveIranianCity("تهران")?.name, "تهران", "a Persian city name resolves");
assertEqual(resolveIranianCity("THR")?.name, "تهران", "an airport code resolves");

/* ------------------------------------------------------------ the quiz */

assert(QUESTION_POOL.length >= 8, "the question pool is large enough to vary");
for (const question of QUESTION_POOL) {
  assertEqual(question.options.length, 4, `question «${question.prompt}» has four options`);
  assert(question.prompt.length > 8, "every question has a real prompt");
  assert(question.aside.length > 5, "every question has an aside");
  const ids = question.options.map((option) => option.id);
  assertEqual(new Set(ids).size, 4, `option ids are unique in «${question.key}»`);
  for (const option of question.options) {
    assert(Object.keys(option.weights).length > 0, `option ${option.id} moves the taste somewhere`);
  }
}

const drawn = drawQuestions(() => 0.42, 4);
assert(drawn.length >= 3 && drawn.length <= 5, "a round draws three to five questions");
assertEqual(new Set(drawn.map((question) => question.key)).size, drawn.length, "a round never repeats a topic");
for (const question of drawn) assertEqual(question.options.length, 4, "drawn questions keep four options");

// Two rounds must not be identical: the whole point of the pool.
let identicalRounds = 0;
for (let round = 0; round < 40; round += 1) {
  const a = drawQuestions(Math.random, 4).map((question) => question.key).join("|");
  const b = drawQuestions(Math.random, 4).map((question) => question.key).join("|");
  if (a === b) identicalRounds += 1;
}
assert(identicalRounds < 40, "drawing twice can produce a different set");

/* --------------------------------------------------------- suggestions */

const discoverNames = new Set(DISCOVER_CITIES.map((city) => city.name));
assert(discoverNames.size > 5, "the discover list has real cities");

let suggestionsSeen = 0;
for (let run = 0; run < 25; run += 1) {
  const questions = drawQuestions(Math.random, 4);
  const answers: Record<string, string> = {};
  for (const question of questions) {
    answers[question.key] = question.options[Math.floor(Math.random() * question.options.length)].id;
  }
  const result = scoreAnswers(questions, answers);
  assert(result.headline.length > 2, "every result has a headline");
  assert(result.summary.includes("پیشنهاد") || result.summary.length > 10, "every result explains itself");

  const suggestions = suggestCities(result, { limit: 4 });
  assert(suggestions.length > 0, "a complete answer produces suggestions");
  assert(suggestions.length <= 4, "no more than four suggestions");
  for (const suggestion of suggestions) {
    assert(discoverNames.has(suggestion.name), `${suggestion.name} is a city Safarino can plan`);
    assert(isIranianTravelCity(suggestion.name), `${suggestion.name} is an Iranian travel city`);
    assert(suggestion.reason.length > 5, "every suggestion says why");
    assert(suggestion.days >= 1 && suggestion.days <= 14, "a suggestion has a sane number of days");
  }
  assertEqual(new Set(suggestions.map((item) => item.name)).size, suggestions.length, "suggestions are unique");
  suggestionsSeen += suggestions.length;
}
assert(suggestionsSeen > 0, "suggestions were produced across random runs");

const excluded = suggestCities(scoreAnswers(drawQuestions(() => 0.3, 4), {}), { limit: 6, exclude: ["یزد"] });
assert(!excluded.some((item) => item.name === "یزد"), "an excluded city is never suggested");

/* -------------------------------------------------------------- budget */

assertEqual(budgetFromDaily(800_000, 3, 2), 5, "800k per day, 3 days, 2 people = 5 million");
assertEqual(budgetFromDaily(1_500_000, 4, 1), 6, "1.5m per day, 4 days, 1 person = 6 million");
assertEqual(budgetFromDaily(null, 3, 2), null, "no daily budget means no guess");
assertEqual(budgetFromDaily(800_000, null, 2), null, "no days means no guess");
assert((budgetFromDaily(100_000, 1, 1) ?? 0) >= 3, "the whole-trip budget never drops below the floor");

/* -------------------------------------------------------------- reviews */

assertEqual(cleanReviewText("<b>عالی</b> بود"), "عالی بود", "markup is stripped");
assertEqual(cleanReviewText("به https://spam.example زنگ بزن"), "به زنگ بزن", "links are stripped");
assertEqual(cleanReviewText("ایمیل من a@b.com است"), "ایمیل من است", "e-mail addresses are stripped");
assertEqual(cleanReviewText("شماره ۰۹۱۲۱۲۳۴۵۶۷ را بگیر"), "شماره را بگیر", "phone numbers are stripped");
assertEqual(validRating(3), 3, "3 is a rating");
assertEqual(validRating(0), null, "0 is not a rating");
assertEqual(validRating(6), null, "6 is not a rating");
assertEqual(validRating("4"), 4, "a numeric string is a rating");

const ok = parseReviewInput({ name: "سارا", city: "شیراز", rating: 5, text: "سفر خیلی خوبی بود، اقامتگاه تمیز و نزدیک بود." });
assert(ok.ok, "a proper review is accepted");
if (ok.ok) {
  assertEqual(ok.review.city, "شیراز", "the review keeps its Iranian city");
  assertEqual(ok.review.name, "سارا", "the review keeps its display name");
}
const noName = parseReviewInput({ city: "یزد", rating: 4, text: "کوچه‌های خشتی و آسمان شب واقعاً دیدنی بود." });
assert(noName.ok && noName.review.name === "مسافر سفرینو", "a review without a name stays anonymous");
const foreignCity = parseReviewInput({ city: "استانبول", rating: 5, text: "سفر خیلی خوبی بود و همه‌چیز مرتب بود." });
assert(!foreignCity.ok, "a review about a foreign city is refused");
const shortText = parseReviewInput({ city: "یزد", rating: 4, text: "خوب" });
assert(!shortText.ok, "a one-word review is refused");
const noRating = parseReviewInput({ city: "یزد", text: "سفر خوبی بود و همه‌چیز مرتب بود." });
assert(!noRating.ok, "a review without a rating is refused");
const tooLong = parseReviewInput({ city: "یزد", rating: 4, text: "ا".repeat(900) });
assert(!tooLong.ok, "an over-long review is refused");

/* ------------------------------------------------------------- packages */

// Provider photos must go through the site's proxy: the CDNs refuse hot links.
const packagesSource = readFileSync("lib/trip-packages.ts", "utf8");
assert(packagesSource.includes("/api/provider-assets?src="), "package photos go through the image proxy");
assert(!/photo:\s*(offer|stay)\.imageUrl\b/.test(packagesSource), "no package photo is linked to the provider directly");
assert(packagesSource.includes("searchTransport("), "a package price comes from the real ticket search");
assert(packagesSource.includes("searchMultiProviderAccommodation("), "a package price comes from the real hotel search");

const today = todaysPackageDestinations("تهران", 4);
assertEqual(today.length, 4, "four destinations are featured every day");
assert(today.every((entry) => entry.city !== "تهران"), "the traveller's own city is never a destination");
for (const entry of today) {
  assert(isIranianTravelCity(entry.city), `${entry.city} is an Iranian city`);
  assert(["train", "plane", "bus"].includes(entry.mode), "a package has a real ticket mode");
  assert(entry.days >= 2 && entry.days <= 5, "a package is 2 to 5 days");
}
assertEqual(new Set(today.map((entry) => entry.city)).size, today.length, "no destination is repeated");
const tomorrow = todaysPackageDestinations("تهران", 4, new Date(Date.now() + 86_400_000));
assert(tomorrow[0].city !== today[0].city, "the featured destinations change tomorrow");

/* ------------------------------------------------------- free-text door */

const seaTrip = describeTrip("دلم می‌خواهد ۴ روز کنار دریا باشم و شب‌ها کافه برویم، حدود ۲۰ میلیون");
assert(seaTrip !== null, "a description with real words produces a result");
assert(seaTrip!.result.moods.some((entry) => entry.mood === "ساحلی"), "«دریا» is read as a seaside taste");
assert(seaTrip!.result.days === 4, "the number of days is read from the sentence");
assert(seaTrip!.result.summary.includes("۲۰"), "the budget is repeated back to the traveller");
assert(describeTrip("یه سفر خوب") === null, "a sentence without any taste word asks for more words");
assert(describeTrip("") === null, "an empty box produces nothing");
const historyTrip = describeTrip("تاریخ و معماری قدیم برایم مهم است");
assert(historyTrip?.result.moods[0].mood === "تاریخی", "history words win when that is what was written");
const freeTextCities = suggestCities(seaTrip!.result, { limit: 4 });
assert(freeTextCities.length >= 1, "the free-text path reaches real city suggestions");
assert(freeTextCities.every((city) => isIranianTravelCity(city.name)), "free-text suggestions are Iranian cities");

/* ------------------------------------------- the link a package produces */

const link = parseTripLink("?from=%D8%AA%D9%87%D8%B1%D8%A7%D9%86&to=%D9%85%D8%B4%D9%87%D8%AF&date=2026-11-21&return=2026-11-24&mode=train&adults=2&nights=3&pkg=whatever");
assert(link !== null, "a package link is understood");
if (!link) throw new Error("the package link must parse");
const pkgLink = link;
assertEqual(pkgLink.origin, "تهران", "the origin survives the link");
assertEqual(pkgLink.destination, "مشهد", "the destination survives the link");
assertEqual(pkgLink.departureDate, "2026-11-21", "the departure date survives the link");
assertEqual(pkgLink.returnDate, "2026-11-24", "the return date survives the link");
assertEqual(pkgLink.mode, "train", "the chosen mode survives the link");
assertEqual(pkgLink.days, 4, "three nights means a four-day trip");
assertEqual(pkgLink.travellers, 2, "the number of travellers survives the link");
assert(pkgLink.roundTrip, "a link with a return date is a round trip");
assertEqual(parseTripLink(""), null, "an empty link changes nothing");
assertEqual(parseTripLink("?adults=2"), null, "a party size alone is not a trip link");
assertEqual(parseTripLink("?date=2026-13-45&mode=spaceship")?.mode, undefined, "an impossible mode is ignored");
assertEqual(parseTripLink("?date=2026-13-45")?.departureDate, undefined, "an impossible date is never set");
assertEqual(parseTripLink("?to=%D9%85%D8%B4%D9%87%D8%AF&adults=99")?.travellers, 9, "the party size is capped, not trusted blindly");

if (failures) {
  console.error(`\n❌ ${failures} بررسی شکست خورد`);
  process.exit(1);
}
console.log("✅ start flow: cities, quiz, suggestions, budget, reviews and deals all pass");
