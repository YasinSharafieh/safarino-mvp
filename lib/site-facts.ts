/**
 * «هر عددی که سایت به کاربر می‌گوید، از دادهٔ واقعی می‌آید» — one source of truth.
 *
 * The home page used to say «۱۵۶ شهر ایران» while the city list really held ۲۱۱:
 * a marketing number typed by hand drifts away from the data the moment the data
 * grows. This file derives every public claim from the code that actually does the
 * work — the city list, the provider lists, the mood list, the journey's steps — so
 * a claim can never be bigger or smaller than the product.
 *
 * Rule: if a number appears in the interface, it is computed here, and
 * `scripts/test-round41.ts` checks the pages really use it instead of typing it.
 */

import { IRANIAN_CITIES } from "./iran-cities";
import { DISCOVER_MOODS } from "./discover";

/** The accommodation providers with a live search, in the order they are tried. */
export const ACCOMMODATION_SOURCES = ["علی‌بابا", "جاجیگا", "جاباما", "اسنپ‌تریپ", "اتاقک", "اقامت۲۴"] as const;

/** The ticket providers with a live search. */
export const TICKET_SOURCES = ["علی‌بابا", "سفر۷۲۴"] as const;

/**
 * The journey, in the words the traveller uses — not the words of the database.
 * Every page's stepper is built from this list, so the same five steps appear
 * everywhere and «برنامه» never means two different pages.
 */
export type JourneyStep = { number: string; label: string; href: string; promise: string };

export const JOURNEY_STEPS: JourneyStep[] = [
  { number: "۱", label: "مقصد و تاریخ", href: "/start/cities", promise: "از کجا، به کجا، چه روزی و با چه بودجه‌ای" },
  { number: "۲", label: "بلیت", href: "/transport", promise: "قطار، هواپیما، اتوبوس یا ماشین خودت" },
  { number: "۳", label: "اقامتگاه", href: "/accommodation", promise: "هتل یا خانه، با قیمت واقعی همان تاریخ" },
  { number: "۴", label: "برنامهٔ روزها", href: "/plan", promise: "جاذبه‌های واقعی، ساعت‌به‌ساعت" },
  { number: "۵", label: "دفترچهٔ سفر", href: "/itinerary", promise: "خرج، چک‌لیست، آفلاین و PDF" },
];

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

/** Everything the marketing copy is allowed to claim, computed from the code. */
export const SITE_FACTS = {
  /** How many cities the picker really offers. */
  cities: IRANIAN_CITIES.length,
  citiesLabel: fa(IRANIAN_CITIES.length),
  accommodationSources: ACCOMMODATION_SOURCES.length,
  accommodationSourcesLabel: fa(ACCOMMODATION_SOURCES.length),
  ticketSources: TICKET_SOURCES.length,
  ticketSourcesLabel: fa(TICKET_SOURCES.length),
  /** All live sources, accommodation and tickets together. */
  liveSources: ACCOMMODATION_SOURCES.length + TICKET_SOURCES.length,
  liveSourcesLabel: fa(ACCOMMODATION_SOURCES.length + TICKET_SOURCES.length),
  moods: DISCOVER_MOODS.length,
  moodsLabel: fa(DISCOVER_MOODS.length),
  steps: JOURNEY_STEPS.length,
  stepsLabel: fa(JOURNEY_STEPS.length),
} as const;

/**
 * The four numbers on the home page. Each one is a fact about the product, and
 * each is produced by the same data the rest of the site runs on.
 */
export function homeStats() {
  return [
    { value: SITE_FACTS.citiesLabel, label: "شهر ایران برای مبدأ و مقصد" },
    { value: SITE_FACTS.accommodationSourcesLabel, label: "منبع اقامت با جست‌وجوی زنده" },
    { value: SITE_FACTS.ticketSourcesLabel, label: "منبع بلیت با قیمت زنده" },
    { value: SITE_FACTS.moodsLabel, label: "حالت سفر در بخش کشف" },
  ];
}

/** One honest line about the promise of the site, used where a number is not. */
export const HONESTY_LINE = "هر عدد یا از منبع رسمی آمده، یا «تخمین با فرض شما» برچسب خورده است.";
