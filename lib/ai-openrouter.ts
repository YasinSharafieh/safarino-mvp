/**
 * One small, shared way to ask the model for JSON.
 *
 * Every AI feature in Safarino uses this helper, so there is exactly one place
 * that knows about the budget guard, the model fallback, the timeout and the
 * «return JSON only» instruction. A feature that cannot get an answer throws,
 * and its own route decides what the honest local answer looks like.
 */

import { siteUrl } from "./site";
import { reserveAiBudget, settleAiBudget, usageCostMicros } from "./ai-budget";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || "mistralai/ministral-8b-2512";

export type AskJsonOptions = {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  title?: string;
  timeoutMs?: number;
};

export function extractJson(content: string): unknown {
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

/** Throws when neither the primary nor the fallback model answered. */
export async function askJson(options: AskJsonOptions): Promise<unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const maxTokens = options.maxTokens ?? 700;
  let lastError: unknown = null;

  for (const model of [MODEL, FALLBACK_MODEL]) {
    const reservation = await reserveAiBudget(model, options.prompt, maxTokens);
    let actual = 0;
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": siteUrl(),
          "X-Title": options.title || "Safarino",
        },
        body: JSON.stringify({
          model,
          temperature: options.temperature ?? 0.4,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          usage: { include: true },
          messages: [
            { role: "system", content: options.system },
            { role: "user", content: options.prompt },
          ],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      });
      if (!response.ok) throw new Error(`OpenRouter ${model} returned ${response.status}`);
      const payload = await response.json();
      actual = usageCostMicros(model, payload?.usage);
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("empty response");
      return extractJson(content);
    } catch (error) {
      lastError = error;
    } finally {
      await settleAiBudget(reservation, actual);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI request failed");
}

/** A short, plain Persian line the model wrote — or nothing at all. */
export function shortText(value: unknown, limit = 400): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}
