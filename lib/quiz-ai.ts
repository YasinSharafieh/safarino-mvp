/**
 * The conversation that decides «کجا بروم؟» — asked and read by the model,
 * grounded in the real city list.
 *
 * Two AI calls, both cheap and both optional:
 *   ask()     — ten fresh four-option questions, different from the last set,
 *               covering budget, company, transport, climate and taste.
 *   analyze() — reads the answers and names Iranian cities with a reason each.
 *
 * Hard rules enforced here, not by trust:
 *  • a question must have exactly four options and a key;
 *  • weights may only mention the seven tastes Safarino knows;
 *  • a suggested city must exist in PROFILED_CITIES (real Iranian city with a
 *    real character), otherwise it is dropped;
 *  • if anything is missing or the budget is out, the local engine answers.
 */

import { PROFILED_CITIES } from "./city-profiles";
import { DISCOVER_MOODS, type DiscoverMood } from "./discover";
import { drawQuestions, scoreAnswers, suggestCities, type QuizAnswers, type QuizQuestion } from "./start-flow";

export type AiQuestion = QuizQuestion;

export type AiSuggestion = {
  name: string;
  reason: string;
  /** Rough cost of the suggested trip, shown so the traveller can judge it. */
  estimatedToman?: number;
};

export type AiAnalysis = {
  headline: string;
  summary: string;
  moods: DiscoverMood[];
  cities: AiSuggestion[];
  days: number | null;
  budgetMillions: number | null;
  source: "ai" | "local";
};

const MOOD_SET = new Set<string>(DISCOVER_MOODS);
const CITY_NAMES = new Set(PROFILED_CITIES.map((city) => city.name));

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Keeps only what a question needs, and refuses anything malformed. */
export function sanitizeQuestions(raw: unknown, limit = 10): AiQuestion[] {
  if (!Array.isArray(raw)) return [];
  const questions: AiQuestion[] = [];
  const seenKeys = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const key = text(row.key, 24).replace(/[^a-z_]/gi, "");
    const prompt = text(row.prompt, 140);
    const aside = text(row.aside, 160);
    const options = Array.isArray(row.options) ? row.options : [];
    if (!key || !prompt || seenKeys.has(key) || options.length !== 4) continue;
    const cleanOptions = options.map((option, index) => {
      const item = (option ?? {}) as Record<string, unknown>;
      const id = text(item.id, 24) || `o${index}`;
      const label = text(item.label, 80);
      const weights: Partial<Record<DiscoverMood, number>> = {};
      const rawWeights = (item.weights ?? {}) as Record<string, unknown>;
      for (const [mood, weight] of Object.entries(rawWeights)) {
        if (!MOOD_SET.has(mood)) continue;
        const number = Number(weight);
        if (Number.isFinite(number) && number !== 0) weights[mood as DiscoverMood] = Math.max(-3, Math.min(3, number));
      }
      const dailyToman = Number(item.dailyToman);
      const days = Number(item.days);
      return {
        id,
        label,
        weights,
        hint: text(item.hint, 40) || undefined,
        ...(Number.isFinite(dailyToman) && dailyToman > 0 ? { dailyToman: Math.round(dailyToman) } : {}),
        ...(Number.isFinite(days) && days >= 1 && days <= 10 ? { days: Math.round(days) } : {}),
      };
    });
    if (cleanOptions.some((option) => !option.label)) continue;
    if (!cleanOptions.some((option) => Object.keys(option.weights).length)) continue;
    seenKeys.add(key);
    questions.push({ key: key as QuizQuestion["key"], prompt, aside, options: cleanOptions });
    if (questions.length >= limit) break;
  }
  return questions;
}

/**
 * The twelve subjects a taste test has to cover. They are split across parallel
 * model calls, because one call asking for all twelve is longer than the cheap
 * models' token ceiling — the answer got cut off and the whole set was lost.
 */
