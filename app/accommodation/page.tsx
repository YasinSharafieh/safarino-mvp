"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Building2,
  Check,
  CircleAlert,
  ExternalLink,
  Hotel as HotelIcon,
  House,
  LoaderCircle,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  WalletCards,
} from "lucide-react";
import TravelSteps from "@/components/TravelSteps";
import AccommodationCard from "@/components/AccommodationCard";
import ProviderBadge from "@/components/ProviderBadge";
import JalaliRangeCalendar from "@/components/JalaliRangeCalendar";
import PassengerSelector from "@/components/PassengerSelector";
import FilterSelect from "@/components/FilterSelect";
import { useTravel } from "../context/TravelContext";
import { categorizeStay, STAY_TYPE_FILTERS } from "@/lib/accommodation-types";
import type { AccommodationGroup, AccommodationKind, AccommodationOffer, ProviderSearchStatus } from "@/lib/accommodation-types";
import { IRANIAN_CITIES } from "@/lib/iran-cities";
import { addDaysToIso, formatJalaliDate, todayIso } from "@/lib/jalali";
import { ACCOMMODATION_RESULTS_KEY, ACCOMMODATION_SELECTION_KEY, buildAccommodationSelection } from "@/lib/accommodation-selection";

const STORAGE_KEY = ACCOMMODATION_SELECTION_KEY;
const numberFormatter = new Intl.NumberFormat("fa-IR");
const compactFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const formatNumber = (value: number) => numberFormatter.format(Math.round(value));
const formatToman = (value: number) => `${formatNumber(value)} تومان`;
const formatCompact = (value: number) => `${compactFormatter.format(value / 1_000_000)} میلیون تومان`;

/** Folds Persian/Arabic letter variants and zero-width joiners so a typed name still matches. */
function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[۰-۹٠-٩]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ")
    .replace(/\s+/g, " ");
}

type SearchResponse = {
  cached?: boolean;
  savedAt?: string;
  fromStore?: string;
  success: boolean;
  error?: string;
  offers?: AccommodationOffer[];
  groups?: AccommodationGroup[];
  providerStatuses?: ProviderSearchStatus[];
  found?: number;
  offerCount?: number;
  propertyCount?: number;
  deduplicatedCount?: number;
  partial?: boolean;
  city?: string;
  fetchedAt?: string;
};

type Choice = "search" | "reserved" | "skipped";

function savedStatus(value: Record<string, unknown> | null): Choice | null {
  const status = value?.status;
  if (status === "selected") return "search";
  if (status === "reserved") return "reserved";
  if (status === "skipped") return "skipped";
  return null;
}

import SnapshotKeeper from "@/components/SnapshotKeeper";

