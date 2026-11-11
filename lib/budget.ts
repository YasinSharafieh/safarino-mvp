/**
 * The trip money, split into clear lines.
 *
 * Two kinds of number live here and they must never be mixed up:
 *  - «واقعی»: the price the traveller actually picked (accommodation, transport)
 *  - «تخمین با فرض شما»: our own transparent assumptions (city driving, food,
 *    tickets, extras). Every assumption is visible and editable on the page.
 * Nothing is invented: when a real price is missing the line says so instead
 * of filling in a made-up number.
 */

export type BudgetAssumptions = {
  /** Toman per kilometre of in-city driving (fuel + wear). */
  cityCostPerKm: number;
  /** Toman per person per day for meals. */
  foodPerPersonPerDay: number;
  /** Toman per person for one ticketed attraction. */
  ticketPerStop: number;
  /** Toman per person per day for souvenirs and small things. */
  extrasPerPersonPerDay: number;
};

export const DEFAULT_BUDGET_ASSUMPTIONS: BudgetAssumptions = {
  cityCostPerKm: 1500,
  foodPerPersonPerDay: 600_000,
  ticketPerStop: 120_000,
  extrasPerPersonPerDay: 200_000,
};

export const BUDGET_ASSUMPTIONS_KEY = "safarino-budget-assumptions-v1";
export const BUDGET_ASSUMPTIONS_EVENT = "safarino-budget-assumptions-changed";

const LIMITS: Record<keyof BudgetAssumptions, { min: number; max: number }> = {
  cityCostPerKm: { min: 0, max: 100_000 },
  foodPerPersonPerDay: { min: 0, max: 50_000_000 },
  ticketPerStop: { min: 0, max: 50_000_000 },
  extrasPerPersonPerDay: { min: 0, max: 50_000_000 },
};

function cleanAmount(value: unknown, fallback: number, key: keyof BudgetAssumptions): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  const limit = LIMITS[key];
  return Math.min(limit.max, Math.max(limit.min, Math.round(number)));
}

/** Nothing the traveller types can break the numbers or the page. */
export function sanitizeAssumptions(input: Partial<BudgetAssumptions> | null | undefined): BudgetAssumptions {
  const source = input || {};
  return {
    cityCostPerKm: cleanAmount(source.cityCostPerKm, DEFAULT_BUDGET_ASSUMPTIONS.cityCostPerKm, "cityCostPerKm"),
    foodPerPersonPerDay: cleanAmount(source.foodPerPersonPerDay, DEFAULT_BUDGET_ASSUMPTIONS.foodPerPersonPerDay, "foodPerPersonPerDay"),
    ticketPerStop: cleanAmount(source.ticketPerStop, DEFAULT_BUDGET_ASSUMPTIONS.ticketPerStop, "ticketPerStop"),
    extrasPerPersonPerDay: cleanAmount(source.extrasPerPersonPerDay, DEFAULT_BUDGET_ASSUMPTIONS.extrasPerPersonPerDay, "extrasPerPersonPerDay"),
  };
}

type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void } | null | undefined;

export function readBudgetAssumptions(storage?: StorageLike): BudgetAssumptions {
  const store = storage === undefined && typeof window !== "undefined" ? window.localStorage : storage;
  if (!store) return { ...DEFAULT_BUDGET_ASSUMPTIONS };
  try {
    const raw = store.getItem(BUDGET_ASSUMPTIONS_KEY);
    if (!raw) return { ...DEFAULT_BUDGET_ASSUMPTIONS };
    return sanitizeAssumptions(JSON.parse(raw) as Partial<BudgetAssumptions>);
  } catch {
    return { ...DEFAULT_BUDGET_ASSUMPTIONS };
  }
}

/** Saves quietly; a blocked storage must never stop the page from working. */
export function saveBudgetAssumptions(assumptions: BudgetAssumptions, storage?: StorageLike): boolean {
  const store = storage === undefined && typeof window !== "undefined" ? window.localStorage : storage;
  if (!store) return false;
  try {
    store.setItem(BUDGET_ASSUMPTIONS_KEY, JSON.stringify(sanitizeAssumptions(assumptions)));
    return true;
  } catch {
    return false;
  }
}

export type BudgetLineId = "stay" | "transport" | "city-drive" | "food" | "tickets" | "extras";
export type BudgetLineKind = "real" | "estimate" | "missing";

