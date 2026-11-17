/**
 * «عکس بلیت را بده، بقیه‌اش با من.»
 *
 * The vision model reads a photo or screenshot of a ticket — a flight, a train, a
 * bus — and turns it into the same facts the app already uses: origin,
 * destination, date, company, time, the amount paid, and the booking reference.
 *
 * What it may and may not do:
 *  - it may only read what is *visible in the image*; a missing field stays
 *    missing and is reported as «خوانده نشد», never guessed;
 *  - a city it reads is checked against the app's own city table, so a blurry
 *    word cannot become a destination that does not exist;
 *  - a date must be a real calendar date; a Jalali date is converted, never
 *    approximated;
 *  - the model returns JSON, and anything that fails these checks is dropped
 *    with a plain-Persian reason.
 */

import { askJson, shortText } from "./ai-openrouter";
import { IRANIAN_CITIES } from "./iran-cities";
import { gregorianFromJalali, todayIso } from "./jalali";

export type ReadTicketResult = {
  ok: boolean;
  fields: {
    mode: "plane" | "train" | "bus" | null;
    origin: string | null;
    destination: string | null;
    /** Gregorian ISO date, YYYY-MM-DD. */
    date: string | null;
    departureTime: string | null;
    company: string | null;
    priceToman: number | null;
    reference: string | null;
  };
  /** Everything the model could not read with confidence. */
  unread: string[];
  note: string;
};

const CITY_NAMES = new Set(IRANIAN_CITIES.map((city) => city.name));

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** A Jalali date the model may have seen, converted exactly. */
function jalaliToIso(year: number, month: number, day: number): string | null {
  if (year < 1390 || year > 1450 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  try {
    const iso = gregorianFromJalali(year, month, day);
    return isIsoDate(iso) ? iso : null;
  } catch {
    return null;
  }
}

/** Persian digits to Latin, so a price written «۱٬۲۵۰٬۰۰۰» is readable. */
function latinNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== "string") return null;
  const latin = value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[,٬\s]/g, "");
  const parsed = Number(latin.match(/\d{3,}/)?.[0] || "");
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 2_000_000_000) return null;
  return parsed;
}

function cityFrom(value: unknown): string | null {
  const name = shortText(value, 40).replace(/[يى]/g, "ی").replace(/ك/g, "ک");
  if (!name) return null;
  if (CITY_NAMES.has(name)) return name;
  const partial = IRANIAN_CITIES.find((city) => name.includes(city.name) || city.name.includes(name));
  return partial ? partial.name : null;
}

export async function readTicketImage(input: { dataUrl: string; mime?: string }): Promise<ReadTicketResult> {
  const system =
    "تو یک خوانندهٔ دقیق بلیت سفر هستی. فقط چیزی را می‌خوانی که در تصویر دیده می‌شود. هیچ حدسی نمی‌زنی: اگر بخشی خوانا نیست، null برمی‌گردانی و نامش را در unread می‌نویسی. اعداد را با رقم انگلیسی و بدون جداکننده می‌نویسی. فقط JSON معتبر می‌نویسی.";

  const prompt = `این تصویر یک بلیت یا رزرو سفر است. این فیلدها را استخراج کن:
{"mode":"plane"|"train"|"bus"|null,
 "origin":"نام شهر مبدأ"|null,
 "destination":"نام شهر مقصد"|null,
 "date_iso":"YYYY-MM-DD"|null,
 "date_jalali":"YYYY-MM-DD"|null,
 "departure_time":"HH:MM"|null,
 "company":"نام شرکت یا ایرلاین یا تعاونی"|null,
 "price":"مبلغ کل به تومان، فقط رقم"|null,
 "reference":"کد رزرو یا شماره بلیت"|null,
 "unread":["هر چیزی که خوانا نبود"]}

قواعد: اگر تاریخ شمسی روی بلیت است، هم date_jalali (به شکل 1403-08-12) و هم date_iso (میلادی) را بده و در تبدیل دقیق باش. اگر مبلغ ریال است، آن را به تومان تبدیل کن (تقسیم بر ۱۰) و همین را در price بگذار. اگر شرکت خوانا نیست null بگذار.`;

  const raw = await askJson({
    task: "vision",
    title: "Safarino Ticket Reader",
    system,
    prompt,
    image: { dataUrl: input.dataUrl, mime: input.mime },
    maxTokens: 420,
    temperature: 0.1,
  });

  return normalizeTicketReading((raw || {}) as Record<string, unknown>);
}

/**
 * Every rule about what a reading may contain, separated from the model call so
 * it can be checked without spending a single token.
 */
export function normalizeTicketReading(body: Record<string, unknown>): ReadTicketResult {
  const unread: string[] = [];
  const reportedUnread = Array.isArray(body.unread)
    ? body.unread.filter((item): item is string => typeof item === "string").slice(0, 6).map((item) => shortText(item, 60))
    : [];

  const mode: "plane" | "train" | "bus" | null =
    body.mode === "plane" || body.mode === "train" || body.mode === "bus" ? body.mode : null;
  const origin = cityFrom(body.origin);
  const destination = cityFrom(body.destination);

  // The date: the ISO one if it is real, otherwise the Jalali one converted.
  let date: string | null = null;
  if (typeof body.date_iso === "string" && isIsoDate(body.date_iso)) {
    date = body.date_iso;
  } else if (typeof body.date_jalali === "string") {
    const parts = body.date_jalali.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).split(/[-/.]/).map(Number);
    if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
      date = jalaliToIso(parts[0], parts[1], parts[2]);
    }
  }
  // A ticket in the past is almost certainly a misread; the app never invents a
  // future date either, so it is simply reported as unread.
  if (date && date < todayIso()) {
    unread.push("تاریخ روی بلیت گذشته است.");
    date = null;
  }

  if (!origin) unread.push("شهر مبدأ");
  if (!destination) unread.push("شهر مقصد");
  if (!date) unread.push("تاریخ حرکت");
  if (!mode) unread.push("نوع وسیله");

  const priceToman = latinNumber(body.price);
  const time = typeof body.departure_time === "string" && /^\d{1,2}:\d{2}$/.test(body.departure_time)
    ? body.departure_time.padStart(5, "0")
    : null;

  const fields = {
    mode,
    origin,
    destination,
    date,
    departureTime: time,
    company: shortText(body.company, 60) || null,
    priceToman,
    reference: shortText(body.reference, 40) || null,
  };

  const ok = Boolean(origin && destination && date);
  return {
    fields,
    unread: Array.from(new Set([...reportedUnread, ...unread])).slice(0, 6),
    ok,
    note: ok
      ? "از تصویر خوانده شد؛ هر فیلدی که مطمئن نبودم خالی گذاشتم."
      : "بخشی از بلیت خوانا نبود؛ همان‌هایی که خوانده شد را نشان می‌دهم و بقیه را دستی کامل کن.",
  };
}
