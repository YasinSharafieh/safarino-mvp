"use client";

import SnapshotKeeper from "@/components/SnapshotKeeper";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  Building2,
  CalendarDays,
  Compass,
  CreditCard,
  Globe2,
  Headphones,
  Hotel,
  MapPin,
  Menu,
  Plane,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ data */

const NAV_LINKS = [
  { label: "خدمات", href: "#services" },
  { label: "مقاصد", href: "#destinations" },
  { label: "کوییز سفر", href: "/quiz" },
  { label: "چرا سفرینو", href: "#why" },
  { label: "نظرات مسافران", href: "#reviews" },
];

const STATS = [
  { value: "۱۲۰ هزار+", label: "مسافر راضی" },
  { value: "۴۸۰+", label: "مقصد داخلی و خارجی" },
  { value: "۹۸٪", label: "رضایت از پشتیبانی" },
  { value: "۲۴/۷", label: "پاسخگویی آنلاین" },
];

const SEARCH_TABS = [
  { id: "flight", label: "پرواز", icon: Plane, placeholder: "مثلاً تهران ← استانبول" },
  { id: "hotel", label: "هتل", icon: Hotel, placeholder: "مثلاً هتل‌های کیش" },
  { id: "tour", label: "تور", icon: Compass, placeholder: "مثلاً تور کاپادوکیه" },
];

const BENTO_CARDS = [
  {
    id: "ai",
    title: "دستیار هوشمند سفر",
    desc: "با چند کلیک، برنامه سفر شخصی‌سازی‌شده بر اساس بودجه و سلیقه شما ساخته می‌شود.",
    icon: Sparkles,
    span: "md:col-span-4 md:row-span-2",
    tone: "from-cyan-400/20 via-sky-500/10 to-transparent",
    bullets: ["پیشنهاد مقصد بر اساس بودجه", "بهینه‌سازی هزینه روزانه", "برنامه روز‌به‌روز سفر"],
  },
  {
    id: "price",
    title: "تضمین بهترین قیمت",
    desc: "اگر ارزان‌تر پیدا کردید، مابه‌التفاوت برمی‌گردد.",
    icon: Wallet,
    span: "md:col-span-2",
    tone: "from-emerald-400/20 via-teal-500/10 to-transparent",
  },
  {
    id: "support",
    title: "پشتیبانی ۲۴ ساعته",
    desc: "کارشناس فارسی‌زبان، همه‌جای دنیا کنار شماست.",
    icon: Headphones,
    span: "md:col-span-2",
    tone: "from-sky-400/20 via-teal-500/10 to-transparent",
  },
  {
    id: "safe",
    title: "پرداخت امن و بیمه سفر",
    desc: "درگاه بانکی معتبر، بیمه مسافرتی و استرداد وجه تا ۷۲ ساعت.",
    icon: ShieldCheck,
    span: "md:col-span-2",
    tone: "from-cyan-400/20 via-teal-500/10 to-transparent",
  },
  {
    id: "trips",
    title: "بیش از ۴۸۰ مقصد فعال",
    desc: "از کیش و مشهد تا استانبول، دبی و آنتالیا.",
    icon: Globe2,
    span: "md:col-span-3",
    tone: "from-sky-400/20 via-teal-500/10 to-transparent",
  },
  {
    id: "alert",
    title: "هشدار افت قیمت",
    desc: "قیمت بلیت که کاهش پیدا کرد، فوراً خبرتان می‌کنیم.",
    icon: BellRing,
    span: "md:col-span-3",
    tone: "from-cyan-400/20 via-sky-500/10 to-transparent",
  },
];

const DESTINATIONS = [
  { city: "استانبول", country: "ترکیه", price: "۹٬۸۰۰٬۰۰۰", tag: "پرفروش", emoji: "🕌", gradient: "from-sky-500/30 to-teal-600/20" },
  { city: "کیش", country: "ایران", price: "۳٬۲۰۰٬۰۰۰", tag: "داخلی", emoji: "🏝️", gradient: "from-cyan-500/30 to-teal-600/20" },
  { city: "دبی", country: "امارات", price: "۱۲٬۴۰۰٬۰۰۰", tag: "لوکس", emoji: "🏙️", gradient: "from-cyan-400/30 to-teal-600/20" },
  { city: "آنتالیا", country: "ترکیه", price: "۱۱٬۱۰۰٬۰۰۰", tag: "خانوادگی", emoji: "🌊", gradient: "from-teal-400/30 to-emerald-600/20" },
];

