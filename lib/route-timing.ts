/**
 * «آیا این روز واقعاً جا می‌شود؟» — the honest time audit of a plan.
 *
 * The site already measures the driving legs (Neshan first, OpenStreetMap where
 * Neshan has no answer) and gives every visit a length that suits what the place
 * is. What was missing is the question a traveller asks on the road: *can this
 * day actually happen?* So this file answers it with arithmetic only:
 *
 *   start of the day + every visit + every measured drive  →  the real end time
 *
 * and it flags the exact pair of stops that cannot both fit, with the minutes the
 * drive needs and the minutes the plan leaves. Nothing here is a guess about a
 * place, a price or a road — when a leg was never measured the day is reported as
 * «تخمینی» instead of being blessed as fine.
 *
 * Two shapes are supported because the site plans in two ways:
 *   - `itineraryDayTiming` for the measured itinerary (`ItineraryDay`), where each
 *     stop carries `visitMinutes` and `legMinutes`;
 *   - `scheduleDayTiming` for the day-by-day schedule (`PlanDay`), where each item
 *     carries a clock time and a kind, and no leg has been measured.
 */

export type TimingStatus = "ok" | "tight" | "impossible" | "estimated" | "empty";

export type TimingConflict = {
  /** The stop the traveller leaves from. */
  from: string;
  /** The stop they cannot reach in time. */
  to: string;
  /** What the measured drive needs, in minutes. */
  neededMinutes: number;
  /** What the plan leaves between the two, in minutes. */
  availableMinutes: number;
};

export type DayTiming = {
  day: number;
  title: string;
  /** First stop's clock, in minutes after midnight (null when the day is empty). */
  startMinutes: number | null;
  /** When the last visit ends. */
  endMinutes: number | null;
  /** end − start, the real length of the day. */
  lengthMinutes: number;
  driveMinutes: number;
  visitMinutes: number;
  stops: number;
  /** How many legs came from a real measurement. */
  measuredLegs: number;
  totalLegs: number;
  status: TimingStatus;
  conflicts: TimingConflict[];
  /** At most three short Persian sentences, only for things the numbers show. */
  notes: string[];
};

export type TripTiming = {
  days: DayTiming[];
  impossible: number;
  tight: number;
  estimated: number;
  /** The day with the longest real length, when there is one. */
  longestDay: number | null;
  headline: string;
};

/** A day that cannot be walked: close to midnight, or a visit that never ends. */
const DAY_CAP_MINUTES = 23 * 60;
/** A day that is doable but heavy: past this, a traveller is tired, so say it. */
const TIGHT_END_MINUTES = 21 * 60 + 30;
const TIGHT_LENGTH_MINUTES = 12 * 60;
/** Room a traveller actually needs to park, walk in and find the ticket desk. */
const ARRIVAL_BUFFER_MINUTES = 10;
/** Below this, two items are effectively at the same minute. */
const MIN_GAP_MINUTES = 10;

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Persian and Arabic-Indic digits to plain ASCII, so any source can be read. */
export function normalizeDigits(value: string): string {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String(FA_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(AR_DIGITS.indexOf(digit)));
}

/** «۰۹:۳۰» → 570. Returns null for anything that is not a clock. */
export function clockMinutes(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(normalizeDigits(value).trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 24 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 570 → «۰۹:۳۰» with Persian digits, the way the rest of the site writes time. */
export function faClock(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "—";
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const rest = String(wrapped % 60).padStart(2, "0");
  return normalizeDigits(`${hours}:${rest}`).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
}

/** 155 → «۲ ساعت و ۳۵ دقیقه» — the length of a day in words. */
export function faDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes <= 0) return "—";
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
  if (!hours) return `${fa(rest)} دقیقه`;
  if (!rest) return `${fa(hours)} ساعت`;
  return `${fa(hours)} ساعت و ${fa(rest)} دقیقه`;
}

export type TimingStopShape = {
  name: string;
  startTime: string;
  visitMinutes?: number | null;
  legMinutes?: number | null;
};

type ItineraryLikeDay = {
  day: number;
  title?: string;
  stops: { startTime: string; visitMinutes?: number | null; legMinutes?: number | null; place: { name: string } }[];
};

const DEFAULT_VISIT_MINUTES = 60;