export const QUIZ_TOPICS = [
  "با چه کسی سفر می‌کند",
  "وسیلهٔ رفتن",
  "آب‌وهوای دلخواه",
  "نوع جاذبه‌ای که دوست دارد",
  "چقدر شلوغی را می‌پسندد",
  "ریتم و سرعت سفر",
  "نوع اقامتگاه",
  "خوراک و تجربهٔ محلی",
  "چیزی که در سفر آزارش می‌دهد",
  "ترجیح بین سفر شهری و طبیعت",
  "یک‌جا ماندن یا هر روز جای تازه",
  "استراحت یا کشف",
] as const;

export function questionsPrompt(input: {
  origin: string;
  travellers: number;
  version: string;
  avoidPrompts: string[];
  /** How many questions this call should write (the rest come from another call). */
  count?: number;
  /** Which subjects this call covers — so parallel calls never overlap. */
  topics?: readonly string[];
}): string {
  const cities = PROFILED_CITIES.slice(0, 40).map((city) => `${city.name}(${city.moods.join("،")})`).join(" | ");
  return `تو یک مشاور سفر ایرانی هستی که می‌خواهد سلیقهٔ یک مسافر را از صفر بشناسد.
برای او دقیقاً ${new Intl.NumberFormat("fa-IR").format(input.count ?? 12)} سؤال چهارگزینه‌ای بساز که با جواب‌هایشان بتوانی بهترین شهر ایران را برایش انتخاب کنی.
شرایط: مبدأ احتمالی ${input.origin}؛ ${input.travellers} نفر؛ نسخهٔ ${input.version}.
سؤال‌ها باید این موضوع‌ها را کامل پوشش دهند (هر کدام یک سؤال، و هر سؤال یک مفهوم تازه — نه دو سؤال شبیه هم): ${(input.topics && input.topics.length ? input.topics : QUIZ_TOPICS).join("؛ ")}.
سؤال بودجه را نپرس؛ بودجه در پایان به‌صورت یک عدد از خودش پرسیده می‌شود.
سؤال‌ها کوتاه، طبیعی، محاوره‌ای و بدون تکرار باشند و با این سؤال‌ها یکسان نباشند: ${input.avoidPrompts.join(" / ") || "—"}
هر گزینه باید weight روی دسته‌های زیر بدهد (فقط از این هفت): ${DISCOVER_MOODS.join("، ")}.
اگر گزینه‌ای هزینهٔ روزانه را عوض می‌کند، dailyToman (تومان برای هر نفر در روز) را هم بده.
فقط JSON معتبر بده، بدون متن اضافه، در این ساختار:
{"questions":[{"key":"english_key","prompt":"...","aside":"...","options":[{"id":"a","label":"...","hint":"...","weights":{"تاریخی":1},"dailyToman":1200000}]}]}
شهرهایی که بعداً پیشنهاد می‌دهی از این فهرست واقعی خواهند بود: ${cities}`;
}

