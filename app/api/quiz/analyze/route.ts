import { NextRequest, NextResponse } from "next/server";
import { siteUrl } from "../../../../lib/site";
import {
  AiBudgetError,
  reserveAiBudget,
  settleAiBudget,
  usageCostMicros,
} from "../../../../lib/ai-budget";
import {
  analysisPrompt,
  localAnalysis,
  sanitizeAnalysis,
  type AiAnalysis,
} from "../../../../lib/quiz-ai";
import { drawQuestions, type QuizAnswers, type QuizQuestion } from "../../../../lib/start-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "mistralai/ministral-8b-2512";
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
        "X-Title": "Safarino Quiz Analysis",
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
        usage: { include: true },
        messages: [
          {
            role: "system",
            content:
              "تو یک مشاور سفر ایرانی هستی. فقط از فهرست شهرهای داده‌شده انتخاب می‌کنی، قیمت و جاذبه از خودت نمی‌سازی، و فقط JSON معتبر می‌دهی.",
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
    return { raw: extractJson(content), model, costMicros: actualMicros };
  } finally {
    await settleAiBudget(reservation, actualMicros);
  }
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
  const models = Array.from(new Set([PRIMARY_MODEL, FALLBACK_MODEL]));

  for (const model of models) {
    try {
      const result = await askModel(model, prompt, apiKey);
      const analysis = sanitizeAnalysis(result.raw, { budgetMillions, travellers, origin, fallback });
      return NextResponse.json({
        success: true,
        analysis,
        meta: { model, generatedAt: new Date().toISOString(), costUsd: result.costMicros / 1_000_000 },
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

  return NextResponse.json({ success: true, analysis: fallback });
}
