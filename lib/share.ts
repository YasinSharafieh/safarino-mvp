/**
 * Sharing a finished plan.
 *
 * A shared plan is a read-only snapshot of what the traveller was looking at:
 * the same days, the same stops, the same measured kilometres and the same
 * money. Two ways to send it:
 *
 *  - a short link  `/s/<code>` (needs the Upstash store Safarino already uses),
 *  - a self-contained link that carries the plan inside the address itself,
 *    used only when the store is unavailable. It is long, but it never lies
 *    and never breaks.
 *
 * Nothing personal and nothing secret is ever put into a shared plan: no
 * tokens, no keys, no e-mail. Only the trip itself.
 */

import { getProviderCache, setProviderCache } from "./provider-cache";

export const SHARE_PREFIX = "safarino:share:v1:";
/** A shared plan is a snapshot; after this it is gone and the page says so. */
export const SHARE_TTL_SECONDS = 60 * 60 * 24 * 60; // ۶۰ روز
export const SHARE_MAX_DAYS = 10;
export const SHARE_MAX_STOPS_PER_DAY = 12;
/** The self-contained link must stay inside what messengers accept. */
export const INLINE_URL_LIMIT = 2400;

export type ShareStop = {
  n: string;
  c: string;
  la: number;
  lo: number;
  t: string;
  v: number;
  d?: string;
  i?: string;
  km?: number | null;
  mn?: number | null;
};

export type ShareDay = {
  d: number;
  th: string;
  ar: string;
  km: number;
  mn: number;
  lunch?: number;
  stops: ShareStop[];
};

export type ShareWeatherDay = {
  date: string;
  label: string;
  code: number;
  maxC: number | null;
  minC: number | null;
  rainProbability: number | null;
  advice: string;
};

export type ShareMoney = {
  total: number;
  real: number;
  estimate: number;
  budget: number | null;
  remaining: number | null;
  lines: { label: string; amount: number | null; kind: "real" | "estimate" | "missing" }[];
};

export type ShareTrip = {
  v: 1;
  city: string;
  createdAt: string;
  days: ShareDay[];
  totals: { km: number; driveMinutes: number; stops: number; days: number };
  engine: string;
  note?: string;
  weather?: { mode: "forecast" | "normals"; note: string; days: ShareWeatherDay[] } | null;
  money?: ShareMoney | null;
};

function short(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

function finite(value: unknown): number | null {
  // null/undefined/"" are "no number", not zero — a missing price must stay missing.
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function coord(value: unknown, limit: number): number | null {
  const number = finite(value);
  if (number === null || Math.abs(number) > limit) return null;
  return Math.round(number * 100000) / 100000;
}

/**
 * Takes whatever the page is holding and returns a small, safe, validated
 * snapshot. Anything unexpected is dropped instead of being published.
 */
export function compactTrip(input: unknown): ShareTrip | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const rawDays = Array.isArray(raw.days) ? raw.days : [];
  if (!rawDays.length) return null;
  const city = short(raw.city, 60);
  if (!city) return null;

  const days: ShareDay[] = [];
  for (const item of rawDays.slice(0, SHARE_MAX_DAYS)) {
    const day = item as Record<string, unknown>;
    const rawStops = Array.isArray(day.stops) ? day.stops : [];
    const stops: ShareStop[] = [];
    for (const stopItem of rawStops.slice(0, SHARE_MAX_STOPS_PER_DAY)) {
      const stop = stopItem as Record<string, unknown>;
      const place = (stop.place || {}) as Record<string, unknown>;
      // Accept a raw plan (place.latitude, stop.place.name) and an already
      // compacted one (la/lo/n) — the same validator guards both doors.
      const latitude = coord(place.latitude ?? stop.la, 90);
      const longitude = coord(place.longitude ?? stop.lo, 180);
      const name = short(place.name ?? stop.n, 90);
      if (latitude === null || longitude === null || !name) continue;
      const entry: ShareStop = {
        n: name,
        c: short(place.category ?? stop.c, 40),
        la: latitude,
        lo: longitude,
        t: short(stop.startTime ?? stop.t, 8) || "—",
        v: Math.max(0, Math.round(finite(stop.visitMinutes ?? stop.v) ?? 0)),
      };
      const description = short(place.description ?? stop.d, 240);
      if (description) entry.d = description;
      const image = short(place.imageUrl ?? stop.i, 400);
      if (image) entry.i = image;
      const km = finite(stop.legKm ?? stop.km);
      if (km !== null && km >= 0) entry.km = Math.round(km * 10) / 10;
      const minutes = finite(stop.legMinutes ?? stop.mn);
      if (minutes !== null && minutes >= 0) entry.mn = Math.round(minutes);
      stops.push(entry);
    }
    if (!stops.length) continue;
    const lunch = Math.round(finite(day.lunchAfter ?? day.lunch) ?? 0);
    days.push({
      d: Math.round(finite(day.day ?? day.d) ?? days.length + 1),
      th: short(day.theme ?? day.th, 60),
      ar: short(day.area ?? day.ar, 60),
      km: Math.round((finite(day.totalKm ?? day.km) ?? stops.reduce((sum, stop) => sum + (stop.km || 0), 0)) * 10) / 10,
      mn: Math.round(finite(day.totalDriveMinutes ?? day.mn) ?? stops.reduce((sum, stop) => sum + (stop.mn || 0), 0)),
      ...(lunch > 0 ? { lunch } : {}),
      stops,
    });
  }
  if (!days.length) return null;

  const allStops = days.reduce((sum, day) => sum + day.stops.length, 0);
  const allKm = Math.round(days.reduce((sum, day) => sum + day.km, 0) * 10) / 10;
  const allMinutes = days.reduce((sum, day) => sum + day.mn, 0);

  const weatherRaw = raw.weather as Record<string, unknown> | undefined;
  let weather: ShareTrip["weather"] = null;
  if (weatherRaw && Array.isArray(weatherRaw.days) && weatherRaw.days.length) {
    const weatherDays: ShareWeatherDay[] = [];
    for (const item of weatherRaw.days.slice(0, SHARE_MAX_DAYS)) {
      const day = item as Record<string, unknown>;
      const date = short(day.date, 20);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      weatherDays.push({
        date,
        label: short(day.label, 40),
        code: Math.round(finite(day.code) ?? -1),
        maxC: finite(day.maxC) === null ? null : Math.round(finite(day.maxC) as number),
        minC: finite(day.minC) === null ? null : Math.round(finite(day.minC) as number),
        rainProbability: finite(day.rainProbability) === null ? null : Math.round(finite(day.rainProbability) as number),
        advice: short(day.advice, 200),
      });
    }
    if (weatherDays.length) {
      weather = {
        mode: weatherRaw.mode === "forecast" ? "forecast" : "normals",
        note: short(weatherRaw.note, 240),
        days: weatherDays,
      };
    }
  }

  const moneyRaw = raw.money as Record<string, unknown> | undefined;
  let money: ShareMoney | null = null;
  if (moneyRaw && Array.isArray(moneyRaw.lines)) {
    const lines = (moneyRaw.lines as unknown[]).slice(0, 8).map((entry) => {
      const line = entry as Record<string, unknown>;
      const amount = finite(line.amount);
      const kind = line.kind === "real" ? "real" : line.kind === "estimate" ? "estimate" : "missing";
      return {
        label: short(line.label, 40),
        amount: amount === null ? null : Math.round(amount),
        kind: kind as "real" | "estimate" | "missing",
      };
    });
    const total = finite(moneyRaw.total);
    if (lines.length && total !== null) {
      money = {
        total: Math.round(total),
        real: Math.round(finite(moneyRaw.real) ?? 0),
        estimate: Math.round(finite(moneyRaw.estimate) ?? 0),
        budget: finite(moneyRaw.budget) === null ? null : Math.round(finite(moneyRaw.budget) as number),
        remaining: finite(moneyRaw.remaining) === null ? null : Math.round(finite(moneyRaw.remaining) as number),
        lines,
      };
    }
  }

  return {
    v: 1,
    city,
    createdAt: new Date().toISOString(),
    days,
    totals: { km: allKm, driveMinutes: allMinutes, stops: allStops, days: days.length },
    engine: short(raw.engine, 30) || "—",
    note: short(raw.note, 240),
    weather,
    money,
  };
}

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
/** A short code that is easy to read out loud and hard to guess. */
export function makeShareCode(random: () => number = Math.random): string {
  let code = "";
  for (let index = 0; index < 9; index += 1) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  }
  return code;
}

