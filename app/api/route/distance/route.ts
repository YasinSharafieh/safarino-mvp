import { NextRequest, NextResponse } from "next/server";
import { resolveIranianCity } from "../../../../lib/iran-cities";
import { getProviderCache, setProviderCache } from "../../../../lib/provider-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const origin = resolveIranianCity(String(body.origin || ""));
    const destination = resolveIranianCity(String(body.destination || ""));
    if (!origin || !destination || origin.code === destination.code) {
      return NextResponse.json({ success: false, error: "مبدأ یا مقصد برای مسیریابی معتبر نیست." }, { status: 400 });
    }
    if (origin.latitude === undefined || origin.longitude === undefined || destination.latitude === undefined || destination.longitude === undefined) {
      return NextResponse.json({ success: false, error: "مسیریابی جاده‌ای برای این شهر هنوز در دسترس نیست." }, { status: 404 });
    }

    const cacheKey = `safarino:road-route:${origin.code}:${destination.code}`;
    const cached = await getProviderCache<Record<string, unknown>>(cacheKey);
    if (cached) return NextResponse.json({ success: true, cached: true, ...cached });

    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false&steps=false`, {
      headers: { Accept: "application/json", "User-Agent": "Safarino/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`OSRM_${response.status}`);
    const payload = await response.json();
    const route = payload?.routes?.[0];
    if (!route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      throw new Error("OSRM_ROUTE_NOT_FOUND");
    }

    const result = {
      provider: "osrm",
      origin: origin.name,
      destination: destination.name,
      distanceKm: Math.round(route.distance / 100) / 10,
      durationMinutes: Math.round(route.duration / 60),
      fetchedAt: new Date().toISOString(),
    };
    await setProviderCache(cacheKey, result, 86_400);
    return NextResponse.json({ success: true, cached: false, ...result });
  } catch {
    return NextResponse.json({ success: false, error: "دریافت مسیر جاده‌ای انجام نشد." }, { status: 502 });
  }
}
