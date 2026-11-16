/**
 * One place that talks to the ticket providers.
 *
 * The transport page and the home-page trip packages both need the same live
 * answer for the same route and date, so the search lives here: one crawl, one
 * saved snapshot, and both screens show exactly the same numbers and links.
 */

import { readWithRefresh, snapshotKey, writeSnapshot } from "./snapshot-store";
import { searchAlibabaFlights } from "./alibaba-flights";
import { searchAlibabaTrains, searchAlibabaBuses } from "./alibaba-ground";
import { searchSafar724Buses } from "./safar724-bus";
import {
  dedupeTransportOffers,
  PROVIDER_LABELS,
  type ProviderStatus,
  type TransportMode,
  type TransportOffer,
  type TransportProviderId,
} from "./transport-types";

/** Ticket lists change faster than hotels, so the saved copy lives for 20 minutes. */
export const TRANSPORT_FRESH_SECONDS = 1_200;
export const TRANSPORT_KEEP_SECONDS = 43_200;

export type TransportSearchInput = {
  mode: TransportMode;
  origin: string;
  destination: string;
  date: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
};

export type TransportSearchPayload = {
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

/** The live answer, served from the shared snapshot store when one exists. */
export async function searchTransport(input: TransportSearchInput): Promise<{ payload: TransportSearchPayload; source: string; savedAt?: string }> {
  const base = snapshotKey("transport-v2", {
    mode: input.mode,
    origin: input.origin,
    destination: input.destination,
    date: input.date,
    returnDate: input.returnDate || "",
    adults: input.adults,
    children: input.children,
    infants: input.infants,
  });
  const saved = await readWithRefresh<TransportSearchPayload>(base, async () => crawlTransport(input), {
    ttlSeconds: TRANSPORT_FRESH_SECONDS,
    keepSeconds: TRANSPORT_KEEP_SECONDS,
  });
  if (saved.snapshot) {
    if (saved.source === "stale-cache" && saved.refreshed) void saved.refreshed();
    return { payload: saved.snapshot.value, source: saved.source, savedAt: saved.snapshot.storedAt };
  }
  const live = await crawlTransport(input);
  await writeSnapshot(base, live, TRANSPORT_FRESH_SECONDS, TRANSPORT_KEEP_SECONDS);
  return { payload: live, source: "live" };
}

function fromAlibabaFlights(rows: unknown): TransportOffer[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((value): TransportOffer[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const price = Number(row.priceToman);
    const departure = String(row.departure || "");
    if (!Number.isFinite(price) || price <= 0 || !departure) return [];
    const airline = String(row.airline || "پرواز");
    const flightNumber = String(row.flightNumber || "");
    return [{
      id: String(row.id || `${airline}-${flightNumber}-${departure}`),
      provider: "alibaba",
      mode: "plane",
      operator: airline,
      logoUrl: row.logoUrl ? String(row.logoUrl) : null,
      serviceLabel: flightNumber,
      departure,
      arrival: row.arrival ? String(row.arrival) : null,
      priceToman: Math.round(price),
      childPriceToman: Number.isFinite(Number(row.childPriceToman)) ? Number(row.childPriceToman) : null,
      infantPriceToman: Number.isFinite(Number(row.infantPriceToman)) ? Number(row.infantPriceToman) : null,
      seatsLeft: Number.isFinite(Number(row.seatsLeft)) ? Number(row.seatsLeft) : null,
      details: [
        row.fareClass ? String(row.fareClass) : "",
        row.aircraft ? String(row.aircraft) : "",
        row.baggageKg ? `${String(row.baggageKg)} کیلوگرم بار` : "",
      ].filter(Boolean),
      bookingUrl: "",
      bookingNote: "",
    }];
  });
}

function fromAlibabaGround(rows: unknown, mode: "train" | "bus", bookingUrl: string): TransportOffer[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((value): TransportOffer[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const price = Number(row.priceToman);
    const departure = String(row.departure || "");
    if (!Number.isFinite(price) || price <= 0 || !departure) return [];
    return [{
      id: String(row.id || `${mode}-${departure}`),
      provider: "alibaba",
      mode,
      operator: String(row.title || (mode === "train" ? "قطار" : "اتوبوس")),
      logoUrl: row.logoUrl ? String(row.logoUrl) : null,
      serviceLabel: String(row.subtitle || ""),
      departure,
      arrival: row.arrival ? String(row.arrival) : null,
      priceToman: Math.round(price),
      childPriceToman: null,
      infantPriceToman: null,
      seatsLeft: Number.isFinite(Number(row.seatsLeft)) ? Number(row.seatsLeft) : null,
      details: Array.isArray(row.details) ? row.details.map(String) : [],
      bookingUrl,
      bookingNote: "این بلیت در فهرست عمومی علی‌بابا است؛ با باز شدن صفحه، همان مسیر و تاریخ را ببین و شرکت و ساعت ردیف را تطبیق بده.",
    }];
  });
}

const STATUS_MESSAGES: Record<string, string> = {
  PROVIDER_RATE_LIMIT_EXCEEDED: "سهمیهٔ جستجوی این منبع پر شده است؛ کمی بعد دوباره تلاش کنید.",
  ALIBABA_HTTP_403: "علی‌بابا در حال حاضر به این سرور پاسخ نمی‌دهد.",
};

function statusFor(provider: TransportProviderId, count: number, found: number, error?: unknown): ProviderStatus {
  const label = PROVIDER_LABELS[provider];
  if (!error) return { provider, label, status: count > 0 ? "ok" : "ok", count, found };
  const message = error instanceof Error ? error.message : String(error);
  return {
    provider,
    label,
    status: "failed",
    count,
    found,
    message: STATUS_MESSAGES[message] || "این منبع در این جستجو پاسخ نداد.",
  };
}

/** The actual provider crawl; kept separate so the snapshot store can call it. */
async function crawlTransport(input: TransportSearchInput): Promise<TransportSearchPayload> {
  const { mode, origin, destination, date, returnDate, adults, children, infants } = input;
  const statuses: ProviderStatus[] = [];
  const bundles: TransportOffer[][] = [];
  const returningBundles: TransportOffer[][] = [];

  const tasks: Promise<void>[] = [];

  const alibabaTask = (async () => {
    try {
      if (mode === "plane") {
        const result = await searchAlibabaFlights({ origin, destination, date, adults, children, infants, ...(returnDate ? { returnDate } : {}) });
        const legacy = result as unknown as Record<string, unknown>;
        const offers = fromAlibabaFlights(result.flights);
        const returning = fromAlibabaFlights(result.returning);
        const bookingUrl = infoUrl(legacy, "plane", input!);
        const withLinks = offers.map((offer) => ({ ...offer, bookingUrl, bookingNote: "صفحهٔ همین مسیر و تاریخ در علی‌بابا باز می‌شود؛ ردیف پرواز را تطبیق بده." }));
        const returningWithLinks = returning.map((offer) => ({ ...offer, bookingUrl: returnUrl(legacy, "plane", input!), bookingNote: "صفحهٔ همین مسیر و تاریخ بازگشت در علی‌بابا باز می‌شود." }));
        bundles.push(withLinks);
        returningBundles.push(returningWithLinks);
        statuses.push(statusFor("alibaba", withLinks.length, Number(result.count) || withLinks.length));
      } else if (mode === "train") {
        const result = await searchAlibabaTrains({ origin, destination, date, adults, children, infants, ...(returnDate ? { returnDate } : {}) });
        const offers = fromAlibabaGround(result.offers, "train", result.bookingUrl);
        const returning = fromAlibabaGround(result.returningOffers, "train", result.bookingUrl);
        bundles.push(offers);
        returningBundles.push(returning);
        statuses.push(statusFor("alibaba", offers.length, Number(result.count) || offers.length));
      } else {
        const result = await searchAlibabaBuses({ origin, destination, date, adults, children, infants, ...(returnDate ? { returnDate } : {}) });
        const offers = fromAlibabaGround(result.offers, "bus", result.bookingUrl);
        const returning = fromAlibabaGround(result.returningOffers, "bus", result.bookingUrl);
        bundles.push(offers);
        returningBundles.push(returning);
        statuses.push(statusFor("alibaba", offers.length, Number(result.count) || offers.length));
      }
    } catch (error) {
      statuses.push(statusFor("alibaba", 0, 0, error));
    }
  })();
  tasks.push(alibabaTask);

  if (mode === "bus") {
    tasks.push((async () => {
      const result = await searchSafar724Buses(origin, destination, date);
      bundles.push(result.offers);
      if (returnDate) {
        const back = await searchSafar724Buses(destination, origin, returnDate);
        returningBundles.push(back.offers);
      }
      statuses.push({
        provider: "safar724",
        label: PROVIDER_LABELS.safar724,
        status: result.status,
        count: result.offers.length,
        found: result.offers.length,
        message: result.message,
      });
    })());
  }

  await Promise.all(tasks);

  const merged = dedupeTransportOffers(bundles.flat().sort((a, b) => a.priceToman - b.priceToman));
  const mergedReturning = dedupeTransportOffers(returningBundles.flat().sort((a, b) => a.priceToman - b.priceToman));

  return {
    success: true,
    mode,
    origin,
    destination,
    date,
    ...(returnDate ? { returnDate } : {}),
    offers: merged.offers.map(readableOffer),
    returningOffers: mergedReturning.offers.map(readableOffer),
    duplicateCount: merged.removed,
    providerStatuses: statuses.sort((a, b) => a.provider.localeCompare(b.provider)),
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * One shape for everybody: every consumer (the ticket list, the plan, the
 * printed book) gets `title`, `subtitle` and `logoUrl` next to the internal
 * names, so no page can end up showing a bare «قطار» instead of the company.
 */
/** Provider text with Persian digits, so «4 ستاره» reads like «۴ ستاره». */
function faDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function readableOffer(offer: TransportOffer): TransportOffer & { title: string; subtitle: string; logoUrl: string | null } {
  return {
    ...offer,
    operator: offer.operator || (offer.mode === "train" ? "قطار" : offer.mode === "bus" ? "اتوبوس" : "هواپیما"),
    title: faDigits(offer.operator || (offer.mode === "train" ? "قطار" : offer.mode === "bus" ? "اتوبوس" : "هواپیما")),
    subtitle: faDigits(offer.serviceLabel || ""),
    details: offer.details.map((detail) => faDigits(detail)),
    logoUrl: offer.logoUrl || null,
  };
}

function infoUrl(result: Record<string, unknown>, mode: TransportMode, input: TransportSearchInput): string {
  const direct = result.bookingUrl;
  if (typeof direct === "string" && direct.startsWith("https://")) return direct;
  return `https://www.alibaba.ir/${mode === "plane" ? "flights" : mode}/${input.origin}-${input.destination}`;
}

function returnUrl(result: Record<string, unknown>, mode: TransportMode, input: TransportSearchInput): string {
  const returning = result.returnBookingUrl;
  if (typeof returning === "string" && returning.startsWith("https://")) return returning;
  return infoUrl(result, mode, { ...input, origin: input.destination, destination: input.origin });
}


export { PROVIDER_LABELS };
