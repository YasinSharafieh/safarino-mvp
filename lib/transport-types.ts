import { IRANIAN_CITIES } from "./iran-cities";
import { alibabaJalaliDate } from "./alibaba-flights";

export type TransportMode = "plane" | "train" | "bus";
export type TransportProviderId = "alibaba" | "safar724";

export type TransportOffer = {
  id: string;
  provider: TransportProviderId;
  mode: TransportMode;
  /** Company / airline / operator name. */
  operator: string;
  /** Service number or class shown next to the operator. */
  serviceLabel: string;
  departure: string;
  arrival: string | null;
  priceToman: number;
  childPriceToman: number | null;
  infantPriceToman: number | null;
  /** null when the public listing does not state the remaining capacity. */
  seatsLeft: number | null;
  details: string[];
  /** Link to the exact service or, when the provider has no per-service page, to its dated route page. */
  bookingUrl: string;
  bookingNote: string;
  /** Identical seat/listings found at other providers, kept so no purchase link is lost. */
  alsoAvailableAt?: {
    provider: TransportProviderId;
    providerLabel: string;
    priceToman: number;
    bookingUrl: string;
    seatsLeft: number | null;
  }[];
};

export type ProviderStatus = {
  provider: TransportProviderId;
  label: string;
  status: "ok" | "unsupported" | "failed";
  count: number;
  found: number;
  message?: string;
};

export type TransportSearchResult = {
  success: boolean;
  mode: TransportMode;
  origin: string;
  destination: string;
  date: string;
  returnDate?: string;
  offers: TransportOffer[];
  returningOffers: TransportOffer[];
  duplicateCount: number;
  providerStatuses: ProviderStatus[];
  fetchedAt: string;
};

export const PROVIDER_LABELS: Record<TransportProviderId, string> = {
  alibaba: "علی‌بابا",
  safar724: "سفر۷۲۴",
};

/** English slug per provider; each provider spells Iranian cities differently. */
const PROVIDER_SLUG_OVERRIDES: Record<string, string> = {
  isfahan: "esfahan",
  "bandar abbas": "bandarabbas",
  "bandar anzali": "bandareanzali",
  "bandar lengeh": "bandarlengeh",
  "bandar-e anzali": "bandareanzali",
  kish: "kish",
  qeshm: "qeshm",
  orumiyeh: "urmia",
  ahwaz: "ahvaz",
  hamedan: "hamadan",
  masuleh: "masouleh",
};

export function citySlug(value: string): string | null {
  const raw = value.trim().toLowerCase();
  const city = IRANIAN_CITIES.find((item) =>
    item.code.toLowerCase() === raw
    || (item.flightCode || "").toLowerCase() === raw
    || (item.groundCode || "").toLowerCase() === raw
    || item.name === value.trim()
    || (item.englishName || "").toLowerCase() === raw,
  );
  const english = (city?.englishName || value).trim().toLowerCase();
  if (!english || !/^[a-z][a-z -]*$/.test(english)) return null;
  const normalized = english.replace(/\s+/g, " ");
  return PROVIDER_SLUG_OVERRIDES[normalized] || normalized.replace(/[\s-]/g, "");
}

export function persianCityName(value: string): string | null {
  const city = IRANIAN_CITIES.find((item) =>
    item.code.toLowerCase() === value.trim().toLowerCase()
    || (item.flightCode || "").toLowerCase() === value.trim().toLowerCase()
    || (item.groundCode || "").toLowerCase() === value.trim().toLowerCase()
    || item.name === value.trim()
    || (item.englishName || "").toLowerCase() === value.trim().toLowerCase(),
  );
  return city?.name ?? null;
}

export function jalaliRangeLabel(date: string): string {
  return alibabaJalaliDate(date);
}

