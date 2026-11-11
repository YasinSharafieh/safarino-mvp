/**
 * The things a traveller must not forget, and when they matter.
 *
 * Two rules shape this file:
 *  - a checklist is personal, so it lives on the traveller's own device and
 *    nothing is uploaded;
 *  - a reminder is only useful with a date, so every item carries «how many
 *    days before departure» it matters, and the page says plainly how many
 *    days are left — there are no push notifications pretending to exist.
 */

export type ChecklistGroup = "documents" | "bookings" | "packing" | "before-leaving";

export const CHECKLIST_GROUPS: { id: ChecklistGroup; label: string; hint: string }[] = [
  { id: "documents", label: "مدارک و پول", hint: "چیزی که اگر جا بماند، سفر شروع نمی‌شود" },
  { id: "bookings", label: "رزروها و بلیت‌ها", hint: "قبل از حرکت، همه‌چیز تأیید شده باشد" },
  { id: "packing", label: "وسایل", hint: "بر اساس فصل و نوع سفر" },
  { id: "before-leaving", label: "قبل از بستن در خانه", hint: "کارهای آخرین ساعت" },
];

export type ChecklistItem = {
  id: string;
  title: string;
  group: ChecklistGroup;
  /** How many days before departure this matters (0 = the day itself). */
  daysBefore: number;
  /** Why it matters, in one short line. */
  note?: string;
  /** Items the traveller added themselves (so they can be removed). */
  custom?: boolean;
};

export type ChecklistState = {
  /** Ids of the finished items. */
  done: string[];
  /** Items added by the traveller. */
  custom: ChecklistItem[];
  /** When the state last changed, so nothing silently looks newer than it is. */
  updatedAt?: string;
};

export const CHECKLIST_STORAGE_KEY = "safarino-checklist-v1";
export const CHECKLIST_EVENT = "safarino-checklist-changed";
export const MAX_CUSTOM_ITEMS = 40;

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "id-card", title: "کارت ملی و شناسنامه", group: "documents", daysBefore: 0, note: "برای هتل و بلیت قطار و هواپیما لازم می‌شود." },
  { id: "booking-copies", title: "کپی رزرو هتل و بلیت‌ها", group: "documents", daysBefore: 1, note: "یک نسخهٔ عکس در گوشی، یک نسخهٔ چاپی." },
  { id: "cash", title: "پول نقد کمکی و کارت بانکی", group: "documents", daysBefore: 1, note: "همه‌جا کارت‌خوان نیست؛ کمی نقد همراه باشد." },
  { id: "insurance", title: "بیمهٔ سفر (اگر دارید)", group: "documents", daysBefore: 3, note: "شمارهٔ پشتیبانی را جایی ذخیره کنید." },
  { id: "meds", title: "داروهای شخصی و نسخه", group: "documents", daysBefore: 1, note: "به‌اندازهٔ کل سفر و کمی بیشتر." },
  { id: "hotel-confirm", title: "تأیید نهایی اقامتگاه", group: "bookings", daysBefore: 3, note: "ساعت پذیرش و شرط لغو را یک بار بخوانید." },
  { id: "transport-ticket", title: "بلیت رفت و برگشت", group: "bookings", daysBefore: 2, note: "شمارهٔ صندلی و ساعت حرکت را در گوشی داشته باشید." },
  { id: "check-in", title: "پیش‌ثبت‌نام پرواز یا قطار (اگر دارد)", group: "bookings", daysBefore: 1, note: "معمولاً از ۲۴ تا ۴۸ ساعت قبل باز می‌شود." },
  { id: "tickets-attractions", title: "بلیت جاذبه‌های پربازدید", group: "bookings", daysBefore: 2, note: "برای موزه‌های شلوغ، رزرو وقت کمک می‌کند." },
  { id: "route-saved", title: "برنامهٔ سفر ذخیره‌شده و آفلاین", group: "bookings", daysBefore: 1, note: "لینک و نسخهٔ PDF برنامه را دانلود کنید." },
  { id: "clothes", title: "لباس مناسب هوای همان روزها", group: "packing", daysBefore: 1, note: "هوای روزهای سفر بالای صفحهٔ برنامه نوشته شده است." },
  { id: "shoes", title: "کفش راحت برای پیاده‌روی", group: "packing", daysBefore: 1 },
  { id: "charger", title: "شارژر و پاوربانک", group: "packing", daysBefore: 1, note: "مسیریابی با نشان باتری می‌خورد." },
  { id: "sunscreen", title: "کرم ضدآفتاب و کلاه", group: "packing", daysBefore: 1 },
  { id: "umbrella", title: "چتر یا بارانی", group: "packing", daysBefore: 1, note: "اگر احتمال باران در پیش‌بینی هست." },
  { id: "snacks", title: "تنقلات و آب برای راه", group: "packing", daysBefore: 0 },
  { id: "home-power", title: "بستن شیر گاز و آب برق", group: "before-leaving", daysBefore: 0 },
  { id: "home-plants", title: "سپردن کلید و رسیدگی به خانه/گیاهان", group: "before-leaving", daysBefore: 1 },
  { id: "home-trash", title: "خالی کردن یخچال از چیزهای فاسدشدنی", group: "before-leaving", daysBefore: 0 },
  { id: "phone-charge", title: "شارژ کامل گوشی قبل از حرکت", group: "before-leaving", daysBefore: 0 },
];

