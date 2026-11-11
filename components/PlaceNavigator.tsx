"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { ArrowUpRight, Check, Compass, Copy, ExternalLink, LoaderCircle, LocateFixed, Navigation, Route, X } from "lucide-react";
import { googleRouteLink, neshanPinLink, neshanRouteLinks, openNeshanNavigation, type NavPoint } from "@/lib/neshan-deeplink";

export type PlaceNavigationPlace = {
  name: string;
  latitude: number;
  longitude: number;
  category?: string;
  address?: string;
};

type Phase = "idle" | "locating" | "routing" | "ready" | "error";

type RouteState =
  | { status: "ok"; distanceKm: number; durationMinutes: number; steps: { instruction: string; distanceMeters: number; durationSeconds: number }[] }
  | { status: "unavailable"; message: string }
  | null;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function formatMeters(meters: number): string {
  if (meters >= 1000) return `${formatNumber(Math.round(meters / 100) / 10)} کیلومتر`;
  return `${formatNumber(Math.round(meters / 10) * 10)} متر`;
}

/**
 * One tap: find where the traveller is, ask Neshan for the real route, then
 * hand the journey over to the Neshan navigator itself — no key, no sign-up.
 * If the phone cannot give a position, the place is opened in Neshan so the
 * traveller can route from wherever they are.
 */
