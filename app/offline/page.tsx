"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Car, Compass, MapPin, WifiOff } from "lucide-react";
import { ITINERARY_STORAGE_KEY } from "@/lib/itinerary-storage";

type SavedDay = {
  day: number;
  theme: string;
  totalKm: number;
  totalDriveMinutes: number;
  stops: { place: { name: string; category: string; latitude: number; longitude: number } }[];
};

type SavedPlan = {
  success?: boolean;
  city?: string;
  days?: SavedDay[];
  totals?: { km: number; driveMinutes: number; stops: number; days: number };
  generatedAt?: string;
};

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

/**
 * What a traveller sees when there is no network. It shows the last plan that
 * was made on this device, read straight from the device — nothing is fetched.
 */
export default function OfflinePage() {
  const [plan, setPlan] = useState<SavedPlan | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(ITINERARY_STORAGE_KEY) || window.localStorage.getItem(ITINERARY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedPlan;
        if (parsed?.days?.length) setPlan(parsed);
      }
    } catch {
      /* no stored plan: the page simply explains the situation */
    }
    setChecked(true);
  }, []);

  return (
    <main dir="rtl" className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#12364a_0%,#071521_60%)]" />
        <div className="absolute inset-0 grid-lines opacity-60" />
      </div>

      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-600 text-slate-950 shadow-glow">
            <Compass className="h-5 w-5" />
          </span>
          <span>
            <b className="block text-sm font-black text-white">سفرینو</b>
            <span className="block text-[10px] tracking-[0.3em] text-cyan-200/70">SAFARINO</span>
          </span>
        </Link>
        <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[10px] font-bold text-amber-100">
          <WifiOff className="h-3.5 w-3.5" />
          بدون اینترنت
        </span>
      </header>

      <section className="mx-auto mt-6 max-w-3xl">
        <div className="glass p-5 sm:p-7">
          <h1 className="text-xl font-black text-white sm:text-2xl">فعلاً اینترنتی نیست</h1>
          <p className="mt-2 text-[11px] leading-6 text-slate-400">
            صفحه‌هایی که قبلاً باز کرده‌اید از روی همین دستگاه باز می‌شوند. جست‌وجوی زنده، قیمت‌ها و هوای روزهای سفر بدون اینترنت به‌روز نمی‌شوند و چیزی از خودمان نمی‌سازیم.
          </p>

          {plan?.days?.length ? (
            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-black text-cyan-100">
                <MapPin className="h-4 w-4" />
                آخرین برنامهٔ ذخیره‌شده روی این دستگاه: {plan.city}
              </p>
              <p className="mt-1 text-[9.5px] text-slate-400">
                {fa(plan.totals?.days || plan.days.length)} روز · {fa(plan.totals?.stops || 0)} ایستگاه · {fa(plan.totals?.km || 0)} کیلومتر رانندگی
                {plan.generatedAt ? ` · ساخته‌شده در ${new Date(plan.generatedAt).toLocaleDateString("fa-IR")}` : ""}
              </p>
              <div className="mt-2 space-y-2">
                {plan.days.map((day) => (
                  <div key={day.day} className="rounded-xl border border-white/10 bg-slate-950/30 p-2">
                    <p className="flex items-center justify-between text-[10px] font-black text-white">
                      <span>روز {fa(day.day)}</span>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
                        <Car className="h-3 w-3" />
                        {fa(day.totalKm)} کیلومتر · {fa(day.totalDriveMinutes)} دقیقه
                      </span>
                    </p>
                    <ol className="mt-1 space-y-0.5">
                      {day.stops.map((stop, index) => (
                        <li key={`${day.day}-${stop.place.name}-${index}`} className="text-[9.5px] leading-5 text-slate-300">
                          <span className="me-1 text-cyan-300">{fa(index + 1)}.</span>
                          {stop.place.name}
                          <span className="text-slate-500"> — {stop.place.category}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          ) : checked ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-[10px] leading-6 text-slate-400">
              هنوز برنامه‌ای روی این دستگاه ذخیره نشده است. وقتی اینترنت داشتید، برنامهٔ روزبه‌روز را باز کنید و دکمهٔ «ذخیره برای آفلاین» را بزنید تا همین‌جا در دسترس باشد.
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl border border-cyan-400/30 bg-cyan-400/15 px-3 py-2 text-[10.5px] font-extrabold text-cyan-100 transition hover:bg-cyan-400/25"
            >
              تلاش دوباره
            </button>
            <Link href="/itinerary" className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[10.5px] font-bold text-slate-100">
              <ArrowLeft className="h-3.5 w-3.5" />
              برنامهٔ سفر
            </Link>
          </div>

          <p className="mt-3 text-[9px] leading-5 text-slate-500">
            برای مسیر رسیدن به هر جا، نسخهٔ آنلاین دکمهٔ «مسیریابی با نشان» دارد که مسیر واقعی همان لحظه را با ترافیک باز می‌کند؛ آن دکمه به اینترنت نیاز دارد.
          </p>
        </div>
      </section>
    </main>
  );
}
