import { NextRequest, NextResponse } from "next/server";
import { neshanDirection, neshanStatusNote, resolveNeshanKey } from "../../../../lib/neshan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function point(value: unknown): { latitude: number; longitude: number } | null {
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
 * The real Neshan route between two points: distance, live-traffic time and
 * turn-by-turn steps. The key never leaves the server.
 */
export async function POST(request: NextRequest) {
  let origin: { latitude: number; longitude: number } | null = null;
  let destination: { latitude: number; longitude: number } | null = null;
  let steps = 10;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    origin = point(body.origin);
    destination = point(body.destination);
    if (typeof body.steps === "number" && Number.isFinite(body.steps)) steps = Math.min(20, Math.max(3, Math.round(body.steps)));
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست معتبر نیست." }, { status: 400 });
  }
  if (!origin || !destination) {
    return NextResponse.json({ success: false, error: "مبدأ یا مقصد معتبر نیست." }, { status: 400 });
  }
  const key = resolveNeshanKey();
  if (!key) {
    return NextResponse.json({ success: false, configured: false, status: "not_configured", error: "سرویس مسیریابی نشان روی سرور تنظیم نشده است." }, { status: 503 });
  }

  const result = await neshanDirection(origin, destination, { key, steps });
  if (result.status !== "ok") {
    return NextResponse.json(
      { success: false, configured: true, status: result.status, error: neshanStatusNote(result.status) },
      { status: 200 },
    );
  }
  return NextResponse.json({
    success: true,
    configured: true,
    status: "ok",
    distanceKm: result.route.distanceKm,
    durationMinutes: result.route.durationMinutes,
    steps: result.route.steps,
    engine: "نشان",
  });
}