const WHY_US = [
  { title: "رزرو در ۶۰ ثانیه", desc: "بدون کاغذبازی، بدون تماس تلفنی.", icon: CreditCard },
  { title: "استرداد شفاف", desc: "قوانین لغو، پیش از پرداخت مشخص است.", icon: BadgeCheck },
  { title: "قیمت لحظه‌ای", desc: "اتصال مستقیم به سیستم‌های ایرلاین.", icon: TrendingUp },
  { title: "مسیرهای ترکیبی", desc: "پرواز + هتل + transfer با یک پرداخت.", icon: Route },
];

const REVIEWS = [
  { name: "سارا محمدی", role: "مسافر استانبول", text: "اولین بار بود همه‌چیز را آنلاین رزرو می‌کردم؛ از پرداخت تا بلیط، بی‌نقص بود." },
  { name: "امیر رضایی", role: "مسافر کیش", text: "هشدار افت قیمت سفرینو واقعاً کار کرد، نیم میلیون تومان ارزان‌تر خریدم." },
  { name: "نگار کریمی", role: "مسافر آنتالیا", text: "پشتیبانی ساعت ۲ بامداد جواب داد و مشکل هتل را همان لحظه حل کرد." },
];

const FAQ = [
  { q: "آیا می‌توانم بلیط را لغو کنم؟", a: "بله، تا ۷۲ ساعت پیش از پرواز با کسر کارمزد بانکی، مبلغ به کامل‌ترین شکل استرداد می‌شود." },
  { q: "پرداخت چگونه انجام می‌شود؟", a: "از طریق درگاه امن بانکی با تمام کارت‌های شتاب و امکان پرداخت اقساطی برای تورها." },
  { q: "بیمه سفر شامل چه مواردی است؟", a: "بیمه درمانی، تأخیر پرواز و بار مفقودشده برای تمام تورهای خارجی سفرینو رایگان است." },
];

const fadeUp = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0 },
};

