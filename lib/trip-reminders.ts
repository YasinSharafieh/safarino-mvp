/**
 * «یادآورهای پیش از سفر» — everything the trip itself says is still missing.
 *
 * The point of this file is that nothing in it is a generic tip. Every reminder
 * is a *condition* read from the traveller's own trip: a return date without a
 * return ticket, a departure in three days with no room booked, a budget that the
 * chosen ticket and room already exceed, rain forecast on an outdoor day, a party
 * with children and a long road leg.
 *
 * If a condition is not true, the reminder does not exist. Nothing is invented to
 * look busy, and every reminder carries the action that fixes it.
 */

export type ReminderSeverity = "now" | "soon" | "info";

export type Reminder = {
  id: string;
  severity: ReminderSeverity;
  title: string;
  detail: string;
  /** Where the traveller goes to fix it. */
  action?: { href: string; label: string };
  /** Only shown when the trip is already under way. */
  daysLeft?: number | null;
};

export type ReminderInput = {
  origin: string;
  destination: string;
  departureDate: string | null;
  returnDate: string | null;
  days: number;
  travellers: number;
  children: number;
  budgetToman: number;
  /** Total of the chosen ticket for the whole party, 0 when nothing chosen. */
  ticketToman: number;
  ticketLabel: string | null;
  /** Total of the chosen room for the whole stay, 0 when nothing chosen. */
  stayToman: number;
  stayLabel: string | null;
  staySkipped: boolean;
  /** Whole-trip daily costs (food, activities, city transport). */
  dailyTotalToman: number;
  /** Real forecast, when the caller has it. */
  weather?: { day: number; label: string; rainProbability: number | null; maxC: number | null }[];
  /** How outdoors each plan day is, 0–1, when the caller has a plan. */
  dayOutdoors?: number[];
  /** Today, ISO — passed in so the rules can be tested. */
  today?: string;
};

