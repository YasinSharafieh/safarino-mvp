import { NextRequest, NextResponse } from "next/server";
import { publicProviderJson } from "../../../../../lib/public-provider-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function shape(value: unknown, depth = 0): unknown {
  if (depth > 4) return "…";
  if (Array.isArray(value)) return value.length ? [shape(value[0], depth + 1)] : [];
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, shape(item, depth + 1)]));
  }
  return typeof value;
}

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text") || "مشهد";
  try {
    const locations = await publicProviderJson("https://hapi.snapptrip.com/hotel/api/v2/search-text", {
      query: { text, token: "Jek", provider: "flightio" },
      headers: { Referer: "https://www.snapptrip.com/", Origin: "https://www.snapptrip.com", channel: "web" },
    });
    const locationBody = locations as Record<string, unknown>;
    const list = Array.isArray(locations) ? locations : (locationBody.cities || locationBody.items || locationBody.locations || locationBody.data) as unknown;
    const first = Array.isArray(list) ? list[0] as Record<string, unknown> : null;
    const cityId = Number(first?.id ?? first?.city_id);
    const search = await publicProviderJson("https://hapi.snapptrip.com/hotel/api/v2/search-city", {
      query: { city_id: cityId, date_from: "2026-11-20", date_to: "2026-11-22", page: 1, order_by: "best_selling", token: "Jek", no_rooms: 1 },
      headers: { Referer: "https://www.snapptrip.com/", Origin: "https://www.snapptrip.com", channel: "web" },
      timeoutMs: 25_000,
    });
    const body = search as Record<string, unknown>;
    const hotels = (Array.isArray(search) ? search : (body.hotels || body.items || body.hotelsData)) as unknown[] | undefined;
    return NextResponse.json({
      ok: true,
      locationKeys: first ? Object.keys(first) : [],
      locationSample: first,
      searchTopKeys: Array.isArray(search) ? "array" : Object.keys(body),
      hotelCount: Array.isArray(hotels) ? hotels.length : null,
      hotelShape: hotels && hotels[0] ? shape(hotels[0]) : null,
      hotelSample: hotels && hotels[0] ? hotels[0] : null,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
