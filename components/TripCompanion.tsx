"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Compass, LoaderCircle, Sparkles, X } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { chosenTransport } from "@/lib/transport-selection";
import { COMPANION_EVENT, companionGauge, companionTips, type CompanionContext, type CompanionTip } from "@/lib/companion";

/**
 * «همسفر سفرینو» — the floating orb.
 *
 * Everything it says is computed from the trip itself (budget, dates, vehicle,
 * weather), so it can react the instant something changes without spending a
 * single token. The model is only asked to rephrase a tip the traveller has
 * already seen, and only when they press «بیشتر بگو».
 */

type WeatherLite = { code: number; minC: number | null; maxC: number | null; rainProbability: number | null };

const TONE_STYLE: Record<CompanionTip["tone"], { ring: string; dot: string; title: string }> = {
  alert: { ring: "border-rose-400/30 bg-rose-400/[0.08]", dot: "bg-rose-400", title: "text-rose-100" },
  warn: { ring: "border-amber-400/30 bg-amber-400/[0.07]", dot: "bg-amber-400", title: "text-amber-100" },
  good: { ring: "border-emerald-400/30 bg-emerald-400/[0.07]", dot: "bg-emerald-400", title: "text-emerald-100" },
  info: { ring: "border-cyan-400/25 bg-cyan-400/[0.06]", dot: "bg-cyan-300", title: "text-cyan-100" },
};

