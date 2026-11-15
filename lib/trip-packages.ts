/**
 * «پیشنهادهای ویژه» as real, bookable trips — not hotel cards with a price.
 *
 * For a few Iranian destinations, Safarino composes a complete package from the
 * same live data the rest of the site uses:
 *   • the cheapest real ticket (train / plane / bus) there and back,
 *   • the cheapest real room for exactly those nights,
 *   • dates, night count and a single total, cheapest first.
 *
 * Nothing is invented: a package only exists when a ticket and a room were both
 * read from a provider a moment ago. Everything else is dropped with a reason.
 */

import { searchMultiProviderAccommodation } from "./accommodation-search";
import { PROVIDER_LABELS as STAY_PROVIDER_LABELS } from "./accommodation-types";
import { IRANIAN_CITIES } from "./iran-cities";
import { readWithRefresh, snapshotKey } from "./snapshot-store";
import { searchTransport, type TransportSearchPayload } from "./transport-search";
import type { TransportMode, TransportOffer } from "./transport-types";

export type PackageTicket = {
  mode: TransportMode;
  modeLabel: string;
  operator: string;
  serviceLabel: string;
  departure: string;
  arrival: string | null;
  priceToman: number;
  providerLabel: string;
  bookingUrl: string;
  /** true when the return leg price is the outbound fare, clearly labelled as such. */
  returnEstimated: boolean;
};

export type PackageStay = {
  name: string;
  typeLabel: string;
  location: string;
  provider: string;
  providerLabel: string;
  photo: string | null;
  rating: number | null;
  reviewCount: number;
  pricePerNightToman: number;
  priceTotalToman: number;
  bookingUrl: string;
};

export type TripPackage = {
  id: string;
  origin: string;
  destination: string;
  days: number;
  nights: number;
  departureDate: string;
  returnDate: string;
  travellers: number;
  ticket: PackageTicket;
  stay: PackageStay;
  ticketTotalToman: number;
  stayTotalToman: number;
  totalToman: number;
  /** Everything the traveller needs to continue into the normal flow. */
  continueUrl: string;
  fetchedAt: string;
  fromStoredCopy: boolean;
};

export type TripPackagesResult = {
  success: boolean;
  origin: string;
  originSource: "request" | "geo" | "default";
  packages: TripPackage[];
  generatedAt: string;
  note: string;
};

const MODE_LABELS: Record<TransportMode, string> = { train: "قطار", plane: "هواپیما", bus: "اتوبوس" };

/** Destinations offered on the home page; rotated every day so the section changes. */
const PACKAGE_DESTINATIONS: { city: string; kind: "hotel" | "stay"; mode: TransportMode; days: number }[] = [
  { city: "مشهد", kind: "hotel", mode: "train", days: 3 },
  { city: "اصفهان", kind: "stay", mode: "train", days: 2 },
  { city: "شیراز", kind: "hotel", mode: "plane", days: 3 },
  { city: "یزد", kind: "stay", mode: "train", days: 2 },
  { city: "تبریز", kind: "hotel", mode: "plane", days: 3 },
  { city: "کیش", kind: "hotel", mode: "plane", days: 4 },
  { city: "رشت", kind: "stay", mode: "bus", days: 2 },
  { city: "همدان", kind: "hotel", mode: "bus", days: 3 },
  { city: "قشم", kind: "stay", mode: "plane", days: 4 },
  { city: "کرمان", kind: "hotel", mode: "train", days: 3 },
  { city: "بندرعباس", kind: "stay", mode: "plane", days: 3 },
  { city: "کاشان", kind: "stay", mode: "bus", days: 2 },
  { city: "اردبیل", kind: "hotel", mode: "bus", days: 3 },
  { city: "بوشهر", kind: "hotel", mode: "plane", days: 3 },
];

function cleanDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
}

/** A city name from a header or the query string, matched against the real city list. */
export function normaliseCity(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = cleanDigits(decodeURIComponent(value)).trim();
  if (!raw) return null;
  const city = IRANIAN_CITIES.find(
    (item) =>
      item.name === raw ||
      item.name.replace(/\s+/g, "") === raw.replace(/\s+/g, "") ||
      item.code.toLowerCase() === raw.toLowerCase() ||
      (item.englishName || "").toLowerCase() === raw.toLowerCase(),
  );
  return city?.name ?? null;
}

