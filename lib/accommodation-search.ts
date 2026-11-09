import type {
  AccommodationGroup,
  AccommodationOffer,
  AccommodationProvider,
  AccommodationSearchInput,
  ProviderSearchResult,
  ProviderSearchStatus,
} from "./accommodation-types";
import { PROVIDER_LABELS } from "./accommodation-types";
import { searchAlibabaAccommodation } from "./alibaba-accommodation";
import { searchJajigaAccommodation } from "./jajiga-accommodation";
import { searchJabamaAccommodation } from "./jabama-accommodation";
import { searchOtaghakAccommodation } from "./otaghak-accommodation";
import { searchSnapptripAccommodation } from "./snapptrip-accommodation";
import { searchEghamat24Accommodation } from "./eghamat24-accommodation";
import { normalizeTerm } from "./accommodation-provider-utils";

type Searcher = (input: AccommodationSearchInput) => Promise<ProviderSearchResult>;

const PROVIDERS: Record<AccommodationProvider, { kinds: readonly ("hotel" | "stay")[]; search: Searcher }> = {
  alibaba: {
    kinds: ["hotel", "stay"],
    search: async (input) => {
      const result = await searchAlibabaAccommodation(input);
      return { offers: result.offers, found: result.found, resolvedCity: result.city };
    },
  },
  jajiga: { kinds: ["stay"], search: searchJajigaAccommodation },
  jabama: { kinds: ["stay"], search: searchJabamaAccommodation },
  snapptrip: { kinds: ["hotel"], search: searchSnapptripAccommodation },
  otaghak: { kinds: ["stay"], search: searchOtaghakAccommodation },
  eghamat24: { kinds: ["hotel", "stay"], search: searchEghamat24Accommodation },
};

const PROVIDER_ORDER: AccommodationProvider[] = ["alibaba", "jajiga", "jabama", "snapptrip", "otaghak", "eghamat24"];

const GENERIC_NAME_TOKENS = new Set([
  "هتل", "هتل‌آپارتمان", "هتل‌اپارتمان", "آپارتمان", "اپارتمان", "سوئیت", "سوییت", "اقامتگاه",
  "بوتیک", "مهمان‌پذیر", "مهمان‌سرا", "مهمانخانه", "مسافرخانه", "اقامت", "خونه", "خانه",
  "ویلا", "دفتر", "شعبه", "رزرو", "آنلاین", "انلاین", "شب", "از", "در", "با", "و",
  "ستاره", "بزرگ", "کوچک", "بین‌المللی", "ایرانی", "ایرانگردی",
  "hotel", "apartment", "suite", "resort", "hostel", "guest", "house", "inn", "boutique",
]);

