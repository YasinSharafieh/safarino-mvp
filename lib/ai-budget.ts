const MICROS_PER_DOLLAR = 1_000_000;
const DAILY_KEY_PREFIX = "safarino:ai:daily:";
const TOTAL_KEY = "safarino:ai:total-v1";

type ModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
};

export type AiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
};

export type BudgetReservation = {
  dailyKey: string;
  micros: number;
};

const MODEL_PRICING: Record<string, ModelPricing> = {
  "google/gemini-2.5-flash-lite": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  "mistralai/ministral-8b-2512": { inputPerMillion: 0.15, outputPerMillion: 0.15 },
};

export class AiBudgetError extends Error {
  constructor(
    message: string,
    public readonly status: 429 | 503,
    public readonly publicMessage: string,
  ) {
    super(message);
  }
}

function configuredNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function tehranDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new AiBudgetError(
      "Durable AI budget storage is not configured",
      503,
      "سرویس هوش مصنوعی هنوز برای استفاده عمومی فعال نشده است.",
    );
  }
  return { token, url };
}

async function runRedisScript(script: string, keys: string[], args: number[]) {
  const { token, url } = redisConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(["EVAL", script, String(keys.length), ...keys, ...args.map(String)]),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) throw new Error(`Budget storage returned ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(String(payload.error));
  return payload.result;
}

export function estimateReservationMicros(model: string, promptText: string, maxOutputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) throw new Error(`No verified pricing is configured for ${model}`);

  // A full character per token is deliberately conservative for mixed Persian/JSON prompts.
  const conservativeInputTokens = Math.max(1, promptText.length);
  const estimatedDollars =
    (conservativeInputTokens * pricing.inputPerMillion + maxOutputTokens * pricing.outputPerMillion) / 1_000_000;
  return Math.max(1, Math.ceil(estimatedDollars * MICROS_PER_DOLLAR * 1.15));
}

export function usageCostMicros(model: string, usage: AiUsage | undefined): number {
  if (typeof usage?.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0) {
    return Math.max(0, Math.ceil(usage.cost * MICROS_PER_DOLLAR));
  }

  const pricing = MODEL_PRICING[model];
  if (!pricing) throw new Error(`No verified pricing is configured for ${model}`);
  const inputTokens = Math.max(0, usage?.prompt_tokens ?? 0);
  const outputTokens = Math.max(0, usage?.completion_tokens ?? 0);
  return Math.max(
    0,
    Math.ceil(((inputTokens * pricing.inputPerMillion + outputTokens * pricing.outputPerMillion) / 1_000_000) * MICROS_PER_DOLLAR),
  );
}

export async function reserveAiBudget(model: string, promptText: string, maxOutputTokens: number): Promise<BudgetReservation> {
  const micros = estimateReservationMicros(model, promptText, maxOutputTokens);
  const perRequestLimit = Math.ceil(configuredNumber("AI_PER_REQUEST_BUDGET_USD", 0.01) * MICROS_PER_DOLLAR);
  if (micros > perRequestLimit) {
    throw new AiBudgetError("Request exceeds its AI token budget", 429, "حجم این درخواست بیش از سقف مجاز است.");
  }

  const dailyKey = `${DAILY_KEY_PREFIX}${tehranDateKey()}`;
  const dailyLimit = Math.ceil(configuredNumber("AI_DAILY_BUDGET_USD", 0.32) * MICROS_PER_DOLLAR);
  const totalLimit = Math.ceil(configuredNumber("AI_TOTAL_BUDGET_USD", 8) * MICROS_PER_DOLLAR);
  const script = `
    local daily = tonumber(redis.call('GET', KEYS[1]) or '0')
    local total = tonumber(redis.call('GET', KEYS[2]) or '0')
    local amount = tonumber(ARGV[1])
    if daily + amount > tonumber(ARGV[2]) then return {0, daily, total} end
    if total + amount > tonumber(ARGV[3]) then return {-1, daily, total} end
    local newDaily = redis.call('INCRBY', KEYS[1], amount)
    redis.call('EXPIRE', KEYS[1], 200000)
    local newTotal = redis.call('INCRBY', KEYS[2], amount)
    return {1, newDaily, newTotal}
  `;

  let result: unknown;
  try {
    result = await runRedisScript(script, [dailyKey, TOTAL_KEY], [micros, dailyLimit, totalLimit]);
  } catch (error) {
    if (error instanceof AiBudgetError) throw error;
    throw new AiBudgetError(
      error instanceof Error ? error.message : "AI budget storage failed",
      503,
      "سرویس هوش مصنوعی موقتاً در دسترس نیست.",
    );
  }

  const status = Array.isArray(result) ? Number(result[0]) : 0;
  if (status === 0) {
    throw new AiBudgetError("Daily AI budget exhausted", 429, "ظرفیت امروز سرویس هوش مصنوعی تکمیل شده است.");
  }
  if (status === -1) {
    throw new AiBudgetError("Total AI budget exhausted", 429, "ظرفیت فعلی سرویس هوش مصنوعی تکمیل شده است.");
  }
  if (status !== 1) throw new Error("Unexpected AI budget reservation response");

  return { dailyKey, micros };
}

export async function settleAiBudget(reservation: BudgetReservation, actualMicros: number): Promise<void> {
  const difference = Math.max(0, Math.ceil(actualMicros)) - reservation.micros;
  if (difference === 0) return;
  const script = `
    local daily = redis.call('INCRBY', KEYS[1], ARGV[1])
    local total = redis.call('INCRBY', KEYS[2], ARGV[1])
    if daily < 0 then redis.call('SET', KEYS[1], 0) end
    if total < 0 then redis.call('SET', KEYS[2], 0) end
    return {daily, total}
  `;
  try {
    await runRedisScript(script, [reservation.dailyKey, TOTAL_KEY], [difference]);
  } catch {
    // Never repeat the AI request or charge the user again because usage logging failed.
  }
}