/** Folds Persian/Arabic letter variants, digits and zero-width joiners into one comparable form. */
function foldText(value: string): string {
  return (value || "")
    .toLowerCase()
    .replace(/[۰-۹٠-٩]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[أإآ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ۀ|ة/g, "ه")
    .replace(/\u200c|\u200e|\u200f/g, " ")
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/[«»"'()\[\]{}.,،؛:!?\\/|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Trading words that say nothing about which company the ticket belongs to. */
const OPERATOR_NOISE = new Set([
  "شرکت", "تعاونی", "اتوبوس", "اتوبوسهای", "اتوبوسرانی", "قطار", "قطارهای", "هواپیمایی",
  "راه", "آهن", "حمل", "نقل", "مسافری", "مسافربری", "بین", "شهری", "بینشهری", "سریع",
  "سهامی", "خاص", "عام", "درجه", "آژانس", "مسافر",
  "ترابری", "ریلی", "خط", "co", "company", "bus", "train", "express",
]);

function operatorTokens(value: string): string[] {
  return foldText(value)
    .split(" ")
    .filter((token) => token.length > 0 && !OPERATOR_NOISE.has(token));
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const first = new Set(a);
  const second = new Set(b);
  let shared = 0;
  first.forEach((token) => { if (second.has(token)) shared += 1; });
  return shared / (first.size + second.size - shared);
}

/**
 * Two operators can be spelled "تعاونی ۱۱ آریا سفر", "آریا سفر" or "شرکت آریاسفر" across
 * providers. They count as the same company when the distinctive words overlap enough,
 * and a purely numeric token match (train/flight numbers) never proves identity alone.
 */
function sameOperatorName(a: string, b: string): boolean {
  const left = operatorTokens(a);
  const right = operatorTokens(b);
  if (!left.length || !right.length) return foldText(a) === foldText(b);
  if (left.join(" ") === right.join(" ")) return true;
  const shared = left.filter((token) => right.includes(token) && !/^\d+$/.test(token) && token.length >= 3);
  if (!shared.length) return false;
  return jaccard(left, right) >= 0.6;
}

function departureMinutes(value: string): number | null {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return Math.round(time / 60000);
}

/** Same calendar day and a departure gap small enough to be clock rounding, not another departure. */
function sameDeparture(a: TransportOffer, b: TransportOffer): boolean {
  const left = departureMinutes(a.departure);
  const right = departureMinutes(b.departure);
  if (left === null || right === null) return a.departure.slice(0, 16) === b.departure.slice(0, 16);
  return Math.abs(left - right) <= 15;
}

function priceGapRatio(a: number, b: number): number {
  const smallest = Math.min(a, b);
  if (!smallest) return 1;
  return Math.abs(a - b) / smallest;
}

/**
 * Conservative duplicate rule (near-identical names included):
 *  - the same company, even when each provider spells it differently,
 *  - the same departure within a quarter of an hour,
 *  - two prices that are clearly the same fare (within 15%), never two classes or cabins.
 * Exact repeats inside one provider collapse too. A removed row is not thrown away: its
 * provider, price and purchase link are attached to the surviving offer instead.
 */
export function dedupeTransportOffers(offers: TransportOffer[]): { offers: TransportOffer[]; removed: number } {
  const kept: TransportOffer[] = [];
  let removed = 0;

  for (const offer of offers) {
    const duplicate = kept.find((item) => {
      if (item.mode !== offer.mode) return false;
      if (!sameDeparture(item, offer)) return false;
      if (!sameOperatorName(item.operator, offer.operator)) return false;
      // A provider repeating its own row must also match on price; two providers may differ slightly.
      const tolerance = item.provider === offer.provider ? 0.02 : 0.15;
      return priceGapRatio(item.priceToman, offer.priceToman) <= tolerance;
    });

    if (!duplicate) {
      kept.push({ ...offer });
      continue;
    }

    removed += 1;
    if (duplicate.provider === offer.provider) continue;
    const alternates = duplicate.alsoAvailableAt || [];
    if (!alternates.some((item) => item.provider === offer.provider && item.bookingUrl === offer.bookingUrl)) {
      alternates.push({
        provider: offer.provider,
        providerLabel: PROVIDER_LABELS[offer.provider],
        priceToman: offer.priceToman,
        bookingUrl: offer.bookingUrl,
        seatsLeft: offer.seatsLeft,
      });
      duplicate.alsoAvailableAt = alternates.sort((a, b) => a.priceToman - b.priceToman);
    }
  }

  return { offers: kept, removed };
}
