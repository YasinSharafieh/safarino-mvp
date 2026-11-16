/**
 * «از همسفر بپرس» — a question in the traveller's own words, answered from the
 * trip's own numbers.
 *
 * Two layers, as everywhere else in this project:
 *   1. `answerLocally` answers instantly, for free, from numbers the page already
 *      has — and it is the answer whenever the model is unavailable.
 *   2. the model may rewrite that answer more warmly, but `keepOnlyRealNumbers`
 *      throws the whole answer away if it contains a number the trip does not
 *      contain. A price the app never read can therefore never be spoken.
 */

export type AskFacts = {
  origin: string;
  destination: string;
  days: number;
  travellers: number;
  children: number;
  budgetToman: number;
  transportToman: number;
  transportLabel: string;
  stayToman: number;
  stayName: string;
  foodToman: number;
  remainingToman: number;
  departureDate: string | null;
  /** Real place names the traveller can actually see on the plan page. */
  placeNames: string[];
  weather: { label: string; minC: number | null; maxC: number | null; rainProbability: number | null }[];
  archetypeName?: string;
  /** What we really know about the destination — used for questions about the city itself. */
  destinationProfile?: {
    tagline: string;
    highlights: string[];
    bestFor: string[];
    bestSeason: string;
    province?: string;
  } | null;
};

/** Which of the two brains a question needs. */
export type AskTopic = "trip" | "destination";

const DESTINATION_PATTERNS = [
  /(مردم|فرهنگ|رسم|آداب|سنت|زبان|لهجه)/,
  /(غذای محلی|غذاشناسی|چی بخورم|بخورم|غذا|کجا غذا|رستوران|کافه|صبحانه|شیرینی|سوغات)/,
  /(تاریخ|تاریخی|دوره|سلسله|بنای|اثر باستانی|موزه)/,
  /(طبیعت|کوه|جنگل|دریا|ساحل|کویر|آبشار|دریاچه)/,
  /(بخرم|خرید|بازار|صنایع دستی|فرش)/,
  /(جاهای دیدنی|جاذبه|دیدنی|کجا برم|چی ببینم)/,
  /(آب و هوا|اقلیم|بهترین فصل|چه فصلی)/,
  /(دربارهٔ|درباره|اهل|مردمش)/,
];

/** Trip questions are about *my numbers*; destination questions are about *the place*. */
export function questionTopic(question: string): AskTopic {
  const text = (question || "").replace(/[يى]/g, "ی").replace(/ك/g, "ک");
  const budgetish = /(بودجه|پول|خرج|هزینه|باقی‌مانده|باقی مانده|چقدر)/.test(text);
  const tripish = /(اقامت|هتل|اتاق|بلیت|قطار|هواپیما|اتوبوس|ماشین|برنامهٔ من|برنامه من|سفرم|روزهام|روزها)/.test(text);
  if (budgetish && !/(جاهای دیدنی|جاذبه|دیدنی)/.test(text)) return "trip";
  if (tripish) return "trip";
  if (DESTINATION_PATTERNS.some((pattern) => pattern.test(text))) return "destination";
  return "trip";
}

