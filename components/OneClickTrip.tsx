"use client";

/**
 * «سفر با یک جمله» — the traveller writes one sentence, the site fills the trip.
 *
 * What it does with the result is the important part: it does not silently write
 * into the shared trip data. It shows *what was understood* — origin, city, days,
 * people, budget and the reason for the city — together with a list of anything
 * it had to assume, and waits for one press. Then the whole site (transport,
 * accommodation, plan, budget) is already filled in.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, LoaderCircle, Sparkles, Wand2 } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";

const fa = new Intl.NumberFormat("fa-IR");

type Plan = {
  origin: string;
  destination: string;
  days: number;
  travelers: number;
  children: number;
  budgetMillions: number;
  reason: string;
  source: "local" | "ai";
  assumed: string[];
};

const EXAMPLES = [
  "۵ روز با بچه، ۴۰ میلیون، از تهران",
  "یک هفته ساحل و آفتاب، ۶۰ میلیون، ۲ نفر",
  "۳ روز تاریخی، ۱۵ میلیون، از اصفهان",
];

export default function OneClickTrip({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { travelData, setTravelData, isHydrated } = useTravel();
  const [sentence, setSentence] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function read(text: string) {
    const clean = text.trim();
    if (clean.length < 4) {
      setError("یک جملهٔ کوتاه بنویس.");
      return;
    }
    setLoading(true);
    setError("");
    setPlan(null);
    try {
      const response = await fetch("/api/trip/oneclick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(28_000),
        body: JSON.stringify({ sentence: clean, origin: isHydrated ? travelData.origin : undefined }),
      });
      const payload = (await response.json()) as { success?: boolean; plan?: Plan; note?: string; error?: string };
      if (payload.success && payload.plan) {
        setPlan(payload.plan);
        setNote(payload.note || "");
      } else {
        setError(payload.error || "این جمله خوانده نشد.");
      }
    } catch {
      setError("ارتباط برقرار نشد؛ یک بار دیگر امتحان کن.");
    } finally {
      setLoading(false);
    }
  }

  function apply() {
    if (!plan) return;
    setTravelData((current) => ({
      ...current,
      origin: plan.origin,
      destination: plan.destination,
      days: plan.days,
      travelers: plan.travelers,
      children: plan.children,
      budget: plan.budgetMillions,
      // The travellers themselves are never invented: a date still has to be
      // chosen, so the transport page opens with the calendar waiting.
      departureDate: current.departureDate || "",
    }));
    router.push("/transport");
  }

  return (
    <section className={`glass overflow-hidden p-4 sm:p-5 ${className}`} aria-label="سفر با یک جمله">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="chip border-violet-400/25 bg-violet-400/10 !text-violet-200">تازه · با یک جمله</span>
          <h2 className="mt-2 text-base font-black text-white sm:text-lg">کل سفرت را با یک جمله بنویس</h2>
          <p className="mt-1 text-[11px] leading-6 text-slate-400">
            مثلاً «۵ روز با بچه، ۴۰ میلیون، از تهران». من مقصد را از میان شهرهای واقعی انتخاب می‌کنم و بقیهٔ سایت را با همین
            اطلاعات پر می‌کنم.
          </p>
        </div>
        <Wand2 className="h-6 w-6 text-violet-300" />
      </div>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void read(sentence);
        }}
      >
        <input
          value={sentence}
          onChange={(event) => setSentence(event.target.value)}
          placeholder="۵ روز با بچه، ۴۰ میلیون، از تهران"
          aria-label="جملهٔ سفر"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
        />
        <button
          type="submit"
          disabled={loading || sentence.trim().length < 4}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2.5 text-[11px] font-black text-white transition hover:bg-violet-400 disabled:opacity-50"
        >
          {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "دارم می‌چینم…" : "بچین"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setSentence(example);
              void read(example);
            }}
            className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] text-slate-400 transition hover:bg-white/[0.09] hover:text-white"
          >
            {example}
          </button>
        ))}
      </div>

      {error ? <p className="mt-2 text-[10px] text-rose-200">{error}</p> : null}

      <AnimatePresence>
        {plan ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 rounded-2xl border border-violet-400/25 bg-violet-400/[0.07] p-3">
            <ul className="grid gap-1.5 text-[10.5px] text-slate-200 sm:grid-cols-2">
              <li>
                <b className="text-slate-400">مسیر: </b>
                {plan.origin} → {plan.destination}
              </li>
              <li>
                <b className="text-slate-400">مدت: </b>
                {fa.format(plan.days)} روز
              </li>
              <li>
                <b className="text-slate-400">مسافران: </b>
                {fa.format(plan.travelers)} نفر{plan.children ? ` + ${fa.format(plan.children)} کودک` : ""}
              </li>
              <li>
                <b className="text-slate-400">بودجهٔ کل: </b>
                {fa.format(plan.budgetMillions)} میلیون تومان
              </li>
            </ul>
            <p className="mt-2 text-[10px] leading-6 text-slate-300">{plan.reason}</p>
            {plan.assumed.length ? (
              <p className="mt-1 text-[9px] leading-5 text-amber-200/85">{plan.assumed.join(" ")} اینها را هر وقت خواستی عوض کن.</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={apply}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-violet-400"
              >
                <ArrowLeft className="h-3 w-3" />
                بزن بریم، سفر را پر کن
              </button>
              <span className="text-[8.5px] text-slate-400">
                {plan.source === "ai" ? "مقصد را هوش مصنوعی از میان شهرهای واقعی انتخاب کرد" : "مقصد از سلیقهٔ جملهٔ خودت انتخاب شد"}
                {note ? ` · ${note}` : ""}
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
