"use client";

import { useEffect, useState } from "react";
import { ExternalLink, ChevronDown, Heart, Info, Navigation2 } from "lucide-react";
import { FAVORITES_EVENT, isFavoritePlace, toggleFavorite } from "@/lib/favorites";
import PlaceNavigator from "./PlaceNavigator";
import type { NavPoint } from "@/lib/neshan-deeplink";

export type PlaceCardData = {
  id: string;
  name: string;
  category: string;
  address?: string;
  latitude: number;
  longitude: number;
  distanceKm?: number | null;
  durationMinutes?: number | null;
  distanceEngine?: string;
  sourceLabel?: string;
  sourceUrl?: string | null;
  wikipediaUrl?: string | null;
  imageUrl?: string | null;
  imageKind?: "photo" | "map" | "none";
  imageLabel?: string;
  imageCreditUrl?: string | null;
  description?: string;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatKm(value: number): string {
  return formatNumber(Math.round(value * 10) / 10);
}

/**
 * One place, twice useful: what it is (a short, practical description taken
 * from its own article) and how to get there (one tap on the Neshan navigator).
 */
export default function PlaceCard({
  place,
  origin,
  originLabel,
  rank,
}: {
  place: PlaceCardData;
  origin?: NavPoint | null;
  originLabel?: string;
  rank?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(isFavoritePlace(place.id));
    sync();
    window.addEventListener(FAVORITES_EVENT, sync);
    return () => window.removeEventListener(FAVORITES_EVENT, sync);
  }, [place.id]);

  const saveOrRemove = () => {
    toggleFavorite({
      id: place.id,
      name: place.name,
      category: place.category,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      description: place.description,
      imageUrl: place.imageUrl,
      imageKind: place.imageKind,
      wikipediaUrl: place.wikipediaUrl,
      sourceUrl: place.sourceUrl,
    });
  };
  const description = (place.description || "").trim();
  const isLong = description.length > 150;
  const articleLink = place.imageCreditUrl || place.wikipediaUrl || place.sourceUrl || null;

  return (
    <article className="glass-soft group flex h-full flex-col overflow-hidden transition hover:border-cyan-400/25 hover:bg-white/[0.07]">
      {/* Picture */}
      <div className="relative h-32 w-full overflow-hidden bg-slate-900/70">
        {place.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.imageUrl}
            alt={place.imageKind === "map" ? `نقشهٔ موقعیت ${place.name}` : place.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-slate-600">
            <Navigation2 className="h-5 w-5" />
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/85 to-transparent" />
        {typeof rank === "number" ? (
          <span className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-slate-950/75 text-[10px] font-black text-cyan-200">{formatNumber(rank)}</span>
        ) : null}
        {place.imageKind === "map" ? (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-slate-950/80 px-1.5 py-0.5 text-[8px] font-bold text-cyan-200">نقشه</span>
        ) : null}
        {place.distanceKm !== null && place.distanceKm !== undefined ? (
          <span className="absolute bottom-1.5 left-1.5 rounded-md bg-slate-950/75 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {formatKm(place.distanceKm)} کیلومتر
            {place.durationMinutes ? ` · ${formatNumber(place.durationMinutes)} دقیقه` : ""}
          </span>
        ) : null}
      </div>

      {/* Name and what kind of place it is */}
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-sm font-black leading-6 text-white">
            <b className="line-clamp-2">{place.name}</b>
          </h3>
          <span className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={saveOrRemove}
              aria-pressed={saved}
              aria-label={saved ? `حذف ${place.name} از علاقه‌مندی‌ها` : `افزودن ${place.name} به علاقه‌مندی‌ها`}
              title={saved ? "در علاقه‌مندی‌هاست" : "افزودن به علاقه‌مندی‌ها"}
              className={`mt-0.5 rounded-lg border p-1.5 transition ${saved ? "border-rose-400/50 bg-rose-400/15 text-rose-200" : "border-white/10 bg-white/5 text-slate-400 hover:text-rose-200"}`}
            >
              <Heart className={`h-3 w-3 ${saved ? "fill-current" : ""}`} />
            </button>
          {articleLink ? (
            <a
              href={articleLink}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`صفحهٔ ${place.name} در منبع`}
              className="mt-0.5 shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 transition hover:text-cyan-200"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] text-slate-500">
          <span className="rounded-md bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200">{place.category}</span>
          {place.sourceLabel ? <span>{place.sourceLabel}</span> : null}
          {place.distanceEngine && place.distanceKm !== null && place.distanceKm !== undefined ? <span>فاصله: {place.distanceEngine}</span> : null}
        </div>

        {/* 1. A short, practical description of the place */}
        {description ? (
          <div className="mt-2 rounded-xl border border-white/5 bg-slate-950/25 p-2">
            <p className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
              <Info className="h-3 w-3 text-cyan-300" />
              دربارهٔ این مکان
            </p>
            <p className={`mt-1 text-[10.5px] leading-6 text-slate-300 ${expanded ? "" : "line-clamp-3"}`}>{description}</p>
            {isLong ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="mt-1 flex items-center gap-1 text-[9.5px] font-bold text-cyan-200 underline-offset-4 hover:underline"
              >
                <ChevronDown className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`} />
                {expanded ? "کمتر" : "توضیحات بیشتر"}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* 2. The way there, straight into the Neshan navigator */}
        <div className="mt-auto pt-2.5">
          <PlaceNavigator place={{ name: place.name, latitude: place.latitude, longitude: place.longitude, category: place.category, address: place.address }} origin={origin} originLabel={originLabel} compact />
        </div>
      </div>
    </article>
  );
}