/** What the companion says about the city from data we already hold — never invented. */
export function answerAboutDestination(question: string, facts: AskFacts): string | null {
  const profile = facts.destinationProfile;
  if (!profile) return null;
  const text = (question || "").replace(/[يى]/g, "ی").replace(/ك/g, "ک");
  const head = `${facts.destination}${profile.province ? ` (${profile.province})` : ""}: ${profile.tagline}`;
  if (/(غذا|بخورم|رستوران|کافه|شیرینی|سوغات)/.test(text)) {
    return `${head}. برای خوردن، سراغ خوراک محلی و بازار همان شهر برو؛ قیمت‌ها را همان‌جا ببین، چون من قیمت به‌روز رستوران‌ها را ندارم و از خودم نمی‌سازم.`;
  }
  if (/(طبیعت|کوه|جنگل|دریا|ساحل|کویر|آبشار|دریاچه)/.test(text)) {
    return `${head}. نزدیک‌ترین طبیعت‌های شناخته‌شدهٔ این مقصد: ${profile.highlights.slice(0, 3).join("، ")}.`;
  }
  if (/(فصل|آب و هوا|اقلیم|کی برم)/.test(text)) {
    return `${head}. بهترین فصل سفر به ${facts.destination}: ${profile.bestSeason}. برای دمای دقیق روزهای سفرت، پیش‌بینی واقعی بالای همین صفحه را ببین.`;
  }
  return `${head}. چیزهایی که این مقصد برایشان شناخته می‌شود: ${profile.highlights.slice(0, 3).join("، ")}${
    profile.bestFor.length ? `؛ مناسب برای ${profile.bestFor.slice(0, 3).join("، ")}` : ""
  }. اگر بخواهی، برنامه‌ات را هم با همین‌ها تنظیم می‌کنم.`;
}

export const ASK_EXAMPLES = [
  "با این بودجه بیشتر کجا رو ببینم؟",
  "هوای مقصد چطوره؟",
  "چقدر پول برای غذا کنار گذاشته شده؟",
  "اقامتگاهم رو عوض کنم بهتره؟",
  "برای بچه‌ها برنامه سبک‌تر بشه؟",
];

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
const money = (value: number) => `${fa(value)} تومان`;

