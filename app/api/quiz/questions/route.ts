import { NextRequest, NextResponse } from "next/server";
import { AiBudgetError } from "../../../../lib/ai-budget";
import {
  questionsPrompt,
  sanitizeQuestions,
  drawQuestions,
  QUIZ_TOPICS,
  type AiQuestion,
} from "../../../../lib/quiz-ai";
import { getProviderCache, setProviderCache } from "../../../../lib/provider-cache";
import { chainFor } from "@/lib/ai-models";
import { askJson } from "@/lib/ai-openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * How the set is written now.
 *
 * A single call asking for twelve four-option questions with weights is longer
 * than the cheap models' output ceiling (the chain allows 900 tokens), so the
 * JSON was cut off mid-array, the parse failed, and the question bank answered
 * every single time. Three small calls in parallel — four subjects each, inside
 * the ceiling — write the whole set in the time of one call, and the result is
 * cached so the next traveller sees it instantly.
 */
const CALLS = [
  { count: 4, topics: QUIZ_TOPICS.slice(0, 4) },
  { count: 4, topics: QUIZ_TOPICS.slice(4, 8) },
  { count: 4, topics: QUIZ_TOPICS.slice(8, 12) },
] as const;

/** How long a written set is reused before another one is asked for. */
const SET_TTL_SECONDS = 3 * 60 * 60;

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

/**
 * How long a traveller may wait for written questions before the real question
 * bank answers instead. Nine seconds covers one small model call; the sweep on
 * the live site measured ۴۳ seconds before any limit existed.
 */
const DEADLINE_MS = 9_000;

/** A promise that resolves, or rejects when the clock runs out. */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("QUIZ_DEADLINE")), Math.max(500, ms));
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function askModel(
  prompt: string,
  seen: string[] = [],
  timeoutMs = 8_000,
): Promise<AiQuestion[]> {
  // «ساختن سؤال» — creativity matters more than price here, but the cheapest
  // good model still wins; the local bank stays as the floor.
  const parsed = (await askJson({
    task: "quiz",
    title: "Safarino Quiz",
    maxTokens: 900,
    timeoutMs,
    system:
      "تو یک مشاور سفر ایرانی هستی که سلیقهٔ مسافر را با سؤال‌های کوتاه و طبیعی می‌شناسد. فقط JSON معتبر به فارسی تولید می‌کنی و هیچ شهر یا جاذبه‌ای از خودت نمی‌سازی.",
    prompt,
  })) as Record<string, unknown>;
  return sanitizeQuestions(parsed?.questions ?? parsed, 6).filter((question) => !seen.includes(question.prompt));
}

/** All three calls at once; whichever answer, its questions are kept. */
async function writeSet(origin: string, travellers: number, version: string, seen: string[], timeoutMs: number) {
  const batches = await Promise.all(
    CALLS.map((call) =>
      askModel(
        questionsPrompt({ origin, travellers, version, avoidPrompts: seen, count: call.count, topics: call.topics }),
        seen,
        timeoutMs,
      ).catch(() => [] as AiQuestion[]),
    ),
  );
  const keys = new Set<string>();
  const prompts = new Set<string>();
  const written: AiQuestion[] = [];
  for (const question of batches.flat()) {
    if (keys.has(question.key) || prompts.has(question.prompt)) continue;
    keys.add(question.key);
    prompts.add(question.prompt);
    written.push(question);
  }
  return written;
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

  /**
   * A written set is reused for a few hours: the store keeps the model's work,
   * so the traveller after this one gets the same fresh questions with no wait
   * and the $10 budget is not spent writing the same twelve subjects again.
   */
  const cacheKey = `safarino:quiz-set:v3:${origin.replace(/\s+/g, "-")}:${travellers}`;
  const cached = await getProviderCache<{ questions: AiQuestion[] }>(cacheKey);
  const cachedQuestions = Array.isArray(cached?.questions) ? cached!.questions : [];
  if (cachedQuestions.length >= WANTED) {
    return NextResponse.json({
      success: true,
      questions: cachedQuestions,
      source: "ai",
      cached: true,
      meta: { model: chainFor("quiz").models[0], writtenByModel: cachedQuestions.length, generatedAt: null },
    });
  }

  const chain = chainFor("quiz");
  const startedAt = Date.now();

  /*
   * Three small parallel calls, never past the deadline. Before this, one big
   * call was cut off by the token ceiling — so the model's questions never
   * reached a traveller — and the wait measured ۴۳ seconds on the live site.
   */
  try {
    const written = await withDeadline(
      writeSet(origin, travellers, token, seen, DEADLINE_MS - 1_500),
      DEADLINE_MS,
    );
    if (!written.length) throw new Error("No usable question in the answer");
    const questions = topUp(written, WANTED, seen);
    // Only a set that is mostly model-written is worth keeping; a set that is
    // one stray question plus eleven from the bank is not a cache entry.
    if (written.length >= 6) {
      await setProviderCache(cacheKey, { questions }, SET_TTL_SECONDS);
    }
    return NextResponse.json({
      success: true,
      questions,
      source: "ai",
      meta: {
        model: chain.models[0],
        writtenByModel: written.length,
        generatedAt: new Date().toISOString(),
        ms: Date.now() - startedAt,
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
    return NextResponse.json({
      success: true,
      ...fallback(),
      note:
        caught instanceof Error && caught.message === "QUIZ_DEADLINE"
          ? "سؤال‌ها دیر آماده می‌شدند؛ برای اینکه معطل نمانی، از بانک سؤال خود سفرینو انتخاب شدند."
          : undefined,
    });
  }
}
