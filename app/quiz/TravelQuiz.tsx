"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarDays,
  Check,
  Compass,
  Heart,
  Home,
  Landmark,
  MapPin,
  Mountain,
  Plane,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  Trees,
  User,
  Users,
  Utensils,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TravelSteps from "@/components/TravelSteps";

type ResultKey = "kish" | "istanbul" | "dubai" | "cappadocia" | "nature";
type Points = Partial<Record<ResultKey, number>>;

type QuizOption = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  points: Points;
};

type Question = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  options: QuizOption[];
};

const QUESTIONS: Question[] = [
  {
    id: "style",
    eyebrow: "سبک سفر",
    title: "در سفر بیشتر دنبال چه تجربه‌ای هستی؟",
    description: "اولین چیزی را انتخاب کن که وقتی به سفر فکر می‌کنی به ذهنت می‌رسد.",
    options: [
      {
        id: "beach",
        title: "آرامش و دریا",
        description: "ساحل، غروب و یک برنامهٔ بدون عجله",
        icon: Waves,
        points: { kish: 4, nature: 1 },
      },
      {
        id: "culture",
        title: "تاریخ و شهرگردی",
        description: "کوچه‌های قدیمی، موزه و کافه‌های محلی",
        icon: Landmark,
        points: { istanbul: 4 },
      },
      {
        id: "luxury",
        title: "خرید و تجربهٔ لوکس",
        description: "هتل خاص، رستوران‌های معروف و مراکز خرید",
        icon: ShoppingBag,
        points: { dubai: 4 },
      },
      {
        id: "adventure",
        title: "طبیعت و ماجراجویی",
        description: "منظره‌های متفاوت و تجربه‌های هیجان‌انگیز",
        icon: Mountain,
        points: { cappadocia: 3, nature: 2 },
      },
    ],
  },
  {
    id: "budget",
    eyebrow: "بودجه",
    title: "بودجهٔ تقریبی هر نفر چقدر است؟",
    description: "یک بازهٔ حدودی کافی است؛ بعداً می‌توانی برنامه را دقیق‌تر کنی.",
    options: [
      {
        id: "economy",
        title: "اقتصادی",
        description: "تا ۱۵ میلیون تومان",
        icon: Banknote,
        points: { nature: 3, kish: 1 },
      },
      {
        id: "balanced",
        title: "متعادل",
        description: "۱۵ تا ۳۰ میلیون تومان",
        icon: Banknote,
        points: { kish: 2, istanbul: 1 },
      },
      {
        id: "comfort",
        title: "راحت",
        description: "۳۰ تا ۵۰ میلیون تومان",
        icon: Banknote,
        points: { istanbul: 2, cappadocia: 1 },
      },
      {
        id: "premium",
        title: "بدون سقف مشخص",
        description: "کیفیت تجربه برایم مهم‌تر است",
        icon: Sparkles,
        points: { dubai: 3, cappadocia: 1 },
      },
    ],
  },
  {
    id: "duration",
    eyebrow: "زمان",
    title: "چند روز می‌توانی سفر کنی؟",
    description: "طول سفر به ما کمک می‌کند مقصد و ریتم برنامه را بهتر پیشنهاد دهیم.",
    options: [
      {
        id: "short",
        title: "۲ تا ۳ روز",
        description: "یک فرار کوتاه و پرانرژی",
        icon: CalendarDays,
        points: { kish: 2, nature: 2 },
      },
      {
        id: "medium",
        title: "۴ تا ۶ روز",
        description: "زمان کافی برای دیدن و استراحت",
        icon: CalendarDays,
        points: { istanbul: 2, dubai: 1 },
      },
      {
        id: "long",
        title: "یک هفته یا بیشتر",
        description: "سفر عمیق و بدون عجله",
        icon: CalendarDays,
        points: { cappadocia: 2, dubai: 1 },
      },
      {
        id: "flexible",
        title: "انعطاف‌پذیر است",
        description: "برنامه را بر اساس مقصد می‌چینم",
        icon: Compass,
        points: { nature: 1, cappadocia: 1 },
      },
    ],
  },
  {
    id: "companions",
    eyebrow: "همراهان",
    title: "این سفر را با چه کسانی می‌روی؟",
    description: "ترکیب مسافران، انتخاب اقامت و تجربه‌های پیشنهادی را تغییر می‌دهد.",
    options: [
      {
        id: "solo",
        title: "تنها",
        description: "آزادی کامل برای کشف مقصد",
        icon: User,
        points: { istanbul: 2, cappadocia: 1 },
      },
      {
        id: "couple",
        title: "با همسر یا پارتنر",
        description: "یک خاطرهٔ دونفره و خاص",
        icon: Heart,
        points: { kish: 2, cappadocia: 1 },
      },
      {
        id: "family",
        title: "با خانواده",
        description: "راحتی و سرگرمی برای همه",
        icon: Users,
        points: { dubai: 2, kish: 1 },
      },
      {
        id: "friends",
        title: "با دوستان",
        description: "تجربه‌های گروهی و پرانرژی",
        icon: Users,
        points: { nature: 2, istanbul: 1 },
      },
    ],
  },
  {
    id: "priority",
    eyebrow: "اولویت",
    title: "اگر فقط یک انتخاب داشته باشی، کدام مهم‌تر است؟",
    description: "این آخرین سؤال است؛ پاسخت وزن بیشتری در پیشنهاد نهایی دارد.",
    options: [
      {
        id: "relax",
        title: "استراحت واقعی",
        description: "اقامت راحت و برنامهٔ کم‌تحرک",
        icon: Waves,
        points: { kish: 3, nature: 1 },
      },
      {
        id: "food",
        title: "غذا و فرهنگ",
        description: "طعم‌های تازه و زندگی محلی",
        icon: Utensils,
        points: { istanbul: 3 },
      },
      {
        id: "shopping",
        title: "خرید و رفاه",
        description: "تجربه‌های مدرن و خدمات باکیفیت",
        icon: ShoppingBag,
        points: { dubai: 3 },
      },
      {
        id: "outdoor",
        title: "هیجان در طبیعت",
        description: "یک قصهٔ متفاوت برای تعریف کردن",
        icon: Trees,
        points: { cappadocia: 2, nature: 2 },
      },
    ],
  },
];

