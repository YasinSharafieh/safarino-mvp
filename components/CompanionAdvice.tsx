"use client";

/**
 * «همسفر پیشنهاد می‌دهد» — the corner assistant actually advising, in the flow.
 *
 * It looks at the options that are really on the page and at the trip's own
 * money, then suggests *one* of them with a reason. The model makes the choice
 * (a cheaper option for a tight budget, a roomier one when the budget allows),
 * the page only shows it — and the traveller can take it with one tap.
 *
 * Nothing is recommended that is not on the list, and no number in the reason
 * can be one the trip does not have.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LoaderCircle, Sparkles, Wand2 } from "lucide-react";
import { useTravel } from "@/app/context/TravelContext";
import { tripCostBreakdown } from "@/lib/trip-costs";

export type AdviceOptionInput = { id: string; title: string; priceToman: number; detail?: string };

type Advice = {
  optionId: string | null;
  reason: string;
  tone: "fits" | "tight" | "over";
  source: "local" | "ai";
  headline: string;
};

export default function CompanionAdvice({
  stage,
  options,
  onPick,
  ticketToman = 0,
  stayToman = 0,
  className = "",
}: {
  stage: "transport" | "accommodation";
  options: AdviceOptionInput[];
  onPick?: (optionId: string) => void;
  ticketToman?: number;
  stayToman?: number;
  className?: string;
}) {
  const { travelData, isHydrated } = useTravel();
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  const travellers = Math.max(
    1,
    Number(travelData.travelers || 1) + Number(travelData.children || 0) + Number(travelData.infants || 0),
  );
  const days = Math.max(1, Number(travelData.days) || 1);

  // A stable signature of the list: the advice is refreshed only when the real
  // options or the money change, never on every render.
  const signature = useMemo(
    () => options.slice(0, 14).map((option) => `${option.id}:${option.priceToman}`).join(","),
    [options],
  );

  useEffect(() => {
    if (!isHydrated || !signature || !travelData.destination) return;
    const costs = tripCostBreakdown({
      totalBudget: Math.round((Number(travelData.budget) || 0) * 1_000_000),
      travellers,
      days,
      nights: Math.max(1, days - 1),
      city: travelData.destination,
      tickets: ticketToman,
      stay: stayToman,
    });
    const controller = new AbortController();
    setLoading(true);
    setNote("");
    fetch("/api/companion/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        facts: {
          stage,
          origin: travelData.origin,
          destination: travelData.destination,
          days,
          travellers,
          children: Number(travelData.children) || 0,
          budgetToman: costs.totalBudget,
          committedToman: stage === "transport" ? 0 : costs.tickets,
          dailyToman: costs.food + costs.activities + costs.localTransport,
          departureDate: travelData.departureDate || null,
          tastes: travelData.tasteMoods || [],
        },
        options: options.slice(0, 14),
      }),
    })
      .then((response) => response.json())
      .then((payload: { success?: boolean; advice?: Advice; note?: string }) => {
        if (payload?.success && payload.advice) {
          setAdvice(payload.advice);
          setNote(payload.note || "");
        }
      })
      .catch(() => {
        // Silence is fine: the page's own budget bar already speaks.
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // `signature` already stands for the option list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, signature, travelData.budget, travelData.destination, travelData.origin, stayToman, ticketToman, stage, days, travellers]);

  if (!isHydrated || (!loading && !advice)) return null;

  const toneRing =
    advice?.tone === "over"
      ? "border-rose-400/30 bg-rose-400/[0.07]"
      : advice?.tone === "tight"
        ? "border-amber-300/25 bg-amber-300/[0.06]"
        : "border-violet-300/25 bg-violet-400/[0.07]";

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-3 ${toneRing} ${className}`}
      aria-label="پیشنهاد همسفر سفرینو"
    >
      <div className="flex items-start gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-cyan-400 text-slate-950">
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <b className="block text-[11px] font-black text-white">
            {loading && !advice ? "همسفر دارد گزینه‌ها را با بودجه‌ات می‌سنجد…" : advice?.headline}
          </b>
          {advice ? <p className="mt-1 text-[10px] leading-6 text-slate-200">{advice.reason}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {advice?.optionId && onPick ? (
              <button
                type="button"
                onClick={() => onPick(advice.optionId as string)}
                className="inline-flex items-center gap-1 rounded-lg bg-violet-500 px-2.5 py-1.5 text-[9.5px] font-black text-white transition hover:bg-violet-400"
              >
                <Wand2 className="h-3 w-3" />
                همین را انتخاب کن
              </button>
            ) : null}
            <span className="text-[8.5px] text-slate-400">
              {advice?.source === "ai"
                ? "انتخاب با هوش مصنوعی، از میان همین گزینه‌های واقعی"
                : "انتخاب از حساب‌های خود سفر تو"}
              {note ? ` · ${note}` : ""}
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
