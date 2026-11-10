import { IRANIAN_CITIES } from "./iran-cities";
import { getProviderCache, setProviderCache } from "./provider-cache";
import { categoryLabel, type Poi, type PoiSearchResult } from "./poi-types";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";
const WIKIPEDIA_API = "https://fa.wikipedia.org/w/api.php";
const USER_AGENT = "Safarino/1.0 (Iranian travel planner; contact: agent@arena.ai)";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const GEOSEARCH_RADIUS_METERS = 10_000;
const FAMOUS_RADIUS_KM = 25;

type Coordinate = { latitude: number; longitude: number };

type Candidate = Poi & { notability: number; articleLength: number };

type OverpassTagged = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type WikidataRow = {
  item?: { value?: string };
  label?: { value?: string };
  coord?: { value?: string };
  kindLabel?: { value?: string };
  links?: { value?: string };
};

type GeoSearchRow = { pageid?: number; title?: string; lat?: number; lon?: number; distance?: number };

type PageMeta = { pageid?: number; title?: string; description?: string; length?: number };

export function normalizeTerm(value: string): string {
  return value
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/[^\u0621-\u064A\u0660-\u0669\u06F0-\u06F9a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function cityCoordinate(city: string): Coordinate | null {
  const target = normalizeTerm(city);
  const match = IRANIAN_CITIES.find((item) => normalizeTerm(item.name) === target)
    ?? IRANIAN_CITIES.find((item) => normalizeTerm(item.name).includes(target) || target.includes(normalizeTerm(item.name)));
  if (!match || typeof match.latitude !== "number" || typeof match.longitude !== "number") return null;
  return { latitude: match.latitude, longitude: match.longitude };
}

/** Resolves a city that is not in the local directory through the Persian Wikipedia article. */
async function resolveCityCoordinateFromWikipedia(city: string): Promise<Coordinate | null> {
  const payload = await wikipediaJson({ action: "query", titles: city, prop: "coordinates", redirects: "1" });
  const pages = ((payload.query as { pages?: { title?: string; coordinates?: { lat?: number; lon?: number }[] }[] } | undefined)?.pages ?? []);
  for (const page of pages) {
    const coordinate = page.coordinates?.[0];
    if (coordinate && typeof coordinate.lat === "number" && typeof coordinate.lon === "number") {
      return { latitude: coordinate.lat, longitude: coordinate.lon };
    }
  }
  return null;
}

export function haversineKm(a: Coordinate, b: Coordinate): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h))) * 10) / 10;
}

/** Phrases that identify a place worth visiting, read from Persian Wikipedia short descriptions. */
const PLACE_PATTERNS: [string, RegExp][] = [
  ["museum", /موزه/],
  ["place_of_worship", /مسجد|زیارتگاه|حرم|امامزاده|کلیسا|آتشکده|معبد|بقعه/],
  ["park", /بوستان|پارک(?! ?(?:ینگ|آب|فناوری))/],
  ["garden", /باغ(?! ?(?:وحش|کتاب))/],
  ["castle", /قلعه|دژ|ارگ/],
  ["tomb", /آرامگاه|مقبره/],
  ["monument", /برج|بنای تاریخی|یادمان|اثر ثبت|مدرسه|گرمابه|حمام|کاروانسرا|پل|سردر|عمارت|کاخ|خانه(?: تاریخی|ٔ تاریخی)?/],
  ["marketplace", /بازار(?:چه)?/],
  ["archaeological_site", /محوطه|شهر تاریخی|تپه|آثار باستانی/],
  ["viewpoint", /چشم‌انداز|منظره/],
  ["zoo", /باغ‌وحش/],
  ["theme_park", /شهربازی|شهر بازی|پارک آبی/],
  ["gallery", /گالری|نگارخانه/],
];

/** Descriptions that clearly describe something other than a visitable place. */
const EXCLUDE_PATTERNS = /(?:^| )(?:فقیه|بازیگر|نویسنده|شاعر|سیاستمدار|بازیکن|خواننده|روحانی|خاندان|سلسله|استان|شهرستان|دهستان|روستا|کلانشهر|شهر بزرگ|شهر جهانی|یک شهر|شرکت|بانک|دانشگاه|دانشکده|بیمارستان|ایستگاه|فرودگاه|پرواز|نیروگاه|ورزشگاه|بلوار|خیابان|مسابقه|انتخابات|فیلم|کتاب|آلبوم|نبرد|جنگ|حمله|انفجار|زلزله|آتش‌سوزی|اعتراض|کشتار|ترور|بمباران|سانحه|تصادف|سکونتگاه|آموزشگاه|دبیرستان|هنرستان|کنسولگری|سینمایی|کتابخانه)(?: |$)/;

