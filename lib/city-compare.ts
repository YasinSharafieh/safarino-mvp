/**
 * «کیش یا قشم؟» — two cities compared with real numbers, then one decision.
 *
 * Every cell of the table is computed from data the site already trusts: the
 * city's own character (`city-profiles`), the day costs it charges everywhere
 * else (`city-costs`), and the traveller's own party and budget. Nothing here is
 * a made-up ranking, and no price is presented as a quote — the daily figures are
 * the same «تخمین» the budget pages use, with the label kept.
 *
 * The single decision at the bottom may come from the model, but only after the
 * arithmetic is done, and it may not introduce a number of its own: the reason
 * is checked against the same figures the table shows.
 */

import { CITY_PROFILES } from "./city-profiles";
import { DISCOVER_CITIES, type DiscoverCity } from "./discover";
import { cityCosts } from "./city-costs";

export type CityFacts = {
  name: string;
  province: string;
  tagline: string;
  highlights: string[];
  bestFor: string[];
  bestSeason: string;
  moods: string[];
  suggestedDays: number;
  /** Per person, per day, estimate — the same numbers the budget uses. */
  foodPerDay: number;
  activitiesPerDay: number;
  localTransportPerDay: number;
  /** Per person, per day. */
  dailyTotal: number;
  /** For the whole party and the whole stay. */
  tripDailyCost: number;
  /** True when this city has its own figures rather than the country default. */
  specific: boolean;
};

export function cityFacts(name: string, travellers: number, days: number): CityFacts | null {
  const city: DiscoverCity | undefined = DISCOVER_CITIES.find((entry) => entry.name === name) || findByName(name);
  if (!city) return null;
  const costs = cityCosts(city.name);
  const dailyTotal = costs.foodPerPersonPerDay + costs.activitiesPerPersonPerDay + costs.localTransportPerPersonPerDay;
  return {
    name: city.name,
    province: city.province,
    tagline: city.tagline,
    highlights: city.highlights,
    bestFor: city.bestFor,
    bestSeason: city.bestSeason,
    moods: city.moods,
    suggestedDays: city.suggestedDays,
    foodPerDay: costs.foodPerPersonPerDay,
    activitiesPerDay: costs.activitiesPerPersonPerDay,
    localTransportPerDay: costs.localTransportPerPersonPerDay,
    dailyTotal,
    tripDailyCost: dailyTotal * Math.max(1, travellers) * Math.max(1, days),
    specific: costs.specific,
  };
}

function findByName(name: string): DiscoverCity | undefined {
  return DISCOVER_CITIES.find((entry) => entry.name === name) || undefined;
}

export type CompareVerdict = {
  winner: "a" | "b" | "tie";
  headline: string;
  reason: string;
  source: "local" | "ai";
  /** Which meals/entrances drive the difference, in toman, when there is one. */
  costGap: number;
};

/**
 * The local verdict: cost per day first, then how well the city answers the
 * traveller's own words. A tie is said out loud rather than invented into a win.
 */
