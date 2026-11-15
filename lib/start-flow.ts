/**
 * The first step of every trip: «کجا برویم؟»
 *
 * Two doors, both Iranian:
 *  1. the traveller already knows the origin and the destination,
 *  2. or the traveller answers a few short, *changing* questions and gets
 *     city suggestions that match the kind of trip they actually want.
 *
 * Everything here is Iranian: no foreign city is ever suggested, and no
 * question is about a place outside Iran. The questions rotate (a different
 * set is drawn every time), so the quiz does not feel like a form.
 */

import { IRANIAN_CITIES, type IranianCity } from "./iran-cities";
import { DISCOVER_CITIES, type DiscoverMood } from "./discover";
import { estimatedTripCost, profileFor } from "./city-profiles";

/** Cities a traveller can start from or travel to: Iran only, unique by name. */
export function iranianTravelCities(): IranianCity[] {
  const seen = new Set<string>();
  const result: IranianCity[] = [];
  for (const city of IRANIAN_CITIES) {
    const name = (city.name || "").trim();
    // A city the ticket sellers do not list can still be searched and
    // recommended, but it must never reach the ticket form.
    if (!name || city.searchOnly || seen.has(name)) continue;
    seen.add(name);
    result.push(city);
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, "fa"));
}

/**
 * Cities people actually search for, first in the list.
 *
 * The provider directory also contains small villages; they stay available
 * (a traveller may live there) but they are not the first thing a visitor sees.
 */
export const MAJOR_TRAVEL_CITIES = [
  "تهران", "مشهد", "اصفهان", "شیراز", "تبریز", "یزد", "کرمان", "رشت",
  "کیش", "قشم", "همدان", "کرمانشاه", "اهواز", "بندرعباس", "ارومیه", "ساری",
  "بابلسر", "رامسر", "چالوس", "نوشهر", "لاهیجان", "انزلی", "زنجان", "قزوین",
  "سمنان", "بوشهر", "خرم‌آباد", "سنندج", "گرگان", "شهرکرد", "بیرجند", "زاهدان",
  "کرج", "قم", "اردبیل", "ماسوله", "سرعین", "طبس", "نطنز", "کاشان", "شوشتر",
];

/** The same complete list, but with the well-known cities first. */
export function orderedTravelCities(): IranianCity[] {
  const all = iranianTravelCities();
  const byName = new Map(all.map((city) => [city.name, city]));
  const first: IranianCity[] = [];
  for (const name of MAJOR_TRAVEL_CITIES) {
    const city = byName.get(name);
    if (city) {
      first.push(city);
      byName.delete(name);
    }
  }
  const rest = all.filter((city) => byName.has(city.name));
  return [...first, ...rest];
}

const TRAVEL_CITY_NAMES = new Set(iranianTravelCities().map((city) => city.name));

/**
 * Any real Iranian city Safarino knows — including the ones without online
 * tickets, which can still be recommended, searched and planned.
 */
/** «خرم‌آباد» and «خرم آباد» are the same city. */
const loose = (value: string) => value.replace(/\u200c/g, " ").replace(/\s+/g, " ").trim();

export function isKnownIranianCity(name: string | null | undefined): boolean {
  if (typeof name !== "string") return false;
  const wanted = loose(name);
  if (!wanted) return false;
  return IRANIAN_CITIES.some((city) => loose(city.name) === wanted);
}

export function isIranianTravelCity(name: unknown): name is string {
  return typeof name === "string" && TRAVEL_CITY_NAMES.has(name.trim());
}

/* ------------------------------------------------------------------ quiz */

/** Questions may also arrive from the model, so the key is any short slug. */
export type QuizKey = string;

export type QuizOption = {
  id: string;
  label: string;
  /** How this answer pulls the traveller's taste. */
  weights: Partial<Record<DiscoverMood, number>>;
  /** Budget/day hint in toman per person, used as a starting point only. */
  dailyToman?: number;
  days?: number;
  /** A short, friendly line under the option. */
  hint?: string;
};

export type QuizQuestion = {
  key: QuizKey;
  /** The question itself, in the traveller's own language. */
  prompt: string;
  /** A one-line framing, so the question feels like a conversation. */
  aside: string;
  options: QuizOption[];
};