function cleanText(value: unknown, limit = 90): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

/** Any stored value becomes a usable state; a broken one becomes an empty one. */
export function sanitizeState(input: unknown): ChecklistState {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const done = Array.isArray(raw.done)
    ? Array.from(new Set(raw.done.filter((id): id is string => typeof id === "string" && /^[a-zA-Z0-9:_-]{1,80}$/.test(id))))
    : [];
  const custom: ChecklistItem[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.custom)) {
    for (const entry of raw.custom.slice(0, MAX_CUSTOM_ITEMS)) {
      const item = entry as Record<string, unknown>;
      const title = cleanText(item.title);
      const id = typeof item.id === "string" && /^[a-zA-Z0-9:_-]{1,80}$/.test(item.id) ? item.id : "";
      if (!title || !id || seen.has(id)) continue;
      const group = CHECKLIST_GROUPS.some((entryGroup) => entryGroup.id === item.group)
        ? (item.group as ChecklistGroup)
        : "packing";
      seen.add(id);
      custom.push({
        id,
        title,
        group,
        daysBefore: Math.max(0, Math.min(30, Math.round(Number(item.daysBefore) || 0))),
        note: cleanText(item.note, 160) || undefined,
        custom: true,
      });
    }
  }
  return {
    done,
    custom,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void } | null | undefined;

export function readChecklist(storage?: StorageLike): ChecklistState {
  const store = storage === undefined && typeof window !== "undefined" ? window.localStorage : storage;
  if (!store) return { done: [], custom: [] };
  try {
    const raw = store.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return { done: [], custom: [] };
    return sanitizeState(JSON.parse(raw));
  } catch {
    return { done: [], custom: [] };
  }
}

