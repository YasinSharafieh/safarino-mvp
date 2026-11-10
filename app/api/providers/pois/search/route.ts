import { NextRequest, NextResponse } from "next/server";
import { searchCityPois } from "../../../../../lib/poi-search";
import { readWithRefresh, snapshotKey, writeSnapshot } from "../../../../../lib/snapshot-store";

/** Attractions of a city barely change, so a saved copy is good for a day. */
const FRESH_SECONDS = 86_400;
const KEEP_SECONDS = 604_800;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let city = "";
  try {
    const body = (await request.json()) as { city?: unknown; limit?: unknown };
    city = typeof body.city === "string" ? body.city.trim().slice(0, 80) : "";
    const limit = typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.min(40, Math.max(6, Math.round(body.limit))) : 24;
    if (!city) return NextResponse.json({ success: false, error: "نام مقصد را وارد کنید." }, { status: 400 });
    const started = Date.now();
    const base = snapshotKey("pois", { city, limit });
    const saved = await readWithRefresh<Record<string, unknown>>(base, async () => (await searchCityPois(city, limit)) as unknown as Record<string, unknown>, {
      ttlSeconds: FRESH_SECONDS,
      keepSeconds: KEEP_SECONDS,
    });
    if (saved.snapshot) {
      if (saved.source === "stale-cache" && saved.refreshed) void saved.refreshed();
      return NextResponse.json(
        { success: true, cached: true, fromStore: saved.source === "stale-cache" ? "last-saved" : "just-fetched", savedAt: saved.snapshot.storedAt, ...saved.snapshot.value },
        { headers: { "X-Safarino-Source": saved.source, "X-Safarino-Ms": String(Date.now() - started) } },
      );
    }
    const result = await searchCityPois(city, limit);
    await writeSnapshot(base, result as unknown as Record<string, unknown>, FRESH_SECONDS, KEEP_SECONDS);
    return NextResponse.json({ success: true, cached: false, fromStore: "crawled-now", ...result }, {
      headers: { "X-Safarino-Source": "live", "X-Safarino-Ms": String(Date.now() - started) },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: true,
        city,
        latitude: null,
        longitude: null,
        pois: [],
        poisWithArticle: 0,
        sources: { openstreetmap: "failed", wikidata: "failed", wikipedia: "failed" },
        note: error instanceof Error ? `خواندن جاذبه‌های واقعی انجام نشد: ${error.message}` : "خواندن جاذبه‌های واقعی انجام نشد.",
      },
      { status: 200 },
    );
  }
}
