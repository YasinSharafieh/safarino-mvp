import type { AccommodationProvider } from "@/lib/accommodation-types";
import { PROVIDER_LABELS } from "@/lib/accommodation-types";

const BRANDS: Record<AccommodationProvider, { mark: string; background: string; foreground: string; border: string }> = {
  alibaba: { mark: "ع", background: "#fff7ed", foreground: "#c2410c", border: "#fdba74" },
  jajiga: { mark: "ج", background: "#ecfdf5", foreground: "#047857", border: "#6ee7b7" },
  jabama: { mark: "جا", background: "#f5f3ff", foreground: "#6d28d9", border: "#c4b5fd" },
  snapptrip: { mark: "S", background: "#eff6ff", foreground: "#0369a1", border: "#7dd3fc" },
  otaghak: { mark: "ا", background: "#eef2ff", foreground: "#4338ca", border: "#a5b4fc" },
  eghamat24: { mark: "۲۴", background: "#fffbeb", foreground: "#b45309", border: "#fcd34d" },
};

export function ProviderMark({ provider, className = "h-5 w-5" }: { provider: AccommodationProvider; className?: string }) {
  const brand = BRANDS[provider] || { mark: "؟", background: "#f8fafc", foreground: "#334155", border: "#cbd5e1" };
  return (
    <svg viewBox="0 0 28 28" role="img" aria-label={`نشان ${PROVIDER_LABELS[provider] || "منبع"}`} className={`${className} shrink-0`}>
      <rect x="1" y="1" width="26" height="26" rx="8" fill={brand.background} stroke={brand.border} />
      <text x="14" y="14" textAnchor="middle" dominantBaseline="central" fill={brand.foreground} fontSize={brand.mark.length > 1 ? "10" : "14"} fontWeight="900" fontFamily="Tahoma, Arial, sans-serif">{brand.mark}</text>
    </svg>
  );
}

export default function ProviderBadge({ provider, inverse = false, className = "" }: { provider: AccommodationProvider; inverse?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-extrabold leading-none ${inverse ? "border-white/20 bg-night-950/75 text-white backdrop-blur-md" : "border-white/10 bg-white/[0.055] text-slate-300"} ${className}`}>
      <ProviderMark provider={provider} className="h-4 w-4" />
      <span>{PROVIDER_LABELS[provider] || "منبع"}</span>
    </span>
  );
}
