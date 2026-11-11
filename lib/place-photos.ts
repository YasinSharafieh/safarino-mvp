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

/** Picture plus a short, practical description of the place itself. */
export type PlaceInfo = {
  photo: PlacePhoto | null;
  /** Two or three plain sentences taken from the place's own article. */
  description: string;
};

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
    pages?: { title?: string; missing?: boolean; thumbnail?: { source?: string }; extract?: string }[];
    normalized?: { from?: string; to?: string }[];
    redirects?: { from?: string; to?: string }[];
  };
};

const SENTENCE_END = /[.!؟?…]\s*$/;
const MAX_DESCRIPTION = 300;

/**
 * Turns an article's opening into two or three sentences a traveller can use.
 * Nothing is invented: only the article's own words, shortened at a sentence end.
 */
export function shortDescription(raw: string | null | undefined): string {
  if (!raw) return "";
  let text = raw
    .replace(/\r/g, " ")
    .replace(/\s+/g, " ")
    // Pronunciation and foreign-name footnotes are noise in a card.
    .replace(/\s*\([^()]*(?:انگلیسی|لاتین|آوانگاری|تلفظ)[^()]*\)/g, "")
    .trim();
  if (!text) return "";
  const sentences = text.match(/[^.!؟?…]+[.!؟?…]*/g) || [];
  let out = "";
  for (const sentence of sentences) {
    const next = `${out} ${sentence.trim()}`.trim();
    if (out && next.length > MAX_DESCRIPTION) break;
    out = next;
    if (out.length >= 150) break;
  }
  if (!out) out = text.slice(0, MAX_DESCRIPTION);
  if (out.length > MAX_DESCRIPTION) {
    const cut = out.slice(0, MAX_DESCRIPTION);
    const lastEnd = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("؟"), cut.lastIndexOf("!"), cut.lastIndexOf("…"));
    out = lastEnd > 120 ? cut.slice(0, lastEnd + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
  }
  return SENTENCE_END.test(out) || out.endsWith("…") ? out : `${out}…`;
}

/**
 * Pictures AND short descriptions of several articles in ONE request.
 * Every title that was asked for is answered, following redirects.
 */
