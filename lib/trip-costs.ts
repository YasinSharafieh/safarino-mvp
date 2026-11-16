/**
 * یکی برای همه — the only cost table the site has.
 *
 * Every screen that shows money (transport, rooms, the plan, the dashboard,
 * the companion, the deals) asks *this* file. If the plan says ۳٬۰۳۶٬۰۰۰ for
 * the room, the accommodation page says the same number, because both read the
 * same row. Nothing recomputes the arithmetic on its own.
 *
 * Five rows, always in this order, always with the same labels:
 *   بلیت سفر       — real provider prices × travellers
 *   اقامت          — real room total (room rate × nights)
 *   پول غذا        — 1,000,000 per person per day
 *   گشت‌وگذار      — per city, per person per day
 *   رفت‌وآمد شهری  — 200,000 per person per day
 * and then «باقی‌مانده» = بودجه − همهٔ ردیف‌ها.
 *
 * Food/activities/local transport are estimates and are labelled as such; the
 * tickets and the room are real numbers from the providers.
 */

import { cityCosts, FOOD_PER_PERSON_PER_DAY, BREAKFAST_PER_PERSON_PER_DAY } from "./city-costs";

export type CostRowKey = "tickets" | "stay" | "food" | "activities" | "localTransport";

export const COST_ROW_ORDER: CostRowKey[] = ["tickets", "stay", "food", "activities", "localTransport"];

export const COST_ROW_LABEL: Record<CostRowKey, string> = {
  tickets: "بلیت سفر",
  stay: "اقامت",
  food: "پول غذا",
  activities: "گشت‌وگذار",
  localTransport: "رفت‌وآمد شهری",
};

export type TripCostRow = {
  key: CostRowKey;
  label: string;
  amount: number;
  /** real = از خود سرویس‌دهنده؛ estimate = تخمین برنامه‌ریزی */
  kind: "real" | "estimate";
  detail: string;
};

export type TripCostVerdict = "fits" | "tight" | "over";

export type TripCostInput = {
  totalBudget: number;
  travellers: number;
  /** Days of the trip (nights + 1 is fine; whatever the trip is). */
  days: number;
  /** Nights of stay — used for the breakfast / full-board saving. */
  nights?: number;
  city?: string | null;
  tickets?: number;
  stay?: number;
  breakfastIncluded?: boolean;
  fullBoardIncluded?: boolean;
};

export type TripCostBreakdown = {
  totalBudget: number;
  travellers: number;
  days: number;
  nights: number;
  city: string;
  tickets: number;
  stay: number;
  food: number;
  activities: number;
  localTransport: number;
  /** Sum of the five rows. */
  totalSpent: number;
  /** totalBudget − totalSpent (can be negative, on purpose). */
  remaining: number;
  verdict: TripCostVerdict;
  /** Plain sentence the traveller can act on. */
  note: string;
  /** Where the daily numbers come from, in plain Persian. */
  basisLine: string;
  rows: TripCostRow[];
  /** Money that the room already saved (breakfast or full board). */
  foodSaving: number;
};

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
const toman = (value: number) => `${fa(value)} تومان`;

function safeInt(value: number | undefined, fallback = 0): number {
  const n = Math.round(Number(value ?? fallback));
  return Number.isFinite(n) ? n : fallback;
}