/** Folds letter variants, digits, punctuation and joins so two spellings meet in the middle. */
function fold(value: string): string {
  return normalizeTerm(value || "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ۀ|ة/g, "ه")
    .replace(/[\u200c\u200e\u200f]/g, " ")
    .replace(/[«»"'()\[\]{}.,،؛:!?\\/|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cityTokens(offer: AccommodationOffer): string[] {
  return fold(offer.location.split("،")[0] || "")
    .split(" ")
    .filter(Boolean);
}

/** Name words that actually identify the property, with the city and trading words removed. */
function nameTokens(offer: AccommodationOffer): string[] {
  const city = new Set(cityTokens(offer));
  return fold(offer.name)
    .split(" ")
    .filter((token) => token && !GENERIC_NAME_TOKENS.has(token) && !city.has(token));
}

function comparableName(offer: AccommodationOffer): string {
  return nameTokens(offer).join(" ");
}

function nameSimilarity(a: AccommodationOffer, b: AccommodationOffer): number {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (!left.length || !right.length) return 0;
  const first = new Set(left);
  const second = new Set(right);
  let shared = 0;
  first.forEach((token) => { if (second.has(token)) shared += 1; });
  const jaccard = shared / (first.size + second.size - shared);
  const containment = shared / Math.min(first.size, second.size);
  // Containment catches "پارس" vs "پارس آپارتمان" where one listing simply adds words.
  return Math.max(jaccard, containment * 0.95);
}

/** A shared distinctive word (long, not a number) is required before merging two names. */
function hasDistinctiveOverlap(a: AccommodationOffer, b: AccommodationOffer): boolean {
  const right = new Set(nameTokens(b));
  return nameTokens(a).some((token) => right.has(token) && token.length >= 4 && !/^\d+$/.test(token));
}

function distanceMeters(a: AccommodationOffer, b: AccommodationOffer): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) return null;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function sharedInventory(a: AccommodationOffer, b: AccommodationOffer): boolean {
  return a.kind === "stay" && b.kind === "stay" &&
    ((a.provider === "alibaba" && b.provider === "jabama") || (a.provider === "jabama" && b.provider === "alibaba")) &&
    a.providerPropertyId === b.providerPropertyId;
}

function sameCity(a: AccommodationOffer, b: AccommodationOffer): boolean {
  const left = cityTokens(a).join(" ");
  const right = cityTokens(b).join(" ");
  return !left || !right || left === right;
}

function starsCompatible(a: AccommodationOffer, b: AccommodationOffer): boolean {
  return a.stars === null || b.stars === null || a.stars === b.stars;
}

function verifiedNameLocation(a: AccommodationOffer, b: AccommodationOffer): boolean {
  if (a.kind !== b.kind) return false;
  if (!comparableName(a) || comparableName(a).length < 2) return false;
  if (!sameCity(a, b) || !starsCompatible(a, b)) return false;
  if (!hasDistinctiveOverlap(a, b)) return false;

  const distance = distanceMeters(a, b);
  const exactName = comparableName(a) === comparableName(b);
  const similarity = nameSimilarity(a, b);

  // An identical distinctive name in the same city is the same property even when one provider
  // publishes no map pin. A two-star gap means they are different buildings that share a name.
  if (exactName) {
    if (a.stars !== null && b.stars !== null && Math.abs(a.stars - b.stars) >= 2) return false;
    if (distance !== null && distance > 2_000) return false;
    return true;
  }

  // Different spellings still merge when both pins show the same building.
  if (distance !== null) return similarity >= 0.8 && distance <= 400;

  // With no coordinates at all only a near-identical name plus the same star rating is accepted.
  const ratedBoth = a.stars !== null && b.stars !== null && a.stars === b.stars;
  return ratedBoth && similarity >= 0.9;
}

function compatible(a: AccommodationOffer, b: AccommodationOffer): "shared_inventory" | "verified_name_location" | null {
  if (sharedInventory(a, b)) return "shared_inventory";
  if (verifiedNameLocation(a, b)) return "verified_name_location";
  return null;
}

export function deduplicateAccommodationOffers(offers: readonly AccommodationOffer[]): AccommodationGroup[] {
  const unique = new Map<string, AccommodationOffer>();
  for (const offer of offers) if (!unique.has(offer.id)) unique.set(offer.id, offer);
  const groups: AccommodationGroup[] = [];
  for (const offer of Array.from(unique.values())) {
    let matched: AccommodationGroup | null = null;
    let reason: AccommodationGroup["matchReason"] = "single";
    for (const group of groups) {
      const relationships = group.offers.map((existing) => compatible(existing, offer));
      if (relationships.every(Boolean)) {
        matched = group;
        reason = relationships.find((value) => value === "shared_inventory") || "verified_name_location";
        break;
      }
    }
    if (matched) {
      matched.offers.push(offer);
      matched.offers.sort((a, b) => a.priceTotalToman - b.priceTotalToman || a.provider.localeCompare(b.provider));
      matched.id = matched.offers[0].id;
      if (matched.offers.length > 1) matched.matchReason = reason;
    } else {
      groups.push({ id: offer.id, matchReason: "single", offers: [offer] });
    }
  }
  return groups.sort((a, b) => a.offers[0].priceTotalToman - b.offers[0].priceTotalToman);
}

function providerError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("CITY_NOT_FOUND")) return "این مقصد در فهرست عمومی منبع پیدا نشد.";
  if (message.includes("RATE_LIMIT") || message.includes("HTTP_429")) return "محدودیت موقت تعداد درخواست منبع؛ کمی بعد دوباره تلاش کنید.";
  return "پاسخ معتبر از این منبع دریافت نشد؛ نتایج سایر منابع حفظ شده است.";
}

export async function searchMultiProviderAccommodation(input: AccommodationSearchInput) {
  const supported = PROVIDER_ORDER.filter((provider) => PROVIDERS[provider].kinds.includes(input.kind));
  const settled = await Promise.allSettled(supported.map((provider) => PROVIDERS[provider].search(input)));
  const statuses: ProviderSearchStatus[] = [];
  const allOffers: AccommodationOffer[] = [];
  let resolvedCity = input.city;
  let succeeded = 0;

  for (const provider of PROVIDER_ORDER) {
    if (!supported.includes(provider)) {
      statuses.push({
        provider,
        label: PROVIDER_LABELS[provider],
        status: "not_supported",
        count: 0,
        found: 0,
        message: input.kind === "hotel" ? "در این مرحله برای جستجوی ویلا و اقامتگاه استفاده می‌شود." : "در این مرحله برای جستجوی هتل استفاده می‌شود.",
      });
      continue;
    }
    const index = supported.indexOf(provider);
    const result = settled[index];
    if (result.status === "rejected") {
      statuses.push({ provider, label: PROVIDER_LABELS[provider], status: "unavailable", count: 0, found: 0, message: providerError(result.reason) });
      continue;
    }
    succeeded += 1;
    const value = result.value;
    if (value.resolvedCity) resolvedCity = value.resolvedCity;
    allOffers.push(...value.offers);
    statuses.push({
      provider,
      label: PROVIDER_LABELS[provider],
      status: value.offers.length ? "ok" : "empty",
      count: value.offers.length,
      found: value.found,
      ...(value.offers.length ? {} : { message: "برای این تاریخ یا مقصد، پیشنهاد قیمت‌دار معتبر اعلام نشد." }),
    });
  }

  const groups = deduplicateAccommodationOffers(allOffers);
  const fetchedAt = new Date().toISOString();
  return {
    provider: "multi",
    kind: input.kind,
    city: resolvedCity,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    childAges: input.childAges,
    infantAges: input.infantAges,
    fetchedAt,
    found: statuses.reduce((sum, status) => sum + (status.status === "ok" || status.status === "empty" ? status.found : 0), 0),
    offerCount: allOffers.length,
    propertyCount: groups.length,
    deduplicatedCount: allOffers.length - groups.length,
    offers: groups.map((group) => group.offers[0]),
    groups,
    providerStatuses: statuses,
    partial: statuses.some((status) => status.status === "unavailable"),
    allProvidersFailed: succeeded === 0,
  };
}
