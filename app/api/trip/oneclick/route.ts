import { NextRequest, NextResponse } from "next/server";
import { askJson, shortText } from "@/lib/ai-openrouter";
import { AiBudgetError } from "@/lib/ai-budget";
import { acceptProposal, candidateCities, destinationPrompt, localProposal, parseTripSentence } from "@/lib/one-click";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * «سفر با یک جمله» — the endpoint behind the one-click box.
 *
 * The sentence is parsed locally first, so the traveller gets an answer even
 * with no credit and no network on the model side. The model is only asked for
 * the one thing arithmetic cannot do: choose a destination from the real list of
 * Iranian cities, and say why in one sentence. Its answer is rejected unless the
 * city exists in that list.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست باید JSON باشد." }, { status: 400 });
  }

  const sentence = shortText(body.sentence, 240);
  if (sentence.length < 4) {
    return NextResponse.json({ success: false, error: "یک جملهٔ کوتاه بنویس؛ مثلاً «۵ روز با بچه، ۴۰ میلیون، از تهران»." }, { status: 400 });
  }

  const parsed = parseTripSentence(sentence);
  const fallbackOrigin = shortText(body.origin, 30);
  const local = localProposal(parsed, fallbackOrigin);

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ success: true, parsed, plan: local, note: "بدون هوش مصنوعی هم جمله‌ات خوانده شد." });
  }

  try {
    const raw = await askJson({
      task: "suggest",
      title: "Safarino One-Click Trip",
      system:
        "تو چینندهٔ سفر سفرینو هستی. فقط از فهرست شهرهایی که به تو داده می‌شود انتخاب می‌کنی و هیچ شهر، قیمت یا تاریخ تازه‌ای نمی‌سازی. جملهٔ دلیلت کوتاه، فارسی و دربارهٔ همین مسافر است. فقط JSON معتبر می‌نویسی.",
      prompt: destinationPrompt(parsed, candidateCities(parsed.moods)),
      maxTokens: 220,
      temperature: 0.4,
    });
    const plan = acceptProposal(raw, parsed, local);
    return NextResponse.json({ success: true, parsed, plan });
  } catch (error) {
    return NextResponse.json({
      success: true,
      parsed,
      plan: local,
      note:
        error instanceof AiBudgetError
          ? "سهم هوش مصنوعی امروز تمام شده؛ پیشنهاد از سلیقهٔ خودت و شهرهای واقعی ساخته شد."
          : "هوش مصنوعی الان جواب نداد؛ پیشنهاد از سلیقهٔ خودت و شهرهای واقعی ساخته شد.",
    });
  }
}
