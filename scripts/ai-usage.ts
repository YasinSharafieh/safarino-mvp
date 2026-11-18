/**
 * How much of the AI credit is left — printed from the same store the app uses.
 *
 * The owner's rule is «۱۰ دلار باید ۲۵ روز دوام بیاورد», so the number has to be
 * checkable at any moment without reading the code: this script reads the daily
 * ledger and the total ledger and says what is spent, what is left, and how many
 * days the current pace allows.
 *
 *   npx tsx scripts/ai-usage.ts              (reads .env.local / environment)
 */

import { AiBudgetError } from "../lib/ai-budget";

function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function command(parts: string[]) {
  const config = redis();
  if (!config) throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN تنظیم نشده است.");
  const response = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(parts),
    cache: "no-store",
  });
  const payload = await response.json();
  if (payload.error) throw new Error(String(payload.error));
  return payload.result;
}

async function main() {
  if (!redis()) {
    console.log("کلیدهای Upstash در این محیط نیستند؛ همان مقادیری که روی سرور تنظیم شده استفاده کنید.");
    process.exit(0);
  }
  const totalBudget = Number(process.env.AI_TOTAL_BUDGET_USD || 8);
  const dailyBudget = Number(process.env.AI_DAILY_BUDGET_USD || 0.32);
  const spentMicros = Number(await command(["GET", "safarino:ai:total-v1"])) || 0;
  const days = await command(["KEYS", "safarino:ai:daily:*"]);
  const keys: string[] = Array.isArray(days) ? days : [];
  const rows: { date: string; usd: number }[] = [];
  for (const key of keys.sort()) {
    const micros = Number(await command(["GET", key])) || 0;
    rows.push({ date: key.replace("safarino:ai:daily:", ""), usd: micros / 1_000_000 });
  }
  const spent = spentMicros / 1_000_000;
  const left = Math.max(0, totalBudget - spent);
  const fa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 3 });
  console.log(`سقف کل: ${fa.format(totalBudget)} دلار · سقف روزانه: ${fa.format(dailyBudget)} دلار`);
  console.log(`خرج‌شده: ${fa.format(spent)} دلار · باقی‌مانده: ${fa.format(left)} دلار`);
  if (rows.length) {
    console.log("روزبه‌روز:");
    for (const row of rows) console.log(`  ${row.date} · ${fa.format(row.usd)} دلار`);
    const average = rows.reduce((sum, row) => sum + row.usd, 0) / rows.length;
    console.log(
      average > 0
        ? `با همین روند (${fa.format(average)} دلار در روز) باقی‌مانده حدود ${fa.format(Math.floor(left / average))} روز دوام می‌آورد.`
        : "هنوز خرجی ثبت نشده است.",
    );
  }
}

main().catch((error) => {
  if (error instanceof AiBudgetError) console.log(error.publicMessage);
  else console.error(error);
});
