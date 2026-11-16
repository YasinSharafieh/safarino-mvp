import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { AiBudgetError, reserveAiBudget, settleAiBudget, usageCostMicros } from "@/lib/ai-budget";
import { getProviderCache, setProviderCache } from "@/lib/provider-cache";
import { guidePrompt, localGuides, sanitizeGuide, type DayGuide, type GuideDayInput, type GuideInput } from "@/lib/plan-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "mistralai/ministral-8b-2512";
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

async function askModel(prompt: string, apiKey: string): Promise<unknown> {
  let lastError: unknown = null;
  for (const model of [MODEL, FALLBACK_MODEL]) {
    const reservation = await reserveAiBudget(model, prompt, MAX_OUTPUT_TOKENS);
    let actual = 0;
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": siteUrl(),
          "X-Title": "Safarino Day Guide",
        },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          max_tokens: MAX_OUTPUT_TOKENS,
          response_format: { type: "json_object" },
          usage: { include: true },
          messages: [
            {
              role: "system",
              content:
                "تو راهنمای سفر ایرانی هستی؛ صمیمی، کوتاه و دقیق. فقط دربارهٔ مکان‌های داده‌شده حرف می‌زنی و هیچ قیمت، ساعت کاری یا آدرسی نمی‌سازی. فقط JSON معتبر می‌نویسی.",
            },
            { role: "user", content: prompt },
          ],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(40_000),
      });
      if (!response.ok) throw new Error(`OpenRouter ${model} returned ${response.status}`);
      const payload = await response.json();
      actual = usageCostMicros(model, payload?.usage);
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("empty response");
      return extractJson(content);
    } catch (error) {
      lastError = error;
    } finally {
      await settleAiBudget(reservation, actual);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI guide failed");
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
    const raw = await askModel(guidePrompt(input), apiKey);
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
