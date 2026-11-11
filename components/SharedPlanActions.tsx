"use client";

import { useState } from "react";
import { Check, Link2, Printer } from "lucide-react";

/** Small, honest actions for a shared plan: copy the address or print it. */
export default function SharedPlanActions() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2 text-[11px] font-black text-slate-950 transition hover:bg-cyan-400"
      >
        <Printer className="h-3.5 w-3.5" />
        ذخیرهٔ PDF
      </button>
      <button
        type="button"
        onClick={() => void copy()}
        className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[11px] font-bold text-slate-200 transition hover:bg-white/10"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? "کپی شد" : "کپی لینک"}
      </button>
    </div>
  );
}
