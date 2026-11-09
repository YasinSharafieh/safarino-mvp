import { NextRequest, NextResponse } from "next/server";
import {
  AiBudgetError,
  reserveAiBudget,
  settleAiBudget,
  usageCostMicros,
} from "../../../lib/ai-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "mistralai/ministral-8b-2512";
const MAX_OUTPUT_TOKENS = 3000;

type TravelInput = {
  origin: string;
  destination: string;
  budget: number;
  days: number;
  travelers: number;
  transport: unknown;
  accommodation: unknown;
  preferences: string[];
};

function cleanText(value: unknown, fallback: string, maxLength = 300): string {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function parseInput(body: unknown): TravelInput | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const origin = cleanText(input.origin, "", 80);
  const destination = cleanText(input.destination, "", 80);
  if (!origin || !destination) return null;

  const preferences = Array.isArray(input.preferences)
    ? input.preferences.filter((item): item is string => typeof item === "string").slice(0, 10)
    : typeof input.preferences === "string"
      ? input.preferences.split(/[،,]/).map((item) => item.trim()).filter(Boolean).slice(0, 10)
      : [];

  return {
    origin,
    destination,
    budget: cleanNumber(input.budget, 15_000_000, 1_000_000, 1_000_000_000),
    days: Math.round(cleanNumber(input.days, 3, 1, 10)),
    travelers: Math.round(cleanNumber(input.travelers, 2, 1, 20)),
    transport: input.transport ?? null,
    accommodation: input.accommodation ?? input.hotel ?? null,
    preferences: preferences.map((item) => item.slice(0, 80)),
  };
}

function jsonPrompt(input: TravelInput): string {
  return `برای سفر زیر یک برنامه عملی و دقیق به فارسی بساز.
اطلاعات سفر: ${JSON.stringify(input)}
قوانین:
- پاسخ فقط یک شیء JSON معتبر و بدون Markdown باشد.
- برنامه برای ${input.days} روز و ساعت‌به‌ساعت از حدود ۰۸:۰۰ تا ۲۲:۰۰ باشد.
- هزینه‌ها به تومان، واقع‌گرایانه و مجموعشان حداکثر بودجه کاربر باشد.
- هزینه حمل‌ونقل و اقامت ورودی را در تحلیل بودجه لحاظ کن.
- نوع هر فعالیت فقط یکی از sightseeing، food، transport، rest یا activity باشد.
ساختار دقیق خروجی:
{
  "budgetAnalysis": {
    "totalBudget": number,
    "transport": number,
    "accommodation": number,
    "food": number,
    "activities": number,
    "remaining": number,
    "summary": "string"
  },
  "days": [{
    "day": number,
    "title": "string",
    "items": [{
      "time": "HH:MM",
      "title": "string",
      "description": "string",
      "type": "sightseeing | food | transport | rest | activity"
    }]
  }],
  "recommendations": {
    "weather": "string",
    "clothing": "string",
    "restaurants": ["string"],
    "costSaving": ["string"]
  }
}`;
}

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