/* --------------------------------------------------------------- page */

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState("flight");
  const [openFaq, setOpenFaq] = useState(0);

  const activeTab = SEARCH_TABS.find((item) => item.id === tab) ?? SEARCH_TABS[0];

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
          <a href="#" className="flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow">
              <Plane className="h-5 w-5 -rotate-45" strokeWidth={2.6} />
            </span>
            <span className="flex flex-col leading-none">
              <b className="text-lg font-black text-white">سفرینو</b>
              <small className="text-[10px] tracking-widest text-slate-400">SAFARINO</small>
            </span>
          </a>

          <ul className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a className="text-sm font-medium text-slate-300 transition hover:text-cyan-300" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-3 lg:flex">
            <button className="rounded-2xl px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white">
              ورود
            </button>
            <a href="/quiz" className="btn-primary !px-5 !py-2.5 text-xs">
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
                <a href="/quiz" className="btn-primary w-full" onClick={() => setMenuOpen(false)}>
                  شروع برنامه‌ریزی سفر
                </a>
              </li>
            </ul>
          </motion.div>
        )}
      </header>

      {/* ---------------------------------------------------------- hero */}
      <section className="relative mx-auto max-w-7xl px-5 pb-10 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <motion.span
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.5 }}
            className="chip mx-auto border-cyan-400/25 bg-cyan-400/10 !text-cyan-200"
          >
            <Sparkles className="h-3.5 w-3.5" />
            نسخهٔ آزمایشی سفرینو منتشر شد
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
            className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg"
          >
            پرواز، هتل و تور را در یک‌جا مقایسه کن، ارزان‌ترین قیمت را قفل کن و با خیال راحت سفر کن.
            سفرینو با دستیار هوشمند، برنامهٔ سفر را در چند ثانیه می‌چیند.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a href="#search" className="btn-primary w-full sm:w-auto">
              همین حالا جست‌وجو کن
              <ArrowLeft className="h-4 w-4" />
            </a>
            <a href="#services" className="btn-ghost w-full sm:w-auto">
              <Compass className="h-4 w-4" />
              مشاهدهٔ خدمات
            </a>
          </motion.div>
        </div>

        {/* ------------------------------------------------ search box */}
        <motion.div
          id="search"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="glass mx-auto mt-14 max-w-5xl p-4 shadow-card sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-2">
            {SEARCH_TABS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === tab;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={
                    "inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition " +
                    (isActive
                      ? "bg-gradient-to-l from-cyan-400 to-sky-500 text-slate-950 shadow-glow"
                      : "border border-white/10 bg-white/5 text-slate-300 hover:text-white")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
            <label className="glass-soft flex items-center gap-3 px-4 py-3">
              <MapPin className="h-4 w-4 shrink-0 text-cyan-300" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" placeholder={activeTab.placeholder} />
            </label>

            <label className="glass-soft flex items-center gap-3 px-4 py-3">
              <CalendarDays className="h-4 w-4 shrink-0 text-turquoise-300" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" placeholder="تاریخ رفت" />
            </label>

            <label className="glass-soft flex items-center gap-3 px-4 py-3">
              <Users className="h-4 w-4 shrink-0 text-rose-300" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" placeholder="۲ مسافر" />
            </label>

            <button className="btn-primary w-full lg:w-auto">
              <Search className="h-4 w-4" />
              جست‌وجو
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">جست‌وجوهای پرطرفدار:</span>
            {["تهران به استانبول", "هتل کیش", "تور کاپادوکیه", "بلیط مشهد"].map((tag) => (
              <button key={tag} className="chip hover:border-cyan-400/40 hover:text-cyan-200">
                {tag}
              </button>
            ))}
          </div>
        </motion.div>

        {/* --------------------------------------------------- stats */}
        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="glass glass-hover p-5 text-center"
            >
              <b className="block text-2xl font-black text-white">{stat.value}</b>
              <span className="mt-1 block text-xs text-slate-400">{stat.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------- bento services */}
      <section id="services" className="relative mx-auto max-w-7xl px-5 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip">خدمات سفرینو</span>
          <h2 className="section-title mt-4">همهٔ سفر، در یک پنل شیشه‌ای</h2>
          <p className="mt-4 leading-8 text-slate-400">
            از انتخاب مقصد تا هتل و بیمه؛ سفرینو تمام زنجیرهٔ سفر را یک‌جا و شفاف مدیریت می‌کند.
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
                  <h3 className="mt-4 text-lg font-extrabold text-white">{card.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{card.desc}</p>

                  {card.bullets && (
                    <ul className="mt-auto space-y-2 pt-5">
                      {card.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-center gap-2 text-xs text-slate-300">
                          <BadgeCheck className="h-4 w-4 text-emerald-400" />
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

      {/* --------------------------------------------------- destinations */}
      <section id="destinations" className="relative mx-auto max-w-7xl px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="chip">مقاصد محبوب</span>
            <h2 className="section-title mt-4">پیشنهاد ویژهٔ این هفته</h2>
          </div>
          <a href="#" className="btn-ghost !px-5 !py-2.5 text-xs">
            همهٔ مقاصد
            <ArrowLeft className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {DESTINATIONS.map((item, index) => (
            <motion.article
              key={item.city}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              className="glass glass-hover overflow-hidden p-0"
            >
              <div className={"relative grid h-40 place-items-center bg-gradient-to-br " + item.gradient}>
                <span className="text-5xl drop-shadow-lg">{item.emoji}</span>
                <span className="absolute right-3 top-3 rounded-full bg-cyan-950/60 px-3 py-1 text-[11px] font-bold text-cyan-200 backdrop-blur">
                  {item.tag}
                </span>
              </div>
              <div className="p-5">
                <h3 className="text-base font-extrabold text-white">{item.city}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin className="h-3.5 w-3.5" />
                  {item.country}
                </p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <span className="block text-[11px] text-slate-500">شروع از</span>
                    <b className="text-sm font-black text-cyan-300">{item.price} تومان</b>
                  </div>
                  <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-300">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ why */}
      <section id="why" className="relative mx-auto max-w-7xl px-5 py-20">
        <div className="glass overflow-hidden p-8 sm:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="chip">چرا سفرینو؟</span>
              <h2 className="section-title mt-4">
                تجربه‌ای که <span className="gradient-text">اعتماد</span> می‌سازد
              </h2>
              <p className="mt-4 leading-8 text-slate-400">
                سفرینو با حذف واسطه‌ها و شفاف‌سازی کامل قیمت‌ها، سفر را از یک دغدغه به یک لذت تبدیل می‌کند.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {WHY_US.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="glass-soft p-4">
                      <Icon className="h-5 w-5 text-cyan-300" />
                      <b className="mt-3 block text-sm font-bold text-white">{item.title}</b>
                      <p className="mt-1 text-xs leading-6 text-slate-400">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <div className="glass p-6">
                <div className="flex items-center justify-between">
                  <b className="text-sm font-bold text-white">بودجهٔ سفر شما</b>
                  <span className="chip">بهینه‌شده</span>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    { label: "پرواز", value: "۴۲٪", width: "w-[42%]", color: "from-cyan-400 to-sky-500" },
                    { label: "هتل", value: "۳۵٪", width: "w-[35%]", color: "from-turquoise-400 to-sky-500" },
                    { label: "تفرج و غذا", value: "۲۳٪", width: "w-[23%]", color: "from-sky-400 to-teal-500" },
                  ].map((row) => (
                    <div key={row.label}>
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                        <span>{row.label}</span>
                        <b className="text-white">{row.value}</b>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div className={"h-full rounded-full bg-gradient-to-l " + row.color + " " + row.width} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-7 flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Wallet className="h-4 w-4" />
                    <span className="text-xs font-bold">صرفه‌جویی برآوردی</span>
                  </div>
                  <b className="text-lg font-black text-emerald-300">۲٬۴۰۰٬۰۰۰ تومان</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- reviews */}
      <section id="reviews" className="relative mx-auto max-w-7xl px-5 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip">نظرات مسافران</span>
          <h2 className="section-title mt-4">سفرهایی که خاطره شدند</h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {REVIEWS.map((review, index) => (
            <motion.blockquote
              key={review.name}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.1 }}
              className="glass glass-hover p-6"
            >
              <div className="flex gap-1 text-cyan-300">
                {Array.from({ length: 5 }).map((_, star) => (
                  <Star key={star} className="h-4 w-4 fill-cyan-300" />
                ))}
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">«{review.text}»</p>
              <footer className="mt-5 flex items-center gap-3 border-t border-white/5 pt-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-teal-600 text-sm font-black text-slate-950">
                  {review.name.charAt(0)}
                </span>
                <div>
                  <b className="block text-sm text-white">{review.name}</b>
                  <span className="text-[11px] text-slate-500">{review.role}</span>
                </div>
              </footer>
            </motion.blockquote>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ faq */}
      <section className="relative mx-auto max-w-4xl px-5 py-16">
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
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-right"
                >
                  <b className="text-sm font-bold text-white sm:text-base">{item.q}</b>
                  <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-cyan-300 transition " + (isOpen ? "rotate-45" : "")}>
                    +
                  </span>
                </button>
                {isOpen && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="px-6 pb-5 text-sm leading-7 text-slate-400"
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
      <section className="relative mx-auto max-w-7xl px-5 pb-24 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass relative overflow-hidden p-10 text-center sm:p-16"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.25),transparent_60%)]" />
          <div className="relative">
            <span className="grid mx-auto h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow">
              <Building2 className="h-6 w-6" />
            </span>
            <h2 className="section-title mt-6">چمدان‌ها را ببندید، بقیه‌اش با سفرینو</h2>
            <p className="mx-auto mt-4 max-w-xl leading-8 text-slate-300">
              همین امروز حساب رایگان بسازید و اولین سفر خود را با کد تخفیف
              <b className="mx-1 text-cyan-300">SAFARINO20</b>
              با ۲۰٪ تخفیف رزرو کنید.
            </p>

            <form className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
              <input className="field" placeholder="ایمیل یا شمارهٔ موبایل" />
              <a href="/quiz" className="btn-primary shrink-0">
                شروع برنامه‌ریزی
                <ArrowLeft className="h-4 w-4" />
              </a>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> پرداخت امن بانکی
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-3.5 w-3.5 text-sky-400" /> بدون هزینهٔ پنهان
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Headphones className="h-3.5 w-3.5 text-cyan-300" /> پشتیبانی فارسی ۲۴/۷
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-white/5 bg-night-950/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950">
                <Plane className="h-4 w-4 -rotate-45" strokeWidth={2.6} />
              </span>
              <b className="text-base font-black text-white">سفرینو</b>
            </div>
            <p className="mt-4 text-xs leading-6 text-slate-500">
              سفرینو، همسفر هوشمند سفرهای ایرانی؛ ساخته‌شده با Next.js 14 و Tailwind CSS.
            </p>
          </div>

          {[
            { title: "خدمات", items: ["رزرو پرواز", "رزرو هتل", "تورهای خارجی", "بیمهٔ سفر"] },
            { title: "شرکت", items: ["دربارهٔ ما", "تماس با ما", "فرصت‌های شغلی", "وبلاگ"] },
            { title: "قوانین", items: ["شرایط استرداد", "حریم خصوصی", "قوانین پرواز", "پرسش‌های متداول"] },
          ].map((column) => (
            <div key={column.title}>
              <b className="text-sm font-bold text-white">{column.title}</b>
              <ul className="mt-4 space-y-2.5">
                {column.items.map((item) => (
                  <li key={item}>
                    <a className="text-xs text-slate-500 transition hover:text-cyan-300" href="#">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 px-5 py-5">
          <p className="mx-auto max-w-7xl text-center text-[11px] text-slate-600">
            © ۱۴۰۳ تمام حقوق برای سفرینو محفوظ است — ساخته‌شده با ❤️ در ایران
          </p>
        </div>
      </footer>
    </main>
  );
}
