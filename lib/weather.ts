/**
 * Weather for the trip, from Open-Meteo (free, no key, no tracking).
 *
 * Two honest modes, never mixed:
 *  - "forecast": the real 16-day forecast, when the trip is close enough;
 *  - "normals":  the average of the same dates in the last five years, shown
 *               clearly as a long-term average and never as a forecast.
 *
 * Every day also carries plain advice (sun cream, umbrella, move the walking
 * to the morning) and a score used to put outdoor days on the clearest dates.
 */

import { getProviderCache, setProviderCache } from "./provider-cache";

export type WeatherMode = "forecast" | "normals";

export type WeatherDay = {
  /** ISO date, YYYY-MM-DD */
  date: string;
  code: number;
  label: string;
  icon: string;
  maxC: number | null;
  minC: number | null;
  rainProbability: number | null;
  rainMm: number | null;
  windKmh: number | null;
  /** 0–100: how good this day is for being outside. */
  score: number;
  /** One practical sentence in Persian. */
  advice: string;
  tone: "good" | "ok" | "warn" | "bad";
};

export type WeatherResult = {
  mode: WeatherMode;
  days: WeatherDay[];
  note: string;
  sources: string;
};

const CACHE_BASE = "safarino:weather:v1";
const TIMEZONE = "Asia/Tehran";

/** WMO weather codes, in plain Persian, with a symbol a traveller reads instantly. */
const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: "آسمان صاف", icon: "☀️" },
  1: { label: "اغلب صاف", icon: "🌤️" },
  2: { label: "کمی ابری", icon: "⛅" },
  3: { label: "ابری", icon: "☁️" },
  45: { label: "مه", icon: "🌫️" },
  48: { label: "مه یخ‌زده", icon: "🌫️" },
  51: { label: "نم‌نم باران سبک", icon: "🌦️" },
  53: { label: "نم‌نم باران", icon: "🌦️" },
  55: { label: "نم‌نم باران شدید", icon: "🌧️" },
  56: { label: "نم‌نم یخ‌زده", icon: "🌧️" },
  57: { label: "نم‌نم یخ‌زده شدید", icon: "🌧️" },
  61: { label: "باران سبک", icon: "🌦️" },
  63: { label: "باران", icon: "🌧️" },
  65: { label: "باران شدید", icon: "🌧️" },
  66: { label: "باران یخ‌زده", icon: "🌧️" },
  67: { label: "باران یخ‌زده شدید", icon: "🌧️" },
  71: { label: "برف سبک", icon: "🌨️" },
  73: { label: "برف", icon: "🌨️" },
  75: { label: "برف سنگین", icon: "❄️" },
  77: { label: "دانه‌های برف", icon: "🌨️" },
  80: { label: "رگبار سبک", icon: "🌦️" },
  81: { label: "رگبار", icon: "🌧️" },
  82: { label: "رگبار شدید", icon: "⛈️" },
  85: { label: "رگبار برف", icon: "🌨️" },
  86: { label: "رگبار برف سنگین", icon: "❄️" },
  95: { label: "رعد و برق", icon: "⛈️" },
  96: { label: "رعد و برق با تگرگ", icon: "⛈️" },
  99: { label: "رعد و برق شدید با تگرگ", icon: "⛈️" },
};

export function weatherLabel(code: number): { label: string; icon: string } {
  return WMO[code] || { label: "وضعیت نامعلوم", icon: "🌡️" };
}

