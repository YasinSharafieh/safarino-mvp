/**
 * Real pictures for a place, from real sources only.
 *
 * 1. The Persian Wikipedia article of that exact place (its lead picture).
 * 2. The Wikidata item's picture (P18) on Wikimedia Commons.
 * 3. Otherwise: none — the caller may then show a real Neshan map image of that
 *    exact spot, clearly labelled as a map, never passed off as a photo.
 *
 * Wikipedia throttles bursts of single lookups (HTTP 429), so places are asked
 * for in batches: one request covers up to 20 places. Answers are cached for a
 * week in the shared store, so a place is only looked up once.
 */

import { getProviderCache, setProviderCache } from "./provider-cache";

export type PlacePhoto = {
  url: string;
  label: string;
  source: "wikipedia" | "commons" | "map";
  creditUrl: string;
};

const PHOTO_TTL = 7 * 86_400;
const NEGATIVE_TTL = 6 * 3_600;
const BATCH = 20;
const USER_AGENT = "SafarinoTravelPlanner/1.0 (https://safarino-mvp.vercel.app; contact: safarino@example.com)";

function commonsFilePath(file: string, width = 800): string {
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

function normalizeTitle(title: string): string {
  return title.trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

function isWikimedia(url: string): boolean {
  return /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(url);
}

async function fetchJson<T>(url: string, timeoutMs = 12_000, attempt = 0): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (response.status === 429 && attempt < 2) {
      const wait = Number(response.headers.get("retry-after")) || 1 + attempt;
      await new Promise((resolve) => setTimeout(resolve, Math.min(4, wait) * 1_000));
      return fetchJson<T>(url, timeoutMs, attempt + 1);
    }
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

type PageImagesPayload = {
  query?: {
    pages?: { title?: string; missing?: boolean; thumbnail?: { source?: string } }[];
    normalized?: { from?: string; to?: string }[];
    redirects?: { from?: string; to?: string }[];
  };
};

/** Lead pictures of several articles in ONE request (Wikipedia API, with redirects). */
export async function wikipediaThumbnails(titles: string[], lang = "fa"): Promise<Map<string, PlacePhoto>> {
  const unique = Array.from(new Set(titles.map(normalizeTitle).filter(Boolean)));
  const found = new Map<string, PlacePhoto>();
  for (let index = 0; index < unique.length; index += BATCH) {
    const slice = unique.slice(index, index + BATCH);
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageimages` +
      `&piprop=thumbnail&pithumbsize=800&titles=${encodeURIComponent(slice.join("|"))}`;
    const payload = await fetchJson<PageImagesPayload>(url);
    if (!payload?.query?.pages) continue;
    const alias = new Map<string, string>();
    [...(payload.query.normalized || []), ...(payload.query.redirects || [])].forEach((entry) => {
      if (entry.from && entry.to) alias.set(normalizeTitle(entry.from), normalizeTitle(entry.to));
    });
    const byTitle = new Map<string, PlacePhoto>();
    payload.query.pages.forEach((page) => {
      const source = page?.thumbnail?.source || "";
      if (!page?.title || page.missing || !isWikimedia(source)) return;
      byTitle.set(normalizeTitle(page.title), {
        url: source,
        label: "عکس از ویکی‌پدیا",
        source: "wikipedia",
        creditUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
      });
    });
    slice.forEach((requested) => {
      const direct = byTitle.get(requested);
      const viaAlias = byTitle.get(alias.get(requested) || "");
      const photo = direct || viaAlias;
      if (photo) found.set(requested, photo);
    });
  }
  return found;
}

type WikidataPayload = {
  entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> }>;
};

/** P18 pictures of several Wikidata items in ONE request. */
export async function wikidataImages(ids: string[]): Promise<Map<string, PlacePhoto>> {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter((id) => /^Q\d+$/.test(id))));
  const found = new Map<string, PlacePhoto>();
  for (let index = 0; index < unique.length; index += BATCH) {
    const slice = unique.slice(index, index + BATCH);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=claims&ids=${slice.join("|")}`;
    const payload = await fetchJson<WikidataPayload>(url);
    if (!payload?.entities) continue;
    slice.forEach((id) => {
      const file = payload.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (typeof file !== "string" || !file) return;
      found.set(id, {
        url: commonsFilePath(file),
        label: "عکس از ویکی‌انبار",
        source: "commons",
        creditUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/^File:/i, ""))}`,
      });
    });
  }
  return found;
}

/** A single article's lead picture (kept for direct callers and tests). */
export async function wikipediaPhoto(title: string, lang = "fa"): Promise<PlacePhoto | null> {
  const clean = normalizeTitle(title);
  if (!clean) return null;
  const cacheKey = `safarino:place-photo:wiki:${lang}:${clean}`;
  const cached = await getProviderCache<PlacePhoto | "none">(cacheKey);
  if (cached === "none") return null;
  if (cached) return cached;
  const map = await wikipediaThumbnails([clean], lang);
  const photo = map.get(clean) || null;
  await setProviderCache(cacheKey, photo || "none", photo ? PHOTO_TTL : NEGATIVE_TTL);
  return photo;
}

/** A single Wikidata item's picture (kept for direct callers and tests). */
export async function wikidataPhoto(wikidataId: string): Promise<PlacePhoto | null> {
  const id = wikidataId.trim();
  if (!/^Q\d+$/.test(id)) return null;
  const cacheKey = `safarino:place-photo:wd:${id}`;
  const cached = await getProviderCache<PlacePhoto | "none">(cacheKey);
  if (cached === "none") return null;
  if (cached) return cached;
  const map = await wikidataImages([id]);
  const photo = map.get(id) || null;
  await setProviderCache(cacheKey, photo || "none", photo ? PHOTO_TTL : NEGATIVE_TTL);
  return photo;
}

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
 * A real Neshan map image of one coordinate, served through Safarino so the key
 * never reaches the browser. Used when no photo of the place exists.
 */
export function neshanStaticMapUrl(
  point: { latitude: number; longitude: number },
  size = { width: 400, height: 250 },
  zoom = 15,
): string {
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
 * Gives every place a picture: its own Wikipedia/Wikimedia photo when one
 * exists, otherwise a real Neshan map image of exactly that coordinate.
 * Two batched requests cover any list length, so it stays fast and polite.
 */
export async function attachPlaceImages<T extends PlaceWithMaybePhoto>(
  places: T[],
  options: { maxPhotos?: number; mapZoom?: number } = {},
): Promise<T[]> {
  const target = places.slice(0, options.maxPhotos ?? places.length);
  if (!target.length) return places;

  const titleOf = (place: T) => wikiTitleFromUrl(place.wikipediaUrl) || normalizeTitle(place.name || "");
  const wikidataOf = (place: T) => {
    const fromUrl = typeof place.sourceUrl === "string" ? (place.sourceUrl.match(/Q\d+/) || [""])[0] : "";
    return fromUrl;
  };

  const photos = await wikipediaThumbnails(target.map(titleOf));

  const missingItems = target.filter((place) => !photos.has(titleOf(place)) && wikidataOf(place));
  const commons = missingItems.length ? await wikidataImages(missingItems.map(wikidataOf)) : new Map<string, PlacePhoto>();

  target.forEach((place) => {
    if (place.imageUrl) return;
    const photo = photos.get(titleOf(place)) || commons.get(wikidataOf(place));
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
      return;
    }
    place.imageKind = "none";
  });
  return places;
}
