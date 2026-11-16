"use client";

/**
 * «جدول هزینهٔ سفر» — the same five rows, in the same order, with the same
 * labels, on every page that talks about money.
 *
 * Nothing here calculates: it prints the breakdown it is given, which always
 * comes from `lib/trip-costs`. Two pages can therefore never disagree.
 */

import { formatToman } from "@/lib/budget";
import type { TripCostBreakdown } from "@/lib/trip-costs";

const fa = new Intl.NumberFormat("fa-IR");

export default function TripCostTable({
  breakdown,
  compact = false,
  title = "جدول هزینهٔ سفر",
  footnote,
}: {
  breakdown: TripCostBreakdown;
  compact?: boolean;
  title?: string;
  footnote?: string;
}) {
  const negative = breakdown.remaining < 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-night-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-white">{title}</span>
        <span className="text-[10px] text-slate-400">
          {fa.format(breakdown.travellers)} نفر · {fa.format(breakdown.days)} روز
          {breakdown.city ? ` · ${breakdown.city}` : ""}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {breakdown.rows.map((row) => (
          <li key={row.key} className="flex items-start justify-between gap-3 rounded-xl bg-white/[0.035] px-3 py-2">
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/90">
                {row.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[8.5px] font-black ${
                    row.kind === "real" ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"
                  }`}
                >
                  {row.kind === "real" ? "قطعی" : "تخمین"}
                </span>
              </span>
              {!compact && <span className="mt-1 block text-[9.5px] leading-5 text-slate-400">{row.detail}</span>}
            </span>
            <b className="shrink-0 text-[11px] font-black text-cyan-100">{formatToman(row.amount)}</b>
          </li>
        ))}
        <li className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
          <span className="text-[11px] font-black text-white">{negative ? "بیشتر از بودجه" : "باقی‌مانده"}</span>
          <b className={`text-xs font-black ${negative ? "text-rose-300" : "text-emerald-300"}`}>
            {formatToman(Math.abs(breakdown.remaining))}
          </b>
        </li>
      </ul>

      <p className="mt-3 text-[9.5px] leading-5 text-slate-400">
        بودجهٔ کل {formatToman(breakdown.totalBudget)} − جمع پنج ردیف بالا = {negative ? "کمبود " : "باقی‌ماندهٔ "}
        {formatToman(Math.abs(breakdown.remaining))}. {breakdown.note}
      </p>
      {footnote && <p className="mt-1 text-[9px] leading-5 text-slate-500">{footnote}</p>}
    </div>
  );
}
