"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowLeft, LoaderCircle, Mic, MicOff, Sparkles } from "lucide-react";
import type { BudgetGauge as Gauge } from "@/lib/budget-gauge";

/**
 * «کیلومترشمار بودجه» — the same numbers as the list underneath, drawn as a dial.
 *
 * The needle is not decoration: it is `usedPct` from the shared budget estimate,
 * so the dial, the remaining amount and the verdict can never disagree.
 */
export default function BudgetGauge({
  gauge,
  title = "کیلومترشمار بودجه",
  compact = false,
}: {
  gauge: Gauge;
  title?: string;
  compact?: boolean;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 60);
    return () => window.clearTimeout(timer);
  }, []);

  const target = ready ? gauge.needlePct : 0;
  const angle = -90 + Math.max(0, Math.min(100, target)) * 1.8;
  const zoneColor = gauge.zone === "over" ? "#fb7185" : gauge.zone === "watch" ? "#fbbf24" : "#34d399";
  const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));

  return (
    <div className={`glass ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between gap-2">
        <b className="flex items-center gap-1.5 text-[11px] font-black text-white">
          <Activity className="h-3.5 w-3.5 text-cyan-300" />
          {title}
        </b>
        <span
          className={`rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${
            gauge.zone === "over"
              ? "border-rose-400/40 bg-rose-400/15 text-rose-200"
              : gauge.zone === "watch"
                ? "border-amber-400/40 bg-amber-400/15 text-amber-100"
                : "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
          }`}
        >
          {gauge.zoneLabel} · {fa(gauge.usedPct)}٪
        </span>
      </div>

      <div className="mt-1 flex items-center gap-3">
        <svg viewBox="0 0 240 140" className="h-[86px] w-[152px] shrink-0" role="img" aria-label={`${gauge.zoneLabel}، ${fa(gauge.usedPct)} درصد بودجه مصرف شده`}>
          <defs>
            <linearGradient id="gauge-fade" x1="0" x2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          {/* Track */}
          <path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="14" strokeLinecap="round" />
          {/* Zones: calm / watch / over — the same breakpoints the gauge uses */}
          <path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke="#34d399" strokeOpacity="0.35" strokeWidth="14" strokeLinecap="butt" pathLength={100} strokeDasharray="60 40" />
          <path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke="#fbbf24" strokeOpacity="0.4" strokeWidth="14" strokeLinecap="butt" pathLength={100} strokeDasharray="25 75" strokeDashoffset={-60} />
          <path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke="#fb7185" strokeOpacity="0.45" strokeWidth="14" strokeLinecap="butt" pathLength={100} strokeDasharray="15 85" strokeDashoffset={-85} />
          {/* Fill */}
          <path
            d="M 30 120 A 90 90 0 0 1 210 120"
            fill="none"
            stroke="url(#gauge-fade)"
            strokeWidth="6"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${Math.max(0, Math.min(100, gauge.needlePct))} 100`}
            style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)" }}
          />
          {/* Needle */}
          <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "120px 120px", transition: "transform 900ms cubic-bezier(0.22,1,0.36,1)" }}>
            <line x1="120" y1="120" x2="120" y2="45" stroke={zoneColor} strokeWidth="4" strokeLinecap="round" />
            <circle cx="120" cy="45" r="5" fill={zoneColor} />
          </g>
          <circle cx="120" cy="120" r="9" fill="#0b0718" stroke={zoneColor} strokeWidth="3" />
          <text x="30" y="136" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9">۰٪</text>
          <text x="210" y="136" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9">۱۰۰٪</text>
        </svg>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] leading-6 text-slate-300">{gauge.verdict}</p>
          <p className="mt-1 text-[10px] leading-6 text-cyan-100/90">{gauge.hint}</p>
          {!compact ? (
            <p className="mt-1 text-[9px] leading-5 text-slate-500">
              بودجهٔ کل {fa(gauge.totalToman)} تومان · بلیت و اقامت {fa(gauge.committedToman)} تومان · پول غذا {fa(gauge.foodToman)} تومان
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The same gauge, as one compact pill for tight corners. */
export function GaugePill({ gauge }: { gauge: Gauge }) {
  // Written out in full: Tailwind only ships classes it can see in the source.
  const style =
    gauge.zone === "over"
      ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
      : gauge.zone === "watch"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {gauge.zoneLabel}
    </span>
  );
}

/** A tiny, honest «how sure are we» line used under AI panels. */
export function AiBadge({ source, label }: { source: "ai" | "local" | null; label?: string }) {
  if (!source) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/25 bg-violet-400/10 px-2 py-0.5 text-[9px] font-bold text-violet-200">
      {source === "ai" ? <Sparkles className="h-2.5 w-2.5" /> : <Mic className="h-2.5 w-2.5" />}
      {label || (source === "ai" ? "نوشتهٔ هوش مصنوعی" : "محاسبهٔ خود سفرینو")}
    </span>
  );
}

/** The spinner used by every AI action in this round. */
export function AiSpinner({ text }: { text: string }) {
  return (
    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1.5 text-[10px] text-cyan-100">
      <LoaderCircle className="h-3 w-3 animate-spin" />
      {text}
    </motion.span>
  );
}

/** «قدم بعدی» — one clear button at the end of an AI panel. */
export function NextArrow({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-200 hover:text-cyan-100">
      {label}
      <ArrowLeft className="h-3 w-3" />
    </a>
  );
}

export { MicOff };

