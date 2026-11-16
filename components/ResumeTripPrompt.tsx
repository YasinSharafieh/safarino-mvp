"use client";

/**
 * «یک سفر نیمه‌کاره داری» — the warning before a planner throws away work.
 *
 * The trip lives in this browser. Starting a new one used to silently overwrite
 * yesterday's hotel and ticket, so this asks first: continue the old trip, or
 * start fresh (and only then clear it).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTravel } from "@/app/context/TravelContext";
import { ArrowLeft, CircleAlert, RotateCcw, Trash2 } from "lucide-react";

const STORAGE_KEY = "safarino-travel-data-v1";
const DISMISS_KEY = "safarino-resume-dismissed";
const fa = new Intl.NumberFormat("fa-IR");

type Saved = {
  origin?: string;
  destination?: string;
  departureDate?: string;
  days?: number;
  budget?: number;
  transport?: unknown;
  accommodation?: unknown;
};

function nextStep(saved: Saved): { href: string; label: string } {
  const transportDone = Boolean(saved.transport && typeof saved.transport === "object" && (saved.transport as Record<string, unknown>).status === "selected");
  const stayDone = Boolean(saved.accommodation && typeof saved.accommodation === "object" && (saved.accommodation as Record<string, unknown>).status === "selected");
  if (!transportDone) return { href: "/transport", label: "انتخاب وسیلهٔ سفر" };
  if (!stayDone) return { href: "/accommodation", label: "انتخاب اقامتگاه" };
  return { href: "/plan", label: "دیدن برنامهٔ سفر" };
}

export default function ResumeTripPrompt({ className = "" }: { className?: string }) {
  const { travelData, resetTravelData, isHydrated } = useTravel();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (!raw) {
      setDismissed(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Saved;
      const meaningful = Boolean(parsed?.destination || parsed?.transport || parsed?.accommodation);
      setSaved(meaningful ? parsed : null);
      // The warning is shown once per browser session for the same trip.
      const dismissedFor = window.sessionStorage.getItem(DISMISS_KEY);
      setDismissed(dismissedFor === JSON.stringify([parsed?.destination, parsed?.departureDate]));
    } catch {
      setDismissed(true);
    }
  }, [isHydrated]);

  // A trip already in progress in this session does not need the warning.
  const busy = Boolean(travelData.destination && (travelData.transport || travelData.accommodation));
  if (!isHydrated || dismissed || !saved || busy) return null;

  const step = nextStep(saved);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify([saved?.destination, saved?.departureDate]));
    } catch {
      /* the prompt simply comes back next time */
    }
  };

  const startFresh = () => {
    resetTravelData();
    dismiss();
  };

  return (
    <section className={`glass relative overflow-hidden border-amber-300/30 p-4 sm:p-5 ${className}`} aria-label="سفر نیمه‌کارهٔ قبلی">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-300/15 text-amber-200">
          <CircleAlert className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block text-sm font-black text-white">یک سفر نیمه‌کاره از قبل داری</b>
          <p className="mt-1 text-[11px] leading-6 text-slate-300">
            {saved.destination ? `مقصد ${saved.destination}` : "مقصدت انتخاب شده"}
            {saved.origin ? ` از ${saved.origin}` : ""}
            {saved.departureDate ? ` · تاریخ ${saved.departureDate}` : ""}
            {saved.days ? ` · ${fa.format(Number(saved.days))} روز` : ""}
            {saved.budget ? ` · بودجهٔ ${fa.format(Number(saved.budget))} میلیون تومان` : ""}
            . اگر سفر تازه را شروع کنی، این اطلاعات پاک می‌شود؛ اگر ادامه بدهی، همان‌جا که بودی برمی‌گردی.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={step.href} onClick={dismiss} className="btn-primary !px-4 !py-2.5 text-[11px]">
              <ArrowLeft className="h-3.5 w-3.5" />
              ادامهٔ سفر قبلی — {step.label}
            </Link>
            <button type="button" onClick={startFresh} className="btn-ghost !px-4 !py-2.5 text-[11px]">
              <Trash2 className="h-3.5 w-3.5" />
              سفر تازه را از صفر شروع کن
            </button>
            <button type="button" onClick={dismiss} className="inline-flex items-center gap-1 px-2 py-2.5 text-[10.5px] font-bold text-slate-400 hover:text-white">
              <RotateCcw className="h-3 w-3" />
              فعلاً نمی‌خواهم تصمیم بگیرم
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