export function compareLocally(
  a: CityFacts,
  b: CityFacts,
  input: { moods: string[]; budgetToman: number; travellers: number; days: number },
): CompareVerdict {
  const fa = new Intl.NumberFormat("fa-IR");
  const costGap = Math.abs(a.tripDailyCost - b.tripDailyCost);
  const cheaper = a.tripDailyCost === b.tripDailyCost ? null : a.tripDailyCost < b.tripDailyCost ? a : b;
  const pricier = cheaper === a ? b : a;

  const moodScore = (city: CityFacts) => city.moods.filter((mood) => input.moods.includes(mood)).length;
  const tasteA = moodScore(a);
  const tasteB = moodScore(b);
  const betterTaste = tasteA === tasteB ? null : tasteA > tasteB ? a : b;

  const fitsBudget = (city: CityFacts) => city.tripDailyCost <= input.budgetToman;

  if (input.moods.length && betterTaste) {
    return {
      winner: betterTaste === a ? "a" : "b",
      headline: `${betterTaste.name} با سلیقه‌ات جورتر است`,
      reason: `چون سراغ «${input.moods.join("، ")}» را می‌گیری و ${betterTaste.name} دقیقاً همین است (${betterTaste.tagline})${
        cheaper ? `؛ در عوض ${cheaper.name} روزی ${fa.format(costGap)} تومان برای هر دو شهر ارزان‌تر در می‌آید` : ""
      }.`,
      source: "local",
      costGap,
    };
  }

  if (cheaper && fitsBudget(cheaper) && !fitsBudget(pricier)) {
    return {
      winner: cheaper === a ? "a" : "b",
      headline: `${cheaper.name} در بودجه‌ات جا می‌شود`,
      reason: `خرج روزانهٔ ${cheaper.name} برای ${fa.format(input.travellers)} نفر در ${fa.format(input.days)} روز حدود ${fa.format(
        cheaper.tripDailyCost,
      )} تومان است و در بودجه‌ات جا می‌شود؛ ${pricier.name} ${fa.format(costGap)} تومان بیشتر در می‌آید.`,
      source: "local",
      costGap,
    };
  }

  if (cheaper && costGap > Math.max(cheaper.tripDailyCost, 1) * 0.1) {
    return {
      winner: cheaper === a ? "a" : "b",
      headline: `${cheaper.name} ارزان‌تر است`,
      reason: `با ${fa.format(input.travellers)} نفر در ${fa.format(input.days)} روز، ${cheaper.name} حدود ${fa.format(
        costGap,
      )} تومان کمتر از ${pricier.name} خرج برمی‌دارد؛ هر دو در بودجه‌ات جا می‌شوند، پس انتخاب سلیقه‌ای است.`,
      source: "local",
      costGap,
    };
  }

  return {
    winner: "tie",
    headline: "هر دو نزدیک به هم هستند",
    reason: `از نظر خرج روزانه تفاوتشان ${fa.format(costGap)} تومان است و هیچ‌کدام با سلیقهٔ گفته‌شده برتری روشنی ندارد؛ هر کدام را که دلت گفت بگیر.`,
    source: "local",
    costGap,
  };
}

/** What the model is shown — the same table the traveller sees, nothing else. */
export function comparePrompt(a: CityFacts, b: CityFacts, input: { moods: string[]; budgetToman: number; travellers: number; days: number }, local: CompareVerdict): string {
  const row = (city: CityFacts) =>
    `${city.name} (${city.province}): ${city.tagline} | دیدنی‌ها ${city.highlights.slice(0, 3).join("، ")} | مناسب برای ${city.bestFor
      .slice(0, 3)
      .join("، ")} | بهترین فصل ${city.bestSeason} | خرج روزانه برای همه ${city.tripDailyCost} تومان | پیشنهاد اقامت ${city.suggestedDays} روز`;
  return `مسافر می‌خواهد بین ${a.name} و ${b.name} یکی را انتخاب کند.
${input.moods.length ? `سلیقه‌اش: ${input.moods.join("، ")}` : "سلیقه‌اش را نگفته"}
بودجهٔ کل: ${input.budgetToman} تومان | ${input.travellers} نفر | ${input.days} روز

${row(a)}
${row(b)}

محاسبهٔ خودمان: برنده «${local.winner}» با این دلیل: ${local.reason}

در یک یا دو جملهٔ فارسی بگو کدام یکی برای همین مسافر بهتر است و چرا، و یک چیز عملی اضافه کن که به تصمیم کمک کند (مثلاً برای یک خانواده با بچه یا برای کسی که دنبال تاریخ است). هیچ عدد تازه‌ای نساز و هیچ قیمتی از خودت نگو.
فرمت: {"winner":"${a.name}"|"${b.name}"|"tie","reason":"..."}`;
}

/** The model may pick only one of the two cities, and may not invent numbers. */
export function acceptVerdict(raw: unknown, a: CityFacts, b: CityFacts, local: CompareVerdict, allowedToman: number[]): CompareVerdict {
  const body = (raw || {}) as Record<string, unknown>;
  const reason = typeof body.reason === "string" ? body.reason.replace(/\s+/g, " ").trim().slice(0, 400) : "";
  const name = typeof body.winner === "string" ? body.winner.trim() : "";
  if (reason.length < 20) return local;
  const winner: CompareVerdict["winner"] = name === a.name ? "a" : name === b.name ? "b" : name === "tie" ? "tie" : local.winner;

  const digits = (reason
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[,٬]/g, "")
    .match(/\d{1,12}/g) || []).map(Number);
  const allowed = new Set(allowedToman);
  for (const number of digits) if (!allowed.has(number)) return local;

  return {
    winner,
    headline:
      winner === "tie"
        ? "هر دو نزدیک به هم هستند"
        : `${winner === "a" ? a.name : b.name} را انتخاب کن`,
    reason,
    source: "ai",
    costGap: local.costGap,
  };
}
