"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import JalaliRangeCalendar from "@/components/JalaliRangeCalendar";
import { addDaysToIso, formatJalaliDate, todayIso } from "@/lib/jalali";
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
  Minus,
  Plus,
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
  Mic,
  Square,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TravelSteps from "@/components/TravelSteps";
import { useTravel } from "../context/TravelContext";
import SiteHeader from "@/components/SiteHeader";
import ArchetypeCard from "@/components/ArchetypeCard";
import {
  describeTrip,
  drawQuestions,
  preferredModeFromText,
  preferredTransportMode,
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
    // The budget is asked as a number at the end, so it is not asked twice.
    const local = drawQuestions(Math.random, 14).filter((question) => !question.key.startsWith("budget")).slice(0, 12);
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
        const fresh = (Array.isArray(data.questions) ? data.questions : []).filter((question) => !question.key.startsWith("budget"));
        if (fresh.length < 10) return;
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

  const totalQuestions = questions.length || 12;
  /** The index of the closing budget step, right after the last question. */
  const moneyStep = questions.length;
  const [step, setStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  /** The closing step that is *always* asked: the money and the length. */
  const [budgetMillions, setBudgetMillions] = useState<number>(() => Math.max(3, Math.round(Number(travelData.budget) || 20)));
  const [days, setDays] = useState<number>(() => Math.max(2, Math.round(Number(travelData.days) || 3)));
  /** How many people the one budget has to cover — it decides the share of each. */
  const [adults, setAdults] = useState<number>(() => Math.min(6, Math.max(1, Math.round(Number(travelData.travelers) || 1))));
  const [kids, setKids] = useState<number>(() => Math.min(5, Math.max(0, Math.round(Number(travelData.children) || 0))));
  /** The dates are asked here, so no step later has to invent them. */
  const [departureDate, setDepartureDate] = useState<string>(() => travelData.departureDate || "");
  const [returnDate, setReturnDate] = useState<string>(() => travelData.returnDate || "");
  const [roundTrip, setRoundTrip] = useState<boolean>(true);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [chosen, setChosen] = useState<string>("");
  /** The second door: describe the trip in your own words instead of answering. */
  const [mode, setMode] = useState<"quiz" | "text" | "voice">("quiz");
  /** Voice input: the browser listens, we only paste the words it heard. */
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const recognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const [description, setDescription] = useState("");
  const [textNote, setTextNote] = useState("");
  const [described, setDescribed] = useState<{ summary: string; words: string[]; days: number | null } | null>(null);

  const resultVisible = ready && showResult;
  const onMoneyStep = !resultVisible && step === moneyStep;
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
  /** The number typed on the closing step wins over anything remembered earlier. */
  /** The trip length follows the calendar the moment both dates exist. */
  useEffect(() => {
    if (!departureDate || !returnDate) return;
    const from = Date.parse(`${departureDate}T00:00:00Z`);
    const to = Date.parse(`${returnDate}T00:00:00Z`);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
    const nights = Math.round((to - from) / 86_400_000);
    setDays(Math.min(14, Math.max(1, nights)));
  }, [departureDate, returnDate]);

  /** The closing step always opens with real dates on the calendar, never blank. */
  useEffect(() => {
    if (!onMoneyStep || departureDate) return;
    const base = addDaysToIso(todayIso(), 7);
    setDepartureDate(base);
    if (roundTrip && !returnDate) setReturnDate(addDaysToIso(base, Math.max(1, days)));
    // Only fills an empty calendar; the traveller's own date always wins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMoneyStep, departureDate]);

  const setTripDays = (value: number) => {
    setDays(value);
    const base = departureDate || addDaysToIso(todayIso(), 7);
    if (!departureDate) setDepartureDate(base);
    setReturnDate(addDaysToIso(base, Math.max(1, value)));
  };

  const peopleCount = Math.max(1, adults + kids);
  const perPersonToman = Math.round((budgetMillions * 1_000_000) / peopleCount);
  const perPersonMillions = perPersonToman / 1_000_000;
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
          overBudget: Boolean(city.estimatedToman && city.estimatedToman > budgetMillions * 1_000_000),
        };
      });
    }
    // Six cities, ranked by the taste read from their own words — the quiz and
    // the written/voice description go through the very same engine.
    return suggestCities(result, { limit: 6, budgetMillions, travellers: peopleCount, matchedWords: described?.words || [] });
  }, [analysis, budgetMillions, described, peopleCount, result]);
  const progress = resultVisible ? 100 : Math.min(99, ((step + 1) / (totalQuestions + 1)) * 100);

  const goNext = () => {
    if (resultVisible) return;
    if (step === moneyStep) {
      setDirection(1);
      setShowResult(true);
      return;
    }
    if (!selectedOption) return;
    setDirection(1);
    if (step >= questions.length - 1) setStep(moneyStep);
    else setStep(step + 1);
  };

  const goBack = () => {
    if (resultVisible) {
      setDirection(-1);
      setShowResult(false);
      setStep(moneyStep);
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

  type RecognitionLike = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
    onerror: ((event: { error?: string }) => void) | null;
    onend: (() => void) | null;
  };

  /** Real listening, in the browser; the words land in the same box the typing mode uses. */
  const startVoice = () => {
    const scope = window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike };
    const Constructor = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Constructor) {
      setVoiceNote("مرورگر تو ضبط صدا را پشتیبانی نمی‌کند؛ همان متن را در حالت «خودم می‌نویسم» بنویس.");
      return;
    }
    try {
      const recognition = new Constructor();
      recognition.lang = "fa-IR";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        let heard = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          heard += ` ${event.results[index][0]?.transcript || ""}`;
        }
        if (heard.trim()) setDescription((current) => `${current} ${heard}`.trim().slice(0, 400));
      };
      recognition.onerror = (event) => {
        setVoiceNote(event.error === "not-allowed" ? "اجازهٔ میکروفن داده نشد؛ از حالت نوشتن استفاده کن." : "صدا را نشنیدم؛ یک بار دیگر امتحان کن.");
        setListening(false);
      };
      recognition.onend = () => setListening(false);
      recognition.start();
      recognitionRef.current = recognition;
      setVoiceNote("");
      setListening(true);
    } catch {
      setVoiceNote("شروع شنیدن ممکن نشد؛ همان متن را بنویس.");
    }
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  /** Reads the traveller's own words; never invents a preference that is not there. */
  const applyDescription = () => {
    const parsed = describeTrip(description);
    if (!parsed) {
      setTextNote("در نوشته‌ات نشانه‌ای از سلیقه پیدا نکردم. یک کلمه از این‌ها را اضافه کن: دریا، کوه، کویر، تاریخ، جنگل، کافه، زیارت. تعداد روز و بودجه را هم می‌توانی بنویسی (مثلاً «۴ روز، ۲۰ میلیون»).");
      return;
    }
    setTextNote("");
    // The free-text path asks the same closing questions (money, people, dates)
    // before it shows anything — no trip is planned without a date and a budget.
    if (parsed.result.days && parsed.result.days > 0) setDays(Math.min(14, Math.max(1, parsed.result.days)));
    setStep(moneyStep);
    setDirection(1);
    setDescribed({
      summary: parsed.result.summary,
      words: parsed.matchedWords,
      days: parsed.result.days,
    });
  };

  /** Reads the answers: the model first, the local engine as the floor. */
  const runAnalysis = useCallback(() => {
    setAnalysing(true);
    const payload = {
      origin: travelData.origin || "",
      travellers: peopleCount,
      days,
      budgetMillions,
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
  }, [answers, budgetMillions, days, description, described, peopleCount, questions, travelData.origin]);

  useEffect(() => {
    if (!resultVisible) return;
    runAnalysis();
    // Once per result screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultVisible]);

  const startTrip = (suggestion: CitySuggestion) => {
    // The traveller's own numbers win: the budget they typed and the days they
    // chose are what every later step spends.
    const tripDays = Math.max(1, days || suggestion.days || 3);
    setTravelData((current) => ({
      ...current,
      destination: suggestion.name,
      days: tripDays,
      departureDate: departureDate || current.departureDate || isoIn(7),
      returnDate: returnDate || isoIn(7 + tripDays),
      budget: budgetMillions,
      travelers: adults,
      children: kids,
      tripStyle: result.headline,
      quizResult: suggestion.name,
      quizAnswers: answers,
      // Answers first; when the traveller wrote freely, their own words decide.
      preferredMode: preferredTransportMode(questions, answers) || preferredModeFromText(description),
      // The taste is kept for the plan page: when nothing is picked, the days
      // are suggested from exactly this.
      tasteMoods: result.moods.slice(0, 3).map((entry) => entry.mood),
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
              دوازده سؤال کوتاه — هر بار سؤال‌های تازه — و در پایان بودجه، تعداد نفرات، تاریخ رفت و برگشت و طول سفر؛ تا شهر مناسب را در ایران پیدا کنیم.
            </p>
            {questionSource === "ai" ? (
              <p className="mt-2 text-[9.5px] text-emerald-300/80">سؤال‌های این دور مخصوص همین سفر نوشته شدند؛ دور بعدی سؤال‌های دیگری دارد.</p>
            ) : null}
          </div>

          {/* سه راه ورود: سؤال کوتاه، نوشتن با کلمات خودت، یا گفتن با صدا. */}
          <div className="mb-3 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 sm:grid-cols-3">
            {[
              {
                id: "quiz" as const,
                title: "چند سؤال کوتاه",
                subtitle: "۱۲ سؤال تازه، هر بار متفاوت",
                icon: <Sparkles className="h-3.5 w-3.5" />,
                active: "bg-cyan-400/20 text-cyan-100 shadow-glow",
              },
              {
                id: "text" as const,
                title: "خودم می‌نویسم",
                subtitle: "حال‌وهوای سفر را با کلمات خودت بنویس",
                icon: <Wand2 className="h-3.5 w-3.5" />,
                active: "bg-teal-400/20 text-teal-100 shadow-warm",
              },
              {
                id: "voice" as const,
                title: "با صدا می‌گویم",
                subtitle: "دستیار صوتی می‌شنود و همان متن را می‌سازد",
                icon: <Mic className="h-3.5 w-3.5" />,
                active: "bg-violet-400/20 text-violet-100 shadow-glow",
              },
            ].map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setMode(entry.id)}
                aria-pressed={mode === entry.id}
                className={`rounded-xl px-3 py-2.5 text-right transition ${mode === entry.id ? entry.active : "text-slate-400 hover:text-white"}`}
              >
                <span className="flex items-center gap-1.5 text-[11px] font-extrabold">
                  {entry.icon}
                  {entry.title}
                </span>
                <span className="mt-0.5 block text-[9px] font-medium leading-5 opacity-80">{entry.subtitle}</span>
              </button>
            ))}
          </div>

          {mode === "voice" && !described ? (
            <div className="glass mb-3 p-4 sm:p-6">
              <h2 className="text-sm font-black text-white">با صدایت بگو چه سفری می‌خواهی</h2>
              <p className="mt-1.5 text-[10.5px] leading-6 text-slate-400">
                مثلاً: «چهار روز کنار دریا، با همسرم، حدود بیست میلیون». مرورگر خودت گوش می‌دهد؛ هیچ صدایی جایی فرستاده نمی‌شود.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => (listening ? stopVoice() : startVoice())}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black transition ${
                    listening ? "bg-rose-500 text-white" : "bg-violet-500 text-white hover:bg-violet-400"
                  }`}
                >
                  {listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  {listening ? "بس است، تمام" : "شروع شنیدن"}
                </button>
                {description ? (
                  <button type="button" onClick={applyDescription} className="btn-primary !px-4 !py-2.5 text-[11px]">
                    <Sparkles className="h-3.5 w-3.5" />
                    پیشنهاد مقصد را ببین
                  </button>
                ) : null}
              </div>
              <p className="mt-3 min-h-[3rem] rounded-xl border border-white/10 bg-slate-950/50 p-3 text-[11.5px] leading-7 text-white">
                {description || (listening ? "گوش می‌دهم…" : "چیزی که می‌گویی همین‌جا نوشته می‌شود.")}
              </p>
              {voiceNote ? <p className="mt-2 text-[10px] leading-6 text-amber-200">{voiceNote}</p> : null}
            </div>
          ) : mode === "text" && !described ? (
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
                  {resultVisible ? "نتیجه آماده است" : onMoneyStep ? "آخرین قدم · بودجه، نفرات، تاریخ و طول سفر" : `سؤال ${faNumber(step + 1)} از ${faNumber(totalQuestions)}`}
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
              {(mode === "text" || mode === "voice") && !described ? (
                <motion.div key="text-mode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                  <p className="text-[11px] leading-7 text-slate-400">
                    {mode === "voice"
                      ? "دکمهٔ «شروع شنیدن» را بزن و سفرت را بگو؛ بعد «پیشنهاد مقصد را ببین»."
                      : "متن بالا را بنویس و «پیشنهاد مقصد را ببین» را بزن؛ یا از دکمهٔ «چند سؤال کوتاه» استفاده کن."}
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
              ) : onMoneyStep ? (
                <motion.div
                  key="money-step"
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -30 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center">
                    <span className="chip border-turquoise-400/30 bg-turquoise-400/10 !text-turquoise-200">
                      <Banknote className="h-3.5 w-3.5" />
                      همیشه پرسیده می‌شود
                    </span>
                    <h2 className="mt-3 text-lg font-extrabold leading-8 text-white sm:text-xl">بودجه، نفرات، تاریخ و طول سفرت چقدر است؟</h2>
                    <p className="mt-1.5 text-[11px] leading-6 text-slate-400">
                      این چهار چیز پای همهٔ پیشنهادهاست: بودجه بین همه تقسیم می‌شود، بلیت و اقامت برای همین تعداد حساب می‌شود، تاریخ بلیت را واقعی می‌کند و شهرها با سهم هر نفر سنجیده می‌شوند.
                    </p>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <label className="block">
                      <span className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-300">
                        <span>بودجهٔ کل سفر (برای همهٔ نفرات)</span>
                        <b className="text-cyan-200">{faNumber(budgetMillions)} میلیون تومان</b>
                      </span>
                      <span className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-night-800/90 px-3 py-2">
                        <input
                          dir="ltr"
                          type="number"
                          min={3}
                          max={300}
                          step={1}
                          value={budgetMillions}
                          onChange={(event) => setBudgetMillions(Math.min(300, Math.max(3, Math.round(Number(event.target.value) || 3))))}
                          aria-label="بودجهٔ کل سفر به میلیون تومان"
                          className="w-24 bg-transparent text-center text-base font-black text-white outline-none"
                        />
                        <span className="text-[10px] text-slate-400">میلیون تومان</span>
                        <input
                          type="range"
                          min={5}
                          max={120}
                          step={1}
                          value={Math.min(120, budgetMillions)}
                          onChange={(event) => setBudgetMillions(Number(event.target.value))}
                          className="mr-auto w-full max-w-[180px] cursor-pointer accent-cyan-400"
                          aria-label="تنظیم بودجه"
                        />
                      </span>
                    </label>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[10, 15, 20, 30, 45, 70].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setBudgetMillions(amount)}
                          aria-pressed={budgetMillions === amount}
                          className={`rounded-full border px-3 py-1 text-[10.5px] font-bold transition ${
                            budgetMillions === amount ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                          }`}
                        >
                          {faNumber(amount)} میلیون
                        </button>
                      ))}
                    </div>

                    <div className="mt-5 border-t border-white/5 pt-4">
                      <span className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-300">
                        <span>چند نفر می‌روید؟</span>
                        <b className="text-cyan-200">{faNumber(peopleCount)} نفر</b>
                      </span>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300"><User className="h-3.5 w-3.5 text-cyan-300" />بزرگسال</span>
                          <span className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAdults((value) => Math.max(1, value - 1))}
                              disabled={adults <= 1}
                              aria-label="یک بزرگسال کمتر"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-35"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <b className="w-6 text-center text-sm font-black text-white">{faNumber(adults)}</b>
                            <button
                              type="button"
                              onClick={() => setAdults((value) => Math.min(6, value + 1))}
                              disabled={adults >= 6}
                              aria-label="یک بزرگسال بیشتر"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-35"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300"><Baby className="h-3.5 w-3.5 text-turquoise-300" />کودک</span>
                          <span className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setKids((value) => Math.max(0, value - 1))}
                              disabled={kids <= 0}
                              aria-label="یک کودک کمتر"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-35"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <b className="w-6 text-center text-sm font-black text-white">{faNumber(kids)}</b>
                            <button
                              type="button"
                              onClick={() => setKids((value) => Math.min(5, value + 1))}
                              disabled={kids >= 5}
                              aria-label="یک کودک بیشتر"
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-200 transition hover:bg-white/[0.1] disabled:opacity-35"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 flex flex-wrap items-baseline gap-1.5 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.06] px-3 py-2 text-[10.5px] leading-6 text-cyan-100">
                        <span>سهم هر نفر از این بودجه:</span>
                        <b className="text-[13px] font-black text-cyan-200">{faNumber(Math.round(perPersonMillions * 10) / 10)} میلیون تومان</b>
                        <span className="text-slate-400">({faNumber(perPersonToman)} تومان) — شهرها با همین سهم سنجیده می‌شوند.</span>
                      </p>
                    </div>

                    <div className="mt-5 border-t border-white/5 pt-4">
                      <span className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-300">
                        <span>چند روز می‌خواهی بمانی؟</span>
                        <b className="text-cyan-200">{faNumber(days)} روز · {faNumber(Math.max(1, days - 1))} شب</b>
                      </span>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[2, 3, 4, 5, 7, 10].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setTripDays(amount)}
                            aria-pressed={days === amount}
                            className={`rounded-full border px-3 py-1 text-[10.5px] font-bold transition ${
                              days === amount ? "border-teal-400/50 bg-teal-400/15 text-teal-100" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                            }`}
                          >
                            {faNumber(amount)} روز
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[9.5px] leading-6 text-slate-500">
                        با این عددها، سهم غذا و رفت‌وآمد روزانه هم حساب می‌شود تا پیشنهاد از بودجهٔ واقعی بیرون نزند.
                      </p>
                    </div>

                    <div className="mt-5 border-t border-white/5 pt-4">
                      <span className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-300">
                        <span>تاریخ رفت و برگشت</span>
                        <b className="text-cyan-200">
                          {departureDate ? formatJalaliDate(departureDate) : "انتخاب نشده"}
                          {roundTrip && returnDate ? ` تا ${formatJalaliDate(returnDate)}` : roundTrip ? "" : " · یک‌طرفه"}
                        </b>
                      </span>
                      <p className="mt-1 text-[9.5px] leading-6 text-slate-500">
                        همان تقویم بلیت: حرکت را بزن، برگشت خودکار چند روز بعد پر می‌شود؛ با کلیک روی برگشت می‌توانی عوضش کنی. بلیت در مرحلهٔ بعد دقیقاً برای همین تاریخ‌ها جست‌وجو می‌شود.
                      </p>
                      <div className="relative z-30 mt-2 max-w-lg">
                        <JalaliRangeCalendar
                          departureDate={departureDate}
                          returnDate={returnDate}
                          roundTrip={roundTrip}
                          onRoundTripChange={(value) => {
                            setRoundTrip(value);
                            if (!value) {
                              setReturnDate("");
                              return;
                            }
                            const base = departureDate || addDaysToIso(todayIso(), 7);
                            setDepartureDate(base);
                            setReturnDate(addDaysToIso(base, Math.max(1, days)));
                          }}
                          onChange={(field, value) => {
                            if (field === "departureDate") {
                              setDepartureDate(value);
                              if (roundTrip && value) setReturnDate(addDaysToIso(value, Math.max(1, days)));
                              return;
                            }
                            setReturnDate(value);
                          }}
                        />
                      </div>
                      {!departureDate ? (
                        <p className="mt-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-[10px] leading-6 text-amber-100">
                          تاریخ حرکت را از تقویم انتخاب کن؛ بدون تاریخ، بلیت را نمی‌توان واقعی جست‌وجو کرد.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/5 pt-4">
                    <button type="button" onClick={goBack} className="btn-ghost !px-3.5 !py-2 text-[11px]">
                      <ArrowRight className="h-3.5 w-3.5" />
                      قبلی
                    </button>
                    <button type="button" onClick={goNext} className="btn-primary !px-4 !py-2.5 text-[11px]">
                      دیدن پیشنهادها
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
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
                    <div className="mt-4 text-right">
                      <ArchetypeCard
                        moods={result.moods.slice(0, 3).map((entry) => entry.mood)}
                        budgetMillions={budgetMillions}
                        people={peopleCount}
                        days={Math.max(1, days || 3)}
                        children={kids}
                        mode={preferredTransportMode(questions, answers) || preferredModeFromText(description)}
                      />
                    </div>
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
                                    حدود {faNumber(Math.round(suggestion.estimatedToman / 1_000_000))} میلیون تومان برای {faNumber(peopleCount)} نفر و {faNumber(suggestion.days)} روز
                                    {suggestion.overBudget
                                      ? " · بیشتر از بودجه‌ات"
                                      : ` · سهم هر نفر ${faNumber(Math.round((suggestion.estimatedToman / peopleCount) / 1_000_000))} میلیون`}
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
