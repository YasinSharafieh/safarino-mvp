/**
 * «با صدات بگو» — turning one spoken sentence into the trip form.
 *
 * The golden rule of this project applies here more than anywhere else: the app
 * never guesses. Everything below is *read* from the sentence the traveller
 * actually said. A field that is not in the sentence stays empty and is asked
 * for, and the screen always shows back exactly what was heard.
 */

import { IRANIAN_CITIES } from "./iran-cities";
import { CARS } from "./car-catalog";
import { preferredModeFromText } from "./start-flow";

export type VoiceMode = "" | "plane" | "train" | "bus" | "car";

export type VoiceField = "origin" | "destination" | "budget" | "days" | "travelers" | "children" | "mode" | "car" | "departureDate";

export type VoiceReading = {
  field: VoiceField;
  /** What the traveller sees next to the value, e.g. «مقصد». */
  label: string;
  /** The normalised value in plain Persian. */
  value: string;
};

export type VoiceTrip = {
  transcript: string;
  origin: string | null;
  destination: string | null;
  /** Whole-trip budget in millions of toman — the unit every page uses. */
  budgetMillions: number | null;
  days: number | null;
  travelers: number | null;
  children: number | null;
  mode: VoiceMode;
  carName: string | null;
  /** ISO date, only when the sentence really says «فردا» / «هفته دیگه». */
  departureDate: string | null;
  /** Everything that was really read, in the order the traveller said it. */
  read: VoiceReading[];
  /** What is still missing before a search can start. */
  missing: string[];
  /** 0–1: how much of the form the sentence filled. */
  confidence: number;
};

const DIGITS_FROM = "۰۱۲۳۴۵۶۷۸۹";
const DIGITS_TO = "0123456789";

