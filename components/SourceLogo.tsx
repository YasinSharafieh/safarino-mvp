"use client";

/**
 * «نشان منبع» — the real brand mark of the site a price came from.
 *
 * Every price on Safarino belongs to somebody: علی‌بابا, سفر۷۲۴, جاباما,
 * جاجیگا, اتاقک, اسنپ‌تریپ, اقامت۲۴. A letter in a coloured circle (the old
 * badge) told the traveller nothing; the real mark lets them recognise the
 * source at a glance, which is the whole point of multi-provider search.
 *
 * The images live in `/public/providers` — self-hosted, so they load on a slow
 * Iranian connection and inside the sandboxed preview, with no dependency on a
 * CDN that may be blocked. If an image is ever missing the component degrades to
 * the site's own initial rather than showing a broken picture.
 */

const SOURCE_LOGOS: Record<string, { src: string; label: string }> = {
  alibaba: { src: "/providers/alibaba.png", label: "علی‌بابا" },
  safar724: { src: "/providers/safar724.png", label: "سفر۷۲۴" },
  jabama: { src: "/providers/jabama.png", label: "جاباما" },
  jajiga: { src: "/providers/jajiga.png", label: "جاجیگا" },
  otaghak: { src: "/providers/otaghak.png", label: "اتاقک" },
  snapptrip: { src: "/providers/snapptrip.png", label: "اسنپ‌تریپ" },
  eghamat24: { src: "/providers/eghamat24.png", label: "اقامت۲۴" },
};

export function sourceLogo(id: string | null | undefined) {
  return (id && SOURCE_LOGOS[id]) || null;
}

export default function SourceLogo({
  id,
  size = 20,
  className = "",
  rounded = false,
}: {
  id: string | null | undefined;
  /** Pixel size of the square tile. */
  size?: number;
  className?: string;
  /** A rounded tile (for list rows) instead of a bare mark. */
  rounded?: boolean;
}) {
  const logo = sourceLogo(id);
  if (!logo) return null;
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden bg-white ${
        rounded ? "rounded-md ring-1 ring-black/10" : ""
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Every logo is a local asset, so a plain img is both safe and cheapest. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.src}
        alt={`نشان ${logo.label}`}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    </span>
  );
}
