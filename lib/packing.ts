/**
 * «چمدان هوشمند» — a packing list that reacts to the real forecast.
 *
 * Every item below is triggered by a real number from Open-Meteo (rain
 * probability, minimum temperature, wind, snow codes) or by a real fact about
 * the trip (children on board, the vehicle, the destination's own taste profile).
 * When there is no forecast, the app says so and falls back to the season —
 * it never pretends to know the weather.
 */

import type { WeatherDay } from "./weather";

export type PackingGroup = "clothing" | "health" | "tech" | "road" | "family";

export const PACKING_GROUPS: { id: PackingGroup; label: string }[] = [
  { id: "clothing", label: "پوشاک" },
  { id: "health", label: "بهداشت و سلامت" },
  { id: "tech", label: "برق و فناوری" },
  { id: "road", label: "جاده و خودرو" },
  { id: "family", label: "کودک و خانواده" },
];

export type PackingItem = {
  id: string;
  title: string;
  group: PackingGroup;
  /** The real number that put this in the bag. */
  reason: string;
  /** 1 = nice to have, 3 = the trip gets hard without it. */
  weight: 1 | 2 | 3;
};

export type PackingInput = {
  destination: string;
  days: number;
  /** Real forecast days for the trip — may be empty. */
  weather: WeatherDay[];
  weatherMode: "forecast" | "normals" | "none";
  children?: number;
  mode?: string;
  /** Taste moods of the destination / traveller. */
  moods?: string[];
  /** Month (1–12) of departure, used only when there is no forecast. */
  month?: number;
};

export type PackingPlan = {
  items: PackingItem[];
  /** One honest sentence about where the advice comes from. */
  basis: string;
  /** What the weather does to the plan, in one line. */
  summary: string;
};

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 99]);

/** The season as a plain fact, used only when there is no forecast at all. */
function seasonOf(month: number | undefined): "cold" | "hot" | "mild" {
  if (!month || month < 1 || month > 12) return "mild";
  if ([12, 1, 2].includes(month)) return "cold";
  if ([6, 7, 8].includes(month)) return "hot";
  return "mild";
}

