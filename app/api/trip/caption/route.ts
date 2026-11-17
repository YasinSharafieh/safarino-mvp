import { NextResponse } from "next/server";
import { captionSanitizerInput, writeCaption } from "@/lib/story-caption-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «یک نسخهٔ گرم‌تر از کپشن» — one cheap writing call, always answerable.
 *
 * The body is sanitised first (numbers, names and lengths are all bounded), then
 * the model writes two or three lines. Whatever comes back passes `verifyAnswer`
 * against the trip's own numbers; a sentence with a number the trip does not have
 * is thrown away and the local caption is returned with `source: "local"`.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "درخواست معتبر نبود." }, { status: 400 });
  }

  const input = captionSanitizerInput((body as Record<string, unknown>)?.input ?? body);
  if (!input) {
    return NextResponse.json({ success: false, error: "داده‌های سفر برای نوشتن کپشن کافی نبود." }, { status: 400 });
  }

  const result = await writeCaption(input);
  return NextResponse.json({
    success: true,
    caption: result.caption,
    source: result.source,
    note:
      result.source === "ai"
        ? "این متن با مدل نوشته و با عددهای خود برنامه بازبینی شد."
        : "متن از داده‌های خود برنامه ساخته شد؛ هیچ چیز اضافه‌ای در آن نیست.",
  });
}
