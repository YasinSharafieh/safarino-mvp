import { NextRequest, NextResponse } from "next/server";
import { searchCityPois } from "../../../../lib/poi-search";
import { attachPlaceDetails } from "../../../../lib/place-photos";
import { buildItinerary, rescheduleDay, type ItineraryDay, type ItineraryPlace } from "../../../../lib/itinerary";
import { neshanAvailable, neshanPairDistances, type NeshanPair } from "../../../../lib/neshan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  city?: unknown;
  days?: unknown;
  stopsPerDay?: unknown;
  origin?: { latitude?: unknown; longitude?: unknown } | null;
  places?: unknown;
};

function asPlace(value: unknown): ItineraryPlace | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const latitude = Number(item.latitude);
  const longitude = Number(item.longitude);
  if (!item.id || typeof item.id !== "string" || typeof item.name !== "string") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    id: item.id,
    name: item.name,
    category: typeof item.category === "string" ? item.category : "جاذبه",
    latitude,
    longitude,
    distanceKm: Number.isFinite(Number(item.distanceKm)) ? Number(item.distanceKm) : null,
    notability: Number.isFinite(Number(item.notability)) ? Number(item.notability) : undefined,
    address: typeof item.address === "string" ? item.address : "",
    source: typeof item.source === "string" ? item.source : "",
    sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : "",
    wikipediaUrl: typeof item.wikipediaUrl === "string" ? item.wikipediaUrl : null,
    description: typeof item.description === "string" ? item.description : "",
    imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
    imageKind: item.imageKind === "photo" || item.imageKind === "map" ? item.imageKind : "none",
    imageCreditUrl: typeof item.imageCreditUrl === "string" ? item.imageCreditUrl : null,
  };
}

/**
 * Builds the day-by-day plan and measures every driving leg with Neshan.
 * Days are clustered by real geography, stops are ordered from the
 * accommodation outwards, and each leg's distance/time comes from Neshan's
 * traffic-aware matrix — one request per day.
 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست معتبر نیست." }, { status: 400 });
  }

  const city = typeof body.city === "string" ? body.city.trim().slice(0, 80) : "";
  const days = Math.min(14, Math.max(1, Number(body.days) || 3));
  const stopsPerDay = Math.min(6, Math.max(2, Number(body.stopsPerDay) || 4));
  const originLat = Number(body.origin?.latitude);
  const originLng = Number(body.origin?.longitude);
  const origin = Number.isFinite(originLat) && Number.isFinite(originLng) && originLat !== 0 && originLng !== 0
    ? { latitude: originLat, longitude: originLng }
    : null;

  let places: ItineraryPlace[] = Array.isArray(body.places)
    ? (body.places.map(asPlace).filter(Boolean) as ItineraryPlace[])
    : [];

  let cityLabel = city;
  let poiNote = "";
  let sources: Record<string, string> = {};
  if (!places.length) {
    if (!city) return NextResponse.json({ success: false, error: "نام مقصد یا فهرست جاذبه‌ها لازم است." }, { status: 400 });
    const found = await searchCityPois(city, 30);
    places = found.pois.map((poi) => ({
      id: poi.id,
      name: poi.name,
      category: poi.category,
      latitude: poi.latitude,
      longitude: poi.longitude,
      distanceKm: poi.distanceKm,
      notability: (poi as { notability?: number }).notability,
      source: poi.source,
      sourceUrl: poi.sourceUrl,
      wikipediaUrl: poi.wikipediaUrl,
    }));
    cityLabel = found.city || city;
    poiNote = found.note;
    sources = found.sources as unknown as Record<string, string>;
  }

  if (!places.length) {
    return NextResponse.json({ success: false, city: cityLabel, error: "برای این مقصد جاذبهٔ تأییدشده‌ای پیدا نشد؛ هیچ مکان ساختگی ساخته نمی‌شود." }, { status: 200 });
  }

  // Photos and short descriptions make the plan readable and printable.
  await attachPlaceDetails(places, { maxPhotos: Math.min(places.length, 30) });

  const itinerary = buildItinerary(places, { days, stopsPerDay, origin });

  // Measure each leg with Neshan: stay → stop 1 → stop 2 → …
  const neshanReady = neshanAvailable();
  let engine = neshanReady ? "نشان" : "OpenStreetMap";
  const measuredDays: ItineraryDay[] = [];
  for (const day of itinerary.days) {
    const legs: NeshanPair[] = [];
    let previous: { latitude: number; longitude: number } | null = origin;
    day.stops.forEach((stop) => {
      if (previous) legs.push({ from: previous, to: { latitude: stop.place.latitude, longitude: stop.place.longitude } });
      previous = { latitude: stop.place.latitude, longitude: stop.place.longitude };
    });
    let legItems: ({ distanceKm: number; durationMinutes: number } | null)[] = [];
    if (neshanReady && legs.length) {
      const result = await neshanPairDistances(legs);
      if (result.status === "ok") legItems = result.items;
      else if (result.status === "failed") engine = "نشان (بخشی ناموفق)";
    }
    const stops = day.stops.map((stop, index) => {
      const measured = legItems[index] || null;
      return {
        ...stop,
        legKm: measured ? measured.distanceKm : null,
        legMinutes: measured ? measured.durationMinutes : null,
        legEngine: measured ? "نشان" : "بدون اندازه‌گیری",
      };
    });
    measuredDays.push(rescheduleDay({ ...day, stops }));
  }

  const totalKm = Math.round(measuredDays.reduce((sum, day) => sum + day.totalKm, 0) * 10) / 10;
  const totalDriveMinutes = measuredDays.reduce((sum, day) => sum + day.totalDriveMinutes, 0);
  const allMeasured = measuredDays.every((day) => day.stops.every((stop) => stop.legKm !== null));

  return NextResponse.json({
    success: true,
    city: cityLabel,
    days: measuredDays,
    unused: itinerary.unused.slice(0, 8),
    stopsPerDay,
    origin,
    engine: allMeasured && neshanReady ? "نشان" : engine,
    note: itinerary.note,
    poiNote,
    sources,
    totals: { km: totalKm, driveMinutes: totalDriveMinutes, stops: measuredDays.reduce((sum, day) => sum + day.stops.length, 0), days: measuredDays.length },
    generatedAt: new Date().toISOString(),
  });
}
