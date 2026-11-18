import type { AccommodationProvider } from "@/lib/accommodation-types";
import { PROVIDER_LABELS } from "@/lib/accommodation-types";
import SourceLogo, { sourceLogo } from "./SourceLogo";

/**
 * The badge that sits on every room and every hotel: the source's real mark and
 * the source's own name. It used to draw a letter in a tinted circle, which a
 * traveller cannot connect to any site they know; the real logo can be read at
 * 16 pixels on a phone.
 */
export function ProviderMark({ provider, className = "h-5 w-5 rounded-md" }: { provider: AccommodationProvider; className?: string }) {
  const logo = sourceLogo(provider);
  // Every provider we read prices from has a real mark in /public/providers; the
  // letter below only exists so an unknown future provider never renders a
  // broken image. It was the old badge for all six — that is what changed.
  if (logo) return <SourceLogo id={provider} size={18} rounded className={className} />;
  const initial = (PROVIDER_LABELS[provider] || "منبع").trim().charAt(0);
  return (
    <svg viewBox="0 0 28 28" role="img" aria-label={`نشان ${PROVIDER_LABELS[provider] || "منبع"}`} className={`${className} shrink-0`}>
      <rect x="1" y="1" width="26" height="26" rx="8" fill="#f8fafc" stroke="#cbd5e1" />
      <text x="14" y="14" textAnchor="middle" dominantBaseline="central" fill="#334155" fontSize="13" fontWeight="900" fontFamily="Tahoma, Arial, sans-serif">{initial}</text>
    </svg>
  );
}

export default function ProviderBadge({
  provider,
  inverse = false,
  className = "",
}: {
  provider: AccommodationProvider;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-extrabold leading-none ${
        inverse ? "border-white/20 bg-night-950/75 text-white backdrop-blur-md" : "border-white/10 bg-white/[0.055] text-slate-300"
      } ${className}`}
    >
      <ProviderMark provider={provider} />
      <span>{PROVIDER_LABELS[provider] || "منبع"}</span>
    </span>
  );
}
