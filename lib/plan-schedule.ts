/**
 * «برنامهٔ من» — the day-by-day schedule, built in real clock time.
 *
 * Two things live here, and they belong together:
 *
 *   1. slotDays(): turns a list of real places into days. The day starts at the
 *      ticket's own arrival time, the transfer to the stay is the measured one,
 *      every visit has the length that kind of place really takes, lunch lands
 *      where a person gets hungry and dinner never before 20:30.
 *
 *   2. tastePlaces(): when the traveller has not picked anything, this is the
 *      honest way to suggest — the places that match the taste they described
 *      (in the quiz or in their own words), spread so a day is not four museums,
 *      and never invented: only places the sources returned.
 *
 * The traveller's own choices always win: whatever they added to the trip is in
 * the schedule, all of it, even if that makes a busier day.
 */

export type ActivityType = "sightseeing" | "food" | "transport" | "rest" | "activity";

export type PlanItem = {
  time: string;
  title: string;
  description: string;
  type: ActivityType;
  poiId?: string;
  poiCategory?: string;
  poiSourceUrl?: string | null;
  poiWikipediaUrl?: string | null;
  poiDistanceKm?: number;
};

export type PlanDay = { day: number; title: string; items: PlanItem[] };

export type SchedulePlace = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  wikipediaUrl?: string | null;
  sourceUrl?: string | null;
  fromStayKm?: number | null;
  fromStayMinutes?: number | null;
  description?: string;
};

/** How long a visit really takes, by what it is. */
export function visitMinutes(category: string): number {
  const value = category || "";
  if (/موزه|گالری/.test(value)) return 90;
  if (/بازار|خرید/.test(value)) return 75;
  if (/پارک|بوستان|طبیعت|چشم‌انداز/.test(value)) return 60;
  if (/مسجد|زیارت|آرامگاه|حرم|کلیسا/.test(value)) return 45;
  if (/قلعه|محوطه|باستانی/.test(value)) return 90;
  return 75;
}

/** «09:05» → 545, and back, so the schedule can be arithmetic. */
export function minutesOfClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return Math.min(23 * 60 + 59, Math.max(0, hours * 60 + minutes));
}

