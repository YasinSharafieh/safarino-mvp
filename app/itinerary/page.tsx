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
import { CloudSun, Droplets, Thermometer, Wind, Heart, PlusCircle, Trash2, Wand2, Ruler } from "lucide-react";
import { drawDayMap } from "@/lib/day-map";
import type { ItineraryDay } from "@/lib/itinerary";
import PlaceToolbar from "@/components/PlaceToolbar";
import { filterPlaces, type FilterOptions } from "@/lib/place-filter";
import { FAVORITES_EVENT, readFavorites, toggleFavorite, type FavoritePlace } from "@/lib/favorites";
import type { WeatherDay } from "@/lib/weather";
import WeatherGlyph from "@/components/WeatherGlyph";
import { formatJalaliDate } from "@/lib/jalali";
import { ITINERARY_STORAGE_KEY } from "@/lib/itinerary-storage";
import BudgetBreakdown from "@/components/BudgetBreakdown";
import ShareTrip from "@/components/ShareTrip";
import TripChecklist from "@/components/TripChecklist";
import {
  buildBudgetPlan,
  readBudgetAssumptions,
  saveBudgetAssumptions,
  type BudgetAssumptions,
} from "@/lib/budget";

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
  origin?: { latitude: number; longitude: number } | null;
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
  const [weather, setWeather] = useState<{
    mode: "forecast" | "normals";
    days: WeatherDay[];
    note: string;
    suggestion: { order: number[]; reason: string; changed: boolean } | null;
  } | null>(null);
  const [weatherOrderApplied, setWeatherOrderApplied] = useState(false);
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);
  const [favoriteFilters, setFavoriteFilters] = useState<FilterOptions>({ query: "", categories: [], sort: "distance" });
  const [editNote, setEditNote] = useState("");
  const [remeasuring, setRemeasuring] = useState(false);
  const [assumptions, setAssumptions] = useState<BudgetAssumptions>(() => readBudgetAssumptions());

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    sync();
    window.addEventListener(FAVORITES_EVENT, sync);
    return () => window.removeEventListener(FAVORITES_EVENT, sync);
  }, []);
  const favoriteIds = favorites.map((place) => place.id);

  /** Which day holds a place right now (so the panel can say so). */
  const dayOfPlace = (placeId: string): number | null => {
    const day = data?.days.find((item) => item.stops.some((stop) => stop.place.id === placeId));
    return day ? day.day : null;
  };

  /** Adds a saved place to the end of a day; its driving time is measured next. */
  const addFavoriteToDay = (favorite: FavoritePlace, dayNumber: number) => {
    if (!data) return;
    const exists = data.days.some((day) => day.stops.some((stop) => stop.place.id === favorite.id));
    if (exists) {
      setEditNote(`«${favorite.name}» همین حالا در برنامهٔ شما هست.`);
      return;
    }
    const updated = data.days.map((day) =>
      day.day !== dayNumber
        ? day
        : {
            ...day,
            stops: [
              ...day.stops,
              {
                place: {
                  id: favorite.id,
                  name: favorite.name,
                  category: favorite.category,
                  latitude: favorite.latitude,
                  longitude: favorite.longitude,
                  address: favorite.address,
                  description: favorite.description,
                  imageUrl: favorite.imageUrl ?? null,
                  imageKind: favorite.imageKind ?? "none",
                  wikipediaUrl: favorite.wikipediaUrl ?? null,
                  sourceUrl: favorite.sourceUrl ?? "",
                },
                order: day.stops.length + 1,
                startTime: day.stops[day.stops.length - 1]?.startTime || "۰۹:۰۰",
                visitMinutes: 50,
                legKm: null,
                legMinutes: null,
                legEngine: "اندازه‌گیری نشد",
              },
            ],
          },
    );
    setData({ ...data, days: updated });
    setEditNote(`«${favorite.name}» به روز ${fa(dayNumber)} اضافه شد. با دکمهٔ «اندازه‌گیری دوبارهٔ مسیرها» فاصله‌ها به‌روز می‌شود.`);
  };

  const removeStop = (dayNumber: number, placeId: string) => {
    if (!data) return;
    const updated = data.days.map((day) =>
      day.day !== dayNumber ? day : { ...day, stops: day.stops.filter((stop) => stop.place.id !== placeId).map((stop, index) => ({ ...stop, order: index + 1 })) },
    );
    setData({ ...data, days: updated });
    setEditNote("ایستگاه از برنامه حذف شد. با دکمهٔ «اندازه‌گیری دوبارهٔ مسیرها» فاصله و زمان‌ها به‌روز می‌شود.");
  };

  /** Asks the server to measure the edited plan again (Neshan first). */
  const remeasure = async () => {
    if (!data) return;
    setRemeasuring(true);
    setEditNote("");
    try {
      const legs = data.days.flatMap((day) => day.stops.map((stop) => ({ latitude: stop.place.latitude, longitude: stop.place.longitude })));
      const response = await fetch("/api/itinerary/legs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: data.origin || null, legs }),
      });
      const payload = await response.json();
      const measured = Array.isArray(payload?.legs) ? (payload.legs as ({ distanceKm: number; durationMinutes: number; engine?: string } | null)[]) : [];
      let cursor = 0;
      const updatedDays = data.days.map((day) => {
        const stops = day.stops.map((stop) => {
          const item = measured[cursor];
          cursor += 1;
          return {
            ...stop,
            legKm: item ? item.distanceKm : null,
            legMinutes: item ? item.durationMinutes : null,
            legEngine: item ? item.engine || "اندازه‌گیری‌شده" : "اندازه‌گیری نشد",
          };
        });
        return {
          ...day,
          stops,
          totalKm: Math.round(stops.reduce((sum, stop) => sum + (stop.legKm || 0), 0) * 10) / 10,
          totalDriveMinutes: stops.reduce((sum, stop) => sum + (stop.legMinutes || 0), 0),
        };
      });
      setData({ ...data, days: updatedDays, engine: payload?.engine || data.engine });
      setEditNote(typeof payload?.note === "string" ? payload.note : "مسیرها دوباره اندازه‌گیری شد.");
    } catch {
      setEditNote("اندازه‌گیری دوباره انجام نشد؛ با دکمهٔ «مسیریابی با نشان» هر مسیر را می‌توانید مستقیم باز کنید.");
    } finally {
      setRemeasuring(false);
    }
  };

  /** The saved places, searchable the same way as the main list. */
  const visibleFavorites = filterPlaces(
    favorites.map((place) => ({
      id: place.id,
      name: place.name,
      category: place.category,
      address: place.address,
      imageKind: place.imageKind ?? ("none" as const),
      wikipediaUrl: place.wikipediaUrl,
      description: place.description,
      distanceKm: null,
    })),
    favoriteFilters,
  );
  const [activeDay, setActiveDay] = useState(0);

  const build = useCallback(async () => {
    if (!city) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/itinerary/plan", {
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

  useEffect(() => {
    if (!data?.days.length) return;
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/weather/trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: data.city,
        days: data.days.length,
        startDate: travelData.departureDate || null,
        latitude: hasStayPin ? stayLatitude : null,
        longitude: hasStayPin ? stayLongitude : null,
        planDays: data.days.map((day) => ({ dayNumber: day.day, categories: Array.from(new Set(day.stops.map((stop) => stop.place.category))) })),
      }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || !payload?.success || !Array.isArray(payload.days)) return;
        setWeather({ mode: payload.mode, days: payload.days, note: payload.note, suggestion: payload.suggestion || null });
      })
      .catch(() => {
        /* weather is a bonus; the plan stays usable without it */
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [data, hasStayPin, stayLatitude, stayLongitude, travelData.departureDate]);

  /** The printable book always shows exactly what is on screen, edits included. */
  useEffect(() => {
    if (!data) return;
    try {
      const payload = weather
        ? { ...data, weather: { mode: weather.mode, days: weather.days, note: weather.note } }
        : data;
      window.sessionStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* the printable page will rebuild if storage is blocked */
    }
  }, [data, weather]);

  const applyAssumptions = (next: BudgetAssumptions) => {
    setAssumptions(next);
    saveBudgetAssumptions(next);
  };

  /** Money: real picks plus clearly labelled assumptions, all editable. */
  const budgetPlan = useMemo(() => {
    const daysOnScreen = data?.days.length || 0;
    const stopsOnScreen = data?.days.reduce((sum, day) => sum + day.stops.length, 0) || 0;
    const measuredKm = data
      ? Math.round(data.days.reduce((sum, day) => sum + day.stops.reduce((inner, stop) => inner + (stop.legKm || 0), 0), 0) * 10) / 10
      : null;
    const stayName = typeof stay?.name === "string" ? stay.name : "";
    const stayNights = Number(stay?.nights);
    const transport = travelData.transport;
    const transportLabel = transport
      ? String((transport.providerLabel as string) || (transport.offerTitle as string) || (transport.title as string) || (transport.kind as string) || "وسیلهٔ انتخاب‌شده")
      : "";
    return buildBudgetPlan({
      days: daysOnScreen,
      stops: stopsOnScreen,
      cityKm: measuredKm,
      people: Math.max(1, Number(travelData.travelers) || 1) + Math.max(0, Number(travelData.children) || 0),
      children: Number(travelData.children) || 0,
      budgetToman: travelData.budget ? Number(travelData.budget) * 1_000_000 : null,
      accommodation: stay ? { name: stayName, nights: Number.isFinite(stayNights) ? stayNights : undefined, totalToman: Number(stay?.cost) || null } : null,
      transport: transport ? { label: transportLabel, totalToman: Number(transport.cost) || null } : null,
      assumptions,
    });
  }, [assumptions, data, stay, travelData.budget, travelData.children, travelData.transport, travelData.travelers]);

  /** Exactly what is on the screen, in the shape the link keeps. */
  const sharePayload = useMemo(() => {
    if (!data) return null;
    return {
      v: 1 as const,
      city: data.city,
      createdAt: new Date().toISOString(),
      days: data.days,
      totals: {
        km: Math.round(data.days.reduce((sum, day) => sum + day.totalKm, 0) * 10) / 10,
        driveMinutes: data.days.reduce((sum, day) => sum + day.totalDriveMinutes, 0),
        stops: data.days.reduce((sum, day) => sum + day.stops.length, 0),
        days: data.days.length,
      },
      engine: data.engine,
      note: data.note,
      weather: weather ? { mode: weather.mode, note: weather.note, days: weather.days } : null,
      money: {
        total: budgetPlan.total,
        real: budgetPlan.realTotal,
        estimate: budgetPlan.estimateTotal,
        budget: budgetPlan.budget,
        remaining: budgetPlan.remaining,
        lines: budgetPlan.lines.map((line) => ({ label: line.label, amount: line.amount, kind: line.kind })),
      },
    };
  }, [budgetPlan, data, weather]);

  const weatherForDay = (index: number): WeatherDay | null => weather?.days[index] || null;

  /** Moves the plan days onto the best dates, keeping every stop as it is. */
  const applyWeatherOrder = () => {
    if (!data || !weather?.suggestion?.changed) return;
    const byNumber = new Map(data.days.map((day) => [day.day, day]));
    const reordered = weather.suggestion.order
      .map((dayNumber, index) => {
        const original = byNumber.get(dayNumber);
        return original ? { ...original, day: index + 1 } : null;
      })
      .filter(Boolean) as ItineraryDay[];
    if (reordered.length !== data.days.length) return;
    setData({ ...data, days: reordered });
    setWeatherOrderApplied(true);
    setActiveDay(0);
  };

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

                {/* Weather for the same dates, and what to do about it */}
                {weather && weather.days.length ? (
                  <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-black text-cyan-100">
                        <CloudSun className="h-4 w-4" />
                        {weather.mode === "forecast" ? "هوای روزهای سفر (پیش‌بینی واقعی)" : "هوای معمول این روزها در سال‌های گذشته"}
                      </p>
                      <span className="text-[9.5px] text-slate-400">
                        {weather.mode === "forecast" ? "منبع: Open-Meteo" : "میانگین پنج سال گذشته — نه پیش‌بینی"}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {weather.days.map((item, index) => (
                        <button
                          key={item.date}
                          type="button"
                          onClick={() => setActiveDay(index)}
                          className={`rounded-xl border p-2 text-right transition ${
                            item.tone === "bad"
                              ? "border-rose-400/25 bg-rose-400/10"
                              : item.tone === "warn"
                                ? "border-amber-400/25 bg-amber-400/10"
                                : item.tone === "good"
                                  ? "border-emerald-400/25 bg-emerald-400/10"
                                  : "border-white/10 bg-white/[0.04]"
                          } hover:brightness-110`}
                        >
                          <span className="flex items-center justify-between gap-1 text-[10px] font-bold text-slate-200">
                            <span>روز {fa(index + 1)}</span>
                            <span className="text-[9px] text-slate-400">{formatJalaliDate(item.date)}</span>
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[11px] font-black text-white">
                            <WeatherGlyph code={item.code} className="h-4 w-4" />
                            {item.label}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[9.5px] text-slate-300">
                            {item.maxC !== null ? (
                              <span className="flex items-center gap-0.5"><Thermometer className="h-3 w-3 text-rose-300" />{fa(item.maxC)}° / {item.minC !== null ? fa(item.minC) : "—"}°</span>
                            ) : null}
                            {item.rainProbability !== null ? (
                              <span className="flex items-center gap-0.5"><Droplets className="h-3 w-3 text-sky-300" />{fa(item.rainProbability)}٪</span>
                            ) : item.rainMm !== null ? (
                              <span className="flex items-center gap-0.5"><Droplets className="h-3 w-3 text-sky-300" />{fa(item.rainMm)} میلی‌متر</span>
                            ) : null}
                            {item.windKmh !== null ? (
                              <span className="flex items-center gap-0.5"><Wind className="h-3 w-3 text-slate-400" />{fa(item.windKmh)}</span>
                            ) : null}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] leading-6 text-slate-300">{weather.days[activeDay]?.advice || ""}</p>
                    {weather.suggestion?.changed && !weatherOrderApplied ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-400/25 bg-slate-950/30 p-2">
                        <p className="min-w-0 flex-1 text-[10px] leading-6 text-cyan-100">{weather.suggestion.reason}</p>
                        <button type="button" onClick={applyWeatherOrder} className="rounded-lg border border-cyan-400/30 bg-cyan-400/15 px-2.5 py-1.5 text-[10px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/25">
                          چیدمان بر اساس هوا
                        </button>
                      </div>
                    ) : weather.suggestion?.reason ? (
                      <p className="mt-2 text-[10px] leading-6 text-slate-400">{weatherOrderApplied ? "روزها بر اساس هوا چیده شدند." : weather.suggestion.reason}</p>
                    ) : null}
                    <p className="mt-1 text-[9.5px] leading-5 text-slate-500">{weather.note}</p>
                  </div>
                ) : null}

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
                      {weatherForDay(index) ? <span className="me-1 inline-flex align-middle"><WeatherGlyph code={weatherForDay(index)!.code} className="h-3.5 w-3.5" /></span> : null}
                      روز {fa(day.day)} · {fa(day.stops.length)} مکان
                    </button>
                  ))}
                  <span className="ms-auto flex items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[10px] text-cyan-100">
                    <Route className="h-3.5 w-3.5" />
                    مسیرها با {data.engine}
                  </span>
                </div>

                {editNote ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] p-2.5">
                    <p className="min-w-0 flex-1 text-[10px] leading-6 text-cyan-100">{editNote}</p>
                    <button
                      type="button"
                      onClick={() => void remeasure()}
                      disabled={remeasuring}
                      className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/15 px-2.5 py-1.5 text-[10px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/25 disabled:opacity-50"
                    >
                      {remeasuring ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Ruler className="h-3 w-3" />}
                      اندازه‌گیری دوبارهٔ مسیرها
                    </button>
                  </div>
                ) : null}

                {/* Saved places: a personal shortlist that can be dropped into a day */}
                <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.04] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-black text-rose-100">
                      <Heart className="h-4 w-4" />
                      علاقه‌مندی‌های من {favorites.length ? `(${fa(favorites.length)})` : ""}
                    </p>
                    <span className="text-[9.5px] text-slate-400">فقط روی همین دستگاه ذخیره می‌شود</span>
                  </div>
                  {favorites.length ? (
                    <>
                      <PlaceToolbar
                        places={favorites.map((place) => ({
                          id: place.id,
                          name: place.name,
                          category: place.category,
                          address: place.address,
                          imageKind: place.imageKind ?? ("none" as const),
                          wikipediaUrl: place.wikipediaUrl,
                          description: place.description,
                          distanceKm: null,
                        }))}
                        options={favoriteFilters}
                        onChange={setFavoriteFilters}
                        total={favorites.length}
                        shown={visibleFavorites.length}
                      />
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {visibleFavorites.map((place) => {
                          const saved = favorites.find((item) => item.id === place.id);
                          const inDay = dayOfPlace(place.id);
                          if (!saved) return null;
                          return (
                            <li key={place.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/30 p-2">
                              {saved.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={saved.imageUrl} alt={saved.name} loading="lazy" className="h-10 w-10 shrink-0 rounded-lg border border-white/10 object-cover" />
                              ) : null}
                              <span className="min-w-0 flex-1">
                                <b className="block truncate text-[11px] font-extrabold text-white">{saved.name}</b>
                                <span className="block text-[9px] text-slate-500">{saved.category}</span>
                              </span>
                              {inDay ? (
                                <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9.5px] font-bold text-emerald-200">در روز {fa(inDay)}</span>
                              ) : (
                                <label className="flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-1.5 py-1 text-[9.5px] font-bold text-cyan-100">
                                  <PlusCircle className="h-3 w-3" />
                                  <select
                                    aria-label={`افزودن ${saved.name} به یک روز`}
                                    defaultValue=""
                                    onChange={(event) => {
                                      const dayNumber = Number(event.target.value);
                                      if (dayNumber) addFavoriteToDay(saved, dayNumber);
                                      event.target.value = "";
                                    }}
                                    className="bg-transparent text-[9.5px] font-bold text-cyan-100 outline-none [&>option]:bg-slate-900"
                                  >
                                    <option value="">افزودن به روز…</option>
                                    {data.days.map((day) => (
                                      <option key={day.day} value={day.day}>روز {fa(day.day)}</option>
                                    ))}
                                  </select>
                                </label>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  toggleFavorite({
                                    id: saved.id,
                                    name: saved.name,
                                    category: saved.category,
                                    latitude: saved.latitude,
                                    longitude: saved.longitude,
                                    address: saved.address,
                                    description: saved.description,
                                    imageUrl: saved.imageUrl,
                                    imageKind: saved.imageKind,
                                    wikipediaUrl: saved.wikipediaUrl,
                                    sourceUrl: saved.sourceUrl,
                                  });
                                }}
                                aria-label={`حذف ${saved.name} از علاقه‌مندی‌ها`}
                                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 transition hover:text-rose-200"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-2 text-[10px] leading-6 text-slate-400">
                      روی قلب کنار هر مکان در صفحهٔ «برنامهٔ هوشمند» بزنید تا اینجا ذخیره شود؛ بعد با یک انتخاب، آن را به روز دلخواه اضافه کنید.
                    </p>
                  )}
                </div>

                {currentDay && (
                  <motion.div key={currentDay.day} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
                    {/* Map of the day */}
                    <div className="glass-soft overflow-hidden p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-black text-white">نقشهٔ روز {fa(currentDay.day)}</h2>
                        <span className="text-[10px] text-slate-500">
                          {weatherForDay(activeDay) ? `${weatherForDay(activeDay)?.label} · ` : ""}
                          {currentDay.theme}
                        </span>
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
                                  <button
                                    type="button"
                                    onClick={() => removeStop(currentDay.day, stop.place.id)}
                                    aria-label={`حذف ${stop.place.name} از این روز`}
                                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[9.5px] font-bold text-slate-300 transition hover:border-rose-400/30 hover:text-rose-200"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    حذف
                                  </button>
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

                <BudgetBreakdown plan={budgetPlan} assumptions={assumptions} onAssumptionsChange={applyAssumptions} />
                {sharePayload ? <ShareTrip trip={sharePayload} /> : null}
                <TripChecklist departureDate={travelData.departureDate} />

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
