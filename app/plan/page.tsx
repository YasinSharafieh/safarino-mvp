"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  ArrowRight,
  BedDouble,
  Camera,
  CarFront,
  Check,
  Clock3,
  CloudSun,
  Coffee,
  Download,
  Lightbulb,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Share2,
  Shirt,
  Sparkles,
  Utensils,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TravelSteps from "@/components/TravelSteps";

type ActivityType = "sightseeing" | "food" | "transport" | "rest" | "activity";
type PlanItem = { time: string; title: string; description: string; type: ActivityType };
type PlanDay = { day: number; title: string; items: PlanItem[] };
type BudgetAnalysis = {
  totalBudget: number;
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  remaining: number;
  summary: string;
};
type TravelPlan = {
  budgetAnalysis: BudgetAnalysis;
  days: PlanDay[];
  recommendations: {
    weather: string;
    clothing: string;
    restaurants: string[];
    costSaving: string[];
  };
};

const numberFormatter = new Intl.NumberFormat("fa-IR");
const compactFormatter = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const formatNumber = (value: number) => numberFormatter.format(Math.round(value));
const formatToman = (value: number) => `${formatNumber(value)} تومان`;
const formatCompact = (value: number) => `${compactFormatter.format(value / 1_000_000)} میلیون`;

const ACTIVITY_STYLES: Record<ActivityType, { icon: LucideIcon; tone: string; label: string }> = {
  sightseeing: { icon: Camera, tone: "bg-sky-400/10 text-sky-300 border-sky-400/20", label: "بازدید" },
  food: { icon: Utensils, tone: "bg-amber-400/10 text-amber-300 border-amber-400/20", label: "غذا" },
  transport: { icon: CarFront, tone: "bg-violet-400/10 text-violet-300 border-violet-400/20", label: "جابه‌جایی" },
  rest: { icon: BedDouble, tone: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20", label: "استراحت" },
  activity: { icon: Sparkles, tone: "bg-rose-400/10 text-rose-300 border-rose-400/20", label: "تجربه" },
};

function localDay(day: number, destination: string): PlanDay {
  const schedules: PlanItem[][] = [
    [
      { time: "۰۸:۰۰", title: "صبحانه و آماده‌سازی", description: "صبحانه در اقامتگاه و آماده‌شدن برای شروع روز اول.", type: "food" },
      { time: "۰۹:۳۰", title: "بازدید از مرکز تاریخی", description: `آشنایی با مهم‌ترین جاذبه‌های مرکز ${destination} و عکاسی.`, type: "sightseeing" },
      { time: "۱۲:۳۰", title: "ناهار در رستوران محلی", description: "تجربه غذای معروف مقصد در یک رستوران خوش‌قیمت.", type: "food" },
      { time: "۱۵:۰۰", title: "استراحت کوتاه", description: "بازگشت به اقامتگاه و استراحت برای برنامه عصر.", type: "rest" },
      { time: "۱۷:۰۰", title: "گشت در بازار", description: "خرید سوغات و تماشای رنگ‌ورنگ محلی.", type: "activity" },
      { time: "۲۰:۰۰", title: "شام و پیاده‌روی", description: "پایان روز با شام سبک و پیاده‌روی آرام.", type: "food" },
    ],
    [
      { time: "۰۸:۳۰", title: "صبحانه", description: "شروع پرانرژی روز دوم با صبحانه.", type: "food" },
      { time: "۱۰:۰۰", title: "جاذبه‌های اطراف شهر", description: "حرکت به مقاصد طبیعی یا تاریخی نزدیک شهر.", type: "transport" },
      { time: "۱۳:۰۰", title: "ناهار و استراحت", description: "ناهار در فضایی محلی و کمی استراحت.", type: "food" },
      { time: "۱۶:۰۰", title: "تجربه ویژه مقصد", description: "زمان آزاد برای تفریح، عکاسی و تجربه محلی.", type: "sightseeing" },
      { time: "۲۰:۰۰", title: "بازگشت و شام", description: "بازگشت به شهر و شام در رستوران پیشنهادی.", type: "food" },
    ],
    [
      { time: "۰۹:۰۰", title: "صبحانه و جمع‌کردن وسایل", description: "آماده‌شدن برای روز پایانی و مرور برنامه.", type: "rest" },
      { time: "۱۰:۳۰", title: "آخرین بازدیدها", description: "بازدید از جاذبه‌ای که در روزهای قبل جا مانده است.", type: "sightseeing" },
      { time: "۱۳:۰۰", title: "ناهار", description: "ناهار سبک پیش از خرید و آماده‌شدن برای بازگشت.", type: "food" },
      { time: "۱۵:۳۰", title: "خرید سوغات", description: "خرید هدیه و سوغات برای خانواده و دوستان.", type: "activity" },
      { time: "۱۸:۰۰", title: "پایان سفر", description: "حرکت به سمت ترمینال یا شروع مسیر بازگشت.", type: "transport" },
    ],
  ];
  return { day, title: `روز ${formatNumber(day)} · کشف ${destination}`, items: schedules[(day - 1) % schedules.length] };
}

function createLocalPlan(destination: string, budget: number, days: number, transport = 3_200_000, accommodation = 4_950_000): TravelPlan {
  const food = Math.round(budget * 0.16);
  const activities = Math.round(budget * 0.1);
  const remaining = Math.max(0, budget - transport - accommodation - food - activities);
  return {
    budgetAnalysis: {
      totalBudget: budget,
      transport,
      accommodation,
      food,
      activities,
      remaining,
      summary: "این برآورد اولیه است و پس از اتصال به سرویس AI، بر اساس اطلاعات دقیق‌تر بازتنظیم می‌شود.",
    },
    days: Array.from({ length: days }, (_, index) => localDay(index + 1, destination)),
    recommendations: {
      weather: "هوای مشهد در روزهای آفتابی معمولاً خشک است؛ پیش‌بینی دقیق چند روز قبل از حرکت را بررسی کنید و آب کافی همراه داشته باشید.",
      clothing: "کفش راحت برای پیاده‌روی، لباس مناسب فصل و یک لایه سبک برای خنکای شب انتخاب خوبی است.",
      restaurants: ["رستوران‌های محلی اطراف بازار رضا", "غذاهای سنتی طرقبه و شاندیز", "کافه‌های آرام احمدآباد برای عصرانه"],
      costSaving: ["خرید بلیت و رزرو اقامتگاه را زودتر انجام دهید.", "برای مسیرهای کوتاه از حمل‌ونقل عمومی استفاده کنید.", "بخشی از هزینه تفریح را برای تجربه‌های رایگان کنار بگذارید."],
    },
  };
}

export default function PlanPage() {
  const [origin, setOrigin] = useState("تهران");
  const [destination, setDestination] = useState("مشهد");
  const [budget, setBudget] = useState(15_000_000);
  const [dayCount, setDayCount] = useState(3);
  const [preferences, setPreferences] = useState("فرهنگ و تاریخ، غذای محلی، سفر اقتصادی");
  const [plan, setPlan] = useState<TravelPlan>(() => createLocalPlan("مشهد", 15_000_000, 3));
  const [activeDay, setActiveDay] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("برای دریافت برنامه اختصاصی، دکمه بازسازی هوشمند را بزنید.");
  const [noticeTone, setNoticeTone] = useState<"info" | "success" | "warning">("info");
  const [transportDetails, setTransportDetails] = useState<Record<string, unknown>>({ vehicleId: "car", cost: 3_200_000 });
  const [accommodationDetails, setAccommodationDetails] = useState<Record<string, unknown>>({ id: "pearl-suite", nights: 3 });

  useEffect(() => {
    let transportCost = 3_200_000;
    let accommodationCost = 4_950_000;
    try {
      const transportRaw = window.localStorage.getItem("safarino-transport-selection-v1");
      if (transportRaw) {
        const transport = JSON.parse(transportRaw) as Record<string, unknown>;
        setTransportDetails(transport);
        if (typeof transport.cost === "number") transportCost = transport.cost;
      }
      const accommodationRaw = window.localStorage.getItem("safarino-accommodation-selection-v1");
      if (accommodationRaw) {
        const accommodation = JSON.parse(accommodationRaw) as Record<string, unknown>;
        setAccommodationDetails(accommodation);
        const nights = typeof accommodation.nights === "number" ? accommodation.nights : 3;
        const prices: Record<string, number> = {
          "golden-palace": 4_800_000,
          "nene-agha": 1_650_000,
          "silver-coast": 7_200_000,
          "pearl-suite": 2_900_000,
          "friend-hostel": 850_000,
          "eram-garden": 3_500_000,
        };
        accommodationCost = (prices[String(accommodation.id)] ?? 1_650_000) * nights;
      }
    } catch {
      // Default estimates remain available if local storage is invalid.
    }
    setPlan(createLocalPlan("مشهد", 15_000_000, 3, transportCost, accommodationCost));
  }, []);

  const selectedDay = plan.days[Math.min(activeDay, plan.days.length - 1)] ?? plan.days[0];
  const totalSpent = useMemo(() => {
    const analysis = plan.budgetAnalysis;
    return analysis.transport + analysis.accommodation + analysis.food + analysis.activities;
  }, [plan]);
  const spentPercent = Math.round((totalSpent / Math.max(plan.budgetAnalysis.totalBudget, 1)) * 100);

  const regenerate = async () => {
    setLoading(true);
    setNoticeTone("info");
    setNotice("هوش مصنوعی در حال تحلیل بودجه و چیدن برنامه روزهاست…");
    try {
      const endpoint = process.env.NEXT_PUBLIC_AI_PLAN_ENDPOINT || "/api/plan";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          budget,
          days: dayCount,
          travelers: 2,
          transport: transportDetails,
          accommodation: accommodationDetails,
          preferences: preferences.split(/[،,]/).map((item) => item.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.plan?.days?.length) {
        throw new Error(payload.error || "AI request failed");
      }
      setPlan(payload.plan as TravelPlan);
      setActiveDay(0);
      setNoticeTone("success");
      setNotice(`برنامه تازه با ${payload.meta?.model || "هوش مصنوعی"} ساخته شد.`);
    } catch {
      setPlan(createLocalPlan(destination, budget, dayCount, plan.budgetAnalysis.transport, plan.budgetAnalysis.accommodation));
      setActiveDay(0);
      setNoticeTone("warning");
      setNotice("اتصال زنده به AI برقرار نشد؛ نسخه آفلاین ساخته شد. روی Netlify ایستا، مسیر API باید به یک سرویس سروری خارجی متصل شود.");
    } finally {
      setLoading(false);
    }
  };

  const sharePlan = async () => {
    const text = `برنامه سفر من از ${origin} به ${destination} با سفرینو`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "برنامه سفر سفرینو", text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        setNoticeTone("success");
        setNotice("لینک برنامه کپی شد و آماده ارسال برای همراهان است.");
      }
    } catch {
      // Closing the native share sheet is not an error that needs to be shown.
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 print:bg-white print:p-0 print:text-black sm:px-6 lg:px-8">
        <style>{`@media print { body { background: white !important; color: black !important; } .print-card { border: 1px solid #ddd !important; background: white !important; color: black !important; box-shadow: none !important; } .print-card * { color: black !important; text-shadow: none !important; } }`}</style>
        <div className="pointer-events-none absolute inset-0 -z-10 print:hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#14223a_0%,#05070f_60%)]" />
          <div className="absolute inset-0 grid-lines opacity-60" />
          <div className="aurora">
            <span className="-top-24 right-[5%] h-96 w-96 animate-float bg-violet-500/25" />
            <span className="left-[2%] top-[45rem] h-80 w-80 animate-float bg-amber-500/20 [animation-delay:1.5s]" />
          </div>
        </div>

        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 print:hidden">
          <a href="/" className="group flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-slate-950 shadow-glow">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-none">
              <b className="text-lg font-black text-white">سفرینو</b>
              <small className="text-[10px] tracking-widest text-slate-400">AI TRAVEL PLAN</small>
            </span>
          </a>
          <div className="flex gap-2">
            <a href="/accommodation" className="btn-ghost !px-4 !py-2.5 text-xs"><ArrowRight className="h-4 w-4" />مرحله قبل</a>
            <a href="/quiz" className="btn-ghost hidden !px-4 !py-2.5 text-xs sm:inline-flex"><RefreshCw className="h-4 w-4" />شروع سفر جدید</a>
          </div>
        </header>

        <TravelSteps current={4} />

        <div className="mx-auto max-w-7xl pb-16 pt-10 sm:pt-14">
          <section className="text-center print:text-right">
            <span className="chip border-violet-400/25 bg-violet-400/10 !text-violet-200 print:hidden"><Sparkles className="h-3.5 w-3.5" />برنامه‌ساز هوشمند سفر</span>
            <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-5xl">برنامه سفر {origin} به <span className="gradient-text">{destination}</span></h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-400">بودجه، زمان و سلیقه تو؛ تبدیل به یک برنامه روزبه‌روز و قابل اجرا.</p>
          </section>

          <section className="glass mt-8 grid gap-3 p-4 print:hidden sm:grid-cols-2 lg:grid-cols-5">
            <label><span className="mb-1.5 block text-[10px] text-slate-500">مبدأ</span><input value={origin} onChange={(event) => setOrigin(event.target.value)} className="field !py-2.5" /></label>
            <label><span className="mb-1.5 block text-[10px] text-slate-500">مقصد</span><input value={destination} onChange={(event) => setDestination(event.target.value)} className="field !py-2.5" /></label>
            <label><span className="mb-1.5 block text-[10px] text-slate-500">بودجه به تومان</span><input type="number" min="1000000" step="500000" value={budget} onChange={(event) => setBudget(Number(event.target.value))} className="field !py-2.5" /></label>
            <label><span className="mb-1.5 block text-[10px] text-slate-500">تعداد روز</span><select value={dayCount} onChange={(event) => setDayCount(Number(event.target.value))} className="field cursor-pointer !py-2.5">{[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>{formatNumber(day)} روز</option>)}</select></label>
            <label className="sm:col-span-2 lg:col-span-1"><span className="mb-1.5 block text-[10px] text-slate-500">سلیقه سفر</span><input value={preferences} onChange={(event) => setPreferences(event.target.value)} className="field !py-2.5" /></label>
          </section>

          <section className="glass print-card mt-6 p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-xl font-black text-white"><WalletCards className="h-5 w-5 text-emerald-300" />داشبورد تحلیل بودجه</h2>
              <span className="text-xs text-slate-400">{formatNumber(spentPercent)}٪ بودجه تخصیص یافته</span>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-gradient-to-l from-emerald-400 via-amber-400 to-rose-400" animate={{ width: `${Math.min(spentPercent, 100)}%` }} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                { label: "حمل‌ونقل", value: plan.budgetAnalysis.transport, icon: CarFront, color: "bg-sky-400" },
                { label: "اقامت", value: plan.budgetAnalysis.accommodation, icon: BedDouble, color: "bg-violet-400" },
                { label: "غذا", value: plan.budgetAnalysis.food, icon: Utensils, color: "bg-amber-400" },
                { label: "تفریح", value: plan.budgetAnalysis.activities, icon: Camera, color: "bg-rose-400" },
                { label: "باقی‌مانده", value: plan.budgetAnalysis.remaining, icon: WalletCards, color: "bg-emerald-400" },
              ].map((item) => {
                const Icon = item.icon;
                const width = Math.min((item.value / Math.max(plan.budgetAnalysis.totalBudget, 1)) * 100, 100);
                return (
                  <div key={item.label} className="glass-soft p-4">
                    <div className="flex items-center justify-between"><span className="text-[11px] text-slate-400">{item.label}</span><Icon className="h-4 w-4 text-slate-500" /></div>
                    <b className="mt-2 block text-sm font-black text-white">{formatCompact(item.value)}</b>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} /></div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3 text-xs leading-6 text-slate-300">{plan.budgetAnalysis.summary} مجموع تخمین: {formatToman(totalSpent)}.</p>
          </section>

          <div className="mt-6 flex flex-col items-center gap-3 print:hidden">
            <button type="button" onClick={regenerate} disabled={loading || !origin.trim() || !destination.trim()} className="btn-primary w-full max-w-xl !py-4 text-sm disabled:cursor-wait disabled:opacity-60">
              {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
              {loading ? "در حال ساخت برنامه…" : "بازسازی هوشمند برنامه"}
            </button>
            <p role="status" className={`text-center text-[11px] leading-6 ${noticeTone === "success" ? "text-emerald-300" : noticeTone === "warning" ? "text-amber-300" : "text-slate-400"}`}>{notice}</p>
          </div>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><span className="chip print:hidden">تایم‌لاین زنده</span><h2 className="mt-3 text-2xl font-black text-white">برنامه ساعت‌به‌ساعت سفر</h2></div>
              <span className="text-xs text-slate-500">{formatNumber(plan.days.length)} روز برنامه‌ریزی‌شده</span>
            </div>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-2 print:hidden">
              {plan.days.map((day, index) => (
                <button key={day.day} type="button" onClick={() => setActiveDay(index)} className={`shrink-0 rounded-xl border px-5 py-2.5 text-xs font-bold transition ${activeDay === index ? "border-amber-300/50 bg-amber-300/15 text-amber-200" : "border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}>روز {formatNumber(day.day)}</button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={selectedDay?.day ?? 0} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="glass print-card mt-4 p-5 sm:p-7">
                <h3 className="text-lg font-black text-white">{selectedDay?.title}</h3>
                <div className="relative mt-6 space-y-4 before:absolute before:right-[23px] before:top-4 before:h-[calc(100%-32px)] before:w-px before:bg-white/10 sm:before:right-[27px]">
                  {selectedDay?.items.map((item, index) => {
                    const style = ACTIVITY_STYLES[item.type] ?? ACTIVITY_STYLES.activity;
                    const Icon = style.icon;
                    return (
                      <motion.article key={`${item.time}-${index}`} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="relative flex gap-4">
                        <span className={`relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${style.tone}`}><Icon className="h-5 w-5" /></span>
                        <div className="glass-soft flex-1 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs font-black text-amber-200"><Clock3 className="h-3.5 w-3.5" />{item.time}</span><span className="text-[10px] text-slate-500">{style.label}</span></div>
                          <h4 className="mt-2 text-sm font-extrabold text-white">{item.title}</h4>
                          <p className="mt-1.5 text-xs leading-6 text-slate-400">{item.description}</p>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </section>

          <section className="glass print-card mt-8 p-5 sm:p-7">
            <h2 className="flex items-center gap-2 text-xl font-black text-white"><Lightbulb className="h-5 w-5 text-amber-300" />توصیه‌های هوشمند AI</h2>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="glass-soft p-5"><CloudSun className="h-5 w-5 text-sky-300" /><h3 className="mt-3 text-sm font-bold text-white">آب‌وهوا</h3><p className="mt-2 text-xs leading-7 text-slate-400">{plan.recommendations.weather}</p></div>
              <div className="glass-soft p-5"><Shirt className="h-5 w-5 text-violet-300" /><h3 className="mt-3 text-sm font-bold text-white">لباس مناسب</h3><p className="mt-2 text-xs leading-7 text-slate-400">{plan.recommendations.clothing}</p></div>
              <div className="glass-soft p-5"><Utensils className="h-5 w-5 text-amber-300" /><h3 className="mt-3 text-sm font-bold text-white">رستوران و غذای مقصد</h3><ul className="mt-2 space-y-2">{plan.recommendations.restaurants.map((item) => <li key={item} className="flex gap-2 text-xs leading-6 text-slate-400"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-300" />{item}</li>)}</ul></div>
              <div className="glass-soft p-5"><WalletCards className="h-5 w-5 text-emerald-300" /><h3 className="mt-3 text-sm font-bold text-white">کاهش هزینه‌ها</h3><ul className="mt-2 space-y-2">{plan.recommendations.costSaving.map((item) => <li key={item} className="flex gap-2 text-xs leading-6 text-slate-400"><Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-300" />{item}</li>)}</ul></div>
            </div>
          </section>

          <section className="mt-8 flex flex-col justify-center gap-3 print:hidden sm:flex-row">
            <button type="button" onClick={() => window.print()} className="btn-primary"><Download className="h-5 w-5" />چاپ و دانلود PDF</button>
            <button type="button" onClick={sharePlan} className="btn-ghost"><Share2 className="h-5 w-5" />اشتراک‌گذاری با همراهان</button>
          </section>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-[10px] leading-6 text-slate-600 print:hidden"><MapPin className="h-3.5 w-3.5" />برای ذخیره PDF، در پنجره چاپ گزینه Save as PDF را انتخاب کنید.</p>
        </div>
      </main>
    </MotionConfig>
  );
}
