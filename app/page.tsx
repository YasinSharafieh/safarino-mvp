"use client";

import SnapshotKeeper from "@/components/SnapshotKeeper";
import HomeDeals from "@/components/HomeDeals";
import HomeReviews from "@/components/HomeReviews";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Bus,
  CalendarDays,
  Car,
  Check,
  Compass,
  FileDown,
  MapPin,
  Menu,
  Plane,
  Route,
  ShieldCheck,
  Sparkles,
  Sun,
  Ticket,
  Users,
  Wallet,
  WifiOff,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ data */

const NAV_LINKS = [
  { label: "کشف مقصد", href: "/discover" },
  { label: "پیشنهادهای ویژه", href: "#deals" },
  { label: "چرا سفرینو", href: "#why" },
  { label: "نظرات مسافران", href: "#reviews" },
  { label: "پرسش‌ها", href: "#faq" },
];

/** Every number here is a fact about the product, not a marketing guess. */
const STATS = [
  { value: "۱۵۶", label: "شهر ایران برای مبدأ و مقصد" },
  { value: "۶", label: "منبع رزرو با جست‌وجوی زنده" },
  { value: "۷", label: "حالت سفر در بخش کشف" },
  { value: "۱۰۰٪", label: "قیمت‌ها از منبع اصلی" },
];

const BENTO_CARDS = [
  {
    id: "plan",
    title: "برنامهٔ روزبه‌روز، ساخته‌شده از جای واقعی",
    desc: "برای هر روز، دیدنی‌های واقعی شهر را با فاصله و زمان رانندگی می‌چیند؛ نه لیست کلیشه‌ای.",
    icon: CalendarDays,
    span: "md:col-span-4 md:row-span-2",
    tone: "from-cyan-400/20 via-sky-500/10 to-transparent",
    bullets: ["مکان‌ها از ویکی‌پدیا، ویکی‌دیتا و نقشهٔ نشان", "مرتب‌شده بر اساس فاصله", "بدون مکان تکراری"],
  },
  {
    id: "car",
    title: "هزینهٔ کامل ماشین شخصی",
    desc: "مسافت واقعی مبدأ تا مقصد، مصرف بنزین و عوارض؛ همه با فرض‌های خودتان و قابل ویرایش.",
    icon: Car,
    span: "md:col-span-2",
    tone: "from-emerald-400/20 via-teal-500/10 to-transparent",
  },
  {
    id: "tickets",
    title: "بلیت قطار، هواپیما و اتوبوس",
    desc: "قیمت و ساعت از منابع رسمی، همراه با لینک خرید همان بلیت.",
    icon: Ticket,
    span: "md:col-span-2",
    tone: "from-sky-400/20 via-teal-500/10 to-transparent",
  },
  {
    id: "stay",
    title: "اقامتگاه از چند منبع",
    desc: "هتل، خانهٔ سنتی، ویلا و سوئیت؛ تکراری‌ها حذف می‌شوند و منبع هر کارت مشخص است.",
    icon: Building2,
    span: "md:col-span-2",
    tone: "from-cyan-400/20 via-teal-500/10 to-transparent",
  },
  {
    id: "budget",
    title: "تقسیم شفاف بودجه",
    desc: "هر عدد یا از منبع آمده یا «تخمین با فرض شما» برچسب خورده است.",
    icon: Wallet,
    span: "md:col-span-2",
    tone: "from-emerald-400/20 via-sky-500/10 to-transparent",
  },
  {
    id: "share",
    title: "دفترچهٔ سفر و لینک اشتراکی",
    desc: "برنامه را به PDF و به لینک تبدیل کن و برای همسفرانت بفرست.",
    icon: FileDown,
    span: "md:col-span-2",
    tone: "from-sky-400/20 via-cyan-500/10 to-transparent",
  },
  {
    id: "offline",
    title: "بدون اینترنت هم می‌ماند",
    desc: "برنامه در گوشی ذخیره می‌شود؛ در جاده هم باز می‌شود.",
    icon: WifiOff,
    span: "md:col-span-2",
    tone: "from-teal-400/20 via-cyan-500/10 to-transparent",
  },
];

