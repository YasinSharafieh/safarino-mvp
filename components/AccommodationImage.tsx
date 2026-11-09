"use client";

import { useEffect, useState } from "react";
import { Hotel } from "lucide-react";

export default function AccommodationImage({ src, alt }: { src: string | null; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);
  const proxiedSource = src ? `/api/provider-assets?src=${encodeURIComponent(src)}` : null;

  return (
    <span className="absolute inset-0 block overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#164e63,#0f2939_65%)]">
      {proxiedSource && !failed && (
        // The server only proxies allowlisted Alibaba/Jabama image paths.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxiedSource}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover transition duration-700 group-hover:scale-105 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {(!loaded || failed) && (
        <span className="absolute inset-0 grid place-items-center text-cyan-300/60" aria-hidden={!failed && Boolean(proxiedSource)}>
          <Hotel className="h-14 w-14" />
          <span className="sr-only">{failed || !proxiedSource ? `تصویر ${alt} در دسترس نیست` : "در حال بارگذاری تصویر"}</span>
        </span>
      )}
    </span>
  );
}
