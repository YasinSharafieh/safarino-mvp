/**
 * Turns an AI draft into a validated itinerary that only contains real places.
 * Every sightseeing stop must reference a POI that came from OpenStreetMap,
 * Wikidata or Persian Wikipedia; anything else is dropped and replaced with a
 * real POI instead of being shown to the traveller.
 */

export type PlanPoi = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  sourceUrl?: string;
  wikipediaUrl?: string | null;
};

export type PlanItem = {
  time: string;
  title: string;
  description: string;
  type: "sightseeing" | "food" | "transport" | "rest" | "activity";
  poiId?: string;
  poiCategory?: string;
  poiSourceUrl?: string;
  poiWikipediaUrl?: string | null;
  poiDistanceKm?: number;
};

export type PlanDay = { day: number; title: string; items: PlanItem[] };

const FILL_TIMES = ["۰۹:۳۰", "۱۱:۳۰", "۱۵:۳۰", "۱۷:۳۰"];

export function sanitizePois(value: unknown): PlanPoi[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const pois: PlanPoi[] = [];
  for (const raw of value.slice(0, 60)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.slice(0, 120) : "";
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 140) : "";
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);
    if (!id || !name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    pois.push({
      id,
      name,
      category: typeof item.category === "string" ? item.category.slice(0, 60) : "جاذبه",
      latitude,
      longitude,
      distanceKm: Number.isFinite(Number(item.distanceKm)) ? Number(item.distanceKm) : undefined,
      sourceUrl: typeof item.sourceUrl === "string" && /^https?:\/\//.test(item.sourceUrl) ? item.sourceUrl : undefined,
      wikipediaUrl: typeof item.wikipediaUrl === "string" && /^https?:\/\//.test(item.wikipediaUrl) ? item.wikipediaUrl : null,
    });
  }
  return pois;
}

function poiFields(poi: PlanPoi): Pick<PlanItem, "poiId" | "poiCategory" | "poiSourceUrl" | "poiWikipediaUrl" | "poiDistanceKm"> {
  return {
    poiId: poi.id,
    poiCategory: poi.category,
    poiSourceUrl: poi.wikipediaUrl || poi.sourceUrl || undefined,
    poiWikipediaUrl: poi.wikipediaUrl ?? null,
    poiDistanceKm: poi.distanceKm,
  };
}

/**
 * @param draft days produced by the model (already shape-checked)
 * @param pois  real POIs offered to the model
 * @param dayCount expected number of days
 */
export function assembleItinerary(draft: PlanDay[], pois: PlanPoi[], dayCount: number): { days: PlanDay[]; usedPois: number; droppedStops: number; filledStops: number } {
  const byId = new Map(pois.map((poi) => [poi.id, poi]));
  const used = new Set<string>();
  let droppedStops = 0;

  const days: PlanDay[] = draft.slice(0, Math.max(1, dayCount)).map((day, index) => ({
    day: index + 1,
    title: day.title,
    items: day.items.flatMap<PlanItem>((item) => {
      if (item.type !== "sightseeing") return [item];
      const rawId = (item as PlanItem & { poiId?: string }).poiId;
      const poi = rawId ? byId.get(rawId) : undefined;
      if (!poi || used.has(poi.id)) {
        droppedStops += 1;
        return [];
      }
      used.add(poi.id);
      return [{ ...item, title: poi.name, ...poiFields(poi) }];
    }),
  }));

  // Fill days that end up without any real place, using unused POIs in ranked order.
  let filledStops = 0;
  const pool = pois.filter((poi) => !used.has(poi.id));
  for (const day of days) {
    const hasSightseeing = day.items.some((item) => item.type === "sightseeing");
    const needed = hasSightseeing ? 0 : Math.min(2, Math.max(1, 3 - day.items.length));
    for (let index = 0; index < needed && pool.length; index += 1) {
      const poi = pool.shift();
      if (!poi) break;
      used.add(poi.id);
      filledStops += 1;
      day.items.push({
        time: FILL_TIMES[(day.day + index) % FILL_TIMES.length],
        title: poi.name,
        description: `${poi.name} از جاذبه‌های ثبت‌شده در ${poi.category} است؛ زمان بازدید را با توجه به ساعت کاری محل تنظیم کنید.`,
        type: "sightseeing",
        ...poiFields(poi),
      });
    }
    day.items.sort((a, b) => a.time.localeCompare(b.time, "fa"));
  }

  return { days, usedPois: used.size, droppedStops, filledStops };
}

export type BudgetInput = {
  totalBudget: number;
  transportCost: number;
  accommodationCost: number;
  aiFood: number;
  aiActivities: number;
};

/**
 * The budget summary is computed on the server from the costs the traveller
 * actually selected, so the interface can never show a different total than
 * the transport and accommodation stages.
 */
export function synchronizeBudget(input: BudgetInput): {
  totalBudget: number;
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  remaining: number;
} {
  const totalBudget = Math.max(0, Math.round(input.totalBudget));
  const transport = Math.max(0, Math.min(Math.round(input.transportCost), totalBudget));
  const accommodation = Math.max(0, Math.min(Math.round(input.accommodationCost), totalBudget - transport));
  const free = totalBudget - transport - accommodation;

  const foodFloor = Math.round(free * 0.15);
  const foodCeiling = Math.round(free * 0.4);
  const activitiesCeiling = Math.round(free * 0.3);
  const food = Math.min(Math.max(Math.round(input.aiFood) || foodFloor, foodFloor), Math.max(foodFloor, foodCeiling));
  const activities = Math.min(Math.max(Math.round(input.aiActivities) || Math.round(free * 0.15), 0), Math.max(0, activitiesCeiling));
  const remaining = Math.max(0, free - food - activities);

  return { totalBudget, transport, accommodation, food, activities, remaining };
}