function isoIn(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function photoSource(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? url : `/api/provider-assets?src=${encodeURIComponent(url)}`;
}

function cheapest(offers: TransportOffer[]): TransportOffer | null {
  const valid = offers.filter((offer) => offer.priceToman > 0 && offer.bookingUrl);
  if (!valid.length) return null;
  return valid.sort((a, b) => a.priceToman - b.priceToman)[0];
}

function continueUrl(pkg: Omit<TripPackage, "continueUrl">): string {
  const query = new URLSearchParams({
    from: pkg.origin,
    to: pkg.destination,
    date: pkg.departureDate,
    return: pkg.returnDate,
    mode: pkg.ticket.mode,
    adults: String(pkg.travellers),
    nights: String(pkg.nights),
    pkg: pkg.id,
  });
  return `/transport?${query.toString()}`;
}

function withDeadline<T>(task: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    task.catch(() => null),
    new Promise<null>((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      if (typeof timer === "object" && typeof (timer as { unref?: () => void }).unref === "function") {
        (timer as unknown as { unref: () => void }).unref();
      }
    }),
  ]);
}

/** A few destinations for today, never the traveller's own city. */
export function todaysPackageDestinations(origin: string, count: number, now = new Date()) {
  const day = Math.floor(now.getTime() / 86_400_000);
  const pool = PACKAGE_DESTINATIONS.filter((entry) => entry.city !== origin);
  const start = day % pool.length;
  const picked: typeof pool = [];
  for (let index = 0; index < pool.length && picked.length < count; index += 1) {
    const entry = pool[(start + index) % pool.length];
    if (!picked.some((item) => item.city === entry.city)) picked.push(entry);
  }
  return picked;
}

async function buildPackage(
  origin: string,
  entry: { city: string; kind: "hotel" | "stay"; mode: TransportMode; days: number },
  travellers: number,
  departOffset: number,
): Promise<TripPackage | null> {
  const destination = entry.city;
  const nights = Math.max(1, entry.days - 1);
  const departureDate = isoIn(departOffset);
  const returnDate = isoIn(departOffset + nights);
  const base = snapshotKey("trip-package-v1", {
    origin,
    destination,
    mode: entry.mode,
    kind: entry.kind,
    departureDate,
    returnDate,
    travellers,
  });

  const build = async (): Promise<TripPackage | null> => {
    /**
     * The planned mode is a suggestion, not a promise: a city may have no train
     * that day. Every alternative is searched for real and the mode that
     * actually answered is the one the card shows.
     */
    const tryMode = async (mode: TransportMode) => {
      const result = await withDeadline(
        searchTransport({ mode, origin, destination, date: departureDate, returnDate, adults: travellers, children: 0, infants: 0 }),
        40_000,
      );
      return result?.payload?.offers?.length ? result : null;
    };
    const [transportFirst, stayResult] = await Promise.all([
      tryMode(entry.mode),
      withDeadline(
        searchMultiProviderAccommodation({
          kind: entry.kind,
          city: destination,
          checkIn: departureDate,
          checkOut: returnDate,
          adults: travellers,
          childAges: [],
          infantAges: [],
        }),
        40_000,
      ),
    ]);

    let transport = transportFirst;
    if (!transport) {
      for (const fallback of (["train", "bus", "plane"] as TransportMode[]).filter((mode) => mode !== entry.mode)) {
        transport = await tryMode(fallback);
        if (transport) break;
      }
    }
    const payload: TransportSearchPayload | null = transport?.payload ?? null;
    const outbound = payload ? cheapest(payload.offers) : null;
    const inbound = payload ? cheapest(payload.returningOffers) : null;
    const stayOffer = stayResult?.offers
      ?.filter((offer) => offer.pricePerNightToman > 0 && offer.bookingUrl)
      .sort((a, b) => a.priceTotalToman - b.priceTotalToman)[0];
    if (!outbound || !stayOffer) return null;

    // A return ticket we could not read is not silently dropped: the package is
    // priced on the outbound fare and marked as an estimate.
    const returnEstimated = !inbound;
    const backPrice = inbound ? inbound.priceToman : outbound.priceToman;
    const ticketTotal = outbound.priceToman + backPrice;

    const ticket: PackageTicket = {
      mode: payload?.mode ?? entry.mode,
      modeLabel: MODE_LABELS[payload?.mode ?? entry.mode],
      operator: outbound.operator,
      serviceLabel: inbound ? `${outbound.serviceLabel} رفت · ${inbound.serviceLabel} برگشت` : outbound.serviceLabel,
      departure: outbound.departure,
      arrival: outbound.arrival,
      priceToman: ticketTotal,
      providerLabel: payload?.providerStatuses?.find((status) => status.status === "ok")?.label || "علی‌بابا",
      bookingUrl: outbound.bookingUrl,
      returnEstimated,
    };

    // Some providers publish only a short name («پاییز»); the type in front keeps
    // the card honest and readable without inventing anything.
    const shortName = stayOffer.name.trim().length <= 8 && !stayOffer.name.includes(stayOffer.typeLabel.split(" ")[0]);
    const stay: PackageStay = {
      name: shortName ? `${stayOffer.typeLabel.split(" ")[0]} ${stayOffer.name}`.trim() : stayOffer.name,
      typeLabel: stayOffer.typeLabel,
      location: stayOffer.location,
      provider: stayOffer.provider,
      providerLabel: STAY_PROVIDER_LABELS[stayOffer.provider] || stayOffer.provider,
      photo: photoSource(stayOffer.imageUrl || stayOffer.images?.[0] || null),
      rating: stayOffer.rating,
      reviewCount: stayOffer.reviewCount,
      pricePerNightToman: stayOffer.pricePerNightToman,
      priceTotalToman: stayOffer.priceTotalToman,
      bookingUrl: stayOffer.bookingUrl,
    };

    const draft = {
      id: `${origin}-${destination}-${payload?.mode ?? entry.mode}-${departureDate}`.replace(/\s+/g, "-"),
      origin,
      destination,
      days: entry.days,
      nights,
      departureDate,
      returnDate,
      travellers,
      ticket,
      stay,
      ticketTotalToman: ticketTotal,
      stayTotalToman: stay.priceTotalToman,
      totalToman: ticketTotal + stay.priceTotalToman,
      fetchedAt: new Date().toISOString(),
      fromStoredCopy: false,
    } satisfies Omit<TripPackage, "continueUrl">;
    return { ...draft, continueUrl: continueUrl(draft) };
  };

  const { snapshot, source, refreshed } = await readWithRefresh<TripPackage | null>(base, build, {
    ttlSeconds: 20 * 60,
    keepSeconds: 6 * 3_600,
  });
  if (source === "live" && refreshed) {
    const value = await refreshed();
    return value ?? null;
  }
  if (snapshot?.value) {
    if (source === "stale-cache" && refreshed) void refreshed();
    return { ...snapshot.value, fromStoredCopy: source === "stale-cache" };
  }
  return null;
}

