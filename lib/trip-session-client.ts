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
import { usePathname } from "next/navigation";
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

/**
 * The address this document was *opened* at.
 *
 * It is captured once per page load, so it is the honest answer to «has this tab
 * moved since it was opened?» — a question a reload resets by definition, and one
 * a client-side navigation changes for certain. The sessionStorage flag says the
 * same thing, but it is written by an observer that fires *after* React has
 * already re-rendered, so on its own it can arrive one screen too late. This
 * comparison cannot be late: it is true the moment the address differs.
 */
let entryAddress: string | null = null;

function currentAddress(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function movedInsideTheSite(): boolean {
  try {
    if (entryAddress === null) entryAddress = currentAddress();
    return currentAddress() !== entryAddress;
  } catch {
    return false;
  }
}

export function useSessionVerdict(input: { hasTrip: boolean; stage: number }): SessionVerdict {
  const [verdict, setVerdict] = useState<SessionVerdict>("empty");
  /** The verdict must be re-decided on every screen, not once per document. */
  const pathname = usePathname();

  useEffect(() => {
    const navigationType = readNavigationType();
    /**
     * A document that was loaded — not navigated to from inside — begins with no
     * in-site history. Clearing the flag here is what makes «بعد از رفرش از اول»
     * hold even though sessionStorage survives a reload.
     */
    if (navigationType !== "back_forward") writeFlag(SESSION_KEYS.insideNavigation, false);
    setVerdict(
      sessionVerdict({
        hasTrip: input.hasTrip,
        stage: input.stage,
        navigationType,
        // Either signal is enough: the flag, or the address itself having moved.
        insideNavigation: readFlag(SESSION_KEYS.insideNavigation) || movedInsideTheSite(),
        startFreshChosen: readFlag(SESSION_KEYS.startFresh),
        resumeChosen: readFlag(SESSION_KEYS.resume),
      }),
    );
  }, [input.hasTrip, input.stage, pathname]);

  return verdict;
}

/**
 * Records an in-site move **at the moment it happens**, which is what makes the
 * signal reliable.
 *
 * The first version watched the DOM for a URL change. That works, but it fires
 * after React has already rendered the next screen, so the strip on that screen
 * could be drawn before the flag existed — and a traveller who tapped a link was
 * briefly told «سفر تازه را از مرحلهٔ ۱ شروع کن». A capture-phase click on a
 * same-origin link is one step earlier and cannot be missed; `popstate` covers
 * the back button, and the observer stays as a safety net for any navigation
 * that happens without either.
 */
export function useRecordInsideNavigation() {
  useEffect(() => {
    const mark = () => writeFlag(SESSION_KEYS.insideNavigation, true);

    const onClick = (event: MouseEvent) => {
      // Only a plain left click that leaves this page is a move; a new tab is not.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const target = anchor.getAttribute("target");
      if (target && target !== "_self") return;
      if (anchor.hasAttribute("download") || anchor.dataset.noInsideNav !== undefined) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // A jump inside the same page is not a move between screens.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      mark();
    };

    let last = window.location.pathname + window.location.search;
    const observer = new MutationObserver(() => {
      const now = window.location.pathname + window.location.search;
      if (now !== last) {
        last = now;
        mark();
      }
    });
    observer.observe(document, { childList: true, subtree: true });

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", mark);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", mark);
      observer.disconnect();
    };
  }, []);
}
