import { NextRequest, NextResponse } from "next/server";
import { neshanAvailable, neshanPairDistances, neshanStatusNote, type NeshanPair } from "../../../../lib/neshan";
import { osrmPairDistances } from "../../../../lib/poi-distance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Point = { latitude: number; longitude: number };

function point(value: unknown): Point | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

/**
 * Re-measures the driving legs of a plan the traveller has edited
 * (a stop removed, a favourite added). Neshan first; OpenStreetMap only where
 * Neshan had no answer, and the label of the engine travels back with each leg.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست معتبر نیست." }, { status: 400 });
  }

  const origin = point(body.origin);
  const legs = Array.isArray(body.legs) ? (body.legs as unknown[]).map(point) : [];
  const pairs: NeshanPair[] = [];
  const indexes: number[] = [];
  legs.forEach((leg, index) => {
    if (!leg) return;
    const from = index === 0 ? origin : legs[index - 1];
    if (!from) return;
    pairs.push({ from, to: leg });
    indexes.push(index);
  });

  if (!pairs.length) {
    return NextResponse.json({ success: true, engine: "نامشخص", legs: legs.map(() => null), note: "نقطه‌ای برای اندازه‌گیری پیدا نشد." });
  }

  const measured: ({ distanceKm: number; durationMinutes: number } | null)[] = legs.map(() => null);
  const engines: string[] = legs.map(() => "");

  if (neshanAvailable()) {
    const result = await neshanPairDistances(pairs);
    if (result.status === "ok") {
      result.items.forEach((item, position) => {
        if (!item) return;
        measured[indexes[position]] = item;
        engines[indexes[position]] = "نشان";
      });
    }
  }

  const missing = measured.map((item, index) => (item ? -1 : index)).filter((index) => index >= 0);
  if (missing.length) {
    const fallbackPairs = missing
      .map((index) => {
        const to = legs[index];
        const from = index === 0 ? origin : legs[index - 1];
        return to && from ? { from, to } : null;
      })
      .filter(Boolean) as NeshanPair[];
    if (fallbackPairs.length) {
      const fallback = await osrmPairDistances(fallbackPairs);
      fallback.forEach((item, position) => {
        const target = missing[position];
        if (!item || target === undefined) return;
        measured[target] = { distanceKm: item.distanceKm, durationMinutes: item.durationMinutes ?? 0 };
        engines[target] = "OpenStreetMap";
      });
    }
  }

  const enginesUsed = Array.from(new Set(engines.filter(Boolean)));
  const engine = enginesUsed.length === 1 ? enginesUsed[0] : enginesUsed.length ? enginesUsed.join(" + ") : "اندازه‌گیری نشد";
  const unmeasured = measured.filter((item) => !item).length;

  return NextResponse.json({
    success: true,
    engine,
    unmeasured,
    legs: measured.map((item, index) => (item ? { ...item, engine: engines[index] } : null)),
    note:
      unmeasured > 0
        ? `${unmeasured} مسیر اندازه‌گیری نشد؛ برای همان مسیرها دکمهٔ «مسیریابی با نشان» مسیر واقعی را باز می‌کند.`
        : neshanAvailable()
          ? "همهٔ مسیرها با نشان (با ترافیک) دوباره اندازه‌گیری شد."
          : neshanStatusNote("not_configured"),
  });
}