export async function wikipediaInfo(titles: string[], lang = "fa"): Promise<Map<string, PlaceInfo>> {
  const unique = Array.from(new Set(titles.map(normalizeTitle).filter(Boolean)));
  const found = new Map<string, PlaceInfo>();
  const missing: string[] = [];

  // Anything looked up in the last week comes from the shared store.
  await Promise.all(
    unique.map(async (title) => {
      const cached = await getProviderCache<PlaceInfo | "none">(`safarino:place-info:v1:${lang}:${title}`);
      if (cached === "none") {
        found.set(title, { photo: null, description: "" });
      } else if (cached) {
        found.set(title, cached);
      } else {
        missing.push(title);
      }
    }),
  );

  for (let index = 0; index < missing.length; index += BATCH) {
    const slice = missing.slice(index, index + BATCH);
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1` +
      `&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=800&exintro=1&explaintext=1&exsentences=5` +
      `&titles=${encodeURIComponent(slice.join("|"))}`;
    const payload = await fetchJson<PageImagesPayload>(url);
    const alias = new Map<string, string>();
    const byTitle = new Map<string, PlaceInfo>();
    [...(payload?.query?.normalized || []), ...(payload?.query?.redirects || [])].forEach((entry) => {
      if (entry.from && entry.to) alias.set(normalizeTitle(entry.from), normalizeTitle(entry.to));
    });
    (payload?.query?.pages || []).forEach((page) => {
      if (!page?.title) return;
      const source = page.thumbnail?.source || "";
      const photo: PlacePhoto | null = !page.missing && isWikimedia(source)
        ? {
            url: source,
            label: "عکس از ویکی‌پدیا",
            source: "wikipedia",
            creditUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
          }
        : null;
      const description = page.missing ? "" : shortDescription(page.extract);
      if (photo || description) byTitle.set(normalizeTitle(page.title), { photo, description });
    });
    slice.forEach((requested) => {
      const info = byTitle.get(requested) || byTitle.get(alias.get(requested) || "") || null;
      const value: PlaceInfo = info || { photo: null, description: "" };
      found.set(requested, value);
      void setProviderCache(`safarino:place-info:v1:${lang}:${requested}`, value.photo || value.description ? value : "none", value.photo || value.description ? PHOTO_TTL : NEGATIVE_TTL);
    });
  }
  return found;
}

/** Lead pictures of several articles in ONE request (kept for simple callers). */
export async function wikipediaThumbnails(titles: string[], lang = "fa"): Promise<Map<string, PlacePhoto>> {
  const info = await wikipediaInfo(titles, lang);
  const photos = new Map<string, PlacePhoto>();
  info.forEach((value, title) => {
    if (value.photo) photos.set(title, value.photo);
  });
  return photos;
}

type CommonsPayload = {
  query?: { pages?: { title?: string; missing?: boolean; imageinfo?: { thumburl?: string; url?: string }[] }[] };
};

/**
 * Turns "File:X.jpg" into the direct picture address on Wikimedia's image CDN.
 * One request covers many files; if it fails, the plain file address is used.
 */
async function commonsThumbnails(files: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(files.map((file) => file.replace(/^File:/i, "").trim()).filter(Boolean)));
  const resolved = new Map<string, string>();
  for (let index = 0; index < unique.length; index += BATCH) {
    const slice = unique.slice(index, index + BATCH);
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo` +
      `&iiprop=url&iiurlwidth=800&titles=${encodeURIComponent(slice.map((file) => `File:${file}`).join("|"))}`;
    const payload = await fetchJson<CommonsPayload>(url);
    if (!payload?.query?.pages) continue;
    payload.query.pages.forEach((page) => {
      const source = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url || "";
      if (!page?.title || page.missing || !isWikimedia(source)) return;
      resolved.set(page.title.replace(/^File:/i, "").replace(/_/g, " "), source);
    });
  }
  return resolved;
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
    const files = slice
      .map((id) => payload.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value)
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    const thumbs = files.length ? await commonsThumbnails(files) : new Map<string, string>();
    slice.forEach((id) => {
      const file = payload.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (typeof file !== "string" || !file) return;
      const direct = thumbs.get(file.replace(/^File:/i, "").replace(/_/g, " "));
      found.set(id, {
        url: direct || commonsFilePath(file),
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

type DescriptionsPayload = {
  entities?: Record<string, { descriptions?: Record<string, { value?: string }> }>;
};

/**
 * One-line descriptions of several Wikidata items in ONE request.
 * Used only when the place has no Persian article to quote.
 */
export async function wikidataDescriptions(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter((id) => /^Q\d+$/.test(id))));
  const found = new Map<string, string>();
  for (let index = 0; index < unique.length; index += BATCH) {
    const slice = unique.slice(index, index + BATCH);
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&formatversion=2&props=descriptions&languages=fa|en&ids=${slice.join("|")}`;
    const payload = await fetchJson<DescriptionsPayload>(url);
    if (!payload?.entities) continue;
    slice.forEach((id) => {
      const text = payload.entities?.[id]?.descriptions?.fa?.value || payload.entities?.[id]?.descriptions?.en?.value || "";
      const clean = shortDescription(text);
      if (clean) found.set(id, clean);
    });
  }
  return found;
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
  /** Two or three sentences about the place itself. */
  description?: string;
  descriptionSource?: string;
};

/**
 * Gives every place a picture: its own Wikipedia/Wikimedia photo when one
 * exists, otherwise a real Neshan map image of exactly that coordinate.
 * Two batched requests cover any list length, so it stays fast and polite.
 */
export async function attachPlaceDetails<T extends PlaceWithMaybePhoto>(
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

  const info = await wikipediaInfo(target.map(titleOf));

  const needCommons = target.filter((place) => !info.get(titleOf(place))?.photo && wikidataOf(place));
  const commons = needCommons.length ? await wikidataImages(needCommons.map(wikidataOf)) : new Map<string, PlacePhoto>();

  const needWords = target.filter((place) => !info.get(titleOf(place))?.description && wikidataOf(place));
  const words = needWords.length ? await wikidataDescriptions(needWords.map(wikidataOf)) : new Map<string, string>();

  target.forEach((place) => {
    const placeInfo = info.get(titleOf(place));
    if (!place.imageUrl) {
      const photo = placeInfo?.photo || commons.get(wikidataOf(place));
      if (photo) {
        place.imageUrl = `/api/provider-assets?src=${encodeURIComponent(photo.url)}`;
        place.imageKind = "photo";
        place.imageLabel = photo.label;
        place.imageCreditUrl = photo.creditUrl;
      } else if (Number.isFinite(place.latitude) && Number.isFinite(place.longitude) && place.latitude !== 0 && place.longitude !== 0) {
        place.imageUrl = neshanStaticMapUrl({ latitude: place.latitude, longitude: place.longitude }, { width: 400, height: 250 }, options.mapZoom ?? 15);
        place.imageKind = "map";
        place.imageLabel = "نقشهٔ نشان برای همین نقطه";
        place.imageCreditUrl = place.sourceUrl || null;
      } else {
        place.imageKind = "none";
      }
    }
    if (!place.description) {
      const fromArticle = placeInfo?.description || "";
      const fromItem = words.get(wikidataOf(place)) || "";
      place.description = fromArticle || fromItem;
      place.descriptionSource = fromArticle ? "ویکی‌پدیای فارسی" : fromItem ? "ویکی‌داده" : "";
    }
  });
  return places;
}

/** Old name kept so older callers and tests keep working. */
export const attachPlaceImages = attachPlaceDetails;
