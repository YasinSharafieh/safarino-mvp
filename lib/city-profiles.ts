/**
 * Every Iranian city Safarino can talk about — with a real character.
 *
 * This is the knowledge layer behind «کدام شهر برای تو؟»: the province, the
 * kind of trip the city is actually good for, two or three landmarks that
 * really exist there, the season it is worth going, how many days it deserves,
 * and roughly what a day costs a traveller (for matching suggestions to a
 * budget).
 *
 * Two rules that keep this honest:
 *  1. Only landmarks that exist are listed — no invented museum or bazaar.
 *  2. The attractions a traveller sees later are never taken from here: the
 *     plan page still asks Wikipedia / Wikidata / OpenStreetMap. This file only
 *     decides *which city* and *why*, never *what is in it*.
 *
 * `dailyCostToman` is a planning estimate (food, local transport, tickets) for
 * one traveller for one day, and it is shown to the traveller as an estimate.
 */

import type { DiscoverMood } from "./discover";
import { IRANIAN_CITIES } from "./iran-cities";

export type CityProfile = {
  name: string;
  province: string;
  /** One line a traveller can decide with. */
  tagline: string;
  /** Two or three landmarks that really exist in or beside the city. */
  highlights: string[];
  /** Who this city suits, in the traveller's words. */
  bestFor: string[];
  /** The months that are actually worth going. */
  bestSeason: string;
  /** Days worth staying, not counting travel days. */
  suggestedDays: number;
  /** Rough cost of one day for one traveller: food, city transport, tickets. */
  dailyCostToman: number;
  moods: DiscoverMood[];
};

/** Short hands so a hundred cities stay readable. */
const T = { history: "تاریخی", pilgrim: "زیارتی", nature: "طبیعت", coast: "ساحلی", city: "شهری", mountain: "کوهستانی", desert: "کویری" } as const;