/**
 * The measured itinerary. Each stop's `legMinutes` is the drive from the stop
 * before it, measured by Neshan or OpenStreetMap; the first stop's leg is the
 * transfer from the accommodation and is not counted towards the day's start.
 */
export function itineraryDayTiming(day: ItineraryLikeDay): DayTiming {
  const stops = Array.isArray(day.stops) ? day.stops : [];
  const title = day.title || `روز ${new Intl.NumberFormat("fa-IR").format(day.day)}`;

  if (!stops.length) {
    return {
      day: day.day,
      title,
      startMinutes: null,
      endMinutes: null,
      lengthMinutes: 0,
      driveMinutes: 0,
      visitMinutes: 0,
      stops: 0,
      measuredLegs: 0,
      totalLegs: 0,
      status: "empty",
      conflicts: [],
      notes: ["این روز هنوز برنامه‌ای ندارد."],
    };
  }

  let driveMinutes = 0;
  let visitMinutes = 0;
  let measuredLegs = 0;
  let totalLegs = 0;
  const conflicts: TimingConflict[] = [];
  const notes: string[] = [];

  const shapes: TimingStopShape[] = stops.map((stop) => ({
    name: stop.place?.name || "بدون نام",
    startTime: stop.startTime,
    visitMinutes: stop.visitMinutes,
    legMinutes: stop.legMinutes,
  }));

  let cursor = clockMinutes(shapes[0]?.startTime) ?? 9 * 60;
  const startMinutes = cursor;
  const roomyGaps: { from: string; to: string; minutes: number }[] = [];

  shapes.forEach((stop, index) => {
    const visit = Number.isFinite(Number(stop.visitMinutes)) && Number(stop.visitMinutes) > 0
      ? Number(stop.visitMinutes)
      : DEFAULT_VISIT_MINUTES;
    visitMinutes += visit;
    if (index === 0) return;

    const previous = shapes[index - 1];
    const previousStart = clockMinutes(previous.startTime);
    const thisStart = clockMinutes(stop.startTime);
    const previousVisit = Number.isFinite(Number(previous.visitMinutes)) && Number(previous.visitMinutes) > 0
      ? Number(previous.visitMinutes)
      : DEFAULT_VISIT_MINUTES;
    const rawLeg = stop.legMinutes === null || stop.legMinutes === undefined ? Number.NaN : Number(stop.legMinutes);
    const leg = Number.isFinite(rawLeg) && rawLeg >= 0 ? rawLeg : null;
    totalLegs += 1;
    if (leg !== null) {
      driveMinutes += leg;
      measuredLegs += 1;
    }

    // What the plan actually leaves between finishing one visit and starting the next.
    const available = previousStart !== null && thisStart !== null ? thisStart - (previousStart + previousVisit) : null;

    if (leg !== null && available !== null) {
      if (leg > available + ARRIVAL_BUFFER_MINUTES) {
        conflicts.push({
          from: previous.name,
          to: stop.name,
          neededMinutes: Math.round(leg),
          availableMinutes: Math.max(0, Math.round(available)),
        });
      } else if (available - leg >= 90) {
        roomyGaps.push({ from: previous.name, to: stop.name, minutes: Math.round(available - leg) });
      }
    }

    // The real clock, rebuilt from the measured leg instead of trusting the draft.
    if (leg !== null) {
      cursor = cursor + previousVisit + Math.round(leg) + ARRIVAL_BUFFER_MINUTES;
    } else if (thisStart !== null) {
      // No measurement: keep the plan's own spacing, and say it is an estimate.
      cursor = Math.max(cursor + previousVisit + MIN_GAP_MINUTES, thisStart);
    } else {
      cursor = cursor + previousVisit + MIN_GAP_MINUTES;
    }
  });

  const lastVisit = Number(shapes[shapes.length - 1]?.visitMinutes) || DEFAULT_VISIT_MINUTES;
  const endMinutes = cursor + lastVisit;
  const lengthMinutes = endMinutes - startMinutes;
  const unmeasured = totalLegs - measuredLegs;

  if (unmeasured > 0) {
    notes.push(
      `زمان رانندگی ${new Intl.NumberFormat("fa-IR").format(unmeasured)} مسیر این روز اندازه‌گیری نشده؛ ساعت پایان تخمینی است.`,
    );
  }
  if (conflicts.length) {
    const first = conflicts[0];
    notes.push(
      `از «${first.from}» تا «${first.to}» رانندگی ${faDuration(first.neededMinutes)} است، ولی برنامه فقط ${faDuration(first.availableMinutes)} فاصله گذاشته.`,
    );
    if (conflicts.length > 1) {
      notes.push(`${new Intl.NumberFormat("fa-IR").format(conflicts.length - 1)} جفت توقف دیگر هم از نظر زمانی جور در نمی‌آید.`);
    }
  }
  if (startMinutes < 8 * 60) {
    notes.push("شروع روز پیش از ساعت ۸ است؛ صبحانه و بیدار شدن را هم حساب کن.");
  }
  if (endMinutes > DAY_CAP_MINUTES) {
    notes.push(`روز با این ترتیب تا ${faClock(endMinutes)} ادامه دارد؛ یعنی از نیمه‌شب می‌گذرد.`);
  } else if (endMinutes > TIGHT_END_MINUTES || lengthMinutes > TIGHT_LENGTH_MINUTES) {
    notes.push(`این روز تا ${faClock(endMinutes)} طول می‌کشد (${faDuration(lengthMinutes)}). یک توقف سبک‌تر کن.`);
  }
  const roomyGap = roomyGaps.sort((a, b) => b.minutes - a.minutes)[0];
  if (roomyGap && notes.length < 3) {
    notes.push(`بین «${roomyGap.from}» و «${roomyGap.to}» حدود ${faDuration(roomyGap.minutes)} وقت خالی مانده؛ می‌توانی یک توقف کوتاه اضافه کنی.`);
  }

  const status: TimingStatus = conflicts.length || endMinutes > DAY_CAP_MINUTES
    ? "impossible"
    : endMinutes > TIGHT_END_MINUTES || lengthMinutes > TIGHT_LENGTH_MINUTES
      ? "tight"
      : unmeasured > 0
        ? "estimated"
        : "ok";

  return {
    day: day.day,
    title,
    startMinutes,
    endMinutes,
    lengthMinutes,
    driveMinutes,
    visitMinutes,
    stops: stops.length,
    measuredLegs,
    totalLegs,
    status,
    conflicts,
    notes: notes.slice(0, 3),
  };
}

