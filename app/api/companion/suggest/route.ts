import { NextRequest, NextResponse } from "next/server";
import { askJson, shortText } from "@/lib/ai-openrouter";
import { AiBudgetError } from "@/lib/ai-budget";
import { getProviderCache, setProviderCache } from "@/lib/provider-cache";
import { acceptAdvice, adviceLocally, advicePrompt, type AdviceFacts, type AdviceOption } from "@/lib/ai-advice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE_SECONDS = 3_600;

function num(value: unknown, min: number, max: number, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function parseFacts(raw: unknown): AdviceFacts | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const stage = body.stage === "accommodation" ? "accommodation" : "transport";
  const destination = shortText(body.destination, 60);
  if (!destination) return null;
  return {
    stage,
    origin: shortText(body.origin, 60) || "—",
    destination,
    days: num(body.days, 1, 30, 3),
    travellers: num(body.travellers, 1, 20, 2),
    children: num(body.children, 0, 8, 0),
    budgetToman: num(body.budgetToman, 0, 5_000_000_000),
    committedToman: num(body.committedToman, 0, 5_000_000_000),
    dailyToman: num(body.dailyToman, 0, 2_000_000_000),
    departureDate: /^\d{4}-\d{2}-\d{2}$/.test(String(body.departureDate || "")) ? String(body.departureDate) : null,
    tastes: Array.isArray(body.tastes) ? body.tastes.filter((item): item is string => typeof item === "string").slice(0, 6) : [],
  };
}

function parseOptions(raw: unknown): AdviceOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 14)
    .map((entry): AdviceOption | null => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const id = shortText(record.id, 80);
      const title = shortText(record.title, 80);
      const priceToman = Math.round(Number(record.priceToman) || 0);
      if (!id || !title || priceToman <= 0) return null;
      return { id, title, priceToman, detail: shortText(record.detail, 120) };
    })
    .filter((option): option is AdviceOption => Boolean(option));
}

/**
 * «همسفر پیشنهاد می‌دهد» — a real recommendation over the real options.
 *
 * The local decision is computed first and stands on its own; the model may
 * pick a different real option and explain it, but it can never invent one and
 * can never invent a number.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست باید JSON باشد." }, { status: 400 });
  }

  const facts = parseFacts(body.facts);
  const options = parseOptions(body.options);
  if (!facts || !options.length) {
    return NextResponse.json({ success: false, error: "اطلاعات این پیشنهاد کامل نیست." }, { status: 400 });
  }

  const local = adviceLocally(facts, options);
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ success: true, advice: local });
  }

  const cacheKey = `safarino:advice:v1:${encodeURIComponent(
    [
      facts.stage,
      facts.destination,
      facts.days,
      facts.travellers,
      facts.budgetToman,
      facts.committedToman,
      options.map((option) => `${option.id}:${option.priceToman}`).join(","),
    ]
      .join("|")
      .slice(0, 700),
  )}`;
  const cached = await getProviderCache<{ advice: ReturnType<typeof acceptAdvice> }>(cacheKey);
  if (cached?.advice) {
    return NextResponse.json({ success: true, advice: cached.advice, cached: true });
  }

  try {
    const raw = await askJson({
      task: "suggest",
      title: "Safarino Choice Advisor",
      maxTokens: 220,
      system:
        "تو «همسفر سفرینو» هستی و یک انتخاب واقعی از میان گزینه‌های داده‌شده پیشنهاد می‌کنی. فقط شناسهٔ موجود در فهرست را برمی‌گردانی، هیچ گزینه یا عددی نمی‌سازی، و فقط JSON معتبر می‌نویسی.",
      prompt: advicePrompt(facts, options, local),
    });
    const advice = acceptAdvice(raw, options, facts, local);
    if (advice.source === "ai") await setProviderCache(cacheKey, { advice }, CACHE_SECONDS);
    return NextResponse.json({ success: true, advice });
  } catch (error) {
    return NextResponse.json({
      success: true,
      advice: local,
      note:
        error instanceof AiBudgetError
          ? "سهم هوش مصنوعی امروز تمام شده؛ پیشنهاد از حساب‌های خود سفر تو ساخته شد."
          : "هوش مصنوعی الان جواب نداد؛ پیشنهاد از حساب‌های خود سفر تو ساخته شد.",
    });
  }
}
