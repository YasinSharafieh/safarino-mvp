/**
 * «پیشنهادهای سفر» that actually change.
 *
 * The packages themselves are real (a live ticket + a live room). What was dull
 * was the shelf: always the same four cards, cheapest first, with no idea of the
 * traveller's money. This module adds three things and never invents a number:
 *
 *   1. a **tier** for every package (اقتصادی / متوسط / لوکس) measured against the
 *      money the traveller actually has,
 *   2. a **spread** so the shelf always shows different vehicles and different
 *      price levels instead of four near-identical cheapest trips,
 *   3. a **rotation** so every press of «بهروزرسانی» shows other real packages,
 *      and the reason shown under each card is computed from its own numbers.
 */

import type { TripPackage } from "./trip-packages";

export type PackageTier = "economy" | "balanced" | "premium";

export const TIER_LABEL: Record<PackageTier, string> = {
  economy: "اقتصادی",
  balanced: "متوسط",
  premium: "لوکس",
};

export type CuratedPackage = TripPackage & {
  tier: PackageTier;
  tierLabel: string;
  /** Cost per person per day, in toman — the number the tier is based on. */
  perPersonPerDay: number;
  /** 0–100: how well it fits the money the traveller said they have. */
  fitPct: number;
  /** One sentence built only from this package's own numbers. */
  reason: string;
  /** A short AI sentence, when one was written for this exact package. */
  aiWhy?: string;
};

export type CuratorInput = {
  budgetMillions: number;
  travellers: number;
  days: number;
  /** "any" keeps every vehicle; otherwise only packages found on that vehicle. */
  mode?: "any" | "plane" | "train" | "bus";
  taste?: string[];
  /** Advanced by the page on every refresh, so the same list never repeats. */
  seed?: number;
};

const MODE_LABEL: Record<string, string> = { plane: "هواپیما", train: "قطار", bus: "اتوبوس" };

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

function toman(value: number): string {
  return `${fa(value)} تومان`;
}

/** Ratings keep one decimal — «۴٫۶» must never be rounded up to «۵». */
function rating(value: number): string {
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(value);
}

export function tierFor(perPersonPerDay: number, budgetPerPersonPerDay: number): PackageTier {
  if (budgetPerPersonPerDay <= 0) return "balanced";
  const share = perPersonPerDay / budgetPerPersonPerDay;
  if (share <= 0.55) return "economy";
  if (share <= 1) return "balanced";
  return "premium";
}

/** The one line that explains a card — always from its own numbers. */
export function packageReason(pkg: TripPackage, tier: PackageTier, travellers: number, days: number): string {
  const mode = MODE_LABEL[pkg.ticket.mode] || "سفر";
  const nights = Math.max(1, pkg.nights);
  const perNight = Math.round(pkg.stayTotalToman / nights);
  if (tier === "economy") {
    return `${mode} + ${pkg.stay.typeLabel} — هر شب ${toman(perNight)} و برای ${fa(travellers)} نفر ${fa(days)} روز جمعاً ${toman(pkg.totalToman)}؛ ارزان‌ترین ترکیبی که همین حالا موجود بود.`;
  }
  if (tier === "premium") {
    return `${mode} + ${pkg.stay.typeLabel} با امتیاز ${pkg.stay.rating ? rating(pkg.stay.rating) : "—"} — راحت‌تر از بقیه، ${toman(pkg.totalToman)} برای کل سفر؛ بیشتر از بودجهٔ هر نفر در روز درمی‌آید.`;
  }
  return `${mode} + ${pkg.stay.typeLabel} — ${pkg.ticket.operator}، اقامت ${pkg.stay.name}؛ ${toman(pkg.totalToman)} برای ${fa(days)} روز، نه ارزان‌ترین و نه گران‌ترین.`;
}

/**
 * The shelf: filtered, tiered, deliberately mixed, then rotated.
 *
 * Diversity rules, in order:
 *   • never two cards with the same vehicle unless there is nothing else,
 *   • never two cards in the same tier while another tier is available,
 *   • then fill the rest by best budget fit.
 */