const EXCLUDED_KINDS = /شهر|روستا|دهستان|کلانشهر|سکونتگاه|فرودگاه|پرواز|ایستگاه|نیروگاه|بلوار|خیابان|بیمارستان|دانشگاه|شرکت|بانک|بازیکن|فیلم|رویداد|انتخابات|نبرد|جنگ|دریاچه|رودخانه|کوه|قله|معبر|جاده|اتوبان|بزرگراه/;

function classifyFromText(value: string): string | null {
  if (!value) return null;
  if (EXCLUDE_PATTERNS.test(value)) return null;
  for (const [kind, pattern] of PLACE_PATTERNS) {
    if (pattern.test(value)) return categoryLabel(kind);
  }
  return null;
}

function parsePoint(value: string | undefined): Coordinate | null {
  const match = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec((value ?? "").trim());
  if (!match) return null;
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function wikipediaUrlFor(title: string): string {
  return `https://fa.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function overpassQuery(center: Coordinate): string {
  const around = `around:${GEOSEARCH_RADIUS_METERS},${center.latitude},${center.longitude}`;
  return `[out:json][timeout:25];
(
  node(${around})["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park)$"]["name"];
  way(${around})["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park)$"]["name"];
  node(${around})["historic"~"^(monument|memorial|castle|archaeological_site|tomb|ruins)$"]["name"];
  way(${around})["historic"~"^(monument|memorial|castle|archaeological_site|tomb|ruins)$"]["name"];
  way(${around})["leisure"="park"]["name"];
  way(${around})["amenity"="marketplace"]["name"];
);
out center tags 150;`;
}

async function fetchOverpass(center: Coordinate): Promise<OverpassTagged[]> {
  const query = overpassQuery(center);
  // Both mirrors are asked at the same time with a short deadline: this source is
  // an optional supplement and must never slow the encyclopedia sources down.
  const attempts = await Promise.all(
    OVERPASS_ENDPOINTS.map(async (endpoint) => {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(7_000),
          cache: "no-store",
        });
        if (!response.ok) return [];
        const payload = (await response.json()) as { elements?: OverpassTagged[] };
        return Array.isArray(payload.elements) ? payload.elements : [];
      } catch {
        return [];
      }
    }),
  );
  return attempts.find((rows) => rows.length) ?? [];
}

/** Famous places: Wikidata items with several encyclopedia articles in different languages. */
function famousQuery(center: Coordinate): string {
  return `SELECT ?item ?label ?coord ?kindLabel (COUNT(?sl) AS ?links) WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${center.longitude} ${center.latitude})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${FAMOUS_RADIUS_KM}" .
  }
  ?item wdt:P31 ?kind .
  ?item rdfs:label ?label . FILTER(lang(?label) = "fa")
  OPTIONAL { ?kind rdfs:label ?kindLabel . FILTER(lang(?kindLabel) = "fa") }
  OPTIONAL { ?sl schema:about ?item . }
}
GROUP BY ?item ?label ?coord ?kindLabel
HAVING(COUNT(?sl) >= 3)
LIMIT 200`;
}

async function fetchFamousPlaces(center: Coordinate): Promise<WikidataRow[]> {
  try {
    const response = await fetch(`${WIKIDATA_ENDPOINT}?${new URLSearchParams({ query: famousQuery(center), format: "json" })}`, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { results?: { bindings?: WikidataRow[] } };
    return Array.isArray(payload.results?.bindings) ? payload.results.bindings : [];
  } catch {
    return [];
  }
}

async function wikipediaJson(params: Record<string, string>): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${WIKIPEDIA_API}?${new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params })}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(18_000),
      cache: "no-store",
    });
    if (!response.ok) return {};
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

type WikipediaPlace = GeoSearchRow & { description?: string; length?: number };

async function fetchWikipediaPlaces(center: Coordinate): Promise<WikipediaPlace[]> {
  const geo = await wikipediaJson({
    action: "query",
    list: "geosearch",
    gscoord: `${center.latitude}|${center.longitude}`,
    gsradius: String(GEOSEARCH_RADIUS_METERS),
    gslimit: "50",
    gsnamespace: "0",
  });
  const rows = ((geo.query as { geosearch?: GeoSearchRow[] } | undefined)?.geosearch ?? []).filter(
    (row) => typeof row.lat === "number" && typeof row.lon === "number" && row.title,
  );
  if (!rows.length) return [];
  const meta = await wikipediaJson({
    action: "query",
    pageids: rows.slice(0, 50).map((row) => String(row.pageid)).join("|"),
    prop: "description|info",
  });
  const pages = ((meta.query as { pages?: PageMeta[] } | undefined)?.pages ?? []);
  const byId = new Map(pages.map((page) => [String(page.pageid), page]));
  return rows.map((row) => {
    const page = byId.get(String(row.pageid));
    return { ...row, description: page?.description ?? "", length: page?.length ?? 0 };
  });
}

/** Returns null when the Wikidata kind is too generic to prove the item is a visitable place. */
function categoryFromKindLabelStrict(label: string | undefined): string | null {
  const value = (label ?? "").trim();
  if (!value) return null;
  if (EXCLUDED_KINDS.test(value)) return null;
  if (/سازمان|نهاد|شورا|مجلس|وزارت|حزب|ارتش|بیمارستان|مدرسه اسلامی/.test(value)) return null;
  const mapped = categoryFromKindLabel(value);
  return mapped === categoryLabel("attraction") ? null : mapped;
}

function categoryFromKindLabel(label: string | undefined): string {
  const value = (label ?? "").trim();
  if (!value) return categoryLabel("attraction");
  if (/موزه/.test(value)) return categoryLabel("museum");
  if (/مسجد|زیارت|امامزاده|حرم|کلیسا|آرامگاه یادمانی|بقعه/.test(value)) return categoryLabel("place_of_worship");
  if (/بوستان|پارک/.test(value)) return categoryLabel("park");
  if (/قلعه|دژ|ارگ|برج/.test(value)) return categoryLabel("castle");
  if (/آرامگاه|مقبره|قبر/.test(value)) return categoryLabel("tomb");
  if (/بازار/.test(value)) return categoryLabel("marketplace");
  if (/باغ/.test(value)) return categoryLabel("garden");
  if (/پل|کاروانسرا|بنای|اثر|عمارت|کاخ|مدرسه|حمام|گرمابه|میدان|مجموعه|لندمارک|اموال فرهنگی/.test(value)) return categoryLabel("monument");
  return categoryLabel("attraction");
}

/** News/event articles are not places a traveller can visit. */
const EVENT_NAME = /(حمله|انفجار|کشتار|ترور|اعتراضات|ناآرامی|جنگ |زلزله|سیل |آتش‌سوزی|آتش‌سوزي|سانحه|سقوط هواپیما|تصادف|بمباران|موشک‌باران|ترور|قتل|اعدام|همه‌گیری|کرونا)/;

const NOISE_NAME = /^(مخبز|مغازه|سوپرمارکت|نانوایی|رستوران|کافه|فروشگاه|پارکینگ|سرویس بهداشتی|ایستگاه|پمپ بنزین|بانک|خیابان|بلوار|میدان)$/;

const GENERIC_WORDS = /(موزه|پارک|بوستان|باغ|مسجد|آستان|حرم|مجموعه|ساختمان|بنای|اثر|خانه|مدرسه|آرامگاه|کاخ|عمارت|حمام|گرمابه|میدان|بازار|پل|برج)/g;

function dedupeKey(name: string): string {
  const base = normalizeTerm(name)
    .replace(/\([^)]*\)/g, " ")
    .replace(GENERIC_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.length >= 3 ? base : normalizeTerm(name).replace(/\s+/g, " ").trim();
}

export type PoiWithMeta = Poi & { notability?: number };

export async function searchCityPois(city: string, limit = 24): Promise<PoiSearchResult> {
  const center = cityCoordinate(city) ?? await resolveCityCoordinateFromWikipedia(city);
  if (!center) {
    return {
      city,
      latitude: null,
      longitude: null,
      pois: [],
      poisWithArticle: 0,
      sources: { openstreetmap: "failed", wikidata: "failed", wikipedia: "failed" },
      note: "مختصات این مقصد در فهرست شهرها موجود نیست، بنابراین جاذبه‌ای نمایش داده نمی‌شود.",
    };
  }

  const cacheKey = `safarino:pois:v4:${normalizeTerm(city).replace(/\s+/g, "-")}`;
  const cached = await getProviderCache<PoiSearchResult & { pois: PoiWithMeta[] }>(cacheKey);
  if (cached && Array.isArray(cached.pois) && cached.pois.length) {
    return { ...cached, pois: cached.pois.slice(0, limit) };
  }

  const [famousRows, wikipediaPlaces, overpassRows] = await Promise.all([
    fetchFamousPlaces(center),
    fetchWikipediaPlaces(center),
    fetchOverpass(center),
  ]);

  const merged = new Map<string, Candidate>();

  const add = (candidate: Omit<Candidate, "distanceKm">) => {
    const key = dedupeKey(candidate.name);
    if (!key || candidate.name.length < 3 || NOISE_NAME.test(candidate.name) || EVENT_NAME.test(candidate.name)) return;
    const existing = merged.get(key);
    if (existing) {
      existing.notability = Math.max(existing.notability, candidate.notability);
      existing.articleLength = Math.max(existing.articleLength, candidate.articleLength);
      if (!existing.wikipediaUrl && candidate.wikipediaUrl) existing.wikipediaUrl = candidate.wikipediaUrl;
      const category = existing.category;
      if (category === categoryLabel("attraction") && candidate.category !== category) existing.category = candidate.category;
      return;
    }
    merged.set(key, { ...candidate, distanceKm: haversineKm(center, candidate) });
  };

  const seenItems = new Set<string>();
  for (const row of famousRows) {
    const itemId = row.item?.value?.split("/").pop() ?? "";
    const name = (row.label?.value ?? "").trim();
    const coordinate = parsePoint(row.coord?.value);
    const kindLabel = row.kindLabel?.value ?? "";
    if (!itemId || !name || !coordinate) continue;
    if (EXCLUDED_KINDS.test(kindLabel)) continue;
    const classified = categoryFromKindLabelStrict(kindLabel) ?? classifyFromText(`${name} ${kindLabel}`);
    if (!classified) continue;
    const links = Number(row.links?.value ?? 0) || 0;
    seenItems.add(itemId);
    const category = classified;
    const title = name;
    add({
      id: `wikidata:${itemId}`,
      name,
      category,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      source: "wikidata",
      sourceUrl: row.item?.value ?? `https://www.wikidata.org/wiki/${itemId}`,
      wikipediaUrl: wikipediaUrlFor(title),
      confirmations: 3,
      notability: Math.min(links, 40) / 4,
      articleLength: 0,
    });
  }

  for (const place of wikipediaPlaces) {
    const title = (place.title ?? "").trim();
    if (!title || typeof place.lat !== "number" || typeof place.lon !== "number") continue;
    const description = (place.description ?? "").trim();
    const category = classifyFromText(description) ?? classifyFromText(title);
    if (!category) continue;
    add({
      id: `wikipedia:${place.pageid ?? title}`,
      name: title,
      category,
      latitude: place.lat,
      longitude: place.lon,
      source: "wikipedia",
      sourceUrl: wikipediaUrlFor(title),
      wikipediaUrl: wikipediaUrlFor(title),
      confirmations: 2,
      notability: Math.min((place.length ?? 0) / 6000, 4),
      articleLength: place.length ?? 0,
    });
  }

  for (const element of overpassRows) {
    const tags = element.tags ?? {};
    const name = (tags["name:fa"] || tags.name || "").trim();
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!name || typeof latitude !== "number" || typeof longitude !== "number") continue;
    const kind = tags.tourism || tags.historic || tags.leisure || tags.amenity || "attraction";
    const wikipediaTag = tags.wikipedia?.startsWith("fa:") ? tags.wikipedia.slice(3) : null;
    add({
      id: element.type && element.id ? `osm:${element.type}/${element.id}` : `osm:${latitude},${longitude}`,
      name,
      category: categoryLabel(kind),
      latitude,
      longitude,
      source: "openstreetmap",
      sourceUrl: element.type && element.id
        ? `https://www.openstreetmap.org/${element.type}/${element.id}`
        : `https://www.openstreetmap.org/#map=17/${latitude}/${longitude}`,
      wikipediaUrl: wikipediaTag ? wikipediaUrlFor(wikipediaTag) : null,
      confirmations: tags.wikidata ? 2 : 1,
      notability: tags.wikidata ? 1.5 : 0.5,
      articleLength: 0,
    });
  }

  const candidates = mergeNearDuplicates(Array.from(merged.values()));
  const ranked = candidates.sort((a, b) => scoreOf(b) - scoreOf(a) || a.distanceKm - b.distanceKm);

  const target = Math.max(limit, 24);
  const perCategoryCap = Math.max(4, Math.ceil(target * 0.35));
  const categoryCount = new Map<string, number>();
  const pois: PoiWithMeta[] = [];
  for (const poi of ranked) {
    const used = categoryCount.get(poi.category) ?? 0;
    if (used >= perCategoryCap) continue;
    categoryCount.set(poi.category, used + 1);
    pois.push(poi);
    if (pois.length >= target) break;
  }

  const result: PoiSearchResult & { pois: PoiWithMeta[] } = {
    city,
    latitude: center.latitude,
    longitude: center.longitude,
    pois,
    poisWithArticle: pois.filter((poi) => poi.wikipediaUrl).length,
    sources: {
      openstreetmap: overpassRows.length ? "ok" : "failed",
      wikidata: famousRows.length ? "ok" : "failed",
      wikipedia: wikipediaPlaces.length ? "ok" : "failed",
    },
    note: pois.length
      ? "این جاذبه‌ها از ویکی‌پدیای فارسی، ویکی‌داده و OpenStreetMap خوانده شده‌اند؛ هیچ جاذبه‌ای از حافظهٔ هوش مصنوعی ساخته نشده است."
      : "در این شعاع جاذبهٔ معتبری پیدا نشد؛ هیچ جاذبهٔ ساختگی نمایش داده نمی‌شود.",
  };

  await setProviderCache(cacheKey, result, CACHE_TTL_SECONDS);
  return result;
}

