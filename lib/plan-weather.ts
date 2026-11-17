/**
 * «اگر روز دوم باران بیاید، چه چیزی را جابه‌جا کنیم؟»
 *
 * The plan is built from real places and real minutes. The forecast is real too
 * (Open-Meteo). What was missing was the step between them: a *decision* about
 * which day should fall on which date.
 *
 * This file makes that decision explainable:
 *   - every day's outdoors-ness is computed from the categories of the places
 *     that are actually in it (`outdoorWeight`);
 *   - the suggestion moves whole days, never places, so times and travel stay
 *     intact;
 *   - the sentence says which day is rainy, which day moves, and why;
 *   - `applyDayOrder` renumbers the days and puts a date on each one, so the
 *     result reads like a new version of the same plan, not a shuffled list.
 */

import { outdoorWeight, suggestDayOrder, type WeatherDay } from "./weather";
/**
 * The plan-day shape, stated structurally: both the local builder and the
 * server builder produce it, and this file only ever reorders and renumbers —
 * it never touches a place or a time.
 */
export type PlanDayLike = {
  day: number;
  title: string;
  items: { time: string; title: string; type: string; poiCategory?: string }[];
};

export type PlanDayForWeather = { day: number; categories: string[] };

/** What each day is really made of, from the items it already contains. */
export function categoriesOf(days: PlanDayLike[]): PlanDayForWeather[] {
  return days.map((day) => ({
    day: day.day,
    categories: day.items
      .map((item) => item.poiCategory || "")
      .filter((category) => category.length > 0),
  }));
}

/** 0–1: how much of this day is outdoors. Used to explain the change. */
export function outdoorsShare(categories: string[]): number {
  if (!categories.length) return 0;
  const total = categories.reduce((sum, category) => sum + outdoorWeight(category), 0);
  return Math.round((total / categories.length) * 100) / 100;
}

export type WeatherReorder = {
  /** Suggested order of the plan's own day numbers. */
  order: number[];
  changed: boolean;
  /** One plain Persian sentence about what should move and why. */
  reason: string;
  /** The rainy or difficult day, when there is one, for the headline. */
  worry: { dayNumber: number; label: string; rainProbability: number | null; maxC: number | null } | null;
};

export function planWeatherReorder(days: PlanDayLike[], weather: WeatherDay[]): WeatherReorder {
  const shaped = categoriesOf(days);
  const base = suggestDayOrder(shaped.map((day) => ({ dayNumber: day.day, categories: day.categories })), weather);

  // The worst day, said precisely: highest rain chance, else the coldest, else
  // the hottest — the three things that really change a plan in Iran.
  type Worry = NonNullable<WeatherReorder["worry"]>;
  let worst: Worry | null = null;
  let worstPenalty = 0;
  for (let index = 0; index < weather.length; index += 1) {
    const day = weather[index];
    const rain = day.rainProbability ?? 0;
    const penalty =
      rain * 2 + (day.maxC !== null && day.maxC > 35 ? (day.maxC - 35) * 4 : 0) + (day.minC !== null && day.minC < 0 ? -day.minC * 4 : 0);
    if (penalty > worstPenalty) {
      worstPenalty = penalty;
      worst = {
        dayNumber: index + 1,
        label: day.label,
        rainProbability: day.rainProbability,
        maxC: day.maxC,
      };
    }
  }

  const worry = worst;
  const fa = new Intl.NumberFormat("fa-IR");
  const moved = base.order.findIndex((dayNumber, index) => dayNumber !== shaped[index]?.day);
  const reason = base.changed
    ? `${
        worry ? `روز ${fa.format(worry.dayNumber)} «${worry.label}» است` : "هوا در بعضی روزها نامناسب است"
      }؛ پیشنهاد من جابه‌جا کردن روزهاست تا روزهای فضای باز روی روزهای بهتری بیفتند — بدون تغییر در جاذبه‌ها یا ساعت‌ها.${
        moved >= 0 ? ` اولین تغیير: روز ${fa.format(moved + 1)} جای دیگری می‌نشیند.` : ""
      }`
    : base.reason;

  return { order: base.order, changed: base.changed, reason, worry };
}

/**
 * Applies an order to the plan: the same days, renumbered, and each one gets the
 * real date it now falls on. Nothing about the places or the times changes.
 */
export function applyDayOrder<T extends PlanDayLike>(days: T[], order: number[], startDate?: string | null): T[] {
  const byNumber = new Map(days.map((day) => [day.day, day]));
  const next: T[] = [];
  order.forEach((dayNumber, index) => {
    const day = byNumber.get(dayNumber);
    if (!day) return;
    next.push({ ...day, day: index + 1 });
  });
  // Any day the order forgot keeps its place at the end rather than vanishing.
  for (const day of days) {
    if (!next.some((entry) => entry.title === day.title && entry.items.length === day.items.length)) {
      next.push({ ...day, day: next.length + 1 });
    }
  }
  if (startDate) {
    return next.map((day, index) => ({ ...day, date: isoPlus(startDate, index) }) as T);
  }
  return next;
}

function isoPlus(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
