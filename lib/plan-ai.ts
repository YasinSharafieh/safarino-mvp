/**
 * The two places where a model genuinely helps — and nothing more.
 *
 *   1. curate():  given a list of REAL places Safarino already found, the model
 *                 decides the order and which day each one belongs to, and writes
 *                 one short reason per stop. It may not add, rename or invent a
 *                 place: every id it returns must already exist in the list.
 *
 *   2. guide():   one honest paragraph per day about what that day contains —
 *                 what to notice, how to pace it, one practical tip. No prices,
 *                 no opening hours, no facts it cannot know.
 *
 * Both functions are pure so they can be tested without a network call, and
 * both degrade to a local, deterministic answer when the model is unavailable.
 */

export type CuratePlace = {
  id: string;
  name: string;
  category: string;
  /** How far it is from where the traveller sleeps. */
  km?: number | null;
  minutes?: number | null;
};

export type CurateInput = {
  destination: string;
  days: number;
  places: CuratePlace[];
  taste?: { moods?: string[]; words?: string };
  /** The traveller picked these themselves: all of them must stay. */
  mustIncludeAll?: boolean;
};

export type CuratedStop = { id: string; why: string };
export type CuratedDay = { day: number; stops: CuratedStop[] };
export type Curation = { days: CuratedDay[]; summary: string; source: "ai" | "local" };

const fmt = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));

export function curatePrompt(input: CurateInput): string {
  const lines = input.places
    .slice(0, 40)
    .map(
      (place, index) =>
        `${index + 1}) id=${place.id} | ${place.name} | دسته: ${place.category}` +
        (typeof place.km === "number" ? ` | ${fmt(place.km)} کیلومتر از اقامتگاه` : "") +
        (typeof place.minutes === "number" ? ` | ~${fmt(place.minutes)} دقیقه رانندگی` : ""),
    )
    .join("\n");
  const taste = [ ...(input.taste?.moods || []) ].join("، ");
  return `تو یک برنامه‌ریز سفر ایرانی و دقیق هستی. فهرست زیر جاذبه‌های واقعی شهر ${input.destination} است که از منابع عمومی خوانده شده‌اند.
سلیقهٔ مسافر: ${taste || "مشخص نشده"}${input.taste?.words ? ` — به زبان خودش: «${input.taste.words.slice(0, 200)}»` : ""}
مدت سفر: ${fmt(input.days)} روز.

${lines}

وظیفه: این جاذبه‌ها را بین ${fmt(input.days)} روز تقسیم کن و در هر روز مرتب کن؛ هر جاذبه باید در یک روز بیاید، طوری که جابه‌جایی روزانه کم باشد و هر روز از نظر نوع جاذبه متنوع باشد (موزه، بازار، طبیعت، زیارتگاه را پخش کن). حداکثر ۳ جاذبه در هر روز.
${input.mustIncludeAll ? "همهٔ این جاذبه‌ها را مسافر خودش انتخاب کرده؛ هیچ‌کدام را حذف نکن، فقط روز و ترتیب را تعیین کن." : "از میان این جاذبه‌ها فقط آن‌هایی را انتخاب کن که با سلیقهٔ مسافر جور است."}
برای هر جاذبه یک جملهٔ کوتاه فارسی (حداکثر ۱۲ کلمه) بنویس که بگوید چرا اینجا و در این روز — بر اساس همان اطلاعات بالا، بدون ساختن ساعت کار، قیمت یا واقعیت تازه.

فقط JSON معتبر با این ساختار برگردان:
{"days":[{"day":1,"stops":[{"id":"شناسهٔ دقیق","why":"..."}]}],"summary":"یک جمله دربارهٔ منطق چیدمان"}`;
}

/** Keeps only ids that really exist, no duplicates, and fills gaps from the local order. */
export function sanitizeCuration(raw: unknown, input: CurateInput): Curation {
  const byId = new Map(input.places.map((place) => [place.id, place]));
  const local = localCuration(input);
  if (!raw || typeof raw !== "object") return local;
  const rows = Array.isArray((raw as Record<string, unknown>).days) ? ((raw as Record<string, unknown>).days as unknown[]) : [];
  const used = new Set<string>();
  const days: CuratedDay[] = [];
  rows.slice(0, Math.max(1, Math.round(input.days))).forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    const stops = Array.isArray(row.stops) ? row.stops : [];
    const curated: CuratedStop[] = [];
    for (const stop of stops) {
      if (!stop || typeof stop !== "object") continue;
      const id = typeof (stop as Record<string, unknown>).id === "string" ? String((stop as Record<string, unknown>).id) : "";
      if (!byId.has(id) || used.has(id)) continue;
      const why = typeof (stop as Record<string, unknown>).why === "string" ? String((stop as Record<string, unknown>).why).trim().slice(0, 120) : "";
      used.add(id);
      curated.push({ id, why });
      if (curated.length >= 3) break;
    }
    if (curated.length) days.push({ day: index + 1, stops: curated });
  });

  const kept = days.flatMap((day) => day.stops).length;
  // A model answer that keeps almost nothing is not an answer.
  if (kept < Math.min(2, input.places.length)) return local;

  if (input.mustIncludeAll) {
    // Every chosen place stays: the leftovers go to the lightest day.
    const leftovers = input.places.filter((place) => !used.has(place.id));
    for (const place of leftovers) {
      const lightest = days.reduce((best, day, index) => (day.stops.length < days[best].stops.length ? index : best), 0);
      days[lightest].stops.push({ id: place.id, why: "" });
    }
  }

  const summary =
    typeof (raw as Record<string, unknown>).summary === "string"
      ? String((raw as Record<string, unknown>).summary).trim().slice(0, 200)
      : local.summary;
  return { days, summary, source: "ai" };
}

