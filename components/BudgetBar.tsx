"use client";

/**
 * «بودجهٔ سفر» — one number, shown the same everywhere, changed on purpose.
 *
 * The budget used to be a slider that sat on some pages and not others, and it
 * said «برای هر نفر» in one place. Now every step shows the same total for the
 * whole trip, and the only way to change it is this panel — so the number the
 * traveller reads on the transport page is the same number the plan is built
 * from.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Pencil, TriangleAlert, Wallet, X } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { MAX_BUDGET_MILLIONS, MIN_BUDGET_MILLIONS, affordabilityOf, budgetChange, clampBudgetMillions } from "@/lib/budget-control";

const fa = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${fa.format(Math.round(value))} تومان`;

const PRESETS = [10, 20, 40, 60, 80, 120];

export default function BudgetBar({
  /** The ticket or the room being looked at, so the alarm can be exact. */
  itemToman = 0,
  itemLabel = "این انتخاب",
  ticketToman = 0,
  stayToman = 0,
  compact = false,
  className = "",
}: {
  itemToman?: number;
  itemLabel?: string;
  ticketToman?: number;
  stayToman?: number;
  compact?: boolean;
  className?: string;
}) {
  const { travelData, setTravelData } = useTravel();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number>(Number(travelData.budget) || 15);
  const [notice, setNotice] = useState("");

  const totalToman = Math.max(0, Math.round((Number(travelData.budget) || 0) * 1_000_000));
  const travellers = Math.max(1, Number(travelData.travelers || 1) + Number(travelData.children || 0) + Number(travelData.infants || 0));
  const days = Math.max(1, Number(travelData.days) || 1);

  useEffect(() => {
    setDraft(Number(travelData.budget) || 15);
  }, [travelData.budget]);

  const fit = useMemo(
    () =>
      affordabilityOf({
        totalBudgetToman: totalToman,
        travellers,
        days,
        city: travelData.destination,
        ticketToman,
        stayToman,
        itemToman,
        itemLabel,
      }),
    [days, itemLabel, itemToman, stayToman, ticketToman, totalToman, travelData.destination, travellers],
  );

  const apply = (value: number) => {
    const next = clampBudgetMillions(value);
    const change = budgetChange(Number(travelData.budget) || 0, next);
    setTravelData((current) => ({ ...current, budget: next }));
    setDraft(next);
    setEditing(false);
    setNotice(change.message);
    window.setTimeout(() => setNotice(""), 6000);
  };

  return (
    <section
      className={`glass relative overflow-hidden ${compact ? "p-3" : "p-4"} ${className}`}
      aria-label="بودجهٔ سفر"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/12 text-cyan-200">
            <Wallet className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <span className="block text-[10px] text-slate-400">بودجهٔ کل سفر (برای همهٔ نفرات)</span>
            <b className="block text-sm font-black text-white">{money(totalToman)}</b>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">
            {fa.format(travellers)} نفر · {fa.format(days)} روز
          </span>
          <button
            type="button"
            onClick={() => setEditing((current) => !current)}
            aria-expanded={editing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-3 py-1.5 text-[10.5px] font-black text-cyan-100 transition hover:bg-cyan-300/20"
          >
            {editing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
            {editing ? "بستن" : "تغییر بودجه"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {editing ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 p-3">
              <p className="text-[10px] leading-6 text-slate-300">
                بودجهٔ کل سفر را عوض کن؛ همین عدد در بلیت، اقامتگاه، برنامه و پاسخ‌های همسفر به‌کار می‌رود.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESETS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => apply(value)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition ${
                      draft === value
                        ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
                        : "border-white/10 bg-white/[0.03] text-slate-300 hover:text-white"
                    }`}
                  >
                    {fa.format(value)} میلیون
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-1.5">
                  <span className="text-[9.5px] text-slate-400">دلخواه</span>
                  <input
                    type="number"
                    min={MIN_BUDGET_MILLIONS}
                    max={MAX_BUDGET_MILLIONS}
                    value={draft}
                    onChange={(event) => setDraft(Number(event.target.value) || MIN_BUDGET_MILLIONS)}
                    aria-label="بودجهٔ کل سفر به میلیون تومان"
                    className="w-16 bg-transparent text-center text-[11px] font-black text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[9.5px] text-slate-400">میلیون تومان</span>
                </label>
                <button
                  type="button"
                  onClick={() => apply(draft)}
                  className="inline-flex items-center gap-1 rounded-xl bg-cyan-300 px-3 py-2 text-[10.5px] font-black text-slate-950"
                >
                  <Check className="h-3 w-3" />
                  ثبت بودجه
                </button>
              </div>
              <p className="mt-2 text-[9px] leading-5 text-slate-500">
                کمترین {fa.format(MIN_BUDGET_MILLIONS)} و بیشترین {fa.format(MAX_BUDGET_MILLIONS)} میلیون تومان.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* The alarm: the real numbers for this traveller, and one way out. */}
      {fit.tone !== "fits" ? (
        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-[10px] leading-6 ${
            fit.tone === "over" ? "border-rose-400/30 bg-rose-400/[0.08] text-rose-100" : "border-amber-300/25 bg-amber-300/[0.07] text-amber-100"
          }`}
          role="alert"
        >
          <b className="flex items-center gap-1.5 text-[10.5px] font-black">
            <TriangleAlert className="h-3.5 w-3.5" />
            {fit.headline}
          </b>
          <span className="mt-1 block">{fit.detail}</span>
          {fit.tone === "over" ? (
            <button
              type="button"
              onClick={() => apply(fit.neededBudgetMillions)}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[9.5px] font-black text-white transition hover:bg-white/20"
            >
              <Check className="h-3 w-3" />
              بودجه را به {fa.format(fit.neededBudgetMillions)} میلیون برسان
            </button>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-2 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.08] px-2.5 py-1.5 text-[9.5px] leading-5 text-emerald-100"
        >
          {notice}
        </motion.p>
      ) : null}
    </section>
  );
}
