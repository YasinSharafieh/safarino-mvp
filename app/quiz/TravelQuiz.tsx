"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Compass,
  Compass as CompassIcon,
  Heart,
  Home,
  Landmark,
  MapPin,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Sun,
  Utensils,
  Waves,
  Mountain,
  Moon,
  Hotel,
  Banknote,
  Baby,
  User,
  PartyPopper,
  AlarmClock,
  ListChecks,
  Coffee,
  Shuffle,
  Store,
  Trees,
  BedDouble,
  Flower2,
  Crown,
  Snowflake,
  ThermometerSun,
  CloudSun,
  Footprints,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TravelSteps from "@/components/TravelSteps";
import { useTravel } from "../context/TravelContext";
import SiteHeader from "@/components/SiteHeader";
import {
  budgetFromDaily,
  describeTrip,
  drawQuestions,
  scoreAnswers,
  suggestCities,
  type CitySuggestion,
  type QuizAnswers,
  type QuizQuestion,
} from "@/lib/start-flow";
import { findCity } from "@/lib/discover";
import type { AiAnalysis } from "@/lib/quiz-ai";

/** Every option in the pool gets its own picture-free glyph. */
const ICONS: Record<string, LucideIcon> = {
  slow: Coffee,
  early: AlarmClock,
  plan: ListChecks,
  free: Shuffle,
  alone: User,
  couple: Heart,
  family: Baby,
  friends: PartyPopper,
  history: Landmark,
  sea: Waves,
  green: Trees,
  desert: Moon,
  low: Banknote,
  mid: Banknote,
  high: Banknote,
  vip: Crown,
  cold: Snowflake,
  mild: Flower2,
  warm: Sun,
  any: ThermometerSun,
  museum: Landmark,
  bazaar: Store,
  park: Footprints,
  food: Utensils,
  simple: BedDouble,
  boutique: Home,
  hotel: Hotel,
  resort: Waves,
  love: Building2,
  ok: CloudSun,
  quiet: Trees,
  escape: Mountain,
};

const FALLBACK_ICON = CompassIcon;

const faNumber = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

