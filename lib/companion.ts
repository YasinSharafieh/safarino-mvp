/**
 * «همسفر سفرینو» — the little orb that talks to the traveller.
 *
 * It is a rule engine, not a chatbot: every sentence it can say is triggered by
 * a number this app already knows (the budget gauge, the road distance, the real
 * forecast, the chosen vehicle, the people on board). That is why it can react
 * instantly and for free. The model is used for exactly one thing — rewriting
 * the tip it has already picked in warmer words — and only when the traveller
 * asks for it.
 */

import { budgetGauge, type BudgetGauge, type GaugeInput } from "./budget-gauge";

export const COMPANION_EVENT = "safarino:companion";

export type CompanionContext = {
  origin?: string;
  destination?: string;
  budgetMillions: number;
  days: number;
  travellers: number;
  children?: number;
  mode?: string;
  carName?: string | null;
  transportToman?: number;
  stayToman?: number;
  departureDate?: string | null;
  todayIso?: string;
  distanceKm?: number | null;
  weather?: { code: number; minC: number | null; maxC: number | null; rainProbability: number | null }[] | null;
  cheaperAlternative?: { mode: string; priceToman: number } | null;
};

export type CompanionTone = "good" | "info" | "warn" | "alert";

export type CompanionTip = {
  id: string;
  tone: CompanionTone;
  title: string;
  body: string;
  /** Where the traveller should go to act on it. */
  action?: { label: string; href: string };
  /** Higher wins; used only for ordering. */
  weight: number;
};

const MODE_LABEL: Record<string, string> = { plane: "هواپیما", train: "قطار", bus: "اتوبوس", car: "ماشین شخصی" };

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

function money(toman: number): string {
  return `${fa(toman)} تومان`;
}

