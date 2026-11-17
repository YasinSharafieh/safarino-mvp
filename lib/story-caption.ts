/**
 * «کپشن استوری» — the words that go with the story cards.
 *
 * `story-plan.ts` turns a trip into three vertical pictures; this file writes the
 * text a traveller actually pastes under them. Nothing is invented: every number
 * comes from the trip itself (days, travellers, the budget, the real place names,
 * the measured kilometres), and the three variants are three honest lengths of the
 * same facts rather than three moods of fiction.
 *
 * A model may polish the text — the cheapest writing model, one call — but only
 * if every number in the answer already exists in the trip, checked by
 * `verifyAnswer`. Otherwise the locally written caption is used, which needs no
 * network and can never be wrong.
 */

import { verifyAnswer } from "./ai-verify";

export type CaptionInput = {
  destination: string;
  origin?: string;
  days: number;
  travellers: number;
  /** Planned total in toman, when the plan has one. */
  totalToman?: number;
  /** The traveller's total budget, for the honest line about money. */
  budgetToman?: number;
  transportLabel?: string;
  stayName?: string;
  archetypeName?: string;
  /** Real stop names, already shown on the page. */
  topPlaces: string[];
  /** e.g. «۱۲ آبان» — only when the traveller really chose a date. */
  dateLabel?: string;
  /** Measured kilometres, when Neshan or OpenStreetMap measured them. */
  km?: number;
};

export type CaptionVariant = {
  id: "short" | "story" | "detailed";
  label: string;
  /** The caption itself, without hashtags. */
  text: string;
};

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
const money = (value: number) => `${fa(value)} تومان`;

/** A hashtag that Persian keyboards and Instagram both accept. */
function tag(value: string): string {
  const clean = String(value || "")
    .trim()
    .replace(/[،.,!؟?«»"'()]/g, "")
    .replace(/[\s\u200c\u200f]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return clean ? `#${clean}` : "";
}

/**
 * Hashtags derived from the trip only: the trip's own city, the number of days,
 * the starting city, and the site. No trending tags, no invented places.
 */
export function captionHashtags(input: CaptionInput): string[] {
  const days = Math.max(1, Math.round(input.days || 1));
  const tags = [
    "#سفرینو",
    tag(input.destination),
    input.origin ? tag(`سفر_از_${input.origin}`) : "",
    tag(`${fa(days)}_روز_در_${input.destination}`),
    "#سفر_ایران",
    input.archetypeName ? tag(`سفر_${input.archetypeName}`) : "",
  ].filter(Boolean);
  return Array.from(new Set(tags));
}

function placesLine(input: CaptionInput): string {
  const names = (input.topPlaces || []).filter(Boolean).slice(0, 3);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join("، ")} و ${names[names.length - 1]}`;
}

/** The three variants — deterministic, and the same facts in three lengths. */
export function captionVariants(input: CaptionInput): CaptionVariant[] {
  const days = Math.max(1, Math.round(input.days || 1));
  const travellers = Math.max(1, Math.round(input.travellers || 1));
  const destination = input.destination || "ایران";
  const places = placesLine(input);
  const date = input.dateLabel ? ` · ${input.dateLabel}` : "";
  const short = `${fa(days)} روز در ${destination}${date} ✨`;
  const story = [
    `${fa(days)} روز در ${destination}${date}`,
    places ? `از ${places} گذشتیم.` : "",
    input.transportLabel ? `با ${input.transportLabel} رفته‌ایم.` : "",
    "برنامه‌اش را با سفرینو چیدیم — با جاذبه‌های واقعی و فاصله‌های اندازه‌گیری‌شده.",
  ]
    .filter(Boolean)
    .join("\n");

  const moneyLine =
    input.totalToman && input.totalToman > 0
      ? input.budgetToman && input.budgetToman > 0
        ? `هزینهٔ برنامه ${money(input.totalToman)} شد از بودجهٔ ${money(input.budgetToman)}.`
        : `هزینهٔ برنامه حدود ${money(input.totalToman)} شد.`
      : "";
  const detailed = [
    `${fa(days)} روز، ${fa(travellers)} نفر، ${destination}${date}.`,
    places ? `مسیر ما: ${places}.` : "",
    input.stayName ? `اقامت: ${input.stayName}.` : "",
    input.transportLabel ? `رفت‌وآمد: ${input.transportLabel}.` : "",
    input.km && input.km > 0 ? `در مجموع ${fa(input.km)} کیلومتر جابه‌جا شدیم.` : "",
    moneyLine,
    "همهٔ این برنامه در سفرینو ساخته شد: جاذبه‌های واقعی، ساعت واقعی، بودجهٔ شفاف.",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    { id: "short", label: "کوتاه (یک خط)", text: short },
    { id: "story", label: "استوری (سه خط)", text: story },
    { id: "detailed", label: "کامل (برای پست)", text: detailed },
  ];
}

/** A caption with its hashtags, exactly as it should be pasted. */
export function fullCaption(variant: CaptionVariant, hashtags: string[]): string {
  return `${variant.text}\n\n${hashtags.join(" ")}`.trim();
}

/** The numbers a caption is allowed to use — the same evidence the checker sees. */
export function captionFacts(input: CaptionInput) {
  return {
    days: Math.max(1, Math.round(input.days || 1)),
    travellers: Math.max(1, Math.round(input.travellers || 1)),
    totalToman: input.totalToman || 0,
    budgetToman: input.budgetToman || 0,
    km: input.km || 0,
    destination: input.destination || "",
    origin: input.origin || "",
    places: (input.topPlaces || []).slice(0, 6),
    transport: input.transportLabel || "",
    stay: input.stayName || "",
  };
}

/** A model caption is accepted only when it repeats no new number. */
export function acceptCaption(raw: unknown, input: CaptionInput): { caption: string; source: "local" | "ai" } {
  const local = captionVariants(input)[1];
  const body = (raw || {}) as Record<string, unknown>;
  const text = clampCaption(body.caption, 600);
  if (text.length < 30) return { caption: local.text, source: "local" };
  const check = verifyAnswer(text, captionFacts(input));
  if (!check.ok) return { caption: local.text, source: "local" };
  return { caption: text, source: "ai" };
}

/**
 * Length-check helper shared with the server module, so a model answer and a
 * local caption are measured the same way.
 */
export function clampCaption(value: unknown, limit = 600): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r/g, "").trim().slice(0, limit);
}
