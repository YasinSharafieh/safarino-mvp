"use client";

import { useEffect, useState } from "react";
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
  TrainFront,
  Users,
} from "lucide-react";
import type { TripPackage, TripPackagesResult } from "@/lib/trip-packages";
import { detectBrowserCity, readSavedOrigin, saveOrigin } from "@/lib/visitor-city";

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
    const query = originHint ? `?from=${encodeURIComponent(originHint)}` : "";
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
  }, [reloadKey, originHint]);

  const packages: TripPackage[] = data?.packages || [];
  const origin = data?.origin || originHint || "تهران";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="chip">پیشنهادهای ویژه</span>
          <h2 className="section-title mt-3">سفر کامل، از شهر خودت</h2>
          <p className="mt-3 max-w-xl text-xs leading-6 text-slate-400">
            مبدأ: <b className="text-white">{origin}</b>
            {originSource === "geo" ? " (از موقعیت همین دستگاه)" : originSource === "request" ? " (شهر انتخابی شما)" : ""} · هر بسته با
            بلیت رفت‌وبرگشت واقعی و اقامت واقعی همان تاریخ‌ها، از ارزان به گران.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
          className="btn-ghost !px-3.5 !py-2 text-[11px] disabled:opacity-50"
        >
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          به‌روزرسانی
        </button>
      </div>

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
            {packages.map((pkg, index) => {
              const ModeIcon = MODE_ICON[pkg.ticket.mode] ?? TrainFront;
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
                    <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-slate-950/75 px-2 py-0.5 text-[9px] font-bold text-cyan-200 backdrop-blur">
                      <ModeIcon className="h-3 w-3" />
                      {pkg.ticket.modeLabel}
                    </span>
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-cyan-400/90 px-2 py-0.5 text-[9px] font-black text-slate-950">
                      {money(pkg.days)} روزه
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
