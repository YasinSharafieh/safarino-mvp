import { NextRequest, NextResponse } from "next/server";
import { tripWeather, suggestDayOrder, type DayToMatch } from "../../../../lib/weather";
import { cityCoordinate, searchCityPois } from "../../../../lib/poi-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weather for the days of the trip, plus an honest suggestion for which day
 * should fall on which date. No key, no tracking: Open-Meteo only.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست معتبر نیست." }, { status: 400 });
  }

  const city = typeof body.city === "string" ? body.city.trim().slice(0, 80) : "";
  const days = Math.min(14, Math.max(1, Number(body.days) || 3));
  const startDate = typeof body.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate) ? body.startDate : null;

  let latitude = Number(body.latitude);
  let longitude = Number(body.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
    const center = city ? cityCoordinate(city) : null;
    if (center) {
      latitude = center.latitude;
      longitude = center.longitude;
    }
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
    return NextResponse.json(
      { success: false, error: "برای نمایش آب‌وهوا، مقصد باید در فهرست شهرها باشد یا اقامتگاه مختصات داشته باشد." },
      { status: 200 },
    );
  }

  const weather = await tripWeather({ latitude, longitude, startDate, days });

  // Optional: the categories of each plan day, to suggest the best order.
  let suggestion: { order: number[]; reason: string; changed: boolean } | null = null;
  const planDays = Array.isArray(body.planDays) ? (body.planDays as { dayNumber?: unknown; categories?: unknown }[]) : [];
  if (planDays.length === weather.days.length && planDays.length > 0) {
    const parsed: DayToMatch[] = planDays.map((day, index) => ({
      dayNumber: Number.isFinite(Number(day.dayNumber)) ? Number(day.dayNumber) : index + 1,
      categories: Array.isArray(day.categories) ? day.categories.filter((item): item is string => typeof item === "string") : [],
    }));
    suggestion = suggestDayOrder(parsed, weather.days);
  } else if (city && planDays.length === 0 && weather.days.length && Number(body.withPlanHint) === 1) {
    // The caller did not send a plan; a light hint is still useful.
    const pois = await searchCityPois(city, 12);
    const outdoor = pois.pois.filter((poi) => /پارک|بوستان|باغ|پل|میدان|بازار/.test(poi.category)).length;
    suggestion = {
      order: weather.days.map((_, index) => index + 1),
      reason: outdoor
        ? `${outdoor} جاذبهٔ فضای باز در این مقصد هست؛ روزهای صاف‌تر را برای آن‌ها نگه دارید.`
        : "جاذبه‌های این مقصد بیشتر سرپوشیده‌اند؛ باران مانع برنامه نیست.",
      changed: false,
    };
  }

  return NextResponse.json({
    success: weather.days.length > 0,
    city,
    mode: weather.mode,
    startDate: weather.startDate,
    days: weather.days,
    suggestion,
    note: weather.note,
    sources: weather.sources,
    error: weather.days.length ? undefined : weather.note,
  });
}
