"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Compass, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { chosenTransport } from "@/lib/transport-selection";
import { COMPANION_EVENT, companionGauge, companionTips, type CompanionContext, type CompanionTip } from "@/lib/companion";
import { ASK_EXAMPLES, type AskFacts } from "@/lib/companion-ask";
import { CITY_PROFILES } from "@/lib/city-profiles";
import { tripCostBreakdown } from "@/lib/trip-costs";

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
  const [tipAsking, setTipAsking] = useState<string | null>(null);
  const [seenCount, setSeenCount] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ text: string; source: "ai" | "local"; note?: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [asksLeft, setAsksLeft] = useState(8);
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
      if (detail?.tipId) setTipAsking(detail.tipId);
    };
    window.addEventListener(COMPANION_EVENT, handler);
    return () => window.removeEventListener(COMPANION_EVENT, handler);
  }, []);

  const askAi = useCallback(
    async (tipId: string) => {
      setTipAsking(tipId);
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
        setTipAsking(null);
      }
    },
    [context],
  );

  /**
   * The facts the companion is allowed to speak about — built from the very
   * numbers the whole site uses, so an answer can never disagree with a page.
   */
  const askFacts = useMemo<AskFacts>(() => {
    const budgetToman = Math.max(0, Math.round((Number(travelData.budget) || 0) * 1_000_000));
    const days = Math.max(1, Number(travelData.days) || 1);
    const estimate = tripCostBreakdown({
      totalBudget: budgetToman,
      travellers: people,
      days,
      nights: Math.max(1, days - 1),
      city: travelData.destination || "",
      tickets: transport?.cost || 0,
      stay: stayCost,
    });
    const cityProfile = CITY_PROFILES.find((profile) => profile.name === travelData.destination) || null;
    return {
      origin: travelData.origin || "—",
      destination: travelData.destination || "—",
      days,
      travellers: people,
      children: Number(travelData.children) || 0,
      budgetToman,
      transportToman: transport?.cost || 0,
      transportLabel: transport?.title || transport?.modeLabel || "انتخاب نشده",
      stayToman: stayCost,
      stayName: String((travelData.accommodation as Record<string, unknown> | null)?.name || "") || "انتخاب نشده",
      foodToman: estimate.food,
      remainingToman: estimate.remaining,
      departureDate: travelData.departureDate || null,
      placeNames: [],
      destinationProfile: cityProfile
        ? {
            tagline: cityProfile.tagline,
            highlights: cityProfile.highlights,
            bestFor: cityProfile.bestFor,
            bestSeason: cityProfile.bestSeason,
            province: cityProfile.province,
          }
        : null,
      weather: (weather || []).map((day) => ({
        label: ["آسمان صاف", "کمی ابری", "ابری", "باران", "برف", "رعد و برق"][day.code >= 95 ? 5 : day.code >= 71 ? 4 : day.code >= 51 ? 3 : day.code >= 3 ? 2 : day.code >= 1 ? 1 : 0],
        minC: day.minC,
        maxC: day.maxC,
        rainProbability: day.rainProbability,
      })),
    };
  }, [people, stayCost, transport, travelData.accommodation, travelData.budget, travelData.children, travelData.days, travelData.departureDate, travelData.destination, travelData.origin, weather]);

  // A small daily allowance per browser, so one person cannot spend the shared
  // credit by holding the button down.
  useEffect(() => {
    try {
      const key = `safarino:asks:${new Date().toISOString().slice(0, 10)}`;
      const used = Number(window.localStorage.getItem(key) || 0);
      setAsksLeft(Math.max(0, 8 - used));
    } catch {
      setAsksLeft(8);
    }
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (clean.length < 3 || asking) return;
      setAsking(true);
      setAnswer(null);
      try {
        const response = await fetch("/api/companion/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(28_000),
          body: JSON.stringify({ question: clean, facts: askFacts }),
        });
        const payload = (await response.json()) as { success?: boolean; answer?: string; source?: "ai" | "local"; note?: string; error?: string };
        if (payload?.success && payload.answer) {
          setAnswer({ text: payload.answer, source: payload.source || "local", note: payload.note });
          try {
            const key = `safarino:asks:${new Date().toISOString().slice(0, 10)}`;
            const used = Number(window.localStorage.getItem(key) || 0) + 1;
            window.localStorage.setItem(key, String(used));
            setAsksLeft(Math.max(0, 8 - used));
          } catch {
            // The answer is already on screen.
          }
        } else {
          setAnswer({ text: payload?.error || "این سؤال را نتوانستم جواب بدهم.", source: "local" });
        }
      } catch {
        setAnswer({ text: "ارتباط برقرار نشد؛ یک بار دیگر بپرس.", source: "local" });
      } finally {
        setAsking(false);
      }
    },
    [askFacts, asking],
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
            className="mb-2 w-[min(90vw,330px)] overflow-hidden rounded-3xl border border-white/12 bg-[#0d0820]/95 shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl"
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

            <div className="max-h-[58vh] space-y-2 overflow-y-auto p-3">
              {/* The greeting: who this is, and what it can help with. */}
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-2.5">
                <p className="text-[10.5px] leading-6 text-cyan-50">
                  من دستیار سفرینو هستم؛ چطور کمکتون کنم؟
                </p>
                <p className="mt-1 text-[9.5px] leading-5 text-slate-300">
                  هم حساب‌وکتاب همین سفر را دارم و هم می‌توانم از خودِ {travelData.destination || "مقصد"} بگویم: غذا، آداب، دیدنی‌ها و بهترین فصل سفر.
                </p>
              </div>
              {/* «از همسفر بپرس» — a real question, answered from the trip's own numbers. */}
              <form
                className="rounded-2xl border border-violet-400/25 bg-violet-400/[0.07] p-2.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void ask(question);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[10.5px] font-black text-violet-100">از همسفر بپرس</b>
                  <span className="text-[8.5px] text-violet-200/60">{new Intl.NumberFormat("fa-IR").format(asksLeft)} سؤال امروز</span>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="مثلاً: در اصفهان چه غذایی را از دست ندهم؟"
                    aria-label="سؤال از همسفر سفرینو"
                    disabled={asksLeft <= 0}
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-[10px] text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={asking || question.trim().length < 3 || asksLeft <= 0}
                    aria-label="بفرست"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500 text-white transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    {asking ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {asksLeft <= 0 ? (
                  <p className="mt-1 text-[8.5px] text-amber-200/80">سهم پرسش‌های امروز تمام شد؛ فردا دوباره باز می‌شود.</p>
                ) : (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {ASK_EXAMPLES.slice(0, 3).map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => {
                          setQuestion(example);
                          void ask(example);
                        }}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8.5px] text-slate-300 transition hover:bg-white/[0.09] hover:text-white"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                )}
                {answer ? (
                  <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/50 p-2">
                    <p className="text-[10px] leading-6 text-slate-200">{answer.text}</p>
                    <p className="mt-1 text-[8px] text-slate-500">
                      {answer.source === "ai" ? "با هوش مصنوعی؛ از اعداد همین سفر و دانش عمومی مقصد" : "از حساب‌ها و اطلاعات واقعی همین سفر"}
                      {answer.note ? ` · ${answer.note}` : ""}
                    </p>
                  </div>
                ) : null}
              </form>

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
                          disabled={tipAsking === tip.id}
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
                        >
                          {tipAsking === tip.id ? <LoaderCircle className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                          {tipAsking === tip.id ? "در حال نوشتن…" : "بیشتر بگو"}
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

      {/* Only the small orb sits on the page. It never writes a sentence over the
          content: a single dot means «یک نکته دارم», and the words appear only
          inside the panel the traveller opens. */}
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setSeenCount((current) => current + 1);
        }}
        aria-label={open ? "بستن همسفر سفرینو" : "همسفر سفرینو — نکته‌ای برای این سفر دارم"}
        title={open ? "بستن" : "همسفر سفرینو"}
        className="relative grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-slate-950 shadow-[0_6px_22px_rgba(168,85,247,0.45)] transition hover:scale-105"
      >
        <span className="absolute inset-0 animate-pulse rounded-full bg-violet-400/25" />
        <Compass className="relative h-4 w-4" strokeWidth={2.6} />
        {showBadge ? (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#120a26] bg-amber-400" aria-hidden />
        ) : null}
        {urgent ? <span className="sr-only">{urgent.title}</span> : null}
      </button>
    </div>
  );
}

/** Pages call this to make the orb speak about something they just noticed. */
export function pingCompanion(tipId?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMPANION_EVENT, { detail: { tipId } }));
}
