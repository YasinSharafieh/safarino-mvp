"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Bus,
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
import { useTravel } from "@/app/context/TravelContext";
import { resolveIranianCity, transportCityCode } from "@/lib/iran-cities";
import { formatProviderDateTime } from "@/lib/jalali";

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
  onSelect: (selection: TicketSelection) => void;
  onCheapestChange: (mode: TicketMode, unitPrice: number | null) => void;
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

const SORTS: { id: SortKey; label: string }[] = [
  { id: "cheapest", label: "ارزان‌ترین" },
  { id: "earliest", label: "زودترین حرکت" },
  { id: "latest", label: "دیرترین حرکت" },
  { id: "seats", label: "بیشترین صندلی" },
];

const normalise = (value: string) =>
  value.toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ");

/**
 * Live tickets for one mode.
 *
 * The panel searched is the mode the traveller chose — nothing else is shown —
 * and the results list has its own search box (company, service, time, source),
 * sorting and a price ceiling, exactly like the accommodation list.
 */
export default function TicketSearch({ mode, roundTrip, active, selectedId, onSelect, onCheapestChange }: Props) {
  const { travelData } = useTravel();
  const [offers, setOffers] = useState<LiveOffer[]>([]);
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
  const autoSearched = useRef(false);

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
        const operator = (offer.title || "").trim() || (mode === "plane" ? "پرواز" : mode === "train" ? "قطار" : "اتوبوس");
        const service = (offer.subtitle || "").trim();
        return { ...offer, title: service && !service.includes(operator) ? `${operator} · ${service}` : operator };
      };
      const outbound = (data.offers || []).map(label);
      const returning = (data.returningOffers || []).map(label);
      setOffers(outbound);
      setReturnOffers(returning);
      setStatuses(data.providerStatuses || []);
      setDuplicates(data.duplicateCount || 0);
      setFetchedAt(data.fetchedAt || new Date().toISOString());
      setActiveLeg("outbound");
      setHasSearched(true);
      setMaxPrice(null);
      const cheapest = outbound.reduce<number | null>((best, offer) => (best === null || offer.priceToman < best ? offer.priceToman : best), null);
      onCheapestChange(mode, cheapest);
      if (!outbound.length) {
        const working = (data.providerStatuses || []).filter((status) => status.status === "ok");
        setError(
          working.length
            ? "برای این مسیر و تاریخ، بلیتی با صندلی و قیمت پیدا نشد. تاریخ دیگری را امتحان کنید."
            : "هیچ منبعی برای این مسیر پاسخ نداد؛ وضعیت هر منبع پایین‌تر آمده است.",
        );
      }
    } catch (caught) {
      setOffers([]);
      setReturnOffers([]);
      onCheapestChange(mode, null);
      setError(caught instanceof Error ? caught.message : "جست‌وجو انجام نشد");
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
    void search();
  }, [active, destinationCity, originCity, search, travelData.departureDate]);

  const legOffers = activeLeg === "return" ? returnOffers : offers;
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

  const priceCeiling = useMemo(
    () => legOffers.reduce((max, offer) => Math.max(max, offer.priceToman), 0),
    [legOffers],
  );

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
        {visible.map((offer, index) => {
          const isSelected = selectedId === offer.id;
          const total = totalFor(offer);
          return (
            <div key={offer.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-white/[0.02] lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <ProviderLogo src={offer.logoUrl} name={offer.title} mode={mode} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="text-[12.5px] text-white">{offer.title}</b>
                    {sort === "cheapest" && index === 0 ? <span className="badge-turquoise !py-0.5 !text-[8.5px]">ارزان‌ترین</span> : null}
                    {offer.provider ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8.5px] font-bold text-slate-300">
                        <span className="grid h-3 w-3 place-items-center rounded-full bg-cyan-400/20 text-[6.5px] text-cyan-200">{PROVIDER_MARKS[offer.provider]}</span>
                        {PROVIDER_LABELS[offer.provider]}
                      </span>
                    ) : null}
                  </div>
                  {offer.subtitle ? <span className="mt-0.5 block text-[10px] text-slate-400">{offer.subtitle}</span> : null}
                  {offer.details?.length ? <span className="mt-0.5 block text-[9.5px] leading-5 text-slate-500">{offer.details.join(" · ")}</span> : null}
                  {offer.alsoAvailableAt?.length ? (
                    <span className="mt-1 block text-[9.5px] leading-5 text-slate-400">
                      همین بلیت در{" "}
                      {offer.alsoAvailableAt.map((alternate, alternateIndex) => (
                        <span key={`${alternate.provider}-${alternateIndex}`}>
                          {alternateIndex > 0 ? " و " : ""}
                          <a href={alternate.bookingUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-cyan-200 underline decoration-cyan-400/40 underline-offset-4">
                            {alternate.providerLabel}
                          </a>{" "}
                          ({money(alternate.priceToman)})
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                <div className="text-left">
                  <span className="block text-[9px] text-slate-500">حرکت</span>
                  <b className="block text-[11.5px] leading-6 text-white">{formatProviderDateTime(offer.departure)}</b>
                  {offer.arrival ? <span className="block text-[9px] text-slate-500">رسیدن: {formatProviderDateTime(offer.arrival)}</span> : null}
                </div>
                <div className="text-left">
                  <b className="block text-[13px] font-black text-turquoise-200">{money(offer.priceToman)}</b>
                  <span className="block text-[9px] text-slate-500">{copy.unit}</span>
                  {total !== null && (travelData.travelers + travelData.children + travelData.infants) > 1 ? (
                    <span className="block text-[9px] text-slate-400">کل گروه: {money(total)}</span>
                  ) : null}
                  <span className="block text-[9px] text-slate-500">
                    {typeof offer.seatsLeft === "number" && offer.seatsLeft > 0 ? `${fa.format(offer.seatsLeft)} صندلی` : "ظرفیت اعلام نشده"}
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
