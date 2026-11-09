"use client";

import { useEffect, useMemo, useState } from "react";
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

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  min?: string;
  label?: string;
};

export default function JalaliDatePicker({ value, onChange, min = todayIso(), label = "تاریخ حرکت شمسی" }: Props) {
  const [error, setError] = useState("");
  const fallback = value || addDaysToIso(todayIso(), 7);
  const selected = jalaliFromGregorian(fallback);
  const currentYear = jalaliFromGregorian(todayIso()).year;
  const years = useMemo(
    () => Array.from(new Set([selected.year, currentYear, currentYear + 1, currentYear + 2])).sort((a, b) => a - b),
    [currentYear, selected.year],
  );
  const dayCount = jalaliMonthDays(selected.year, selected.month);

  useEffect(() => setError(""), [value]);

  function update(part: "year" | "month" | "day", rawValue: string) {
    const next = { ...selected, [part]: Number(rawValue) };
    next.day = Math.min(next.day, jalaliMonthDays(next.year, next.month));
    try {
      const iso = gregorianFromJalali(next.year, next.month, next.day);
      if (iso < min) {
        setError("تاریخ حرکت نمی‌تواند قبل از امروز باشد.");
        return;
      }
      setError("");
      onChange(iso);
    } catch {
      setError("این تاریخ شمسی معتبر نیست.");
    }
  }

  const selectClass = "field min-h-12 cursor-pointer appearance-none bg-night-800 px-3 text-center text-xs text-white";

  return (
    <div>
      <span className="mb-2 block text-xs font-bold text-slate-300">{label}</span>
      <div className="grid grid-cols-3 gap-2" aria-label={label}>
        <label>
          <span className="sr-only">روز</span>
          <select value={selected.day} onChange={(event) => update("day", event.target.value)} className={selectClass}>
            {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day} className="bg-night-800">{toPersianDigits(day)}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">ماه</span>
          <select value={selected.month} onChange={(event) => update("month", event.target.value)} className={selectClass}>
            {JALALI_MONTHS.map((month, index) => (
              <option key={month} value={index + 1} className="bg-night-800">{month}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">سال</span>
          <select value={selected.year} onChange={(event) => update("year", event.target.value)} className={selectClass}>
            {years.map((year) => (
              <option key={year} value={year} className="bg-night-800">{toPersianDigits(year)}</option>
            ))}
          </select>
        </label>
      </div>
      <p className={`mt-2 text-[11px] ${error ? "text-rose-300" : "text-slate-500"}`} aria-live="polite">
        {error || (value ? formatJalaliDate(value) : "روز، ماه و سال حرکت را انتخاب کنید")}
      </p>
    </div>
  );
}