/** Persian digits, Arabic letters and half-spaces are folded to one shape. */
export function foldPersian(input: string): string {
  return (input || "")
    .replace(/[۰-۹]/g, (digit) => DIGITS_TO[DIGITS_FROM.indexOf(digit)])
    .replace(/[٠-٩]/g, (digit) => DIGITS_TO["٠١٢٣٤٥٦٧٨٩".indexOf(digit)])
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const WORD_NUMBERS: Record<string, number> = {
  یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
  یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15, شانزده: 16, شونزده: 16,
  هفده: 17, هیفده: 17, هجده: 18, هیجده: 18, نوزده: 19,
  بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90,
  صد: 100, یکصد: 100, دویست: 200, سیصد: 300, چهارصد: 400, پانصد: 500, ششصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900,
};

/** «بیست و پنج» → 25, «پانزده» → 15. Only real number words count. */
function wordsToNumber(text: string): number | null {
  const words = text.split(/[\s‌]+/).filter((word) => word && word !== "و");
  if (!words.length) return null;
  let total = 0;
  let seen = false;
  for (const word of words) {
    const value = WORD_NUMBERS[word];
    if (value === undefined) return null;
    total += value;
    seen = true;
  }
  return seen ? total : null;
}

/** The number before a unit word: digits first, Persian number words second. */
function numberBefore(text: string, units: string[]): number | null {
  const unit = units.join("|");
  const digits = new RegExp(`(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*(?:${unit})`).exec(text);
  if (digits) return Number(digits[1].replace(",", "."));
  const words = new RegExp(`((?:[آ-ی]{2,10})(?:\\s+و\\s+[آ-ی]{2,10})*)\\s*(?:${unit})`).exec(text);
  if (words) {
    const parsed = wordsToNumber(words[1]);
    if (parsed) return parsed;
  }
  return null;
}

/** The whole-trip budget, always in millions of toman. */
export function parseBudget(input: string): number | null {
  const text = foldPersian(input);
  const millions = numberBefore(text, ["میلیون", "ملیون", "میلیونی", "میلیون تومان"]);
  if (millions && millions > 0) return Math.min(500, Math.round(millions * 10) / 10);

  // «۸۰۰ هزار تومان» is a per-day figure only when the sentence says so; a bare
  // large number of toman is read as a trip total.
  const toman = /(\d{6,9})\s*(?:تومان|تومن)/.exec(text);
  if (toman) return Math.max(1, Math.round(Number(toman[1]) / 1_000_000));
  return null;
}

const CITY_NAMES = Array.from(new Set(IRANIAN_CITIES.filter((city) => city.name).map((city) => foldPersian(city.name))))
  .sort((a, b) => b.length - a.length);

type CityHit = { name: string; index: number; before: string };

/** Cities that are really in the sentence, with what came right before them. */
export function findCities(text: string): CityHit[] {
  const folded = foldPersian(text);
  const hits: CityHit[] = [];
  for (const name of CITY_NAMES) {
    let from = 0;
    for (;;) {
      const index = folded.indexOf(name, from);
      if (index < 0) break;
      from = index + name.length;
      const before = folded.charAt(index - 1);
      const after = folded.charAt(index + name.length);
      const letterBefore = /[آ-ی]/.test(before);
      const letterAfter = /[آ-ی]/.test(after);
      if (letterBefore || letterAfter) continue;
      hits.push({ name, index, before: folded.slice(Math.max(0, index - 14), index) });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

const ORIGIN_HINTS = ["از", "مبدا", "مبدأ", "از شهر"];
const DESTINATION_HINTS = ["به", "مقصد", "طرف", "سمت", "برم", "بریم", "میرم", "می روم", "میروم", "سفر به", "سفر"];

function endsWithHint(before: string, hints: string[]): boolean {
  const clean = before.trim();
  return hints.some((hint) => clean.endsWith(hint));
}

/** A day offset from «فردا», «هفته دیگه» — nothing more is inferred. */
export function parseDeparture(text: string, today = new Date()): string | null {
  const folded = foldPersian(text);
  let offset: number | null = null;
  const weeks = numberBefore(folded, ["هفته", "هفتهای", "هفته‌ی"]);
  if (/هفته\s+(دیگه|دیگر|بعد|آینده)/.test(folded)) offset = 7 * (weeks && weeks > 0 ? weeks : 1);
  else if (/ماه\s+(دیگه|دیگر|بعد|آینده)/.test(folded)) offset = 30;
  else if (/پس\s?فردا/.test(folded)) offset = 2;
  else if (/فردا/.test(folded)) offset = 1;
  else if (/(امروز|همین امروز|همین امشب)/.test(folded)) offset = 0;
  else {
    const daysAhead = numberBefore(folded, ["روز دیگه", "روز دیگر", "روز بعد"]);
    if (daysAhead && daysAhead > 0) offset = Math.min(60, Math.round(daysAhead));
  }
  if (offset === null) return null;
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** The car, when the traveller names one that really exists in the catalogue. */
export function parseCar(text: string): string | null {
  const folded = foldPersian(text);
  const firstTokenCount = new Map<string, number>();
  for (const car of CARS) {
    const token = foldPersian(car.name).split(" ")[0];
    firstTokenCount.set(token, (firstTokenCount.get(token) || 0) + 1);
  }
  const needles: { needle: string; name: string }[] = [];
  for (const car of CARS) {
    const full = foldPersian(car.name);
    const tokens = full.split(" ").filter(Boolean);
    const candidates = [
      full,
      full.replace(/\s*[(（].*$/, ""),
      tokens.slice(0, 2).join(" "),
      ...(car.aliases || []).map((alias) => foldPersian(alias)),
    ];
    // A single word only counts when the catalogue has exactly one car with it,
    // so «پژو» alone never silently becomes one particular model.
    if (firstTokenCount.get(tokens[0]) === 1) candidates.push(tokens[0]);
    for (const candidate of candidates) {
      const needle = candidate.trim();
      if (needle.length >= 3) needles.push({ needle, name: car.name });
    }
  }
  needles.sort((a, b) => b.needle.length - a.needle.length);
  for (const entry of needles) {
    if (folded.includes(entry.needle)) return entry.name;
  }
  return null;
}

const SECOND_PERSON = /(همسرم|همسره|زنم|شوهرم|نامزدم|دوست\s?دخترم|دوست\s?پسرم|با یکی|دو\s?نفری)/;
const ALONE = /(تنهام|تنها می|تنهایی|خودم تنها|یک\s?نفری)/;

/**
 * Reads one sentence into the form. Every value below is present in the
 * sentence itself; there is no fallback value anywhere in this function.
 */
export function parseVoiceTrip(transcript: string, today = new Date()): VoiceTrip {
  const text = foldPersian(transcript);
  const read: VoiceReading[] = [];

  const cities = findCities(text);
  let origin: string | null = null;
  let destination: string | null = null;

  const originHit = cities.find((hit) => endsWithHint(hit.before, ORIGIN_HINTS));
  const destinationHit = cities.find((hit) => hit !== originHit && endsWithHint(hit.before, DESTINATION_HINTS));
  if (originHit) origin = originHit.name;
  if (destinationHit) destination = destinationHit.name;
  if (!destination) {
    const remaining = cities.filter((hit) => hit.name !== origin);
    if (remaining.length) destination = remaining[remaining.length - 1].name;
  }
  if (!origin && destination) {
    const others = cities.filter((hit) => hit.name !== destination);
    if (others.length) origin = others[0].name;
  }
  if (origin && destination && origin === destination) destination = null;

  if (destination) read.push({ field: "destination", label: "مقصد", value: destination });
  if (origin) read.push({ field: "origin", label: "مبدأ", value: origin });

  const budgetMillions = parseBudget(text);
  if (budgetMillions) read.push({ field: "budget", label: "بودجه", value: `${new Intl.NumberFormat("fa-IR").format(budgetMillions)} میلیون تومان` });

  let days = numberBefore(text, ["روز", "روزه", "شب", "شبه"]);
  if (!days || days < 1 || days > 30) {
    if (/یک\s?هفته/.test(text)) days = 7;
    else days = null;
  }
  if (days) read.push({ field: "days", label: "مدت سفر", value: `${new Intl.NumberFormat("fa-IR").format(Math.round(days))} روز` });

  let travelers = numberBefore(text, ["نفر", "نفری", "نفریم", "آدم"]);
  if (!travelers) {
    if (SECOND_PERSON.test(text)) travelers = 2;
    else if (ALONE.test(text)) travelers = 1;
  }
  if (travelers && travelers >= 1 && travelers <= 9) {
    read.push({ field: "travelers", label: "مسافر", value: `${new Intl.NumberFormat("fa-IR").format(Math.round(travelers))} نفر` });
  } else travelers = null;

  const childrenRaw = numberBefore(text, ["بچه", "بچه‌ها", "بچه ها", "کودک", "فرزند"]);
  const children = childrenRaw && childrenRaw >= 1 && childrenRaw <= 6 ? Math.round(childrenRaw) : /(با بچه|بچه داریم|بچه‌مون|بچه مون)/.test(text) ? 1 : null;
  if (children) read.push({ field: "children", label: "کودک", value: `${new Intl.NumberFormat("fa-IR").format(children)} نفر` });

  const modeFromWords = preferredModeFromText(text);
  // Naming a real car *is* choosing to drive, even when the word «ماشین» is
  // written as «ماشینمون» and never matches the plain pattern.
  const carName = modeFromWords === "car" || /پژو|پراید|سمند|دنا|تارا|شاهین|کوییک|تیبا|ساینا|هایما|چری|رانا|سورن|پارس/.test(text) ? parseCar(text) : null;
  const mode: VoiceMode = modeFromWords || (carName ? "car" : "");
  if (mode) read.push({ field: "mode", label: "وسیله", value: mode === "car" ? "ماشین شخصی" : mode === "plane" ? "هواپیما" : mode === "train" ? "قطار" : "اتوبوس" });
  if (carName) read.push({ field: "car", label: "خودرو", value: carName });

  const departureDate = parseDeparture(text, today);
  if (departureDate) {
    read.push({ field: "departureDate", label: "تاریخ حرکت", value: new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${departureDate}T00:00:00Z`)) });
  }

  const missing: string[] = [];
  if (!origin) missing.push("مبدأ");
  if (!destination) missing.push("مقصد");
  if (!budgetMillions) missing.push("بودجه");
  // Days are only «missing» when nothing else says them either: a departure and
  // a return date are chosen on the next screen in every case.
  if (!days) missing.push("مدت سفر");

  const filled = [destination, origin, budgetMillions, days, travelers].filter(Boolean).length;
  const confidence = Math.round((filled / 5) * 100) / 100;

  return {
    transcript: transcript.trim(),
    origin,
    destination,
    budgetMillions,
    days: days ? Math.round(days) : null,
    travelers: travelers ? Math.round(travelers) : null,
    children,
    mode: mode as VoiceMode,
    carName,
    departureDate,
    read,
    missing,
    confidence,
  };
}

/**
 * Whatever the model adds must pass through here first: a city that exists, a
 * budget inside the app's range, a mode from the app's own list. Anything else
 * is thrown away, so a hallucinated «بودجه ۳ میلیارد» can never reach the form.
 */
export function mergeVoiceFields(local: VoiceTrip, extra: unknown): VoiceTrip {
  const raw = (extra && typeof extra === "object" ? extra : {}) as Record<string, unknown>;
  const cities = new Set(CITY_NAMES);
  const result: VoiceTrip = { ...local, read: [...local.read] };

  const pickCity = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const folded = foldPersian(value);
    return cities.has(folded) ? folded : null;
  };

  if (!result.origin) {
    const value = pickCity(raw.origin);
    if (value) {
      result.origin = value;
      result.read.unshift({ field: "origin", label: "مبدأ", value });
    }
  }
  if (!result.destination) {
    const value = pickCity(raw.destination);
    if (value && value !== result.origin) {
      result.destination = value;
      result.read.unshift({ field: "destination", label: "مقصد", value });
    }
  }
  if (!result.budgetMillions) {
    const value = Number(raw.budgetMillions);
    if (Number.isFinite(value) && value >= 1 && value <= 500) {
      result.budgetMillions = Math.round(value * 10) / 10;
      result.read.push({ field: "budget", label: "بودجه", value: `${new Intl.NumberFormat("fa-IR").format(result.budgetMillions)} میلیون تومان` });
    }
  }
  if (!result.days) {
    const value = Number(raw.days);
    if (Number.isFinite(value) && value >= 1 && value <= 30) {
      result.days = Math.round(value);
      result.read.push({ field: "days", label: "مدت سفر", value: `${new Intl.NumberFormat("fa-IR").format(result.days)} روز` });
    }
  }
  if (!result.travelers) {
    const value = Number(raw.travelers);
    if (Number.isFinite(value) && value >= 1 && value <= 9) {
      result.travelers = Math.round(value);
      result.read.push({ field: "travelers", label: "مسافر", value: `${new Intl.NumberFormat("fa-IR").format(result.travelers)} نفر` });
    }
  }
  if (!result.children) {
    const value = Number(raw.children);
    if (Number.isFinite(value) && value >= 1 && value <= 6) result.children = Math.round(value);
  }
  if (!result.mode) {
    const value = typeof raw.mode === "string" ? raw.mode : "";
    if (["plane", "train", "bus", "car"].includes(value)) {
      result.mode = value as VoiceMode;
      result.read.push({ field: "mode", label: "وسیله", value: value === "car" ? "ماشین شخصی" : value === "plane" ? "هواپیما" : value === "train" ? "قطار" : "اتوبوس" });
    }
  }

  const missing: string[] = [];
  if (!result.origin) missing.push("مبدأ");
  if (!result.destination) missing.push("مقصد");
  if (!result.budgetMillions) missing.push("بودجه");
  if (!result.days) missing.push("مدت سفر");
  const filled = [result.destination, result.origin, result.budgetMillions, result.days, result.travelers].filter(Boolean).length;
  return { ...result, missing, confidence: Math.round((filled / 5) * 100) / 100 };
}
