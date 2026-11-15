"use client";

import SnapshotKeeper from "@/components/SnapshotKeeper";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Compass,
  MapPin,
  Pencil,
  Ticket,
  X,
  Route,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import TravelSteps from "@/components/TravelSteps";
import CityCombobox from "@/components/CityCombobox";
import JalaliRangeCalendar from "@/components/JalaliRangeCalendar";
import PassengerSelector from "@/components/PassengerSelector";
import CarPlanner from "@/components/transport/CarPlanner";
import TicketSearch, { type TicketMode } from "@/components/transport/TicketSearch";
import ModeChooser, { MODE_OPTIONS, type TravelMode } from "@/components/transport/ModeChooser";
import { useTravel } from "../context/TravelContext";
import { citiesForTransport, resolveIranianCity } from "@/lib/iran-cities";
import { formatJalaliDate } from "@/lib/jalali";
import { parseTripLink, type PrefilledTicket } from "@/lib/link-prefill";
import SiteHeader from "@/components/SiteHeader";
import NextStepBar from "@/components/NextStepBar";

const STORAGE_KEY = "safarino-transport-selection-v1";
const MODE_KEY = "safarino-transport-mode-v1";
const LINK_APPLIED_KEY = "safarino-transport-link-v1";

const fa = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${fa.format(Math.round(value))} تومان`;
const millions = (value: number) =>
  `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(value / 1_000_000)} میلیون تومان`;

type Selection = {
  vehicleId: TravelMode;
  cost: number;
  unitPrice?: number;
  offerId?: string;
  offerTitle?: string;
  provider?: string;
  providerLabel?: string;
  bookingUrl?: string;
  fetchedAt?: string;
  carName?: string;
  details?: Record<string, unknown>;
};

type TransportContextValue = {
  selection: Selection;
  selectVehicle: (vehicleId: TravelMode, cost: number, details?: Partial<Selection>) => void;
  isReady: boolean;
};

const TransportContext = createContext<TransportContextValue | null>(null);

function TransportProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection>({ vehicleId: "plane", cost: 0 });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Selection>;
        const valid = MODE_OPTIONS.some((option) => option.id === parsed.vehicleId);
        if (valid && typeof parsed.cost === "number" && Number.isFinite(parsed.cost)) {
          setSelection({ ...parsed, vehicleId: parsed.vehicleId as TravelMode, cost: parsed.cost });
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
      // The calculator keeps working when storage is blocked.
    }
  }, [isReady, selection]);

  const selectVehicle = useCallback((vehicleId: TravelMode, cost: number, details?: Partial<Selection>) => {
    setSelection(details ? { ...details, vehicleId, cost } : { vehicleId, cost });
  }, []);

  const value = useMemo(() => ({ selection, isReady, selectVehicle }), [isReady, selection, selectVehicle]);

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

  const [mode, setMode] = useState<TravelMode | null>(null);
  const [editingTrip, setEditingTrip] = useState(false);
  const [roundTrip, setRoundTrip] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState("");
  const [cheapest, setCheapest] = useState<Partial<Record<TicketMode, number | null>>>({});
  /** The ticket a home-page package was built from, shown as the chosen one. */
  const [packageTicket, setPackageTicket] = useState<PrefilledTicket | null>(null);

  const originCity = resolveIranianCity(travelData.origin);
  const destinationCity = resolveIranianCity(travelData.destination);
  const budget = travelData.budget * 1_000_000;
  const passengers = Math.max(1, travelData.travelers + travelData.children);
  const days = Math.max(1, travelData.days || 1);

  /* ------------------------------------- coming from a home-page package */
  // «پیشنهادهای ویژه» sends the traveller here with origin, destination, dates
  // and mode already chosen. The same context every other entry path uses is
  // filled once, so the hotel and plan steps continue with identical values.
  useEffect(() => {
    if (!isHydrated) return;
    // The exact link is remembered, not a bare flag: a *different* package
    // clicked later in the same tab must apply too, while a refresh of the same
    // link must not undo the traveller's own edits.
    let applied = false;
    try {
      applied = window.sessionStorage.getItem(LINK_APPLIED_KEY) === window.location.search;
    } catch {
      applied = false;
    }
    if (applied) return;
    const prefill = parseTripLink(window.location.search);
    if (!prefill) return;

    // A package link starts a *new* trip. Leaving the previous car trip or the
    // previous hotel in place is exactly how a traveller ends up paying for a
    // journey they did not choose, so everything trip-specific is replaced.
    const fromPackage = Boolean(prefill.ticket || prefill.packageId);
    setTravelData((current) => {
      if (!fromPackage) {
        return {
          ...current,
          ...(prefill.origin ? { origin: prefill.origin } : {}),
          ...(prefill.destination ? { destination: prefill.destination } : {}),
          ...(prefill.departureDate ? { departureDate: prefill.departureDate } : {}),
          ...(prefill.returnDate ? { returnDate: prefill.returnDate } : {}),
          ...(prefill.days ? { days: prefill.days } : {}),
          ...(prefill.travellers ? { travelers: prefill.travellers } : {}),
        };
      }
      const nights = prefill.days ? Math.max(1, prefill.days - 1) : 1;
      const travellers = prefill.travellers || current.travelers;
      const stay = prefill.stay;
      return {
        ...current,
        origin: prefill.origin || current.origin,
        destination: prefill.destination || current.destination,
        departureDate: prefill.departureDate || current.departureDate,
        returnDate: prefill.returnDate || current.returnDate,
        days: prefill.days || current.days,
        travelers: travellers,
        children: 0,
        infants: 0,
        tripStyle: "",
        quizResult: "",
        quizAnswers: {},
        quizStep: 0,
        // The room the package was built from, in the same shape the
        // accommodation step writes — so that page opens with it selected.
        accommodation: stay
          ? {
              status: "selected" as const,
              id: `pkg-${prefill.packageId || "stay"}-${stay.name}`,
              kind: "hotel" as const,
              name: stay.name,
              typeLabel: stay.typeLabel,
              cost: stay.priceTotalToman,
              pricePerNightToman: stay.pricePerNightToman,
              city: prefill.destination || current.destination,
              checkIn: prefill.departureDate || current.departureDate,
              checkOut: prefill.returnDate || current.returnDate,
              nights,
              adults: travellers,
              children: 0,
              infants: 0,
              childAges: [],
              infantAges: [],
              bookingUrl: stay.bookingUrl,
              imageUrl: stay.photo,
              provider: stay.provider,
              providerLabel: stay.providerLabel,
              fetchedAt: new Date().toISOString(),
              fromPackage: true,
            }
          : null,
        transport: null,
      };
    });

    if (prefill.ticket) {
      const travellers = prefill.travellers || travelData.travelers || 2;
      const unit = prefill.ticket.priceToman;
      selectVehicle(prefill.ticket.mode, unit * travellers, {
        unitPrice: unit,
        offerId: `pkg:${prefill.packageId || prefill.ticket.bookingUrl}`,
        offerTitle: `${prefill.ticket.operator}${prefill.ticket.service ? ` · ${prefill.ticket.service}` : ""}`,
        provider: prefill.ticket.provider,
        providerLabel: prefill.ticket.providerLabel,
        bookingUrl: prefill.ticket.bookingUrl,
        fetchedAt: new Date().toISOString(),
        details: { fromPackage: true, departure: prefill.ticket.departure, arrival: prefill.ticket.arrival },
      });
      setPackageTicket(prefill.ticket);
      setMode(prefill.ticket.mode);
    } else if (prefill.mode) {
      setMode(prefill.mode);
    }
    if (prefill.roundTrip) setRoundTrip(true);
    try {
      window.sessionStorage.setItem(LINK_APPLIED_KEY, window.location.search);
    } catch {
      // A blocked storage only means the link is applied again on refresh.
    }
  }, [isHydrated, setTravelData]);

  /* ------------------------------------------------ restore the chosen mode */
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(MODE_KEY);
      if (saved && MODE_OPTIONS.some((option) => option.id === saved)) setMode(saved as TravelMode);
    } catch {
      // Ignoring a blocked storage keeps the page usable.
    }
  }, []);

  useEffect(() => {
    if (!mode) return;
    try {
      window.localStorage.setItem(MODE_KEY, mode);
    } catch {
      // Same here.
    }
  }, [mode]);

  /* ------------------------------------------------------------- trip dates */
  useEffect(() => {
    if (!isHydrated) return;
    if (travelData.returnDate) setRoundTrip(true);
  }, [isHydrated, travelData.returnDate]);

  /* --------------------------------------------------------- road distance */
  useEffect(() => {
    if (!isHydrated || !originCity || !destinationCity || originCity.code === destinationCity.code) {
      setDistanceKm(null);
      setDistanceError(
        originCity && destinationCity
          ? "مبدأ و مقصد یکی است؛ برای محاسبهٔ جاده دو شهر متفاوت انتخاب کنید."
          : "برای اندازه‌گیری مسیر، مبدأ و مقصد را انتخاب کنید.",
      );
      return;
    }
    let cancelled = false;
    setDistanceLoading(true);
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
      })
      .finally(() => {
        if (!cancelled) setDistanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [destinationCity, isHydrated, originCity]);

  /* ------------------------------------------- keep the choice in the context */
  useEffect(() => {
    setTravelData((current) => ({
      ...current,
      transport: {
        ...selection,
        origin: current.origin,
        destination: current.destination,
        departureDate: current.departureDate,
        returnDate: current.returnDate,
        travelers: current.travelers,
        days: current.days,
      },
    }));
  }, [selection, setTravelData]);

  const changeJourney = useCallback(
    (field: "origin" | "destination" | "departureDate" | "returnDate", value: string) => {
      setTravelData((current) => ({ ...current, [field]: value }));
    },
    [setTravelData],
  );

  const chooseMode = (next: TravelMode) => {
    setMode(next);
    if (next === "car" && selection.vehicleId !== "car") return;
    if (next !== "car" && selection.vehicleId === "car") return;
  };

  const onCarSelect = ({ total, details }: { total: number; perPassenger: number; details: Record<string, unknown> }) => {
    const carName = typeof details.carName === "string" ? details.carName : undefined;
    selectVehicle("car", total, {
      carName,
      details,
      provider: "safarino",
      // Later steps (budget, itinerary, PDF) show this as the chosen transport.
      providerLabel: "ماشین شخصی",
      offerTitle: carName ? `${carName} · محاسبهٔ کامل` : "محاسبهٔ کامل خودرو",
    });
  };

  const hints: Partial<Record<TravelMode, string>> = {
    plane: cheapest.plane ? `از ${money(cheapest.plane)} هر نفر` : undefined,
    train: cheapest.train ? `از ${money(cheapest.train)} هر نفر` : undefined,
    bus: cheapest.bus ? `از ${money(cheapest.bus)} هر نفر` : undefined,
    car: distanceKm ? "محاسبهٔ کامل با مسافت واقعی" : undefined,
  };

  const selectedName = MODE_OPTIONS.find((option) => option.id === selection.vehicleId)?.title || "";
  const budgetDifference = budget - selection.cost;
  const modeLabel = MODE_OPTIONS.find((option) => option.id === mode)?.title;

  return (
    <MotionConfig reducedMotion="user">
      <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 pb-32 pt-6 sm:px-6 lg:px-8">
        <SnapshotKeeper />
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#2c1256_0%,#120a26_60%)]" />
          <div className="absolute inset-0 grid-lines opacity-60" />
          <div className="aurora">
            <span className="-top-24 right-[5%] h-96 w-96 animate-float bg-teal-500/25" />
            <span className="left-[2%] top-[32rem] h-80 w-80 animate-float bg-sky-500/20 [animation-delay:1.5s]" />
          </div>
        </div>

        <SiteHeader />

        <TravelSteps current={2} />

        <NextStepBar
          summary={
            selection.cost > 0
              ? `${selectedName} · ${money(selection.cost)}${selection.offerTitle ? ` · ${selection.offerTitle}` : ""}`
              : "هنوز وسیلهٔ سفر انتخاب نشده"
          }
          hint={
            selection.cost > 0
              ? `بعد از این انتخاب، حدود ${money(Math.max(0, budget - selection.cost))} از بودجهٔ ${money(budget)} برای اقامت و بقیهٔ سفر می‌ماند.`
              : "یک بلیت یا ماشین را انتخاب کن؛ بعد اقامتگاه."
          }
          ready={selection.cost > 0}
          blockedNote="برای ادامه، یکی از بلیت‌ها را انتخاب کن یا ماشین شخصی را حساب کن."
          href="/accommodation"
          ctaLabel="ادامه به اقامتگاه"
        />

        <div className="mx-auto max-w-6xl pb-16 pt-8">
          {/* ------------------------------------------------ trip summary */}
          <section className="glass overflow-hidden p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  مرحلهٔ دوم: حمل‌ونقل
                </span>
                <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px]">
                  <MapPin className="h-3.5 w-3.5 text-cyan-300" />
                  <b className="text-white">{travelData.origin || "مبدأ؟"}</b>
                  <ArrowLeft className="h-3 w-3 text-slate-500" />
                  <b className="text-white">{travelData.destination || "مقصد؟"}</b>
                </span>
                <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10.5px] text-slate-300">
                  <CalendarDays className="h-3.5 w-3.5 text-cyan-300" />
                  {travelData.departureDate ? formatJalaliDate(travelData.departureDate) : "تاریخ؟"}
                  {travelData.returnDate ? ` تا ${formatJalaliDate(travelData.returnDate)}` : ""}
                </span>
                <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10.5px] text-slate-300">
                  <Users className="h-3.5 w-3.5 text-cyan-300" />
                  {fa.format(passengers)} مسافر · {fa.format(days)} روز
                </span>
                <span className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10.5px] text-slate-300">
                  <Route className="h-3.5 w-3.5 text-cyan-300" />
                  {distanceLoading ? "…" : distanceKm ? `${fa.format(distanceKm)} کیلومتر` : "مسیر نامشخص"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingTrip((value) => !value)}
                aria-expanded={editingTrip}
                className="btn-ghost !px-3 !py-2 text-[10.5px]"
              >
                <Pencil className="h-3 w-3" />
                ویرایش سفر
                <ChevronDown className={`h-3 w-3 transition ${editingTrip ? "rotate-180" : ""}`} />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {editingTrip ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 lg:grid-cols-[1.2fr_1fr]">
                    <div className="relative z-30 grid gap-3 sm:grid-cols-2">
                      <CityCombobox
                        label="مبدأ"
                        value={travelData.origin}
                        cities={citiesForTransport(mode === "bus" ? "bus" : mode === "train" ? "train" : "plane")}
                        placeholder="مثلاً تهران"
                        onChange={(city) => changeJourney("origin", city.name)}
                      />
                      <CityCombobox
                        label="مقصد"
                        value={travelData.destination}
                        cities={citiesForTransport(mode === "bus" ? "bus" : mode === "train" ? "train" : "plane")}
                        placeholder="مثلاً مشهد"
                        onChange={(city) => changeJourney("destination", city.name)}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
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
                          setTravelData((current) => ({
                            ...current,
                            [field]: value,
                            infants:
                              field === "travelers"
                                ? Math.min(current.infants, value)
                                : field === "infants"
                                  ? Math.min(value, current.travelers)
                                  : current.infants,
                          }));
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </section>

          {/* ------------------------------------------------ mode + budget */}
          <div className="mt-5">
            <ModeChooser
              mode={mode}
              onChoose={chooseMode}
              budgetMillions={travelData.budget}
              onBudget={(value) => setTravelData((current) => ({ ...current, budget: value }))}
              hints={hints}
            />
          </div>

          {/* ------------------------------------ the package's own ticket */}
          {packageTicket ? (
            <div className="glass mt-5 flex flex-col gap-3 border border-emerald-400/25 bg-emerald-400/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                  <Ticket className="h-5 w-5" />
                </span>
                <div>
                  <b className="block text-[12.5px] font-black text-white">بلیت همین پیشنهاد ویژه انتخاب شده است</b>
                  <p className="mt-1 text-[10.5px] leading-6 text-slate-300">
                    {packageTicket.operator}
                    {packageTicket.service ? ` · ${packageTicket.service}` : ""} · {money(packageTicket.priceToman)} هر نفر · منبع {packageTicket.providerLabel}
                    {packageTicket.departure ? ` · حرکت ${formatJalaliDate(packageTicket.departure.slice(0, 10))} ${packageTicket.departure.slice(11, 16)}` : ""}
                  </p>
                  <p className="mt-0.5 text-[9.5px] leading-5 text-emerald-200/80">
                    اقامتگاه این بسته هم ثبت شد؛ در مرحلهٔ اقامتگاه همان انتخاب می‌ماند مگر خودت عوضش کنی.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <a href={packageTicket.bookingUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-bold text-slate-200 hover:bg-white/10">
                  دیدن در {packageTicket.providerLabel}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setPackageTicket(null);
                    selectVehicle(mode || packageTicket.mode, 0);
                    try { window.sessionStorage.removeItem(LINK_APPLIED_KEY); } catch { /* ignore */ }
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-turquoise-400/30 bg-turquoise-400/10 px-3 py-2 text-[10px] font-bold text-turquoise-100 hover:bg-turquoise-400/20"
                >
                  <X className="h-3 w-3" />
                  تغییر این بلیت
                </button>
              </div>
            </div>
          ) : null}

          {/* ------------------------------------------------------- panels */}
          <div className="mt-5">
            {!mode ? (
              <div className="glass p-6 text-center">
                <b className="text-sm font-black text-white">اول وسیله را انتخاب کن</b>
                <p className="mx-auto mt-2 max-w-md text-[11px] leading-6 text-slate-400">
                  وقتی یکی از چهار کارت بالا را بزنی، دقیقاً همان بخش باز می‌شود: بلیت‌های واقعی همان وسیله، یا محاسبهٔ کامل هزینهٔ ماشین شخصی. هیچ‌چیز با هم قاطی نمی‌شود.
                </p>
              </div>
            ) : mode === "car" ? (
              <CarPlanner
                roadDistanceKm={distanceKm}
                distanceLoading={distanceLoading}
                distanceError={distanceError}
                origin={travelData.origin}
                destination={travelData.destination}
                passengers={passengers}
                days={days}
                roundTrip={roundTrip}
                initialCarId={typeof selection.details?.carId === "string" ? selection.details.carId : undefined}
                selected={selection.vehicleId === "car"}
                onSelect={onCarSelect}
              />
            ) : (
              <TicketSearch
                key={mode}
                mode={mode}
                roundTrip={roundTrip}
                active
                selectedId={selection.vehicleId === mode ? selection.offerId : undefined}
                onSelect={(payload) =>
                  selectVehicle(payload.mode, payload.total, {
                    unitPrice: payload.unitPrice,
                    offerId: payload.offerId,
                    offerTitle: payload.offerTitle,
                    provider: payload.provider,
                    providerLabel: payload.providerLabel,
                    bookingUrl: payload.bookingUrl,
                    fetchedAt: payload.fetchedAt,
                  })
                }
                onCheapestChange={(ticketMode, unitPrice) => setCheapest((current) => ({ ...current, [ticketMode]: unitPrice }))}
              />
            )}
          </div>

          {/* -------------------------------------------------- comparison */}
          {mode && selection.cost > 0 ? (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass mt-5 flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                  <Check className="h-5 w-5" />
                </span>
                <div>
                  <span className="text-[10px] text-slate-500">وسیلهٔ انتخابی شما</span>
                  <b className="mt-0.5 block text-[12.5px] text-white">
                    {selectedName}
                    {selection.vehicleId === "car"
                      ? selection.carName
                        ? ` · ${selection.carName}`
                        : ""
                      : selection.offerTitle
                        ? ` · ${selection.offerTitle}`
                        : ""}{" "}
                    · {money(selection.cost)}
                  </b>
                  <span className={`mt-0.5 flex items-center gap-1 text-[10px] ${budgetDifference >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    <Wallet className="h-3 w-3" />
                    {budgetDifference >= 0
                      ? `از بودجهٔ ${millions(budget)}، ${millions(budgetDifference)} باقی می‌ماند`
                      : `${millions(Math.abs(budgetDifference))} بیشتر از بودجهٔ ${millions(budget)}`}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <a href="/accommodation" className="btn-primary !px-4 !py-2.5 text-[11px]">
                  گام بعدی: انتخاب اقامتگاه
                  <ArrowLeft className="h-3.5 w-3.5" />
                </a>
                <a href="/itinerary" className="btn-ghost !px-4 !py-2.5 text-[11px]">
                  دیدن برنامهٔ روزبه‌روز
                </a>
              </div>
            </motion.section>
          ) : null}

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[9.5px] text-slate-500">
            {modeLabel ? `${modeLabel} انتخاب شده — ` : ""}انتخاب‌ها خودکار در همین مرورگر ذخیره می‌شوند و به سرور فرستاده نمی‌شوند.
          </p>
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