function isRainy(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

function isSnowy(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86 || code === 56 || code === 57 || code === 66 || code === 67;
}

/**
 * How good a day is for sightseeing, 0–100. Rain and extremes cost the most;
 * a mild, dry, lightly-clouded day is best.
 */
export function dayScore(input: { code: number; maxC: number | null; minC: number | null; rainProbability: number | null; windKmh: number | null }): number {
  let score = 100;
  if (isRainy(input.code)) score -= 55;
  if (isSnowy(input.code)) score -= 35;
  if (input.code === 45 || input.code === 48) score -= 15;
  if (input.code === 3) score -= 5;
  const rain = input.rainProbability;
  if (typeof rain === "number") score -= Math.min(30, rain * 0.3);
  const max = input.maxC;
  if (typeof max === "number") {
    if (max >= 40) score -= 40;
    else if (max >= 35) score -= 25;
    else if (max >= 32) score -= 12;
    else if (max <= 0) score -= 25;
    else if (max <= 8) score -= 10;
  }
  const wind = input.windKmh;
  if (typeof wind === "number" && wind >= 45) score -= 15;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** One useful sentence, not a paragraph. */
export function weatherAdvice(input: { code: number; maxC: number | null; minC: number | null; rainProbability: number | null; windKmh: number | null }): { advice: string; tone: WeatherDay["tone"] } {
  if (isSnowy(input.code)) return { advice: "برف و سرما؛ بازدیدهای بیرونی را کوتاه کنید و لباس گرم و کفش ضدآب ببرید.", tone: "bad" };
  if (input.code >= 95) return { advice: "رعد و برق؛ بازدیدهای بیرونی را به ساعتی دیگر موکول کنید و پناهگاه سرپوشیده انتخاب کنید.", tone: "bad" };
  if (isRainy(input.code) || (typeof input.rainProbability === "number" && input.rainProbability >= 60)) {
    return { advice: "احتمال باران؛ چتر ببرید و موزه و مکان‌های سرپوشیده را در این روز بگذارید.", tone: "warn" };
  }
  const max = input.maxC;
  if (typeof max === "number" && max >= 38) return { advice: "گرمای شدید؛ بازدیدها را صبح زود یا بعد از غروب بگذارید و آب زیاد همراه داشته باشید.", tone: "warn" };
  if (typeof max === "number" && max >= 33) return { advice: "هوای گرم؛ ساعت‌های میانی روز را برای استراحت و ناهار نگه دارید.", tone: "ok" };
  if (typeof max === "number" && max <= 2) return { advice: "هوای سرد؛ لباس گرم و نوشیدنی گرم همراه ببرید.", tone: "warn" };
  if (typeof input.windKmh === "number" && input.windKmh >= 45) return { advice: "باد شدید؛ برای کویر و ارتفاعات و مسیرهای باز احتیاط کنید.", tone: "ok" };
  if (input.code === 0 || input.code === 1) return { advice: "هوای خوب برای گشت‌زنی بیرونی؛ روز مناسبی برای جاذبه‌های فضای باز است.", tone: "good" };
  return { advice: "هوای متعادل؛ برنامهٔ معمول روز را می‌توانید اجرا کنید.", tone: "ok" };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return isoDate(parsed);
}

function todayIso(): string {
  const now = new Date();
  // Tehran is UTC+3:30 all year since 2022 (no daylight saving).
  const tehran = new Date(now.getTime() + 3.5 * 3_600_000);
  return isoDate(tehran);
}

type OpenMeteoDaily = {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    precipitation_sum?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
  };
};

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
}

async function getJson<T>(url: string, timeoutMs = 12_000): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Safarino/1.0 (travel planner)" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function buildDay(date: string, raw: { code: number; maxC: number | null; minC: number | null; rainProbability: number | null; rainMm: number | null; windKmh: number | null }): WeatherDay {
  const { label, icon } = weatherLabel(raw.code);
  const score = dayScore(raw);
  const { advice, tone } = weatherAdvice(raw);
  return {
    date,
    code: raw.code,
    label,
    icon,
    maxC: raw.maxC,
    minC: raw.minC,
    rainProbability: raw.rainProbability,
    rainMm: raw.rainMm,
    windKmh: raw.windKmh,
    score,
    advice,
    tone,
  };
}

/**
 * Weather for each day of the trip, starting at `startDate`.
 * Uses the real forecast when the dates are inside the forecast window,
 * otherwise the average of the same dates over the last five years.
 */