/** Short, plain sentences built only from `facts`. */
export function answerLocally(question: string, facts: AskFacts): string {
  const text = (question || "").replace(/[يى]/g, "ی").replace(/ك/g, "ک");
  const has = (pattern: RegExp) => pattern.test(text);

  if (has(/(بودجه|پول|خرج|هزینه|چقدر)/)) {
    const parts = [
      `بودجهٔ کل ${money(facts.budgetToman)} است`,
      facts.transportToman > 0 ? `بلیت ${facts.transportLabel} ${money(facts.transportToman)} شد` : "هنوز بلیتی انتخاب نکردی",
      facts.stayToman > 0 ? `اقامت ${facts.stayName} ${money(facts.stayToman)} است` : "اقامتگاه هنوز انتخاب نشده",
      `برای غذا ${money(facts.foodToman)} کنار گذاشته شده`,
      facts.remainingToman >= 0 ? `و ${money(facts.remainingToman)} برای خرج آزاد می‌ماند` : `${money(Math.abs(facts.remainingToman))} از بودجه بیشتر شده`,
    ];
    return `${parts.join("، ")}.`;
  }

  if (has(/(هوا|باران|بارون|برف|دما|سرما|گرما)/)) {
    if (!facts.weather.length) {
      return `هوای ${facts.destination} برای این تاریخ در دسترس من نیست؛ نمی‌خواهم حدس بزنم. پیش‌بینی رسمی را پیش از حرکت ببین.`;
    }
    const rainy = facts.weather.filter((day) => (day.rainProbability ?? 0) >= 40).length;
    const min = facts.weather.map((day) => day.minC).filter((value): value is number => typeof value === "number");
    const max = facts.weather.map((day) => day.maxC).filter((value): value is number => typeof value === "number");
    return `برای ${facts.destination} در این ${fa(facts.weather.length)} روز: ${facts.weather[0].label}، کمینه ${
      min.length ? `${fa(Math.min(...min))} درجه` : "نامشخص"
    } و بیشینه ${max.length ? `${fa(Math.max(...max))} درجه` : "نامشخص"}${
      rainy ? ` و ${fa(rainy)} روز احتمال باران بالای ۴۰٪ است` : " و باران قابل‌توجهی پیش‌بینی نشده"
    }.`;
  }

  if (has(/(کجا|جاذبه|ببینم|گشت|برنامه|چی ببینم)/)) {
    if (!facts.placeNames.length) {
      return (
        answerAboutDestination(question, facts) ||
        `برای ${facts.destination} هنوز جاذبهٔ تأییدشده‌ای در فهرست تو نیست؛ در صفحهٔ برنامه، فهرست جاذبه‌ها را باز کن.`
      );
    }
    return `از جاذبه‌های تأییدشدهٔ ${facts.destination} این‌ها در دسترس تو هستند: ${facts.placeNames.slice(0, 5).join("، ")}${
      facts.placeNames.length > 5 ? " و چند مورد دیگر" : ""
    }. برای ${fa(facts.days)} روز، روزی دو تا سه مورد کافی است.`;
  }

  if (has(/(اقامت|هتل|خواب|اتاق|جای خواب)/)) {
    if (!facts.stayToman) return "اقامتگاهت را هنوز انتخاب نکرده‌ای؛ در صفحهٔ اقامتگاه فهرست واقعی و بودجهٔ باقی‌مانده را می‌بینی.";
    const perNight = facts.stayToman / Math.max(1, facts.days - 1);
    return `اقامتگاه فعلی‌ات ${facts.stayName} است با ${money(facts.stayToman)} برای کل اقامت (حدود ${money(perNight)} هر شب). ${
      facts.remainingToman < 0 ? "چون از بودجه رد شده‌ای، یک گزینهٔ ارزان‌تر انتخاب بهتری است." : "داخل بودجه‌ای، پس اگر جابه‌جا کردنش سخت است لازم نیست عوضش کنی."
    }`;
  }

  if (has(/(بچه|کودک|خانواده|خسته)/)) {
    if (!facts.children) return "در این سفر کودک همراهت نیست؛ می‌توانی روزها را پرمسیرتر بچینی.";
    return `با ${fa(facts.children)} کودک، روزی دو برنامهٔ اصلی بیشتر نگذار و بین دو بازدید یک استراحت کوتاه بگذار. تعداد روزها ${fa(facts.days)} و نفرات ${fa(facts.travellers)} است، پس یک برنامهٔ سبک‌تر در روز آخر بگذار.`;
  }

  if (has(/(قطار|هواپیما|اتوبوس|ماشین|بلیت|وسیله|سفر)/)) {
    if (!facts.transportToman) return "هنوز وسیلهٔ سفر انتخاب نشده؛ هر چهار حالت (هواپیما، قطار، اتوبوس، ماشین شخصی) با قیمت واقعی در صفحهٔ حمل‌ونقل هست.";
    return `وسیلهٔ انتخابی‌ات ${facts.transportLabel} است با ${money(facts.transportToman)}. ${
      facts.remainingToman >= 0
        ? `بعد از آن ${money(facts.remainingToman)} برای بقیهٔ سفر می‌ماند.`
        : "این انتخاب بودجه را رد کرده؛ گزینهٔ ارزان‌تر همان مسیر را ببین."
    }`;
  }

  if (has(/(کی|چه تاریخ|چه زمانی|چند روز)/)) {
    return `سفر تو ${fa(facts.days)} روز است${facts.departureDate ? ` و تاریخ حرکت ${facts.departureDate} است` : ""}. ${
      facts.travellers ? `برای ${fa(facts.travellers)} نفر برنامه ریخته‌ایم.` : ""
    }`;
  }

  // A question about the place itself, not about the money.
  const aboutPlace = answerAboutDestination(question, facts);
  if (aboutPlace) return aboutPlace;

  return `این‌ها را از سفر خودت می‌دانم: مقصد ${facts.destination}، ${fa(facts.days)} روز، ${fa(facts.travellers)} نفر، بودجهٔ ${money(
    facts.budgetToman,
  )}${facts.remainingToman >= 0 ? ` و ${money(facts.remainingToman)} باقی‌مانده` : ""}. هر سؤالی از همین‌ها داری بپرس؛ اگر چیزی را ندانم، حدس نمی‌زنم.`;
}

/**
 * The model's answer is accepted only if every number in it already exists in
 * the facts. This is the guard that stops an invented price or hour from ever
 * reaching the screen.
 */
