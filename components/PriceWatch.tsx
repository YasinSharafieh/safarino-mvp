"use client";

/**
 * «قیمت این مسیر» — the one line of price history the site can honestly show.
 *
 * It reads nothing itself: a trend is handed to it, produced by `lib/price-watch`
 * from prices Safarino actually read. When there is only one reading it says so
 * instead of drawing a fake arrow, and when the search came from a saved copy it
 * says that too.
 */

import { ArrowDownRight, ArrowUpRight, LineChart, Minus, TrendingUp } from "lucide-react";

export type PriceForecastView = {
  points: number;
  spanHours: number;
  horizonDays: number;
  predictedToman: number;
  deltaPct: number;
  direction: "up" | "down" | "flat";
  confidence: "low" | "medium" | "high";
  message: string;
};

export type PriceTrendView = {
  latest: { at: string; priceToman: number; offers: number };
  baseline: { at: string; priceToman: number; offers: number };
  deltaToman: number;
  deltaPct: number;
  direction: "down" | "up" | "flat";
  message: string;
  readings: number;
  /** Where our own readings point; absent when the history is too short. */
  forecast?: PriceForecastView | null;
};

const fa = new Intl.NumberFormat("fa-IR");

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const hours = Math.max(0, Math.round((Date.now() - date.getTime()) / 3_600_000));
  if (hours < 1) return "کمتر از یک ساعت پیش";
  if (hours < 24) return `${fa.format(hours)} ساعت پیش`;
  return `${fa.format(Math.round(hours / 24))} روز پیش`;
}

export default function PriceWatch({ trend, className = "" }: { trend: PriceTrendView | null; className?: string }) {
  if (!trend) return null;
  const Icon = trend.direction === "down" ? ArrowDownRight : trend.direction === "up" ? ArrowUpRight : Minus;
  const tone =
    trend.direction === "down"
      ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-100"
      : trend.direction === "up"
        ? "border-amber-300/25 bg-amber-300/[0.07] text-amber-100"
        : "border-white/10 bg-white/[0.03] text-slate-300";

  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${tone} ${className}`} aria-live="polite">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-black">
          <TrendingUp className="h-3 w-3" />
          تعقیب قیمت
          <span className="font-normal opacity-70">
            · {fa.format(trend.readings)} بار خواندن · آخرین بار {when(trend.latest.at)}
          </span>
        </p>
        <p className="mt-0.5 text-[9.5px] leading-5 opacity-90">{trend.message}</p>
        {trend.forecast ? (
          <p className="mt-1 flex items-start gap-1 rounded-lg border border-white/10 bg-black/20 px-1.5 py-1 text-[9px] leading-5 text-slate-300">
            <LineChart className="mt-0.5 h-2.5 w-2.5 shrink-0 text-cyan-200" />
            <span className="min-w-0">{trend.forecast.message}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