function readStayCost(raw: unknown): number {
  if (!raw || typeof raw !== "object") return 0;
  const value = Number((raw as Record<string, unknown>).cost);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export default function TripCompanion() {
  const { travelData, isHydrated } = useTravel();
  const [open, setOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherLite[] | null>(null);
  const [aiText, setAiText] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState<string | null>(null);
  const [seenCount, setSeenCount] = useState(0);
  const [hidden, setHidden] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(() => chosenTransport(travelData.transport), [travelData.transport]);
  const stayCost = readStayCost(travelData.accommodation);
  const people = Math.max(1, Number(travelData.travelers || 1) + Number(travelData.children || 0));

  // The forecast is read once per destination+date and kept for three hours; the
  // orb never blocks the page on it and simply says nothing about weather if it
  // cannot be read.
  useEffect(() => {
    if (!isHydrated || !travelData.destination || !travelData.departureDate) return;
    const key = `safarino:companion-weather:v2:${travelData.destination}:${travelData.departureDate}:${travelData.days}`;
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; days: WeatherLite[] };
        if (Date.now() - parsed.at < 3 * 60 * 60 * 1000) {
          setWeather(parsed.days);
          return;
        }
      }
    } catch {
      // A blocked storage only means the forecast is read again.
    }
    let cancelled = false;
    fetch("/api/weather/trip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: travelData.destination, days: Math.max(1, Number(travelData.days) || 3), startDate: travelData.departureDate }),
    })
      .then((response) => response.json())
      .then((payload: { success?: boolean; days?: WeatherLite[] }) => {
        if (cancelled || !payload?.success || !Array.isArray(payload.days)) return;
        const days = payload.days.map((day) => ({ code: day.code, minC: day.minC, maxC: day.maxC, rainProbability: day.rainProbability }));
        setWeather(days);
        try {
          window.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), days }));
        } catch {
          // Ignore unavailable storage.
        }
      })
      .catch(() => {
        // The orb simply does not talk about the weather.
      });
    return () => {
      cancelled = true;
    };
  }, [isHydrated, travelData.days, travelData.departureDate, travelData.destination]);

  const context: CompanionContext = useMemo(
    () => ({
      origin: travelData.origin,
      destination: travelData.destination,
      budgetMillions: Number(travelData.budget) || 0,
      days: Math.max(1, Number(travelData.days) || 1),
      travellers: people,
      children: Number(travelData.children) || 0,
      mode: transport?.mode || travelData.preferredMode || "",
      carName: (travelData.transport as Record<string, unknown> | null)?.carName as string | undefined,
      transportToman: transport?.cost || 0,
      stayToman: stayCost,
      departureDate: travelData.departureDate || null,
      todayIso: new Date().toISOString().slice(0, 10),
      weather,
    }),
    [people, stayCost, transport, travelData.budget, travelData.children, travelData.days, travelData.departureDate, travelData.destination, travelData.origin, travelData.preferredMode, travelData.transport, weather],
  );

  const tips = useMemo(() => companionTips(context), [context]);
  const gauge = useMemo(() => companionGauge(context), [context]);
  const urgent = tips.find((tip) => tip.tone === "alert" || tip.tone === "warn") || tips[0];

  // A page can ask the orb to speak about something specific.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tipId?: string }>).detail;
      setOpen(true);
      setHidden(false);
      if (detail?.tipId) setAsking(detail.tipId);
    };
    window.addEventListener(COMPANION_EVENT, handler);
    return () => window.removeEventListener(COMPANION_EVENT, handler);
  }, []);

  const askAi = useCallback(
    async (tipId: string) => {
      setAsking(tipId);
      try {
        const response = await fetch("/api/companion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(25_000),
          body: JSON.stringify({ tipId, context }),
        });
        const payload = (await response.json()) as { success?: boolean; text?: string };
        if (payload?.success && payload.text) setAiText((current) => ({ ...current, [tipId]: payload.text as string }));
      } catch {
        // The local sentence is already on screen — nothing to report.
      } finally {
        setAsking(null);
      }
    },
    [context],
  );

  if (!isHydrated || hidden) return null;
  const showBadge = tips.some((tip) => tip.tone === "alert" || tip.tone === "warn") && !open && seenCount === 0;

  return (
    <div dir="rtl" className="fixed bottom-4 left-4 z-40 print:hidden">
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="mb-3 w-[min(92vw,360px)] overflow-hidden rounded-3xl border border-white/12 bg-[#0d0820]/95 shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-l from-violet-500/15 to-transparent px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-cyan-400 text-slate-950">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="leading-tight">
                  <b className="block text-[11px] font-black text-white">همسفر سفرینو</b>
                  <span className="text-[8.5px] text-slate-400">
                    {gauge.zoneLabel} · {new Intl.NumberFormat("fa-IR").format(Math.round(gauge.usedPct))}٪ بودجه
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setSeenCount((current) => current + 1);
                }}
                aria-label="بستن همسفر"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[62vh] space-y-2 overflow-y-auto p-3">
              {tips.map((tip) => {
                const tone = TONE_STYLE[tip.tone];
                const text = aiText[tip.id];
                return (
                  <div key={tip.id} className={`rounded-2xl border p-2.5 ${tone.ring}`}>
                    <p className={`flex items-center gap-1.5 text-[10.5px] font-black ${tone.title}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      {tip.title}
                    </p>
                    <p className="mt-1 text-[10px] leading-6 text-slate-300">{text || tip.body}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {tip.action ? (
                        <a href={tip.action.href} className="inline-flex items-center gap-1 text-[9.5px] font-bold text-cyan-200 hover:text-cyan-100">
                          {tip.action.label}
                          <ArrowLeft className="h-2.5 w-2.5" />
                        </a>
                      ) : null}
                      {!aiText[tip.id] ? (
                        <button
                          type="button"
                          onClick={() => void askAi(tip.id)}
                          disabled={asking === tip.id}
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
                        >
                          {asking === tip.id ? <LoaderCircle className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                          {asking === tip.id ? "در حال نوشتن…" : "بیشتر بگو"}
                        </button>
                      ) : (
                        <span className="text-[8.5px] text-violet-200/70">بازنویسی‌شده با هوش مصنوعی، بر پایهٔ همان اعداد</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-[8.5px] leading-5 text-slate-500">
                این پیام‌ها از اعداد واقعی سفر خودت ساخته می‌شوند (بودجه، تاریخ، وسیله، هوای پیش‌بینی‌شده)؛ هیچ‌کدام حدس نیست.
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen((current) => !current);
            setSeenCount((current) => current + 1);
          }}
          aria-label={open ? "بستن همسفر سفرینو" : "همسفر سفرینو"}
          className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-slate-950 shadow-[0_10px_40px_rgba(168,85,247,0.5)] transition hover:scale-105"
        >
          <span className="absolute inset-0 animate-pulse rounded-full bg-violet-400/25" />
          <Compass className="relative h-5 w-5" strokeWidth={2.4} />
          {showBadge ? <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#120a26] bg-amber-400" /> : null}
        </button>
        {!open && urgent ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="max-w-[54vw] truncate rounded-2xl border border-white/10 bg-[#0d0820]/90 px-2.5 py-1.5 text-[9.5px] text-slate-200 shadow-lg backdrop-blur"
          >
            <b className="text-white">{urgent.title}</b>
            <span className="mx-1 text-slate-500">·</span>
            {urgent.body.slice(0, 46)}…
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Pages call this to make the orb speak about something they just noticed. */
export function pingCompanion(tipId?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMPANION_EVENT, { detail: { tipId } }));
}
