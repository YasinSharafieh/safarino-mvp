"use client";

/**
 * «کدام شهر؟» — two cities side by side, then one honest decision.
 *
 * The table is built from the same daily costs and characters the rest of the
 * site uses, so it can never disagree with the budget pages. The decision line
 * may be written by the model, but every number in it must already be in the
 * table; otherwise the locally computed verdict stays.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Check, LoaderCircle, Sparkles } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { DISCOVER_CITIES } from "@/lib/discover";

const fa = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${fa.format(Math.round(value))} تومان`;

type Facts = {
  name: string;
  province: string;
  tagline: string;
  highlights: string[];
  bestFor: string[];
  bestSeason: string;
  moods: string[];
  suggestedDays: number;
  dailyTotal: number;
  tripDailyCost: number;
  specific: boolean;
};

type Verdict = { winner: "a" | "b" | "tie"; headline: string; reason: string; source: "local" | "ai"; costGap: number };

export default function CityCompare({ className = "" }: { className?: string }) {
  const { travelData, isHydrated } = useTravel();
  const [first, setFirst] = useState("کیش");
  const [second, setSecond] = useState("قشم");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ a: Facts; b: Facts; verdict: Verdict } | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const names = useMemo(() => DISCOVER_CITIES.map((city) => city.name), []);
  const travellers = Math.max(1, Number(travelData.travelers || 2) + Number(travelData.children || 0));
  const days = Math.max(1, Number(travelData.days) || 3);
  const budgetToman = Math.max(0, Math.round((Number(travelData.budget) || 20) * 1_000_000));

  async function run() {
    if (!first || !second || first === second) {
      setError("دو شهر متفاوت انتخاب کن.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/trip/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(28_000),
        body: JSON.stringify({
          a: first,
          b: second,
          travellers,
          days,
          budgetToman,
          moods: Array.isArray(travelData.tasteMoods) ? travelData.tasteMoods : [],
        }),
      });
      const payload = (await response.json()) as { success?: boolean; a?: Facts; b?: Facts; verdict?: Verdict; note?: string; error?: string };
      if (payload.success && payload.a && payload.b && payload.verdict) {
        setResult({ a: payload.a, b: payload.b, verdict: payload.verdict });
        setNote(payload.note || "");
      } else {
        setError(payload.error || "مقایسه انجام نشد.");
      }
    } catch {
      setError("ارتباط برقرار نشد.");
    } finally {
      setLoading(false);
    }
  }

  const rows: { label: string; a: string; b: string; better?: "a" | "b" }[] = result
    ? [
        { label: "استان", a: result.a.province, b: result.b.province },
        { label: "یک خط", a: result.a.tagline, b: result.b.tagline },
        { label: "مناسب برای", a: result.a.bestFor.slice(0, 2).join("، "), b: result.b.bestFor.slice(0, 2).join("، ") },
        { label: "بهترین فصل", a: result.a.bestSeason, b: result.b.bestSeason },
        {
          label: `خرج روزانه (${fa.format(travellers)} نفر)`,
          a: money(result.a.tripDailyCost),
          b: money(result.b.tripDailyCost),
          better: result.a.tripDailyCost === result.b.tripDailyCost ? undefined : result.a.tripDailyCost < result.b.tripDailyCost ? "a" : "b",
        },
        { label: "پیشنهاد اقامت", a: `${fa.format(result.a.suggestedDays)} روز`, b: `${fa.format(result.b.suggestedDays)} روز` },
        {
          label: "در بودجه‌ات جا می‌شود؟",
          a: result.a.tripDailyCost <= budgetToman ? "بله" : "کم می‌آید",
          b: result.b.tripDailyCost <= budgetToman ? "بله" : "کم می‌آید",
        },
      ]
    : [];

  return (
    <section className={`glass overflow-hidden p-4 sm:p-5 ${className}`} aria-label="مقایسهٔ دو شهر">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="chip border-teal-400/25 bg-teal-400/10 !text-teal-200">تصمیم با داده</span>
          <h2 className="mt-2 text-base font-black text-white sm:text-lg">بین دو شهر مانده‌ای؟</h2>
          <p className="mt-1 text-[11px] leading-6 text-slate-400">
            هزینهٔ روز، جنس سفر و بهترین فصل را با هم می‌سنجم و یک تصمیم با دلیل می‌دهم.
          </p>
        </div>
        <ArrowLeftRight className="h-6 w-6 text-teal-300" />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center">
        <select
          value={first}
          onChange={(event) => setFirst(event.target.value)}
          aria-label="شهر اول"
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[11.5px] text-white outline-none focus:border-teal-400/50"
        >
          {names.map((name) => (
            <option key={name} value={name} className="bg-slate-900">
              {name}
            </option>
          ))}
        </select>
        <span className="text-center text-[10px] text-slate-500">یا</span>
        <select
          value={second}
          onChange={(event) => setSecond(event.target.value)}
          aria-label="شهر دوم"
          className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[11.5px] text-white outline-none focus:border-teal-400/50"
        >
          {names.map((name) => (
            <option key={name} value={name} className="bg-slate-900">
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-400 px-4 py-2 text-[11px] font-black text-slate-950 transition hover:bg-teal-300 disabled:opacity-50"
        >
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "در حال مقایسه…" : "مقایسه کن"}
        </button>
      </div>

      {!isHydrated ? null : (
        <p className="mt-1 text-[8.5px] text-slate-500">
          با {fa.format(travellers)} نفر و {fa.format(days)} روز و بودجهٔ {fa.format(Math.round(budgetToman / 1_000_000))} میلیون تومانِ سفر فعلی‌ات
          حساب می‌کنم. اعداد روزانه تخمینی‌اند و همان اعدادی هستند که در صفحهٔ بودجه می‌بینی.
        </p>
      )}
      {error ? <p className="mt-2 text-[10px] text-rose-200">{error}</p> : null}

      {result ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-separate border-spacing-y-1 text-[10.5px]">
              <thead>
                <tr className="text-slate-400">
                  <th className="p-1 text-right font-bold"> </th>
                  <th className="p-1 text-right font-black text-white">{result.a.name}</th>
                  <th className="p-1 text-right font-black text-white">{result.b.name}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="rounded-lg bg-white/[0.03]">
                    <td className="p-1.5 text-slate-400">{row.label}</td>
                    <td className={`p-1.5 ${row.better === "a" ? "font-black text-emerald-200" : "text-slate-200"}`}>{row.a}</td>
                    <td className={`p-1.5 ${row.better === "b" ? "font-black text-emerald-200" : "text-slate-200"}`}>{row.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className={`mt-2 rounded-2xl border p-3 ${
              result.verdict.winner === "tie" ? "border-white/10 bg-white/[0.03]" : "border-emerald-400/25 bg-emerald-400/[0.07]"
            }`}
          >
            <p className="flex items-center gap-1.5 text-[11px] font-black text-emerald-100">
              <Check className="h-3.5 w-3.5" />
              {result.verdict.headline}
            </p>
            <p className="mt-1 text-[10px] leading-6 text-slate-200">{result.verdict.reason}</p>
            <p className="mt-1 text-[8.5px] text-slate-400">
              {result.verdict.source === "ai"
                ? "تصمیم با هوش مصنوعی، فقط از میان اعداد همین جدول"
                : "تصمیم از اعداد همین جدول، بدون هوش مصنوعی"}
              {note ? ` · ${note}` : ""}
            </p>
          </div>
        </motion.div>
      ) : null}
    </section>
  );
}