export const CITY_PROFILES: CityProfile[] = [
  // ---------------------------------------------------------- big six
  { name: "تهران", province: "تهران", tagline: "پایتخت با موزه‌های بزرگ، کاخ‌ها و زندگی شبانه", highlights: ["کاخ گلستان و بازار بزرگ", "برج میلاد و موزهٔ موسیقی", "تجریش و کوهپایه‌های توچال"], bestFor: ["سفر شهری", "موزه و گالری", "خرید"], bestSeason: "مهر تا اردیبهشت", suggestedDays: 3, dailyCostToman: 1_200_000, moods: [T.city, T.history] },
  { name: "مشهد", province: "خراسان رضوی", tagline: "زیارت، موزه و باغ‌های بزرگ در یک شهر", highlights: ["حرم مطهر رضوی و مجموعهٔ اطراف", "موزه‌های آستان قدس", "بازار رضا و سوغات زعفران"], bestFor: ["سفر زیارتی", "سفر خانوادگی"], bestSeason: "بهار و پاییز؛ تابستان گرم است", suggestedDays: 3, dailyCostToman: 900_000, moods: [T.pilgrim, T.history, T.city] },
  { name: "اصفهان", province: "اصفهان", tagline: "میدان‌ها، پل‌ها و معماری که تمام نمی‌شود", highlights: ["میدان نقش جهان و مسجدهای آن", "پل‌های سی‌وسه‌پل و خواجو", "محلهٔ جلفا و کلیسای وانک"], bestFor: ["سفر فرهنگی", "عکاسی", "خانواده"], bestSeason: "فروردین تا خرداد و مهر تا آبان", suggestedDays: 3, dailyCostToman: 950_000, moods: [T.history, T.city, T.pilgrim] },
  { name: "شیراز", province: "فارس", tagline: "شهر شعر، باغ و فاصلهٔ کوتاه تا تخت جمشید", highlights: ["حافظیه و سعدیه", "مسجد نصیرالملک و بازار وکیل", "تخت جمشید و نقش رستم در یک روز"], bestFor: ["سفر فرهنگی", "سفر عاشقانه"], bestSeason: "اسفند تا اردیبهشت", suggestedDays: 3, dailyCostToman: 950_000, moods: [T.history, T.city] },
  { name: "تبریز", province: "آذربایجان شرقی", tagline: "بازار تاریخی، غذا و کوه‌های اطراف", highlights: ["بازار تاریخی تبریز", "ائل‌گلی و مسجد کبود", "کندوان و کوه‌های اطراف"], bestFor: ["سفر شهری", "غذاشناسی"], bestSeason: "خرداد تا شهریور", suggestedDays: 2, dailyCostToman: 800_000, moods: [T.history, T.city, T.mountain] },
  { name: "یزد", province: "یزد", tagline: "شهر خشت و بادگیر، آرام و پیاده‌رو", highlights: ["بافت تاریخی و بادگیرها", "مسجد جامع و آب‌انبارها", "باغ دولت‌آباد"], bestFor: ["سفر آرام", "معماری و عکاسی"], bestSeason: "مهر تا فروردین", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.history, T.desert] },

  // ---------------------------------------------------------- north
  { name: "رشت", province: "گیلان", tagline: "سبزی شمال، باران و غذا", highlights: ["بازار رشت و خوراک محلی", "موزهٔ میراث روستایی گیلان", "روستاهای اطراف و ماسوله"], bestFor: ["طبیعت‌گردی", "سفر غذا"], bestSeason: "اردیبهشت تا شهریور", suggestedDays: 2, dailyCostToman: 750_000, moods: [T.nature, T.city] },
  { name: "لاهیجان", province: "گیلان", tagline: "چای، استخر و بازار سبز", highlights: ["استخر لاهیجان و شیطان‌کوه", "بازار چای و سوغات", "مزارع چای اطراف"], bestFor: ["طبیعت‌گردی", "سفر آرام"], bestSeason: "اردیبهشت تا شهریور", suggestedDays: 2, dailyCostToman: 650_000, moods: [T.nature] },
  { name: "انزلی", province: "گیلان", tagline: "تالاب، دریا و ماهی", highlights: ["تالاب انزلی", "بلوار ساحلی و اسکله", "بازار ماهی و خوراک محلی"], bestFor: ["طبیعت‌گردی", "سفر ساحلی"], bestSeason: "اردیبهشت تا شهریور", suggestedDays: 1, dailyCostToman: 650_000, moods: [T.coast, T.nature] },
  { name: "ماسوله", province: "گیلان", tagline: "روستای پلکانی با بازار و مه", highlights: ["بافت پلکانی ماسوله", "بازار سنتی و صنایع دستی", "آبشار و ارتفاعات اطراف"], bestFor: ["طبیعت‌گردی", "عکاسی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.nature, T.history] },
  { name: "رامسر", province: "مازندران", tagline: "جنگل و دریا در یک قدمی", highlights: ["تله‌کابین رامسر", "چشمه‌های آب گرم", "ساحل و جنگل‌های اطراف"], bestFor: ["سفر خانوادگی", "آب گرم"], bestSeason: "اردیبهشت تا شهریور", suggestedDays: 2, dailyCostToman: 800_000, moods: [T.coast, T.nature] },
  { name: "بابلسر", province: "مازندران", tagline: "ساحل و رودخانه در وسط شهر", highlights: ["ساحل بابلسر", "رودخانهٔ بابلرود", "بازار و خوراک شمالی"], bestFor: ["سفر خانوادگی", "سفر ساحلی"], bestSeason: "خرداد تا شهریور", suggestedDays: 2, dailyCostToman: 750_000, moods: [T.coast, T.city] },
  { name: "نوشهر", province: "مازندران", tagline: "جنگل و دریا با ساحل‌های آرام", highlights: ["ساحل نوشهر", "جنگل‌های اطراف", "بازار و سی‌سنگان در نزدیکی"], bestFor: ["طبیعت‌گردی", "سفر ساحلی"], bestSeason: "خرداد تا شهریور", suggestedDays: 2, dailyCostToman: 750_000, moods: [T.coast, T.nature] },
  { name: "چالوس", province: "مازندران", tagline: "دروازهٔ جادهٔ معروف شمال", highlights: ["جاده چالوس و دریاچهٔ ولشت", "ساحل و بازار", "مرزن‌آباد و کندوان"], bestFor: ["سفر جاده‌ای", "طبیعت‌گردی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 2, dailyCostToman: 800_000, moods: [T.nature, T.coast, T.mountain] },
  { name: "ساری", province: "مازندران", tagline: "مرکز مازندران با جنگل و شالیزار", highlights: ["پارک جنگلی ساری", "بازار ساری", "شالیزارها و روستاهای اطراف"], bestFor: ["طبیعت‌گردی"], bestSeason: "اردیبهشت تا شهریور", suggestedDays: 1, dailyCostToman: 650_000, moods: [T.nature, T.city] },
  { name: "گرگان", province: "گلستان", tagline: "جنگل هیرکانی و برج قابوس", highlights: ["جنگل ناهارخوران", "گنبد قابوس", "دیوار تاریخی گرگان"], bestFor: ["طبیعت‌گردی", "تاریخ"], bestSeason: "فروردین تا خرداد و مهر تا آبان", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.nature, T.history] },
  { name: "بندرترکمن", province: "گلستان", tagline: "ساحل خزر و بازار ترکمن", highlights: ["ساحل بندرترکمن", "بازار صنایع دستی ترکمن", "تالاب‌های اطراف"], bestFor: ["سفر ساحلی", "طبیعت‌گردی"], bestSeason: "اردیبهشت تا شهریور", suggestedDays: 1, dailyCostToman: 600_000, moods: [T.coast, T.nature] },
  { name: "اردبیل", province: "اردبیل", tagline: "شیخ صفی، سرعین و دامنهٔ سبلان", highlights: ["بقعهٔ شیخ صفی‌الدین", "چشمه‌های سرعین", "دامنهٔ سبلان"], bestFor: ["تاریخ", "آب گرم", "کوهنوردی"], bestSeason: "خرداد تا شهریور", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.history, T.nature, T.mountain] },
  { name: "سرعین", province: "اردبیل", tagline: "چشمه‌های آب گرم و هوای خنک", highlights: ["چشمه‌های آب گرم", "تله‌کابین آلوارس", "دامنهٔ سبلان"], bestFor: ["آب گرم", "سفر خانوادگی"], bestSeason: "خرداد تا شهریور", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.nature, T.mountain] },

  // ---------------------------------------------------------- west
  { name: "همدان", province: "همدان", tagline: "شهر باستانی با غار و کتیبه", highlights: ["آرامگاه بوعلی‌سینا", "کتیبه‌های گنج‌نامه", "غار علیصدر در نزدیکی"], bestFor: ["تاریخ و طبیعت"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 2, dailyCostToman: 650_000, moods: [T.history, T.nature, T.mountain] },
  { name: "کرمانشاه", province: "کرمانشاه", tagline: "طاق بستان، بیستون و غارها", highlights: ["طاق بستان", "کتیبهٔ بیستون", "غارها و کوه‌های اطراف"], bestFor: ["تاریخ", "طبیعت"], bestSeason: "فروردین تا خرداد", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.history, T.mountain] },
  { name: "سنندج", province: "کردستان", tagline: "موسیقی، بازار و پارک آبیدر", highlights: ["پارک و تله‌کابین آبیدر", "بازار سنتی سنندج", "عمارت‌های قدیمی"], bestFor: ["سفر آرام", "طبیعت‌گردی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 2, dailyCostToman: 650_000, moods: [T.city, T.mountain] },
  { name: "مریوان", province: "کردستان", tagline: "دریاچهٔ زریوار و بازار مرزی", highlights: ["دریاچهٔ زریوار", "بازار مرزی مریوان", "کوه‌های اطراف"], bestFor: ["طبیعت‌گردی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 600_000, moods: [T.nature, T.mountain] },
  { name: "سقز", province: "کردستان", tagline: "بازار قدیمی و کوه‌های کردستان", highlights: ["بازار سنتی سقز", "تپه‌های باستانی اطراف", "کوه‌های زاگرس"], bestFor: ["طبیعت‌گردی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.nature, T.mountain] },
  { name: "مهاباد", province: "آذربایجان غربی", tagline: "تالاب و کتیبه‌های میخی", highlights: ["تالاب کانی‌برازان", "کتیبهٔ میخی مهاباد", "بازار مهاباد"], bestFor: ["طبیعت‌گردی", "تاریخ"], bestSeason: "فروردین تا خرداد", suggestedDays: 1, dailyCostToman: 600_000, moods: [T.nature, T.history] },
  { name: "ارومیه", province: "آذربایجان غربی", tagline: "دریاچه، کلیساهای قدیمی و بازار", highlights: ["دریاچهٔ ارومیه", "کلیسای ننه‌مریم", "بازار ارومیه"], bestFor: ["طبیعت‌گردی"], bestSeason: "خرداد تا شهریور", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.nature, T.city] },
  { name: "خوی", province: "آذربایجان غربی", tagline: "شهر مرزی با بازار و چشمه‌ها", highlights: ["بازار خوی", "چشمه‌های آب معدنی اطراف", "کلیساهای تاریخی منطقه"], bestFor: ["سفر شهری"], bestSeason: "خرداد تا شهریور", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.city, T.history] },
  { name: "ماکو", province: "آذربایجان غربی", tagline: "کاخ، دره و دامنهٔ آرارات", highlights: ["کاخ و قلعهٔ ماکو", "درهٔ قره‌کلیسا در نزدیکی", "ارس و کوه آرارات"], bestFor: ["طبیعت‌گردی", "تاریخ"], bestSeason: "خرداد تا شهریور", suggestedDays: 2, dailyCostToman: 650_000, moods: [T.mountain, T.history] },
  { name: "میاندوآب", province: "آذربایجان غربی", tagline: "شهر میان دو آب با تالاب‌های اطراف", highlights: ["تالاب‌های اطراف زرینه‌رود", "بازار میاندوآب", "دشت‌های کشاورزی"], bestFor: ["سفر جاده‌ای"], bestSeason: "اردیبهشت تا شهریور", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.nature] },
  { name: "زنجان", province: "زنجان", tagline: "چاقو، بازار و گنبد سلطانیه", highlights: ["گنبد سلطانیه در نزدیکی", "بازار سنتی زنجان", "غار کتله‌خور در نزدیکی"], bestFor: ["تاریخ", "خرید صنایع دستی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 2, dailyCostToman: 650_000, moods: [T.history, T.city] },
  { name: "قزوین", province: "قزوین", tagline: "پایتخت صفوی، باغ و کتیبه", highlights: ["کاخ چهل‌ستون قزوین", "بازار و مسجد جامع", "قلعهٔ الموت در نزدیکی"], bestFor: ["تاریخ", "سفر آرام"], bestSeason: "فروردین تا خرداد", suggestedDays: 2, dailyCostToman: 650_000, moods: [T.history, T.city] },
  { name: "الموت", province: "قزوین", tagline: "قلعهٔ الموت و دره‌های سبز", highlights: ["قلعهٔ الموت", "دره‌های الموت", "روستاهای پلکانی اطراف"], bestFor: ["کوهنوردی", "تاریخ"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.mountain, T.history] },

  // ---------------------------------------------------------- centre & south
  { name: "قم", province: "قم", tagline: "زیارت، حوزه و بازار", highlights: ["حرم حضرت معصومه", "مسجد جمکران", "بازار و سوغات"], bestFor: ["سفر زیارتی"], bestSeason: "همهٔ فصل‌ها؛ تابستان گرم", suggestedDays: 1, dailyCostToman: 600_000, moods: [T.pilgrim, T.city] },
  { name: "اراک", province: "مرکزی", tagline: "بازار قدیمی و آبگوشت معروف", highlights: ["بازار تاریخی اراک", "مسجد جامع", "دشت‌های اطراف"], bestFor: ["سفر جاده‌ای"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.city, T.history] },
  { name: "ساوه", province: "مرکزی", tagline: "مسجد جامع و باغ‌های انار", highlights: ["مسجد جامع ساوه", "بازار و باغ‌های انار", "تپهٔ باستانی"], bestFor: ["سفر جاده‌ای"], bestSeason: "مهر تا آذر", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history] },
  { name: "خرم‌آباد", province: "لرستان", tagline: "قلعهٔ فلک‌الافلاک و آبشارها", highlights: ["قلعهٔ فلک‌الافلاک", "آبشارها و دره‌های اطراف", "بازار خرم‌آباد"], bestFor: ["طبیعت‌گردی", "تاریخ"], bestSeason: "فروردین تا مهر", suggestedDays: 2, dailyCostToman: 600_000, moods: [T.nature, T.history, T.mountain] },
  { name: "بروجرد", province: "لرستان", tagline: "مسجد سلطانی و بازار قدیمی", highlights: ["مسجد سلطانی بروجرد", "بازار سنتی", "بناهای تاریخی شهر"], bestFor: ["تاریخ"], bestSeason: "فروردین تا مهر", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.history, T.city] },
  { name: "دورود", province: "لرستان", tagline: "دره‌های سبز راه‌آهن", highlights: ["دره‌های سبز دورود", "راه‌آهن تاریخی", "کوه‌های زاگرس"], bestFor: ["طبیعت‌گردی"], bestSeason: "فروردین تا مهر", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.nature, T.mountain] },
  { name: "ایلام", province: "ایلام", tagline: "بلوط، کوه و کتیبه‌های تاریخی", highlights: ["کوه‌های ایلام و جنگل بلوط", "قلعه‌های تاریخی", "بازار ایلام"], bestFor: ["طبیعت‌گردی"], bestSeason: "فروردین تا خرداد", suggestedDays: 1, dailyCostToman: 600_000, moods: [T.nature, T.mountain] },
  { name: "اهواز", province: "خوزستان", tagline: "کارون، پل‌ها و گرمای جنوب", highlights: ["کارون و پل‌های اهواز", "بازار اهواز", "بند قیر و بقعه‌های اطراف"], bestFor: ["سفر شهری"], bestSeason: "آذر تا اسفند", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.city] },
  { name: "شوشتر", province: "خوزستان", tagline: "شاهکار آبی ایرانیان باستان", highlights: ["سازه‌های آبی شوشتر", "مسجد جامع شوشتر", "پل‌های تاریخی"], bestFor: ["تاریخ", "عکاسی"], bestSeason: "آذر تا اسفند", suggestedDays: 1, dailyCostToman: 600_000, moods: [T.history] },
  { name: "شوش", province: "خوزستان", tagline: "زیگورات چغازنبیل و آپادانا", highlights: ["کاخ آپادانا شوش", "زیگورات چغازنبیل", "آرامگاه دانیال نبی"], bestFor: ["تاریخ", "تاریخ باستان"], bestSeason: "آذر تا اسفند", suggestedDays: 1, dailyCostToman: 650_000, moods: [T.history] },
  { name: "دزفول", province: "خوزستان", tagline: "پل کهن، بافت قدیم و آبشارهای اطراف", highlights: ["پل قدیم دزفول", "بافت تاریخی دزفول", "شهیون و آبشارها"], bestFor: ["تاریخ", "طبیعت‌گردی"], bestSeason: "آذر تا فروردین", suggestedDays: 2, dailyCostToman: 650_000, moods: [T.history, T.nature] },
  { name: "خرمشهر", province: "خوزستان", tagline: "اروند، یادمان و بازار", highlights: ["اروند و اسکلهٔ خرمشهر", "مسجد جامع", "بازار مرزی"], bestFor: ["تاریخ معاصر"], bestSeason: "آذر تا اسفند", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.city, T.coast] },
  { name: "آبادان", province: "خوزستان", tagline: "اروندرود و آب‌های جنوب", highlights: ["اروندرود", "پالایشگاه و تاریخ معاصر", "بازار آبادان"], bestFor: ["تاریخ معاصر"], bestSeason: "آذر تا اسفند", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.city, T.coast] },
  { name: "اندیمشک", province: "خوزستان", tagline: "دروازهٔ لرستان و زاگرس", highlights: ["رود دز", "کوه‌های اطراف", "بازار اندیمشک"], bestFor: ["سفر جاده‌ای"], bestSeason: "آذر تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.nature] },
  { name: "سوسنگرد", province: "خوزستان", tagline: "دشت آزادگان و یادمان‌ها", highlights: ["یادمان‌های جنگ", "دشت آزادگان", "رود کرخه"], bestFor: ["تاریخ معاصر"], bestSeason: "آذر تا اسفند", suggestedDays: 1, dailyCostToman: 450_000, moods: [T.city] },

  // ---------------------------------------------------------- coasts & islands
  { name: "بوشهر", province: "بوشهر", tagline: "بافت قدیم کنار دریا و نخل", highlights: ["بافت تاریخی بوشهر", "کلیسای ارامنه و هفت‌برکه", "بازار و ساحل"], bestFor: ["سفر ساحلی", "تاریخ"], bestSeason: "آبان تا فروردین", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.coast, T.history] },
  { name: "بندرعباس", province: "هرمزگان", tagline: "بندر، ساحل و جزیره‌های اطراف", highlights: ["ساحل و بلوار بندرعباس", "جزیرهٔ هرمز", "بازار و بندر شهید رجایی"], bestFor: ["سفر ساحلی", "جزیره‌گردی"], bestSeason: "آبان تا فروردین", suggestedDays: 2, dailyCostToman: 850_000, moods: [T.coast, T.city] },
  { name: "قشم", province: "هرمزگان", tagline: "بزرگ‌ترین جزیرهٔ ایران با طبیعت کم‌نظیر", highlights: ["درهٔ ستاره‌ها و جنگل حرا", "جزایر ناز و هنگام", "بازار قشم و لافت"], bestFor: ["طبیعت‌گردی", "سفر خانوادگی"], bestSeason: "آبان تا فروردین", suggestedDays: 3, dailyCostToman: 900_000, moods: [T.coast, T.nature] },
  { name: "کیش", province: "هرمزگان", tagline: "خلیج فارس، ساحل و خرید بی‌گمرک", highlights: ["ساحل مرجان و درخت سبز", "جزیرهٔ هندورابی و ورزش‌های آبی", "خرید و بازار"], bestFor: ["سفر ساحلی", "خرید"], bestSeason: "آبان تا فروردین", suggestedDays: 3, dailyCostToman: 1_300_000, moods: [T.coast, T.city] },
  { name: "هرمز", province: "هرمزگان", tagline: "جزیرهٔ رنگین‌کمانی خاک سرخ", highlights: ["سواحل رنگین جزیرهٔ هرمز", "درهٔ مجسمه‌ها", "قلعهٔ هرمز"], bestFor: ["طبیعت‌گردی", "عکاسی"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 700_000, moods: [T.coast, T.nature] },
  { name: "چابهار", province: "سیستان و بلوچستان", tagline: "دریای عمان، کوه‌های مریخی و بازار مرزی", highlights: ["خلیج گواتر و ساحل درک", "کوه‌های مریخی", "بازار مرزی چابهار"], bestFor: ["سفر ساحلی", "طبیعت‌گردی"], bestSeason: "آبان تا فروردین", suggestedDays: 3, dailyCostToman: 800_000, moods: [T.coast, T.nature] },
  { name: "بندر لنگه", province: "هرمزگان", tagline: "بازار قدیمی و لنج‌های خلیج", highlights: ["بافت و بازار بندر لنگه", "ساحل و لنج‌ها", "جزیره‌های نزدیک"], bestFor: ["سفر ساحلی"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 650_000, moods: [T.coast, T.city] },
  { name: "خورموج", province: "بوشهر", tagline: "نخلستان و بندری قدیمی", highlights: ["نخلستان‌های خورموج", "بازار و بافت قدیم", "بندرهای نزدیک"], bestFor: ["سفر جاده‌ای"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.coast] },

  // ---------------------------------------------------------- desert belt
  { name: "کرمان", province: "کرمان", tagline: "دروازهٔ کویر و باغ‌های تاریخی", highlights: ["باغ شاهزاده ماهان", "بازار و گنبد جبلیه", "کلوت‌های شهداد"], bestFor: ["کویرنوردی", "تاریخ"], bestSeason: "مهر تا فروردین", suggestedDays: 2, dailyCostToman: 650_000, moods: [T.desert, T.history] },
  { name: "بم", province: "کرمان", tagline: "ارگ خشتی و نخلستان", highlights: ["ارگ تاریخی بم", "نخلستان‌های بم", "بازار بم"], bestFor: ["تاریخ"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.history, T.desert] },
  { name: "رفسنجان", province: "کرمان", tagline: "پسته و کویر", highlights: ["باغ‌های پسته", "کویر و آسمان شب", "بازار رفسنجان"], bestFor: ["کویرنوردی"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.desert] },
  { name: "سیرجان", province: "کرمان", tagline: "گلیم و کویر", highlights: ["بازار و گلیم سیرجان", "کویر اطراف", "باغ‌های پسته"], bestFor: ["کویرنوردی", "خرید صنایع دستی"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.desert, T.city] },
  { name: "جیرفت", province: "کرمان", tagline: "تمدن کهن و نخلستان", highlights: ["تپه‌های باستانی جیرفت", "نخلستان‌ها", "بازار جیرفت"], bestFor: ["تاریخ"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history, T.desert] },
  { name: "طبس", province: "خراسان جنوبی", tagline: "باغ گلشن در دل کویر", highlights: ["باغ گلشن طبس", "چشمه‌های آب گرم", "کویر و روستای حلوان"], bestFor: ["کویرنوردی", "سفر آرام"], bestSeason: "مهر تا فروردین", suggestedDays: 2, dailyCostToman: 600_000, moods: [T.desert, T.nature] },
  { name: "بیرجند", province: "خراسان جنوبی", tagline: "باغ‌های تاریخی و زرشک", highlights: ["باغ اکبریه", "بازار بیرجند", "روستاهای زرشک"], bestFor: ["تاریخ", "سفر آرام"], bestSeason: "فروردین تا خرداد و مهر تا آبان", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.desert, T.history] },
  { name: "زابل", province: "سیستان و بلوچستان", tagline: "شهر سوخته و بادهای سیستان", highlights: ["شهر سوخته", "تالاب هامون", "کوه خواجه"], bestFor: ["تاریخ باستان"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.desert, T.history] },
  { name: "زاهدان", province: "سیستان و بلوچستان", tagline: "بازار مرزی و کویر", highlights: ["بازار زاهدان", "مسجد جامع مکی", "کویر اطراف"], bestFor: ["سفر جاده‌ای"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.desert, T.city] },
  { name: "خاش", province: "سیستان و بلوچستان", tagline: "کوه تفتان و نخلستان", highlights: ["کوه تفتان", "نخلستان‌های خاش", "بازار خاش"], bestFor: ["کوهنوردی"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.mountain, T.desert] },
  { name: "ایرانشهر", province: "سیستان و بلوچستان", tagline: "کوه‌های آتشفشانی و نخل", highlights: ["کوه‌های اطراف", "نخلستان‌ها", "بازار ایرانشهر"], bestFor: ["طبیعت‌گردی"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.nature, T.desert] },
  { name: "اردکان", province: "یزد", tagline: "شهر بادگیرها و انار", highlights: ["بافت تاریخی اردکان", "باغ‌های انار", "کویر اردکان"], bestFor: ["کویرنوردی", "تاریخ"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.desert, T.history] },
  { name: "میبد", province: "یزد", tagline: "نارین قلعه و زیلو", highlights: ["نارین قلعهٔ میبد", "بازار زیلو", "بافت تاریخی"], bestFor: ["تاریخ", "صنایع دستی"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.history, T.desert] },
  { name: "مهریز", province: "یزد", tagline: "باغ پهلوان‌پور و کوه‌های کهن", highlights: ["باغ پهلوان‌پور", "بافت تاریخی مهریز", "کوه ریگ"], bestFor: ["تاریخ", "سفر آرام"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.history, T.desert] },
  { name: "بافق", province: "یزد", tagline: "معدن، کویر و کوه", highlights: ["کویر بافق", "کوه‌های اطراف", "بازار بافق"], bestFor: ["کویرنوردی"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.desert] },
  { name: "نایین", province: "اصفهان", tagline: "مسجد جامع کهن و کویر", highlights: ["مسجد جامع نایین", "بافت تاریخی", "کویر نایین"], bestFor: ["تاریخ", "کویرنوردی"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.history, T.desert] },

  // ---------------------------------------------------------- isfahan & yazd satellites
  { name: "کاشان", province: "اصفهان", tagline: "خانه‌های تاریخی، باغ فین و گلاب", highlights: ["باغ فین", "خانه‌های تاریخی کاشان", "روستای ابیانه در نزدیکی"], bestFor: ["تاریخ", "عکاسی"], bestSeason: "فروردین تا خرداد و مهر تا آبان", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.history, T.desert] },
  { name: "نطنز", province: "اصفهان", tagline: "مسجد جامع و کوه کرکس", highlights: ["مسجد جامع نطنز", "آتشکدهٔ نطنز", "دامنهٔ کرکس"], bestFor: ["تاریخ", "کوهنوردی"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.history, T.mountain] },
  { name: "شهرضا", province: "اصفهان", tagline: "مسجد جامع و راه قدیم اصفهان", highlights: ["مسجد جامع شهرضا", "بازار قدیمی", "روستاهای اطراف"], bestFor: ["تاریخ"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history] },
  { name: "مبارکه", province: "اصفهان", tagline: "صنعت، دشت و باغ‌های حاشیهٔ زاینده‌رود", highlights: ["بازار مبارکه", "دشت‌های اطراف", "راه قدیم اصفهان"], bestFor: ["سفر جاده‌ای"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 450_000, moods: [T.city] },
  { name: "گلپایگان", province: "اصفهان", tagline: "مسجد جامع سلجوقی", highlights: ["مسجد جامع گلپایگان", "بازار سنتی", "باغ‌های اطراف"], bestFor: ["تاریخ"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history] },

  // ---------------------------------------------------------- khuzestan & southwest hills
  { name: "یاسوج", province: "کهگیلویه و بویراحمد", tagline: "دنا، آبشار و بلوط", highlights: ["آبشار یاسوج", "قلهٔ دنا", "جنگل‌های بلوط"], bestFor: ["طبیعت‌گردی", "کوهنوردی"], bestSeason: "فروردین تا مهر", suggestedDays: 2, dailyCostToman: 600_000, moods: [T.nature, T.mountain] },
  { name: "گچساران", province: "کهگیلویه و بویراحمد", tagline: "نفت و کوه‌های گرمسیری", highlights: ["کوه‌های اطراف", "بازار گچساران", "چشمه‌های منطقه"], bestFor: ["سفر جاده‌ای"], bestSeason: "آذر تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.city] },
  { name: "شهرکرد", province: "چهارمحال و بختیاری", tagline: "بام ایران و آبشارها", highlights: ["آبشارها و چشمه‌های اطراف", "ارتفاعات زاگرس", "بازار شهرکرد"], bestFor: ["طبیعت‌گردی", "کوهنوردی"], bestSeason: "خرداد تا شهریور", suggestedDays: 2, dailyCostToman: 600_000, moods: [T.nature, T.mountain] },

  // ---------------------------------------------------------- khorasan
  { name: "نیشابور", province: "خراسان رضوی", tagline: "خیام، عطار و فیروزه", highlights: ["آرامگاه خیام و عطار", "مسجد جامع نیشابور", "معادن فیروزه"], bestFor: ["تاریخ", "ادبیات"], bestSeason: "فروردین تا خرداد و مهر تا آبان", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.history, T.city] },
  { name: "سبزوار", province: "خراسان رضوی", tagline: "حکیم سبزواری و کویر", highlights: ["آرامگاه حکیم سبزواری", "بازار سبزوار", "کویر اطراف"], bestFor: ["تاریخ"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history, T.desert] },
  { name: "تربت حیدریه", province: "خراسان رضوی", tagline: "زعفران و باغ‌ها", highlights: ["بازار زعفران", "باغ‌های اطراف", "مسجد جامع"], bestFor: ["خرید زعفران"], bestSeason: "آبان (فصل برداشت زعفران)", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.city] },
  { name: "گناباد", province: "خراسان رضوی", tagline: "قنات جهانی و کویر", highlights: ["قنات قصبهٔ گناباد", "کویر اطراف", "بازار گناباد"], bestFor: ["تاریخ", "کویرنوردی"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history, T.desert] },
  { name: "خواف", province: "خراسان رضوی", tagline: "خشت و بادگیر", highlights: ["بافت خشتی خواف", "بازار قدیمی", "کاریزهای تاریخی"], bestFor: ["تاریخ"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 450_000, moods: [T.history, T.desert] },
  { name: "قائن", province: "خراسان جنوبی", tagline: "زعفران و قنات", highlights: ["مزارع زعفران", "قنات‌های تاریخی", "بازار قائن"], bestFor: ["خرید زعفران"], bestSeason: "آبان تا اسفند", suggestedDays: 1, dailyCostToman: 450_000, moods: [T.desert, T.city] },

  // ---------------------------------------------------------- alborz & caspian south
  { name: "کرج", province: "البرز", tagline: "کوهپایه، باغ و نزدیکی تهران", highlights: ["کوهپایه‌های کرج", "باغ‌های اطراف", "بازار کرج"], bestFor: ["سفر یک‌روزه"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 700_000, moods: [T.city, T.mountain] },
  { name: "طالقان", province: "البرز", tagline: "درهٔ سبز و آبشار", highlights: ["درهٔ طالقان", "آبشارها و چشمه‌ها", "روستاهای کوهستانی"], bestFor: ["طبیعت‌گردی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.nature, T.mountain] },
  { name: "فیروزکوه", province: "تهران", tagline: "کوه و دشت لاله", highlights: ["دشت لاله‌های واژگون", "قلعه‌های تاریخی", "کوه‌های البرز"], bestFor: ["طبیعت‌گردی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.nature, T.mountain] },

  // ---------------------------------------------------------- south‑east & others
  { name: "لار", province: "فارس", tagline: "بازار قدیم و قلعه", highlights: ["بازار قیصریهٔ لار", "قلعهٔ لار", "بافت تاریخی"], bestFor: ["تاریخ"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history, T.desert] },
  { name: "لامرد", province: "فارس", tagline: "نخل و جنوب گرم", highlights: ["نخلستان‌ها", "بازار لامرد", "ساحل نزدیک"], bestFor: ["سفر جاده‌ای"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 450_000, moods: [T.desert] },
  { name: "مرودشت", province: "فارس", tagline: "تخت جمشید و نقش رستم", highlights: ["تخت جمشید", "نقش رستم", "دشت مرودشت"], bestFor: ["تاریخ باستان"], bestSeason: "اسفند تا اردیبهشت", suggestedDays: 1, dailyCostToman: 700_000, moods: [T.history] },
  { name: "آباده", province: "فارس", tagline: "شهر شعرا و باغ", highlights: ["آرامگاه وصال شیرازی", "بازار آباده", "مناطق ییلاقی اطراف"], bestFor: ["تاریخ", "سفر جاده‌ای"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history, T.mountain] },
  { name: "اقلید", province: "فارس", tagline: "دشت و کوه؛ شهری آرام در شمال فارس", highlights: ["دشت اقلید", "بلندی‌های زاگرس", "بازار اقلید"], bestFor: ["طبیعت‌گردی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 450_000, moods: [T.nature, T.mountain] },
  { name: "بجنورد", province: "خراسان شمالی", tagline: "عمارت مفخم و طبیعت شمال شرق", highlights: ["عمارت مفخم", "بازار بجنورد", "دره‌های اطراف"], bestFor: ["تاریخ", "طبیعت‌گردی"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history, T.nature] },
  { name: "اسفراین", province: "خراسان شمالی", tagline: "شهر کهن و باغ", highlights: ["بافت تاریخی اسفراین", "بازار اسفراین", "طبیعت اطراف"], bestFor: ["تاریخ"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 450_000, moods: [T.history] },
  { name: "سمنان", province: "سمنان", tagline: "مسجد جامع و کاروانسراها", highlights: ["مسجد جامع سمنان", "بازار سنتی", "کاروانسراهای اطراف"], bestFor: ["تاریخ", "سفر جاده‌ای"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history, T.desert] },
  { name: "شاهرود", province: "سمنان", tagline: "بسطام، جنگل ابر و کویر", highlights: ["مجموعهٔ بسطام", "جنگل ابر", "کویر شاهرود"], bestFor: ["طبیعت‌گردی", "تاریخ"], bestSeason: "اردیبهشت تا آبان", suggestedDays: 2, dailyCostToman: 600_000, moods: [T.nature, T.history, T.desert] },
  { name: "دامغان", province: "سمنان", tagline: "مسجد تاریخانه و بادگیر", highlights: ["مسجد تاریخانه", "بازار دامغان", "تپه‌حصار"], bestFor: ["تاریخ"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history] },
  { name: "گنبد کاووس", province: "گلستان", tagline: "برج قابوس و ترکمن‌صحرا", highlights: ["گنبد قابوس", "بازار ترکمن", "دشت گلستان"], bestFor: ["تاریخ"], bestSeason: "فروردین تا آبان", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history, T.desert] },

  // ------------------------------------------------ added in the full-city pass
  { name: "آمل", province: "مازندران", tagline: "شهر هراز، برنج و جنگل‌های بلند", highlights: ["پل معلق آمل", "بازار قدیم و برنج محلی", "جنگل و آبشارهای اطراف"], bestFor: ["طبیعت‌گردی", "سفر خانوادگی"], bestSeason: "اردیبهشت تا شهریور", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.nature, T.city] },
  { name: "بابل", province: "مازندران", tagline: "شهری زنده با بازار بزرگ و دسترسی به جنگل و دریا", highlights: ["بازار بابل", "دریاچه و جنگل‌های اطراف", "بقعهٔ امیر کبیر"], bestFor: ["سفر خانوادگی", "خرید"], bestSeason: "اردیبهشت تا شهریور", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.city, T.nature] },
  { name: "بهشهر", province: "مازندران", tagline: "باغ عباس‌آباد و جنگل‌های هزارجریب", highlights: ["باغ عباس‌آباد", "غار هوتو و کمربند", "جنگل هزارجریب"], bestFor: ["طبیعت‌گردی", "تاریخ"], bestSeason: "اردیبهشت تا شهریور", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.history, T.nature] },
  { name: "تنکابن", province: "مازندران", tagline: "باغ‌های مرکبات، دریا و کوه", highlights: ["ساحل تنکابن", "باغ‌های مرکبات", "جادهٔ کوهستانی و روستاهای اطراف"], bestFor: ["سفر ساحلی", "طبیعت‌گردی"], bestSeason: "خرداد تا شهریور", suggestedDays: 2, dailyCostToman: 750_000, moods: [T.coast, T.nature] },
  { name: "خلخال", province: "اردبیل", tagline: "ارتفاعات، چشمه و روستاهای پلکانی", highlights: ["منطقهٔ گردشگری خلخال", "روستاهای کوهستانی", "چشمه‌های آب گرم"], bestFor: ["طبیعت‌گردی", "کوهنوردی"], bestSeason: "خرداد تا شهریور", suggestedDays: 2, dailyCostToman: 650_000, moods: [T.mountain, T.nature] },
  { name: "بوکان", province: "آذربایجان غربی", tagline: "شهری آرام با تپه‌های باستانی اطراف", highlights: ["تپهٔ باستانی بوکان", "بازار شهر", "طبیعت دشت‌های اطراف"], bestFor: ["سفر آرام", "تاریخ"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.history, T.city] },
  { name: "میانه", province: "آذربایجان شرقی", tagline: "راه‌آهن، باغ و کوه‌های میانه", highlights: ["بازار میانه", "طبیعت کوهستانی اطراف", "راه‌آهن تاریخی منطقه"], bestFor: ["سفر آرام", "طبیعت‌گردی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.mountain, T.city] },
  { name: "نهاوند", province: "همدان", tagline: "سراب‌ها و تاریخ ماد", highlights: ["سراب گیان", "تپهٔ باستانی نوشیجان", "بازار نهاوند"], bestFor: ["تاریخ", "طبیعت‌گردی"], bestSeason: "فروردین تا مهر", suggestedDays: 2, dailyCostToman: 550_000, moods: [T.history, T.nature] },
  { name: "ملایر", province: "همدان", tagline: "تخته‌نرد و انگور", highlights: ["بازار ملایر", "تپهٔ باستانی نوشیجان در نزدیکی", "باغ‌های انگور اطراف"], bestFor: ["سفر آرام", "غذاشناسی"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.city, T.history] },
  { name: "بهبهان", province: "خوزستان", tagline: "نخل، رود و راه کهگیلویه", highlights: ["رود مارون", "بازار و خوراک محلی", "طبیعت حاشیهٔ زاگرس"], bestFor: ["طبیعت‌گردی", "سفر آرام"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.nature, T.city] },
  { name: "سیرجان", province: "کرمان", tagline: "پسته، قالی و بادگیرهای کویری", highlights: ["بازار سیرجان", "قلعهٔ سنگ", "باغ‌های پستهٔ اطراف"], bestFor: ["سفر آرام", "تاریخ"], bestSeason: "مهر تا فروردین", suggestedDays: 2, dailyCostToman: 600_000, moods: [T.history, T.desert] },
  { name: "خوانسار", province: "اصفهان", tagline: "چشمه، گل و آبشار در دامنه", highlights: ["چشمهٔ خوانسار", "بازار و بافت قدیم", "آبشار و باغ‌های اطراف"], bestFor: ["طبیعت‌گردی", "سفر آرام"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.nature] },
  { name: "محلات", province: "مرکزی", tagline: "گل و سنگ، شهری آرام در مرکز ایران", highlights: ["بازار محلات", "چشمه و باغ‌های گل", "معادن سنگ و کارگاه‌های تراش"], bestFor: ["سفر آرام", "طبیعت‌گردی"], bestSeason: "فروردین تا مهر", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.nature, T.city] },
  { name: "ابهر", province: "زنجان", tagline: "شهر تاریخی ابهررود", highlights: ["بازار ابهر", "تپه‌های باستانی دشت ابهر", "طبیعت کوهستانی اطراف"], bestFor: ["سفر آرام", "تاریخ"], bestSeason: "اردیبهشت تا مهر", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.history, T.mountain] },
  { name: "قائن", province: "خراسان جنوبی", tagline: "زعفران، بادگیر و کویر", highlights: ["بازار قائن", "بافت تاریخی و بادگیرها", "مزارع زعفران اطراف"], bestFor: ["سفر آرام", "کویر"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.desert, T.history] },
  { name: "مهریز", province: "یزد", tagline: "باغ‌های پهلوان‌پور و قلعه‌های خشتی", highlights: ["باغ پهلوان‌پور", "قلعهٔ سریزد", "بافت تاریخی مهریز"], bestFor: ["تاریخ", "عکاسی"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.history, T.desert] },
  { name: "ابرکوه", province: "یزد", tagline: "سرو کهن و خانه‌های خشتی", highlights: ["سرو ابرکوه", "بافت تاریخی و خانه‌های خشتی", "یخچال خشتی"], bestFor: ["تاریخ", "عکاسی"], bestSeason: "مهر تا فروردین", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.history, T.desert] },
  { name: "مرودشت", province: "فارس", tagline: "دروازهٔ تخت جمشید و نقش رستم", highlights: ["تخت جمشید", "نقش رستم", "دشت مرودشت و باغ‌های اطراف"], bestFor: ["تاریخ", "سفر فرهنگی"], bestSeason: "اسفند تا اردیبهشت", suggestedDays: 2, dailyCostToman: 700_000, moods: [T.history] },
  { name: "میناب", province: "هرمزگان", tagline: "نخل، آبنما و بازار جنوبی", highlights: ["قلعهٔ میناب", "بازار و خوراک جنوبی", "نخلستان‌های اطراف"], bestFor: ["سفر آرام", "غذاشناسی"], bestSeason: "آبان تا فروردین", suggestedDays: 1, dailyCostToman: 550_000, moods: [T.city, T.coast] },
  { name: "پلدختر", province: "لرستان", tagline: "پل‌های تاریخی و درهٔ سیمره", highlights: ["پل‌های تاریخی پلدختر", "درهٔ سیمره", "طبیعت زاگرس"], bestFor: ["طبیعت‌گردی", "تاریخ"], bestSeason: "فروردین تا مهر", suggestedDays: 1, dailyCostToman: 500_000, moods: [T.nature, T.history] },
];

/** Names that are not in Iran; they exist in provider directories only. */
export const NON_IRANIAN_NAMES = ["کربلا", "وان", "نخجوان", "نجف", "کربلاء", "استانبول", "دبی"];

/**
 * Only cities a provider can actually search are kept: a suggestion that leads
 * to «برای این شهر اقامتگاه پیدا نشد» would be a broken promise.
 */
const PROVIDER_CITIES = new Set(IRANIAN_CITIES.map((city) => city.name));
/** Cities the ticket and hotel providers do not list, but a traveller may still want. */
const CURATED_ONLY = new Set([
  "لاهیجان", "انزلی", "ماسوله", "بابلسر", "چالوس", "سرعین", "مریوان", "الموت",
  "خرم‌آباد", "بروجرد", "سوسنگرد", "هرمز", "خورموج", "نایین", "نطنز", "مبارکه",
  "گلپایگان", "قائن", "طالقان", "گنبد کاووس",
]);

const indexed = new Map<string, CityProfile>();
for (const profile of CITY_PROFILES) {
  if (!profile.tagline || profile.suggestedDays === 0) continue;
  if (NON_IRANIAN_NAMES.includes(profile.name)) continue;
  if (!PROVIDER_CITIES.has(profile.name) && !CURATED_ONLY.has(profile.name)) continue;
  if (!indexed.has(profile.name)) indexed.set(profile.name, profile);
}

/** The full, deduplicated list of cities Safarino can recommend. */
export const PROFILED_CITIES: CityProfile[] = Array.from(indexed.values());

export function profileFor(name: string | null | undefined): CityProfile | null {
  if (typeof name !== "string") return null;
  return indexed.get(name.trim()) || null;
}

/** A rough, honest cost of the whole trip for the suggested days. */
export function estimatedTripCost(profile: CityProfile, days: number, travellers: number): number {
  const nights = Math.max(1, days - 1);
  const daily = profile.dailyCostToman * Math.max(1, days) * Math.max(1, travellers);
  // A room is priced per night, not per person; this is the planning figure.
  const stay = 900_000 * nights;
  return Math.round(daily + stay);
}
