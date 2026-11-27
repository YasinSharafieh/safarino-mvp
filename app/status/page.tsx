import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Clock3, Database, Layers, RefreshCw, ShieldCheck } from "lucide-react";

/**
 * «وضعیت داده‌ها» — the page that answers the one question a traveller should
 * never have to take on faith: *is this price from today?*
 *
 * It reads `/api/status`, which reports the same freshness numbers the panels
 * use, and prints them in the traveller's own language. Nothing here is a
 * marketing claim: every line is a fact about what the site is doing right now —
 * which sources answer, how long a saved copy may live, and when the warm-up
 * last ran.
 */

export const metadata: Metadata = {
  title: "وضعیت داده‌ها و تازگی قیمت‌ها",
  description:
    "سفرینو از کجا قیمت می‌گیرد، هر چند وقت تازه می‌شود و چرا می‌توانی به عددهایش اعتماد کنی. منابع، زمان تازه‌سازی و محدودهٔ کش، شفاف و بدون ادعا.",
  alternates: { canonical: "/status" },
};

type StatusPayload = {
  checkedAt: string;
  sources: Record<string, { label: string; serves: string; configured?: boolean }>;
  freshness: { ticketMinutes: number; roomMinutes: number; warmUp: string; lastWarmAt: string | null; lastWarmLabel: string };
  health: { providerStorage: boolean; ai: string; cache: string };
};

/**
 * The page renders on the server, so it cannot fetch its own API through a
 * guessed host (and on a static export there is no server at all). The status is
 * therefore computed by the same functions the API uses: one source of truth,
 * no self-call, and the page works in every deployment mode.
 */
async function loadStatus(): Promise<StatusPayload | null> {
  try {
    const { getProviderCache, providerStorageHealthy } = await import("@/lib/provider-cache");
    const { topDemand, freshnessOf } = await import("@/lib/freshness");
    const { TRANSPORT_FRESH_SECONDS } = await import("@/lib/transport-search");
    const [storage, lastWarm, demand] = await Promise.all([
      providerStorageHealthy(),
      getProviderCache<string>("safarino:warm-lock"),
      topDemand("ticket", 5),
    ]);
    void demand;
    const warm = freshnessOf("ticket", lastWarm || null);
    return {
      checkedAt: new Date().toISOString(),
      sources: {
        alibaba: { label: "علی‌بابا", serves: "بلیت قطار، هواپیما، اتوبوس و هتل" },
        safar724: { label: "سفر۷۲۴", serves: "بلیت اتوبوس" },
        stays: { label: "جاباما · جاجیگا · اتاقک · اقامت۲۴", serves: "اقامتگاه و هتل" },
        neshan: { label: "نشان", serves: "مسیر، فاصله و ترافیک", configured: Boolean(process.env.NESHAN_API_KEY) },
        weather: { label: "Open-Meteo", serves: "هوای روزهای سفر" },
      },
      freshness: {
        ticketMinutes: Math.round(TRANSPORT_FRESH_SECONDS / 60),
        roomMinutes: 30,
        warmUp: "هر ۶ ساعت، به‌علاوهٔ گرم‌کردن تقاضامحور برای مسیرهایی که واقعاً جست‌وجو شده‌اند",
        lastWarmAt: lastWarm || null,
        lastWarmLabel: warm.label,
      },
      health: {
        providerStorage: storage,
        ai: process.env.OPENROUTER_API_KEY ? "configured" : "off",
        cache: process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? "configured" : "off",
      },
    };
  } catch {
    return null;
  }
}

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

