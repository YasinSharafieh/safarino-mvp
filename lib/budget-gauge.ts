/**
 * «کیلومترشمار بودجه» — the same arithmetic as every other page, drawn as a
 * gauge. It reads the shared estimate (tickets + stay + food + activities +
 * local transport) so the needle can never disagree with the numbers printed
 * underneath it.
 */

import { estimateBudget } from "./budget-fit";

export type GaugeZone = "calm" | "watch" | "over";

export type BudgetGauge = {
  totalToman: number;
  committedToman: number;
  foodToman: number;
  remainingToman: number;
  /** 0–100 (may exceed 100 when the trip is over budget). */
  usedPct: number;
  /** Where the needle points, clamped to the dial. */
  needlePct: number;
  zone: GaugeZone;
  zoneLabel: string;
  /** One plain sentence about the current state. */
  verdict: string;
  /** What to do next, grounded in the numbers above. */
  hint: string;
  /** How much the traveller can still spend per person per day. */
  perPersonPerDayToman: number;
  travellers: number;
  days: number;
};

export type GaugeInput = {
  totalMillions: number;
  transportToman?: number;
  accommodationToman?: number;
  travellers?: number;
  days?: number;
  /** Cheapest real alternative the page already knows about. */
  cheaperAlternative?: { mode: string; priceToman: number } | null;
  /** The destination, so the dial uses the same per-city sightseeing rate. */
  city?: string | null;
};

const MODE_LABEL: Record<string, string> = { plane: "هواپیما", train: "قطار", bus: "اتوبوس", car: "ماشین شخصی" };

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

export function budgetGauge(input: GaugeInput): BudgetGauge {
  const totalToman = Math.max(0, Math.round((input.totalMillions || 0) * 1_000_000));
  const transportToman = Math.max(0, Math.round(input.transportToman || 0));
  const accommodationToman = Math.max(0, Math.round(input.accommodationToman || 0));
  const travellers = Math.max(1, Math.round(input.travellers || 1));
  const days = Math.max(1, Math.round(input.days || 1));

  const plan = estimateBudget({
    totalBudget: totalToman,
    travellers,
    days,
    city: input.city,
    tickets: transportToman,
    stay: accommodationToman,
  });

  const committed = transportToman + accommodationToman;
  const spentShare = totalToman > 0 ? (committed + plan.food + plan.activities + plan.localTransport) / totalToman : 1;
  const usedPct = Math.round(spentShare * 1000) / 10;
  const zone: GaugeZone = plan.remaining < 0 ? "over" : spentShare > 0.85 ? "watch" : "calm";
  const zoneLabel = zone === "over" ? "از بودجه رد شدی" : zone === "watch" ? "نزدیک سقف بودجه" : "داخل بودجه";

  const verdict =
    zone === "over"
      ? `${fa(Math.abs(plan.remaining))} تومان از بودجه بیشتر شده؛ با این انتخاب، سفر تا آخر کشیده نمی‌شود.`
      : zone === "watch"
        ? `بودجه تقریباً پر است و ${fa(Math.max(0, plan.remaining))} تومان جای مانور مانده.`
        : `بعد از بلیت، اقامت، پول غذا، گشت‌وگذار و رفت‌وآمد شهری، ${fa(Math.max(0, plan.remaining))} تومان برای خرج آزاد می‌ماند.`;

  let hint: string;
  const alternative = input.cheaperAlternative;
  if (zone === "over" && alternative && alternative.priceToman > 0 && alternative.priceToman < transportToman) {
    const saved = transportToman - alternative.priceToman;
    hint = `اگر با ${MODE_LABEL[alternative.mode] || "گزینهٔ ارزان‌تر"} بروی، ${fa(saved)} تومان کمتر می‌شود و دوباره داخل بودجه می‌مانی.`;
  } else if (zone === "over") {
    hint = "اقامتگاه ارزان‌تر یا کوتاه‌تر کردن یک شب، بیشترین اثر را روی همین عدد دارد.";
  } else if (zone === "watch") {
    hint = "برای باقی سفر، یک انتخاب ارزان‌تر در اقامت یا غذا می‌تواند عقربه را از ناحیهٔ نارنجی بیرون بیاورد.";
  } else {
    hint = `می‌توانی روی خرج روزانه حساب کنی: هر نفر هر روز حدود ${fa(Math.max(0, plan.remaining) / (travellers * days))} تومان.`;
  }

  return {
    totalToman,
    committedToman: committed,
    foodToman: plan.food,
    remainingToman: plan.remaining,
    usedPct,
    needlePct: Math.max(0, Math.min(100, usedPct)),
    zone,
    zoneLabel,
    verdict,
    hint,
    perPersonPerDayToman: Math.max(0, plan.remaining) / (travellers * days),
    travellers,
    days,
  };
}