const WHY_US = [
  { title: "بدون ثبت‌نام", desc: "هیچ حسابی نمی‌خواهد؛ انتخاب‌ها روی دستگاه خودتان می‌مانند.", icon: ShieldCheck },
  { title: "قیمت با برچسب منبع", desc: "لحظه‌ای، ذخیره‌شده یا تخمین — همیشه مشخص است.", icon: BadgeCheck },
  { title: "خرید از سایت اصلی", desc: "سفرینو پرداخت نمی‌گیرد؛ به صفحهٔ رسمی ارائه‌دهنده می‌روید.", icon: Ticket },
  { title: "همه‌چیز داخل ایران", desc: "شهرها، مسیرها، اقامتگاه و پیشنهادها؛ بدون مقصد خارجی.", icon: MapPin },
];

const FAQ = [
  {
    q: "برای استفاده باید ثبت‌نام کنم؟",
    a: "نه. سفرینو حساب کاربری ندارد؛ انتخاب‌های شما (مبدأ، مقصد، تاریخ، اقامتگاه) روی همین دستگاه ذخیره می‌شود و به هیچ سروری نمی‌رود.",
  },
  {
    q: "قیمت‌هایی که می‌بینم واقعی است؟",
    a: "بله. قیمت بلیت و اقامتگاه از منابع رسمی خوانده می‌شود و اگر از نسخهٔ ذخیره‌شده آمده باشد، همان‌جا برچسب می‌خورد. رزرو و پرداخت در سایت همان ارائه‌دهنده انجام می‌شود.",
  },
  {
    q: "اگر با ماشین شخصی سفر کنم، فقط فاصله را می‌گوید؟",
    a: "نه. مسافت واقعی جاده، مصرف سوخت، عوارض و پارکینگ با فرض‌های خودتان (قابل ویرایش) حساب می‌شود و در تقسیم هزینه می‌آید.",
  },
  {
    q: "برنامه سفر چه چیزی دارد؟",
    a: "برنامهٔ روزبه‌روز با دیدنی‌های واقعی شهر، فاصله و زمان بین آن‌ها، هوای همان روزها (یا میانگین چندساله با برچسب)، فهرست وسایل، تقسیم بودجه و خروجی PDF.",
  },
  {
    q: "سفر خارج از ایران هم هست؟",
    a: "فعلاً نه. سفرینو کاملاً ایران‌محور است: مبدأ، مقصد، اقامتگاه و پیشنهادها فقط شهرهای ایران هستند.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0 },
};

/* --------------------------------------------------------------- page */

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <main className="relative overflow-hidden">
      <SnapshotKeeper />
      {/* ---------------------------------------------------- background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#12364a_0%,#071521_55%)]" />
        <div className="absolute inset-0 grid-lines opacity-70" />
        <div className="aurora">
          <span className="h-[26rem] w-[26rem] -top-24 right-0 bg-teal-500/40 animate-float" />
          <span className="h-[22rem] w-[22rem] top-40 left-0 bg-turquoise-500/30 animate-float [animation-delay:1.5s]" />
          <span className="h-[18rem] w-[18rem] top-[38rem] right-1/3 bg-teal-500/25 animate-float [animation-delay:3s]" />
        </div>
      </div>

      {/* -------------------------------------------------------- navbar */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-night-900/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow">
              <Compass className="h-5 w-5" strokeWidth={2.6} />
            </span>
            <span className="flex flex-col leading-none">
              <b className="text-lg font-black text-white">سفرینو</b>
              <small className="text-[10px] tracking-widest text-slate-400">SAFARINO</small>
            </span>
          </a>

          <ul className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a className="text-sm font-medium text-slate-300 transition hover:text-cyan-300" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <a href="/start" className="btn-primary !px-5 !py-2.5 text-xs">
              شروع برنامه‌ریزی
            </a>
          </div>

          <button
            aria-label="منو"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>

        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="border-t border-white/5 bg-night-800/90 px-5 py-4 lg:hidden"
          >
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a className="block text-sm text-slate-200" href={link.href} onClick={() => setMenuOpen(false)}>
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a href="/start" className="btn-primary w-full" onClick={() => setMenuOpen(false)}>
                  شروع برنامه‌ریزی سفر
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </header>

      {/* ---------------------------------------------------------- hero */}
      <section className="relative mx-auto max-w-7xl px-5 pb-12 pt-14 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.5 }}
            className="chip mx-auto border-cyan-400/25 bg-cyan-400/10 !text-cyan-200"
          >
            <Sparkles className="h-3.5 w-3.5" />
            برنامه‌ریز سفر ایران — از انتخاب شهر تا دفترچهٔ سفر
          </motion.span>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-6 text-4xl font-black leading-[1.25] text-white sm:text-6xl"
          >
            سفر بعدی‌ات را به <span className="gradient-text">سفرینو</span> بسپار
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base"
          >
            بگو از کجا می‌آیی و کجا می‌خواهی بروی؛ سفرینو مسیر و فاصلهٔ واقعی، بلیت قطار و هواپیما،
            اقامتگاه از چند منبع و هزینهٔ کل سفر را یک‌جا برایت می‌چیند.
            <br className="hidden sm:block" />
            اگر هنوز مقصد را انتخاب نکرده‌ای، چند سؤال کوتاه و هر بار تازه، شهر مناسب سلیقه‌ات را پیدا می‌کند.
          </motion.p>
        </div>

        {/* ------------------------------------------- start planning block */}
        <motion.div
          initial={{ opacity: 0, y: 34 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24 }}
          className="glass mx-auto mt-10 max-w-4xl overflow-hidden p-5 shadow-card sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.22),transparent_65%)]" />
          <div className="relative">
            <div className="flex flex-col items-center gap-4 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow">
                <Route className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-white sm:text-xl">شروع برنامه‌ریزی</h2>
                <p className="mt-1.5 text-[11px] leading-6 text-slate-400">
                  یک قدم اول، دو مسیر — هر کدام را انتخاب کنی، بقیهٔ سفر روی همان بنا می‌شود.
                </p>
              </div>

              <a href="/start" className="btn-primary w-full !py-4 text-sm sm:w-auto sm:!px-12">
                شروع برنامه‌ریزی سفر
                <ArrowLeft className="h-4 w-4" />
              </a>

              <div className="grid w-full gap-3 sm:grid-cols-2">
                <a
                  href="/start/cities"
                  className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-right transition hover:border-cyan-400/40 hover:bg-white/[0.07]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-cyan-300">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span>
                    <b className="block text-[12px] font-bold text-white">مبدأ و مقصدم مشخص است</b>
                    <span className="mt-0.5 block text-[10px] leading-5 text-slate-400">
                      شهرها را از بین ۱۵۶ شهر ایران انتخاب کن، تاریخ و مسافران را بگذار و برو به بلیت و اقامتگاه.
                    </span>
                  </span>
                </a>
                <a
                  href="/quiz"
                  className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 text-right transition hover:border-cyan-400/40 hover:bg-white/[0.07]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-cyan-300">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <span>
                    <b className="block text-[12px] font-bold text-white">هنوز نمی‌دانم کجا بروم</b>
                    <span className="mt-0.5 block text-[10px] leading-5 text-slate-400">
                      چند سؤال کوتاه و متفاوت در هر بار؛ بعد چند شهر ایرانی که به سلیقه‌ات می‌خورد.
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* --------------------------------------------------- stats */}
        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="glass glass-hover p-4 text-center"
            >
              <b className="block text-xl font-black text-white">{stat.value}</b>
              <span className="mt-1 block text-[10.5px] leading-5 text-slate-400">{stat.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- bento services */}
      <section id="services" className="relative mx-auto max-w-7xl px-5 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip">سفرینو چه می‌کند</span>
          <h2 className="section-title mt-4">همهٔ سفر، در یک پنل شیشه‌ای</h2>
          <p className="mt-4 text-sm leading-8 text-slate-400">
            از انتخاب شهر تا فهرست وسایل و دفترچهٔ PDF؛ هر بخش با دادهٔ واقعی کار می‌کند.
          </p>
        </div>

        <div className="mt-12 grid auto-rows-[minmax(150px,auto)] grid-cols-1 gap-4 md:grid-cols-6">
          {BENTO_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: index * 0.07 }}
                className={"glass glass-hover group overflow-hidden p-6 " + card.span}
              >
                <div className={"pointer-events-none absolute inset-0 bg-gradient-to-bl " + card.tone + " opacity-0 transition duration-500 group-hover:opacity-100"} />
                <div className="relative flex h-full flex-col">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/10 text-cyan-300 transition group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-extrabold text-white">{card.title}</h3>
                  <p className="mt-2 text-xs leading-7 text-slate-400">{card.desc}</p>

                  {card.bullets && (
                    <ul className="mt-auto space-y-2 pt-5">
                      {card.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-center gap-2 text-[11px] text-slate-300">
                          <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------ live deals */}
      <section id="deals" className="relative mx-auto max-w-7xl px-5 py-12">
        <HomeDeals />
      </section>

      {/* ------------------------------------------------------------ why */}
      <section id="why" className="relative mx-auto max-w-7xl px-5 py-16">
        <div className="glass overflow-hidden p-6 sm:p-10">
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <div>
              <span className="chip">چرا سفرینو؟</span>
              <h2 className="section-title mt-4">
                تجربه‌ای که <span className="gradient-text">اعتماد</span> می‌سازد
              </h2>
              <p className="mt-4 text-xs leading-7 text-slate-400">
                سفرینو چیزی را که نمی‌داند حدس نمی‌زند: یا عدد از منبع رسمی می‌آید، یا با برچسب تخمین و قابل ویرایش است.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {WHY_US.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="glass-soft p-4">
                      <Icon className="h-5 w-5 text-cyan-300" />
                      <b className="mt-2.5 block text-[12.5px] font-bold text-white">{item.title}</b>
                      <p className="mt-1 text-[10.5px] leading-6 text-slate-400">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass p-5">
              <div className="flex items-center justify-between">
                <b className="text-sm font-bold text-white">هر عدد، با برچسب خودش</b>
                <span className="chip">شفاف</span>
              </div>

              <ul className="mt-5 space-y-2.5">
                {[
                  { label: "بلیت قطار، هواپیما، اتوبوس", tag: "از منبع، لحظه‌ای", tone: "text-emerald-300 border-emerald-400/25 bg-emerald-400/10", icon: Plane },
                  { label: "اتاق هتل و اقامتگاه", tag: "از منبع، لحظه‌ای", tone: "text-emerald-300 border-emerald-400/25 bg-emerald-400/10", icon: Building2 },
                  { label: "سوخت، عوارض و پارکینگ خودرو", tag: "تخمین با فرض شما", tone: "text-amber-200 border-amber-400/25 bg-amber-400/10", icon: Car },
                  { label: "بلیت ورودی جاذبه‌ها", tag: "تخمین با فرض شما", tone: "text-amber-200 border-amber-400/25 bg-amber-400/10", icon: Ticket },
                  { label: "هوای روزهای سفر", tag: "پیش‌بینی واقعی یا میانگین چندساله", tone: "text-sky-200 border-sky-400/25 bg-sky-400/10", icon: Sun },
                ].map((row) => {
                  const Icon = row.icon;
                  return (
                    <li key={row.label} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <span className="flex min-w-0 items-center gap-2 text-[11px] text-slate-200">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                        <span className="truncate">{row.label}</span>
                      </span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${row.tone}`}>{row.tag}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.07] p-3 text-[10px] leading-6 text-cyan-100">
                <Check className="h-4 w-4 shrink-0" />
                هیچ قیمتی بدون منبع نمایش داده نمی‌شود؛ اگر منبع در دسترس نباشد، همان را می‌گوییم.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- reviews */}
      <section id="reviews" className="relative mx-auto max-w-7xl px-5 py-12">
        <HomeReviews />
      </section>

      {/* ------------------------------------------------------------ faq */}
      <section id="faq" className="relative mx-auto max-w-4xl px-5 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip">سؤالات متداول</span>
          <h2 className="section-title mt-4">پاسخ سریع به ابهام‌ها</h2>
        </div>

        <div className="mt-10 space-y-3">
          {FAQ.map((item, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={item.q} className="glass overflow-hidden">
                <button
                  onClick={() => setOpenFaq(isOpen ? -1 : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-right"
                >
                  <b className="text-[12.5px] font-bold text-white sm:text-sm">{item.q}</b>
                  <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-cyan-300 transition " + (isOpen ? "rotate-45" : "")}>
                    +
                  </span>
                </button>
                {isOpen && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="px-5 pb-4 text-[11px] leading-7 text-slate-400"
                  >
                    {item.a}
                  </motion.p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------ cta + foot */}
      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass relative overflow-hidden p-8 text-center sm:p-14"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.25),transparent_60%)]" />
          <div className="relative">
            <span className="grid mx-auto h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow">
              <Bus className="h-6 w-6" />
            </span>
            <h2 className="section-title mt-6">چمدان‌ها را ببندید، بقیه‌اش با سفرینو</h2>
            <p className="mx-auto mt-4 max-w-xl text-xs leading-7 text-slate-300">
              بدون ثبت‌نام، بدون کارت بانکی. شهر و تاریخ را بگو؛ مسیر، بلیت، اقامتگاه و هزینهٔ کل را همان‌جا می‌بینی.
            </p>

            <div className="mx-auto mt-8 flex max-w-md flex-col items-stretch justify-center gap-3 sm:flex-row">
              <a href="/start" className="btn-primary !py-3.5 text-xs">
                شروع برنامه‌ریزی
                <ArrowLeft className="h-4 w-4" />
              </a>
              <a href="/discover" className="btn-ghost !py-3.5 text-xs">
                <Compass className="h-4 w-4" />
                کشف مقصدها
              </a>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> بدون حساب کاربری
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-sky-400" /> بدون هزینهٔ پنهان
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-cyan-300" /> ساخته‌شده برای سفر در ایران
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-white/5 bg-night-950/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950">
                <Compass className="h-4 w-4" strokeWidth={2.6} />
              </span>
              <b className="text-base font-black text-white">سفرینو</b>
            </div>
            <p className="mt-4 text-[10.5px] leading-6 text-slate-500">
              برنامه‌ریز سفر ایران: انتخاب شهر، مسیر و هزینهٔ واقعی، بلیت، اقامتگاه و دفترچهٔ سفر — در یک‌جا.
            </p>
          </div>

          {[
            {
              title: "سفر",
              items: [
                { label: "شروع برنامه‌ریزی", href: "/start" },
                { label: "مبدأ و مقصد", href: "/start/cities" },
                { label: "پیشنهاد مقصد", href: "/quiz" },
                { label: "کشف مقصدها", href: "/discover" },
              ],
            },
            {
              title: "ابزارها",
              items: [
                { label: "حمل‌ونقل", href: "/transport" },
                { label: "اقامتگاه", href: "/accommodation" },
                { label: "برنامهٔ روزبه‌روز", href: "/itinerary" },
                { label: "تقسیم بودجه", href: "/plan" },
              ],
            },
            {
              title: "دربارهٔ سفرینو",
              items: [
                { label: "چرا سفرینو", href: "#why" },
                { label: "نظرات مسافران", href: "#reviews" },
                { label: "پرسش‌های متداول", href: "#faq" },
                { label: "پیشنهادهای ویژه", href: "#deals" },
              ],
            },
          ].map((column) => (
            <div key={column.title}>
              <b className="text-[12.5px] font-bold text-white">{column.title}</b>
              <ul className="mt-3.5 space-y-2">
                {column.items.map((item) => (
                  <li key={item.label}>
                    <a className="text-[10.5px] text-slate-500 transition hover:text-cyan-300" href={item.href}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 px-5 py-4">
          <p className="mx-auto max-w-7xl text-center text-[10px] leading-6 text-slate-600">
            © سفرینو — قیمت‌ها و موجودی‌ها از منابع رسمی ارائه‌دهندگان خوانده می‌شوند و رزرو در سایت همان ارائه‌دهنده انجام می‌شود.
          </p>
        </div>
      </footer>
    </main>
  );
}
