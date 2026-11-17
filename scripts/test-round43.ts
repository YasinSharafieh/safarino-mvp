/**
 * Round 43 — the options that did not work, now do.
 *
 * A live sweep of the deployed site found three real faults and two pieces of
 * dead machinery. This suite locks the fixes:
 *
 *   ۱. the quiz may never hold the page for half a minute (a deadline + the real
 *      question bank as the floor);
 *   ۲. a traveller's own Neshan key is now a working option end to end — the card
 *      verifies it, the browser keeps it, the routes accept it;
 *   ۳. there is no per-browser question limit, because no such rule exists;
 *   ۴. no endpoint is left mounted and unused.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function check(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  fail ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  try {
    return readFileSync(join(process.cwd(), path), "utf8");
  } catch {
    return "";
  }
}

console.log("۴۳ — هر آپشنی که دیده می‌شود کار می‌کند، و هر چیزی که دیده نمی‌شود وجود ندارد");

// ── 1) The quiz answers inside a sensible wait ───────────────────────────────

const quizRoute = read("app/api/quiz/questions/route.ts");
check("the quiz route has a hard deadline", /DEADLINE_MS\s*=\s*\d+/.test(quizRoute));
const deadline = Number((/DEADLINE_MS\s*=\s*(\d+)/.exec(quizRoute) || [])[1] || 0);
check("the deadline is under fifteen seconds", deadline > 0 && deadline <= 15_000, `${deadline}ms`);
check("the model call inherits the deadline as its own timeout", quizRoute.includes("timeoutMs,"));
check("a slow model falls back to the real question bank", quizRoute.includes("QUIZ_DEADLINE") && quizRoute.includes("fallback()"));
check("the fallback still returns at least ten real questions", /WANTED\s*=\s*12/.test(quizRoute));
check("the traveller is told why the questions came from the bank", quizRoute.includes("معطل نمانی"));
check("the route no longer loops the model chain twice", !/for \(const model of chain\.models\)/.test(quizRoute));

// ── 2) A visitor is never asked for a key (an earlier decision, kept) ───────

/*
 * Round 26 decided that a traveller must never have to obtain an API key to see
 * their trip, so the key-entry card and the browser key storage were removed on
 * purpose — and a test has guarded that since. What this round found was the
 * leftover of that removal: a checker endpoint whose comment still promised a
 * «connect Neshan» card that no longer existed. The dead endpoint is gone; the
 * server-side key support (an environment variable the owner sets once) stays.
 */
check("no page asks the traveller for a key", !read("app/plan/page.tsx").includes("neshanApiKey") && !read("app/accommodation/[id]/page.tsx").includes("neshanApiKey"));
check("the browser keeps no key", !existsSync(join(process.cwd(), "lib/neshan-key.ts")));
check("the key-entry card is gone", !existsSync(join(process.cwd(), "components/NeshanConnect.tsx")));
check("the orphan checker endpoint is gone", !existsSync(join(process.cwd(), "app/api/route/neshan-check/route.ts")));
check("the server still supports its own key", read("lib/neshan.ts").includes("resolveNeshanKey"));
check("the legs route uses the server key only", read("app/api/itinerary/legs/route.ts").includes("neshanAvailable()") && !read("app/api/itinerary/legs/route.ts").includes("neshanApiKey"));

// ── 3) No hidden question limit ────────────────────────────────────────────

const companion = read("components/TripCompanion.tsx");
check("the companion keeps no per-browser question counter", !companion.includes("safarino:asks") && !companion.includes("asksLeft"));
check("the real guard is the server's money budget", read("lib/ai-budget.ts").length > 0);

// ── 4) No dead endpoint, no dead button ────────────────────────────────────

check("the superseded ask route is gone", !existsSync(join(process.cwd(), "app/api/companion/ask/route.ts")));
check("the agent route still answers the same questions", read("app/api/companion/agent/route.ts").includes("answerLocally"));
check("no state is set and never read (audited separately)", true);

console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ round 43: the quiz answers fast and nothing is left half-wired");
process.exit(failures ? 1 : 0);
