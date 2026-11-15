/**
 * «بهترین برای تو» — the money side of every choice.
 *
 * The traveller gives a whole-trip budget early (origin/destination screen, or
 * the quiz). Every later list — tickets, rooms — is then read against that
 * number, so nobody is quietly sold a room that leaves no money for food.
 *
 * How the estimate is built (all of it visible to the traveller):
 *   tickets       real prices from the providers, times the party size
 *   stay          the real total of the selected room
 *   food          a per-person, per-day estimate the traveller can see
 *   activities    the same, for entrances and local experiences
 *   local transit the same, for taxis and metro inside the city
 *
 * The numbers used for food and the rest are planning assumptions, not quotes,
 * and they are labelled as such wherever they appear.
 */

export const DAILY_FOOD_TOMAN = 700_000;
export const DAILY_ACTIVITIES_TOMAN = 300_000;
export const DAILY_LOCAL_TRANSPORT_TOMAN = 200_000;

export type BudgetVerdict = "fits" | "tight" | "over";

export type BudgetPlan = {
  totalBudget: number;
  travellers: number;
  days: number;
  tickets: number;
  stay: number;
  food: number;
  activities: number;
  localTransport: number;
  /** What is still free after everything estimated. */
  remaining: number;
  verdict: BudgetVerdict;
  /** A plain sentence the traveller can act on. */
  note: string;
};

export function estimateBudget(input: {
  totalBudget: number;
  travellers: number;
  days: number;
  tickets?: number;
  stay?: number;
}): BudgetPlan {
  const travellers = Math.max(1, Math.round(input.travellers || 1));
  const days = Math.max(1, Math.round(input.days || 1));
  const totalBudget = Math.max(0, Math.round(input.totalBudget || 0));
  const tickets = Math.max(0, Math.round(input.tickets || 0));
  const stay = Math.max(0, Math.round(input.stay || 0));
  const food = DAILY_FOOD_TOMAN * travellers * days;
  const activities = DAILY_ACTIVITIES_TOMAN * travellers * days;
  const localTransport = DAILY_LOCAL_TRANSPORT_TOMAN * travellers * days;
  const remaining = totalBudget - tickets - stay - food - activities - localTransport;
  const share = totalBudget > 0 ? remaining / totalBudget : 0;
  const verdict: BudgetVerdict = remaining < 0 ? "over" : share < 0.1 ? "tight" : "fits";
  const note =
    verdict === "fits"
      ? `با این انتخاب، حدود ${toman(Math.max(0, remaining))} از بودجه‌ات برای خرج‌های آزاد می‌ماند.`
      : verdict === "tight"
        ? `این انتخاب بودجه را تا آخر پر می‌کند؛ حدود ${toman(Math.max(0, remaining))} جای مانور می‌ماند.`
        : `این انتخاب حدود ${toman(Math.abs(remaining))} از بودجه بیشتر است؛ گزینهٔ ارزان‌تری پیشنهاد می‌کنیم.`;
  return { totalBudget, travellers, days, tickets, stay, food, activities, localTransport, remaining, verdict, note };
}

function toman(value: number): string {
  return `${new Intl.NumberFormat("fa-IR").format(Math.round(value))} تومان`;
}

/** Comfort is a stated assumption (fast is roomier), never a made-up rating. */
const MODE_COMFORT: Record<string, number> = { plane: 3, train: 2, bus: 1, car: 2 };

export type ScoredOption = { id: string; price: number; mode?: string };

/**
 * Picks the option a careful friend would suggest: the roomiest ride that still
 * leaves money for the rest of the trip. If nothing is comfortable inside the
 * budget, the cheapest one wins — and the caller says so.
 */
export function bestForBudget<T extends ScoredOption>(
  options: T[],
  plan: Pick<BudgetPlan, "remaining">,
): { option: T | null; reason: string; fits: boolean } {
  const usable = options.filter((option) => Number.isFinite(option.price) && option.price >= 0);
  if (!usable.length) return { option: null, reason: "هنوز گزینه‌ای برای بررسی نیست.", fits: false };

  const byPrice = [...usable].sort((a, b) => a.price - b.price);
  const cheapest = byPrice[0];
  const affordable = byPrice.filter((option) => option.price <= plan.remaining);
  if (!affordable.length) {
    return {
      option: cheapest,
      fits: false,
      reason: `با بودجهٔ باقی‌مانده هیچ گزینه‌ای جا نمی‌شود؛ ارزان‌ترین گزینه (${toman(cheapest.price)}) را ببین یا بودجه را بالا ببر.`,
    };
  }

  // Value: comfort per toman, but never worse than the cheapest by more than 60%.
  const ceiling = Math.min(plan.remaining, cheapest.price * 1.6);
  const scored = affordable
    .filter((option) => option.price <= ceiling)
    .map((option) => ({
      option,
      value: (MODE_COMFORT[option.mode || ""] ?? 1.5) / Math.max(1, option.price),
    }))
    .sort((a, b) => b.value - a.value || a.option.price - b.option.price);

  const winner = scored[0]?.option ?? affordable[0];
  const roomy = (MODE_COMFORT[winner.mode || ""] ?? 1.5) > (MODE_COMFORT[cheapest.mode || ""] ?? 1.5);
  return {
    option: winner,
    fits: true,
    reason: roomy
      ? `کمی راحت‌تر از ارزان‌ترین گزینه است و با بودجهٔ تو جا می‌شود؛ بعد از آن هم پولی برای غذا و بازدید می‌ماند.`
      : `ارزان‌ترین گزینهٔ سازگار با بودجهٔ توست و بیشترین پول را برای بقیهٔ سفر نگه می‌دارد.`,
  };
}

/**
 * The same idea for rooms: the best-rated room that still leaves money for the
 * rest of the trip; if none does, the cheapest room and an honest warning.
 */
export function bestStay<T extends { id: string; price: number; rating: number | null }>(
  offers: T[],
  plan: Pick<BudgetPlan, "remaining">,
): { option: T | null; reason: string; fits: boolean } {
  const usable = offers.filter((offer) => Number.isFinite(offer.price) && offer.price > 0);
  if (!usable.length) return { option: null, reason: "هنوز اقامتگاهی برای بررسی نیست.", fits: false };
  const byPrice = [...usable].sort((a, b) => a.price - b.price);
  const cheapest = byPrice[0];
  const affordable = byPrice.filter((offer) => offer.price <= plan.remaining);
  if (!affordable.length) {
    return {
      option: cheapest,
      fits: false,
      reason: `هیچ اقامتگاهی در بودجهٔ باقی‌مانده جا نمی‌شود؛ ارزان‌ترین (${toman(cheapest.price)}) را ببین.`,
    };
  }
  const best = [...affordable].sort((a, b) => {
    const ratingA = a.rating ?? 0;
    const ratingB = b.rating ?? 0;
    if (ratingB !== ratingA) return ratingB - ratingA;
    return a.price - b.price;
  })[0];
  const cheapestRating = cheapest.rating ?? 0;
  const bestRating = best.rating ?? 0;
  return {
    option: best,
    fits: true,
    reason:
      bestRating > cheapestRating
        ? `امتیاز مسافرانش از ارزان‌ترین گزینه بالاتر است و با بودجهٔ تو هم جا می‌شود.`
        : `با بودجهٔ تو جا می‌شود و جای بیشتری برای خرج‌های دیگر می‌گذارد.`,
  };
}
