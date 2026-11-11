/**
 * Real distances from the chosen accommodation to attractions.
 *
 * Engine order (never a fake number):
 *   1. Neshan distance matrix — traffic-aware driving distance and time,
 *      used as soon as a NESHAN_API_KEY exists on the server.
 *   2. OSRM (OpenStreetMap) driving table — keyless public routing server.
 *   3. Straight-line distance via haversine — clearly labelled as such.
 *
 * Every result carries the engine that produced it and a Persian note, so the
 * interface can tell the traveller exactly where the number came from.
 */

import { getProviderCache, setProviderCache } from "./provider-cache";
import { neshanAvailable, neshanDistanceMatrix, neshanStatusNote, type NeshanStatus } from "./neshan";

export type Coordinates = { latitude: number; longitude: number };
export type DistanceTarget = Coordinates & { id: string };

export type DistanceEngine = "neshan" | "osrm" | "straight-line";

export type DistanceEntry = { id: string; distanceKm: number; durationMinutes: number | null };

export type DistanceResult = {
  engine: DistanceEngine;
  engineLabel: string;
  entries: DistanceEntry[];
  failedIds: string[];
  neshanConfigured: boolean;
  note: string;
};

const OSRM_TABLE_CHUNK = 12;

const ENGINE_LABELS: Record<DistanceEngine, string> = {
  neshan: "نشان",
  osrm: "OpenStreetMap (OSRM)",
  "straight-line": "فاصلهٔ خط مستقیم",
};

export function engineLabel(engine: DistanceEngine): string {
  return ENGINE_LABELS[engine];
}

/** Iran's rough bounding box; anything outside it is not a usable origin. */
export function usableCoordinates(point: Coordinates | null | undefined): point is Coordinates {
  if (!point) return false;
  const { latitude, longitude } = point;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 || longitude === 0) return false;
  return latitude >= 24 && latitude <= 40.5 && longitude >= 43 && longitude <= 64;
}

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * earthRadius * Math.asin(Math.sqrt(h)) * 10) / 10;
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

async function osrmTable(origin: Coordinates, targets: DistanceTarget[], timeoutMs: number) {
  const entries: DistanceEntry[] = [];
  const failedIds: string[] = [];
  for (const group of chunk(targets, OSRM_TABLE_CHUNK)) {
    const coordinates = [origin, ...group].map((point) => `${point.longitude},${point.latitude}`).join(";");
    const destinations = group.map((_, index) => index + 1).join(";");
    const url = `https://router.project-osrm.org/table/v1/driving/${coordinates}?sources=0&destinations=${destinations}&annotations=distance,duration`;
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Safarino/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`OSRM_TABLE_${response.status}`);
      const payload = (await response.json()) as { distances?: number[][]; durations?: number[][] };
      const distances = payload?.distances?.[0];
      const durations = payload?.durations?.[0];
      if (!Array.isArray(distances)) throw new Error("OSRM_TABLE_EMPTY");
      group.forEach((target, index) => {
        const meters = Number(distances[index]);
        const seconds = Number(durations?.[index]);
        if (!Number.isFinite(meters) || meters <= 0) {
          failedIds.push(target.id);
          return;
        }
        entries.push({
          id: target.id,
          distanceKm: Math.round(meters / 100) / 10,
          durationMinutes: Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null,
        });
      });
    } catch {
      group.forEach((target) => failedIds.push(target.id));
      // A single failing chunk must not throw away the chunks that worked.
    }
  }
  return { entries, failedIds };
}

function straightLine(origin: Coordinates, targets: DistanceTarget[]): DistanceEntry[] {
  return targets.map((target) => ({ id: target.id, distanceKm: haversineKm(origin, target), durationMinutes: null }));
}

function cacheKey(origin: Coordinates, targets: DistanceTarget[], engine: "neshan" | "keyless"): string {
  const originKey = `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}`;
  const targetKey = targets
    .map((target) => `${target.id}@${target.latitude.toFixed(4)},${target.longitude.toFixed(4)}`)
    .sort()
    .join("|");
  // The engine is part of the key: a result computed without a Neshan key must
  // never be served as if Neshan had produced it (and the other way round).
  return `safarino:poi-distance:v2:${engine}:${originKey}:${targetKey}`.slice(0, 900);
}

/**
 * Driving distance and travel time from one origin (the chosen accommodation)
 * to many attractions, with an explicit fallback chain.
 */
