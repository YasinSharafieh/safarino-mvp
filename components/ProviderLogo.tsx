"use client";

import { useEffect, useState } from "react";
import { Bus, Plane, TrainFront } from "lucide-react";

/**
 * The operator's real mark — airline, rail company or bus cooperative.
 *
 * The live searches return the operator's own logo URL on علی‌بابا's CDN. Two
 * things matter for a traveller on an Iranian connection: the picture must
 * appear immediately, and it must still appear when the CDN is slow or the
 * browser cannot reach it. So the same marks are also shipped inside the app
 * (`/public/airlines`, `/public/rail`, `/public/bus`): the component tries the
 * local copy first, falls back to the signed proxy route, and only then to a
 * neutral icon — never a broken image.
 */

/** cdn.alibaba.ir/static/img/airlines/Domestic/IR.png → /airlines/IR.png, etc. */
function localCopy(src: string): string | null {
  let path = "";
  try {
    const url = new URL(src);
    if (url.hostname !== "cdn.alibaba.ir") return null;
    path = url.pathname;
  } catch {
    return null;
  }
  const airline = /^\/static\/img\/airlines\/[^/]+\/([\w-]+)\.png$/i.exec(path);
  if (airline) return `/airlines/${airline[1]}.png`;
  const train = /^\/static\/img\/train\/([\w.-]+)$/i.exec(path);
  if (train) return `/rail/${train[1]}`;
  const bus = /^\/static\/img\/bus\/([\w.-]+)$/i.exec(path);
  if (bus) return `/bus/${bus[1]}`;
  return null;
}

export default function ProviderLogo({ src, name, mode }: { src?: string | null; name: string; mode: "plane" | "train" | "bus" }) {
  const local = src ? localCopy(src) : null;
  const proxied = src ? `/api/provider-assets?src=${encodeURIComponent(src)}` : null;
  /** Which address is being tried right now: the shipped copy, then the proxy. */
  const [attempt, setAttempt] = useState<"local" | "proxy">(local ? "local" : "proxy");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAttempt(local ? "local" : "proxy");
    setLoaded(false);
  }, [local, src]);

  const address = attempt === "local" ? local : proxied;
  const Icon = mode === "plane" ? Plane : mode === "train" ? TrainFront : Bus;

  return (
    <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white p-1.5">
      {address && (
        // Local copies are first-party files; the proxy normalises and restricts
        // any remote URL to a known provider CDN on the server.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={address}
          src={address}
          alt={`نشان ${name}`}
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            // A mark we do not ship yet still gets its CDN copy before giving up.
            if (attempt === "local" && proxied) setAttempt("proxy");
            else setLoaded(false);
          }}
          className={`h-full w-full object-contain transition-opacity ${loaded ? "opacity-100" : "absolute opacity-0"}`}
        />
      )}
      {!loaded && <Icon className="h-6 w-6 text-slate-700" aria-hidden="true" />}
    </span>
  );
}