export function curatePackages(packages: TripPackage[], input: CuratorInput): CuratedPackage[] {
  const travellers = Math.max(1, Math.round(input.travellers || 1));
  const days = Math.max(1, Math.round(input.days || 1));
  const budgetToman = Math.max(0, Math.round((input.budgetMillions || 0) * 1_000_000));
  const budgetPerPersonPerDay = budgetToman / (travellers * days);

  const prepared: CuratedPackage[] = packages
    .filter((pkg) => (input.mode && input.mode !== "any" ? pkg.ticket.mode === input.mode : true))
    .map((pkg) => {
      // Each card is judged on its own trip: the ticket and room it really found,
      // divided by the people and days that package actually covers.
      const pkgPeople = Math.max(1, Math.round(pkg.travellers || travellers));
      const pkgDays = Math.max(1, Math.round(pkg.days || days));
      const perPersonPerDay = Math.round(pkg.totalToman / (pkgPeople * pkgDays));
      const tier = tierFor(perPersonPerDay, budgetPerPersonPerDay);
      const fitPct =
        budgetPerPersonPerDay > 0
          ? Math.max(0, Math.min(100, Math.round((1 - Math.abs(perPersonPerDay - budgetPerPersonPerDay) / budgetPerPersonPerDay) * 100)))
          : 0;
      return {
        ...pkg,
        perPersonPerDay,
        tier,
        tierLabel: TIER_LABEL[tier],
        fitPct,
        reason: packageReason(pkg, tier, pkgPeople, pkgDays),
      };
    });

  // Rotation: shift the order by the seed *before* the diversity pass, so a
  // refresh picks different cards even when the money is identical.
  const seed = Math.abs(Math.round(input.seed || 0));
  const rotated = prepared.length ? [...prepared.slice(seed % prepared.length), ...prepared.slice(0, seed % prepared.length)] : [];

  const picked: CuratedPackage[] = [];
  const usedModes = new Set<string>();
  const usedTiers = new Set<PackageTier>();
  for (const pkg of rotated) {
    if (picked.some((item) => item.id === pkg.id)) continue;
    if (usedModes.has(pkg.ticket.mode) && picked.length < 3) continue;
    if (usedTiers.has(pkg.tier) && picked.length < 3) continue;
    picked.push(pkg);
    usedModes.add(pkg.ticket.mode);
    usedTiers.add(pkg.tier);
  }
  // Fill the rest when the diversity rules were too strict for what came back.
  for (const pkg of rotated) {
    if (picked.length >= 4) break;
    if (picked.some((item) => item.id === pkg.id)) continue;
    picked.push(pkg);
  }

  const ordered = picked.sort((a, b) => b.fitPct - a.fitPct || a.totalToman - b.totalToman);
  // The seed also rotates the finished shelf, so a refresh always looks different
  // even when the providers returned exactly the same money.
  if (seed > 0 && ordered.length > 1) {
    const shift = seed % ordered.length;
    return [...ordered.slice(shift), ...ordered.slice(0, shift)];
  }
  return ordered;
}

/** What the shelf says about the money — computed, never guessed. */
export function shelfSummary(items: CuratedPackage[], input: CuratorInput): string {
  if (!items.length) return "";
  const travellers = Math.max(1, Math.round(input.travellers || 1));
  const days = Math.max(1, Math.round(input.days || 1));
  const budgetToman = Math.max(0, Math.round((input.budgetMillions || 0) * 1_000_000));
  if (!budgetToman) {
    return `این ${fa(items.length)} بسته از ارزان به گران مرتب شده‌اند و همه با بلیت و اقامت واقعی ساخته شده‌اند؛ بودجه‌ات را بگو تا داخلشان فقط آن‌هایی را نگه دارم که جا می‌شود.`;
  }
  const inside = items.filter((pkg) => pkg.totalToman <= budgetToman);
  if (inside.length) {
    return `با بودجهٔ ${toman(budgetToman)} برای ${fa(travellers)} نفر و ${fa(days)} روز، ${fa(inside.length)} بسته از این فهرست کامل داخل بودجه‌ات جا می‌شود؛ بقیه را هم گذاشتم تا ببینی با کمی بالاتر چه چیزی هست.`;
  }
  const cheapest = items.reduce((best, pkg) => (pkg.totalToman < best.totalToman ? pkg : best), items[0]);
  return `هیچ‌کدام از این بسته‌ها با ${toman(budgetToman)} جا نمی‌شود؛ ارزان‌ترینشان ${toman(cheapest.totalToman)} است. می‌توانی تعداد شب را کم کنی یا وسیلهٔ ارزان‌تری مثل اتوبوس را انتخاب کنی.`;
}

