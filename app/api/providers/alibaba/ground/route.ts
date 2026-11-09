import { NextRequest, NextResponse } from "next/server";
import { searchAlibabaBuses, searchAlibabaTrains } from "../../../../../lib/alibaba-ground";
import type { FlightSearchInput } from "../../../../../lib/alibaba-flights";
import { assertProviderRateLimit, getProviderCache, setProviderCache } from "../../../../../lib/provider-cache";
import { resolveIranianCity } from "../../../../../lib/iran-cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function count(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function parse(body: unknown): { input: FlightSearchInput; mode: "train" | "bus" } | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const mode = value.mode === "train" || value.mode === "bus" ? value.mode : null;
  const origin = String(value.origin || "").trim().toUpperCase();
  const destination = String(value.destination || "").trim().toUpperCase();
  const date = String(value.date || "").trim();
  if (!mode || !/^[A-Z]{3,12}$/.test(origin) || !/^[A-Z]{3,12}$/.test(destination) || origin === destination) return null;
  if (!resolveIranianCity(origin) || !resolveIranianCity(destination)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < new Date().toISOString().slice(0, 10)) return null;
  const adults = count(value.adults, 1, 1, 9);
  return {
    mode,
    input: {
      origin,
      destination,
      date,
      adults,
      children: count(value.children, 0, 0, 9),
      infants: count(value.infants, 0, 0, adults),
    },
  };
}

export async function POST(request: NextRequest) {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: "بدنه درخواست معتبر نیست." }, { status: 400 });
  }
  if (!parsed) return NextResponse.json({ success: false, error: "اطلاعات جستجو معتبر نیست." }, { status: 400 });

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await assertProviderRateLimit(ip, `alibaba-${parsed.mode}`);
    const cacheKey = `safarino:alibaba-${parsed.mode}:${JSON.stringify(parsed.input)}`;
    const cached = await getProviderCache<Record<string, unknown>>(cacheKey);
    if (cached) return NextResponse.json({ success: true, cached: true, ...cached });
    const result = parsed.mode === "train"
      ? await searchAlibabaTrains(parsed.input)
      : await searchAlibabaBuses(parsed.input);
    await setProviderCache(cacheKey, result, 60);
    return NextResponse.json({ success: true, cached: false, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "PROVIDER_RATE_LIMIT_EXCEEDED"
      ? 429
      : message === "PROVIDER_RATE_LIMIT_UNAVAILABLE"
        ? 503
        : message === "ALIBABA_BUS_CITY_NOT_FOUND"
          ? 404
          : 502;
    const userError = status === 429
      ? "تعداد جستجوها بیش از حد مجاز است."
      : status === 404
        ? "فروش اتوبوس برای یکی از این شهرها پیدا نشد؛ مسیر دیگری را امتحان کنید."
        : "دریافت اطلاعات زنده انجام نشد؛ دوباره تلاش کنید.";
    return NextResponse.json({ success: false, error: userError }, { status });
  }
}