/**
 * The question pool: every entry is a different *way* of asking what kind of
 * trip this is. A round draws one question per key, so two people (or the same
 * person twice) do not see the same quiz.
 */
export const QUESTION_POOL: QuizQuestion[] = [
  // ------------------------------------------------------------- pace
  {
    key: "pace",
    prompt: "صبح سفرت بیشتر شبیه کدام است؟",
    aside: "هیچ جواب درستی وجود ندارد؛ فقط بگو چه حالی داری.",
    options: [
      { id: "slow", label: "آرام صبحانه می‌خورم و بعد راه می‌افتم", weights: { طبیعت: 1, کویری: 1 }, hint: "سفر آرام" },
      { id: "early", label: "قبل از آفتاب بیدارم و شهر را می‌گیرم", weights: { تاریخی: 1, شهری: 1 }, hint: "شروع زود" },
      { id: "plan", label: "برنامهٔ دقیق ساعت‌به‌ساعت دارم", weights: { تاریخی: 1, شهری: 1 }, hint: "برنامه‌ریز" },
      { id: "free", label: "هر روز صبح تصمیم می‌گیرم کجا بروم", weights: { طبیعت: 1, ساحلی: 1 }, hint: "آزاد" },
    ],
  },
  {
    key: "pace2",
    prompt: "یک روز سفر را چطور پر می‌کنی؟",
    aside: "بین سه جاذبه یا یک جاذبه و یک کافه، کدام؟",
    options: [
      { id: "packed", label: "سه‌چهار جا در یک روز؛ خستگی هم باشد", weights: { شهری: 2, تاریخی: 1 }, hint: "پرتر" },
      { id: "balanced", label: "دو جا با وقت کافی و یک ناهار خوب", weights: { تاریخی: 1, شهری: 1, طبیعت: 1 }, hint: "متعادل" },
      { id: "one", label: "یک جا، ولی کامل و بی‌عجله", weights: { تاریخی: 1, طبیعت: 1 }, hint: "عمیق" },
      { id: "rest", label: "شاید حتی از اقامتگاه بیرون نیایم", weights: { ساحلی: 2, کوهستانی: 1 }, hint: "استراحت" },
    ],
  },
  // ------------------------------------------------------------- party
  {
    key: "party",
    prompt: "با چه کسی سفر می‌کنی؟",
    aside: "این جواب روی نوع اقامتگاه هم اثر می‌گذارد.",
    options: [
      { id: "alone", label: "تنها", weights: { شهری: 1, تاریخی: 1 }, hint: "سفر تنهایی" },
      { id: "couple", label: "دو نفره", weights: { ساحلی: 1, شهری: 1 }, hint: "سفر دو نفره" },
      { id: "family", label: "با خانواده و بچه‌ها", weights: { زیارتی: 1, ساحلی: 1 }, hint: "خانوادگی" },
      { id: "friends", label: "با دوستان", weights: { طبیعت: 1, کویری: 1 }, hint: "گروهی" },
    ],
  },
  {
    key: "party2",
    prompt: "اگر همسفرت وسط راه نظرش عوض شود چه می‌کنی؟",
    aside: "این نشان می‌دهد چقدر برنامه باید انعطاف داشته باشد.",
    options: [
      { id: "flex", label: "مسیر را عوض می‌کنیم، ماجراست", weights: { طبیعت: 2, کویری: 1 }, hint: "انعطاف" },
      { id: "negotiate", label: "با هم تصمیم می‌گیریم", weights: { شهری: 1, تاریخی: 1 }, hint: "مشورتی" },
      { id: "stick", label: "به برنامهٔ اول می‌چسبیم", weights: { تاریخی: 2 }, hint: "منظم" },
      { id: "solo", label: "من معمولاً تنها سفر می‌کنم", weights: { شهری: 1, کویری: 1 }, hint: "تنها" },
    ],
  },
  // ------------------------------------------------------------- mood
  {
    key: "mood",
    prompt: "کدام تصویر بیشتر شبیه تعطیلات توست؟",
    aside: "یک تصویر را انتخاب کن؛ بقیه را فراموش کن.",
    options: [
      { id: "history", label: "کوچه‌های خشتی و کاشی‌های فیروزه‌ای", weights: { تاریخی: 2 }, hint: "تاریخ و معماری" },
      { id: "sea", label: "باد شور و صدای موج", weights: { ساحلی: 2 }, hint: "دریا" },
      { id: "green", label: "جنگل، مه و صدای آب", weights: { طبیعت: 2 }, hint: "شمال سبز" },
      { id: "desert", label: "آسمان پرستاره و سکوت کویر", weights: { کویری: 2 }, hint: "کویر" },
    ],
  },
  {
    key: "mood2",
    prompt: "کدام صدا را در سفر بیشتر دوست داری؟",
    aside: "به اولین حسی که می‌آید اعتماد کن.",
    options: [
      { id: "azan", label: "صدای اذان و بازار حرم", weights: { زیارتی: 2 }, hint: "زیارتی" },
      { id: "mountain", label: "باد لای سنگ‌های بلند", weights: { کوهستانی: 2 }, hint: "کوه" },
      { id: "city", label: "همهمهٔ خیابان و کافه", weights: { شهری: 2 }, hint: "شهر" },
      { id: "silence", label: "هیچ صدایی، فقط سکوت", weights: { کویری: 2, طبیعت: 1 }, hint: "خلوت" },
    ],
  },
  // ------------------------------------------------------------- budget
  {
    key: "budget",
    prompt: "برای کل سفر چقدر بودجه گذاشته‌ای؟",
    aside: "این عدد بعداً در همهٔ پیشنهادها و انتخاب بلیت و اقامتگاه اثر می‌گذارد.",
    options: [
      { id: "low", label: "تا ۱۰ میلیون تومان", weights: { تاریخی: 1, کویری: 1 }, dailyToman: 700_000, hint: "اقتصادی" },
      { id: "mid", label: "حدود ۲۰ میلیون تومان", weights: { شهری: 1, تاریخی: 1 }, dailyToman: 1_400_000, hint: "متوسط" },
      { id: "high", label: "حدود ۴۰ میلیون تومان", weights: { ساحلی: 1, شهری: 1 }, dailyToman: 2_600_000, hint: "راحت" },
      { id: "vip", label: "بیشتر از ۶۰ میلیون، دنبال بهترین‌ها هستم", weights: { ساحلی: 1, شهری: 1 }, dailyToman: 4_500_000, hint: "بی‌دغدغه" },
    ],
  },
  {
    key: "budget2",
    prompt: "پولت را بیشتر کجای سفر خرج می‌کنی؟",
    aside: "این کمک می‌کند بدانیم چه چیزی را برایت کم کنیم.",
    options: [
      { id: "stay", label: "اقامتگاه خوب و راحت", weights: { شهری: 1, ساحلی: 1 }, dailyToman: 2_000_000, hint: "اقامت" },
      { id: "food", label: "غذا و رستوران‌های محلی", weights: { شهری: 2 }, dailyToman: 1_500_000, hint: "غذا" },
      { id: "tickets", label: "بازدیدها و تجربه‌ها", weights: { تاریخی: 1, طبیعت: 1 }, dailyToman: 1_300_000, hint: "تجربه" },
      { id: "travel", label: "رسیدن راحت‌تر، حتی گران‌تر", weights: { شهری: 1 }, dailyToman: 1_600_000, hint: "مسیر" },
    ],
  },
  // ------------------------------------------------------------- season / climate
  {
    key: "season",
    prompt: "چه هوایی را بیشتر دوست داری؟",
    aside: "هوای همان روزها را هم بعداً نشانت می‌دهیم.",
    options: [
      { id: "cold", label: "سرد و برفی", weights: { کوهستانی: 2 }, hint: "کوه و سرما" },
      { id: "mild", label: "معتدل و بهاری", weights: { تاریخی: 1, طبیعت: 1 }, hint: "بهار" },
      { id: "warm", label: "گرم و آفتابی", weights: { ساحلی: 1, کویری: 1 }, hint: "آفتاب" },
      { id: "any", label: "مهم نیست، لباسش را می‌پوشم", weights: { شهری: 1 }, hint: "هر فصلی" },
    ],
  },
  {
    key: "climate2",
    prompt: "در سفر گرمای ۴۰ درجه را چطور تحمل می‌کنی؟",
    aside: "بعضی شهرهای جنوب و کویر همین هوا را دارند.",
    options: [
      { id: "fine", label: "مشکلی نیست، عاشق گرما هستم", weights: { کویری: 2, ساحلی: 1 }, hint: "گرم" },
      { id: "shade", label: "با آب و سایه کنار می‌آیم", weights: { ساحلی: 1, تاریخی: 1 }, hint: "متوسط" },
      { id: "avoid", label: "ترجیح می‌دهم خنک باشد", weights: { کوهستانی: 2 }, hint: "خنک" },
      { id: "cold", label: "سرما را بیشتر از گرما دوست دارم", weights: { کوهستانی: 2, تاریخی: 1 }, hint: "سرد" },
    ],
  },
  // ------------------------------------------------------------- interest
  {
    key: "interest",
    prompt: "اگر یک ساعت وقت اضافه داشتی، چه می‌کردی؟",
    aside: "این بار دربارهٔ سفر جواب بده، نه خانه.",
    options: [
      { id: "museum", label: "یک موزه یا بنای تاریخی", weights: { تاریخی: 2 }, hint: "موزه" },
      { id: "bazaar", label: "گشت در بازار و خرید سوغات", weights: { شهری: 2 }, hint: "بازار" },
      { id: "park", label: "نشستن در پارک و قدم‌زدن", weights: { طبیعت: 2 }, hint: "طبیعت" },
      { id: "food", label: "یک رستوران محلی و غذای خاص", weights: { شهری: 1, تاریخی: 1 }, hint: "غذا" },
    ],
  },
  {
    key: "interest2",
    prompt: "در سفر بیشتر عکس می‌گیری یا بیشتر می‌فهمی؟",
    aside: "هیچ‌کدام بهتر نیست؛ فقط جور دیگری است.",
    options: [
      { id: "photo", label: "عکس و معماری برایم مهم است", weights: { تاریخی: 2 }, hint: "عکاسی" },
      { id: "learn", label: "تاریخ و داستان هر مکان را می‌خوانم", weights: { تاریخی: 1, زیارتی: 1 }, hint: "دانش" },
      { id: "people", label: "آدم‌ها و زندگی روزمره", weights: { شهری: 2 }, hint: "مردم" },
      { id: "nature", label: "طبیعت و چشم‌انداز", weights: { طبیعت: 2, کوهستانی: 1 }, hint: "طبیعت" },
    ],
  },
  // ------------------------------------------------------------- transport
  {
    key: "transport",
    prompt: "دوست داری سفرت را چطور شروع کنی؟",
    aside: "قیمت واقعی هر کدام را در مرحلهٔ بلیت می‌بینی.",
    options: [
      { id: "plane", label: "با هواپیما، سریع و کوتاه", weights: { شهری: 1 }, hint: "هواپیما" },
      { id: "train", label: "با قطار، راحت و آرام", weights: { تاریخی: 1, طبیعت: 1 }, hint: "قطار" },
      { id: "bus", label: "با اتوبوس، ارزان", weights: { کویری: 1, شهری: 1 }, hint: "اتوبوس" },
      { id: "car", label: "با ماشین خودم، هرجا خواستم می‌ایستم", weights: { طبیعت: 1, کوهستانی: 1 }, hint: "جاده" },
    ],
  },
  {
    key: "transport2",
    prompt: "طول مسیر برایت چقدر مهم است؟",
    aside: "مثلاً ۱۲ ساعت قطار در برابر ۲ ساعت پرواز.",
    options: [
      { id: "short", label: "کوتاه‌ترین راه، حتی گران‌تر", weights: { شهری: 2 }, hint: "سریع" },
      { id: "cheap", label: "ارزان‌ترین راه، حتی طولانی‌تر", weights: { کویری: 1, تاریخی: 1 }, hint: "ارزان" },
      { id: "scenic", label: "راهِ زیبا مهم است، نه فقط رسیدن", weights: { طبیعت: 2, کوهستانی: 1 }, hint: "منظره" },
      { id: "night", label: "شب حرکت کنم و صبح برسم", weights: { شهری: 1 }, hint: "شبانه" },
    ],
  },
  // ------------------------------------------------------------- comfort
  {
    key: "comfort",
    prompt: "اقامتگاهت چه شکلی باشد؟",
    aside: "قیمت واقعی‌اش را در مرحلهٔ بعد می‌بینی.",
    options: [
      { id: "simple", label: "ساده و تمیز، فقط برای خواب", weights: { کویری: 1, طبیعت: 1 }, hint: "ساده" },
      { id: "boutique", label: "خانهٔ سنتی یا بوتیک", weights: { تاریخی: 2 }, hint: "بوتیک" },
      { id: "hotel", label: "هتل با صبحانه و امکانات", weights: { شهری: 1, زیارتی: 1 }, hint: "هتل" },
      { id: "resort", label: "اقامتگاه کنار آب با استخر", weights: { ساحلی: 2 }, hint: "ریزورت" },
    ],
  },
  {
    key: "comfort2",
    prompt: "صبحانهٔ سفر برایت چیست؟",
    aside: "بستگی دارد شهر چه چیزی دارد.",
    options: [
      { id: "hotel", label: "صبحانهٔ بوفهٔ هتل", weights: { شهری: 1, زیارتی: 1 }, hint: "هتل" },
      { id: "local", label: "نان محلی و شیرینی همان شهر", weights: { تاریخی: 1, شهری: 1 }, hint: "محلی" },
      { id: "cafe", label: "کافه و قهوه", weights: { شهری: 2 }, hint: "کافه" },
      { id: "none", label: "صبحانه نمی‌خورم", weights: { کویری: 1, طبیعت: 1 }, hint: "بی‌خیال" },
    ],
  },
  // ------------------------------------------------------------- crowd
  {
    key: "crowd",
    prompt: "شلوغی را چطور تحمل می‌کنی؟",
    aside: "بعضی شهرها همیشه شلوغ‌ند، بعضی هیچ‌وقت.",
    options: [
      { id: "love", label: "شلوغی و زندگی را دوست دارم", weights: { شهری: 2, زیارتی: 1 }, hint: "شهر شلوغ" },
      { id: "ok", label: "تا حدی، اگر جاذبه‌اش ارزشش را داشته باشد", weights: { تاریخی: 1, زیارتی: 1 }, hint: "متوسط" },
      { id: "quiet", label: "آرامش برایم مهم‌تر است", weights: { کویری: 1, طبیعت: 1 }, hint: "آرام" },
      { id: "escape", label: "شلوغی را دوست ندارم؛ جای خالی می‌خواهم", weights: { کویری: 2 }, hint: "خلوت" },
    ],
  },
  {
    key: "crowd2",
    prompt: "در سفر با صف طولانی موزه چه می‌کنی؟",
    aside: "این نشان می‌دهد چقدر شلوغی را می‌پذیری.",
    options: [
      { id: "wait", label: "می‌ایستم، ارزشش را دارد", weights: { تاریخی: 2 }, hint: "صبور" },
      { id: "early", label: "صبح زود می‌روم که خلوت باشد", weights: { تاریخی: 1, شهری: 1 }, hint: "زود" },
      { id: "skip", label: "بی‌خیالش می‌شوم و جای دیگری می‌روم", weights: { طبیعت: 1, ساحلی: 1 }, hint: "جایگزین" },
      { id: "other", label: "کلاً جای خلوت‌تر را انتخاب می‌کنم", weights: { کویری: 2 }, hint: "خلوت" },
    ],
  },
  // ------------------------------------------------------------- food & local life
  {
    key: "food",
    prompt: "غذای سفر برایت چه نقشی دارد؟",
    aside: "غذا در بعضی شهرها بهترین بخش سفر است.",
    options: [
      { id: "main", label: "اصلاً سفر یعنی غذا", weights: { شهری: 2, ساحلی: 1 }, hint: "غذاشناس" },
      { id: "normal", label: "مهم است ولی عجله‌ای ندارم", weights: { شهری: 1 }, hint: "معمولی" },
      { id: "simple", label: "ساده می‌خورم تا پول و وقت بماند", weights: { تاریخی: 1, کویری: 1 }, hint: "ساده" },
      { id: "veg", label: "غذای گیاهی و سالم را ترجیح می‌دهم", weights: { طبیعت: 1, شهری: 1 }, hint: "سبک" },
    ],
  },
  {
    key: "food2",
    prompt: "خاطره‌انگیزترین چیز سفرهای قبلی‌ات چه بود؟",
    aside: "به چیز خوبی که یادت مانده فکر کن.",
    options: [
      { id: "monument", label: "یک بنای عظیم و قدیمی", weights: { تاریخی: 2 }, hint: "بنا" },
      { id: "beach", label: "یک غروب کنار آب", weights: { ساحلی: 2 }, hint: "غروب" },
      { id: "street", label: "یک شب پیاده‌روی در شهر", weights: { شهری: 2 }, hint: "شهر" },
      { id: "pilgrim", label: "یک زیارت یا جمع مذهبی", weights: { زیارتی: 2 }, hint: "زیارت" },
    ],
  },
  // ------------------------------------------------------------- what to avoid
  {
    key: "avoid",
    prompt: "چه چیزی در سفر بیشتر از همه کلافه‌ات می‌کند؟",
    aside: "همین نشان می‌دهد از کجا دورت کنیم.",
    options: [
      { id: "heat", label: "گرمای شدید", weights: { کوهستانی: 2, طبیعت: 1 }, hint: "دور از گرما" },
      { id: "cold", label: "سرمای شدید", weights: { ساحلی: 2, کویری: 1 }, hint: "دور از سرما" },
      { id: "crowd", label: "شلوغی و صف", weights: { کویری: 1, طبیعت: 2 }, hint: "دور از شلوغی" },
      { id: "road", label: "مسیر طولانی و خسته‌کننده", weights: { شهری: 2 }, hint: "نزدیک" },
    ],
  },
  {
    key: "avoid2",
    prompt: "کدام گزینه را حاضر نیستی در سفر تحمل کنی؟",
    aside: "صادقانه بگو؛ بعداً برایت راحت‌تر است.",
    options: [
      { id: "dirty", label: "اقامتگاه آلوده", weights: { شهری: 1, ساحلی: 1 }, hint: "تمیزی" },
      { id: "noise", label: "سروصدای شبانه", weights: { کویری: 1, طبیعت: 2 }, hint: "سکوت" },
      { id: "nothing", label: "هیچ‌چیز، همه‌چیز را می‌پذیرم", weights: { شهری: 1, طبیعت: 1 }, hint: "سازگار" },
      { id: "walk", label: "پیاده‌روی زیاد", weights: { شهری: 1, ساحلی: 1 }, hint: "بدون راه‌پیمایی" },
    ],
  },
];