export function smartPacking(input: PackingInput): PackingPlan {
  const items: PackingItem[] = [];
  const add = (item: PackingItem) => {
    if (!items.some((existing) => existing.id === item.id)) items.push(item);
  };

  const weather = input.weather.filter((day) => Number.isFinite(day.code));
  const rainyDays = weather.filter((day) => (day.rainProbability ?? 0) >= 40 || [61, 63, 65, 80, 81, 82, 51, 53, 55].includes(day.code));
  const snowDays = weather.filter((day) => SNOW_CODES.has(day.code));
  const stormDays = weather.filter((day) => STORM_CODES.has(day.code));
  const minTemps = weather.map((day) => day.minC).filter((value): value is number => typeof value === "number");
  const maxTemps = weather.map((day) => day.maxC).filter((value): value is number => typeof value === "number");
  const windDays = weather.filter((day) => (day.windKmh ?? 0) >= 40);
  const minTemp = minTemps.length ? Math.min(...minTemps) : null;
  const maxTemp = maxTemps.length ? Math.max(...maxTemps) : null;

  // ---- always true for any trip of more than one day
  add({ id: "pack-charger", title: "شارژر و پاوربانک", group: "tech", reason: "مسیریابی و بلیت الکترونیکی روی گوشی است.", weight: 3 });
  add({ id: "pack-shoes", title: "کفش راحت پیاده‌روی", group: "clothing", reason: `${fa(input.days)} روز برنامهٔ شهری و بازدید داری.`, weight: 3 });

  // ---- driven by the real forecast
  if (rainyDays.length) {
    add({
      id: "pack-umbrella",
      title: "چتر و بارانی سبک",
      group: "clothing",
      reason: `در ${fa(rainyDays.length)} روز از ${fa(weather.length)} روز سفر، احتمال باران بالای ۴۰٪ است.`,
      weight: 3,
    });
    add({ id: "pack-shoe-cover", title: "کیسهٔ پلاستیکی برای کفش خیس", group: "clothing", reason: "روزهای بارانی کفش را نمی‌شود خشک نگه داشت.", weight: 1 });
  }
  if (snowDays.length) {
    add({ id: "pack-warm", title: "لباس گرم و دستکش", group: "clothing", reason: `${fa(snowDays.length)} روز از سفر در پیش‌بینی برف دارد.`, weight: 3 });
    add({ id: "pack-waterproof-boot", title: "کفش ضدآب و جوراب اضافه", group: "clothing", reason: "برف و آبِ کف خیابان، کفش معمولی را خیس می‌کند.", weight: 2 });
  }
  if (minTemp !== null && minTemp <= 5 && !snowDays.length) {
    add({ id: "pack-warm", title: "لباس گرم و بادگیر", group: "clothing", reason: `کمترین دمای پیش‌بینی‌شده ${fa(minTemp)} درجه است.`, weight: 3 });
  }
  if (maxTemp !== null && maxTemp >= 33) {
    add({ id: "pack-sun", title: "کلاه، عینک آفتابی و ضدآفتاب", group: "health", reason: `بیشترین دمای پیش‌بینی‌شده ${fa(maxTemp)} درجه است.`, weight: 3 });
    add({ id: "pack-water", title: "قمقمهٔ آب", group: "health", reason: "در این دما، آب همراه داشتن از خرید لحظه‌ای ارزان‌تر و مطمئن‌تر است.", weight: 2 });
  }
  if (windDays.length) {
    add({ id: "pack-windbreaker", title: "بادگیر و شال/روسری محکم", group: "clothing", reason: `در ${fa(windDays.length)} روز، باد بالای ۴۰ کیلومتر بر ساعت پیش‌بینی شده.`, weight: 2 });
  }
  if (stormDays.length) {
    add({ id: "pack-powerbank-storm", title: "چراغ‌قوهٔ کوچک یا چراغ گوشی", group: "tech", reason: "رعد و برق می‌تواند برق منطقه را قطع کند.", weight: 2 });
  }

  // ---- the vehicle
  if (input.mode === "car") {
    add({ id: "pack-car-docs", title: "کارت خودرو، بیمه‌نامه و گواهی‌نامه", group: "road", reason: "با ماشین شخصی می‌روی؛ مدارک خودرو در جاده لازم می‌شود.", weight: 3 });
    add({ id: "pack-tire", title: "بررسی زاپاس، باد لاستیک و روغن", group: "road", reason: "پیش از جاده، همین سه مورد بیشترین خرابی را کم می‌کند.", weight: 3 });
    if (snowDays.length || (minTemp !== null && minTemp <= 3)) {
      add({ id: "pack-chains", title: "زنجیر چرخ", group: "road", reason: `دمای پیش‌بینی‌شده تا ${fa(minTemp ?? 0)} درجه پایین می‌آید${snowDays.length ? " و برف هم در پیش‌بینی است" : ""}.`, weight: 3 });
    }
  }
  if (input.mode === "plane") {
    add({ id: "pack-liquid", title: "مایعات زیر ۱۰۰ میلی‌لیتر در کیف دستی", group: "tech", reason: "با هواپیما می‌روی؛ مایعات بیشتر باید تحویل بار شود.", weight: 2 });
  }
  if (input.mode === "train" || input.mode === "bus") {
    add({ id: "pack-snack", title: "خوراکی سبک و آب برای راه", group: "health", reason: "سفر زمینی چند ساعت بین دو شهر طول می‌کشد.", weight: 2 });
    add({ id: "pack-neck", title: "بالش سفری و پتو نازک", group: "clothing", reason: "برای خوابیدن در قطار یا اتوبوس شبانه.", weight: 1 });
  }

  // ---- the people
  if ((input.children ?? 0) > 0) {
    add({ id: "pack-kids-meds", title: "داروی کودک و تب‌سنج", group: "family", reason: `با ${fa(input.children ?? 0)} کودک سفر می‌کنی.`, weight: 3 });
    add({ id: "pack-kids-snack", title: "خوراکی و سرگرمی کودک برای مسیر", group: "family", reason: "مسیر طولانی بدون سرگرمی برای کودک سخت می‌شود.", weight: 2 });
    add({ id: "pack-kids-clothes", title: "یک دست لباس اضافه برای کودک", group: "family", reason: "لباس کودک در روز سفر بیش از یک بار کثیف می‌شود.", weight: 2 });
  }

  // ---- the destination's own character
  const moods = input.moods || [];
  if (moods.includes("ساحلی")) add({ id: "pack-swim", title: "لباس شنا و دمپایی", group: "clothing", reason: "مقصد ساحلی است.", weight: 2 });
  if (moods.includes("کویری")) add({ id: "pack-desert", title: "شال، کلاه لبه‌دار و لایهٔ گرم شب", group: "clothing", reason: "کویر روزِ گرم و شبِ سرد دارد.", weight: 2 });
  if (moods.includes("کوهستانی")) add({ id: "pack-hike", title: "کفش کوه و بادگیر", group: "clothing", reason: "برنامهٔ کوهستانی در این سفر هست.", weight: 2 });
  if (moods.includes("زیارتی")) add({ id: "pack-sacred", title: "لباس مناسب زیارت", group: "clothing", reason: "مقصد زیارتی است.", weight: 1 });

  // ---- fallback: no forecast at all
  if (!weather.length) {
    const season = seasonOf(input.month);
    if (season === "cold") add({ id: "pack-season-cold", title: "لباس زمستانی و لایهٔ میانی", group: "clothing", reason: "برای این تاریخ، پیش‌بینی‌ای در دسترس نیست؛ فصل سرد است.", weight: 2 });
    if (season === "hot") add({ id: "pack-season-hot", title: "لباس نازک و ضدآفتاب", group: "clothing", reason: "برای این تاریخ، پیش‌بینی‌ای در دسترس نیست؛ فصل گرم است.", weight: 2 });
    if (season === "mild") add({ id: "pack-season-mild", title: "لباس لایه‌ای بهاری/پاییزی", group: "clothing", reason: "برای این تاریخ، پیش‌بینی‌ای در دسترس نیست؛ هوا معمولاً متغیر است.", weight: 2 });
  }

  const basis =
    input.weatherMode === "forecast"
      ? `بر اساس پیش‌بینی واقعی ${fa(weather.length)} روز سفر از Open-Meteo.`
      : input.weatherMode === "normals"
        ? `این تاریخ از محدودهٔ پیش‌بینی (۱۶ روز) دورتر است؛ فهرست بر اساس میانگین واقعی همین روزها در پنج سال گذشته (${fa(weather.length)} روز) نوشته شده.`
        : "پیش‌بینی هوا برای این مقصد در دسترس نبود؛ فهرست فقط بر اساس فصل و نوع سفر نوشته شده و هیچ ادعایی دربارهٔ هوا ندارد.";

  const summary = weather.length
    ? `کمترین دما ${minTemp === null ? "نامشخص" : `${fa(minTemp)}°`} · بیشترین دما ${maxTemp === null ? "نامشخص" : `${fa(maxTemp)}°`} · ${fa(rainyDays.length)} روز با احتمال باران${snowDays.length ? ` · ${fa(snowDays.length)} روز برف` : ""}`
    : "هوای مقصد برای این تاریخ در دسترس نیست.";

  const order: PackingGroup[] = ["clothing", "health", "road", "family", "tech"];
  items.sort((a, b) => b.weight - a.weight || order.indexOf(a.group) - order.indexOf(b.group));

  return { items, basis, summary };
}

/** What goes into the shared checklist — a plain item, in the app's own shape. */
export function packingToChecklist(plan: PackingPlan, limit = 6): { id: string; title: string; group: "packing"; daysBefore: number; note: string }[] {
  return plan.items.slice(0, limit).map((item) => ({
    id: `smart-${item.id}`,
    title: item.title,
    group: "packing" as const,
    daysBefore: 1,
    note: item.reason,
  }));
}
