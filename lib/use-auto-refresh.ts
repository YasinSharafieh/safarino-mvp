"use client";

/**
 * «خودش تازه شود» — refresh an ageing list when the traveller comes back.
 *
 * A traveller opens the ticket list, gets a phone call, and returns twenty
 * minutes later to a price that may already be gone. Asking them to notice a
 * small timestamp is not a design. This hook watches the two moments that mean
 * "the traveller is looking again" — the tab becoming visible, and the window
 * regaining focus — and calls the panel's own search when the answer has aged
 * past its comfortable window.
 *
 * It is deliberately conservative:
 *  - it never runs while a search is already in flight;
 *  - it waits a moment after focus, so a quick alt-tab does not cost a crawl;
 *  - it refreshes at most once per `minIntervalMs`, so flicking between tabs
 *    cannot hammer a provider;
 *  - it is silent on failure — a failed background refresh must not replace a
 *    good list with an error.
 */

import { useEffect, useRef } from "react";

export function useAutoRefreshOnReturn(options: {
  /** True when the current answer is older than its comfortable window. */
  shouldRefresh: boolean;
  /** True while a search is running — never start a second one. */
  busy: boolean;
  /** The traveller's own search. Must be stable (a `useCallback`). */
  refresh: () => void;
  /** Shortest gap between two automatic refreshes. Default 3 minutes. */
  minIntervalMs?: number;
}) {
  const { shouldRefresh, busy, refresh, minIntervalMs = 180_000 } = options;
  const lastRun = useRef(0);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!shouldRefresh || busy) return;
    const run = () => {
      if (document.visibilityState === "hidden") return;
      if (busy) return;
      const now = Date.now();
      if (now - lastRun.current < minIntervalMs) return;
      lastRun.current = now;
      refreshRef.current();
    };
    let timer = 0;
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // A moment of grace: if the traveller is only passing through, no crawl.
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 1_200);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [busy, minIntervalMs, shouldRefresh]);
}
