"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BedDouble,
  Building2,
  Bus,
  CalendarDays,
  ExternalLink,
  Info,
  LoaderCircle,
  MapPin,
  Plane,
  RefreshCw,
  MapPinOff,
  MapPinCheck,
  TrainFront,
  Users,
} from "lucide-react";
import type { TripPackage, TripPackagesResult } from "@/lib/trip-packages";
import { estimateBudget } from "@/lib/budget-fit";
import { useTravel } from "@/app/context/TravelContext";
import { detectBrowserCity, readSavedOrigin, saveOrigin } from "@/lib/visitor-city";
import { orderedTravelCities } from "@/lib/start-flow";
import CityCombobox from "@/components/CityCombobox";
import { curatePackages, shelfSummary, TIER_LABEL, type CuratedPackage, type PackageTier } from "@/lib/package-curator";
import { Plane as PlaneIcon, Sparkles, TrainFront as TrainIcon, Bus as BusIcon } from "lucide-react";

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
const compact = (value: number) =>
  new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(Math.round(value / 100_000) / 10);

const faDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", { month: "long", day: "numeric" }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
};

const faClock = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" }).format(date);
};

const MODE_ICON = { train: TrainFront, plane: Plane, bus: Bus } as const;

/** Photos always load through the site's proxy, whatever the payload says. */
const photoSrc = (value: string | null) => {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  return `/api/provider-assets?src=${encodeURIComponent(value)}`;
};

function StayPhoto({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="absolute inset-0 grid place-items-center bg-gradient-to-br from-cyan-500/15 to-teal-700/20 text-cyan-200/35">
        <Building2 className="h-8 w-8" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" onError={() => setFailed(true)} />
  );
}

/**
 * «پیشنهادهای ویژه» — real, complete trips built a second ago.
 *
 * Every card is a composed package: the cheapest real ticket there and back plus
 * a real room for exactly those nights, from the traveller's own city. Pressing
 * the card continues into the normal flow (ticket → hotel → plan) with the same
 * origin, destination and dates.
 */
