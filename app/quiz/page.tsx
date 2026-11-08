'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  MapPin,
  Plane,
  Sparkles,
} from 'lucide-react';
import { useTravel } from '../context/TravelContext';
import type { TripStyle } from '../context/TravelContext';
import StepIndicator from '../components/StepIndicator';

type StyleOption = {
  id: TripStyle;
  title: string;
  english: string;
  emoji: string;
  description: string;
  gradient: string;
  glow: string;
};

type Destination = {
  name: string;
  province: string;
  image: string;
  tagline: string;
  description: string;
  experiences: string[];
};

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'nature',
    title: 'طبیعت‌گردی',
    english: 'NATURE',
    emoji: '🌿',
    description: 'جنگل، دریا، کوهستان و نفس کشیدن در فضای باز',
    gradient: 'from-emerald-400/30 via-teal-500/10 to-transparent',
    glow: 'hover:border-emerald-300/50 hover:shadow-emerald-500/20',
  },
  {
    id: 'history',
    title: 'تاریخی',
    english: 'HISTORY',
    emoji: '🏛️',
    description: 'معماری باشکوه، فرهنگ اصیل و قصه‌های کهن',
    gradient: 'from-amber-400/30 via-orange-500/10 to-transparent',
    glow: 'hover:border-amber-300/50 hover:shadow-amber-500/20',
  },
  {
    id: 'modern',
    title: 'تفریحی و مدرن',
    english: 'MODERN',
    emoji: '🛍️',
    description: 'خرید، تفریحات تازه و تجربه‌های لوکس شهری',
    gradient: 'from-violet-400/30 via-fuchsia-500/10 to-transparent',
    glow: 'hover:border-violet-300/50 hover:shadow-violet-500/20',
  },
  {
    id: 'spiritual',
    title: 'زیارتی',
    english: 'SPIRITUAL',
    emoji: '🕌',
    description: 'آرامش، معنویت و تجربه‌ای متفاوت از سفر',
    gradient: 'from-sky-400/30 via-cyan-500/10 to-transparent',
    glow: 'hover:border-sky-300/50 hover:shadow-sky-500/20',
  },
];

const DESTINATIONS: Record<TripStyle, Destination[]> = {
  nature: [
    {
      name: 'رشت',
      province: 'گیلان',
      image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=85',
      tagline: 'سفر به قلب سبز ایران',
      description: 'پایتخت غذای ایران؛ شهری سرسبز با بازار پرانرژی و دسترسی فوق‌العاده به جنگل و دریا.',
      experiences: ['بازار رشت', 'جنگل ماسال', 'ساحل انزلی'],
    },
    {
      name: 'رامسر',
      province: 'مازندران',
      image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=85',
      tagline: 'جایی میان کوه و دریا',
      description: 'عروس شهرهای شمالی برای تله‌کابین، جنگل‌نوردی و استراحت کنار ساحل.',
      experiences: ['تله‌کابین', 'جنگل ابر', 'ساحل رامسر'],
    },
  ],
  history: [
    {
      name: 'شیراز',
      province: 'فارس',
      image: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=85',
      tagline: 'شهر شعر و تمدن ایرانی',
      description: 'از تخت جمشید تا باغ‌های ایرانی؛ مقصدی کامل برای عاشقان تاریخ، هنر و فرهنگ.',
      experiences: ['تخت جمشید', 'حافظیه', 'ارگ کریمخان'],
    },
    {
      name: 'اصفهان',
      province: 'اصفهان',
      image: 'https://images.unsplash.com/photo-1577136493850-e9f55e5c6c0b?auto=format&fit=crop&w=1200&q=85',
      tagline: 'نصف جهان در یک شهر',
      description: 'موزه‌ای زنده از معماری، میدان‌های تاریخی، پل‌های باشکوه و صنایع‌دستی اصیل.',
      experiences: ['نقش جهان', 'سی‌وسه‌پل', 'بازار قیصریه'],
    },
  ],
  modern: [
    {
      name: 'کیش',
      province: 'هرمزگان',
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85',
      tagline: 'تجربه مدرن جزیره',
      description: 'خرید، هتل‌های ساحلی و تفریحات دریایی در مدرن‌ترین مقصد جزیره‌ای ایران.',
      experiences: ['مارینا', 'ساحل مرجان', 'مراکز خرید'],
    },
    {
      name: 'قشم',
      province: 'هرمزگان',
      image: 'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1200&q=85',
      tagline: 'ماجراجویی در جنوب',
      description: 'ترکیبی از سواحل آرام، ژئوپارک و جاذبه‌های منحصربه‌فرد برای یک سفر متفاوت.',
      experiences: ['جنگل حرا', 'دره ستارگان', 'غار نمکدان'],
    },
  ],
  spiritual: [
    {
      name: 'مشهد',
      province: 'خراسان رضوی',
      image: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?auto=format&fit=crop&w=1200&q=85',
      tagline: 'سفر آرامش و معنویت',
      description: 'مهم‌ترین مقصد زیارتی ایران با خدمات گسترده و جاذبه‌های متنوع در اطراف شهر.',
      experiences: ['حرم امام رضا', 'بازار رضا', 'طرقبه و شاندیز'],
    },
    {
      name: 'قم',
      province: 'قم',
      image: 'https://images.unsplash.com/photo-1542816417-0983c9c9ad53?auto=format&fit=crop&w=1200&q=85',
      tagline: 'زیارت در فضایی اصیل',
      description: 'مقصدی آرام و معنوی با دسترسی آسان از تهران و تجربه‌ای اصیل از فرهنگ زیارت.',
      experiences: ['حرم حضرت معصومه', 'مسجد جمکران', 'بازار سنتی'],
    },
  ],
};