export function tripCostBreakdown(input: TripCostInput): TripCostBreakdown {
  const travellers = Math.max(1, safeInt(input.travellers, 1));
  const days = Math.max(1, safeInt(input.days, 1));
  const nights = Math.max(1, safeInt(input.nights ?? Math.max(1, days - 1), 1));
  const totalBudget = Math.max(0, safeInt(input.totalBudget, 0));
  const tickets = Math.max(0, safeInt(input.tickets, 0));
  const stay = Math.max(0, safeInt(input.stay, 0));
  const costs = cityCosts(input.city);

  // Food is charged for the days of the trip, but a room that already includes
  // breakfast (or every meal) gives part of that money back, for the nights.
  const mealDays = Math.min(days, nights);
  const foodSaving = input.fullBoardIncluded
    ? Math.round((FOOD_PER_PERSON_PER_DAY / 2) * travellers * mealDays)
    : input.breakfastIncluded
      ? BREAKFAST_PER_PERSON_PER_DAY * travellers * mealDays
      : 0;
  const food = Math.max(0, costs.foodPerPersonPerDay * travellers * days - foodSaving);
  const activities = costs.activitiesPerPersonPerDay * travellers * days;
  const localTransport = costs.localTransportPerPersonPerDay * travellers * days;

  const totalSpent = tickets + stay + food + activities + localTransport;
  const remaining = totalBudget - totalSpent;
  const share = totalBudget > 0 ? remaining / totalBudget : 0;
  const verdict: TripCostVerdict = remaining < 0 ? "over" : share < 0.1 ? "tight" : "fits";

  const where = costs.city || "مقصد";
  const rows: TripCostRow[] = [
    {
      key: "tickets",
      label: COST_ROW_LABEL.tickets,
      amount: tickets,
      kind: "real",
      detail: tickets > 0 ? `قیمت واقعی بلیت برای ${fa(travellers)} نفر` : "هنوز بلیتی انتخاب نشده",
    },
    {
      key: "stay",
      label: COST_ROW_LABEL.stay,
      amount: stay,
      kind: "real",
      detail: stay > 0 ? `قیمت کل اتاق برای ${fa(nights)} شب` : "هنوز اقامتگاهی انتخاب نشده",
    },
    {
      key: "food",
      label: COST_ROW_LABEL.food,
      amount: food,
      kind: "estimate",
      detail:
        foodSaving > 0
          ? `${fa(costs.foodPerPersonPerDay)} تومان هر نفر هر روز؛ ${toman(foodSaving)} بابت وعده‌ای که در قیمت اقامتگاه هست کم شد`
          : `${fa(costs.foodPerPersonPerDay)} تومان هر نفر هر روز`,
    },
    {
      key: "activities",
      label: COST_ROW_LABEL.activities,
      amount: activities,
      kind: "estimate",
      detail: `${fa(costs.activitiesPerPersonPerDay)} تومان هر نفر هر روز در ${where}`,
    },
    {
      key: "localTransport",
      label: COST_ROW_LABEL.localTransport,
      amount: localTransport,
      kind: "estimate",
      detail: `${fa(costs.localTransportPerPersonPerDay)} تومان هر نفر هر روز در ${where}`,
    },
  ];

  const note =
    verdict === "fits"
      ? `با این انتخاب، ${toman(Math.max(0, remaining))} از بودجه‌ات باقی می‌ماند.`
      : verdict === "tight"
        ? `این انتخاب بودجه را تا آخر پر می‌کند؛ ${toman(Math.max(0, remaining))} جای مانور می‌ماند.`
        : `این انتخاب ${toman(Math.abs(remaining))} از بودجه بیشتر است؛ گزینهٔ ارزان‌تری پیشنهاد می‌کنیم.`;

  const basisLine = `${COST_ROW_LABEL.food} ${fa(costs.foodPerPersonPerDay)} و ${COST_ROW_LABEL.activities} ${fa(
    costs.activitiesPerPersonPerDay,
  )} و ${COST_ROW_LABEL.localTransport} ${fa(costs.localTransportPerPersonPerDay)} تومان برای هر نفر در هر روز در ${where} — تخمین برنامه‌ریزی، نه صورت‌حساب.`;

  return {
    totalBudget,
    travellers,
    days,
    nights,
    city: costs.city,
    tickets,
    stay,
    food,
    activities,
    localTransport,
    totalSpent,
    remaining,
    verdict,
    note,
    basisLine,
    rows,
    foodSaving,
  };
}

/**
 * The same five rows, but read *backwards*: what is still free for the room
 * once the tickets and the daily costs are set aside. Rooms are compared
 * against this, not against the whole budget.
 */
export function roomBudgetAfterDailyCosts(input: TripCostInput): { breakdown: TripCostBreakdown; roomBudget: number } {
  const breakdown = tripCostBreakdown(input);
  const roomBudget = breakdown.totalBudget - breakdown.tickets - breakdown.food - breakdown.activities - breakdown.localTransport;
  return { breakdown, roomBudget };
}

/**
 * The single sentence every page prints under the table so the traveller knows
 * the numbers are the same everywhere and where they came from.
 */
export function costTableFootnote(breakdown: TripCostBreakdown): string {
  return `همهٔ صفحه‌ها همین جدول را نشان می‌دهند: ${fa(breakdown.travellers)} نفر، ${fa(breakdown.days)} روز، ${
    breakdown.city || "مقصد"
  }. ${breakdown.basisLine}`;
}

export { FOOD_PER_PERSON_PER_DAY, BREAKFAST_PER_PERSON_PER_DAY };
