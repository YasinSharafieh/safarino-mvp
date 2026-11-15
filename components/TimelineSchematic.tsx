"use client";

import type { LucideIcon } from "lucide-react";
import { BedDouble, Camera, MapPin, TrainFront, Utensils } from "lucide-react";
import { motion } from "framer-motion";

export type SchematicStep = {
  /** A real clock value («۱۲:۴۰») or a dash when the source did not give one. */
  time: string;
  title: string;
  note?: string;
  kind: "arrive" | "hotel" | "visit" | "food" | "other";
};

const KIND: Record<SchematicStep["kind"], { icon: LucideIcon; tone: string; label: string }> = {
  arrive: { icon: TrainFront, tone: "border-cyan-400/40 bg-cyan-400/15 text-cyan-200", label: "رسیدن" },
  hotel: { icon: BedDouble, tone: "border-teal-400/40 bg-teal-400/15 text-teal-200", label: "اقامتگاه" },
  visit: { icon: Camera, tone: "border-sky-400/40 bg-sky-400/15 text-sky-200", label: "بازدید" },
  food: { icon: Utensils, tone: "border-amber-300/40 bg-amber-300/15 text-amber-200", label: "غذا" },
  other: { icon: MapPin, tone: "border-white/15 bg-white/5 text-slate-300", label: "برنامه" },
};

/**
 * The day as a simple diagram: when you arrive, when you hand over your bags,
 * and from what hour each visit starts. Every time comes from the traveller's
 * own ticket or from the generated plan — nothing is guessed to look neat.
 */
export default function TimelineSchematic({ steps, title }: { steps: SchematicStep[]; title?: string }) {
  if (!steps.length) return null;
  return (
    <div className="mt-4">
      {title ? <p className="mb-2 text-[10.5px] font-bold text-slate-400">{title}</p> : null}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {steps.map((step, index) => {
          const style = KIND[step.kind] ?? KIND.other;
          const Icon = style.icon;
          return (
            <motion.div
              key={`${step.time}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.04 }}
              className="flex min-w-[9.5rem] flex-1 items-stretch gap-2"
            >
              <div className={`flex w-full flex-col items-center gap-1.5 rounded-2xl border p-3 text-center ${style.tone}`}>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950/40">
                  <Icon className="h-4 w-4" />
                </span>
                <b className="text-[12px] font-black text-white">{step.time}</b>
                <span className="text-[10px] font-bold leading-5">{step.title}</span>
                {step.note ? <span className="text-[9px] leading-4 text-slate-400">{step.note}</span> : null}
              </div>
              {index < steps.length - 1 ? (
                <span className="mt-8 h-px w-3 shrink-0 self-start bg-gradient-to-l from-white/30 to-transparent" />
              ) : null}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