function nameTokens(name: string): Set<string> {
  return new Set(dedupeKey(name).split(" ").filter((part) => part.length > 2));
}

function similarity(a: string, b: string): number {
  const first = nameTokens(a);
  const second = nameTokens(b);
  if (!first.size || !second.size) return 0;
  let shared = 0;
  first.forEach((token) => { if (second.has(token)) shared += 1; });
  return shared / Math.max(first.size, second.size);
}

function editDistance(a: string, b: string): number {
  const left = a.replace(/\s+/g, "");
  const right = b.replace(/\s+/g, "");
  if (left === right) return 0;
  if (Math.abs(left.length - right.length) > 2) return 3;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let lastDiagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const temp = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        lastDiagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      lastDiagonal = temp;
    }
  }
  return previous[right.length];
}

function sameName(a: string, b: string): boolean {
  return similarity(a, b) >= 0.75 || editDistance(dedupeKey(a), dedupeKey(b)) <= 2;
}

/** Two records within 500 m whose names match describe the same place. */
function mergeNearDuplicates(candidates: Candidate[]): Candidate[] {
  const kept: Candidate[] = [];
  for (const candidate of candidates) {
    const duplicate = kept.find((item) => {
      const meters = haversineKm(item, candidate) * 1000;
      return meters <= 500 && sameName(item.name, candidate.name);
    });
    if (!duplicate) {
      kept.push(candidate);
      continue;
    }
    duplicate.notability = Math.max(duplicate.notability, candidate.notability);
    duplicate.articleLength = Math.max(duplicate.articleLength, candidate.articleLength);
    if (!duplicate.wikipediaUrl && candidate.wikipediaUrl) duplicate.wikipediaUrl = candidate.wikipediaUrl;
    if (duplicate.category === categoryLabel("attraction")) duplicate.category = candidate.category;
  }
  return kept;
}

function scoreOf(candidate: Candidate): number {
  let score = 0;
  score += candidate.notability;
  score += Math.min(candidate.articleLength / 9000, 3);
  if (candidate.wikipediaUrl) score += 1.5;
  if (["موزه", "بنای تاریخی", "زیارتگاه و مسجد", "قلعه", "آرامگاه", "بازار", "باغ"].includes(candidate.category)) score += 1;
  score -= Math.min(candidate.distanceKm / 6, 3);
  return score;
}
