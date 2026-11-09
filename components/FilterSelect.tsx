"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type FilterOption = { value: string; label: string };

type Props = {
  label?: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Extra text under the trigger, e.g. the active filter summary. */
  hint?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * Accessible dark dropdown used instead of the native <select>.
 * The native popup ignores the Midnight Ocean palette on most browsers and
 * renders pale text on a pale list, which is unreadable; this renders the
 * list itself with full contrast.
 */
export default function FilterSelect({ label, value, options, onChange, hint, className = "", ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={wrapper} className={`relative ${className}`}>
      {label && <span className="mt-5 mb-2 block text-xs font-bold text-slate-300">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel || label}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-right text-xs font-bold transition ${
          open
            ? "border-cyan-400/60 bg-cyan-400/10 text-white"
            : "border-white/15 bg-night-800 text-white hover:border-cyan-400/40 hover:bg-white/10"
        }`}
      >
        <span className="truncate text-white">{selected?.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-cyan-300 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {hint && <span className="mt-1.5 block text-[10px] text-slate-500">{hint}</span>}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 z-50 mt-2 max-h-64 overflow-auto rounded-2xl border border-cyan-400/25 bg-[#08202f] p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-right text-xs font-bold transition ${
                    active ? "bg-cyan-400/20 text-cyan-100" : "text-slate-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{option.label}</span>
                  {active && <Check className="h-4 w-4 text-cyan-300" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
