/**
 * The cities Safarino recommends, and why.
 *
 * Only the *recommendation* is written here — «این شهر برای این نوع سفر خوب
 * است». The attractions themselves are never written by hand: they come from
 * the same real sources (Wikipedia / Wikidata / OSM) as the rest of the site,
 * so nothing in this file can put a made-up place on a page.
 */

export type DiscoverCity = {
  /** The name used everywhere else on the site (and in provider searches). */
  name: string;
  province: string;
  /** One line a traveller can decide with. */
  tagline: string;
  /** Two or three short, practical reasons. */
  highlights: string[];
  /** Who this city suits. */
  bestFor: string[];
  /** The best months to go, in plain Persian. */
  bestSeason: string;
  /** Typical number of days worth staying. */
  suggestedDays: number;
  /** A rough character, used for filtering on the page. */
  moods: DiscoverMood[];
};

export type DiscoverMood = "تاریخی" | "زیارتی" | "طبیعت" | "ساحلی" | "شهری" | "کوهستانی" | "کویری";

export const DISCOVER_MOODS: DiscoverMood[] = ["تاریخی", "زیارتی", "طبیعت", "ساحلی", "شهری", "کوهستانی", "کویری"];

export const DISCOVER_CITIES: DiscoverCity[] = [
  {
    name: "مشهد",
    province: "خراسان رضوی",
    tagline: "زیارت، موزه و باغ‌های بزرگ در یک شهر",
    highlights: ["حرم مطهر و مجموعهٔ اطراف آن", "موزه‌های آستان قدس", "بازار رضا و سوغات زعفران"],
    bestFor: ["سفر زیارتی", "سفر خانوادگی"],
    bestSeason: "بهار و پاییز؛ تابستان گرم است",
    suggestedDays: 3,
    moods: ["زیارتی", "تاریخی", "شهری"],
  },
  {
    name: "اصفهان",
    province: "اصفهان",
    tagline: "میدان‌ها، پل‌ها و معماری که تمام نمی‌شود",
    highlights: ["میدان نقش جهان و مسجدها", "پل‌های سی‌وسه‌پل و خواجو", "محلهٔ جلفا و کلیساها"],
    bestFor: ["سفر فرهنگی", "عکاسی"],
    bestSeason: "فروردین تا خرداد و مهر تا آبان",
    suggestedDays: 3,
    moods: ["تاریخی", "شهری"],
  },
  {
    name: "شیراز",
    province: "فارس",
    tagline: "شهر شعر، باغ و فاصلهٔ کوتاه تا تخت جمشید",
    highlights: ["حافظیه و سعدیه", "بازار وکیل و مسجد نصیرالملک", "تخت جمشید در یک روز"],
    bestFor: ["سفر فرهنگی", "سفر عاشقانه"],
    bestSeason: "اسفند تا اردیبهشت",
    suggestedDays: 3,
    moods: ["تاریخی", "شهری"],
  },
  {
    name: "یزد",
    province: "یزد",
    tagline: "شهر خشت و بادگیر، آرام و پیاده‌رو",
    highlights: ["بافت تاریخی و بادگیرها", "مسجد جامع و آب انبارها", "آتشکده و دخمه‌ها"],
    bestFor: ["سفر آرام", "معماری و عکاسی"],
    bestSeason: "مهر تا فروردین",
    suggestedDays: 2,
    moods: ["تاریخی", "کویری"],
  },
  {
    name: "کیش",
    province: "هرمزگان",
    tagline: "خلیج فارس، ساحل و خرید بی‌گمرک",
    highlights: ["ساحل مرجان و درخت سبز", "جزیرهٔ هندورابی و ورزش‌های آبی", "خرید و بازار"],
    bestFor: ["سفر ساحلی", "سفر خانوادگی"],
    bestSeason: "آبان تا فروردین",
    suggestedDays: 3,
    moods: ["ساحلی", "شهری"],
  },
  {
    name: "قشم",
    province: "هرمزگان",
    tagline: "بزرگ‌ترین جزیرهٔ ایران با طبیعت کم‌نظیر",
    highlights: ["درهٔ ستاره‌ها و جنگل حرا", "جزایر ناز و هنگام", "بازار قشم"],
    bestFor: ["طبیعت‌گردی", "سفر خانوادگی"],
    bestSeason: "آبان تا فروردین",
    suggestedDays: 3,
    moods: ["ساحلی", "طبیعت"],
  },
  {
    name: "تبریز",
    province: "آذربایجان شرقی",
    tagline: "بازار تاریخی، غذا و کوه‌های اطراف",
    highlights: ["بازار تاریخی تبریز", "ائل‌گلی و مسجد کبود", "کندوان و اسکند در نزدیکی"],
    bestFor: ["سفر شهری", "غذاشناسی"],
    bestSeason: "خرداد تا شهریور",
    suggestedDays: 2,
    moods: ["تاریخی", "شهری", "کوهستانی"],
  },
  {
    name: "همدان",
    province: "همدان",
    tagline: "شهر باستانی با غار و کتیبه",
    highlights: ["گنج‌نامه و آرامگاه بوعلی", "غار علیصدر در نزدیکی", "کتیبه‌های گنج‌نامه"],
    bestFor: ["تاریخ و طبیعت"],
    bestSeason: "اردیبهشت تا مهر",
    suggestedDays: 2,
    moods: ["تاریخی", "طبیعت", "کوهستانی"],
  },
  {
    name: "رشت",
    province: "گیلان",
    tagline: "سبزی شمال، باران و غذا",
    highlights: ["بازار رشت و خوراک محلی", "روستاهای اطراف و ماسوله", "ساحل نزدیک"],
    bestFor: ["طبیعت‌گردی", "سفر غذا"],
    bestSeason: "اردیبهشت تا شهریور",
    suggestedDays: 2,
    moods: ["طبیعت", "شهری"],
  },
  {
    name: "کرمان",
    province: "کرمان",
    tagline: "دروازهٔ کویر و باغ‌های تاریخی",
    highlights: ["باغ شاهزاده ماهان", "بازار و گنبد جبلیه", "کلوت‌های شهداد"],
    bestFor: ["کویرنوردی", "تاریخ"],
    bestSeason: "مهر تا فروردین",
    suggestedDays: 2,
    moods: ["کویری", "تاریخی"],
  },
  {
    name: "کرمانشاه",
    province: "کرمانشاه",
    tagline: "طاق بستان، بیستون و غارها",
    highlights: ["طاق بستان", "کتیبهٔ بیستون", "غار قوری‌قلعه در نزدیکی"],
    bestFor: ["تاریخ", "طبیعت"],
    bestSeason: "فروردین تا خرداد",
    suggestedDays: 2,
    moods: ["تاریخی", "کوهستانی"],
  },
  {
    name: "ارومیه",
    province: "آذربایجان غربی",
    tagline: "دریاچه، کلیساهای قدیمی و بازار",
    highlights: ["دریاچهٔ ارومیه", "کلیساهای اطراف", "بازار ارومیه"],
    bestFor: ["طبیعت‌گردی"],
    bestSeason: "خرداد تا شهریور",
    suggestedDays: 2,
    moods: ["طبیعت", "شهری"],
  },
];

export function findCity(name: string | null | undefined): DiscoverCity | null {
  if (typeof name !== "string") return null;
  const wanted = name.trim();
  if (!wanted) return null;
  return DISCOVER_CITIES.find((city) => city.name === wanted) || null;
}

/** Filters the city list by a mood and a free-text query (Persian, forgiving). */
export function filterCities(cities: DiscoverCity[], options: { query?: string; mood?: DiscoverMood | null }): DiscoverCity[] {
  const query = (options.query || "").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
  return cities.filter((city) => {
    if (options.mood && !city.moods.includes(options.mood)) return false;
    if (!query) return true;
    const haystack = [city.name, city.province, city.tagline, city.bestFor.join(" "), city.highlights.join(" ")]
      .join(" ")
      .replace(/[يى]/g, "ی")
      .replace(/ك/g, "ک");
    return haystack.includes(query);
  });
}
