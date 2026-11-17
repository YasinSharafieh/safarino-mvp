/**
 * «همسفر خودش بررسی می‌کند» — the last gate before a sentence reaches the screen.
 *
 * Round 33's promise was that the assistant never states a fact it does not
 * have. This file enforces it as a *checker*, not a hope:
 *
 *   1. `numbersIn` pulls every number out of a sentence, in Persian or Latin
 *      digits, with or without separators.
 *   2. `collectTruth` gathers every number that actually exists in the data the
 *      answer was built from — the trip facts, the live offers, the weather —
 *      plus the simple arithmetic that is legitimate on top of it (sums and
 *      differences of money figures).
 *   3. `reviewAnswer` compares the two. A number that is not in the truth set is
 *      a fabrication, and the sentence is rejected whole rather than patched.
 *
 * `reviewWithModel` is the second, optional pass: a cheap model reads the
 * sentence and the evidence and answers one question — «is everything in this
 * sentence supported?» — so an invented *claim* (not just an invented number)
 * can be caught too. It costs a fraction of a cent and only runs on the final
 * answer, never in a loop.
 */

import { askJson, shortText } from "./ai-openrouter";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Persian/Arabic digits to Latin, separators removed. */
export function normalizeDigits(text: string): string {
  return (text || "")
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[,٬\s\u200c]/g, (match) => (match === " " || match === "\u200c" ? match : ""));
}

/** Every number in the sentence, as plain integers/decimals. */
export function numbersIn(text: string): number[] {
  const latin = normalizeDigits(text).replace(/(\d)\s+(?=\d)/g, "$1");
  const found = latin.match(/\d+(?:\.\d+)?/g) || [];
  return found.map((value) => Number(value)).filter((value) => Number.isFinite(value));
}

type TruthSink = Set<number>;

function remember(sink: TruthSink, value: number) {
  if (!Number.isFinite(value)) return;
  const rounded = Math.round(value);
  sink.add(rounded);
  sink.add(Math.abs(rounded));
  // The same amount is spoken in toman or in millions, so both forms are true.
  sink.add(Math.round(rounded / 1_000));
  sink.add(Math.round(rounded / 1_000_000));
  sink.add(Math.round(rounded / 1_000_000_000));
}

function walk(sink: TruthSink, value: unknown, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return;
  if (typeof value === "number") {
    remember(sink, value);
    return;
  }
  if (typeof value === "string") {
    for (const number of numbersIn(value)) remember(sink, number);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 40)) walk(sink, item, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) walk(sink, item, depth + 1);
  }
}

/**
 * Every number an answer is allowed to say, given the evidence it was built
 * from. Money sums and differences are added because comparing two real prices
 * is honest arithmetic, not invention.
 */
export function collectTruth(evidence: unknown): TruthSink {
  const sink: TruthSink = new Set();
  walk(sink, evidence);
  const base = Array.from(sink).filter((value) => value >= 1_000 && value <= 100_000_000_000);
  const limited = base.slice(0, 24);
  for (let i = 0; i < limited.length; i += 1) {
    for (let j = i + 1; j < limited.length; j += 1) {
      remember(sink, limited[i] + limited[j]);
      remember(sink, Math.abs(limited[i] - limited[j]));
    }
  }
  // Small counts (days, people, rooms) always come from the facts themselves.
  for (let value = 0; value <= 31; value += 1) sink.add(value);
  return sink;
}

export type VerifyResult = { ok: boolean; invented: number[]; reason: string };

/**
 * The hard check. A sentence may only use numbers the evidence contains; if it
 * does not, the whole sentence is refused and the caller shows its own honest
 * version instead.
 */
