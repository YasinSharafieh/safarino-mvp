import { NextResponse } from "next/server";
import { loadHomeDeals } from "@/lib/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/deals — the home page's «پیشنهادهای ویژه».
 * Real rooms, real prices, real booking links; cached for a few hours.
 */
export async function GET() {
  try {
    const result = await loadHomeDeals();
    return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({
      success: true,
      cities: [],
      generatedAt: new Date().toISOString(),
      note: "منابع اقامتگاه الان پاسخ ندادند. یک بار دیگر تلاش کنید یا مستقیم جست‌وجوی اقامتگاه را باز کنید.",
    });
  }
}
