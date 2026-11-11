import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Car, Clock3, Compass, MapPin, Share2, Wallet } from "lucide-react";
import { drawDayMap } from "@/lib/day-map";
import {
  compactTrip,
  decodeTripToken,
  loadSharedTrip,
  shareSummary,
  type ShareTrip,
} from "@/lib/share";
import { formatJalaliDate } from "@/lib/jalali";
import WeatherGlyph from "@/components/WeatherGlyph";
import SharedPlanActions from "@/components/SharedPlanActions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { code: string };
  searchParams: { d?: string };
};

/** The plan behind a link: stored short code first, self-contained link second. */
async function readTrip({ params, searchParams }: PageProps): Promise<ShareTrip | null> {
  if (params.code === "inline") {
    const decoded = decodeTripToken(searchParams.d);
    return decoded ? compactTrip(decoded) : null;
  }
  return loadSharedTrip(params.code);
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const trip = await readTrip(props);
  if (!trip) return { title: "برنامه پیدا نشد · سفرینو", robots: { index: false, follow: false } };
  const description = shareSummary(trip);
  return {
    title: `برنامهٔ سفر ${trip.city} · سفرینو`,
    description,
    // A shared plan is one traveller's trip: readable by whoever receives the
    // link, never collected by search engines.
    robots: { index: false, follow: false },
    openGraph: { title: `برنامهٔ سفر ${trip.city}`, description, siteName: "سفرینو", type: "article" },
  };
}

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function toman(value: number): string {
  return `${fa(Math.round(value))} تومان`;
}

