"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
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
  mode?: "journey" | "stay";
  /**
   * Days that really have a ticket, as the ticket search measured them. A day
   * that is absent stays selectable — the map may still be loading — but a day
   * that is present with `null` was asked and had nothing.
   */
  availability?: Record<string, number | null>;
};

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/**
 * تقویم شمسی — one calendar, in every phase, always fully on screen.
 *
 * The old version opened as an `absolute` box inside the page card, so on a
 * laptop screen the bottom rows of the month fell below the fold and the day
 * numbers could not be clicked at all. A traveller who cannot click a day has
 * no trip, so the panel is now a real overlay: a bottom sheet on a phone, a
 * centred card on a desktop, with its own scroll — it can never be cut off by
 * the container it was opened from, whichever page hosts it.
 *
 * It also refuses to walk backwards into the past: a month that has already
 * finished cannot be opened, and the days before today are dimmed even when
 * they belong to the current month.
 */
export default function JalaliRangeCalendar({
  departureDate,
  returnDate,
  roundTrip,
  onRoundTripChange,
  onChange,
  mode = "journey",
  availability,
}: Props) {
  const initial = jalaliFromGregorian(departureDate || addDaysToIso(todayIso(), 7));
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [view, setView] = useState({ year: initial.year, month: initial.month });
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const thisMonth = useMemo(() => jalaliFromGregorian(todayIso()), [activeField]);

  useEffect(() => {
    if (!activeField) return;
    const value = activeField === "return" ? returnDate || departureDate : departureDate;
    if (value) setView(jalaliFromGregorian(value));
    setError("");
  }, [activeField, departureDate, returnDate]);

  // Escape closes, and the page behind the sheet does not scroll under it.
  useEffect(() => {
    if (!activeField) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveField(null);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [activeField]);

  const nearestOpen = useMemo(() => {
    if (!availability) return "";
    const today = todayIso();
    return (
      Object.keys(availability)
        .filter((iso) => availability[iso] !== null && iso >= today)
        .sort()[0] || ""
    );
  }, [availability]);

  const days = useMemo(() => {
    const count = jalaliMonthDays(view.year, view.month);
    const firstIso = gregorianFromJalali(view.year, view.month, 1);
    const offset = (new Date(`${firstIso}T12:00:00Z`).getUTCDay() + 1) % 7;
    return { count, offset, firstIso };
  }, [view]);

  /** A month that ended before today has nothing to offer. */
  const canGoBack = useMemo(() => {
    const firstOfView = gregorianFromJalali(view.year, view.month, 1);
    const firstOfThisMonth = gregorianFromJalali(thisMonth.year, thisMonth.month, 1);
    return firstOfView > firstOfThisMonth;
  }, [view, thisMonth]);

  const moveMonth = useCallback(
    (amount: number) => {
      if (amount < 0 && !canGoBack) {
        setError("ماه‌های گذشته قابل انتخاب نیستند؛ از امروز به بعد را ببین.");
        return;
      }
      setError("");
      setView((current) => {
        const month = current.month + amount;
        if (month < 1) return { year: current.year - 1, month: 12 };
        if (month > 12) return { year: current.year + 1, month: 1 };
        return { year: current.year, month };
      });
    },
    [canGoBack],
  );

  function open(field: Field) {
    if (field === "return" && !roundTrip) return;
    setActiveField((current) => (current === field ? null : field));
  }

  function choose(day: number) {
    if (!activeField) return;
    const iso = gregorianFromJalali(view.year, view.month, day);
    if (iso < todayIso()) {
      setError("تاریخ گذشته قابل انتخاب نیست.");
      return;
    }
    const invalidReturn = mode === "stay" ? iso <= departureDate : iso < departureDate;
    if (activeField === "return" && departureDate && invalidReturn) {
      setError(mode === "stay" ? "تاریخ خروج باید بعد از تاریخ ورود باشد." : "تاریخ برگشت باید بعد از رفت یا برابر با آن باشد.");
      return;
    }
    onChange(activeField === "departure" ? "departureDate" : "returnDate", iso);
    setError("");
    setActiveField(null);
  }

  const fieldLabel = (field: Field) =>
    mode === "stay" ? (field === "departure" ? "تاریخ ورود" : "تاریخ خروج") : field === "departure" ? "تاریخ رفت" : "تاریخ برگشت";

  const inputClass =
    "flex min-h-14 w-full items-center gap-2 rounded-2xl border border-white/10 bg-night-800/90 px-3 text-right transition hover:border-cyan-300/40";

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-300">{mode === "stay" ? "تاریخ ورود و خروج شمسی" : "تاریخ سفر شمسی"}</span>
        {mode === "journey" && (
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => onRoundTripChange(true)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${roundTrip ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}
            >
              رفت و برگشت
            </button>
            <button
              type="button"
              onClick={() => onRoundTripChange(false)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${!roundTrip ? "bg-cyan-300 text-slate-950" : "text-slate-400"}`}
            >
              یک‌طرفه
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => open("departure")}
          aria-haspopup="dialog"
          aria-expanded={activeField === "departure"}
          className={`${inputClass} ${activeField === "departure" ? "!border-cyan-300/50" : ""}`}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-cyan-300" />
          <span className="min-w-0">
            <small className="block text-[10px] text-slate-500">{fieldLabel("departure")}</small>
            <b className="block truncate text-xs text-white">
              {departureDate ? formatJalaliDate(departureDate) : `انتخاب ${fieldLabel("departure")}`}
            </b>
          </span>
        </button>
        <button
          type="button"
          disabled={!roundTrip}
          onClick={() => open("return")}
          aria-haspopup="dialog"
          aria-expanded={activeField === "return"}
          className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-45 ${activeField === "return" ? "!border-cyan-300/50" : ""}`}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-cyan-300" />
          <span className="min-w-0">
            <small className="block text-[10px] text-slate-500">{fieldLabel("return")}</small>
            <b className="block truncate text-xs text-white">
              {!roundTrip
                ? "یک‌طرفه"
                : returnDate
                  ? formatJalaliDate(returnDate)
                  : `انتخاب ${fieldLabel("return")}`}
            </b>
          </span>
        </button>
      </div>

      {mounted && activeField
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={fieldLabel(activeField)}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setActiveField(null);
              }}
            >
              <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-white/15 bg-night-800 p-4 shadow-2xl sm:max-h-[88vh] sm:w-[24rem] sm:rounded-3xl sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <b className="block text-sm font-black text-white">{fieldLabel(activeField)} را انتخاب کن</b>
                    <span className="mt-0.5 block text-[10px] text-slate-400">
                      {mode === "stay" ? "ورود و خروج — شب‌ها حساب می‌شوند" : "همان روزی که بلیت برایش جست‌وجو می‌شود"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveField(null)}
                    aria-label="بستن تقویم"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-white hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/[0.04] p-1.5">
                  <button
                    type="button"
                    onClick={() => moveMonth(1)}
                    aria-label="ماه بعد"
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white hover:bg-white/10"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <b className="text-sm text-white">
                    {JALALI_MONTHS[view.month - 1]} {toPersianDigits(view.year)}
                  </b>
                  <button
                    type="button"
                    onClick={() => moveMonth(-1)}
                    disabled={!canGoBack}
                    aria-label="ماه قبل"
                    className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS.map((day, index) => (
                    <span key={`${day}-${index}`} className="py-1 text-[10px] text-slate-500">
                      {day}
                    </span>
                  ))}
                  {Array.from({ length: days.offset }, (_, index) => (
                    <span key={`empty-${index}`} aria-hidden />
                  ))}
                  {Array.from({ length: days.count }, (_, index) => index + 1).map((day) => {
                    const iso = gregorianFromJalali(view.year, view.month, day);
                    const selected = iso === (activeField === "departure" ? departureDate : returnDate);
                    const past = iso < todayIso();
                    const disabled =
                      past ||
                      (activeField === "return" &&
                        Boolean(departureDate) &&
                        (mode === "stay" ? iso <= departureDate : iso < departureDate));
                    const price = availability?.[iso];
                    const open = typeof price === "number";
                    const soldOut = price === null;
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={disabled}
                        onClick={() => choose(day)}
                        aria-label={`${toPersianDigits(day)} ${JALALI_MONTHS[view.month - 1]}`}
                        title={open ? `از ${new Intl.NumberFormat("fa-IR").format(price)} تومان` : soldOut ? "برای این روز بلیتی باز نشده" : undefined}
                        className={`relative grid aspect-square place-items-center rounded-xl text-[13px] font-bold transition ${
                          selected
                            ? "bg-cyan-300 text-slate-950"
                            : open
                              ? "bg-emerald-400/10 text-white ring-1 ring-emerald-400/30 hover:bg-emerald-400/20"
                              : "text-white hover:bg-cyan-300/15"
                        } ${soldOut ? "!text-slate-600" : ""} disabled:cursor-not-allowed disabled:text-slate-700`}
                      >
                        {toPersianDigits(day)}
                        {open ? <span className="absolute inset-x-0 bottom-1 mx-auto h-1 w-1 rounded-full bg-emerald-300" /> : null}
                      </button>
                    );
                  })}
                </div>

                {availability && activeField === "departure" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                    <span className="flex items-center gap-1 text-[9.5px] text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> روزی که واقعاً بلیت دارد
                    </span>
                    {nearestOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          onChange("departureDate", nearestOpen);
                          setActiveField(null);
                        }}
                        className="mr-auto rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-2 py-1 text-[9.5px] font-bold text-emerald-100 transition hover:bg-emerald-300/20"
                      >
                        نزدیک‌ترین روز باز: {formatJalaliDate(nearestOpen)}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <p className={`mt-3 min-h-5 text-[11px] ${error ? "text-rose-300" : "text-slate-500"}`} aria-live="polite">
                  {error || `روی هر روز بزن تا ${fieldLabel(activeField)} ثبت شود.`}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
