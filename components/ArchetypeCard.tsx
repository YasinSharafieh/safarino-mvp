"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass, LoaderCircle, Sparkles } from "lucide-react";
import { readArchetype, type Archetype } from "@/lib/archetype";

/**
 * «تیپ سفرت» — one card, computed from the trip's own numbers.
 *
 * The label and the reasons are calculated in the browser instantly (so the card
 * is never empty), and the two friendly sentences come from `/api/archetype`
 * when the model is available. The card says which of the two it is showing.
 */
export default function ArchetypeCard({
  moods,
  budgetMillions,
  people,
  days,
  children,
  mode,
  compact = false,
}: {
  moods: string[];
  budgetMillions: number;
  people: number;
  days: number;
  children?: number;
  mode?: string;
  compact?: boolean;
}) {
  const local = readArchetype({ moods, budgetMillions, people, days, children, mode });
  const [archetype, setArchetype] = useState<Archetype>(local);
  const [note, setNote] = useState("");
  const [source, setSource] = useState<"ai" | "local" | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setArchetype(local);
    // The same trip always produces the same type; this only re-reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moods.join(","), budgetMillions, people, days, children, mode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/archetype", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({ moods: moods.slice(0, 3), budgetMillions, people, days, children: children || 0, mode: mode || "" }),
    })
      .then((response) => response.json())
      .then((payload: { success?: boolean; archetype?: Archetype; note?: string; source?: "ai" | "local" }) => {
        if (cancelled || !payload?.success) return;
        if (payload.archetype) setArchetype(payload.archetype);
        if (payload.note) setNote(payload.note);
        setSource(payload.source || "local");
      })
      .catch(() => {
        // The local card already says everything the numbers say.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moods.join(","), budgetMillions, people, days, children, mode]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass relative overflow-hidden p-4 sm:p-5"
    >
      <span className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 via-fuchsia-400 to-violet-500 text-xl shadow-glow">
            <span aria-hidden>{archetype.emoji}</span>
          </span>
          <div>
            <span className="text-[9px] font-bold tracking-wide text-fuchsia-200/80">تیپ سفر تو</span>
            <b className="block text-base font-black text-white">{archetype.name}</b>
            <span className="text-[9.5px] text-slate-400">
              {archetype.bandLabel} · آهنگ سفر: {archetype.pace}
            </span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-400/10 px-2 py-0.5 text-[8.5px] font-bold text-violet-200">
          {loading ? <LoaderCircle className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
          {loading ? "در حال نوشتن…" : source === "ai" ? "توضیح با هوش مصنوعی" : "محاسبهٔ خود سفرینو"}
        </span>
      </div>

      <p className="relative mt-3 text-[11px] leading-7 text-slate-200">{note || archetype.tagline}</p>

      {!compact ? (
        <div className="relative mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <b className="flex items-center gap-1 text-[9.5px] font-black text-cyan-200">
              <Compass className="h-3 w-3" />
              از کجا این را فهمیدیم
            </b>
            <ul className="mt-1 space-y-1">
              {archetype.why.map((line) => (
                <li key={line} className="flex gap-1 text-[9.5px] leading-6 text-slate-300">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
            <b className="text-[9.5px] font-black text-amber-200">برای همین سفر</b>
            <ul className="mt-1 space-y-1">
              {archetype.tips.map((line) => (
                <li key={line} className="flex gap-1 text-[9.5px] leading-6 text-slate-300">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-300" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {archetype.runnerUp ? (
        <p className="relative mt-2 text-[9px] text-slate-500">
          نزدیک‌ترین تیپ دیگر: {archetype.runnerUp.emoji} {archetype.runnerUp.name} — سلیقه‌ها همیشه یک‌دست نیستند.
        </p>
      ) : null}
    </motion.div>
  );
}
