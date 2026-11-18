import { NextRequest, NextResponse } from "next/server";
import { searchMultiProviderAccommodation } from "../../../../lib/accommodation-search";
import { searchTransport } from "../../../../lib/transport-search";
import { searchCityPois } from "../../../../lib/poi-search";
import { readFreshSnapshot, snapshotKey, writeSnapshot } from "../../../../lib/snapshot-store";
import { loadTripPackages } from "../../../../lib/trip-packages";
import { getProviderCache, setProviderCache } from "../../../../lib/provider-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Warm-up job: refreshes the saved copies for the searches travellers ask for
 * most, so nobody waits 12 seconds for a crawl.
 *
 * It only touches public, read-only provider data for a fixed list of cities —
 * there is no user data here and nothing is invented. Anybody can call it (a
 * scheduler, a bookmark, the owner), so it cannot leak anything.
 *
 * Schedule: `vercel.json` runs it daily (Hobby limit). For hourly freshness any
 * external scheduler can hit this URL, e.g. every hour:
 *   <your-domain>/api/cron/refresh
 */

const CITIES = ["مشهد", "تهران", "شیراز", "اصفهان", "کیش", "رامسر", "تبریز", "یزد"];
/**
 * How far ahead the ticket windows are opened.
 *
 * Train and flight inventory is released in waves, so «فردا» and «دو هفته بعد»
 * are two different searches with two different answers. The warm-up used to
 * look at a single date, which is why a traveller picking a new date waited for
 * a full crawl. Three windows — this week, next week, next month — cover the
 * dates people actually choose.
 */
const TICKET_DAYS = [1, 3, 7, 14, 21, 30, 45];
const STAY_CITIES = ["رامسر", "مشهد", "شیراز", "تهران", "ماسوله", "کیش"];
/** Origins whose home-page packages are warmed ahead of the first visitor. */
const PACKAGE_ORIGINS = ["تهران", "مشهد", "اصفهان", "شیراز"];
const ROUTES: { mode: "plane" | "train" | "bus"; origin: string; destination: string }[] = [
  { mode: "plane", origin: "THR", destination: "MHD" },
  { mode: "plane", origin: "THR", destination: "SYZ" },
  { mode: "train", origin: "THR", destination: "MHD" },
  { mode: "bus", origin: "THR", destination: "MHD" },
];