export type QuizAnswers = Record<string, string>;

/** One question per key, freshly shuffled, so no two rounds look the same. */
export function drawQuestions(random: () => number = Math.random, count = 5): QuizQuestion[] {
  const byKey = new Map<QuizKey, QuizQuestion>();
  for (const question of QUESTION_POOL) {
    const existing = byKey.get(question.key);
    // Keys can appear more than once in the pool: pick one of them at random.
    if (!existing || random() < 0.5) byKey.set(question.key, question);
  }
  const all = Array.from(byKey.values());
  // Fisher–Yates, then take the first `count`.
  for (let index = all.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [all[index], all[swap]] = [all[swap], all[index]];
  }
  return all.slice(0, Math.max(3, Math.min(all.length, count)));
}

export type QuizResult = {
  moods: { mood: DiscoverMood; score: number }[];
  /** The strongest taste, in one word, for the result screen. */
  headline: string;
  /** Two or three sentences describing the traveller's trip style. */
  summary: string;
  dailyToman: number | null;
  days: number | null;
};

const MOOD_WORDS: Record<DiscoverMood, string> = {
  تاریخی: "تاریخ و معماری",
  زیارتی: "زیارت و آرامش",
  طبیعت: "طبیعت و هوای آزاد",
  ساحلی: "دریا و ساحل",
  شهری: "شهر، بازار و غذا",
  کوهستانی: "کوه و سرما",
  کویری: "کویر و آسمان شب",
};

