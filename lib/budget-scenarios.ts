/**
 * «سه راه برای جا کردن بودجه» — and three honest sizes for a budget.
 *
 * When the ticket or the room does not fit, a red sentence is not help. The
 * traveller needs *options with numbers*. This file builds them out of data the
 * page already holds, so every option is calculable, reversible and true:
 *
 *   1. one night less — the room's own nightly rate, minus one day of food,
 *      sightseeing and city transport;
 *   2. a cheaper room — only when the page really has a cheaper room in hand;
 *   3. a cheaper ticket — only when the page really has a cheaper ticket;
 *   4. a bigger budget — the exact figure that makes the choice fit.
 *
 * Nothing here invents a price. A scenario whose input is missing is simply not
 * offered, and the list says so instead of filling the gap with a guess.
 */

import { cityCosts } from "./city-costs";
import { ROOM_KIND_MULTIPLIER } from "./stay-price";

export type ScenarioInput = {
  totalBudgetToman: number;
  travellers: number;
  days: number;
  nights: number;
  city: string;
  ticketToman: number;
  stayToman: number;
  /** A real cheaper ticket on the same page, total for the party. */
  cheaperTicketToman?: number | null;
  cheaperTicketLabel?: string | null;
  /** A real cheaper room on the same page, total for the stay. */
  cheaperStayToman?: number | null;
  cheaperStayLabel?: string | null;
  /** The room mix, so one night can be priced exactly like the rest. */
  roomAverageMultiplier?: number;
};

export type Scenario = {
  id: "shorter" | "cheaper_stay" | "cheaper_ticket" | "raise";
  title: string;
  detail: string;
  /** What the trip would cost after this change. */
  newTotalToman: number;
  /** Change applied to the budget field, in millions (0 = no budget change). */
  budgetMillions: number;
  /** True when this scenario makes the whole trip fit. */
  fits: boolean;
  /** How much is still missing after the change (0 when it fits). */
  stillShortToman: number;
};

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
const money = (value: number) => `${fa(value)} تومان`;

function dailyCosts(city: string, travellers: number, days: number): number {
  const costs = cityCosts(city);
  return (costs.foodPerPersonPerDay + costs.activitiesPerPersonPerDay + costs.localTransportPerPersonPerDay) * travellers * days;
}

/**
 * One night less: the room loses exactly one night (its own average rate, not an
 * approximation), and the whole party loses one day of daily costs.
 */
function shorterTrip(input: ScenarioInput): Scenario | null {
  if (input.days <= 1 || input.nights <= 0 || input.stayToman <= 0) return null;
  const perNight = input.stayToman / Math.max(1, input.nights);
  const savedStay = perNight;
  const savedDays = dailyCosts(input.city, input.travellers, 1);
  const newTotal = input.ticketToman + (input.stayToman - savedStay) + dailyCosts(input.city, input.travellers, Math.max(1, input.days - 1));
  const budget = Math.max(0, input.totalBudgetToman);
  const stillShort = Math.max(0, newTotal - budget);
  return {
    id: "shorter",
    title: `یک شب کمتر در ${input.city}`,
    detail: `اقامت ${money(input.stayToman - savedStay)} می‌شود و یک روز خرج روزانه (${money(savedDays)}) هم کم می‌شود؛ در کل ${money(
      savedStay + savedDays,
    )} آزاد می‌شود.`,
    newTotalToman: Math.round(newTotal),
    budgetMillions: 0,
    fits: stillShort === 0,
    stillShortToman: Math.round(stillShort),
  };
}

function cheaperStay(input: ScenarioInput): Scenario | null {
  const cheaper = Number(input.cheaperStayToman || 0);
  if (!cheaper || cheaper >= input.stayToman) return null;
  const newTotal = input.ticketToman + cheaper + dailyCosts(input.city, input.travellers, input.days);
  const stillShort = Math.max(0, newTotal - input.totalBudgetToman);
  return {
    id: "cheaper_stay",
    title: input.cheaperStayLabel ? `اقامت ارزان‌تر: ${input.cheaperStayLabel}` : "اقامت ارزان‌تر",
    detail: `به‌جای ${money(input.stayToman)}، ${money(cheaper)} برای همین شب‌ها؛ ${money(input.stayToman - cheaper)} آزاد می‌شود.`,
    newTotalToman: Math.round(newTotal),
    budgetMillions: 0,
    fits: stillShort === 0,
    stillShortToman: Math.round(stillShort),
  };
}

