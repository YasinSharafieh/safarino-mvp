"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import CompanionAdvice from "@/components/CompanionAdvice";
import PriceWatch, { type PriceTrendView } from "@/components/PriceWatch";
import {
  Bus,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  Info,
  LoaderCircle,
  Plane,
  Search,
  SlidersHorizontal,
  TrainFront,
  Users,
  X,
} from "lucide-react";
import ProviderLogo from "@/components/ProviderLogo";
import SourceLogo from "@/components/SourceLogo";
import ProviderTag, { AlsoAvailable } from "@/components/transport/ProviderTag";
import { useTravel } from "@/app/context/TravelContext";
import { bestForBudget, estimateBudget } from "@/lib/budget-fit";
import { resolveIranianCity, transportCityCode } from "@/lib/iran-cities";
import { addDaysToIso, formatJalaliDate, formatProviderDateTime, todayIso } from "@/lib/jalali";

export type TicketMode = "plane" | "train" | "bus";

export type LiveOffer = {
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
  /** The operator's own facts and stations, straight from the provider response. */
  amenities?: string[];
  companyName?: string;
  originStation?: string;
  destinationStation?: string;
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

type SearchResponse = {
  success: boolean;
  priceTrend?: {
    latest: { at: string; priceToman: number; offers: number };
    baseline: { at: string; priceToman: number; offers: number };
    deltaToman: number;
    deltaPct: number;
    direction: "down" | "up" | "flat";
    message: string;
    readings: number;
  } | null;
  error?: string;
  fetchedAt?: string;
  offers?: LiveOffer[];
  returningOffers?: LiveOffer[];
  duplicateCount?: number;
  providerStatuses?: ProviderStatus[];
};

export type TicketSelection = {
  mode: TicketMode;
  total: number;
  unitPrice: number;
  offerId: string;
  offerTitle: string;
  provider: string;
  providerLabel: string;
  bookingUrl?: string;
  fetchedAt?: string;
};

type Props = {
  mode: TicketMode;
  roundTrip: boolean;
  active: boolean;
  selectedId?: string;
  /** Opens the trip calendar above, so an empty date can be fixed in place. */
  onFixDate?: () => void;
  onSelect: (selection: TicketSelection) => void;
  onCheapestChange: (mode: TicketMode, unitPrice: number | null) => void;
  /**
   * Real per-day availability for this route, party and mode. The calendar above
   * uses it to mark the days that actually have a ticket — a price, or `null`
   * when the provider answered with nothing.
   */
  onAvailability?: (map: Record<string, number | null>) => void;
};

const fa = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${fa.format(Math.round(value))} تومان`;
const PROVIDER_LABELS: Record<string, string> = { alibaba: "علی‌بابا", safar724: "سفر۷۲۴" };
const PROVIDER_MARKS: Record<string, string> = { alibaba: "ع", safar724: "۷۲۴" };

const MODE_COPY: Record<TicketMode, { title: string; unit: string; emoji: string; Icon: typeof Plane }> = {
  plane: { title: "بلیت هواپیما", unit: "هر بزرگسال", emoji: "✈️", Icon: Plane },
  train: { title: "بلیت قطار", unit: "هر بزرگسال", emoji: "🚂", Icon: TrainFront },
  bus: { title: "بلیت اتوبوس", unit: "هر بزرگسال", emoji: "🚌", Icon: Bus },
};

type SortKey = "cheapest" | "earliest" | "latest" | "seats";

/**
 * Measured availability, remembered for the session.
 *
 * The sweep costs thirty real provider searches; the answer is identical for
 * every panel of the same route, mode and party. Keeping it in a module-level
 * map means switching between the plane, train and bus lists (or leaving the
 * page and coming back) shows the same measured days immediately, instead of
 * crawling again and risking a rate-limited, thinner answer.
 */
const AVAILABILITY_TTL_MS = 10 * 60_000;
const AVAILABILITY_MEMORY = new Map<
  string,
  { at: number; map: Record<string, number | null>; counts: Record<string, number> }
>();

const SORTS: { id: SortKey; label: string }[] = [
  { id: "cheapest", label: "ارزان‌ترین" },
  { id: "earliest", label: "زودترین حرکت" },
  { id: "latest", label: "دیرترین حرکت" },
  { id: "seats", label: "بیشترین صندلی" },
];

/** «۷ ساعت و ۲۰ دقیقه» — measured from the two times the provider gave. */
function journeyLength(departure: string, arrival: string | null): string {
  if (!departure || !arrival) return "";
  const from = Date.parse(departure);
  const to = Date.parse(arrival);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return "";
  const minutes = Math.round((to - from) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${fa.format(rest)} دقیقه`;
  return rest ? `${fa.format(hours)} ساعت و ${fa.format(rest)} دقیقه` : `${fa.format(hours)} ساعت`;
}

/**
 * The chips under a ticket.
 *
 * A row used to print every fact as one long sentence, so «کوپهٔ ۴ نفره» and
 * «غذای رایگان» and «۱۴٪ تخفیف» became a paragraph nobody reads. The chips are
 * grouped by what they are about — the service, the comfort, the money — and
 * each keeps the provider's own words. Nothing is added: an empty group simply
 * does not render.
 */
