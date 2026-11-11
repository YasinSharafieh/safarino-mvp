"use client";

import { useMemo } from "react";
import { Image as ImageIcon, Heart, Search, SlidersHorizontal, X, BookOpen, ArrowDownWideNarrow } from "lucide-react";
import { categoryCounts, type FilterOptions, type FilterablePlace, type SortMode } from "@/lib/place-filter";

const SORTS: { value: SortMode; label: string }[] = [
  { value: "distance", label: "نزدیک‌ترین" },
  { value: "popular", label: "پرآوازه‌ترین" },
  { value: "name", label: "الفبایی" },
];

/**
 * The control strip that sits next to a list of places: a real search box,
 * one-tap filters with their counts, and a readable sort order.
 * Nothing is hidden behind an advanced screen; every option says what it does.
 */
export default function PlaceToolbar({
  places,
  options,
  onChange,
  total,
  shown,
  favoriteCount = 0,
}: {
  places: FilterablePlace[];
  options: FilterOptions;
  onChange: (next: FilterOptions) => void;
  total: number;
  shown: number;
  favoriteCount?: number;
}) {
  const categories = useMemo(() => categoryCounts(places), [places]);
  const selected = options.categories || [];

  const toggleCategory = (category: string) => {
    const exists = selected.includes(category);
    onChange({ ...options, categories: exists ? selected.filter((item) => item !== category) : [...selected, category] });
  };

  const reset = () => onChange({ query: "", categories: [], onlyWithPhoto: false, onlyWithArticle: false, onlyFavorites: false, maxDistanceKm: null, sort: options.sort });
  const hasFilters = Boolean(options.query || selected.length || options.onlyWithPhoto || options.onlyWithArticle || options.onlyFavorites || options.maxDistanceKm);

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-cyan-300" />
          <input
            type="search"
            value={options.query || ""}
            onChange={(event) => onChange({ ...options, query: event.target.value })}
            placeholder="جست‌وجو در همین فهرست: نام مکان، دسته یا نشانی…"
            aria-label="جست‌وجو در فهرست مکان‌ها"
            className="w-full bg-transparent text-[11px] text-white outline-none placeholder:text-slate-500"
          />
          {options.query ? (
            <button type="button" onClick={() => onChange({ ...options, query: "" })} aria-label="پاک کردن جست‌وجو" className="text-slate-500 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>

        <label className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/40 px-2.5 py-2 text-[10.5px] text-slate-300">
          <ArrowDownWideNarrow className="h-3.5 w-3.5 text-cyan-300" />
          <select
            value={options.sort || "distance"}
            onChange={(event) => onChange({ ...options, sort: event.target.value as SortMode })}
            aria-label="ترتیب نمایش"
            className="bg-transparent text-[11px] font-bold text-white outline-none [&>option]:bg-slate-900 [&>option]:text-white"
          >
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>{sort.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
          <SlidersHorizontal className="h-3.5 w-3.5 text-cyan-300" />
          فیلتر
        </span>
        <button
          type="button"
          onClick={() => onChange({ ...options, onlyWithPhoto: !options.onlyWithPhoto })}
          aria-pressed={Boolean(options.onlyWithPhoto)}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${options.onlyWithPhoto ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"}`}
        >
          <ImageIcon className="h-3 w-3" />
          فقط دارای عکس
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...options, onlyWithArticle: !options.onlyWithArticle })}
          aria-pressed={Boolean(options.onlyWithArticle)}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${options.onlyWithArticle ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"}`}
        >
          <BookOpen className="h-3 w-3" />
          فقط دارای مقاله
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...options, onlyFavorites: !options.onlyFavorites })}
          aria-pressed={Boolean(options.onlyFavorites)}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition ${options.onlyFavorites ? "border-rose-400/50 bg-rose-400/15 text-rose-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"}`}
        >
          <Heart className={`h-3 w-3 ${options.onlyFavorites ? "fill-current" : ""}`} />
          علاقه‌مندی‌ها ({new Intl.NumberFormat("fa-IR").format(favoriteCount)})
        </button>

        {[1, 2, 5].map((limit) => (
          <button
            key={limit}
            type="button"
            onClick={() => onChange({ ...options, maxDistanceKm: options.maxDistanceKm === limit ? null : limit })}
            aria-pressed={options.maxDistanceKm === limit}
            className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${options.maxDistanceKm === limit ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"}`}
          >
            تا {new Intl.NumberFormat("fa-IR").format(limit)} کیلومتر
          </button>
        ))}
      </div>

      {categories.length > 1 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-2">
          <span className="text-[10px] font-bold text-slate-400">دسته:</span>
          {categories.slice(0, 8).map((item) => (
            <button
              key={item.category}
              type="button"
              onClick={() => toggleCategory(item.category)}
              aria-pressed={selected.includes(item.category)}
              className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${selected.includes(item.category) ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"}`}
            >
              {item.category} <span className="text-[9px] text-slate-500">({new Intl.NumberFormat("fa-IR").format(item.count)})</span>
            </button>
          ))}
          {hasFilters ? (
            <button type="button" onClick={reset} className="ms-auto flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold text-slate-300 transition hover:bg-white/10">
              <X className="h-3 w-3" />
              پاک کردن فیلترها
            </button>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-[9.5px] text-slate-500" aria-live="polite">
        نمایش {new Intl.NumberFormat("fa-IR").format(shown)} از {new Intl.NumberFormat("fa-IR").format(total)} مکان
      </p>
    </div>
  );
}
