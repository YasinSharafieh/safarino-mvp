import { NextRequest, NextResponse } from "next/server";
import { AiBudgetError } from "@/lib/ai-budget";
import { getProviderCache, setProviderCache } from "@/lib/provider-cache";
import { guidePrompt, localGuides, sanitizeGuide, type DayGuide, type GuideDayInput, type GuideInput } from "@/lib/plan-ai";
import { askJson } from "@/lib/ai-openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_OUTPUT_TOKENS = 1400;
const CACHE_SECONDS = 43_200;

function text(value: unknown, max = 120): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseInput(raw: unknown): GuideInput | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const destination = text(body.destination, 60);
  const days = Array.isArray(body.days) ? body.days : [];
  const clean: GuideDayInput[] = days
    .slice(0, 10)
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const stops = Array.isArray(row.stops) ? row.stops : [];
      return {
        day: Number(row.day) || index + 1,
        stops: stops
          .slice(0, 8)
          .map((stop) => {
            if (!stop || typeof stop !== "object") return null;
            const item = stop as Record<string, unknown>;
            const title = text(item.title, 80);
            if (!title) return null;
            return { time: text(item.time, 8), title, kind: text(item.kind, 20) || "sightseeing" };
          })
          .filter((value): value is NonNullable<typeof value> => Boolean(value)),
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  if (!destination || !clean.length) return null;
  return { destination, days: clean, taste: text(body.taste, 120) };
}

function extractJson(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("AI response was not valid JSON");
  }
}

async function askModel(prompt: string): Promise<unknown> {
  // «نوشتن» — the task that likes a model with better Persian prose.
  return askJson({
    task: "write",
    title: "Safarino Day Guide",
    maxTokens: MAX_OUTPUT_TOKENS,
    system:
      "تو راهنمای سفر ایرانی هستی؛ صمیمی، کوتاه و دقیق. فقط دربارهٔ مکان‌های داده‌شده حرف می‌زنی و هیچ قیمت، ساعت کاری یا آدرسی نمی‌سازی. فقط JSON معتبر می‌نویسی.",
    prompt,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست باید JSON باشد." }, { status: 400 });
  }
  const input = parseInput(body);
  if (!input) {
    return NextResponse.json({ success: false, error: "برنامهٔ روزها برای نوشتن راهنما کافی نیست." }, { status: 400 });
  }

  const cacheKey = `safarino:plan:guide:v1:${encodeURIComponent(
    JSON.stringify({
      d: input.destination,
      t: input.taste || "",
      days: input.days.map((day) => day.stops.map((stop) => `${stop.time}|${stop.title}`)),
    }),
  ).slice(0, 400)}`;
  const cached = await getProviderCache<{ guides: DayGuide[]; source: string }>(cacheKey);
  if (cached?.guides?.length && cached.source === "ai") {
    return NextResponse.json({ success: true, ...cached, cached: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const fallback = localGuides(input);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: true, ...fallback, note: "کلید هوش مصنوعی تنظیم نشده؛ راهنمای ساده نوشته شد." });
  }

  try {
    const raw = await askModel(guidePrompt(input));
    const result = sanitizeGuide(raw, input);
    if (result.source === "ai") await setProviderCache(cacheKey, result, CACHE_SECONDS);
    return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const note =
      error instanceof AiBudgetError
        ? "سهم هوش مصنوعی امروز تمام شده؛ راهنمای ساده نوشته شد."
        : "هوش مصنوعی الان پاسخ نداد؛ راهنمای ساده نوشته شد.";
    return NextResponse.json({ success: true, ...fallback, note });
  }
}