export async function tripWeather(input: {
  latitude: number;
  longitude: number;
  startDate?: string | null;
  days: number;
}): Promise<WeatherResult & { startDate: string }> {
  const days = Math.max(1, Math.min(14, Math.round(input.days) || 3));
  const validPoint = Number.isFinite(input.latitude) && Number.isFinite(input.longitude) && !(input.latitude === 0 && input.longitude === 0);
  const startDate = input.startDate && /^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ? input.startDate : todayIso();

  if (!validPoint) {
    return {
      mode: "forecast",
      days: [],
      note: "برای نمایش آب‌وهوا، اول مقصد یا اقامتگاه باید مختصات معتبر داشته باشد.",
      sources: "Open-Meteo",
      startDate,
    };
  }

  const today = todayIso();
  const forecastWindowEnd = addDays(today, 15);
  const end = addDays(startDate, days - 1);
  const withinForecast = startDate >= today && end <= forecastWindowEnd;
  const mode: WeatherMode = withinForecast ? "forecast" : "normals";

  const cacheKey = `${CACHE_BASE}:${mode}:${input.latitude.toFixed(2)},${input.longitude.toFixed(2)}:${startDate}:${days}`;
  const cached = await getProviderCache<WeatherResult & { startDate: string }>(cacheKey);
  if (cached && Array.isArray(cached.days) && cached.days.length) return cached;

  let result: WeatherResult & { startDate: string };

  if (mode === "forecast") {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${input.latitude.toFixed(4)}&longitude=${input.longitude.toFixed(4)}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max` +
      `&timezone=${encodeURIComponent(TIMEZONE)}&start_date=${startDate}&end_date=${end}`;
    const payload = await getJson<OpenMeteoDaily>(url);
    const daily = payload?.daily;
    const daysOut: WeatherDay[] = (daily?.time || []).map((date, index) =>
      buildDay(date, {
        code: Number(daily?.weather_code?.[index]) || 0,
        maxC: toNumber(daily?.temperature_2m_max?.[index]),
        minC: toNumber(daily?.temperature_2m_min?.[index]),
        rainProbability: toNumber(daily?.precipitation_probability_max?.[index]),
        rainMm: toNumber(daily?.precipitation_sum?.[index]),
        windKmh: toNumber(daily?.wind_speed_10m_max?.[index]),
      }),
    );
    result = {
      mode,
      days: daysOut,
      note: "این اعداد پیش‌بینی واقعی هوای همان روزهاست (منبع: Open-Meteo) و ممکن است تا روز سفر کمی تغییر کند.",
      sources: "Open-Meteo",
      startDate,
    };
  } else {
    // Long-term average: the same calendar dates over the last five years.
    const perDate: WeatherDay[] = [];
    for (let index = 0; index < days; index += 1) {
      const target = addDays(startDate, index);
      const samples: { code: number; maxC: number | null; minC: number | null; rainMm: number | null; windKmh: number | null }[] = [];
      for (let yearOffset = 1; yearOffset <= 5; yearOffset += 1) {
        const year = Number(target.slice(0, 4)) - yearOffset;
        const date = `${year}${target.slice(4)}`;
        const url =
          `https://archive-api.open-meteo.com/v1/archive?latitude=${input.latitude.toFixed(4)}&longitude=${input.longitude.toFixed(4)}` +
          `&start_date=${date}&end_date=${date}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=${encodeURIComponent(TIMEZONE)}`;
        const payload = await getJson<OpenMeteoDaily>(url, 10_000);
        const daily = payload?.daily;
        if (!daily?.time?.length) continue;
        samples.push({
          code: Number(daily.weather_code?.[0]) || 0,
          maxC: toNumber(daily.temperature_2m_max?.[0]),
          minC: toNumber(daily.temperature_2m_min?.[0]),
          rainMm: toNumber(daily.precipitation_sum?.[0]),
          windKmh: toNumber(daily.wind_speed_10m_max?.[0]),
        });
      }
      if (!samples.length) continue;
      const average = (values: (number | null)[]): number | null => {
        const clean = values.filter((value): value is number => typeof value === "number");
        return clean.length ? Math.round((clean.reduce((sum, value) => sum + value, 0) / clean.length) * 10) / 10 : null;
      };
      // The most common sky is more honest than an average of codes.
      const counts = new Map<number, number>();
      samples.forEach((sample) => counts.set(sample.code, (counts.get(sample.code) || 0) + 1));
      const commonCode = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
      perDate.push(
        buildDay(target, {
          code: commonCode,
          maxC: average(samples.map((sample) => sample.maxC)),
          minC: average(samples.map((sample) => sample.minC)),
          rainProbability: null,
          rainMm: average(samples.map((sample) => sample.rainMm)),
          windKmh: average(samples.map((sample) => sample.windKmh)),
        }),
      );
    }
    result = {
      mode,
      days: perDate,
      note: "برای این تاریخ‌ها پیش‌بینی دقیق هنوز وجود ندارد؛ این اعداد میانگین همان روزها در پنج سال گذشته است، نه پیش‌بینی.",
      sources: "Open-Meteo (داده‌های تاریخی)",
      startDate,
    };
  }

  if (result.days.length) {
    // Forecast: an hour is enough. Climate averages: a day is plenty.
    await setProviderCache(cacheKey, result, mode === "forecast" ? 3_600 : 86_400);
  }
  return result;
}

