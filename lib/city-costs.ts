/**
 * What a day really costs in *this* city.
 *
 * The traveller told us the shape of these numbers: about one million toman of
 * food per person per day, and sightseeing that costs a little in Isfahan and a
 * lot in Kish. Those two lines are the backbone of every budget on the site, so
 * they live in exactly one place — here — and every page reads them from here.
 *
 * Nothing is presented as a quote: these are planning estimates, and every page
 * that prints them says «تخمین» next to them.
 */

export type CityCosts = {
  city: string;
  /** Food for one traveller for one day, in toman. */
  foodPerPersonPerDay: number;
  /** Entrances, museums and the paid experiences of one day, one traveller. */
  activitiesPerPersonPerDay: number;
  /** Taxis, metro and parking inside the city. */
  localTransportPerPersonPerDay: number;
  /** Where the numbers came from, in plain Persian. */
  note: string;
  /** True when the city has its own figure rather than the country default. */
  specific: boolean;
};

export const FOOD_PER_PERSON_PER_DAY = 1_000_000;
/** Breakfast is normally part of the room, so this much food money is saved. */
export const BREAKFAST_PER_PERSON_PER_DAY = 200_000;
export const LOCAL_TRANSPORT_PER_PERSON_PER_DAY = 200_000;
export const DEFAULT_ACTIVITIES_PER_PERSON_PER_DAY = 200_000;

/**
 * Sightseeing for one person for one day, by city.
 *
 * The cities with expensive ticketed attractions (islands, big resorts, the
 * capital's museums) are listed explicitly with a figure that matches what a
 * traveller actually spends there; everything else falls back to a share of the
 * city's own daily-cost profile, so no two cities are silently identical.
 */
const ACTIVITIES_BY_CITY: Record<string, number> = {
  کیش: 500_000,
  قشم: 450_000,
  هرمز: 350_000,
  "بندرعباس": 300_000,
  چابهار: 300_000,
  تهران: 300_000,
  مشهد: 250_000,
  "بندرترکمن": 250_000,
  انزلی: 250_000,
  رامسر: 250_000,
  "بابلسر": 250_000,
  نوشهر: 250_000,
  چالوس: 250_000,
  "بوشهر": 250_000,
  "بندر لنگه": 250_000,
  شیراز: 200_000,
  اصفهان: 150_000,
  تبریز: 150_000,
  یزد: 120_000,
  کرمان: 120_000,
  "کرمانشاه": 120_000,
  همدان: 120_000,
  رشت: 120_000,
  لاهیجان: 120_000,
  "ماسوله": 120_000,
  اردبیل: 150_000,
  سرعین: 150_000,
  "شوش": 120_000,
  "شوشتر": 120_000,
  "دزفول": 120_000,
  قم: 100_000,
  کاشان: 150_000,
};

/** Cities whose own profile already reflects a quiet, cheap day. */
const QUIET_CITIES = new Set(["سقز", "میاندوآب", "سوسنگرد", "ساوه", "ساری", "مریوان", "رفسنجان", "اندیمشک", "خوی", "خرمشهر"]);

/** The profile's daily cost, used only to derive a fair figure for other cities. */
const PROFILE_DAILY: Record<string, number> = {
  // Filled from `lib/city-profiles` at call time to avoid a circular import.
};

export function registerCityProfileCosts(entries: { name: string; dailyCostToman: number }[]): void {
  for (const entry of entries) PROFILE_DAILY[entry.name] = entry.dailyCostToman;
}

function roundTo50k(value: number): number {
  return Math.max(50_000, Math.round(value / 50_000) * 50_000);
}

export function cityCosts(city: string | null | undefined): CityCosts {
  const name = (city || "").trim();
  if (!name) {
    return {
      city: "",
      foodPerPersonPerDay: FOOD_PER_PERSON_PER_DAY,
      activitiesPerPersonPerDay: DEFAULT_ACTIVITIES_PER_PERSON_PER_DAY,
      localTransportPerPersonPerDay: LOCAL_TRANSPORT_PER_PERSON_PER_DAY,
      note: "مقصد هنوز انتخاب نشده؛ تخمین با نرخ عمومی کشور حساب می‌شود.",
      specific: false,
    };
  }

  const explicit = ACTIVITIES_BY_CITY[name];
  const profile = PROFILE_DAILY[name];
  let activities = DEFAULT_ACTIVITIES_PER_PERSON_PER_DAY;
  let note = "برای این شهر نرخ جداگانه‌ای ثبت نشده؛ تخمین با نرخ عمومی گشت‌وگذار حساب شده.";
  let specific = false;

  if (typeof explicit === "number") {
    activities = explicit;
    note = `هزینهٔ گشت‌وگذار ${name} برای هر نفر در روز تخمین ${new Intl.NumberFormat("fa-IR").format(explicit)} تومان است (بلیت جاذبه‌ها و تجربه‌های همان شهر).`;
    specific = true;
  } else if (QUIET_CITIES.has(name)) {
    activities = 50_000;
    note = `گشت‌وگذار ${name} ارزان است؛ برای هر نفر در روز حدود ${new Intl.NumberFormat("fa-IR").format(activities)} تومان تخمین زده می‌شود.`;
    specific = true;
  } else if (typeof profile === "number") {
    // Roughly a fifth of the city's own daily cost is ticketed sightseeing.
    activities = roundTo50k(profile * 0.2);
    note = `هزینهٔ گشت‌وگذار ${name} برای هر نفر در روز حدود ${new Intl.NumberFormat("fa-IR").format(activities)} تومان تخمین زده می‌شود (بر پایهٔ پروفایل هزینهٔ همین شهر).`;
    specific = true;
  }

  return {
    city: name,
    foodPerPersonPerDay: FOOD_PER_PERSON_PER_DAY,
    activitiesPerPersonPerDay: activities,
    localTransportPerPersonPerDay: LOCAL_TRANSPORT_PER_PERSON_PER_DAY,
    note,
    specific,
  };
}

/** A one-line summary every page can print so the traveller sees the basis. */
export function cityCostLine(city: string | null | undefined, people: number, days: number): string {
  const costs = cityCosts(city);
  const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
  const travellers = Math.max(1, Math.round(people || 1));
  const tripDays = Math.max(1, Math.round(days || 1));
  return `تخمین برای ${fa(travellers)} نفر و ${fa(tripDays)} روز در ${costs.city || "مقصد"}: غذا ${fa(
    costs.foodPerPersonPerDay * travellers * tripDays,
  )} + گشت‌وگذار ${fa(costs.activitiesPerPersonPerDay * travellers * tripDays)} + رفت‌وآمد شهری ${fa(
    costs.localTransportPerPersonPerDay * travellers * tripDays,
  )} تومان.`;
}
