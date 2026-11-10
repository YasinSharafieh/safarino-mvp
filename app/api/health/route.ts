import { NextResponse } from "next/server";
import { providerStorageHealthy } from "../../../lib/provider-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const openRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);
  const budgetStorageConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );

  const providerStorage = await providerStorageHealthy();

  return NextResponse.json({
    success: true,
    service: "safarino-backend",
    openRouterConfigured,
    budgetStorageConfigured,
    providerStorageReachable: providerStorage,
    aiReady: openRouterConfigured && budgetStorageConfigured,
    model: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite",
    dailyBudgetUsd: Number(process.env.AI_DAILY_BUDGET_USD || 0.32),
    totalBudgetUsd: Number(process.env.AI_TOTAL_BUDGET_USD || 8),
    timestamp: new Date().toISOString(),
  });
}
