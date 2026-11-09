export type JalaliDate = {
  year: number;
  month: number;
  day: number;
};

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

const persianDigits = new Intl.NumberFormat("fa-IR", { useGrouping: false });

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => persianDigits.format(Number(digit)));
}

export function jalaliFromGregorian(date: string): JalaliDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("INVALID_GREGORIAN_DATE");
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(`${date}T12:00:00Z`));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const result = { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
  if (!result.year || !result.month || !result.day) throw new Error("INVALID_GREGORIAN_DATE");
  return result;
}

/** Convert a Jalali calendar date to an ISO Gregorian date, then verify the round trip. */
export function gregorianFromJalali(year: number, month: number, day: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error("INVALID_JALALI_DATE");
  }
  if (year < 1200 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error("INVALID_JALALI_DATE");
  }

  // Arithmetic Jalali conversion; the Intl round-trip below rejects invalid leap days.
  const jy = year + 1595;
  let days = -355668 + 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + day;
  days += month < 7 ? (month - 1) * 31 : (month - 7) * 30 + 186;
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const leap = gy % 4 === 0 && gy % 100 !== 0 || gy % 400 === 0;
  const monthLengths = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  while (gm <= 12 && gd > monthLengths[gm]) {
    gd -= monthLengths[gm];
    gm += 1;
  }
  if (gm > 12) throw new Error("INVALID_JALALI_DATE");
  const iso = `${String(gy).padStart(4, "0")}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
  const check = jalaliFromGregorian(iso);
  if (check.year !== year || check.month !== month || check.day !== day) throw new Error("INVALID_JALALI_DATE");
  return iso;
}

export function jalaliMonthDays(year: number, month: number): number {
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  try {
    gregorianFromJalali(year, 12, 30);
    return 30;
  } catch {
    return 29;
  }
}

export function addDaysToIso(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatJalaliDate(date: string): string {
  const value = jalaliFromGregorian(date);
  return `${toPersianDigits(value.day)} ${JALALI_MONTHS[value.month - 1]} ${toPersianDigits(value.year)}`;
}

export function formatProviderDateTime(value: string): string {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (!match) return value;
  return `${formatJalaliDate(match[1])} · ساعت ${toPersianDigits(match[2])}`;
}
