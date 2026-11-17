"use client";

/**
 * «آیا این روز جا می‌شود؟» — the timing audit as a card.
 *
 * It shows only what `lib/route-timing` computed from real clock times and real
 * measured legs: where a day starts, where it ends, how long it is, and — when a
 * day cannot work — the exact two stops that do not fit. A day whose legs were
 * never measured is called «تخمینی» on the card, never «اوکی».
 */

import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Gauge, Info, Route } from "lucide-react";
import { faClock, faDuration, timingStatusLabel, tripTiming, type DayTiming, type TimingStatus } from "@/lib/route-timing";

const TONE: Record<TimingStatus, string> = {
  ok: "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-100",
  tight: "border-amber-300/25 bg-amber-300/[0.07] text-amber-100",
  impossible: "border-rose-400/30 bg-rose-400/[0.08] text-rose-100",
  estimated: "border-sky-300/25 bg-sky-300/[0.07] text-sky-100",
  empty: "border-white/10 bg-white/[0.03] text-slate-300",
};

const ICON: Record<TimingStatus, typeof CheckCircle2> = {
  ok: CheckCircle2,
  tight: AlertTriangle,
  impossible: AlertTriangle,
  estimated: Info,
  empty: Info,
};

export default function RouteTimingCard({
  days,
  className = "",
  title = "زمان‌سنجی واقعی روزها",
  /**
   * «فشرده» for the planning step: one line about the whole trip, no table. The
   * full per-day table lives on the trip page and in the printed book.
   */
  compact = false,
}: {
  days: DayTiming[];
  className?: string;
  title?: string;
  compact?: boolean;
}) {
  const summary = tripTiming(days);
  if (!summary.days.length) return null;

  if (compact) {
    const worst =
      summary.days.find((day) => day.status === "impossible") ||
      summary.days.find((day) => day.status === "tight") ||
      null;
    return (
      <div className={`flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 ${className}`} aria-live="polite">
        <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200" />
        <p className="min-w-0 text-[10px] leading-5 text-slate-200">
          <b className="font-black text-white">زمان‌سنجی: </b>
          {summary.headline}
          {worst && worst.notes[0] ? <span className="text-slate-400"> {worst.notes[0]}</span> : null}
        </p>
      </div>
    );
  }

  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:p-4 ${className}`} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-black text-white">
          <CalendarClock className="h-3.5 w-3.5 text-cyan-200" />
          {title}
        </h3>
        <span className="flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[9px] text-slate-300">
          <Route className="h-2.5 w-2.5" />
          {summary.days.reduce((sum, day) => sum + day.measuredLegs, 0)} مسیر اندازه‌گیری‌شده
        </span>
      </div>

      <p className="mt-1.5 text-[10px] leading-5 text-slate-300">{summary.headline}</p>

      <div className="mt-2 space-y-1.5">
        {summary.days.map((day) => {
          const Icon = ICON[day.status];
          return (
            <div key={day.day} className={`rounded-xl border px-2.5 py-2 ${TONE[day.status]}`}>
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <p className="text-[10px] font-black">
                  روز {new Intl.NumberFormat("fa-IR").format(day.day)}
                  <span className="mr-1 font-normal opacity-70">{day.title && day.title !== `روز ${new Intl.NumberFormat("fa-IR").format(day.day)}` ? `· ${day.title}` : ""}</span>
                </p>
                <span className="flex items-center gap-1 rounded-full border border-white/20 bg-black/20 px-1.5 py-0.5 text-[9px] font-black">
                  <Icon className="h-2.5 w-2.5" />
                  {timingStatusLabel(day.status)}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] opacity-90">
                <span>شروع {faClock(day.startMinutes)}</span>
                <span>پایان {faClock(day.endMinutes)}</span>
                <span className="flex items-center gap-0.5">
                  <Gauge className="h-2.5 w-2.5" />
                  {faDuration(day.lengthMinutes)}
                </span>
                <span>{new Intl.NumberFormat("fa-IR").format(day.stops)} توقف</span>
                {day.driveMinutes > 0 ? <span>رانندگی {faDuration(day.driveMinutes)}</span> : null}
                {day.totalLegs > day.measuredLegs ? (
                  <span className="text-amber-200">
                    {new Intl.NumberFormat("fa-IR").format(day.totalLegs - day.measuredLegs)} مسیر اندازه‌گیری نشده
                  </span>
                ) : null}
              </div>

              {day.conflicts.length ? (
                <p className="mt-1 rounded-lg border border-rose-300/25 bg-rose-500/10 px-2 py-1 text-[9px] leading-5 text-rose-50">
                  «{day.conflicts[0].from}» → «{day.conflicts[0].to}»: رانندگی {faDuration(day.conflicts[0].neededMinutes)}، فاصلهٔ برنامه {faDuration(day.conflicts[0].availableMinutes)}. یکی از این دو را جابه‌جا یا حذف کن.
                </p>
              ) : null}

              {day.notes.length ? (
                <ul className="mt-1 space-y-0.5">
                  {day.notes.slice(0, 2).map((note, index) => (
                    <li key={index} className="flex items-start gap-1 text-[9px] leading-5 opacity-85">
                      <span className="mt-2 h-0.5 w-0.5 shrink-0 rounded-full bg-current" />
                      <span className="min-w-0">{note}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
