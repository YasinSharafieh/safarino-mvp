import { NextRequest, NextResponse } from "next/server";
import { readTicketImage } from "@/lib/ai-vision";
import { AiBudgetError } from "@/lib/ai-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

/** Big enough for a phone screenshot, small enough not to waste paid tokens. */
const MAX_DATA_URL = 3_500_000;

/**
 * «عکس بلیت را بخوان» — the vision half of the companion.
 *
 * The model reads only what is visible; every field it returns is checked here
 * again (real city, real calendar date, plausible amount) so a misread can
 * never become a trip fact.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست باید JSON باشد." }, { status: 400 });
  }

  const dataUrl = typeof body.image === "string" ? body.image : "";
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(dataUrl)) {
    return NextResponse.json({ success: false, error: "تصویر باید PNG یا JPG یا WebP باشد." }, { status: 400 });
  }
  if (dataUrl.length > MAX_DATA_URL) {
    return NextResponse.json({ success: false, error: "تصویر بزرگ است؛ یک عکس سبک‌تر یا اسکرین‌شات بفرست." }, { status: 413 });
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ success: false, error: "خواندن تصویر نیاز به کلید هوش مصنوعی دارد." }, { status: 503 });
  }

  try {
    const result = await readTicketImage({ dataUrl });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof AiBudgetError
            ? "سهم هوش مصنوعی امروز تمام شده؛ فردا دوباره امتحان کن."
            : "این تصویر خوانده نشد. یک عکس واضح‌تر از بلیت بفرست.",
      },
      { status: 502 },
    );
  }
}
