/**
 * Durable snapshot store for everything Safarino fetches from public providers.
 *
 * Why: a live multi-provider search costs 10–15 seconds. Repeating the exact
 * same search should cost nothing, and a search for a city that was refreshed a
 * few minutes ago should be served from the store instead of crawling again.
 *
 * Two keys are written for every payload:
 *   <base>:fresh  — short TTL, served as a normal hit.
 *   <base>:last   — long TTL, served only when the fresh copy expired; the
 *                   caller then refreshes in the background. This is what keeps
 *                   the site fast and never empty when a provider is slow.
 *
 * Storage is Upstash Redis (already used by Safarino). When it is not
 * configured the helpers return null and the caller simply goes live — nothing
 * breaks, nothing is faked.
 */

import { getProviderCache, setProviderCache } from "./provider-cache";

export type Snapshot<T> = {
  value: T;
  storedAt: string;
  /** fresh | stale — how the caller should treat this payload. */
  age: "fresh" | "stale";
};

export type SnapshotSource = "fresh-cache" | "stale-cache" | "live";

function freshKey(base: string) {
  return `${base}:fresh`;
}
function lastKey(base: string) {
  return `${base}:last`;
}

/** Reads the short-lived copy only; safe to trust as "just fetched". */
export async function readFreshSnapshot<T>(base: string): Promise<T | null> {
  const payload = await getProviderCache<{ value: T; storedAt: string }>(freshKey(base));
  return payload && typeof payload === "object" ? (payload.value ?? null) : null;
}

/** Reads the long-lived copy; good enough to show while a refresh happens. */
export async function readStaleSnapshot<T>(base: string): Promise<Snapshot<T> | null> {
  const payload = await getProviderCache<{ value: T; storedAt: string }>(lastKey(base));
  if (!payload || typeof payload !== "object" || payload.value === undefined) return null;
  return { value: payload.value, storedAt: payload.storedAt, age: "stale" };
}

/** Writes both copies: the fresh one for the TTL, the last one for the day. */
export async function writeSnapshot<T>(base: string, value: T, ttlSeconds: number, keepSeconds = 86_400): Promise<void> {
  const payload = { value, storedAt: new Date().toISOString() };
  await Promise.all([
    setProviderCache(freshKey(base), payload, ttlSeconds),
    setProviderCache(lastKey(base), payload, Math.max(ttlSeconds, keepSeconds)),
  ]);
}

/**
 * The whole read path in one call: instant fresh hit, otherwise a stale copy
 * plus a background refresh task the caller can fire and forget.
 */
export async function readWithRefresh<T>(
  base: string,
  refresh: () => Promise<T | null>,
  options: { ttlSeconds: number; keepSeconds?: number },
): Promise<{ snapshot: Snapshot<T> | null; source: SnapshotSource; refreshed: (() => Promise<void>) | null }> {
  const fresh = await readFreshSnapshot<T>(base);
  if (fresh !== null) {
    return { snapshot: { value: fresh, storedAt: new Date().toISOString(), age: "fresh" }, source: "fresh-cache", refreshed: null };
  }

  const stale = await readStaleSnapshot<T>(base);
  const refreshTask = async () => {
    try {
      const value = await refresh();
      if (value !== null && value !== undefined) {
        await writeSnapshot(base, value, options.ttlSeconds, options.keepSeconds);
      }
    } catch {
      // A failed refresh must never remove the last good snapshot.
    }
  };

  if (stale) {
    return { snapshot: stale, source: "stale-cache", refreshed: refreshTask };
  }
  return { snapshot: null, source: "live", refreshed: refreshTask };
}

/** Builds a stable, short, readable cache key out of the request parameters. */
export function snapshotKey(namespace: string, params: Record<string, unknown>): string {
  const parts = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join("&");
  return `safarino:snapshot:${namespace}:${parts}`;
}
