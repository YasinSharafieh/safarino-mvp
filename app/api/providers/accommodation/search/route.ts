import { NextRequest, NextResponse } from "next/server";
import type { AccommodationSearchInput } from "../../../../../lib/accommodation-types";
import { searchMultiProviderAccommodation } from "../../../../../lib/accommodation-search";
import { assertProviderRateLimit } from "../../../../../lib/provider-cache";
import { readWithRefresh, snapshotKey, writeSnapshot } from "../../../../../lib/snapshot-store";

/** A saved multi-provider answer is good for 30 minutes and usable for a day. */
const FRESH_SECONDS = 1_800;
const KEEP_SECONDS = 86_400;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function ages(value: unknown, min: number, max: number, limit: number): number[] | null {
  if (!Array.isArray(value) || value.length > limit) return null;
  const parsed = value.map(Number);
  return parsed.every((age) => Number.isInteger(age) && age >= min && age <= max) ? parsed : null;
}

function parse(body: unknown): AccommodationSearchInput | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const kind = value.kind === "hotel" || value.kind === "stay" ? value.kind : null;
  const city = String(value.city || "").trim();
  const checkIn = String(value.checkIn || "");
  const checkOut = String(value.checkOut || "");
  const adults = Number(value.adults);
  const childAges = ages(value.childAges, 2, 11, 8);
  const infantAges = ages(value.infantAges, 0, 1, 8);
  if (!kind || city.length < 2 || city.length > 60 || !validDate(checkIn) || !validDate(checkOut)) return null;
  if (checkIn < new Date().toISOString().slice(0, 10) || checkOut <= checkIn) return null;
  const nights = Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);
  if (nights < 1 || nights > 30 || !Number.isInteger(adults) || adults < 1 || adults > 30) return null;
  if (!childAges || !infantAges || infantAges.length > adults || adults + childAges.length + infantAges.length > 30) return null;
  if (kind === "hotel" && adults > 6) return null;
  return { kind, city, checkIn, checkOut, adults, childAges, infantAges };
}

export async function POST(request: NextRequest) {
  let input: AccommodationSearchInput | null;
  try {
    input = parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: "بدنه درخواست معتبر نیست." }, { status: 400 });
  }
  if (!input) {
    return NextResponse.json({ success: false, error: "مقصد، تاریخ و مسافران را بررسی کنید؛ اقامت بین ۱ تا ۳۰ شب پشتیبانی می‌شود." }, { status: 400 });
  }

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await assertProviderRateLimit(ip, "multi-accommodation");
    const started = Date.now();
    const base = snapshotKey("accommodation", { ...input, kinds: input.kind });
    const { snapshot, source, refreshed } = await readWithRefresh<Record<string, unknown>>(
      base,
      async () => {
        const live = await searchMultiProviderAccommodation(input);
        return live.allProvidersFailed ? null : (live as unknown as Record<string, unknown>);
      },
      { ttlSeconds: FRESH_SECONDS, keepSeconds: KEEP_SECONDS },
    );

    if (snapshot) {
      // A stale copy is answered instantly and refreshed in the background.
      if (source === "stale-cache" && refreshed) void refreshed();
      const saved = snapshot.value as { allProvidersFailed?: boolean };
      return NextResponse.json(
        {
          success: !saved.allProvidersFailed,
          cached: true,
          fromStore: source === "stale-cache" ? "last-saved" : "just-fetched",
          savedAt: snapshot.storedAt,
          ...snapshot.value,
        },
        {
          status: saved.allProvidersFailed ? 502 : 200,
          headers: {
            "Cache-Control": "no-store",
            "X-Safarino-Source": source,
            "X-Safarino-Ms": String(Date.now() - started),
          },
        },
      );
    }

    // Nothing saved yet: crawl the providers now and keep the answer.
    const result = await searchMultiProviderAccommodation(input);
    if (!result.allProvidersFailed) {
      await writeSnapshot(base, result as unknown as Record<string, unknown>, FRESH_SECONDS, KEEP_SECONDS);
    }
    return NextResponse.json(
      { success: !result.allProvidersFailed, cached: false, fromStore: "crawled-now", ...result, ...(result.allProvidersFailed ? { error: "هیچ‌یک از منابع اقامت پاسخ معتبر نداد؛ کمی بعد دوباره تلاش کنید." } : {}) },
      {
        status: result.allProvidersFailed ? 502 : 200,
        headers: { "Cache-Control": "no-store", "X-Safarino-Source": "live", "X-Safarino-Ms": String(Date.now() - started) },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "PROVIDER_RATE_LIMIT_EXCEEDED" ? 429 : message === "PROVIDER_RATE_LIMIT_UNAVAILABLE" ? 503 : 502;
    return NextResponse.json({
      success: false,
      error: status === 429 ? "تعداد جستجوها بیش از حد مجاز است؛ کمی بعد دوباره تلاش کنید." : "جستجوی اقامت انجام نشد؛ دوباره تلاش کنید.",
    }, { status });
  }
}
