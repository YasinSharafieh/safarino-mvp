"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CalendarDays,
  CarFront,
  Check,
  CircleAlert,
  Coffee,
  ExternalLink,
  Hotel as HotelIcon,
  House,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
  WalletCards,
  Waves,
  Wifi,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TravelSteps from "@/components/TravelSteps";

const TRANSPORT_STORAGE_KEY = "safarino-transport-selection-v1";
const ACCOMMODATION_STORAGE_KEY = "safarino-accommodation-selection-v1";

const numberFormatter = new Intl.NumberFormat("fa-IR");
const compactFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const formatNumber = (value: number) => numberFormatter.format(Math.round(value));
const formatToman = (value: number) => `${formatNumber(value)} تومان`;
const formatCompact = (value: number) => `${compactFormatter.format(value / 1_000_000)} میلیون تومان`;

type StayType = "هتل" | "بوم‌گردی" | "ویلا" | "سوئیت" | "هاستل";
type Amenity = "پارکینگ" | "صبحانه" | "WiFi" | "استخر";
type Provider = "جاباما" | "اقامت۲۴";

type Accommodation = {
  id: string;
  name: string;
  type: StayType;
  rating: number;
  reviews: number;
  price: number;
  location: string;
  image: string;
  amenities: Amenity[];
  provider: Provider;
  providerUrl: string;
};

const ACCOMMODATIONS: Accommodation[] = [
  {
    id: "golden-palace",
    name: "هتل قصر طلایی",
    type: "هتل",
    rating: 4.8,
    reviews: 328,
    price: 4_800_000,
    location: "امام رضا، مشهد",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85",
    amenities: ["پارکینگ", "صبحانه", "WiFi", "استخر"],
    provider: "جاباما",
    providerUrl: "https://www.jabama.com/",
  },
  {
    id: "nene-agha",
    name: "اقامتگاه بوم‌گردی ننه آقا",
    type: "بوم‌گردی",
    rating: 4.9,
    reviews: 146,
    price: 1_650_000,
    location: "طرقبه، مشهد",
    image: "https://images.unsplash.com/photo-1601918774946-25832a4be0d6?auto=format&fit=crop&w=1200&q=85",
    amenities: ["صبحانه", "WiFi"],
    provider: "جاباما",
    providerUrl: "https://www.jabama.com/",
  },
  {
    id: "silver-coast",
    name: "ویلا ساحل نقره‌ای",
    type: "ویلا",
    rating: 4.7,
    reviews: 89,
    price: 7_200_000,
    location: "شاندیز، مشهد",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85",
    amenities: ["پارکینگ", "WiFi", "استخر"],
    provider: "اقامت۲۴",
    providerUrl: "https://www.eghamat24.com/",
  },
  {
    id: "pearl-suite",
    name: "سوئیت مروارید",
    type: "سوئیت",
    rating: 4.6,
    reviews: 214,
    price: 2_900_000,
    location: "احمدآباد، مشهد",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=85",
    amenities: ["پارکینگ", "صبحانه", "WiFi"],
    provider: "اقامت۲۴",
    providerUrl: "https://www.eghamat24.com/",
  },
  {
    id: "friend-hostel",
    name: "هاستل رفیق",
    type: "هاستل",
    rating: 4.4,
    reviews: 402,
    price: 850_000,
    location: "پایین خیابان، مشهد",
    image: "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1200&q=85",
    amenities: ["صبحانه", "WiFi"],
    provider: "جاباما",
    providerUrl: "https://www.jabama.com/",
  },
  {
    id: "eram-garden",
    name: "هتل باغ ارم",
    type: "هتل",
    rating: 4.5,
    reviews: 267,
    price: 3_500_000,
    location: "وکیل‌آباد، مشهد",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=85",
    amenities: ["پارکینگ", "صبحانه", "WiFi"],
    provider: "اقامت۲۴",
    providerUrl: "https://www.eghamat24.com/",
  },
];

const STAY_TYPES: StayType[] = ["هتل", "بوم‌گردی", "ویلا", "سوئیت", "هاستل"];
const AMENITIES: { label: Amenity; icon: LucideIcon }[] = [
  { label: "پارکینگ", icon: CarFront },
  { label: "صبحانه", icon: Coffee },
  { label: "WiFi", icon: Wifi },
  { label: "استخر", icon: Waves },
];

