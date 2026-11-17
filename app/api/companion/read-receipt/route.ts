import { NextRequest, NextResponse } from "next/server";
import { readReceiptImage } from "@/lib/ai-vision";
import { AiBudgetError } from "@/lib/ai-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

const MAX_DATA_URL = 3_500_000;

/**
 * «رسید را بخوان» — for the traveller standing at a till.
 *
 * The amount, the place and the kind of spending are read from the photo and
 * checked again here; the traveller then confirms before it enters their book.
 * Nothing is uploaded beyond this one call, and nothing is stored on our side.
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
    return NextResponse.json({ success: false, error: "تصویر بزرگ است؛ یک عکس سبک‌تر بفرست." }, { status: 413 });
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ success: false, error: "خواندن رسید نیاز به کلید هوش مصنوعی دارد." }, { status: 503 });
  }

  try {
    const result = await readReceiptImage({ dataUrl });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof AiBudgetError
            ? "سهم هوش مصنوعی امروز تمام شده؛ مبلغ را دستی وارد کن."
            : "این رسید خوانده نشد؛ یک عکس واضح‌تر بفرست یا مبلغ را دستی بنویس.",
      },
      { status: 502 },
    );
  }
}
