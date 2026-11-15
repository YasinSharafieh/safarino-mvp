/**
 * The places the traveller chose for this trip, kept on their own device.
 *
 * Step ۴ asks «کدامها را میخواهی ببینی؟» — every place the traveller adds is
 * stored here, so the AI (or the local slot-fit) builds the days from exactly
 * those places, and the itinerary page shows the same list without asking again.
 * Nothing is sent to a server until the traveller presses «ساخت برنامه».
 */

export const PLAN_PLACES_KEY = "safarino-plan-places-v1";

export type PlanPlace = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  wikipediaUrl?: string | null;
  sourceUrl?: string | null;
  description?: string;
};

function clean(value: unknown): PlanPlace | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!id || !name) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    id,
    name,
    category: typeof raw.category === "string" ? raw.category : "جاذبه",
    latitude,
    longitude,
    distanceKm: Number.isFinite(Number(raw.distanceKm)) ? Number(raw.distanceKm) : 0,
    wikipediaUrl: typeof raw.wikipediaUrl === "string" ? raw.wikipediaUrl : null,
    sourceUrl: typeof raw.sourceUrl === "string" ? raw.sourceUrl : null,
    description: typeof raw.description === "string" ? raw.description.slice(0, 600) : undefined,
  };
}

export function readPlanPlaces(): PlanPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PLAN_PLACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(clean).filter((item): item is PlanPlace => Boolean(item));
  } catch {
    return [];
  }
}

export function writePlanPlaces(places: PlanPlace[]): PlanPlace[] {
  if (typeof window === "undefined") return places;
  try {
    window.localStorage.setItem(PLAN_PLACES_KEY, JSON.stringify(places));
  } catch {
    // A blocked storage only means the list lives until this tab is closed.
  }
  return places;
}

/** Adds a place once; adding the same place twice never duplicates the row. */
export function togglePlanPlace(place: PlanPlace): PlanPlace[] {
  const current = readPlanPlaces();
  const exists = current.some((item) => item.id === place.id);
  const next = exists ? current.filter((item) => item.id !== place.id) : [...current, place];
  return writePlanPlaces(next);
}

export function clearPlanPlaces(): PlanPlace[] {
  return writePlanPlaces([]);
}
