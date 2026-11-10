import { NextRequest, NextResponse } from "next/server";
import { neshanDistanceMatrix, neshanStatusNote, resolveNeshanKey } from "../../../../lib/neshan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Two real points in Tehran; only used to prove that a Neshan key answers. */
const ORIGIN = { latitude: 35.7005, longitude: 51.4015 };
const DESTINATION = { latitude: 35.6892, longitude: 51.389 };

/**
 * Checks a Neshan key without ever echoing it back.
 * Used by the "connect Neshan" card so the traveller knows their key works
 * before trusting the distances.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { neshanApiKey?: unknown };
    const key = resolveNeshanKey(body?.neshanApiKey);
    if (!key) {
      return NextResponse.json({
        success: true,
        connected: false,
        status: "not_configured",
        message: "کلید نشان ثبت نشده است؛ فاصله‌ها با OpenStreetMap محاسبه می‌شوند.",
      });
    }

    const result = await neshanDistanceMatrix(ORIGIN, [DESTINATION], { key });
    if (result.status === "ok" && result.items[0]) {
      return NextResponse.json({
        success: true,
        connected: true,
        status: "ok",
        sample: result.items[0],
        message: "کلید نشان درست است؛ فاصله و زمان رانندگی از نشان خوانده می‌شود.",
      });
    }
    const status = result.status === "ok" ? "failed" : result.status;
    return NextResponse.json({
      success: true,
      connected: false,
      status,
      message: neshanStatusNote(status),
    });
  } catch {
    return NextResponse.json({ success: false, error: "بررسی کلید نشان انجام نشد." }, { status: 502 });
  }
}
