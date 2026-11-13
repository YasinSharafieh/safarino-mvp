/**
 * The first step of every trip: «کجا برویم؟»
 *
 * Two doors, both Iranian:
 *  1. the traveller already knows the origin and the destination,
 *  2. or the traveller answers a few short, *changing* questions and gets
 *     city suggestions that match the kind of trip they actually want.
 *
 * Everything here is Iranian: no foreign city is ever suggested, and no
 * question is about a place outside Iran. The questions rotate (a different
 * set is drawn every time), so the quiz does not feel like a form.
 */

import { IRANIAN_CITIES, type IranianCity } from "./iran-cities";
import { DISCOVER_CITIES, type DiscoverMood } from "./discover";

/** Cities a traveller can start from or travel to: Iran only, unique by name. */
export function iranianTravelCities(): IranianCity[] {
  const seen = new Set<string>();
  const result: IranianCity[] = [];
  for (const city of IRANIAN_CITIES) {
    const name = (city.name || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(city);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

/**
 * Cities people actually search for, first in the list.
 *
 * The provider directory also contains small villages; they stay available
 * (a traveller may live there) but they are not the first thing a visitor sees.
 */
export const MAJOR_TRAVEL_CITIES = [
  "تهران", "مشهد", "اصفهان", "شیراز", "تبریز", "یزد", "کرمان", "رشت",
  "کیش", "قشم", "همدان", "کرمانشاه", "اهواز", "بندرعباس", "ارومیه", "ساری",
  "بابلسر", "رامسر", "چالوس", "نوشهر", "لاهیجان", "انزلی", "زنجان", "قزوین",
  "سمنان", "بوشهر", "خرم‌آباد", "سنندج", "گرگان", "شهرکرد", "بیرجند", "زاهدان",
  "کرج", "قم", "اردبیل", "ماسوله", "سرعین", "طبس", "نطنز", "کاشان", "شوشتر",
];

/** The same complete list, but with the well-known cities first. */
export function orderedTravelCities(): IranianCity[] {
  const all = iranianTravelCities();
  const byName = new Map(all.map((city) => [city.name, city]));
  const first: IranianCity[] = [];
  for (const name of MAJOR_TRAVEL_CITIES) {
    const city = byName.get(name);
    if (city) {
      first.push(city);
      byName.delete(name);
    }
  }
  const rest = all.filter((city) => byName.has(city.name));
  return [...first, ...rest];
}

const TRAVEL_CITY_NAMES = new Set(iranianTravelCities().map((city) => city.name));

export function isIranianTravelCity(name: unknown): name is string {
  return typeof name === "string" && TRAVEL_CITY_NAMES.has(name.trim());
}

/* ------------------------------------------------------------------ quiz */

export type QuizKey = "pace" | "party" | "mood" | "budget" | "season" | "interest" | "comfort" | "crowd";

export type QuizOption = {
  id: string;
  label: string;
  /** How this answer pulls the traveller's taste. */
  weights: Partial<Record<DiscoverMood, number>>;
  /** Budget/day hint in toman per person, used as a starting point only. */
  dailyToman?: number;
  days?: number;
  /** A short, friendly line under the option. */
  hint?: string;
};

export type QuizQuestion = {
  key: QuizKey;
  /** The question itself, in the traveller's own language. */
  prompt: string;
  /** A one-line framing, so the question feels like a conversation. */
  aside: string;
  options: QuizOption[];
};

/**
 * The question pool: every entry is a different *way* of asking what kind of
 * trip this is. A round draws one question per key, so two people (or the same
 * person twice) do not see the same quiz.
 */
export const QUESTION_POOL: QuizQuestion[] = [
  {
    key: "pace",
    prompt: "صبح سفرت بیشتر شبیه کدام است؟",
    aside: "هیچ جواب درستی وجود ندارد؛ فقط بگو چه حالی داری.",
    options: [
      { id: "slow", label: "آرام صبحانه می‌خورم و بعد راه می‌افتم", weights: { طبیعت: 1, کویری: 1 }, hint: "سفر آرام" },
      { id: "early", label: "قبل از آفتاب بیدارم و شهر را می‌گیرم", weights: { تاریخی: 1, شهری: 1 }, hint: "شروع زود" },
      { id: "plan", label: "برنامهٔ دقیق ساعت‌به‌ساعت دارم", weights: { تاریخی: 1, شهری: 1 }, hint: "برنامه‌ریز" },
      { id: "free", label: "هر روز صبح تصمیم می‌گیرم کجا بروم", weights: { طبیعت: 1, ساحلی: 1 }, hint: "آزاد" },
    ],
  },
  {
    key: "party",
    prompt: "با چه کسی سفر می‌کنی؟",
    aside: "این جواب روی نوع اقامتگاه هم اثر می‌گذارد.",
    options: [
      { id: "alone", label: "تنها", weights: { شهری: 1, تاریخی: 1 }, hint: "سفر تنهایی" },
      { id: "couple", label: "دو نفره", weights: { ساحلی: 1, شهری: 1 }, hint: "سفر دو نفره" },
      { id: "family", label: "با خانواده و بچه‌ها", weights: { زیارتی: 1, ساحلی: 1 }, hint: "خانوادگی" },
      { id: "friends", label: "با دوستان", weights: { طبیعت: 1, کویری: 1 }, hint: "گروهی" },
    ],
  },
  {
    key: "mood",
    prompt: "کدام تصویر بیشتر شبیه تعطیلات توست؟",
    aside: "یک تصویر را انتخاب کن؛ بقیه را فراموش کن.",
    options: [
      { id: "history", label: "کوچه‌های خشتی و کاشی‌های فیروزه‌ای", weights: { تاریخی: 2 }, hint: "تاریخ و معماری" },
      { id: "sea", label: "باد شور و صدای موج", weights: { ساحلی: 2 }, hint: "دریا" },
      { id: "green", label: "جنگل، مه و صدای آب", weights: { طبیعت: 2 }, hint: "شمال سبز" },
      { id: "desert", label: "آسمان پرستاره و سکوت کویر", weights: { کویری: 2 }, hint: "کویر" },
    ],
  },
  {
    key: "budget",
    prompt: "برای هر نفر در روز چقدر راحت‌تری خرج کنی؟",
    aside: "فقط یک شروع است؛ بعداً دقیق حساب می‌کنیم.",
    options: [
      { id: "low", label: "تا ۸۰۰ هزار تومان", weights: { تاریخی: 1, کویری: 1 }, dailyToman: 800_000 },
      { id: "mid", label: "حدود ۱٫۵ میلیون تومان", weights: { شهری: 1 }, dailyToman: 1_500_000 },
      { id: "high", label: "حدود ۳ میلیون تومان", weights: { ساحلی: 1 }, dailyToman: 3_000_000 },
      { id: "vip", label: "مهم نیست، راحتی مهم‌تر است", weights: { ساحلی: 1, شهری: 1 }, dailyToman: 5_000_000 },
    ],
  },
  {
    key: "season",
    prompt: "چه هوایی را بیشتر دوست داری؟",
    aside: "هوای همان روزها را هم بعداً نشانت می‌دهیم.",
    options: [
      { id: "cold", label: "سرد و برفی", weights: { کوهستانی: 2 }, hint: "کوه و سرما" },
      { id: "mild", label: "معتدل و بهاری", weights: { تاریخی: 1, طبیعت: 1 }, hint: "بهار" },
      { id: "warm", label: "گرم و آفتابی", weights: { ساحلی: 1, کویری: 1 }, hint: "آفتاب" },
      { id: "any", label: "مهم نیست، لباسش را می‌پوشم", weights: { شهری: 1 }, hint: "هر فصلی" },
    ],
  },
  {
    key: "interest",
    prompt: "اگر یک ساعت وقت اضافه داشتی، چه می‌کردی؟",
    aside: "این بار دربارهٔ سفر جواب بده، نه خانه.",
    options: [
      { id: "museum", label: "یک موزه یا بنای تاریخی", weights: { تاریخی: 2 }, hint: "موزه" },
      { id: "bazaar", label: "گشت در بازار و خرید سوغات", weights: { شهری: 2 }, hint: "بازار" },
      { id: "park", label: "نشستن در پارک و قدم‌زدن", weights: { طبیعت: 2 }, hint: "طبیعت" },
      { id: "food", label: "یک رستوران محلی و غذای خاص", weights: { شهری: 1, تاریخی: 1 }, hint: "غذا" },
    ],
  },
  {
    key: "comfort",
    prompt: "اقامتگاهت چه شکلی باشد؟",
    aside: "قیمت واقعی‌اش را در مرحلهٔ بعد می‌بینی.",
    options: [
      { id: "simple", label: "ساده و تمیز، فقط برای خواب", weights: { کویری: 1, طبیعت: 1 }, hint: "ساده" },
      { id: "boutique", label: "خانهٔ سنتی یا بوتیک", weights: { تاریخی: 2 }, hint: "بوتیک" },
      { id: "hotel", label: "هتل با صبحانه و امکانات", weights: { شهری: 1, زیارتی: 1 }, hint: "هتل" },
      { id: "resort", label: "اقامتگاه کنار آب با استخر", weights: { ساحلی: 2 }, hint: "ریزورت" },
    ],
  },
  {
    key: "crowd",
    prompt: "شلوغی را چطور تحمل می‌کنی؟",
    aside: "بعضی شهرها همیشه شلوغ‌ند، بعضی هیچ‌وقت.",
    options: [
      { id: "love", label: "شلوغی و زندگی را دوست دارم", weights: { شهری: 2, زیارتی: 1 }, hint: "شهر شلوغ" },
      { id: "ok", label: "تا حدی، اگر جاذبه‌اش ارزشش را داشته باشد", weights: { تاریخی: 1, زیارتی: 1 }, hint: "متوسط" },
      { id: "quiet", label: "آرامش برایم مهم‌تر است", weights: { کویری: 1, طبیعت: 1 }, hint: "آرام" },
      { id: "escape", label: "شلوغی را دوست ندارم؛ جای خالی می‌خواهم", weights: { کویری: 2 }, hint: "خلوت" },
    ],
  },
];

export type QuizAnswers = Record<string, string>;

/** One question per key, freshly shuffled, so no two rounds look the same. */
export function drawQuestions(random: () => number = Math.random, count = 5): QuizQuestion[] {
  const byKey = new Map<QuizKey, QuizQuestion>();
  for (const question of QUESTION_POOL) {
    const existing = byKey.get(question.key);
    // Keys can appear more than once in the pool: pick one of them at random.
    if (!existing || random() < 0.5) byKey.set(question.key, question);
  }
  const all = Array.from(byKey.values());
  // Fisher–Yates, then take the first `count`.
  for (let index = all.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [all[index], all[swap]] = [all[swap], all[index]];
  }
  return all.slice(0, Math.max(3, Math.min(all.length, count)));
}

export type QuizResult = {
  moods: { mood: DiscoverMood; score: number }[];
  /** The strongest taste, in one word, for the result screen. */
  headline: string;
  /** Two or three sentences describing the traveller's trip style. */
  summary: string;
  dailyToman: number | null;
  days: number | null;
};

const MOOD_WORDS: Record<DiscoverMood, string> = {
  تاریخی: "تاریخ و معماری",
  زیارتی: "زیارت و آرامش",
  طبیعت: "طبیعت و هوای آزاد",
  ساحلی: "دریا و ساحل",
  شهری: "شهر، بازار و غذا",
  کوهستانی: "کوه و سرما",
  کویری: "کویر و آسمان شب",
};

/** Turns the answers into a ranked taste, without pretending to be a diagnosis. */
export function scoreAnswers(questions: QuizQuestion[], answers: QuizAnswers): QuizResult {
  const scores = new Map<DiscoverMood, number>();
  let dailyToman: number | null = null;
  let days: number | null = null;

  for (const question of questions) {
    const chosen = question.options.find((option) => option.id === answers[question.key]);
    if (!chosen) continue;
    for (const [mood, weight] of Object.entries(chosen.weights)) {
      const key = mood as DiscoverMood;
      scores.set(key, (scores.get(key) || 0) + (Number(weight) || 0));
    }
    if (typeof chosen.dailyToman === "number") dailyToman = chosen.dailyToman;
    if (typeof chosen.days === "number") days = chosen.days;
  }

  const ranked = Array.from(scores.entries())
    .map(([mood, score]) => ({ mood, score }))
    .sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, 2).map((entry) => MOOD_WORDS[entry.mood]);
  const headline = ranked.length ? MOOD_WORDS[ranked[0].mood] : "سفری تازه";
  const summary = top.length
    ? `سلیقهٔ سفرت بیشتر به ${top.join(" و ")} می‌خورد. بر همین اساس چند شهر پیشنهاد می‌کنیم و بعد با هم وسیلهٔ سفر و اقامتگاه را می‌چینیم.`
    : "با همین چند جواب، چند شهر پیشنهاد می‌کنیم و بعد با هم بقیهٔ سفر را می‌چینیم.";

  return { moods: ranked, headline, summary, dailyToman, days };
}

export type CitySuggestion = {
  name: string;
  province: string;
  tagline: string;
  days: number;
  bestSeason: string;
  /** Why this city was suggested — in the traveller's own words, never generic. */
  reason: string;
  score: number;
};

/**
 * Cities that match the taste. Only places Safarino already knows (with real
 * coordinates and real attractions) can be suggested, so a suggestion always
 * leads to a plan that can actually be built.
 */
export function suggestCities(result: QuizResult, options: { limit?: number; exclude?: string[] } = {}): CitySuggestion[] {
  const exclude = new Set(options.exclude || []);
  const topMoods = result.moods.slice(0, 3);
  const scored = DISCOVER_CITIES.filter((city) => !exclude.has(city.name)).map((city) => {
    let score = 0;
    for (const entry of topMoods) {
      if (city.moods.includes(entry.mood)) score += entry.score * 2;
    }
    // A city that matches several tastes is a good, safe suggestion.
    score += city.moods.filter((mood) => topMoods.some((entry) => entry.mood === mood)).length;
    return { city, score };
  });

  scored.sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name, "fa"));

  return scored
    .filter((entry) => entry.score > 0)
    .slice(0, Math.max(1, Math.min(6, options.limit ?? 4)))
    .map(({ city, score }) => {
      const matched = city.moods.filter((mood) => topMoods.some((entry) => entry.mood === mood));
      const reason = matched.length
        ? `${matched.map((mood) => MOOD_WORDS[mood]).join(" و ")} — همان چیزی که انتخاب کردی.`
        : city.tagline;
      return {
        name: city.name,
        province: city.province,
        tagline: city.tagline,
        days: result.days && result.days > 0 ? Math.max(city.suggestedDays - 1, result.days) : city.suggestedDays,
        bestSeason: city.bestSeason,
        reason,
        score,
      };
    });
}

/** The budget the traveller hinted at, as a whole-trip figure in millions. */
export function budgetFromDaily(dailyToman: number | null, days: number | null, people: number): number | null {
  if (!dailyToman || !days || days < 1) return null;
  const total = dailyToman * days * Math.max(1, people);
  // The app stores the whole-trip budget in millions of toman.
  return Math.max(3, Math.round(total / 1_000_000));
}