export default function AccommodationPage() {
  const { travelData, setTravelData, isHydrated } = useTravel();
  const initialized = useRef(false);
  const restoredChildAges = useRef<number[] | null>(null);
  const restoredInfantAges = useRef<number[] | null>(null);
  const [kind, setKind] = useState<AccommodationKind>("hotel");
  const [city, setCity] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [childAges, setChildAges] = useState<number[]>([]);
  const [infantAges, setInfantAges] = useState<number[]>([]);
  const [offers, setOffers] = useState<AccommodationOffer[]>([]);
  const [groups, setGroups] = useState<AccommodationGroup[]>([]);
  const [providerStatuses, setProviderStatuses] = useState<ProviderSearchStatus[]>([]);
  const [found, setFound] = useState(0);
  const [offerCount, setOfferCount] = useState(0);
  const [deduplicatedCount, setDeduplicatedCount] = useState(0);
  const [resolvedCity, setResolvedCity] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");
  const [fromSavedCopy, setFromSavedCopy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [legacyTransportCost, setLegacyTransportCost] = useState(0);
  const [maxTotalPrice, setMaxTotalPrice] = useState(50_000_000);
  const [minRating, setMinRating] = useState(0);
  const [minStars, setMinStars] = useState(0);
  const [stayType, setStayType] = useState("all");
  const [amenity, setAmenity] = useState("all");
  const [sort, setSort] = useState<"price" | "rating">("price");
  const [nameQuery, setNameQuery] = useState("");
  const [budgetOnly, setBudgetOnly] = useState(false);

  const accommodation = travelData.accommodation;
  const choice = savedStatus(accommodation);
  const selected = accommodation?.status === "selected" ? accommodation : null;
  const selectedId = selected ? String(selected.id || "") : "";
  const totalBudget = travelData.budget * 1_000_000;
  const contextTransportCost = Number(travelData.transport?.cost);
  const transportCost = Number.isFinite(contextTransportCost) && contextTransportCost >= 0 ? contextTransportCost : legacyTransportCost;
  const accommodationCost = selected ? Math.max(0, Number(selected.cost) || 0) : 0;
  const totalSpent = transportCost + accommodationCost;
  const remainingBudget = totalBudget - totalSpent;
  const beforeAccommodation = totalBudget - transportCost;
  const budgetPercent = Math.round((totalSpent / Math.max(totalBudget, 1)) * 100);
  const nights = checkIn && checkOut && checkOut > checkIn
    ? Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000)
    : 0;

  useEffect(() => {
    if (!isHydrated || initialized.current) return;
    initialized.current = true;
    const saved = travelData.accommodation;
    const arrival = travelData.departureDate || addDaysToIso(todayIso(), 7);
    const departure = travelData.returnDate > arrival ? travelData.returnDate : addDaysToIso(arrival, Math.max(1, travelData.days || 3));
    setCity(travelData.destination || "");
    setCheckIn(arrival);
    setCheckOut(departure);
    if (saved?.status === "selected") {
      if (saved.kind === "stay" || saved.kind === "hotel") setKind(saved.kind);
      if (typeof saved.city === "string") setCity(saved.city);
      if (typeof saved.checkIn === "string") setCheckIn(saved.checkIn);
      if (typeof saved.checkOut === "string") setCheckOut(saved.checkOut);
      if (Array.isArray(saved.childAges)) {
        restoredChildAges.current = saved.childAges.map(Number).filter(Number.isFinite);
        setChildAges(restoredChildAges.current);
      }
      if (Array.isArray(saved.infantAges)) {
        restoredInfantAges.current = saved.infantAges.map(Number).filter(Number.isFinite);
        setInfantAges(restoredInfantAges.current);
      }
    }
    try {
      const transportRaw = window.localStorage.getItem("safarino-transport-selection-v1");
      if (transportRaw) {
        const transport = JSON.parse(transportRaw) as { cost?: number };
        if (typeof transport.cost === "number" && Number.isFinite(transport.cost)) setLegacyTransportCost(Math.max(0, transport.cost));
      }
      const savedRaw = window.localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as Record<string, unknown>;
        if (parsed.status !== "selected") window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [isHydrated, travelData]);

  useEffect(() => {
    setChildAges((current) => {
      const restored = restoredChildAges.current;
      restoredChildAges.current = null;
      return Array.from({ length: travelData.children }, (_, index) => restored?.[index] ?? current[index] ?? 8);
    });
  }, [travelData.children]);

  useEffect(() => {
    setInfantAges((current) => {
      const restored = restoredInfantAges.current;
      restoredInfantAges.current = null;
      return Array.from({ length: travelData.infants }, (_, index) => restored?.[index] ?? current[index] ?? 0);
    });
  }, [travelData.infants]);

  function clearSelection() {
    setTravelData((current) => ({ ...current, accommodation: null }));
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* In-memory state remains usable. */ }
  }

  function resetResultsForCoreChange() {
    setOffers([]);
    setGroups([]);
    setProviderStatuses([]);
    setFound(0);
    setOfferCount(0);
    setDeduplicatedCount(0);
    setError("");
    setFetchedAt("");
    if (selected) clearSelection();
  }

  function changeKind(value: AccommodationKind) {
    setKind(value);
    resetResultsForCoreChange();
  }

  function changeCity(value: string) {
    setCity(value);
    if (value !== city) resetResultsForCoreChange();
  }

  function changeDate(field: "departureDate" | "returnDate", value: string) {
    let nextIn = checkIn;
    let nextOut = checkOut;
    if (field === "departureDate") {
      nextIn = value;
      if (!nextOut || nextOut <= value) nextOut = addDaysToIso(value, Math.max(1, nights || travelData.days || 1));
      setCheckIn(value);
      setCheckOut(nextOut);
    } else {
      nextOut = value;
      setCheckOut(value);
    }
    if (nextIn && nextOut > nextIn) {
      const count = Math.round((Date.parse(`${nextOut}T00:00:00Z`) - Date.parse(`${nextIn}T00:00:00Z`)) / 86_400_000);
      setTravelData((current) => ({ ...current, days: count }));
    }
    resetResultsForCoreChange();
  }

  function changePassengers(field: "travelers" | "children" | "infants", value: number) {
    setTravelData((current) => ({ ...current, [field]: value }));
    resetResultsForCoreChange();
  }

  function chooseStatus(status: "reserved" | "skipped") {
    setTravelData((current) => ({
      ...current,
      accommodation: { status, cost: 0, checkIn, checkOut, nights, city },
    }));
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Ignore unavailable storage. */ }
  }

  function returnToSearch() {
    if (choice === "reserved" || choice === "skipped") clearSelection();
  }

  function selectOffer(offer: AccommodationOffer, selectionFetchedAt = fetchedAt) {
    const selection = buildAccommodationSelection(offer, {
      city, checkIn, checkOut, nights,
      adults: travelData.travelers,
      children: travelData.children,
      infants: travelData.infants,
      childAges,
      infantAges,
      fetchedAt: selectionFetchedAt,
    });
    setTravelData((current) => ({ ...current, accommodation: selection, days: nights }));
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection)); } catch { /* Context still preserves it. */ }
  }

  async function searchAccommodation(forceFresh = false) {
    if (!city.trim()) {
      setError("مقصد اقامت را وارد کنید.");
      return;
    }
    if (!checkIn || !checkOut || nights < 1 || nights > 30) {
      setError("تاریخ ورود و خروج معتبر با فاصلهٔ ۱ تا ۳۰ شب انتخاب کنید.");
      return;
    }
    if (kind === "hotel" && travelData.travelers > 6) {
      setError("جستجوی هتل در این نسخه برای حداکثر ۶ بزرگسال در یک اتاق است؛ برای گروه بزرگ‌تر، اقامتگاه را امتحان کنید.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/providers/accommodation/search${forceFresh ? "?refresh=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, city: city.trim(), checkIn, checkOut, adults: travelData.travelers, childAges, infantAges }),
      });
      const data = await response.json() as SearchResponse;
      setProviderStatuses(data.providerStatuses || []);
      if (!response.ok || !data.success) throw new Error(data.error || "جستجو انجام نشد");
      const nextOffers = data.offers || [];
      const nextGroups = data.groups || nextOffers.map((offer) => ({ id: offer.id, matchReason: "single" as const, offers: [offer] }));
      setOffers(nextOffers);
      setGroups(nextGroups);
      setFound(Math.max(0, Number(data.found) || 0));
      setOfferCount(Math.max(nextOffers.length, Number(data.offerCount) || 0));
      setDeduplicatedCount(Math.max(0, Number(data.deduplicatedCount) || 0));
      setResolvedCity(data.city || city);
      setFetchedAt(data.fetchedAt || new Date().toISOString());
      setFromSavedCopy(Boolean(data.cached));
      setTravelData((current) => ({ ...current, days: nights }));
      try {
        window.sessionStorage.setItem(ACCOMMODATION_RESULTS_KEY, JSON.stringify({
          kind,
          city: data.city || city,
          checkIn,
          checkOut,
          adults: travelData.travelers,
          children: travelData.children,
          infants: travelData.infants,
          childAges,
          infantAges,
          nights,
          fetchedAt: data.fetchedAt || new Date().toISOString(),
          providerStatuses: data.providerStatuses || [],
          groups: nextGroups,
        }));
      } catch { /* The page still works without the snapshot. */ }
      if (selectedId) {
        const refreshed = nextGroups.flatMap((group) => group.offers).find((offer) => offer.id === selectedId);
        if (refreshed) selectOffer(refreshed, data.fetchedAt || new Date().toISOString());
        else clearSelection();
      }
    } catch (caught) {
      setOffers([]);
      setGroups([]);
      setFound(0);
      setOfferCount(0);
      setDeduplicatedCount(0);
      setError(caught instanceof Error ? caught.message : "جستجوی اقامت انجام نشد");
    } finally {
      setLoading(false);
    }
  }

  const filteredGroups = useMemo(() => {
    const filtered = groups.flatMap((group) => {
      const needle = normalizeSearchText(nameQuery);
      const matching = group.offers.filter((offer) => {
        if (needle && !`${offer.name} ${offer.location} ${offer.typeLabel}`.toLowerCase().replace(/\u200c/g, " ").includes(needle)) return false;
        if (offer.priceTotalToman > maxTotalPrice) return false;
        if (budgetOnly && offer.priceTotalToman > Math.max(0, beforeAccommodation)) return false;
        if (minRating && (offer.rating || 0) < minRating) return false;
        if (kind === "hotel" && minStars && (offer.stars || 0) < minStars) return false;
        if (kind === "stay" && stayType !== "all" && categorizeStay(offer.typeLabel, offer.name).key !== stayType) return false;
        if (amenity !== "all") {
          const text = [...offer.details, ...offer.amenities].join(" ").toLowerCase();
          const terms: Record<string, RegExp> = {
            breakfast: /صبحانه/,
            wifi: /wifi|اینترنت|بي‌سیم|بی‌سیم/i,
            pool: /استخر/,
            parking: /پارکینگ/,
          };
          if (!terms[amenity]?.test(text)) return false;
        }
        return true;
      });
      if (!matching.length) return [];
      matching.sort((a, b) => sort === "price"
        ? a.priceTotalToman - b.priceTotalToman
        : (b.rating || 0) - (a.rating || 0) || b.reviewCount - a.reviewCount);
      return [{ ...group, id: matching[0].id, offers: matching }];
    });
    return filtered.sort((a, b) => sort === "price"
      ? a.offers[0].priceTotalToman - b.offers[0].priceTotalToman
      : (b.offers[0].rating || 0) - (a.offers[0].rating || 0) || b.offers[0].reviewCount - a.offers[0].reviewCount);
  }, [amenity, beforeAccommodation, budgetOnly, groups, kind, maxTotalPrice, minRating, minStars, nameQuery, sort, stayType]);

  function resetFilters() {
    setNameQuery("");
    setMaxTotalPrice(50_000_000);
    setMinRating(0);
    setMinStars(0);
    setStayType("all");
    setAmenity("all");
    setBudgetOnly(false);
    setSort("price");
  }

  return (
    <MotionConfig reducedMotion="user">
      <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <SnapshotKeeper />
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
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow transition group-hover:scale-105"><BedDouble className="h-5 w-5" /></span>
            <span className="flex flex-col leading-none"><b className="text-lg font-black text-white">سفرینو</b><small className="text-[10px] tracking-widest text-slate-400">SAFARINO</small></span>
          </a>
          <a href="/transport" className="btn-ghost !px-4 !py-2.5 text-xs"><ArrowRight className="h-4 w-4" /><span className="hidden sm:inline">بازگشت به حمل‌ونقل</span><span className="sm:hidden">مرحلهٔ قبل</span></a>
        </header>
        <TravelSteps current={3} />

        <div className="mx-auto max-w-7xl pb-16 pt-10 sm:pt-14">
          <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="glass overflow-hidden p-5 shadow-card sm:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(6,182,212,0.13),transparent_45%)]" />
            <div className="relative">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200"><Sparkles className="h-3.5 w-3.5" />جستجوی زنده و مقایسه در ۶ منبع اقامت</span>
                  <h1 className="mt-4 text-2xl font-black leading-tight text-white sm:text-4xl">جایی برای <span className="gradient-text">استراحت و خاطره‌سازی</span></h1>
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-xs leading-6 text-slate-400"><MapPin className="h-4 w-4 text-cyan-300" />مقصد: {city || travelData.destination || "انتخاب نشده"}{nights > 0 && ` · اقامت ${formatNumber(nights)} شب`} · {formatNumber(travelData.travelers + travelData.children + travelData.infants)} مسافر</p>
                </div>
                <label className="glass-soft block w-full p-4 lg:max-w-xs">
                  <span className="flex items-center justify-between gap-3 text-xs text-slate-300"><span>بودجهٔ کل سفر</span><b className="text-cyan-200">{formatCompact(totalBudget)}</b></span>
                  <input dir="ltr" type="range" min="5000000" max="100000000" step="1000000" value={totalBudget} onChange={(event) => setTravelData((current) => ({ ...current, budget: Number(event.target.value) / 1_000_000 }))} className="mt-4 w-full cursor-pointer accent-cyan-400" aria-label="بودجه کل سفر" />
                </label>
              </div>

              <div className="mt-7 rounded-2xl border border-white/10 bg-night-900/50 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-xs font-bold text-white"><WalletCards className="h-4 w-4 text-turquoise-300" />بودجهٔ یکپارچهٔ حمل‌ونقل و اقامت</span>
                  <span className={`text-xs font-black ${remainingBudget < 0 ? "text-rose-300" : "text-emerald-300"}`}>{formatNumber(budgetPercent)}٪ از بودجه</span>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="هزینه حمل‌ونقل و اقامت نسبت به بودجه" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(budgetPercent, 100)}>
                  <motion.div className={`h-full rounded-full ${remainingBudget < 0 ? "bg-rose-500" : "bg-emerald-400"}`} animate={{ width: `${Math.min(budgetPercent, 100)}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                  {[
                    ["حمل‌ونقل", transportCost],
                    ["اقامت", accommodationCost],
                    ["مجموع هزینه", totalSpent],
                    [remainingBudget >= 0 ? "باقی‌مانده" : "بیشتر از بودجه", Math.abs(remainingBudget)],
                  ].map(([label, value], index) => (
                    <div key={String(label)} className="rounded-xl bg-white/[0.035] p-3"><span className="block text-[10px] text-slate-500">{label}</span><b className={`mt-1 block text-xs ${index === 3 ? remainingBudget >= 0 ? "text-emerald-300" : "text-rose-300" : "text-white"}`}>{formatToman(Number(value))}</b></div>
                  ))}
                </div>
                {remainingBudget < 0 && <p className="mt-3 flex items-center gap-2 text-[11px] text-rose-300"><CircleAlert className="h-4 w-4 shrink-0" />هزینه‌ها از بودجه بیشتر شده؛ اقامت اقتصادی‌تری انتخاب کنید یا بودجه را افزایش دهید.</p>}
              </div>
            </div>
          </motion.section>

          <section className="mt-8 text-center">
            <h2 className="text-xl font-black text-white sm:text-2xl">برای اقامت در این سفر چه برنامه‌ای داری؟</h2>
            <div className="mx-auto mt-5 inline-flex max-w-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 sm:flex-row">
              {([
                { value: "search" as const, label: "جستجوی اقامتگاه" },
                { value: "reserved" as const, label: "از قبل رزرو کردم" },
                { value: "skipped" as const, label: "بدون اقامتگاه" },
              ]).map((option) => (
                <button key={option.value} type="button" onClick={() => option.value === "search" ? returnToSearch() : chooseStatus(option.value)} aria-pressed={choice === option.value} className={`rounded-xl px-5 py-3 text-xs font-bold transition ${choice === option.value ? "bg-gradient-to-l from-cyan-400 to-sky-500 text-slate-950 shadow-glow" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{option.label}</button>
              ))}
            </div>
          </section>

          <AnimatePresence mode="wait">
            {choice === "reserved" || choice === "skipped" ? (
              <motion.section key={choice} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="glass mx-auto mt-8 max-w-3xl p-8 text-center sm:p-12">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300"><Check className="h-7 w-7" /></span>
                <h2 className="mt-5 text-2xl font-black text-white">{choice === "reserved" ? "اقامتگاهت آماده است" : "این سفر بدون رزرو اقامتگاه ادامه دارد"}</h2>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-8 text-slate-400">هزینهٔ اقامت صفر ثبت شد و هزینهٔ حمل‌ونقل همچنان در بودجه لحاظ می‌شود. این تصمیم هنگام بازگشت به مراحل قبل حفظ خواهد شد.</p>
                <button type="button" onClick={returnToSearch} className="btn-ghost mt-6 !py-2.5 text-xs">جستجوی اقامتگاه</button>
              </motion.section>
            ) : (
              <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <section className="glass relative z-30 mt-8 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h2 className="text-lg font-black text-white">جستجوی دقیق و مقایسهٔ اقامت</h2><p className="mt-1 text-[11px] text-slate-500">قیمت کل هر منبع جداگانه است؛ مبنای مالیات و نیاز به تأیید مجدد ظرفیت روی همان کارت نوشته می‌شود.</p></div>
                    <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
                      <button type="button" onClick={() => changeKind("hotel")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold ${kind === "hotel" ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}><HotelIcon className="h-4 w-4" />هتل</button>
                      <button type="button" onClick={() => changeKind("stay")} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold ${kind === "stay" ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}><House className="h-4 w-4" />ویلا و اقامتگاه</button>
                    </div>
                  </div>

                  <div className="relative z-40 mt-5 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
                    <div className="glass-soft p-4">
                      <label className="block"><span className="mb-2 block text-xs font-bold text-slate-300">مقصد اقامت</span><span className="flex min-h-14 items-center gap-2 rounded-2xl border border-white/10 bg-night-800/90 px-3 focus-within:border-cyan-300/50"><MapPin className="h-4 w-4 text-cyan-300" /><input value={city} onChange={(event) => changeCity(event.target.value)} list="accommodation-cities" placeholder="مثلاً مشهد، ماسوله یا رامسر" className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500" /></span></label>
                      <datalist id="accommodation-cities">{IRANIAN_CITIES.map((item) => <option key={item.code} value={item.name}>{item.englishName || item.code}</option>)}</datalist>
                      <p className="mt-2 text-[10px] leading-5 text-slate-500">برای ویلا و بوم‌گردی می‌توانی نام روستا یا شهرهای نزدیک را هم بنویسی.</p>
                    </div>
                    <div className="glass-soft relative z-30 p-4"><PassengerSelector adults={travelData.travelers} children={travelData.children} infants={travelData.infants} onChange={changePassengers} /></div>
                  </div>

                  <div className="relative z-20 mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
                    <div className="glass-soft p-4"><JalaliRangeCalendar mode="stay" departureDate={checkIn} returnDate={checkOut} roundTrip onRoundTripChange={() => undefined} onChange={changeDate} /></div>
                    <div className="glass-soft p-4">
                      <span className="text-xs font-bold text-slate-300">سن کودکان و نوزادان</span>
                      {!travelData.children && !travelData.infants ? <p className="mt-4 rounded-xl bg-white/[0.035] p-3 text-[11px] leading-6 text-slate-400">کودک یا نوزادی ثبت نشده است. در صورت اضافه‌کردن، سن برای قیمت‌گذاری دقیق هتل ارسال می‌شود.</p> : (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {childAges.map((age, index) => <label key={`child-${index}`} className="text-[10px] text-slate-400">کودک {formatNumber(index + 1)}<select value={age} onChange={(event) => { setChildAges((current) => current.map((value, i) => i === index ? Number(event.target.value) : value)); resetResultsForCoreChange(); }} className="field mt-1 !py-2 text-xs">{Array.from({ length: 10 }, (_, i) => i + 2).map((value) => <option key={value} value={value}>{formatNumber(value)} سال</option>)}</select></label>)}
                          {infantAges.map((age, index) => <label key={`infant-${index}`} className="text-[10px] text-slate-400">نوزاد {formatNumber(index + 1)}<select value={age} onChange={(event) => { setInfantAges((current) => current.map((value, i) => i === index ? Number(event.target.value) : value)); resetResultsForCoreChange(); }} className="field mt-1 !py-2 text-xs">{[0, 1].map((value) => <option key={value} value={value}>{value === 0 ? "کمتر از ۱ سال" : "۱ سال"}</option>)}</select></label>)}
                        </div>
                      )}
                      <p className="mt-3 text-[10px] leading-5 text-slate-500">{checkIn && checkOut ? `${formatJalaliDate(checkIn)} تا ${formatJalaliDate(checkOut)} · ${formatNumber(nights)} شب` : "تاریخ‌ها را انتخاب کنید"}</p>
                    </div>
                  </div>

                  <button type="button" onClick={() => searchAccommodation()} disabled={loading || !isHydrated} className="btn-primary mt-5 w-full disabled:cursor-wait disabled:opacity-60">{loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}{loading ? "در حال دریافت قیمت‌های واقعی…" : `جستجوی ${kind === "hotel" ? "هتل" : "ویلا و اقامتگاه"}`}</button>
                  {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/15 bg-rose-400/5 p-3 text-xs leading-6 text-rose-200"><CircleAlert className="mt-1 h-4 w-4 shrink-0" />{error}</p>}
                </section>

                {providerStatuses.length > 0 && (
                  <section className="glass mt-6 p-4 sm:p-5" aria-label="وضعیت منابع جستجو">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-black text-white">وضعیت زندهٔ منابع</h2>
                      <p className="text-[10px] text-slate-500">{offerCount ? `${formatNumber(offerCount)} پیشنهاد دریافت‌شده` : "جزئیات پاسخ هر منبع"}{deduplicatedCount ? ` · ${formatNumber(deduplicatedCount)} پیشنهاد تکراری در یک کارت` : ""}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {providerStatuses.map((status) => (
                        <div key={status.provider} title={status.message || status.label} className={`rounded-xl border p-2.5 ${status.status === "ok" ? "border-emerald-400/15 bg-emerald-400/[0.045]" : status.status === "unavailable" ? "border-rose-400/15 bg-rose-400/[0.04]" : "border-white/10 bg-white/[0.025]"}`}>
                          <div className="flex items-center justify-between gap-1"><ProviderBadge provider={status.provider} /><span className={`text-[9px] font-bold ${status.status === "ok" ? "text-emerald-300" : status.status === "unavailable" ? "text-rose-300" : "text-slate-500"}`}>{status.status === "ok" ? `${formatNumber(status.count)} نتیجه` : status.status === "empty" ? "بدون نتیجه" : status.status === "not_supported" ? "نوع دیگر" : "در دسترس نیست"}</span></div>
                          {status.message && <p className="mt-2 text-[8px] leading-4 text-slate-500">{status.message}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selected && (
                  <section className="glass mt-6 flex flex-col gap-4 border-emerald-400/25 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div><span className="flex items-center gap-2 text-xs font-bold text-emerald-300"><Check className="h-4 w-4" />اقامتگاه در برنامهٔ سفر ذخیره شده</span><div className="mt-3 flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-white">{String(selected.name)}</h3>{typeof selected.provider === "string" && <ProviderBadge provider={selected.provider as AccommodationOffer["provider"]} />}</div><p className="mt-1 text-[11px] text-slate-400">{formatNumber(Number(selected.nights) || 0)} شب · {formatToman(Number(selected.cost) || 0)}</p></div>
                    <div className="flex flex-wrap gap-2"><a href={String(selected.bookingUrl || "#")} target="_blank" rel="noreferrer noopener" className="btn-ghost !py-2.5 text-xs">مشاهده و رزرو<ExternalLink className="h-3.5 w-3.5" /></a><button type="button" onClick={clearSelection} className="btn-ghost !py-2.5 text-xs">لغو انتخاب</button></div>
                  </section>
                )}

                <div className="mt-8 grid items-start gap-6 lg:grid-cols-[280px_1fr]">
                  <aside className="glass p-5 lg:sticky lg:top-5">
                    <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-base font-black text-white"><SlidersHorizontal className="h-5 w-5 text-cyan-300" />فیلترها</h2><button type="button" onClick={resetFilters} className="text-[10px] text-slate-500 hover:text-cyan-300">پاک‌کردن</button></div>
                    <label className="mt-6 block border-b border-white/5 pb-6"><span className="flex items-center justify-between gap-2 text-xs font-bold text-slate-300"><span>حداکثر قیمت کل</span><b className="text-cyan-200">{formatCompact(maxTotalPrice)}</b></span><input dir="ltr" type="range" min="1000000" max="100000000" step="1000000" value={maxTotalPrice} onChange={(event) => setMaxTotalPrice(Number(event.target.value))} className="mt-4 w-full accent-cyan-400" aria-label="حداکثر قیمت کل اقامت" /></label>
                    <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-cyan-400/10 bg-cyan-400/5 p-3"><input type="checkbox" checked={budgetOnly} onChange={(event) => setBudgetOnly(event.target.checked)} className="mt-1 h-4 w-4 accent-cyan-400" /><span><b className="block text-[11px] text-cyan-100">فقط داخل بودجهٔ باقی‌مانده</b><small className="mt-1 block text-[10px] leading-5 text-slate-500">سقف: {formatToman(Math.max(0, beforeAccommodation))}</small></span></label>
                    <FilterSelect label="حداقل امتیاز مسافران" value={String(minRating)} onChange={(next) => setMinRating(Number(next))} options={[{ value: "0", label: "همه امتیازها" }, { value: "3", label: "۳ به بالا" }, { value: "4", label: "۴ به بالا" }, { value: "4.5", label: "۴٫۵ به بالا" }]} />
                    {kind === "hotel" ? <>
                      <FilterSelect label="حداقل ستاره هتل" value={String(minStars)} onChange={(next) => setMinStars(Number(next))} options={[{ value: "0", label: "همه هتل‌ها" }, ...[2, 3, 4, 5].map((value) => ({ value: String(value), label: `${formatNumber(value)} ستاره به بالا` }))]} />
                      <FilterSelect label="امکانات" value={amenity} onChange={setAmenity} options={[{ value: "all", label: "همه امکانات" }, { value: "breakfast", label: "صبحانه" }, { value: "wifi", label: "اینترنت / WiFi" }, { value: "pool", label: "استخر" }, { value: "parking", label: "پارکینگ" }]} />
                    </> : <FilterSelect label="نوع اقامتگاه" value={stayType} onChange={setStayType} options={[{ value: "all", label: "همه" }, ...STAY_TYPE_FILTERS.map((item) => ({ value: item.key, label: item.label }))]} />}
                    <FilterSelect label="مرتب‌سازی" value={sort} onChange={(next) => setSort(next as "price" | "rating")} options={[{ value: "price", label: "ارزان‌ترین قیمت کل" }, { value: "rating", label: "بالاترین امتیاز" }]} />
                  </aside>

                  <section>
                    <div className="glass mb-5 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70" />
                        <input
                          type="search"
                          value={nameQuery}
                          onChange={(event) => setNameQuery(event.target.value)}
                          placeholder="جستجو در همین نتایج: نام هتل یا اقامتگاه…"
                          aria-label="جستجوی نام اقامتگاه در نتایج"
                          className="field !py-2.5 pr-11 text-xs"
                        />
                      </div>
                      {nameQuery && (
                        <button type="button" onClick={() => setNameQuery("")} className="btn-ghost shrink-0 !px-4 !py-2.5 text-[11px]">
                          <RotateCcw className="h-3.5 w-3.5" />پاک‌کردن جستجو
                        </button>
                      )}
                    </div>
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">اقامتگاه‌های واقعی {resolvedCity || city}</h2><p className="mt-1 text-xs text-slate-500">{groups.length ? `${formatNumber(filteredGroups.length)} اقامتگاه از ${formatNumber(groups.length)} نتیجهٔ یکتا · ${formatNumber(offerCount)} پیشنهاد منابع${found > offerCount ? ` · ${formatNumber(found)} مورد اعلام‌شده در منابع` : ""}` : "برای دیدن قیمت و ظرفیت، جستجو را اجرا کن"}</p></div>{fetchedAt && <span className="chip border-emerald-400/20 bg-emerald-400/10 !text-emerald-200"><Check className="h-3.5 w-3.5" />به‌روزرسانی {new Date(fetchedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}{fromSavedCopy ? " · از نسخهٔ ذخیره‌شده" : ""}</span>}
                    {fetchedAt && fromSavedCopy && (
                      <button type="button" onClick={() => searchAccommodation(true)} disabled={loading} className="text-[10px] font-bold text-cyan-300 underline decoration-dotted underline-offset-4 hover:text-cyan-200 disabled:opacity-50">
                        {loading ? "در حال دریافت…" : "دریافت قیمت تازه از منابع"}
                      </button>
                    )}
                    </div>

                    {loading ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="glass h-[29rem] animate-pulse p-5"><div className="h-52 rounded-2xl bg-white/5" /><div className="mt-5 h-5 w-2/3 rounded bg-white/5" /><div className="mt-3 h-4 w-1/2 rounded bg-white/5" /></div>)}</div> : filteredGroups.length ? (
                      <motion.div layout className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        <AnimatePresence mode="popLayout">{filteredGroups.map((group, index) => (
                          <AccommodationCard key={group.id} group={group} index={index} nights={nights} selectedId={selectedId} onSelect={selectOffer} onClear={clearSelection} detailQuery={`?kind=${kind}&city=${encodeURIComponent(city)}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${travelData.travelers}`} />
                        ))}</AnimatePresence>
                      </motion.div>
                    ) : groups.length ? <div className="glass p-10 text-center"><SlidersHorizontal className="mx-auto h-8 w-8 text-slate-600" /><h3 className="mt-4 text-lg font-black text-white">اقامتگاهی با این فیلترها پیدا نشد</h3><p className="mt-2 text-xs text-slate-500">سقف قیمت یا فیلتر امتیاز را تغییر بده.</p><button type="button" onClick={resetFilters} className="btn-ghost mt-5 !py-2.5 text-xs"><RotateCcw className="h-4 w-4" />پاک‌کردن فیلترها</button></div> : !loading && fetchedAt && !error ? <div className="glass p-10 text-center"><Building2 className="mx-auto h-8 w-8 text-slate-600" /><h3 className="mt-4 text-lg font-black text-white">برای این تاریخ و مسافران گزینه‌ای با قیمت پیدا نشد</h3><p className="mt-2 text-xs leading-6 text-slate-500">تاریخ، نوع اقامت یا مقصد نزدیک را تغییر بده؛ سفرینو قیمت جایگزین نمی‌سازد.</p></div> : <div className="glass p-10 text-center"><BedDouble className="mx-auto h-10 w-10 text-cyan-300/50" /><h3 className="mt-4 text-lg font-black text-white">هتل، ویلا یا سوئیت واقعی پیدا کن</h3><p className="mx-auto mt-2 max-w-md text-xs leading-7 text-slate-500">مقصد و تاریخ از مراحل قبل آمده است. جستجو را اجرا کن تا قیمت کل، امتیاز واقعی و لینک رزرو همان اقامتگاه را ببینی.</p></div>}
                  </section>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="glass relative mt-10 overflow-hidden p-6 text-center sm:p-9">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(6,182,212,0.18),transparent_60%)]" />
            <div className="relative"><span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200"><Sparkles className="h-3.5 w-3.5" />حمل‌ونقل و اقامت در یک وضعیت مشترک</span><h2 className="mt-4 text-2xl font-black text-white">آماده برای برنامهٔ نهایی سفر</h2><p className="mx-auto mt-3 max-w-xl text-xs leading-7 text-slate-400">انتخاب اقامت یا ردکردن این مرحله ذخیره می‌شود و هزینهٔ واقعی آن به برنامه و بودجهٔ مرحلهٔ بعد منتقل خواهد شد.</p>
              {choice ? <a href="/plan" className="btn-primary mx-auto mt-7 w-full max-w-xl !px-8 !py-4 text-sm shadow-glow sm:text-base"><Sparkles className="h-5 w-5" />ادامه به برنامهٔ سفر<ArrowLeft className="h-5 w-5" /></a> : <p className="mx-auto mt-7 max-w-xl rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-6 text-slate-400">برای ادامه، یک اقامتگاه انتخاب کن یا یکی از گزینه‌های «از قبل رزرو کردم» و «بدون اقامتگاه» را ثبت کن.</p>}
              {selected && <p className="mt-4 text-[11px] text-emerald-300">{String(selected.name)} · {formatToman(Number(selected.cost) || 0)}</p>}
            </div>
          </motion.section>
        </div>
      </main>
    </MotionConfig>
  );
}
