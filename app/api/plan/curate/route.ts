import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "@/lib/site";
import { AiBudgetError, reserveAiBudget, settleAiBudget, usageCostMicros } from "@/lib/ai-budget";
import { getProviderCache, setProviderCache } from "@/lib/provider-cache";
import {
  curatePrompt,
  localCuration,
  sanitizeCuration,
  type Curation,
  type CurateInput,
} from "@/lib/plan-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "mistralai/ministral-8b-2512";
const MAX_OUTPUT_TOKENS = 900;
const CACHE_SECONDS = 43_200;

function text(value: unknown, max = 120): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseInput(raw: unknown): CurateInput | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const destination = text(body.destination, 60);
  const days = Math.min(10, Math.max(1, Math.round(Number(body.days) || 1)));
  const places = Array.isArray(body.places) ? body.places : [];
  const clean = places
    .slice(0, 40)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const id = text(row.id, 120);
      const name = text(row.name, 90);
      if (!id || !name) return null;
      const km = Number(row.km);
      const minutes = Number(row.minutes);
      return {
        id,
        name,
        category: text(row.category, 60) || "جاذبه",
        km: Number.isFinite(km) ? km : null,
        minutes: Number.isFinite(minutes) ? minutes : null,
      };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  if (!destination || clean.length < 2) return null;
  const tasteRaw = (body.taste ?? {}) as Record<string, unknown>;
  return {
    destination,
    days,
    places: clean,
    taste: {
      moods: Array.isArray(tasteRaw.moods) ? tasteRaw.moods.filter((item): item is string => typeof item === "string").slice(0, 4) : [],
      words: text(tasteRaw.words, 200),
    },
    mustIncludeAll: body.mustIncludeAll === true,
  };
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

async function askModel(prompt: string, apiKey: string): Promise<{ raw: unknown; costMicros: number }> {
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
          "X-Title": "Safarino AI Curator",
        },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          max_tokens: MAX_OUTPUT_TOKENS,
          response_format: { type: "json_object" },
          usage: { include: true },
          messages: [
            {
              role: "system",
              content:
                "تو برنامه‌ریز سفر ایرانی هستی. فقط از جاذبه‌هایی که به تو داده شده استفاده می‌کنی، هیچ مکانی نمی‌سازی و هیچ قیمت یا ساعت کاری‌ای جعل نمی‌کنی. فقط JSON معتبر می‌نویسی.",
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
      return { raw: extractJson(content), costMicros: actual };
    } catch (error) {
      lastError = error;
    } finally {
      await settleAiBudget(reservation, actual);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI curation failed");
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
    return NextResponse.json({ success: false, error: "فهرست جاذبه‌ها یا مقصد کافی نیست." }, { status: 400 });
  }

  const cacheKey = `safarino:plan:curate:v1:${encodeURIComponent(
    JSON.stringify({
      d: input.destination,
      n: input.days,
      all: Boolean(input.mustIncludeAll),
      t: input.taste?.moods || [],
      p: input.places.map((place) => place.id).sort(),
    }),
  ).slice(0, 400)}`;
  const cached = await getProviderCache<Curation>(cacheKey);
  if (cached && cached.source === "ai") {
    return NextResponse.json({ success: true, ...cached, cached: true }, { headers: { "Cache-Control": "no-store" } });
  }

  const fallback: Curation = localCuration(input);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: true, ...fallback, note: "کلید هوش مصنوعی تنظیم نشده؛ چیدمان محلی انجام شد." });
  }

  try {
    const { raw } = await askModel(curatePrompt(input), apiKey);
    const curation = sanitizeCuration(raw, input);
    if (curation.source === "ai") await setProviderCache(cacheKey, curation, CACHE_SECONDS);
    return NextResponse.json({ success: true, ...curation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const note =
      error instanceof AiBudgetError
        ? "سهم هوش مصنوعی امروز تمام شده؛ چیدمان محلی (نزدیک‌ترین جاذبه‌ها) انجام شد."
        : "هوش مصنوعی الان پاسخ نداد؛ چیدمان محلی انجام شد.";
    return NextResponse.json({ success: true, ...fallback, note });
  }
}