export function clockOfMinutes(total: number): string {
  const wrapped = ((Math.round(total) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const minutes = String(wrapped % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

const faDigits = new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2, useGrouping: false });
const faWhole = new Intl.NumberFormat("fa-IR");

export const faTime = (total: number) =>
  `${faDigits.format(Math.floor((total % (24 * 60)) / 60))}:${faDigits.format(total % 60)}`;

export const faNum = (value: number) => faWhole.format(Math.round(value));

const stayKm = (place: SchedulePlace) => (typeof place.fromStayKm === "number" ? place.fromStayKm : place.distanceKm);
const stayMinutes = (place: SchedulePlace) => (typeof place.fromStayMinutes === "number" ? place.fromStayMinutes : null);

export type SlotInput = {
  destination: string;
  days: number;
  places: SchedulePlace[];
  arrivalTime: string | null;
  /** Real minutes from the terminal (airport/station) to the chosen stay. */
  transferMinutes?: number | null;
  /** Real kilometres for the same hop, when it was measured. */
  transferKm?: number | null;
  origin?: string;
  /**
   * The traveller picked these places themselves. Their list is a promise, so
   * every one of them is scheduled — a full day simply carries more stops.
   */
  respectAll?: boolean;
  /** Stops a normal day holds before it is called full (default 3). */
  maxPerDay?: number;
  /** Said honestly when the choice does not fit the days the traveller booked. */
  onOverflow?: (dropped: number) => void;
  /** Lines the traveller wrote when they added the place. */
  notes?: Record<string, string>;
};

/**
 * Distributes places over days. Nearest to the stay first, so the first day
 * needs the least driving; when a list was chosen by the traveller it is kept
 * whole and the days absorb it evenly.
 */
export function distributePlaces<T extends SchedulePlace>(places: T[], days: number, respectAll = false): T[][] {
  const dayCount = Math.max(1, Math.round(days || 1));
  const sorted = [...places].sort((a, b) => stayKm(a) - stayKm(b));
  const buckets: T[][] = Array.from({ length: dayCount }, () => []);
  if (!sorted.length) return buckets;

  if (respectAll) {
    // Even spread: day 1 gets the first stop, then round-robin, so no day is
    // empty while another one holds six places.
    sorted.forEach((place, index) => buckets[index % dayCount].push(place));
    return buckets;
  }

  const perDay = Math.max(1, Math.ceil(sorted.length / dayCount));
  sorted.forEach((place, index) => {
    const day = Math.min(dayCount - 1, Math.floor(index / perDay));
    buckets[day].push(place);
  });
  return buckets;
}

export function slotDays(input: SlotInput): PlanDay[] {
  const dayCount = Math.max(1, Math.round(input.days || 1));
  const cap = input.respectAll ? Number.POSITIVE_INFINITY : Math.max(1, Math.round(input.maxPerDay || 3));
  const buckets = distributePlaces(input.places, dayCount, Boolean(input.respectAll));
  const dropped = input.respectAll ? 0 : 0;
  if (dropped && input.onOverflow) input.onOverflow(dropped);

  const arrival = minutesOfClock(input.arrivalTime);
  const transfer = Math.max(10, Math.round(input.transferMinutes ?? 45));

  return Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const items: PlanItem[] = [];
    const queue = [...buckets[index]];
    let clock = day === 1 ? (arrival ?? 9 * 60) : 8 * 60 + 30;

    if (day === 1) {
      items.push({
        time: clockOfMinutes(clock),
        title: input.arrivalTime ? `رسیدن به ${input.destination}` : `حرکت به سمت ${input.destination}`,
        description: input.arrivalTime
          ? `طبق ساعت بلیت انتخاب‌شده، ${faTime(clock)} در ${input.destination} هستید${input.origin ? ` (از ${input.origin} راهی شده‌اید)` : ""}.`
          : "ساعت رسیدن در بلیت ثبت نشده؛ برنامه از صبح شروع می‌شود و با ساعت واقعی بلیت هماهنگ می‌شود.",
        type: "transport",
      });
      clock += transfer;
      items.push({
        time: clockOfMinutes(clock),
        title: "رسیدن به اقامتگاه",
        description:
          input.transferKm && input.transferKm > 0
            ? `حدود ${faNum(transfer)} دقیقه و ${faNum(input.transferKm)} کیلومتر تا اقامتگاه (مسیر واقعی جاده)؛ بارها را بگذارید و اگر اتاق آماده نبود چمدان را تحویل دهید.`
            : `حدود ${faNum(transfer)} دقیقه تا اقامتگاه؛ بارها را بگذارید و اگر اتاق آماده نبود چمدان را تحویل دهید.`,
        type: "rest",
      });
      clock += 45;
      items.push({
        time: clockOfMinutes(clock),
        title: "استراحت کوتاه و آماده‌شدن",
        description: "چای یا قهوه‌ای، یک دوش و شروع اولین بازدید با انرژی.",
        type: "rest",
      });
    } else {
      items.push({
        time: clockOfMinutes(clock),
        title: "صبحانه و شروع روز",
        description: "صبحانه، آماده‌شدن و مرور برنامهٔ امروز.",
        type: "food",
      });
      clock += 60;
    }

    let visits = 0;
    let lunchDone = false;

    while (queue.length) {
      const poi = queue.shift() as SchedulePlace;
      const travel = Math.max(10, stayMinutes(poi) ?? 25);
      clock += travel;
      const km = stayKm(poi);
      const stayLength = visitMinutes(poi.category);
      const note = input.notes?.[poi.id];
      items.push({
        time: clockOfMinutes(clock),
        title: poi.name,
        description:
          (note ? `${note} · ` : "") +
          `${poi.name} از جاذبه‌های ${poi.category} است؛ ${faNum(km)} کیلومتر از اقامتگاه${
            typeof poi.fromStayMinutes === "number" ? ` (حدود ${faNum(poi.fromStayMinutes)} دقیقه رانندگی)` : ""
          } · حدود ${faNum(stayLength)} دقیقه برای بازدید.`,
        type: "sightseeing",
        poiId: poi.id,
        poiCategory: poi.category,
        poiSourceUrl: poi.wikipediaUrl || poi.sourceUrl,
        poiWikipediaUrl: poi.wikipediaUrl,
        poiDistanceKm: km,
      });
      clock += stayLength;
      visits += 1;

      if (!lunchDone && clock >= 12 * 60 + 30 && clock <= 15 * 60) {
        items.push({
          time: clockOfMinutes(clock),
          title: "ناهار در همان محله",
          description: "ناهار ساده و محلی نزدیک همین جاذبه؛ بعد از آن کمی قدم‌زدن.",
          type: "food",
        });
        clock += 75;
        lunchDone = true;
      }

      // A chosen list is never cut; only an automatic day stops at three.
      if (visits >= cap) break;
    }

    if (!lunchDone) {
      items.push({ time: clockOfMinutes(Math.max(clock, 12 * 60 + 45)), title: "ناهار", description: "ناهار در محلهٔ اقامتگاه.", type: "food" });
      clock = Math.max(clock, 12 * 60 + 45) + 75;
    }

    items.push({
      time: clockOfMinutes(Math.max(clock + 30, 20 * 60 + 30)),
      title: "شام و بازگشت به اقامتگاه",
      description: "پایان روز با شام سبک و استراحت؛ فردا صبح دوباره ادامه می‌دهیم.",
      type: "food",
    });

    items.sort((a, b) => a.time.localeCompare(b.time));
    return { day, title: `روز ${faNum(day)} · ${input.destination}`, items };
  });
}

