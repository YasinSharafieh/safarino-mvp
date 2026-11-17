/**
 * «سفر با یک جمله» — one sentence in, one real trip out.
 *
 * The traveller types what they already know: «۵ روز با بچه، ۴۰ میلیون، از
 * تهران، هوای گرم». From that, the app must fill the four facts the whole site
 * is built on — origin, destination, days, people, budget — and it must never
 * invent any of them.
 *
 * Two layers, exactly as everywhere else:
 *   1. `parseTripSentence` reads every number and every known city of Iran
 *      locally, for free, and marks which facts are still missing;
 *   2. the model may only *choose a destination from the real list* when the
 *      traveller did not name one — and its choice is checked against that list,
 *      so a made-up city can never reach the trip.
 *
 * Prices are never produced here: the transport and accommodation pages read
 * them live, as always.
 */

import { DISCOVER_CITIES, type DiscoverCity, type DiscoverMood } from "./discover";
import { parseVoiceTrip } from "./voice-parse";
import { MIN_BUDGET_MILLIONS, MAX_BUDGET_MILLIONS } from "./budget-control";

export type ParsedTrip = {
  origin: string | null;
  destination: string | null;
  days: number | null;
  travelers: number | null;
  children: number;
  budgetMillions: number | null;
  /** Tastes the sentence itself revealed: «گرم»، «تاریخی»، «دریا»… */
  moods: string[];
  /** Start date, if the sentence carried one; never guessed. */
  departureDate: string | null;
  /** Facts the sentence did not contain, named in Persian. */
  missing: string[];
  /** What we understood, one line, so the traveller can correct it. */
  understanding: string;
};

const MOOD_WORDS: { mood: string; patterns: RegExp }[] = [
  { mood: "تاریخی", patterns: /(تاریخ|قدیمی|باستان|میراث|بنای|کاخ|مسجد)/ },
  { mood: "طبیعت", patterns: /(طبیعت|جنگل|کوه|آبشار|سبز|روستا|کویر)/ },
  { mood: "ساحلی", patterns: /(دریا|ساحل|شنا|جزیره|آفتاب|گرم)/ },
  { mood: "زیارتی", patterns: /(زیارت|امام|حرم|مذهبی|عتبات)/ },
  { mood: "شهری", patterns: /(شهر|خرید|بازار|کافه|شب‌گردی|رستوران)/ },
  { mood: "کوهستانی", patterns: /(کوهستان|برف|اسکی|سرد|ییلاق)/ },
  { mood: "کویری", patterns: /(کویر|شتر|ستاره|آسمان شب|ریگ)/ },
];

/**
 * One sentence in, the trip's own facts out.
 *
 * This used to be a second, hand-written parser that only understood digits —
 * «سه روز»، «دو نفر»، «بیست میلیون» were all read as nothing — and its «از»
 * pattern matched the *end* of «شیراز», so a sentence about Shiraz lost its own
 * destination. The voice door already had a parser that reads Persian numbers,
 * folds ي/ك, knows the real city list and finds «از تهران» correctly, so the
 * two doors now share it: whatever a traveller can say to the microphone, they
 * can type in the one-click box, with the same result.
 */
export function parseTripSentence(input: string): ParsedTrip {
  const voice = parseVoiceTrip(input);
  const text = voice.transcript;

  const moods = MOOD_WORDS.filter((entry) => entry.patterns.test(text)).map((entry) => entry.mood);

  /**
   * «با بچه» says there is a child, and a child travelling with nobody is not a
   * trip: with no adult count in the sentence the party is one adult plus the
   * children — said out loud in `assumed`, never silently.
   */
  const travelers = voice.travelers || (voice.children ? Math.min(12, voice.children + 1) : null);

  const missing: string[] = [];
  if (!voice.destination) missing.push("مقصد");
  if (!voice.days) missing.push("تعداد روز");
  if (!travelers) missing.push("تعداد نفرات");
  if (!voice.budgetMillions) missing.push("بودجه");

  const fa = new Intl.NumberFormat("fa-IR");
  const parts: string[] = [];
  if (voice.origin) parts.push(`از ${voice.origin}`);
  if (voice.destination) parts.push(`به ${voice.destination}`);
  if (voice.days) parts.push(`${fa.format(voice.days)} روز`);
  if (travelers) parts.push(`${fa.format(travelers)} نفر${voice.children ? ` (${fa.format(voice.children)} کودک)` : ""}`);
  if (voice.budgetMillions) parts.push(`بودجهٔ ${fa.format(voice.budgetMillions)} میلیون تومان`);
  if (moods.length) parts.push(`سلیقه: ${moods.join("، ")}`);

  return {
    origin: voice.origin,
    destination: voice.destination,
    days: voice.days,
    travelers,
    children: voice.children || 0,
    budgetMillions: voice.budgetMillions,
    moods,
    departureDate: voice.departureDate,
    missing,
    understanding: parts.length ? parts.join(" · ") : "از جمله‌ات چیزی نفهمیدم؛ یک بار ساده‌تر بنویس.",
  };
}

/**
 * The candidates a model may choose from, already ranked by the tastes the
 * sentence revealed. A model may only answer with a name from this list.
 */
