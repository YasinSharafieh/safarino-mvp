/**
 * «بلیت و شب‌های اقامت باید با هم بخوانند».
 *
 * A traveller who lands at 23:40 on the 12th cannot use a room booked from the
 * 12th for anything but sleep — and a ticket that arrives a day after check-in
 * means a night is paid for nothing. This file compares the two real facts we
 * already have (the ticket's own clock, the room's own dates) and says what it
 * finds. Nothing is guessed: when a time is missing, it says so.
 */

export type TimingTone = "ok" | "warn" | "problem";

export type TimingIssue = {
  tone: TimingTone;
  title: string;
  body: string;
};

export type TicketStayCheck = {
  /** The hour the provider printed on the ticket, in Tehran time. */
  arrivalClock: string | null;
  arrivalDate: string | null;
  checkIn: string | null;
  checkOut: string | null;
  /** Nights the room is actually booked for. */
  nights: number | null;
  /** True when the ticket and the room describe the same trip. */
  compatible: boolean;
  issues: TimingIssue[];
  /** One sentence for the top of the plan. */
  line: string;
};

const fa = new Intl.NumberFormat("fa-IR");

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tehranDay(value: string | null | undefined): string | null {
  const date = toDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function tehranClock(value: string | null | undefined): { clock: string | null; minutes: number | null } {
  const date = toDate(value);
  if (!date) return { clock: null, minutes: null };
  const parts = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value || "";
  const minute = parts.find((part) => part.type === "minute")?.value || "";
  if (!hour || !minute) return { clock: null, minutes: null };
  const numeric = (text: string) => Number(text.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))));
  return { clock: `${hour}:${minute}`, minutes: numeric(hour) * 60 + numeric(minute) };
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function ticketStayCheck(input: {
  departure?: string | null;
  arrival?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
}): TicketStayCheck {
  const arrivalDate = tehranDay(input.arrival);
  const { clock: arrivalClock, minutes } = tehranClock(input.arrival);
  const checkIn = /^\d{4}-\d{2}-\d{2}$/.test(String(input.checkIn || "")) ? String(input.checkIn) : null;
  const checkOut = /^\d{4}-\d{2}-\d{2}$/.test(String(input.checkOut || "")) ? String(input.checkOut) : null;
  const nights = checkIn && checkOut ? dayDiff(checkIn, checkOut) : null;
  const issues: TimingIssue[] = [];

  if (checkIn && checkOut && nights !== null) {
    if (nights <= 0) {
      issues.push({
        tone: "problem",
        title: "تاریخ اقامت درست نیست",
        body: "تاریخ خروج باید بعد از تاریخ ورود باشد؛ با این دو تاریخ، اتاق عملاً صفر شب رزرو می‌شود.",
      });
    } else {
      issues.push({
        tone: "ok",
        title: `اقامت ${fa.format(nights)} شب`,
        body: `اتاق از ${checkIn} تا ${checkOut} رزرو شده است.`,
      });
    }
  }

  if (arrivalDate && checkIn) {
    const gap = dayDiff(checkIn, arrivalDate);
    if (gap > 0) {
      issues.push({
        tone: "problem",
        title: "بلیت دیرتر از شروع اقامت می‌رسد",
        body: `بلیت شما ${fa.format(gap)} روز بعد از تاریخ ورودِ اتاق می‌رسد؛ یعنی ${fa.format(gap)} شب از اقامت را بدون استفاده پرداخت می‌کنید. تاریخ اقامت را با تاریخ بلیت هم‌تراز کنید.`,
      });
    } else if (gap < 0) {
      issues.push({
        tone: "warn",
        title: "اتاق دیرتر از بلیت شروع می‌شود",
        body: `شما ${fa.format(Math.abs(gap))} روز پیش از شروع اقامت می‌رسید؛ برای آن شب‌ها جای خواب جدا لازم است.`,
      });
    } else if (minutes !== null && minutes >= 22 * 60) {
      issues.push({
        tone: "warn",
        title: "ورود شب‌هنگام",
        body: `بلیت ساعت ${arrivalClock} می‌رسد؛ شب اول فقط برای خواب است، پس برنامهٔ روز اول را سبک بچینید.`,
      });
    } else if (minutes !== null) {
      issues.push({
        tone: "ok",
        title: "هم‌زمانی بلیت و اقامت",
        body: `بلیت ساعت ${arrivalClock} می‌رسد و همان روز اقامت شروع می‌شود؛ شب اول کامل در اختیار شماست.`,
      });
    }
  }

  if (!input.arrival) {
    issues.push({
      tone: "warn",
      title: "ساعت رسیدن در بلیت نیست",
      body: "منبع بلیت برای این گزینه ساعت رسیدن اعلام نکرده؛ برنامهٔ روز اول با زمان تقریبی چیده شده و حدس زده نمی‌شود.",
    });
  }

  const problem = issues.some((issue) => issue.tone === "problem");
  const warn = issues.some((issue) => issue.tone === "warn");
  return {
    arrivalClock,
    arrivalDate,
    checkIn,
    checkOut,
    nights,
    compatible: !problem,
    issues,
    line: problem
      ? "بلیت و تاریخ اقامت با هم نمی‌خوانند؛ قبل از پرداخت اصلاحش کنید."
      : warn
        ? "بلیت و اقامت هم‌راستا هستند، با یک نکتهٔ کوچک که پایین نوشته شده."
        : "بلیت و شب‌های اقامت با هم می‌خوانند.",
  };
}
