/**
 * «بودجهٔ سفر» — یک عدد، همه‌جا، با یک راه برای عوض‌کردنش.
 *
 * The budget is the traveller's own number, agreed at the start and then shown
 * the same on every screen. It is **not** an open slider on each page: that is
 * how a trip becomes a number nobody trusts. Instead:
 *
 *  - every step shows the same total, big and clear;
 *  - there is exactly one «تغییر بودجه» action, which opens a small panel and
 *    writes the new number into the shared trip;
 *  - the change is announced («بودجه از ۴۰ به ۶۰ میلیون تغییر کرد») so the
 *    traveller sees what moved;
 *  - and when a ticket or a room does not fit, the alarm says the real numbers,
 *    for the real party size, and offers the change as the way out.
 *
 * Everything here is arithmetic on numbers that already exist — no estimates of
 * its own, so the alarm can never disagree with the cost table.
 */

import { tripCostBreakdown, type TripCostBreakdown } from "./trip-costs";

export const MIN_BUDGET_MILLIONS = 5;
export const MAX_BUDGET_MILLIONS = 500;

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
const money = (value: number) => `${fa(value)} تومان`;
const millions = (value: number) => `${fa(value / 1_000_000)} میلیون`;

export function clampBudgetMillions(value: number): number {
  const rounded = Math.round(Number(value) || 0);
  return Math.min(MAX_BUDGET_MILLIONS, Math.max(MIN_BUDGET_MILLIONS, rounded));
}

export type BudgetChange = {
  fromMillions: number;
  toMillions: number;
  /** Positive when the traveller added money. */
  deltaToman: number;
  message: string;
};

export function budgetChange(fromMillions: number, toMillions: number): BudgetChange {
  const from = clampBudgetMillions(fromMillions);
  const to = clampBudgetMillions(toMillions);
  const deltaToman = (to - from) * 1_000_000;
  return {
    fromMillions: from,
    toMillions: to,
    deltaToman,
    message:
      deltaToman === 0
        ? "بودجه بدون تغییر ماند."
        : deltaToman > 0
          ? `بودجهٔ سفر از ${millions(from * 1_000_000)} به ${millions(to * 1_000_000)} تومان افزایش یافت (${money(deltaToman)} بیشتر).`
          : `بودجهٔ سفر از ${millions(from * 1_000_000)} به ${millions(to * 1_000_000)} تومان کاهش یافت (${money(Math.abs(deltaToman))} کمتر).`,
  };
}

/**
 * The number that actually matters when a traveller is standing in front of a
 * ticket: how much is left for *this* item after the trip's other costs.
 */
export type AffordabilityInput = {
  totalBudgetToman: number;
  travellers: number;
  days: number;
  city?: string | null;
  /** The ticket price for the whole party (not per person). */
  ticketToman?: number;
  /** The room total. */
  stayToman?: number;
  /** The price of the item being looked at, when it is not yet chosen. */
  itemToman?: number;
  itemLabel?: string;
};

export type Affordability = {
  fits: boolean;
  tone: "fits" | "tight" | "over";
  /** What is free for this item once everything else is set aside. */
  availableToman: number;
  /** How much is missing when it does not fit. */
  shortfallToman: number;
  /** The budget that would make it fit, rounded up to a round million. */
  neededBudgetMillions: number;
  headline: string;
  detail: string;
  costs: TripCostBreakdown;
};

export function affordabilityOf(input: AffordabilityInput): Affordability {
  const travellers = Math.max(1, Math.round(input.travellers || 1));
  const days = Math.max(1, Math.round(input.days || 1));
  const costs = tripCostBreakdown({
    totalBudget: Math.max(0, Math.round(input.totalBudgetToman || 0)),
    travellers,
    days,
    nights: Math.max(1, days - 1),
    city: input.city,
    tickets: input.ticketToman || 0,
    stay: input.stayToman || 0,
  });

  const item = Math.max(0, Math.round(input.itemToman || 0));
  const label = input.itemLabel || "این گزینه";
  // Everything except the item itself: the daily costs plus the other choices.
  const availableToman = costs.totalBudget - costs.food - costs.activities - costs.localTransport - costs.stay - costs.tickets;
  const shortfallToman = Math.max(0, item - availableToman);
  const fits = shortfallToman === 0;
  const share = availableToman > 0 ? item / availableToman : 2;

  // The budget that would cover this item, rounded up to a whole million.
  const neededToman = costs.totalBudget + shortfallToman;
  const neededBudgetMillions = clampBudgetMillions(Math.ceil(neededToman / 1_000_000));

  const headline = !fits
    ? `بودجه‌ات برای ${label} کم است`
    : share > 0.85
      ? `${label} تقریباً همهٔ پولی را که مانده برمی‌دارد`
      : `${label} در بودجه‌ات جا می‌شود`;

  const detail = !fits
    ? `${label} برای ${fa(travellers)} نفر ${money(item)} است، اما بعد از بلیت، اقامت و خرج روزانه (غذا، گشت‌وگذار و رفت‌وآمد) فقط ${money(
        Math.max(0, availableToman),
      )} در بودجهٔ ${millions(costs.totalBudget)} تومانی‌ات جا می‌شود؛ ${money(shortfallToman)} کم داری. با بودجهٔ ${millions(
        neededBudgetMillions * 1_000_000,
      )} تومان جا می‌شود.`
    : `${label} برای ${fa(travellers)} نفر ${money(item)} است و ${money(Math.max(0, availableToman - item))} هم بعد از آن برای بقیهٔ سفر می‌ماند.`;

  return {
    fits,
    tone: !fits ? "over" : share > 0.85 ? "tight" : "fits",
    availableToman: Math.max(0, availableToman),
    shortfallToman,
    neededBudgetMillions,
    headline,
    detail,
    costs,
  };
}

/** A one-line budget statement for the top of every step. */
export function budgetLine(input: {
  totalBudgetToman: number;
  travellers: number;
  days: number;
  city?: string | null;
  ticketToman?: number;
  stayToman?: number;
}): string {
  const costs = tripCostBreakdown({
    totalBudget: Math.round(input.totalBudgetToman || 0),
    travellers: Math.max(1, Math.round(input.travellers || 1)),
    days: Math.max(1, Math.round(input.days || 1)),
    nights: Math.max(1, Math.round((input.days || 1) - 1)),
    city: input.city,
    tickets: input.ticketToman || 0,
    stay: input.stayToman || 0,
  });
  return `بودجهٔ کل سفر ${money(costs.totalBudget)} برای ${fa(costs.travellers)} نفر و ${fa(costs.days)} روز؛ الان ${money(
    costs.totalBudget - costs.totalSpent,
  )} از آن باقی مانده.`;
}