export function keepOnlyRealNumbers(answer: string, facts: AskFacts): string | null {
  const clean = (answer || "").replace(/\s+/g, " ").trim();
  if (clean.length < 12) return null;
  if (/(ساعت کاری|بسته است|باز است از|شماره تلفن|آدرس دقیق)/.test(clean)) return null;

  const digits = (value: string) =>
    value
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[,٬]/g, "");

  const factNumbers = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      factNumbers.add(String(Math.round(value)));
      // money is often said in millions or thousands
      factNumbers.add(String(Math.round(value / 1_000)));
      factNumbers.add(String(Math.round(value / 1_000_000)));
    }
  };
  collect(facts.budgetToman);
  collect(facts.transportToman);
  collect(facts.stayToman);
  collect(facts.foodToman);
  collect(facts.remainingToman);
  collect(facts.days);
  collect(facts.travellers);
  collect(facts.children);
  for (const day of facts.weather) {
    collect(day.minC);
    collect(day.maxC);
    collect(day.rainProbability);
  }

  const mentioned = digits(clean).match(/\d{1,12}/g) || [];
  for (const number of mentioned) {
    if (factNumbers.has(number)) continue;
    // «۲ روز» یا «۴۰٪» هم باید در داده باشد
    return null;
  }
  return clean.slice(0, 600);
}

export function askPrompt(question: string, facts: AskFacts): string {
  const topic = questionTopic(question);
  const destinationBlock = facts.destinationProfile
    ? `دربارهٔ ${facts.destination} (دادهٔ ثبت‌شدهٔ خودمان): ${facts.destinationProfile.tagline} | دیدنی‌ها: ${facts.destinationProfile.highlights.join("، ")} | مناسب برای: ${facts.destinationProfile.bestFor.join("، ")} | بهترین فصل: ${facts.destinationProfile.bestSeason}`
    : `دربارهٔ ${facts.destination} دادهٔ ثبت‌شده‌ای نداریم.`;

  const rules =
    topic === "destination"
      ? `سؤال مسافر دربارهٔ خودِ مقصد است. با دانش عمومی و شناخته‌شدهٔ ایرانی دربارهٔ ${facts.destination} جواب بده (فرهنگ، غذا، دیدنی‌ها، آداب، فصل سفر، سوغات). هیچ قیمت، نرخ، ساعت کاری یا شماره تلفنی نگو و هیچ عدد تازه‌ای نساز. اگر مطمئن نیستی، صریح بگو که مطمئن نیستی.`
      : `سؤال مسافر دربارهٔ حساب‌وکتاب سفرش است. فقط از اعداد و واقعیت‌های بالا استفاده کن؛ هیچ عدد تازه‌ای (قیمت، درصد، ساعت) نساز. اگر جواب در داده نیست، صریح بگو که نمی‌دانی و حدس نمی‌زنی.`;

  return `سفر مسافر:
مقصد: ${facts.destination} | مبدأ: ${facts.origin} | ${facts.days} روز | ${facts.travellers} نفر${facts.children ? ` (${facts.children} کودک)` : ""}
بودجهٔ کل: ${facts.budgetToman} تومان
بلیت: ${facts.transportLabel} — ${facts.transportToman} تومان
اقامت: ${facts.stayName} — ${facts.stayToman} تومان
پول غذای کنارگذاشته: ${facts.foodToman} تومان
باقی‌مانده: ${facts.remainingToman} تومان
تاریخ حرکت: ${facts.departureDate || "نامشخص"}
جاذبه‌های تأییدشده: ${facts.placeNames.slice(0, 10).join("، ") || "ثبت نشده"}
هوا (پیش‌بینی واقعی): ${facts.weather.map((day) => `${day.label} ${day.minC ?? "?"}/${day.maxC ?? "?"}`).join(" | ") || "در دسترس نیست"}
${destinationBlock}

سؤال مسافر: «${question}»

در حداکثر سه جملهٔ فارسی و صمیمی جواب بده. ${rules}
فرمت: {"answer":"..."}`;
}
