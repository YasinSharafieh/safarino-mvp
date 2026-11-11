"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  Clock3,
  Compass,
  Download,
  Fuel,
  Info,
  LoaderCircle,
  MapPin,
  Navigation,
  RefreshCw,
  Route,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import TravelSteps from "@/components/TravelSteps";
import { useTravel } from "../context/TravelContext";
import { openNeshanNavigation } from "@/lib/neshan-deeplink";
import { drawDayMap } from "@/lib/day-map";
import type { ItineraryDay } from "@/lib/itinerary";
import { ITINERARY_STORAGE_KEY } from "@/lib/itinerary-storage";

type ItineraryResponse = {
  success: boolean;
  city: string;
  days: ItineraryDay[];
  unused: { id: string; name: string; category: string }[];
  stopsPerDay: number;
  engine: string;
  note: string;
  poiNote: string;
  totals: { km: number; driveMinutes: number; stops: number; days: number };
  unmeasuredLegs?: number;
  cached?: boolean;
  generatedAt: string;
  error?: string;
};

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function faDigits(value: string): string {
  return value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
}

function ItineraryContent() {
  const query = useSearchParams();
  const { travelData, isHydrated } = useTravel();

  const stay = travelData.accommodation && travelData.accommodation.status === "selected" ? travelData.accommodation : null;
  const city = (typeof stay?.city === "string" && stay.city) || query.get("city") || "";
  const stayLatitude = Number(stay?.latitude);
  const stayLongitude = Number(stay?.longitude);
  const hasStayPin = Number.isFinite(stayLatitude) && Number.isFinite(stayLongitude) && stayLatitude !== 0 && stayLongitude !== 0;

  const [days, setDays] = useState(Math.max(1, Math.min(10, Number(query.get("days")) || Number(travelData.days) || 3)));
  const [stopsPerDay, setStopsPerDay] = useState(4);
  const [data, setData] = useState<ItineraryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeDay, setActiveDay] = useState(0);

  const build = useCallback(async () => {
    if (!city) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/itinerary/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          days,
          stopsPerDay,
          origin: hasStayPin ? { latitude: stayLatitude, longitude: stayLongitude } : null,
        }),
      });
      const payload = (await response.json()) as ItineraryResponse;
      if (!payload.success) {
        setError(payload.error || "ساختن برنامهٔ روزبه‌روز انجام نشد.");
        setData(null);
        return;
      }
      setData(payload);
      setActiveDay(0);
      try {
        window.sessionStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* the printable page will rebuild if storage is blocked */
      }
    } catch {
      setError("ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }, [city, days, hasStayPin, stayLatitude, stayLongitude, stopsPerDay]);

  useEffect(() => {
    if (!isHydrated || !city) return;
    void build();
    // Build once per city and length; the buttons rebuild on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, city, days, stopsPerDay]);

  const currentDay: ItineraryDay | null = data?.days[activeDay] || null;
  const dayMap = useMemo(() => {
    if (!currentDay) return null;
    return drawDayMap(
      currentDay.stops.map((stop, index) => ({ latitude: stop.place.latitude, longitude: stop.place.longitude, label: `${faDigits(String(index + 1))} ${stop.place.name}` })),
      { title: `روز ${faDigits(String(currentDay.day))}` },
    );
  }, [currentDay]);

  return (
    <MotionConfig reducedMotion="user">
      <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#12364a_0%,#071521_60%)]" />
          <div className="absolute inset-0 grid-lines opacity-60" />
          <div className="aurora">
            <span className="-top-24 right-[5%] h-96 w-96 animate-float bg-teal-500/25" />
            <span className="left-[2%] top-[32rem] h-80 w-80 animate-float bg-sky-500/20 [animation-delay:1.5s]" />
          </div>
        </div>

        <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="صفحهٔ اصلی سفرینو">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow transition group-hover:scale-105">
              <Compass className="h-5 w-5" />
            </span>
            <span>
              <b className="block text-sm font-black text-white">سفرینو</b>
              <span className="block text-[10px] tracking-[0.3em] text-cyan-200/70">SAFARINO</span>
            </span>
          </Link>
          <Link href="/plan" className="btn-ghost !px-3 !py-2 text-[11px]">
            <ArrowLeft className="h-3.5 w-3.5" />
            برنامهٔ هوشمند
          </Link>
        </header>

        <div className="mx-auto mt-5 max-w-6xl">
          <TravelSteps current={4} />
        </div>

        <section className="mx-auto mt-6 max-w-6xl">
          <div className="glass p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">
                  <Sparkles className="h-3 w-3" />
                  برنامهٔ روزبه‌روز
                </span>
                <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                  {city ? `${city} در ${fa(days)} روز` : "برنامهٔ روزبه‌روز سفر"}
                </h1>
                <p className="mt-2 max-w-xl text-[11px] leading-6 text-slate-400">
                  جاذبه‌های واقعی هر روز بر اساس نزدیکی جغرافیایی کنار هم چیده می‌شوند، ترتیب بازدید از اقامتگاه به سمت دور است و فاصله و زمان رانندگی هر مسیر از نشان گرفته می‌شود.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-slate-300">
                  <CalendarDays className="h-3.5 w-3.5 text-cyan-300" />
                  روزها
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={days}
                    onChange={(event) => setDays(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
                    className="w-12 rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1 text-center text-[11px] font-bold text-white outline-none focus:border-cyan-400/50"
                  />
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-slate-300">
                  <MapPin className="h-3.5 w-3.5 text-cyan-300" />
                  مکان در روز
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={stopsPerDay}
                    onChange={(event) => setStopsPerDay(Math.max(2, Math.min(6, Number(event.target.value) || 4)))}
                    className="w-12 rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1 text-center text-[11px] font-bold text-white outline-none focus:border-cyan-400/50"
                  />
                </label>
                <button type="button" onClick={() => void build()} disabled={loading || !city} className="btn-ghost !px-3 !py-2 text-[11px] disabled:opacity-50">
                  {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  بازچینش
                </button>
                <Link
                  href="/itinerary/print"
                  className={`btn-primary !px-3 !py-2 text-[11px] ${data ? "" : "pointer-events-none opacity-50"}`}
                >
                  <Download className="h-3.5 w-3.5" />
                  نسخهٔ PDF
                </Link>
              </div>
            </div>

            {!city && (
              <p className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-[11px] leading-6 text-amber-100">
                اول مقصد و اقامتگاه را انتخاب کنید؛ بعد این صفحه جاذبه‌های واقعی همان شهر را در روزها می‌چیند. می‌توانید از صفحهٔ برنامهٔ سفر هم به همین‌جا بیایید.
              </p>
            )}
            {error && <p className="mt-5 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-4 text-[11px] leading-6 text-rose-100">{error}</p>}
            {loading && !data && (
              <div className="mt-6 flex items-center gap-2 text-[11px] text-cyan-100">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                در حال چیدن روزها و گرفتن مسیرها از نشان…
              </div>
            )}

            {data && (
              <>
                <div className="mt-5 grid gap-2 sm:grid-cols-4">
                  {[
                    { icon: CalendarDays, label: "روز", value: fa(data.totals.days) },
                    { icon: MapPin, label: "ایستگاه", value: fa(data.totals.stops) },
                    { icon: Car, label: "کیلومتر رانندگی", value: fa(data.totals.km) },
                    { icon: Clock3, label: "دقیقه پشت فرمان", value: fa(data.totals.driveMinutes) },
                  ].map((item) => (
                    <div key={item.label} className="glass-soft flex items-center gap-3 p-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200">
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span>
                        <b className="block text-sm font-black text-white">{item.value}</b>
                        <span className="block text-[10px] text-slate-500">{item.label}</span>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {data.days.map((day, index) => (
                    <button
                      key={day.day}
                      type="button"
                      onClick={() => setActiveDay(index)}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-bold transition ${
                        index === activeDay
                          ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
                      }`}
                    >
                      روز {fa(day.day)} · {fa(day.stops.length)} مکان
                    </button>
                  ))}
                  <span className="ms-auto flex items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[10px] text-cyan-100">
                    <Route className="h-3.5 w-3.5" />
                    مسیرها با {data.engine}
                  </span>
                </div>

                {currentDay && (
                  <motion.div key={currentDay.day} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
                    {/* Map of the day */}
                    <div className="glass-soft overflow-hidden p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-black text-white">نقشهٔ روز {fa(currentDay.day)}</h2>
                        <span className="text-[10px] text-slate-500">{currentDay.theme}</span>
                      </div>
                      {dayMap ? (
                        <div className="mt-2 overflow-hidden rounded-xl border border-white/10" dangerouslySetInnerHTML={{ __html: dayMap.svg }} />
                      ) : (
                        <p className="mt-2 text-[10px] text-slate-500">برای این روز مختصات معتبری ثبت نشده است.</p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                        <span className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1.5 text-slate-300">
                          <Car className="h-3.5 w-3.5 text-cyan-300" />
                          {fa(currentDay.totalKm)} کیلومتر
                        </span>
                        <span className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1.5 text-slate-300">
                          <Clock3 className="h-3.5 w-3.5 text-cyan-300" />
                          {fa(currentDay.totalDriveMinutes)} دقیقه رانندگی
                        </span>
                      </div>
                      <p className="mt-2 flex items-start gap-1.5 text-[9.5px] leading-5 text-slate-500">
                        <Info className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />
                        این نقشه از مختصات واقعی همان مکان‌ها رسم شده و ترتیب بازدید را نشان می‌دهد؛ خط‌چین مسیر رانندگی نیست.
                      </p>
                    </div>

                    {/* The day itself */}
                    <div className="glass-soft p-3">
                      <ol className="space-y-2.5">
                        {currentDay.stops.map((stop, index) => (
                          <li key={stop.place.id} className="relative rounded-xl border border-white/10 bg-slate-950/30 p-2.5">
                            <div className="flex items-start gap-2.5">
                              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-[10px] font-black text-cyan-200">{fa(stop.order)}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <b className="block truncate text-xs font-extrabold text-white">{stop.place.name}</b>
                                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9.5px] text-slate-500">
                                      <span className="rounded-md bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200">{stop.place.category}</span>
                                      <span>شروع {stop.startTime}</span>
                                      <span>· {fa(stop.visitMinutes)} دقیقه بازدید</span>
                                    </span>
                                  </div>
                                  {stop.place.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={stop.place.imageUrl} alt={stop.place.name} loading="lazy" className="h-12 w-12 shrink-0 rounded-lg border border-white/10 object-cover" />
                                  ) : null}
                                </div>
                                {stop.place.description ? (
                                  <p className="mt-1.5 line-clamp-2 text-[10px] leading-5 text-slate-400">{stop.place.description}</p>
                                ) : null}
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {stop.legKm !== null ? (
                                    <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[9.5px] font-bold text-cyan-100">
                                      <Car className="h-3 w-3" />
                                      {index === 0 ? "از اقامتگاه" : "از ایستگاه قبل"} {fa(stop.legKm)} کیلومتر · {fa(stop.legMinutes || 0)} دقیقه
                                    </span>
                                  ) : index === 0 && !hasStayPin ? (
                                    <span className="text-[9.5px] text-slate-500">برای سنجش این مسیر، اول اقامتگاه را انتخاب کنید</span>
                                  ) : (
                                    <span className="text-[9.5px] text-slate-500">فاصلهٔ این مسیر اندازه‌گیری نشد</span>
                                  )}
                                  {hasStayPin || index > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openNeshanNavigation(
                                          index === 0
                                            ? { latitude: stayLatitude, longitude: stayLongitude }
                                            : { latitude: currentDay.stops[index - 1].place.latitude, longitude: currentDay.stops[index - 1].place.longitude },
                                          { latitude: stop.place.latitude, longitude: stop.place.longitude },
                                        )
                                      }
                                      className="flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 text-[9.5px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/20"
                                    >
                                      <Navigation className="h-3 w-3" />
                                      مسیریابی با نشان
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            {stop.order === currentDay.lunchAfter && stop.order < currentDay.stops.length ? (
                              <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2 py-1 text-[9.5px] text-amber-200/90">
                                <UtensilsCrossed className="h-3 w-3" />
                                بعد از این ایستگاه، ناهار و کمی استراحت (حدود یک ساعت) در برنامه حساب شده است.
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                      <p className="mt-3 flex items-start gap-1.5 text-[9.5px] leading-5 text-slate-500">
                        <Fuel className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />
                        زمان‌ها تقریبی و بر اساس بازدید معمول هر نوع مکان است؛ با دکمهٔ مسیریابی، مسیر واقعی همان لحظه با ترافیک نشان باز می‌شود.
                      </p>
                    </div>
                  </motion.div>
                )}

                {data.unused.length ? (
                  <p className="mt-4 text-[10px] leading-6 text-slate-500">
                    {fa(data.unused.length)} مکان دیگر هم پیدا شد که در این تعداد روز جا نشد: {data.unused.map((place) => place.name).join("، ")}.
                  </p>
                ) : null}
                {data.unmeasuredLegs ? (
                  <p className="mt-2 rounded-xl border border-amber-400/25 bg-amber-400/10 p-2.5 text-[10px] leading-6 text-amber-100">
                    {fa(data.unmeasuredLegs)} مسیر اندازه‌گیری نشد (سرویس مسیریابی در آن لحظه پاسخ نداد)؛ برای همان مسیرها از دکمهٔ «مسیریابی با نشان» استفاده کنید تا مسیر واقعی همان لحظه باز شود.
                  </p>
                ) : null}
                <p className="mt-2 text-[10px] leading-6 text-slate-500">{data.note}</p>
              </>
            )}
          </div>
        </section>
      </main>
    </MotionConfig>
  );
}

/** The page reads the plan length from the address, so it needs a suspense boundary. */
export default function ItineraryPage() {
  return (
    <Suspense
      fallback={
        <main dir="rtl" className="grid min-h-screen place-items-center bg-[#071521] text-cyan-100">
          <span className="flex items-center gap-2 text-sm">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            در حال آماده‌سازی برنامهٔ روزبه‌روز…
          </span>
        </main>
      }
    >
      <ItineraryContent />
    </Suspense>
  );
}