function isoDate(offsetDays: number): string {
  // Dates are Iran's dates; adjusting from UTC would shift a search by a day.
  const date = new Date(Date.now() + 3.5 * 3_600_000 + offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
}

type Step = { label: string; result: "refreshed" | "kept" | "failed"; ms: number };

async function warmAccommodation(kind: "hotel" | "stay", city: string, checkIn: string, checkOut: string, nights: number): Promise<Step> {
  const started = Date.now();
  const input = { kind, city, checkIn, checkOut, adults: 2, childAges: [], infantAges: [] };
  const base = snapshotKey("accommodation", { ...input, kinds: input.kind });
  try {
    const live = await searchMultiProviderAccommodation(input);
    if (live.allProvidersFailed) return { label: `${kind}:${city}:${checkIn}`, result: "kept", ms: Date.now() - started };
    await writeSnapshot(base, live as unknown as Record<string, unknown>, 1_800, 86_400);
    return { label: `${kind}:${city}:${checkIn}`, result: "refreshed", ms: Date.now() - started, nights } as Step;
  } catch {
    return { label: `${kind}:${city}:${checkIn}`, result: "failed", ms: Date.now() - started };
  }
}

/**
 * The warm-up must write the store the ticket page reads.
 *
 * Before this it saved a private `{ warm: true, count }` marker that nothing
 * ever read — so the page had to crawl the providers again no matter how warm
 * the job claimed to be. Now the job runs the very same `searchTransport` the
 * page runs, for the party sizes people actually search (one and two), and the
 * result lands in the shared snapshot with its real freshness window.
 */
async function warmTransport(mode: "plane" | "train" | "bus", origin: string, destination: string, date: string): Promise<Step> {
  const started = Date.now();
  try {
    let found = 0;
    for (const adults of [1, 2]) {
      const { payload } = await searchTransport({ mode, origin, destination, date, adults, children: 0, infants: 0 });
      found = Math.max(found, payload.offers.length);
    }
    return {
      label: `${mode}:${origin}-${destination}:${date}`,
      result: found > 0 ? "refreshed" : "kept",
      ms: Date.now() - started,
    };
  } catch {
    return { label: `${mode}:${origin}-${destination}:${date}`, result: "failed", ms: Date.now() - started };
  }
}

/** Small helper so a hot loop can yield to the event loop now and then. */
const nap = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The home-page packages are built from two live searches each, so a cold visit
 * would wait too long. Warming the biggest origins here keeps «پیشنهادهای ویژه»
 * instant while the numbers still come from the providers.
 */
async function warmPackages(origin: string): Promise<Step> {
  const started = Date.now();
  try {
    const result = await loadTripPackages({ origin, originSource: "default", travellers: 1, limit: 4 });
    return { label: `packages:${origin}`, result: result.packages.length ? "refreshed" : "kept", ms: Date.now() - started };
  } catch {
    return { label: `packages:${origin}`, result: "failed", ms: Date.now() - started };
  }
}

async function warmPois(city: string): Promise<Step> {
  const started = Date.now();
  const base = snapshotKey("pois", { city, limit: 24 });
  try {
    const existing = await readFreshSnapshot<Record<string, unknown>>(base);
    if (existing) return { label: `pois:${city}`, result: "kept", ms: Date.now() - started };
    const result = await searchCityPois(city, 40);
    if (!result.pois?.length) return { label: `pois:${city}`, result: "kept", ms: Date.now() - started };
    await writeSnapshot(base, result as unknown as Record<string, unknown>, 86_400, 604_800);
    return { label: `pois:${city}`, result: "refreshed", ms: Date.now() - started };
  } catch {
    return { label: `pois:${city}`, result: "failed", ms: Date.now() - started };
  }
}

/** One warm-up per hour is plenty; the lock also protects the providers. */
const LOCK_KEY = "safarino:warm-lock";
const LOCK_SECONDS = 3_600;

/**
 * How much work one call may do. The job always finishes inside the limit and
 * the next call continues with the rest — so the store gets warmer every hour
 * instead of one call dying at 60 seconds.
 */
export async function GET(request: NextRequest) {
  return run(request, { hotels: 3, stays: 2, transports: 6, pois: 3, packages: 1, skip: 0 });
}

export async function POST(request: NextRequest) {
  return run(request, { hotels: 6, stays: 4, transports: 14, pois: 6, packages: 2, skip: 0 });
}

/**
 * `budget*` bounds how much work one call does, so the job always finishes
 * inside the serverless time limit; the next call continues where it stopped.
 */
async function run(
  request: NextRequest,
  budget: { hotels: number; stays: number; transports: number; pois: number; packages?: number; skip?: number },
) {
  const started = Date.now();
  const force = request.nextUrl.searchParams.get("force") === "1";
  if (!force) {
    const locked = await getProviderCache<string>(LOCK_KEY);
    if (locked) {
      return NextResponse.json({
        success: true,
        skipped: true,
        lastRunAt: locked,
        message: "نسخه‌های ذخیره‌شده در همین ساعت تازه شده‌اند؛ کاری لازم نبود.",
      });
    }
  }
  // Claim the hour before doing the heavy work, so two visitors cannot both crawl.
  await setProviderCache(LOCK_KEY, new Date().toISOString(), LOCK_SECONDS);
  /** Both stay windows people actually pick: a short break and a full week. */
  const stayWindows = [
    { checkIn: isoDate(1), checkOut: isoDate(3) },
    { checkIn: isoDate(7), checkOut: isoDate(11) },
  ];
  const steps: Step[] = [];

  const hotelJobs = CITIES.slice(0, budget.hotels).flatMap((city) =>
    stayWindows.map((window) => warmAccommodation("hotel", city, window.checkIn, window.checkOut, 2)),
  );
  const stayJobs = STAY_CITIES.slice(0, budget.stays).flatMap((city) =>
    stayWindows.map((window) => warmAccommodation("stay", city, window.checkIn, window.checkOut, 2)),
  );
  /**
   * Ticket searches run one after another, not all at once: a provider that
   * answers six parallel crawls slowly answers one quickly, and the whole job
   * must finish inside the serverless time limit instead of being killed
   * half-way (which is exactly what produced a 500 on the live site).
   */
  const plan: { mode: "plane" | "train" | "bus"; origin: string; destination: string; date: string }[] = ROUTES.flatMap((route) =>
    TICKET_DAYS.map((day) => ({ ...route, date: isoDate(day) })),
  );
  const skip = Math.max(0, Math.round(Number(request.nextUrl.searchParams.get("skip")) || budget.skip || 0));
  const transportPlan: Step[] = [];
  let transportCount = 0;
  for (const job of plan.slice(skip)) {
    if (transportCount >= budget.transports) break;
    transportCount += 1;
    transportPlan.push(await warmTransport(job.mode, job.origin, job.destination, job.date));
    await nap(150);
    if (Date.now() - started > 40_000) break;
  }
  const poiJobs = CITIES.slice(0, budget.pois).map((city) => warmPois(city));
  // Only the two biggest origins per call: the job must stay inside the limit.
  const packageJobs = PACKAGE_ORIGINS.slice(0, budget.packages ?? 2).map((origin) => warmPackages(origin));

  const settled = await Promise.allSettled([...hotelJobs, ...stayJobs, ...poiJobs, ...packageJobs]);
  settled.forEach((item) => {
    if (item.status === "fulfilled") steps.push(item.value);
    else steps.push({ label: "unknown", result: "failed", ms: 0 });
  });
  steps.push(...transportPlan);

  return NextResponse.json({
    success: true,
    ranFor: `${Date.now() - started}ms`,
    window: { stays: stayWindows, ticketDays: TICKET_DAYS.map(isoDate) },
    nextSkip: skip + transportCount < plan.length ? skip + transportCount : 0,
    summary: {
      refreshed: steps.filter((step) => step.result === "refreshed").length,
      kept: steps.filter((step) => step.result === "kept").length,
      failed: steps.filter((step) => step.result === "failed").length,
    },
    steps,
    note: "این کار فقط نسخهٔ ذخیره‌شدهٔ داده‌های عمومی منابع را تازه می‌کند؛ هیچ داده‌ای ساخته یا جایگزین نمی‌شود.",
  });
}
