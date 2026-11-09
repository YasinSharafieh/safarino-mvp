"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  CalendarDays,
  CarFront,
  Check,
  Clock3,
  LoaderCircle,
  ExternalLink,
  Fuel,
  MapPin,
  Plane,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrainFront,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TravelSteps from "@/components/TravelSteps";
import CityCombobox from "@/components/CityCombobox";
import JalaliRangeCalendar from "@/components/JalaliRangeCalendar";
import PassengerSelector from "@/components/PassengerSelector";
import ProviderLogo from "@/components/ProviderLogo";
import FilterSelect from "@/components/FilterSelect";
import { useTravel } from "../context/TravelContext";
import { citiesForTransport, resolveIranianCity, transportCityCode } from "@/lib/iran-cities";
import { addDaysToIso, formatProviderDateTime, todayIso } from "@/lib/jalali";

const FUEL_PRICE_PER_LITER = 3_000;
const TOLL_PER_KM = 180;
const STORAGE_KEY = "safarino-transport-selection-v1";

const numberFormatter = new Intl.NumberFormat("fa-IR");
const compactFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const formatNumber = (value: number) => numberFormatter.format(Math.round(value));
const formatToman = (value: number) => `${formatNumber(value)} تومان`;
const formatCompactToman = (value: number) =>
  `${compactFormatter.format(value / 1_000_000)} میلیون تومان`;

type CarModel = {
  id: string;
  name: string;
  consumption: number;
  depreciationPerKm: number;
};

const CARS: CarModel[] = [
  { id: "pride", name: "پراید", consumption: 6.5, depreciationPerKm: 1_500 },
  { id: "206", name: "پژو ۲۰۶", consumption: 7.5, depreciationPerKm: 2_000 },
  { id: "samand", name: "سمند", consumption: 8.5, depreciationPerKm: 2_200 },
  { id: "dena", name: "دنا", consumption: 8, depreciationPerKm: 2_400 },
  { id: "tiba", name: "تیبا", consumption: 7, depreciationPerKm: 1_800 },
  { id: "haima-s7", name: "هایما S7", consumption: 9.5, depreciationPerKm: 3_200 },
  { id: "camry", name: "تویوتا کمری", consumption: 10.5, depreciationPerKm: 5_000 },
];

type TransportId = "plane" | "train" | "car" | "bus";

type TransportOption = {
  id: TransportId;
  name: string;
  emoji: string;
  icon: LucideIcon;
  duration: string;
  price?: number;
  accent: string;
  iconTone: string;
  link?: { label: string; href: string };
};

const TRANSPORT_OPTIONS: TransportOption[] = [
  {
    id: "plane",
    name: "هواپیما",
    emoji: "✈️",
    icon: Plane,
    duration: "زمان پرواز در نتایج زنده",
    accent: "from-sky-400/20 to-teal-500/5",
    iconTone: "bg-sky-400/10 text-sky-300 border-sky-400/20",
  },
  {
    id: "train",
    name: "قطار",
    emoji: "🚆",
    icon: TrainFront,
    duration: "زمان سفر در نتایج زنده",
    accent: "from-emerald-400/20 to-teal-500/5",
    iconTone: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  },
  {
    id: "car",
    name: "ماشین شخصی",
    emoji: "🚗",
    icon: CarFront,
    duration: "حدود ۱۰ ساعت",
    accent: "from-cyan-400/20 to-sky-500/5",
    iconTone: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
  },
  {
    id: "bus",
    name: "اتوبوس VIP",
    emoji: "🚌",
    icon: Bus,
    duration: "ساعت حرکت در نتایج زنده",
    accent: "from-cyan-400/20 to-teal-500/5",
    iconTone: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
  },
];

type LiveOffer = {
  id: string;
  logoUrl?: string | null;
  title: string;
  subtitle: string;
  departure: string;
  arrival: string | null;
  priceToman: number;
  childPriceToman?: number | null;
  infantPriceToman?: number | null;
  seatsLeft: number | null;
  details: string[];
  provider?: "alibaba" | "safar724";
  bookingUrl?: string;
  bookingNote?: string;
  alsoAvailableAt?: {
    provider: "alibaba" | "safar724";
    providerLabel: string;
    priceToman: number;
    bookingUrl: string;
    seatsLeft: number | null;
  }[];
};

type ProviderStatus = {
  provider: "alibaba" | "safar724";
  label: string;
  status: "ok" | "unsupported" | "failed";
  count: number;
  found: number;
  message?: string;
};

type LiveSearchResponse = {
  success: boolean;
  error?: string;
  mode?: "plane" | "train" | "bus";
  fetchedAt?: string;
  offers?: LiveOffer[];
  returningOffers?: LiveOffer[];
  duplicateCount?: number;
  providerStatuses?: ProviderStatus[];
};

const TRANSPORT_PROVIDER_LABELS: Record<string, string> = { alibaba: "علی‌بابا", safar724: "سفر۷۲۴" };
const TRANSPORT_PROVIDER_MARKS: Record<string, string> = { alibaba: "ع", safar724: "۷۲۴" };

type Selection = {
  vehicleId: TransportId;
  cost: number;
  unitPrice?: number;
  offerId?: string;
  offerTitle?: string;
  provider?: string;
  providerLabel?: string;
  bookingUrl?: string;
  fetchedAt?: string;
};

type TransportContextValue = {
  selection: Selection;
  selectVehicle: (vehicleId: TransportId, cost: number, details?: Partial<Selection>) => void;
  isReady: boolean;
};

const TransportContext = createContext<TransportContextValue | null>(null);

function TransportProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>({ vehicleId: "car", cost: 0 });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Selection>;
        const validId = TRANSPORT_OPTIONS.some((option) => option.id === parsed.vehicleId);
        if (validId && typeof parsed.cost === "number" && Number.isFinite(parsed.cost)) {
          setSelection({ ...parsed, vehicleId: parsed.vehicleId as TransportId, cost: parsed.cost });
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch {
      // The calculator remains usable when storage is blocked or full.
    }
  }, [isReady, selection]);

  const selectVehicle = useCallback(
    (vehicleId: TransportId, cost: number, details?: Partial<Selection>) => {
      setSelection(details ? { ...details, vehicleId, cost } : { vehicleId, cost });
    },
    [],
  );

  const value = useMemo(
    () => ({ selection, isReady, selectVehicle }),
    [isReady, selection, selectVehicle],
  );

  return <TransportContext.Provider value={value}>{children}</TransportContext.Provider>;
}

function useTransport() {
  const context = useContext(TransportContext);
  if (!context) throw new Error("useTransport must be used inside TransportProvider");
  return context;
}

function TransportPageContent() {
  const { selection, selectVehicle, isReady } = useTransport();
  const { travelData, setTravelData, isHydrated } = useTravel();
  const [carId, setCarId] = useState("dena");
  const [searchMode, setSearchMode] = useState<Exclude<TransportId, "car">>("plane");
  const [roundTrip, setRoundTrip] = useState(false);
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [returnOffers, setReturnOffers] = useState<LiveOffer[]>([]);
  const [activeLeg, setActiveLeg] = useState<"outbound" | "return">("outbound");
  const [searchLoading, setSearchLoading] = useState(false);
  const [offerQuery, setOfferQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const [providerMeta, setProviderMeta] = useState<{ bookingUrl?: string; fetchedAt?: string }>({});
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [distanceError, setDistanceError] = useState("");
  const [fuelPrice, setFuelPrice] = useState(FUEL_PRICE_PER_LITER);
  const [customConsumption, setCustomConsumption] = useState<number | null>(null);
  const [customDepreciation, setCustomDepreciation] = useState<number | null>(null);
  const [tollPerKm, setTollPerKm] = useState(TOLL_PER_KM);

  const originCity = resolveIranianCity(travelData.origin);
  const destinationCity = resolveIranianCity(travelData.destination);
  const availableCities = useMemo(() => citiesForTransport(searchMode), [searchMode]);
  const passengers = travelData.travelers;
  const budget = travelData.budget * 1_000_000;
  const setPassengers = useCallback((value: number) => {
    setTravelData((current) => ({ ...current, travelers: Math.min(9, Math.max(1, value)) }));
  }, [setTravelData]);
  const setBudget = useCallback((amount: number) => {
    setTravelData((current) => ({ ...current, budget: Math.round(amount / 1_000_000) }));
  }, [setTravelData]);

  const selectedCar = CARS.find((car) => car.id === carId) ?? CARS[0];
  const consumption = customConsumption ?? selectedCar.consumption;
  const depreciationPerKm = customDepreciation ?? selectedCar.depreciationPerKm;
  const roadDistance = distanceKm ?? 0;
  const fuelCost = (roadDistance / 100) * consumption * fuelPrice;
  const depreciationCost = roadDistance * depreciationPerKm;
  const tollCost = roadDistance * tollPerKm;
  const carTotal = fuelCost + depreciationCost + tollCost;
  const costPerPassenger = carTotal / passengers;
  const cheapestTrain = searchMode === "train" && offers.length ? offers[0].priceToman * passengers : null;
  const trainSaving = cheapestTrain === null ? 0 : Math.max(0, carTotal - cheapestTrain);

  useEffect(() => {
    setCustomConsumption(null);
    setCustomDepreciation(null);
  }, [carId]);

  useEffect(() => {
    if (!isHydrated || !originCity || !destinationCity) {
      setDistanceKm(null);
      setDistanceError("برای محاسبه مسیر، مبدا و مقصد را در بخش جستجوی زنده انتخاب کنید.");
      return;
    }
    let cancelled = false;
    setDistanceError("");
    fetch("/api/route/distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: originCity.code, destination: destinationCity.code }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "مسیر دریافت نشد");
        if (!cancelled) setDistanceKm(Number(data.distanceKm));
      })
      .catch((error) => {
        if (!cancelled) {
          setDistanceKm(null);
          setDistanceError(error instanceof Error ? error.message : "مسیر دریافت نشد");
        }
      });
    return () => { cancelled = true; };
  }, [destinationCity, isHydrated, originCity]);

  useEffect(() => {
    if (!isReady || selection.vehicleId !== "car") return;
    if (!Number.isFinite(carTotal)) return;
    if (selection.cost !== carTotal) selectVehicle("car", carTotal);
  }, [carTotal, isReady, selectVehicle, selection.cost, selection.vehicleId]);

  useEffect(() => {
    setTravelData((current) => ({
      ...current,
      transport: {
        ...selection,
        origin: current.origin,
        destination: current.destination,
        departureDate: current.departureDate,
        travelers: current.travelers,
      },
    }));
  }, [selection, setTravelData]);

  useEffect(() => {
    if (!isHydrated) return;
    if (travelData.returnDate) setRoundTrip(true);
    if (travelData.departureDate) return;
    const departureDate = addDaysToIso(todayIso(), 7);
    setTravelData((current) => current.departureDate ? current : { ...current, departureDate });
  }, [isHydrated, setTravelData, travelData.departureDate, travelData.returnDate]);

  useEffect(() => {
    setOffers([]);
    setReturnOffers([]);
    setActiveLeg("outbound");
    setProviderMeta({});
    setSearchError("");
  }, [roundTrip, searchMode, travelData.departureDate, travelData.returnDate, travelData.destination, travelData.origin]);

  useEffect(() => {
    if (!isHydrated) return;
    const validOrigin = !originCity || availableCities.some((city) => city.code === originCity.code);
    const validDestination = !destinationCity || availableCities.some((city) => city.code === destinationCity.code);
    if (validOrigin && validDestination) return;
    setTravelData((current) => ({
      ...current,
      origin: validOrigin ? current.origin : "",
      destination: validDestination ? current.destination : "",
    }));
  }, [availableCities, destinationCity, isHydrated, originCity, setTravelData]);

  const changeJourney = useCallback((field: "origin" | "destination" | "departureDate" | "returnDate", value: string) => {
    if (selection.vehicleId !== "car") selectVehicle("car", carTotal);
    setTravelData((current) => ({ ...current, [field]: value }));
  }, [carTotal, selectVehicle, selection.vehicleId, setTravelData]);

  const searchTickets = useCallback(async () => {
    if (!originCity || !destinationCity) {
      setSearchError("برای جستجوی زنده، مبدا و مقصد ایرانی را انتخاب کنید.");
      return;
    }
    if (originCity.code === destinationCity.code) {
      setSearchError("مبدا و مقصد نمی‌توانند یکی باشند.");
      return;
    }
    if (!travelData.departureDate) {
      setSearchError("ابتدا تاریخ حرکت را انتخاب کنید.");
      return;
    }
    if (roundTrip && (!travelData.returnDate || travelData.returnDate < travelData.departureDate)) {
      setSearchError("برای سفر رفت و برگشت، تاریخ برگشت معتبر را انتخاب کنید.");
      return;
    }
    setSearchLoading(true);
    setSearchError("");
    setProviderStatuses([]);
    try {
      const response = await fetch("/api/providers/transport/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: searchMode,
          origin: transportCityCode(originCity, searchMode),
          destination: transportCityCode(destinationCity, searchMode),
          date: travelData.departureDate,
          returnDate: roundTrip ? travelData.returnDate : undefined,
          adults: travelData.travelers,
          children: travelData.children,
          infants: travelData.infants,
        }),
      });
      const data = await response.json() as LiveSearchResponse;
      if (!response.ok || !data.success) throw new Error(data.error || "جستجو انجام نشد");
      const withLabels = (offer: LiveOffer & { operator?: string; serviceLabel?: string }): LiveOffer => {
        const operator = (offer.operator || offer.title || (searchMode === "plane" ? "پرواز" : searchMode === "train" ? "قطار" : "اتوبوس")).trim();
        const service = (offer.serviceLabel || offer.subtitle || "").trim();
        return {
          ...offer,
          title: service ? `${operator} · ${service}` : operator,
          subtitle: service && !service.includes(operator) ? service : (offer.subtitle || (searchMode === "plane" ? "پرواز" : searchMode === "train" ? "قطار" : "اتوبوس")),
        };
      };
      const normalized: LiveOffer[] = (data.offers || []).map((offer) => ({
        ...withLabels(offer),
        logoUrl: offer.logoUrl ?? null,
        arrival: offer.arrival ?? null,
        childPriceToman: offer.childPriceToman ?? null,
        infantPriceToman: offer.infantPriceToman ?? null,
        seatsLeft: typeof offer.seatsLeft === "number" ? offer.seatsLeft : null,
        details: Array.isArray(offer.details) ? offer.details : [],
      }));
      const normalizedReturn: LiveOffer[] = (data.returningOffers || []).map((offer) => ({
        ...withLabels(offer),
        logoUrl: offer.logoUrl ?? null,
        arrival: offer.arrival ?? null,
        childPriceToman: offer.childPriceToman ?? null,
        infantPriceToman: offer.infantPriceToman ?? null,
        seatsLeft: typeof offer.seatsLeft === "number" ? offer.seatsLeft : null,
        details: Array.isArray(offer.details) ? offer.details : [],
      }));
      setOffers(normalized);
      setReturnOffers(normalizedReturn);
      setProviderStatuses(data.providerStatuses || []);
      setDuplicateCount(data.duplicateCount || 0);
      setActiveLeg("outbound");
      setProviderMeta({ fetchedAt: data.fetchedAt });
      if (!normalized.length) {
        const working = (data.providerStatuses || []).filter((status) => status.status === "ok");
        setSearchError(working.length
          ? "برای این مسیر و تاریخ، گزینه‌ای با صندلی و قیمت پیدا نشد."
          : "هیچ منبعی برای این مسیر پاسخ نداد؛ جزئیات هر منبع پایین‌تر آمده است.");
      }
    } catch (error) {
      setOffers([]);
      setReturnOffers([]);
      setSearchError(error instanceof Error ? error.message : "جستجو انجام نشد");
    } finally {
      setSearchLoading(false);
    }
  }, [destinationCity, originCity, roundTrip, searchMode, travelData]);

  const selectedName = TRANSPORT_OPTIONS.find((option) => option.id === selection.vehicleId)?.name;
  const searchModeName = TRANSPORT_OPTIONS.find((option) => option.id === searchMode)?.name;
  const legOffers = activeLeg === "return" ? returnOffers : offers;
  const needle = offerQuery.trim().toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ");
  const visibleOffers = needle
    ? legOffers.filter((offer) => `${offer.title} ${offer.subtitle} ${offer.details?.join(" ") || ""} ${TRANSPORT_PROVIDER_LABELS[offer.provider || "alibaba"] || ""}`
        .toLowerCase()
        .replace(/ي/g, "ی")
        .replace(/ك/g, "ک")
        .replace(/\u200c/g, " ")
        .includes(needle))
    : legOffers;
  const budgetDifference = budget - selection.cost;

  function verifiedOfferTotal(offer: LiveOffer): number | null {
    if (travelData.children > 0 && !offer.childPriceToman) return null;
    if (travelData.infants > 0 && !offer.infantPriceToman) return null;
    return offer.priceToman * travelData.travelers
      + (offer.childPriceToman || 0) * travelData.children
      + (offer.infantPriceToman || 0) * travelData.infants;
  }

  function chooseLiveOffer(offer: LiveOffer) {
    const total = verifiedOfferTotal(offer);
    if (total === null) {
      setSearchError("قیمت دقیق کودک یا نوزاد در پاسخ این سرویس موجود نیست؛ انتخاب قیمت کل انجام نشد.");
      return;
    }
    const details = {
      provider: offer.provider || "alibaba",
      providerLabel: TRANSPORT_PROVIDER_LABELS[offer.provider || "alibaba"],
      offerId: offer.id,
      offerTitle: `${activeLeg === "return" ? "برگشت · " : ""}${offer.title}`,
      unitPrice: offer.priceToman,
      bookingUrl: offer.bookingUrl || providerMeta.bookingUrl,
      fetchedAt: providerMeta.fetchedAt,
    };
    selectVehicle(searchMode, total, details);
    setTravelData((current) => ({
      ...current,
      transport: {
        vehicleId: searchMode,
        cost: total,
        ...details,
        origin: current.origin,
        destination: current.destination,
        departureDate: current.departureDate,
        returnDate: current.returnDate,
        travelers: current.travelers,
        children: current.children,
        infants: current.infants,
      },
    }));
  }

  return (
    <MotionConfig reducedMotion="user">
      <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#12364a_0%,#071521_60%)]" />
          <div className="absolute inset-0 grid-lines opacity-60" />
          <div className="aurora">
            <span className="-top-24 right-[5%] h-96 w-96 animate-float bg-teal-500/25" />
            <span className="left-[2%] top-[32rem] h-80 w-80 animate-float bg-sky-500/20 [animation-delay:1.5s]" />
            <span className="right-[30%] top-[75rem] h-72 w-72 animate-float bg-teal-500/15 [animation-delay:3s]" />
          </div>
        </div>

        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="/" className="group flex items-center gap-2.5" aria-label="صفحهٔ اصلی سفرینو">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow transition group-hover:scale-105">
              <Plane className="h-5 w-5 -rotate-45" strokeWidth={2.6} />
            </span>
            <span className="flex flex-col leading-none">
              <b className="text-lg font-black text-white">سفرینو</b>
              <small className="text-[10px] tracking-widest text-slate-400">SAFARINO</small>
            </span>
          </a>
          <a href="/quiz" className="btn-ghost !px-4 !py-2.5 text-xs">
            <ArrowRight className="h-4 w-4" />
            <span className="hidden sm:inline">بازگشت به کوییز</span>
            <span className="sm:hidden">کوییز</span>
          </a>
        </header>

        <TravelSteps current={2} />

        <div className="mx-auto max-w-7xl pb-16 pt-10 sm:pt-14">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="glass overflow-hidden p-5 shadow-card sm:p-7"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(6,182,212,0.12),transparent_45%)]" />
            <div className="relative grid items-center gap-6 lg:grid-cols-[1.5fr_1fr_auto]">
              <div>
                <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  مرحلهٔ دوم برنامه‌ریزی سفر
                </span>
                <h1 className="mt-4 text-2xl font-black leading-tight text-white sm:text-4xl">
                  حمل‌ونقل هوشمند؛ <span className="gradient-text">شفاف و اقتصادی</span>
                </h1>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <MapPin className="h-4 w-4 text-cyan-300" />
                    <b className="text-sm text-white">{travelData.origin || "مبدا نامشخص"}</b>
                    <ArrowLeft className="h-4 w-4 text-slate-500" />
                    <b className="text-sm text-white">{travelData.destination || "مقصد را در کوییز انتخاب کن"}</b>
                  </div>
                  <span className="chip !px-4 !py-2.5 !text-xs">
                    {distanceKm !== null ? `${formatNumber(distanceKm)} کیلومتر جاده‌ای` : "مسیر جاده‌ای در حال دریافت"}
                  </span>
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs text-slate-400">بودجهٔ حمل‌ونقل برای این سفر</span>
                <div className="flex flex-wrap gap-2" aria-label="انتخاب بودجه">
                  {[3_000_000, 5_000_000, 10_000_000].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setBudget(amount)}
                      aria-pressed={budget === amount}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        budget === amount
                          ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-200"
                          : "border-white/10 bg-white/5 text-slate-400 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      {formatCompactToman(amount)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-soft min-w-44 p-4 text-center lg:text-right">
                <WalletCards className="mx-auto h-5 w-5 text-turquoise-300 lg:mx-0" />
                <span className="mt-2 block text-[11px] text-slate-500">بودجهٔ انتخاب‌شده</span>
                <b className="mt-1 block text-lg font-black text-white">{formatCompactToman(budget)}</b>
              </div>
            </div>
          </motion.section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass p-5 sm:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="chip">ماشین‌حساب زنده</span>
                  <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">سفر با خودروی شخصی</h2>
                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    هزینه را با لحاظ‌کردن بنزین، استهلاک و عوارض و بر اساس مسیر جاده‌ای دریافت‌شده محاسبه کنید.
                  </p>
                  {distanceError && <p className="mt-2 text-[11px] leading-5 text-rose-300">{distanceError}</p>}
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                  <CarFront className="h-6 w-6" />
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300">مدل خودرو</span>
                  <select
                    value={carId}
                    onChange={(event) => setCarId(event.target.value)}
                    className="field cursor-pointer appearance-none bg-night-800"
                  >
                    {CARS.map((car) => (
                      <option key={car.id} value={car.id} className="bg-night-800 text-white">
                        {car.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold text-slate-300">تعداد سرنشین</span>
                  <select
                    value={passengers}
                    onChange={(event) => setPassengers(Number(event.target.value))}
                    className="field cursor-pointer appearance-none bg-night-800"
                  >
                    {Array.from({ length: 9 }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count} className="bg-night-800 text-white">
                        {formatNumber(count)} نفر
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <label className="glass-soft p-3">
                  <span className="mb-2 block text-[10px] text-slate-500">مصرف در ۱۰۰ کیلومتر (لیتر)</span>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    step="0.1"
                    value={consumption}
                    onChange={(event) => setCustomConsumption(Math.max(1, Number(event.target.value) || 1))}
                    className="w-full bg-transparent text-left text-xs font-bold text-white outline-none"
                    dir="ltr"
                  />
                </label>
                <label className="glass-soft p-3">
                  <span className="mb-2 block text-[10px] text-slate-500">قیمت هر لیتر بنزین (تومان)</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={fuelPrice}
                    onChange={(event) => setFuelPrice(Math.max(0, Number(event.target.value) || 0))}
                    className="w-full bg-transparent text-left text-xs font-bold text-white outline-none"
                    dir="ltr"
                  />
                </label>
                <label className="glass-soft p-3">
                  <span className="mb-2 block text-[10px] text-slate-500">استهلاک هر کیلومتر (تومان)</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={depreciationPerKm}
                    onChange={(event) => setCustomDepreciation(Math.max(0, Number(event.target.value) || 0))}
                    className="w-full bg-transparent text-left text-xs font-bold text-white outline-none"
                    dir="ltr"
                  />
                </label>
                <label className="glass-soft p-3">
                  <span className="mb-2 block text-[10px] text-slate-500">عوارض هر کیلومتر (تومان)</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={tollPerKm}
                    onChange={(event) => setTollPerKm(Math.max(0, Number(event.target.value) || 0))}
                    className="w-full bg-transparent text-left text-xs font-bold text-white outline-none"
                    dir="ltr"
                  />
                </label>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  { label: "هزینهٔ بنزین", value: fuelCost, icon: Fuel, tone: "text-cyan-300" },
                  { label: "هزینهٔ استهلاک", value: depreciationCost, icon: Wrench, tone: "text-rose-300" },
                  { label: "عوارض آزادراهی", value: tollCost, icon: Route, tone: "text-sky-300" },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.label} className="flex items-center justify-between gap-4 rounded-2xl bg-white/[0.035] px-4 py-3">
                      <span className="flex items-center gap-2 text-xs text-slate-300">
                        <Icon className={`h-4 w-4 ${row.tone}`} />
                        {row.label}
                      </span>
                      <b className="text-sm text-white">{formatToman(row.value)}</b>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.07] p-4">
                <div>
                  <span className="text-[11px] text-slate-400">جمع کل سفر</span>
                  <b className="mt-1 block text-lg font-black text-cyan-200">{formatToman(carTotal)}</b>
                </div>
                <div className="border-r border-white/10 pr-3">
                  <span className="text-[11px] text-slate-400">سهم هر سرنشین</span>
                  <b className="mt-1 block text-lg font-black text-white">{formatToman(costPerPassenger)}</b>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="flex flex-col gap-6"
            >
              <div className="glass relative overflow-hidden p-6 sm:p-7">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-transparent" />
                <div className="relative">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-xl">💡</span>
                  <h2 className="mt-4 text-lg font-black text-white">پیشنهاد هوشمند سفرینو</h2>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`${carId}-${passengers}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="mt-3 text-sm leading-8 text-emerald-100"
                    >
                      {cheapestTrain === null ? (
                        <>
                          برای مقایسهٔ واقعی خودرو و قطار، ابتدا <b className="text-emerald-300">بلیت قطار را جستجو کن</b>؛ بدون قیمت زنده مقایسه‌ای اعلام نمی‌کنیم.
                        </>
                      ) : trainSaving > 0 ? (
                        <>
                          با ارزان‌ترین بلیت جستجوشده، سفر با قطار حدود <b className="text-emerald-300">{formatCompactToman(trainSaving)}</b> کمتر از خودرو تمام می‌شود.
                        </>
                      ) : (
                        <>
                          با بلیت قطار جستجوشده، هزینهٔ خودرو کمتر است؛ سهم هر نفر{` `}
                          <b className="text-emerald-300">{formatCompactToman(costPerPassenger)}</b> است.
                        </>
                      )}
                    </motion.p>
                  </AnimatePresence>
                  <p className="mt-3 text-[11px] leading-6 text-slate-500">
                    مقایسه بر اساس هزینهٔ کل خودرو و بلیت قطار برای {formatNumber(passengers)} مسافر انجام شده است.
                  </p>
                </div>
              </div>

              <div className="glass p-6 sm:p-7">
                <h2 className="text-lg font-black text-white">فرمول محاسبه؛ بدون هزینهٔ پنهان</h2>
                <div className="mt-5 space-y-4 text-xs leading-7 text-slate-400">
                  <p>
                    <b className="text-slate-200">بنزین:</b> مسافت ÷ ۱۰۰ × {compactFormatter.format(consumption)} لیتر × {formatNumber(fuelPrice)} تومان
                  </p>
                  <p>
                    <b className="text-slate-200">استهلاک:</b> مسافت × نرخ کیلومتری خودرو ({formatNumber(depreciationPerKm)} تومان برای {selectedCar.name})
                  </p>
                  <p>
                    <b className="text-slate-200">عوارض:</b> مسافت × {formatNumber(tollPerKm)} تومان
                  </p>
                </div>
                <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-[11px] text-slate-500">
                  <Users className="h-4 w-4 shrink-0 text-turquoise-300" />
                  هزینهٔ خودرو برای کل گروه یک بار محاسبه و سپس بین سرنشین‌ها تقسیم می‌شود.
                </div>
              </div>
            </motion.div>
          </section>

          <section id="live-transport-search" className="glass mt-8 scroll-mt-6">
            <div className="border-b border-white/10 p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="chip">اطلاعات زندهٔ سفر</span>
                  <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">جستجوی واقعی {searchModeName}</h2>
                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    قیمت، ساعت حرکت و ظرفیت از پاسخ دریافت‌شدهٔ علی‌بابا؛ هیچ بلیت تخمینی نمایش داده نمی‌شود.
                  </p>
                </div>
                <span className="text-3xl" aria-hidden="true">{searchMode === "plane" ? "✈️" : searchMode === "train" ? "🚂" : "🚌"}</span>
              </div>
              <div className="glass-soft relative z-40 mt-6 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-cyan-300" />
                    <b className="text-sm text-white">مبدا و مقصد</b>
                  </div>
                  <span className="text-[10px] text-slate-500">جستجو با فارسی، لاتین یا کد شهر</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <CityCombobox
                    label="مبدا"
                    value={travelData.origin}
                    cities={availableCities}
                    placeholder="مثلاً تهران یا Tehran"
                    onChange={(city) => changeJourney("origin", city.name)}
                  />
                  <CityCombobox
                    label="مقصد"
                    value={travelData.destination}
                    cities={availableCities}
                    placeholder="مثلاً مشهد یا MHD"
                    onChange={(city) => changeJourney("destination", city.name)}
                  />
                </div>
              </div>

              <div className="relative z-30 mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
                <JalaliRangeCalendar
                  departureDate={travelData.departureDate}
                  returnDate={travelData.returnDate}
                  roundTrip={roundTrip}
                  onRoundTripChange={(value) => {
                    setRoundTrip(value);
                    if (!value) changeJourney("returnDate", "");
                  }}
                  onChange={(field, value) => changeJourney(field, value)}
                />
                <PassengerSelector
                  adults={travelData.travelers}
                  children={travelData.children}
                  infants={travelData.infants}
                  onChange={(field, value) => {
                    if (selection.vehicleId !== "car") selectVehicle("car", carTotal);
                    setTravelData((current) => ({
                      ...current,
                      [field]: value,
                      infants: field === "travelers" ? Math.min(current.infants, value) : field === "infants" ? Math.min(value, current.travelers) : current.infants,
                    }));
                  }}
                />
              </div>

              <div className="mt-5 flex flex-wrap gap-2" aria-label="انتخاب نوع حمل‌ونقل">
                {([
                  { id: "plane" as const, label: "✈️ هواپیما" },
                  { id: "train" as const, label: "🚂 قطار" },
                  { id: "bus" as const, label: "🚌 اتوبوس" },
                ]).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSearchMode(item.id)}
                    aria-pressed={searchMode === item.id}
                    className={`min-h-10 rounded-xl border px-4 text-xs font-bold transition-all ${
                      searchMode === item.id
                        ? "border-turquoise-400/40 bg-turquoise-400/15 text-turquoise-100"
                        : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={searchTickets}
                disabled={searchLoading}
                className="btn-primary mt-5 w-full !min-h-12 !px-6 !text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {searchLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SlidersHorizontal className="h-4 w-4" />}
                {searchLoading ? "در حال جستجو..." : "جستجوی بلیت واقعی"}
              </button>
            </div>

            {(offers.length > 0 || returnOffers.length > 0) && (
              <div className="flex flex-col gap-2 border-b border-white/10 bg-white/[0.02] p-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300/70" />
                  <input
                    type="search"
                    value={offerQuery}
                    onChange={(event) => setOfferQuery(event.target.value)}
                    placeholder={`جستجو در ${formatNumber(legOffers.length)} بلیت یافته‌شده: نام شرکت، سرویس یا منبع…`}
                    aria-label="جستجوی نام شرکت یا سرویس در بلیت‌های یافته‌شده"
                    className="field !py-2.5 pr-11 text-xs"
                  />
                </div>
                <span className="shrink-0 text-[10px] text-slate-400">
                  {formatNumber(visibleOffers.length)} از {formatNumber(legOffers.length)} بلیت
                </span>
              </div>
            )}

            {providerStatuses.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b border-white/10 bg-white/[0.02] p-4" aria-label="وضعیت منابع بلیت">
                {providerStatuses.map((status) => (
                  <span key={status.provider} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold ${status.status === "ok" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-cyan-400/20 bg-cyan-400/5 text-slate-400"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.status === "ok" ? "bg-emerald-300" : "bg-slate-500"}`} />
                    {status.label}
                    <b className="text-white">{status.status === "ok" ? `${formatNumber(status.count)} بلیت` : status.message || "در دسترس نیست"}</b>
                  </span>
                ))}
              </div>
            )}

            {searchError && (
              <div className="m-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs leading-6 text-rose-100">
                {searchError}
              </div>
            )}

            {roundTrip && (offers.length > 0 || returnOffers.length > 0) && (
              <div className="flex gap-2 border-b border-white/10 bg-white/[0.02] p-4">
                <button type="button" onClick={() => setActiveLeg("outbound")} className={`rounded-xl px-4 py-2 text-xs font-bold ${activeLeg === "outbound" ? "bg-cyan-300 text-slate-950" : "bg-white/5 text-slate-300"}`}>
                  رفت · {formatNumber(offers.length)} نتیجه
                </button>
                <button type="button" onClick={() => setActiveLeg("return")} className={`rounded-xl px-4 py-2 text-xs font-bold ${activeLeg === "return" ? "bg-cyan-300 text-slate-950" : "bg-white/5 text-slate-300"}`}>
                  برگشت · {formatNumber(returnOffers.length)} نتیجه
                </button>
              </div>
            )}

            {roundTrip && activeLeg === "return" && !returnOffers.length && offers.length > 0 && (
              <p className="m-5 rounded-2xl bg-white/5 p-4 text-xs text-slate-300">برای تاریخ برگشت، گزینه‌ای با قیمت و ظرفیت پیدا نشد.</p>
            )}

            <div className="divide-y divide-white/5">
              {visibleOffers.map((offer, index) => {
                const isSelected = selection.vehicleId === searchMode && selection.offerId === offer.id;
                return (
                  <div key={offer.id} className="flex flex-col gap-4 p-5 transition-colors hover:bg-white/[0.025] lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <ProviderLogo src={offer.logoUrl} name={offer.title} mode={searchMode} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <b className="text-sm text-white">{offer.title}</b>
                          {offer.provider && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-slate-300">
                              <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-cyan-400/20 text-[7px] text-cyan-200">{TRANSPORT_PROVIDER_MARKS[offer.provider]}</span>
                              {TRANSPORT_PROVIDER_LABELS[offer.provider]}
                            </span>
                          )}
                          {index === 0 && <span className="badge-turquoise !py-0.5 !text-[9px]">ارزان‌ترین</span>}
                        </div>
                        <span className="mt-1 block text-[11px] text-slate-400">{offer.subtitle}</span>
                        {offer.details?.length ? <span className="mt-1 block text-[10px] text-slate-500">{offer.details.join(" · ")}</span> : null}
                        {offer.alsoAvailableAt?.length ? (
                          <span className="mt-2 block text-[10px] leading-5 text-slate-400">
                            همین بلیت در{" "}
                            {offer.alsoAvailableAt.map((alternate, alternateIndex) => (
                              <span key={`${alternate.provider}-${alternateIndex}`}>
                                {alternateIndex > 0 ? " و " : ""}
                                <a href={alternate.bookingUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-cyan-200 underline decoration-cyan-400/40 underline-offset-4 hover:text-cyan-100">
                                  {alternate.providerLabel}
                                </a>{" "}
                                هم هست ({formatToman(alternate.priceToman)})
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-5 lg:justify-end">
                      <div className="text-left">
                        <span className="block text-[10px] text-slate-500">حرکت</span>
                        <b className="block text-sm leading-7 text-white">{formatProviderDateTime(offer.departure)}</b>
                        {offer.arrival && <span className="mt-1 block text-[10px] leading-5 text-slate-500">رسیدن: {formatProviderDateTime(offer.arrival)}</span>}
                      </div>
                      <div className="text-left">
                        <b className="block text-base font-black text-turquoise-200">{formatToman(offer.priceToman)}</b>
                        <span className="mt-1 block text-[10px] text-slate-500">هر بزرگسال</span>
                        {travelData.children > 0 && (
                          <span className="mt-1 block text-[10px] text-slate-500">
                            کودک: {offer.childPriceToman ? formatToman(offer.childPriceToman) : "قیمت در پاسخ نیست"}
                          </span>
                        )}
                        <span className="mt-1 block text-[10px] text-slate-500">
                          {typeof offer.seatsLeft === "number" && offer.seatsLeft > 0 ? `${formatNumber(offer.seatsLeft)} صندلی باقی‌مانده` : "ظرفیت در فهرست منبع ذکر نشده"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => chooseLiveOffer(offer)}
                          aria-pressed={isSelected}
                          className={`min-h-10 rounded-xl px-4 text-xs font-bold transition ${
                            isSelected ? "bg-cyan-300 text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                          }`}
                        >
                          {isSelected && <Check className="ml-1 inline h-4 w-4" />}
                          {isSelected ? "انتخاب شده" : "انتخاب برای سفرینو"}
                        </button>
                        {(offer.bookingUrl || providerMeta.bookingUrl) && (
                          <a
                            href={offer.bookingUrl || providerMeta.bookingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => chooseLiveOffer(offer)}
                            className="btn-primary !min-h-10 !px-4 !py-2 !text-[11px]"
                          >
                            خرید از {TRANSPORT_PROVIDER_LABELS[offer.provider || "alibaba"]}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 bg-white/[0.02] p-4 sm:flex-row">
              <p className="flex items-center gap-2 text-[11px] text-slate-400">
                <Clock3 className="h-4 w-4 text-turquoise-300" />
                {providerMeta.fetchedAt ? `دریافت اطلاعات: ${new Date(providerMeta.fetchedAt).toLocaleString("fa-IR")}` : "برای مشاهده نتایج واقعی جستجو کنید"}
              </p>
              {visibleOffers.length > 0 && (
                <p className="max-w-md text-[10px] leading-5 text-slate-500">
                  هر بلیت لینک خرید همان منبع را دارد؛ نام شرکت و ساعت ردیف را با بلیت انتخابی تطبیق بده.
                  {duplicateCount > 0 ? ` ${formatNumber(duplicateCount)} مورد یکسان (همان شرکت و همان ساعت، حتی با نام‌های کمی متفاوت) ادغام شد و لینک سایر منابع زیر همان بلیت آمده است.` : ""}
                </p>
              )}
            </div>
          </section>

          <section className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="chip">مقایسهٔ همزمان</span>
                <h2 className="section-title mt-3">کدام وسیله بیشتر به سفر تو می‌خورد؟</h2>
              </div>
              <p className="text-xs text-slate-500">قیمت بلیت‌ها برای هر مسافر و پس از جستجوی زنده نمایش داده می‌شود.</p>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {TRANSPORT_OPTIONS.map((option, index) => {
                const Icon = option.icon;
                const isSelected = selection.vehicleId === option.id;
                const liveUnitPrice = option.id !== "car" && option.id === searchMode && offers.length ? offers[0].priceToman : null;
                const optionCost = option.id === "car" ? carTotal : liveUnitPrice !== null ? liveUnitPrice * passengers : 0;
                return (
                  <motion.article
                    key={option.id}
                    initial={{ opacity: 0, y: 26 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.4, delay: index * 0.07 }}
                    className={`glass group relative flex flex-col overflow-hidden p-5 transition duration-300 hover:-translate-y-1 ${
                      isSelected ? "border-cyan-300/50 shadow-glow" : "hover:border-white/25"
                    }`}
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${option.accent} opacity-60`} />
                    <div className="relative flex h-full flex-col">
                      <div className="flex items-start justify-between">
                        <span className={`grid h-12 w-12 place-items-center rounded-2xl border ${option.iconTone}`}>
                          <Icon className="h-6 w-6" />
                        </span>
                        <span className="text-3xl" aria-hidden="true">{option.emoji}</span>
                      </div>
                      <h3 className="mt-5 text-lg font-black text-white">{option.name}</h3>
                      <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                        <Clock3 className="h-4 w-4 text-slate-500" />
                        {option.duration}
                      </p>
                      <div className="mt-5 border-y border-white/5 py-4">
                        <span className="block text-[10px] text-slate-500">
                          {option.id === "car" ? "هزینهٔ محاسبه‌شدهٔ کل" : `هزینه برای ${formatNumber(passengers)} مسافر`}
                        </span>
                        <b className="mt-1 block text-xl font-black text-cyan-200">
                          {option.id !== "car" && liveUnitPrice === null ? "پس از جستجو" : formatCompactToman(optionCost)}
                        </b>
                        {option.id !== "car" && (
                          <span className="mt-1 block text-[10px] text-slate-500">
                            {liveUnitPrice !== null ? `هر مسافر ${formatToman(liveUnitPrice)}` : "برای دیدن قیمت واقعی جستجو کنید"}
                          </span>
                        )}
                      </div>

                      <div className="mt-auto space-y-2 pt-5">
                        <button
                          type="button"
                          onClick={() => {
                            if (option.id === "car" || liveUnitPrice !== null) {
                              selectVehicle(option.id, optionCost);
                            } else {
                              setSearchMode(option.id);
                              document.getElementById("live-transport-search")?.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                          aria-pressed={isSelected}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
                            isSelected
                              ? "bg-cyan-300 text-slate-950"
                              : "border border-white/10 bg-white/5 text-white hover:border-cyan-300/40 hover:bg-white/10"
                          }`}
                        >
                          {isSelected && <Check className="h-4 w-4" />}
                          {isSelected ? "انتخاب شده" : option.id !== "car" && liveUnitPrice === null ? `جستجوی ${option.name}` : `انتخاب ${option.name}`}
                        </button>
                        {option.link && (
                          <a
                            href={option.link.href}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] text-slate-400 transition hover:bg-white/5 hover:text-white"
                          >
                            {option.link.label}
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass mt-8 flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                <Check className="h-5 w-5" />
              </span>
              <div>
                <span className="text-[11px] text-slate-500">وسیلهٔ انتخابی شما</span>
                <b className="mt-1 block text-sm text-white">
                  {selectedName}{selection.offerTitle ? ` · ${selection.offerTitle}` : ""} · {formatToman(selection.cost)}
                </b>
                <span className={`mt-1 block text-[11px] ${budgetDifference >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {budgetDifference >= 0
                    ? `${formatCompactToman(budgetDifference)} از بودجه باقی می‌ماند`
                    : `${formatCompactToman(Math.abs(budgetDifference))} بیشتر از بودجه`}
                </span>
              </div>
            </div>
            <a href="/accommodation" className="btn-primary w-full shrink-0 lg:w-auto">
              گام بعدی: انتخاب هتل و اقامتگاه
              <ArrowLeft className="h-4 w-4" />
            </a>
          </motion.section>

          <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-slate-600">
            <ArrowRight className="h-3.5 w-3.5" />
            انتخاب وسیله و هزینهٔ آن به‌صورت خودکار در همین مرورگر ذخیره می‌شود.
          </div>
        </div>
      </main>
    </MotionConfig>
  );
}

export default function TransportPage() {
  return (
    <TransportProvider>
      <TransportPageContent />
    </TransportProvider>
  );
}
