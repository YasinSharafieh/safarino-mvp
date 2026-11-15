import { NextRequest, NextResponse } from "next/server";
import { searchTransport, type TransportSearchInput } from "../../../../../lib/transport-search";
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
    return NextResponse.json(
      {
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
