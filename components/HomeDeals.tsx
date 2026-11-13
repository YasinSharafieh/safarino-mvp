"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Building2, Clock, ExternalLink, LoaderCircle, MapPin, RefreshCw, Star } from "lucide-react";
import type { DealCity } from "@/lib/deals";

type Response = {
  success: boolean;
  cities: DealCity[];
  generatedAt: string;
  note: string;
};

/** Photos always load through the site's proxy, whatever the payload says. */
const photoSrc = (value: string | null) => {
  if (!value) return null;
  if (value.startsWith("/")) return value;
  return `/api/provider-assets?src=${encodeURIComponent(value)}`;
};

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));

const faDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", { month: "long", day: "numeric" }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
};

/**
 * «پیشنهادهای ویژه» — every number here was read from a real booking provider
 * a moment ago. Nothing is written by hand, and if the providers do not answer
 * the section says so instead of showing a made-up price.
 */
export default function HomeDeals() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const controller = new AbortController();
    // The section must never hang: if the providers are slow, say so plainly.
    const timer = window.setTimeout(() => controller.abort(), 40_000);
    fetch("/api/deals", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((payload: Response) => {
        if (cancelled) return;
        setData(payload);
      })
      .catch((reason) => {
        if (cancelled) return;
        if (reason?.name === "AbortError") {
          setError("خواندن قیمت‌ها طول کشید. یک بار دیگر «به‌روزرسانی» را بزنید.");
        } else {
          setError("خواندن پیشنهادهای زنده ممکن نشد. اتصال اینترنت را بررسی کنید.");
        }
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
  }, [reloadKey]);

  const cities = data?.cities || [];
  const deals = cities.flatMap((city) => city.deals.map((deal) => ({ ...deal, city: city.city })));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="chip">پیشنهادهای ویژه</span>
          <h2 className="section-title mt-3">اتاق‌های واقعی، قیمت واقعی</h2>
          <p className="mt-3 max-w-xl text-xs leading-6 text-slate-400">
            این کارت‌ها همین حالا از منابع رسمی رزرو خوانده شده‌اند؛ با کلیک روی هر کارت، همان اتاق در سایت ارائه‌دهنده باز می‌شود.
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

      {loading && !deals.length ? (
        <div className="mt-8">
          <p className="flex items-center gap-2 text-[10px] text-slate-400">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-cyan-300" />
            در حال خواندن قیمت‌های واقعی از منابع رزرو — این چند ثانیه طول می‌کشد.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="glass h-64 overflow-hidden p-0">
                <div className="h-36 animate-pulse bg-white/[0.05]" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/10" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-white/5" />
                  <div className="h-3 w-1/3 animate-pulse rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!loading && (error || !deals.length) ? (
        <div className="glass mt-8 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-6 text-slate-300">
            {error || data?.note || "منابع اقامتگاه الان پاسخ ندادند."}
          </p>
          <a href="/accommodation" className="btn-primary shrink-0 !px-4 !py-2 text-[11px]">
            جست‌وجوی اقامتگاه
            <ArrowLeft className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : null}

      {deals.length ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.slice(0, 6).map((deal, index) => (
              <motion.a
                key={`${deal.provider}-${deal.id}`}
                href={deal.bookingUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: Math.min(index, 5) * 0.06 }}
                className="glass glass-hover group overflow-hidden p-0"
              >
                <div className="relative h-36 overflow-hidden bg-gradient-to-br from-cyan-500/20 to-teal-700/20">
                  {photoSrc(deal.photo) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoSrc(deal.photo) as string}
                      alt={deal.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-cyan-200/40">
                      <Building2 className="h-10 w-10" />
                    </span>
                  )}
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-slate-950/70 px-2 py-0.5 text-[9px] font-bold text-cyan-200 backdrop-blur">
                    {deal.providerLabel}
                  </span>
                  {deal.discountPercent > 0 ? (
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-rose-500/85 px-2 py-0.5 text-[9px] font-black text-white">
                      {money(deal.discountPercent)}٪ تخفیف
                    </span>
                  ) : null}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-1 text-[13px] font-extrabold text-white">{deal.name}</h3>
                    {deal.rating ? (
                      <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-amber-300">
                        <Star className="h-3 w-3 fill-amber-300" />
                        {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(deal.rating)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="line-clamp-1">{deal.city}{deal.location ? ` · ${deal.location}` : ""}</span>
                  </p>
                  <p className="mt-1.5 flex items-center gap-1 text-[9.5px] text-slate-500">
                    <Clock className="h-3 w-3 shrink-0" />
                    {faDate(deal.checkIn)} · {money(deal.nights)} شب · ۲ نفر
                  </p>

                  <div className="mt-3 flex items-end justify-between gap-2 border-t border-white/5 pt-3">
                    <div>
                      <span className="block text-[9px] text-slate-500">هر شب</span>
                      <b className="text-[13px] font-black text-cyan-300">{money(deal.pricePerNightToman)} تومان</b>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-slate-300 transition group-hover:text-cyan-200">
                      رزرو
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[9.5px] leading-5 text-slate-500">
            <Clock className="h-3 w-3 shrink-0" />
            {data?.note}
          </p>
        </>
      ) : null}
    </div>
  );
}
