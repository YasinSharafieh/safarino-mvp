import { NextRequest, NextResponse } from "next/server";
import { askJson, shortText } from "@/lib/ai-openrouter";
import { AiBudgetError } from "@/lib/ai-budget";
import { getProviderCache, setProviderCache } from "@/lib/provider-cache";
import { localArchetypeNote, readArchetype, type ArchetypeInput } from "@/lib/archetype";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE_SECONDS = 86_400;
const BANNED = /(تومان|ریال|دلار)\s*\d|ساعت کاری|بسته است|باز است از/;

/**
 * «تیپ سفرت» — the label is computed from the trip's own numbers; the model only
 * writes the two sentences that explain it in a friendlier voice.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست باید JSON باشد." }, { status: 400 });
  }

  const moods = Array.isArray(body.moods) ? body.moods.filter((mood): mood is string => typeof mood === "string").slice(0, 3) : [];
  const input: ArchetypeInput = {
    moods,
    budgetMillions: Math.max(0, Math.min(500, Number(body.budgetMillions) || 0)),
    people: Math.max(1, Math.min(30, Number(body.people) || 1)),
    days: Math.max(1, Math.min(30, Number(body.days) || 1)),
    children: Math.max(0, Math.min(8, Number(body.children) || 0)),
    mode: shortText(body.mode, 10),
  };

  const archetype = readArchetype(input);
  const fallback = localArchetypeNote(archetype, input);
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ success: true, archetype, note: fallback, source: "local" });
  }

  const cacheKey = `safarino:archetype:v1:${encodeURIComponent(
    JSON.stringify({ id: archetype.id, b: input.budgetMillions, p: input.people, d: input.days, c: input.children, m: input.mode || "" }),
  ).slice(0, 300)}`;
  const cached = await getProviderCache<{ note: string }>(cacheKey);
  if (cached?.note) return NextResponse.json({ success: true, archetype, note: cached.note, source: "ai", cached: true });

  try {
    const raw = await askJson({
      title: "Safarino Archetype",
      maxTokens: 260,
      temperature: 0.7,
      system:
        "تو یک راهنمای سفر ایرانی هستی که کوتاه، دقیق و صمیمی حرف می‌زند. فقط از اطلاعاتی که به تو داده شده استفاده می‌کنی و هیچ عدد، قیمت یا مکانی از خودت نمی‌سازی. فقط JSON معتبر می‌نویسی.",
      prompt: `تیپ سفر این مسافر (خودمان حساب کرده‌ایم): «${archetype.name}» — ${archetype.tagline}
دلیل‌های واقعی: ${archetype.why.join(" | ")}
بودجه: ${input.budgetMillions} میلیون تومان | ${input.people} نفر | ${input.days} روز | کودکان: ${input.children} | وسیله: ${input.mode || "انتخاب نشده"}

در دو جملهٔ فارسی (حداکثر ۵۰ کلمه، بدون ایموجی) برای خودِ مسافر توضیح بده چرا این تیپ به او می‌خورد و یک قدم عملی برای همین سفر پیشنهاد بده. قیمت و ساعت کاری ننویس.
فرمت: {"note":"..."}`,
    });
    const note = shortText((raw as Record<string, unknown>)?.note, 400);
    if (!note || note.length < 20 || BANNED.test(note)) {
      return NextResponse.json({ success: true, archetype, note: fallback, source: "local" });
    }
    await setProviderCache(cacheKey, { note }, CACHE_SECONDS);
    return NextResponse.json({ success: true, archetype, note, source: "ai" });
  } catch (error) {
    return NextResponse.json({
      success: true,
      archetype,
      note: fallback,
      source: "local",
      reason: error instanceof AiBudgetError ? "budget" : "error",
    });
  }
}
