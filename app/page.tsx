"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  ArrowLeft,
  Brain,
  CalendarDays,
  Car,
  Check,
  Hotel,
  Menu,
  Plane,
  Sparkles,
  Wallet,
  X,
  Zap,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  داده‌ها                                                            */
/* ------------------------------------------------------------------ */

const navLinks = [
  { label: "خانه", href: "#home" },
  { label: "امکانات", href: "#features" },
  { label: "چطور کار می‌کند؟", href: "#how-it-works" },
  { label: "درباره سفرینو", href: "#about" },
];

const modules = [
  {
    emoji: "🤖",
    icon: Brain,
    title: "مغز هوشمند سفرینو",
    subtitle: "AI Travel Brain",
    desc: "فقط بگو کجا می‌خواهی بروی و چقدر وقت داری؛ هوش مصنوعی سفرینو بهترین مسیر، شهرها، جاذبه‌ها و تجربه‌های سفر را با توجه به سلیقه‌ات طراحی می‌کند.",
    tags: ["پیشنهاد شخصی‌سازی‌شده", "چت هوشمند", "مسیر بهینه"],
    className: "md:col-span-4",
    glow: "from-violet-500/25 via-fuchsia-500/10 to-transparent",
  },
  {
    emoji: "🚗",
    icon: Car,
    title: "محاسبه دقیق هزینه حمل‌ونقل",
    subtitle: "بنزین، استهلاک، قطار، پرواز",
    desc: "هزینه بنزین، استهلاک خودرو، عوارض جاده‌ای، بلیط قطار و پرواز را تا ریال آخر مقایسه می‌کنیم تا ارزان‌ترین و راحت‌ترین گزینه را انتخاب کنی.",
    tags: ["بنزین", "استهلاک", "قطار", "پرواز"],
    className: "md:col-span-2",
    glow: "from-sky-500/25 via-cyan-500/10 to-transparent",
  },
  {
    emoji: "🏨",
    icon: Hotel,
    title: "پیشنهاد هوشمند اقامتگاه",
    subtitle: "اقامتگاه متناسب با بودجه",
    desc: "از هتل، اقامتگاه بومگردی و سوئیت تا خانه‌های اجاره‌ای؛ بهترین گزینه‌ها بر اساس بودجه، موقعیت مکانی و نظرات واقعی مسافران.",
    tags: ["بودجه‌محور", "بومگردی", "نزدیک به مسیر"],
    className: "md:col-span-2",
    glow: "from-emerald-500/25 via-teal-500/10 to-transparent",
  },
  {
    emoji: "💰",
    icon: Wallet,
    title: "مدیریت و بهینه‌سازی زنده بودجه",
    subtitle: "Live Budget Optimizer",
    desc: "بودجه‌ات را زنده رصد می‌کنیم و همزمان که برنامه را تغییر می‌دهی، پیشنهاد می‌دهیم کجا صرفه‌جویی کنی تا سفر در چارچوب بودجه بماند.",
    tags: ["هشدار هزینه", "صرفه‌جویی", "گزارش شفاف"],
    className: "md:col-span-2",
    glow: "from-amber-500/25 via-orange-500/10 to-transparent",
  },
  {
    emoji: "🗓️",
    icon: CalendarDays,
    title: "برنامه‌ریزی روزانه و زمان‌بندی هوشمند",
    subtitle: "Smart Daily Itinerary",
    desc: "ساعت‌به‌ساعت، روز‌به‌روز؛ با در نظر گرفتن زمان رانندگی، ساعات بازدید و استراحت. برنامه‌ات را در یک نگاه ببین، ویرایش کن و با همراهانت به اشتراک بگذار.",
    tags: ["ساعت‌به‌ساعت", "قابل ویرایش", "اشتراک‌گذاری"],
    className: "md:col-span-2",
    glow: "from-rose-500/25 via-pink-500/10 to-transparent",
  },
];

const steps = [
  {
    number: "۱",
    title: "مقصد و شرایطت را بگو",
    desc: "مبدأ، مقصد، تاریخ‌ها، تعداد نفرات و بودجه‌ات را در چند کلیک وارد کن. سفرینو هر جزئیاتی که برای برنامه‌ریزی لازم است را از تو می‌پرسد.",
    icon: Sparkles,
  },
  {
    number: "۲",
    title: "هوش مصنوعی برنامه می‌سازد",
    desc: "در چند ثانیه یک برنامه کامل سفری با مسیر بهینه، اقامتگاه پیشنهادی، هزینه دقیق حمل‌ونقل و بودجه‌بندی زنده تحویل می‌گیری.",
    icon: Brain,
  },
  {
    number: "۳",
    title: "سفر کن و لذت ببر",
    desc: "برنامه را دانلود کن، با همراهانت به اشتراک بگذار و در طول سفر ویرایشش کن. سفرینو هزینه‌ها را زنده کنترل می‌کند تا خیالت راحت باشد.",
    icon: Plane,
  },
];