/** Turns the answers into a ranked taste, without pretending to be a diagnosis. */
export function scoreAnswers(questions: QuizQuestion[], answers: QuizAnswers): QuizResult {
  const scores = new Map<DiscoverMood, number>();
  let dailyToman: number | null = null;
  let days: number | null = null;

  for (const question of questions) {
    const chosen = question.options.find((option) => option.id === answers[question.key]);
    if (!chosen) continue;
    for (const [mood, weight] of Object.entries(chosen.weights)) {
      const key = mood as DiscoverMood;
      scores.set(key, (scores.get(key) || 0) + (Number(weight) || 0));
    }
    if (typeof chosen.dailyToman === "number") dailyToman = chosen.dailyToman;
    if (typeof chosen.days === "number") days = chosen.days;
  }

  const ranked = Array.from(scores.entries())
    .map(([mood, score]) => ({ mood, score }))
    .sort((a, b) => b.score - a.score);

  const top = ranked.slice(0, 2).map((entry) => MOOD_WORDS[entry.mood]);
  const headline = ranked.length ? MOOD_WORDS[ranked[0].mood] : "سفری تازه";
  const summary = top.length
    ? `سلیقهٔ سفرت بیشتر به ${top.join(" و ")} می‌خورد. بر همین اساس چند شهر پیشنهاد می‌کنیم و بعد با هم وسیلهٔ سفر و اقامتگاه را می‌چینیم.`
    : "با همین چند جواب، چند شهر پیشنهاد می‌کنیم و بعد با هم بقیهٔ سفر را می‌چینیم.";

  return { moods: ranked, headline, summary, dailyToman, days };
}