export type BudgetLine = {
  id: BudgetLineId;
  label: string;
  /** null when the real price is unknown — we never fill it with a guess. */
  amount: number | null;
  kind: BudgetLineKind;
  detail: string;
};

export type BudgetInputs = {
  days: number;
  stops: number;
  /** Measured in-city driving, or null when no leg could be measured. */
  cityKm: number | null;
  /** Adults plus children — the people who eat and pay tickets. */
  people: number;
  /** How many of those people are children (for the wording only). */
  children?: number;
  budgetToman: number | null;
  accommodation: { name?: string; nights?: number; totalToman: number | null } | null;
  transport: { label?: string; totalToman: number | null } | null;
  assumptions: BudgetAssumptions;
};

export type BudgetPlan = {
  lines: BudgetLine[];
  /** Sum of every known line (real + estimate). */
  total: number;
  realTotal: number;
  estimateTotal: number;
  budget: number | null;
  remaining: number | null;
  over: boolean;
  perDay: number;
  perTraveler: number;
  travelersForSplit: number;
  shares: { id: BudgetLineId; percent: number }[];
  missing: BudgetLineId[];
  notes: string[];
};

function roundToThousand(value: number): number {
  return Math.round(value / 1000) * 1000;
}

function positiveOrNull(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}

/** Persian money wording, used by both the page and the printable book. */
export function formatToman(value: number): string {
  const rounded = Math.round(value);
  return `${new Intl.NumberFormat("fa-IR").format(rounded)} تومان`;
}