export default function AccommodationPage() {
  const [hasReservation, setHasReservation] = useState(false);
  const [maxNightlyPrice, setMaxNightlyPrice] = useState(10_000_000);
  const [selectedTypes, setSelectedTypes] = useState<StayType[]>(STAY_TYPES);
  const [requiredAmenities, setRequiredAmenities] = useState<Amenity[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nights, setNights] = useState(3);
  const [transportCost, setTransportCost] = useState(0);
  const [totalBudget, setTotalBudget] = useState(15_000_000);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const transport = window.localStorage.getItem(TRANSPORT_STORAGE_KEY);
      if (transport) {
        const parsed = JSON.parse(transport) as { cost?: number };
        if (typeof parsed.cost === "number" && Number.isFinite(parsed.cost)) {
          setTransportCost(Math.max(0, parsed.cost));
        }
      }

      const accommodation = window.localStorage.getItem(ACCOMMODATION_STORAGE_KEY);
      if (accommodation) {
        const parsed = JSON.parse(accommodation) as { id?: string; nights?: number };
        if (ACCOMMODATIONS.some((item) => item.id === parsed.id)) setSelectedId(parsed.id ?? null);
        if (typeof parsed.nights === "number" && parsed.nights >= 1 && parsed.nights <= 7) {
          setNights(Math.round(parsed.nights));
        }
      }
    } catch {
      window.localStorage.removeItem(ACCOMMODATION_STORAGE_KEY);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    try {
      if (selectedId) {
        window.localStorage.setItem(ACCOMMODATION_STORAGE_KEY, JSON.stringify({ id: selectedId, nights }));
      } else {
        window.localStorage.removeItem(ACCOMMODATION_STORAGE_KEY);
      }
    } catch {
      // Filtering and selection still work when browser storage is unavailable.
    }
  }, [isReady, nights, selectedId]);

  const selectedAccommodation = ACCOMMODATIONS.find((item) => item.id === selectedId);
  const accommodationCost = !hasReservation && selectedAccommodation ? selectedAccommodation.price * nights : 0;
  const totalSpent = transportCost + accommodationCost;
  const budgetRatio = totalSpent / totalBudget;
  const budgetPercent = Math.round(budgetRatio * 100);
  const remainingBudget = totalBudget - totalSpent;
  const budgetTone = budgetRatio > 1 ? "red" : budgetRatio > 0.75 ? "yellow" : "green";

  const filteredAccommodations = useMemo(
    () =>
      ACCOMMODATIONS.filter(
        (item) =>
          item.price <= maxNightlyPrice &&
          selectedTypes.includes(item.type) &&
          requiredAmenities.every((amenity) => item.amenities.includes(amenity)),
      ),
    [maxNightlyPrice, requiredAmenities, selectedTypes],
  );

  const toggleType = (type: StayType) => {
    setSelectedTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  };

  const toggleAmenity = (amenity: Amenity) => {
    setRequiredAmenities((current) =>
      current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity],
    );
  };

  const resetFilters = () => {
    setMaxNightlyPrice(10_000_000);
    setSelectedTypes(STAY_TYPES);
    setRequiredAmenities([]);
  };

  const progressColor =
    budgetTone === "red" ? "bg-rose-500" : budgetTone === "yellow" ? "bg-cyan-400" : "bg-emerald-400";

  return (
    <MotionConfig reducedMotion="user">
      <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#12364a_0%,#071521_60%)]" />
          <div className="absolute inset-0 grid-lines opacity-60" />
          <div className="aurora">
            <span className="-top-24 right-[8%] h-96 w-96 animate-float bg-teal-500/25" />
            <span className="left-[3%] top-[35rem] h-80 w-80 animate-float bg-teal-500/20 [animation-delay:1.5s]" />
            <span className="right-[35%] top-[85rem] h-72 w-72 animate-float bg-turquoise-500/15 [animation-delay:3s]" />
          </div>
        </div>

        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="/" className="group flex items-center gap-2.5" aria-label="صفحهٔ اصلی سفرینو">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow transition group-hover:scale-105">
              <BedDouble className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-none">
              <b className="text-lg font-black text-white">سفرینو</b>
              <small className="text-[10px] tracking-widest text-slate-400">SAFARINO</small>
            </span>
          </a>
          <a href="/transport" className="btn-ghost !px-4 !py-2.5 text-xs">
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline">بازگشت به حمل‌ونقل</span>
            <span className="sm:hidden">مرحلهٔ قبل</span>
          </a>
        </header>

        <TravelSteps current={3} />

        <div className="mx-auto max-w-7xl pb-16 pt-10 sm:pt-14">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass overflow-hidden p-5 shadow-card sm:p-7"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(6,182,212,0.13),transparent_45%)]" />
            <div className="relative">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    مرحلهٔ سوم برنامه‌ریزی سفر
                  </span>
                  <h1 className="mt-4 text-2xl font-black leading-tight text-white sm:text-4xl">
                    جایی برای <span className="gradient-text">استراحت و خاطره‌سازی</span>
                  </h1>
                  <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="h-4 w-4 text-cyan-300" />
                    مقصد: مشهد · اقامت {formatNumber(nights)} شب
                  </p>
                </div>

                <label className="glass-soft block w-full p-4 lg:max-w-xs">
                  <span className="flex items-center justify-between gap-3 text-xs text-slate-300">
                    <span>بودجهٔ کل سفر</span>
                    <b className="text-cyan-200">{formatCompact(totalBudget)}</b>
                  </span>
                  <input
                    dir="ltr"
                    type="range"
                    min="5000000"
                    max="40000000"
                    step="1000000"
                    value={totalBudget}
                    onChange={(event) => setTotalBudget(Number(event.target.value))}
                    className="mt-4 w-full cursor-pointer accent-cyan-400"
                    aria-label="بودجه کل سفر"
                  />
                </label>
              </div>

              <div className="mt-7 rounded-2xl border border-white/10 bg-night-900/50 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs font-bold text-white">
                    <WalletCards className="h-4 w-4 text-turquoise-300" />
                    نشانگر زندهٔ بودجه
                  </span>
                  <span className={`text-xs font-black ${budgetTone === "red" ? "text-rose-300" : budgetTone === "yellow" ? "text-cyan-300" : "text-emerald-300"}`}>
                    {formatNumber(budgetPercent)}٪ از بودجه
                  </span>
                </div>
                <div
                  className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-label="هزینه حمل‌ونقل و اقامت نسبت به بودجه"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(budgetPercent, 100)}
                >
                  <motion.div
                    className={`h-full rounded-full ${progressColor}`}
                    animate={{ width: `${Math.min(budgetRatio * 100, 100)}%` }}
                    transition={{ duration: 0.35 }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                  <div className="rounded-xl bg-white/[0.035] p-3">
                    <span className="block text-[10px] text-slate-500">حمل‌ونقل</span>
                    <b className="mt-1 block text-xs text-white">{formatToman(transportCost)}</b>
                  </div>
                  <div className="rounded-xl bg-white/[0.035] p-3">
                    <span className="block text-[10px] text-slate-500">اقامت</span>
                    <b className="mt-1 block text-xs text-white">{formatToman(accommodationCost)}</b>
                  </div>
                  <div className="rounded-xl bg-white/[0.035] p-3">
                    <span className="block text-[10px] text-slate-500">مجموع هزینه</span>
                    <b className="mt-1 block text-xs text-white">{formatToman(totalSpent)}</b>
                  </div>
                  <div className="rounded-xl bg-white/[0.035] p-3">
                    <span className="block text-[10px] text-slate-500">{remainingBudget >= 0 ? "باقی‌مانده" : "بیشتر از بودجه"}</span>
                    <b className={`mt-1 block text-xs ${remainingBudget >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {formatToman(Math.abs(remainingBudget))}
                    </b>
                  </div>
                </div>
                {budgetRatio > 1 && (
                  <p className="mt-3 flex items-center gap-2 text-[11px] text-rose-300">
                    <CircleAlert className="h-4 w-4 shrink-0" />
                    هزینه‌ها از بودجه بیشتر شده است؛ اقامتگاه اقتصادی‌تری انتخاب کنید یا بودجه را افزایش دهید.
                  </p>
                )}
              </div>
            </div>
          </motion.section>

          <section className="mt-8 text-center">
            <h2 className="text-xl font-black text-white sm:text-2xl">برای اقامت در این سفر چه برنامه‌ای داری؟</h2>
            <div className="mx-auto mt-5 inline-flex max-w-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 sm:flex-row">
              {[
                { value: true, label: "از قبل جا رزرو کردم" },
                { value: false, label: "نیاز به اقامتگاه دارم" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setHasReservation(option.value)}
                  aria-pressed={hasReservation === option.value}
                  className={`rounded-xl px-5 py-3 text-xs font-bold transition ${
                    hasReservation === option.value
                      ? "bg-gradient-to-l from-cyan-400 to-sky-500 text-slate-950 shadow-glow"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <AnimatePresence mode="wait">
            {hasReservation ? (
              <motion.section
                key="reserved"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass mx-auto mt-8 max-w-3xl p-8 text-center sm:p-12"
              >
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <Check className="h-7 w-7" />
                </span>
                <h2 className="mt-5 text-2xl font-black text-white">اقامتگاهت آماده است!</h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-8 text-slate-400">
                  هزینهٔ اقامت به محاسبات این مرحله اضافه نمی‌شود. هزینهٔ حمل‌ونقل همچنان در بودجه لحاظ شده و می‌توانی مستقیم به ساخت برنامه بروی.
                </p>
                <button type="button" onClick={() => setHasReservation(false)} className="btn-ghost mt-6 !py-2.5 text-xs">
                  مشاهدهٔ پیشنهادهای اقامتگاه
                </button>
              </motion.section>
            ) : (
              <motion.div
                key="accommodations"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-10 grid items-start gap-6 lg:grid-cols-[280px_1fr]"
              >
                <aside className="glass p-5 lg:sticky lg:top-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-base font-black text-white">
                      <SlidersHorizontal className="h-5 w-5 text-cyan-300" />
                      فیلترهای هوشمند
                    </h2>
                    <button type="button" onClick={resetFilters} className="text-[10px] text-slate-500 transition hover:text-cyan-300">
                      پاک‌کردن
                    </button>
                  </div>

                  <div className="mt-6 border-b border-white/5 pb-6">
                    <label className="flex items-center justify-between gap-2 text-xs font-bold text-slate-300">
                      <span>حداکثر قیمت هر شب</span>
                      <b className="text-cyan-200">{formatCompact(maxNightlyPrice)}</b>
                    </label>
                    <input
                      dir="ltr"
                      type="range"
                      min="500000"
                      max="10000000"
                      step="250000"
                      value={maxNightlyPrice}
                      onChange={(event) => setMaxNightlyPrice(Number(event.target.value))}
                      className="mt-4 w-full cursor-pointer accent-cyan-400"
                      aria-label="حداکثر بودجه هر شب"
                    />
                    <div className="mt-2 flex justify-between text-[10px] text-slate-600">
                      <span>۱۰ میلیون</span>
                      <span>۵۰۰ هزار</span>
                    </div>
                  </div>

                  <fieldset className="mt-6 border-b border-white/5 pb-6">
                    <legend className="text-xs font-bold text-slate-300">نوع اقامتگاه</legend>
                    <div className="mt-4 space-y-3">
                      {STAY_TYPES.map((type) => (
                        <label key={type} className="flex cursor-pointer items-center justify-between gap-3 text-xs text-slate-400 transition hover:text-white">
                          <span className="flex items-center gap-2">
                            {type === "هتل" ? <HotelIcon className="h-4 w-4 text-slate-500" /> : <House className="h-4 w-4 text-slate-500" />}
                            {type}
                          </span>
                          <input
                            type="checkbox"
                            checked={selectedTypes.includes(type)}
                            onChange={() => toggleType(type)}
                            className="h-4 w-4 cursor-pointer accent-cyan-400"
                          />
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="mt-6">
                    <legend className="text-xs font-bold text-slate-300">امکانات ضروری</legend>
                    <div className="mt-4 space-y-3">
                      {AMENITIES.map((amenity) => {
                        const Icon = amenity.icon;
                        return (
                          <label key={amenity.label} className="flex cursor-pointer items-center justify-between gap-3 text-xs text-slate-400 transition hover:text-white">
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-slate-500" />
                              {amenity.label}
                            </span>
                            <input
                              type="checkbox"
                              checked={requiredAmenities.includes(amenity.label)}
                              onChange={() => toggleAmenity(amenity.label)}
                              className="h-4 w-4 cursor-pointer accent-cyan-400"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <label className="mt-6 block rounded-2xl bg-white/[0.035] p-4">
                    <span className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <CalendarDays className="h-4 w-4 text-turquoise-300" />
                      تعداد شب
                    </span>
                    <select value={nights} onChange={(event) => setNights(Number(event.target.value))} className="field mt-3 cursor-pointer bg-night-800">
                      {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                        <option key={count} value={count} className="bg-night-800">{formatNumber(count)} شب</option>
                      ))}
                    </select>
                  </label>
                </aside>

                <section>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black text-white">اقامتگاه‌های پیشنهادی</h2>
                      <p className="mt-1 text-xs text-slate-500">{formatNumber(filteredAccommodations.length)} نتیجه مطابق فیلترهای شما</p>
                    </div>
                    {selectedAccommodation && (
                      <span className="chip border-emerald-400/20 bg-emerald-400/10 !text-emerald-200">
                        <Check className="h-3.5 w-3.5" />
                        {selectedAccommodation.name} انتخاب شده است
                      </span>
                    )}
                  </div>

                  {filteredAccommodations.length > 0 ? (
                    <motion.div layout className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      <AnimatePresence mode="popLayout">
                        {filteredAccommodations.map((item, index) => {
                          const isSelected = selectedId === item.id;
                          return (
                            <motion.article
                              layout
                              key={item.id}
                              initial={{ opacity: 0, y: 22 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              transition={{ duration: 0.35, delay: index * 0.05 }}
                              className={`glass group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 ${isSelected ? "border-cyan-300/50 shadow-glow" : "hover:border-white/25"}`}
                            >
                              <div className="relative h-52 overflow-hidden">
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                                  className="object-cover transition duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-night-950/90 via-transparent to-night-950/20" />
                                <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-night-950/65 px-3 py-1 text-[10px] font-bold text-white backdrop-blur-md">{item.type}</span>
                                <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-night-950/65 px-2.5 py-1 text-[11px] font-black text-cyan-300 backdrop-blur-md">
                                  <Star className="h-3.5 w-3.5 fill-cyan-300" />
                                  {compactFormatter.format(item.rating)}
                                </span>
                                <div className="absolute bottom-3 right-3 left-3">
                                  <h3 className="text-base font-black leading-7 text-white">{item.name}</h3>
                                  <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-300">
                                    <MapPin className="h-3 w-3" />
                                    {item.location}
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-1 flex-col p-4">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <b className="text-lg font-black text-cyan-200">{formatCompact(item.price)}</b>
                                    <span className="block text-[10px] text-slate-500">برای هر شب</span>
                                  </div>
                                  <span className="text-[10px] text-slate-500">{formatNumber(item.reviews)} نظر</span>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-1.5">
                                  {item.amenities.map((amenity) => (
                                    <span key={amenity} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] text-slate-300">{amenity}</span>
                                  ))}
                                </div>
                                <div className="mt-auto space-y-2 pt-5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedId(isSelected ? null : item.id)}
                                    aria-pressed={isSelected}
                                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                                      isSelected ? "bg-emerald-400 text-slate-950" : "btn-primary w-full !py-2.5"
                                    }`}
                                  >
                                    {isSelected && <Check className="h-4 w-4" />}
                                    {isSelected ? "انتخاب شد؛ برای لغو کلیک کنید" : "رزرو و انتخاب"}
                                  </button>
                                  <a
                                    href={item.providerUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[10px] text-slate-400 transition hover:bg-white/5 hover:text-white"
                                  >
                                    مشاهده در {item.provider}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            </motion.article>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <div className="glass p-10 text-center">
                      <SlidersHorizontal className="mx-auto h-8 w-8 text-slate-600" />
                      <h3 className="mt-4 text-lg font-black text-white">اقامتگاهی با این فیلترها پیدا نشد</h3>
                      <p className="mt-2 text-xs text-slate-500">بودجه را افزایش دهید یا چند فیلتر را بردارید.</p>
                      <button type="button" onClick={resetFilters} className="btn-ghost mt-5 !py-2.5 text-xs">
                        <RotateCcw className="h-4 w-4" />
                        پاک‌کردن فیلترها
                      </button>
                    </div>
                  )}
                </section>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass relative mt-10 overflow-hidden p-6 text-center sm:p-9"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(6,182,212,0.18),transparent_60%)]" />
            <div className="relative">
              <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">
                <Sparkles className="h-3.5 w-3.5" />
                همه‌چیز برای برنامهٔ نهایی آماده است
              </span>
              <h2 className="mt-4 text-2xl font-black text-white">حالا نوبت چیدن سفر رؤیایی توست</h2>
              <p className="mx-auto mt-3 max-w-xl text-xs leading-7 text-slate-400">
                مسیر، حمل‌ونقل و اقامتگاه انتخاب شد؛ در مرحلهٔ بعد هوش مصنوعی سفرینو برنامهٔ روزبه‌روز سفر را می‌سازد.
              </p>
              <a href="/plan" className="btn-primary mx-auto mt-7 w-full max-w-xl !px-8 !py-4 text-sm shadow-glow sm:text-base">
                <Sparkles className="h-5 w-5" />
                ساخت برنامه سفر با هوش مصنوعی
                <ArrowLeft className="h-5 w-5" />
              </a>
              {selectedAccommodation && !hasReservation && (
                <p className="mt-4 text-[11px] text-emerald-300">
                  {selectedAccommodation.name} برای {formatNumber(nights)} شب · {formatToman(accommodationCost)}
                </p>
              )}
            </div>
          </motion.section>
        </div>
      </main>
    </MotionConfig>
  );
}
