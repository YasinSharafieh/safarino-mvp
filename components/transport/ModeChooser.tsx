"use client";

import { motion } from "framer-motion";
import { Bus, CarFront, Check, LoaderCircle, Plane, TrainFront, Wallet } from "lucide-react";
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

const faNumber = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

type Props = {
  mode: TravelMode | null;
  onChoose: (mode: TravelMode) => void;
  budgetMillions: number;
  hints: Partial<Record<TravelMode, string>>;
  /**
   * How many real tickets each mode answered with for this exact route and
   * date, measured by the same availability sweep the calendar uses. A mode
   * that answered zero says so — the traveller then switches instead of
   * waiting for a list that will never fill.
   */
  counts?: Partial<Record<TravelMode, number | null>>;
  countsLoading?: boolean;
};


/**
 * Step two of every trip, asked before any search: «با چی می‌روی و چقدر بودجه
 * داری؟». Only the chosen mode is opened afterwards, so the page never mixes a
 * train ticket list with a car calculator.
 */
export default function ModeChooser({ mode, onChoose, budgetMillions: _budgetMillions, hints, counts, countsLoading = false }: Props) {
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
                {option.id !== "car" ? (
                  <span className="mt-1.5 flex items-center gap-1 text-[9px] font-bold">
                    {countsLoading && counts?.[option.id] === undefined ? (
                      <span className="flex items-center gap-1 text-slate-500">
                        <LoaderCircle className="h-2.5 w-2.5 animate-spin" />
                        شمردن بلیت‌های همین تاریخ…
                      </span>
                    ) : typeof counts?.[option.id] === "number" ? (
                      (counts[option.id] as number) > 0 ? (
                        <span className="text-emerald-300">✓ {faNumber(counts[option.id] as number)} بلیت برای همین تاریخ</span>
                      ) : (
                        <span className="text-amber-300">بلیتی برای این تاریخ نیافتیم</span>
                      )
                    ) : (
                      <span className="text-slate-500">موجودی این تاریخ سنجیده نشده</span>
                    )}
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