/** Short form for tight chips: «۲٫۴ میلیون تومان». */
export function formatTomanShort(value: number): string {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1_000_000) {
    const millions = Math.round((rounded / 1_000_000) * 10) / 10;
    return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(millions)} میلیون تومان`;
  }
  return formatToman(rounded);
}

export function buildBudgetPlan(inputs: BudgetInputs): BudgetPlan {
  const assumptions = sanitizeAssumptions(inputs.assumptions);
  const days = Math.max(1, Math.floor(Number(inputs.days) || 1));
  const stops = Math.max(0, Math.floor(Number(inputs.stops) || 0));
  const people = Math.max(1, Math.floor(Number(inputs.people) || 1));
  const children = Math.max(0, Math.floor(Number(inputs.children) || 0));
  const rawKm = Number(inputs.cityKm);
  // Nonsense kilometres (negative, endless) are treated as "not measured".
  const cityKm = inputs.cityKm === null || inputs.cityKm === undefined || !Number.isFinite(rawKm) || rawKm < 0 ? null : rawKm;

  const lines: BudgetLine[] = [];

  // 1) Accommodation — a real price the traveller picked.
  const stayTotal = positiveOrNull(inputs.accommodation?.totalToman);
  lines.push(
    stayTotal === null
      ? {
          id: "stay",
          label: "اقامتگاه",
          amount: null,
          kind: "missing",
          detail: "هنوز اقامتگاهی انتخاب نشده؛ از صفحهٔ اقامتگاه یکی را انتخاب کنید تا قیمت واقعی همین‌جا بیاید.",
        }
      : {
          id: "stay",
          label: "اقامتگاه",
          amount: Math.round(stayTotal),
          kind: "real",
          detail: `${inputs.accommodation?.name || "اقامتگاه انتخاب‌شده"}${inputs.accommodation?.nights ? ` · ${numFa(inputs.accommodation.nights)} شب` : ""} — قیمت لحظهٔ انتخاب`,
        },
  );

  // 2) Transport — also a real pick (a live ticket price or the transparent car estimate).
  const transportTotal = positiveOrNull(inputs.transport?.totalToman);
  lines.push(
    transportTotal === null
      ? {
          id: "transport",
          label: "حمل‌ونقل",
          amount: null,
          kind: "missing",
          detail: "وسیلهٔ سفر انتخاب نشده؛ از صفحهٔ حمل‌ونقل بلیت یا ماشین شخصی را انتخاب کنید.",
        }
      : {
          id: "transport",
          label: "حمل‌ونقل",
          amount: Math.round(transportTotal),
          kind: "real",
          detail: `${inputs.transport?.label || "وسیلهٔ انتخاب‌شده"} — همان مبلغی که در مرحلهٔ حمل‌ونقل انتخاب شد`,
        },
  );

  // 3) Driving inside the city — measured kilometres × your own per-kilometre rate.
  lines.push(
    cityKm === null
      ? {
          id: "city-drive",
          label: "رانندگی در شهر",
          amount: null,
          kind: "missing",
          detail: "کیلومتر درون‌شهری اندازه‌گیری نشد؛ با دکمهٔ «اندازه‌گیری دوبارهٔ مسیرها» فاصله‌ها را بگیرید.",
        }
      : {
          id: "city-drive",
          label: "رانندگی در شهر",
          amount: roundToThousand(cityKm * assumptions.cityCostPerKm),
          kind: "estimate",
          detail: `${numFa(Math.round(cityKm * 10) / 10)} کیلومتر اندازه‌گیری‌شده × ${formatToman(assumptions.cityCostPerKm)} در هر کیلومتر (بنزین و استهلاک)`,
        },
  );

  // 4) Food.
  lines.push({
    id: "food",
    label: "خوراک",
    amount: roundToThousand(people * days * assumptions.foodPerPersonPerDay),
    kind: "estimate",
    detail: `${numFa(people)} نفر × ${numFa(days)} روز × ${formatToman(assumptions.foodPerPersonPerDay)}`,
  });

  // 5) Tickets. Not every attraction charges; this is the ceiling, said out loud.
  lines.push(
    stops === 0
      ? {
          id: "tickets",
          label: "بلیت جاذبه‌ها",
          amount: null,
          kind: "missing",
          detail: "هنوز ایستگاهی در برنامه نیست.",
        }
      : {
          id: "tickets",
          label: "بلیت جاذبه‌ها",
          amount: roundToThousand(stops * people * assumptions.ticketPerStop),
          kind: "estimate",
          detail: `${numFa(stops)} ایستگاه × ${numFa(people)} نفر × ${formatToman(assumptions.ticketPerStop)} — سقف تقریبی، چون همهٔ جاذبه‌ها بلیت ندارند`,
        },
  );

  // 6) Souvenirs and small things.
  lines.push({
    id: "extras",
    label: "سوغات و متفرقه",
    amount: roundToThousand(people * days * assumptions.extrasPerPersonPerDay),
    kind: "estimate",
    detail: `${numFa(people)} نفر × ${numFa(days)} روز × ${formatToman(assumptions.extrasPerPersonPerDay)}`,
  });

  const known = lines.filter((line) => line.amount !== null) as (BudgetLine & { amount: number })[];
  const total = known.reduce((sum, line) => sum + line.amount, 0);
  const realTotal = known.filter((line) => line.kind === "real").reduce((sum, line) => sum + line.amount, 0);
  const estimateTotal = known.filter((line) => line.kind === "estimate").reduce((sum, line) => sum + line.amount, 0);
  const missing = lines.filter((line) => line.kind === "missing").map((line) => line.id);

  const budget = positiveOrNull(inputs.budgetToman);
  const remaining = budget === null ? null : budget - total;

  const shares = known.map((line) => ({
    id: line.id,
    percent: total > 0 ? Math.round((line.amount / total) * 1000) / 10 : 0,
  }));

  const notes: string[] = [];
  if (missing.includes("stay")) notes.push("قیمت اقامتگاه در جمع حساب نشده، چون هنوز انتخاب نشده است.");
  if (missing.includes("transport")) notes.push("قیمت حمل‌ونقل در جمع حساب نشده، چون هنوز انتخاب نشده است.");
  if (missing.includes("city-drive")) notes.push("هزینهٔ رانندگی در شهر حساب نشده، چون کیلومترها اندازه‌گیری نشده‌اند.");
  notes.push(
    children > 0
      ? "کودکان در خوراک و بلیت مثل یک نفر کامل حساب شده‌اند؛ نوزادان حساب نشده‌اند. اگر غذای کودک کمتر است، عدد خوراک روزانه را پایین بیاورید."
      : "نوزادان در این جمع حساب نشده‌اند.",
  );
  notes.push("ردیف‌های «تخمین با فرض شما» عدد قطعی نیستند؛ با تغییر فرض‌ها، جمع سفر بلافاصله به‌روز می‌شود.");

  return {
    lines,
    total,
    realTotal,
    estimateTotal,
    budget,
    remaining,
    over: remaining !== null && remaining < 0,
    perDay: Math.round(total / days),
    perTraveler: Math.round(total / people),
    travelersForSplit: people,
    shares,
    missing,
    notes,
  };
}

function numFa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}
