/**
 * Round 24 — the parts the traveller feels most: the questions, the budget
 * arithmetic and the size of the city and car lists.
 */
import {
  sanitizeQuestions,
  sanitizeAnalysis,
  localAnalysis,
  questionsPrompt,
  analysisPrompt,
} from "../lib/quiz-ai";
import { drawQuestions, isKnownIranianCity } from "../lib/start-flow";
import { PROFILED_CITIES } from "../lib/city-profiles";
import { DISCOVER_CITIES, DISCOVER_MOODS } from "../lib/discover";
import { CARS, searchCars, findCar, DEFAULT_CAR_ID } from "../lib/car-catalog";
import { estimateBudget, bestForBudget, bestStay, DAILY_FOOD_TOMAN } from "../lib/budget-fit";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

console.log("The quiz always asks at least ten questions, and never the same set");
const a = drawQuestions(Math.random, 10);
const b = drawQuestions(Math.random, 10);
check("ten questions are drawn", a.length === 10, String(a.length));
check("the keys are unique", new Set(a.map((q) => q.key)).size === a.length);
check("every question has four options", a.every((q) => q.options.length === 4));
check("every option carries a taste weight", a.every((q) => q.options.every((o) => Object.keys(o.weights).length >= 1)));
check("the taste words are the seven known ones", a.every((q) => q.options.every((o) => Object.keys(o.weights).every((mood) => DISCOVER_MOODS.includes(mood as never)))));
check("two attempts differ", a.map((q) => q.prompt).join("|") !== b.map((q) => q.prompt).join("|") || a.map((q) => q.key).join("|") !== b.map((q) => q.key).join("|"));
check("a budget question exists in the pool", drawQuestions(() => 0.1, 22).some((q) => q.key.startsWith("budget")));

console.log("Model-written questions are checked, not trusted");
const good = sanitizeQuestions([
    { key: "budget", prompt: "چقدر بودجه داری؟", aside: "صادقانه", options: [
      { id: "a", label: "کم", weights: { تاریخی: 1 } },
      { id: "b", label: "متوسط", weights: { شهری: 2 } },
      { id: "c", label: "زیاد", weights: { ساحلی: 1 } },
      { id: "d", label: "نامحدود", weights: { کوهستانی: 3 } },
    ] },
], 10);
check("a well-formed question survives", good.length === 1 && good[0].options.length === 4);
const bad = sanitizeQuestions([
  { key: "x", prompt: "سه گزینه", options: [{ id: "a", label: "۱", weights: {} }, { id: "b", label: "۲", weights: {} }, { id: "c", label: "۳", weights: {} }] },
  { key: "y", prompt: "", options: [] },
  { key: "z", prompt: "دستهٔ ناشناس", options: [
    { id: "a", label: "۱", weights: { فضایی: 1 } },
    { id: "b", label: "۲", weights: {} },
    { id: "c", label: "۳", weights: {} },
    { id: "d", label: "۴", weights: {} },
  ] },
], 10);
check("three options are refused", !bad.some((q) => q.key === "x"));
check("an empty prompt is refused", !bad.some((q) => q.key === "y"));
check("an unknown taste word is dropped", bad.every((q) => q.options.every((o) => Object.keys(o.weights).every((mood) => DISCOVER_MOODS.includes(mood as never)))));

console.log("The analysis can only name real Iranian cities");
const fallback = localAnalysis(a, Object.fromEntries(a.map((q) => [q.key, q.options[0].id])), { budgetMillions: 20, travellers: 2, origin: "تهران" });
check("the local engine answers", fallback.cities.length >= 1 && fallback.source === "local");
check("no city is the origin", fallback.cities.every((city) => city.name !== "تهران"));
const cleaned = sanitizeAnalysis(
  { headline: "سفر تاریخی", summary: "خلاصه", moods: ["تاریخی"], cities: [
    { name: "اصفهان", reason: "برای معماری" },
    { name: "آتلانتیس", reason: "شهر خیالی" },
    { name: "تهران", reason: "مبدأ است" },
    { name: "یزد", reason: "برای کویر" },
    { name: "شیراز", reason: "برای باغ" },
    { name: "کیش", reason: "برای دریا" },
    { name: "مشهد", reason: "زیارت" },
  ] },
  { budgetMillions: 20, travellers: 2, origin: "تهران", fallback },
);
check("an invented city is dropped", !cleaned.cities.some((city) => city.name === "آتلانتیس"));
check("the origin is not suggested back", !cleaned.cities.some((city) => city.name === "تهران"));
check("at most four cities", cleaned.cities.length <= 4, String(cleaned.cities.length));
check("every city is a real one", cleaned.cities.every((city) => isKnownIranianCity(city.name)));
check("a city carries a rough cost", cleaned.cities.every((city) => (city.estimatedToman ?? 0) > 0));
const empty = sanitizeAnalysis({ cities: [] }, { budgetMillions: 20, travellers: 2, origin: "تهران", fallback });
check("an empty model answer falls back to the local engine", empty.source === "local" && empty.cities.length >= 1);

