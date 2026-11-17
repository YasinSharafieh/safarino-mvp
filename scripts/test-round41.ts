/**
 * Round 41 — «concept» guards.
 *
 * The site's mistakes were not typos; they were ideas that disagreed with each
 * other: the home page said ۱۵۶ cities while the list held ۲۱۱; the root
 * description sold «رزرو پرواز و تور» while the FAQ promised Safarino takes no
 * payment and sells nothing; the stepper called step four «برنامهٔ نهایی» while
 * two different pages both called themselves the plan; one page had two controls
 * for the same number; and a warning blamed a ticket that had not been chosen.
 *
 * Each guard below reads the real source files, so the same class of mistake
 * cannot come back silently.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACCOMMODATION_SOURCES, JOURNEY_STEPS, SITE_FACTS, TICKET_SOURCES, homeStats } from "../lib/site-facts";
import { IRANIAN_CITIES } from "../lib/iran-cities";
import { DISCOVER_MOODS } from "../lib/discover";
import { ticketStayCheck } from "../lib/ticket-timing";
import { PHASES } from "../lib/phase-coverage";

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

/** Source with comments removed, so a comment explaining an old mistake is not the mistake. */
function code(path: string): string {
  return read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function exists(path: string): boolean {
  const body = read(path);
  return body.length > 0;
}

console.log("۴۱ — عددها، نام‌ها و هشدارها با هم و با واقعیت نمی‌جنگند");

// ── 1) Every number the site states comes from the data ────────────────────────

check("the city count is the real list", SITE_FACTS.cities === IRANIAN_CITIES.length, String(SITE_FACTS.cities));
check("the mood count is the real list", SITE_FACTS.moods === DISCOVER_MOODS.length);
check("the source counts are the real lists", SITE_FACTS.accommodationSources === ACCOMMODATION_SOURCES.length && SITE_FACTS.ticketSources === TICKET_SOURCES.length);
check("the journey really has five steps", JOURNEY_STEPS.length === 5 && SITE_FACTS.steps === 5);
check("every step has an address and a promise", JOURNEY_STEPS.every((step) => step.href.startsWith("/") && step.promise.length > 8));
check("the five steps cover the five phases in order", JOURNEY_STEPS.map((step) => step.href).join("|") === "/start/cities|/transport|/accommodation|/plan|/itinerary");

const home = read("app/page.tsx");
check("the home page takes its numbers from the facts, not from typed strings", home.includes("homeStats()") && !home.includes("۱۵۶"));
check("the start page does not type the city count either", !read("app/start/page.tsx").includes("۱۵۶"));
check("the four home numbers are all real", homeStats().every((stat) => stat.value.length > 0));
check("the home claims the sources it really has", homeStats().some((stat) => stat.label.includes("اقامت")) && homeStats().some((stat) => stat.label.includes("بلیت")));

const staleCounts: string[] = [];
for (const phase of PHASES) {
  const body = read(phase.file);
  if (/۱۵۶|156 شهر|۱۴۵ شهر/.test(body)) staleCounts.push(phase.id);
}
check("no page repeats an old, wrong city count", staleCounts.length === 0, staleCounts.join(", ") || "none");

// ── 2) The site must not sell what it does not sell ───────────────────────────

const layout = read("app/layout.tsx");
const description = layout.slice(layout.indexOf("description:"), layout.indexOf("keywords:"));
check("the site description does not claim to book or sell tours", !/رزرو پرواز|رزرو هتل|تور مسافرتی/.test(description), description.slice(0, 60));
check("the description says what the product does", /برنامه/.test(description));
check("the keywords do not pretend to be a travel agency", !layout.includes("آژانس مسافرتی"));
check("the home FAQ's own promise is not contradicted anywhere in the root metadata", !/پرداخت/.test(layout) || layout.includes("بدون پرداخت"));

// ── 3) Every phase says what it is ────────────────────────────────────────────

const metaSource = (phase: { file: string }) => {
  const body = read(phase.file);
  if (/export const metadata|export function generateMetadata|export async function generateMetadata/.test(body)) return "page";
  const dir = phase.file.replace(/\/page\.tsx$/, "");
  if (exists(`${dir}/layout.tsx`) && /metadata/.test(read(`${dir}/layout.tsx`))) return "layout";
  return "";
};
const missingMeta = PHASES.filter((phase) => !metaSource(phase)).map((phase) => phase.id);
check("every phase has a title and a description", missingMeta.length === 0, missingMeta.join(", ") || "all ۱۴");

const canonicals = PHASES.map((phase) => {
  const dir = phase.file.replace(/\/page\.tsx$/, "");
  const source = `${read(phase.file)}\n${read(`${dir}/layout.tsx`)}`;
  const match = /canonical:\s*[`"](\/[^`"]*)[`"]/.exec(source);
  return { id: phase.id, canonical: match ? match[1] : null };
});
const wrongCanonical = canonicals.filter((entry) => entry.canonical === "/" && entry.id !== "home");
check("no page claims to be the home page", wrongCanonical.length === 0, wrongCanonical.map((entry) => entry.id).join(", ") || "none");
check("the private screens are kept out of the index", /index:\s*false/.test(read("app/s/[code]/page.tsx")) && /index:\s*false/.test(read("app/itinerary/print/layout.tsx")) && /index:\s*false/.test(read("app/offline/layout.tsx")));

// ── 4) One number, one control ───────────────────────────────────────────────

const plan = read("app/plan/page.tsx");
check("the plan page has exactly one budget control", (plan.match(/<BudgetBar/g) || []).length === 1);
check("the plan page has no second editable budget field", !plan.includes("budgetEditing") && !/aria-label="بودجهٔ کل سفر به تومان"/.test(plan));
check("the read-only budget still points at the real control", plan.includes('href="#budget-control"') && plan.includes('id="budget-control"'));
const budgetPages = PHASES.filter((phase) => read(phase.file).includes("<BudgetBar"));
check("the steps that spend money all show the same budget bar", budgetPages.length >= 4, budgetPages.map((phase) => phase.id).join(", "));

// ── 5) The stepper means the same thing everywhere ───────────────────────────

const stepper = read("components/TravelSteps.tsx");
check("the stepper is built from the shared five steps", stepper.includes("JOURNEY_STEPS"));
check("the stepper no longer calls step four «برنامه نهایی»", !code("components/TravelSteps.tsx").includes("برنامه نهایی"));
const stepperUsers: { file: string; current: number }[] = [];
for (const phase of PHASES) {
  const body = read(phase.file);
  const match = /<TravelSteps\s+current=\{(\d)\}/.exec(body);
  if (match) stepperUsers.push({ file: phase.id, current: Number(match[1]) });
}
const quizSource = read("app/quiz/TravelQuiz.tsx");
if (/<TravelSteps\s+current=\{(\d)\}/.test(quizSource)) stepperUsers.push({ file: "quiz", current: Number(/<TravelSteps\s+current=\{(\d)\}/.exec(quizSource)![1]) });
check("every stepper asks for a valid step", stepperUsers.every((entry) => entry.current >= 1 && entry.current <= 5), stepperUsers.map((entry) => `${entry.file}:${entry.current}`).join(", "));
const stepOf = (id: string) => stepperUsers.find((entry) => entry.file === id)?.current;
check("the transport page is step ۲", stepOf("transport") === 2);
check("the accommodation page is step ۳", stepOf("accommodation") === 3);
check("the plan page is step ۴", stepOf("plan") === 4);
check("the trip book is step ۵ — it is no longer the same step as the plan", stepOf("itinerary") === 5);

// ── 6) A warning must be about something that exists ─────────────────────────

const noTicket = ticketStayCheck({ checkIn: "2026-12-01", checkOut: "2026-12-03", hasTicket: false });
check("with no ticket chosen, nothing blames a missing arrival time", !noTicket.issues.some((issue) => issue.title.includes("ساعت رسیدن")), noTicket.line);
const ticketNoTime = ticketStayCheck({ hasTicket: true, departure: "2026-12-01T09:00:00+03:30", checkIn: "2026-12-01", checkOut: "2026-12-03" });
check("with a real ticket and no hour, the gap is still said out loud", ticketNoTime.issues.some((issue) => issue.title.includes("ساعت رسیدن")));
const accommodation = read("app/accommodation/page.tsx");
check("the accommodation page passes the real ticket state to that check", accommodation.includes("hasTicket: Boolean(pickedTransport)"));

// ── 7) The budget sentence names what it subtracted ─────────────────────────

const gauge = read("lib/budget-gauge.ts");
check("the gauge sentence lists every row it subtracts", gauge.includes("رفت‌وآمد شهری") && gauge.includes("گشت‌وگذار"), "verdict sentence");
check("the accommodation bar no longer mislabels the total", !accommodation.includes("بودجهٔ یکپارچهٔ حمل‌ونقل و اقامت"));

// ── 8) The start page has one entry of each kind ──────────────────────────────

const start = read("app/start/page.tsx");
check("the two «one sentence» doors are now one section", (start.match(/<OneClickTrip/g) || []).length === 1 && (start.match(/<VoiceTripButton/g) || []).length === 1);
check("the voice door is presented as an alternative, not a rival", /variant="compact"/.test(start));
check("the two real branches are still there", start.includes('href="/start/cities"') && start.includes('href="/quiz"'));

console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ round 41: the numbers come from the data and the words match the product");
process.exit(failures ? 1 : 0);