type ScheduleLikeDay = {
  day: number;
  title?: string;
  items: { time: string; title: string; type: string; poiCategory?: string }[];
};

/** Visit lengths the schedule itself uses, kept in one place. */
const SCHEDULE_VISIT_MINUTES: Record<string, number> = {
  sightseeing: 75,
  food: 60,
  activity: 90,
  rest: 45,
  transport: 30,
};

/**
 * The clock-only schedule (`PlanDay`). Here no leg has been measured, so this
 * audits the shape of the day honestly — where it starts, where it ends, how long
 * it really is, and whether two items sit on top of each other — and never claims
 * a driving time it does not have.
 */
export function scheduleDayTiming(day: ScheduleLikeDay): DayTiming {
  const items = Array.isArray(day.items) ? day.items : [];
  const title = day.title || `روز ${new Intl.NumberFormat("fa-IR").format(day.day)}`;
  if (!items.length) {
    return {
      day: day.day,
      title,
      startMinutes: null,
      endMinutes: null,
      lengthMinutes: 0,
      driveMinutes: 0,
      visitMinutes: 0,
      stops: 0,
      measuredLegs: 0,
      totalLegs: 0,
      status: "empty",
      conflicts: [],
      notes: ["این روز هنوز برنامه‌ای ندارد."],
    };
  }

  const timed = items
    .map((item) => ({ ...item, minutes: clockMinutes(item.time) }))
    .filter((item): item is typeof item & { minutes: number } => item.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes);

  if (!timed.length) {
    return {
      day: day.day,
      title,
      startMinutes: null,
      endMinutes: null,
      lengthMinutes: 0,
      driveMinutes: 0,
      visitMinutes: 0,
      stops: items.length,
      measuredLegs: 0,
      totalLegs: 0,
      status: "estimated",
      conflicts: [],
      notes: ["ساعتِ توقف‌های این روز خوانده نشد؛ ترتیب زمانی را نمی‌توانم بررسی کنم."],
    };
  }

  let visitMinutes = 0;
  const conflicts: TimingConflict[] = [];
  const notes: string[] = [];
  const overlaps: { from: string; to: string; minutes: number }[] = [];

  timed.forEach((item, index) => {
    visitMinutes += SCHEDULE_VISIT_MINUTES[item.type] ?? 60;
    if (index === 0) return;
    const previous = timed[index - 1];
    const gap = item.minutes - previous.minutes;
    if (gap < MIN_GAP_MINUTES) {
      overlaps.push({ from: previous.title, to: item.title, minutes: gap });
    }
  });

  const startMinutes = timed[0].minutes;
  const lastItem = timed[timed.length - 1];
  const endMinutes = lastItem.minutes + (SCHEDULE_VISIT_MINUTES[lastItem.type] ?? 60);
  const lengthMinutes = endMinutes - startMinutes;

  if (overlaps.length) {
    notes.push(`«${overlaps[0].from}» و «${overlaps[0].to}» تقریباً هم‌زمان‌اند (${faDuration(Math.max(0, overlaps[0].minutes))} فاصله).`);
  }
  if (endMinutes > DAY_CAP_MINUTES) {
    notes.push(`این روز تا ${faClock(endMinutes)} ادامه دارد؛ عملاً از نیمه‌شب می‌گذرد.`);
  } else if (endMinutes > TIGHT_END_MINUTES || lengthMinutes > TIGHT_LENGTH_MINUTES) {
    notes.push(`این روز ${faDuration(lengthMinutes)} طول می‌کشد؛ یکی از توقف‌ها را کوتاه‌تر کن.`);
  }
  if (lengthMinutes > 0 && timed.length < 2) {
    notes.push("این روز فقط یک توقف دارد؛ اگر دوست داری یک گزینهٔ نزدیک اضافه کن.");
  }
  notes.push("زمان رانندگی در این مرحله اندازه‌گیری نشده؛ در صفحهٔ برنامهٔ کامل، بعد از اندازه‌گیری، دقیق می‌شود.");

  const status: TimingStatus =
    endMinutes > DAY_CAP_MINUTES ? "impossible" : overlaps.length || endMinutes > TIGHT_END_MINUTES || lengthMinutes > TIGHT_LENGTH_MINUTES ? "tight" : "estimated";

  return {
    day: day.day,
    title,
    startMinutes,
    endMinutes,
    lengthMinutes,
    driveMinutes: 0,
    visitMinutes,
    stops: timed.length,
    measuredLegs: 0,
    totalLegs: Math.max(0, timed.length - 1),
    status,
    conflicts,
    notes: notes.slice(0, 3),
  };
}

