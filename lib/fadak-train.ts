import { citySlug, persianCityName, type TransportOffer } from "./transport-types";

/**
 * Fadak trains publishes dated ticket cards inside its public route page
 * (Next.js server state). Only rows that agree with their visible card are
 * accepted: route, date, departure time, arrival time and per-person price.
 */

const HOST = "https://www.fadaktrains.com";
const USER_AGENT = "Mozilla/5.0 (compatible; Safarino/1.0; +https://safarino-mvp.vercel.app)";
const PERSIAN_DIGITS = /[۰-۹٠-٩]/g;
const PERSON_PRICE = /هر\s*نفر\s*([\d۰-۹٠-٩,٬]+)\s*تومان/;
const VISIBLE_SEATS = /ظرفیت\s*:\s*([\d۰-۹٠-٩,٬]+)(\+)?\s*صندلی/;

type FadakRow = {
  origin?: string;
  destination?: string;
  ownerName?: string;
  wagonName?: string;
  goingExitDate?: string;
  originMoveTime?: string;
  timeOfArrivalToDestination?: string;
  price?: number | string;
  discountPrice?: number | string;
  seatCount?: number;
  travelDuration?: number;
};

type FadakPage = {
  route?: { originKey?: string; destinationKey?: string };
  available?: FadakRow[];
  calendarDates?: { goingDate?: string; label?: string }[];
};

function toAsciiDigits(value: string): string {
  return value.replace(PERSIAN_DIGITS, (digit) => {
    const code = digit.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    return String(code - 0x0660);
  });
}

function plain(value: string): string {
  return value.replace(/\s+/g, " ").replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ").trim();
}

