/**
 * The server half of «کپشن استوری»: sanitising what the browser sent, and one
 * cheap model call that is only allowed to re-tell the trip's own facts.
 *
 * Kept apart from `lib/story-caption.ts` on purpose — the pure caption builder is
 * imported by a client component, and the model client (with the API key and the
 * budget guard) must never be pulled into the browser bundle.
 */

import { askJson } from "./ai-openrouter";
import { acceptCaption, captionFacts, captionVariants, type CaptionInput } from "./story-caption";

function text(value: unknown, limit: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, limit);
}

function count(value: unknown, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(max, Math.round(number));
}

/**
 * Everything from the browser is bounded here: no unbounded string can reach the
 * prompt, and the numbers are the same numbers the page already shows. Returns
 * `null` when there is not enough of a trip to write about.
 */
export function captionSanitizerInput(raw: unknown): CaptionInput | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const destination = text(item.destination, 60);
  if (!destination) return null;
  const places = Array.isArray(item.topPlaces)
    ? item.topPlaces.map((place) => text(place, 60)).filter(Boolean).slice(0, 6)
    : [];
  return {
    destination,
    origin: text(item.origin, 60) || undefined,
    days: Math.max(1, count(item.days, 30)),
    travellers: Math.max(1, count(item.travellers, 20)),
    totalToman: count(item.totalToman, 10_000_000_000),
    budgetToman: count(item.budgetToman, 10_000_000_000),
    transportLabel: text(item.transportLabel, 60) || undefined,
    stayName: text(item.stayName, 80) || undefined,
    archetypeName: text(item.archetypeName, 40) || undefined,
    topPlaces: places,
    dateLabel: text(item.dateLabel, 30) || undefined,
    km: count(item.km, 20_000),
  };
}

export function captionPrompt(input: CaptionInput): string {
  const facts = captionFacts(input);
  return `یک سفر واقعی که با سفرینو برنامه‌ریزی شده است:
مقصد: ${facts.destination}${facts.origin ? ` | مبدأ: ${facts.origin}` : ""}
${facts.days} روز | ${facts.travellers} نفر
توقف‌ها: ${facts.places.join("، ") || "—"}
${facts.transport ? `رفت‌وآمد: ${facts.transport}` : ""}
${facts.stay ? `اقامت: ${facts.stay}` : ""}
${facts.km ? `مسافت: ${Math.round(facts.km)} کیلومتر` : ""}
${facts.totalToman ? `هزینهٔ برنامه: ${facts.totalToman} تومان` : ""}

یک کپشن فارسی برای زیر عکس‌های استوری بنویس: دو یا سه خط، صمیمی، بدون اغراق، بدون وعده، بدون هشتگ.
هیچ عدد تازه‌ای نساز، هیچ نام مکانی که در فهرست نیست ننویس، هیچ قیمتی از خودت نگو.
فرمت: {"caption":"..."}`;
}

/** Best effort: never blocks the page, never throws. */
export async function writeCaption(input: CaptionInput): Promise<{ caption: string; source: "local" | "ai" }> {
  const local = captionVariants(input)[1].text;
  if (!process.env.OPENROUTER_API_KEY) return { caption: local, source: "local" };
  try {
    const raw = await askJson({
      task: "write",
      title: "Safarino Story Caption",
      system:
        "تو نویسندهٔ سفرینو هستی و برای زیر عکس‌های سفر، دو سه خط فارسی صمیمی می‌نویسی. فقط از داده‌های داده‌شده استفاده می‌کنی، هیچ عدد یا نام تازه‌ای نمی‌سازی و هشتگ نمی‌گذاری. فقط JSON معتبر می‌نویسی.",
      prompt: captionPrompt(input),
      maxTokens: 320,
      temperature: 0.7,
    });
    return acceptCaption(raw, input);
  } catch {
    return { caption: local, source: "local" };
  }
}
