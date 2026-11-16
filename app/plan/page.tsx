"use client";

import Link from "next/link";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowRight,
  BedDouble,
  Camera,
  CarFront,
  Check,
  Clock3,
  CloudSun,
  Coffee,
  Download,
  ExternalLink,
  ImageIcon,
  Lightbulb,
  LoaderCircle,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Trash2,
  Wand2,
  Route,
  Share2,
  Shirt,
  Sparkles,
  Utensils,
  WalletCards,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TravelSteps from "@/components/TravelSteps";
import ProviderBadge from "@/components/ProviderBadge";
import type { AccommodationProvider } from "@/lib/accommodation-types";
import { formatJalaliDate } from "@/lib/jalali";
import { useTravel } from "../context/TravelContext";
import PlaceCard from "@/components/PlaceCard";
import PlaceToolbar from "@/components/PlaceToolbar";
import { filterPlaces, type FilterOptions } from "@/lib/place-filter";
import { FAVORITES_EVENT, favoriteIds } from "@/lib/favorites";
import { openNeshanNavigation } from "@/lib/neshan-deeplink";
import type { PlaceCardData } from "@/components/PlaceCard";
import SiteHeader from "@/components/SiteHeader";
import ArchetypeCard from "@/components/ArchetypeCard";
import CrisisPlanCard from "@/components/CrisisPlanCard";
import AgentDebate from "@/components/AgentDebate";
import SmartPacking from "@/components/SmartPacking";
import NextStepBar from "@/components/NextStepBar";
import TimelineSchematic, { type SchematicStep } from "@/components/TimelineSchematic";
import { readPlanPlaces, togglePlanPlace, clearPlanPlaces, type PlanPlace } from "@/lib/plan-places";
import { cityPoint } from "@/lib/iran-cities";
import { chosenTransport, transportHeadline } from "@/lib/transport-selection";
import { tripCostBreakdown, costTableFootnote } from "@/lib/trip-costs";
import { ticketStayCheck } from "@/lib/ticket-timing";
import TripCostTable from "@/components/TripCostTable";
import { findCity } from "@/lib/discover";

// The schedule lives in lib/plan-schedule so the tests can build it too.
import { clockOfMinutes, faNum, faTime, minutesOfClock, slotDays, tastePlaces, tasteProfile, visitMinutes, type ActivityType, type PlanDay, type PlanItem } from "@/lib/plan-schedule";
type BudgetAnalysis = {
  totalBudget: number;
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  /** Taxis and metro inside the city, counted per person per day. */
  localTransport?: number;
  remaining: number;
  summary: string;
};
type PlanPoi = {
  id: string;
  description?: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  source: "openstreetmap" | "wikidata" | "wikipedia";
  sourceUrl: string;
  wikipediaUrl: string | null;
  imageUrl?: string | null;
  imageKind?: "photo" | "map" | "none";
  imageLabel?: string;
  imageCreditUrl?: string | null;
};

type PlanPoiWithStay = PlanPoi & { fromStayKm?: number | null; fromStayMinutes?: number | null };
type PoiPicture = { imageUrl?: string | null; imageKind?: "photo" | "map" | "none"; imageLabel?: string; imageCreditUrl?: string | null };

type PoiDistanceResponse = {
  success: boolean;
  engine: "neshan" | "osrm" | "straight-line";
  engineLabel: string;
  entries: { id: string; distanceKm: number; durationMinutes: number | null }[];
  failedIds: string[];
  neshanConfigured: boolean;
  note: string;
};

type PoiResponse = {
  success: boolean;
  city: string;
  pois: PlanPoi[];
  poisWithArticle: number;
  sources: { openstreetmap: "ok" | "failed"; wikidata: "ok" | "failed"; wikipedia: "ok" | "failed" };
  note: string;
};

type TravelPlan = {
  budgetAnalysis: BudgetAnalysis;
  days: PlanDay[];
  poiUsage?: { used: number; droppedStops: number; filledStops: number; offered: number };
  recommendations: {
    weather: string;
    clothing: string;
    restaurants: string[];
    costSaving: string[];
  };
};

const numberFormatter = new Intl.NumberFormat("fa-IR");
const compactFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const formatNumber = (value: number) => numberFormatter.format(Math.round(value));
const formatToman = (value: number) => `${formatNumber(value)} تومان`;
/** Kilometres keep one decimal below 10 so 0.5 km never reads as "1 km". */
const formatKm = (value: number) =>
  new Intl.NumberFormat("fa-IR", { maximumFractionDigits: value < 10 ? 1 : 0, minimumFractionDigits: 0 }).format(value);
const formatCompact = (value: number) => `${compactFormatter.format(value / 1_000_000)} میلیون`;