/** Saves quietly: a blocked storage must never break the page. */
export function saveChecklist(state: ChecklistState, storage?: StorageLike): boolean {
  const store = storage === undefined && typeof window !== "undefined" ? window.localStorage : storage;
  if (!store) return false;
  try {
    const clean = sanitizeState(state);
    store.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify({ ...clean, updatedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

/** The full list: the built-in items plus whatever the traveller added. */
export function allItems(state: ChecklistState): ChecklistItem[] {
  const custom = state.custom || [];
  const customIds = new Set(custom.map((item) => item.id));
  const base = DEFAULT_CHECKLIST.filter((item) => !customIds.has(item.id));
  return [...base, ...custom].sort((a, b) => a.daysBefore - b.daysBefore);
}

export type ChecklistProgress = {
  total: number;
  done: number;
  remaining: number;
  percent: number;
  byGroup: { group: ChecklistGroup; total: number; done: number }[];
  /** Items whose moment is now (or already passed) for the days left. */
  dueNow: ChecklistItem[];
  /** Items coming up within the next two days. */
  soon: ChecklistItem[];
};

/**
 * Progress and "what matters now".
 * `daysUntilDeparture` is null when the trip has no date yet — then nothing is
 * called late, we simply show the list in its natural order.
 */
export function checklistProgress(state: ChecklistState, daysUntilDeparture: number | null): ChecklistProgress {
  const items = allItems(state);
  const doneSet = new Set(state.done);
  const isDone = (item: ChecklistItem) => doneSet.has(item.id);
  const done = items.filter(isDone).length;
  const total = items.length;

  const byGroup = CHECKLIST_GROUPS.map((group) => {
    const groupItems = items.filter((item) => item.group === group.id);
    return { group: group.id, total: groupItems.length, done: groupItems.filter(isDone).length };
  }).filter((entry) => entry.total > 0);

  let dueNow: ChecklistItem[] = [];
  let soon: ChecklistItem[] = [];
  if (daysUntilDeparture !== null && Number.isFinite(daysUntilDeparture)) {
    const days = Math.max(0, Math.round(daysUntilDeparture));
    dueNow = items.filter((item) => !isDone(item) && item.daysBefore >= days);
    soon = items.filter((item) => !isDone(item) && item.daysBefore < days && item.daysBefore >= days - 2);
  }

  return {
    total,
    done,
    remaining: total - done,
    percent: total ? Math.round((done / total) * 100) : 0,
    byGroup,
    dueNow,
    soon,
  };
}

export function toggleDone(state: ChecklistState, id: string): ChecklistState {
  const exists = state.done.includes(id);
  return {
    ...state,
    done: exists ? state.done.filter((entry) => entry !== id) : [...state.done, id],
    updatedAt: new Date().toISOString(),
  };
}

export function addCustomItem(state: ChecklistState, input: { title: string; group: ChecklistGroup; daysBefore: number; note?: string }): ChecklistState {
  const title = cleanText(input.title);
  if (!title) return state;
  const same = allItems(state).some((item) => item.title.replace(/\s/g, "") === title.replace(/\s/g, ""));
  if (same) return state;
  if ((state.custom || []).length >= MAX_CUSTOM_ITEMS) return state;
  const item: ChecklistItem = {
    id: `own-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    group: CHECKLIST_GROUPS.some((group) => group.id === input.group) ? input.group : "packing",
    daysBefore: Math.max(0, Math.min(30, Math.round(Number(input.daysBefore) || 0))),
    note: cleanText(input.note, 160) || undefined,
    custom: true,
  };
  return { ...state, custom: [...(state.custom || []), item], updatedAt: new Date().toISOString() };
}

export function removeCustomItem(state: ChecklistState, id: string): ChecklistState {
  return {
    ...state,
    custom: (state.custom || []).filter((item) => item.id !== id),
    done: state.done.filter((entry) => entry !== id),
    updatedAt: new Date().toISOString(),
  };
}

export function resetChecklist(): ChecklistState {
  return { done: [], custom: [], updatedAt: new Date().toISOString() };
}

/** Whole days between today and the departure date (null when unknown). */
export function daysUntil(departureDateIso: string | null | undefined, today = new Date()): number | null {
  if (typeof departureDateIso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(departureDateIso)) return null;
  const target = new Date(`${departureDateIso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/** One honest sentence about the countdown. */
export function countdownLabel(days: number | null): string {
  if (days === null) return "تاریخ حرکت را انتخاب کنید تا یادآورها معنی پیدا کنند.";
  if (days > 1) return `${new Intl.NumberFormat("fa-IR").format(days)} روز تا حرکت`;
  if (days === 1) return "فردا حرکت می‌کنید";
  if (days === 0) return "امروز روز حرکت است";
  return "تاریخ حرکت گذشته؛ تاریخ‌ها را به‌روز کنید.";
}
