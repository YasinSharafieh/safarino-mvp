/**
 * «بستهٔ آفلاین سفر» — everything a traveller needs in a tunnel.
 *
 * The plan alone is not enough when the network disappears: the address of the
 * hotel, the booking reference, what was already paid, and how much is left are
 * exactly what a person reaches for at a reception desk with no signal.
 *
 * So this file builds one small pack from data the device already has — the plan
 * that was just made, the chosen ticket and room, the money rows and the
 * traveller's own expense book — and keeps it in `localStorage` under one key per
 * trip. It is written by an explicit press («ذخیره برای آفلاین»), never silently,
 * and it never contains a price that was not already real on screen.
 *
 * The pack is deliberately versioned: an old pack made by an older version of the
 * app is reported as old rather than half-understood.
 */

import { tripSignature, type TripSignatureInput } from "./checklist";

export const OFFLINE_PACK_VERSION = 1;
export const OFFLINE_PACK_PREFIX = "safarino:offline-pack";

export type PackStop = {
  name: string;
  category: string;
  time: string;
  latitude: number | null;
  longitude: number | null;
  /** A phone number, only when the source really had one. */
  phone?: string | null;
};

export type PackDay = { day: number; title: string; stops: PackStop[] };

export type OfflinePack = {
  version: number;
  savedAt: string;
  trip: {
    origin: string;
    destination: string;
    departureDate: string | null;
    returnDate: string | null;
    days: number;
    travellers: number;
    children: number;
  };
  days: PackDay[];
  booking: {
    transportLabel: string | null;
    transportCost: number;
    stayName: string | null;
    stayCost: number;
    stayAddress: string | null;
    stayPhone: string | null;
  };
  money: {
    budgetToman: number;
    plannedToman: number;
    spentToman: number;
    remainingToman: number;
    rows: { label: string; toman: number; kind: "real" | "estimate" }[];
  };
  /** Any line the pack could not fill, so the page can say what is missing. */
  gaps: string[];
};

export function offlinePackKey(trip?: TripSignatureInput | string): string {
  const signature = typeof trip === "string" ? trip : trip ? tripSignature(trip) : "no-trip";
  return `${OFFLINE_PACK_PREFIX}:${signature}`;
}

/** Keeps the pack small: coordinates rounded, strings trimmed, days capped. */
export function buildOfflinePack(input: {
  trip: OfflinePack["trip"];
  days: { day: number; title?: string; stops: { name?: string; category?: string; time?: string; latitude?: number | null; longitude?: number | null; phone?: string | null }[] }[];
  booking: OfflinePack["booking"];
  money: OfflinePack["money"];
  now?: Date;
}): OfflinePack {
  const gaps: string[] = [];
  const days: PackDay[] = input.days.slice(0, 21).map((day, index) => ({
    day: Number(day.day) || index + 1,
    title: (day.title || "").trim().slice(0, 80) || `روز ${index + 1}`,
    stops: (day.stops || [])
      .slice(0, 20)
      .map((stop) => ({
        name: (stop.name || "").trim().slice(0, 90),
        category: (stop.category || "").trim().slice(0, 40),
        time: (stop.time || "").trim().slice(0, 8) || "—",
        latitude: Number.isFinite(Number(stop.latitude)) ? Math.round(Number(stop.latitude) * 1e5) / 1e5 : null,
        longitude: Number.isFinite(Number(stop.longitude)) ? Math.round(Number(stop.longitude) * 1e5) / 1e5 : null,
        phone: (stop.phone || "").trim().slice(0, 24) || null,
      }))
      .filter((stop) => stop.name.length > 0),
  }));

  if (!input.booking.stayName) gaps.push("نام و آدرس اقامتگاه انتخاب نشده است.");
  if (!input.booking.transportLabel) gaps.push("بلیت رفت انتخاب نشده است.");
  if (!input.trip.departureDate) gaps.push("تاریخ حرکت انتخاب نشده است.");
  if (!days.some((day) => day.stops.length)) gaps.push("برنامهٔ روزها هنوز ساخته نشده است.");

  return {
    version: OFFLINE_PACK_VERSION,
    savedAt: (input.now || new Date()).toISOString(),
    trip: {
      ...input.trip,
      origin: String(input.trip.origin || "").slice(0, 40),
      destination: String(input.trip.destination || "").slice(0, 40),
      days: Math.max(1, Math.min(21, Math.round(Number(input.trip.days) || 1))),
      travellers: Math.max(1, Math.round(Number(input.trip.travellers) || 1)),
      children: Math.max(0, Math.round(Number(input.trip.children) || 0)),
    },
    days,
    booking: {
      ...input.booking,
      transportCost: Math.max(0, Math.round(input.booking.transportCost || 0)),
      stayCost: Math.max(0, Math.round(input.booking.stayCost || 0)),
    },
    money: {
      ...input.money,
      budgetToman: Math.max(0, Math.round(input.money.budgetToman || 0)),
      plannedToman: Math.max(0, Math.round(input.money.plannedToman || 0)),
      spentToman: Math.max(0, Math.round(input.money.spentToman || 0)),
      remainingToman: Math.round(input.money.remainingToman || 0),
    },
    gaps,
  };
}

