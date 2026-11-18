/**
 * «وضعیت سفر» — the one line that answers «کجای سفرم؟».
 *
 * Every page used to show the same stepper and nothing else: the traveller had to
 * remember which city, which date, how many nights and how much money they had
 * chosen three screens ago. This file turns the shared trip into a status the
 * interface can show on every screen, and — more importantly — into **one** next
 * step, computed from what is really chosen, never from the step number.
 *
 * Rules that keep it honest:
 *  - a step is «done» only when the shared trip really holds that choice;
 *  - the next step is the first unfinished one, and its sentence says *why*;
 *  - a date the traveller has not chosen is reported as «انتخاب نشده», never
 *    filled with a guess (the one-click trip deliberately leaves it empty);
 *  - when there is no trip at all, `exists` is false and nothing is shown.
 */

export type StatusStepId = "route" | "ticket" | "stay" | "plan" | "book";

export type StatusStep = {
  id: StatusStepId;
  label: string;
  done: boolean;
  href: string;
};

export type StatusChip = {
  id: "route" | "date" | "people" | "budget" | "length";
  label: string;
  value: string;
  /** `empty` means the traveller has not chosen this yet — it is not an error. */
  tone: "ok" | "empty";
};

export type NextStep = {
  id: StatusStepId;
  title: string;
  why: string;
  href: string;
  cta: string;
};

export type TripStatus = {
  exists: boolean;
  origin: string;
  destination: string;
  chips: StatusChip[];
  steps: StatusStep[];
  doneCount: number;
  total: number;
  next: NextStep;
  /** «۲ از ۵ قدم انجام شده». */
  progressLabel: string;
  /** «۲ از ۵» — the same progress where there is no room for a sentence. */
  progressShort: string;
};

export type TripStatusInput = {
  origin?: string | null;
  destination?: string | null;
  departureDate?: string | null;
  days?: number | null;
  travelers?: number | null;
  children?: number | null;
  infants?: number | null;
  /** In millions of toman — the same unit the rest of the site stores. */
  budgetMillions?: number | null;
  /** The real chosen ticket (the stored offer object, not its id). */
  transport?: Record<string, unknown> | null;
  /** The real chosen stay, or the record of «skipped» / «already booked». */
  accommodation?: Record<string, unknown> | null;
  /** True when this device really holds a built plan. */
  hasPlan?: boolean;
  /** The Jalali label of the departure date, when the caller already has it. */
  dateLabel?: string | null;
};

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));

/** A ticket exists only when a real offer was stored — «car» is stored the same way. */
export function hasChosenTransport(transport: Record<string, unknown> | null | undefined): boolean {
  if (!transport || typeof transport !== "object") return false;
  const cost = Number(transport.cost);
  const mode = String(transport.mode || transport.vehicleId || transport.kind || "").trim();
  return Boolean(mode) && Number.isFinite(cost) && cost >= 0;
}

/**
 * A stay is «decided» when the traveller chose one, said they already booked, or
 * deliberately chose to travel without one. Undecided is not the same as absent.
 */
export function accommodationState(accommodation: Record<string, unknown> | null | undefined): "chosen" | "none" | "undecided" {
  if (!accommodation || typeof accommodation !== "object") return "undecided";
  const status = String(accommodation.status || "").trim();
  if (status === "skipped" || status === "booked" || status === "prebooked") return "none";
  if (status === "selected") return "chosen";
  if (String(accommodation.name || "").trim()) return "chosen";
  return "undecided";
}

const STEP_LABEL: Record<StatusStepId, string> = {
  route: "مقصد و تاریخ",
  ticket: "بلیت",
  stay: "اقامتگاه",
  plan: "برنامهٔ روزها",
  book: "دفترچهٔ سفر",
};

const STEP_HREF: Record<StatusStepId, string> = {
  route: "/start/cities",
  ticket: "/transport",
  stay: "/accommodation",
  plan: "/plan",
  book: "/itinerary",
};

function peopleLabel(travelers: number, children: number, infants: number): string {
  const parts: string[] = [];
  if (travelers > 0) parts.push(`${fa(travelers)} بزرگسال`);
  if (children > 0) parts.push(`${fa(children)} کودک`);
  if (infants > 0) parts.push(`${fa(infants)} نوزاد`);
  return parts.length ? parts.join(" · ") : "—";
}

