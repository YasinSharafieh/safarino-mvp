import { NextRequest, NextResponse } from "next/server";
import { searchAlibabaFlights } from "../../../../../lib/alibaba-flights";
import type { FlightSearchInput } from "../../../../../lib/alibaba-flights";
import {
  assertProviderRateLimit,
  getProviderCache,
  setProviderCache,
} from "../../../../../lib/provider-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function integer(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function parseInput(body: unknown): FlightSearchInput | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const origin = String(input.origin || "").trim().toUpperCase();
  const destination = String(input.destination || "").trim().toUpperCase();
  const date = String(input.date || "").trim();
  if (!/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) || origin === destination) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return null;

  const adults = integer(input.adults, 1, 1, 9);
  const children = integer(input.children, 0, 0, 9);
  const infants = integer(input.infants, 0, 0, adults);
  return { origin, destination, date, adults, children, infants };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "PROVIDER_RATE_LIMIT_EXCEEDED") {
    return NextResponse.json(
      { success: false, error: "تعداد جستجوها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید." },
      { status: 429 },
    );
  }
  if (message === "PROVIDER_RATE_LIMIT_UNAVAILABLE") {
    return NextResponse.json(
      { success: false, error: "سرویس جستجو موقتاً در دسترس نیست." },
      { status: 503 },
    );
  }
  if (message === "ALIBABA_HTTP_403") {
    return NextResponse.json(
      { success: false, error: "ارائه‌دهنده در حال حاضر پاسخ به این سرور نمی‌دهد.", provider: "alibaba" },
      { status: 502 },
    );
  }
  return NextResponse.json(
    { success: false, error: "دریافت اطلاعات زنده پرواز انجام نشد؛ دوباره تلاش کنید.", provider: "alibaba" },
    { status: 502 },
  );
}

export async function POST(request: NextRequest) {
  let input: FlightSearchInput | null;
  try {
    input = parseInput(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: "بدنه درخواست معتبر نیست." }, { status: 400 });
  }
  if (!input) {
    return NextResponse.json(
      { success: false, error: "مبدأ، مقصد و تاریخ سفر معتبر نیست." },
      { status: 400 },
    );
  }

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await assertProviderRateLimit(ip, "alibaba-flights");
    const cacheKey = `safarino:alibaba-flights:${JSON.stringify(input)}`;
    const cached = await getProviderCache<Record<string, unknown>>(cacheKey);
    if (cached) return NextResponse.json({ success: true, cached: true, ...cached });

    const result = await searchAlibabaFlights(input);
    await setProviderCache(cacheKey, result, 60);
    return NextResponse.json(
      { success: true, cached: false, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
