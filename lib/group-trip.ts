/**
 * «دستیار گروه» — the arithmetic a group trip actually needs.
 *
 * When more than one person travels, the only question that causes trouble is
 * *who pays how much*. The site already knows the real total budget, the planned
 * cost and the money actually spent; this file splits those three numbers between
 * the travellers without ever losing a toman and without inventing a single one:
 *
 *  - each member has a weight in half-units (an adult is 2, a child is 1, so a
 *    child counts as half a share — a split the traveller can change);
 *  - the toman is integer currency, so the split is done in integer toman and the
 *    few toman left over are handed out one by one, biggest remainder first; the
 *    parts always add up to the whole, exactly;
 *  - if more than one person travelled and the site does not know who paid each
 *    receipt, it says so plainly instead of pretending to settle debts.
 *
 * Storage is the traveller's own device, one group per trip.
 */

import { tripSignature, type TripSignatureInput } from "./checklist";

export const GROUP_STORAGE_KEY = "safarino-group-v1";
export const GROUP_EVENT = "safarino-group-changed";
export const MAX_MEMBERS = 12;

export type GroupMember = {
  id: string;
  name: string;
  /** Half-units: 2 = a full share, 1 = half a share, 3 = one and a half. */
  weight: number;
};

export type SplitRow = {
  id: string;
  name: string;
  weight: number;
  /** Share of the whole, as an integer percentage that sums to 100 when possible. */
  sharePct: number;
  /** This member's part of the number that was split, in integer toman. */
  amount: number;
};

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));

export function groupKeyFor(trip?: TripSignatureInput | string): string {
  const signature = typeof trip === "string" ? trip : trip ? tripSignature(trip) : "no-trip";
  return `${GROUP_STORAGE_KEY}:${signature}`;
}

/** The group a trip starts with: the travellers and children the site already knows. */
export function defaultMembers(travellers: number, children = 0): GroupMember[] {
  const adults = Math.max(0, Math.min(MAX_MEMBERS, Math.round(Number(travellers) || 0)));
  const kids = Math.max(0, Math.min(MAX_MEMBERS - adults, Math.round(Number(children) || 0)));
  const members: GroupMember[] = [];
  for (let index = 0; index < adults; index += 1) {
    members.push({ id: `a${index + 1}`, name: `همسفر ${new Intl.NumberFormat("fa-IR").format(index + 1)}`, weight: 2 });
  }
  for (let index = 0; index < kids; index += 1) {
    members.push({ id: `c${index + 1}`, name: `کودک ${new Intl.NumberFormat("fa-IR").format(index + 1)}`, weight: 1 });
  }
  return members.length ? members : [{ id: "a1", name: "خودم", weight: 2 }];
}

/** Anything read from the device goes through here: bounded, de-duplicated, safe. */
export function normalizeMembers(raw: unknown): GroupMember[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const members: GroupMember[] = [];
  for (const entry of raw.slice(0, MAX_MEMBERS)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.slice(0, 40) : "";
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 40) : "";
    const weight = Number(item.weight);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    members.push({ id, name, weight: Number.isFinite(weight) ? Math.min(6, Math.max(1, Math.round(weight))) : 2 });
  }
  return members;
}

