/**
 * The cities Safarino recommends, and why.
 *
 * Only the *recommendation* is written here — «این شهر برای این نوع سفر خوب
 * است». The attractions themselves are never written by hand: they come from
 * the same real sources (Wikipedia / Wikidata / OSM) as the rest of the site,
 * so nothing in this file can put a made-up place on a page.
 */

import { PROFILED_CITIES } from "./city-profiles";

export type DiscoverCity = {
  /** The name used everywhere else on the site (and in provider searches). */
  name: string;
  province: string;
  /** One line a traveller can decide with. */
  tagline: string;
  /** Two or three short, practical reasons. */
  highlights: string[];
  /** Who this city suits. */
  bestFor: string[];
  /** The best months to go, in plain Persian. */
  bestSeason: string;
  /** Typical number of days worth staying. */
  suggestedDays: number;
  /** A rough character, used for filtering on the page. */
  moods: DiscoverMood[];
};

export type DiscoverMood = "تاریخی" | "زیارتی" | "طبیعت" | "ساحلی" | "شهری" | "کوهستانی" | "کویری";

export const DISCOVER_MOODS: DiscoverMood[] = ["تاریخی", "زیارتی", "طبیعت", "ساحلی", "شهری", "کوهستانی", "کویری"];

/**
 * The full recommendation list, built from the city profiles.
 *
 * Every Iranian city Safarino has a real character for is here — a hundred of
 * them, not a dozen — so a traveller who loves history, or the sea, or the
 * desert, is never offered only three options. The curated six at the top of
 * the profile file keep their place as the most-visited cities.
 */
export const DISCOVER_CITIES: DiscoverCity[] = PROFILED_CITIES.map((city) => ({
  name: city.name,
  province: city.province,
  tagline: city.tagline,
  highlights: city.highlights,
  bestFor: city.bestFor,
  bestSeason: city.bestSeason,
  suggestedDays: city.suggestedDays,
  moods: city.moods,
}));

export function findCity(name: string | null | undefined): DiscoverCity | null {
  if (typeof name !== "string") return null;
  const wanted = name.trim();
  if (!wanted) return null;
  return DISCOVER_CITIES.find((city) => city.name === wanted) || null;
}

/** Filters the city list by a mood and a free-text query (Persian, forgiving). */
export function filterCities(cities: DiscoverCity[], options: { query?: string; mood?: DiscoverMood | null }): DiscoverCity[] {
  const query = (options.query || "").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
  return cities.filter((city) => {
    if (options.mood && !city.moods.includes(options.mood)) return false;
    if (!query) return true;
    const haystack = [city.name, city.province, city.tagline, city.bestFor.join(" "), city.highlights.join(" ")]
      .join(" ")
      .replace(/[يى]/g, "ی")
      .replace(/ك/g, "ک");
    return haystack.includes(query);
  });
}
