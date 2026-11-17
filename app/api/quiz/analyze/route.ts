import { NextRequest, NextResponse } from "next/server";
import { AiBudgetError } from "../../../../lib/ai-budget";
import {
  analysisPrompt,
  localAnalysis,
  sanitizeAnalysis,
  type AiAnalysis,
} from "../../../../lib/quiz-ai";
import { drawQuestions, type QuizAnswers, type QuizQuestion } from "../../../../lib/start-flow";
import { chainFor } from "@/lib/ai-models";
import { askJson } from "@/lib/ai-openrouter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_OUTPUT_TOKENS = 1200;

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

/** Rebuilds the question list the client answered, from the local bank only. */
function questionsFromClient(raw: unknown): QuizQuestion[] {
  const bank = [...drawQuestions(Math.random, 20), ...drawQuestions(() => 0.5, 20)];
  const byKey = new Map<string, QuizQuestion>();
  for (const question of bank) if (!byKey.has(question.key)) byKey.set(question.key, question);
  const out: QuizQuestion[] = [];
  if (!Array.isArray(raw)) return out;
  for (const entry of raw) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key : "";
    const prompt = typeof row.prompt === "string" ? row.prompt.slice(0, 200) : "";
    const known = byKey.get(key);
    if (known) {
      out.push(known);
      continue;
    }
    // A model-written question: keep the prompt and the option labels only, so
    // the reply can be described back to the traveller.
    const labels = Array.isArray(row.options) ? row.options.filter((item): item is string => typeof item === "string").slice(0, 4) : [];
    if (!key || !prompt || labels.length < 2) continue;
    out.push({
      key,
      prompt,
      aside: "",
      options: labels.map((label, index) => ({ id: `o${index}`, label, weights: {}, hint: "" })),
    });
  }
  return out.slice(0, 20);
}

/**
 * How long the traveller waits for the written analysis.
 *
 * The result screen is already complete without it (the local engine names real
 * cities from the same answers), so this is an enrichment with a hard ceiling —
 * a sweep of the live site measured ۲۷ seconds for one visit before this limit.
 */
const ANALYSIS_DEADLINE_MS = 9_000;

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ANALYSIS_DEADLINE")), Math.max(500, ms));
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

async function askModel(prompt: string, timeoutMs = ANALYSIS_DEADLINE_MS - 1_000) {
  // «پیشنهاد با دلیل» — a small structured answer that must never invent a city.
  const raw = await askJson({
    task: "suggest",
    title: "Safarino Quiz Analysis",
    maxTokens: MAX_OUTPUT_TOKENS,
    timeoutMs,
    system:
      "تو یک مشاور سفر ایرانی هستی. فقط از فهرست شهرهای داده‌شده انتخاب می‌کنی، قیمت و جاذبه از خودت نمی‌سازی، و فقط JSON معتبر می‌دهی.",
    prompt,
  });
  return { raw };
}

/**
 * Reads the answers and names the cities that fit.
 *
 * The model is asked first; whatever it returns is checked against the real city
 * list and the traveller's budget. If the budget is out, the model is skipped
 * entirely and the local engine answers — the traveller never sees an error.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنه درخواست باید JSON معتبر باشد." }, { status: 400 });
  }

  const origin = typeof body.origin === "string" ? body.origin.slice(0, 60) : "";
  const travellers = Math.min(9, Math.max(1, Math.round(Number(body.travellers) || 1)));
  const daysRaw = Number(body.days);
  const days = Number.isFinite(daysRaw) && daysRaw >= 1 && daysRaw <= 10 ? Math.round(daysRaw) : null;
  const budgetRaw = Number(body.budgetMillions);
  const budgetMillions = Number.isFinite(budgetRaw) && budgetRaw > 0 ? Math.round(budgetRaw) : null;
  const freeText = typeof body.freeText === "string" ? body.freeText.slice(0, 400) : "";
  const questions = questionsFromClient(body.questions);
  const answers: QuizAnswers =
    body.answers && typeof body.answers === "object"
      ? Object.fromEntries(
          Object.entries(body.answers as Record<string, unknown>)
            .filter(([, value]) => typeof value === "string")
            .slice(0, 25)
            .map(([key, value]) => [key, String(value).slice(0, 80)]),
        )
      : {};

  const fallback: AiAnalysis = localAnalysis(questions, answers, { budgetMillions, travellers, origin });

  if (!questions.length || !Object.keys(answers).length) {
    return NextResponse.json({ success: true, analysis: fallback, note: "پاسخ کافی نبود؛ نتیجه با موتور داخلی ساخته شد." });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ success: true, analysis: fallback });
  }

  const answered = questions
    .filter((question) => answers[question.key])
    .map((question) => ({
      prompt: question.prompt,
      label: question.options.find((option) => option.id === answers[question.key])?.label || answers[question.key],
    }));

  const prompt = analysisPrompt({ origin, travellers, budgetMillions, days, freeText, answers: answered });
  const chain = chainFor("suggest");

  for (const model of chain.models) {
    try {
      const result = await withDeadline(askModel(prompt), ANALYSIS_DEADLINE_MS);
      const analysis = sanitizeAnalysis(result.raw, { budgetMillions, travellers, origin, fallback });
      return NextResponse.json({
        success: true,
        analysis,
        meta: { model, generatedAt: new Date().toISOString() },
      });
    } catch (caught) {
      if (caught instanceof AiBudgetError) {
        return NextResponse.json({
          success: true,
          analysis: fallback,
          note: "سهم هوش مصنوعی تمام شده؛ نتیجه با موتور داخلی سفرینو ساخته شد.",
        });
      }
    }
  }

  return NextResponse.json({
    success: true,
    analysis: fallback,
    note: "نوشتن تحلیل طول کشید؛ شهرها با موتور داخلی سفرینو و از همان پاسخ‌های تو انتخاب شدند.",
  });
}
