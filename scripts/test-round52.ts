/**
 * Round 52 — «refresh starts over, walking around continues».
 *
 * The owner's rule has four cases and they pull in opposite directions, so the
 * decision lives in `lib/trip-session.ts` as a pure function and every case is
 * pinned here. If a future change makes a refresh resume a trip, or makes a
 * back-button look like a new trip, this file fails.
 */
import assert from "node:assert/strict";
import { demandKey, freshnessOf, parseDemandKey } from "../lib/freshness";
import { SESSION_KEYS, sessionVerdict, verdictCopy, type SessionInput } from "../lib/trip-session";
import { tripStatus } from "../lib/trip-status";

// The phase the strip prints must be the step the traveller is actually on.
assert.equal(tripStatus({ origin: "تهران", destination: "مشهد", departureDate: "2026-12-13", travelers: 1, days: 3 }).stage, 2, "only the route is done → the traveller stands on step ۲");
assert.equal(tripStatus({ destination: "مشهد" }).stage, 1, "a destination without a date is not a finished route — the traveller still stands on step ۱");
assert.equal(tripStatus({ origin: "تهران", destination: "مشهد", departureDate: "2026-12-13", transport: { mode: "train", cost: 900000 }, accommodation: { status: "skipped" } }).stage, 4, "route, ticket and stay decided → the traveller stands on the days plan");
assert.equal(tripStatus({}).stage, 1, "nothing chosen → step ۱");

const base: SessionInput = {
  hasTrip: true,
  stage: 3,
  navigationType: "navigate",
  insideNavigation: false,
  startFreshChosen: false,
  resumeChosen: false,
};

/* 1. The four cases the owner named. */
assert.equal(sessionVerdict({ ...base, navigationType: "reload" }), "fresh-load", "F5 asks the question again");
assert.equal(sessionVerdict({ ...base, navigationType: "navigate", insideNavigation: true }), "resume", "a tap inside the site continues the trip");
assert.equal(sessionVerdict({ ...base, navigationType: "navigate", insideNavigation: false }), "fresh-load", "a typed address is a new visit");
assert.equal(sessionVerdict({ ...base, navigationType: "back_forward" }), "resume", "the browser back button is not abandonment");

/**
 * 2. A refresh is the boundary, and the in-site signal is scoped to one document.
 *
 *    The client clears the signal whenever a new document loads, so a reload
 *    always arrives here with `insideNavigation: false` → «fresh-load». The case
 *    below — reload *and* an in-site move — is the one that is actually reachable
 *    after the reload, on a screen the traveller then walked to. It must read as a
 *    continuation; before this rule it still said «سفر تازه را از مرحلهٔ ۱ شروع کن»
 *    on the home page of someone who had only tapped a link.
 */
assert.equal(sessionVerdict({ ...base, navigationType: "reload", insideNavigation: false }), "fresh-load", "F5 with no move behind it starts over");
assert.equal(sessionVerdict({ ...base, navigationType: "reload", insideNavigation: true }), "resume", "after F5, walking to another screen is a continuation");

/* 3. Choices the traveller made in this tab are respected. */
assert.equal(sessionVerdict({ ...base, startFreshChosen: true }), "empty", "«سفر تازه» clears the strip");
assert.equal(sessionVerdict({ ...base, navigationType: "reload", resumeChosen: true }), "resume", "«ادامه» survives a reload in the same tab");
assert.equal(sessionVerdict({ ...base, resumeChosen: true }), "resume");

/* 4. Nothing to resume, nothing to say. */
assert.equal(sessionVerdict({ ...base, hasTrip: false }), "empty");
assert.equal(sessionVerdict({ ...base, hasTrip: false, navigationType: "reload" }), "empty");

/* 5. A finished trip is not offered as «continue». */
assert.equal(sessionVerdict({ ...base, stage: 5 }), "finished");