function cheaperTicket(input: ScenarioInput): Scenario | null {
  const cheaper = Number(input.cheaperTicketToman || 0);
  if (!cheaper || cheaper >= input.ticketToman) return null;
  const newTotal = cheaper + input.stayToman + dailyCosts(input.city, input.travellers, input.days);
  const stillShort = Math.max(0, newTotal - input.totalBudgetToman);
  return {
    id: "cheaper_ticket",
    title: input.cheaperTicketLabel ? `بلیت ارزان‌تر: ${input.cheaperTicketLabel}` : "بلیت ارزان‌تر",
    detail: `به‌جای ${money(input.ticketToman)}، ${money(cheaper)}؛ ${money(input.ticketToman - cheaper)} آزاد می‌شود.`,
    newTotalToman: Math.round(newTotal),
    budgetMillions: 0,
    fits: stillShort === 0,
    stillShortToman: Math.round(stillShort),
  };
}

function raiseBudget(input: ScenarioInput, targetToman: number): Scenario {
  const millions = Math.max(5, Math.ceil(targetToman / 1_000_000 / 5) * 5);
  return {
    id: "raise",
    title: `بودجه را به ${fa(millions)} میلیون برسان`,
    detail: `برای همین انتخاب‌ها، با بودجهٔ ${fa(millions)} میلیون تومان همه‌چیز جا می‌شود و ${money(
      millions * 1_000_000 - targetToman,
    )} هم برای خرج‌های پیش‌بینی‌نشده می‌ماند.`,
    newTotalToman: Math.round(targetToman),
    budgetMillions: millions,
    fits: true,
    stillShortToman: 0,
  };
}

/**
 * The list the traveller sees when money is short: every option that can be
 * computed from real data, cheapest-and-least-disruptive first.
 */
export function rescueScenarios(input: ScenarioInput): { scenarios: Scenario[]; missing: string[] } {
  const spent = input.ticketToman + input.stayToman + dailyCosts(input.city, input.travellers, input.days);
  const missing: string[] = [];
  const scenarios: Scenario[] = [];

  const shorter = shorterTrip(input);
  if (shorter) scenarios.push(shorter);
  else missing.push("برای «یک شب کمتر» باید اول اقامت انتخاب شود.");

  const stay = cheaperStay(input);
  if (stay) scenarios.push(stay);
  else missing.push("اتاق ارزان‌تری در همین صفحه پیدا نشد.");

  const ticket = cheaperTicket(input);
  if (ticket) scenarios.push(ticket);
  else missing.push("بلیت ارزان‌تری در همین صفحه پیدا نشد.");

  scenarios.push(raiseBudget(input, spent));

  return {
    scenarios: scenarios.sort((a, b) => Number(b.fits) - Number(a.fits) || a.stillShortToman - b.stillShortToman),
    missing,
  };
}

export type BudgetLevel = {
  id: "lean" | "balanced" | "roomy";
  title: string;
  millions: number;
  detail: string;
};

/**
 * Three honest sizes for a budget, built from the trip's own daily costs and the
 * purchases already chosen — not from a table of imaginary prices.
 *
 * `lean` is exactly what the trip costs today; `balanced` keeps a real cushion
 * for a taxi, a souvenir and one upgrade; `roomy` doubles that cushion. The
 * multiplier is ours and the sentence says so.
 */
export function budgetLevels(input: {
  travellers: number;
  days: number;
  city: string;
  ticketToman: number;
  stayToman: number;
}): BudgetLevel[] {
  const base = input.ticketToman + input.stayToman + dailyCosts(input.city, input.travellers, input.days);
  const lean = Math.max(5, Math.ceil(base / 1_000_000 / 5) * 5);
  const balanced = Math.max(lean, Math.ceil((base * 1.3) / 1_000_000 / 5) * 5);
  const roomy = Math.max(balanced, Math.ceil((base * 1.8) / 1_000_000 / 5) * 5);
  return [
    {
      id: "lean",
      title: "دقیقاً کافی",
      millions: lean,
      detail: `${fa(lean)} میلیون: همین انتخاب‌های فعلی + غذا و گشت‌وگذار، بدون ذخیره.`,
    },
    {
      id: "balanced",
      title: "با حاشیهٔ امن",
      millions: balanced,
      detail: `${fa(balanced)} میلیون: حدود ۳۰٪ بیشتر، برای یک تاکسی، سوغات و یک ارتقای کوچک.`,
    },
    {
      id: "roomy",
      title: "راحت",
      millions: roomy,
      detail: `${fa(roomy)} میلیون: حدود ۸۰٪ بیشتر، برای اقامت بهتر یا یک روز بیشتر.`,
    },
  ];
}

/** The room mix multiplier, exported so a page can price one night exactly. */
export function roomMultiplierFor(kind: keyof typeof ROOM_KIND_MULTIPLIER | null): number {
  if (!kind) return 1;
  return ROOM_KIND_MULTIPLIER[kind] || 1;
}
