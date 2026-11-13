import { NextResponse } from "next/server";
import { addReview, listReviews } from "@/lib/reviews";
import { assertProviderRateLimit } from "@/lib/provider-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everyone sees only reviews real visitors submitted. */
export async function GET() {
  const summary = await listReviews();
  return NextResponse.json({ success: true, ...summary }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "درخواست معتبر نبود." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "درخواست معتبر نبود." }, { status: 400 });
  }

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    await assertProviderRateLimit(ip, "reviews");
  } catch {
    return NextResponse.json({ success: false, error: "تعداد ارسال‌ها زیاد بود؛ یک دقیقهٔ دیگر دوباره تلاش کنید." }, { status: 429 });
  }

  const result = await addReview(body as Record<string, unknown>);
  if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 });

  return NextResponse.json({ success: true, review: result.review, total: result.total });
}