/* 6. The wording states the real phase, in Persian digits, and never invents one. */
const fresh = verdictCopy("fresh-load", 3)!;
assert.match(fresh.body, /۳ از ۵/, "the phase the traveller stood on is named");
assert.match(fresh.title, /۱/, "the new trip is offered from step ۱");
assert.match(verdictCopy("resume", 2)!.title, /شما داشتی این سفر را برنامه‌ریزی می‌کردی/, "the owner's sentence, in his words");
assert.match(verdictCopy("resume", 2)!.title, /برگردی و ادامه بدهی/);
assert.match(verdictCopy("resume", 3)!.body, /۳ از ۵/, "the current phase is named");
assert.match(verdictCopy("resume", 3)!.body, /۲ قدم از ۵/, "and how much is behind it");
assert.match(verdictCopy("fresh-load", 3)!.body, /۲ قدم از ۵ انجام شده و مرحلهٔ ۳ از ۵/, "a refresh names the previous trip's progress and phase");
assert.equal(verdictCopy("empty", 1), null, "no saved trip → no copy at all");
for (const stage of [0, 1, 3, 5, 99]) {
  const copy = verdictCopy("fresh-load", stage)!;
  assert.match(copy.body, /[۱۲۳۴۵] از ۵/, `stage ${stage} must still read as a real phase`);
}

/* 7. The demand key is stable, and carries no user identity. */
const a = demandKey("ticket", { mode: "train", origin: "THR", destination: "MHD", date: "2026-12-13", adults: 2 });
const b = demandKey("ticket", { adults: 2, date: "2026-12-13", destination: "MHD", origin: "THR", mode: "train" });
assert.equal(a, b, "the same search always yields the same key");
assert.doesNotMatch(a, /cookie|user|session|email/i);
// Keys are normalised to lower-case so «THR» and «thr» are one search; the
// warm-up turns them back into provider codes before searching.
assert.deepEqual(parseDemandKey(a)?.parts, { adults: "2", date: "2026-12-13", destination: "mhd", mode: "train", origin: "thr" });
assert.equal(parseDemandKey(demandKey("ticket", { origin: "thr" }))?.parts.origin, parseDemandKey(demandKey("ticket", { origin: "THR" }))?.parts.origin);
assert.equal(parseDemandKey("nonsense"), null);

/* 8. Freshness tells the truth about age and never guesses a timestamp. */
const now = Date.parse("2026-11-19T12:00:00Z");
assert.equal(freshnessOf("ticket", "2026-11-19T11:59:40Z", now).label, "همین حالا");
assert.equal(freshnessOf("ticket", "2026-11-19T11:48:00Z", now).label, "۱۲ دقیقه پیش");
assert.equal(freshnessOf("ticket", "2026-11-19T09:00:00Z", now).label, "۳ ساعت پیش");
assert.equal(freshnessOf("ticket", "2026-11-17T12:00:00Z", now).label, "۲ روز پیش");
const freshTicket = freshnessOf("ticket", "2026-11-19T11:50:00Z", now);
assert.equal(freshTicket.comfortable, true);
assert.equal(freshTicket.stale, false);
// 20 minutes old: outside the 15-minute comfort window, inside the 30-minute stale one.
const oldTicket = freshnessOf("ticket", "2026-11-19T11:40:00Z", now);
assert.equal(oldTicket.ageing, true, "an hour-old ticket list is ageing");
assert.equal(oldTicket.stale, false);
const ancientTicket = freshnessOf("ticket", "2026-11-19T09:00:00Z", now);
assert.equal(ancientTicket.stale, true, "three hours old is a saved copy, not a live answer");
assert.equal(freshnessOf("room", "2026-11-19T09:00:00Z", now).stale, false, "rooms age more slowly than tickets");
const unknown = freshnessOf("ticket", null, now);
assert.equal(unknown.ageSeconds, null);
assert.equal(unknown.comfortable, false, "an unknown age is not called fresh");
assert.match(unknown.label, /نامعلوم/);

/* 9. The keys are namespaced so nothing generic is overwritten. */
for (const key of Object.values(SESSION_KEYS)) assert.match(key, /^safarino:/);

console.log("✅ round 52: a refresh starts a new trip, walking inside the site continues the old one — and freshness is stated, never implied");
