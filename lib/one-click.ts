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
import { IRANIAN_CITIES } from "./iran-cities";
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

const FA_DIGITS: Record<string, string> = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };

function latin(text: string): string {
  return (text || "")
    .replace(/[۰-۹]/g, (digit) => FA_DIGITS[digit] || digit)
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/ك/g, "ک")
    .replace(/ي/g, "ی");
}

/** A city only counts when it is a real city the app knows. */
function findCityIn(text: string, pool: { name: string }[]): string | null {
  let best: { name: string; index: number } | null = null;
  for (const city of pool) {
    const index = text.indexOf(city.name);
    if (index < 0) continue;
    if (!best || city.name.length > best.name.length) best = { name: city.name, index };
  }
  return best?.name ?? null;
}

const MOOD_WORDS: { mood: string; patterns: RegExp }[] = [
  { mood: "تاریخی", patterns: /(تاریخ|قدیمی|باستان|میراث|بنای|کاخ|مسجد)/ },
  { mood: "طبیعت", patterns: /(طبیعت|جنگل|کوه|آبشار|سبز|روستا|کویر)/ },
  { mood: "ساحلی", patterns: /(دریا|ساحل|شنا|جزیره|آفتاب|گرم)/ },
  { mood: "زیارتی", patterns: /(زیارت|امام|حرم|مذهبی|عتبات)/ },
  { mood: "شهری", patterns: /(شهر|خرید|بازار|کافه|شب‌گردی|رستوران)/ },
  { mood: "کوهستانی", patterns: /(کوهستان|برف|اسکی|سرد|ییلاق)/ },
  { mood: "کویری", patterns: /(کویر|شتر|ستاره|آسمان شب|ریگ)/ },
];

export function parseTripSentence(input: string): ParsedTrip {
  const text = latin(input);
  const numbers = (text.match(/\d+(?:[.,]\d+)?/g) || []).map((value) => Number(value.replace(",", ".")));

  // Days: «۵ روز» / «یک هفته»
  let days: number | null = null;
  const dayMatch = text.match(/(\d+)\s*(?:روز|شب)/);
  if (dayMatch) days = Number(dayMatch[1]);
  else if (/یک\s*هفته|1\s*هفته/.test(text)) days = 7;
  else if (/دو\s*هفته|2\s*هفته/.test(text)) days = 14;
  else if (/آخر\s*هفته|weekend/i.test(text)) days = 2;

  // People: «۲ نفر» / «۴ نفر با بچه» / «تنها»
  let travelers: number | null = null;
  let children = 0;
  const peopleMatch = text.match(/(\d+)\s*(?:نفر|بزرگسال|مسافر)/);
  if (peopleMatch) travelers = Number(peopleMatch[1]);
  if (/تنها|خودم|سینگل/.test(text)) travelers = travelers || 1;
  const childMatch = text.match(/(\d+)\s*(?:بچه|کودک|نوجوان)/);
  if (childMatch) {
    children = Number(childMatch[1]);
    travelers = travelers || 2;
  } else if (/با\s*بچه|با\s*کودک|خانوادگی/.test(text)) {
    children = 1;
    travelers = travelers || 2;
  }

  // Budget: «۴۰ میلیون» / «۴۰م» / «بودجه ۴۰ میلیون تومان»
  let budgetMillions: number | null = null;
  const millionMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:میلیون|م\b)/);
  if (millionMatch) budgetMillions = Number(millionMatch[1]);
  else {
    // A bare number over a thousand is read as toman only when it says so.
    const tomanMatch = text.match(/(\d{6,})\s*(?:تومان|تومن)/);
    if (tomanMatch) budgetMillions = Math.round(Number(tomanMatch[1]) / 1_000_000);
  }

  // Origin: «از تهران»
  const fromMatch = text.match(/از\s+([آ-ی\s]{2,20})/);
  const origin = fromMatch ? findCityIn(fromMatch[1], IRANIAN_CITIES) : null;

  // Destination: a city named anywhere except right after «از».
  const withoutOrigin = fromMatch ? text.replace(fromMatch[0], " ") : text;
  const destination = findCityIn(withoutOrigin, DISCOVER_CITIES) || findCityIn(withoutOrigin, IRANIAN_CITIES);

  const moods = MOOD_WORDS.filter((entry) => entry.patterns.test(text)).map((entry) => entry.mood);

  const missing: string[] = [];
  if (!destination) missing.push("مقصد");
  if (!days) missing.push("تعداد روز");
  if (!travelers) missing.push("تعداد نفرات");
  if (!budgetMillions) missing.push("بودجه");

  const fa = new Intl.NumberFormat("fa-IR");
  const parts: string[] = [];
  if (origin) parts.push(`از ${origin}`);
  if (destination) parts.push(`به ${destination}`);
  if (days) parts.push(`${fa.format(days)} روز`);
  if (travelers) parts.push(`${fa.format(travelers)} نفر${children ? ` (${fa.format(children)} کودک)` : ""}`);
  if (budgetMillions) parts.push(`بودجهٔ ${fa.format(budgetMillions)} میلیون تومان`);
  if (moods.length) parts.push(`سلیقه: ${moods.join("، ")}`);

  return {
    origin,
    destination,
    days,
    travelers,
    children,
    budgetMillions,
    moods,
    departureDate: null,
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
  return {
    ...local,
    destination: city.name,
    days: Number.isFinite(days) && days >= 1 && days <= 21 ? Math.round(days) : local.days,
    reason,
    source: "ai",
  };
}