export default async function StatusPage() {
  const status = await loadStatus();
  const sources = status ? Object.entries(status.sources) : [];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-10 sm:px-6">
      <span className="chip border-emerald-400/25 bg-emerald-400/10 !text-emerald-200">
        <BadgeCheck className="h-3.5 w-3.5" />
        شفافیت داده
      </span>
      <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">قیمت‌های سفرینو از کجا و از چه زمانی‌اند؟</h1>
      <p className="mt-2 max-w-2xl text-[12px] leading-7 text-slate-400">
        سفرینو هیچ قیمتی نمی‌سازد و هیچ بلیتی را از خودش نمی‌فروشد. هر عدد از سایت صاحبش خوانده می‌شود و در همین صفحه می‌توانی ببینی
        هر منبع چه چیزی می‌دهد، یک نسخهٔ ذخیره‌شده چند دقیقه اجازهٔ عمر دارد، و آخرین تازه‌سازی چه زمانی بوده است.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { Icon: Clock3, label: "عمر نسخهٔ بلیت", value: status ? `${fa(status.freshness.ticketMinutes)} دقیقه` : "—", note: "بعد از آن، دوباره از منبع خوانده می‌شود" },
          { Icon: Database, label: "عمر نسخهٔ اقامت", value: status ? `${fa(status.freshness.roomMinutes)} دقیقه` : "—", note: "اتاق کندتر از بلیت عوض می‌شود" },
          { Icon: RefreshCw, label: "آخرین تازه‌سازی", value: status?.freshness.lastWarmAt ? status.freshness.lastWarmLabel : "در انتظار", note: "گرم‌کردن دوره‌ای + بر اساس تقاضای واقعی" },
        ].map((card) => (
          <div key={card.label} className="glass-soft p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200">
              <card.Icon className="h-4 w-4" />
            </span>
            <b className="mt-2.5 block text-[11px] font-bold text-slate-400">{card.label}</b>
            <b className="block text-lg font-black text-white">{card.value}</b>
            <span className="mt-1 block text-[9.5px] leading-5 text-slate-500">{card.note}</span>
          </div>
        ))}
      </div>

      <section className="glass mt-5 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <Layers className="h-4 w-4 text-cyan-300" />
          <b className="text-[12px] font-black text-white">منابعی که واقعاً خوانده می‌شوند</b>
        </div>
        <div className="divide-y divide-white/5">
          {sources.length ? (
            sources.map(([id, source]) => (
              <div key={id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <b className="text-[11.5px] text-white">{source.label}</b>
                <span className="text-[10px] text-slate-400">{source.serves}</span>
                {typeof source.configured === "boolean" ? (
                  <span className={`rounded-full border px-2 py-0.5 text-[8.5px] font-bold ${source.configured ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-slate-400"}`}>
                    {source.configured ? "فعال" : "کلید تنظیم نشده"}
                  </span>
                ) : null}
              </div>
            ))
          ) : (
            <p className="px-4 py-4 text-[10.5px] text-slate-400">وضعیت منابع همین حالا قابل خواندن نبود؛ خودِ جست‌وجوها مستقل از این صفحه کار می‌کنند.</p>
          )}
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="glass-soft p-4">
          <b className="flex items-center gap-1.5 text-[11.5px] font-black text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            چه چیزی ذخیره می‌شود و چه چیزی نه
          </b>
          <ul className="mt-2 space-y-1.5 text-[10px] leading-6 text-slate-400">
            <li>• پاسخ منابع، به‌عنوان <b className="text-slate-200">کش</b> با عمر محدود — مثل کش هر سایت حرفه‌ای.</li>
            <li>• سفر تو فقط در مرورگر خودت می‌ماند؛ سرور سفر مسافران را ذخیره نمی‌کند.</li>
            <li>• عکس بلیت یا رسید برای خواندن به مدل می‌رود و در سفرینو نگه داشته نمی‌شود.</li>
            <li>• هیچ شناسه‌ای از مسافر برای «تقاضا» ثبت نمی‌شود؛ فقط مسیر و تاریخ.</li>
          </ul>
        </div>
        <div className="glass-soft p-4">
          <b className="flex items-center gap-1.5 text-[11.5px] font-black text-white">
            <RefreshCw className="h-4 w-4 text-cyan-300" />
            تازه‌سازی چطور انجام می‌شود
          </b>
          <p className="mt-2 text-[10px] leading-6 text-slate-400">
            {status?.freshness.warmUp || "هر ۶ ساعت یک کار زمان‌بندی‌شده نسخه‌های پرتقاضا را تازه می‌کند."}
          </p>
          <p className="mt-2 text-[10px] leading-6 text-slate-400">
            هر جست‌وجوی تازه هم قیمت را زنده می‌خواند؛ اگر پاسخ قدیمی باشد، خودِ کارت می‌نویسد «۱۲ دقیقه پیش» و دکمهٔ تازه‌سازی نشان می‌دهد.
          </p>
          <p className="mt-2 text-[9.5px] leading-5 text-slate-500">
            وضعیت کش: {status ? (status.health.cache === "configured" ? "فعال" : "خاموش") : "—"} · هوش مصنوعی:{" "}
            {status ? (status.health.ai === "configured" ? "فعال" : "خاموش") : "—"}
          </p>
        </div>
      </section>

      <Link href="/" className="btn-primary mt-6 !px-5 !py-2.5 text-[11px]">
        بازگشت به سفرینو
        <ArrowLeft className="h-3.5 w-3.5" />
      </Link>
    </main>
  );
}
