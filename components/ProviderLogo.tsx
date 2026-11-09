"use client";

import { useEffect, useState } from "react";
import { Bus, Plane, TrainFront } from "lucide-react";

export default function ProviderLogo({ src, name, mode }: { src?: string | null; name: string; mode: "plane" | "train" | "bus" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const Icon = mode === "plane" ? Plane : mode === "train" ? TrainFront : Bus;

  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white p-1.5">
      {src && !failed ? (
        // Provider CDN URLs are normalized and restricted to cdn.alibaba.ir on the server.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`لوگوی ${name}`} width={48} height={48} onError={() => setFailed(true)} className="h-full w-full object-contain" />
      ) : (
        <Icon className="h-6 w-6 text-slate-700" />
      )}
    </span>
  );
}