export function isValidShareCode(code: unknown): code is string {
  return typeof code === "string" && /^[a-z0-9]{6,16}$/.test(code);
}

/** Stores a plan and returns its code. Null means the store is unreachable. */
export async function saveSharedTrip(trip: ShareTrip, code = makeShareCode()): Promise<string | null> {
  if (!isValidShareCode(code)) return null;
  try {
    await setProviderCache(`${SHARE_PREFIX}${code}`, trip, SHARE_TTL_SECONDS);
    const saved = await getProviderCache<ShareTrip>(`${SHARE_PREFIX}${code}`);
    return saved ? code : null;
  } catch {
    return null;
  }
}

export async function loadSharedTrip(code: unknown): Promise<ShareTrip | null> {
  if (!isValidShareCode(code)) return null;
  const trip = await getProviderCache<ShareTrip>(`${SHARE_PREFIX}${code}`);
  if (!trip || typeof trip !== "object" || !Array.isArray((trip as ShareTrip).days)) return null;
  return trip;
}

/** base64url without any dependency, safe in a query string. */
export function encodeTripToToken(trip: ShareTrip): string {
  const json = JSON.stringify(trip);
  const base64 = typeof Buffer !== "undefined"
    ? Buffer.from(json, "utf8").toString("base64")
    : // Browser fallback: percent-encode first so Persian survives btoa.
      btoa(unescape(encodeURIComponent(json)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeTripToken(token: unknown): ShareTrip | null {
  if (typeof token !== "string" || token.length < 20 || token.length > 20000) return null;
  try {
    const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = typeof Buffer !== "undefined"
      ? Buffer.from(padded, "base64").toString("utf8")
      : decodeURIComponent(escape(atob(padded)));
    const parsed = JSON.parse(json) as ShareTrip;
    return parsed && parsed.v === 1 && Array.isArray(parsed.days) && parsed.days.length ? parsed : null;
  } catch {
    return null;
  }
}

/** One honest sentence about what the link is. */
export function shareSummary(trip: ShareTrip): string {
  const parts = [
    `برنامهٔ سفر ${trip.city}`,
    `${faNum(trip.totals.days)} روز`,
    `${faNum(trip.totals.stops)} ایستگاه`,
    `${faNum(trip.totals.km)} کیلومتر رانندگی`,
  ];
  if (trip.money) parts.push(`حدود ${new Intl.NumberFormat("fa-IR").format(trip.money.total)} تومان`);
  return parts.join(" · ");
}

export function whatsappShareUrl(link: string, trip: ShareTrip): string {
  const text = `${shareSummary(trip)}\n${link}\n(ساخته‌شده با سفرینو)`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramShareUrl(link: string, trip: ShareTrip): string {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareSummary(trip))}`;
}

function faNum(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}
