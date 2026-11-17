import { NextRequest, NextResponse } from "next/server";
import { shortText } from "@/lib/ai-openrouter";
import { AiBudgetError } from "@/lib/ai-budget";
import { getProviderCache, setProviderCache } from "@/lib/provider-cache";
import { answerLocally, keepOnlyRealNumbers, questionTopic, type AskFacts } from "@/lib/companion-ask";
import { runCompanionAgent, type AgentFacts } from "@/lib/ai-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

const CACHE_SECONDS = 1_800;

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
    destinationProfile: null,
  };
}

/**
 * «همسفر: از سؤال تا کار» — the agent endpoint.
 *
 * The deterministic answer is computed first and is always a valid reply. Then
 * the agent runs: it reads real tickets, real rooms, the trip's own money, the
 * forecast and the destination profile, and answers from what it read. Anything
 * it says is verified before it is returned.
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
    return NextResponse.json({ success: true, answer: local, source: "local", steps: [], note: "پاسخ از حساب‌های خودِ سفر تو ساخته شد." });
  }

  const cacheKey = `safarino:agent:v1:${encodeURIComponent(
    `${facts.destination}|${facts.days}|${facts.budgetToman}|${facts.transportToman}|${facts.stayToman}|${question}`,
  ).slice(0, 300)}`;
  const cached = await getProviderCache<{ answer: string; steps: unknown[] }>(cacheKey);
  if (cached?.answer) {
    return NextResponse.json({ success: true, answer: cached.answer, steps: cached.steps || [], source: "agent", cached: true });
  }

  const agentFacts: AgentFacts = {
    origin: facts.origin,
    destination: facts.destination,
    departureDate: facts.departureDate,
    days: facts.days,
    travellers: facts.travellers,
    children: facts.children,
    infants: 0,
    budgetToman: facts.budgetToman,
    ticketsToman: facts.transportToman,
    stayToman: facts.stayToman,
    stayName: facts.stayName,
    transportLabel: facts.transportLabel,
    tastes: [],
  };

  try {
    const result = await runCompanionAgent({ question, facts: agentFacts, localAnswer: local });
    // The plain answer path is still checked against the trip's own numbers: a
    // destination question may never come back with a price the site never read.
    const kept = result.source === "agent" ? keepOnlyRealNumbers(result.answer, facts) || local : result.answer;
    const moneyInPlaceAnswer = questionTopic(question) === "destination" && /(تومان|ریال|دلار)/.test(kept);
    if (moneyInPlaceAnswer) {
      return NextResponse.json({
        success: true,
        answer: local,
        source: "local",
        steps: result.steps,
        note: "پاسخ پیشنهادی عددی داشت که در سفر تو نبود؛ همان حساب خودمان را نشان می‌دهم.",
      });
    }
    if (result.source === "agent" && result.steps.length) {
      await setProviderCache(cacheKey, { answer: kept, steps: result.steps }, CACHE_SECONDS);
    }
    return NextResponse.json({
      success: true,
      answer: kept,
      source: result.source,
      steps: result.steps,
      action: result.action || null,
      note: result.note,
    });
  } catch (error) {
    return NextResponse.json({
      success: true,
      answer: local,
      source: "local",
      steps: [],
      note: error instanceof AiBudgetError ? "سهم هوش مصنوعی امروز تمام شده؛ پاسخ از حساب‌های خودت." : "هوش مصنوعی الان پاسخ نداد؛ پاسخ از حساب‌های خودت.",
    });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    usage: "POST { question, facts } — the companion runs real tools and answers from what it read.",
    tools: ["tickets", "stays", "money", "weather", "destination", "fix_budget"],
  });
}
