import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/usage — how much of the AI credit is left.
 *
 * The owner's standing rule is «۱۰ دلار باید ۲۵ روز دوام بیاورد», so the number
 * must be readable at any moment without opening a dashboard. Only counts are
 * returned: never a key, never a token, never a model call.
 */
function fa(n: number): string {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 3 }).format(n);
}

async function command(parts: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(parts),
    cache: "no-store",
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  if (!payload || payload.error) return null;
  return payload.result;
}

export async function GET() {
  const totalBudgetUsd = Number(process.env.AI_TOTAL_BUDGET_USD || 8);
  const dailyBudgetUsd = Number(process.env.AI_DAILY_BUDGET_USD || 0.32);
  const spentMicros = Number(await command(["GET", "safarino:ai:total-v1"])) || 0;
  const keys = await command(["KEYS", "safarino:ai:daily:*"]);
  const daily: { date: string; usd: number }[] = [];
  if (Array.isArray(keys)) {
    for (const key of (keys as string[]).sort()) {
      const micros = Number(await command(["GET", key])) || 0;
      daily.push({ date: key.replace("safarino:ai:daily:", ""), usd: Math.round(micros) / 1_000_000 });
    }
  }
  const spent = spentMicros / 1_000_000;
  const remaining = Math.max(0, totalBudgetUsd - spent);
  const average = daily.length ? daily.reduce((sum, row) => sum + row.usd, 0) / daily.length : 0;
  return NextResponse.json(
    {
      success: true,
      totalBudgetUsd,
      dailyBudgetUsd,
      spentUsd: Number(spent.toFixed(4)),
      remainingUsd: Number(remaining.toFixed(4)),
      daysRecorded: daily.length,
      averageUsdPerDay: Number(average.toFixed(4)),
      daysLeftAtThisPace: average > 0 ? Math.floor(remaining / average) : null,
      daily,
      message: `از ${fa(totalBudgetUsd)} دلار، ${fa(spent)} دلار خرج شده و ${fa(remaining)} دلار مانده است.`,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
