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
import { readFreshSnapshot, readStaleSnapshot, snapshotKey, writeSnapshot } from "./snapshot-store";
import { getProviderCache, setProviderCache } from "./provider-cache";
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

const PACKAGE_TTL_SECONDS = 20 * 60;
const PACKAGE_KEEP_SECONDS = 6 * 3_600;

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

/**
 * The link that carries the *chosen* trip, not just the route.
 *
 * The ticket and the room the package was built from travel with the link, so
 * the next step opens with exactly that bus and that hotel already selected —
 * and the traveller can still change either of them.
 */
function continueUrl(pkg: Omit<TripPackage, "continueUrl">): string {
  const ticket = {
    mode: pkg.ticket.mode,
    operator: pkg.ticket.operator,
    service: pkg.ticket.serviceLabel,
    priceToman: pkg.ticket.priceToman,
    provider: pkg.ticket.providerLabel,
    providerLabel: pkg.ticket.providerLabel,
    bookingUrl: pkg.ticket.bookingUrl,
    departure: pkg.ticket.departure,
    arrival: pkg.ticket.arrival,
  };
  const stay = {
    name: pkg.stay.name,
    typeLabel: pkg.stay.typeLabel,
    location: pkg.stay.location,
    provider: pkg.stay.provider,
    providerLabel: pkg.stay.providerLabel,
    photo: pkg.stay.photo,
    rating: pkg.stay.rating,
    pricePerNightToman: pkg.stay.pricePerNightToman,
    priceTotalToman: pkg.stay.priceTotalToman,
    bookingUrl: pkg.stay.bookingUrl,
    nights: pkg.nights,
  };
  const query = new URLSearchParams({
    from: pkg.origin,
    to: pkg.destination,
    date: pkg.departureDate,
    return: pkg.returnDate,
    mode: pkg.ticket.mode,
    adults: String(pkg.travellers),
    nights: String(pkg.nights),
    pkg: pkg.id,
    tkt: JSON.stringify(ticket),
    stay: JSON.stringify(stay),
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
export function todaysPackageDestinations(origin: string, count: number, now = new Date(), offset = 0) {
  const day = Math.floor(now.getTime() / 86_400_000);
  const pool = PACKAGE_DESTINATIONS.filter((entry) => entry.city !== origin);
  const start = (((day + offset) % pool.length) + pool.length) % pool.length;
  const picked: typeof pool = [];
  for (let index = 0; index < pool.length && picked.length < count; index += 1) {
    const entry = pool[(start + index) % pool.length];
    if (!picked.some((item) => item.city === entry.city)) picked.push(entry);
  }
  return picked;
}

/**
 * Every press of «به‌روزرسانی» must move the row on. A clock bucket is not
 * enough — two presses in the same minute would show the same four cards — so a
 * small per-origin counter is stored and advanced on each forced refresh.
 */
async function nextRotation(origin: string, step: number): Promise<number> {
  const key = `safarino:deals:rotation:${origin}`;
  const stored = await getProviderCache<{ n: number }>(key);
  // Advancing by a whole row means no card from the last press repeats.
  const next = ((Number(stored?.n) || 0) + Math.max(1, step)) % 100_000;
  await setProviderCache(key, { n: next }, 86_400);
  return next;
}

async function buildPackage(
  origin: string,
  entry: { city: string; kind: "hotel" | "stay"; mode: TransportMode; days: number },
  travellers: number,
  departOffset: number,
  force = false,
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
    /**
     * Every mode that could realistically serve this route is searched at the
     * same time, and the cheapest real ticket wins — a train that does not run
     * that day must never make the traveller pay for a bus when a plane was
     * cheaper. The card always names the mode it actually found.
     */
    const modes: TransportMode[] = entry.mode === "bus" ? ["bus", "train", "plane"] : [entry.mode, "bus", "train"];
    const [transportAnswers, stayResult] = await Promise.all([
      Promise.all(modes.map((mode) => tryMode(mode))),
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

    const answered = transportAnswers.filter(
      (item): item is NonNullable<typeof item> => Boolean(item?.payload?.offers?.length),
    );
    // The cheapest outbound fare across the modes that really answered.
    const cheapestFare = (item: (typeof answered)[number]) => cheapest(item!.payload.offers)?.priceToman ?? Number.POSITIVE_INFINITY;
    answered.sort((a, b) => cheapestFare(a) - cheapestFare(b));
    const transport = answered[0] ?? null;
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

  // A saved package is served instantly. On a cold key the package is built
  // right here and stored, so `refreshed` (which only writes the snapshot) is
  // never awaited for its — empty — return value.
  // «به‌روزرسانی» must mean it: a forced refresh skips the saved copy entirely
  // and crawls the providers again.
  if (!force) {
    const fresh = await readFreshSnapshot<TripPackage>(base);
    if (fresh) return { ...fresh, fromStoredCopy: false };
  }

  const stale = force ? null : await readStaleSnapshot<TripPackage>(base);
  if (stale?.value) {
    // Show the last good package and rebuild in the background.
    void build()
      .then((value) => (value ? writeSnapshot(base, value, PACKAGE_TTL_SECONDS, PACKAGE_KEEP_SECONDS) : null))
      .catch(() => null);
    return { ...stale.value, fromStoredCopy: true };
  }

  const value = await build();
  if (value) await writeSnapshot(base, value, PACKAGE_TTL_SECONDS, PACKAGE_KEEP_SECONDS).catch(() => null);
  return value;
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
  /** Rebuild every package from the providers, ignoring the saved copy. */
  force?: boolean;
}): Promise<TripPackagesResult> {
  const origin = normaliseCity(options.origin) || "تهران";
  const travellers = Math.min(4, Math.max(1, Math.round(options.travellers || 1)));
  const limit = Math.min(6, Math.max(2, Math.round(options.limit || 4)));
  // «به‌روزرسانی» also moves the list on: a fresh crawl shows other real
  // destinations from the same city, not the same four cards with new numbers.
  const rotation = options.force ? (await nextRotation(origin, limit)) : 0;
  const destinations = todaysPackageDestinations(origin, limit, new Date(), rotation);
  const offsets = [3, 6, 10, 14, 18, 21];

  const settled = await Promise.all(
    destinations.map((entry, index) => withDeadline(buildPackage(origin, entry, travellers, offsets[index % offsets.length], options.force), 52_000)),
  );
  let packages = settled
    .filter((value): value is TripPackage => Boolean(value))
    .sort((a, b) => a.totalToman - b.totalToman);

  /**
   * A live crawl can come back mostly empty when a provider is slow that
   * minute. «به‌روزرسانی» must never turn a full row of real packages into an
   * empty shelf, so the last good packages are served (clearly marked) instead.
   */
  let fellBack = false;
  if (options.force && packages.length < 2) {
    const salvaged = await Promise.all(
      destinations.map((entry, index) => withDeadline(buildPackage(origin, entry, travellers, offsets[index % offsets.length], false), 52_000)),
    );
    const seen = new Set(packages.map((pkg) => pkg.id));
    salvaged.forEach((value) => {
      if (!value || seen.has(value.id)) return;
      seen.add(value.id);
      packages.push({ ...value, fromStoredCopy: true });
      fellBack = true;
    });
    packages = packages.sort((a, b) => a.totalToman - b.totalToman);
  }

  const storedCopy = fellBack || packages.some((pkg) => pkg.fromStoredCopy);
  return {
    success: true,
    origin,
    originSource: options.originSource || "default",
    packages,
    generatedAt: new Date().toISOString(),
    note: packages.length
      ? storedCopy
        ? fellBack
          ? "منابع در این لحظه پاسخ کامل ندادند؛ همان بسته‌های تأییدشدهٔ قبلی (ذخیره‌شده از منابع واقعی) نشان داده می‌شوند. قیمت نهایی را در صفحهٔ ارائه‌دهنده کنترل کنید."
          : "بخشی از این قیمت‌ها از نسخهٔ ذخیره‌شدهٔ کمتر از ۲۰ دقیقه پیش منابع است؛ قیمت نهایی را در صفحهٔ ارائه‌دهنده کنترل کنید."
        : "بلیت و اقامت هر بسته همین حالا از منابع رسمی خوانده شده‌اند؛ قیمت نهایی و ظرفیت را پیش از پرداخت در صفحهٔ ارائه‌دهنده کنترل کنید."
      : "منابع بلیت و اقامت الان پاسخ کامل ندادند. کمی بعد دوباره تلاش کنید یا مستقیم جست‌وجو را باز کنید.",
  };
}