const RESULTS: Record<
  ResultKey,
  {
    city: string;
    country: string;
    emoji: string;
    title: string;
    description: string;
    duration: string;
    highlights: string[];
  }
> = {
  kish: {
    city: "کیش",
    country: "ایران",
    emoji: "🏝️",
    title: "آرامش کنار خلیج فارس",
    description:
      "ترکیب ساحل، اقامت راحت و برنامهٔ منعطف با پاسخ‌های تو هماهنگ است. کیش برای سفری کم‌دغدغه و پر از لحظه‌های آرام پیشنهاد می‌شود.",
    duration: "۳ تا ۵ روز",
    highlights: ["غروب ساحل مروارید", "تفریحات دریایی", "رستوران‌های ساحلی"],
  },
  istanbul: {
    city: "استانبول",
    country: "ترکیه",
    emoji: "🕌",
    title: "شهری میان تاریخ و زندگی مدرن",
    description:
      "علاقه‌ات به فرهنگ، غذا و شهرگردی نشان می‌دهد استانبول انتخاب خوبی است؛ جایی که هر محله یک تجربهٔ تازه برایت دارد.",
    duration: "۴ تا ۶ روز",
    highlights: ["گشت تاریخی سلطان‌احمد", "قایق‌سواری در بسفر", "کافه‌ها و غذاهای محلی"],
  },
  dubai: {
    city: "دبی",
    country: "امارات",
    emoji: "🌆",
    title: "تجربه‌ای مدرن و باکیفیت",
    description:
      "اولویت تو راحتی، خرید و تجربه‌های خاص است. دبی با هتل‌های متنوع و سرگرمی‌های خانوادگی و لوکس با این سبک سفر هماهنگ است.",
    duration: "۴ تا ۷ روز",
    highlights: ["برج خلیفه و دبی‌مال", "سافاری کویر", "تفریحات خانوادگی"],
  },
  cappadocia: {
    city: "کاپادوکیه",
    country: "ترکیه",
    emoji: "🎈",
    title: "منظره‌ای که شبیه هیچ‌جای دیگر نیست",
    description:
      "برای مسافری که تجربه‌های متفاوت و طبیعت را دوست دارد، کاپادوکیه ترکیبی از منظره، هیجان و آرامش است.",
    duration: "۴ تا ۷ روز",
    highlights: ["بالن‌سواری هنگام طلوع", "اقامت در هتل‌های صخری", "گشت دره‌ها و شهرهای زیرزمینی"],
  },
  nature: {
    city: "شمال ایران",
    country: "ایران",
    emoji: "🌲",
    title: "نفس کشیدن میان جنگل و دریا",
    description:
      "پاسخ‌هایت نشان می‌دهد طبیعت، انعطاف و صرفه‌جویی برایت ارزشمند است. یک سفر جنگلی به شمال ایران می‌تواند شروع خوبی باشد.",
    duration: "۲ تا ۴ روز",
    highlights: ["اقامت در کلبهٔ جنگلی", "پیاده‌روی در طبیعت", "بازارها و غذاهای محلی"],
  },
};

