import { NextRequest, NextResponse } from "next/server";
import { askJson } from "@/lib/ai-openrouter";
import { AiBudgetError } from "@/lib/ai-budget";
import { getProviderCache, setProviderCache } from "@/lib/provider-cache";
import { curatePackages, packagePrompt, sanitizePackageAnswer, shelfSummary, type CuratorInput } from "@/lib/package-curator";
import type { TripPackage } from "@/lib/trip-packages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE_SECONDS = 10_800;

/**
 * «چیدن هوشمند پیشنهادها» — the shelf the home page already has, re-read for
 * this traveller: the right tier for their money, a real reason under each card,
 * and a different order on every refresh.
 *
 * The packages are never rebuilt here (that would mean crawling the providers
 * again); they are the ones the page already received, verified by id.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "بدنهٔ درخواست باید JSON باشد." }, { status: 400 });
  }

  const packages = Array.isArray(body.packages) ? (body.packages as TripPackage[]) : [];
  const safe = packages
    .filter((pkg) => pkg && typeof pkg.id === "string" && Number(pkg.totalToman) > 0 && pkg.ticket && pkg.stay)
    .slice(0, 8);
  if (!safe.length) {
    return NextResponse.json({ success: false, error: "بسته‌ای برای چیدن وجود ندارد." }, { status: 400 });
  }

  const input: CuratorInput = {
    budgetMillions: Math.max(0, Math.min(500, Number(body.budgetMillions) || 0)),
    travellers: Math.max(1, Math.min(9, Number(body.travellers) || 1)),
    days: Math.max(1, Math.min(20, Number(body.days) || 2)),
    mode: ["plane", "train", "bus"].includes(String(body.mode)) ? (body.mode as "plane" | "train" | "bus") : "any",
    taste: Array.isArray(body.taste) ? body.taste.filter((item): item is string => typeof item === "string").slice(0, 3) : [],
    seed: Math.max(0, Math.round(Number(body.seed) || 0)),
  };

  const local = curatePackages(safe, input);
  const summary = shelfSummary(local, input);
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ success: true, items: local, summary, source: "local" });
  }

  const cacheKey = `safarino:deals-smart:v1:${encodeURIComponent(
    JSON.stringify({ ids: local.map((item) => item.id).sort(), b: input.budgetMillions, t: input.travellers, d: input.days, m: input.mode }),
  ).slice(0, 320)}`;
  const cached = await getProviderCache<{ items: typeof local; summary: string }>(cacheKey);
  if (cached?.summary) return NextResponse.json({ success: true, ...cached, source: "ai", cached: true });

  try {
    const raw = await askJson({
      title: "Safarino Deals",
      maxTokens: 600,
      temperature: 0.5,
      system:
        "تو یک مشاور سفر ایرانی هستی. فقط دربارهٔ بسته‌هایی که به تو داده شده حرف می‌زنی، هیچ قیمت یا عدد تازه‌ای نمی‌سازی و هیچ مکان یا ساعتی اضافه نمی‌کنی. فقط JSON معتبر می‌نویسی.",
      prompt: packagePrompt(local, input),
    });
    const result = sanitizePackageAnswer(raw, local);
    if (result.source === "ai") {
      const payload = { items: result.items, summary: result.summary || summary };
      await setProviderCache(cacheKey, payload, CACHE_SECONDS);
      return NextResponse.json({ success: true, ...payload, source: "ai" });
    }
    return NextResponse.json({ success: true, items: local, summary, source: "local", note: "پاسخ هوش مصنوعی عدد ناشناس داشت؛ همان دلیل‌های محاسبه‌شده نمایش داده می‌شود." });
  } catch (error) {
    return NextResponse.json({
      success: true,
      items: local,
      summary,
      source: "local",
      note: error instanceof AiBudgetError ? "سهم هوش مصنوعی امروز تمام شده؛ دلیل‌ها از روی اعداد خود بسته‌ها نوشته شد." : "هوش مصنوعی الان پاسخ نداد؛ دلیل‌ها از روی اعداد خود بسته‌ها نوشته شد.",
    });
  }
}
