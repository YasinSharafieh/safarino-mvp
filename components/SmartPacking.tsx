"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Backpack, Check, CloudSun, LoaderCircle, Plus } from "lucide-react";
import { PACKING_GROUPS, smartPacking, packingToChecklist, type PackingPlan } from "@/lib/packing";
import { readChecklist, saveChecklist, addCustomItem, CHECKLIST_EVENT } from "@/lib/checklist";

type WeatherLite = { code: number; label: string; icon: string; maxC: number | null; minC: number | null; rainProbability: number | null; windKmh: number | null };

/**
 * «چمدان هوشمند» — what to pack, decided by the real forecast.
 *
 * The list is built by `lib/packing.ts` from Open-Meteo numbers the page really
 * received. If there is no forecast (too far away, or the API is down) the card
 * says so and falls back to the season — it never invents weather.
 */
export default function SmartPacking({
  destination,
  days,
  startDate,
  children,
  mode,
  moods,
}: {
  destination: string;
  days: number;
  startDate?: string;
  children?: number;
  mode?: string;
  moods?: string[];
}) {
  const [weather, setWeather] = useState<WeatherLite[]>([]);
  const [mode2, setMode2] = useState<"forecast" | "normals" | "none">("none");
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!destination) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/weather/trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: destination, days: Math.max(1, Math.min(14, days)), startDate: startDate || null }),
    })
      .then((response) => response.json())
      .then((payload: { success?: boolean; mode?: "forecast" | "normals"; days?: WeatherLite[] }) => {
        if (cancelled) return;
        if (payload?.success && Array.isArray(payload.days)) {
          setWeather(payload.days);
          setMode2(payload.mode || "forecast");
        } else {
          setWeather([]);
          setMode2("none");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWeather([]);
          setMode2("none");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, destination, startDate]);

  const plan: PackingPlan = useMemo(
    () =>
      smartPacking({
        destination,
        days,
        weather: weather.map((day) => ({
          date: "",
          code: day.code,
          label: day.label,
          icon: day.icon,
          maxC: day.maxC,
          minC: day.minC,
          rainProbability: day.rainProbability,
          rainMm: null,
          windKmh: day.windKmh,
          score: 0,
          advice: "",
          tone: "ok",
        })),
        weatherMode: mode2,
        children,
        mode,
        moods,
        month: startDate ? Number(startDate.slice(5, 7)) : new Date().getMonth() + 1,
      }),
    [children, days, destination, mode, mode2, moods, startDate, weather],
  );

  const addToChecklist = () => {
    try {
      const state = readChecklist(window.localStorage);
      let next = state;
      // `addCustomItem` already refuses a title that is on the list, so pressing
      // the button twice can never duplicate anything.
      for (const item of packingToChecklist(plan, 6)) {
        next = addCustomItem(next, { title: item.title, group: "packing", daysBefore: item.daysBefore, note: item.note });
      }
      saveChecklist(next, window.localStorage);
      window.dispatchEvent(new Event(CHECKLIST_EVENT));
      setAdded(true);
    } catch {
      // The list on this page is still useful on its own.
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-slate-950">
            <Backpack className="h-4 w-4" />
          </span>
          <div>
            <b className="block text-[12px] font-black text-white">چمدان هوشمند</b>
            <span className="text-[9px] text-slate-400">بر اساس هوای واقعی همان روزها، نه حدس</span>
          </div>
        </div>
        <button
          type="button"
          onClick={addToChecklist}
          disabled={added || loading || !plan.items.length}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[9.5px] font-bold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-60"
        >
          {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {added ? "به چک‌لیست اضافه شد" : "افزودن به چک‌لیست"}
        </button>
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400">
          <LoaderCircle className="h-3 w-3 animate-spin" />
          در حال خواندن پیش‌بینی هوای {destination}…
        </p>
      ) : (
        <>
          <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-[9.5px] leading-6 text-slate-300">
            <CloudSun className="mt-0.5 h-3 w-3 shrink-0 text-sky-300" />
            <span>
              <b className="text-white">{plan.summary}</b>
              <span className="mt-0.5 block text-slate-400">{plan.basis}</span>
            </span>
          </p>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PACKING_GROUPS.map((group) => {
              const items = plan.items.filter((item) => item.group === group.id);
              if (!items.length) return null;
              return (
                <div key={group.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
                  <b className="text-[9.5px] font-black text-cyan-200">{group.label}</b>
                  <ul className="mt-1 space-y-1.5">
                    {items.map((item) => (
                      <li key={item.id} className="flex gap-1.5">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.weight === 3 ? "bg-rose-300" : item.weight === 2 ? "bg-amber-300" : "bg-slate-500"}`} />
                        <span className="min-w-0">
                          <b className="block text-[10px] font-bold text-white">{item.title}</b>
                          <span className="block text-[9px] leading-5 text-slate-400">{item.reason}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[8.5px] leading-5 text-slate-500">
            نقطه‌های رنگی: قرمز = بدون این، سفر سخت می‌شود · زرد = بهتر است باشد · خاکستری = راحتی بیشتر.
          </p>
        </>
      )}
    </motion.div>
  );
}
