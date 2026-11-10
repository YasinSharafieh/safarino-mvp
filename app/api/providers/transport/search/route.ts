import { NextRequest, NextResponse } from "next/server";
import { readWithRefresh, snapshotKey, writeSnapshot } from "../../../../../lib/snapshot-store";

/** Ticket lists change faster than hotels, so the saved copy lives for 20 minutes. */
const FRESH_SECONDS = 1_200;
const KEEP_SECONDS = 43_200;
import { searchAlibabaFlights } from "../../../../../lib/alibaba-flights";
import { searchAlibabaTrains, searchAlibabaBuses } from "../../../../../lib/alibaba-ground";
import { searchSafar724Buses } from "../../../../../lib/safar724-bus";
import {
  dedupeTransportOffers,
  PROVIDER_LABELS,
  type ProviderStatus,
  type TransportMode,
  type TransportOffer,
  type TransportProviderId,
} from "../../../../../lib/transport-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

type SearchInput = {
  mode: TransportMode;
  origin: string;
  destination: string;
  date: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
};

function parseInput(body: unknown): SearchInput | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const mode = String(input.mode || "").trim();
  if (!["plane", "train", "bus"].includes(mode)) return null;
  const origin = String(input.origin || "").trim().toUpperCase();
  const destination = String(input.destination || "").trim().toUpperCase();
  const date = String(input.date || "").trim();
  if (!origin || !destination || origin === destination) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return null;
  const returnDate = String(input.returnDate || "").trim();
  if (returnDate && (!/^\d{4}-\d{2}-\d{2}$/.test(returnDate) || returnDate < date)) return null;
  const adults = integer(input.adults, 1, 1, 9);
  const children = integer(input.children, 0, 0, 9);
  const infants = integer(input.infants, 0, 0, adults);
  return { mode: mode as TransportMode, origin, destination, date, adults, children, infants, ...(returnDate ? { returnDate } : {}) };
}

/** Alibaba keeps its own response shape; map it onto the shared offer type. */
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

export async function POST(request: NextRequest) {
  let input: SearchInput | null;
  try {
    input = parseInput(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: "بدنه درخواست باید JSON معتبر باشد." }, { status: 400 });
  }
  if (!input) {
    return NextResponse.json({ success: false, error: "مبدأ، مقصد و تاریخ سفر معتبر نیست." }, { status: 400 });
  }

  const { mode, origin, destination, date, returnDate, adults, children, infants } = input;

  // Saved answer first: an identical search must never crawl again.
  const started = Date.now();
  const base = snapshotKey("transport", { mode, origin, destination, date, returnDate: returnDate || "", adults, children, infants });
  const saved = await readWithRefresh<Record<string, unknown>>(base, async () => crawl(input!), {
    ttlSeconds: FRESH_SECONDS,
    keepSeconds: KEEP_SECONDS,
  });
  if (saved.snapshot) {
    if (saved.source === "stale-cache" && saved.refreshed) void saved.refreshed();
    return NextResponse.json(
      { ...saved.snapshot.value, cached: true, fromStore: saved.source === "stale-cache" ? "last-saved" : "just-fetched", savedAt: saved.snapshot.storedAt },
      { headers: { "Cache-Control": "no-store", "X-Safarino-Source": saved.source, "X-Safarino-Ms": String(Date.now() - started) } },
    );
  }

  const live = await crawl(input);
  await writeSnapshot(base, live, FRESH_SECONDS, KEEP_SECONDS);
  return NextResponse.json(
    { ...live, cached: false, fromStore: "crawled-now" },
    { headers: { "Cache-Control": "no-store", "X-Safarino-Source": "live", "X-Safarino-Ms": String(Date.now() - started) } },
  );
}

/** The actual provider crawl; kept separate so the snapshot store can call it. */
async function crawl(input: SearchInput): Promise<Record<string, unknown>> {
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
    offers: merged.offers,
    returningOffers: mergedReturning.offers,
    duplicateCount: merged.removed,
    providerStatuses: statuses.sort((a, b) => a.provider.localeCompare(b.provider)),
    fetchedAt: new Date().toISOString(),
  };
}

function infoUrl(result: Record<string, unknown>, mode: TransportMode, input: SearchInput): string {
  const direct = result.bookingUrl;
  if (typeof direct === "string" && direct.startsWith("https://")) return direct;
  return `https://www.alibaba.ir/${mode === "plane" ? "flights" : mode}/${input.origin}-${input.destination}`;
}

function returnUrl(result: Record<string, unknown>, mode: TransportMode, input: SearchInput): string {
  const returning = result.returnBookingUrl;
  if (typeof returning === "string" && returning.startsWith("https://")) return returning;
  return infoUrl(result, mode, { ...input, origin: input.destination, destination: input.origin });
}
