"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CarFront, Check, ChevronDown, Search } from "lucide-react";
import { CARS, findCar, searchCars, type CarModel } from "@/lib/car-catalog";

type Props = {
  value: string;
  onChange: (car: CarModel) => void;
  label?: string;
};

const fa = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

/**
 * The car picker: a real searchable list of Iranian cars, like the city picker.
 * Typing «۲۰۶» or «تیگو» or «شاسی» narrows the list; the row shows the numbers
 * the cost model will use, so the choice is informed before it is made.
 */
export default function CarCombobox({ value, onChange, label = "مدل خودرو" }: Props) {
  const selected = findCar(value) || CARS[0];
  const [query, setQuery] = useState(selected.name);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setQuery(selected.name);
  }, [open, selected.name]);

  const results = useMemo(() => searchCars(open ? query : ""), [open, query]);

  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.children[active] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function choose(car: CarModel) {
    onChange(car);
    setQuery(car.name);
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="relative">
      <span className="mb-2 block text-xs font-bold text-slate-300">{label}</span>
      <div className={`flex min-h-12 items-center gap-2 rounded-2xl border bg-night-800/90 px-3 transition ${open ? "border-cyan-300/50 shadow-glow" : "border-white/10"}`}>
        <CarFront className="h-4 w-4 shrink-0 text-cyan-300" />
        <input
          ref={inputRef}
          value={query}
          role="combobox"
          aria-expanded={open}
          aria-controls="car-list"
          aria-autocomplete="list"
          aria-label="جست‌وجوی مدل خودرو"
          placeholder="مثلاً ۲۰۶، تیگو، سمند…"
          onFocus={() => {
            setQuery("");
            setOpen(true);
            setActive(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            }
            if (event.key === "Enter" && open && results.length) {
              event.preventDefault();
              choose(results[Math.min(active, results.length - 1)]);
            }
            if (event.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-slate-500"
        />
        {open ? <Search className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
      </div>

      {open ? (
        <div
          ref={listRef}
          id="car-list"
          role="listbox"
          aria-label="فهرست خودروها"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-white/10 bg-night-800 p-1.5 shadow-2xl"
        >
          {results.length ? (
            results.map((car, index) => {
              const isSelected = car.id === value;
              const isActive = index === active;
              return (
                <button
                  key={car.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(car)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-right transition ${
                    isActive ? "bg-cyan-400/15" : "hover:bg-white/5"
                  }`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-200">
                    <CarFront className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <b className="text-[12px] font-bold text-white">{car.name}</b>
                      <span className="text-[9px] text-slate-500">{car.segment}</span>
                    </span>
                    <span className="mt-0.5 block text-[9.5px] text-slate-400">
                      {car.detail} · مصرف {fa.format(car.consumption)} لیتر در ۱۰۰ کیلومتر
                    </span>
                  </span>
                  {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-cyan-300" /> : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center text-[11px] leading-6 text-slate-400">
              خودرویی با این نام پیدا نشد. مدل خودرو را کوتاه‌تر بنویسید (مثلاً «۲۰۶» یا «تیگو»).
            </p>
          )}
          <p className="mt-1 border-t border-white/5 px-3 py-2 text-[9px] leading-5 text-slate-500">
            {results.length} خودرو · مصرف ترکیبی و ارزش تقریبی بازار، هر دو در محاسبه قابل ویرایش‌اند.
          </p>
        </div>
      ) : null}
    </div>
  );
}
