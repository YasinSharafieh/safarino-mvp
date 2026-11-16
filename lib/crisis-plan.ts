/**
 * «حالت بحران» — Plan B for a day, built from the real forecast and the real
 * places the traveller already has.
 *
 * If a day is going to be rainy, very cold, very hot or windy, the outdoor stops
 * of that day are swapped for indoor places of the same city that really exist in
 * the app's own list. Nothing new is invented, no price is mentioned, and the
 * original times are kept so the rest of the day still works.
 */

export type CrisisStop = {
  time: string;
  title: string;
  /** The plan's own item type ("sightseeing", "food", "transport", …). */
  type: string;
  /** The place's category, when the stop is a place. */
  category?: string | null;
};

export type CrisisPlace = {
  id: string;
  name: string;
  category: string;
  /** Kilometres from the stay, when known. */
  km?: number | null;
};

export type CrisisWeather = {
  code: number;
  label: string;
  rainProbability: number | null;
  minC: number | null;
  maxC: number | null;
  windKmh: number | null;
};

export type CrisisPlan = {
  needed: boolean;
  /** Why plan B is being offered — always a real forecast number. */
  reason: string;
  /** The swapped stops, in the same order as the day. */
  stops: { time: string; title: string; replaced: string | null }[];
  /** Places that could not be replaced, said plainly. */
  unresolved: string[];
  note: string;
};

/** Categories that rain, cold or wind really ruins. */
const OUTDOOR = /(پارک|طبیعت|باغ|کوه|دره|آبشار|ساحل|کویر|میدان|پل|بازار|خیابان|تپه|جنگل|دشت|جزیره|بندر)/;
/** Categories that stay usable in bad weather. */
const INDOOR = /(موزه|گالری|کاخ|خانه|مسجد|زیارتگاه|امامزاده|حمام|بازار|سرا|کاروانسرا|فروشگاه|کافه|رستوران)/;

export function crisisNeeded(weather: CrisisWeather | null): { needed: boolean; reason: string } {
  if (!weather) {
    return { needed: false, reason: "پیش‌بینی هوایی برای این روز در دسترس نیست؛ برنامهٔ جایگزین هم بر پایهٔ آن ساخته نمی‌شود." };
  }
  const rainy = (weather.rainProbability ?? 0) >= 60 || [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weather.code);
  const snowy = [71, 73, 75, 77, 85, 86].includes(weather.code);
  const cold = typeof weather.minC === "number" && weather.minC <= 0;
  const hot = typeof weather.maxC === "number" && weather.maxC >= 38;
  const windy = (weather.windKmh ?? 0) >= 45;

  if (snowy) return { needed: true, reason: `در این روز برف پیش‌بینی شده (${weather.label}).` };
  if (rainy) return { needed: true, reason: `در این روز ${weather.label} و احتمال بارش بالاست.` };
  if (cold) return { needed: true, reason: `کمینهٔ دما ${new Intl.NumberFormat("fa-IR").format(Math.round(weather.minC as number))} درجه است.` };
  if (hot) return { needed: true, reason: `بیشینهٔ دما ${new Intl.NumberFormat("fa-IR").format(Math.round(weather.maxC as number))} درجه است؛ ظهر بیرون ماندن سخت است.` };
  if (windy) return { needed: true, reason: "باد شدید پیش‌بینی شده و بازدیدهای روباز سخت می‌شود." };
  return { needed: false, reason: `هوای این روز (${weather.label}) مانعی برای برنامهٔ بیرونی نیست.` };
}

/**
 * Builds Plan B for one day. Outdoor stops are replaced, one by one, with real
 * indoor places that are not already in the day; the original time is kept.
 */
export function buildCrisisPlan(input: {
  dayTitle?: string;
  stops: CrisisStop[];
  places: CrisisPlace[];
  weather: CrisisWeather | null;
  transportStop?: boolean;
}): CrisisPlan {
  const verdict = crisisNeeded(input.weather);
  if (!verdict.needed) {
    return { needed: false, reason: verdict.reason, stops: [], unresolved: [], note: "" };
  }

  const usedNames = new Set(input.stops.map((stop) => stop.title));
  const indoor = input.places
    .filter((place) => INDOOR.test(`${place.category} ${place.name}`))
    .filter((place) => !usedNames.has(place.name))
    .sort((a, b) => (a.km ?? 99) - (b.km ?? 99));

  const swapped: { time: string; title: string; replaced: string | null }[] = [];
  const unresolved: string[] = [];
  let cursor = 0;

  for (const stop of input.stops) {
    const isPlace = stop.type === "sightseeing";
    const outdoor = isPlace && OUTDOOR.test(`${stop.category || ""} ${stop.title}`);
    if (!isPlace || !outdoor) {
      swapped.push({ time: stop.time, title: stop.title, replaced: null });
      continue;
    }
    const replacement = indoor[cursor];
    if (!replacement) {
      unresolved.push(stop.title);
      swapped.push({ time: stop.time, title: `${stop.title} (اگر بارش شدید نبود، همان‌جا بمان)`, replaced: null });
      continue;
    }
    cursor += 1;
    usedNames.add(replacement.name);
    swapped.push({ time: stop.time, title: replacement.name, replaced: stop.title });
  }

  const note =
    cursor > 0
      ? `${new Intl.NumberFormat("fa-IR").format(cursor)} برنامهٔ بیرونی با مکان سرپوشیدهٔ همان شهر عوض شد؛ ساعت‌ها همان ساعت‌های قبلی است، پس ناهار و بقیهٔ روز به‌هم نمی‌خورد. هزینهٔ بلیت ورودی در برنامهٔ اصلی هم نبود، در اینجا هم چیزی اضافه نمی‌شود.`
      : "مکان سرپوشیدهٔ تأییدشده‌ای برای این شهر در فهرست نبود که جای برنامهٔ بیرونی را بگیرد؛ پیشنهاد می‌کنم همان روز را استراحت بگذاری یا با رستوران/کافهٔ نزدیک اقامتگاه جابه‌جا کنی.";

  return { needed: true, reason: verdict.reason, stops: swapped, unresolved, note };
}
