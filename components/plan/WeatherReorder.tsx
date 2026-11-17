"use client";

/**
 * «هوا برنامه را عوض می‌کند» — the plan adapting to the real forecast.
 *
 * It reads the forecast for the trip's own dates, looks at what each day is
 * actually made of (outdoors or not), and — only when the order really helps —
 * offers to move whole days. The traveller sees the reason, the rainy day, and
 * presses one button; the places and times do not change.
 *
 * When the dates are outside the forecast window the card says it is using the
 * five-year average, because a climate figure is not a forecast.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CloudRain, LoaderCircle, RotateCcw, Sun } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { applyDayOrder, planWeatherReorder, type WeatherReorder as Reorder } from "@/lib/plan-weather";
import type { WeatherDay } from "@/lib/weather";

/** The shape both plan builders produce; only these fields are touched. */
type Day = { day: number; title: string; items: { time: string; title: string; type: string; poiCategory?: string }[] };

const fa = new Intl.NumberFormat("fa-IR");

export default function WeatherReorder({
  days,
  startDate,
  onApply,
}: {
  days: Day[];
  startDate?: string | null;
  onApply: (next: Day[]) => void;
}) {
  const { travelData } = useTravel();
  const [weather, setWeather] = useState<WeatherDay[] | null>(null);
  const [mode, setMode] = useState<"forecast" | "normals" | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const signature = useMemo(
    () => `${travelData.destination}|${startDate || ""}|${days.length}|${days.map((day) => day.items.map((item) => item.poiCategory || "").join(".")).join("|")}`,
    [days, startDate, travelData.destination],
  );

  useEffect(() => {
    if (!travelData.destination || days.length < 2) return;
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/weather/trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        city: travelData.destination,
        days: days.length,
        startDate: startDate || undefined,
        planDays: days.map((day) => ({
          dayNumber: day.day,
          categories: day.items.map((item) => item.poiCategory || "").filter(Boolean),
        })),
      }),
    })
      .then((response) => response.json())
      .then((payload: { success?: boolean; days?: WeatherDay[]; mode?: "forecast" | "normals" }) => {
        if (payload?.success && payload.days?.length) {
          setWeather(payload.days);
          setMode(payload.mode || "forecast");
        }
      })
      .catch(() => {
        // Without a forecast the card simply does not appear; nothing is faked.
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // `signature` already stands for the plan's shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, travelData.destination]);

  const reorder: Reorder | null = useMemo(() => (weather?.length === days.length ? planWeatherReorder(days, weather) : null), [days, weather]);

  if (!travelData.destination || days.length < 2) return null;
  if (loading && !weather) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/[0.05] px-3 py-2 text-[10px] text-sky-100">
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        پیش‌بینی هوای روزهای سفر را می‌خوانم تا ببینم چیدمان با هوا جور است یا نه…
      </div>
    );
  }
  if (!reorder || !reorder.changed || done) return null;

  const dry = (reorder.worry?.rainProbability ?? 0) < 20;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-3"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-black text-sky-100">
        {dry ? <Sun className="h-3.5 w-3.5" /> : <CloudRain className="h-3.5 w-3.5" />}
        هوا با این چیدمان جور نیست
        <span className="font-normal text-sky-200/60">
          ({mode === "forecast" ? "پیش‌بینی واقعی" : "میانگین پنج‌سالهٔ همین روزها"})
        </span>
      </p>
      <p className="mt-1 text-[10px] leading-6 text-slate-200">{reorder.reason}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onApply(applyDayOrder(days, reorder.order, startDate || travelData.departureDate || null));
            setDone(true);
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-400 px-2.5 py-1.5 text-[9.5px] font-black text-slate-950 transition hover:bg-sky-300"
        >
          <RotateCcw className="h-3 w-3" />
          روزها را جابه‌جا کن
        </button>
        <span className="text-[8.5px] text-sky-200/70">
          جاذبه‌ها و ساعت‌ها دست‌نخورده می‌مانند؛ فقط ترتیب روزها عوض می‌شود.
        </span>
      </div>
    </motion.div>
  );
}
