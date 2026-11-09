/**
 * Real points of interest (POIs) fetched from OpenStreetMap and Wikidata.
 * Nothing in this module invents a place: every POI carries its own upstream
 * object id, coordinates and a link back to the source that published it.
 */

export type PoiSource = "openstreetmap" | "wikidata" | "wikipedia";

export type Poi = {
  id: string;
  name: string;
  /** Persian category label, e.g. موزه / بنای تاریخی */
  category: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  source: PoiSource;
  /** Link to the upstream record (OSM object page or Wikidata item). */
  sourceUrl: string;
  /** Persian Wikipedia article when the place has one. */
  wikipediaUrl: string | null;
  /** Number of independent sources that reported the same place. */
  confirmations: number;
};

export type PoiSearchResult = {
  city: string;
  latitude: number | null;
  longitude: number | null;
  pois: Poi[];
  poisWithArticle: number;
  sources: {
    openstreetmap: "ok" | "failed";
    wikidata: "ok" | "failed";
    wikipedia: "ok" | "failed";
  };
  note: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  attraction: "جاذبه گردشگری",
  museum: "موزه",
  viewpoint: "چشم‌انداز",
  gallery: "گالری",
  zoo: "باغ‌وحش",
  theme_park: "شهربازی",
  park: "بوستان",
  monument: "بنای یادبود",
  memorial: "یادمان",
  castle: "قلعه",
  archaeological_site: "محوطه تاریخی",
  tomb: "آرامگاه",
  ruins: "آثار تاریخی",
  place_of_worship: "زیارتگاه و مسجد",
  marketplace: "بازار",
  artwork: "اثر هنری",
  garden: "باغ",
};

export function categoryLabel(kind: string): string {
  return CATEGORY_LABELS[kind] ?? "جاذبه";
}

/** Categories that make sense in a sightseeing itinerary. */
export const SIGHTSEEING_CATEGORIES = Object.keys(CATEGORY_LABELS);

export const POI_SOURCE_LABELS: Record<PoiSource, string> = {
  openstreetmap: "OpenStreetMap",
  wikidata: "ویکی‌داده",
  wikipedia: "ویکی‌پدیای فارسی",
};
