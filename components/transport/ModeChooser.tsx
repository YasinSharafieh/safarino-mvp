"use client";

import { motion } from "framer-motion";
import { Bus, CarFront, Check, Plane, TrainFront, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TravelMode = "plane" | "train" | "bus" | "car";

export type ModeOption = {
  id: TravelMode;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  emoji: string;
  accent: string;
};

export const MODE_OPTIONS: ModeOption[] = [
  {
    id: "plane",
    title: "هواپیما",
    subtitle: "سریع‌ترین راه؛ قیمت و ساعت از منابع بلیت",
    icon: Plane,
    emoji: "✈️",
    accent: "from-sky-400/20 via-teal-500/10 to-transparent",
  },
  {
    id: "train",
    title: "قطار",
    subtitle: "راحت و مقرون‌به‌صرفه؛ بلیت زنده با لینک خرید",
    icon: TrainFront,
    emoji: "🚂",
    accent: "from-emerald-400/20 via-teal-500/10 to-transparent",
  },
  {
    id: "bus",
    title: "اتوبوس VIP",
    subtitle: "گزینهٔ اقتصادی جاده‌ای؛ ساعت و قیمت زنده",
    icon: Bus,
    emoji: "🚌",
    accent: "from-cyan-400/20 via-sky-500/10 to-transparent",
  },
  {
    id: "car",
    title: "ماشین شخصی",
    subtitle: "هزینهٔ کامل: بنزین، استهلاک، سرویس، عوارض، پارکینگ",
    icon: CarFront,
    emoji: "🚗",
    accent: "from-turquoise-400/20 via-cyan-500/10 to-transparent",
  },
];

type Props = {
  mode: TravelMode | null;
  onChoose: (mode: TravelMode) => void;
  budgetMillions: number;
  onBudget: (millions: number) => void;
  hints: Partial<Record<TravelMode, string>>;
};

const BUDGETS = [5, 10, 20, 40];

/**
 * Step two of every trip, asked before any search: «با چی می‌روی و چقدر بودجه
 * داری؟». Only the chosen mode is opened afterwards, so the page never mixes a
 * train ticket list with a car calculator.
 */
export default function ModeChooser({ mode, onChoose, budgetMillions, onBudget, hints }: Props) {
  const fa = new Intl.NumberFormat("fa-IR");

  return (
    <section className="glass overflow-hidden p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">سؤال دوم سفر</span>
          <h2 className="mt-3 text-lg font-black text-white sm:text-xl">با چه وسیله‌ای می‌روی؟</h2>
          <p className="mt-1.5 text-[11px] leading-6 text-slate-400">
            یکی را انتخاب کن؛ بعد فقط همان بخش باز می‌شود — بلیت یا محاسبهٔ کامل ماشین.
          </p>
        </div>
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold text-slate-300">
            <Wallet className="h-3.5 w-3.5 text-cyan-300" />
            بودجهٔ سفر برای هر نفر
          </span>
          <div className="flex flex-wrap gap-1.5">
            {BUDGETS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onBudget(value)}
                aria-pressed={budgetMillions === value}
                className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${
                  budgetMillions === value
                    ? "border-cyan-300/50 bg-cyan-300/12 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                }`}
              >
                {fa.format(value)} میلیون
              </button>
            ))}
            <label className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-950/40 px-2 py-1">
              <input
                type="number"
                min={1}
                max={500}
                value={budgetMillions}
                onChange={(event) => onBudget(Math.max(1, Math.min(500, Number(event.target.value) || 1)))}
                aria-label="بودجهٔ سفر به میلیون تومان"
                className="w-11 bg-transparent text-center text-[10px] font-bold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                dir="ltr"
              />
              <span className="whitespace-nowrap text-[8.5px] text-slate-500">میلیون</span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODE_OPTIONS.map((option, index) => {
          const Icon = option.icon;
          const isSelected = mode === option.id;
          return (
            <motion.button
              key={option.id}
              type="button"
              onClick={() => onChoose(option.id)}
              aria-pressed={isSelected}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className={`group relative overflow-hidden rounded-2xl border p-3.5 text-right transition ${
                isSelected
                  ? "border-cyan-300/60 bg-cyan-300/10 shadow-glow"
                  : "border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.06]"
              }`}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-bl ${option.accent} opacity-70`} />
              <div className="relative">
                <div className="flex items-start justify-between">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl border ${isSelected ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-200" : "border-white/10 bg-white/5 text-slate-300"}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-2xl" aria-hidden="true">{option.emoji}</span>
                </div>
                <b className="mt-2.5 flex items-center gap-1.5 text-[13px] font-black text-white">
                  {option.title}
                  {isSelected ? <Check className="h-3.5 w-3.5 text-cyan-300" /> : null}
                </b>
                <span className="mt-0.5 block text-[9.5px] leading-5 text-slate-400">{option.subtitle}</span>
                {hints[option.id] ? (
                  <span className="mt-1.5 block rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-cyan-100">
                    {hints[option.id]}
                  </span>
                ) : null}
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