export async function computePoiDistances(
  origin: Coordinates,
  targets: DistanceTarget[],
  options: { timeoutMs?: number; cacheSeconds?: number; neshanKey?: string } = {},
): Promise<DistanceResult> {
  const clean = targets.filter((target) => target && typeof target.id === "string" && usableCoordinates(target));
  const configured = neshanAvailable(options.neshanKey);
  const base = { neshanConfigured: configured };

  if (!usableCoordinates(origin)) {
    return {
      ...base,
      engine: "straight-line",
      engineLabel: ENGINE_LABELS["straight-line"],
      entries: [],
      failedIds: clean.map((target) => target.id),
      note: "مختصات اقامتگاه انتخاب‌شده در دسترس نیست، پس فاصله‌ای هم محاسبه نشد.",
    };
  }
  if (!clean.length) {
    return {
      ...base,
      engine: "straight-line",
      engineLabel: ENGINE_LABELS["straight-line"],
      entries: [],
      failedIds: [],
      note: "جاذبه‌ای برای محاسبهٔ فاصله پیدا نشد.",
    };
  }

  const ttl = options.cacheSeconds ?? 3_600;
  const key = cacheKey(origin, clean, configured ? "neshan" : "keyless");
  const shareable = !options.neshanKey;
  if (shareable) {
    const cached = await getProviderCache<DistanceResult>(key);
    if (cached && Array.isArray(cached.entries) && cached.entries.length) return cached;
  }

  const timeoutMs = options.timeoutMs ?? 12_000;

  if (configured) {
    const matrix = await neshanDistanceMatrix(origin, clean, { key: options.neshanKey, timeoutMs });
    if (matrix.status === "ok") {
      const entries: DistanceEntry[] = [];
      const failedIds: string[] = [];
      clean.forEach((target, index) => {
        const item = matrix.items[index];
        if (item && Number.isFinite(item.distanceKm)) {
          entries.push({ id: target.id, distanceKm: item.distanceKm, durationMinutes: item.durationMinutes || null });
        } else {
          failedIds.push(target.id);
        }
      });
      if (entries.length) {
        const result: DistanceResult = {
          ...base,
          engine: "neshan",
          engineLabel: ENGINE_LABELS.neshan,
          entries,
          failedIds,
          note: neshanStatusNote("ok"),
        };
        if (shareable) await setProviderCache(key, result, ttl);
        return result;
      }
    }
    const status = matrix.status === "ok" ? "failed" : (matrix.status as Exclude<NeshanStatus, "ok">);
    const osrm = await osrmTable(origin, clean, timeoutMs);
    if (osrm.entries.length) {
      const result: DistanceResult = {
        ...base,
        engine: "osrm",
        engineLabel: ENGINE_LABELS.osrm,
        entries: osrm.entries,
        failedIds: osrm.failedIds,
        note: `${neshanStatusNote(status)} ${ENGINE_LABELS.osrm} فاصلهٔ رانندگی را حساب کرد.`,
      };
      if (shareable) await setProviderCache(key, result, ttl);
      return result;
    }
    const fallback: DistanceResult = {
      ...base,
      engine: "straight-line",
      engineLabel: ENGINE_LABELS["straight-line"],
      entries: straightLine(origin, clean),
      failedIds: [],
      note: `${neshanStatusNote(status)} مسیر رانندگی هم در دسترس نبود؛ این عددها فاصلهٔ خط مستقیم‌اند.`,
    };
    return fallback;
  }

  const osrm = await osrmTable(origin, clean, timeoutMs);
  if (osrm.entries.length) {
    const result: DistanceResult = {
      ...base,
      engine: "osrm",
      engineLabel: ENGINE_LABELS.osrm,
      entries: osrm.entries,
      failedIds: osrm.failedIds,
      note: `${ENGINE_LABELS.osrm} فاصلهٔ رانندگی از اقامتگاه انتخابی تا هر جاذبه را حساب کرد.`,
    };
    if (shareable) await setProviderCache(key, result, ttl);
    return result;
  }

  return {
    ...base,
    engine: "straight-line",
    engineLabel: ENGINE_LABELS["straight-line"],
    entries: straightLine(origin, clean),
    failedIds: [],
    note: "مسیر رانندگی از سرور عمومی در دسترس نبود؛ این عددها فاصلهٔ خط مستقیم‌اند، نه مسیر رانندگی.",
  };
}

export type RoutePair = { from: Coordinates; to: Coordinates };

/**
 * Fallback for point-to-point legs when Neshan cannot answer: OpenStreetMap's
 * routing table, asked once for many pairs. Explicitly labelled as OSRM
 * elsewhere, so the traveller always knows which engine produced a number.
 */
export async function osrmPairDistances(
  pairs: RoutePair[],
  options: { timeoutMs?: number; chunkSize?: number } = {},
): Promise<(DistanceEntry | null)[]> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const size = Math.max(1, Math.min(options.chunkSize ?? 6, 8));
  const clean = pairs.filter((pair) => pair?.from && pair?.to);
  const results: (DistanceEntry | null)[] = new Array(clean.length).fill(null);
  for (let index = 0; index < clean.length; index += size) {
    const group = clean.slice(index, index + size);
    const coordinates = [...group.map((pair) => pair.from), ...group.map((pair) => pair.to)]
      .map((point) => `${point.longitude},${point.latitude}`)
      .join(";");
    const sources = group.map((_, position) => position).join(";");
    const destinations = group.map((_, position) => position + group.length).join(";");
    const url = `https://router.project-osrm.org/table/v1/driving/${coordinates}?sources=${sources}&destinations=${destinations}&annotations=distance,duration`;
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Safarino/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as { distances?: number[][]; durations?: number[][] };
      group.forEach((_, position) => {
        const meters = Number(payload?.distances?.[position]?.[position]);
        const seconds = Number(payload?.durations?.[position]?.[position]);
        if (!Number.isFinite(meters) || meters <= 0) return;
        results[index + position] = {
          id: String(index + position),
          distanceKm: Math.round(meters / 100) / 10,
          durationMinutes: Number.isFinite(seconds) ? Math.max(1, Math.round(seconds / 60)) : null,
        };
      });
    } catch {
      // A failed chunk leaves those legs unmeasured rather than guessed.
    }
  }
  return results;
}
