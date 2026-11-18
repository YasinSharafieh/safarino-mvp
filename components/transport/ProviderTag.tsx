"use client";

/**
 * «بلیت از» — which site this ticket came from, in the row itself.
 *
 * The transport list printed a small circled letter («ع», «۲۴»,…) next to the
 * provider name. Nobody recognises a letter; travellers do recognise the mark of
 * the site they are about to open and pay on. This strip shows the real logo of
 * the source (self-hosted in `/public/providers`, so no CDN can be blocked), and
 * for the same ticket also available elsewhere it names the other sites with
 * their own marks — a choice the traveller can compare at a glance.
 */

import SourceLogo, { sourceLogo } from "../SourceLogo";

const FALLBACK_LABELS: Record<string, string> = {
  alibaba: "علی‌بابا",
  safar724: "سفر۷۲۴",
};

export default function ProviderTag({
  provider,
  label,
  size = 14,
  tone = "quiet",
}: {
  provider?: string | null;
  label?: string | null;
  size?: number;
  tone?: "quiet" | "solid";
}) {
  if (!provider) return null;
  const logo = sourceLogo(provider);
  const name = label || FALLBACK_LABELS[provider] || logo?.label || provider;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border py-0.5 pl-1.5 pr-0.5 text-[8.5px] font-bold ${
        tone === "solid" ? "border-white/15 bg-white/10 text-white" : "border-white/10 bg-white/5 text-slate-300"
      }`}
      title={`منبع این بلیت: ${name}`}
    >
      <SourceLogo id={provider} size={size} rounded />
      {name}
    </span>
  );
}

/** «همین بلیت در …» — every other site that sells this row, each with its mark. */
export function AlsoAvailable({
  items,
  money,
}: {
  items: Array<{ provider: string; providerLabel: string; bookingUrl: string; priceToman: number }>;
  money: (value: number) => string;
}) {
  if (!items?.length) return null;
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[9.5px] leading-5 text-slate-400">
      همچنین در:
      {items.map((alternate, index) => (
        <a
          key={`${alternate.provider}-${index}`}
          href={alternate.bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] py-0.5 pl-1.5 pr-0.5 font-bold text-cyan-100 underline decoration-cyan-400/30 underline-offset-4 hover:bg-cyan-400/15"
          title={`همین بلیت در ${alternate.providerLabel} — ${money(alternate.priceToman)}`}
        >
          <SourceLogo id={alternate.provider} size={12} rounded />
          {alternate.providerLabel}
          <span className="font-black text-cyan-200">({money(alternate.priceToman)})</span>
        </a>
      ))}
    </span>
  );
}
