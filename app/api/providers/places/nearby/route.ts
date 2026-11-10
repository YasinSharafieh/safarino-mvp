import { NextRequest, NextResponse } from "next/server";
import { searchCityPois, type PoiWithMeta } from "../../../../../lib/poi-search";
import { computePoiDistances, engineLabel as distanceEngineLabel, type DistanceTarget } from "../../../../../lib/poi-distance";
import {
  NESHAN_PLACE_LAYERS,
  neshanAvailable,
  neshanNearby,
  neshanReverse,
  resolveNeshanKey,
  type NeshanPlace,
} from "../../../../../lib/neshan";
import { placePhoto, neshanStaticMapUrl } from "../../../../../lib/place-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  /** Real photo of this place, or a real Neshan map image of its exact spot. */
  imageUrl: string | null;
  imageKind: "photo" | "map" | "none";
  imageLabel: string;
  imageCreditUrl: string | null;
};

function nameKey(name: string): string {
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
    imageUrl: null,
    imageKind: "none",
    imageLabel: "",
    imageCreditUrl: null,
  };
}

function fromNeshanNearby(place: {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  durationSeconds: number;
}): NearbyPlace {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    address: "",
    latitude: place.latitude,
    longitude: place.longitude,
    distanceKm: place.distanceMeters > 0 ? Math.round(place.distanceMeters / 100) / 10 : null,
    durationMinutes: place.durationSeconds > 0 ? Math.max(1, Math.round(place.durationSeconds / 60)) : null,
    distanceEngine: "نشان",
    sourceLabel: "نشان",
    sourceUrl: `https://neshan.org/maps/@${place.latitude},${place.longitude},16z`,
    wikipediaUrl: null,
    imageUrl: null,
    imageKind: "none",
    imageLabel: "",
    imageCreditUrl: null,
  };
}

function fromNeshanSearch(place: NeshanPlace): NearbyPlace {
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
    imageUrl: null,
    imageKind: "none",
    imageLabel: "",
    imageCreditUrl: null,
  };
}

/**
 * Places around the chosen accommodation, each with a real picture and a real
 * distance.
 *
 * Places: Neshan's own "nearby" results (when that service is enabled for the
 * key) merged with OpenStreetMap / Wikidata / Persian Wikipedia.
 * Pictures: the place's own Wikipedia/Wikimedia photo; if there is none, a real
 * Neshan map image of that exact coordinate, labelled as a map — never a made-up
 * photo.
 * Distance: Neshan's traffic-aware matrix, then OpenStreetMap routing, then a
 * clearly labelled straight line.
 */
export async function POST(request: NextRequest) {
  let city = "";
  try {
    const body = (await request.json()) as {
      city?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      limit?: unknown;
      neshanApiKey?: unknown;
    };
    city = typeof body.city === "string" ? body.city.trim().slice(0, 80) : "";
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const limit = typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.min(24, Math.max(4, Math.round(body.limit))) : 12;
    if (!city) return NextResponse.json({ success: false, error: "نام مقصد را وارد کنید." }, { status: 400 });

    const requestKey = resolveNeshanKey(body.neshanApiKey);
    const neshanReady = neshanAvailable(requestKey);
    const hasOrigin = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;

    const poiResult = await searchCityPois(city, 30);
    const places: NearbyPlace[] = poiResult.pois.map(fromPoi);
    const seen = new Set<string>();
    places.forEach((place) => seen.add(nameKey(place.name)));

    // Neshan's own places, when the service answers.
    const neshanNotes: string[] = [];
    if (neshanReady) {
      let added = 0;
      let firstFailure = "";
      for (const definition of NESHAN_PLACE_LAYERS) {
        const found = await neshanNearby(
          { latitude: hasOrigin ? latitude : poiResult.latitude || 0, longitude: hasOrigin ? longitude : poiResult.longitude || 0 },
          definition.layer,
          5_000,
          { key: requestKey },
        );
        if (found.status !== "ok") {
          if (!firstFailure) firstFailure = found.status;
          continue;
        }
        found.places.forEach((place) => {
          const key = nameKey(place.name);
          if (!key || seen.has(key)) return;
          seen.add(key);
          places.push(fromNeshanNearby(place));
          added += 1;
        });
      }
      if (!added && firstFailure) {
        neshanNotes.push(
          firstFailure === "service_disabled"
            ? "سرویس «مکان‌های نزدیک» نشان برای این کلید فعال نیست؛ برای فعال‌سازی از پنل نشان تیکت بزنید. تا آن زمان مکان‌ها از ویکی‌داده/ویکی‌پدیا/OpenStreetMap می‌آید و فاصله‌شان با نشان حساب می‌شود."
            : `سرویس مکان‌های نزدیک نشان پاسخ نداد (${firstFailure}).`,
        );
      }
    }

    const targets: DistanceTarget[] = places.map((place) => ({ id: place.id, latitude: place.latitude, longitude: place.longitude }));
    const distance = hasOrigin ? await computePoiDistances({ latitude, longitude }, targets, { neshanKey: requestKey }) : null;

    if (distance) {
      const byId = new Map<string, { distanceKm: number; durationMinutes: number | null }>();
      distance.entries.forEach((entry) => byId.set(entry.id, { distanceKm: entry.distanceKm, durationMinutes: entry.durationMinutes }));
      places.forEach((place) => {
        if (place.distanceKm !== null && place.distanceEngine === "نشان") return; // Neshan already measured it
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

    // Real pictures, in parallel, from each place's own article or item.
    await Promise.all(
      ordered.map(async (place) => {
        const photo = await placePhoto({
          wikipediaUrl: place.wikipediaUrl,
          wikidataId: place.sourceUrl.includes("wikidata.org")
            ? (place.sourceUrl.match(/Q\d+/) || [""])[0]
            : null,
          name: place.name,
        });
        if (photo) {
          place.imageUrl = `/api/provider-assets?src=${encodeURIComponent(photo.url)}`;
          place.imageKind = "photo";
          place.imageLabel = photo.label;
          place.imageCreditUrl = photo.creditUrl;
          return;
        }
        if (Number.isFinite(place.latitude) && Number.isFinite(place.longitude)) {
          place.imageUrl = neshanStaticMapUrl({ latitude: place.latitude, longitude: place.longitude });
          place.imageKind = "map";
          place.imageLabel = "نقشهٔ نشان برای همین نقطه";
          place.imageCreditUrl = place.sourceUrl;
        }
      }),
    );

    const reverse = hasOrigin ? await neshanReverse({ latitude, longitude }, { key: requestKey }) : null;

    const note = distance
      ? distance.note
      : "برای محاسبهٔ فاصله، اول یک اقامتگاه را انتخاب کنید.";

    return NextResponse.json({
      success: true,
      city: poiResult.city || city,
      origin: hasOrigin ? { latitude, longitude } : null,
      originArea: reverse,
      places: ordered,
      engine: distance?.engine || null,
      engineLabel: distance ? distanceEngineLabel(distance.engine) : null,
      neshanConfigured: neshanReady,
      neshanNearbyNote: neshanNotes.join(" "),
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
