"use client";

/**
 * Records the difference the owner asked for: «دستش خورده و رفته صفحهٔ اصلی» is a
 * continuation, while «F5 / رفرش» is a fresh start.
 *
 * A client-side route change can only happen while a page is already open, so it
 * is the one signal that a reload can never produce. The hook fires once per
 * movement and writes a single flag in sessionStorage; `lib/trip-session.ts` makes
 * the decision from it. No UI, no state, no render cost.
 */

import { useRecordInsideNavigation } from "@/lib/trip-session-client";

export default function InsideNavigationWatcher() {
  useRecordInsideNavigation();
  return null;
}
