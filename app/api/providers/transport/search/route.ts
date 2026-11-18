import { NextRequest, NextResponse } from "next/server";
import { priceWatchKey, readPriceTrend, recordPrice } from "@/lib/price-watch";
import { searchTransport, ticketAvailability, type TransportSearchInput } from "../../../../../lib/transport-search";
import type { TransportMode } from "../../../../../lib/transport-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

/** Everything the browser sends is re-checked here; the search itself lives in lib/transport-search. */
function parseInput(body: unknown): TransportSearchInput | null {
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

/**
 * `GET /api/providers/transport/search?availability=30&mode=…&origin=…&destination=…`
 * answers which of the next days really have a ticket, measured one real search
 * per day. Anything the providers fail on is left out rather than guessed.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const base = parseInput({
    mode: params.get("mode"),
    origin: params.get("origin"),
    destination: params.get("destination"),
    date: params.get("date") || new Date(Date.now() + 3.5 * 3_600_000).toISOString().slice(0, 10),
    adults: params.get("adults"),
    children: params.get("children"),
    infants: params.get("infants"),
  });
  if (!base) return NextResponse.json({ success: false, error: "مسیر یا وسیلهٔ سفر معتبر نیست." }, { status: 400 });
  const days = Math.min(45, Math.max(7, Math.round(Number(params.get("availability")) || 30)));
  const { dates, checked } = await ticketAvailability(base, days);
  return NextResponse.json({
    success: true,
    mode: base.mode,
    origin: base.origin,
    destination: base.destination,
    days,
    dates,
    checked,
    note: "هر روز با یک جست‌وجوی واقعی از منبع بلیت بررسی شده؛ روزی که در این فهرست نیست یا بلیت نداشته یا منبع پاسخ نداده است.",
  });
}

export async function POST(request: NextRequest) {
  let input: TransportSearchInput | null;
  try {
    input = parseInput(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: "بدنه درخواست باید JSON معتبر باشد." }, { status: 400 });
  }
  if (!input) {
    return NextResponse.json({ success: false, error: "مبدأ، مقصد و تاریخ سفر معتبر نیست." }, { status: 400 });
  }

  const started = Date.now();
  try {
    const { payload, source, savedAt } = await searchTransport(input);

    /**
     * One true reading for the price watch: the cheapest total this search really
     * returned, with the number of offers beside it. Recorded only when the data
     * came from a live crawl, so a saved copy never pretends to be a new price.
     */
    let trend: Awaited<ReturnType<typeof recordPrice>> = null;
    if (source === "live" && payload.offers.length) {
      const cheapest = payload.offers.reduce(
        (best, offer) => Math.min(best, offer.priceToman * input.adults + (offer.childPriceToman || 0) * input.children),
        Number.POSITIVE_INFINITY,
      );
      if (Number.isFinite(cheapest) && cheapest > 0) {
        trend = await recordPrice({
          key: priceWatchKey("transport", {
            mode: input.mode,
            origin: input.origin,
            destination: input.destination,
            date: input.date,
            adults: input.adults,
          }),
          priceToman: cheapest,
          offers: payload.offers.length,
        });
      }
    } else {
      trend = await readPriceTrend(
        priceWatchKey("transport", {
          mode: input.mode,
          origin: input.origin,
          destination: input.destination,
          date: input.date,
          adults: input.adults,
        }),
      );
    }

    return NextResponse.json(
      {
        ...(trend ? { priceTrend: trend } : {}),
        ...payload,
        cached: source !== "live",
        fromStore: source === "live" ? "crawled-now" : source === "stale-cache" ? "last-saved" : "just-fetched",
        ...(savedAt ? { savedAt } : {}),
      },
      { headers: { "Cache-Control": "no-store", "X-Safarino-Source": source, "X-Safarino-Ms": String(Date.now() - started) } },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "جست‌وجوی بلیت در این لحظه انجام نشد؛ کمی بعد دوباره تلاش کنید." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
