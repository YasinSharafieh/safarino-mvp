/**
 * «سفر تازه یا سفر نیمه‌کاره؟» — the rule that decides what the top of the site
 * says, and why a refresh must not look like a lost trip.
 *
 * The owner's rule, in his own words:
 *   - a traveller who **refreshes** the site (F5, or opens it again) starts from
 *     the beginning: the strip of a previous trip must not greet them as if
 *     nothing happened; they should be able to begin a new trip from step ۱;
 *   - but a traveller who only **moved around inside the site** (tapped a link,
 *     went to the home page) keeps seeing the trip they were planning, with the
 *     real phase they stand on («۳ از ۵») and a way back into it.
 *
 * A browser does not tell us "this is a refresh" directly in a way that survives
 * everything, so this module uses the one honest signal that does: a page that
 * was **reloaded** is a fresh start, while a **client-side navigation** inside a
 * page that is already open is a continuation. The signal is written by the app
 * itself (`markInsideNavigation`) the first time the traveller moves between
 * pages without a full load.
 *
 * Everything here is a pure decision on purpose: no storage, no React, no
 * window. The caller reads the browser, this file decides, and the tests in
 * `scripts/test-round52.ts` prove all four combinations.
 */

/** Where the traveller stands, as the interface may phrase it. */
export type SessionVerdict =
  /** No saved trip at all: nothing to resume, nothing to warn about. */
  | "empty"
  /** A saved trip, and this load is a real page load (refresh / new tab). */
  | "fresh-load"
  /** A saved trip, and the traveller got here by moving inside the site. */
  | "resume"
  /** A saved trip that is already finished (all five steps): no «continue». */
  | "finished";

export type SessionInput = {
  /** Does this device really hold a trip with a destination? */
  hasTrip: boolean;
  /** The step the saved trip stands on, 1..5, from `tripStatus().stage`. */
  stage: number;
  /**
   * How this page was loaded, from `PerformanceNavigationTiming`:
   * `"reload"` (F5), `"navigate"` (typed address, a bookmark, a new tab),
   * `"back_forward"` (the browser back button from another site).
   */
  navigationType: "navigate" | "reload" | "back_forward" | "unknown";
  /** The app already recorded at least one in-site navigation in this tab. */
  insideNavigation: boolean;
  /** The traveller pressed «سفر تازه» in this tab, so the question is settled. */
  startFreshChosen: boolean;
  /** The traveller pressed «ادامه» in this tab. */
  resumeChosen: boolean;
};

export function sessionVerdict(input: SessionInput): SessionVerdict {
  if (!input.hasTrip) return "empty";
  if (input.startFreshChosen) return "empty";
  if (input.stage >= 5 && !input.resumeChosen) return "finished";
  if (input.resumeChosen) return "resume";
  /**
   * `"back_forward"` is the browser's back button. A traveller who came back to
   * the tab is continuing, not starting over — the page was live in their
   * history and the trip was never abandoned.
   */
  if (input.navigationType === "back_forward") return "resume";
  /**
   * A reload is the case the owner named explicitly: «وقتی رفرش کرده باید از اول
   * نمایش داده بشه». Even if the tab had in-site navigation before, the reload
   * itself is the boundary — the traveller asked for a fresh screen.
   */
  if (input.navigationType === "reload") return "fresh-load";
  /**
   * A plain `"navigate"`: a typed address or a bookmark is a fresh load too,
   * **unless** the app itself recorded an in-site move in this tab (which can
   * only happen after the page is already open, so a navigate cannot follow it
   * in the same document).
   */
  if (input.insideNavigation) return "resume";
  return "fresh-load";
}

/**
 * The words the strip shows. Kept beside the decision so every caller phrases
 * the same situation the same way — a second wording is how two screens end up
 * telling a traveller two different stories.
 */
export function verdictCopy(verdict: SessionVerdict, stage: number): { tone: "info" | "warn" | "ok"; title: string; body: string } | null {
  const fa = (value: number) => String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  switch (verdict) {
    case "fresh-load":
      return {
        tone: "info",
        title: "سفر تازه را از مرحلهٔ ۱ شروع کن",
        body: `یک سفر نیمه‌کاره روی این دستگاه مانده و تا مرحلهٔ ${fa(Math.min(5, Math.max(1, stage)))} از ۵ رفته بود. می‌توانی همان را ادامه بدهی یا از نو شروع کنی.`,
      };
    case "finished":
      return {
        tone: "ok",
        title: "سفر قبلی‌ات کامل شده",
        body: "همهٔ پنج مرحله انجام شده است. یک سفر تازه بساز یا برنامهٔ قبلی را ببین.",
      };
    case "resume":
      return {
        tone: "info",
        title: `داشتی سفر را برنامه‌ریزی می‌کردی — مرحلهٔ ${fa(Math.min(5, Math.max(1, stage)))} از ۵`,
        body: "از همان‌جایی که بودی ادامه بده؛ چیزی از دست نرفته است.",
      };
    default:
      return null;
  }
}

/** Keys, in one place, so no component invents its own. */
export const SESSION_KEYS = {
  /** Set once the traveller navigates inside an open page. */
  insideNavigation: "safarino:inside-navigation",
  /** Set when «سفر تازه» is chosen for this tab. */
  startFresh: "safarino:start-fresh",
  /** Set when «ادامه» is chosen for this tab. */
  resume: "safarino:resume-chosen",
} as const;
