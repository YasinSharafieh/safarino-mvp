"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Car, Download, LoaderCircle, Printer } from "lucide-react";
import { useTravel } from "../../context/TravelContext";
import { drawDayMap } from "@/lib/day-map";
import { ITINERARY_STORAGE_KEY } from "@/lib/itinerary-storage";
import { formatJalaliDate } from "@/lib/jalali";
import type { ItineraryDay } from "@/lib/itinerary";

type SavedItinerary = {
  success: boolean;
  city: string;
  days: ItineraryDay[];
  totals: { km: number; driveMinutes: number; stops: number; days: number };
  engine: string;
  note: string;
  generatedAt: string;
};

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function toman(value: number): string {
  return `${fa(Math.round(value / 1000) * 1000)} تومان`;
}

/**
 * The printable travel book: cover, a page per day with its own map and
 * pictures, and a clear budget table. «ذخیرهٔ PDF» uses the browser's own
 * print dialog, which keeps the Persian text sharp and selects the right fonts.
 */
export default function ItineraryPrintPage() {
  const { travelData, isHydrated } = useTravel();
  const [saved, setSaved] = useState<SavedItinerary | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(ITINERARY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedItinerary;
        if (parsed?.success && Array.isArray(parsed.days)) {
          setSaved(parsed);
          return;
        }
      }
      setMissing(true);
    } catch {
      setMissing(true);
    }
  }, []);

  const stay = travelData.accommodation && travelData.accommodation.status === "selected" ? travelData.accommodation : null;
  const transport = travelData.transport;
  const accommodationCost = Number(stay?.cost) || 0;
  const transportCost = Number(transport?.cost) || 0;
  const budgetToman = (Number(travelData.budget) || 0) * 1_000_000;
  const rest = Math.max(0, budgetToman - accommodationCost - transportCost);
  const tripDays = saved?.totals.days || Number(travelData.days) || 1;

  const maps = useMemo(() => {
    if (!saved) return {};
    const result: Record<number, string> = {};
    saved.days.forEach((day) => {
      const drawn = drawDayMap(
        day.stops.map((stop, index) => ({ latitude: stop.place.latitude, longitude: stop.place.longitude, label: `${fa(index + 1)} ${stop.place.name}` })),
        { title: `روز ${fa(day.day)}` },
      );
      if (drawn) result[day.day] = drawn.svg;
    });
    return result;
  }, [saved]);

  if (!isHydrated) {
    return (
      <main className="grid min-h-screen place-items-center bg-white text-slate-700" dir="rtl">
        <span className="flex items-center gap-2 text-sm">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          در حال آماده‌سازی…
        </span>
      </main>
    );
  }

  if (missing || !saved) {
    return (
      <main className="grid min-h-screen place-items-center bg-white p-6 text-slate-700" dir="rtl">
        <div className="max-w-md rounded-2xl border border-slate-200 p-6 text-center">
          <h1 className="text-lg font-black text-slate-900">نسخهٔ چاپی هنوز ساخته نشده است</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">اول در صفحهٔ «برنامهٔ روزبه‌روز» دکمهٔ ساخت/بازچینش را بزنید تا روزها آماده شوند؛ بعد این صفحه را باز کنید.</p>
          <Link href="/itinerary" className="mt-4 inline-block rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white">
            بازگشت به برنامهٔ روزبه‌روز
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 pb-16 print:bg-white print:pb-0">
      <style>{`
        @page {
          size: A4;
          margin: 14mm 12mm;
        }
        @media print {
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; border: 0 !important; }
          .day-block { break-before: page; }
          .stop-row { break-inside: avoid; page-break-inside: avoid; }
          .day-map { max-height: 82mm; overflow: hidden; }
          .day-map svg { max-height: 82mm; }
          .stop-text { font-size: 9.5pt; line-height: 1.55; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <Link href="/itinerary" className="flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-cyan-700">
            <ArrowRight className="h-4 w-4" />
            بازگشت به برنامه
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700">
              <Download className="h-4 w-4" />
              ذخیرهٔ PDF
            </button>
            <span className="hidden items-center gap-1 text-[11px] text-slate-500 sm:flex">
              <Printer className="h-3.5 w-3.5" />
              در پنجرهٔ چاپ، «Save as PDF» را انتخاب کنید
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-3 print:max-w-none print:px-0">
        {/* Cover */}
        <section className="sheet mt-4 rounded-2xl bg-white p-8 shadow-sm print:mt-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-[0.4em] text-cyan-700">SAFARINO</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">دفترچهٔ سفر {saved.city}</h1>
              <p className="mt-2 text-sm text-slate-600">
                {fa(tripDays)} روز · {fa(saved.totals.stops)} ایستگاه · {fa(saved.totals.km)} کیلومتر رانندگی · حدود {fa(saved.totals.driveMinutes)} دقیقه پشت فرمان
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {travelData.departureDate ? `تاریخ حرکت: ${formatJalaliDate(travelData.departureDate)} · ` : ""}
                ساخته‌شده در {formatJalaliDate(saved.generatedAt.slice(0, 10))} · مسیرها با {saved.engine}
              </p>
            </div>
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-cyan-600 text-white">
              <Car className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-bold text-slate-500">اقامتگاه</p>
              <p className="mt-1 text-sm font-black text-slate-900">{stay ? String(stay.name || "") : "انتخاب نشده"}</p>
              {stay ? (
                <p className="mt-1 text-[11px] text-slate-600">
                  {String(stay.typeLabel || "")} · {fa(Number(stay.nights) || 0)} شب · {stay.city ? String(stay.city) : ""}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-bold text-slate-500">حمل‌ونقل</p>
              <p className="mt-1 text-sm font-black text-slate-900">
                {transport ? String((transport.providerLabel as string) || (transport.title as string) || (transport.kind as string) || "انتخاب‌شده") : "انتخاب نشده"}
              </p>
              {transport && typeof transport.cost === "number" ? <p className="mt-1 text-[11px] text-slate-600">{toman(transportCost)}</p> : null}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
            <p className="text-[11px] font-bold text-cyan-900">این دفترچه چه چیزی را تضمین می‌کند</p>
            <p className="mt-1 text-[11px] leading-6 text-cyan-900/80">
              همهٔ مکان‌ها واقعی و دارای مختصات هستند، فاصله و زمان رانندگی از سرویس مسیریابی نشان آمده و هیچ مکان یا عددی ساختگی نیست. برای رفتن به هر ایستگاه، در نسخهٔ آنلاین دکمهٔ «مسیریابی با نشان» همان مسیر را با ترافیک لحظه باز می‌کند.
            </p>
          </div>
        </section>

        {/* One page per day */}
        {saved.days.map((day) => (
          <section key={day.day} className="sheet day-block mt-4 rounded-2xl bg-white p-6 shadow-sm print:mt-0 print:p-4 print:shadow-none">
            <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-3">
              <h2 className="text-xl font-black text-slate-900">روز {fa(day.day)}</h2>
              <p className="text-[11px] text-slate-500">
                {day.theme} · {fa(day.totalKm)} کیلومتر · {fa(day.totalDriveMinutes)} دقیقه رانندگی
              </p>
            </div>

            {maps[day.day] ? (
              <div className="day-map mt-3 overflow-hidden rounded-xl border border-slate-200 print:break-inside-avoid" dangerouslySetInnerHTML={{ __html: maps[day.day] }} />
            ) : null}

            <ol className="mt-3 space-y-2">
              {day.stops.map((stop, index) => (
                <li key={stop.place.id} className="stop-row flex gap-3 rounded-xl border border-slate-200 p-3 print:p-2">
                  <div className="shrink-0 text-center">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-cyan-600 text-[11px] font-black text-white">{fa(stop.order)}</span>
                    <span className="mt-1 block text-[10px] font-bold text-slate-500">{stop.startTime}</span>
                  </div>
                  {stop.place.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={stop.place.imageUrl} alt={stop.place.name} className="h-20 w-24 shrink-0 rounded-lg border border-slate-200 object-cover print:h-16 print:w-20" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900">{stop.place.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {stop.place.category} · {fa(stop.visitMinutes)} دقیقه بازدید
                      {stop.legKm !== null ? ` · ${index === 0 ? "از اقامتگاه" : "از ایستگاه قبل"} ${fa(stop.legKm)} کیلومتر / ${fa(stop.legMinutes || 0)} دقیقه (${stop.legEngine})` : ""}
                    </p>
                    {stop.place.description ? <p className="stop-text mt-1 line-clamp-4 text-[11px] leading-6 text-slate-700">{stop.place.description.split(/(?<=[.!؟…])\s+/).slice(0, 3).join(" ")}</p> : null}
                  </div>
                </li>
              ))}
            </ol>

            {day.stops.some((stop) => stop.order === day.lunchAfter) ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900">
                بعد از ایستگاه {fa(day.lunchAfter)} ناهار و کمی استراحت در برنامه دیده شده است.
              </p>
            ) : null}
          </section>
        ))}

        {/* Money */}
        <section className="sheet mt-4 rounded-2xl bg-white p-6 shadow-sm print:mt-0 print:break-before-page">
          <h2 className="text-xl font-black text-slate-900">جمع هزینه‌ها</h2>
          <table className="mt-3 w-full text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                <th className="py-2 font-bold">قلم</th>
                <th className="py-2 font-bold">مبلغ</th>
                <th className="py-2 font-bold">توضیح</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              <tr className="border-b border-slate-100">
                <td className="py-2 font-bold">اقامتگاه</td>
                <td className="py-2">{accommodationCost ? toman(accommodationCost) : "—"}</td>
                <td className="py-2 text-[11px] text-slate-500">{stay ? `${String(stay.name || "")} · ${fa(Number(stay.nights) || 0)} شب` : "انتخاب نشده"}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 font-bold">حمل‌ونقل</td>
                <td className="py-2">{transportCost ? toman(transportCost) : "—"}</td>
                <td className="py-2 text-[11px] text-slate-500">{transport ? String((transport.providerLabel as string) || (transport.kind as string) || "") : "انتخاب نشده"}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 font-bold">بودجهٔ کل سفر</td>
                <td className="py-2">{budgetToman ? toman(budgetToman) : "—"}</td>
                <td className="py-2 text-[11px] text-slate-500">عددی که خودتان وارد کرده‌اید</td>
              </tr>
              <tr>
                <td className="py-2 font-bold">باقی‌مانده برای خوراک و بازدید</td>
                <td className="py-2 font-black text-cyan-800">{budgetToman ? toman(rest) : "—"}</td>
                <td className="py-2 text-[11px] text-slate-500">بودجه منهای اقامتگاه و حمل‌ونقل</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-[10px] leading-6 text-slate-500">
            قیمت‌های اقامتگاه و حمل‌ونقل همان چیزی است که در لحظهٔ انتخاب از منبع اصلی خوانده شد؛ ممکن است تغییر کند. هیچ هزینه‌ای تخمینی به‌عنوان واقعیت نوشته نشده است.
          </p>
          <p className="mt-1 text-[10px] leading-6 text-slate-500">{saved.note}</p>
        </section>
      </div>
    </main>
  );
}