console.log("The prompts keep the model inside Iran and inside the budget");
const questions = questionsPrompt({ origin: "تهران", travellers: 2, version: "v1", avoidPrompts: ["قدیمی"] });
check("the question prompt asks for twelve", questions.includes("۱۲ سؤال"));
check("the question prompt never asks for the budget itself", questions.includes("سؤال بودجه را نپرس"));
check("the question prompt forbids repeats", questions.includes("یکسان نباشند"));
const analysis = analysisPrompt({ origin: "تهران", travellers: 2, budgetMillions: 15, days: 3, freeText: "", answers: [{ prompt: "بودجه", label: "کم" }] });
check("the analysis prompt carries the budget", analysis.includes("15 میلیون"));
check("the analysis prompt lists real cities", analysis.includes("اصفهان") && analysis.includes("کیش"));
check("the analysis prompt forbids invention", analysis.includes("چیزی از خودت نساز"));

console.log("The city lists are national, not a dozen");
check("more than a hundred recommended cities", PROFILED_CITIES.length >= 100, String(PROFILED_CITIES.length));
check("the discovery list uses them all", DISCOVER_CITIES.length === PROFILED_CITIES.length);
check("every recommended city is a real Iranian city", PROFILED_CITIES.every((city) => isKnownIranianCity(city.name)));
check("history lovers get many historical cities", DISCOVER_CITIES.filter((city) => city.moods.includes("تاریخی")).length >= 30);
check("every city says what it costs per day", PROFILED_CITIES.every((city) => city.dailyCostToman > 0));

console.log("The car list is wide enough to find any real car");
check("no duplicate models", new Set(CARS.map((car) => car.id)).size === CARS.length);
check("more than seventy models", CARS.length >= 70, String(CARS.length));
check("برلیانس is there", searchCars("برلیانس").length >= 5, String(searchCars("برلیانس").length));
check("latin search works", searchCars("brilliance").length >= 5);
check("a model number narrows it", searchCars("H230").some((car) => car.name.includes("H230")));
check("double spaces and Arabic letters do not break it", searchCars("  پژو   پارس ").length >= 1);
check("an unknown car finds nothing", searchCars("پورشه ۹۱۱").length === 0 && searchCars("").length === CARS.length);
check("the default car exists", Boolean(findCar(DEFAULT_CAR_ID)));
check("every car has honest numbers", CARS.every((car) => car.consumption > 0 && car.valueToman > 0 && car.lifeKm > 0 && car.servicePerKm > 0));

console.log("The budget is spent on the whole trip, not just the ticket");
const plan = estimateBudget({ totalBudget: 20_000_000, travellers: 2, days: 3, tickets: 4_000_000, stay: 3_000_000 });
check("food is counted per person per day", plan.food === DAILY_FOOD_TOMAN * 2 * 3, String(plan.food));
check("what is left is honest", plan.remaining === 20_000_000 - 4_000_000 - 3_000_000 - plan.food - plan.activities - plan.localTransport);
check("a tight trip is called tight", estimateBudget({ totalBudget: 10_000_000, travellers: 2, days: 3, tickets: 2_000_000, stay: 3_000_000 }).verdict !== "fits");
check("an impossible trip is called over", estimateBudget({ totalBudget: 5_000_000, travellers: 2, days: 4, tickets: 4_000_000, stay: 4_000_000 }).verdict === "over");

const pick = bestForBudget([
  { id: "bus", price: 1_000_000, mode: "bus" },
  { id: "train", price: 1_400_000, mode: "train" },
  { id: "plane", price: 6_000_000, mode: "plane" },
], { remaining: 2_000_000 });
check("the comfortable option inside the budget wins", pick.option?.id === "train", pick.option?.id);
check("the reason mentions the rest of the trip", pick.reason.includes("بودجه"));
const poor = bestForBudget([{ id: "plane", price: 9_000_000, mode: "plane" }], { remaining: 1_000_000 });
check("when nothing fits, the cheapest is shown with a warning", poor.fits === false && poor.option?.id === "plane");

const stay = bestStay([
  { id: "cheap", price: 1_000_000, rating: 7.2 },
  { id: "good", price: 2_000_000, rating: 9.1 },
  { id: "grand", price: 9_000_000, rating: 9.6 },
], { remaining: 3_000_000 });
check("the best-rated room inside the budget wins", stay.option?.id === "good", stay.option?.id);

if (failures) {
  console.error(`\n❌ ${failures} بررسی شکست خورد`);
  process.exit(1);
}
console.log("\n✅ quiz, budget fit, city and car lists all pass");