export default function HomeDeals() {
  const [data, setData] = useState<TripPackagesResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [originHint, setOriginHint] = useState<string | null>(null);
  /** «تغییر مبدأ»: the traveller's own city, editable at any time. */
  const [originDraft, setOriginDraft] = useState("");
  const [originEditing, setOriginEditing] = useState(false);
  /** Bumped by «به‌روزرسانی» so the request really goes back to the providers. */
  const [refreshToken, setRefreshToken] = useState(0);
  const { travelData } = useTravel();
  const [budgetMillions, setBudgetMillions] = useState<number>(() => Math.max(3, Math.round(Number(travelData.budget) || 15)));
  const [originSource, setOriginSource] = useState<"request" | "geo" | "default" | null>(null);

  // A returning visitor's city is remembered; a first visitor is located once.
  useEffect(() => {
    let cancelled = false;
    const saved = readSavedOrigin();
    if (saved) {
      setOriginHint(saved);
      setOriginSource("request");
      return () => {
        cancelled = true;
      };
    }
    void detectBrowserCity().then((city) => {
      if (cancelled || !city) return;
      saveOrigin(city);
      setOriginHint(city);
      setOriginSource("geo");
      setReloadKey((value) => value + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const controller = new AbortController();
    // The section must never hang: if the providers are slow, say so plainly.
    const timer = window.setTimeout(() => controller.abort(), 62_000);
    const params = new URLSearchParams();
    params.set("limit", "6");
    if (originHint) params.set("from", originHint);
    // Only a press of «به‌روزرسانی» asks for a fresh crawl; the first paint of
    // the page stays fast and uses the saved copy when it is still warm.
    if (refreshToken > 0) params.set("fresh", "1");
    const query = params.toString() ? `?${params.toString()}` : "";
    fetch(`/api/deals${query}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload: TripPackagesResult) => {
        if (cancelled) return;
        setData(payload);
        if (payload.origin) {
          setOriginSource(payload.originSource);
          if (payload.originSource !== "request") setOriginHint(payload.origin);
        }
      })
      .catch((reason) => {
        if (cancelled) return;
        if (reason?.name === "AbortError") setError("خواندن قیمت‌ها طول کشید. یک بار دیگر «به‌روزرسانی» را بزنید.");
        else setError("خواندن پیشنهادهای زنده ممکن نشد. اتصال اینترنت را بررسی کنید.");
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [reloadKey, originHint, refreshToken]);

  const packages: TripPackage[] = data?.packages || [];

  /**
   * The shelf is re-read for this traveller: a tier measured against their money,
   * one card per vehicle, one card per price level — and a different mix on every
   * press of «به‌روزرسانی».
   */
  const [mixSeed, setMixSeed] = useState(0);
  const [modeFilter, setModeFilter] = useState<"any" | "plane" | "train" | "bus">("any");
  const [tierFilter, setTierFilter] = useState<"all" | PackageTier>("all");
  const [smart, setSmart] = useState<{ items: CuratedPackage[]; summary: string; source: "ai" | "local"; note?: string } | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);

  const curated = useMemo(
    () =>
      curatePackages(packages, {
        budgetMillions,
        travellers: Math.max(1, travelData.travelers || 1),
        days: Math.max(1, Number(travelData.days) || 2),
        mode: modeFilter,
        taste: Array.isArray(travelData.tasteMoods) ? travelData.tasteMoods : [],
        seed: mixSeed,
      }),
    [budgetMillions, mixSeed, modeFilter, packages, travelData.days, travelData.tasteMoods, travelData.travelers],
  );

  /** The AI sentences, when one arrived, are attached by id — never reordered blindly. */
  const shelf = useMemo<CuratedPackage[]>(() => {
    const base = smart?.items?.length ? smart.items : curated;
    const filtered = tierFilter === "all" ? base : base.filter((pkg) => pkg.tier === tierFilter);
    return filtered.length ? filtered : base;
  }, [curated, smart, tierFilter]);

  const summaryLine = smart?.summary || shelfSummary(shelf, {
    budgetMillions,
    travellers: Math.max(1, travelData.travelers || 1),
    days: Math.max(1, Number(travelData.days) || 2),
  });

  const askSmart = async () => {
    if (!packages.length || smartLoading) return;
    setSmartLoading(true);
    try {
      const response = await fetch("/api/deals/smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          packages,
          budgetMillions,
          travellers: Math.max(1, travelData.travelers || 1),
          days: Math.max(1, Number(travelData.days) || 2),
          mode: modeFilter,
          taste: Array.isArray(travelData.tasteMoods) ? travelData.tasteMoods : [],
          seed: mixSeed,
        }),
      });
      const payload = (await response.json()) as { success?: boolean; items?: CuratedPackage[]; summary?: string; source?: "ai" | "local"; note?: string };
      if (payload?.success && payload.items?.length) {
        setSmart({ items: payload.items, summary: payload.summary || "", source: payload.source || "local", note: payload.note });
      }
    } catch {
      // The computed shelf is already on screen.
    } finally {
      setSmartLoading(false);
    }
  };
  const origin = data?.origin || originHint || "تهران";
  const originCities = useMemo(() => orderedTravelCities(), []);

  /**
   * The budget the visitor already set (or a sensible default), read against
   * every package: ticket + room + an allowance for food and everyday spending.
   * The one that fits best is marked «پیشنهاد من» — with the reason spelled out.
   */
  const budgetPlans = useMemo(() => {
    const totalBudget = Math.max(0, budgetMillions * 1_000_000);
    return packages.map((pkg) => ({
      pkg,
      plan: estimateBudget({
        totalBudget,
        travellers: Math.max(1, pkg.travellers),
        days: Math.max(1, pkg.days),
        tickets: pkg.ticketTotalToman,
        stay: pkg.stayTotalToman,
      }),
    }));
  }, [budgetMillions, packages]);

  const pick = useMemo(() => {
    const fitting = budgetPlans.filter((entry) => entry.plan.verdict !== "over");
    if (!fitting.length) return null;
    // The longest trip that still leaves money for food and the rest.
    return [...fitting].sort((a, b) => b.pkg.days - a.pkg.days || b.plan.remaining - a.plan.remaining)[0];
  }, [budgetPlans]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="chip">پیشنهادهای ویژه</span>
          <h2 className="section-title mt-3">سفر کامل، از شهر خودت</h2>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-6 text-slate-400">
            <span>
              مبدأ: <b className="text-white">{origin}</b>
              {originSource === "geo" ? " (از موقعیت همین دستگاه)" : originSource === "request" ? " (شهر انتخابی شما)" : ""} · هر بسته با
              بلیت رفت‌وبرگشت واقعی و اقامت واقعی همان تاریخ‌ها، از ارزان به گران.
            </span>
            <button
              type="button"
              onClick={() => {
                setOriginDraft(origin);
                setOriginEditing((value) => !value);
              }}
              aria-expanded={originEditing}
              className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/20"
            >
              <MapPin className="h-3 w-3" />
              تغییر مبدأ
            </button>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="glass-soft flex items-center gap-2 px-3 py-2">
            <span className="text-[10px] text-slate-400">بودجهٔ سفرت</span>
            <input
              dir="ltr"
              type="range"
              min="5"
              max="80"
              step="1"
              value={budgetMillions}
              onChange={(event) => setBudgetMillions(Number(event.target.value))}
              className="w-24 cursor-pointer accent-cyan-400"
              aria-label="بودجهٔ کل سفر به میلیون تومان"
            />
            <b className="whitespace-nowrap text-[10.5px] text-cyan-200">{money(budgetMillions)} میلیون</b>
          </label>
          <button
            type="button"
            onClick={() => void askSmart()}
            disabled={smartLoading || !packages.length}
            className="btn-primary !px-3.5 !py-2 text-[11px] disabled:opacity-50"
          >
            {smartLoading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            چیدن هوشمند
          </button>
          <button
            type="button"
            onClick={() => {
              setMixSeed((value) => value + 1);
              setSmart(null);
              setRefreshToken((value) => value + 1);
            }}
            disabled={loading}
            className="btn-ghost !px-3.5 !py-2 text-[11px] disabled:opacity-50"
          >
            {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            به‌روزرسانی
          </button>
        </div>
      </div>

      {packages.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {([
            { id: "any", label: "همه", Icon: null },
            { id: "plane", label: "هواپیما", Icon: PlaneIcon },
            { id: "train", label: "قطار", Icon: TrainIcon },
            { id: "bus", label: "اتوبوس", Icon: BusIcon },
          ] as const).map((option) => {
            const active = modeFilter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setModeFilter(option.id);
                  setSmart(null);
                }}
                aria-pressed={active}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                  active ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                }`}
              >
                {option.Icon ? <option.Icon className="h-3 w-3" /> : null}
                {option.label}
              </button>
            );
          })}
          <span className="mx-1 h-4 w-px bg-white/10" />
          {(["all", "economy", "balanced", "premium"] as const).map((tier) => {
            const active = tierFilter === tier;
            return (
              <button
                key={tier}
                type="button"
                onClick={() => setTierFilter(tier)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                  active ? "border-fuchsia-300/50 bg-fuchsia-300/15 text-fuchsia-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                }`}
              >
                {tier === "all" ? "همهٔ سطح‌ها" : TIER_LABEL[tier]}
              </button>
            );
          })}
          <span className="mr-auto text-[9px] text-slate-500">
            {smart?.source === "ai" ? "توضیح‌ها با هوش مصنوعی، بر پایهٔ همین قیمت‌های واقعی" : "سطح هر بسته با بودجهٔ خودت سنجیده شده"}
          </span>
        </div>
      ) : null}

      {summaryLine ? (
        <p className="mt-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-2 text-[10px] leading-6 text-cyan-100">
          <Sparkles className="ml-1 inline h-3 w-3" />
          {summaryLine}
          {smart?.note ? <span className="mt-0.5 block text-[9px] text-slate-400">{smart.note}</span> : null}
        </p>
      ) : null}

      {originEditing ? (
        <div className="glass mt-4 border border-cyan-400/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-[11.5px] font-black text-white">سفر از کدام شهر شروع شود؟</b>
            <span className="text-[9.5px] text-slate-500">همهٔ بسته‌ها با مبدأ تازه از منابع دوباره خوانده می‌شوند.</span>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <CityCombobox
              label="شهر مبدأ"
              value={originDraft}
              cities={originCities}
              placeholder="شهر خودت را انتخاب کن…"
              onChange={(city) => setOriginDraft(city.name)}
            />
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const name = originDraft.trim();
                  if (!name) return;
                  saveOrigin(name);
                  setOriginHint(name);
                  setOriginSource("request");
                  setOriginEditing(false);
                  // A new origin is a new trip: the old cards must not linger.
                  setData(null);
                  setRefreshToken((value) => value + 1);
                }}
                className="btn-primary !px-4 !py-2.5 text-[11px]"
              >
                <MapPinCheck className="h-3.5 w-3.5" />
                همین مبدأ
              </button>
              <button type="button" onClick={() => setOriginEditing(false)} className="btn-ghost !px-3 !py-2.5 text-[11px]">
                <MapPinOff className="h-3.5 w-3.5" />
                انصراف
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["تهران", "مشهد", "اصفهان", "شیراز", "تبریز", "رشت", "اهواز", "کرج"].filter((city) => city !== origin).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setOriginDraft(city)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${originDraft === city ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"}`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading && !packages.length ? (
        <div className="mt-8">
          <p className="flex items-center gap-2 text-[10px] text-slate-400">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-300" />
            در حال ساختن سفرهای واقعی از {origin}: بلیت و اقامت از منابع رسمی خوانده می‌شود — چند ثانیه صبر کنید.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="glass h-72 animate-pulse p-0" />
            ))}
          </div>
        </div>
      ) : null}

      {!loading && (error || !packages.length) ? (
        <div className="glass mt-8 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-6 text-slate-300">{error || data?.note || "منابع الان پاسخ کامل ندادند."}</p>
          <a href="/start" className="btn-primary shrink-0 !px-4 !py-2 text-[11px]">
            خودم انتخاب می‌کنم
            <ArrowLeft className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : null}

      {packages.length ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {shelf.map((pkg, index) => {
              const plan =
                budgetPlans.find((entry) => entry.pkg.id === pkg.id)?.plan ||
                estimateBudget({
                  totalBudget: Math.max(0, budgetMillions * 1_000_000),
                  travellers: Math.max(1, pkg.travellers),
                  days: Math.max(1, pkg.days),
                  tickets: pkg.ticketTotalToman,
                  stay: pkg.stayTotalToman,
                });
              const ModeIcon = MODE_ICON[pkg.ticket.mode] ?? TrainFront;
              const isPick = pick?.pkg.id === pkg.id;
              return (
                <motion.a
                  key={pkg.id}
                  href={pkg.continueUrl}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: Math.min(index, 5) * 0.06 }}
                  className="glass glass-hover group flex flex-col overflow-hidden p-0"
                >
                  <div className="relative h-32 overflow-hidden bg-gradient-to-br from-cyan-500/20 to-teal-700/20">
                    <StayPhoto src={photoSrc(pkg.stay.photo)} alt={pkg.stay.name} />
                    {isPick ? (
                      <span className="absolute inset-x-2.5 bottom-2.5 rounded-full bg-emerald-400/90 px-2 py-1 text-center text-[9px] font-black text-slate-950">پیشنهاد من برای بودجهٔ تو</span>
                    ) : null}
                    <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-slate-950/75 px-2 py-0.5 text-[9px] font-bold text-cyan-200 backdrop-blur">
                      <ModeIcon className="h-3 w-3" />
                      {pkg.ticket.modeLabel}
                    </span>
                    <span className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
                      <span className="rounded-full bg-cyan-400/90 px-2 py-0.5 text-[9px] font-black text-slate-950">{money(pkg.days)} روزه</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                          pkg.tier === "economy"
                            ? "bg-emerald-400/90 text-slate-950"
                            : pkg.tier === "premium"
                              ? "bg-amber-300/90 text-slate-950"
                              : "bg-violet-300/90 text-slate-950"
                        }`}
                      >
                        {pkg.tierLabel} · {money(pkg.fitPct)}٪ تناسب
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="text-sm font-black text-white">
                      {pkg.origin} ← {pkg.destination}
                    </h3>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                      <CalendarDays className="h-3 w-3 shrink-0 text-cyan-300" />
                      {faDate(pkg.departureDate)} تا {faDate(pkg.returnDate)} · {money(pkg.nights)} شب
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                      <Users className="h-3 w-3 shrink-0 text-cyan-300" />
                      {money(pkg.travellers)} نفر
                    </p>

                    <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-[10px] leading-5 text-slate-300">
                      <p className="flex items-start gap-1.5">
                        <ModeIcon className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />
                        <span>
                          {pkg.ticket.modeLabel} {pkg.ticket.operator}
                          {faClock(pkg.ticket.departure) ? ` · حرکت ${faClock(pkg.ticket.departure)}` : ""} ·{" "}
                          <b className="text-white">{compact(pkg.ticketTotalToman)} میلیون</b> رفت‌وبرگشت
                        </span>
                      </p>
                      <p className="flex items-start gap-1.5">
                        <BedDouble className="mt-0.5 h-3 w-3 shrink-0 text-teal-300" />
                        <span>
                          {pkg.stay.name} · {money(pkg.nights)} شب · <b className="text-white">{compact(pkg.stayTotalToman)} میلیون</b>
                        </span>
                      </p>
                    </div>

                    <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-[9px] leading-5 text-slate-300">
                      {pkg.aiWhy || pkg.reason}
                    </p>

                    <p className={`mt-2 rounded-xl border p-2 text-[9px] leading-5 ${plan.verdict === "over" ? "border-rose-400/25 bg-rose-400/10 text-rose-200" : plan.verdict === "tight" ? "border-turquoise-400/25 bg-turquoise-400/10 text-turquoise-200" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"}`}>
                      {plan.verdict === "over"
                        ? `${compact(Math.abs(plan.remaining) * 10)} میلیون بیشتر از بودجه‌ات؛ با غذا و خرج روزانه حساب شده.`
                        : `با غذا و خرج روزانه، ${money(Math.max(0, plan.remaining))} تومان از بودجه‌ات می‌ماند.`}
                    </p>

                    <div className="mt-auto flex items-end justify-between gap-2 border-t border-white/5 pt-3">
                      <div>
                        <span className="block text-[9px] text-slate-500">جمع سفر</span>
                        <b className="text-sm font-black text-cyan-200">{money(pkg.totalToman)} تومان</b>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-300 transition group-hover:text-cyan-200">
                        دیدن و ادامه
                        <ArrowLeft className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>

          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[9.5px] leading-5 text-slate-500">
            <Info className="h-3 w-3 shrink-0" />
            {data?.note}
            {packages.some((pkg) => pkg.ticket.returnEstimated)
              ? " در بسته‌هایی که بلیت برگشت در فهرست منابع نبود، قیمت برگشت با همان نرخ رفت حساب شده و در صفحهٔ بلیت مشخص است."
              : ""}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[9.5px] leading-5 text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" />
            با کلیک روی هر بسته، همان مبدأ و مقصد و تاریخ‌ها در مرحلهٔ بلیت پر می‌شود؛ بعد اقامت و برنامهٔ سفر.
            <a href="/accommodation" className="text-cyan-200 hover:text-cyan-100">
              فقط اقامتگاه ببین
              <ExternalLink className="mr-1 inline h-2.5 w-2.5" />
            </a>
          </p>
        </>
      ) : null}
    </div>
  );
}