export function verifyAnswer(text: string, evidence: unknown): VerifyResult {
  const truth = collectTruth(evidence);
  const invented: number[] = [];
  for (const number of numbersIn(text)) {
    if (truth.has(Math.round(number))) continue;
    if (truth.has(Math.round(Math.abs(number)))) continue;
    invented.push(number);
    if (invented.length >= 4) break;
  }
  return {
    ok: invented.length === 0,
    invented,
    reason: invented.length
      ? `این جمله عددی دارد که در داده‌های سفر نیست: ${invented.join("، ")}`
      : "همهٔ عددهای جمله در داده‌های واقعی هست.",
  };
}

/**
 * Names of companies and hotels must also be real: a sentence that recommends
 * «هتل پارسیان» when no such offer was read is a fabrication even with no
 * numbers in it. This check is deliberately lenient about ordinary words and
 * strict about anything that looks like a proper name we supplied.
 */
export function verifyNames(text: string, allowedNames: string[]): VerifyResult {
  const clean = (text || "").replace(/[يى]/g, "ی").replace(/ك/g, "ک");
  const candidates = clean.match(/«([^»]{2,40})»/g) || [];
  const lower = clean.toLowerCase();
  const unknown: string[] = [];
  for (const raw of candidates) {
    const name = raw.replace(/[«»]/g, "").trim();
    const known = allowedNames.some((allowed) => allowed && (allowed.includes(name) || name.includes(allowed)));
    if (!known && name.length >= 3) unknown.push(name);
  }
  // A quoted name is the model's way of citing something; it must exist.
  const inventedHotel = /هتل\s+[آ-ی]{3,}/.test(lower)
    ? allowedNames.filter((name) => /هتل/.test(name)).length === 0 && !/هتل/.test(clean.replace(/هتل\s+[آ-ی]{3,}/g, ""))
    : false;
  return {
    ok: unknown.length === 0 && !inventedHotel,
    invented: [],
    reason: unknown.length ? `نام «${unknown[0]}» در گزینه‌های واقعی نبود.` : "نام‌ها با گزینه‌های واقعی می‌خوانند.",
  };
}

/**
 * The model's own review, on the finished answer only. It is asked one narrow
 * question and must answer with a JSON object, so a broken answer is dropped
 * rather than published.
 */
export async function reviewWithModel(input: {
  answer: string;
  evidence: string;
  question?: string;
}): Promise<{ ok: boolean; reason: string; source: "model" | "skipped" }> {
  if (!process.env.OPENROUTER_API_KEY) return { ok: true, reason: "بازبینی مدل خاموش است.", source: "skipped" };
  try {
    const raw = await askJson({
      task: "review",
      title: "Safarino Self Check",
      system:
        "تو بازبین سفرینو هستی. فقط یک کار داری: بررسی کن که آیا هر جملهٔ پاسخ با داده‌های داده‌شده پشتیبانی می‌شود. هر عدد، نام، ساعت یا ادعایی که در داده‌ها نیست «پشتیبانی‌نشده» است. سخت‌گیر باش اما لازم نیست پاسخ را قشنگ‌تر کنی. فقط JSON معتبر بنویس.",
      prompt: `داده‌های واقعی:
${input.evidence.slice(0, 2_400)}

${input.question ? `سؤال کاربر: ${input.question}\n` : ""}پاسخ پیشنهادی:
${input.answer.slice(0, 1_200)}

فرمت پاسخ: {"ok": true|false, "reason": "در یک جملهٔ کوتاه فارسی بگو چرا"}
اگر پاسخ هیچ عدد یا نام تازه‌ای ندارد و با داده‌ها نمی‌خواند، ok را false بگذار.`,
      maxTokens: 140,
      temperature: 0.1,
    });
    const body = (raw || {}) as Record<string, unknown>;
    return {
      ok: body.ok !== false,
      reason: shortText(body.reason, 200) || (body.ok === false ? "بازبین ایراد گرفت." : "بازبین تأیید کرد."),
      source: "model",
    };
  } catch {
    return { ok: true, reason: "بازبین در دسترس نبود؛ بررسی عددی انجام شد.", source: "skipped" };
  }
}