function number(value: unknown): number | null {
  if (typeof value === "boolean") return null;
  const parsed = Number(toAsciiDigits(String(value ?? "")).replace(/[,٬]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

export function fadakRoutePage(destinationSlug: string, originSlug: string): string {
  return `${HOST}/train/${destinationSlug}/${originSlug}-${destinationSlug}`;
}

export function extractFadakPage(html: string): FadakPage | null {
  const match = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { props?: { pageProps?: FadakPage } };
    return parsed.props?.pageProps ?? null;
  } catch {
    return null;
  }
}

/** Visible card texts in page order, used to cross-check every accepted row. */
function visibleCards(html: string): string[] {
  const cards: string[] = [];
  const pattern = /<div[^>]*class="[^"]*available-card[^"]*"[\s\S]*?(?=<div[^>]*class="[^"]*available-card|<footer|$)/g;
  for (const chunk of html.match(pattern) ?? []) {
    cards.push(plain(chunk.replace(/<[^>]+>/g, " ")));
  }
  return cards;
}

export function normalizeFadakRows(
  page: FadakPage,
  html: string,
  isoDate: string,
  persianOrigin: string,
  persianDestination: string,
  bookingUrl: string,
): TransportOffer[] {
  const rows = Array.isArray(page.available) ? page.available : [];
  if (!rows.length) return [];
  const cards = visibleCards(html);
  const dateLabels = new Map<string, string>();
  for (const item of page.calendarDates ?? []) {
    if (item && typeof item.goingDate === "string" && typeof item.label === "string") {
      dateLabels.set(item.goingDate, plain(item.label));
    }
  }
  const offers: TransportOffer[] = [];
  rows.forEach((row, index) => {
    if (!row || row.origin !== persianOrigin || row.destination !== persianDestination) return;
    if (typeof row.goingExitDate !== "string" || row.goingExitDate.slice(0, 10) !== isoDate) return;
    const departureTime = toAsciiDigits(String(row.originMoveTime ?? ""));
    const arrivalTime = toAsciiDigits(String(row.timeOfArrivalToDestination ?? ""));
    if (!/^\d{2}:\d{2}$/.test(departureTime)) return;
    const card = cards[index] ?? "";
    if (card) {
      const label = dateLabels.get(isoDate);
      if (!label || !card.includes(label)) return;
      if (!card.includes(departureTime)) return;
      if (arrivalTime && !card.includes(arrivalTime)) return;
    }
    const rawRial = number(row.discountPrice) ?? number(row.price);
    if (!rawRial || rawRial % 10 !== 0) return;
    const priceToman = Math.round(rawRial / 10);
    const displayed = card ? PERSON_PRICE.exec(card) : null;
    if (displayed) {
      const shown = number(displayed[1]);
      if (shown !== priceToman) return;
    }
    const seats = VISIBLE_SEATS.exec(card);
    const seatCount = Number(row.seatCount);
    const seatsLeft = seats && /^\+$/.test(seats[2] ?? "") === false && number(seats[1]) === seatCount ? seatCount
      : seats && number(seats[1]) ? number(seats[1])
        : Number.isFinite(seatCount) && seatCount > 0 ? seatCount : null;
    const duration = Number(row.travelDuration);
    offers.push({
      id: `fadak:${[row.ownerName, row.wagonName, isoDate, departureTime].filter(Boolean).join("-")}-${index}`,
      provider: "fadak",
      mode: "train",
      operator: (row.ownerName || "قطار").trim(),
      serviceLabel: (row.wagonName || "قطار مسافری").trim(),
      departure: `${isoDate}T${departureTime}:00`,
      arrival: /^\d{2}:\d{2}$/.test(arrivalTime) ? `${isoDate}T${arrivalTime}:00` : null,
      priceToman,
      childPriceToman: null,
      infantPriceToman: null,
      seatsLeft: seatsLeft && seatsLeft > 0 ? seatsLeft : null,
      details: [
        Number.isFinite(duration) && duration > 0 ? `${Math.floor(duration / 60)} ساعت و ${duration % 60} دقیقه` : "",
        seatsLeft && seatsLeft > 0 ? `${seatsLeft} صندلی` : "",
      ].filter(Boolean),
      bookingUrl,
      bookingNote: "نرخ هر نفر در کارت عمومی فدک با تاریخ و ساعت همان کارت تطبیق داده شده است؛ موجودی و مبلغ نهایی هنگام خرید کنترل شود.",
    });
  });
  return offers;
}

export async function searchFadakTrains(
  origin: string,
  destination: string,
  isoDate: string,
): Promise<{ offers: TransportOffer[]; bookingUrl: string | null; status: "ok" | "unsupported" | "failed"; message?: string }> {
  const originSlug = citySlug(origin);
  const destinationSlug = citySlug(destination);
  if (!originSlug || !destinationSlug || originSlug === destinationSlug) {
    return { offers: [], bookingUrl: null, status: "unsupported", message: "این مسیر برای فدک قابل تشخیص نبود." };
  }
  const pageUrl = fadakRoutePage(destinationSlug, originSlug);
  try {
    const response = await fetch(pageUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(22_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`FADAK_HTTP_${response.status}`);
    const html = await response.text();
    const page = extractFadakPage(html);
    if (!page) return { offers: [], bookingUrl: pageUrl, status: "unsupported", message: "صفحهٔ عمومی فدک برای این مسیر داده‌ای منتشر نکرده است." };
    if (page.route?.originKey !== originSlug || page.route?.destinationKey !== destinationSlug) {
      return { offers: [], bookingUrl: pageUrl, status: "unsupported", message: "فدک این مسیر را پشتیبانی نمی‌کند." };
    }
    const persianOrigin = persianCityName(origin) ?? origin;
    const persianDestination = persianCityName(destination) ?? destination;
    const offers = normalizeFadakRows(page, html, isoDate, persianOrigin, persianDestination, pageUrl);
    return { offers, bookingUrl: pageUrl, status: "ok" };
  } catch (error) {
    return {
      offers: [],
      bookingUrl: pageUrl,
      status: "failed",
      message: error instanceof Error ? error.message : "FADAK_FAILED",
    };
  }
}
