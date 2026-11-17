import { NextRequest, NextResponse } from "next/server";
import { AiBudgetError } from "../../../../lib/ai-budget";
import {
  applyRewrites,
  rewritePrompt,
  drawQuestions,
  type AiQuestion,
} from "../../../../lib/quiz-ai";
import { getProviderCache, setProviderCache } from "../../../../lib/provider-cache";
import { chainFor } from "@/lib/ai-models";
import { askJson } from "@/lib/ai-openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A written set is reused for a while, so the traveller after this one gets the
 * same fresh wording with no wait — and the $10 budget is not spent rewording
 * the same twelve subjects for every visitor.
 */
const SET_TTL_SECONDS = 3 * 60 * 60;

/**
 * How many questions a traveller is asked. Ten is the floor; twelve gives room
 * for the budget, the party, the transport, the climate and the taste to all be
 * asked properly, and the budget is asked again — with a real number — right
 * before the result.
 */
const WANTED = 12;

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

/**
 * «لحن تازه برای سؤال‌های واقعی» — one short call.
 *
 * The model does not invent questions any more: it is handed the twelve real
 * ones and asked to say each differently. That answer is a handful of short
 * sentences, so it arrives in a couple of seconds instead of the twenty-plus a
 * full set with weights took — and the options, the weights and the scoring
 * stay exactly the ones Safarino can stand behind.
 */
async function reword(base: AiQuestion[], origin: string, travellers: number, timeoutMs: number): Promise<AiQuestion[]> {
  const parsed = await askJson({
    task: "quiz",
    title: "Safarino Quiz",
    maxTokens: 900,
    timeoutMs,
    system:
      "تو یک مشاور سفر ایرانی هستی که سؤال‌های سلیقه را با لحنی گرم، کوتاه و محاوره‌ای بازنویسی می‌کند. فقط JSON معتبر به فارسی می‌نویسی و هیچ سؤال، گزینه یا شهر تازه‌ای نمی‌سازی.",
    prompt: rewritePrompt({
      questions: base.map((question) => ({ key: question.key, prompt: question.prompt, aside: question.aside })),
      origin,
      travellers,
    }),
  });
  return applyRewrites(base, parsed);
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
  const bank = topUp([], WANTED, seen);
  if (!apiKey) {
    return NextResponse.json({ success: true, questions: bank, source: "local", note: "بدون سرویس هوش مصنوعی، سؤال‌ها از بانک داخلی انتخاب شدند." });
  }

  // Keyed by the route a traveller is on, not by their token: everybody flying
  // out of the same city with the same party sees the same freshly worded set
  // for a few hours, which is what keeps the wait and the budget down.
  const cacheKey = `safarino:quiz-set:v4:${origin.replace(/\s+/g, "-") || "any"}:${travellers}`;
  const cached = await getProviderCache<{ questions: AiQuestion[] }>(cacheKey);
  const cachedQuestions = Array.isArray(cached?.questions) ? cached!.questions : [];
  if (cachedQuestions.length >= WANTED) {
    return NextResponse.json({ success: true, questions: cachedQuestions, source: "ai", cached: true });
  }

  const startedAt = Date.now();
  try {
    const questions = await withDeadline(reword(bank, origin, travellers, DEADLINE_MS - 1_500), DEADLINE_MS);
    const changed = questions.filter((question, index) => question.prompt !== bank[index]?.prompt).length;
    if (!changed) throw new Error("Nothing was reworded");
    await setProviderCache(cacheKey, { questions }, SET_TTL_SECONDS);
    return NextResponse.json({
      success: true,
      questions,
      source: "ai",
      meta: { model: chainFor("quiz").models[0], reworded: changed, generatedAt: new Date().toISOString(), ms: Date.now() - startedAt },
    });
  } catch (caught) {
    if (caught instanceof AiBudgetError) {
      return NextResponse.json({
        success: true,
        questions: bank,
        source: "local",
        note: "سهم هوش مصنوعی این ماه تمام شده؛ سؤال‌ها از بانک داخلی سفرینو انتخاب شدند و همهٔ گزینه‌ها واقعی‌اند.",
      });
    }
    return NextResponse.json({
      success: true,
      questions: bank,
      source: "local",
      note:
        caught instanceof Error && caught.message === "QUIZ_DEADLINE"
          ? "سؤال‌ها دیر آماده می‌شدند؛ برای اینکه معطل نمانی، از بانک سؤال خود سفرینو انتخاب شدند."
          : undefined,
    });
  }
}
