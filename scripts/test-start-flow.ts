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
import { DEAL_CITIES, todaysDealCities } from "../lib/deals";

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
for (const city of DEAL_CITIES) assert(discoverNames.has(city.city) || isIranianTravelCity(city.city), `${city.city} is an Iranian city`);

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

/* ---------------------------------------------------------------- deals */

// Provider photos must go through the site's proxy: the CDNs refuse hot links.
const dealsSource = readFileSync("lib/deals.ts", "utf8");
assert(dealsSource.includes("/api/provider-assets?src="), "deal photos go through the image proxy");
assert(!/photo:\s*offer\.imageUrl/.test(dealsSource), "no deal photo is linked to the provider directly");

const pair = todaysDealCities();
assertEqual(pair.length, 2, "two cities are featured every day");
assert(pair[0].city !== pair[1].city, "the two featured cities are different");
for (const entry of pair) {
  assert(isIranianTravelCity(entry.city), `${entry.city} is an Iranian city`);
  assert(entry.kind === "hotel" || entry.kind === "stay", "a deal city has a kind");
}
const tomorrow = todaysDealCities(new Date(Date.now() + 86_400_000));
assert(tomorrow[0].city !== pair[0].city, "the featured cities change tomorrow");

if (failures) {
  console.error(`\n❌ ${failures} بررسی شکست خورد`);
  process.exit(1);
}
console.log("✅ start flow: cities, quiz, suggestions, budget, reviews and deals all pass");