const ACTIVITY_STYLES: Record<ActivityType, { icon: LucideIcon; tone: string; label: string }> = {
  sightseeing: { icon: Camera, tone: "bg-sky-400/10 text-sky-300 border-sky-400/20", label: "بازدید" },
  food: { icon: Utensils, tone: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20", label: "غذا" },
  transport: { icon: CarFront, tone: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20", label: "جابه‌جایی" },
  rest: { icon: BedDouble, tone: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20", label: "استراحت" },
  activity: { icon: Sparkles, tone: "bg-sky-400/10 text-rose-300 border-sky-400/20", label: "تجربه" },
};

const LOCAL_TIMES = ["۰۹:۰۰", "۱۱:۳۰", "۱۵:۰۰", "۱۷:۳۰"];

/** Offline plan: when real POIs are available they are the only places shown. */
function localDays(destination: string, days: number, pois: PlanPoiWithStay[]): PlanDay[] {
  const pool = [...pois].sort((a, b) => {
    const first = typeof a.fromStayKm === "number" ? a.fromStayKm : Number.POSITIVE_INFINITY;
    const second = typeof b.fromStayKm === "number" ? b.fromStayKm : Number.POSITIVE_INFINITY;
    return first - second;
  });
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const stops = pool.splice(0, 2);
    const items: PlanItem[] = [
      { time: "۰۸:۰۰", title: "صبحانه و آماده‌سازی", description: "صبحانه در اقامتگاه و آماده‌شدن برای شروع روز.", type: "food" },
      ...stops.map((poi, stopIndex) => ({
        time: LOCAL_TIMES[stopIndex % LOCAL_TIMES.length],
        title: poi.name,
        description:
          typeof poi.fromStayKm === "number"
            ? `${poi.name} از جاذبه‌های ${poi.category} در ${destination} است؛ ${formatKm(poi.fromStayKm)} کیلومتر از اقامتگاه انتخاب‌شده فاصله دارد${typeof poi.fromStayMinutes === "number" ? ` (حدود ${new Intl.NumberFormat("fa-IR").format(poi.fromStayMinutes)} دقیقه رانندگی)` : ""}.`
            : `${poi.name} از جاذبه‌های ${poi.category} در ${destination} است؛ حدود ${formatKm(poi.distanceKm)} کیلومتر از مرکز شهر فاصله دارد.`,
        type: "sightseeing" as ActivityType,
        poiId: poi.id,
        poiCategory: poi.category,
        poiSourceUrl: poi.wikipediaUrl || poi.sourceUrl,
        poiWikipediaUrl: poi.wikipediaUrl,
        poiDistanceKm: typeof poi.fromStayKm === "number" ? poi.fromStayKm : poi.distanceKm,
      })),
      { time: "۱۳:۳۰", title: "ناهار در رستوران محلی", description: "ناهار ساده و محلی نزدیک به همان محله؛ قیمت را همان‌جا کنترل کنید.", type: "food" },
      { time: "۱۹:۳۰", title: "شام و پیاده‌روی", description: "پایان روز با شام سبک و پیاده‌روی آرام.", type: "food" },
    ];
    items.sort((a, b) => a.time.localeCompare(b.time, "fa"));
    return {
      day,
      title: stops.length ? `روز ${formatNumber(day)} · ${stops.map((poi) => poi.name).join(" و ")}` : `روز ${formatNumber(day)} · گشت در ${destination}`,
      items,
    };
  });
}

function createLocalPlan(
  destination: string,
  budget: number,
  days: number,
  transport = 0,
  accommodation = 0,
  pois: PlanPoiWithStay[] = [],
  people = 2,
  city = "",
): TravelPlan {
  /**
   * The same table as the transport and accommodation steps — food 1,000,000
   * per person per day, sightseeing priced for this city, and 200,000 of city
   * transport — so the remaining budget on this page matches the pages before it.
   */
  const shared = tripCostBreakdown({
    totalBudget: budget,
    travellers: Math.max(1, people),
    days: Math.max(1, days),
    nights: Math.max(1, days - 1),
    city,
    tickets: transport,
    stay: accommodation,
  });
  const food = shared.food;
  const activities = shared.activities;
  const localTransport = shared.localTransport;
  const remaining = shared.remaining;
  return {
    budgetAnalysis: {
      totalBudget: budget,
      transport,
      accommodation,
      food,
      activities,
      localTransport,
      remaining,
      summary: "این نسخه بدون هوش مصنوعی و فقط بر پایهٔ انتخاب‌های واقعی شما (حمل‌ونقل و اقامت) و جاذبه‌های تأییدشدهٔ مقصد ساخته شده است.",
    },
    days: localDays(destination, days, pois),
    recommendations: {
      weather: "پیش از حرکت، پیش‌بینی هوای مقصد را از منبع رسمی بررسی کنید.",
      clothing: "کفش راحت برای پیاده‌روی، لباس مناسب فصل و یک لایه سبک برای شب.",
      restaurants: ["رستوران‌های محلی نزدیک اقامتگاه", "غذاهای سنتی همان شهر", "کافه‌های محلی برای عصرانه"],
      costSaving: ["رزرو اقامت و بلیت را زودتر انجام دهید.", "برای مسیرهای کوتاه از حمل‌ونقل عمومی استفاده کنید."],
    },
  };
}

/** The hours a normal day can hold; the same grid every traveller understands. */
const DAY_SLOTS = ["۰۸:۳۰", "۱۰:۳۰", "۱۲:۳۰", "۱۵:۰۰", "۱۷:۳۰", "۱۹:۳۰"];

/**
 * «خودت پیشنهاد بده» — no AI, no invention: the traveller's own places are put
 * into real time slots, with the timetable the chosen ticket actually produces.
 *
 * The day is built like a person plans it:
 *   arrive (the ticket's own clock time) → transfer to the stay → check in and
 *   rest → first visit → lunch → afternoon visit → dinner.
 * Every clock time is derived from the one before it plus a travel leg measured
 * by the routing service, so «۱۰:۳۰» is a real time, not a label.
 */

export default function PlanPage() {
  const { travelData, setTravelData, isHydrated } = useTravel();
  const peopleCount = Math.max(1, Number(travelData.travelers || 2) + Number(travelData.children || 0));
  const [origin, setOrigin] = useState("تهران");
  const [destination, setDestination] = useState("مشهد");
  const [budget, setBudget] = useState(15_000_000);
  // The budget is agreed early (origin/destination or the quiz), so here it is
  // shown locked — changing it is a deliberate act, not an accident.
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [dayCount, setDayCount] = useState(3);
  const [preferences, setPreferences] = useState("فرهنگ و تاریخ، غذای محلی، سفر اقتصادی");
  const [plan, setPlan] = useState<TravelPlan>(() => createLocalPlan("مشهد", 15_000_000, 3, 0, 0));
  const [activeDay, setActiveDay] = useState(0);
  /** Where the current timeline came from: the traveller's list, their taste, or the model. */
  const [scheduleSource, setScheduleSource] = useState<"mine" | "taste" | "ai" | null>(null);
  /** AI order + one reason per stop, from /api/plan/curate. */
  const [curateLoading, setCurateLoading] = useState(false);
  const [curationNote, setCurationNote] = useState("");
  /** One warm paragraph a day, from /api/plan/guide. */
  const [guides, setGuides] = useState<Record<number, { text: string; tip: string }>>({});
  const [guideSource, setGuideSource] = useState<"ai" | "local" | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);
  const autoBuilt = useRef(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("برای دریافت برنامه اختصاصی، دکمه بازسازی هوشمند را بزنید.");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "warning">("info");
  const [transportDetails, setTransportDetails] = useState<Record<string, unknown>>({});
  const [accommodationDetails, setAccommodationDetails] = useState<Record<string, unknown>>({});
  const [poiData, setPoiData] = useState<PoiResponse | null>(null);
  const [poiLoading, setPoiLoading] = useState(false);
  const [poiDistances, setPoiDistances] = useState<Record<string, { distanceKm: number; durationMinutes: number | null }>>({});
  /** Measured minutes from the origin city (airport/terminal) to the chosen stay. */
  const [arrivalTransfer, setArrivalTransfer] = useState<{ minutes: number; distanceKm: number } | null>(null);
  const [distanceMeta, setDistanceMeta] = useState<{ engineLabel: string; engine: string; note: string; neshanConfigured: boolean } | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [placeFilters, setPlaceFilters] = useState<FilterOptions>({ query: "", categories: [], sort: "distance" });
  const [favoriteList, setFavoriteList] = useState<string[]>([]);
  /** Places the traveller chose in this step; the plan is built from exactly these. */
  const [chosenPlaces, setChosenPlaces] = useState<PlanPlace[]>([]);

  useEffect(() => {
    setChosenPlaces(readPlanPlaces());
  }, []);

  const chosenIds = useMemo(() => new Set(chosenPlaces.map((place) => place.id)), [chosenPlaces]);

  const toggleChosen = (place: PlanPlace) => {
    setChosenPlaces(togglePlanPlace(place));
  };

  useEffect(() => {
    const sync = () => setFavoriteList(favoriteIds());
    sync();
    window.addEventListener(FAVORITES_EVENT, sync);
    return () => window.removeEventListener(FAVORITES_EVENT, sync);
  }, []);


  const stayLatitude = Number(accommodationDetails.latitude);
  const stayLongitude = Number(accommodationDetails.longitude);
  const hasStayPin =
    Number.isFinite(stayLatitude) &&
    Number.isFinite(stayLongitude) &&
    stayLatitude !== 0 &&
    stayLongitude !== 0;

  const stayCity = typeof accommodationDetails.city === "string" ? accommodationDetails.city.trim() : "";
  const sameCity = (first: string, second: string) => {
    const clean = (value: string) => value.replace(/\s+/g, "").replace(/\u064a/g, "\u06cc").replace(/\u0643/g, "\u06a9");
    const a = clean(first);
    const b = clean(second);
    if (!a || !b) return true;
    return a === b || a.includes(b) || b.includes(a);
  };
  /** A stay in another city must never be sold as "2 km from this restaurant". */
  const stayCityMismatch = Boolean(stayCity) && Boolean(destination.trim()) && !sameCity(stayCity, destination);
  const canMeasureFromStay = hasStayPin && !stayCityMismatch;

  const enrichedPois: PlanPoiWithStay[] = (poiData?.pois ?? []).map((poi) => ({
    ...poi,
    fromStayKm: poiDistances[poi.id]?.distanceKm ?? null,
    fromStayMinutes: poiDistances[poi.id]?.durationMinutes ?? null,
  }));

  /** The places exactly as the cards render them, so search and filters agree with what is shown. */
  const cardPlaces = useMemo(
    () =>
      enrichedPois.map((poi) => ({
        id: poi.id,
        name: poi.name,
        category: poi.category,
        latitude: poi.latitude,
        longitude: poi.longitude,
        distanceKm: typeof poi.fromStayKm === "number" ? poi.fromStayKm : poi.distanceKm,
        imageKind: poi.imageKind ?? ("none" as const),
        wikipediaUrl: poi.wikipediaUrl,
        description: poi.description,
      })),
    [enrichedPois],
  );
  const visiblePlaces = useMemo(
    () => filterPlaces(cardPlaces, { ...placeFilters, favorites: favoriteList }),
    [cardPlaces, placeFilters, favoriteList],
  );
  const visibleIds = useMemo(() => new Set(visiblePlaces.map((place) => place.id)), [visiblePlaces]);

  useEffect(() => {
    if (!isHydrated) return;
    const nextOrigin = travelData.origin || "تهران";
    const nextDestination = travelData.destination || "مشهد";
    const nextBudget = Math.max(1_000_000, travelData.budget * 1_000_000);
    const nextDays = Math.max(1, Math.round(travelData.days || 3));
    let transportCost = 0;
    let accommodationCost = 0;
    setOrigin(nextOrigin);
    setDestination(nextDestination);
    setBudget(nextBudget);
    setDayCount(nextDays);

    // A leftover from another vehicle is not a choice: it is ignored and the
    // plan says «انتخاب نشده» rather than pricing a trip nobody picked.
    const picked = chosenTransport(travelData.transport);
    if (picked) {
      setTransportDetails(travelData.transport as Record<string, unknown>);
      transportCost = picked.cost;
    }
    if (travelData.accommodation) {
      setAccommodationDetails(travelData.accommodation);
      if (travelData.accommodation.status === "selected" && typeof travelData.accommodation.cost === "number" && Number.isFinite(travelData.accommodation.cost)) {
        accommodationCost = Math.max(0, travelData.accommodation.cost);
      }
    }

    try {
      if (!travelData.transport) {
        const transportRaw = window.localStorage.getItem("safarino-transport-selection-v1");
        const saved = transportRaw ? chosenTransport(JSON.parse(transportRaw)) : null;
        if (saved) {
          setTransportDetails(saved.raw);
          transportCost = saved.cost;
        }
      }
      if (!travelData.accommodation) {
        const accommodationRaw = window.localStorage.getItem("safarino-accommodation-selection-v1");
        if (accommodationRaw) {
          const saved = JSON.parse(accommodationRaw) as Record<string, unknown>;
          if (saved.status === "selected") {
            setAccommodationDetails(saved);
            if (typeof saved.cost === "number" && Number.isFinite(saved.cost)) accommodationCost = Math.max(0, saved.cost);
          }
        }
      }
    } catch {
      // Shared context remains the source of truth when legacy storage is invalid.
    }
    setPlan(createLocalPlan(nextDestination, nextBudget, nextDays, transportCost, accommodationCost, enrichedPois, peopleCount, nextDestination));
    setActiveDay(0);
  }, [isHydrated, travelData]);

  useEffect(() => {
    const city = destination.trim();
    if (!city) {
      setPoiData(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setPoiLoading(true);
    fetch("/api/providers/pois/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, limit: 40 }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload: PoiResponse) => {
        if (cancelled) return;
        setPoiData(payload);
        setPlan((current) => current.poiUsage
          ? current
          : createLocalPlan(city, current.budgetAnalysis.totalBudget, current.days.length, current.budgetAnalysis.transport, current.budgetAnalysis.accommodation, (payload.pois ?? []).map((poi) => ({ ...poi, fromStayKm: poiDistances[poi.id]?.distanceKm ?? null, fromStayMinutes: poiDistances[poi.id]?.durationMinutes ?? null })), peopleCount, city));
      })
      .catch(() => {
        if (!cancelled) setPoiData({ success: false, city, pois: [], poisWithArticle: 0, sources: { openstreetmap: "failed", wikidata: "failed", wikipedia: "failed" }, note: "خواندن جاذبه‌های واقعی مقصد انجام نشد." });
      })
      .finally(() => {
        if (!cancelled) setPoiLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [destination]);

  // Real distance from the chosen accommodation to every attraction.
  // Neshan first (when its key exists), OpenStreetMap routing second; the
  // engine that answered is always shown to the traveller.
  useEffect(() => {
    const pois = poiData?.pois ?? [];
    if (!canMeasureFromStay || !pois.length) {
      setPoiDistances({});
      setDistanceMeta(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setDistanceLoading(true);
    fetch("/api/route/poi-distances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { latitude: stayLatitude, longitude: stayLongitude },
        targets: pois.map((poi) => ({ id: poi.id, latitude: poi.latitude, longitude: poi.longitude })),
      }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload: PoiDistanceResponse) => {
        if (cancelled || !payload?.success || !Array.isArray(payload.entries)) return;
        const map: Record<string, { distanceKm: number; durationMinutes: number | null }> = {};
        payload.entries.forEach((entry) => {
          map[entry.id] = { distanceKm: entry.distanceKm, durationMinutes: entry.durationMinutes };
        });
        setPoiDistances(map);
        setDistanceMeta({ engineLabel: payload.engineLabel, engine: payload.engine, note: payload.note, neshanConfigured: payload.neshanConfigured });
      })
      .catch(() => {
        if (!cancelled) setDistanceMeta({ engineLabel: "", engine: "", note: "محاسبهٔ فاصله از اقامتگاه انجام نشد؛ همان فاصلهٔ مرکز شهر نمایش داده می‌شود.", neshanConfigured: false });
      })
      .finally(() => {
        if (!cancelled) setDistanceLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [poiData, canMeasureFromStay, stayLatitude, stayLongitude]);

  /**
   * How long it really takes to get from the traveller's own city to the door
   * of the chosen stay. Without this the first day pretends everyone arrives
   * at the hotel door. Neshan first, OSM second, and when there is no
   * measurement the scheduler keeps its honest default.
   */
  useEffect(() => {
    const start = cityPoint(origin.trim());
    if (!start || !canMeasureFromStay) {
      setArrivalTransfer(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    fetch("/api/route/poi-distances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: start,
        targets: [{ id: "stay", latitude: stayLatitude, longitude: stayLongitude }],
      }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((payload: { success?: boolean; entries?: { id: string; distanceKm: number; durationMinutes: number | null }[] }) => {
        if (cancelled || !payload?.success) return;
        const entry = payload.entries?.find((item) => item.id === "stay");
        if (!entry || typeof entry.durationMinutes !== "number" || !Number.isFinite(entry.durationMinutes)) {
          setArrivalTransfer(null);
          return;
        }
        setArrivalTransfer({ minutes: Math.round(entry.durationMinutes), distanceKm: entry.distanceKm });
      })
      .catch(() => {
        if (!cancelled) setArrivalTransfer(null);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [origin, canMeasureFromStay, stayLatitude, stayLongitude]);

  useEffect(() => {
    if (!Object.keys(poiDistances).length) return;
    setPlan((current) =>
      current.poiUsage
        ? current
        : createLocalPlan(destination, current.budgetAnalysis.totalBudget, current.days.length, current.budgetAnalysis.transport, current.budgetAnalysis.accommodation, enrichedPois, peopleCount, destination),
    );
    // Only rebuild while the plan is still the local, real-place-only one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poiDistances]);

  const nearestPois = enrichedPois
    .filter((poi) => typeof poi.fromStayKm === "number")
    .sort((a, b) => (a.fromStayKm as number) - (b.fromStayKm as number))
    .slice(0, 8);

  const selectedDay = plan.days[Math.min(activeDay, plan.days.length - 1)] ?? plan.days[0];

  /** The real arrival hour of the chosen ticket, when the provider gave one. */
  const arrivalTime = useMemo(() => {
    const candidates = [transportDetails.arrival, (transportDetails.details as Record<string, unknown> | undefined)?.arrival];
    for (const value of candidates) {
      if (typeof value !== "string" || !value.trim()) continue;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) continue;
      const parts = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).formatToParts(date);
      const hour = parts.find((part) => part.type === "hour")?.value;
      const minute = parts.find((part) => part.type === "minute")?.value;
      if (hour && minute) return `${hour}:${minute}`;
    }
    return null;
  }, [transportDetails]);

  /** The taste from the quiz (or their own words), plus the character of the destination. */
  const taste = useMemo(() => {
    const cityMoods = findCity(destination)?.moods || [];
    const picked = Array.isArray(travelData.tasteMoods) ? travelData.tasteMoods : [];
    return tasteProfile({
      // Their stated taste first, then the nature of the city they are visiting.
      moods: Array.from(new Set([...picked, ...cityMoods])).slice(0, 4),
      text: `${travelData.tripStyle || ""} ${travelData.quizResult || ""}`,
    });
  }, [destination, travelData.quizResult, travelData.tasteMoods, travelData.tripStyle]);

  /** Which places the suggestion may use when nothing was chosen. */
  const suggestionPool = useMemo(() => {
    const pool = nearestPois.length ? nearestPois : enrichedPois;
    return tastePlaces(pool, taste, { days: dayCount, maxPerDay: 3 });
  }, [dayCount, enrichedPois, nearestPois, taste]);

  /** Only the places the traveller added, matched to the live POI list. */
  const chosenPois = useMemo(
    () => enrichedPois.filter((poi) => chosenIds.has(poi.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enrichedPois, chosenIds],
  );

  /** «برنامهٔ من» — taken from the traveller's own list, never from somewhere else. */
  const planSource = (plan.days.flatMap((day) => day.items).filter((item) => item.poiId).length)
    ? chosenPois.length && plan.budgetAnalysis
      ? "mine"
      : "mixed"
    : "none";

  /** The diagram above the day list: arrival, bags, then the visits of that day. */
  const daySteps: SchematicStep[] = useMemo(() => {
    const items = selectedDay?.items ?? [];
    const steps: SchematicStep[] = [];
    if (selectedDay?.day === 1) {
      steps.push({
        time: arrivalTime || "—",
        title: origin && destination ? `رسیدن از ${origin}` : "رسیدن به مقصد",
        note: arrivalTime ? "ساعت بلیت انتخاب‌شده" : "ساعت ورود در بلیت ثبت نشده",
        kind: "arrive",
      });
      const stayClock = typeof accommodationDetails.checkIn === "string" ? null : null;
      void stayClock;
      steps.push({ time: items.find((item) => item.type === "rest")?.time || "—", title: "تحویل اقامتگاه", note: typeof accommodationDetails.name === "string" ? accommodationDetails.name : undefined, kind: "hotel" });
    }
    items
      .filter((item) => item.type === "sightseeing" || item.type === "food" || item.type === "activity")
      .slice(0, 6)
      .forEach((item) => {
        steps.push({
          time: item.time,
          title: item.title,
          note: item.poiCategory,
          kind: item.type === "sightseeing" ? "visit" : item.type === "food" ? "food" : "other",
        });
      });
    return steps;
  }, [selectedDay, arrivalTime, origin, destination, accommodationDetails]);

  const totalSpent = useMemo(() => {
    const analysis = plan.budgetAnalysis;
    // Every row counts, including the city transport that used to be forgotten.
    return analysis.transport + analysis.accommodation + analysis.food + analysis.activities + (analysis.localTransport || 0);
  }, [plan]);

  /** The very same five rows the transport and accommodation pages print. */
  const costTable = useMemo(
    () =>
      tripCostBreakdown({
        totalBudget: plan.budgetAnalysis.totalBudget,
        travellers: Math.max(1, peopleCount),
        days: Math.max(1, plan.days.length || dayCount),
        nights: Math.max(1, (plan.days.length || dayCount) - 1),
        city: destination,
        tickets: plan.budgetAnalysis.transport,
        stay: plan.budgetAnalysis.accommodation,
      }),
    [dayCount, destination, peopleCount, plan],
  );
  const spentPercent = Math.round((totalSpent / Math.max(plan.budgetAnalysis.totalBudget, 1)) * 100);

  /**
   * «بلیت و شب‌های اقامت با هم می‌خوانند؟» — the ticket's own clock against the
   * room's own dates. A night paid for before the traveller has landed is a real
   * mistake, so it is said out loud instead of hidden behind a clean plan.
   */
  const timing = useMemo(
    () =>
      ticketStayCheck({
        departure: typeof transportDetails.departure === "string" ? transportDetails.departure : null,
        arrival: typeof transportDetails.arrival === "string" ? transportDetails.arrival : null,
        checkIn: typeof accommodationDetails.checkIn === "string" ? accommodationDetails.checkIn : null,
        checkOut: typeof accommodationDetails.checkOut === "string" ? accommodationDetails.checkOut : null,
      }),
    [accommodationDetails.checkIn, accommodationDetails.checkOut, transportDetails.arrival, transportDetails.departure],
  );

  const regenerate = async (pool?: PlanPoiWithStay[]) => {
    const requested = pool && pool.length ? pool : enrichedPois;
    setLoading(true);
    setNoticeTone("info");
    setNotice(requested.length
      ? `هوش مصنوعی دارد برنامهٔ ${formatNumber(dayCount)} روز را از ${formatNumber(requested.length)} مکان انتخابی تو می‌چیند…`
      : "هوش مصنوعی در حال تحلیل بودجه و چیدن برنامه روزهاست…");
    try {
      const endpoint = process.env.NEXT_PUBLIC_AI_PLAN_ENDPOINT || "/api/plan";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arrivalTime,
          chosenPlaceIds: requested.map((poi) => poi.id),
          origin,
          destination,
          budget,
          days: dayCount,
          travelers: travelData.travelers,
          transport: transportDetails,
          accommodation: accommodationDetails,
          pois: requested.map((poi) => ({ id: poi.id, name: poi.name, category: poi.category, latitude: poi.latitude, longitude: poi.longitude, distanceKm: typeof poi.fromStayKm === "number" ? poi.fromStayKm : poi.distanceKm, sourceUrl: poi.sourceUrl, wikipediaUrl: poi.wikipediaUrl })),
          preferences: preferences.split(/[،,]/).map((item) => item.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.plan?.days?.length) {
        throw new Error(payload.error || "AI request failed");
      }
      setPlan(payload.plan as TravelPlan);
      setActiveDay(0);
      setScheduleSource("ai");
      setNoticeTone("success");
      setNotice(`برنامه تازه با ${payload.meta?.model || "هوش مصنوعی"} ساخته شد.`);
    } catch {
      setPlan(createLocalPlan(destination, budget, dayCount, plan.budgetAnalysis.transport, plan.budgetAnalysis.accommodation, enrichedPois, peopleCount, destination));
      setActiveDay(0);
      setNoticeTone("warning");
      setNotice("اتصال زنده به AI برقرار نشد؛ نسخه آفلاین ساخته شد. روی Netlify ایستا، مسیر API باید به یک سرویس سروری خارجی متصل شود.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * «برنامهٔ من»: the traveller's own places, fitted to real hours.
   *
   * Whatever they added is in the plan — all of it, even when the day gets
   * busy — because a chosen place that silently disappears is a broken promise.
   * With nothing chosen, the suggestion comes from their taste instead.
   */
  const suggestMyself = () => {
    const mine = chosenPois.length > 0;
    const places = mine ? chosenPois : suggestionPool.length ? suggestionPool : enrichedPois;
    if (!places.length) {
      setNoticeTone("warning");
      setNotice("اول چند جاذبه را با «افزودن به برنامهٔ سفر» انتخاب کن، بعد ساعت‌ها را می‌چینم.");
      return;
    }
    setPlan((current) => ({
      ...current,
      days: slotDays({
        destination,
        days: dayCount,
        places,
        arrivalTime,
        // Real minutes from the origin city to the hotel, measured — never guessed.
        transferMinutes: arrivalTransfer?.minutes ?? null,
        transferKm: arrivalTransfer?.distanceKm ?? null,
        origin,
        // A chosen list is a promise: every place is scheduled.
        respectAll: mine,
        maxPerDay: mine ? places.length : 3,
      }),
    }));
    setActiveDay(0);
    setScheduleSource(mine ? "mine" : "taste");
    setNoticeTone("success");
    setNotice(
      mine
        ? `برنامه دقیقاً از ${formatNumber(places.length)} جاذبه‌ای که خودت انتخاب کردی و در ساعت‌های واقعی روز چیده شد؛ هیچ جای دیگری اضافه نشد.`
        : `مکانی انتخاب نکرده بودی، پس ${formatNumber(places.length)} جاذبه را بر اساس سلیقه‌ات (${taste.moods.join("، ") || "طبیعت و تاریخ"}) و فاصله از اقامتگاه چیدم.`,
    );
  };

  /**
   * The list of days must never contradict the places the traveller picked, so
   * the schedule is built once on arrival: from their own list when they have
   * one, otherwise from their taste. Running it here (not in an effect chain)
   * keeps a single, predictable build.
   */
  useEffect(() => {
    if (autoBuilt.current || !isHydrated) return;
    if (!chosenPois.length && !suggestionPool.length) return;
    autoBuilt.current = true;
    suggestMyself();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenPois.length, suggestionPool.length, isHydrated]);

  /**
   * Adding or removing a place rebuilds the schedule right away, so the
   * timeline and the list of chosen places can never drift apart.
   */
  const chosenKey = useMemo(() => chosenPois.map((poi) => poi.id).sort().join("|"), [chosenPois]);
  useEffect(() => {
    if (!autoBuilt.current) return;
    if (scheduleSource === "ai") return;
    if (!chosenKey) {
      if (scheduleSource === "mine") suggestMyself();
      return;
    }
    suggestMyself();
    // Only the chosen list triggers a rebuild; the builder is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenKey]);

  const tripKey = useMemo(
    () => `${destination}|${dayCount}|${chosenPois.map((poi) => poi.id).sort().join(",")}`,
    [chosenPois, dayCount, destination],
  );

  /**
   * «چیدن هوشمند»: the model orders the real places the traveller is looking at
   * and says why each one is there. It never adds a place and never removes a
   * chosen one — if it cannot answer, the local order stands.
   */
  const runCurate = async (silent = false) => {
    const mine = chosenPois.length > 0;
    const places = mine ? chosenPois : suggestionPool.length ? suggestionPool : enrichedPois;
    if (!places.length) return;
    setCurateLoading(true);
    if (!silent) setNoticeTone("info");
    try {
      const response = await fetch("/api/plan/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          destination,
          days: dayCount,
          mustIncludeAll: mine,
          taste: { moods: taste.moods, words: taste.words },
          places: places.map((poi) => ({
            id: poi.id,
            name: poi.name,
            category: poi.category,
            km: typeof poi.fromStayKm === "number" ? poi.fromStayKm : poi.distanceKm,
            minutes: typeof poi.fromStayMinutes === "number" ? poi.fromStayMinutes : null,
          })),
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        days?: { day: number; stops: { id: string; why: string }[] }[];
        summary?: string;
        source?: "ai" | "local";
        note?: string;
      };
      if (!payload?.success || !payload.days?.length) throw new Error("curate failed");
      const reasons: Record<string, string> = {};
      payload.days.forEach((day) => day.stops.forEach((stop) => { if (stop.why) reasons[stop.id] = stop.why; }));
      setPlan((current) => ({
        ...current,
        days: slotDays({
          destination,
          days: dayCount,
          places,
          arrivalTime,
          transferMinutes: arrivalTransfer?.minutes ?? null,
          transferKm: arrivalTransfer?.distanceKm ?? null,
          origin,
          respectAll: true,
          maxPerDay: places.length,
          assignment: payload.days!.map((day) => day.stops.map((stop) => stop.id)),
          notes: reasons,
        }),
      }));
      setActiveDay(0);
      setScheduleSource(payload.source === "ai" ? "ai" : mine ? "mine" : "taste");
      setCurationNote(payload.source === "ai" ? payload.summary || "" : payload.note || "");
      setNoticeTone("success");
      setNotice(
        payload.source === "ai"
          ? `چیدمان هوشمند آماده شد: ${formatNumber(places.length)} جاذبهٔ واقعی، مرتب‌شده بر اساس سلیقه و فاصله${payload.summary ? ` — ${payload.summary}` : ""}.`
          : payload.note || "چیدمان محلی (نزدیک‌ترین جاذبه‌ها) اعمال شد.",
      );
    } catch {
      if (!silent) {
        setNoticeTone("warning");
        setNotice("چیدن هوشمند انجام نشد؛ همان ترتیب محلی باقی ماند.");
      }
    } finally {
      setCurateLoading(false);
    }
  };

  /** «راهنمای روز»: one paragraph a day about exactly what that day holds. */
  const runGuide = async () => {
    if (!plan.days.length) return;
    setGuideLoading(true);
    try {
      const response = await fetch("/api/plan/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          destination,
          taste: taste.moods.join("، "),
          days: plan.days.map((day) => ({
            day: day.day,
            stops: day.items
              .filter((item) => item.type === "sightseeing" || item.type === "food" || item.type === "transport")
              .map((item) => ({ time: item.time, title: item.title, kind: item.type })),
          })),
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        guides?: { day: number; text: string; tip: string }[];
        source?: "ai" | "local";
      };
      if (!payload?.success || !payload.guides?.length) throw new Error("guide failed");
      const map: Record<number, { text: string; tip: string }> = {};
      payload.guides.forEach((entry) => { map[entry.day] = { text: entry.text, tip: entry.tip }; });
      setGuides(map);
      setGuideSource(payload.source || "local");
    } catch {
      // The timeline stands on its own; a missing paragraph is not an error box.
    } finally {
      setGuideLoading(false);
    }
  };

  /**
   * The guide is written once per distinct plan (cached for the session), so a
   * reload never pays for the same paragraph twice.
   */
  useEffect(() => {
    if (!plan.days.length) return;
    const key = `safarino:guide:${tripKey}:${plan.days.map((day) => day.items.filter((item) => item.type === "sightseeing").map((item) => item.poiId).join("-")).join("_")}`;
    let saved: Record<number, { text: string; tip: string }> | null = null;
    let savedSource: "ai" | "local" | null = null;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { guides: Record<number, { text: string; tip: string }>; source: "ai" | "local" };
        saved = parsed.guides;
        savedSource = parsed.source;
      }
    } catch {
      saved = null;
    }
    if (saved) {
      setGuides(saved);
      setGuideSource(savedSource);
      return;
    }
    void runGuide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey, plan.days]);

  useEffect(() => {
    if (!guideSource || !Object.keys(guides).length) return;
    const key = `safarino:guide:${tripKey}:${plan.days.map((day) => day.items.filter((item) => item.type === "sightseeing").map((item) => item.poiId).join("-")).join("_")}`;
    try {
      window.sessionStorage.setItem(key, JSON.stringify({ guides, source: guideSource }));
    } catch {
      // A blocked storage only means the paragraph is written again next time.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guides, guideSource]);

  const sharePlan = async () => {
    const text = `برنامه سفر من از ${origin} به ${destination} با سفرینو`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "برنامه سفر سفرینو", text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        setNoticeTone("success");
        setNotice("لینک برنامه کپی شد و آماده ارسال برای همراهان است.");
      }
    } catch {
      // Closing the native share sheet is not an error that needs to be shown.
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 pb-32 pt-6 print:bg-white print:p-0 print:text-black sm:px-6 lg:px-8">
        <style>{`@page { size: A4; margin: 14mm 12mm; }
@media print {
  body { background: white !important; color: black !important; }
  .print-card { border: 1px solid #ddd !important; background: white !important; color: black !important; box-shadow: none !important; break-inside: avoid; }
  .print-card * { color: black !important; text-shadow: none !important; }
  .print-only { display: block !important; }
  .screen-only { display: none !important; }
}`}</style>
        <div className="pointer-events-none absolute inset-0 -z-10 print:hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#2c1256_0%,#120a26_60%)]" />
          <div className="absolute inset-0 grid-lines opacity-60" />
          <div className="aurora">
            <span className="-top-24 right-[5%] h-96 w-96 animate-float bg-teal-500/25" />
            <span className="left-[2%] top-[45rem] h-80 w-80 animate-float bg-teal-500/20 [animation-delay:1.5s]" />
          </div>
        </div>

        <SiteHeader />

        <TravelSteps current={4} />

        <NextStepBar
          summary={`${origin} → ${destination} · ${formatNumber(dayCount)} روز · برنامهٔ ${formatNumber(plan.days.length)} روزه`}
          hint="برنامهٔ روزبه‌روز، هوای همان روزها، فاصله‌ها، چک‌لیست و نسخهٔ PDF در مرحلهٔ بعد است."
          href="/itinerary"
          ctaLabel="ادامه به برنامهٔ روزبه‌روز"
        />

        <div className="mx-auto max-w-7xl pb-16 pt-10 sm:pt-14">
          <section className="text-center print:text-right">
            <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200 print:hidden"><Sparkles className="h-3.5 w-3.5" />برنامه‌ساز هوشمند سفر</span>
            <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-5xl">برنامه سفر {origin} به <span className="gradient-text">{destination}</span></h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-400">بودجه، زمان و سلیقه تو؛ تبدیل به یک برنامه روزبه‌روز و قابل اجرا.</p>
          </section>

          <section className="print-only mt-6 hidden print-card rounded-xl border border-white/10 p-4" aria-label="خلاصه سفر">
            <h2 className="text-base font-black">خلاصه سفر</h2>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] leading-6">
              <span>مسیر: {origin} به {destination}</span>
              <span>تعداد روز: {formatNumber(dayCount)}</span>
              <span>تاریخ حرکت: {travelData.departureDate ? formatJalaliDate(travelData.departureDate) : "ثبت‌نشده"}</span>
              <span>تاریخ بازگشت: {travelData.returnDate ? formatJalaliDate(travelData.returnDate) : "ثبت‌نشده"}</span>
              <span>مسافران: {formatNumber(travelData.travelers || 1)} بزرگسال{travelData.children ? ` · ${formatNumber(travelData.children)} کودک` : ""}{travelData.infants ? ` · ${formatNumber(travelData.infants)} نوزاد` : ""}</span>
              <span>بودجه کل: {formatToman(plan.budgetAnalysis.totalBudget)}</span>
              <span>حمل‌ونقل انتخاب‌شده: {(() => { const picked = chosenTransport(transportDetails); return picked ? transportHeadline(picked) : "انتخاب نشده"; })()}</span>
              <span>اقامت انتخاب‌شده: {plan.budgetAnalysis.accommodation ? `${String(accommodationDetails.name ?? "")} · ${formatToman(plan.budgetAnalysis.accommodation)}` : "بدون اقامتگاه"}</span>
            </div>
          </section>

          <section className="glass mt-8 grid gap-3 p-4 print:hidden sm:grid-cols-2 lg:grid-cols-5">
            <label><span className="mb-1.5 block text-[10px] text-slate-500">مبدأ</span><input value={origin} onChange={(event) => setOrigin(event.target.value)} className="field !py-2.5" /></label>
            <label><span className="mb-1.5 block text-[10px] text-slate-500">مقصد</span><input value={destination} onChange={(event) => setDestination(event.target.value)} className="field !py-2.5" /></label>
            <div>
              <span className="mb-1.5 block text-[10px] text-slate-500">بودجهٔ کل سفر</span>
              {budgetEditing ? (
                <span className="flex items-center gap-1.5">
                  <input type="number" min="1000000" step="500000" value={budget} onChange={(event) => setBudget(Number(event.target.value))} className="field !py-2.5" aria-label="بودجهٔ کل سفر به تومان" />
                  <button type="button" onClick={() => { setBudgetEditing(false); setTravelData((current) => ({ ...current, budget: Math.max(1, Math.round(budget / 1_000_000)) })); }} className="shrink-0 rounded-xl bg-cyan-300 px-3 py-2.5 text-[10px] font-black text-slate-950">ثبت</button>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] px-3 py-2.5">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <b className="flex-1 text-[11px] font-black text-white">{formatToman(budget)}</b>
                  <button type="button" onClick={() => setBudgetEditing(true)} className="shrink-0 text-[10px] font-extrabold text-cyan-200 underline decoration-cyan-400/40 underline-offset-4">تغییر</button>
                </span>
              )}
              <span className="mt-1 block text-[9px] leading-4 text-slate-500">همان بودجه‌ای که اول سفر گفتی؛ همهٔ پیشنهادها با همین عدد سنجیده شده‌اند.</span>
            </div>
            <label><span className="mb-1.5 block text-[10px] text-slate-500">تعداد روز</span><select value={dayCount} onChange={(event) => setDayCount(Number(event.target.value))} className="field cursor-pointer !py-2.5">{[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>{formatNumber(day)} روز</option>)}</select></label>
            <label className="sm:col-span-2 lg:col-span-1"><span className="mb-1.5 block text-[10px] text-slate-500">سلیقه سفر</span><input value={preferences} onChange={(event) => setPreferences(event.target.value)} className="field !py-2.5" /></label>
          </section>

          <section className="glass print-card mt-6 border border-cyan-400/20 p-5 sm:p-7 print:hidden" aria-label="جاذبه‌های انتخابی سفر">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black text-white">
                <Camera className="h-5 w-5 text-cyan-300" />
                مکان‌هایی که برای این سفر انتخاب کردی
                <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                  {formatNumber(chosenPlaces.length)}
                </span>
              </h2>
              {chosenPlaces.length ? (
                <button
                  type="button"
                  onClick={() => setChosenPlaces(clearPlanPlaces())}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 transition hover:text-rose-200"
                >
                  <Trash2 className="h-3 w-3" />
                  پاک کردن فهرست
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-[11px] leading-6 text-slate-400">
              روی هر جاذبه در فهرست پایین «افزودن به برنامهٔ سفر» را بزن. برنامهٔ روزها از همین مکان‌ها و تعداد روزی که در مرحلهٔ قبل انتخاب کردی ساخته می‌شود.
            </p>
            {chosenPlaces.length ? (
              <>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chosenPlaces.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => toggleChosen(place)}
                      title="حذف از فهرست"
                      className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-100 transition hover:border-rose-400/40 hover:text-rose-200"
                    >
                      {place.name}
                      <Trash2 className="h-3 w-3" />
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={suggestMyself}
                    className="btn-primary flex-1 !py-3 text-xs"
                  >
                    <Wand2 className="h-4 w-4" />
                    چیدن برنامه از همین {formatNumber(chosenPlaces.length)} جاذبه (بدون AI)
                  </button>
                  <button
                    type="button"
                    onClick={() => void regenerate(chosenPois)}
                    disabled={loading}
                    className="btn-ghost flex-1 !py-3 text-xs disabled:cursor-wait disabled:opacity-60"
                  >
                    {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    ساخت روایت روزها با هوش مصنوعی
                  </button>
                </div>
                <p className="mt-2 text-[9.5px] leading-5 text-slate-500">
                  «چیدن برنامه» همهٔ جاذبه‌های انتخابی تو را — نه کم و نه زیاد — به ترتیب نزدیکی به اقامتگاه در ساعت‌های واقعی روز می‌گذارد؛ ناهار، شام، رفت‌وآمد و ساعت رسیدن بلیت هم حساب می‌شود. «هوش مصنوعی» فقط توضیح و روایت همان مکان‌ها را می‌نویسد.
                </p>
              </>
            ) : (
              <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-[10.5px] leading-6 text-amber-100">
                هنوز مکانی انتخاب نکرده‌ای — و لازم هم نیست: برنامهٔ پایین از سلیقه‌ات ساخته می‌شود. اگر جای خاصی را می‌خواهی، از فهرست «جاذبه‌های واقعی {destination}» یا «نزدیک‌ترین جاذبه‌ها» با «افزودن به برنامهٔ سفر» اضافه کن؛ بعد همان لحظه برنامه از فهرست خودت ساخته می‌شود.
              </p>
            )}
          </section>

          <section className="glass print-card mt-6 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black text-white"><WalletCards className="h-5 w-5 text-emerald-300" />داشبورد تحلیل بودجه</h2>
              <span className="text-xs text-slate-400">{formatNumber(spentPercent)}٪ بودجه تخصیص یافته</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-gradient-to-l from-emerald-400 via-cyan-400 to-cyan-400" animate={{ width: `${Math.min(spentPercent, 100)}%` }} />
            </div>
            {/* بلیت و شب‌های اقامت — the two real clocks of the trip. */}
            <div className="mt-4 space-y-1.5" aria-label="هم‌خوانی بلیت و اقامت">
              {timing.issues.map((issue) => (
                <div
                  key={issue.title}
                  className={`rounded-xl border px-3 py-2 text-[10px] leading-6 ${
                    issue.tone === "problem"
                      ? "border-rose-400/30 bg-rose-400/[0.08] text-rose-100"
                      : issue.tone === "warn"
                        ? "border-amber-300/25 bg-amber-300/[0.07] text-amber-100"
                        : "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-100"
                  }`}
                >
                  <b className="block text-[10.5px] font-black">{issue.title}</b>
                  {issue.body}
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                { label: "حمل‌ونقل", value: plan.budgetAnalysis.transport, icon: CarFront, color: "bg-sky-400" },
                { label: "اقامت", value: plan.budgetAnalysis.accommodation, icon: BedDouble, color: "bg-cyan-400" },
                { label: "غذا", value: plan.budgetAnalysis.food, icon: Utensils, color: "bg-cyan-400" },
                { label: "تفریح", value: plan.budgetAnalysis.activities, icon: Camera, color: "bg-rose-400" },
                { label: "رفت‌وآمد شهری", value: plan.budgetAnalysis.localTransport || 0, icon: Route, color: "bg-sky-400" },
                { label: "باقی‌مانده", value: plan.budgetAnalysis.remaining, icon: WalletCards, color: "bg-emerald-400" },
              ].map((item) => {
                const Icon = item.icon;
                const width = Math.min((item.value / Math.max(plan.budgetAnalysis.totalBudget, 1)) * 100, 100);
                return (
                  <div key={item.label} className="glass-soft p-4">
                    <div className="flex items-center justify-between"><span className="text-[11px] text-slate-400">{item.label}</span><Icon className="h-4 w-4 text-slate-500" /></div>
                    <b className="mt-2 block text-sm font-black text-white">{formatCompact(item.value)}</b>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} /></div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3 text-xs leading-6 text-slate-300">{plan.budgetAnalysis.summary} مجموع تخمین: {formatToman(totalSpent)}.</p>
            <div className="mt-4">
              <TripCostTable breakdown={costTable} title="جدول هزینهٔ سفر (همان جدول همهٔ صفحه‌ها)" footnote={costTableFootnote(costTable)} />
            </div>
          </section>

          {/* ------------------------------------------- change one thing only */}
          <section className="glass print:hidden mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="تغییر انتخاب‌ها">
            <p className="text-[11px] leading-6 text-slate-400">
              چیزی را که می‌خواهی عوض کن — فقط همان بخش دوباره انتخاب می‌شود و بقیهٔ سفر دست‌نخورده می‌ماند.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/transport?change=ticket" className="btn-ghost !py-2.5 text-[11px]">
                <Route className="h-3.5 w-3.5" />
                تغییر بلیت
              </Link>
              <Link href="/accommodation?change=stay" className="btn-ghost !py-2.5 text-[11px]">
                <BedDouble className="h-3.5 w-3.5" />
                تغییر اقامتگاه
              </Link>
              <Link href="/start/cities" className="btn-ghost !py-2.5 text-[11px]">
                <MapPin className="h-3.5 w-3.5" />
                تغییر مبدأ و مقصد
              </Link>
            </div>
          </section>

          {accommodationDetails.status === "selected" && typeof accommodationDetails.name === "string" && (
            <section className="glass print-card mt-6 p-5 sm:p-7" aria-label="اقامت انتخاب‌شده">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3"><BedDouble className="h-5 w-5 text-cyan-300" /><h2 className="text-xl font-black text-white">اقامت انتخاب‌شده برای این سفر</h2>{typeof accommodationDetails.provider === "string" && <ProviderBadge provider={accommodationDetails.provider as AccommodationProvider} />}</div>
                  <h3 className="mt-4 text-lg font-black text-white">{accommodationDetails.name}</h3>
                  <p className="mt-2 text-xs leading-7 text-slate-400">
                    {typeof accommodationDetails.checkIn === "string" && typeof accommodationDetails.checkOut === "string" ? `${formatJalaliDate(accommodationDetails.checkIn)} تا ${formatJalaliDate(accommodationDetails.checkOut)} · ` : ""}
                    {formatNumber(Number(accommodationDetails.nights) || 0)} شب · {formatNumber(Number(accommodationDetails.adults) || 0)} بزرگسال{Number(accommodationDetails.children) ? ` · ${formatNumber(Number(accommodationDetails.children))} کودک` : ""}{Number(accommodationDetails.infants) ? ` · ${formatNumber(Number(accommodationDetails.infants))} نوزاد` : ""}
                  </p>
                  {typeof accommodationDetails.priceNote === "string" && <p className="mt-3 rounded-xl bg-white/[0.035] p-3 text-[11px] leading-6 text-slate-400">{accommodationDetails.priceNote}</p>}
                </div>
                <div className="shrink-0 sm:text-left"><span className="block text-[10px] text-slate-500">قیمت ثبت‌شده در برنامه</span><b className="mt-2 block text-xl font-black text-cyan-200">{formatToman(Number(accommodationDetails.cost) || 0)}</b></div>
              </div>
              {typeof accommodationDetails.bookingUrl === "string" && accommodationDetails.bookingUrl && <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-[10px] leading-6 text-slate-500">{typeof accommodationDetails.bookingNote === "string" ? accommodationDetails.bookingNote : "لینک همان اقامتگاه در منبع انتخاب‌شده است؛ جزئیات نهایی را پیش از پرداخت کنترل کنید."}</p><a href={accommodationDetails.bookingUrl} target="_blank" rel="noreferrer noopener" className="btn-ghost shrink-0 !py-2.5 text-xs">رزرو همان اقامتگاه<ExternalLink className="h-3.5 w-3.5" /></a></div>}
            </section>
          )}

          {stayCityMismatch && (
            <section className="glass print-card mt-6 border border-amber-300/25 p-5" aria-label="هشدار ناسازگاری مقصد و اقامتگاه">
              <h2 className="flex items-center gap-2 text-sm font-black text-amber-200">
                <MapPin className="h-4 w-4" />
                اقامتگاه انتخابی در «{stayCity}» است، ولی مقصد این برنامه «{destination}» است
              </h2>
              <p className="mt-2 text-[11px] leading-6 text-slate-300">
                برای اینکه هیچ فاصله‌ای اشتباه گفته نشود، سفرینو در این حالت فاصلهٔ اقامتگاه تا جاذبه‌ها را حساب نمی‌کند؛ چون اقامتگاه و جاذبه‌ها در دو شهر مختلف‌اند.
                یا مقصد برنامه را به «{stayCity}» تغییر بده، یا اقامتگاه را از شهر «{destination}» انتخاب کن تا فاصله و زمان رانندگی درست نمایش داده شود.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/accommodation" className="btn-ghost !py-2.5 text-xs">تغییر اقامتگاه</Link>
              </div>
            </section>
          )}

          {canMeasureFromStay && (
            <section className="glass print-card mt-6 p-5 sm:p-7" aria-label="جاذبه‌های نزدیک اقامتگاه انتخابی">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-xl font-black text-white"><MapPin className="h-5 w-5 text-cyan-300" />نزدیک‌ترین جاذبه‌ها به اقامتگاه شما</h2>
                <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">{distanceLoading ? "در حال محاسبهٔ فاصله…" : distanceMeta?.engineLabel ? `فاصله و زمان رانندگی: ${distanceMeta.engineLabel}` : "در انتظار محاسبهٔ فاصله"}</span>
              </div>
              {nearestPois.length ? (
                <ol className="mt-4 space-y-2.5">
                  {nearestPois.map((poi, index) => (
                    <li key={poi.id} className="glass-soft flex flex-wrap items-center justify-between gap-3 p-3 transition hover:bg-white/[0.07]">
                      <a href={poi.wikipediaUrl || poi.sourceUrl} target="_blank" rel="noreferrer noopener" className="group flex min-w-0 flex-1 items-center gap-3">
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900/70">
                          {poi.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={poi.imageUrl}
                              alt={poi.imageKind === "map" ? `نقشهٔ موقعیت ${poi.name}` : poi.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="grid h-full w-full place-items-center rounded-full bg-cyan-400/15 text-[11px] font-black text-cyan-200">{formatNumber(index + 1)}</span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <b className="block truncate text-xs font-extrabold text-white">{poi.name}</b>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                            <span className="rounded-md bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200">{poi.category}</span>
                            <span className="rounded-lg border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-cyan-100">{formatKm(poi.fromStayKm as number)} کیلومتر</span>
                            {typeof poi.fromStayMinutes === "number" && <span>≈ {formatNumber(poi.fromStayMinutes)} دقیقه</span>}
                          </span>
                        </span>
                      </a>
                      <button
                        type="button"
                        onClick={() => openNeshanNavigation({ latitude: stayLatitude, longitude: stayLongitude }, { latitude: poi.latitude, longitude: poi.longitude })}
                        className="flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1.5 text-[10px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/20"
                        aria-label={`مسیریابی با نشان تا ${poi.name}`}
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        مسیریابی
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          toggleChosen({
                            id: poi.id,
                            name: poi.name,
                            category: poi.category,
                            latitude: poi.latitude,
                            longitude: poi.longitude,
                            distanceKm: typeof poi.fromStayKm === "number" ? poi.fromStayKm : poi.distanceKm,
                            wikipediaUrl: poi.wikipediaUrl,
                            sourceUrl: poi.sourceUrl,
                            description: poi.description,
                          })
                        }
                        aria-pressed={chosenIds.has(poi.id)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-extrabold transition ${
                          chosenIds.has(poi.id)
                            ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                            : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                        aria-label={`${chosenIds.has(poi.id) ? "حذف" : "افزودن"} ${poi.name} ${chosenIds.has(poi.id) ? "از" : "به"} برنامهٔ سفر`}
                      >
                        {chosenIds.has(poi.id) ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                        {chosenIds.has(poi.id) ? "در برنامه" : "افزودن"}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3 text-[11px] leading-6 text-slate-300">
                  {distanceLoading ? "در حال محاسبهٔ فاصله تا اقامتگاه انتخابی…" : distanceMeta?.note || "برای این اقامتگاه جاذبهٔ نزدیکی با اطلاعات کافی پیدا نشد؛ هیچ فاصله‌ای حدس زده نمی‌شود."}
                </p>
              )}
              <p className="mt-3 text-[10px] leading-6 text-slate-500">
                {distanceMeta?.note || "فاصله‌ها از مختصات واقعی اقامتگاه انتخابی و مختصات منتشرشدهٔ هر جاذبه محاسبه می‌شود."}
                {distanceMeta && !distanceMeta.neshanConfigured ? " فاصله‌های این بخش با OpenStreetMap گرفته شده است." : ""}
              </p>
              <div className="mt-4">
  
              </div>
            </section>
          )}

          <section className="glass print-card mt-6 p-5 sm:p-7" aria-label="جاذبه‌های واقعی مقصد">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black text-white"><MapPin className="h-5 w-5 text-cyan-300" />جاذبه‌های واقعی {destination}</h2>
              <span className="text-[10px] text-slate-500">
                {poiLoading ? "در حال خواندن منابع…" : `${formatNumber(poiData?.pois.length ?? 0)} جاذبه · ${formatNumber(poiData?.poisWithArticle ?? 0)} دارای مقالهٔ ویکی‌پدیا`}
              </span>
            </div>
            {poiData?.pois.length ? (
              <PlaceToolbar
                places={cardPlaces}
                options={placeFilters}
                onChange={setPlaceFilters}
                total={cardPlaces.length}
                shown={visiblePlaces.length}
                favoriteCount={favoriteList.filter((id) => cardPlaces.some((place) => place.id === id)).length}
              />
            ) : null}
            {poiData?.pois.length && !visiblePlaces.length ? (
              <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] leading-6 text-amber-100">
                با این جست‌وجو و فیلترها مکانی پیدا نشد. یکی از فیلترها را بردارید یا نام دیگری امتحان کنید.
              </p>
            ) : null}
            {poiData?.pois.length ? (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {enrichedPois.filter((poi) => visibleIds.has(poi.id)).map((poi, index) => (
                  <PlaceCard
                    key={poi.id}
                    rank={index + 1}
                    place={{
                      id: poi.id,
                      name: poi.name,
                      category: poi.category,
                      latitude: poi.latitude,
                      longitude: poi.longitude,
                      distanceKm: typeof poi.fromStayKm === "number" ? poi.fromStayKm : poi.distanceKm,
                      durationMinutes: typeof poi.fromStayMinutes === "number" ? poi.fromStayMinutes : null,
                      distanceEngine: typeof poi.fromStayKm === "number" ? distanceMeta?.engineLabel || "" : "از مرکز شهر",
                      sourceLabel: poi.source === "wikidata" ? "ویکی‌داده" : poi.source === "wikipedia" ? "ویکی‌پدیای فارسی" : "OpenStreetMap",
                      sourceUrl: poi.sourceUrl,
                      wikipediaUrl: poi.wikipediaUrl,
                      imageUrl: poi.imageUrl ?? null,
                      imageKind: poi.imageKind ?? "none",
                      imageLabel: poi.imageLabel,
                      imageCreditUrl: poi.imageCreditUrl ?? null,
                      description: poi.description,
                    } satisfies PlaceCardData}
                    origin={canMeasureFromStay ? { latitude: stayLatitude, longitude: stayLongitude } : null}
                    originLabel="اقامتگاه انتخاب‌شده"
                    addedToPlan={chosenIds.has(poi.id)}
                    onAddToPlan={() =>
                      toggleChosen({
                        id: poi.id,
                        name: poi.name,
                        category: poi.category,
                        latitude: poi.latitude,
                        longitude: poi.longitude,
                        distanceKm: typeof poi.fromStayKm === "number" ? poi.fromStayKm : poi.distanceKm,
                        wikipediaUrl: poi.wikipediaUrl,
                        sourceUrl: poi.sourceUrl,
                        description: poi.description,
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3 text-[11px] leading-6 text-slate-300">
                {poiLoading ? "در حال خواندن جاذبه‌ها از منابع عمومی…" : poiData?.note || "برای این مقصد جاذبهٔ تأییدشده‌ای پیدا نشد؛ هیچ جاذبهٔ ساختگی نمایش داده نمی‌شود."}
              </p>
            )}
            {poiData && <p className="mt-3 text-[10px] leading-6 text-slate-500">{poiData.note} منابع: ویکی‌پدیا {poiData.sources.wikipedia === "ok" ? "✅" : "—"} · ویکی‌داده {poiData.sources.wikidata === "ok" ? "✅" : "—"} · OpenStreetMap {poiData.sources.openstreetmap === "ok" ? "✅" : "—"}</p>}
          </section>

          <div className="mt-6 flex flex-col items-center gap-3 print:hidden">
            <Link href="/itinerary" className="btn-ghost w-full max-w-xl !py-3.5 text-sm">
              <Route className="h-4 w-4" />
              ساخت برنامهٔ روزبه‌روز و نسخهٔ PDF
            </Link>
            <button type="button" onClick={() => void regenerate()} disabled={loading || !origin.trim() || !destination.trim()} className="btn-primary w-full max-w-xl !py-4 text-sm disabled:cursor-wait disabled:opacity-60">
              {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              {loading ? "در حال ساخت برنامه…" : "بازسازی هوشمند برنامه"}
            </button>
            <p role="status" className={`text-center text-[11px] leading-6 ${noticeTone === "success" ? "text-emerald-300" : noticeTone === "warning" ? "text-cyan-300" : "text-slate-400"}`}>{notice}</p>
          </div>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><span className="chip print:hidden">تایم‌لاین زنده</span><h2 className="mt-3 text-2xl font-black text-white">برنامه ساعت‌به‌ساعت سفر</h2></div>
              <span className="text-xs text-slate-500">{formatNumber(plan.days.length)} روز برنامه‌ریزی‌شده</span>
            </div>

            {curateLoading ? (
              <AgentDebate
                input={{
                  destination,
                  budgetMillions: Number(travelData.budget) || 0,
                  days: dayCount,
                  travellers: peopleCount,
                  children: Number(travelData.children) || 0,
                  transportToman: 0,
                  stayToman: 0,
                  mode: String((travelData.transport as Record<string, unknown> | null)?.vehicleId || travelData.preferredMode || ""),
                  placeCount: (chosenPois.length ? chosenPois : suggestionPool).length,
                }}
              />
            ) : null}
            <div className="mt-4 print:hidden">
              <ArchetypeCard
                moods={taste.moods}
                budgetMillions={Number(travelData.budget) || 0}
                people={peopleCount}
                days={dayCount}
                children={Number(travelData.children) || 0}
                mode={String((travelData.transport as Record<string, unknown> | null)?.vehicleId || travelData.preferredMode || "")}
              />
            </div>

            <div
              className={`mt-4 flex flex-col gap-3 rounded-2xl border p-3.5 print:hidden sm:flex-row sm:items-center sm:justify-between ${
                scheduleSource === "mine"
                  ? "border-emerald-400/25 bg-emerald-400/[0.06]"
                  : "border-cyan-400/20 bg-cyan-400/[0.05]"
              }`}
              aria-label="منبع برنامه"
            >
              <div className="flex items-start gap-2.5">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${scheduleSource === "mine" ? "bg-emerald-400/15 text-emerald-300" : "bg-cyan-400/15 text-cyan-200"}`}>
                  {scheduleSource === "mine" ? <Check className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                </span>
                <div>
                  <b className="block text-[12px] font-black text-white">
                    {scheduleSource === "mine"
                      ? `این برنامه دقیقاً از ${formatNumber(chosenPois.length)} جاذبه‌ای است که خودت انتخاب کردی`
                      : scheduleSource === "taste"
                        ? "این برنامه پیشنهاد سفرینو بر اساس سلیقهٔ توست"
                        : scheduleSource === "ai"
                          ? "این برنامه با هوش مصنوعی از انتخاب‌های تو ساخته شد"
                          : "برنامهٔ روزها"}
                  </b>
                  <span className="mt-0.5 block text-[10px] leading-5 text-slate-400">
                    {scheduleSource === "mine"
                      ? "ترتیب از نزدیک‌ترین به اقامتگاه، با ساعت واقعی رسیدن بلیت؛ اگر مکانی را اضافه یا حذف کنی، همین برنامه با فهرست تازه دوباره چیده می‌شود."
                      : `سلیقهٔ خوانده‌شده: ${taste.moods.length ? taste.moods.join("، ") : "طبیعت و تاریخ"} — هر مکانی که خودت اضافه کنی جای پیشنهاد را می‌گیرد.`}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button type="button" onClick={suggestMyself} className="btn-ghost !px-3.5 !py-2 text-[10.5px]">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {chosenPois.length ? "چیدن دوباره از انتخاب‌های من" : "چیدن پیشنهاد سلیقه‌ای"}
                </button>
                <button
                  type="button"
                  onClick={() => void runCurate()}
                  disabled={curateLoading || (!chosenPois.length && !suggestionPool.length)}
                  className="btn-primary !px-3.5 !py-2 text-[10.5px] disabled:cursor-wait disabled:opacity-60"
                >
                  {curateLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {curateLoading ? "در حال چیدن هوشمند…" : "چیدن هوشمند با AI"}
                </button>
                {chosenPois.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      const places = suggestionPool.length ? suggestionPool : enrichedPois;
                      if (!places.length) return;
                      setPlan((current) => ({ ...current, days: slotDays({ destination, days: dayCount, places, arrivalTime, transferMinutes: arrivalTransfer?.minutes ?? null, transferKm: arrivalTransfer?.distanceKm ?? null, origin }) }));
                      setActiveDay(0);
                      setScheduleSource("taste");
                      setNoticeTone("info");
                      setNotice("پیشنهاد سلیقه‌ای نشان داده شد؛ با «چیدن دوباره از انتخاب‌های من» به فهرست خودت برمی‌گردی.");
                    }}
                    className="btn-ghost !px-3.5 !py-2 text-[10.5px]"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    پیشنهاد سلیقه‌ای هم ببینم
                  </button>
                ) : null}
              </div>
            </div>
            {curationNote ? (
              <p className="mt-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] px-3 py-2 text-[10px] leading-6 text-cyan-100/90">
                <Sparkles className="ml-1 inline h-3 w-3" />
                منطق این چیدمان: {curationNote}
              </p>
            ) : null}
            <div className="mt-5 flex gap-2 overflow-x-auto pb-2 print:hidden">
              {plan.days.map((day, index) => (
                <button key={day.day} type="button" onClick={() => setActiveDay(index)} className={`shrink-0 rounded-xl border px-5 py-2.5 text-xs font-bold transition ${activeDay === index ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-200" : "border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}>روز {formatNumber(day.day)}</button>
              ))}
            </div>

            <div className="glass mt-4 p-4 print:hidden">
              <p className="flex items-center gap-1.5 text-[11px] font-black text-white">
                <Clock3 className="h-3.5 w-3.5 text-cyan-300" />
                طرح‌وارهٔ روز {formatNumber(selectedDay?.day ?? 1)}
              </p>
              <TimelineSchematic steps={daySteps} />

              <CrisisPlanCard
                destination={destination}
                startDate={travelData.departureDate || undefined}
                days={plan.days.map((day) => ({
                  day: day.day,
                  title: day.title,
                  stops: day.items
                    .filter((item) => item.type === "sightseeing" || item.type === "food")
                    .map((item) => ({ time: item.time, title: item.title, type: item.type, category: item.poiCategory || null })),
                }))}
                places={(nearestPois.length ? nearestPois : enrichedPois).map((poi) => ({
                  id: poi.id,
                  name: poi.name,
                  category: poi.category,
                  km: typeof poi.fromStayKm === "number" ? poi.fromStayKm : poi.distanceKm,
                }))}
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={selectedDay?.day ?? 0} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="glass print-card mt-4 p-5 sm:p-7 print:hidden">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-black text-white">{selectedDay?.title}</h3>
                  <button
                    type="button"
                    onClick={() => void runGuide()}
                    disabled={guideLoading}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9.5px] font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-60 print:hidden"
                  >
                    {guideLoading ? <LoaderCircle className="ml-1 inline h-3 w-3 animate-spin" /> : <Sparkles className="ml-1 inline h-3 w-3" />}
                    راهنمای روز را دوباره بنویس
                  </button>
                </div>

                {guides[selectedDay?.day ?? 0] ? (
                  <div className="mt-3 rounded-2xl border border-turquoise-400/20 bg-gradient-to-l from-turquoise-400/[0.09] to-transparent p-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="grid h-6 w-6 place-items-center rounded-lg bg-turquoise-400/15 text-turquoise-200"><Sparkles className="h-3.5 w-3.5" /></span>
                      <b className="text-[10.5px] font-black text-turquoise-100">
                        راهنمای {guideSource === "ai" ? "سفرینو (نوشتهٔ هوش مصنوعی)" : "سفرینو"}
                      </b>
                    </div>
                    <p className="mt-2 text-[11.5px] leading-7 text-slate-200">{guides[selectedDay?.day ?? 0].text}</p>
                    {guides[selectedDay?.day ?? 0].tip ? (
                      <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-6 text-amber-100/90">
                        <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                        {guides[selectedDay?.day ?? 0].tip}
                      </p>
                    ) : null}
                  </div>
                ) : guideLoading ? (
                  <div className="mt-3 h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
                ) : null}
                <div className="relative mt-6 space-y-4 before:absolute before:right-[23px] before:top-4 before:h-[calc(100%-32px)] before:w-px before:bg-white/10 sm:before:right-[27px]">
                  {selectedDay?.items.map((item, index) => {
                    const style = ACTIVITY_STYLES[item.type] ?? ACTIVITY_STYLES.activity;
                    const Icon = style.icon;
                    return (
                      <motion.article key={`${item.time}-${index}`} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="relative flex gap-4">
                        <span className={`relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${style.tone}`}><Icon className="h-5 w-5" /></span>
                        <div className="glass-soft flex-1 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs font-black text-cyan-200"><Clock3 className="h-3.5 w-3.5" />{item.time}</span><span className="text-[10px] text-slate-500">{style.label}</span></div>
                          <h4 className="mt-2 text-sm font-extrabold text-white">{item.title}</h4>
                          <p className="mt-1.5 text-xs leading-6 text-slate-400">{item.description}</p>
                          {item.poiId && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                              {item.poiCategory && <span className="rounded-md bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200">{item.poiCategory}</span>}
                              {typeof item.poiDistanceKm === "number" && <span>{formatNumber(item.poiDistanceKm)} کیلومتر از مرکز</span>}
                              {item.poiSourceUrl && <a href={item.poiSourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-slate-400 underline decoration-dotted hover:text-cyan-200">منبع اطلاعات<ExternalLink className="h-3 w-3" /></a>}
                            </div>
                          )}
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </section>

          <section className="print-only mt-8 hidden" aria-label="برنامه کامل چاپ">
            <h2 className="text-2xl font-black text-white">برنامه کامل روزها</h2>
            {plan.days.map((day) => (
              <div key={`print-${day.day}`} className="print-card mt-4 rounded-xl border border-white/10 p-4">
                <h3 className="text-base font-black">{day.title}</h3>
                <ul className="mt-2 space-y-1.5">
                  {day.items.map((item, index) => (
                    <li key={`print-${day.day}-${index}`} className="text-[11px] leading-6">
                      <b>{item.time}</b> · {item.title}{item.poiId ? " (جاذبهٔ تأییدشده در منبع عمومی)" : ""}{item.description && !item.description.startsWith(item.title) ? ` — ${item.description}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="glass print-card mt-8 p-5 sm:p-7">
            <h2 className="flex items-center gap-2 text-xl font-black text-white"><Lightbulb className="h-5 w-5 text-cyan-300" />توصیه‌های هوشمند AI</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="glass-soft p-5"><CloudSun className="h-5 w-5 text-sky-300" /><h3 className="mt-3 text-sm font-bold text-white">آب‌وهوا</h3><p className="mt-2 text-xs leading-7 text-slate-400">{plan.recommendations.weather}</p></div>
              <div className="glass-soft p-5"><Shirt className="h-5 w-5 text-cyan-300" /><h3 className="mt-3 text-sm font-bold text-white">لباس مناسب</h3><p className="mt-2 text-xs leading-7 text-slate-400">{plan.recommendations.clothing}</p></div>
              <div className="glass-soft p-5"><Utensils className="h-5 w-5 text-cyan-300" /><h3 className="mt-3 text-sm font-bold text-white">رستوران و غذای مقصد</h3><ul className="mt-2 space-y-2">{plan.recommendations.restaurants.map((item) => <li key={item} className="flex gap-2 text-xs leading-6 text-slate-400"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-300" />{item}</li>)}</ul></div>
              <div className="glass-soft p-5"><WalletCards className="h-5 w-5 text-emerald-300" /><h3 className="mt-3 text-sm font-bold text-white">کاهش هزینه‌ها</h3><ul className="mt-2 space-y-2">{plan.recommendations.costSaving.map((item) => <li key={item} className="flex gap-2 text-xs leading-6 text-slate-400"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-300" />{item}</li>)}</ul></div>
            </div>
          </section>

          <section className="mt-8 flex flex-col justify-center gap-3 print:hidden sm:flex-row">
            <button type="button" onClick={() => window.print()} className="btn-primary"><Download className="h-5 w-5" />چاپ و دانلود PDF</button>
            <button type="button" onClick={sharePlan} className="btn-ghost"><Share2 className="h-5 w-5" />اشتراک‌گذاری با همراهان</button>
          </section>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-[10px] leading-6 text-slate-600 print:hidden"><MapPin className="h-3.5 w-3.5" />برای ذخیره PDF، در پنجره چاپ گزینه Save as PDF را انتخاب کنید.</p>
        </div>
      </main>
    </MotionConfig>
  );
}
