/**
 * کدام مدل، برای کدام کار — and what it costs.
 *
 * One model for everything is why the project feels «ساده»: a cheap model is
 * wasted on the hard jobs, and an expensive one burns the ten-dollar credit on
 * the easy ones. Every AI feature in Safarino now names a **task**, and this
 * file decides which model is allowed to answer it, in what order, and how big
 * the answer may get.
 *
 * The rule for money: only models whose price per million tokens we know for
 * certain are enabled. An unknown model is never guessed at, because a wrong
 * price would quietly break the credit guard.
 */

export type AiTask =
  | "chat" // «از همسفر بپرس» — a question in the traveller's own words
  | "suggest" // a recommendation with a reason, in a small list
  | "write" // warm Persian prose (day narration, story, tip rewriting)
  | "plan" // ordering stops, choosing days
  | "quiz" // generating fresh quiz questions
  | "vision" // reading a photo of a ticket: company, times, price
  | "reason" // the hardest calls: crisis plan, package curation, budget advice
  | "parse"; // turning free text into structured trip facts

export type ModelSpec = {
  id: string;
  /** Shown in the admin line and never invented. */
  label: string;
  /** US dollars per one million input / output tokens. */
  inputPerMillion: number;
  outputPerMillion: number;
  /** Context window in tokens, from the provider's own table. */
  contextTokens: number;
  vision: boolean;
  /** Where it is genuinely good, in one plain line. */
  goodAt: string;
};

/**
 * The enabled models. Prices are dollars per million tokens, taken from the
 * account's own price table; a model we cannot price exactly stays disabled.
 */
export const AI_MODELS: Record<string, ModelSpec> = {
  "google/gemini-2.5-flash-lite": {
    id: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    inputPerMillion: 0.1,
    outputPerMillion: 0.4,
    contextTokens: 1_000_000,
    vision: true,
    goodAt: "ارزان‌ترین مدل خوب برای فارسی، JSON و تصویر؛ ستون فقرات پروژه",
  },
  "google/gemini-2.5-flash": {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    inputPerMillion: 0.3,
    outputPerMillion: 2.5,
    contextTokens: 1_000_000,
    vision: true,
    goodAt: "استدلال سخت‌تر و پاسخ طولانی‌تر؛ فقط برای کارهای پیچیده",
  },
  "meta-llama/llama-3.3-70b-instruct": {
    id: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    inputPerMillion: 0.12,
    outputPerMillion: 0.3,
    contextTokens: 131_072,
    vision: false,
    goodAt: "نوشتن فارسی گرم و روایی؛ برای متن‌های بلند و دلنشین",
  },
  "mistralai/ministral-8b-2512": {
    id: "mistralai/ministral-8b-2512",
    label: "Ministral 8B",
    inputPerMillion: 0.15,
    outputPerMillion: 0.15,
    contextTokens: 128_000,
    vision: false,
    goodAt: "سریع و ارزان برای جمله‌های کوتاه و پاسخ‌های فوری",
  },
  "qwen/qwen-2.5-72b-instruct": {
    id: "qwen/qwen-2.5-72b-instruct",
    label: "Qwen 2.5 72B",
    inputPerMillion: 0.4,
    outputPerMillion: 1.2,
    contextTokens: 32_768,
    vision: false,
    goodAt: "چندزبانهٔ قوی و پایبند به JSON؛ برای ساختارهای پیچیده",
  },
};

/**
 * The chain per task. The first model is tried, then the next — so one provider
 * being down never leaves the traveller with an empty screen.
 *
 * `maxTokens` is a hard ceiling per answer: a long output is the expensive half
 * of every call, so every task states how much it really needs.
 */
export const TASK_CHAINS: Record<AiTask, { models: string[]; maxTokens: number; temperature: number }> = {
  chat: { models: ["google/gemini-2.5-flash-lite", "mistralai/ministral-8b-2512"], maxTokens: 320, temperature: 0.45 },
  suggest: { models: ["google/gemini-2.5-flash-lite", "meta-llama/llama-3.3-70b-instruct"], maxTokens: 380, temperature: 0.5 },
  write: { models: ["meta-llama/llama-3.3-70b-instruct", "google/gemini-2.5-flash-lite"], maxTokens: 500, temperature: 0.7 },
  plan: { models: ["google/gemini-2.5-flash-lite", "qwen/qwen-2.5-72b-instruct"], maxTokens: 700, temperature: 0.35 },
  quiz: { models: ["google/gemini-2.5-flash-lite", "qwen/qwen-2.5-72b-instruct"], maxTokens: 900, temperature: 0.8 },
  vision: { models: ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash"], maxTokens: 400, temperature: 0.2 },
  reason: { models: ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"], maxTokens: 600, temperature: 0.3 },
  parse: { models: ["mistralai/ministral-8b-2512", "google/gemini-2.5-flash-lite"], maxTokens: 300, temperature: 0.2 },
};

export function modelSpec(id: string): ModelSpec | null {
  return AI_MODELS[id] || null;
}

export function chainFor(task: AiTask): { models: string[]; maxTokens: number; temperature: number } {
  return TASK_CHAINS[task] || TASK_CHAINS.chat;
}

/**
 * What one call will probably cost, so the interface can say «این کار حدود
 * ۰٫۰۰۰۳ دلار است» instead of hiding the meter.
 */
export function estimateTaskCostUsd(task: AiTask, promptChars: number, maxOutputTokens?: number): number {
  const chain = chainFor(task);
  const spec = modelSpec(chain.models[0]);
  if (!spec) return 0;
  // A deliberately pessimistic character-per-token ratio for Persian.
  const inputTokens = Math.max(1, Math.round(promptChars / 2));
  const outputTokens = maxOutputTokens ?? chain.maxTokens;
  return (inputTokens * spec.inputPerMillion + outputTokens * spec.outputPerMillion) / 1_000_000;
}

/** A plain table for the «مصرف هوش مصنوعی» panel and the report. */
export function modelTable(): { task: AiTask; model: string; label: string; maxTokens: number; vision: boolean }[] {
  return (Object.keys(TASK_CHAINS) as AiTask[]).map((task) => {
    const chain = chainFor(task);
    const spec = modelSpec(chain.models[0]);
    return {
      task,
      model: chain.models[0],
      label: spec?.label || chain.models[0],
      maxTokens: chain.maxTokens,
      vision: Boolean(spec?.vision),
    };
  });
}

export const TASK_LABEL: Record<AiTask, string> = {
  chat: "گفت‌وگو با همسفر",
  suggest: "پیشنهاد و دلیل",
  write: "نوشتن متن فارسی",
  plan: "چیدن برنامه",
  quiz: "ساختن سؤال سلیقه",
  vision: "خواندن عکس بلیت",
  reason: "تصمیم سخت",
  parse: "خواندن متن آزاد",
};