/** Whole days between today and the departure date; null when unknown. */
export function daysToDeparture(departureDate: string | null | undefined, todayIso: string): number | null {
  if (!departureDate || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) return null;
  const start = Date.parse(`${todayIso}T00:00:00Z`);
  const end = Date.parse(`${departureDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const RAIN_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82]);

/**
 * Everything the orb can say right now, most important first.
 * Nothing is said when the app does not actually know it.
 */
export function companionTips(context: CompanionContext): CompanionTip[] {
  const tips: CompanionTip[] = [];
  const gaugeInput: GaugeInput = {
    totalMillions: context.budgetMillions,
    transportToman: context.transportToman || 0,
    accommodationToman: context.stayToman || 0,
    travellers: context.travellers,
    days: context.days,
    cheaperAlternative: context.cheaperAlternative || null,
  };
  const gauge: BudgetGauge = budgetGauge(gaugeInput);

  // --- budget
  if (gauge.zone === "over") {
    tips.push({
      id: "budget-over",
      tone: "alert",
      title: "بودجه از سقف رد شد",
      body: `${gauge.verdict} ${gauge.hint}`,
      action: { label: "انتخاب اقامتگاه ارزان‌تر", href: "/accommodation" },
      weight: 100,
    });
  } else if (gauge.zone === "watch") {
    tips.push({
      id: "budget-watch",
      tone: "warn",
      title: "نزدیک سقف بودجه‌ای",
      body: `${gauge.verdict} ${gauge.hint}`,
      weight: 70,
    });
  } else if (gauge.committedToman > 0) {
    tips.push({
      id: "budget-calm",
      tone: "good",
      title: "حساب‌ها می‌خواند",
      body: `${gauge.verdict} هر نفر هر روز حدود ${money(gauge.perPersonPerDayToman)} برای خرج آزاد می‌ماند.`,
      weight: 20,
    });
  }

  // --- departure closeness
  const left = daysToDeparture(context.departureDate, context.todayIso || new Date().toISOString().slice(0, 10));
  if (left !== null && left >= 0 && left <= 3) {
    tips.push({
      id: "departure-soon",
      tone: left === 0 ? "warn" : "info",
      title: left === 0 ? "امروز حرکت است" : `${fa(left)} روز تا حرکت`,
      body:
        left === 0
          ? "کارت ملی، بلیت و آدرس اقامتگاه را یک بار چک کن؛ بقیهٔ برنامه در گوشی هست و آفلاین هم باز می‌شود."
          : "چک‌لیست سفر را یک بار مرور کن؛ کارهای آخرین روز را از قبل انجام بده تا صبح حرکت عجله نداشته باشی.",
      action: { label: "چک‌لیست سفر", href: "/itinerary" },
      weight: 55,
    });
  }

  // --- the vehicle they chose
  if (context.mode === "car") {
    const carName = context.carName ? `با ${context.carName}` : "با ماشین شخصی";
    const km = context.distanceKm && context.distanceKm > 0 ? `مسیر حدود ${fa(context.distanceKm)} کیلومتر است` : "مسیر را در مرحلهٔ قبل اندازه گرفتیم";
    tips.push({
      id: "mode-car",
      tone: "info",
      title: `${carName} می‌روی`,
      body: `${km}. پیش از حرکت باد لاستیک، زاپاس و روغن را چک کن؛ هزینهٔ جاده در همین مسیر برایت حساب شده است.`,
      action: { label: "هزینهٔ ماشین را ببین", href: "/transport" },
      weight: 45,
    });
  }
  if (context.mode === "train") {
    tips.push({
      id: "mode-train",
      tone: "info",
      title: "با قطار می‌روی",
      body: "بلیت قطار معمولاً چند روز قبل از حرکت باز می‌شود و صندلی‌ها زود پر می‌شوند؛ رزرو را عقب نینداز.",
      action: { label: "بلیت‌ها را ببین", href: "/transport" },
      weight: 40,
    });
  }

  // --- the weather that is really in the forecast
  const weather = (context.weather || []).filter((day) => Number.isFinite(day.code));
  if (weather.length) {
    const snow = weather.filter((day) => SNOW_CODES.has(day.code)).length;
    const rain = weather.filter((day) => RAIN_CODES.has(day.code) || (day.rainProbability ?? 0) >= 40).length;
    const cold = weather.filter((day) => typeof day.minC === "number" && (day.minC as number) <= 2).length;
    const hot = weather.filter((day) => typeof day.maxC === "number" && (day.maxC as number) >= 35).length;
    if (snow) {
      tips.push({
        id: "weather-snow",
        tone: "warn",
        title: "برف در پیش‌بینی است",
        body: `${fa(snow)} روز از سفر برف دارد.${context.mode === "car" ? " برای جاده زنجیر چرخ و لاستیک مناسب لازم می‌شود." : " لباس گرم و کفش ضدآب بردار."}`,
        weight: 80,
      });
    }
    if (rain) {
      tips.push({
        id: "weather-rain",
        tone: "info",
        title: `${fa(rain)} روز با احتمال باران`,
        body: "چتر و بارانی سبک بردار؛ برای همان روزها جاذبهٔ سرپوشیده (موزه و بازار) را جلوتر بگذار.",
        weight: 50,
      });
    }
    if (cold) {
      tips.push({ id: "weather-cold", tone: "info", title: "شب‌های سرد", body: `${fa(cold)} روز کمترین دما زیر ۲ درجه است؛ یک لایهٔ گرم اضافه بردار.`, weight: 35 });
    }
    if (hot) {
      tips.push({ id: "weather-hot", tone: "info", title: "گرمای شدید", body: `${fa(hot)} روز بیشینهٔ دما بالای ۳۵ درجه است؛ بازدیدها را صبح یا غروب بگذار.`, weight: 35 });
    }
    if (context.mode === "car" && cold) {
      tips.push({ id: "weather-car-cold", tone: "warn", title: "جادهٔ سرد با ماشین", body: "با دمای نزدیک صفر، لاستیک و برف‌پاک‌کن را چک کن و در مسیرهای کوهستانی زنجیر چرخ همراه داشته باش.", weight: 60 });
    }
  }

  // --- the people
  if ((context.children ?? 0) > 0) {
    tips.push({
      id: "with-children",
      tone: "info",
      title: `با ${fa(context.children ?? 0)} کودک`,
      body: "در هر روز دو برنامهٔ اصلی کافی است؛ بین دو بازدید یک استراحت بگذار تا بچه‌ها خسته نشوند.",
      action: { label: "برنامهٔ روزها", href: "/plan" },
      weight: 42,
    });
  }

  // --- nothing known yet
  if (!tips.length) {
    tips.push({
      id: "start",
      tone: "info",
      title: "از کجا شروع کنیم؟",
      body: context.destination
        ? `مقصد را ${context.destination} انتخاب کردی. وسیلهٔ سفر و اقامتگاه را با هم بچینیم؛ بعد بودجه و برنامهٔ روزها را می‌سازم.`
        : "مبدأ، مقصد و بودجه را بگو — می‌توانی حرف بزنی یا فرم را پر کنی — بعد همهٔ سفر را با هم می‌چینیم.",
      action: { label: "شروع برنامه‌ریزی", href: "/start" },
      weight: 10,
    });
  }

  const seen = new Set<string>();
  return tips
    .sort((a, b) => b.weight - a.weight)
    .filter((tip) => (seen.has(tip.id) ? false : (seen.add(tip.id), true)))
    .slice(0, 5);
}

/** The gauge the orb shows inside its panel. */
export function companionGauge(context: CompanionContext): BudgetGauge {
  return budgetGauge({
    totalMillions: context.budgetMillions,
    transportToman: context.transportToman || 0,
    accommodationToman: context.stayToman || 0,
    travellers: context.travellers,
    days: context.days,
    city: context.destination || "",
    cheaperAlternative: context.cheaperAlternative || null,
  });
}

/**
 * A trip line the model may rewrite. It contains only facts taken from the tip
 * it was built from — the model is not asked to add anything, just to say it in
 * a friendlier voice.
 */
export function companionPrompt(tip: CompanionTip, context: CompanionContext): string {
  const route = context.origin && context.destination ? `${context.origin} → ${context.destination}` : context.destination || "سفر";
  return `تو «همسفر سفرینو» هستی؛ یک همراه کوتاه‌گو و مهربان که هیچ واقعیت تازه‌ای نمی‌سازد.
مسیر: ${route} | ${fa(context.travellers)} نفر | ${fa(context.days)} روز${context.mode ? ` | وسیله: ${MODE_LABEL[context.mode] || context.mode}` : ""}
پیامی که باید بازنویسی کنی (همین اطلاعات، بدون اضافه کردن چیزی):
عنوان: ${tip.title}
متن: ${tip.body}

فقط دو جملهٔ فارسی (حداکثر ۴۵ کلمه) بنویس؛ صمیمی، بدون ایموجی، بدون اختراع قیمت یا ساعت کاری یا نام مکان. اگر عددی در متن بالا هست، می‌توانی همان را تکرار کنی.`;
}
