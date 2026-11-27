/**
 * «همیشه تازه» — demand-driven freshness for the provider data.
 *
 * The warm-up job used to heat a fixed list of route/date pairs the author
 * guessed. A real traveller rarely picks one of those: they search their own
 * origin, destination, party and date. So the site crawls for them — once, and
 * then again on every reload, when a cached copy could have been waiting.
 *
 * This file closes that gap in two small pieces:
 *
 *  1. **Demand** — every real search records *what* was searched (never *who*),
 *     with a decaying score. The warm-up then heats the searched-for keys first,
 *     so the traveller's next visit is instant and still live.
 *  2. **Freshness** — a payload reports how old it is, and whether that age is
 *     still acceptable for its kind of data (tickets change faster than rooms).
 *     The interface can then say «۲۰ دقیقه پیش» instead of pretending the price
 *     is from this second, and refresh by itself when the tab comes back.
 *
 * Only counts and public route data are stored: no user id, no cookie, no trip.
 */

import { getProviderCache, setProviderCache } from "./provider-cache";

const DEMAND_KEY = "safarino:demand:v1";
const DEMAND_MAX_ENTRIES = 400;

/**
 * How long a copy of each kind stays honest.
 *
 * These numbers are the product decision, not a technical default: a ticket that
 * is 25 minutes old may already be sold out, while a room list from yesterday
 * still tells the truth about next month.
 */
export const FRESHNESS = {
  ticket: { comfortableSeconds: 900, staleSeconds: 1_800 },
  room: { comfortableSeconds: 1_800, staleSeconds: 4 * 3_600 },
  pois: { comfortableSeconds: 24 * 3_600, staleSeconds: 7 * 86_400 },
} as const;

export type FreshnessKind = keyof typeof FRESHNESS;

export type Freshness = {
  ageSeconds: number | null;
  /** Comfortably fresh: no need to say anything. */
  comfortable: boolean;
  /** Older than the comfortable window — the interface should offer a refresh. */
  ageing: boolean;
  /** Past the stale window — the data is a saved copy, not a live answer. */
  stale: boolean;
  /** «۱۲ دقیقه پیش» — a sentence a traveller can read. */
  label: string;
};

/** Persian digits, local to this file so it can run on the server and the client. */
function fa(value: number): string {
  return String(Math.round(value)).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

/**
 * The age of a payload, in plain words.
 *
 * `storedAt`/`fetchedAt` come from the provider answer itself, so an old number
 * is never dressed up as new. A missing timestamp is reported as unknown rather
 * than guessed.
 */
export function freshnessOf(kind: FreshnessKind, timestamp: string | null | undefined, now = Date.now()): Freshness {
  const window = FRESHNESS[kind];
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
  const blank: Freshness = { ageSeconds: null, comfortable: false, ageing: true, stale: true, label: "زمان دریافت نامعلوم" };
  if (!Number.isFinite(parsed)) return blank;

  const ageSeconds = Math.max(0, Math.round((now - parsed) / 1000));
  const minutes = Math.floor(ageSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const label =
    ageSeconds < 60
      ? "همین حالا"
      : minutes < 60
        ? `${fa(minutes)} دقیقه پیش`
        : hours < 24
          ? `${fa(hours)} ساعت پیش`
          : `${fa(days)} روز پیش`;

  return {
    ageSeconds,
    comfortable: ageSeconds <= window.comfortableSeconds,
    ageing: ageSeconds > window.comfortableSeconds && ageSeconds <= window.staleSeconds,
    stale: ageSeconds > window.staleSeconds,
    label,
  };
}

/* ------------------------------------------------------------------------ demand */

export type DemandKind = "ticket" | "room" | "pois";

export type DemandEntry = { key: string; kind: DemandKind; hits: number; lastAt: number };

/** A stable, human-readable key: what was searched, never who searched it. */
export function demandKey(kind: DemandKind, parts: Record<string, unknown>): string {
  const ordered = Object.keys(parts)
    .sort()
    .map((name) => `${name}=${String(parts[name] ?? "").trim().toLowerCase()}`)
    .join("&");
  return `${kind}|${ordered}`;
}

/**
 * Records one real search. Reading and writing the whole map is deliberate: it
 * is capped at a few hundred entries, and one round-trip is cheaper than a
 * sorted-set query per search.
 */
export async function recordDemand(kind: DemandKind, parts: Record<string, unknown>): Promise<void> {
  const key = demandKey(kind, parts);
  try {
    const current = (await getProviderCache<DemandEntry[]>(DEMAND_KEY)) || [];
    const at = Date.now();
    const found = current.find((entry) => entry.key === key);
    if (found) {
      found.hits += 1;
      found.lastAt = at;
    } else {
      current.push({ key, kind, hits: 1, lastAt: at });
    }
    /**
     * Recent searches matter more than old popular ones: a summer route is not
     * the hottest route in winter. The score halves every thirty days, so the
     * list follows the season instead of freezing.
     */
    const ranked = current
      .map((entry) => ({ ...entry, score: entry.hits * Math.pow(0.5, Math.max(0, at - entry.lastAt) / (30 * 86_400_000)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, DEMAND_MAX_ENTRIES)
      .map(({ key: entryKey, kind: entryKind, hits, lastAt }) => ({ key: entryKey, kind: entryKind, hits, lastAt }));
    await setProviderCache(DEMAND_KEY, ranked, 45 * 86_400);
  } catch {
    // Freshness is a bonus: a failed write must never break a search.
  }
}

/** The searches worth warming right now, hottest first. */
export async function topDemand(kind: DemandKind, limit = 12): Promise<DemandEntry[]> {
  try {
    const current = (await getProviderCache<DemandEntry[]>(DEMAND_KEY)) || [];
    return current.filter((entry) => entry.kind === kind).sort((a, b) => b.lastAt - a.lastAt).slice(0, limit);
  } catch {
    return [];
  }
}

/** Turns a demand key back into the arguments a search needs. */
export function parseDemandKey(key: string): { kind: DemandKind; parts: Record<string, string> } | null {
  const [kind, rest] = key.split("|");
  if (!kind || !rest) return null;
  const parts: Record<string, string> = {};
  for (const pair of rest.split("&")) {
    const [name, value] = pair.split("=");
    if (name) parts[name] = value ?? "";
  }
  return { kind: kind as DemandKind, parts };
}
