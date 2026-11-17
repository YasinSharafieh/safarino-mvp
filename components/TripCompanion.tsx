"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Camera, Compass, LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { formatJalaliDate } from "@/lib/jalali";
import SpeakButton from "@/components/SpeakButton";
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
  const { travelData, setTravelData, isHydrated } = useTravel();
  const [open, setOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherLite[] | null>(null);
  const [aiText, setAiText] = useState<Record<string, string>>({});
  const [tipAsking, setTipAsking] = useState<string | null>(null);
  const [seenCount, setSeenCount] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{
    text: string;
    source: "ai" | "local";
    note?: string;
    steps?: { tool: string; label: string; ok: boolean; summary: string }[];
    action?: { kind: "budget"; millions: number; label: string } | null;
  } | null>(null);
  const [asking, setAsking] = useState(false);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketRead, setTicketRead] = useState<{
    fields: {
      mode: "plane" | "train" | "bus" | null;
      origin: string | null;
      destination: string | null;
      date: string | null;
      departureTime: string | null;
      company: string | null;
      priceToman: number | null;
      reference: string | null;
    };
    unread: string[];
    note: string;
  } | null>(null);
  const [ticketError, setTicketError] = useState("");
  /** A short, self-retiring line next to the orb — never a panel over the page. */
  const [bubble, setBubble] = useState("");
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

  /**
   * A page can ask the orb to *say* something — but it never takes the screen.
   * The traveller is choosing a ticket; a panel opening on top of the list is
   * exactly the behaviour that made the site feel noisy. So the orb only lifts
   * a small bubble beside itself, and the panel opens when they tap it.
   */
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tipId?: string }>).detail;
      setBubble(detail?.tipId || "auto");
      setHidden(false);
    };
    window.addEventListener(COMPANION_EVENT, handler);
    // The bubble retires on its own so it never becomes permanent furniture.
    return () => window.removeEventListener(COMPANION_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!bubble) return;
    const timer = window.setTimeout(() => setBubble(""), 14_000);
    return () => window.clearTimeout(timer);
  }, [bubble]);

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

  /*
   * There is no per-browser question limit: the owner's rule is «سؤال نامحدود»,
   * and the real guard is the server's own AI budget (`lib/ai-budget.ts`), which
   * caps the money rather than the traveller. A local counter used to be kept and
   * nothing ever read it — dead machinery that could only mislead later.
   */

  /**
   * A ticket photo is shrunk on the device before it is uploaded: a 4 MB phone
   * screenshot becomes a small JPEG, which keeps the paid tokens (and the
   * traveller's data plan) honest.
   */
  const readTicket = useCallback(async (file: File) => {
    setTicketError("");
    setTicketRead(null);
    setTicketBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      const shrunk = await new Promise<string>((resolve) => {
        const image = new window.Image();
        image.onload = () => {
          const maxSide = 1400;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            resolve(dataUrl);
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          } catch {
            resolve(dataUrl);
          }
        };
        image.onerror = () => resolve(dataUrl);
        image.src = dataUrl;
      });
      const response = await fetch("/api/companion/read-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(35_000),
        body: JSON.stringify({ image: shrunk }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        fields?: NonNullable<typeof ticketRead>["fields"];
        unread?: string[];
        note?: string;
        error?: string;
      };
      if (payload.success && payload.fields) {
        setTicketRead({ fields: payload.fields, unread: payload.unread || [], note: payload.note || "" });
      } else {
        setTicketError(payload.error || "این تصویر خوانده نشد.");
      }
    } catch {
      setTicketError("عکس خوانده نشد؛ یک بار دیگر امتحان کن.");
    } finally {
      setTicketBusy(false);
    }
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (clean.length < 3 || asking) return;
      setAsking(true);
      setAnswer(null);
      try {
        // The agent route: it reads real tickets, real rooms and the trip's own
        // money before answering, and tells the traveller what it actually did.
        const response = await fetch("/api/companion/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(40_000),
          body: JSON.stringify({ question: clean, facts: askFacts }),
        });
        const payload = (await response.json()) as {
          success?: boolean;
          answer?: string;
          source?: "agent" | "local";
          note?: string;
          error?: string;
          steps?: { tool: string; label: string; ok: boolean; summary: string }[];
          action?: { kind: "budget"; millions: number; label: string } | null;
        };
        if (payload?.success && payload.answer) {
          setAnswer({
            text: payload.answer,
            source: payload.source === "agent" ? "ai" : "local",
            note: payload.note,
            steps: payload.steps || [],
            action: payload.action || null,
          });
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
              {/* «عکس بلیت را بخوان» — the companion's eyes. */}
              <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.06] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[10.5px] font-black text-cyan-100">عکس بلیت را بخوان</b>
                  <span className="text-[8.5px] text-cyan-200/60">مبدأ، مقصد و تاریخ را خودم می‌گذارم</span>
                </div>
                <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-cyan-300/35 bg-slate-950/40 px-2 py-2 text-[9.5px] font-bold text-cyan-100 transition hover:bg-cyan-400/10">
                  {ticketBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {ticketBusy ? "دارم می‌خوانم…" : "انتخاب عکس بلیت یا اسکرین‌شات"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void readTicket(file);
                    }}
                  />
                </label>
                {ticketError ? <p className="mt-1 text-[8.5px] text-rose-200">{ticketError}</p> : null}
                {ticketRead ? (
                  <div className="mt-1.5 rounded-lg border border-white/10 bg-slate-950/50 p-1.5">
                    <ul className="space-y-0.5 text-[9px] text-slate-300">
                      <li>
                        <b className="text-slate-400">مسیر: </b>
                        {ticketRead.fields.origin || "—"} → {ticketRead.fields.destination || "—"}
                      </li>
                      <li>
                        <b className="text-slate-400">تاریخ: </b>
                        {ticketRead.fields.date ? formatJalaliDate(ticketRead.fields.date) : "خوانده نشد"}
                        {ticketRead.fields.departureTime ? ` · ساعت ${ticketRead.fields.departureTime}` : ""}
                      </li>
                      {ticketRead.fields.company ? (
                        <li>
                          <b className="text-slate-400">شرکت: </b>
                          {ticketRead.fields.company}
                        </li>
                      ) : null}
                      {ticketRead.fields.priceToman ? (
                        <li>
                          <b className="text-slate-400">مبلغ: </b>
                          {new Intl.NumberFormat("fa-IR").format(ticketRead.fields.priceToman)} تومان
                        </li>
                      ) : null}
                      {ticketRead.unread.length ? (
                        <li className="text-amber-200/80">خوانده نشد: {ticketRead.unread.join("، ")}</li>
                      ) : null}
                    </ul>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={!ticketRead.fields.origin || !ticketRead.fields.destination}
                        onClick={() => {
                          setTravelData((current) => ({
                            ...current,
                            origin: ticketRead.fields.origin || current.origin,
                            destination: ticketRead.fields.destination || current.destination,
                            departureDate: ticketRead.fields.date || current.departureDate,
                            preferredMode: ticketRead.fields.mode || current.preferredMode,
                          }));
                          setTicketRead(null);
                          setBubble("بلیت خوانده شد؛ سفر را با همین اطلاعات پر کردم.");
                        }}
                        className="rounded-lg bg-cyan-500 px-2 py-1 text-[9px] font-black text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
                      >
                        در سفر بگذار
                      </button>
                      <button
                        type="button"
                        onClick={() => setTicketRead(null)}
                        className="rounded-lg border border-white/10 px-2 py-1 text-[9px] text-slate-300 transition hover:bg-white/[0.06]"
                      >
                        نه، خودم می‌نویسم
                      </button>
                    </div>
                    <p className="mt-1 text-[8px] text-slate-500">{ticketRead.note}</p>
                  </div>
                ) : null}
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
                  <span className="text-[8.5px] text-violet-200/60">هر چند تا بخواهی بپرس</span>
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="مثلاً: در اصفهان چه غذایی را از دست ندهم؟"
                    aria-label="سؤال از همسفر سفرینو"
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-[10px] text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={asking || question.trim().length < 3}
                    aria-label="بفرست"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500 text-white transition hover:bg-violet-400 disabled:opacity-50"
                  >
                    {asking ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
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
                {answer ? (
                  <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/50 p-2">
                    <p className="text-[10px] leading-6 text-slate-200">{answer.text}</p>
                    <div className="mt-1 flex justify-end">
                      <SpeakButton text={answer.text} label="بخوانش" />
                    </div>
                    {answer.steps?.length ? (
                      <div className="mt-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-1.5">
                        <p className="text-[8px] font-black text-cyan-200/80">چه کاری کردم</p>
                        <ul className="mt-1 space-y-1">
                          {answer.steps.map((step, index) => (
                            <li key={`${step.tool}-${index}`} className="flex items-start gap-1 text-[8px] leading-4 text-slate-400">
                              <span className={step.ok ? "mt-1 h-1 w-1 shrink-0 rounded-full bg-emerald-400" : "mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-400"} />
                              <span className="min-w-0">
                                <b className="text-slate-300">{step.label}</b>
                                {step.ok ? `: ${step.summary}` : ` — ${step.summary}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {answer.action?.kind === "budget" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTravelData((current) => ({ ...current, budget: answer.action ? answer.action.millions : current.budget }));
                          setAnswer(null);
                        }}
                        className="mt-1.5 w-full rounded-lg bg-rose-500/90 px-2 py-1.5 text-[9px] font-black text-white transition hover:bg-rose-400"
                      >
                        {answer.action.label}
                      </button>
                    ) : null}
                    <p className="mt-1 text-[8px] text-slate-500">
                      {answer.source === "ai" ? "با هوش مصنوعی؛ از دادهٔ واقعی همین سفر، بازبینی‌شده پیش از نمایش" : "از حساب‌ها و اطلاعات واقعی همین سفر"}
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

      {/* A short suggestion beside the orb — the traveller can ignore it and
          nothing is covered. The full panel only opens on a tap. */}
      <AnimatePresence>
        {bubble && !open ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            onClick={() => {
              setOpen(true);
              setBubble("");
            }}
            className="mb-2 block w-[min(78vw,270px)] rounded-2xl border border-violet-300/30 bg-[#160c2c]/95 p-2.5 text-right shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur"
            aria-label="پیشنهاد همسفر"
          >
            <span className="flex items-center gap-1.5 text-[10px] font-black text-violet-100">
              <Sparkles className="h-3 w-3" />
              {urgent?.title || "یک نکته برای این سفر"}
            </span>
            <span className="mt-1 block text-[9.5px] leading-5 text-slate-300">
              {(urgent?.body || "بودجه و انتخاب‌هایت را با هم می‌سنجم؛ بزن تا بگویم.").slice(0, 130)}…
            </span>
            <span className="mt-1 block text-[8.5px] font-bold text-cyan-200">بزن تا کامل توضیح بدهم →</span>
          </motion.button>
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
