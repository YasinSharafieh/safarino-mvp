import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Compass, MapPin, Sparkles, Users } from "lucide-react";
import { DISCOVER_CITIES, DISCOVER_MOODS } from "@/lib/discover";
import { siteUrl } from "@/lib/site";
import DiscoverGrid from "@/components/DiscoverGrid";

export const metadata: Metadata = {
  title: "کشف مقصدها",
  description:
    "شهرهای پیشنهادی سفرینو برای سفر در ایران: مشهد، اصفهان، شیراز، یزد، کیش، قشم و بیشتر — با جاذبه‌های واقعی، فصل مناسب و تعداد روز پیشنهادی.",
  alternates: { canonical: "/discover" },
  openGraph: {
    title: "کشف مقصدها · سفرینو",
    description: "کجا برویم؟ شهرها را ببینید، جاذبه‌های واقعی‌شان را بخوانید و برنامهٔ سفر بسازید.",
  },
};

/**
 * «کشف»: the public way in. Someone who does not know where to go picks a
 * city here, sees its real attractions, and turns that into a plan.
 * The page is static text (fast for everyone, readable by search engines);
 * the attractions themselves are fetched live on each city page.
 */
export default function DiscoverPage() {
  const regionCount = new Set(DISCOVER_CITIES.map((city) => city.province)).size;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "شهرهای پیشنهادی سفرینو",
    numberOfItems: DISCOVER_CITIES.length,
    itemListElement: DISCOVER_CITIES.map((city, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: city.name,
      url: `${siteUrl()}/discover/${encodeURIComponent(city.name)}`,
    })),
  };

  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#12364a_0%,#071521_60%)]" />
        <div className="absolute inset-0 grid-lines opacity-60" />
        <div className="aurora">
          <span className="-top-24 right-[5%] h-96 w-96 animate-float bg-teal-500/25" />
          <span className="left-[2%] top-[32rem] h-80 w-80 animate-float bg-sky-500/20 [animation-delay:1.5s]" />
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />

      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="صفحهٔ اصلی سفرینو">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow transition group-hover:scale-105">
            <Compass className="h-5 w-5" />
          </span>
          <span>
            <b className="block text-sm font-black text-white">سفرینو</b>
            <span className="block text-[10px] tracking-[0.3em] text-cyan-200/70">SAFARINO</span>
          </span>
        </Link>
        <Link href="/quiz" className="btn-ghost !px-3 !py-2 text-[11px]">
          <ArrowLeft className="h-3.5 w-3.5" />
          نمی‌دانم کجا بروم
        </Link>
      </header>

      <section className="mx-auto mt-8 max-w-6xl text-center">
        <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">
          <Sparkles className="h-3 w-3" />
          کشف مقصد
        </span>
        <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">
          کجا برویم؟
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-[12px] leading-7 text-slate-400">
          {new Intl.NumberFormat("fa-IR").format(DISCOVER_CITIES.length)} شهر پیشنهادی در {new Intl.NumberFormat("fa-IR").format(regionCount)} استان.
          جاذبه‌های هر شهر از منابع واقعی (ویکی‌پدیا، ویکی‌داده و نقشهٔ آزاد) خوانده می‌شود — هیچ مکانی برای پرکردن صفحه ساخته نمی‌شود.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
            <MapPin className="h-3 w-3 text-cyan-300" /> جاذبه‌های واقعی با مختصات
          </span>
          <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
            <CalendarDays className="h-3 w-3 text-cyan-300" /> فصل مناسب هر شهر
          </span>
          <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
            <Users className="h-3 w-3 text-cyan-300" /> برای چه کسی مناسب است
          </span>
        </div>
      </section>

      <DiscoverGrid
        cities={DISCOVER_CITIES.map((city) => ({
          name: city.name,
          province: city.province,
          tagline: city.tagline,
          moods: city.moods,
          bestSeason: city.bestSeason,
          suggestedDays: city.suggestedDays,
        }))}
        moods={DISCOVER_MOODS}
      />

      <section className="mx-auto mt-10 max-w-6xl">
        <div className="glass flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <b className="block text-sm font-black text-white">شهرتان را اینجا نمی‌بینید؟</b>
            <p className="mt-1 text-[10.5px] leading-6 text-slate-400">
              کوییز سفر یا جست‌وجوی مقصد، شهرهای بیشتری را پوشش می‌دهد و همان‌جا اقامتگاه و وسیلهٔ سفر انتخاب می‌شود.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/quiz" className="btn-primary !px-4 !py-2.5 text-[11px]">کوییز سفر</Link>
            <Link href="/plan" className="btn-ghost !px-4 !py-2.5 text-[11px]">برنامهٔ هوشمند</Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto mt-8 max-w-6xl pb-6 text-center text-[9.5px] leading-5 text-slate-500">
        اطلاعات فصل و تعداد روز، پیشنهاد سفرینو است؛ جاذبه‌ها، عکس‌ها و توضیح‌ها از منابع عمومی خوانده می‌شوند و ممکن است کامل نباشند.
      </footer>
    </main>
  );
}
