import { NextRequest, NextResponse } from "next/server";
import { askJson, shortText } from "@/lib/ai-openrouter";
import { AiBudgetError } from "@/lib/ai-budget";
import { acceptVerdict, cityFacts, compareLocally, comparePrompt } from "@/lib/city-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

/**
 * «کدام شهر؟» — the two-city comparison endpoint.
 *
 * The table is computed here from the same numbers every other page uses. The
 * model only writes the decision sentence, and it is discarded unless every
 * number in it is already in the table.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست باید JSON باشد." }, { status: 400 });
  }

  const firstName = shortText(body.a, 40);
  const secondName = shortText(body.b, 40);
  if (!firstName || !secondName || firstName === secondName) {
    return NextResponse.json({ success: false, error: "دو شهر متفاوت انتخاب کن." }, { status: 400 });
  }

  const travellers = clamp(body.travellers, 1, 12, 2);
  const days = clamp(body.days, 1, 21, 3);
  const budgetToman = clamp(body.budgetToman, 0, 5_000_000_000, 40_000_000);
  const moods = Array.isArray(body.moods) ? body.moods.filter((item): item is string => typeof item === "string").slice(0, 6) : [];

  const a = cityFacts(firstName, travellers, days);
  const b = cityFacts(secondName, travellers, days);
  if (!a || !b) {
    return NextResponse.json({ success: false, error: "یکی از این دو شهر در فهرست شهرهای سفرینو نیست." }, { status: 404 });
  }

  const local = compareLocally(a, b, { moods, budgetToman, travellers, days });
  const table = { a, b, verdict: local, travellers, days, budgetToman, moods };

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ success: true, ...table, note: "بدون هوش مصنوعی هم جدول و تصمیم از اعداد واقعی ساخته شد." });
  }

  try {
    const raw = await askJson({
      task: "reason",
      title: "Safarino City Compare",
      system:
        "تو مشاور انتخاب مقصد در سفرینو هستی. فقط بین دو شهری که داده شده یکی را انتخاب می‌کنی، فقط از اعداد داده‌شده استفاده می‌کنی و هیچ قیمت یا آمار تازه‌ای نمی‌سازی. فارسی، کوتاه، عملی. فقط JSON معتبر می‌نویسی.",
      prompt: comparePrompt(a, b, { moods, budgetToman, travellers, days }, local),
      maxTokens: 240,
      temperature: 0.35,
    });
    const allowed = [a.tripDailyCost, b.tripDailyCost, local.costGap, travellers, days, Math.round(budgetToman / 1_000_000), a.suggestedDays, b.suggestedDays];
    const verdict = acceptVerdict(raw, a, b, local, allowed);
    return NextResponse.json({ success: true, a, b, verdict, travellers, days, budgetToman, moods });
  } catch (error) {
    return NextResponse.json({
      success: true,
      ...table,
      note:
        error instanceof AiBudgetError
          ? "سهم هوش مصنوعی امروز تمام شده؛ جدول و تصمیم از اعداد واقعی ساخته شد."
          : "هوش مصنوعی الان جواب نداد؛ جدول و تصمیم از اعداد واقعی ساخته شد.",
    });
  }
}