export function saveOfflinePack(pack: OfflinePack): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(offlinePackKey(pack.trip), JSON.stringify(pack));
    return true;
  } catch {
    return false;
  }
}

export type PackRead = { pack: OfflinePack | null; state: "missing" | "ok" | "outdated" | "unreadable" };

export function readOfflinePack(trip?: TripSignatureInput | string): PackRead {
  if (typeof window === "undefined") return { pack: null, state: "missing" };
  try {
    const raw = window.localStorage.getItem(offlinePackKey(trip));
    if (!raw) return { pack: null, state: "missing" };
    const parsed = JSON.parse(raw) as OfflinePack;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.days)) return { pack: null, state: "unreadable" };
    if (Number(parsed.version) !== OFFLINE_PACK_VERSION) return { pack: null, state: "outdated" };
    return { pack: parsed, state: "ok" };
  } catch {
    return { pack: null, state: "unreadable" };
  }
}

export function clearOfflinePack(trip?: TripSignatureInput | string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(offlinePackKey(trip));
  } catch {
    // Nothing to do.
  }
}

/**
 * How old a pack is, in words — because an offline plan from three weeks ago is
 * still useful, but the traveller must know it.
 */
export function packAge(pack: OfflinePack, now: Date = new Date()): { hours: number; text: string } {
  const saved = new Date(pack.savedAt);
  const hours = Number.isNaN(saved.getTime()) ? 0 : Math.max(0, Math.round((now.getTime() - saved.getTime()) / 3_600_000));
  const fa = new Intl.NumberFormat("fa-IR");
  const text =
    hours < 1 ? "کمتر از یک ساعت پیش" : hours < 24 ? `${fa.format(hours)} ساعت پیش` : `${fa.format(Math.round(hours / 24))} روز پیش`;
  return { hours, text };
}

/** Everything the page should warn about before the network goes away. */
export function packWarnings(pack: OfflinePack, now: Date = new Date()): string[] {
  const warnings: string[] = [];
  const age = packAge(pack, now);
  if (age.hours >= 48) warnings.push(`این بسته ${age.text} ذخیره شده و ممکن است برنامه عوض شده باشد؛ یک بار دیگر ذخیره کن.`);
  const noCoords = pack.days.flatMap((day) => day.stops).filter((stop) => stop.latitude === null || stop.longitude === null);
  if (noCoords.length) warnings.push(`برای ${noCoords.length} ایستگاه مختصات نداریم، پس مسیریابی آفلاین برایشان کار نمی‌کند.`);
  if (pack.gaps.length) warnings.push(...pack.gaps.slice(0, 3));
  return warnings;
}