export type CitySuggestion = {
  name: string;
  /** Rough cost of the whole trip for the suggested days, in toman. */
  estimatedToman?: number;
  /** true when that estimate is above what the traveller said they can spend. */
  overBudget?: boolean;
  province: string;
  tagline: string;
  days: number;
  bestSeason: string;
  /** Why this city was suggested — in the traveller's own words, never generic. */
  reason: string;
  score: number;
};

/**
 * Cities that match the taste. Only places Safarino already knows (with real
 * coordinates and real attractions) can be suggested, so a suggestion always
 * leads to a plan that can actually be built.
 */
export function suggestCities(
  result: QuizResult,
  options: { limit?: number; exclude?: string[]; budgetMillions?: number | null; travellers?: number } = {},
): CitySuggestion[] {
  const exclude = new Set(options.exclude || []);
  const topMoods = result.moods.slice(0, 3);
  const scored = DISCOVER_CITIES.filter((city) => !exclude.has(city.name)).map((city) => {
    let score = 0;
    for (const entry of topMoods) {
      if (city.moods.includes(entry.mood)) score += entry.score * 2;
    }
    // A city that matches several tastes is a good, safe suggestion.
    score += city.moods.filter((mood) => topMoods.some((entry) => entry.mood === mood)).length;
    return { city, score };
  });

  scored.sort((a, b) => b.score - a.score || a.city.name.localeCompare(b.city.name, "fa"));

  return scored
    .filter((entry) => entry.score > 0)
    .slice(0, Math.max(1, Math.min(6, options.limit ?? 4)))
    .map(({ city, score }) => {
      const matched = city.moods.filter((mood) => topMoods.some((entry) => entry.mood === mood));
      const reason = matched.length
        ? `${matched.map((mood) => MOOD_WORDS[mood]).join(" و ")} — همان چیزی که انتخاب کردی.`
        : city.tagline;
      return {
        name: city.name,
        province: city.province,
        tagline: city.tagline,
        days: result.days && result.days > 0 ? Math.max(city.suggestedDays - 1, result.days) : city.suggestedDays,
        bestSeason: city.bestSeason,
        reason,
        score,
        ...estimateFor(city.name, result.days && result.days > 0 ? city.suggestedDays : city.suggestedDays, options.travellers || 1, options.budgetMillions ?? null),
      };
    });
}

