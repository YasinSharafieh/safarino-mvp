/**
 * «پیشنهادهای ویژه» — real offers, never a hard-coded price.
 *
 * Every card on the home page comes from a live multi-provider search (علی‌بابا،
 * جاجیگا، جاباما، اسنپ‌تریپ، اتاقک، اقامت۲۴) for a real Iranian city and real
 * dates. The cities rotate by day, so the section actually changes, and each
 * answer is snapshotted for a few hours so the home page stays fast and the
 * providers are not crawled on every visit.
 *
 * If nothing at all can be fetched the caller gets an empty list with a reason —
 * the site then says so instead of inventing «از ۳٬۲۰۰٬۰۰۰ تومان».
 */

import { searchMultiProviderAccommodation } from "./accommodation-search";
import { PROVIDER_LABELS, type AccommodationOffer } from "./accommodation-types";
import { readWithRefresh, snapshotKey } from "./snapshot-store";

export type Deal = {
  id: string;
  name: string;
  city: string;
  kind: "hotel" | "stay";
  typeLabel: string;
  location: string;
  photo: string | null;
  rating: number | null;
  reviewCount: number;
  pricePerNightToman: number;
  priceTotalToman: number;
  discountPercent: number;
  provider: string;
  providerLabel: string;
  bookingUrl: string;
  nights: number;
  checkIn: string;
  checkOut: string;
};

export type DealCity = {
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  deals: Deal[];
  providers: string[];
  /** true when the answer came from the saved copy instead of a fresh search. */
  fromStoredCopy: boolean;
};

export type DealsResult = {
  cities: DealCity[];
  generatedAt: string;
  note: string;
};

/** Cities featured on the home page, rotated one per day. */
export const DEAL_CITIES: { city: string; kind: "hotel" | "stay" }[] = [
  { city: "مشهد", kind: "hotel" },
  { city: "اصفهان", kind: "stay" },
  { city: "شیراز", kind: "hotel" },
  { city: "یزد", kind: "stay" },
  { city: "تبریز", kind: "hotel" },
  { city: "رشت", kind: "stay" },
  { city: "کیش", kind: "hotel" },
  { city: "قشم", kind: "stay" },
  { city: "همدان", kind: "hotel" },
  { city: "کرمان", kind: "stay" },
  { city: "تهران", kind: "hotel" },
  { city: "بندرعباس", kind: "stay" },
];

/** Two cities per day, offset so the pair changes every day. */
export function todaysDealCities(now = new Date()): { city: string; kind: "hotel" | "stay" }[] {
  const day = Math.floor(now.getTime() / 86_400_000);
  const first = day % DEAL_CITIES.length;
  const second = (first + Math.floor(DEAL_CITIES.length / 2)) % DEAL_CITIES.length;
  return [DEAL_CITIES[first], DEAL_CITIES[second]];
}

function isoIn(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toDeal(offer: AccommodationOffer, city: string, checkIn: string, checkOut: string, nights: number): Deal {
  return {
    id: offer.id,
    name: offer.name,
    city,
    kind: offer.kind,
    typeLabel: offer.typeLabel,
    location: offer.location,
    photo: offer.imageUrl || offer.images[0] || null,
    rating: offer.rating,
    reviewCount: offer.reviewCount,
    pricePerNightToman: offer.pricePerNightToman,
    priceTotalToman: offer.priceTotalToman,
    discountPercent: offer.discountPercent,
    provider: offer.provider,
    providerLabel: PROVIDER_LABELS[offer.provider] || offer.provider,
    bookingUrl: offer.bookingUrl,
    nights,
    checkIn,
    checkOut,
  };
}

async function loadCity(entry: { city: string; kind: "hotel" | "stay" }, limit: number): Promise<DealCity | null> {
  const nights = 2;
  const checkIn = isoIn(10);
  const checkOut = isoIn(10 + nights);
  const base = snapshotKey("deals-home", { city: entry.city, kind: entry.kind, checkIn, nights });

  const { snapshot, source, refreshed } = await readWithRefresh<DealCity>(base, async () => {
    const result = await searchMultiProviderAccommodation({
      kind: entry.kind,
      city: entry.city,
      checkIn,
      checkOut,
      adults: 2,
      childAges: [],
      infantAges: [],
    });
    const offers = result.offers
      .filter((offer) => offer.pricePerNightToman > 0)
      .sort((a, b) => a.pricePerNightToman - b.pricePerNightToman)
      .slice(0, limit);
    if (result.allProvidersFailed) throw new Error("no provider answered");
    const providers = Array.from(new Set(result.offers.map((offer) => PROVIDER_LABELS[offer.provider] || offer.provider)));
    // An empty answer is still an answer: it is stored so the providers are not
    // asked again on every visit, and it is never shown as a price.
    return {
      city: result.city || entry.city,
      checkIn,
      checkOut,
      nights,
      deals: offers.map((offer) => toDeal(offer, result.city || entry.city, checkIn, checkOut, nights)),
      providers,
      fromStoredCopy: false,
    } satisfies DealCity;
  }, { ttlSeconds: 6 * 3_600, keepSeconds: 86_400 });

  if (source === "live" && refreshed) {
    // Nothing stored yet: do the real search now (this is the first visitor of
    // the day for this city).
    await refreshed();
    const stored = await readWithRefresh<DealCity>(base, async () => null, { ttlSeconds: 6 * 3_600, keepSeconds: 86_400 });
    if (stored.snapshot?.value) return { ...stored.snapshot.value, fromStoredCopy: false };
    return null;
  }

  if (!snapshot?.value) return null;
  if (source === "stale-cache" && refreshed) {
    // Serve the saved copy immediately and refresh in the background.
    void refreshed();
  }
  return { ...snapshot.value, fromStoredCopy: source !== "fresh-cache" };
}

/**
 * The home-page deal list. Two Iranian cities, cheapest real rooms first.
 * Never throws: a failure is reported as an empty list with a plain reason.
 */
/** Resolves with null instead of throwing when the budget runs out. */
function withDeadline<T>(task: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    task.catch(() => null),
    new Promise<null>((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      // Never keep the lambda alive just for the timer.
      if (typeof timer === "object" && typeof (timer as { unref?: () => void }).unref === "function") {
        (timer as unknown as { unref: () => void }).unref();
      }
    }),
  ]);
}

export async function loadHomeDeals(limitPerCity = 3): Promise<DealsResult> {
  const pair = todaysDealCities();
  // A first (cold) visit must not hang the page: each city gets its own budget,
  // and whatever answers in time is shown and stored for the next visitor.
  const settled = await Promise.all(pair.map((entry) => withDeadline(loadCity(entry, limitPerCity), 34_000)));
  const cities = settled.filter((value): value is DealCity => Boolean(value && value.deals.length));

  const storedCopy = cities.some((city) => city.fromStoredCopy);
  return {
    cities,
    generatedAt: new Date().toISOString(),
    note: cities.length
      ? storedCopy
        ? "بخشی از این قیمت‌ها از نسخهٔ ذخیره‌شدهٔ چند ساعت پیش منابع است و ممکن است تغییر کرده باشد."
        : "همهٔ این قیمت‌ها همین حالا از منابع رسمی خوانده شده‌اند؛ قیمت نهایی و موجودی را در صفحهٔ ارائه‌دهنده بررسی کنید."
      : "منابع اقامتگاه الان پاسخ ندادند. یک بار دیگر تلاش کنید یا مستقیم جست‌وجوی اقامتگاه را باز کنید.",
  };
}