const STATUS_LABEL: Record<TimingStatus, string> = {
  ok: "جا می‌شود",
  tight: "سنگین",
  impossible: "جا نمی‌شود",
  estimated: "تخمینی",
  empty: "خالی",
};

export function timingStatusLabel(status: TimingStatus): string {
  return STATUS_LABEL[status] ?? status;
}

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));

/** The trip in one honest sentence, plus the per-day rows. */
export function tripTiming(days: DayTiming[]): TripTiming {
  const clean = Array.isArray(days) ? days.filter(Boolean) : [];
  const impossible = clean.filter((day) => day.status === "impossible").length;
  const tight = clean.filter((day) => day.status === "tight").length;
  const estimated = clean.filter((day) => day.status === "estimated").length;
  const longest = clean
    .filter((day) => day.lengthMinutes > 0)
    .reduce<DayTiming | null>((best, day) => (!best || day.lengthMinutes > best.lengthMinutes ? day : best), null);

  let headline = "";
  if (!clean.length) headline = "هنوز روزی برای زمان‌سنجی نیست.";
  else if (impossible) {
    const worst = clean.find((day) => day.status === "impossible");
    headline = `${fa(impossible)} روز از نظر زمانی جا نمی‌شود${worst ? `؛ اول از همه روز ${fa(worst.day)}` : ""}. دو توقف را جابه‌جا یا حذف کن.`;
  } else if (tight) headline = `${fa(tight)} روز سنگین است ولی شدنی؛ با شروع زودتر یا یک توقف کمتر راحت‌تر می‌شود.`;
  else if (estimated) headline = "زمان رانندگی بعضی مسیرها اندازه‌گیری نشده؛ عددهای این روزها تخمینی است و با دکمهٔ «اندازه‌گیری دوبارهٔ مسیرها» دقیق می‌شود.";
  else headline = `همهٔ ${fa(clean.length)} روز از نظر زمانی شدنی است.`;

  return { days: clean, impossible, tight, estimated, longestDay: longest ? longest.day : null, headline };
}
