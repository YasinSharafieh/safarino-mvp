"use client";

import { useEffect, useState } from "react";
import { Check, DownloadCloud } from "lucide-react";

/**
 * Registers the offline worker and lets the traveller keep this page (with its
 * pictures) on the device before a trip. It says plainly what was saved.
 */
export default function OfflineKeeper({ warmUrls = [] }: { warmUrls?: string[] }) {
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      setSupported(false);
      return;
    }
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (cancelled) return;
        if (registration.active || registration.waiting) setReady(true);
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "activated" && !cancelled) setReady(true);
          });
        });
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });
    const onController = () => setReady(true);
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onController);
    };
  }, []);

  const keepPage = async () => {
    if (!("serviceWorker" in navigator)) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const worker = registration?.active || registration?.waiting || registration?.installing;
      const urls = [window.location.pathname, ...warmUrls];
      if (worker) worker.postMessage({ type: "warm", urls });
      // The current page is also kept by the worker as soon as it is reloaded;
      // asking the browser for the pictures makes them available offline too.
      await Promise.all(
        warmUrls.map((url) =>
          fetch(url, { mode: "no-cors", cache: "force-cache" }).catch(() => null),
        ),
      );
      setSaved(true);
      window.setTimeout(() => setSaved(false), 4000);
    } catch {
      setSaved(false);
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-2.5">
      <p className="min-w-0 flex-1 text-[9.5px] leading-5 text-sky-100">
        {ready
          ? "نسخهٔ آفلاین آماده است: صفحه‌هایی که باز کرده‌اید و عکس‌هایشان روی همین دستگاه می‌مانند و بدون اینترنت هم باز می‌شوند."
          : "این صفحه برای حالت آفلاین آماده می‌شود…"}
        {" "}
        جست‌وجوی زنده و قیمت‌ها آفلاین کار نمی‌کنند.
      </p>
      <button
        type="button"
        onClick={() => void keepPage()}
        disabled={busy}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/15 px-2.5 py-1.5 text-[9.5px] font-extrabold text-sky-100 transition hover:bg-sky-400/25 disabled:opacity-50"
      >
        {saved ? <Check className="h-3 w-3 text-emerald-300" /> : <DownloadCloud className="h-3 w-3" />}
        {saved ? "ذخیره شد" : "ذخیره برای آفلاین"}
      </button>
    </div>
  );
}