/**
 * Which places are done outdoors, so a rainy date can be matched with indoor
 * visits instead of the other way round.
 */
export function outdoorWeight(category: string): number {
  const label = (category || "").toLowerCase();
  if (/(پارک|بوستان|باغ|park|garden)/.test(label)) return 1;
  if (/(پل|bridge|میدان|square|بازار|market|bazaar)/.test(label)) return 0.8;
  if (/(کوه|طبیعت|natural|دریاچه|lake|کویر|desert)/.test(label)) return 1;
  if (/(بنای|یادبود|آرامگاه|مقبره|monument|tomb)/.test(label)) return 0.6;
  if (/(مسجد|mosque|زیارتی|shrine|آستان)/.test(label)) return 0.25;
  if (/(موزه|museum|خانه|خانه‌|historic house|مدرسه|school|کاخ|palace)/.test(label)) return 0.15;
  return 0.4;
}

export type DayToMatch = { dayNumber: number; categories: string[] };

/**
 * Suggests which plan day should fall on which date: the most outdoor day goes
 * on the clearest date. Returns the suggested order of day numbers and a short
 * reason, so the traveller decides — nothing is changed behind their back.
 */
export function suggestDayOrder(days: DayToMatch[], weather: WeatherDay[]): { order: number[]; reason: string; changed: boolean } {
  if (!days.length || days.length !== weather.length) {
    return { order: days.map((day) => day.dayNumber), reason: "", changed: false };
  }
  const outdoorOf = (day: DayToMatch) =>
    day.categories.length ? day.categories.reduce((sum, category) => sum + outdoorWeight(category), 0) / day.categories.length : 0.4;

  const daysByOutdoor = [...days].sort((a, b) => outdoorOf(b) - outdoorOf(a));
  const datesByScore = [...weather].sort((a, b) => b.score - a.score);
  const order = datesByScore.map((_, index) => daysByOutdoor[index].dayNumber);

  const changed = order.some((dayNumber, index) => dayNumber !== days[index].dayNumber);
  const bestDate = weather[order.indexOf(days[0].dayNumber)]?.date || "";
  const reason = changed
    ? `پیشنهاد می‌کنیم روزهای پرگردش در فضای باز روی صاف‌ترین روزها بیفتند؛ به این ترتیب بهترین روز برای بیرون بودن «${bestDate}» است. اگر دوست ندارید، ترتیب فعلی هم درست است.`
    : "ترتیب فعلی روزها با هوای همان روزها جور است؛ پیشنهاد ویژه‌ای برای جابه‌جایی نیست.";
  return { order, reason, changed };
}
