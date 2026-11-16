import {
  BREAKFAST_PER_PERSON_PER_DAY,
  DEFAULT_ACTIVITIES_PER_PERSON_PER_DAY,
  FOOD_PER_PERSON_PER_DAY,
  LOCAL_TRANSPORT_PER_PERSON_PER_DAY,
} from "./city-costs";
import { tripCostBreakdown } from "./trip-costs";

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

/**
 * A normal day of food for one person, as stated by the traveller: about one
 * million toman. It is a planning assumption, not a quote, and every place
 * that uses it says so. Activities differ per city and come from
 * `lib/city-costs`; the food, breakfast saving and city transport do not.
 */
export const DAILY_FOOD_TOMAN = FOOD_PER_PERSON_PER_DAY;
/** When the room includes breakfast, that much of the food money is saved. */
export const DAILY_BREAKFAST_TOMAN = BREAKFAST_PER_PERSON_PER_DAY;
/** The country default; a city with its own figure overrides it. */
export const DAILY_ACTIVITIES_TOMAN = DEFAULT_ACTIVITIES_PER_PERSON_PER_DAY;
export const DAILY_LOCAL_TRANSPORT_TOMAN = LOCAL_TRANSPORT_PER_PERSON_PER_DAY;

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

/**
 * Reads a room's own text to see whether a meal is already paid for. Nothing
 * is assumed: only the words the provider itself put on the offer count.
 */
export function mealsIncluded(offer: { name?: string; priceNote?: string; amenities?: string[]; details?: string[] }): {
  breakfast: boolean;
  fullBoard: boolean;
  label: string;
} {
  const text = [offer.name, offer.priceNote, ...(offer.amenities || []), ...(offer.details || [])]
    .filter(Boolean)
    .join(" ");
  const fullBoard = /(تمام\s* غذا|پانسیون|full\s*board|all\s*inclusive|ناهار و شام)/i.test(text);
  const breakfast = fullBoard || /(صبحانه|breakfast)/i.test(text);
  return {
    breakfast,
    fullBoard,
    label: fullBoard ? "غذا در قیمت اقامتگاه هست" : breakfast ? "صبحانه در قیمت اقامتگاه هست" : "",
  };
}

export function estimateBudget(input: {
  totalBudget: number;
  travellers: number;
  days: number;
  tickets?: number;
  stay?: number;
  /** The destination — activities are priced per city. */
  city?: string | null;
  nights?: number;
  /** The room's price already covers breakfast / all meals. */
  breakfastIncluded?: boolean;
  fullBoardIncluded?: boolean;
}): BudgetPlan {
  // One engine for the whole site: this is the same table every page prints.
  const breakdown = tripCostBreakdown({
    totalBudget: input.totalBudget,
    travellers: input.travellers,
    days: input.days,
    nights: input.nights,
    city: input.city,
    tickets: input.tickets,
    stay: input.stay,
    breakfastIncluded: input.breakfastIncluded,
    fullBoardIncluded: input.fullBoardIncluded,
  });
  return {
    totalBudget: breakdown.totalBudget,
    travellers: breakdown.travellers,
    days: breakdown.days,
    tickets: breakdown.tickets,
    stay: breakdown.stay,
    food: breakdown.food,
    activities: breakdown.activities,
    localTransport: breakdown.localTransport,
    remaining: breakdown.remaining,
    verdict: breakdown.verdict,
    note: breakdown.note,
  };
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

/**
 * «آیا این اتاق با پول باقی‌مانده جور است؟» — the sentence a traveller needs
 * before pressing «انتخاب»: what is left for the room once the ticket, the
 * food (800,000 per person per day) and the day-to-day costs are set aside.
 */
export function roomAffordability(input: {
  roomTotal: number;
  /** What is still unspent for the room after the ticket and the daily costs. */
  roomBudget: number;
  travellers: number;
  nights: number;
  breakfastIncluded?: boolean;
  fullBoardIncluded?: boolean;
}): { fits: boolean; tone: "fits" | "tight" | "over"; label: string; foodNote: string; headroom: number } {
  const nights = Math.max(1, Math.round(input.nights || 1));
  const travellers = Math.max(1, Math.round(input.travellers || 1));
  const savings =
    (input.fullBoardIncluded ? DAILY_FOOD_TOMAN / 2 : input.breakfastIncluded ? DAILY_BREAKFAST_TOMAN : 0) * travellers * nights;
  const food = Math.max(0, DAILY_FOOD_TOMAN * travellers * nights - savings);
  const headroom = Math.round(input.roomBudget - input.roomTotal);
  const ratio = input.roomBudget > 0 ? input.roomTotal / input.roomBudget : 2;
  const dailyFood = new Intl.NumberFormat("fa-IR").format(DAILY_FOOD_TOMAN);
  const breakfast = new Intl.NumberFormat("fa-IR").format(DAILY_BREAKFAST_TOMAN);
  const foodNote = input.fullBoardIncluded
    ? `غذای هر نفر هر روز ${dailyFood} تومان حساب شد و چون غذا در قیمت اقامتگاه هست، نصفش کم شد (${toman(food)} برای ${travellers} نفر و ${nights} شب).`
    : input.breakfastIncluded
      ? `صبحانه در قیمت هست، پس از ${dailyFood} تومان غذای هر نفر هر روز، ${breakfast} تومان کم شد (${toman(food)} برای ${travellers} نفر و ${nights} شب).`
      : `غذا برای ${travellers} نفر و ${nights} شب ${toman(food)} حساب شده (${dailyFood} تومان هر نفر هر روز).`;
  if (headroom >= 0 && ratio <= 0.8) {
    return {
      fits: true,
      tone: "fits",
      headroom,
      foodNote,
      label: `مناسب بودجه‌ات است: ${toman(headroom)} هم بعد از این اقامت و پول غذا باقی می‌ماند.`,
    };
  }
  if (headroom >= 0) {
    return {
      fits: true,
      tone: "tight",
      headroom,
      foodNote,
      label: `جای مانور زیادی نمی‌مانَد: بعد از این اقامت فقط ${toman(headroom)} برای بقیهٔ سفر می‌ماند.`,
    };
  }
  return {
    fits: false,
    tone: "over",
    headroom,
    foodNote,
    label: `${toman(Math.abs(headroom))} بیشتر از پولی است که بعد از بلیت و پول غذا می‌ماند.`,
  };
}