const FACT_TONES: { test: RegExp; tone: string }[] = [
  { test: /تخفیف|٪/, tone: "border-rose-400/30 bg-rose-400/10 text-rose-100" },
  { test: /استرداد|کنسل/, tone: "border-amber-400/25 bg-amber-400/10 text-amber-100" },
  { test: /کوپه|صندلی|کلاس|درجه|ستاره|VIP|تخت/, tone: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100" },
  { test: /غذا|پذیرایی/, tone: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" },
  { test: /ایستگاه|ترمینال|پایانه|استان/, tone: "border-white/15 bg-white/[0.06] text-slate-200" },
];

const factTone = (fact: string) => FACT_TONES.find((entry) => entry.test.test(fact))?.tone || "border-white/10 bg-white/[0.04] text-slate-300";

const normalise = (value: string) =>
  value.toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ");

/**
 * Live tickets for one mode.
 *
 * The panel searched is the mode the traveller chose — nothing else is shown —
 * and the results list has its own search box (company, service, time, source),
 * sorting and a price ceiling, exactly like the accommodation list.
 */
export default function TicketSearch({ mode, roundTrip, active, selectedId, onSelect, onCheapestChange, onFixDate, onAvailability }: Props) {
  const { travelData, setTravelData } = useTravel();
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [priceTrend, setPriceTrend] = useState<PriceTrendView | null>(null);
  const [returnOffers, setReturnOffers] = useState<LiveOffer[]>([]);
  const [activeLeg, setActiveLeg] = useState<"outbound" | "return">("outbound");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("cheapest");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [duplicates, setDuplicates] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [nearbyDates, setNearbyDates] = useState<{ date: string; cheapest: number }[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const autoSearched = useRef(false);
  const lastSearchedDate = useRef<string | null>(null);

  const originCity = resolveIranianCity(travelData.origin);
  const destinationCity = resolveIranianCity(travelData.destination);
  const copy = MODE_COPY[mode];

  const search = useCallback(async () => {
    if (!originCity || !destinationCity || !travelData.departureDate) return;
    setLoading(true);
    setError("");
    setStatuses([]);
    try {
      const response = await fetch("/api/providers/transport/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The panel must always finish: a provider that never answers is a
        // failure to report, not a spinner forever.
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          mode,
          origin: transportCityCode(originCity, mode),
          destination: transportCityCode(destinationCity, mode),
          date: travelData.departureDate,
          returnDate: roundTrip ? travelData.returnDate : undefined,
          adults: travelData.travelers,
          children: travelData.children,
          infants: travelData.infants,
        }),
      });
      const data = (await response.json()) as SearchResponse;
      if (!response.ok || !data.success) throw new Error(data.error || "جست‌وجو انجام نشد");
      const label = (offer: LiveOffer): LiveOffer => {
        const raw = offer as LiveOffer & { operator?: string; serviceLabel?: string };
        const operator =
          (offer.title || "").trim() ||
          (raw.operator || "").trim() ||
          (mode === "plane" ? "پرواز" : mode === "train" ? "قطار" : "اتوبوس");
        const service = (offer.subtitle || raw.serviceLabel || "").trim();
        // The company stays the headline; the service (train number, cabin,
        // bus class) is kept as its own line so nothing is invented.
        return {
          ...offer,
          title: operator,
          subtitle: service && service !== operator ? service : "",
          logoUrl: offer.logoUrl || null,
        };
      };
      const outbound = (data.offers || []).map(label);
      const returning = (data.returningOffers || []).map(label);
      setOffers(outbound);
      setReturnOffers(returning);
      setStatuses(data.providerStatuses || []);
      setDuplicates(data.duplicateCount || 0);
      setFetchedAt(data.fetchedAt || new Date().toISOString());
      setPriceTrend(data.priceTrend || null);
      setActiveLeg("outbound");
      setHasSearched(true);
      setMaxPrice(null);
      const cheapest = outbound.reduce<number | null>((best, offer) => (best === null || offer.priceToman < best ? offer.priceToman : best), null);
      onCheapestChange(mode, cheapest);
      if (!outbound.length) {
        const working = (data.providerStatuses || []).filter((status) => status.status === "ok");
        // Why it can be empty at a far date, said plainly — and never invented.
        const farDate = (Date.parse(`${travelData.departureDate}T00:00:00Z`) - Date.now()) / 86_400_000 > 7;
        setError(
          working.length
            ? mode === "train"
              ? farDate
                ? "برای این تاریخ هنوز قطاری در سیستم فروش نیست؛ بلیت قطار معمولاً نزدیک تاریخ حرکت (حدود یک هفته قبل) باز می‌شود. روزهای نزدیک‌تر را ببین یا برای همین سفر اتوبوس/هواپیما را انتخاب کن."
                : "برای این مسیر و تاریخ قطاری با صندلی خالی پیدا نشد. روزهای نزدیک‌تر را ببین یا اتوبوس/هواپیما را انتخاب کن."
              : "برای این مسیر و تاریخ، بلیتی با صندلی و قیمت پیدا نشد."
            : "هیچ منبعی برای این مسیر پاسخ نداد؛ وضعیت هر منبع پایین‌تر آمده است.",
        );
        // Being empty on one date does not mean the route is dead: check the
        // neighbouring days and offer the ones that do have tickets.
        void findNearbyDates();
      } else {
        setNearbyDates([]);
      }
    } catch (caught) {
      setOffers([]);
      setReturnOffers([]);
      onCheapestChange(mode, null);
      const timedOut = caught instanceof Error && (caught.name === "TimeoutError" || caught.name === "AbortError");
      setError(
        timedOut
          ? "پاسخ منابع بلیت دیر رسید. یک بار دیگر «جست‌وجوی دوباره» را بزنید."
          : caught instanceof Error
            ? caught.message
            : "جست‌وجو انجام نشد",
      );
    } finally {
      setLoading(false);
    }
  }, [destinationCity, mode, onCheapestChange, originCity, roundTrip, travelData.children, travelData.departureDate, travelData.infants, travelData.returnDate, travelData.travelers]);

  // The first time a mode is opened, search it once automatically: the
  // traveller already said they want this mode, so asking them to press
  // «جستجو» again would be one click too many.
  useEffect(() => {
    if (!active || autoSearched.current || !originCity || !destinationCity || !travelData.departureDate) return;
    autoSearched.current = true;
    lastSearchedDate.current = travelData.departureDate;
    void search();
  }, [active, destinationCity, originCity, search, travelData.departureDate]);

  // A date changed from the «nearby dates» list means search again right away.
  useEffect(() => {
    if (!active || !autoSearched.current) return;
    if (lastSearchedDate.current === travelData.departureDate) return;
    const timer = window.setTimeout(() => void search(), 200);
    return () => window.clearTimeout(timer);
    // The date is the only trigger here; the other inputs use the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelData.departureDate]);

  /**
   * Which of the coming days really have a ticket?
   *
   * Ticket windows open in waves: on the live site, trains had nothing today
   * and nothing seven days out, but plenty two days out and again a month
   * later. The old helper looked only seven days around the chosen date, so a
   * traveller whose date was just past the window was told «nothing at all» when
   * a real ticket existed ten days away. Now a month is swept — one real search
   * per day, all in parallel — and the calendar marks the days that answered.
   *
   * The map is keyed by route + mode + party, so switching dates reuses what was
   * already measured instead of asking the providers again.
   */
  const [availability, setAvailability] = useState<Record<string, number | null>>({});
  /** How many real departures the sweep found on each measured day. */
  const [availabilityOffers, setAvailabilityOffers] = useState<Record<string, number>>({});
  /**
   * What this panel has already swept. The component's state is not enough: two
   * panels of the same mode share a route key, and a remount would start the
   * whole thirty-day sweep again. One measurement per route+mode+party is kept
   * here and shown instantly the next time.
   */
  const [availabilityKey, setAvailabilityKey] = useState("");
  const availabilityPlan = useMemo(() => {
    const days: string[] = [];
    const today = todayIso();
    for (let offset = 0; offset < 31; offset += 1) days.push(addDaysToIso(today, offset));
    return days;
  }, []);
  const routeKey = originCity && destinationCity ? `${mode}|${originCity.code}|${destinationCity.code}|${travelData.travelers}|${travelData.children}|${travelData.infants}` : "";

  useEffect(() => {
    /**
     * Only the mode the traveller is actually looking at sweeps the providers.
     * Every mode panel stays mounted, so without this guard a single visit asked
     * علی‌بابا for thirty days × three modes — ninety real searches — and the
     * mode on screen was the one most likely to come back rate-limited and thin.
     * One panel, one sweep: the results a traveller sees are the rich ones.
     */
    if (!active) return;
    if (!routeKey || !availabilityPlan.length || !originCity || !destinationCity) return;
    let cancelled = false;
    const sweepId = `${routeKey}|${mode}`;
    const remembered = AVAILABILITY_MEMORY.get(sweepId);
    if (remembered && Date.now() - remembered.at < AVAILABILITY_TTL_MS) {
      setAvailability(remembered.map);
      setAvailabilityOffers(remembered.counts);
      setAvailabilityKey(routeKey);
      return;
    }
    setAvailabilityKey(routeKey);
    setAvailability({});
    setAvailabilityOffers({});
    void (async () => {
      try {
        /**
         * One request, not thirty: the server measures every day with a real
         * provider search and answers with the days that actually have tickets.
         */
        const query = new URLSearchParams({
          mode,
          origin: transportCityCode(originCity, mode),
          destination: transportCityCode(destinationCity, mode),
          adults: String(travelData.travelers),
          children: String(travelData.children),
          infants: String(travelData.infants),
          availability: "30",
        });
        const response = await fetch(`/api/providers/transport/search?${query.toString()}`, {
          signal: AbortSignal.timeout(45_000),
        });
        const payload = (await response.json()) as { dates?: { date: string; cheapestToman: number | null; offers?: number }[] };
        if (cancelled) return;
        const next: Record<string, number | null> = {};
        const counts: Record<string, number> = {};
        for (const row of payload.dates || []) {
          next[row.date] = row.cheapestToman ?? null;
          counts[row.date] = Number(row.offers) || 0;
        }
        setAvailability(next);
        setAvailabilityOffers(counts);
        if (Object.keys(next).length) {
          AVAILABILITY_MEMORY.set(sweepId, { at: Date.now(), map: next, counts });
        }
      } catch {
        // A failed sweep only means the calendar shows no markers; nothing else breaks.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, active]);

  /** The calendar above the list marks the same real days this search measured. */
  useEffect(() => {
    if (!onAvailability) return;
    onAvailability(availability);
  }, [availability, onAvailability]);

  const availableDays = useMemo(
    () => Object.keys(availability).filter((date) => availability[date] !== null).sort(),
    [availability],
  );

  /** Looks at the days around the chosen one and keeps the ones with tickets. */
  const findNearbyDates = useCallback(async () => {
    if (!originCity || !destinationCity || !travelData.departureDate) return;
    setNearbyLoading(true);
    // ±3 weeks around the chosen date, not ±1: that is where the open windows are.
    const offsets = [-21, -14, -10, -7, -3, -1, 1, 3, 7, 10, 14, 21];
    const base = Date.parse(`${travelData.departureDate}T00:00:00Z`);
    const today = todayIso();
    try {
      const results = await Promise.all(
        offsets.map(async (offset) => {
          const date = new Date(base + offset * 86_400_000).toISOString().slice(0, 10);
          if (date < today) return null;
          if (availabilityKey === routeKey && availability[date] !== undefined) {
            return availability[date] === null ? null : { date, cheapest: availability[date] };
          }
          try {
            const response = await fetch("/api/providers/transport/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(20_000),
              body: JSON.stringify({
                mode,
                origin: transportCityCode(originCity, mode),
                destination: transportCityCode(destinationCity, mode),
                date,
                adults: travelData.travelers,
                children: travelData.children,
                infants: travelData.infants,
              }),
            });
            const payload = (await response.json()) as SearchResponse;
            const cheapest = (payload.offers || []).reduce<number | null>(
              (best, offer) => (best === null || offer.priceToman < best ? offer.priceToman : best),
              null,
            );
            return cheapest === null ? null : { date, cheapest };
          } catch {
            return null;
          }
        }),
      );
      const fresh = results.filter((entry): entry is { date: string; cheapest: number } => Boolean(entry));
      // If the chosen date is outside the sweep, the nearest open days still help.
      const withSweep = [...fresh];
      for (const date of availableDays) {
        if (withSweep.length >= 8) break;
        if (withSweep.some((entry) => entry.date === date)) continue;
        if (availability[date] !== null) withSweep.push({ date, cheapest: availability[date] as number });
      }
      setNearbyDates(withSweep.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12));
    } finally {
      setNearbyLoading(false);
    }
  }, [availability, availabilityKey, availableDays, destinationCity, mode, originCity, routeKey, travelData.children, travelData.departureDate, travelData.infants, travelData.travelers]);

  useEffect(() => {
    setNearbyDates([]);
  }, [travelData.departureDate]);

  const legOffers = activeLeg === "return" ? returnOffers : offers;

  /**
   * The real options this list offers, for the companion's advice: one price
   * per option, already for the whole party, so its sentence can compare them
   * with the trip's own money.
   */
  const adviceOptions = legOffers
    .map((offer: LiveOffer) => {
      const total = totalFor(offer);
      if (total === null) return null;
      return {
        id: offer.id,
        title: offer.title,
        priceToman: Math.round(total),
        detail: [offer.title, formatProviderDateTime(offer.departure) || "", offer.seatsLeft ? `${offer.seatsLeft} صندلی` : ""]
          .filter(Boolean)
          .join(" · "),
      };
    })
    .filter((option): option is { id: string; title: string; priceToman: number; detail: string } => Boolean(option));
  const needle = normalise(query.trim());

  const visible = useMemo(() => {
    const filtered = legOffers.filter((offer) => {
      if (maxPrice !== null && offer.priceToman > maxPrice) return false;
      if (!needle) return true;
      const haystack = normalise(
        `${offer.title} ${offer.subtitle} ${(offer.details || []).join(" ")} ${PROVIDER_LABELS[offer.provider || "alibaba"] || ""}`,
      );
      return haystack.includes(needle);
    });
    const sorted = filtered.slice();
    sorted.sort((a, b) => {
      if (sort === "cheapest") return a.priceToman - b.priceToman;
      if (sort === "seats") return (b.seatsLeft ?? 0) - (a.seatsLeft ?? 0);
      const at = Date.parse(a.departure) || 0;
      const bt = Date.parse(b.departure) || 0;
      return sort === "earliest" ? at - bt : bt - at;
    });
    return sorted;
  }, [legOffers, maxPrice, needle, sort]);

  /**
   * Who is actually operating the tickets in this list — one real mark per
   * company, with how many departures it has. On a full train day this is the
   * fastest way to see «رجا، فدک، نورالرضا…» at a glance, and tapping one asks
   * the same search box to narrow to that operator.
   */
  /**
   * The measured ticket board.
   *
   * The 30-day sweep behind the calendar already runs one real provider search
   * per day, so we know exactly which days have a ticket and what the cheapest
   * one costs. That knowledge used to be spent on calendar dots only; here it
   * becomes a row of real days a traveller can jump straight into.
   */
  const boardDays = useMemo(() => {
    const today = todayIso();
    return Object.entries(availability)
      .filter(([date, cheapest]) => cheapest !== null && date >= today)
      .map(([date, cheapest]) => ({ date, cheapest: cheapest as number }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 14)
      .map((day) => ({ ...day, offers: availabilityOffers[day.date] || 0 }));
  }, [availability, availabilityOffers]);

  const operators = useMemo(() => {
    const seen = new Map<string, { name: string; logoUrl: string | null; count: number; cheapest: number }>();
    for (const offer of legOffers) {
      const name = (offer.companyName || offer.title || "").trim();
      if (!name) continue;
      const key = normalise(name);
      const current = seen.get(key);
      if (current) {
        current.count += 1;
        current.cheapest = Math.min(current.cheapest, offer.priceToman);
      } else {
        seen.set(key, { name, logoUrl: offer.logoUrl || null, count: 1, cheapest: offer.priceToman });
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.count - a.count || a.cheapest - b.cheapest);
  }, [legOffers]);

  // The money side of the list: what is left for tickets once the rest of the
  // trip has a realistic share.
  const ticketBudget = useMemo(() => {
    const days = Math.max(1, Math.round(travelData.days || 1));
    const travellers = Math.max(1, travelData.travelers + travelData.children + travelData.infants);
    const stay = Number(travelData.accommodation?.cost) || 0;
    return estimateBudget({
      totalBudget: Math.max(0, travelData.budget * 1_000_000),
      travellers,
      days,
      stay,
    });
  }, [travelData.accommodation, travelData.budget, travelData.children, travelData.days, travelData.infants, travelData.travelers]);

  const recommendation = useMemo(() => {
    const priced = visible
      .map((offer) => ({ id: offer.id, price: totalFor(offer) ?? offer.priceToman, mode }))
      .filter((offer) => Number.isFinite(offer.price));
    return bestForBudget(priced, { remaining: Math.max(0, ticketBudget.remaining) });
  }, [mode, ticketBudget.remaining, visible]);

  const priceCeiling = useMemo(
    () => legOffers.reduce((max, offer) => Math.max(max, offer.priceToman), 0),
    [legOffers],
  );

  /** Switches the trip to another departure date and searches it at once. */
  const searchForDate = useCallback(async (date: string) => {
    setTravelData((current) => ({ ...current, departureDate: date }));
  }, [setTravelData]);

  function totalFor(offer: LiveOffer): number | null {
    if (travelData.children > 0 && !offer.childPriceToman) return null;
    if (travelData.infants > 0 && !offer.infantPriceToman) return null;
    return offer.priceToman * travelData.travelers
      + (offer.childPriceToman || 0) * travelData.children
      + (offer.infantPriceToman || 0) * travelData.infants;
  }

  function choose(offer: LiveOffer) {
    const total = totalFor(offer);
    if (total === null) {
      setError("قیمت دقیق کودک یا نوزاد در پاسخ این منبع نیست؛ برای این بلیت قیمت کل اعلام نمی‌کنیم.");
      return;
    }
    setError("");
    onSelect({
      mode,
      total,
      unitPrice: offer.priceToman,
      offerId: offer.id,
      offerTitle: `${activeLeg === "return" ? "برگشت · " : ""}${offer.title}`,
      provider: offer.provider || "alibaba",
      providerLabel: PROVIDER_LABELS[offer.provider || "alibaba"],
      bookingUrl: offer.bookingUrl,
      fetchedAt: fetchedAt || undefined,
    });
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5 sm:p-6">
        <div>
          <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">
            <copy.Icon className="h-3.5 w-3.5" />
            {copy.title}
          </span>
          <h2 className="mt-2.5 text-lg font-black text-white sm:text-xl">
            {travelData.origin || "مبدأ"} <span className="text-cyan-300">←</span> {travelData.destination || "مقصد"}
          </h2>
          <p className="mt-1 text-[10.5px] leading-6 text-slate-400">
            قیمت، ساعت حرکت و ظرفیت از پاسخ زندهٔ منابع؛ هیچ بلیت تخمینی نمایش داده نمی‌شود.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void search()}
          disabled={loading}
          className="btn-primary !px-4 !py-2.5 text-[11px] disabled:opacity-50"
        >
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {hasSearched ? "جست‌وجوی دوباره" : "جست‌وجوی بلیت"}
        </button>
      </div>

      {statuses.length ? (
        <div className="flex flex-wrap gap-2 border-b border-white/10 bg-white/[0.02] px-5 py-3">
          {statuses.map((status) => (
            <span
              key={status.provider}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-bold ${
                status.status === "ok" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.03] text-slate-400"
              }`}
            >
              <SourceLogo id={status.provider} size={13} rounded />
              <span className={`h-1.5 w-1.5 rounded-full ${status.status === "ok" ? "bg-emerald-300" : "bg-slate-500"}`} />
              {status.label}
              <b className="text-white">{status.status === "ok" ? `${fa.format(status.count)} بلیت` : status.message || "در دسترس نیست"}</b>
            </span>
          ))}
        </div>
      ) : null}

      {roundTrip && (offers.length > 0 || returnOffers.length > 0) ? (
        <div className="flex gap-2 border-b border-white/10 bg-white/[0.02] px-5 py-3">
          <button
            type="button"
            onClick={() => setActiveLeg("outbound")}
            className={`rounded-xl px-3 py-1.5 text-[11px] font-bold ${activeLeg === "outbound" ? "bg-cyan-300 text-slate-950" : "bg-white/5 text-slate-300"}`}
          >
            رفت · {fa.format(offers.length)}
          </button>
          <button
            type="button"
            onClick={() => setActiveLeg("return")}
            className={`rounded-xl px-3 py-1.5 text-[11px] font-bold ${activeLeg === "return" ? "bg-cyan-300 text-slate-950" : "bg-white/5 text-slate-300"}`}
          >
            برگشت · {fa.format(returnOffers.length)}
          </button>
        </div>
      ) : null}

      {boardDays.length ? (
        <div className="border-b border-white/10 bg-white/[0.015] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-400">
              <CalendarDays className="h-3 w-3 text-cyan-300" />
              {mode === "train" ? "روزهایی که واقعاً قطار دارد" : mode === "plane" ? "روزهایی که واقعاً پرواز دارد" : "روزهایی که واقعاً اتوبوس دارد"}
              <span className="text-slate-500">— هر روز با یک جست‌وجوی واقعی اندازه‌گیری شده</span>
            </span>
            <span className="text-[9px] text-slate-500">
              {fa.format(boardDays.length)} روز از {fa.format(Object.keys(availability).length)} روز بررسی‌شده
            </span>
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {boardDays.map((day) => {
              const active = day.date === travelData.departureDate;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => void searchForDate(day.date)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-right transition ${
                    active ? "border-cyan-300/60 bg-cyan-300/15" : "border-white/10 bg-white/[0.04] hover:border-cyan-300/30"
                  }`}
                >
                  <span className={`block text-[9px] font-bold ${active ? "text-cyan-100" : "text-slate-300"}`}>
                    {formatJalaliDate(day.date)}
                  </span>
                  <span className="block text-[9px] font-black text-turquoise-200">{money(day.cheapest)}</span>
                  <span className="block text-[8px] text-slate-500">{fa.format(day.offers)} بلیت</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {operators.length > 1 ? (
        <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9.5px] font-bold text-slate-400">
              {mode === "plane" ? "شرکت‌های هواپیمایی این فهرست" : mode === "train" ? "شرکت‌های ریلی این فهرست" : "شرکت‌های اتوبوسرانی این فهرست"}
            </span>
            {operators.map((operator) => (
              <button
                key={operator.name}
                type="button"
                onClick={() => setQuery(operator.name)}
                title={`${operator.name} — ${fa.format(operator.count)} سرویس، از ${money(operator.cheapest)}`}
                className={`flex items-center gap-1.5 rounded-full border px-1.5 py-1 text-[9px] font-bold transition ${
                  normalise(query.trim()) === normalise(operator.name)
                    ? "border-cyan-300/50 bg-cyan-300/12 text-cyan-100"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/30 hover:text-white"
                }`}
              >
                <span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-white p-0.5">
                  {operator.logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={/^https:\/\/cdn\.alibaba\.ir\/static\/img\/(?:airlines|train|bus)\//.test(operator.logoUrl)
                        ? operator.logoUrl.replace(/^https:\/\/cdn\.alibaba\.ir\/static\/img\/airlines\/[^/]+\//, "/airlines/").replace(/^https:\/\/cdn\.alibaba\.ir\/static\/img\/train\//, "/rail/").replace(/^https:\/\/cdn\.alibaba\.ir\/static\/img\/bus\//, "/bus/")
                        : `/api/provider-assets?src=${encodeURIComponent(operator.logoUrl)}`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  ) : (
                    <copy.Icon className="h-3 w-3 text-slate-600" />
                  )}
                </span>
                {operator.name}
                <span className="text-[8.5px] text-slate-500">{fa.format(operator.count)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {legOffers.length ? (
        <div className="border-b border-white/10 bg-white/[0.015] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`جست‌وجو در ${fa.format(legOffers.length)} بلیت: نام شرکت، نوع قطار، ساعت یا منبع…`}
                aria-label="جست‌وجو در بلیت‌های یافته‌شده"
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-2 pr-9 pl-8 text-[11px] text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="پاک کردن جست‌وجو"
                  className="absolute left-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-slate-300"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {SORTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSort(option.id)}
                  aria-pressed={sort === option.id}
                  className={`rounded-lg border px-2 py-1.5 text-[9.5px] font-bold transition ${
                    sort === option.id ? "border-cyan-300/50 bg-cyan-300/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {priceCeiling > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-3 w-3 text-slate-500" />
              <span className="text-[9.5px] text-slate-400">سقف قیمت هر نفر:</span>
              {[null, Math.round(priceCeiling * 0.5), Math.round(priceCeiling * 0.75)].map((limit, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setMaxPrice(limit)}
                  aria-pressed={maxPrice === limit}
                  className={`rounded-lg border px-2 py-1 text-[9px] font-bold transition ${
                    maxPrice === limit ? "border-cyan-300/50 bg-cyan-300/12 text-cyan-100" : "border-white/10 bg-white/[0.03] text-slate-400"
                  }`}
                >
                  {limit === null ? "همه" : `تا ${money(limit)}`}
                </button>
              ))}
              <span className="mr-auto text-[9.5px] text-slate-500">
                {fa.format(visible.length)} از {fa.format(legOffers.length)} بلیت
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="m-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3 text-[10.5px] leading-6 text-rose-100">{error}</div>
      ) : null}

      {!loading && hasSearched && !legOffers.length ? (
        <div className="mx-4 mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="flex items-center gap-1.5 text-[10.5px] font-black text-cyan-100">
              <CalendarDays className="h-3.5 w-3.5" />
              اصلاح تاریخ سفر
            </b>
            {onFixDate ? (
              <button
                type="button"
                onClick={onFixDate}
                className="rounded-lg border border-cyan-300/40 bg-cyan-300/15 px-2.5 py-1 text-[9.5px] font-bold text-cyan-50 transition hover:bg-cyan-300/25"
              >
                تقویم را باز کن و تاریخ را عوض کن
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-[9.5px] leading-6 text-slate-300">
            {nearbyLoading
              ? "روزهای نزدیک را بررسی می‌کنم؛ تا آن وقت می‌توانی تاریخ را هم عوض کنی."
              : nearbyDates.length
                ? "برای تاریخ انتخابی بلیتی پیدا نشد، ولی این روزها بلیت واقعی دارند؛ یکی را بزن تا همان تاریخ جست‌وجو شود."
                : "برای روزهای نزدیک هم بلیتی پیدا نشد؛ تاریخ یا مسیر دیگری را امتحان کن."}
          </p>
          {nearbyLoading ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[9.5px] text-slate-400">
              <LoaderCircle className="h-3 w-3 animate-spin" />
              در حال بررسی روزهای نزدیک…
            </p>
          ) : nearbyDates.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {nearbyDates.map((entry) => (
                <button
                  key={entry.date}
                  type="button"
                  onClick={() => {
                    setNearbyDates([]);
                    void searchForDate(entry.date);
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[9.5px] font-bold text-white transition hover:border-cyan-300/40 hover:bg-white/10"
                >
                  {formatJalaliDate(entry.date)}
                  <span className="mr-1 text-cyan-300">{money(entry.cheapest)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {loading && !legOffers.length ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : null}

      {!loading && hasSearched && !visible.length && legOffers.length ? (
        <p className="m-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-[10.5px] leading-6 text-slate-400">
          با این جست‌وجو یا سقف قیمت، بلیتی نماند. فیلترها را پاک کنید.
        </p>
      ) : null}

      {!loading && activeLeg === "return" && !returnOffers.length && offers.length ? (
        <p className="m-4 rounded-xl bg-white/5 p-3 text-[10.5px] text-slate-300">برای تاریخ برگشت، بلیتی با قیمت و ظرفیت پیدا نشد.</p>
      ) : null}

      <div className="divide-y divide-white/5">
        {/* همسفر: یک انتخاب واقعی از میان همین بلیت‌ها، با بودجهٔ همین سفر */}
        {priceTrend ? (
          <div className="px-3.5 pt-3">
            <PriceWatch trend={priceTrend} />
          </div>
        ) : null}
        {adviceOptions.length ? (
          <div className="p-3.5">
            <CompanionAdvice
              stage="transport"
              options={adviceOptions}
              ticketToman={0}
              stayToman={Number(travelData.accommodation?.cost) || 0}
              onPick={(id) => {
                const picked = legOffers.find((offer) => offer.id === id);
                if (picked) choose(picked);
              }}
            />
          </div>
        ) : null}
        {recommendation.option ? (
          <div className={`border-b p-3.5 ${recommendation.fits ? "border-emerald-400/20 bg-emerald-400/[0.05]" : "border-turquoise-400/25 bg-turquoise-400/[0.05]"}`}>
            <p className="text-[10.5px] leading-6 text-slate-300">
              <b className="text-emerald-200">پیشنهاد من: </b>
              {recommendation.reason} برای بلیت‌ها حدود {money(Math.max(0, ticketBudget.remaining))} از بودجهٔ {money(ticketBudget.totalBudget)} در نظر گرفته شده؛ بقیهٔ بودجه صرف اقامت، غذا و بازدید می‌شود.
            </p>
          </div>
        ) : null}
        {visible.map((offer, index) => {
          const isSelected = selectedId === offer.id;
          const total = totalFor(offer);
          /**
           * Everything the provider published about this row, in one list: the
           * station it leaves from, the operator's own facilities, then any
           * remaining detail. The subtitle is already on screen, so it is not
           * repeated here.
           */
          const facts = Array.from(
            new Set(
              [
                offer.originStation ? `از ${offer.originStation}` : "",
                ...(offer.amenities?.length ? offer.amenities : []),
                ...(offer.details || []),
              ]
                .map((fact) => (fact || "").trim())
                .filter((fact) => fact && !(offer.subtitle || "").includes(fact) && !offer.title.includes(fact)),
            ),
          );
          /** The live response states how many seats are left; a low number is a real warning. */
          const fewSeats = typeof offer.seatsLeft === "number" && offer.seatsLeft > 0 && offer.seatsLeft <= 8;
          /** An overnight service arrives the next day — say it, do not make the traveller subtract dates. */
          const arrivalDay = (() => {
            if (!offer.arrival) return "";
            const days = Math.round(
              (Date.parse(`${offer.arrival.slice(0, 10)}T00:00:00Z`) - Date.parse(`${offer.departure.slice(0, 10)}T00:00:00Z`)) / 86_400_000,
            );
            return days > 0 ? `${fa.format(days)} روز بعد` : "";
          })();
          return (
            <div key={offer.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-white/[0.02] lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <ProviderLogo src={offer.logoUrl} name={offer.title} mode={mode} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="text-[12.5px] text-white">{offer.title}</b>
                    {sort === "cheapest" && index === 0 ? <span className="badge-turquoise !py-0.5 !text-[8.5px]">ارزان‌ترین</span> : null}
                    {recommendation.option?.id === offer.id ? <span className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2 py-0.5 text-[8.5px] font-black text-emerald-200">بهترین انتخاب برای تو</span> : null}
                    {offer.provider ? <ProviderTag provider={offer.provider} label={PROVIDER_LABELS[offer.provider]} /> : null}
                  </div>
                  {offer.subtitle ? <span className="mt-0.5 block text-[10px] text-slate-400">{offer.subtitle}</span> : null}
                  {facts.length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {facts.map((fact) => (
                        <span
                          key={fact}
                          className={`rounded-full border px-2 py-0.5 text-[9px] font-bold leading-4 ${factTone(fact)}`}
                        >
                          {fact}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {offer.alsoAvailableAt?.length ? <AlsoAvailable items={offer.alsoAvailableAt} money={money} /> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                <div className="text-left">
                  <span className="block text-[9px] text-slate-500">حرکت</span>
                  <b className="block text-[11.5px] leading-6 text-white">{formatProviderDateTime(offer.departure)}</b>
                  {offer.arrival ? (
                    <span className="block text-[9px] text-slate-500">
                      رسیدن: {formatProviderDateTime(offer.arrival)}
                      {arrivalDay ? <span className="text-amber-300/90"> · {arrivalDay}</span> : null}
                    </span>
                  ) : null}
                  {journeyLength(offer.departure, offer.arrival) ? (
                    <span className="mt-0.5 block text-[9px] font-bold text-cyan-300/80">مدت سفر: {journeyLength(offer.departure, offer.arrival)}</span>
                  ) : null}
                </div>
                <div className="text-left">
                  <b className="block text-[13px] font-black text-turquoise-200">{money(offer.priceToman)}</b>
                  <span className="block text-[9px] text-slate-500">{copy.unit}</span>
                  {total !== null && (travelData.travelers + travelData.children + travelData.infants) > 1 ? (
                    <span className="block text-[9px] text-slate-400">کل گروه: {money(total)}</span>
                  ) : null}
                  <span className={`block text-[9px] ${fewSeats ? "font-bold text-amber-300" : "text-slate-500"}`}>
                    {typeof offer.seatsLeft === "number" && offer.seatsLeft > 0
                      ? `${fa.format(offer.seatsLeft)} صندلی${fewSeats ? " — در حال پر شدن" : " خالی"}`
                      : "ظرفیت اعلام نشده"}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => choose(offer)}
                    aria-pressed={isSelected}
                    className={`rounded-xl px-3 py-2 text-[10.5px] font-extrabold transition ${
                      isSelected ? "bg-cyan-300 text-slate-950" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    }`}
                  >
                    {isSelected ? <Check className="ml-1 inline h-3.5 w-3.5" /> : null}
                    {isSelected ? "انتخاب شد" : "انتخاب این بلیت"}
                  </button>
                  {offer.bookingUrl ? (
                    <a
                      href={offer.bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => choose(offer)}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-[9.5px] font-bold text-cyan-100 hover:bg-cyan-400/15"
                    >
                      خرید از {PROVIDER_LABELS[offer.provider || "alibaba"]}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {offer.companyName ? (
                    <span className="text-center text-[8.5px] leading-4 text-slate-500">
                      اپراتور: {offer.companyName}
                      {offer.originStation && offer.destinationStation
                        ? ` · ${offer.originStation} ← ${offer.destinationStation}`
                        : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-white/[0.02] px-4 py-3">
        <p className="flex items-center gap-1.5 text-[9.5px] text-slate-400">
          <Clock3 className="h-3 w-3 text-turquoise-300" />
          {fetchedAt ? `دریافت: ${new Date(fetchedAt).toLocaleString("fa-IR")}` : "هنوز جست‌وجو نشده"}
        </p>
        {visible.length ? (
          <p className="flex items-center gap-1.5 text-[9px] text-slate-500">
            <Info className="h-3 w-3" />
            هر بلیت لینک خرید همان منبع را دارد.
            {duplicates > 0 ? ` ${fa.format(duplicates)} مورد تکراری ادغام شد.` : ""}
            {(travelData.children > 0 || travelData.infants > 0) ? " قیمت کودک/نوزاد فقط اگر منبع اعلام کند." : ""}
          </p>
        ) : null}
      </div>
    </motion.section>
  );
}

/** Shown when the traveller picked a mode that has no live search (nothing here). */
export function TicketEmptyState({ message }: { message: string }) {
  return (
    <div className="glass flex items-center gap-3 p-5 text-[11px] leading-6 text-slate-300">
      <Users className="h-4 w-4 shrink-0 text-cyan-300" />
      {message}
    </div>
  );
}