const faNumber = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

function calculateResult(answers: Record<string, string>): ResultKey {
  const scores: Record<ResultKey, number> = {
    kish: 0,
    istanbul: 0,
    dubai: 0,
    cappadocia: 0,
    nature: 0,
  };

  QUESTIONS.forEach((question) => {
    const option = question.options.find((item) => item.id === answers[question.id]);
    if (!option) return;

    Object.entries(option.points).forEach(([key, value]) => {
      scores[key as ResultKey] += value ?? 0;
    });
  });

  return (Object.keys(scores) as ResultKey[]).reduce((best, key) =>
    scores[key] > scores[best] ? key : best,
  );
}

export default function TravelQuiz() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const showResult = step === QUESTIONS.length;
  const question = QUESTIONS[Math.min(step, QUESTIONS.length - 1)];
  const selectedOption = answers[question.id];
  const resultKey = useMemo(() => calculateResult(answers), [answers]);
  const result = RESULTS[resultKey];
  const progress = showResult ? 100 : ((step + 1) / QUESTIONS.length) * 100;

  const goNext = () => {
    if (!selectedOption || showResult) return;
    setDirection(1);
    setStep((current) => current + 1);
  };

  const goBack = () => {
    if (step === 0) return;
    setDirection(-1);
    setStep((current) => current - 1);
  };

  const restart = () => {
    setAnswers({});
    setDirection(-1);
    setStep(0);
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#132038_0%,#05070f_58%)]" />
          <div className="absolute inset-0 grid-lines opacity-60" />
          <div className="aurora">
            <span className="-top-20 right-0 h-80 w-80 animate-float bg-amber-500/30" />
            <span className="left-0 top-1/3 h-72 w-72 animate-float bg-turquoise-500/20 [animation-delay:1.5s]" />
          </div>
        </div>

        <header className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <a href="/" className="group flex items-center gap-2.5" aria-label="بازگشت به صفحهٔ اصلی سفرینو">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-slate-950 shadow-glow transition group-hover:scale-105">
              <Plane className="h-5 w-5 -rotate-45" strokeWidth={2.6} />
            </span>
            <span className="flex flex-col leading-none">
              <b className="text-lg font-black text-white">سفرینو</b>
              <small className="text-[10px] tracking-widest text-slate-400">SAFARINO</small>
            </span>
          </a>
          <a href="/" className="btn-ghost !px-4 !py-2.5 text-xs">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">صفحهٔ اصلی</span>
          </a>
        </header>

        <TravelSteps current={1} />

        <section className="mx-auto max-w-3xl pb-8 pt-10 sm:pt-14">
          <div className="mb-8 text-center">
            <span className="chip border-amber-400/25 bg-amber-400/10 !text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              پیشنهاد مقصد در کمتر از یک دقیقه
            </span>
            <h1 className="mt-5 text-3xl font-black leading-tight text-white sm:text-5xl">
              سفر ایده‌آل تو <span className="gradient-text">چه شکلی است؟</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
              به پنج سؤال کوتاه جواب بده تا بر اساس سلیقه، بودجه و زمانت یک نقطهٔ شروع مناسب پیشنهاد کنیم.
            </p>
          </div>

          <div className="glass overflow-hidden p-5 shadow-card sm:p-8">
            <div className="mb-7">
              <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                <span aria-live="polite">
                  {showResult
                    ? "نتیجهٔ کوییز آماده است"
                    : `سؤال ${faNumber(step + 1)} از ${faNumber(QUESTIONS.length)}`}
                </span>
                <b className="text-amber-300">{faNumber(Math.round(progress))}٪</b>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="پیشرفت کوییز"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <motion.div
                  className="h-full rounded-full bg-gradient-to-l from-amber-300 via-orange-400 to-rose-400"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
            </div>

            <AnimatePresence mode="wait" custom={direction}>
              {!showResult ? (
                <motion.div
                  key={question.id}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -30 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="text-center">
                    <span className="text-xs font-bold text-turquoise-300">{question.eyebrow}</span>
                    <h2 className="mt-2 text-xl font-extrabold leading-8 text-white sm:text-2xl">
                      {question.title}
                    </h2>
                    <p className="mt-2 text-xs leading-6 text-slate-400 sm:text-sm">{question.description}</p>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={question.title}>
                    {question.options.map((option) => {
                      const Icon = option.icon;
                      const isSelected = selectedOption === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                          className={`group relative flex items-start gap-3 rounded-2xl border p-4 text-right outline-none transition focus-visible:ring-2 focus-visible:ring-amber-300/70 ${
                            isSelected
                              ? "border-amber-300/60 bg-amber-300/10 shadow-glow"
                              : "border-white/10 bg-white/[0.035] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"
                          }`}
                        >
                          <span
                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition ${
                              isSelected
                                ? "border-amber-300/30 bg-amber-300/15 text-amber-200"
                                : "border-white/10 bg-white/5 text-slate-300 group-hover:text-amber-200"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block text-sm font-bold text-white">{option.title}</b>
                            <span className="mt-1 block text-[11px] leading-5 text-slate-400">{option.description}</span>
                          </span>
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                              isSelected ? "border-amber-300 bg-amber-300 text-slate-950" : "border-white/20 text-transparent"
                            }`}
                            aria-hidden="true"
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/5 pt-5">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={step === 0}
                      className="btn-ghost !px-4 !py-2.5 text-xs disabled:cursor-not-allowed disabled:opacity-30 sm:!px-5"
                    >
                      <ArrowRight className="h-4 w-4" />
                      قبلی
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!selectedOption}
                      className="btn-primary !px-5 !py-2.5 text-xs disabled:cursor-not-allowed disabled:grayscale disabled:opacity-40 sm:!px-7"
                    >
                      {step === QUESTIONS.length - 1 ? "نمایش نتیجه" : "سؤال بعدی"}
                      <ArrowLeft className="h-4 w-4" />
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
                      <BadgeCheck className="h-3.5 w-3.5" />
                      همسفر تو پیدا شد
                    </span>
                    <div className="mt-5 text-6xl" aria-hidden="true">{result.emoji}</div>
                    <p className="mt-4 text-xs text-slate-400">مقصد پیشنهادی سفرینو برای تو</p>
                    <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">
                      {result.city}
                      <span className="mr-2 text-sm font-medium text-slate-400">{result.country}</span>
                    </h2>
                    <h3 className="gradient-text mt-3 text-lg font-extrabold">{result.title}</h3>
                    <p className="mx-auto mt-4 max-w-xl text-sm leading-8 text-slate-300">{result.description}</p>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_1.4fr]">
                    <div className="glass-soft flex items-center gap-3 p-4">
                      <CalendarDays className="h-5 w-5 shrink-0 text-amber-300" />
                      <div>
                        <span className="block text-[11px] text-slate-500">مدت پیشنهادی</span>
                        <b className="mt-1 block text-sm text-white">{result.duration}</b>
                      </div>
                    </div>
                    <div className="glass-soft p-4">
                      <span className="mb-2 flex items-center gap-2 text-[11px] text-slate-500">
                        <MapPin className="h-4 w-4 text-turquoise-300" />
                        تجربه‌های پیشنهادی
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {result.highlights.map((highlight) => (
                          <span key={highlight} className="chip !text-[10px]">{highlight}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="mt-5 rounded-2xl border border-sky-400/15 bg-sky-400/5 p-3 text-center text-[11px] leading-6 text-slate-400">
                    این نتیجه یک پیشنهاد اولیه بر اساس پاسخ‌های شماست؛ زمان و هزینهٔ نهایی پس از استعلام مشخص می‌شود.
                  </p>

                  <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/5 pt-5 sm:flex-row sm:justify-between">
                    <button type="button" onClick={restart} className="btn-ghost !px-5 !py-3 text-xs">
                      <RotateCcw className="h-4 w-4" />
                      شروع دوباره
                    </button>
                    <a href="/transport" className="btn-primary !px-5 !py-3 text-xs">
                      گام بعدی: محاسبه حمل‌ونقل و خودرو
                      <ArrowLeft className="h-4 w-4" />
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="mt-5 text-center text-[11px] leading-6 text-slate-600">
            پاسخ‌های شما فقط در همین صفحه پردازش می‌شوند و به هیچ سروری ارسال نمی‌شوند.
          </p>
        </section>
      </main>
    </MotionConfig>
  );
}
