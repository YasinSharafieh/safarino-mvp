import { NextRequest, NextResponse } from "next/server";
import { askJson, shortText } from "@/lib/ai-openrouter";
import { AiBudgetError } from "@/lib/ai-budget";
import { getProviderCache, setProviderCache } from "@/lib/provider-cache";
import { companionPrompt, companionTips, type CompanionContext } from "@/lib/companion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE_SECONDS = 43_200;
const BANNED = /(تومان|ریال|دلار)\s*\d|ساعت کاری|بسته است|باز است از|ورودی\s*\d/;

function num(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseContext(raw: unknown): CompanionContext | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const weatherRaw = Array.isArray(body.weather) ? body.weather.slice(0, 14) : [];
  return {
    origin: shortText(body.origin, 40) || undefined,
    destination: shortText(body.destination, 40) || undefined,
    budgetMillions: num(body.budgetMillions, 0, 500, 0),
    days: num(body.days, 1, 30, 1),
    travellers: num(body.travellers, 1, 20, 1),
    children: num(body.children, 0, 8, 0),
    mode: shortText(body.mode, 10) || undefined,
    carName: shortText(body.carName, 40) || null,
    transportToman: num(body.transportToman, 0, 10_000_000_000, 0),
    stayToman: num(body.stayToman, 0, 10_000_000_000, 0),
    departureDate: shortText(body.departureDate, 10) || null,
    todayIso: shortText(body.todayIso, 10) || undefined,
    distanceKm: Number.isFinite(Number(body.distanceKm)) ? Number(body.distanceKm) : null,
    weather: weatherRaw
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const day = entry as Record<string, unknown>;
        const code = Number(day.code);
        if (!Number.isFinite(code)) return null;
        const numberOrNull = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : null);
        return {
          code,
          minC: numberOrNull(day.minC),
          maxC: numberOrNull(day.maxC),
          rainProbability: numberOrNull(day.rainProbability),
        };
      })
      .filter((day): day is NonNullable<typeof day> => Boolean(day)),
  };
}

/**
 * The orb asks for a warmer sentence — about a tip it has already chosen itself.
 *
 * The tip is rebuilt on the server from the numbers the page sent, so the model
 * can never be talked into writing about a problem that does not exist, and its
 * answer is thrown away if it invents a price or an opening hour.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست باید JSON باشد." }, { status: 400 });
  }

  const context = parseContext(body.context);
  const tipId = shortText(body.tipId, 40);
  if (!context || !tipId) {
    return NextResponse.json({ success: false, error: "اطلاعات این گفت‌وگو کامل نیست." }, { status: 400 });
  }

  const tip = companionTips(context).find((entry) => entry.id === tipId);
  if (!tip) {
    return NextResponse.json({ success: false, error: "این موضوع دیگر مطرح نیست؛ وضعیت سفر عوض شده." }, { status: 409 });
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ success: true, text: tip.body, source: "local" });
  }

  const cacheKey = `safarino:companion:v1:${encodeURIComponent(
    JSON.stringify({
      id: tip.id,
      b: context.budgetMillions,
      d: context.days,
      t: context.travellers,
      m: context.mode || "",
      tr: context.transportToman || 0,
      st: context.stayToman || 0,
      w: (context.weather || []).map((day) => day.code).join(","),
    }),
  ).slice(0, 300)}`;
  const cached = await getProviderCache<{ text: string }>(cacheKey);
  if (cached?.text) return NextResponse.json({ success: true, text: cached.text, source: "ai", cached: true });

  try {
    const raw = await askJson({
      // «از همسفر بپرس»: یک بازنویسی کوتاه — the task names the model chain and the token ceiling.
      task: "chat",
      title: "Safarino Companion",
      maxTokens: 220,
      temperature: 0.6,
      system:
        "تو «همسفر سفرینو» هستی: کوتاه، مهربان و دقیق. هیچ واقعیت، قیمت، ساعت کاری یا نام مکانی نمی‌سازی و فقط چیزی را که در پیام آمده بازنویسی می‌کنی. فقط JSON معتبر می‌نویسی.",
      prompt: `${companionPrompt(tip, context)}\n\nفرمت پاسخ: {"text":"دو جمله"}`,
    });
    const text = shortText((raw as Record<string, unknown>)?.text, 500);
    if (!text || text.length < 12 || BANNED.test(text)) {
      return NextResponse.json({ success: true, text: tip.body, source: "local" });
    }
    await setProviderCache(cacheKey, { text }, CACHE_SECONDS);
    return NextResponse.json({ success: true, text, source: "ai" });
  } catch (error) {
    return NextResponse.json({
      success: true,
      text: tip.body,
      source: "local",
      note: error instanceof AiBudgetError ? "سهم هوش مصنوعی امروز تمام شده." : "هوش مصنوعی الان پاسخ نداد.",
    });
  }
}