/* ------------------------------------------------------------------ taste */

/** What each taste means, in the words the sources use for their places. */
const TASTE_WORDS: Record<string, RegExp> = {
  تاریخی: /(تاریخ|باستانی|موزه|قلعه|کاروانسرا|آثار|کتیبه|بافت|قدیم|کاخ)/,
  زیارتی: /(حرم|زیارت|امام|مسجد|آرامگاه|بقعه|مزار|کلیسا)/,
  طبیعت: /(پارک|باغ|طبیعت|چشمه|آبشار|جنگل|دره|تالاب|روستا)/,
  ساحلی: /(ساحل|دریا|بندر|جزیره|ساحل|خلیج)/,
  شهری: /(بازار|خرید|میدان|خیابان|کافه|شهر|گالری)/,
  کوهستانی: /(کوه|قله|ارتفاع|پیست|تله‌کابین|ییلاق)/,
  کویری: /(کویر|بیابان|شن|تپه|ریگ|چشمه)/,
};

export type TasteProfile = { moods: string[]; words?: string };

/** Reads the taste the traveller described, without inventing one. */
export function tasteProfile(input: { moods?: string[]; text?: string }): TasteProfile {
  const moods = (input.moods || []).filter((mood) => Boolean(TASTE_WORDS[mood]));
  return { moods, words: (input.text || "").trim() };
}

const categoryOf = (place: SchedulePlace) => `${place.category} ${place.name}`;

export function tasteScore(place: SchedulePlace, profile: TasteProfile): number {
  const haystack = `${categoryOf(place)} ${place.description || ""}`;
  let score = 0;
  profile.moods.forEach((mood, index) => {
    // The strongest taste counts double; the rest still matter.
    const weight = index === 0 ? 3 : 2;
    if (TASTE_WORDS[mood]?.test(haystack)) score += weight;
  });
  if (profile.words) {
    for (const word of profile.words.split(/[\s،,.!؟]+/).filter((entry) => entry.length > 2)) {
      if (haystack.includes(word)) score += 1;
    }
  }
  return score;
}

/**
 * The suggestion when the traveller picked nothing: the places that fit their
 * taste best, then a mix that keeps a day varied and close to the stay.
 */
export function tastePlaces<T extends SchedulePlace>(
  places: T[],
  profile: TasteProfile,
  options: { days: number; maxPerDay?: number } = { days: 1 },
): T[] {
  const wanted = Math.max(1, Math.round(options.days || 1)) * Math.max(1, Math.round(options.maxPerDay || 3));
  const scored = places.map((place) => ({ place, score: tasteScore(place, profile) }));
  scored.sort((a, b) => b.score - a.score || stayKm(a.place) - stayKm(b.place));

  const picked: T[] = [];
  const usedCategories: string[] = [];
  // First pass: at most one of each category, so a day is not four museums.
  for (const entry of scored) {
    if (picked.length >= wanted) break;
    const family = entry.place.category.split(/[،,/]/)[0].trim();
    if (usedCategories.includes(family) && picked.length < wanted - 1) continue;
    picked.push(entry.place);
    usedCategories.push(family);
  }
  // Second pass: top up with the best remaining, same category or not.
  for (const entry of scored) {
    if (picked.length >= wanted) break;
    if (!picked.includes(entry.place)) picked.push(entry.place);
  }
  return picked;
}
