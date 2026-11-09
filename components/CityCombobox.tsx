"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, Search } from "lucide-react";
import type { IranianCity } from "@/lib/iran-cities";
import { resolveIranianCity } from "@/lib/iran-cities";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/‌/g, " ");
}

type Props = {
  label: string;
  value: string;
  cities: IranianCity[];
  placeholder: string;
  onChange: (city: IranianCity) => void;
};

export default function CityCombobox({ label, value, cities, placeholder, onChange }: Props) {
  const selected = resolveIranianCity(value);
  const [query, setQuery] = useState(selected?.name || value);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setQuery(selected?.name || value);
  }, [open, selected?.name, value]);

  const filtered = useMemo(() => {
    const term = normalize(query);
    if (!term || term === normalize(selected?.name || "")) return cities;
    return cities.filter((city) => {
      const codes = `${city.code} ${city.flightCode || ""} ${city.groundCode || ""}`;
      return normalize(`${city.name} ${city.englishName || ""} ${codes}`).includes(term);
    });
  }, [cities, query, selected?.name]);

  function choose(city: IranianCity) {
    setQuery(city.name);
    setOpen(false);
    onChange(city);
    inputRef.current?.blur();
  }

  return (
    <div className="relative">
      <span className="mb-2 block text-xs font-bold text-slate-300">{label}</span>
      <div className={`flex min-h-14 items-center gap-2 rounded-2xl border bg-night-800/90 px-3 transition ${open ? "border-cyan-300/50 shadow-glow" : "border-white/10"}`}>
        <MapPin className="h-4 w-4 shrink-0 text-cyan-300" />
        <input
          ref={inputRef}
          value={query}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${label}-city-list`}
          aria-autocomplete="list"
          placeholder={placeholder}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && open && filtered.length) {
              event.preventDefault();
              choose(filtered[0]);
            }
            if (event.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
        />
        {open ? <Search className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </div>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-white/15 bg-night-800 shadow-2xl">
          <div className="border-b border-white/10 px-4 py-2 text-[10px] text-slate-400">
            {query ? `${filtered.length.toLocaleString("fa-IR")} شهر پیدا شد` : "نام فارسی، لاتین یا کد شهر را بنویس"}
          </div>
          <div id={`${label}-city-list`} role="listbox" className="max-h-72 overflow-y-auto p-2">
            {filtered.slice(0, 60).map((city) => (
              <button
                key={`${city.code}-${city.flightCode || ""}-${city.groundCode || ""}`}
                type="button"
                role="option"
                aria-selected={selected?.code === city.code}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(city)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-right transition hover:bg-cyan-300/10"
              >
                <span>
                  <b className="block text-sm text-white">{city.name}</b>
                  {city.englishName && <small className="mt-0.5 block text-[10px] text-slate-500" dir="ltr">{city.englishName}</small>}
                </span>
                <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-cyan-200" dir="ltr">
                  {city.flightCode || city.groundCode || city.code}
                </span>
              </button>
            ))}
            {!filtered.length && <p className="p-5 text-center text-xs text-slate-400">شهری با این نام پیدا نشد.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
