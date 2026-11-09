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

/**
 * Conservative duplicate rule: the same operator and the same departure minute
 * with a price within 2% is the same seat sold by two providers.
 */
export function dedupeTransportOffers(offers: TransportOffer[]): { offers: TransportOffer[]; removed: number } {
  const kept: TransportOffer[] = [];
  let removed = 0;
  const normalizeOperator = (value: string) => value.replace(/\s+/g, "").replace(/ي/g, "ی");
  for (const offer of offers) {
    const duplicate = kept.find((item) => {
      if (item.provider === offer.provider) return false;
      if (normalizeOperator(item.operator) !== normalizeOperator(offer.operator)) return false;
      if (item.departure.slice(0, 16) !== offer.departure.slice(0, 16)) return false;
      const gap = Math.abs(item.priceToman - offer.priceToman);
      return gap <= Math.max(1_000, Math.round(Math.min(item.priceToman, offer.priceToman) * 0.02));
    });
    if (duplicate) removed += 1;
    else kept.push(offer);
  }
  return { offers: kept, removed };
}