export default async function SharedPlanPage(props: PageProps) {
  const trip = await readTrip(props);
  if (!trip) notFound();

  const maps = trip.days.map((day) => {
    const drawn = drawDayMap(
      day.stops.map((stop, index) => ({ latitude: stop.la, longitude: stop.lo, label: `${fa(index + 1)} ${stop.n}` })),
      { title: `روز ${fa(day.d)}` },
    );
    return { day: day.d, svg: drawn?.svg || "" };
  });

  const createdAt = trip.createdAt.slice(0, 10);

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

      <header className="mx-auto flex max-w-4xl items-center justify-between gap-4">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="صفحهٔ اصلی سفرینو">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow transition group-hover:scale-105">
            <Compass className="h-5 w-5" />
          </span>
          <span>
            <b className="block text-sm font-black text-white">سفرینو</b>
            <span className="block text-[10px] tracking-[0.3em] text-cyan-200/70">SAFARINO</span>
          </span>
        </Link>
        <SharedPlanActions />
      </header>

      <section className="mx-auto mt-6 max-w-4xl">
        <div className="glass p-5 sm:p-7">
          <span className="chip border-cyan-400/25 bg-cyan-400/10 !text-cyan-200">
            <Share2 className="h-3 w-3" />
            برنامهٔ به‌اشتراک‌گذاشته‌شده
          </span>
          <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">برنامهٔ سفر {trip.city}</h1>
          <p className="mt-2 text-[11px] leading-6 text-slate-400">
            {fa(trip.totals.days)} روز · {fa(trip.totals.stops)} ایستگاه · {fa(trip.totals.km)} کیلومتر رانندگی · حدود {fa(trip.totals.driveMinutes)} دقیقه پشت فرمان
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {[
              { icon: MapPin, label: "روز", value: fa(trip.totals.days) },
              { icon: Share2, label: "ایستگاه", value: fa(trip.totals.stops) },
              { icon: Car, label: "کیلومتر رانندگی", value: fa(trip.totals.km) },
              { icon: Clock3, label: "دقیقه پشت فرمان", value: fa(trip.totals.driveMinutes) },
            ].map((item) => (
              <div key={item.label} className="glass-soft flex items-center gap-2.5 p-3">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200">
                  <item.icon className="h-4 w-4" />
                </span>
                <span>
                  <b className="block text-sm font-black text-white">{item.value}</b>
                  <span className="block text-[10px] text-slate-500">{item.label}</span>
                </span>
              </div>
            ))}
          </div>

          {trip.weather?.days?.length ? (
            <div className="mt-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3">
              <p className="text-[10px] font-black text-cyan-100">
                {trip.weather.mode === "forecast" ? "هوای روزهای سفر (پیش‌بینی واقعی)" : "هوای معمول این روزها در سال‌های گذشته — نه پیش‌بینی"}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {trip.weather.days.map((item, index) => (
                  <div key={item.date} className="rounded-xl border border-white/10 bg-slate-950/30 p-2">
                    <span className="flex items-center justify-between text-[9.5px] text-slate-400">
                      <span>روز {fa(index + 1)}</span>
                      <span>{formatJalaliDate(item.date)}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-[11px] font-black text-white">
                      <WeatherGlyph code={item.code} className="h-3.5 w-3.5" />
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[9.5px] text-slate-300">
                      {item.maxC !== null ? `${fa(item.maxC)}° / ${item.minC !== null ? fa(item.minC) : "—"}°` : ""}
                      {item.rainProbability !== null ? ` · باران ${fa(item.rainProbability)}٪` : ""}
                    </span>
                  </div>
                ))}
              </div>
              {trip.weather.note ? <p className="mt-1 text-[9px] leading-5 text-slate-500">{trip.weather.note}</p> : null}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {trip.days.map((day) => {
              const map = maps.find((item) => item.day === day.d);
              return (
                <div key={day.d} className="glass-soft p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-black text-white">روز {fa(day.d)}</h2>
                    <span className="text-[10px] text-slate-500">
                      {day.th} · {fa(day.km)} کیلومتر · {fa(day.mn)} دقیقه رانندگی
                    </span>
                  </div>
                  {map?.svg ? (
                    <div className="mt-2 overflow-hidden rounded-xl border border-white/10" dangerouslySetInnerHTML={{ __html: map.svg }} />
                  ) : null}
                  <ol className="mt-2 space-y-2">
                    {day.stops.map((stop, index) => (
                      <li key={`${day.d}-${stop.n}-${index}`} className="flex items-start gap-2 rounded-xl border border-white/10 bg-slate-950/30 p-2">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-400/15 text-[9px] font-black text-cyan-200">
                          {fa(index + 1)}
                        </span>
                        {stop.i ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={stop.i} alt={stop.n} loading="lazy" className="h-11 w-11 shrink-0 rounded-lg border border-white/10 object-cover" />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <b className="block text-[11px] font-extrabold text-white">{stop.n}</b>
                          <span className="mt-0.5 block text-[9.5px] text-slate-500">
                            {stop.c} · شروع {stop.t} · {fa(stop.v)} دقیقه بازدید
                            {stop.km !== undefined && stop.km !== null ? ` · ${index === 0 ? "از اقامتگاه" : "از ایستگاه قبل"} ${fa(stop.km)} کیلومتر / ${fa(stop.mn || 0)} دقیقه` : ""}
                          </span>
                          {stop.d ? <p className="mt-1 line-clamp-2 text-[9.5px] leading-5 text-slate-400">{stop.d}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>

          {trip.money ? (
            <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-black text-amber-100">
                <Wallet className="h-4 w-4" />
                هزینهٔ تقریبی همین برنامه
              </p>
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {trip.money.lines.map((line) => (
                  <li key={line.label} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-950/25 px-2 py-1.5">
                    <span className="text-[10px] font-bold text-slate-200">
                      {line.label}
                      <span className={`ms-1.5 rounded px-1 py-0.5 text-[8.5px] ${line.kind === "real" ? "bg-emerald-400/15 text-emerald-200" : line.kind === "estimate" ? "bg-cyan-400/15 text-cyan-100" : "bg-amber-400/15 text-amber-200"}`}>
                        {line.kind === "real" ? "واقعی" : line.kind === "estimate" ? "تخمین" : "انتخاب نشده"}
                      </span>
                    </span>
                    <b className="text-[10px] font-black text-white">{line.amount === null ? "—" : toman(line.amount)}</b>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-2 py-1.5 sm:col-span-2">
                  <span className="text-[10px] font-black text-cyan-100">جمع سفر</span>
                  <b className="text-[11px] font-black text-white">{toman(trip.money.total)}</b>
                </li>
              </ul>
              <p className="mt-1.5 text-[9px] leading-5 text-slate-400">
                «واقعی» یعنی همان قیمتی که در لحظهٔ انتخاب از منبع اصلی خوانده شد؛ «تخمین» یعنی فرضی که خود مسافر تنظیم کرده است. قیمت‌ها در زمان ساخت این برنامه ثبت شده‌اند.
              </p>
            </div>
          ) : null}

          <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[9.5px] leading-6 text-slate-400">
            این صفحه یک تصویر ثابت از برنامه است که در {formatJalaliDate(createdAt)} ساخته شده؛ تغییرهای بعدی مسافر روی آن اثری ندارد. همهٔ مکان‌ها واقعی و دارای مختصات‌اند و کیلومترها با سرویس {trip.engine} اندازه‌گیری شده‌اند.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] p-2.5">
            <p className="min-w-0 flex-1 text-[10px] leading-6 text-cyan-100">می‌خواهید برنامهٔ سفر خودتان را بسازید؟</p>
            <Link href="/" className="rounded-lg border border-cyan-400/30 bg-cyan-400/15 px-3 py-1.5 text-[10px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/25">
              ساخت برنامه با سفرینو
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