export function readGroup(trip?: TripSignatureInput | string): GroupMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(groupKeyFor(trip));
    return normalizeMembers(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export function writeGroup(members: GroupMember[], trip?: TripSignatureInput | string): GroupMember[] {
  const clean = normalizeMembers(members);
  if (typeof window === "undefined") return clean;
  try {
    window.localStorage.setItem(groupKeyFor(trip), JSON.stringify(clean));
    window.dispatchEvent(new Event(GROUP_EVENT));
  } catch {
    /* a full disk is not a reason to break the page */
  }
  return clean;
}

/**
 * Splits an integer amount of toman by weight, exactly.
 * `remainder` is how many toman were handed out as extra single toman; the sum of
 * `rows[].amount` is always exactly the amount asked for.
 */
export function splitAmount(totalToman: number, members: GroupMember[]): { rows: SplitRow[]; remainder: number; total: number } {
  const usable = normalizeMembers(members);
  const total = Number.isFinite(totalToman) ? Math.round(totalToman) : 0;
  if (!usable.length) return { rows: [], remainder: 0, total };
  if (total <= 0) {
    return {
      rows: usable.map((member) => ({ id: member.id, name: member.name, weight: member.weight, sharePct: 0, amount: 0 })),
      remainder: 0,
      total: 0,
    };
  }

  const weightSum = usable.reduce((sum, member) => sum + member.weight, 0);
  const parts = usable.map((member) => {
    const exact = (total * member.weight) / weightSum;
    return { member, exact, floor: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });

  let assigned = parts.reduce((sum, part) => sum + part.floor, 0);
  let remainder = total - assigned;
  const order = parts
    .map((part, index) => ({ index, fraction: part.fraction }))
    .sort((a, b) => (b.fraction - a.fraction) || (a.index - b.index));
  const extra = new Array(parts.length).fill(0) as number[];
  for (const entry of order) {
    if (remainder <= 0) break;
    extra[entry.index] += 1;
    remainder -= 1;
  }
  assigned = total - remainder;

  const rows: SplitRow[] = parts.map((part, index) => ({
    id: part.member.id,
    name: part.member.name,
    weight: part.member.weight,
    sharePct: Math.round((part.member.weight / weightSum) * 1000) / 10,
    amount: part.floor + extra[index],
  }));

  return { rows, remainder, total: assigned };
}

export type GroupMoney = {
  /** The trip's total budget. */
  budget?: number;
  /** What the plan says it will cost. */
  planned?: number;
  /** What the traveller has actually written in the ledger. */
  spent?: number;
};

export type GroupRow = {
  id: string;
  name: string;
  weight: number;
  sharePct: number;
  budgetShare: number;
  plannedShare: number;
  spentShare: number;
  /** Budget share minus spent share: what this person still has for the trip. */
  remainingShare: number;
  /** True when this person's part of the real spending has passed their part of the budget. */
  overShare: boolean;
};

export type GroupSummary = {
  members: number;
  weightSum: number;
  rows: GroupRow[];
  /** Exact totals of what was split, so the interface can prove the maths. */
  totals: { budget: number; planned: number; spent: number; remaining: number };
  /** Persian sentences that are true for this group, at most three. */
  notes: string[];
};

export function groupSummary(money: GroupMoney, members: GroupMember[]): GroupSummary {
  const usable = normalizeMembers(members);
  const budget = Math.max(0, Math.round(money.budget || 0));
  const planned = Math.max(0, Math.round(money.planned || 0));
  const spent = Math.max(0, Math.round(money.spent || 0));
  const budgetSplit = splitAmount(budget, usable);
  const plannedSplit = splitAmount(planned, usable);
  const spentSplit = splitAmount(spent, usable);

  const rows: GroupRow[] = budgetSplit.rows.map((row, index) => {
    const plannedShare = plannedSplit.rows[index]?.amount || 0;
    const spentShare = spentSplit.rows[index]?.amount || 0;
    return {
      id: row.id,
      name: row.name,
      weight: row.weight,
      sharePct: row.sharePct,
      budgetShare: row.amount,
      plannedShare,
      spentShare,
      remainingShare: row.amount - spentShare,
      overShare: row.amount > 0 && spentShare > row.amount,
    };
  });

  const weightSum = usable.reduce((sum, member) => sum + member.weight, 0);
  const notes: string[] = [];
  if (usable.length > 1) {
    notes.push(
      `سهم هر نفر بر اساس ${fa(usable.length)} عضو و ${fa(weightSum)} واحد وزن حساب شد؛ بزرگسال ۲ واحد و کودک ۱ واحد. جمع سهم‌ها دقیقاً ${fa(budget)} تومان است.`,
    );
  }
  const over = rows.filter((row) => row.overShare);
  if (over.length) {
    notes.push(`${over.map((row) => row.name).join("، ")} از سهم خودش بیشتر خرج کرده؛ در تسویه باید جبران شود.`);
  }
  if (usable.length > 1 && spent > 0) {
    notes.push("برای «چه کسی به چه کسی بدهکار است» باید بدانیم هر خرج را چه کسی پرداخت کرده؛ این را عمداً حدس نمی‌زنیم.");
  }

  return {
    members: usable.length,
    weightSum,
    rows,
    totals: { budget, planned, spent, remaining: budget - spent },
    notes: notes.slice(0, 3),
  };
}

/** Persian label for a weight, used by the editor. */
export function weightLabel(weight: number): string {
  if (weight === 1) return "نیم‌سهم (کودک)";
  if (weight === 2) return "یک سهم (بزرگسال)";
  if (weight === 3) return "یک‌ونیم سهم";
  if (weight === 4) return "دو سهم";
  return `${fa(weight / 2)} سهم`;
}
