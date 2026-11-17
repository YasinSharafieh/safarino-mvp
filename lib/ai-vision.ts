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


/* ------------------------------------------------------------------ receipts */

export type ReadReceiptResult = {
  ok: boolean;
  fields: {
    /** What was bought, as the receipt itself words it. */
    title: string | null;
    vendor: string | null;
    toman: number | null;
    category: "transport" | "stay" | "food" | "activity" | "shopping" | "other" | null;
    /** Gregorian ISO date printed on the receipt, if it had one. */
    date: string | null;
  };
  unread: string[];
  note: string;
};

const CATEGORY_WORDS: { category: NonNullable<ReadReceiptResult["fields"]["category"]>; pattern: RegExp }[] = [
  { category: "transport", pattern: /(تاکسی|اسنپ|تپسی|بلیت|پرواز|قطار|اتوبوس|بنزین|مترو|فرودگاه|سوخت)/ },
  { category: "stay", pattern: /(هتل|اقامت|اتاق|سوئیت|ویلا|بومگردی|مینی‌بار)/ },
  { category: "food", pattern: /(رستوران|کافه|غذا|چای|آبمیوه|بستنی|قنادی|نان|صبحانه|ناهار|شام|فست)/ },
  { category: "activity", pattern: /(موزه|بازدید|بلیط|تفریح|تور|شهربازی|آکواریوم|پارک)/ },
  { category: "shopping", pattern: /(سوغات|خرید|فروشگاه|بازار|پوشاک|صنایع)/ },
];

/**
 * Reads a receipt photo. Same discipline as the ticket reader: only what is
 * visible, every field re-checked here, and anything unclear is named instead of
 * guessed. A receipt is written into the traveller's own book — never uploaded
 * anywhere except the one model call that reads it.
 */
export async function readReceiptImage(input: { dataUrl: string; mime?: string }): Promise<ReadReceiptResult> {
  const system =
    "تو یک خوانندهٔ دقیق رسید و فاکتور فارسی هستی. فقط چیزی را می‌خوانی که در تصویر دیده می‌شود. اگر مبلغ یا فروشنده خوانا نیست null برمی‌گردانی و در unread می‌نویسی. مبلغ ریال را به تومان تبدیل می‌کنی (تقسیم بر ۱۰). فقط JSON معتبر می‌نویسی.";

  const prompt = `این تصویر یک رسید، فاکتور یا قبض است. این فیلدها را استخراج کن:
{"title":"شرح خرید یا خدمات"|null,
 "vendor":"نام فروشنده یا رستوران یا تاکسی"|null,
 "price":"مبلغ نهایی به تومان، فقط رقم"|null,
 "category":"transport"|"stay"|"food"|"activity"|"shopping"|"other"|null,
 "date_iso":"YYYY-MM-DD"|null,
 "unread":["هر چیزی که خوانا نبود"]}

قواعد: اگر تصویر رسید سفر نیست (مثلاً عکس شخصی)، همه را null بگذار و در unread بنویس «رسید شناسایی نشد». مبلغ کل را بده، نه جمع جزء‌ها، مگر اینکه کل خوانا نباشد.`;

  const raw = await askJson({
    task: "vision",
    title: "Safarino Receipt Reader",
    system,
    prompt,
    image: { dataUrl: input.dataUrl, mime: input.mime },
    maxTokens: 320,
    temperature: 0.1,
  });

  return normalizeReceiptReading((raw || {}) as Record<string, unknown>);
}

/** All the rules about a receipt reading, separated so they can be tested free. */
export function normalizeReceiptReading(body: Record<string, unknown>): ReadReceiptResult {
  const unread: string[] = [];
  const reported = Array.isArray(body.unread)
    ? body.unread.filter((item): item is string => typeof item === "string").slice(0, 5).map((item) => shortText(item, 60))
    : [];

  const toman = latinNumber(body.price);
  const vendorText = shortText(body.vendor, 60) || null;
  const rawTitle = shortText(body.title, 60) || null;

  // The category: the model's own answer first, then the words on the receipt.
  const haystack = `${rawTitle || ""} ${vendorText || ""}`;
  const guessed = CATEGORY_WORDS.find((entry) => entry.pattern.test(haystack))?.category || null;
  const allowed = ["transport", "stay", "food", "activity", "shopping", "other"];
  const category = typeof body.category === "string" && allowed.includes(body.category)
    ? (body.category as ReadReceiptResult["fields"]["category"])
    : guessed;

  let date: string | null = null;
  if (typeof body.date_iso === "string" && isIsoDate(body.date_iso)) date = body.date_iso;

  if (!toman) unread.push("مبلغ");
  if (!vendorText && !rawTitle) unread.push("فروشنده یا شرح خرید");
  if (!category) unread.push("دستهٔ خرج");

  const ok = Boolean(toman);
  return {
    ok,
    fields: {
      title: rawTitle || (category ? `${vendorText || ""}`.trim() || null : null),
      vendor: vendorText,
      toman,
      category: category || null,
      date,
    },
    unread: Array.from(new Set([...reported, ...unread])).slice(0, 5),
    note: ok
      ? "مبلغ از تصویر خوانده شد؛ هر چیزی که مطمئن نبودم خالی گذاشتم."
      : "مبلغ در این تصویر خوانا نبود؛ می‌توانی خودت عدد را بنویسی.",
  };
}