export function analysisPrompt(input: {
  origin: string;
  travellers: number;
  budgetMillions: number | null;
  days: number | null;
  freeText: string;
  answers: { prompt: string; label: string }[];
}): string {
  const cityList = PROFILED_CITIES.map(
    (city) => `${city.name} :: ${city.province} :: ${city.moods.join("،")} :: ${city.tagline} :: ~${Math.round(city.dailyCostToman / 100_000) / 10} میلیون در روز`,
  ).join("\n");
  const answers = input.answers.map((item) => `- ${item.prompt} → ${item.label}`).join("\n") || "—";
  return `پاسخ‌های یک مسافر ایرانی را تحلیل کن و بهترین شهرهای ایران را برایش انتخاب کن.
مبدأ: ${input.origin}؛ تعداد نفرات: ${input.travellers}؛ بودجهٔ کل: ${input.budgetMillions ? `${input.budgetMillions} میلیون تومان` : "اعلام نشده"}؛ تعداد روز: ${input.days ?? "اعلام نشده"}.
توضیح آزاد خود مسافر: ${input.freeText || "—"}
پاسخ‌ها:
${answers}

قوانین سخت:
- فقط از این فهرست شهر انتخاب کن (نام دقیقاً همان‌طور که نوشته شده): 
${cityList}
- شهر پیشنهادی باید با بودجهٔ اعلام‌شدهٔ مسافر قابل انجام باشد؛ اگر بودجه کم است شهر نزدیک‌تر و ارزان‌تر بده و در دلیلش همین را بگو.
- برای هر شهر یک دلیل کوتاه و شخصی بنویس که به پاسخ‌های همین مسافر اشاره کند (نه جملهٔ کلی).
- چیزی از خودت نساز: نه جاذبه، نه قیمت بلیت، نه هتل. فقط شهر و دلیل.
- بین ۳ تا ۴ شهر بده، مرتب از مناسب‌ترین.
فقط JSON معتبر:
{"headline":"...","summary":"...","days":3,"budgetMillions":20,"moods":["تاریخی"],"cities":[{"name":"...","reason":"..."}]}`;
}

/** The local engine, used when the model is unavailable or the budget is out. */
export function localAnalysis(questions: QuizQuestion[], answers: QuizAnswers, context: { budgetMillions: number | null; travellers: number; origin: string }): AiAnalysis {
  const result = scoreAnswers(questions, answers);
  const suggestions = suggestCities(result, { limit: 6, exclude: [context.origin], budgetMillions: context.budgetMillions, travellers: context.travellers, matchedWords: (context as { matchedWords?: string[] }).matchedWords || [] });
  return {
    headline: result.headline,
    summary: result.summary,
    moods: result.moods.map((entry) => entry.mood),
    cities: suggestions.map((city) => ({ name: city.name, reason: city.reason, estimatedToman: city.estimatedToman })),
    days: result.days,
    budgetMillions: context.budgetMillions,
    source: "local",
  };
}

/** Reads the model's answer and keeps only what is real. */
export function sanitizeAnalysis(
  raw: unknown,
  context: { budgetMillions: number | null; travellers: number; origin: string; fallback: AiAnalysis },
): AiAnalysis {
  if (!raw || typeof raw !== "object") return context.fallback;
  const row = raw as Record<string, unknown>;
  const headline = text(row.headline, 80);
  const summary = text(row.summary, 700);
  const moods = Array.isArray(row.moods) ? row.moods.filter((mood): mood is DiscoverMood => MOOD_SET.has(String(mood))).slice(0, 3) : [];
  const cities: AiSuggestion[] = [];
  if (Array.isArray(row.cities)) {
    for (const entry of row.cities) {
      const item = (entry ?? {}) as Record<string, unknown>;
      const name = text(item.name, 40);
      if (!CITY_NAMES.has(name) || name === context.origin) continue;
      if (cities.some((city) => city.name === name)) continue;
      const city = PROFILED_CITIES.find((profile) => profile.name === name);
      cities.push({
        name,
        reason: text(item.reason, 220) || city?.tagline || "",
        estimatedToman: city ? city.dailyCostToman * 3 * Math.max(1, context.travellers) : undefined,
      });
      if (cities.length >= 4) break;
    }
  }
  if (!cities.length) return context.fallback;
  const days = Number(row.days);
  const budgetMillions = Number(row.budgetMillions);
  return {
    headline: headline || context.fallback.headline,
    summary: summary || context.fallback.summary,
    moods: moods.length ? moods : context.fallback.moods,
    cities,
    days: Number.isFinite(days) && days >= 1 && days <= 10 ? Math.round(days) : context.fallback.days,
    budgetMillions: Number.isFinite(budgetMillions) && budgetMillions > 0 ? Math.round(budgetMillions) : context.budgetMillions,
    source: "ai",
  };
}

export { drawQuestions };
