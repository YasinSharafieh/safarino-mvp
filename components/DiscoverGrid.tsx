"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, Search, X } from "lucide-react";
import type { DiscoverMood } from "@/lib/discover";

type CityCard = {
  name: string;
  province: string;
  tagline: string;
  moods: DiscoverMood[];
  bestSeason: string;
  suggestedDays: number;
};

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

/** A real map of the city (Neshan), so the card shows the place itself. */
function mapUrl(city: string): string {
  return `/api/discover/map?city=${encodeURIComponent(city)}`;
}

/**
 * The city grid with a search box and mood filters.
 * Filtering happens on the device, so typing is instant and costs nothing.
 */
export default function DiscoverGrid({ cities, moods }: { cities: CityCard[]; moods: DiscoverMood[] }) {
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState<DiscoverMood | null>(null);

  const visible = useMemo(() => {
    const clean = query
      .replace(/[يى]/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/\s+/g, " ")
      .trim();
    return cities.filter((city) => {
      if (mood && !city.moods.includes(mood)) return false;
      if (!clean) return true;
      const haystack = [city.name, city.province, city.tagline, city.moods.join(" ")].join(" ").replace(/[يى]/g, "ی").replace(/ك/g, "ک");
      return haystack.includes(clean);
    });
  }, [cities, mood, query]);

  return (
    <section className="mx-auto mt-8 max-w-6xl">
      <div className="glass p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-cyan-300" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="جست‌وجوی شهر یا استان"
              placeholder="نام شهر یا استان…"
              className="w-full min-w-0 bg-transparent text-[11px] text-white outline-none placeholder:text-slate-500"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="پاک‌کردن جست‌وجو" className="text-slate-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMood(null)}
              aria-pressed={mood === null}
              className={`rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition ${
                mood === null ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
              }`}
            >
              همه
            </button>
            {moods.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => setMood(mood === entry ? null : entry)}
                aria-pressed={mood === entry}
                className={`rounded-full border px-2.5 py-1.5 text-[10px] font-bold transition ${
                  mood === entry ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                }`}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[9.5px] text-slate-500" aria-live="polite">
          {fa(visible.length)} از {fa(cities.length)} شهر
        </p>
      </div>

      {visible.length ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((city) => (
            <li key={city.name}>
              <Link
                href={`/discover/${encodeURIComponent(city.name)}`}
                className="glass group block overflow-hidden transition hover:border-cyan-400/40 hover:brightness-110"
              >
                <div className="relative h-32 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mapUrl(city.name)}
                    alt={`نقشهٔ ${city.name}`}
                    loading="lazy"
                    className="h-full w-full object-cover opacity-80 transition group-hover:scale-105 group-hover:opacity-100"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                  <span className="absolute bottom-2 right-3 left-3 flex items-end justify-between gap-2">
                    <span>
                      <b className="block text-base font-black text-white">{city.name}</b>
                      <span className="block text-[9.5px] text-cyan-200/80">{city.province}</span>
                    </span>
                    <span className="flex items-center gap-1 rounded-lg border border-white/15 bg-slate-950/60 px-2 py-1 text-[9px] font-bold text-slate-200">
                      <CalendarDays className="h-3 w-3 text-cyan-300" />
                      {fa(city.suggestedDays)} روز
                    </span>
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-[10.5px] leading-6 text-slate-300">{city.tagline}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {city.moods.map((entry) => (
                      <span key={entry} className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-slate-300">
                        {entry}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-cyan-300" />
                      {city.bestSeason}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-cyan-200 transition group-hover:gap-2">
                      جاذبه‌ها
                      <ArrowLeft className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-[11px] leading-6 text-amber-100">
          شهری با این مشخصات پیدا نشد. فیلترها را پاک کنید یا از کوییز سفر استفاده کنید.
        </p>
      )}
      <p className="mt-2 text-[9px] leading-5 text-slate-500">
        عکس بالای هر کارت، نقشهٔ واقعی همان شهر است (نشان) — نه عکس تزئینی.
      </p>
    </section>
  );
}
