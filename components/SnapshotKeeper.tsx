"use client";

import { useEffect } from "react";

const LAST_PING_KEY = "safarino-warm-ping-v1";
const ONE_HOUR = 60 * 60 * 1000;

/**
 * Keeps the saved provider answers warm with no scheduler and no credentials.
 *
 * At most once an hour, one visitor's browser quietly asks the server to
 * refresh the most requested cities. Nothing personal is sent, the request is
 * dropped if the browser blocks it, and the server itself refuses to run more
 * than once per hour.
 */
export default function SnapshotKeeper() {
  useEffect(() => {
    let last = 0;
    try {
      last = Number(window.localStorage.getItem(LAST_PING_KEY) || 0);
    } catch {
      return;
    }
    if (Date.now() - last < ONE_HOUR) return;
    try {
      window.localStorage.setItem(LAST_PING_KEY, String(Date.now()));
    } catch {
      /* private mode: simply skip the warm-up */
    }
    const timer = window.setTimeout(() => {
      fetch("/api/cron/refresh", { method: "POST", keepalive: true }).catch(() => {});
    }, 4_000);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