export function tripStatus(input: TripStatusInput): TripStatus {
  const origin = String(input.origin || "").trim();
  const destination = String(input.destination || "").trim();
  const departureDate = String(input.departureDate || "").trim();
  const days = Math.max(0, Math.round(Number(input.days) || 0));
  const travelers = Math.max(0, Math.round(Number(input.travelers) || 0));
  const children = Math.max(0, Math.round(Number(input.children) || 0));
  const infants = Math.max(0, Math.round(Number(input.infants) || 0));
  const budgetToman = Math.max(0, Math.round((Number(input.budgetMillions) || 0) * 1_000_000));

  const routeDone = Boolean(destination && departureDate);
  const ticketDone = hasChosenTransport(input.transport);
  const stayState = accommodationState(input.accommodation);
  const stayDone = stayState !== "undecided";
  const planDone = Boolean(input.hasPlan);
  // The book is «done» once there is a plan: everything the book shows comes from it.
  const bookDone = planDone && ticketDone;

  const steps: StatusStep[] = [
    { id: "route", label: STEP_LABEL.route, done: routeDone, href: STEP_HREF.route },
    { id: "ticket", label: STEP_LABEL.ticket, done: ticketDone, href: STEP_HREF.ticket },
    { id: "stay", label: STEP_LABEL.stay, done: stayDone, href: STEP_HREF.stay },
    { id: "plan", label: STEP_LABEL.plan, done: planDone, href: STEP_HREF.plan },
    { id: "book", label: STEP_LABEL.book, done: bookDone, href: STEP_HREF.book },
  ];
  const doneCount = steps.filter((step) => step.done).length;

  const chips: StatusChip[] = [
    {
      id: "route",
      label: "مسیر",
      value: destination ? (origin && origin !== destination ? `${origin} → ${destination}` : destination) : "انتخاب نشده",
      tone: destination ? "ok" : "empty",
    },
    {
      id: "date",
      label: "تاریخ حرکت",
      value: departureDate ? input.dateLabel || departureDate : "انتخاب نشده",
      tone: departureDate ? "ok" : "empty",
    },
    {
      id: "length",
      label: "طول سفر",
      value: days ? `${fa(days)} روز` : "انتخاب نشده",
      tone: days ? "ok" : "empty",
    },
    {
      id: "people",
      label: "مسافران",
      value: peopleLabel(travelers, children, infants),
      tone: travelers + children + infants > 0 ? "ok" : "empty",
    },
    {
      id: "budget",
      label: "بودجهٔ کل",
      value: budgetToman ? `${fa(budgetToman)} تومان` : "انتخاب نشده",
      tone: budgetToman ? "ok" : "empty",
    },
  ];

  const next: NextStep = (() => {
    if (!destination) {
      return { id: "route", title: "اول مقصد را انتخاب کن", why: "تا مقصد معلوم نشود، بلیت و اقامتگاه معنی ندارد.", href: "/start/cities", cta: "انتخاب مقصد" };
    }
    if (!departureDate) {
      return { id: "route", title: "تاریخ حرکت را بگذار", why: "قیمت بلیت و موجودی اتاق برای هر تاریخ فرق می‌کند؛ تاریخ را عمداً خودت انتخاب می‌کنی، از خودم نمی‌سازم.", href: "/start/cities", cta: "انتخاب تاریخ" };
    }
    if (!ticketDone) {
      return { id: "ticket", title: "بلیت یا ماشین خودت را مشخص کن", why: `مسیر ${origin && origin !== destination ? `${origin} → ${destination}` : destination} آماده است؛ فقط وسیله مانده.`, href: "/transport", cta: "انتخاب بلیت" };
    }
    if (!stayDone) {
      return { id: "stay", title: "اقامتگاه را انتخاب یا رد کن", why: "می‌توانی هتل بگیری، بگویی از قبل رزرو کرده‌ای، یا «بدون اقامتگاه» را بزنی — هر سه ثبت می‌شوند.", href: "/accommodation", cta: "انتخاب اقامتگاه" };
    }
    if (!planDone) {
      return { id: "plan", title: "برنامهٔ روزها را بساز", why: "جاذبه‌های واقعی مقصد با فاصله و زمان رانندگی، روز به روز.", href: "/plan", cta: "ساختن برنامه" };
    }
    return { id: "book", title: "دفترچهٔ سفر آماده است", why: "خرج واقعی، چک‌لیست، بستهٔ آفلاین و نسخهٔ PDF در یک صفحه.", href: "/itinerary", cta: "دیدن دفترچه" };
  })();

  return {
    exists: Boolean(destination),
    origin,
    destination,
    chips,
    steps,
    doneCount,
    total: steps.length,
    next,
    progressLabel: `${fa(doneCount)} از ${fa(steps.length)} قدم انجام شده`,
    progressShort: `${fa(doneCount)} از ${fa(steps.length)}`,
  };
}

/** What the strip says about the stay, because «بدون اقامتگاه» is a decision too. */
export function staySummary(accommodation: Record<string, unknown> | null | undefined): string {
  const state = accommodationState(accommodation);
  if (state === "undecided") return "انتخاب نشده";
  const status = String(accommodation?.status || "");
  if (status === "skipped") return "بدون اقامتگاه (خودت انتخاب کردی)";
  if (status === "booked" || status === "prebooked") return "از قبل رزرو شده";
  return String(accommodation?.name || "انتخاب شده");
}
