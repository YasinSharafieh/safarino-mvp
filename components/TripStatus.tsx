"use client";

/**
 * «وضعیت سفر» — the slim bar that answers «کجای سفرم؟» on every screen.
 *
 * Mounted once, in the root layout, so it is genuinely on every phase and cannot
 * drift page by page. It shows the choices the shared trip really holds (route,
 * date, length, travellers, budget), how many of the five steps are done, and
 * **one** next step with a button.
 *
 * It keeps itself out of the way:
 *  - it does not exist until there is a destination;
 *  - it is hidden on the printed book, the offline reader and a shared link,
 *    where a traveller's own status does not belong;
 *  - it never floats over content (no fixed positioning) — the assistant keeps the
 *    corner, this keeps the top of the page;
 *  - on the home page the trip chips are deliberately **not** shown: the home page
 *    is where a trip is started, and a traveller who has not chosen anything yet
 *    was greeted by a strip of «انتخاب نشده» before they had even seen the site.
 *    Only the step progress («۱ از ۵») stays there, so a returning traveller still
 *    knows where the trip stands.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Check, CircleAlert, MapPin, Route, Users, Wallet, X } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { formatJalaliDate } from "@/lib/jalali";
import { ITINERARY_STORAGE_KEY } from "@/lib/itinerary-storage";
import { tripStatus, type StatusChip } from "@/lib/trip-status";
import { verdictCopy, SESSION_KEYS } from "@/lib/trip-session";
import { useSessionVerdict, writeFlag } from "@/lib/trip-session-client";

const ICONS = {
  route: Route,
  date: CalendarDays,
  people: Users,
  budget: Wallet,
  length: CalendarDays,
} as const;

/** Screens where a traveller's own trip bar would be noise or a privacy leak. */
const HIDDEN_PREFIXES = ["/s/", "/itinerary/print", "/offline"];

