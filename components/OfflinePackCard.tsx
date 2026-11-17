"use client";

/**
 * «برای جاده ذخیره کن» — one press, and the trip works without a network.
 *
 * The card is honest about what it is saving and what it could not fill: the
 * day-by-day plan with addresses and coordinates, the chosen ticket and room,
 * the money rows and what is left. It then reports the real size and age of the
 * file, and warns when it is getting old.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { tripSignature } from "@/lib/checklist";
import { chosenTransport } from "@/lib/transport-selection";
import { tripCostBreakdown } from "@/lib/trip-costs";
import { readLedger, ledgerTotals } from "@/lib/trip-ledger";
import { buildOfflinePack, clearOfflinePack, packAge, packWarnings, readOfflinePack, saveOfflinePack, type OfflinePack } from "@/lib/offline-pack";

const fa = new Intl.NumberFormat("fa-IR");

export type PackDayInput = {
  day: number;
  title?: string;
  stops: { name?: string; category?: string; time?: string; latitude?: number | null; longitude?: number | null; phone?: string | null }[];
};

export default function OfflinePackCard({ days, className = "" }: { days: PackDayInput[]; className?: string }) {
  const { travelData, isHydrated } = useTravel();
  const [pack, setPack] = useState<OfflinePack | null>(null);
  const [state, setState] = useState<"missing" | "ok" | "outdated" | "unreadable">("missing");
  const [justSaved, setJustSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  const trip = useMemo(
    () =>
      tripSignature({
        origin: travelData.origin,
        destination: travelData.destination,
        departureDate: travelData.departureDate,
        days: travelData.days,
      }),
    [travelData.days, travelData.departureDate, travelData.destination, travelData.origin],
  );

  useEffect(() => {
    if (!isHydrated) return;
    const read = readOfflinePack(trip);
    setPack(read.pack);
    setState(read.state);
  }, [isHydrated, trip]);

  const travellers = Math.max(1, Number(travelData.travelers || 1) + Number(travelData.children || 0) + Number(travelData.infants || 0));
  const dayCount = Math.max(1, Number(travelData.days) || 1);
  const transport = chosenTransport(travelData.transport);
  const stay = (travelData.accommodation || {}) as Record<string, unknown>;
  const stayCost = Number(stay.cost) || 0;
  const budgetToman = Math.max(0, Math.round((Number(travelData.budget) || 0) * 1_000_000));
  const costs = tripCostBreakdown({
    totalBudget: budgetToman,
    travellers,
    days: dayCount,
    nights: Math.max(1, dayCount - 1),
    city: travelData.destination,
    tickets: transport?.cost || 0,
    stay: stayCost,
  });
  const ledger = ledgerTotals(readLedger(trip), budgetToman);

  function save() {
    const next = buildOfflinePack({
      trip: {
        origin: travelData.origin || "",
        destination: travelData.destination || "",
        departureDate: travelData.departureDate || null,
        returnDate: travelData.returnDate || null,
        days: dayCount,
        travellers: Number(travelData.travelers) || 1,
        children: Number(travelData.children) || 0,
      },
      days: days.map((day) => ({
        day: day.day,
        title: day.title,
        stops: day.stops.map((stop) => ({
          name: stop.name,
          category: stop.category,
          time: stop.time,
          latitude: stop.latitude ?? null,
          longitude: stop.longitude ?? null,
          phone: stop.phone ?? null,
        })),
      })),
      booking: {
        transportLabel: transport?.title || transport?.modeLabel || null,
        transportCost: transport?.cost || 0,
        stayName: typeof stay.name === "string" ? stay.name : null,
        stayCost,
        stayAddress: typeof stay.address === "string" ? stay.address : null,
        stayPhone: typeof stay.phone === "string" ? stay.phone : null,
      },
      money: {
        budgetToman,
        plannedToman: costs.rows.filter((row) => row.kind === "real").reduce((sum, row) => sum + row.amount, 0),
        spentToman: ledger.totalToman,
        remainingToman: budgetToman - ledger.totalToman,
        rows: costs.rows.map((row) => ({ label: row.label, toman: row.amount, kind: row.kind })),
      },
    });
    const ok = saveOfflinePack(next);
    setFailed(!ok);
    if (ok) {
      setPack(next);
      setState("ok");
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 6000);
    }
  }

  if (!isHydrated || !travelData.destination) return null;

  const warnings = pack ? packWarnings(pack) : [];
  const stopCount = days.reduce((sum, day) => sum + day.stops.length, 0);

  return (
    <section className={`glass overflow-hidden p-4 ${className}`} aria-label="بستهٔ آفلاین سفر">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <b className="flex items-center gap-1.5 text-[11px] font-black text-white">
            <WifiOff className="h-3.5 w-3.5 text-cyan-300" />
            برای جاده ذخیره کن
          </b>
          <p className="mt-1 text-[10px] leading-6 text-slate-400">
            {fa.format(dayCount)} روز · {fa.format(stopCount)} ایستگاه با آدرس و مختصات · بلیت و اقامت · پول و باقی‌مانده.
            همه در همین گوشی می‌مانند و بدون اینترنت باز می‌شوند.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-3 py-2 text-[10.5px] font-black text-slate-950 transition hover:bg-cyan-300"
        >
          {pack ? <RefreshCw className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          {pack ? "به‌روزرسانی" : "ذخیره برای آفلاین"}
        </button>
      </div>

      {justSaved ? (
        <p className="mt-2 flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-1 text-[9.5px] text-emerald-100">
          <CheckCircle2 className="h-3 w-3" />
          ذخیره شد. حالا حتی بدون اینترنت هم برنامه، آدرس اقامتگاه و باقی‌ماندهٔ بودجه در دسترس است.
        </p>
      ) : null}
      {failed ? <p className="mt-2 text-[9.5px] text-rose-200">ذخیره نشد؛ حافظهٔ مرورگر پر است یا اجازه نمی‌دهد.</p> : null}

      {state === "outdated" ? (
        <p className="mt-2 text-[9.5px] text-amber-200">یک نسخهٔ قدیمی از بسته ذخیره شده؛ با «به‌روزرسانی» جایش را با نسخهٔ تازه عوض کن.</p>
      ) : null}
      {state === "unreadable" ? (
        <p className="mt-2 text-[9.5px] text-amber-200">بستهٔ ذخیره‌شده خوانده نشد؛ یک بار دیگر ذخیره کن.</p>
      ) : null}

      {pack ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/40 p-2">
          <p className="text-[9.5px] text-slate-300">
            آخرین ذخیره: {packAge(pack).text} · {pack.trip.origin} → {pack.trip.destination} · {fa.format(pack.days.length)} روز
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-400">
            <span>ماندهٔ بودجه: {fa.format(pack.money.remainingToman)} تومان</span>
            <span>خرج ثبت‌شده: {fa.format(pack.money.spentToman)} تومان</span>
            {pack.booking.stayName ? <span>اقامت: {pack.booking.stayName}</span> : null}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Link href="/offline" className="text-[9px] font-black text-cyan-200 hover:text-cyan-100">
              دیدن نسخهٔ آفلاین →
            </Link>
            <button
              type="button"
              onClick={() => {
                clearOfflinePack(trip);
                setPack(null);
                setState("missing");
              }}
              className="text-[9px] text-slate-500 transition hover:text-rose-200"
            >
              پاک کردن بسته
            </button>
          </div>
        </div>
      ) : null}

      {warnings.length ? (
        <ul className="mt-2 space-y-0.5">
          {warnings.slice(0, 3).map((warning) => (
            <li key={warning} className="flex items-start gap-1 text-[9px] leading-5 text-amber-200/85">
              <TriangleAlert className="mt-0.5 h-2.5 w-2.5 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
