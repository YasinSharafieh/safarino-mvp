import { NextRequest, NextResponse } from "next/server";
import { computePoiDistances, type DistanceTarget } from "../../../../lib/poi-distance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  origin?: { latitude?: unknown; longitude?: unknown };
  targets?: { id?: unknown; latitude?: unknown; longitude?: unknown }[];
  /** Optional Neshan key saved in the traveller's own browser; never logged or stored. */
  neshanApiKey?: unknown;
};

/**
 * Real driving distance / travel time from the chosen accommodation to a list
 * of real places. Neshan first (when NESHAN_API_KEY exists), OpenStreetMap
 * routing second, straight line last — and the engine is always reported.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const originLat = Number(body?.origin?.latitude);
    const originLng = Number(body?.origin?.longitude);
    const rawTargets = Array.isArray(body?.targets) ? body.targets.slice(0, 40) : [];
    const targets: DistanceTarget[] = [];
    rawTargets.forEach((item) => {
      const id = typeof item?.id === "string" ? item.id.slice(0, 120) : "";
      const latitude = Number(item?.latitude);
      const longitude = Number(item?.longitude);
      if (!id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      targets.push({ id, latitude, longitude });
    });

    if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) {
      return NextResponse.json({ success: false, error: "مختصات اقامتگاه انتخاب‌شده برای محاسبهٔ فاصله لازم است." }, { status: 400 });
    }
    if (!targets.length) {
      return NextResponse.json({ success: false, error: "فهرست جاذبه‌ها خالی است." }, { status: 400 });
    }

    const result = await computePoiDistances({ latitude: originLat, longitude: originLng }, targets, {
      neshanKey: typeof body.neshanApiKey === "string" ? body.neshanApiKey : undefined,
    });
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ success: false, error: "محاسبهٔ فاصله انجام نشد." }, { status: 502 });
  }
}
