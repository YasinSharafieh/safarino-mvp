/**
 * «خرج‌های واقعی سفر» — the ledger that turns a planned budget into a true one.
 *
 * Until now the remaining budget was an estimate: five rows, computed before the
 * trip. On the road the traveller pays real amounts, and the honest thing is to
 * write them down and subtract them. This file is that book.
 *
 * Rules:
 *  - it lives in this browser only, one book per trip (the trip's own signature),
 *    so last summer's taxi never appears in this trip's maths;
 *  - an entry needs a real amount; a title is optional but never invented — a
 *    photo entry keeps the amount the receipt actually showed;
 *  - totals are simple sums of what was entered, and the comparison is always
 *    against the same total budget the rest of the site uses;
 *  - nothing is uploaded anywhere, and no model is needed to read the book.
 */

import { tripSignature, type TripSignatureInput } from "./checklist";

export const LEDGER_STORAGE_KEY = "safarino-ledger-v1";
export const LEDGER_EVENT = "safarino-ledger-changed";
export const MAX_ENTRIES = 200;

export type ExpenseCategory = "transport" | "stay" | "food" | "activity" | "shopping" | "other";

export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  transport: "بلیت و مسافرت",
  stay: "اقامت",
  food: "غذا",
  activity: "بازدید و تفریح",
  shopping: "خرید و سوغات",
  other: "سایر",
};

export type Expense = {
  id: string;
  title: string;
  toman: number;
  category: ExpenseCategory;
  /** ISO timestamp when it was written down. */
  at: string;
  /** Where the number came from: typed by the traveller or read from a receipt photo. */
  source: "manual" | "receipt";
  /** The vendor or place the receipt showed, when there is one. */
  vendor?: string | null;
};

export type LedgerTotals = {
  entries: Expense[];
  totalToman: number;
  byCategory: { category: ExpenseCategory; label: string; toman: number; share: number }[];
  /** What is left of the total budget once the real spending is subtracted. */
  remainingToman: number;
  /** True when real spending has passed the budget. */
  overBudget: boolean;
  /** The biggest single entry, for the summary sentence. */
  biggest: Expense | null;
};

export function ledgerKeyFor(trip?: TripSignatureInput | string): string {
  const signature = typeof trip === "string" ? trip : trip ? tripSignature(trip) : "no-trip";
  return `${LEDGER_STORAGE_KEY}:${signature}`;
}

export function readLedger(trip?: TripSignatureInput | string): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ledgerKeyFor(trip));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is Expense =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as Expense).toman === "number" &&
        Number.isFinite((entry as Expense).toman) &&
        (entry as Expense).toman > 0 &&
        typeof (entry as Expense).id === "string",
    );
  } catch {
    return [];
  }
}

function writeLedger(trip: TripSignatureInput | string | undefined, entries: Expense[]): Expense[] {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ledgerKeyFor(trip), JSON.stringify(entries.slice(-MAX_ENTRIES)));
      window.dispatchEvent(new CustomEvent(LEDGER_EVENT));
    } catch {
      // A full or blocked storage simply keeps no book.
    }
  }
  return entries;
}

/** Adds an entry. A missing title is replaced by its category, never by a guess. */
export function addExpense(trip: TripSignatureInput | string | undefined, input: Omit<Expense, "id" | "at"> & { at?: string }): Expense[] {
  const toman = Math.round(Number(input.toman));
  if (!Number.isFinite(toman) || toman <= 0) return readLedger(trip);
  const entry: Expense = {
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: (input.title || "").trim().slice(0, 60) || EXPENSE_LABELS[input.category || "other"],
    toman,
    category: input.category || "other",
    at: input.at || new Date().toISOString(),
    source: input.source || "manual",
    vendor: input.vendor || null,
  };
  return writeLedger(trip, [...readLedger(trip), entry]);
}

export function removeExpense(trip: TripSignatureInput | string | undefined, id: string): Expense[] {
  return writeLedger(trip, readLedger(trip).filter((entry) => entry.id !== id));
}

export function clearLedger(trip: TripSignatureInput | string | undefined): Expense[] {
  return writeLedger(trip, []);
}

/**
 * The totals, and one sentence that says what the numbers mean — never more.
 */
export function ledgerTotals(entries: Expense[], totalBudgetToman: number): LedgerTotals {
  const totalToman = entries.reduce((sum, entry) => sum + Math.max(0, Math.round(entry.toman)), 0);
  const categories = Object.keys(EXPENSE_LABELS) as ExpenseCategory[];
  const byCategory = categories
    .map((category) => {
      const toman = entries.filter((entry) => entry.category === category).reduce((sum, entry) => sum + Math.round(entry.toman), 0);
      return { category, label: EXPENSE_LABELS[category], toman, share: totalToman > 0 ? Math.round((toman / totalToman) * 100) : 0 };
    })
    .filter((row) => row.toman > 0)
    .sort((a, b) => b.toman - a.toman);
  const budget = Math.max(0, Math.round(totalBudgetToman));
  const remainingToman = budget - totalToman;
  const biggest = entries.length
    ? entries.reduce((best, entry) => (entry.toman > best.toman ? entry : best), entries[0])
    : null;
  return {
    entries,
    totalToman,
    byCategory,
    remainingToman,
    overBudget: remainingToman < 0,
    biggest,
  };
}

/**
 * The sentence shown under the ledger. It is built from the book itself, so it
 * can be spoken out loud without a model and can never contradict the numbers
 * above it.
 */
export function ledgerSentence(totals: LedgerTotals, totalBudgetToman: number): string {
  const fa = new Intl.NumberFormat("fa-IR");
  if (!totals.entries.length) return "هنوز خرجی ثبت نشده؛ اولین رسید را اضافه کن تا باقی‌ماندهٔ واقعی بودجه را ببینی.";
  const biggest = totals.biggest;
  const head = totals.overBudget
    ? `خرج‌های ثبت‌شده ${fa.format(Math.abs(totals.remainingToman))} تومان از بودجهٔ ${fa.format(totalBudgetToman)} تومانی گذشته است.`
    : `از بودجهٔ ${fa.format(totalBudgetToman)} تومان، ${fa.format(totals.totalToman)} تومان خرج شده و ${fa.format(
        totals.remainingToman,
      )} تومان مانده.`;
  const cat = totals.byCategory[0];
  return `${head}${cat ? ` بیشترین سهم با ${cat.label} است (${fa.format(cat.toman)} تومان، ${fa.format(cat.share)}٪).` : ""}${
    biggest ? ` بزرگ‌ترین خرج: ${biggest.title} با ${fa.format(biggest.toman)} تومان.` : ""
  }`;
}
