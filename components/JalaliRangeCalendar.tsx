"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  JALALI_MONTHS,
  addDaysToIso,
  formatJalaliDate,
  gregorianFromJalali,
  jalaliFromGregorian,
  jalaliMonthDays,
  toPersianDigits,
  todayIso,
} from "@/lib/jalali";

type Field = "departure" | "return";

type Props = {
  departureDate: string;
  returnDate: string;
  roundTrip: boolean;
  onRoundTripChange: (value: boolean) => void;
  onChange: (field: "departureDate" | "returnDate", isoDate: string) => void;
};

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export default function JalaliRangeCalendar({ departureDate, returnDate, roundTrip, onRoundTripChange, onChange }: Props) {
  const initial = jalaliFromGregorian(departureDate || addDaysToIso(todayIso(), 7));
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeField) return;
    const value = activeField === "return" ? returnDate || departureDate : departureDate;
    if (value) setView(jalaliFromGregorian(value));
    setError("");
  }, [activeField, departureDate, returnDate]);

  const days = useMemo(() => {
    const count = jalaliMonthDays(view.year, view.month);
    const firstIso = gregorianFromJalali(view.year, view.month, 1);
    const offset = (new Date(`${firstIso}T12:00:00Z`).getUTCDay() + 1) % 7;
    return { count, offset };
  }, [view]);

  function moveMonth(amount: number) {
    const month = view.month + amount;
    if (month < 1) setView({ year: view.year - 1, month: 12 });
    else if (month > 12) setView({ year: view.year + 1, month: 1 });
    else setView({ ...view, month });
  }

  function choose(day: number) {
    if (!activeField) return;
    const iso = gregorianFromJalali(view.year, view.month, day);
    if (iso < todayIso()) {
      setError("تاریخ گذشته قابل انتخاب نیست.");
      return;
    }
    if (activeField === "return" && departureDate && iso < departureDate) {
      setError("تاریخ برگشت باید بعد از رفت یا برابر با آن باشد.");
      return;
    }
    onChange(activeField === "departure" ? "departureDate" : "returnDate", iso);
    setActiveField(null);
  }

  function open(field: Field) {
    if (field === "return" && !roundTrip) return;
    setActiveField((current) => current === field ? null : field);
  }

  const inputClass = "flex min-h-14 w-full items-center gap-2 rounded-2xl border border-white/10 bg-night-800/90 px-3 text-right transition hover:border-cyan-300/40";

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-300">تاریخ سفر شمسی</span>
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => onRoundTripChange(false)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${!roundTrip ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}
          >یک‌طرفه</button>
          <button
            type="button"
            onClick={() => onRoundTripChange(true)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${roundTrip ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}
          >رفت و برگشت</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => open("departure")} className={`${inputClass} ${activeField === "departure" ? "!border-cyan-300/50" : ""}`}>
          <CalendarDays className="h-4 w-4 shrink-0 text-cyan-300" />
          <span>
            <small className="block text-[10px] text-slate-500">تاریخ رفت</small>
            <b className="text-xs text-white">{departureDate ? formatJalaliDate(departureDate) : "انتخاب تاریخ رفت"}</b>
          </span>
        </button>
        <button type="button" disabled={!roundTrip} onClick={() => open("return")} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-45 ${activeField === "return" ? "!border-cyan-300/50" : ""}`}>
          <CalendarDays className="h-4 w-4 shrink-0 text-cyan-300" />
          <span>
            <small className="block text-[10px] text-slate-500">تاریخ برگشت</small>
            <b className="text-xs text-white">{roundTrip ? returnDate ? formatJalaliDate(returnDate) : "انتخاب تاریخ برگشت" : "یک‌طرفه"}</b>
          </span>
        </button>
      </div>

      {activeField && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 rounded-3xl border border-white/15 bg-night-800 p-4 shadow-2xl sm:right-0 sm:left-auto sm:w-[25rem]">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد" className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white hover:bg-white/10"><ChevronRight className="h-4 w-4" /></button>
            <b className="text-sm text-white">{JALALI_MONTHS[view.month - 1]} {toPersianDigits(view.year)}</b>
            <button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل" className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`} className="py-2 text-[10px] text-slate-500">{day}</span>)}
            {Array.from({ length: days.offset }, (_, index) => <span key={`empty-${index}`} />)}
            {Array.from({ length: days.count }, (_, index) => index + 1).map((day) => {
              const iso = gregorianFromJalali(view.year, view.month, day);
              const selected = iso === (activeField === "departure" ? departureDate : returnDate);
              const disabled = iso < todayIso() || activeField === "return" && Boolean(departureDate) && iso < departureDate;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => choose(day)}
                  className={`aspect-square rounded-xl text-xs font-bold transition ${selected ? "bg-cyan-300 text-slate-950" : "text-white hover:bg-cyan-300/15"} disabled:cursor-not-allowed disabled:text-slate-700`}
                >{toPersianDigits(day)}</button>
              );
            })}
          </div>
          <p className={`mt-3 min-h-5 text-[11px] ${error ? "text-rose-300" : "text-slate-500"}`}>
            {error || `انتخاب ${activeField === "departure" ? "تاریخ رفت" : "تاریخ برگشت"}`}
          </p>
        </div>
      )}
    </div>
  );
}
