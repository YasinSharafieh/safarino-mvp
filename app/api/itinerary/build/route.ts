import { NextRequest, NextResponse } from "next/server";
import { searchCityPois } from "../../../../lib/poi-search";
import { attachPlaceDetails } from "../../../../lib/place-photos";
import { buildItinerary, rescheduleDay, type ItineraryDay, type ItineraryPlace } from "../../../../lib/itinerary";
import { neshanAvailable, neshanPairDistances, type NeshanPair } from "../../../../lib/neshan";
import { getProviderCache, setProviderCache } from "../../../../lib/provider-cache";
import { osrmPairDistances } from "../../../../lib/poi-distance";

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

  const neshanReadyForCache = neshanAvailable();
  const cacheKey = `safarino:itinerary:v3:${neshanReadyForCache ? "neshan" : "keyless"}:${city}:${days}:${stopsPerDay}:${
    origin ? `${origin.latitude.toFixed(3)},${origin.longitude.toFixed(3)}` : "no-origin"
  }`;
  if (!Array.isArray(body.places)) {
    const cached = await getProviderCache<Record<string, unknown>>(cacheKey);
    if (cached && Array.isArray((cached as { days?: unknown[] }).days)) {
      return NextResponse.json({ ...cached, cached: true });
    }
  }

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

  // Measure every leg of every day, once: Neshan first (traffic-aware), then
  // OpenStreetMap for anything Neshan could not answer. A leg that neither
  // engine measured stays empty rather than guessed.
  const neshanReady = neshanAvailable();
  const flatLegs: NeshanPair[] = [];
  const legIndex: { day: number; stop: number }[] = [];
  itinerary.days.forEach((day, dayIndex) => {
    let previous: { latitude: number; longitude: number } | null = origin;
    day.stops.forEach((stop, stopIndex) => {
      if (previous) {
        flatLegs.push({ from: previous, to: { latitude: stop.place.latitude, longitude: stop.place.longitude } });
        legIndex.push({ day: dayIndex, stop: stopIndex });
      }
      previous = { latitude: stop.place.latitude, longitude: stop.place.longitude };
    });
  });

  const measured: ({ distanceKm: number; durationMinutes: number } | null)[] = flatLegs.map(() => null);
  const legEngine: string[] = flatLegs.map(() => "");

  if (neshanReady && flatLegs.length) {
    const result = await neshanPairDistances(flatLegs);
    if (result.status === "ok") {
      result.items.forEach((item, index) => {
        if (!item) return;
        measured[index] = item;
        legEngine[index] = "نشان";
      });
    }
  }

  const missingIndexes = measured.map((item, index) => (item ? -1 : index)).filter((index) => index >= 0);
  if (missingIndexes.length) {
    const fallback = await osrmPairDistances(missingIndexes.map((index) => flatLegs[index]));
    fallback.forEach((item, position) => {
      const target = missingIndexes[position];
      if (!item || target === undefined) return;
      measured[target] = { distanceKm: item.distanceKm, durationMinutes: item.durationMinutes ?? 0 };
      legEngine[target] = "OpenStreetMap";
    });
  }

  const measuredDays: ItineraryDay[] = itinerary.days.map((day, dayIndex) => {
    const stops = day.stops.map((stop, stopIndex) => {
      const position = legIndex.findIndex((entry) => entry.day === dayIndex && entry.stop === stopIndex);
      const item = position >= 0 ? measured[position] : null;
      return {
        ...stop,
        legKm: item ? item.distanceKm : null,
        legMinutes: item ? item.durationMinutes : null,
        legEngine: item ? legEngine[position] || "اندازه‌گیری‌شده" : "اندازه‌گیری نشد",
      };
    });
    return rescheduleDay({ ...day, stops });
  });

  const enginesUsed = Array.from(new Set(legEngine.filter(Boolean)));
  const engine = enginesUsed.length === 1 ? enginesUsed[0] : enginesUsed.length ? enginesUsed.join(" + ") : "اندازه‌گیری نشد";

  const totalKm = Math.round(measuredDays.reduce((sum, day) => sum + day.totalKm, 0) * 10) / 10;
  const totalDriveMinutes = measuredDays.reduce((sum, day) => sum + day.totalDriveMinutes, 0);
  const allMeasured = measuredDays.every((day) => day.stops.every((stop) => stop.legKm !== null));
  const unmeasured = measuredDays.reduce((sum, day) => sum + day.stops.filter((stop) => stop.legKm === null).length, 0);

  const payload = {
    success: true,
    city: cityLabel,
    days: measuredDays,
    unused: itinerary.unused.slice(0, 8),
    stopsPerDay,
    origin,
    engine,
    unmeasuredLegs: unmeasured,
    note: itinerary.note,
    poiNote,
    sources,
    totals: { km: totalKm, driveMinutes: totalDriveMinutes, stops: measuredDays.reduce((sum, day) => sum + day.stops.length, 0), days: measuredDays.length },
    generatedAt: new Date().toISOString(),
  };
  if (unmeasured === 0) {
    // A complete answer is worth keeping for an hour; a partial one is not,
    // so the next visitor gets a fresh attempt instead of old gaps.
    await setProviderCache(cacheKey, payload as unknown as Record<string, unknown>, 3_600);
  }
  return NextResponse.json(payload);
}
