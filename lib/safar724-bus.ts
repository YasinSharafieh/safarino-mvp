import { jalaliFromGregorian } from "./jalali";
import { citySlug, type TransportOffer, type TransportSearchResult } from "./transport-types";
import { siteReference } from "./site";

/**
 * Safar724 publishes its dated intercity-bus list through a public, no-auth
 * service host. This module only reads that public list; it never books and
 * never guesses a price.
 */

const WEB = "https://www.safar724.com";
const SERVICE = "https://service.safar724.com";
const USER_AGENT = `Mozilla/5.0 (compatible; ${siteReference()})`;
const DIGITS = /[۰-۹٠-٩]/g;

type RouteCodes = { originCode: string; destinationCode: string };

function toAsciiDigits(value: string): string {
  return value.replace(DIGITS, (digit) => {
    const code = digit.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    return String(code - 0x0660);
  });
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

export function safar724RoutePage(originSlug: string, destinationSlug: string): string {
  return `${WEB}/bus/${originSlug}-${destinationSlug}`;
}

/** The public route page serialises the exact numeric city codes; read them, never invent them. */
export function parseRouteCodes(html: string, originSlug: string, destinationSlug: string): RouteCodes | null {
  const pattern = /\\?"origin\\?":\{[^{}]*?\\?"engName\\?":\\?"([^"\\]+)\\?"[^{}]*?\\?"code\\?":\\?"(\d+)\\?"\}[,\s]*\\?"destination\\?":\{[^{}]*?\\?"engName\\?":\\?"([^"\\]+)\\?"[^{}]*?\\?"code\\?":\\?"(\d+)\\?"/g;
  const matches = html.match(pattern) ?? [];
  const globalPattern = new RegExp(pattern.source, "g");
  let match: RegExpExecArray | null;
  const pairs: RegExpExecArray[] = [];
  while ((match = globalPattern.exec(html)) !== null) {
    pairs.push(match);
    if (pairs.length > 400) break;
  }
  void matches;
  for (const item of pairs) {
    const [, originEng, originCode, destinationEng, destinationCode] = item;
    if (
      originEng.trim().toLowerCase() === originSlug
      && destinationEng.trim().toLowerCase() === destinationSlug
    ) {
      return { originCode, destinationCode };
    }
  }
  // A looser pass: codes appear near their english names in the serialised state.
  const loose = new RegExp(
    `engName\\\\?":\\\\?"${originSlug}\\\\?"[^}]*?code\\\\?":\\\\?"(\\d+)"[\\s\\S]{0,400}?engName\\\\?":\\\\?"${destinationSlug}\\\\?"[^}]*?code\\\\?":\\\\?"(\\d+)"`,
    "i",
  ).exec(html);
  if (loose) return { originCode: loose[1], destinationCode: loose[2] };
  return null;
}

function jalaliDate(isoDate: string): string {
  const jalali = jalaliFromGregorian(isoDate);
  return `${jalali.year}-${String(jalali.month).padStart(2, "0")}-${String(jalali.day).padStart(2, "0")}`;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/json" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`SAFAR724_HTTP_${response.status}`);
  return response.text();
}

type Safar724Item = {
  id?: number;
  price?: number;
  availableSeatCount?: number;
  departureTime?: string;
  arrivalTime?: string;
  departureDate?: string;
  status?: string;
  vehicleType?: string;
  companyName?: string;
  companyPersianName?: string;
  vehicleModel?: string;
  originTerminalName?: string;
  destinationTerminalName?: string;
  originCode?: string;
  destinationCode?: string;
  serviceNumber?: string;
};

export function normalizeSafar724Items(
  items: Safar724Item[],
  originSlug: string,
  destinationSlug: string,
  isoDate: string,
  bookingUrl: string,
): TransportOffer[] {
  const expectedDate = jalaliDate(isoDate).replace(/-/g, "/");
  return items.flatMap((item): TransportOffer[] => {
    const priceRial = Number(item.price);
    const seats = Number(item.availableSeatCount);
    const departureTime = toAsciiDigits(text(item.departureTime));
    const arrivalTime = toAsciiDigits(text(item.arrivalTime));
    if (!Number.isInteger(item.id) || (item.id ?? 0) <= 0) return [];
    if (!Number.isFinite(priceRial) || priceRial <= 0 || priceRial % 10 !== 0) return [];
    if (!Number.isFinite(seats) || seats <= 0) return [];
    if (item.status !== "Available") return [];
    if (item.vehicleType && item.vehicleType !== "Bus") return [];
    if (toAsciiDigits(text(item.departureDate)) !== expectedDate) return [];
    if (!/^\d{2}:\d{2}$/.test(departureTime)) return [];
    const operator = text(item.companyPersianName) || text(item.companyName) || "شرکت اتوبوسرانی";
    return [{
      id: `safar724:${item.id}`,
      provider: "safar724",
      mode: "bus",
      operator,
      serviceLabel: text(item.vehicleModel) || text(item.serviceNumber) || "اتوبوس بین‌شهری",
      departure: `${isoDate}T${departureTime}:00`,
      arrival: /^\d{2}:\d{2}$/.test(arrivalTime) ? `${isoDate}T${arrivalTime}:00` : null,
      priceToman: Math.round(priceRial / 10),
      childPriceToman: null,
      infantPriceToman: null,
      seatsLeft: Math.round(seats),
      details: [text(item.originTerminalName), text(item.destinationTerminalName)].filter(Boolean),
      bookingUrl,
      bookingNote: "قیمت هر صندلی در فهرست عمومی سفر۷۲۴ منتشر شده و به تومان تبدیل شده است؛ ظرفیت و مبلغ نهایی را پیش از پرداخت در همان صفحه کنترل کنید.",
    }];
  });
}

export async function searchSafar724Buses(
  origin: string,
  destination: string,
  isoDate: string,
): Promise<{ offers: TransportOffer[]; bookingUrl: string | null; status: "ok" | "unsupported" | "failed"; message?: string }> {
  const originSlug = citySlug(origin);
  const destinationSlug = citySlug(destination);
  if (!originSlug || !destinationSlug || originSlug === destinationSlug) {
    return { offers: [], bookingUrl: null, status: "unsupported", message: "این مسیر برای سفر۷۲۴ قابل تشخیص نبود." };
  }
  const pageUrl = safar724RoutePage(originSlug, destinationSlug);
  try {
    const html = await fetchText(pageUrl);
    const codes = parseRouteCodes(html, originSlug, destinationSlug);
    if (!codes) {
      return { offers: [], bookingUrl: pageUrl, status: "unsupported", message: "سفر۷۲۴ برای این مسیر کد شهر عمومی منتشر نکرده است." };
    }
    const query = new URLSearchParams({
      date: jalaliDate(isoDate),
      origin: codes.originCode,
      destination: codes.destinationCode,
      vehicleType: "Bus",
    });
    const response = await fetch(`${SERVICE}/cs/api/bus/route?${query.toString()}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`SAFAR724_SERVICE_HTTP_${response.status}`);
    const payload = (await response.json()) as { items?: Safar724Item[]; date?: string };
    const items = Array.isArray(payload.items) ? payload.items : [];
    const offers = normalizeSafar724Items(items, originSlug, destinationSlug, isoDate, pageUrl);
    return { offers, bookingUrl: pageUrl, status: "ok" };
  } catch (error) {
    return {
      offers: [],
      bookingUrl: pageUrl,
      status: "failed",
      message: error instanceof Error ? error.message : "SAFAR724_FAILED",
    };
  }
}

export function emptySafar724Result(origin: string, destination: string, date: string): TransportSearchResult {
  return {
    success: true,
    mode: "bus",
    origin,
    destination,
    date,
    offers: [],
    returningOffers: [],
    duplicateCount: 0,
    providerStatuses: [{ provider: "safar724", label: "سفر۷۲۴", status: "failed", count: 0, found: 0 }],
    fetchedAt: new Date().toISOString(),
  };
}