export default function PlaceNavigator({
  place,
  origin,
  originLabel,
  compact = false,
}: {
  place: PlaceNavigationPlace;
  /** Where the trip starts: the chosen accommodation when we know it. */
  origin?: NavPoint | null;
  originLabel?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [position, setPosition] = useState<NavPoint | null>(null);
  const [positionNote, setPositionNote] = useState("");
  const [route, setRoute] = useState<RouteState>(null);
  const [copied, setCopied] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const requested = useRef(false);

  const start = useMemo<NavPoint | null>(() => position || origin || null, [position, origin]);
  const startLabel = position ? "موقعیت فعلی شما" : origin ? originLabel || "اقامتگاه انتخاب‌شده" : "";
  const links = neshanRouteLinks(start, place);
  const pinLink = neshanPinLink(place);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPositionNote("این دستگاه موقعیت مکانی نمی‌دهد؛ مسیر از اقامتگاه انتخاب‌شده حساب می‌شود.");
      setPhase("idle");
      return;
    }
    setPhase("locating");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ latitude: result.coords.latitude, longitude: result.coords.longitude });
        setPositionNote("");
        setPhase("idle");
      },
      () => {
        setPositionNote("دسترسی به موقعیت مکانی داده نشد؛ مسیر از اقامتگاه انتخاب‌شده حساب می‌شود.");
        setPhase("idle");
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 120_000 },
    );
  }, []);

  const askRoute = useCallback(async () => {
    if (!start) {
      setRoute({ status: "unavailable", message: "مبدأ مشخص نیست؛ با دکمهٔ بالا موقعیت خود را پیدا کنید یا مسیر را در نشان باز کنید." });
      return;
    }
    setPhase("routing");
    try {
      const response = await fetch("/api/route/neshan-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin: start, destination: { latitude: place.latitude, longitude: place.longitude }, steps: 10 }),
      });
      const payload = await response.json();
      if (payload?.success) {
        setRoute({
          status: "ok",
          distanceKm: Number(payload.distanceKm) || 0,
          durationMinutes: Number(payload.durationMinutes) || 0,
          steps: Array.isArray(payload.steps) ? payload.steps : [],
        });
        setPhase("ready");
      } else {
        setRoute({ status: "unavailable", message: typeof payload?.error === "string" ? payload.error : "مسیر از سرور نشان خوانده نشد؛ با دکمهٔ پایین مستقیم در مسیریاب نشان باز کنید." });
        setPhase("error");
      }
    } catch {
      setRoute({ status: "unavailable", message: "ارتباط برقرار نشد؛ با دکمهٔ پایین مستقیم در مسیریاب نشان باز کنید." });
      setPhase("error");
    }
  }, [place.latitude, place.longitude, start]);

  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    if (!position && typeof navigator !== "undefined" && navigator.geolocation) locate();
    void askRoute();
  }, [open, askRoute, locate, position]);

  useEffect(() => {
    if (phase === "ready" && position) void askRoute();
    // Re-measure once the real position arrives, so the number matches the trip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  const copyLink = async () => {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.web);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`مسیریابی با نشان تا ${place.name}`}
        className={`group/nav flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 font-extrabold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/20 ${compact ? "px-2 py-1.5 text-[10px]" : "px-3 py-2 text-[11px]"}`}
      >
        <Navigation className="h-3.5 w-3.5 transition group-hover/nav:-rotate-12" />
        مسیریابی با نشان
        <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`مسیریابی تا ${place.name}`}
          >
            <motion.div
              dir="rtl"
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              onClick={(event) => event.stopPropagation()}
              className="glass max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 p-5 sm:max-w-lg sm:rounded-3xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">مسیریاب نشان</span>
                  <h3 className="mt-2 truncate text-lg font-black text-white">{place.name}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                    {place.category ? <span className="rounded-md bg-cyan-400/10 px-1.5 py-0.5 text-cyan-200">{place.category}</span> : null}
                    {place.address ? <span className="truncate">{place.address}</span> : null}
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Where the trip starts */}
              <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/15 text-[10px] font-black text-emerald-300">م</span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">{startLabel || "مبدأ هنوز مشخص نیست"}</span>
                  <button
                    type="button"
                    onClick={locate}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-cyan-200 transition hover:bg-white/10"
                  >
                    {phase === "locating" ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />}
                    موقعیت من
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-400/15 text-[10px] font-black text-cyan-200">ق</span>
                  <span className="min-w-0 flex-1 truncate text-slate-200">{place.name}</span>
                </div>
                {positionNote ? <p className="text-[10px] leading-5 text-amber-200/80">{positionNote}</p> : null}
              </div>

              {/* The measured route */}
              <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3">
                {phase === "routing" ? (
                  <p className="flex items-center gap-2 text-[11px] text-cyan-100">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    مسیر واقعی را از نشان می‌گیرم…
                  </p>
                ) : route?.status === "ok" ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] font-black text-white">
                      <span className="rounded-lg bg-white/10 px-2 py-1">{formatNumber(route.distanceKm)} کیلومتر</span>
                      <span className="rounded-lg bg-white/10 px-2 py-1">≈ {formatNumber(route.durationMinutes)} دقیقه</span>
                      <span className="rounded-md bg-cyan-400/15 px-1.5 py-0.5 text-[9px] font-bold text-cyan-200">با ترافیک زندهٔ نشان</span>
                    </div>
                    {route.steps.length ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowSteps((value) => !value)}
                          className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-cyan-200 underline-offset-4 hover:underline"
                        >
                          <Route className="h-3.5 w-3.5" />
                          {showSteps ? "بستن مسیر گام‌به‌گام" : `دیدن مسیر گام‌به‌گام (${formatNumber(route.steps.length)} گام)`}
                        </button>
                        <AnimatePresence initial={false}>
                          {showSteps && (
                            <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 space-y-1.5 overflow-hidden">
                              {route.steps.map((step, index) => (
                                <li key={`${index}-${step.instruction.slice(0, 12)}`} className="flex items-start gap-2 rounded-xl bg-slate-950/30 p-2 text-[10px] leading-5 text-slate-300">
                                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-[9px] font-black text-cyan-200">{formatNumber(index + 1)}</span>
                                  <span className="min-w-0 flex-1">
                                    {step.instruction}
                                    {step.distanceMeters > 0 ? <span className="mr-1 text-slate-500">· {formatMeters(step.distanceMeters)}</span> : null}
                                  </span>
                                </li>
                              ))}
                            </motion.ol>
                          )}
                        </AnimatePresence>
                      </>
                    ) : null}
                  </>
                ) : (
                  <p className="flex items-start gap-2 text-[10px] leading-6 text-amber-200/85">
                    <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {route?.status === "unavailable" ? route.message : "برای دیدن مسیر، دکمهٔ «موقعیت من» را بزنید."}
                  </p>
                )}
              </div>

              {/* The one tap that actually starts navigating */}
              <button
                type="button"
                onClick={() => {
                  openNeshanNavigation(start, place);
                }}
                className="btn-primary mt-4 w-full !py-3.5 text-sm"
              >
                <Navigation className="h-4 w-4" />
                {start ? "شروع مسیریابی با نشان" : "بازکردن این مکان در نشان"}
              </button>
              <p className="mt-2 text-center text-[10px] leading-5 text-slate-500">
                بدون ثبت‌نام، بدون رمز و بدون نصب اجباری؛ اگر برنامهٔ نشان روی دستگاه باشد باز می‌شود، وگرنه نسخهٔ وب نشان.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-[10px] font-bold text-slate-200 transition hover:bg-white/10"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "کپی شد" : "کپی لینک مسیر"}
                </button>
                <a
                  href={googleRouteLink(start, place)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-[10px] font-bold text-slate-200 transition hover:bg-white/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  مسیر جایگزین (گوگل)
                </a>
              </div>
              {pinLink ? (
                <a href={pinLink} target="_blank" rel="noreferrer noopener" className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 underline-offset-4 hover:text-cyan-200 hover:underline">
                  <Compass className="h-3.5 w-3.5" />
                  دیدن این نقطه روی نقشهٔ نشان
                </a>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
