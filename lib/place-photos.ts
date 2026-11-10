/**
 * Real pictures for a place, from real sources only.
 *
 * Order:
 *   1. The Persian Wikipedia article of that exact place (its lead photo).
 *   2. The Wikidata item's image (P18) on Wikimedia Commons.
 *   3. Otherwise: no photo. The caller may then show a real Neshan map image
 *      of that spot, clearly labelled as a map, never as a photo of the place.
 *
 * Everything is cached in the shared store for a week; nothing is generated.
 */

import { getProviderCache, setProviderCache } from "./provider-cache";

export type PlacePhoto = {
  url: string;
  /** Human label in Persian for the caption. */
  label: string;
  /** Where the picture comes from. */
  source: "wikipedia" | "commons" | "map";
  /** Page the traveller can open to check it themselves. */
  creditUrl: string;
};

const PHOTO_TTL = 7 * 86_400;
/** Wikipedia asks not to be hammered; keep the fan-out small. */
const PHOTO_CONCURRENCY = 4;

async function inPool<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await work(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function commonsFilePath(file: string, width = 640): string {
  const clean = file.replace(/^File:/i, "").trim();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(clean)}?width=${width}`;
}

function wikiTitleFromUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/wiki\/(.+)$/);
    return match ? decodeURIComponent(match[1]).replace(/_/g, " ") : "";
  } catch {
    return "";
  }
}

/** Wikipedia lead photo for a given article title (any language, defaults to Persian). */
export async function wikipediaPhoto(title: string, lang = "fa", timeoutMs = 8_000): Promise<PlacePhoto | null> {
  const clean = title.trim();
  if (!clean) return null;
  const cacheKey = `safarino:place-photo:wiki:${lang}:${clean}`;
  const cached = await getProviderCache<PlacePhoto | "none">(cacheKey);
  if (cached === "none") return null;
  if (cached) return cached;

  try {
    const response = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`, {
      headers: { Accept: "application/json", "User-Agent": "Safarino/1.0 (travel planner)" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) {
      // 429 = too many requests; do not remember "no photo" for long.
      await setProviderCache(cacheKey, "none", response.status === 429 ? 60 : 3_600);
      return null;
    }
    const payload = (await response.json()) as {
      thumbnail?: { source?: string };
      originalimage?: { source?: string };
      content_urls?: { desktop?: { page?: string } };
    };
    const source = payload.thumbnail?.source || payload.originalimage?.source || "";
    if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(source)) {
      await setProviderCache(cacheKey, "none", 3_600);
      return null;
    }
    const photo: PlacePhoto = {
      url: source,
      label: "عکس از ویکی‌پدیا",
      source: "wikipedia",
      creditUrl: payload.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(clean)}`,
    };
    await setProviderCache(cacheKey, photo, PHOTO_TTL);
    return photo;
  } catch {
    return null;
  }
}

/** Wikidata P18 image on Wikimedia Commons. */
export async function wikidataPhoto(wikidataId: string, timeoutMs = 8_000): Promise<PlacePhoto | null> {
  const id = wikidataId.trim();
  if (!/^Q\d+$/.test(id)) return null;
  const cacheKey = `safarino:place-photo:wd:${id}`;
  const cached = await getProviderCache<PlacePhoto | "none">(cacheKey);
  if (cached === "none") return null;
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=claims&format=json&formatversion=2`,
      { headers: { Accept: "application/json", "User-Agent": "Safarino/1.0 (travel planner)" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> }>;
    };
    const entity = payload.entities ? payload.entities[id] : undefined;
    const file = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (typeof file !== "string" || !file) {
      await setProviderCache(cacheKey, "none", PHOTO_TTL);
      return null;
    }
    const photo: PlacePhoto = {
      url: commonsFilePath(file),
      label: "عکس از ویکی‌انبار",
      source: "commons",
      creditUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/^File:/i, ""))}`,
    };
    await setProviderCache(cacheKey, photo, PHOTO_TTL);
    return photo;
  } catch {
    return null;
  }
}

/** Tries the article first, then the Wikidata image. */
export async function placePhoto(input: {
  wikipediaUrl?: string | null;
  wikidataId?: string | null;
  name?: string;
  lang?: string;
}): Promise<PlacePhoto | null> {
  const title = wikiTitleFromUrl(input.wikipediaUrl) || (input.name || "").trim();
  const fromWiki = title ? await wikipediaPhoto(title, input.lang || "fa") : null;
  if (fromWiki) return fromWiki;
  if (input.wikidataId) return wikidataPhoto(input.wikidataId);
  return null;
}

/**
 * A real Neshan map image of one coordinate, served through Safarino so the
 * key never reaches the browser. Used when no photo of the place exists.
 */
export function neshanStaticMapUrl(point: { latitude: number; longitude: number }, size = { width: 400, height: 250 }, zoom = 15): string {
  const params = new URLSearchParams({
    lat: point.latitude.toFixed(5),
    lng: point.longitude.toFixed(5),
    zoom: String(zoom),
    w: String(size.width),
    h: String(size.height),
  });
  return `/api/neshan/static?${params.toString()}`;
}

type PlaceWithMaybePhoto = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  sourceUrl?: string | null;
  wikipediaUrl?: string | null;
  imageUrl?: string | null;
  imageKind?: "photo" | "map" | "none";
  imageLabel?: string;
  imageCreditUrl?: string | null;
};

/**
 * Adds a real picture to every place: the place's own Wikipedia/Wikimedia photo
 * when it exists, otherwise a real Neshan map image of exactly that coordinate.
 * Photos are cached for a week, so repeat visits cost nothing.
 */
export async function attachPlaceImages<T extends PlaceWithMaybePhoto>(places: T[], options: { maxPhotos?: number; mapZoom?: number } = {}): Promise<T[]> {
  const maxPhotos = options.maxPhotos ?? 16;
  await inPool(places.slice(0, maxPhotos), PHOTO_CONCURRENCY, async (place) => {
      if (place.imageUrl) return;
      const wikidataId = typeof place.sourceUrl === "string" ? (place.sourceUrl.match(/Q\d+/) || [""])[0] : "";
      const photo = await placePhoto({
        wikipediaUrl: place.wikipediaUrl || null,
        wikidataId: wikidataId || null,
        name: place.name,
      });
      if (photo) {
        place.imageUrl = `/api/provider-assets?src=${encodeURIComponent(photo.url)}`;
        place.imageKind = "photo";
        place.imageLabel = photo.label;
        place.imageCreditUrl = photo.creditUrl;
        return;
      }
      if (Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && place.latitude !== 0 && place.longitude !== 0) {
        place.imageUrl = neshanStaticMapUrl({ latitude: place.latitude, longitude: place.longitude }, { width: 400, height: 250 }, options.mapZoom ?? 15);
        place.imageKind = "map";
        place.imageLabel = "نقشهٔ نشان برای همین نقطه";
        place.imageCreditUrl = place.sourceUrl || null;
      } else {
        place.imageKind = "none";
      }
  });
  return places;
}
