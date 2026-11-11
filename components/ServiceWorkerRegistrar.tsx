"use client";

import { useEffect } from "react";

/**
 * Registers the offline worker once for the whole site, so every page the
 * traveller opens is kept on the device and can open again with no network.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support is a bonus; the site works without it */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
