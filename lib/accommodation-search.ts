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
import { IRANIAN_CITIES } from "./iran-cities";

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
  "بوتیک", "مهمان‌پذیر", "مهمانپذیر", "مهمان", "پذیر", "مهمان‌سرا", "مهمانسرا", "سرا",
  "مهمانخانه", "مسافرخانه", "مسافر", "اقامت", "خونه", "خانه", "سنتی", "بوتیک",
  "ویلا", "دفتر", "شعبه", "رزرو", "آنلاین", "انلاین", "شب", "از", "در", "با", "و",
  "ستاره", "بزرگ", "کوچک", "ایرانی", "ایرانگردی",
  "بین", "المللی", "بین‌المللی", "بین المللی", "مللی", "مجتمع", "مجموعه", "واحد",
  "hotel", "apartment", "suite", "resort", "hostel", "guest", "house", "inn", "boutique",
]);

/** Folds letter variants, digits, punctuation and joins so two spellings meet in the middle. */
function fold(value: string): string {
  return normalizeTerm(value || "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ۀ|ة/g, "ه")
    .replace(/[\u200c\u200e\u200f]/g, "")
    .replace(/[«»"'()\[\]{}.,،؛:!?\\/|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Known Iranian city names that appear anywhere in the address, so "میدان آستانه" is not a city. */
const CITY_NAME_SET = new Set(IRANIAN_CITIES.map((city) => normalizeTerm(city.name)).filter((name) => name.length >= 3));

function cityTokens(offer: AccommodationOffer): string[] {
  return fold(offer.location)
    .split(" ")
    .filter((token) => CITY_NAME_SET.has(token));
}

/** Name words that actually identify the property, with the city and trading words removed. */
function nameWords(offer: AccommodationOffer): string[] {
  return fold(offer.name).split(" ").filter((token) => token && !GENERIC_NAME_TOKENS.has(token));
}

/**
 * Two readings of a property name: one dropping the city from that property's own address, one
 * dropping every Iranian city name. "الوند" is also a town, so only the second reading must never
 * be the only one used; matching succeeds when either reading lines up.
 */
function nameVariants(offer: AccommodationOffer): string[][] {
  const words = nameWords(offer);
  if (!words.length) return [];
  const addressCities = new Set(cityTokens(offer));
  const withoutAddressCity = words.filter((token) => !addressCities.has(token));
  const withoutAnyCity = words.filter((token) => !addressCities.has(token) && !CITY_NAME_SET.has(token));
  const variants = [withoutAddressCity, withoutAnyCity].filter((list) => list.length > 0);
  // "هتل تهران مشهد" is a real hotel name: when every word is a city, keep them all.
  return variants.length ? variants : [words];
}

function nameTokens(offer: AccommodationOffer): string[] {
  return nameVariants(offer)[0] || [];
}

function comparableName(offer: AccommodationOffer): string {
  return nameTokens(offer).join(" ");
}

/** Name words with the trailing numbers removed: "الماس ۱" and "الماس" name the same building. */
function nameJaccardWithoutNumbers(a: AccommodationOffer, b: AccommodationOffer): number {
  const clean = (offer: AccommodationOffer) => nameTokens(offer).filter((token) => !/^\d+$/.test(token));
  return jaccardOf(clean(a), clean(b));
}

function jaccardOf(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const first = new Set(left);
  const second = new Set(right);
  let shared = 0;
  first.forEach((token) => { if (second.has(token)) shared += 1; });
  return shared / (first.size + second.size - shared);
}

function nameJaccard(a: AccommodationOffer, b: AccommodationOffer): number {
  let best = 0;
  for (const left of nameVariants(a)) {
    for (const right of nameVariants(b)) best = Math.max(best, jaccardOf(left, right));
  }
  return best;
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
/** Providers send 0 for "not rated", which must not count as a zero-star hotel. */
function knownStars(offer: AccommodationOffer): number | null {
  return offer.stars !== null && offer.stars > 0 ? offer.stars : null;
}

function hasDistinctiveOverlap(a: AccommodationOffer, b: AccommodationOffer): boolean {
  const right = new Set(nameTokens(b));
  return nameTokens(a).some((token) => right.has(token) && token.length >= 3 && !/^\d+$/.test(token));
}

/** A 0/0 or out-of-country pin is a placeholder, not a location. */
function usablePin(latitude: number | null, longitude: number | null): boolean {
  return latitude !== null && longitude !== null
    && latitude >= 24 && latitude <= 40 && longitude >= 44 && longitude <= 64;
}

function vagueAddress(offer: AccommodationOffer): boolean {
  return fold(offer.location).split(" ").filter(Boolean).length <= 2;
}

function distanceMeters(a: AccommodationOffer, b: AccommodationOffer): number | null {
  if (!usablePin(a.latitude, a.longitude) || !usablePin(b.latitude, b.longitude)) return null;
  const aLat = Number(a.latitude);
  const aLng = Number(a.longitude);
  const bLat = Number(b.latitude);
  const bLng = Number(b.longitude);
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function sharedInventory(a: AccommodationOffer, b: AccommodationOffer): boolean {
  return a.kind === "stay" && b.kind === "stay" &&
    ((a.provider === "alibaba" && b.provider === "jabama") || (a.provider === "jabama" && b.provider === "alibaba")) &&
    a.providerPropertyId === b.providerPropertyId;
}

/**
 * Providers format the address differently ("مشهد، خیابان…" vs "آدرس: مشهد- …"), so raw string
 * comparison is unreliable. Two cards share a city when they name at least one of the same
 * Iranian cities; when an address names no known city, the other one decides.
 */
function sameCity(a: AccommodationOffer, b: AccommodationOffer): boolean {
  const left = cityTokens(a);
  const right = cityTokens(b);
  if (!left.length || !right.length) return true;
  return left.some((token) => right.includes(token));
}

function starsCompatible(a: AccommodationOffer, b: AccommodationOffer): boolean {
  return a.stars === null || b.stars === null || a.stars === b.stars;
}

type MatchStrength = "shared_inventory" | "exact_name" | "similar_name";

function nameMatch(a: AccommodationOffer, b: AccommodationOffer): MatchStrength | null {
  if (a.kind !== b.kind) return null;
  const nameA = comparableName(a);
  if (!nameA || nameA.length < 2) return null;
  if (!sameCity(a, b)) return null;

  const distance = distanceMeters(a, b);
  const variantsB = nameVariants(b).map((list) => list.join(" "));
  const exactName = nameVariants(a).map((list) => list.join(" ")).some((value) => value && variantsB.includes(value));
  // An identical name is proof on its own; a shared word needs at least three letters.
  if (!exactName && !hasDistinctiveOverlap(a, b)) return null;
  const similarity = nameSimilarity(a, b);
  // One provider only says "شیراز" and its pin is a city-level placeholder, so it cannot veto a merge.
  const loosePin = vagueAddress(a) || vagueAddress(b);

  // An identical full name in the same building is that hotel, whatever each provider writes about it.
  if (exactName) {
    if (distance !== null && distance <= 400) return "exact_name";
    // Apart or unplaced: then a two-star gap means two different buildings sharing a name.
    const leftStars = knownStars(a);
    const rightStars = knownStars(b);
    const starsAgree = leftStars === null || rightStars === null || Math.abs(leftStars - rightStars) <= 1;
    if (!starsAgree) return null;
    if (distance === null || loosePin || distance <= 25_000) return "exact_name";
    return null;
  }

  // A different spelling must cover most of both names ("هتل پارس" vs "پارس" is fine,
  // "الماس" vs "الماس نوین" is not: those are two hotels in the same street).
  const overlap = nameJaccard(a, b);
  if (distance !== null) {
    if (overlap >= 0.75 && distance <= 400) return "similar_name";
    // Same words, only a house number added ("الماس ۱" vs "الماس"), on the same building.
    const sameNumberLess = nameJaccardWithoutNumbers(a, b) >= 0.9;
    const sameStars = knownStars(a) !== null && knownStars(a) === knownStars(b);
    if (sameNumberLess && sameStars && distance <= 120) return "similar_name";
    return null;
  }

  // Different spellings with no coordinates need a near-identical name and the same star level.
  const ratedBoth = knownStars(a) !== null && knownStars(a) === knownStars(b);
  return ratedBoth && overlap >= 0.9 ? "similar_name" : null;
}

function compatible(a: AccommodationOffer, b: AccommodationOffer): MatchStrength | null {
  if (sharedInventory(a, b)) return "shared_inventory";
  return nameMatch(a, b);
}

/**
 * Some providers publish one city-level pin for every property (the same coordinate repeats for
 * dozens of hotels). Such a pin says nothing about the building, so it must not decide a merge.
 */
function markPlaceholderPins(offers: AccommodationOffer[]): AccommodationOffer[] {
  const counts = new Map<string, number>();
  for (const offer of offers) {
    if (offer.latitude === null || offer.longitude === null) continue;
    const key = `${offer.provider}:${offer.latitude.toFixed(4)}:${offer.longitude.toFixed(4)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return offers.map((offer) => {
    if (offer.latitude === null || offer.longitude === null) return offer;
    const key = `${offer.provider}:${offer.latitude.toFixed(4)}:${offer.longitude.toFixed(4)}`;
    if ((counts.get(key) || 0) < 3) return offer;
    return { ...offer, latitude: null, longitude: null };
  });
}

/**
 * Groups the same property offered by different providers. Merging is transitive: if provider A and
 * B describe one hotel and B also matches C, all three belong to one card, because the card still
 * lists every provider with its own name, price and booking link.
 */
/**
 * Groups the same property offered by different providers.
 * Strong evidence (shared inventory, an identical name) is merged transitively, because the card
 * still lists every provider with its own name, price and booking link. A merely similar spelling
 * only joins when it fits every member of that card, so one shared word cannot chain two hotels.
 */
export function deduplicateAccommodationOffers(offers: readonly AccommodationOffer[]): AccommodationGroup[] {
  const unique = new Map<string, AccommodationOffer>();
  for (const offer of offers) if (!unique.has(offer.id)) unique.set(offer.id, offer);
  const list = markPlaceholderPins(Array.from(unique.values()));

  const parent = list.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    let walk = index;
    while (parent[walk] !== walk) {
      const next = parent[walk];
      parent[walk] = root;
      walk = next;
    }
    return root;
  };
  const reasons = new Map<number, AccommodationGroup["matchReason"]>();

  const similarPairs: [number, number][] = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const relationship = compatible(list[i], list[j]);
      if (!relationship) continue;
      if (relationship === "similar_name") {
        similarPairs.push([i, j]);
        continue;
      }
      const rootA = find(i);
      const rootB = find(j);
      if (rootA === rootB) continue;
      parent[rootB] = rootA;
      if (relationship === "shared_inventory") {
        reasons.set(rootA, "shared_inventory");
      } else if (!reasons.has(rootA)) {
        reasons.set(rootA, "verified_name_location");
      }
    }
  }

  // Weaker matches join only a card they fit completely.
  for (const [i, j] of similarPairs) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI === rootJ) continue;
    const membersI = list.filter((_, index) => find(index) === rootI);
    const membersJ = list.filter((_, index) => find(index) === rootJ);
    const fitsI = membersI.every((member) => compatible(member, list[j]));
    const fitsJ = membersJ.every((member) => compatible(member, list[i]));
    if (!fitsI && !fitsJ) continue;
    parent[rootJ] = rootI;
    if (!reasons.has(rootI)) reasons.set(rootI, "verified_name_location");
  }

  const buckets = new Map<number, AccommodationOffer[]>();
  list.forEach((offer, index) => {
    const root = find(index);
    const bucket = buckets.get(root) || [];
    bucket.push(offer);
    buckets.set(root, bucket);
  });

  const groups: AccommodationGroup[] = [];
  buckets.forEach((bucket, root) => {
    bucket.sort((a, b) => a.priceTotalToman - b.priceTotalToman || a.provider.localeCompare(b.provider));
    groups.push({
      id: bucket[0].id,
      matchReason: bucket.length > 1 ? reasons.get(root) || "verified_name_location" : "single",
      offers: bucket,
    });
  });

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