export function candidateCities(moods: string[], limit = 8): DiscoverCity[] {
  // With no taste to go on, the curated, most-visited cities come first — a
  // family that typed nothing about taste should not be sent to a random short
  // name just because it sorts first.
  if (!moods.length) return DISCOVER_CITIES.slice(0, limit);
  const scored = DISCOVER_CITIES.map((city) => {
    const hits = city.moods.filter((mood) => moods.includes(mood)).length;
    const bestForHits = city.bestFor.filter((item) => moods.some((mood) => item.includes(mood))).length;
    return { city, score: hits * 2 + bestForHits };
  }).sort((a, b) => b.score - a.score || a.city.name.length - b.city.name.length);
  const positive = scored.filter((entry) => entry.score > 0);
  return (positive.length ? positive : DISCOVER_CITIES.map((city) => ({ city, score: 0 }))).slice(0, limit).map((entry) => entry.city);
}

export function destinationPrompt(parsed: ParsedTrip, candidates: DiscoverCity[]): string {
  return `مسافر این را نوشته است: «${parsed.understanding}»
${parsed.days ? `مدت: ${parsed.days} روز` : "مدت نامشخص"} | ${parsed.travelers ? `${parsed.travelers} نفر` : "تعداد نامشخص"}
${parsed.budgetMillions ? `بودجه: ${parsed.budgetMillions} میلیون تومان` : "بودجه نامشخص"}
${parsed.moods.length ? `سلیقه‌ای که از جمله‌اش خواندم: ${parsed.moods.join("، ")}` : ""}

فقط از میان این شهرهای واقعی یکی را انتخاب کن (هیچ شهر دیگری نساز):
${candidates.map((city) => `- ${city.name} (${city.province}): ${city.tagline} | مناسب برای ${city.bestFor.join("، ")} | بهترین فصل ${city.bestSeason} | حدود ${city.suggestedDays} روز`).join("\n")}

فرمت: {"destination":"نام دقیق از فهرست","days":عدد,"reason":"یک جملهٔ فارسی دربارهٔ اینکه چرا این شهر برای همین مسافر خوب است"}`;
}

export type OneClickPlan = {
  origin: string;
  destination: string;
  days: number;
  travelers: number;
  children: number;
  budgetMillions: number;
  reason: string;
  source: "local" | "ai";
  /** Anything we had to fill with a default, said out loud. */
  assumed: string[];
};

export function localProposal(parsed: ParsedTrip, fallbackOrigin: string): OneClickPlan {
  const origin = parsed.origin || fallbackOrigin || "تهران";
  // A trip to the city you are already in is not a suggestion.
  const candidates = candidateCities(parsed.moods).filter((city) => city.name !== origin);
  const pool = candidates.length ? candidates : candidateCities(parsed.moods, 12).filter((city) => city.name !== origin);
  const chosen = pool[0] || candidateCities(parsed.moods)[0];
  const assumed: string[] = [];
  if (!parsed.days) assumed.push("مدت را ۳ روز گذاشتم.");
  if (!parsed.travelers) assumed.push("تعداد نفرات را ۲ نفر گذاشتم.");
  if (!parsed.budgetMillions) assumed.push("بودجه را ۲۰ میلیون تومان گذاشتم.");
  if (!parsed.destination) assumed.push(`مقصد را از میان شهرهای واقعی «${chosen.name}» گذاشتم.`);
  const budget = Math.min(MAX_BUDGET_MILLIONS, Math.max(MIN_BUDGET_MILLIONS, parsed.budgetMillions || 20));
  return {
    origin,
    destination: parsed.destination || chosen.name,
    days: Math.max(1, Math.min(21, parsed.days || chosen.suggestedDays || 3)),
    travelers: Math.max(1, Math.min(12, parsed.travelers || 2)),
    children: Math.max(0, Math.min(6, parsed.children)),
    budgetMillions: budget,
    reason: parsed.destination
      ? `${parsed.destination} را خودت انتخاب کردی؛ سفر را با همین مقصد می‌چینم.`
      : `${chosen.name}: ${chosen.tagline} مناسب برای ${chosen.bestFor.slice(0, 2).join(" و ")}${parsed.moods.length ? `، و با سلیقهٔ «${parsed.moods.join("، ")}» که نوشتی می‌خواند` : ""}.`,
    source: "local",
    assumed,
  };
}

/** The model's proposal, accepted only if every fact is legal and the city is real. */
export function acceptProposal(raw: unknown, parsed: ParsedTrip, local: OneClickPlan): OneClickPlan {
  const body = (raw || {}) as Record<string, unknown>;
  const name = typeof body.destination === "string" ? body.destination.trim() : "";
  const city = DISCOVER_CITIES.find((entry) => entry.name === name);
  const reason = typeof body.reason === "string" ? body.reason.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  // A city the traveller named themselves is never overridden.
  if (!city || reason.length < 15 || parsed.destination) return local;
  const days = Number(body.days);
  /**
   * When the model names the city, the note that used to say «مقصد را از میان
   * شهرهای واقعی «X» گذاشتم» must not keep the local engine's other city — that
   * read as a contradiction on screen («مقصد مشهد» next to a plan for اصفهان).
   */
  const assumed = local.assumed.filter((line) => !line.startsWith("مقصد"));
  if (!parsed.destination) assumed.push(`مقصد را از میان شهرهای واقعی «${city.name}» انتخاب کردم.`);
  return {
    ...local,
    destination: city.name,
    days: Number.isFinite(days) && days >= 1 && days <= 21 ? Math.round(days) : local.days,
    reason,
    source: "ai",
    assumed,
  };
}