/** The prompt for one AI call that only writes a line under each card. */
export function packagePrompt(items: CuratedPackage[], input: CuratorInput): string {
  return `این بسته‌های سفر از منابع واقعی (بلیت و اقامت) خوانده شده‌اند. مسافر: ${input.travellers} نفر، ${input.days} روز، بودجهٔ ${input.budgetMillions} میلیون تومان${input.taste?.length ? `، سلیقه: ${input.taste.join("، ")}` : ""}.

${items
  .map(
    (pkg, index) =>
      `${index + 1}) id=${pkg.id} | ${pkg.origin} → ${pkg.destination} | وسیله: ${MODE_LABEL[pkg.ticket.mode] || pkg.ticket.mode} | اقامت: ${pkg.stay.name} (${pkg.stay.typeLabel}) | جمع: ${pkg.totalToman} تومان | هر نفر هر روز: ${pkg.perPersonPerDay} تومان | سطح: ${pkg.tierLabel}`,
  )
  .join("\n")}

برای هر بسته یک جملهٔ کوتاه فارسی (حداکثر ۱۴ کلمه) بنویس که بگوید چرا برای این مسافر مناسب یا نامناسب است. هیچ عدد تازه‌ای (قیمت، امتیاز، درصد) نساز و اسم مکان یا ساعت کاری جدید اضافه نکن. فقط JSON:
{"items":[{"id":"...","why":"..."}],"summary":"یک جمله دربارهٔ این‌که این فهرست چه چیزی را پوشش می‌دهد"}`;
}

/** Keeps only ids that exist, and refuses any sentence with a new number. */
export function sanitizePackageAnswer(
  raw: unknown,
  items: CuratedPackage[],
): { items: CuratedPackage[]; summary: string; source: "ai" | "local" } {
  const fallback = { items, summary: "", source: "local" as const };
  if (!raw || typeof raw !== "object") return fallback;
  const body = raw as Record<string, unknown>;
  const rows = Array.isArray(body.items) ? body.items : [];
  const byId = new Map(items.map((item) => [item.id, item]));

  const allowed = new Set<string>();
  for (const item of items) {
    allowed.add(String(item.totalToman));
    allowed.add(String(Math.round(item.totalToman / 1_000)));
    allowed.add(String(item.perPersonPerDay));
    allowed.add(String(item.nights));
    allowed.add(String(item.travellers));
    allowed.add(String(item.days));
  }

  let applied = 0;
  const next = items.map((item) => {
    const row = rows.find((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && (entry as Record<string, unknown>).id === item.id);
    const why = typeof row?.why === "string" ? row.why.replace(/\s+/g, " ").trim().slice(0, 160) : "";
    if (!why) return item;
    if (!byId.has(item.id)) return item;
    const numbers = why.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))).replace(/[,٬]/g, "").match(/\d{1,12}/g) || [];
    if (numbers.some((number) => !allowed.has(number))) return item;
    applied += 1;
    return { ...item, aiWhy: why };
  });

  const summary = typeof body.summary === "string" ? body.summary.replace(/\s+/g, " ").trim().slice(0, 220) : "";
  return { items: next, summary: applied ? summary : "", source: applied ? "ai" : "local" };
}