function normalizePlan(raw: unknown, input: TravelInput) {
  if (!raw || typeof raw !== "object") throw new Error("AI response has no plan object");
  const root = raw as Record<string, unknown>;
  const budget = (root.budgetAnalysis ?? {}) as Record<string, unknown>;
  const recommendations = (root.recommendations ?? {}) as Record<string, unknown>;
  const rawDays = Array.isArray(root.days) ? root.days : [];
  if (!rawDays.length) throw new Error("AI response has no daily schedule");

  const totalBudget = cleanNumber(budget.totalBudget, input.budget, 0, 1_000_000_000);
  const transport = cleanNumber(budget.transport, 0, 0, totalBudget);
  const accommodation = cleanNumber(budget.accommodation, 0, 0, totalBudget);
  const food = cleanNumber(budget.food, 0, 0, totalBudget);
  const activities = cleanNumber(budget.activities, 0, 0, totalBudget);
  const remaining = Math.max(0, totalBudget - transport - accommodation - food - activities);

  const days = rawDays.slice(0, input.days).map((rawDay, dayIndex) => {
    const day = (rawDay ?? {}) as Record<string, unknown>;
    const rawItems = Array.isArray(day.items) ? day.items : [];
    return {
      day: dayIndex + 1,
      title: cleanText(day.title, `روز ${dayIndex + 1} در ${input.destination}`, 120),
      items: rawItems.slice(0, 12).map((rawItem) => {
        const item = (rawItem ?? {}) as Record<string, unknown>;
        const allowedTypes = ["sightseeing", "food", "transport", "rest", "activity"];
        const type = allowedTypes.includes(String(item.type)) ? String(item.type) : "activity";
        return {
          time: cleanText(item.time, "۱۰:۰۰", 10),
          title: cleanText(item.title, "بازدید و گشت‌وگذار", 140),
          description: cleanText(item.description, "زمان آزاد برای لذت بردن از سفر", 500),
          type,
        };
      }),
    };
  });

  const stringList = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").slice(0, 8).map((item) => item.slice(0, 240))
      : [];

  return {
    budgetAnalysis: {
      totalBudget,
      transport,
      accommodation,
      food,
      activities,
      remaining,
      summary: cleanText(budget.summary, "هزینه‌ها متناسب با بودجه شما برنامه‌ریزی شده است.", 600),
    },
    days,
    recommendations: {
      weather: cleanText(recommendations.weather, "پیش از سفر پیش‌بینی هوای مقصد را بررسی کنید.", 500),
      clothing: cleanText(recommendations.clothing, "لباس راحت و کفش مناسب پیاده‌روی همراه داشته باشید.", 500),
      restaurants: stringList(recommendations.restaurants),
      costSaving: stringList(recommendations.costSaving),
    },
  };
}

async function requestModel(model: string, input: TravelInput, apiKey: string) {
  const prompt = jsonPrompt(input);
  const reservation = await reserveAiBudget(model, prompt, MAX_OUTPUT_TOKENS);
  let actualMicros = 0;

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "Safarino AI Travel Planner",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" },
        usage: { include: true },
        messages: [
          {
            role: "system",
            content: "تو یک برنامه‌ریز حرفه‌ای سفر و تحلیلگر بودجه هستی. فقط JSON معتبر و کاربردی به فارسی تولید می‌کنی. هرگز قیمت زنده، ساعت بلیت یا موجودی اقامتگاه جعل نکن.",
          },
          { role: "user", content: prompt },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) throw new Error(`OpenRouter ${model} returned ${response.status}`);
    const payload = await response.json();
    actualMicros = usageCostMicros(model, payload?.usage);
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("OpenRouter returned an empty response");

    return {
      plan: normalizePlan(extractJson(content), input),
      usage: payload?.usage ?? null,
      costMicros: actualMicros,
    };
  } finally {
    await settleAiBudget(reservation, actualMicros);
  }
}

export async function POST(request: NextRequest) {
  let input: TravelInput | null;
  try {
    input = parseInput(await request.json());
  } catch {
    return NextResponse.json({ success: false, error: "بدنه درخواست باید JSON معتبر باشد." }, { status: 400 });
  }

  if (!input) {
    return NextResponse.json(
      { success: false, error: "مبدأ و مقصد الزامی هستند و اطلاعات سفر معتبر نیست." },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "OPENROUTER_API_KEY روی سرور تنظیم نشده است." },
      { status: 503 },
    );
  }

  const models = Array.from(new Set([PRIMARY_MODEL, FALLBACK_MODEL]));
  let lastError = "Unknown AI provider error";

  for (const model of models) {
    try {
      const result = await requestModel(model, input, apiKey);
      return NextResponse.json({
        success: true,
        plan: result.plan,
        meta: {
          model,
          generatedAt: new Date().toISOString(),
          usage: result.usage,
          costUsd: result.costMicros / 1_000_000,
        },
      });
    } catch (error) {
      if (error instanceof AiBudgetError) {
        return NextResponse.json(
          { success: false, error: error.publicMessage },
          { status: error.status },
        );
      }
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  const isTimeout = lastError.toLowerCase().includes("timeout");
  return NextResponse.json(
    {
      success: false,
      error: isTimeout ? "پاسخ سرویس هوش مصنوعی زمان‌بر شد؛ دوباره تلاش کنید." : "سرویس هوش مصنوعی موقتاً در دسترس نیست.",
    },
    { status: isTimeout ? 504 : 502 },
  );
}