const stats = [
  { value: "۵۰+", label: "شهر و مقصد ایران" },
  { value: "۹۸٪", label: "دقت در برآورد بودجه" },
  { value: "۳۰ ثانیه", label: "تا رسیدن به برنامه سفر" },
  { value: "۲۴/۷", label: "همراهی هوش مصنوعی" },
];

/* ------------------------------------------------------------------ */
/*  کامپوننت‌های کوچک                                                  */
/* ------------------------------------------------------------------ */

function Logo({ className }: { className?: string }) {
  return (
    <a href="#home" className={clsx("group flex items-center gap-2.5", className)}>
      <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-sky-500 shadow-glow">
        <Plane className="h-5 w-5 -rotate-45 text-white" strokeWidth={2.4} />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-xl font-extrabold tracking-tight text-white">سفرینو</span>
        <span className="mt-1 text-[10px] font-medium tracking-widest text-slate-400">
          SAFARINO AI
        </span>
      </span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  صفحه اصلی                                                          */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* پس‌زمینه */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#070713]" />
        <div className="absolute inset-0 bg-grid mask-radial opacity-70" />
        <div className="absolute -top-40 right-1/4 h-[34rem] w-[34rem] animate-pulse-glow rounded-full bg-violet-600/25 blur-[130px]" />
        <div className="absolute -top-24 left-1/4 h-[28rem] w-[28rem] animate-pulse-glow rounded-full bg-sky-500/20 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/10 blur-[140px]" />
      </div>

      {/* ---------------- هدر ---------------- */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#070713]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href="#auth"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:text-white sm:block"
            >
              ورود
            </a>
            <a href="#auth" className="btn-primary !px-5 !py-2.5 text-sm">
              <Sparkles className="h-4 w-4" />
              ثبت‌نام رایگان
            </a>
            <button
              type="button"
              aria-label="منو"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-white/5 bg-[#070713]/95 px-5 pb-5 pt-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main id="home">
        {/* ---------------- هیرو ---------------- */}
        <section className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="mx-auto flex max-w-4xl flex-col items-center text-center"
          >
            <span className="glass-soft inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-300">
              <Zap className="h-3.5 w-3.5 text-amber-300" />
              نسل جدید برنامه‌ریزی سفر در ایران
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" />
            </span>

            <h1 className="mt-7 text-balance text-4xl font-black leading-[1.35] tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.3]">
              سفرت رو با{" "}
              <span className="gradient-text">هوش مصنوعی</span>،
              <br className="hidden sm:block" />{" "}
              بی‌نقص برنامه‌ریزی کن!
            </h1>

            <p className="mt-6 max-w-2xl text-balance text-base leading-8 text-slate-400 sm:text-lg">
              سفرینو همه‌چیز را برایت حساب می‌کند؛ از هزینه بنزین و استهلاک خودرو تا
              بهترین اقامتگاه و برنامه ساعت‌به‌ساعت روزانه. تو فقط انتخاب کن و
              سفر کن.
            </p>

            <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
              <a href="#auth" className="btn-primary w-full sm:w-auto">
                شروع رایگان سفر
                <ArrowLeft className="h-4 w-4" />
              </a>
              <a href="#how-it-works" className="btn-ghost w-full sm:w-auto">
                چطور کار می‌کند؟
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                بدون نیاز به کارت بانکی
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                کاملاً فارسی و راست‌به‌چپ
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                آماده در ۳۰ ثانیه
              </span>
            </div>
          </motion.div>

          {/* آمار */}
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
            className="glass mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-4"
          >
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="gradient-text text-2xl font-extrabold sm:text-3xl">
                  {stat.value}
                </div>
                <div className="mt-2 text-xs text-slate-400 sm:text-sm">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ---------------- بنتوی ۵ کارتی ---------------- */}
        <section id="features" className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
          >
            <div>
              <span className="chip">
                <Brain className="h-3.5 w-3.5 text-violet-300" />
                ماژول‌های سفرینو
              </span>
              <h2 className="section-title mt-4 text-white">
                هر چیزی که یک سفر <span className="gradient-text-warm">بی‌دردسر</span> لازم دارد
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-slate-400">
              پنج ماژول هوشمند که مثل یک تیم پشتیبان سفر، در تمام مراحل کنارت هستند —
              از لحظه تصمیم‌گیری تا برگشت به خانه.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-6">
            {modules.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.article
                  key={module.title}
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.55, delay: index * 0.07, ease: "easeOut" }}
                  className={clsx(
                    "glass glass-hover group relative overflow-hidden p-7",
                    module.className
                  )}
                >
                  <div
                    className={clsx(
                      "pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br opacity-70 blur-3xl transition-opacity duration-500 group-hover:opacity-100",
                      module.glow
                    )}
                  />

                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
                        {module.emoji}
                      </span>
                      <div>
                        <h3 className="text-base font-bold leading-6 text-white sm:text-lg">
                          {module.title}
                        </h3>
                        <p className="mt-1 text-[11px] font-medium tracking-wide text-slate-500">
                          {module.subtitle}
                        </p>
                      </div>
                    </div>
                    <Icon className="hidden h-5 w-5 shrink-0 text-slate-500 transition group-hover:text-violet-300 sm:block" />
                  </div>

                  <p className="relative mt-5 text-sm leading-7 text-slate-400">
                    {module.desc}
                  </p>

                  <div className="relative mt-5 flex flex-wrap gap-2">
                    {module.tags.map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* ---------------- چطور کار می‌کند؟ ---------------- */}
        <section id="how-it-works" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mx-auto mb-14 max-w-2xl text-center"
          >
            <span className="chip">
              <Plane className="h-3.5 w-3.5 text-sky-300" />
              فقط ۳ گام
            </span>
            <h2 className="section-title mt-4 text-white">چطور کار می‌کند؟</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">
              سه ساده‌ترین گام تا سفری که دقیقاً همان‌طور که می‌خواهی برنامه‌ریزی شده است.
            </p>
          </motion.div>

          <div className="relative grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="pointer-events-none absolute inset-x-10 top-16 hidden h-px bg-gradient-to-l from-transparent via-white/15 to-transparent md:block" />

            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.55, delay: index * 0.12, ease: "easeOut" }}
                  className="glass glass-hover relative p-7"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-sky-500 text-lg font-extrabold text-white shadow-glow">
                      {step.number}
                    </span>
                    <Icon className="h-5 w-5 text-slate-500" />
                  </div>
                  <h3 className="mt-6 text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400">{step.desc}</p>
                </motion.div>
              );
            })}
          </div>

          {/* CTA پایانی */}
          <motion.div
            id="auth"
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="glass relative mt-16 overflow-hidden px-6 py-12 text-center sm:px-12"
          >
            <div className="pointer-events-none absolute -top-24 right-1/2 h-64 w-64 translate-x-1/2 rounded-full bg-violet-600/30 blur-[110px]" />
            <h2 className="relative text-balance text-2xl font-extrabold leading-relaxed text-white sm:text-3xl">
              آماده‌ای سفر بعدی‌ات را <span className="gradient-text">هوشمند</span> شروع کنی؟
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400">
              همین حالا رایگان ثبت‌نام کن و اولین برنامه سفرت را با سفرینو بساز.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#auth" className="btn-primary w-full sm:w-auto">
                ساخت حساب رایگان
                <ArrowLeft className="h-4 w-4" />
              </a>
              <a href="#features" className="btn-ghost w-full sm:w-auto">
                دیدن امکانات
              </a>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ---------------- فوتر ---------------- */}
      <footer id="about" className="mt-10 border-t border-white/5 bg-[#05050f]/80">
        <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-5 text-sm leading-7 text-slate-500">
                سفرینو، همراه هوشمند سفرهای توست؛ برنامه‌ریزی دقیق، بودجه شفاف و
                تجربه‌ای که به یاد می‌مانی.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <div>
                <h4 className="text-sm font-bold text-white">محصول</h4>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
                  <li><a href="#features" className="transition hover:text-slate-200">امکانات</a></li>
                  <li><a href="#how-it-works" className="transition hover:text-slate-200">چطور کار می‌کند؟</a></li>
                  <li><a href="#auth" className="transition hover:text-slate-200">ثبت‌نام</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">پشتیبانی</h4>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
                  <li><a href="#about" className="transition hover:text-slate-200">سوالات متداول</a></li>
                  <li><a href="#about" className="transition hover:text-slate-200">تماس با ما</a></li>
                  <li><a href="#about" className="transition hover:text-slate-200">حریم خصوصی</a></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">ارتباط</h4>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
                  <li>hello@safarino.ir</li>
                  <li>تهران، ایران</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-7 sm:flex-row">
            <p className="text-xs text-slate-500">© ۱۴۰۳ سفرینو — تمامی حقوق محفوظ است.</p>
            <p className="text-xs text-slate-600">ساخته‌شده با Next.js 14 و Tailwind CSS</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
