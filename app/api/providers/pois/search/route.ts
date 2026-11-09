import { NextRequest, NextResponse } from "next/server";
import { searchCityPois } from "../../../../../lib/poi-search";

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
    const result = await searchCityPois(city, limit);
    return NextResponse.json({ success: true, ...result });
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
