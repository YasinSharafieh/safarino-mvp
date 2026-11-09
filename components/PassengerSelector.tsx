"use client";

import { useState } from "react";
import { ChevronDown, Minus, Plus, Users } from "lucide-react";

type Field = "travelers" | "children" | "infants";

type Props = {
  adults: number;
  children: number;
  infants: number;
  onChange: (field: Field, value: number) => void;
};

export default function PassengerSelector({ adults, children, infants, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const total = adults + children + infants;
  const rows = [
    { field: "travelers" as const, title: "بزرگسال", subtitle: "۱۲ سال و بیشتر", value: adults, min: 1, max: 9 },
    { field: "children" as const, title: "کودک", subtitle: "۲ تا ۱۲ سال", value: children, min: 0, max: 9 },
    { field: "infants" as const, title: "نوزاد", subtitle: "کمتر از ۲ سال", value: infants, min: 0, max: adults },
  ];

  return (
    <div className="relative">
      <span className="mb-2 block text-xs font-bold text-slate-300">مسافران</span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border bg-night-800/90 px-3 text-right transition ${open ? "border-cyan-300/50" : "border-white/10 hover:border-cyan-300/40"}`}
      >
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-300" />
          <span>
            <b className="block text-xs text-white">{total.toLocaleString("fa-IR")} مسافر</b>
            <small className="mt-0.5 block text-[10px] text-slate-500">
              {adults.toLocaleString("fa-IR")} بزرگسال{children ? `، ${children.toLocaleString("fa-IR")} کودک` : ""}{infants ? `، ${infants.toLocaleString("fa-IR")} نوزاد` : ""}
            </small>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {open && (
        <>
          <button type="button" aria-label="بستن" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 rounded-2xl border border-white/15 bg-night-800 p-4 shadow-2xl">
            {rows.map((row) => (
              <div key={row.field} className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-0">
                <span>
                  <b className="block text-xs text-white">{row.title}</b>
                  <small className="mt-1 block text-[10px] text-slate-500">{row.subtitle}</small>
                </span>
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={`افزایش ${row.title}`}
                    disabled={row.value >= row.max}
                    onClick={() => onChange(row.field, row.value + 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-300/10 text-cyan-200 disabled:opacity-30"
                  ><Plus className="h-4 w-4" /></button>
                  <b className="w-5 text-center text-sm text-white">{row.value.toLocaleString("fa-IR")}</b>
                  <button
                    type="button"
                    aria-label={`کاهش ${row.title}`}
                    disabled={row.value <= row.min}
                    onClick={() => onChange(row.field, row.value - 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white disabled:opacity-30"
                  ><Minus className="h-4 w-4" /></button>
                </span>
              </div>
            ))}
            <button type="button" onClick={() => setOpen(false)} className="btn-primary mt-3 w-full !min-h-10 !py-2 !text-xs">تأیید مسافران</button>
          </div>
        </>
      )}
    </div>
  );
}
