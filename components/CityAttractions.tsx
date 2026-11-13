"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info, LoaderCircle, MapPin, Sparkles } from "lucide-react";
import PlaceToolbar from "@/components/PlaceToolbar";
import { filterPlaces, type FilterOptions } from "@/lib/place-filter";

type ApiPlace = {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  wikipediaUrl?: string | null;
  sourceUrl?: string;
  source?: string;
  description?: string;
  imageUrl?: string | null;
  imageKind?: "photo" | "map" | "none";
};

type ApiResponse = {
  success?: boolean;
  city?: string;
  pois?: ApiPlace[];
  note?: string;
  cached?: boolean;
};

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

/**
 * The real attractions of one city, read from the same provider route the rest
 * of the site uses (server-side keys, snapshot store, no invented places).
 * Search and filters run on the device, so typing never waits for a network.
 */
export default function CityAttractions({ city, suggestedDays }: { city: string; suggestedDays: number }) {
  const [places, setPlaces] = useState<ApiPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({ query: "", categories: [], sort: "popular" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/providers/pois/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, limit: 24 }),
    })
      .then((response) => response.json())
      .then((payload: ApiResponse) => {
        if (cancelled) return;
        const list = Array.isArray(payload.pois) ? payload.pois : [];
        setPlaces(list);
        setNote(typeof payload.note === "string" ? payload.note : "");
        if (!list.length) setError("برای این شهر جاذبهٔ تأییدشده‌ای پیدا نشد؛ هیچ مکانی از خودمان نمی‌سازیم.");
      })
      .catch(() => {
        if (!cancelled) setError("خواندن جاذبه‌ها انجام نشد؛ اتصال اینترنت را بررسی کنید.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city]);

  const prepared = useMemo(
    () =>
      places.map((place) => ({
        id: place.id,
        name: place.name,
        category: place.category,
        distanceKm: typeof place.distanceKm === "number" ? place.distanceKm : null,
        wikipediaUrl: place.wikipediaUrl || null,
        imageKind: place.imageKind || "none",
        description: place.description || "",
        imageUrl: place.imageUrl || null,
        latitude: place.latitude,
        longitude: place.longitude,
        sourceUrl: place.sourceUrl || "",
      })),
    [places],
  );

  const visible = filterPlaces(prepared, filters);
  const withPhotos = prepared.filter((place) => place.imageKind === "photo").length;

  return (
    <div className="mt-3 glass p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-black text-cyan-100">
          <Sparkles className="h-4 w-4" />
          جاذبه‌های واقعی {city}
        </p>
        <span className="text-[9px] text-slate-500">
          {loading ? "در حال خواندن…" : `${fa(prepared.length)} مکان · ${fa(withPhotos)} با عکس`}
        </span>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-[10.5px] text-cyan-100">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          در حال خواندن جاذبه‌ها از منابع عمومی…
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-[10px] leading-6 text-amber-100">{error}</p>
      ) : null}

      {prepared.length ? (
        <>
          <PlaceToolbar
            places={prepared.map((place) => ({
              id: place.id,
              name: place.name,
              category: place.category,
              distanceKm: place.distanceKm,
              imageKind: place.imageKind,
              wikipediaUrl: place.wikipediaUrl,
              description: place.description,
            }))}
            options={filters}
            onChange={setFilters}
            total={prepared.length}
            shown={visible.length}
          />

          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {visible.map((place) => {
              const full = prepared.find((item) => item.id === place.id);
              if (!full) return null;
              return (
                <li key={full.id} className="flex gap-2 rounded-xl border border-white/10 bg-slate-950/30 p-2">
                  {full.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={full.imageUrl}
                      alt={full.name}
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-lg border border-white/10 object-cover"
                    />
                  ) : (
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-600">
                      <MapPin className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[11px] font-extrabold text-white">{full.name}</b>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-slate-500">
                      {/* A category name from Wikipedia can be a whole sentence; keep the chip one line. */}
                      <span title={full.category} className="max-w-[9rem] truncate rounded bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200">
                        {full.category.split(/[(،,]/)[0].trim().slice(0, 24)}
                      </span>
                      {full.imageKind === "map" ? <span>تصویر: نقشهٔ نشان</span> : null}
                      {full.wikipediaUrl ? <span>مقالهٔ ویکی‌پدیا</span> : null}
                    </span>
                    {full.description ? (
                      <p className="mt-1 line-clamp-2 text-[9.5px] leading-5 text-slate-400">{full.description}</p>
                    ) : null}
                    <a
                      href={`https://nshn.ir/?lat=${full.latitude}&lng=${full.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-cyan-300 hover:text-cyan-200"
                    >
                      <MapPin className="h-2.5 w-2.5" />
                      دیدن روی نشان
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-2.5">
            <p className="min-w-0 flex-1 text-[10px] leading-6 text-cyan-100">
              برنامهٔ {fa(suggestedDays)} روزهٔ {city} را بسازید: همین جاذبه‌ها، با ترتیب نزدیک به هم، فاصلهٔ واقعی و هزینه.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/itinerary?city=${encodeURIComponent(city)}&days=${suggestedDays}`}
                className="flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/15 px-2.5 py-1.5 text-[10px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/25"
              >
                ساختن برنامه
                <ArrowLeft className="h-3 w-3" />
              </Link>
              <Link
                href={`/accommodation?city=${encodeURIComponent(city)}`}
                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 transition hover:bg-white/10"
              >
                اقامتگاه‌ها
              </Link>
            </div>
          </div>
        </>
      ) : null}

      {note ? (
        <p className="mt-2 flex items-start gap-1.5 text-[9px] leading-5 text-slate-500">
          <Info className="mt-0.5 h-2.5 w-2.5 shrink-0 text-cyan-300" />
          {note}
        </p>
      ) : null}
    </div>
  );
}