/**
 * The home-page packages: several destinations from the traveller's own city,
 * each priced with real tickets and a real room, cheapest first.
 */
export async function loadTripPackages(options: {
  origin: string;
  originSource?: "request" | "geo" | "default";
  travellers?: number;
  limit?: number;
}): Promise<TripPackagesResult> {
  const origin = normaliseCity(options.origin) || "تهران";
  const travellers = Math.min(4, Math.max(1, Math.round(options.travellers || 1)));
  const limit = Math.min(6, Math.max(2, Math.round(options.limit || 4)));
  const destinations = todaysPackageDestinations(origin, limit);
  const offsets = [3, 6, 10, 14, 18, 21];

  const settled = await Promise.all(
    destinations.map((entry, index) => withDeadline(buildPackage(origin, entry, travellers, offsets[index % offsets.length]), 52_000)),
  );
  const packages = settled
    .filter((value): value is TripPackage => Boolean(value))
    .sort((a, b) => a.totalToman - b.totalToman);

  const storedCopy = packages.some((pkg) => pkg.fromStoredCopy);
  return {
    success: true,
    origin,
    originSource: options.originSource || "default",
    packages,
    generatedAt: new Date().toISOString(),
    note: packages.length
      ? storedCopy
        ? "بخشی از این قیمت‌ها از نسخهٔ ذخیره‌شدهٔ کمتر از ۲۰ دقیقه پیش منابع است؛ قیمت نهایی را در صفحهٔ ارائه‌دهنده کنترل کنید."
        : "بلیت و اقامت هر بسته همین حالا از منابع رسمی خوانده شده‌اند؛ قیمت نهایی و ظرفیت را پیش از پرداخت در صفحهٔ ارائه‌دهنده کنترل کنید."
      : "منابع بلیت و اقامت الان پاسخ کامل ندادند. کمی بعد دوباره تلاش کنید یا مستقیم جست‌وجو را باز کنید.",
  };
}