const fa = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${fa.format(Math.round(value))} تومان`;

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return NaN;
  return Math.round((to - from) / 86_400_000);
}

/**
 * The list, most urgent first. A reminder is only produced from a true condition.
 */
export function tripReminders(input: ReminderInput): Reminder[] {
  const today = input.today || new Date().toISOString().slice(0, 10);
  const reminders: Reminder[] = [];
  const party = Math.max(1, input.travellers + input.children);

  const daysLeft = input.departureDate ? daysBetween(today, input.departureDate) : null;
  const spent = input.ticketToman + input.stayToman + input.dailyTotalToman;

  // 1. The date itself. Everything else depends on it.
  if (!input.departureDate) {
    reminders.push({
      id: "no-date",
      severity: "now",
      title: "تاریخ حرکت انتخاب نشده",
      detail: "بدون تاریخ، بلیت و اتاق را نمی‌شود نهایی کرد. تاریخ را از تقویم خودت بگذار — ما تاریخی از خودمان نمی‌سازیم.",
      action: { href: "/start/cities", label: "انتخاب تاریخ" },
    });
  }

  // 2. A ticket that is still a decision, a ticket that is missing.
  if (!input.ticketToman) {
    reminders.push({
      id: "no-ticket",
      severity: daysLeft !== null && daysLeft <= 7 ? "now" : "soon",
      title: "بلیت رفت هنوز انتخاب نشده",
      detail:
        daysLeft !== null && daysLeft >= 0
          ? `${fa.format(daysLeft)} روز به حرکت مانده و بلیت رفت قطعی نشده است.`
          : "بلیت رفت را از لیست واقعی انتخاب کن تا هزینهٔ قطعی در بودجه بیاید.",
      action: { href: "/transport", label: "دیدن بلیت‌ها" },
    });
  }

  // 3. Accommodation.
  if (!input.stayToman && !input.staySkipped) {
    reminders.push({
      id: "no-stay",
      severity: daysLeft !== null && daysLeft <= 10 ? "now" : "soon",
      title: "اقامتگاه انتخاب نشده",
      detail: "اتاق را از منابع واقعی انتخاب کن؛ یا اگر مهمان داری، «بدون اقامت» را بزن تا بودجه درست بماند.",
      action: { href: "/accommodation", label: "دیدن اقامتگاه‌ها" },
    });
  }

  // 4. The money. This one is a hard fact, not advice.
  if (input.budgetToman > 0 && spent > input.budgetToman) {
    reminders.push({
      id: "over-budget",
      severity: "now",
      title: "خرج این سفر از بودجه بیشتر است",
      detail: `بلیت، اقامت و خرج روزانه جمعاً ${money(spent)} می‌شود، یعنی ${money(spent - input.budgetToman)} بیشتر از بودجهٔ ${money(
        input.budgetToman,
      )}. یا بودجه را بالا ببر یا یکی از انتخاب‌ها را ارزان‌تر کن.`,
      action: { href: "/transport", label: "جا کردن بودجه" },
    });
  } else if (input.budgetToman > 0 && spent > input.budgetToman * 0.9) {
    reminders.push({
      id: "tight-budget",
      severity: "soon",
      title: "بودجه تا آخر خط پر شده",
      detail: `از ${money(input.budgetToman)}، حدود ${money(input.budgetToman - spent)} برای خرج‌های پیش‌بینی‌نشده مانده.`,
    });
  }

  // 5. The return leg: a return date with no return ticket is the most common
  //    way a trip ends in a bus station at midnight.
  if (input.returnDate && daysLeft !== null && daysLeft >= 0) {
    reminders.push({
      id: "return-leg",
      severity: "soon",
      title: "بلیت برگشت را جدا بگیر",
      detail: `تاریخ برگشت ${input.returnDate} است. بلیت برگشت با بلیت رفت یکی نیست؛ در همان صفحهٔ بلیت، بخش «برگشت» را ببین.`,
      action: { href: "/transport", label: "بلیت برگشت" },
    });
  }

  // 6. The real forecast against the real plan.
  const weather = input.weather || [];
  const outdoors = input.dayOutdoors || [];
  weather.forEach((day, index) => {
    const rain = day.rainProbability ?? 0;
    if (rain < 55) return;
    // The forecast entry names its own day, so the plan's shares are looked up by
    // that number, never by array position.
    const outdoorShare = outdoors[Math.max(0, (day.day || index + 1) - 1)] ?? 0;
    if (outdoorShare < 0.5) return;
    reminders.push({
      id: `rain-${day.day}`,
      severity: "soon",
      title: `روز ${fa.format(day.day)} بارانی است و برنامه‌اش فضای باز دارد`,
      detail: `${day.label} با ${fa.format(rain)}٪ احتمال باران. برنامه را جابه‌جا کن یا برای آن روز جای سرپوشیده بگذار.`,
      action: { href: "/plan", label: "جابه‌جایی روزها" },
    });
  });

  // 7. Children on a long road: a real, practical caution from the trip's shape.
  if (input.children > 0 && input.days >= 5) {
    reminders.push({
      id: "kids-long-trip",
      severity: "info",
      title: "سفر بلند با کودک",
      detail: `${fa.format(input.children)} کودک و ${fa.format(input.days)} روز سفر: یک روز میانی را سبک بگذار و برنامهٔ روزانه را کوتاه‌تر کن.`,
      action: { href: "/plan", label: "برنامه" },
    });
  }

  // 8. Departure is today or tomorrow: what actually matters now.
  if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 1) {
    reminders.push({
      id: "departing",
      severity: "now",
      title: daysLeft === 0 ? "امروز حرکت است" : "فردا حرکت است",
      detail: `کارت ملی، بلیت و آدرس اقامتگاه را همراهت داشته باش. برای ${fa.format(party)} نفر ${input.ticketLabel || "بلیت"} و ${
        input.stayLabel || "اقامت"
      } ثبت شده است.`,
      action: { href: "/itinerary/print", label: "نسخهٔ چاپی" },
      daysLeft,
    });
  }

  const order: Record<ReminderSeverity, number> = { now: 0, soon: 1, info: 2 };
  return reminders.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** A one-line summary for the page header. */
export function reminderHeadline(reminders: Reminder[]): string {
  if (!reminders.length) return "هیچ کاری عقب نیست؛ سفرت آماده است.";
  const now = reminders.filter((reminder) => reminder.severity === "now").length;
  if (!now) return `${fa.format(reminders.length)} نکتهٔ کوچک برای بهتر شدن سفر هست.`;
  return `${fa.format(now)} کار هست که باید همین حالا انجام شود.`;
}
