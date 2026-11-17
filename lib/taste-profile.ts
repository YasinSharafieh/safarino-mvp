/**
 * «سلیقه‌ات را از انتخاب‌های خودت یاد می‌گیرم.»
 *
 * Not from a questionnaire and not from a guess: from what the traveller
 * actually pressed. Every real decision — the vehicle, the kind of stay, the
 * places added to a plan — is written down in their own browser, and the counts
 * become a small, honest profile:
 *
 *   «در ۴ سفر قطار را انتخاب کرده‌ای، اقامتگاه بومگردی را به هتل ترجیح داده‌ای،
 *    و بیشتر جاذبه‌های تاریخی و طبیعت را اضافه می‌کنی.»
 *
 * The rules that keep it honest:
 *  - it lives only in this browser (localStorage); nothing is sent anywhere and
 *    nothing identifies a person;
 *  - it never invents a preference from a single press: a pattern needs at least
 *    `MIN_SIGNAL` real choices before it is spoken about;
 *  - it is a *nudge*, not a filter: it can raise a suggestion's standing, but it
 *    can never hide an option or change a price.
 */

export const TASTE_KEY = "safarino:taste-profile-v1";
/** How many real choices make a pattern worth mentioning. */
export const MIN_SIGNAL = 3;
/** How many decisions are kept; old ones fade so tastes can change. */
const MAX_EVENTS = 60;

export type TasteEvent = {
  kind: "mode" | "stay" | "poi" | "cuisine";
  /** The concrete value: «قطار», «بومگردی», «تاریخی». */
  value: string;
  at: string;
};

export type TasteProfile = {
  events: TasteEvent[];
  modes: { value: string; count: number }[];
  stays: { value: string; count: number }[];
  categories: { value: string; count: number }[];
  /** The strongest pattern, or null when there is not enough evidence yet. */
  top: TasteEvent["kind"] | null;
  /** One plain sentence, or an honest «هنوز چیزی نمی‌دانم». */
  summary: string;
  /** True when at least one pattern has enough evidence. */
  confident: boolean;
};

const MODE_LABELS: Record<string, string> = { plane: "هواپیما", train: "قطار", bus: "اتوبوس", car: "خودروی شخصی" };
const STAY_LABELS: Record<string, string> = { hotel: "هتل", stay: "اقامتگاه بومگردی و خانهٔ محلی" };

function read(): TasteEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TASTE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (event): event is TasteEvent =>
        Boolean(event) &&
        typeof event === "object" &&
        ["mode", "stay", "poi", "cuisine"].includes(String((event as TasteEvent).kind)) &&
        typeof (event as TasteEvent).value === "string" &&
        (event as TasteEvent).value.length > 0,
    );
  } catch {
    return [];
  }
}

function write(events: TasteEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TASTE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // A private window with storage disabled simply keeps no profile.
  }
}

/** Records one real decision. Repeating the same choice same-day counts once. */
export function recordTaste(kind: TasteEvent["kind"], value: string): TasteEvent[] {
  const clean = (value || "").trim();
  if (!clean) return read();
  const events = read();
  const today = new Date().toISOString().slice(0, 10);
  const already = events.some(
    (event) => event.kind === kind && event.value === clean && event.at.slice(0, 10) === today,
  );
  const next = already ? events : [...events, { kind, value: clean, at: new Date().toISOString() }];
  write(next);
  return next;
}

function tally(events: TasteEvent[], kind: TasteEvent["kind"]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.kind !== kind) continue;
    counts.set(event.value, (counts.get(event.value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

const fa = new Intl.NumberFormat("fa-IR");

export function tasteProfile(events?: TasteEvent[]): TasteProfile {
  const list = events || read();
  const modes = tally(list, "mode");
  const stays = tally(list, "stay");
  const categories = tally(list, "poi");

  const parts: string[] = [];
  if (modes[0] && modes[0].count >= MIN_SIGNAL) {
    parts.push(`در ${fa.format(modes[0].count)} انتخاب، ${MODE_LABELS[modes[0].value] || modes[0].value} را برگزیده‌ای`);
  }
  if (stays[0] && stays[0].count >= MIN_SIGNAL) {
    parts.push(`${STAY_LABELS[stays[0].value] || stays[0].value} را ترجیح داده‌ای`);
  }
  if (categories[0] && categories[0].count >= MIN_SIGNAL) {
    const names = categories.slice(0, 2).filter((entry) => entry.count >= MIN_SIGNAL).map((entry) => entry.value);
    if (names.length) parts.push(`بیشتر سراغ ${names.join(" و ")} می‌روی`);
  }

  const confident = parts.length > 0;
  return {
    events: list,
    modes,
    stays,
    categories,
    top: modes[0] && modes[0].count >= MIN_SIGNAL ? "mode" : stays[0] && stays[0].count >= MIN_SIGNAL ? "stay" : categories[0] && categories[0].count >= MIN_SIGNAL ? "poi" : null,
    summary: confident
      ? `از انتخاب‌های خودت در این مرورگر: ${parts.join("، ")}.`
      : `هنوز ${fa.format(list.length)} انتخاب ثبت شده؛ از ${fa.format(MIN_SIGNAL)} انتخاب به بعد سلیقه‌ات را می‌گویم.`,
    confident,
  };
}

/**
 * The one thing the profile is allowed to do: give a small preference bonus to
 * an option that matches the traveller's own history. It is capped, so history
 * can never outvote the budget.
 */
export function tasteBonus(profile: TasteProfile, input: { mode?: string; stayKind?: string; category?: string }): number {
  if (!profile.confident) return 0;
  let bonus = 0;
  if (input.mode && profile.modes[0]?.value === input.mode && profile.modes[0].count >= MIN_SIGNAL) bonus += 0.08;
  if (input.stayKind && profile.stays[0]?.value === input.stayKind && profile.stays[0].count >= MIN_SIGNAL) bonus += 0.08;
  if (input.category && profile.categories[0]?.value === input.category && profile.categories[0].count >= MIN_SIGNAL) bonus += 0.05;
  return Math.min(0.12, bonus);
}

/** The tastes a page should hand to the advisor, strongest first. */
export function tasteWords(profile: TasteProfile, extra: string[] = []): string[] {
  const words = [
    ...(profile.categories[0]?.count >= MIN_SIGNAL ? [profile.categories[0].value] : []),
    ...profile.modes.slice(0, 1).filter((entry) => entry.count >= MIN_SIGNAL).map((entry) => MODE_LABELS[entry.value] || entry.value),
    ...extra,
  ];
  return Array.from(new Set(words.map((word) => word.trim()).filter(Boolean))).slice(0, 6);
}
