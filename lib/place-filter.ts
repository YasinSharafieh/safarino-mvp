/**
 * Finding one place among many: a forgiving Persian search, a few honest
 * filters, and a sensible order. Pure functions, so the same rules can be
 * tested and used on both the plan page and the day-by-day page.
 */

export type FilterablePlace = {
  id: string;
  name: string;
  category: string;
  address?: string;
  distanceKm?: number | null;
  imageKind?: "photo" | "map" | "none";
  wikipediaUrl?: string | null;
  description?: string;
};

export type SortMode = "distance" | "name" | "popular";

export type FilterOptions = {
  query?: string;
  categories?: string[];
  onlyWithPhoto?: boolean;
  onlyWithArticle?: boolean;
  onlyFavorites?: boolean;
  maxDistanceKm?: number | null;
  favorites?: string[];
  sort?: SortMode;
};

/**
 * Persian text, made comparable: Arabic yeh/kaf → Persian, diacritics and
 * zero-width joiners removed, Arabic-Indic digits → Latin, spaces collapsed.
 */
export function normalizeFa(value: string): string {
  return (value || "")
    // آ/أ/إ are typed as ا all the time; treat them the same.
    .replace(/[\u0622\u0623\u0625]/g, "\u0627")
    .replace(/\u064a/g, "\u06cc")
    .replace(/\u0643/g, "\u06a9")
    .replace(/[\u064b-\u0655\u0670\u0640]/g, "")
    .replace(/\u200c/g, " ")
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Every word of the query must appear somewhere in the place. */
export function matchesQuery(place: FilterablePlace, query: string): boolean {
  const words = normalizeFa(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const haystack = normalizeFa([place.name, place.category, place.address || "", place.description || ""].join(" "));
  return words.every((word) => haystack.includes(word));
}

export function categoryCounts(places: FilterablePlace[]): { category: string; count: number }[] {
  const counts = new Map<string, number>();
  places.forEach((place) => {
    const key = (place.category || "دسته‌بندی نشده").trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, "fa"));
}

export function filterPlaces<T extends FilterablePlace>(places: T[], options: FilterOptions = {}): T[] {
  const favorites = new Set(options.favorites || []);
  const categories = new Set((options.categories || []).map((category) => category.trim()).filter(Boolean));
  const maxDistance = typeof options.maxDistanceKm === "number" && options.maxDistanceKm > 0 ? options.maxDistanceKm : null;

  const filtered = places.filter((place) => {
    if (!matchesQuery(place, options.query || "")) return false;
    if (categories.size && !categories.has((place.category || "").trim())) return false;
    if (options.onlyWithPhoto && place.imageKind !== "photo") return false;
    if (options.onlyWithArticle && !place.wikipediaUrl) return false;
    if (options.onlyFavorites && !favorites.has(place.id)) return false;
    if (maxDistance !== null) {
      if (typeof place.distanceKm !== "number" || place.distanceKm > maxDistance) return false;
    }
    return true;
  });

  const sort: SortMode = options.sort || "distance";
  return filtered.sort((a, b) => {
    if (sort === "name") return normalizeFa(a.name).localeCompare(normalizeFa(b.name), "fa");
    if (sort === "popular") {
      const score = (place: FilterablePlace) => (place.wikipediaUrl ? 2 : 0) + (place.description ? 1 : 0) + (place.imageKind === "photo" ? 1 : 0);
      return score(b) - score(a);
    }
    const aDistance = typeof a.distanceKm === "number" ? a.distanceKm : Number.POSITIVE_INFINITY;
    const bDistance = typeof b.distanceKm === "number" ? b.distanceKm : Number.POSITIVE_INFINITY;
    return aDistance - bDistance;
  });
}

/** A short sentence telling the traveller what they are looking at. */
export function filterSummary(shown: number, total: number, options: FilterOptions = {}): string {
  if (!total) return "مکانی برای نمایش نیست.";
  if (shown === total) return `${new Intl.NumberFormat("fa-IR").format(total)} مکان`;
  const bits: string[] = [];
  if (options.query) bits.push(`جست‌وجوی «${options.query}»`);
  if (options.categories?.length) bits.push(options.categories.length === 1 ? `دستهٔ ${options.categories[0]}` : `${options.categories.length} دسته`);
  if (options.onlyWithPhoto) bits.push("دارای عکس");
  if (options.onlyWithArticle) bits.push("دارای مقاله");
  if (options.onlyFavorites) bits.push("علاقه‌مندی‌ها");
  if (options.maxDistanceKm) bits.push(`تا ${options.maxDistanceKm} کیلومتر`);
  const reason = bits.length ? ` با ${bits.join("، ")}` : "";
  return `${new Intl.NumberFormat("fa-IR").format(shown)} از ${new Intl.NumberFormat("fa-IR").format(total)} مکان${reason}`;
}