export default function SmartQuizPage() {
  const router = useRouter();
  const { setTravelData } = useTravel();
  const [step, setStep] = useState<1 | 2>(1);
  const [tripStyle, setTripStyle] = useState<TripStyle | null>(null);
  const [pendingDestination, setPendingDestination] = useState<string | null>(null);

  const selectedStyle = useMemo(
    () => STYLE_OPTIONS.find((option) => option.id === tripStyle),
    [tripStyle],
  );

  const selectStyle = (style: TripStyle) => {
    setTripStyle(style);
    setStep(2);
  };

  const selectDestination = (destination: string) => {
    if (!tripStyle || pendingDestination) return;

    setPendingDestination(destination);
    setTravelData((previous) => ({
      ...previous,
      destination,
      tripStyle,
    }));
    router.push('/transport');
  };

  return (
    <MotionConfig reducedMotion="user">
      <main
        dir="rtl"
        className="relative min-h-screen overflow-hidden bg-[#070713] px-4 py-6 text-white sm:px-6 lg:px-8"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.16),transparent_45%)]" />
          <div className="absolute -right-32 top-24 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="absolute -left-32 bottom-10 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <header className="flex items-center justify-between gap-4">
            <a href="/" className="group flex items-center gap-3" aria-label="صفحه اصلی سفرینو">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-slate-950 shadow-lg shadow-amber-500/20 transition group-hover:scale-105">
                <Plane className="h-5 w-5 -rotate-45" />
              </span>
              <span>
                <b className="block text-lg font-black">سفرینو</b>
                <small className="text-[10px] tracking-[0.25em] text-gray-500">SAFARINO</small>
              </span>
            </a>
            <span className="rounded-full border border-white/10 bg-gray-900/60 px-4 py-2 text-xs text-gray-300 backdrop-blur-xl">
              کوییز هوشمند سفر
            </span>
          </header>

          <div className="mt-8">
            <StepIndicator step={2} />
          </div>

          <div className="mx-auto mt-7 flex max-w-xl items-center gap-3 text-xs text-gray-400">
            <span>مرحله {step === 1 ? '۱' : '۲'} از ۲</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-l from-violet-400 to-amber-300"
                animate={{ width: step === 1 ? '50%' : '100%' }}
              />
            </div>
            <span>{step === 1 ? 'سبک سفر' : 'انتخاب مقصد'}</span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.section
                key="style-step"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="animate-in fade-in slide-in-from-bottom-4 mt-10 duration-700"
              >
                <div className="text-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-xs text-violet-200">
                    <Sparkles className="h-4 w-4" />
                    سفر را با سلیقه تو شروع کنیم
                  </span>
                  <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
                    سفرت باید چه حال و هوایی داشته باشه؟
                  </h1>
                  <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-gray-400 sm:text-base">
                    یک گزینه را انتخاب کن تا مقصدهای متناسب با شخصیت و سلیقه سفرت را پیشنهاد دهیم.
                  </p>
                </div>

                <div className="mt-10 grid gap-5 md:grid-cols-2">
                  {STYLE_OPTIONS.map((option, index) => (
                    <motion.button
                      key={option.id}
                      type="button"
                      initial={{ opacity: 0, y: 25 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      whileHover={{ y: -6, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => selectStyle(option.id)}
                      className={`group relative min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-gray-900/60 p-7 text-right shadow-2xl backdrop-blur-xl transition duration-300 ${option.glow}`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${option.gradient} opacity-70 transition duration-500 group-hover:opacity-100`} />
                      <div className="absolute -left-6 -top-8 text-[9rem] opacity-[0.06] transition duration-500 group-hover:rotate-6 group-hover:scale-110">
                        {option.emoji}
                      </div>
                      <div className="relative flex h-full flex-col">
                        <span className="text-5xl">{option.emoji}</span>
                        <div className="mt-auto pt-10">
                          <span className="text-[10px] font-bold tracking-[0.3em] text-gray-500">{option.english}</span>
                          <h2 className="mt-2 text-3xl font-black">{option.title}</h2>
                          <p className="mt-3 text-sm leading-7 text-gray-300">{option.description}</p>
                          <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-amber-200">
                            انتخاب این حال‌وهوا
                            <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.section>
            ) : (
              <motion.section
                key="destination-step"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.4 }}
                className="animate-in fade-in slide-in-from-bottom-4 mt-10 duration-700"
              >
                <div className="text-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs text-emerald-200">
                    <Check className="h-4 w-4" />
                    سفر {selectedStyle?.title} انتخاب شد
                  </span>
                  <h1 className="mt-6 text-3xl font-black sm:text-5xl">کدام مقصد را انتخاب می‌کنی؟</h1>
                  <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-gray-400">
                    با انتخاب مقصد، سبک سفر و مقصد در پروفایل سفرت ذخیره می‌شود و مستقیم به حمل‌ونقل می‌روی.
                  </p>
                </div>

                <div className="mt-10 grid gap-6 md:grid-cols-2">
                  {tripStyle && DESTINATIONS[tripStyle].map((destination, index) => (
                    <motion.button
                      key={destination.name}
                      type="button"
                      disabled={Boolean(pendingDestination)}
                      initial={{ opacity: 0, y: 25 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ y: -5 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => selectDestination(destination.name)}
                      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gray-900/60 text-right shadow-2xl backdrop-blur-xl transition hover:border-amber-300/40 hover:shadow-amber-500/10 disabled:cursor-wait disabled:opacity-70"
                    >
                      <div className="relative h-56 overflow-hidden">
                        <Image
                          src={destination.image}
                          alt={destination.name}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover transition duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/20 to-transparent" />
                        <span className="absolute right-5 top-5 rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-[10px] text-white backdrop-blur-md">
                          پیشنهاد سفرینو
                        </span>
                        <div className="absolute bottom-4 right-5">
                          <h2 className="text-3xl font-black">{destination.name}</h2>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-300">
                            <MapPin className="h-4 w-4 text-amber-300" />
                            {destination.province}
                          </p>
                        </div>
                      </div>

                      <div className="p-6">
                        <b className="text-sm text-amber-200">{destination.tagline}</b>
                        <p className="mt-3 text-sm leading-8 text-gray-300">{destination.description}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {destination.experiences.map((experience) => (
                            <span key={experience} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-gray-300">
                              {experience}
                            </span>
                          ))}
                        </div>
                        <span className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-amber-400 to-orange-500 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-500/15">
                          {pendingDestination === destination.name ? 'در حال انتقال…' : `انتخاب ${destination.name} و ادامه`}
                          <ChevronLeft className="h-4 w-4" />
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setPendingDestination(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-gray-900/60 px-5 py-3 text-xs text-gray-300 backdrop-blur transition hover:border-white/25 hover:text-white"
                  >
                    <ArrowRight className="h-4 w-4" />
                    بازگشت و تغییر حال‌وهوای سفر
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </main>
    </MotionConfig>
  );
}
