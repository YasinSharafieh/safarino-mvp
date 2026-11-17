/**
 * «قیمت این مسیر دارد چه می‌کند؟»
 *
 * Every time a real search comes back, its cheapest price is written down with
 * the time it was read. After that the app can say something no invented table
 * can: *this route was 230,000 toman cheaper yesterday*. It is built only from
 * prices Safarino itself read from the providers — never from an estimate, never
 * from a guess, never from a model.
 *
 * Storage is the same Upstash Redis the snapshots use, under one key per search,
 * holding at most `MAX_POINTS` readings. When Redis is not configured the
 * function returns null and the interface simply says nothing — it never fakes a
 * trend.
 */

import { getProviderCache, setProviderCache } from "./provider-cache";

export type PricePoint = {
  /** ISO timestamp of the reading. */
  at: string;
  /** Cheapest total for the party, in toman. */
  priceToman: number;
  /** How many offers were on the page when it was read. */
  offers: number;
};

export type PriceTrend = {
  /** The newest reading — always real. */
  latest: PricePoint;
  /** The oldest reading inside the comparison window. */
  baseline: PricePoint;
  /** Signed change in toman (negative = cheaper now). */
  deltaToman: number;
  /** Signed change as a percentage, rounded to one decimal. */
  deltaPct: number;
  direction: "down" | "up" | "flat";
  /** One honest Persian sentence. */
  message: string;
  /** How many readings exist, so the interface can say «بر پایهٔ ۳ بار خواندن». */
  readings: number;
};

const MAX_POINTS = 24;
const HISTORY_SECONDS = 60 * 60 * 24 * 21;

export function priceWatchKey(kind: "transport" | "accommodation", parts: Record<string, string | number | undefined>): string {
  const signature = Object.keys(parts)
    .sort()
    .map((key) => `${key}=${String(parts[key] ?? "")}`)
    .join("|");
  return `safarino:price-watch:v1:${kind}:${encodeURIComponent(signature).slice(0, 160)}`;
}

async function readHistory(key: string): Promise<PricePoint[]> {
  const stored = await getProviderCache<PricePoint[]>(key);
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (point) => point && typeof point.priceToman === "number" && point.priceToman > 0 && typeof point.at === "string",
  );
}

/**
 * Writes one reading. A reading less than `minGapMinutes` after the previous one
 * replaces nothing — otherwise a page refresh would fill the history with the
 * same minute and make the trend meaningless.
 */
export async function recordPrice(input: {
  key: string;
  priceToman: number;
  offers: number;
  minGapMinutes?: number;
  now?: Date;
}): Promise<PriceTrend | null> {
  const price = Math.round(input.priceToman);
  if (!Number.isFinite(price) || price <= 0) return null;
  const now = input.now || new Date();
  const history = await readHistory(input.key);
  const last = history[history.length - 1];
  const gapMs = (input.minGapMinutes ?? 20) * 60_000;
  const shouldAppend = !last || now.getTime() - new Date(last.at).getTime() >= gapMs;

  const next = shouldAppend
    ? [...history, { at: now.toISOString(), priceToman: price, offers: Math.max(0, Math.round(input.offers)) }].slice(-MAX_POINTS)
    : [...history.slice(0, -1), { at: last.at, priceToman: price, offers: Math.max(0, Math.round(input.offers)) }];

  if (shouldAppend || last.priceToman !== price) {
    await setProviderCache(input.key, next, HISTORY_SECONDS);
  }
  return trendFrom(next);
}

export function trendFrom(history: PricePoint[]): PriceTrend | null {
  if (!history.length) return null;
  const latest = history[history.length - 1];
  if (history.length === 1) {
    return {
      latest,
      baseline: latest,
      deltaToman: 0,
      deltaPct: 0,
      direction: "flat",
      message: "این اولین باری است که قیمت این مسیر خوانده می‌شود؛ از دفعهٔ بعد می‌گویم ارزان‌تر شده یا گران‌تر.",
      readings: 1,
    };
  }

  // Compare with the reading closest to 24 hours ago, or the oldest we have.
  const target = latest.at ? new Date(latest.at).getTime() - 86_400_000 : 0;
  const baseline =
    history
      .slice(0, -1)
      .reduce((best, point) => {
        const distance = Math.abs(new Date(point.at).getTime() - target);
        const bestDistance = Math.abs(new Date(best.at).getTime() - target);
        return distance < bestDistance ? point : best;
      }) || history[0];

  const deltaToman = latest.priceToman - baseline.priceToman;
  const deltaPct = baseline.priceToman > 0 ? Math.round((deltaToman / baseline.priceToman) * 1000) / 10 : 0;
  const direction: PriceTrend["direction"] = deltaToman < -1_000 ? "down" : deltaToman > 1_000 ? "up" : "flat";
  const fa = new Intl.NumberFormat("fa-IR");

  const message =
    direction === "flat"
      ? `قیمت نسبت به آخرین خواندن (${fa.format(baseline.priceToman)} تومان) تقریباً ثابت مانده است.`
      : direction === "down"
        ? `از ${fa.format(Math.abs(deltaToman))} تومان ارزان‌تر از قبل شده (${deltaPct}٪)؛ الان ${fa.format(latest.priceToman)} تومان.`
        : `از ${fa.format(deltaToman)} تومان گران‌تر از قبل شده (+${deltaPct}٪)؛ الان ${fa.format(latest.priceToman)} تومان.`;

  return { latest, baseline, deltaToman, deltaPct, direction, message, readings: history.length };
}

/** Reads the history without writing anything — for the page's first paint. */
export async function readPriceTrend(key: string): Promise<PriceTrend | null> {
  return trendFrom(await readHistory(key));
}

/**
 * A watch is worth speaking about only when it has a real change and enough
 * readings to mean something. Everything else stays quiet.
 */
export function isNoteworthy(trend: PriceTrend | null): boolean {
  return Boolean(trend && trend.readings >= 2 && Math.abs(trend.deltaPct) >= 3);
}