function isoIn(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The «suggest me a place» door.
 *
 * Three to five questions are drawn fresh from a rotating pool, so the quiz is
 * never the same twice. The answers only decide *which Iranian cities fit* —
 * the traveller still sees the reason and can pick a different one.
 */
export default function TravelQuiz() {
  const router = useRouter();
  const { travelData, setTravelData } = useTravel();
  const [round, setRound] = useState(0);
  // The questions are drawn in the browser only: the pre-rendered HTML cannot
  // contain one particular random set, so nothing is drawn until hydration.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  /**
   * Ten questions, written for this attempt.
   *
   * The model writes a fresh set each time; the local bank is the fallback, so
   * the traveller always gets ten questions even when the model is unavailable.
   * Prompts already seen are sent along so the next set is not the same one.
   */
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionSource, setQuestionSource] = useState<"ai" | "local" | "">("");
  const seenPrompts = useRef<string[]>([]);
  /** Once the traveller has tapped an answer, the set on screen must not change. */
  const touched = useRef(false);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    touched.current = false;
    const local = drawQuestions(Math.random, 10);
    setQuestions(local);
    seenPrompts.current = [...seenPrompts.current, ...local.map((question) => question.prompt)].slice(-40);
    setQuestionSource("local");
    setAnswers({});
    setStep(0);
    setShowResult(false);
    const people = Math.max(1, (travelData.travelers || 2) + (travelData.children || 0));
    fetch("/api/quiz/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ origin: travelData.origin || "", travellers: people, seen: seenPrompts.current, token: `${Date.now()}-${round}` }),
    })
      .then((response) => response.json())
      .then((data: { success?: boolean; questions?: QuizQuestion[]; source?: "ai" | "local" }) => {
        if (cancelled || touched.current) return;
        const fresh = Array.isArray(data.questions) ? data.questions : [];
        if (!fresh.length) return;
        setQuestions(fresh);
        setQuestionSource(data.source || "local");
        seenPrompts.current = [...seenPrompts.current, ...fresh.map((question) => question.prompt)].slice(-40);
      })
      .catch(() => {
        // The local set is already on screen; nothing to report.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, round]);

  const totalQuestions = questions.length || 10;
  const [step, setStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [chosen, setChosen] = useState<string>("");
  /** The second door: describe the trip in your own words instead of answering. */
  const [mode, setMode] = useState<"quiz" | "text">("quiz");
  const [description, setDescription] = useState("");
  const [textNote, setTextNote] = useState("");
  const [described, setDescribed] = useState<{ summary: string; words: string[]; days: number | null } | null>(null);

  const resultVisible = ready && (Boolean(described) || showResult);
  const question = questions[Math.min(step, Math.max(questions.length - 1, 0))];
  const selectedOption = question ? answers[question.key] : undefined;
  const quizResult = useMemo(() => scoreAnswers(questions, answers), [questions, answers]);
  const result = useMemo(() => {
    if (described) {
      const describedResult = describeTrip(description);
      if (describedResult) return describedResult.result;
    }
    return quizResult;
  }, [described, description, quizResult]);
  const peopleCount = Math.max(1, (travelData.travelers || 2) + (travelData.children || 0));
  const suggestions: CitySuggestion[] = useMemo(() => {
    if (analysis?.cities?.length) {
      return analysis.cities.slice(0, 4).map((city) => {
        const profile = findCity(city.name);
        return {
          name: city.name,
          province: profile?.province || "",
          tagline: profile?.tagline || "",
          days: analysis.days || profile?.suggestedDays || 3,
          bestSeason: profile?.bestSeason || "",
          reason: city.reason || profile?.tagline || "",
          score: 0,
          estimatedToman: city.estimatedToman,
          overBudget: Boolean(travelData.budget && city.estimatedToman && city.estimatedToman > travelData.budget * 1_000_000),
        };
      });
    }
    return suggestCities(result, { limit: 4, budgetMillions: travelData.budget || null, travellers: peopleCount });
  }, [analysis, peopleCount, result, travelData.budget]);
  const progress = resultVisible ? 100 : ((step + 1) / totalQuestions) * 100;

  const goNext = () => {
    if (!selectedOption || resultVisible) return;
    setDirection(1);
    if (step >= questions.length - 1) setShowResult(true);
    else setStep(step + 1);
  };

  const goBack = () => {
    if (resultVisible) {
      setDirection(-1);
      setShowResult(false);
      setStep(Math.max(questions.length - 1, 0));
      return;
    }
    if (step === 0) return;
    setDirection(-1);
    setStep(Math.max(step - 1, 0));
  };

  const restart = () => {
    setDescribed(null);
    setDescription("");
    setTextNote("");
    setAnswers({});
    setChosen("");
    setStep(0);
    setShowResult(false);
    setAnalysis(null);
    setDirection(-1);
    setRound((value) => value + 1);
  };

  /** Reads the traveller's own words; never invents a preference that is not there. */
  const applyDescription = () => {
    const parsed = describeTrip(description);
    if (!parsed) {
      setTextNote("در نوشته‌ات نشانه‌ای از سلیقه پیدا نکردم. یک کلمه از این‌ها را اضافه کن: دریا، کوه، کویر، تاریخ، جنگل، کافه، زیارت. تعداد روز و بودجه را هم می‌توانی بنویسی (مثلاً «۴ روز، ۲۰ میلیون»).");
      return;
    }
    setTextNote("");
    setDescribed({
      summary: parsed.result.summary,
      words: parsed.matchedWords,
      days: parsed.result.days,
    });
    setDirection(1);
  };

  /** Reads the answers: the model first, the local engine as the floor. */
  const runAnalysis = useCallback(() => {
    setAnalysing(true);
    const payload = {
      origin: travelData.origin || "",
      travellers: peopleCount,
      days: result.days,
      budgetMillions: travelData.budget || null,
      freeText: described ? description : "",
      questions: questions.map((question) => ({
        key: question.key,
        prompt: question.prompt,
        options: question.options.map((option) => option.id),
      })),
      answers,
    };
    fetch("/api/quiz/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify(payload),
    })
      .then((response) => response.json())
      .then((data: { success?: boolean; analysis?: AiAnalysis }) => {
        if (data.analysis?.cities?.length) setAnalysis(data.analysis);
      })
      .catch(() => {
        // The local result is already on screen.
      })
      .finally(() => setAnalysing(false));
  }, [answers, description, described, peopleCount, questions, result.days, travelData.budget, travelData.origin]);

  useEffect(() => {
    if (!resultVisible) return;
    runAnalysis();
    // Once per result screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultVisible]);

  const startTrip = (suggestion: CitySuggestion) => {
    const days = Math.max(1, suggestion.days || 3);
    const people = Math.max(1, (travelData.travelers || 2) + (travelData.children || 0));
    const budget = budgetFromDaily(result.dailyToman, days, people);
    setTravelData((current) => ({
      ...current,
      destination: suggestion.name,
      days,
      departureDate: current.departureDate || isoIn(7),
      returnDate: current.returnDate || isoIn(7 + days),
      budget: budget ?? current.budget,
      tripStyle: result.headline,
      quizResult: suggestion.name,
      quizAnswers: answers,
      quizStep: questions.length,
    }));
    router.push("/transport");
  };

  return (
    <MotionConfig reducedMotion="user">
      <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#2c1256_0%,#120a26_58%)]" />
          <div className="absolute inset-0 grid-lines opacity-60" />
          <div className="aurora">
            <span className="-top-20 right-0 h-80 w-80 animate-float bg-teal-500/30" />
            <span className="left-0 top-1/3 h-72 w-72 animate-float bg-sky-500/20 [animation-delay:1.5s]" />
          </div>
        </div>

        <SiteHeader />

        <TravelSteps current={1} />

        <section className="mx-auto max-w-3xl pb-8 pt-8 sm:pt-10">
          <div className="mb-6 text-center">
            <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              پیشنهاد مقصد ایرانی در چند ثانیه
            </span>
            <h1 className="mt-4 text-2xl font-black leading-tight text-white sm:text-4xl">
              سفر بعدی‌ات <span className="gradient-text">چه حالی</span> دارد؟
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-[11.5px] leading-7 text-slate-400 sm:text-sm">
              ده سؤال کوتاه — هر بار سؤال‌های تازه — تا بر اساس سلیقه و بودجه‌ات شهر مناسب را در ایران پیدا کنیم.
            </p>
            {questionSource === "ai" ? (
              <p className="mt-2 text-[9.5px] text-emerald-300/80">سؤال‌های این دور مخصوص همین سفر نوشته شدند؛ دور بعدی سؤال‌های دیگری دارد.</p>
            ) : null}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
            <button
              type="button"
              onClick={() => setMode("quiz")}
              aria-pressed={mode === "quiz"}
              className={`rounded-xl px-3 py-2.5 text-[11px] font-extrabold transition ${
                mode === "quiz" ? "bg-cyan-400/20 text-cyan-100 shadow-glow" : "text-slate-400 hover:text-white"
              }`}
            >
              چند سؤال کوتاه
            </button>
            <button
              type="button"
              onClick={() => setMode("text")}
              aria-pressed={mode === "text"}
              className={`rounded-xl px-3 py-2.5 text-[11px] font-extrabold transition ${
                mode === "text" ? "bg-teal-400/20 text-teal-100 shadow-warm" : "text-slate-400 hover:text-white"
              }`}
            >
              خودم می‌نویسم
            </button>
          </div>

          {mode === "text" && !described ? (
            <div className="glass mb-3 p-4 sm:p-6">
              <h2 className="text-sm font-black text-white">حال‌وهوای سفرت را بنویس</h2>
              <p className="mt-1.5 text-[10.5px] leading-6 text-slate-400">
                مثلاً: «دلم می‌خواهد چند روز کنار دریا باشم، صبح‌ها پیاده‌روی کنم و شب کافه برویم؛ ۴ روز و حدود ۲۰ میلیون.»
                فقط کلمه‌هایی که واقعاً نوشته‌ای ملاک است.
              </p>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value.slice(0, 400))}
                rows={4}
                aria-label="توصیف سفر با کلمات خودت"
                placeholder="چند روز، با چند نفر، چه حالی، چه چیزی را دوست داری…"
                className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 p-3 text-[11.5px] leading-7 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[9px] text-slate-500">{new Intl.NumberFormat("fa-IR").format(description.length)} از ۴۰۰ نویسه</span>
                <button type="button" onClick={applyDescription} className="btn-primary !px-4 !py-2.5 text-[11px]">
                  <Sparkles className="h-3.5 w-3.5" />
                  پیشنهاد مقصد را ببین
                </button>
              </div>
              {textNote ? (
                <p className="mt-2 rounded-xl border border-amber-300/25 bg-amber-300/10 p-2.5 text-[10px] leading-6 text-amber-100">{textNote}</p>
              ) : null}
            </div>
          ) : null}

          <div className="glass overflow-hidden p-4 shadow-card sm:p-7">
            <div className="mb-5">
              <div className="mb-2.5 flex items-center justify-between gap-3 text-[10.5px] text-slate-400">
                <span aria-live="polite">
                  {resultVisible ? "نتیجه آماده است" : `سؤال ${faNumber(step + 1)} از ${faNumber(totalQuestions)}`}
                </span>
                <b className="text-cyan-300">{faNumber(Math.round(progress))}٪</b>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="پیشرفت کوییز"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <motion.div
                  className="h-full rounded-full bg-gradient-to-l from-cyan-300 via-sky-400 to-cyan-400"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
            </div>

            <AnimatePresence mode="wait" custom={direction}>
              {mode === "text" && !described ? (
                <motion.div key="text-mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                  <p className="text-[11px] leading-7 text-slate-400">
                    متن بالا را بنویس و «پیشنهاد مقصد را ببین» را بزن؛ یا از دکمهٔ «چند سؤال کوتاه» استفاده کن.
                  </p>
                </motion.div>
              ) : !ready || !question ? (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2.5">
                  <div className="mx-auto h-6 w-56 animate-pulse rounded-full bg-white/10" />
                  <div className="mx-auto h-4 w-40 animate-pulse rounded-full bg-white/5" />
                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/5" />
                    ))}
                  </div>
                </motion.div>
              ) : !resultVisible ? (
                <motion.div
                  key={question.key}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -30 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center">
                    <h2 className="text-lg font-extrabold leading-8 text-white sm:text-xl">{question.prompt}</h2>
                    <p className="mt-1.5 text-[11px] leading-6 text-slate-400">{question.aside}</p>
                  </div>

                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label={question.prompt}>
                    {question.options.map((option) => {
                      const Icon = ICONS[option.id] || FALLBACK_ICON;
                      const isSelected = selectedOption === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => {
                            touched.current = true;
                            setAnswers((current) => ({ ...current, [question.key]: option.id }));
                          }}
                          className={`group relative flex items-start gap-2.5 rounded-2xl border p-3.5 text-right outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
                            isSelected
                              ? "border-cyan-300/60 bg-cyan-300/10 shadow-glow"
                              : "border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"
                          }`}
                        >
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition ${
                              isSelected
                                ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-200"
                                : "border-white/10 bg-white/5 text-slate-300 group-hover:text-cyan-200"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block text-[12px] font-bold leading-6 text-white">{option.label}</b>
                            {option.hint ? (
                              <span className="mt-0.5 block text-[10px] text-slate-500">{option.hint}</span>
                            ) : null}
                          </span>
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border transition ${
                              isSelected ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/20 text-transparent"
                            }`}
                            aria-hidden="true"
                          >
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/5 pt-4">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={step === 0}
                      className="btn-ghost !px-3.5 !py-2 text-[11px] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      قبلی
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!selectedOption}
                      className="btn-primary !px-4 !py-2.5 text-[11px] disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40"
                    >
                      {step === questions.length - 1 ? "دیدن پیشنهادها" : "سؤال بعدی"}
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  aria-live="polite"
                >
                  <div className="text-center">
                    <span className="chip border-emerald-400/25 bg-emerald-400/10 !text-emerald-200">
                      <Sparkles className="h-3.5 w-3.5" />
                      سلیقهٔ سفرت مشخص شد
                    </span>
                    <h2 className="gradient-text mt-4 text-xl font-black sm:text-2xl">{analysis?.headline || result.headline}</h2>
                    <p className="mx-auto mt-2.5 max-w-xl text-[11px] leading-7 text-slate-300 sm:text-xs">{analysis?.summary || result.summary}</p>
                    {analysing ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[9.5px] text-cyan-100">
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                        پاسخ‌ها خوانده می‌شود؛ داشتیم شهرها را با بودجه‌ات می‌سنجیدیم…
                      </p>
                    ) : null}
                    {described ? (
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                        <span className="text-[9.5px] text-slate-500">از نوشتهٔ خودت:</span>
                        {described.words.slice(0, 8).map((word) => (
                          <span key={word} className="rounded-full border border-teal-400/30 bg-teal-400/10 px-2 py-0.5 text-[9px] font-bold text-teal-100">
                            {word}
                          </span>
                        ))}
                        {described.days ? (
                          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[9px] font-bold text-cyan-100">
                            {faNumber(described.days)} روز
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 space-y-2">
                    {suggestions.length ? (
                      suggestions.map((suggestion, index) => {
                        const isChosen = chosen === suggestion.name;
                        return (
                          <button
                            key={suggestion.name}
                            type="button"
                            onClick={() => setChosen(suggestion.name)}
                            className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-right transition ${
                              isChosen
                                ? "border-cyan-300/60 bg-cyan-300/10"
                                : "border-white/10 bg-white/[0.035] hover:border-white/25 hover:bg-white/[0.07]"
                            }`}
                          >
                            <span
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[11px] font-black ${
                                isChosen ? "bg-cyan-300 text-slate-950" : "bg-white/5 text-cyan-200"
                              }`}
                            >
                              {faNumber(index + 1)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <b className="text-[13px] font-black text-white">{suggestion.name}</b>
                                <span className="text-[9.5px] text-slate-500">{suggestion.province}</span>
                                <span className="chip !px-1.5 !py-0.5 !text-[9px]">
                                  <CalendarDays className="h-2.5 w-2.5" />
                                  {faNumber(suggestion.days)} روز
                                </span>
                                <span className="chip !px-1.5 !py-0.5 !text-[9px]">
                                  <Sun className="h-2.5 w-2.5" />
                                  {suggestion.bestSeason}
                                </span>
                              </span>
                              <span className="mt-1 block text-[10px] leading-5 text-slate-400">{suggestion.reason}</span>
                              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                                {index === 0 ? (
                                  <span className="rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2 py-0.5 text-[8.5px] font-black text-emerald-200">پیشنهاد من</span>
                                ) : null}
                                {suggestion.estimatedToman ? (
                                  <span className={`text-[9px] ${suggestion.overBudget ? "text-amber-300" : "text-slate-500"}`}>
                                    حدود {faNumber(Math.round(suggestion.estimatedToman / 1_000_000))} میلیون تومان برای {faNumber(suggestion.days)} روز
                                    {suggestion.overBudget ? " · کمی بیشتر از بودجه‌ات" : ""}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            <span
                              className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                                isChosen ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/20 text-transparent"
                              }`}
                              aria-hidden="true"
                            >
                              <Check className="h-2.5 w-2.5" strokeWidth={3} />
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center text-[11px] leading-6 text-slate-400">
                        با این جواب‌ها شهر قطعی پیدا نشد. یک بار دیگر با سؤال‌های تازه امتحان کن؛ یا مسیر «مقصد را می‌دانم» را انتخاب کن.
                      </p>
                    )}
                  </div>

                  <p className="mt-4 rounded-2xl border border-sky-400/15 bg-sky-400/5 p-2.5 text-center text-[10px] leading-6 text-slate-400">
                    این پیشنهادها بر اساس همان چند جواب انتخاب شده‌اند؛ قیمت و زمان واقعی در مرحلهٔ بعد از منابع زنده خوانده می‌شود.
                  </p>

                  <div className="mt-5 flex flex-col-reverse gap-2.5 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2">
                      <button type="button" onClick={restart} className="btn-ghost !px-3.5 !py-2.5 text-[11px]">
                        <RotateCcw className="h-3.5 w-3.5" />
                        سؤال‌های تازه
                      </button>
                      <Link href="/start/cities" className="btn-ghost !px-3.5 !py-2.5 text-[11px]">
                        <MapPin className="h-3.5 w-3.5" />
                        مقصدم را می‌دانم
                      </Link>
                    </div>
                    <button
                      type="button"
                      disabled={!chosen}
                      onClick={() => {
                        const suggestion = suggestions.find((item) => item.name === chosen);
                        if (suggestion) startTrip(suggestion);
                      }}
                      className="btn-primary !px-4 !py-2.5 text-[11px] disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40"
                    >
                      {chosen ? `برنامه‌ریزی سفر به ${chosen}` : "یک شهر را انتخاب کن"}
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-4 text-center text-[10px] leading-6 text-slate-600">
            پاسخ‌ها فقط برای ساختن همین پیشنهاد پردازش می‌شوند و ذخیره نمی‌شوند؛ هیچ نام یا اطلاعات شخصی پرسیده نمی‌شود.
          </p>
        </section>
      </main>
    </MotionConfig>
  );
}