/** A rough trip cost, so a suggestion never ignores the money available. */
function estimateFor(
  city: string,
  days: number,
  travellers: number,
  budgetMillions: number | null,
): { estimatedToman?: number; overBudget?: boolean } {
  const profile = profileFor(city);
  if (!profile) return {};
  const estimatedToman = estimatedTripCost(profile, Math.max(2, days), Math.max(1, travellers));
  const budget = budgetMillions && budgetMillions > 0 ? budgetMillions * 1_000_000 : null;
  return { estimatedToman, ...(budget ? { overBudget: estimatedToman > budget } : {}) };
}

/** The budget the traveller hinted at, as a whole-trip figure in millions. */
export function budgetFromDaily(dailyToman: number | null, days: number | null, people: number): number | null {
  if (!dailyToman || !days || days < 1) return null;
  const total = dailyToman * days * Math.max(1, people);
  // The app stores the whole-trip budget in millions of toman.
  return Math.max(3, Math.round(total / 1_000_000));
}

/* ------------------------------------------------------- free-text path */

/** Words a traveller actually uses, each mapped to one of the seven tastes. */
const MOOD_WORDS_IN_TEXT: { mood: DiscoverMood; words: string[] }[] = [
  { mood: "تاریخی", words: ["تاریخ", "تاریخی", "قدیم", "بنای", "مسجد", "کاروانسرا", "بازار قدیم", "میراث", "معماری", "موزه"] },
  { mood: "زیارتی", words: ["زیارت", "امام", "حرم", "مذهبی", "ارامش", "آرامش", "دعا"] },
  { mood: "طبیعت", words: ["طبیعت", "جنگل", "آبشار", "سبز", "پیاده‌روی", "پیاده روی", "روستا", "چشمه", "گردش"] },
  { mood: "ساحلی", words: ["دریا", "ساحل", "شنا", "جزیره", "ماهی", "قایق", "آفتاب"] },
  { mood: "شهری", words: ["شهر", "کافه", "خرید", "پاساژ", "غذا", "شب‌گرد", "شبگرد", "رستوران", "بازار"] },
  { mood: "کوهستانی", words: ["کوه", "سرما", "برف", "ارتفاع", "پیست", "اسکی", "ییلاق", "دماوند"] },
  { mood: "کویری", words: ["کویر", "شب", "ستاره", "آسمان", "شن", "شتر", "خورشید", "گرم"] },
];