/** The deterministic answer: nearest first, evenly spread, taste-aware. */
export function localCuration(input: CurateInput): Curation {
  const dayCount = Math.max(1, Math.round(input.days || 1));
  const km = (place: CuratePlace) => (typeof place.km === "number" ? place.km : Number.POSITIVE_INFINITY);
  const sorted = [...input.places].sort((a, b) => km(a) - km(b));
  const days: CuratedDay[] = Array.from({ length: dayCount }, (_, index) => ({ day: index + 1, stops: [] }));
  sorted.forEach((place, index) => {
    const day = index % dayCount;
    if (days[day].stops.length >= 3 && !input.mustIncludeAll) return;
    days[day].stops.push({ id: place.id, why: "" });
  });
  return {
    days: days.filter((day) => day.stops.length),
    summary: "چیدمان بر اساس نزدیکی به اقامتگاه و پخش یکنواخت بین روزها.",
    source: "local",
  };
}

/* ------------------------------------------------------------------ guide */

export type GuideDayInput = {
  day: number;
  stops: { time: string; title: string; kind: string }[];
};

export type GuideInput = { destination: string; days: GuideDayInput[]; taste?: string };

export type DayGuide = { day: number; text: string; tip: string };

export function guidePrompt(input: GuideInput): string {
  const days = input.days
    .slice(0, 10)
    .map((day) => `روز ${fmt(day.day)}: ` + day.stops.map((stop) => `${stop.time} ${stop.title}`).join(" ← "))
    .join("\n");
  return `تو یک راهنمای سفر ایرانی هستی که با مسافر صمیمی و کوتاه حرف می‌زند.
مقصد: ${input.destination}${input.taste ? ` | سلیقهٔ مسافر: ${input.taste}` : ""}
برنامهٔ روزها (فقط همین‌ها در برنامه هستند):
${days}

برای هر روز دقیقاً یک پاراگراف فارسی (حداکثر ۶۰ کلمه) بنویس که بگوید آن روز چه حالی دارد، کدام بخشش را از دست ندهد و چطور وقتش را تقسیم کند؛ و یک «نکتهٔ کاربردی» کوتاه (حداکثر ۲۰ کلمه).
فقط از همین مکان‌ها و ساعت‌های نوشته‌شده حرف بزن. هیچ قیمت، ساعت کاری، آدرس یا واقعیت تازه‌ای نساز.

فقط JSON معتبر: {"guides":[{"day":1,"text":"...","tip":"..."}]}`;
}

const BANNED = /(تومان|ریال|دلار|ساعت کاری|بسته است|باز است از|ورودی\s*\d)/;

/** One paragraph per day; numbers and prices the model cannot know are refused. */
export function sanitizeGuide(raw: unknown, input: GuideInput): { guides: DayGuide[]; source: "ai" | "local" } {
  const local = localGuides(input);
  if (!raw || typeof raw !== "object") return local;
  const rows = Array.isArray((raw as Record<string, unknown>).guides) ? ((raw as Record<string, unknown>).guides as unknown[]) : [];
  const byDay = new Map<number, DayGuide>();
  for (const entry of rows) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const day = Number(row.day);
    const text = typeof row.text === "string" ? row.text.trim() : "";
    const tip = typeof row.tip === "string" ? row.tip.trim() : "";
    if (!Number.isFinite(day) || !text) continue;
    if (BANNED.test(text) || BANNED.test(tip)) continue;
    byDay.set(day, { day, text: text.slice(0, 420), tip: tip.slice(0, 160) });
  }
  const guides = input.days.map((day) => byDay.get(day.day) || local.guides.find((entry) => entry.day === day.day)!);
  const fromModel = guides.filter((entry) => byDay.has(entry.day)).length;
  return { guides, source: fromModel >= Math.max(1, Math.ceil(input.days.length / 2)) ? "ai" : "local" };
}

export function localGuides(input: GuideInput): { guides: DayGuide[]; source: "local" } {
  return {
    source: "local",
    guides: input.days.map((day) => {
      const visits = day.stops.filter((stop) => stop.kind === "sightseeing");
      const names = visits.map((stop) => stop.title);
      const text = names.length
        ? `روز ${fmt(day.day)} با ${names.slice(0, 3).join("، ")} می‌گذرد؛ بین بازدیدها وقت بگذارید و عجله نکنید.${
            names.length > 2 ? " اگر خسته شدید، آخرین بازدید را کوتاه کنید." : ""
          }`
        : `روز ${fmt(day.day)} سبک‌تر است: گشت آزاد در محله، بازار و کافه‌های ${input.destination}.`;
      return {
        day: day.day,
        text,
        tip: visits.length >= 3 ? "کفش راحت بپوشید و آب همراه داشته باشید؛ سه بازدید در یک روز انرژی می‌برد." : "صبح زودتر شروع کنید تا شلوغی را از دست ندهید.",
      };
    }),
  };
}
