"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Info } from "lucide-react";

type Props = {
  /** What is chosen so far, e.g. «قطار رجا · ۸:۴۰ · ۱٬۲۰۰٬۰۰۰ تومان». */
  summary: string;
  /** A one-line explanation of the next step. */
  hint?: string;
  href: string;
  ctaLabel: string;
  /** When false the button is shown but cannot be pressed, with `blockedNote`. */
  ready?: boolean;
  blockedNote?: string;
  /** Optional secondary action, e.g. «بدون اقامتگاه ادامه بده». */
  secondary?: { label: string; onClick: () => void };
};

/**
 * The way forward, always in reach.
 *
 * Ticket and room lists can be long, and asking a traveller to scroll to the
 * very bottom of a hundred results to find «ادامه» is how people get stuck.
 * This bar stays at the bottom of the screen on every step of the flow: it says
 * what has been chosen and takes the traveller to the next step from anywhere
 * on the page.
 */
export default function NextStepBar({ summary, hint, href, ctaLabel, ready = true, blockedNote, secondary }: Props) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 print:hidden"
    >
      <div className="pointer-events-auto mx-auto w-full max-w-6xl px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] sm:px-5">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-cyan-400/25 bg-night-950/90 px-3 py-2.5 shadow-[0_-12px_40px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:gap-3 sm:px-4">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <Check className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <b className="block truncate text-[11px] font-black text-white sm:text-xs">{summary}</b>
              <span className="mt-0.5 flex items-center gap-1 text-[9.5px] leading-4 text-slate-400">
                <Info className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{ready ? hint || "مرحلهٔ بعد آماده است." : blockedNote || "برای ادامه یک گزینه را انتخاب کن."}</span>
              </span>
            </span>
          </span>

          {secondary ? (
            <button
              type="button"
              onClick={secondary.onClick}
              className="order-3 shrink-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-bold text-slate-200 transition hover:bg-white/10 sm:order-2"
            >
              {secondary.label}
            </button>
          ) : null}

          {ready ? (
            <Link
              href={href}
              className="order-2 inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-l from-cyan-400 via-sky-500 to-teal-500 px-3.5 py-2 text-[11px] font-extrabold text-white shadow-glow transition hover:brightness-110 sm:order-3 sm:px-5 sm:py-2.5 sm:text-xs"
            >
              {ctaLabel}
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="order-2 inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-[11px] font-extrabold text-slate-500 sm:order-3 sm:px-5 sm:py-2.5 sm:text-xs"
            >
              {ctaLabel}
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
