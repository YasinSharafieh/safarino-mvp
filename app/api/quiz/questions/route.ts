import { NextRequest, NextResponse } from "next/server";
import { AiBudgetError } from "../../../../lib/ai-budget";
import {
  questionsPrompt,
  sanitizeQuestions,
  drawQuestions,
  type AiQuestion,
} from "../../../../lib/quiz-ai";
import { chainFor } from "@/lib/ai-models";
import { askJson } from "@/lib/ai-openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ten four-option questions in Persian are long; a short cap truncates the
// JSON and the whole set is lost, so the answer gets room to finish.
const MAX_OUTPUT_TOKENS = 4800;

/**
 * How many questions a traveller is asked. Ten is the floor; twelve gives room
 * for the budget, the party, the transport, the climate and the taste to all be
 * asked properly, and the budget is asked again — with a real number — right
 * before the result.
 */
const WANTED = 12;

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
function topUp(written: AiQuestion[], wanted: number, seen: string[] = []): AiQuestion[] {
  const out = written.slice(0, wanted);
  const keys = new Set(out.map((question) => question.key));
  const prompts = new Set([...out.map((question) => question.prompt), ...seen]);
  if (out.length >= wanted) return out;
  // Two passes: first only questions the traveller has never seen, then (if the
  // pool is smaller than ten) the rest, so the count is always ten.
  for (const avoidSeen of [true, false]) {
    for (const candidate of drawQuestions(Math.random, 24)) {
      if (out.length >= wanted) break;
      if (keys.has(candidate.key)) continue;
      if (prompts.has(candidate.prompt)) continue;
      if (avoidSeen && seen.includes(candidate.prompt)) continue;
      out.push(candidate);
      keys.add(candidate.key);
      prompts.add(candidate.prompt);
    }
  }
  return out;
}

async function askModel(prompt: string, seen: string[] = []) {
  // «ساختن سؤال» — creativity matters more than price here, but the cheapest
  // good model still wins; the local bank stays as the floor.
  const parsed = (await askJson({
    task: "quiz",
    title: "Safarino Quiz",
    maxTokens: MAX_OUTPUT_TOKENS,
    system:
      "تو یک مشاور سفر ایرانی هستی که سلیقهٔ مسافر را با سؤال‌های کوتاه و طبیعی می‌شناسد. فقط JSON معتبر به فارسی تولید می‌کنی و هیچ شهر یا جاذبه‌ای از خودت نمی‌سازی.",
    prompt,
  })) as Record<string, unknown>;
  const written = sanitizeQuestions(parsed?.questions ?? parsed, WANTED);
  if (!written.length) throw new Error("No usable question in the answer");
  // A model may write eight good questions and two broken ones. The good ones
  // are kept and the local bank tops the set up to ten — the traveller always
  // gets ten questions, and none of them is repeated.
  return { questions: topUp(written, WANTED, seen), written: written.length };
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
    questions: topUp([], WANTED, seen),
    source: "local",
  });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: true, ...fallback(), note: "بدون سرویس هوش مصنوعی، سؤال‌ها از بانک داخلی انتخاب شدند." });
  }

  const prompt = questionsPrompt({ origin, travellers, version: token, avoidPrompts: seen });
  const chain = chainFor("quiz");

  for (const model of chain.models) {
    try {
      const result = await askModel(prompt, seen);
      return NextResponse.json({
        success: true,
        questions: result.questions,
        source: "ai",
        meta: {
          model,
          writtenByModel: result.written,
          generatedAt: new Date().toISOString(),
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
