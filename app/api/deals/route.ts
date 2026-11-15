import { NextRequest, NextResponse } from "next/server";
import { loadTripPackages, normaliseCity, type TripPackagesResult } from "@/lib/trip-packages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/deals — the home page's «پیشنهادهای ویژه», now real composed trips.
 *
 * The traveller's own city becomes the origin: from the explicit `from` query,
 * else from the edge's city header (Vercel sets `x-vercel-ip-city`), else from a
 * sensible default. Nothing personal is stored or returned beyond the city name
 * the traveller could see in their own browser anyway.
 */
function originFromRequest(request: NextRequest): { origin: string; source: "request" | "geo" | "default" } {
  const fromQuery = normaliseCity(request.nextUrl.searchParams.get("from"));
  if (fromQuery) return { origin: fromQuery, source: "request" };

  const headers = request.headers;
  const candidates = [
    headers.get("x-vercel-ip-city"),
    headers.get("x-city"),
    headers.get("cf-ipcity"),
  ];
  for (const candidate of candidates) {
    const city = normaliseCity(candidate);
    if (city) return { origin: city, source: "geo" };
  }
  return { origin: "تهران", source: "default" };
}

function emptyResult(origin: string, source: "request" | "geo" | "default", note: string): TripPackagesResult {
  return {
    success: true,
    origin,
    originSource: source,
    packages: [],
    generatedAt: new Date().toISOString(),
    note,
  };
}

export async function GET(request: NextRequest) {
  const { origin, source } = originFromRequest(request);
  const travellers = Math.min(4, Math.max(1, Number(request.nextUrl.searchParams.get("travellers")) || 1));
  // `fresh=1` is the traveller pressing «به‌روزرسانی»: crawl instead of serving
  // the saved copy, so the numbers (and the destinations) really move.
  const force = ["1", "true", "yes"].includes((request.nextUrl.searchParams.get("fresh") || "").toLowerCase());
  try {
    const result = await loadTripPackages({ origin, originSource: source, travellers, limit: 4, force });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      emptyResult(origin, source, "ساخت بسته‌های سفر در این لحظه انجام نشد. یک بار دیگر تلاش کنید یا مستقیم جست‌وجو را باز کنید."),
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
