import { NextRequest, NextResponse } from "next/server";
import { searchMultiProviderAccommodation } from "../../../../lib/accommodation-search";
import { searchAlibabaFlights } from "../../../../lib/alibaba-flights";
import { searchAlibabaBuses, searchAlibabaTrains } from "../../../../lib/alibaba-ground";
import { searchSafar724Buses } from "../../../../lib/safar724-bus";
import { searchCityPois } from "../../../../lib/poi-search";
import { readFreshSnapshot, snapshotKey, writeSnapshot } from "../../../../lib/snapshot-store";
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
const STAY_CITIES = ["رامسر", "مشهد", "شیراز", "تهران", "ماسوله", "کیش"];
const ROUTES: { mode: "plane" | "train" | "bus"; origin: string; destination: string }[] = [
  { mode: "plane", origin: "THR", destination: "MHD" },
  { mode: "plane", origin: "THR", destination: "SYZ" },
  { mode: "train", origin: "THR", destination: "MHD" },
  { mode: "bus", origin: "THR", destination: "MHD" },
];

function isoDate(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
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

async function warmTransport(mode: "plane" | "train" | "bus", origin: string, destination: string, date: string): Promise<Step> {
  const started = Date.now();
  const base = snapshotKey("transport", { mode, origin, destination, date, returnDate: "", adults: 1, children: 0, infants: 0 });
  try {
    if (mode === "plane") {
      const flights = await searchAlibabaFlights({ origin, destination, date, adults: 1, children: 0, infants: 0 });
      if (!flights.flights?.length) return { label: `${mode}:${origin}-${destination}`, result: "kept", ms: Date.now() - started };
    } else if (mode === "train") {
      const trains = await searchAlibabaTrains({ origin, destination, date, adults: 1, children: 0, infants: 0 });
      if (!trains.offers?.length) return { label: `${mode}:${origin}-${destination}`, result: "kept", ms: Date.now() - started };
    } else {
      const [busA, busS] = await Promise.all([
        searchAlibabaBuses({ origin, destination, date, adults: 1, children: 0, infants: 0 }).catch(() => null),
        searchSafar724Buses(origin, destination, date).catch(() => null),
      ]);
      const count = (busA?.offers?.length || 0) + (busS?.offers?.length || 0);
      if (count > 0) await writeSnapshot(base, { warm: true, count }, 1_200, 43_200);
      return { label: `${mode}:${origin}-${destination}`, result: count > 0 ? "refreshed" : "kept", ms: Date.now() - started };
    }
    return { label: `${mode}:${origin}-${destination}`, result: "refreshed", ms: Date.now() - started };
  } catch {
    return { label: `${mode}:${origin}-${destination}`, result: "failed", ms: Date.now() - started };
  }
}

async function warmPois(city: string): Promise<Step> {
  const started = Date.now();
  const base = snapshotKey("pois", { city, limit: 24 });
  try {
    const existing = await readFreshSnapshot<Record<string, unknown>>(base);
    if (existing) return { label: `pois:${city}`, result: "kept", ms: Date.now() - started };
    const result = await searchCityPois(city, 24);
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

export async function GET(request: NextRequest) {
  return run(request, { hotels: 3, stays: 2, transports: 2, pois: 4 });
}

export async function POST(request: NextRequest) {
  return run(request, { hotels: 6, stays: 4, transports: 4, pois: 8 });
}

/**
 * `budget*` bounds how much work one call does, so the job always finishes
 * inside the serverless time limit; the next call continues where it stopped.
 */
async function run(request: NextRequest, budget: { hotels: number; stays: number; transports: number; pois: number }) {
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
  const checkIn = isoDate(3);
  const checkOut = isoDate(6);
  const steps: Step[] = [];

  const hotelJobs = CITIES.slice(0, budget.hotels).map((city) => warmAccommodation("hotel", city, checkIn, checkOut, 3));
  const stayJobs = STAY_CITIES.slice(0, budget.stays).map((city) => warmAccommodation("stay", city, checkIn, checkOut, 3));
  const transportJobs = ROUTES.slice(0, budget.transports).map((route) => warmTransport(route.mode, route.origin, route.destination, isoDate(3)));
  const poiJobs = CITIES.slice(0, budget.pois).map((city) => warmPois(city));

  const settled = await Promise.allSettled([...hotelJobs, ...stayJobs, ...transportJobs, ...poiJobs]);
  settled.forEach((item) => {
    if (item.status === "fulfilled") steps.push(item.value);
    else steps.push({ label: "unknown", result: "failed", ms: 0 });
  });

  return NextResponse.json({
    success: true,
    ranFor: `${Date.now() - started}ms`,
    window: { checkIn, checkOut },
    summary: {
      refreshed: steps.filter((step) => step.result === "refreshed").length,
      kept: steps.filter((step) => step.result === "kept").length,
      failed: steps.filter((step) => step.result === "failed").length,
    },
    steps,
    note: "این کار فقط نسخهٔ ذخیره‌شدهٔ داده‌های عمومی منابع را تازه می‌کند؛ هیچ داده‌ای ساخته یا جایگزین نمی‌شود.",
  });
}
