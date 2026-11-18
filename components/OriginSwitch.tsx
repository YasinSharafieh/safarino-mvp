"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, Repeat, Ticket } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { formatJalaliDate } from "@/lib/jalali";

/**
 * نوار سفر — the trip's own identity, in the top bar of every phase.
 *
 * The old chip printed only «مبدأ: تهران» — a city the site starts from, not a
 * city the traveller chose — and said nothing about where they are going. A
 * traveller glancing at the bar could not tell whether it described their trip
 * or a default. Now the bar shows the whole journey in one line, right to left:
 * where from, where to, when, and how many people — and if the traveller has
 * not chosen a destination yet it says so instead of inventing one.
 *
 * The ۸-year-old default origin is marked as a default, in plain words, so
 * nobody mistakes it for a decision they made.
 */
export default function OriginSwitch() {
  const { travelData, isHydrated } = useTravel();
  if (!isHydrated) return null;

  const origin = (travelData.origin || "").trim();
  const destination = (travelData.destination || "").trim();
  const people = Math.max(1, travelData.travelers + travelData.children + travelData.infants);
  const plane = travelData.preferredMode === "plane";
  const train = travelData.preferredMode === "train";

  return (
    <Link
      href="/start/cities"
      className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-bold text-slate-200 transition hover:border-cyan-300/40 hover:bg-white/[0.09] hover:text-white"
      title="مبدأ، مقصد، تاریخ و تعداد مسافران را عوض کن"
    >
      <MapPin className="h-3 w-3 shrink-0 text-cyan-300" />
      <span className="shrink-0 text-slate-400">از</span>
      <b className="max-w-[5.5rem] truncate text-white sm:max-w-none">{origin || "انتخاب مبدأ"}</b>
      <ArrowLeft className="h-3 w-3 shrink-0 text-slate-500" />
      <span className="shrink-0 text-slate-400">به</span>
      <b className={`max-w-[5.5rem] truncate sm:max-w-none ${destination ? "text-cyan-200" : "text-amber-200/90"}`}>
        {destination || "انتخاب نشده"}
      </b>
      {travelData.departureDate ? (
        <span className="hidden items-center gap-1 border-r border-white/10 pr-1.5 text-slate-400 sm:flex">
          <CalendarDays className="h-3 w-3 text-cyan-300" />
          {formatJalaliDate(travelData.departureDate)}
          {travelData.returnDate ? ` تا ${formatJalaliDate(travelData.returnDate)}` : ""}
        </span>
      ) : null}
      {(plane || train) && travelData.departureDate ? (
        <span className="hidden items-center gap-1 text-slate-400 md:flex">
          <Ticket className="h-3 w-3 text-cyan-300" />
          {plane ? "هواپیما" : "قطار"}
        </span>
      ) : null}
      <span className="hidden shrink-0 text-slate-400 sm:inline">{people} نفر</span>
      <Repeat className="h-3 w-3 shrink-0 text-cyan-200/80 transition group-hover:rotate-180" />
    </Link>
  );
}
