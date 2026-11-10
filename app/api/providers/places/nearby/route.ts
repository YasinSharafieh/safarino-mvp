import { NextRequest, NextResponse } from "next/server";
import { searchCityPois, type PoiWithMeta } from "../../../../../lib/poi-search";
import { computePoiDistances, engineLabel as distanceEngineLabel, type DistanceTarget } from "../../../../../lib/poi-distance";
import { neshanAvailable, neshanConfigured, neshanSearch, resolveNeshanKey, type NeshanPlace } from "../../../../../lib/neshan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Real attraction searches Neshan is asked for around the chosen property. */
const NESHAN_TERMS = ["جاذبه گردشگری", "موزه", "بازار", "پارک"];

type NearbyPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  durationMinutes: number | null;
  distanceEngine: string;
  sourceLabel: string;
  sourceUrl: string;
  wikipediaUrl: string | null;
};

function nameKey(name: string): string {
  // Keep Persian/Arabic letters and digits only; the build target predates \p{L}.
  const lettersOnly = name
    .replace(/\u064a/g, "\u06cc")
    .replace(/\u0643/g, "\u06a9")
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "");
  return lettersOnly.toLowerCase();
}

function fromPoi(poi: PoiWithMeta): NearbyPlace {
  return {
    id: poi.id,
    name: poi.name,
    category: poi.category,
    address: "",
    latitude: poi.latitude,
    longitude: poi.longitude,
    distanceKm: null,
    durationMinutes: null,
    distanceEngine: "",
    sourceLabel: poi.source === "wikidata" ? "ویکی‌داده" : poi.source === "wikipedia" ? "ویکی‌پدیای فارسی" : "OpenStreetMap",
    sourceUrl: poi.sourceUrl,
    wikipediaUrl: poi.wikipediaUrl || null,
  };
}

function fromNeshan(place: NeshanPlace): NearbyPlace {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    distanceKm: null,
    durationMinutes: null,
    distanceEngine: "",
    sourceLabel: "نشان",
    sourceUrl: place.sourceUrl,
    wikipediaUrl: null,
  };
}

/**
 * Places around the chosen accommodation plus the real distance to each one.
 * Places come from OpenStreetMap / Wikidata / Persian Wikipedia (always) and
 * from Neshan (when its key is configured). Distance comes from Neshan's
 * traffic-aware matrix, then OpenStreetMap routing, then a labelled
 * straight-line estimate. Nothing is invented and no number is presented
 * without saying which engine produced it.
 */
export async function POST(request: NextRequest) {
  let city = "";
  try {
    const body = (await request.json()) as {
      city?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      limit?: unknown;
    };
    city = typeof body.city === "string" ? body.city.trim().slice(0, 80) : "";
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const limit = typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.min(24, Math.max(4, Math.round(body.limit))) : 12;
    const requestKey = resolveNeshanKey((body as { neshanApiKey?: unknown }).neshanApiKey);
    const neshanReady = neshanAvailable(requestKey);
    if (!city) return NextResponse.json({ success: false, error: "نام مقصد را وارد کنید." }, { status: 400 });

    const poiResult = await searchCityPois(city, 30);
    const places: NearbyPlace[] = poiResult.pois.map(fromPoi);
    const seen = new Set<string>();
    places.forEach((place) => seen.add(nameKey(place.name)));

    let neshanSearchNote = neshanReady ? "" : "بدون کلید نشان؛ فقط منابع آزاد استفاده شد.";
    if (neshanReady) {
      const statuses: string[] = [];
      for (const term of NESHAN_TERMS) {
        const found = await neshanSearch(term, { latitude: latitude || poiResult.latitude || 0, longitude: longitude || poiResult.longitude || 0 }, { key: requestKey });
        if (found.status !== "ok") {
          statuses.push(found.status);
          continue;
        }
        found.places.forEach((place) => {
          const key = nameKey(place.name);
          if (!key || seen.has(key)) return;
          seen.add(key);
          places.push(fromNeshan(place));
        });
      }
      const uniqueStatuses = Array.from(new Set(statuses));
      neshanSearchNote = uniqueStatuses.length ? `جستجوی نشان برای این بخش فعال نشد (${uniqueStatuses.join(", ")}).` : "";
    }

    const targets: DistanceTarget[] = places.map((place) => ({ id: place.id, latitude: place.latitude, longitude: place.longitude }));
    const hasOrigin =
      Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;

    const distance = hasOrigin
      ? await computePoiDistances({ latitude, longitude }, targets, { neshanKey: requestKey })
      : null;

    if (distance) {
      const byId = new Map<string, { distanceKm: number; durationMinutes: number | null }>();
      distance.entries.forEach((entry) => byId.set(entry.id, { distanceKm: entry.distanceKm, durationMinutes: entry.durationMinutes }));
      places.forEach((place) => {
        const entry = byId.get(place.id);
        if (!entry) return;
        place.distanceKm = entry.distanceKm;
        place.durationMinutes = entry.durationMinutes;
        place.distanceEngine = distance.engineLabel;
      });
    }

    const withDistance = places.filter((place) => place.distanceKm !== null);
    const withoutDistance = places.filter((place) => place.distanceKm === null);
    withDistance.sort((a, b) => (a.distanceKm as number) - (b.distanceKm as number));
    const ordered = [...withDistance, ...withoutDistance].slice(0, limit);

    const note = distance
      ? distance.note
      : "برای محاسبهٔ فاصله، اول یک اقامتگاه را انتخاب کنید.";

    return NextResponse.json({
      success: true,
      city: poiResult.city || city,
      origin: hasOrigin ? { latitude, longitude } : null,
      places: ordered,
      engine: distance?.engine || null,
      engineLabel: distance ? distanceEngineLabel(distance.engine) : null,
      neshanConfigured: neshanConfigured(),
      neshanSearchNote,
      poiSources: poiResult.sources,
      poiNote: poiResult.note,
      note,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        city,
        error: error instanceof Error ? `خواندن مکان‌های اطراف انجام نشد: ${error.message}` : "خواندن مکان‌های اطراف انجام نشد.",
      },
      { status: 502 },
    );
  }
}
