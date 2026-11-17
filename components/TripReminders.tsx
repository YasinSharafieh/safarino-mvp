"use client";

/**
 * «چه کاری عقب است؟» — the trip's own checklist, computed, not written by hand.
 *
 * Every line comes from `lib/trip-reminders`, which only produces a reminder when
 * the condition is genuinely true for this trip. A clean trip shows one calm
 * sentence instead of invented chores.
 */

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, Info } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { reminderHeadline, tripReminders, type Reminder } from "@/lib/trip-reminders";
import { chosenTransport } from "@/lib/transport-selection";
import { tripCostBreakdown } from "@/lib/trip-costs";

const STYLE: Record<Reminder["severity"], { ring: string; icon: typeof AlertTriangle; tint: string }> = {
  now: { ring: "border-rose-400/30 bg-rose-400/[0.07]", icon: AlertTriangle, tint: "text-rose-200" },
  soon: { ring: "border-amber-300/25 bg-amber-300/[0.06]", icon: AlertTriangle, tint: "text-amber-200" },
  info: { ring: "border-white/10 bg-white/[0.03]", icon: Info, tint: "text-slate-300" },
};

export default function TripReminders({
  className = "",
  /**
   * «فشرده» — used inside the transport, accommodation and plan steps, where the
   * page is already busy: only the things that must be done *now*, at most two,
   * in one thin strip. The full list lives on the trip page.
   */
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { travelData, isHydrated } = useTravel();

  const reminders = useMemo(() => {
    if (!isHydrated) return [];
    const travellers = Math.max(1, Number(travelData.travelers || 1) + Number(travelData.children || 0) + Number(travelData.infants || 0));
    const days = Math.max(1, Number(travelData.days) || 1);
    const transport = chosenTransport(travelData.transport);
    const stayCost = Number((travelData.accommodation as Record<string, unknown> | null)?.cost) || 0;
    const stayStatus = String((travelData.accommodation as Record<string, unknown> | null)?.status || "");
    const budgetToman = Math.max(0, Math.round((Number(travelData.budget) || 0) * 1_000_000));
    const costs = tripCostBreakdown({
      totalBudget: budgetToman,
      travellers,
      days,
      nights: Math.max(1, days - 1),
      city: travelData.destination,
      tickets: transport?.cost || 0,
      stay: stayCost,
    });
    return tripReminders({
      origin: travelData.origin,
      destination: travelData.destination,
      departureDate: travelData.departureDate || null,
      returnDate: travelData.returnDate || null,
      days,
      travellers: Number(travelData.travelers) || 1,
      children: Number(travelData.children) || 0,
      budgetToman,
      ticketToman: transport?.cost || 0,
      ticketLabel: transport?.title || transport?.modeLabel || null,
      stayToman: stayCost,
      stayLabel: String((travelData.accommodation as Record<string, unknown> | null)?.name || "") || null,
      staySkipped: stayStatus === "skipped",
      dailyTotalToman: costs.food + costs.activities + costs.localTransport,
    });
  }, [isHydrated, travelData]);

  if (!isHydrated || !travelData.destination) return null;

  if (compact) {
    const urgent = reminders.filter((reminder) => reminder.severity === "now").slice(0, 2);
    if (!urgent.length) return null;
    return (
      <div className={`rounded-xl border border-rose-400/25 bg-rose-400/[0.07] px-2.5 py-1.5 ${className}`} aria-label="کارهای فوری این مرحله">
        <ul className="space-y-1">
          {urgent.map((reminder) => (
            <li key={reminder.id} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-rose-200" />
              <span className="min-w-0 text-[9.5px] leading-5 text-rose-50">
                <b className="font-black">{reminder.title}: </b>
                {reminder.detail}
                {reminder.action ? (
                  <Link href={reminder.action.href} className="mr-1 font-black text-cyan-200 hover:text-cyan-100">
                    {reminder.action.label} →
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!reminders.length) {
    return (
      <section className={`glass flex items-center gap-2 p-3 ${className}`} aria-label="کارهای عقب‌مانده">
        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        <p className="text-[10.5px] text-emerald-100">{reminderHeadline(reminders)}</p>
      </section>
    );
  }

  return (
    <section className={`glass overflow-hidden p-4 ${className}`} aria-label="کارهای عقب‌مانده">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-[11px] font-black text-white">چه کاری عقب است؟</b>
        <span className="text-[9px] text-slate-400">{reminderHeadline(reminders)}</span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {reminders.map((reminder) => {
          const style = STYLE[reminder.severity];
          const Icon = style.icon;
          return (
            <li key={reminder.id} className={`rounded-xl border px-2.5 py-2 ${style.ring}`}>
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${style.tint}`} />
                <div className="min-w-0 flex-1">
                  <b className={`block text-[10.5px] font-black ${style.tint}`}>{reminder.title}</b>
                  <p className="mt-0.5 text-[9.5px] leading-5 text-slate-300">{reminder.detail}</p>
                  {reminder.action ? (
                    <Link
                      href={reminder.action.href}
                      className="mt-1 inline-flex items-center gap-1 text-[9px] font-black text-cyan-200 transition hover:text-cyan-100"
                    >
                      {reminder.action.label}
                      <ArrowLeft className="h-2.5 w-2.5" />
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
