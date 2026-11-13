import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Compass, Sparkles, Users } from "lucide-react";
import { DISCOVER_CITIES, findCity } from "@/lib/discover";
import { siteUrl } from "@/lib/site";
import CityAttractions from "@/components/CityAttractions";

type PageProps = { params: { city: string } };

/** Every recommended city is a real page, known before the first visit. */
export function generateStaticParams() {
  return DISCOVER_CITIES.map((city) => ({ city: encodeURIComponent(city.name) }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const city = findCity(decodeURIComponent(params.city));
  if (!city) return { title: "شهر پیدا نشد · سفرینو", robots: { index: false, follow: false } };
  const title = `سفر به ${city.name}`;
  const description = `${city.tagline}. ${city.highlights.join("، ")} — بهترین فصل: ${city.bestSeason}. جاذبه‌های واقعی ${city.name} و ساخت برنامهٔ سفر.`;
  return {
    title,
    description,
    alternates: { canonical: `/discover/${encodeURIComponent(city.name)}` },
    openGraph: {
      title: `${title} · سفرینو`,
      description,
      type: "article",
      url: `${siteUrl()}/discover/${encodeURIComponent(city.name)}`,
    },
  };
}

export default function DiscoverCityPage({ params }: PageProps) {
  const city = findCity(decodeURIComponent(params.city));
  if (!city) notFound();

  const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
  const others = DISCOVER_CITIES.filter((item) => item.name !== city.name).slice(0, 6);

  const structured = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: city.name,
    description: city.tagline,
    touristType: city.bestFor,
    containedInPlace: { "@type": "AdministrativeArea", name: city.province },
    url: `${siteUrl()}/discover/${encodeURIComponent(city.name)}`,
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

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />

      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="صفحهٔ اصلی سفرینو">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow transition group-hover:scale-105">
            <Compass className="h-5 w-5" />
          </span>
          <span>
            <b className="block text-sm font-black text-white">سفرینو</b>
            <span className="block text-[10px] tracking-[0.3em] text-cyan-200/70">SAFARINO</span>
          </span>
        </Link>
        <Link href="/discover" className="btn-ghost !px-3 !py-2 text-[11px]">
          <ArrowRight className="h-3.5 w-3.5" />
          همهٔ مقصدها
        </Link>
      </header>

      <section className="mx-auto mt-6 max-w-5xl">
        <div className="glass overflow-hidden">
          <div className="relative h-44 sm:h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/discover/map?city=${encodeURIComponent(city.name)}`}
              alt={`نقشهٔ ${city.name}`}
              className="h-full w-full object-cover opacity-80"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            <div className="absolute bottom-3 right-4 left-4">
              <span className="chip border-cyan-400/25 bg-cyan-400/15 !text-cyan-100">
                <Sparkles className="h-3 w-3" />
                {city.province}
              </span>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">سفر به {city.name}</h1>
              <p className="mt-1 text-[11.5px] text-slate-300">{city.tagline}</p>
            </div>
          </div>

          <div className="grid gap-2 p-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-slate-950/30 p-2.5">
              <span className="flex items-center gap-1 text-[9.5px] text-slate-500">
                <CalendarDays className="h-3 w-3 text-cyan-300" /> بهترین فصل
              </span>
              <b className="mt-0.5 block text-[11px] font-black text-white">{city.bestSeason}</b>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 p-2.5">
              <span className="flex items-center gap-1 text-[9.5px] text-slate-500">
                <Compass className="h-3 w-3 text-cyan-300" /> چند روز کافی است
              </span>
              <b className="mt-0.5 block text-[11px] font-black text-white">{fa(city.suggestedDays)} روز</b>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/30 p-2.5">
              <span className="flex items-center gap-1 text-[9.5px] text-slate-500">
                <Users className="h-3 w-3 text-cyan-300" /> مناسب برای
              </span>
              <b className="mt-0.5 block text-[11px] font-black text-white">{city.bestFor.join(" · ")}</b>
            </div>
          </div>

          <div className="px-4 pb-4">
            <p className="text-[10px] font-black text-slate-200">چرا این شهر؟</p>
            <ul className="mt-1.5 grid gap-1 sm:grid-cols-3">
              {city.highlights.map((highlight) => (
                <li key={highlight} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[10px] leading-5 text-slate-300">
                  {highlight}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[9px] leading-5 text-slate-500">
              این خط‌ها پیشنهاد سفرینو هستند؛ فهرست پایین از منابع عمومی خوانده می‌شود.
            </p>
          </div>
        </div>

        {/* The real attractions, on the device, from the same source as everywhere else */}
        <CityAttractions city={city.name} suggestedDays={city.suggestedDays} />
      </section>

      <section className="mx-auto mt-8 max-w-5xl">
        <h2 className="text-sm font-black text-white">مقصدهای دیگر</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {others.map((other) => (
            <li key={other.name}>
              <Link
                href={`/discover/${encodeURIComponent(other.name)}`}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10.5px] font-bold text-slate-200 transition hover:border-cyan-400/40 hover:text-white"
              >
                {other.name}
                <span className="text-[9px] text-slate-500">{other.province}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mx-auto mt-8 max-w-5xl pb-6 text-[9px] leading-5 text-slate-500">
        جاذبه‌ها، عکس‌ها و توضیح‌ها از ویکی‌پدیای فارسی، ویکی‌داده و نقشهٔ آزاد (OpenStreetMap) خوانده می‌شوند و به منبع خودشان لینک دارند. هیچ مکان یا عددی ساختگی نیست.
      </footer>
    </main>
  );
}
