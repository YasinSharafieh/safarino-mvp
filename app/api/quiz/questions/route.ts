import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "../../../../lib/site";
import {
  AiBudgetError,
  reserveAiBudget,
  settleAiBudget,
  usageCostMicros,
} from "../../../../lib/ai-budget";
import {
  questionsPrompt,
  sanitizeQuestions,
  drawQuestions,
  type AiQuestion,
} from "../../../../lib/quiz-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "mistralai/ministral-8b-2512";
const MAX_OUTPUT_TOKENS = 1800;

/** How many questions a traveller is asked; ten is the floor the user set. */
const WANTED = 10;

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

/** Fills a short model-written set from the local bank, never repeating one. */
function topUp(written: AiQuestion[], wanted: number): AiQuestion[] {
  const out = written.slice(0, wanted);
  const keys = new Set(out.map((question) => question.key));
  const prompts = new Set(out.map((question) => question.prompt));
  if (out.length >= wanted) return out;
  for (const candidate of drawQuestions(Math.random, 20)) {
    if (out.length >= wanted) break;
    if (keys.has(candidate.key) || prompts.has(candidate.prompt)) continue;
    out.push(candidate);
    keys.add(candidate.key);
    prompts.add(candidate.prompt);
  }
  return out;
}

async function askModel(model: string, prompt: string, apiKey: string) {
  const reservation = await reserveAiBudget(model, prompt, MAX_OUTPUT_TOKENS);
  let actualMicros = 0;
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": siteUrl(),
        "X-Title": "Safarino Quiz",
      },
      body: JSON.stringify({
        model,
        temperature: 0.85,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
        usage: { include: true },
        messages: [
          {
            role: "system",
            content:
              "تو یک مشاور سفر ایرانی هستی که سلیقهٔ مسافر را با سؤال‌های کوتاه و طبیعی می‌شناسد. فقط JSON معتبر به فارسی تولید می‌کنی و هیچ شهر یا جاذبه‌ای از خودت نمی‌سازی.",
          },
          { role: "user", content: prompt },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(35_000),
    });
    if (!response.ok) throw new Error(`OpenRouter ${model} returned ${response.status}`);
    const payload = await response.json();
    actualMicros = usageCostMicros(model, payload?.usage);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("OpenRouter returned an empty response");
    const parsed = extractJson(content) as Record<string, unknown>;
    const written = sanitizeQuestions(parsed?.questions ?? parsed, WANTED);
    if (!written.length) throw new Error("No usable question in the answer");
    // A model may write eight good questions and two broken ones. The good ones
    // are kept and the local bank tops the set up to ten — the traveller always
    // gets ten questions, and none of them is repeated.
    const questions = topUp(written, WANTED);
    return { questions, model, costMicros: actualMicros, written: written.length };
  } finally {
    await settleAiBudget(reservation, actualMicros);
  }
}

/**
 * Ten fresh questions for the «where should I go?» door.
 *
 * Every attempt is a new set: the client sends the prompts it has already seen,
 * and the local pool is shuffled as the fallback — so the traveller never
 * answers the same questionnaire twice, with or without the model available.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const origin = typeof body.origin === "string" ? body.origin.slice(0, 60) : "";
  const travellers = Math.min(9, Math.max(1, Math.round(Number(body.travellers) || 1)));
  const seen = Array.isArray(body.seen) ? body.seen.filter((item): item is string => typeof item === "string").slice(0, 40) : [];
  const token = typeof body.token === "string" ? body.token.slice(0, 40) : String(Date.now());

  const fallback = (): { questions: AiQuestion[]; source: "local" } => ({
    questions: drawQuestions(Math.random, WANTED),
    source: "local",
  });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: true, ...fallback(), note: "بدون سرویس هوش مصنوعی، سؤال‌ها از بانک داخلی انتخاب شدند." });
  }

  const prompt = questionsPrompt({ origin, travellers, version: token, avoidPrompts: seen });
  const models = Array.from(new Set([PRIMARY_MODEL, FALLBACK_MODEL]));

  for (const model of models) {
    try {
      const result = await askModel(model, prompt, apiKey);
      return NextResponse.json({
        success: true,
        questions: result.questions,
        source: "ai",
        meta: {
          model,
          writtenByModel: result.written,
          generatedAt: new Date().toISOString(),
          costUsd: result.costMicros / 1_000_000,
        },
      });
    } catch (caught) {
      if (caught instanceof AiBudgetError) {
        // The $10 must last: stop asking the model, use the real question bank.
        return NextResponse.json({
          success: true,
          ...fallback(),
          note: "سهم هوش مصنوعی این ماه تمام شده؛ سؤال‌ها از بانک داخلی سفرینو انتخاب شدند و همهٔ گزینه‌ها واقعی‌اند.",
        });
      }
      // Otherwise try the fallback model, then the local bank.
    }
  }

  return NextResponse.json({ success: true, ...fallback() });
}
