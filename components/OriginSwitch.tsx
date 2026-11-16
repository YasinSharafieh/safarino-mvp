"use client";

import Link from "next/link";
import { MapPin, Repeat } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";

/**
 * «تغییر مبدأ» — the origin sits in the top bar of every page.
 *
 * Changing it anywhere changes it everywhere: the trip is stored once in the
 * shared context, so the ticket search, the packages and the plan all read the
 * same city. Pressing it opens the trip form with the current trip in place.
 */
export default function OriginSwitch() {
  const { travelData, isHydrated } = useTravel();
  if (!isHydrated || !travelData.origin) return null;
  return (
    <Link
      href="/start/cities"
      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-[10px] font-bold text-slate-200 transition hover:border-cyan-300/40 hover:bg-white/[0.09] hover:text-white"
      title="مبدأ، مقصد و تاریخ سفر را عوض کن"
    >
      <MapPin className="h-3 w-3 text-cyan-300" />
      <span className="hidden sm:inline">مبدأ:</span>
      {travelData.origin}
      <Repeat className="h-3 w-3 text-cyan-200/80" />
    </Link>
  );
}