/** Numbers a traveller writes for «چند روز» and «چند میلیون». */
const DIGIT_WORDS: Record<string, number> = { یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10 };

function mentionedNumber(text: string, suffix: string): number | null {
  const latin = text.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  const match = latin.match(new RegExp(`(\\d{1,2})\\s*${suffix}`));
  if (match) return Number(match[1]);
  for (const [word, value] of Object.entries(DIGIT_WORDS)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|\\s)${escaped}(\\s|$)`, "u").test(text)) return value;
  }
  return null;
}

export type DescribeResult = { result: QuizResult; matchedWords: string[] };

/**
 * «خودم می‌نویسم» — the traveller describes the trip in their own words and the
 * same taste engine decides which Iranian cities fit. Only words that are really
 * in the sentence are counted, and the words that decided are shown back, so the
 * suggestion never looks like magic and never invents a preference.
 */
export function describeTrip(text: string): DescribeResult | null {
  const clean = (text || "").trim();
  if (clean.length < 6) return null;
  const folded = clean
    .replace(/\u200c/g, " ")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .toLowerCase();

  const scores = new Map<DiscoverMood, number>();
  const matchedWords: string[] = [];
  for (const entry of MOOD_WORDS_IN_TEXT) {
    for (const word of entry.words) {
      if (folded.includes(word.replace(/\u200c/g, " "))) {
        scores.set(entry.mood, (scores.get(entry.mood) || 0) + 1);
        if (!matchedWords.includes(word)) matchedWords.push(word);
      }
    }
  }
  if (!scores.size) return null;

  const ranked = Array.from(scores.entries())
    .map(([mood, score]) => ({ mood, score }))
    .sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, 2).map((entry) => MOOD_WORDS[entry.mood]);
  const headline = MOOD_WORDS[ranked[0].mood];
  const days = mentionedNumber(folded, "روز") ?? mentionedNumber(folded, "شب") ?? null;
  const millions = mentionedNumber(folded, "میلیون") ?? mentionedNumber(folded, "میلیونتومانی") ?? null;
  const dailyToman = null;

  return {
    matchedWords,
    result: {
      moods: ranked,
      headline,
      summary: `از نوشته‌ات این‌ها را خواندم: ${matchedWords.slice(0, 6).join("، ")}. سلیقه‌ات بیشتر به ${top.join(" و ")} می‌خورد؛ شهرهای پیشنهادی بر همین اساس مرتب شده‌اند${
        millions ? ` و بودجهٔ حدود ${new Intl.NumberFormat("fa-IR").format(millions)} میلیون تومان در نظر گرفته می‌شود` : ""
      }.`,
      dailyToman,
      days: days && days >= 1 && days <= 10 ? days : null,
    },
  };
}
