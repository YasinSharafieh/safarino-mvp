"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CloudRain, LoaderCircle, ShieldAlert, Umbrella } from "lucide-react";
import { buildCrisisPlan, crisisNeeded, type CrisisPlace, type CrisisWeather } from "@/lib/crisis-plan";

type DayInput = {
  day: number;
  title: string;
  stops: { time: string; title: string; type: string; category?: string | null }[];
};

/**
 * «حالت بحران» — the app offers a Plan B before the traveller needs it.
 *
 * The forecast decides whether a plan B is worth showing at all; the replacement
 * places come from the same verified list the trip is built from. There is no AI
 * here on purpose: swapping a rainy day is arithmetic, and a model would only add
 * the chance of inventing a place.
 */
export default function CrisisPlanCard({
  destination,
  startDate,
  days,
  places,
}: {
  destination: string;
  startDate?: string;
  days: DayInput[];
  places: CrisisPlace[];
}) {
  const [weather, setWeather] = useState<CrisisWeather[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState<number | null>(null);

  useEffect(() => {
    if (!destination || !days.length) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/weather/trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: destination, days: Math.max(1, Math.min(14, days.length)), startDate: startDate || null }),
    })
      .then((response) => response.json())
      .then((payload: { success?: boolean; days?: CrisisWeather[] }) => {
        if (cancelled) return;
        setWeather(payload?.success && Array.isArray(payload.days) ? payload.days : null);
      })
      .catch(() => {
        if (!cancelled) setWeather(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days.length, destination, startDate]);

  const risky = useMemo(() => {
    if (!weather) return [];
    return days
      .map((day, index) => ({ day, index, weather: weather[index] || null, verdict: crisisNeeded(weather[index] || null) }))
      .filter((entry) => entry.verdict.needed);
  }, [days, weather]);

  if (loading) {
    return (
      <div className="glass mt-3 flex items-center gap-2 p-3 text-[10px] text-slate-400">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        هوای روزهای سفر را می‌خوانم تا اگر لازم شد، برنامهٔ جایگزین آماده باشد…
      </div>
    );
  }

  return (
    <div className="glass mt-3 p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="flex items-center gap-1.5 text-[11px] font-black text-white">
          <ShieldAlert className="h-3.5 w-3.5 text-amber-300" />
          حالت بحران — پلن B برای روزهای سخت
        </b>
        <span className="text-[8.5px] text-slate-500">
          {weather ? `${new Intl.NumberFormat("fa-IR").format(weather.length)} روز پیش‌بینی خوانده شد` : "پیش‌بینی در دسترس نیست"}
        </span>
      </div>

      {!weather ? (
        <p className="mt-2 text-[10px] leading-6 text-slate-400">
          پیش‌بینی هوای این روزها در دسترس نبود، پس برنامهٔ جایگزینی هم نمی‌سازم — حدس زدن دربارهٔ هوا کار درستی نیست.
        </p>
      ) : !risky.length ? (
        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-6 text-emerald-100/90">
          <Umbrella className="mt-0.5 h-3 w-3 shrink-0" />
          در پیش‌بینی این روزها باران شدید، برف، سرما یا گرمای بحرانی نیست؛ برنامهٔ فعلی بدون جایگزین هم اجرا می‌شود.
        </p>
      ) : (
        <>
          <div className="mt-2 space-y-2">
            {risky.map((entry) => (
              <div key={entry.day.day} className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-100">
                    <CloudRain className="h-3 w-3" />
                    {entry.day.title} — {entry.verdict.reason}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenDay(openDay === entry.day.day ? null : entry.day.day)}
                    className="rounded-full border border-amber-300/40 bg-amber-300/15 px-2.5 py-0.5 text-[9.5px] font-bold text-amber-100 transition hover:bg-amber-300/25"
                  >
                    {openDay === entry.day.day ? "بستن پلن B" : "پلن B را نشانم بده"}
                  </button>
                </div>

                {openDay === entry.day.day ? (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
                    {(() => {
                      const plan = buildCrisisPlan({
                        dayTitle: entry.day.title,
                        stops: entry.day.stops,
                        places,
                        weather: entry.weather,
                      });
                      return (
                        <div className="mt-2">
                          <ol className="space-y-1">
                            {plan.stops.map((stop, index) => (
                              <li key={`${stop.time}-${index}`} className="flex items-start gap-2 text-[10px] text-slate-200">
                                <span className="rounded bg-white/10 px-1 tabular-nums">{stop.time}</span>
                                <span className="min-w-0">
                                  {stop.title}
                                  {stop.replaced ? (
                                    <span className="mr-1 text-[8.5px] text-amber-200/80">(جای {stop.replaced})</span>
                                  ) : null}
                                </span>
                              </li>
                            ))}
                          </ol>
                          <p className="mt-1.5 text-[9px] leading-5 text-slate-400">{plan.note}</p>
                          {plan.unresolved.length ? (
                            <p className="mt-1 text-[9px] leading-5 text-slate-500">
                              جایگزین سرپوشیده برای: {plan.unresolved.join("، ")} پیدا نشد.
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                  </motion.div>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[8.5px] leading-5 text-slate-500">
            جایگزین‌ها فقط از جاذبه‌های تأییدشدهٔ همان شهر انتخاب می‌شوند؛ ساعت‌ها همان ساعت‌های برنامهٔ اصلی است.
          </p>
        </>
      )}
    </div>
  );
}
