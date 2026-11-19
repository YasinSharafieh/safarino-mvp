import { NextRequest, NextResponse } from "next/server";
import { askJson, shortText } from "@/lib/ai-openrouter";
import { AiBudgetError } from "@/lib/ai-budget";
import { getProviderCache, setProviderCache } from "@/lib/provider-cache";
import { mergeVoiceFields, parseVoiceTrip, type VoiceTrip } from "@/lib/voice-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE_SECONDS = 86_400;

/**
 * «با صدات بگو» — the sentence becomes the trip form.
 *
 * The local reader runs first and needs no network: it is instant and free. The
 * model is asked only when the sentence left real gaps (a destination but no
 * budget, say), and whatever it answers still has to pass `mergeVoiceFields`,
 * which throws away any city, budget or vehicle that does not exist.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست باید JSON باشد." }, { status: 400 });
  }

  const transcript = shortText(body.transcript, 400);
  if (transcript.length < 4) {
    return NextResponse.json({ success: false, error: "چیزی شنیده نشد؛ یک بار دیگر بگو." }, { status: 400 });
  }

  const local = parseVoiceTrip(transcript);
  const cacheKey = `safarino:voice:v1:${encodeURIComponent(transcript).slice(0, 300)}`;

  // A sentence that already filled the form needs no model at all.
  if (local.confidence >= 0.8 || !process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      {
        success: true,
        trip: local,
        source: "local",
        note:
          local.confidence >= 0.8
            ? "همه‌چیز از خودِ جملهٔ تو خوانده شد."
            : "بخشی از جمله خوانده شد؛ بقیه را در فرم کامل کن.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const cached = await getProviderCache<{ trip: VoiceTrip }>(cacheKey);
  if (cached?.trip) {
    return NextResponse.json({ success: true, trip: cached.trip, source: "ai", cached: true }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const raw = await askJson({
      // استخراج دقیق فیلدها از جملهٔ مسافر، بدون تخیل — the task names the model chain and the token ceiling.
      task: "parse",
      title: "Safarino Voice",
      maxTokens: 260,
      temperature: 0.1,
      system:
        "تو فقط اطلاعاتی را از جملهٔ فارسی مسافر بیرون می‌کشی که واقعاً در جمله آمده است. چیزی حدس نمی‌زنی و چیزی اضافه نمی‌کنی. فقط JSON معتبر می‌نویسی.",
      prompt: `جملهٔ مسافر:
«${transcript}»

این‌ها را از قبل خوانده‌ایم: ${JSON.stringify({
        origin: local.origin,
        destination: local.destination,
        budgetMillions: local.budgetMillions,
        days: local.days,
        travelers: local.travelers,
        mode: local.mode,
      })}

اگر و فقط اگر در جمله آمده باشد، این JSON را پر کن؛ هر فیلدی که در جمله نیست را null بگذار:
{"origin":null,"destination":null,"budgetMillions":null,"days":null,"travelers":null,"children":null,"mode":null}
قواعد: نام شهر فقط از شهرهای ایران، بودجهٔ کل سفر به میلیون تومان (عدد)، مدت سفر به روز (۱ تا ۳۰)، تعداد مسافر (۱ تا ۹)، mode یکی از plane/train/bus/car.`,
    });

    const merged = mergeVoiceFields(local, raw);
    if (merged.confidence > local.confidence) {
      await setProviderCache(cacheKey, { trip: merged }, CACHE_SECONDS);
      return NextResponse.json(
        { success: true, trip: merged, source: "ai", note: "این جمله خوانده شد؛ بقیه را در فرم کامل کن." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json({ success: true, trip: local, source: "local", note: "بخشی از جمله خوانده شد؛ بقیه را در فرم کامل کن." });
  } catch (error) {
    const note =
      error instanceof AiBudgetError
        ? "سهم هوش مصنوعی امروز تمام شده؛ همان بخشی که شنیدیم در فرم گذاشته شد."
        : "هوش مصنوعی الان پاسخ نداد؛ همان بخشی که شنیدیم در فرم گذاشته شد.";
    return NextResponse.json({ success: true, trip: local, source: "local", note });
  }
}
