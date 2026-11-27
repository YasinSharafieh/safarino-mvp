"use client";

/**
 * The browser half of `lib/trip-session.ts`.
 *
 * It reads two things a page can actually observe — how this document was
 * loaded, and whether the traveller has already moved inside the site without a
 * full load — and hands them to the pure decision function. Nothing here decides
 * anything by itself, so the rule stays testable without a browser.
 */

import { useEffect, useState } from "react";
import { SESSION_KEYS, sessionVerdict, type SessionVerdict } from "@/lib/trip-session";

type NavigationType = "navigate" | "reload" | "back_forward" | "unknown";

function readNavigationType(): NavigationType {
  try {
    const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const type = entries?.[0]?.type;
    if (type === "reload" || type === "navigate" || type === "back_forward") return type;
    /**
     * PerformanceNavigationTiming is not universal; the deprecated interface is
     * still the only one some old WebViews have, and it uses numbers.
     */
    const legacy = (performance as unknown as { navigation?: { type?: number } }).navigation;
    if (legacy?.type === 1) return "reload";
    if (legacy?.type === 2) return "back_forward";
    if (legacy?.type === 0) return "navigate";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function readFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(key: string, value: boolean) {
  try {
    if (value) window.sessionStorage.setItem(key, "1");
    else window.sessionStorage.removeItem(key);
  } catch {
    // Session storage can be unavailable in private modes; the site still works.
  }
}

/**
 * Records that this tab is now moving inside the site rather than reloading it.
 *
 * It is called from the router on a client-side navigation, which by definition
 * can only happen while a page is already open — that is exactly the difference
 * between «دستش خورده و رفته صفحهٔ اصلی» and «رفرش کرده».
 */
export function markInsideNavigation() {
  writeFlag(SESSION_KEYS.insideNavigation, true);
}

export function useSessionVerdict(input: { hasTrip: boolean; stage: number }): SessionVerdict {
  const [verdict, setVerdict] = useState<SessionVerdict>("empty");

  useEffect(() => {
    const navigationType = readNavigationType();
    setVerdict(
      sessionVerdict({
        hasTrip: input.hasTrip,
        stage: input.stage,
        navigationType,
        insideNavigation: readFlag(SESSION_KEYS.insideNavigation),
        startFreshChosen: readFlag(SESSION_KEYS.startFresh),
        resumeChosen: readFlag(SESSION_KEYS.resume),
      }),
    );
  }, [input.hasTrip, input.stage]);

  return verdict;
}

/**
 * The first in-site navigation of a tab is recorded here, once, so every later
 * page knows the traveller is continuing rather than starting over.
 */
export function useRecordInsideNavigation() {
  useEffect(() => {
    let last = window.location.pathname + window.location.search;
    const observer = new MutationObserver(() => {
      const now = window.location.pathname + window.location.search;
      if (now !== last) {
        last = now;
        markInsideNavigation();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
}