export default function TripStatus({ className = "" }: { className?: string }) {
  const { travelData, isHydrated, resetTravelData } = useTravel();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [hasPlan, setHasPlan] = useState(false);

  // A plan is real when this device kept one — read, never assumed.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(ITINERARY_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as { success?: boolean; days?: unknown[] }) : null;
      setHasPlan(Boolean(parsed?.success && Array.isArray(parsed.days) && parsed.days.length));
    } catch {
      setHasPlan(false);
    }
  }, [pathname]);

  const status = useMemo(
    () =>
      tripStatus({
        origin: travelData.origin,
        destination: travelData.destination,
        departureDate: travelData.departureDate,
        days: travelData.days,
        travelers: travelData.travelers,
        children: travelData.children,
        infants: travelData.infants,
        budgetMillions: travelData.budget,
        transport: travelData.transport,
        accommodation: travelData.accommodation,
        hasPlan,
        dateLabel: travelData.departureDate ? formatJalaliDate(travelData.departureDate) : null,
      }),
    [hasPlan, travelData],
  );

  /**
   * «رفرش» یا «قدم زدن داخل سایت»؟
   *
   * A traveller who reloaded the page starts over — the strip says so and offers
   * a new trip from step ۱. A traveller who only moved to the home page keeps
   * seeing the trip and the phase they stand on. The decision lives in
   * `lib/trip-session.ts` so it can be tested without a browser.
   */
  const verdict = useSessionVerdict({ hasTrip: isHydrated && status.exists, stage: status.stage });
  const [dismissed, setDismissed] = useState(false);
  /** A new screen is a new moment: a question dismissed on one page is not dismissed everywhere. */
  useEffect(() => setDismissed(false), [pathname]);
  const copy = verdictCopy(verdict, status.stage);

  if (!isHydrated || !status.exists) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;
  // The home page shows the progress only — no route/date/budget strip.
  const isHome = pathname === "/";

  /**
   * A reload asks one question, once: continue the trip that is still on this
   * device, or start a new one? Everything else about the strip stays as it was.
   */
  /**
   * The panel has two jobs, and they are not the same size:
   *  - after a reload it asks the one question that must be asked: continue, or
   *    start a new trip from step ۱;
   *  - on the home page, a traveller who walked here from another screen is told
   *    «داشتی این سفر را برنامه‌ریزی می‌کردی» with a way back. On the other phases
   *    that sentence would only repeat the strip that is already under it.
   */
  const showChoice = !dismissed && (verdict === "fresh-load" || verdict === "finished" || (isHome && verdict === "resume"));

  return (
    <section aria-label="وضعیت سفر" className={`mx-auto mt-3 w-full max-w-6xl px-4 print:hidden sm:px-6 ${className}`}>
      <div className={`rounded-2xl border border-white/10 backdrop-blur ${isHome ? "bg-white/[0.02] px-2.5 py-1.5" : "bg-white/[0.03] px-3 py-2"}`}>
        {showChoice && copy ? (
          <div
            className={`mb-1.5 flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-2 ${
              copy.tone === "ok"
                ? "border-emerald-300/25 bg-emerald-300/[0.07]"
                : "border-cyan-300/25 bg-cyan-300/[0.07]"
            }`}
          >
            <span className="min-w-0 flex-1">
              <b className="block text-[10.5px] font-black text-white">{copy.title}</b>
              <span className="block text-[9px] leading-5 text-slate-300">{copy.body}</span>
            </span>
            {verdict === "fresh-load" ? (
              <>
                <Link
                  href={status.next.href}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-cyan-300 px-2.5 py-1 text-[9.5px] font-black text-slate-950 transition hover:bg-cyan-200"
                  title={`برگرد به مرحلهٔ ${status.stage} از ۵`}
                >
                  ادامهٔ همین سفر
                  <ArrowLeft className="h-2.5 w-2.5" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    resetTravelData();
                    writeFlag(SESSION_KEYS.startFresh, true);
                    writeFlag(SESSION_KEYS.resume, false);
                    setDismissed(true);
                    // A new trip starts at step ۱, so take them where step ۱ lives.
                    router.push("/start/cities");
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[9.5px] font-bold text-slate-200 transition hover:bg-white/10"
                >
                  سفر تازه از مرحلهٔ ۱
                </button>
              </>
            ) : verdict === "resume" ? (
              /**
               * The sentence says «برگرد و ادامه بده», so the button must actually
               * continue — to the very step this trip stands on, which is the same
               * `next.href` the strip underneath would send them to.
               */
              <>
                <Link
                  href={status.next.href}
                  onClick={() => setDismissed(true)}
                  className="flex shrink-0 items-center gap-1 rounded-full bg-cyan-300 px-2.5 py-1 text-[9.5px] font-black text-slate-950 transition hover:bg-cyan-200"
                  title={`برگرد به مرحلهٔ ${status.stage} از ۵`}
                >
                  ادامهٔ همین سفر
                  <ArrowLeft className="h-2.5 w-2.5" />
                </Link>
                <Link
                  href="/start/cities"
                  onClick={() => setDismissed(true)}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[9.5px] font-bold text-slate-200 transition hover:bg-white/10"
                >
                  سفر تازه
                </Link>
              </>
            ) : (
              <Link
                href="/start/cities"
                onClick={() => setDismissed(true)}
                className="flex shrink-0 items-center gap-1 rounded-full bg-cyan-300 px-2.5 py-1 text-[9.5px] font-black text-slate-950 transition hover:bg-cyan-200"
              >
                سفر تازه بساز
                <ArrowLeft className="h-2.5 w-2.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setDismissed(true);
                if (verdict === "fresh-load") writeFlag(SESSION_KEYS.resume, true);
              }}
              aria-label="بستن این پیام"
              className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-1.5">
          {status.chips.filter(() => !isHome).map((chip) => {
            const Icon = ICONS[chip.id];
            return (
              <span
                key={chip.id}
                title={chip.label}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${
                  chip.tone === "ok"
                    ? "border-white/10 bg-white/[0.04] text-slate-200"
                    : "border-amber-300/25 bg-amber-300/[0.06] text-amber-100"
                }`}
              >
                <Icon className="h-2.5 w-2.5 shrink-0 opacity-70" />
                <span className="opacity-60">{chip.label}:</span>
                <b className="font-black">{chip.value}</b>
              </span>
            );
          })}

          {/* How far along the five steps are — dots, not a number to decode. */}
          <span
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] text-slate-300 ${
              isHome ? "border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100" : "border-white/10 bg-black/20"
            }`}
            title={status.progressLabel}
          >
            {status.steps.map((step) => (
              <span
                key={step.id}
                aria-label={`${step.label}: ${step.done ? "انجام شده" : "انجام نشده"}`}
                className={`h-1.5 w-1.5 rounded-full ${step.done ? "bg-emerald-300" : "bg-white/20"}`}
              />
            ))}
            <b className="mr-0.5 font-black text-slate-200">{isHome ? status.stageLabel : status.progressLabel}</b>
          </span>
        </div>

        {/* One next step, with the reason it is next. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-2.5 py-1.5">
          {status.next.id === "book" ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
          ) : (
            <CircleAlert className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
          )}
          <span className="min-w-0 flex-1">
            <b className="block text-[10px] font-black text-white">{status.next.title}</b>
            <span className="block text-[9px] leading-5 text-slate-300">{status.next.why}</span>
          </span>
          <Link
            href={status.next.href}
            className="flex shrink-0 items-center gap-1 rounded-full bg-cyan-300 px-2.5 py-1 text-[9.5px] font-black text-slate-950 transition hover:bg-cyan-200"
          >
            {status.next.cta}
            <ArrowLeft className="h-2.5 w-2.5" />
          </Link>
        </div>

        {/* The stay deserves its own word, because «بدون اقامتگاه» is a decision. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8.5px] text-slate-500">
          <span className="flex items-center gap-0.5">
            <MapPin className="h-2 w-2" />
            مقصد: {status.destination}
          </span>
          <span>·</span>
          <span>{status.steps.find((step) => step.id === "stay")?.done ? "اقامتگاه مشخص شده" : "اقامتگاه هنوز انتخاب نشده"}</span>
          <span>·</span>
          <span>{status.steps.find((step) => step.id === "ticket")?.done ? "بلیت مشخص شده" : "بلیت هنوز انتخاب نشده"}</span>
        </p>
      </div>
    </section>
  );
}
