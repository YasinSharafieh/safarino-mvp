import { NextRequest, NextResponse } from "next/server";
import { askJson, shortText } from "@/lib/ai-openrouter";
import { AiBudgetError } from "@/lib/ai-budget";
import { getProviderCache, setProviderCache } from "@/lib/provider-cache";
import { answerLocally, askPrompt, keepOnlyRealNumbers, type AskFacts } from "@/lib/companion-ask";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE_SECONDS = 21_600;

function num(value: unknown, min: number, max: number, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function parseFacts(raw: unknown): AskFacts | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const destination = shortText(body.destination, 40);
  if (!destination) return null;
  return {
    origin: shortText(body.origin, 40) || "—",
    destination,
    days: num(body.days, 1, 30, 1),
    travellers: num(body.travellers, 1, 20, 1),
    children: num(body.children, 0, 8, 0),
    budgetToman: num(body.budgetToman, 0, 5_000_000_000),
    transportToman: num(body.transportToman, 0, 1_000_000_000),
    transportLabel: shortText(body.transportLabel, 30) || "انتخاب نشده",
    stayToman: num(body.stayToman, 0, 1_000_000_000),
    stayName: shortText(body.stayName, 60) || "انتخاب نشده",
    foodToman: num(body.foodToman, 0, 1_000_000_000),
    remainingToman: num(body.remainingToman, -1_000_000_000, 1_000_000_000),
    departureDate: /^\d{4}-\d{2}-\d{2}$/.test(String(body.departureDate || "")) ? String(body.departureDate) : null,
    placeNames: Array.isArray(body.placeNames) ? body.placeNames.filter((item): item is string => typeof item === "string").slice(0, 12) : [],
    weather: Array.isArray(body.weather)
      ? body.weather
          .slice(0, 7)
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null;
            const day = entry as Record<string, unknown>;
            return {
              label: shortText(day.label, 40) || "نامشخص",
              minC: Number.isFinite(Number(day.minC)) ? Number(day.minC) : null,
              maxC: Number.isFinite(Number(day.maxC)) ? Number(day.maxC) : null,
              rainProbability: Number.isFinite(Number(day.rainProbability)) ? Number(day.rainProbability) : null,
            };
          })
          .filter((day): day is NonNullable<typeof day> => Boolean(day))
      : [],
    archetypeName: shortText(body.archetypeName, 40) || undefined,
  };
}

/**
 * «از همسفر بپرس» — one question, answered from the trip's own numbers.
 *
 * The local answer is computed first and is always valid on its own. The model
 * only rewrites it, and `keepOnlyRealNumbers` rejects the rewrite completely if
 * it contains a single number the trip does not have.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست باید JSON باشد." }, { status: 400 });
  }

  const question = shortText(body.question, 200);
  const facts = parseFacts(body.facts);
  if (!question || question.length < 3 || !facts) {
    return NextResponse.json({ success: false, error: "سؤال یا اطلاعات سفر کامل نیست." }, { status: 400 });
  }

  const local = answerLocally(question, facts);
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ success: true, answer: local, source: "local", note: "پاسخ از حساب‌های خودِ سفر تو ساخته شد." });
  }

  const cacheKey = `safarino:ask:v1:${encodeURIComponent(`${facts.destination}|${facts.days}|${facts.budgetToman}|${facts.remainingToman}|${question}`).slice(0, 320)}`;
  const cached = await getProviderCache<{ answer: string }>(cacheKey);
  if (cached?.answer) return NextResponse.json({ success: true, answer: cached.answer, source: "ai", cached: true });

  try {
    const raw = await askJson({
      title: "Safarino Companion Ask",
      maxTokens: 240,
      temperature: 0.4,
      system:
        "تو «همسفر سفرینو» هستی: کوتاه، دقیق و صادق. فقط از اعداد و واقعیت‌های داده‌شده استفاده می‌کنی، هیچ عدد یا قیمت یا ساعتی نمی‌سازی و اگر جواب در داده نیست صریح می‌گویی نمی‌دانی. فقط JSON معتبر می‌نویسی.",
      prompt: askPrompt(question, facts),
    });
    const written = shortText((raw as Record<string, unknown>)?.answer, 700);
    const kept = keepOnlyRealNumbers(written, facts);
    if (!kept) {
      return NextResponse.json({ success: true, answer: local, source: "local", note: "پاسخ پیشنهادی عددی داشت که در سفر تو نبود؛ همان حساب خودمان را نشان می‌دهم." });
    }
    await setProviderCache(cacheKey, { answer: kept }, CACHE_SECONDS);
    return NextResponse.json({ success: true, answer: kept, source: "ai" });
  } catch (error) {
    return NextResponse.json({
      success: true,
      answer: local,
      source: "local",
      note: error instanceof AiBudgetError ? "سهم هوش مصنوعی امروز تمام شده؛ پاسخ از حساب‌های خودت." : "هوش مصنوعی الان پاسخ نداد؛ پاسخ از حساب‌های خودت.",
    });
  }
}
