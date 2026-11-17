import { NextRequest, NextResponse } from "next/server";
import { searchTransport } from "@/lib/transport-search";
import { searchMultiProviderAccommodation } from "@/lib/accommodation-search";
import { describeFindings, inspectAccommodation, inspectTransport, type Finding } from "@/lib/data-inspector";
import { priceWatchKey, recordPrice } from "@/lib/price-watch";
import { addDays } from "@/lib/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * «بازرس شبانه» — the daily job that reads our own output and writes down what
 * is wrong with it.
 *
 * It crawls a small, fixed sample of real searches (nothing user-specific), runs
 * the data checks, records the cheapest price of each one for the price watch,
 * and returns a report a human can read. It never edits or deletes data, so a
 * bad run cannot break the site; it can only tell us.
 */

const ROUTES: { mode: "plane" | "train" | "bus"; origin: string; destination: string; label: string }[] = [
  { mode: "plane", origin: "تهران", destination: "مشهد", label: "هواپیما تهران–مشهد" },
  { mode: "train", origin: "تهران", destination: "مشهد", label: "قطار تهران–مشهد" },
  { mode: "bus", origin: "تهران", destination: "اصفهان", label: "اتوبوس تهران–اصفهان" },
  { mode: "plane", origin: "تهران", destination: "کیش", label: "هواپیما تهران–کیش" },
];

const STAYS = [
  { city: "مشهد", label: "اقامت مشهد" },
  { city: "اصفهان", label: "اقامت اصفهان" },
];

function tomorrow(): string {
  return addDays(new Date().toISOString().slice(0, 10), 3);
}

export async function GET(request: NextRequest) {
  const token = process.env.CRON_SECRET;
  if (token && request.nextUrl.searchParams.get("secret") !== token) {
    return NextResponse.json({ success: false, error: "اجازه نداری." }, { status: 401 });
  }

  const started = Date.now();
  const findings: Finding[] = [];
  const watched: { label: string; cheapestToman: number | null }[] = [];

  for (const route of ROUTES) {
    try {
      const date = tomorrow();
      const { payload } = await searchTransport({
        mode: route.mode,
        origin: route.origin,
        destination: route.destination,
        date,
        adults: 2,
        children: 0,
        infants: 0,
      });
      findings.push(...inspectTransport(payload).map((finding) => ({ ...finding, message: `${route.label}: ${finding.message}` })));
      const cheapest = payload.offers.length
        ? payload.offers.reduce((best, offer) => Math.min(best, offer.priceToman * 2), Number.POSITIVE_INFINITY)
        : null;
      if (cheapest && Number.isFinite(cheapest)) {
        await recordPrice({
          key: priceWatchKey("transport", {
            mode: route.mode,
            origin: route.origin,
            destination: route.destination,
            date,
            adults: 2,
          }),
          priceToman: cheapest,
          offers: payload.offers.length,
          minGapMinutes: 300,
        });
      }
      watched.push({ label: route.label, cheapestToman: cheapest && Number.isFinite(cheapest) ? Math.round(cheapest) : null });
    } catch {
      findings.push({
        severity: "error",
        area: "transport",
        code: "crawl-failed",
        message: `${route.label}: جست‌وجو خطا داد.`,
        count: 1,
      });
    }
  }

  for (const stay of STAYS) {
    try {
      const checkIn = addDays(new Date().toISOString().slice(0, 10), 4);
      const checkOut = addDays(checkIn, 2);
      const result = await searchMultiProviderAccommodation({
        kind: "hotel",
        city: stay.city,
        checkIn,
        checkOut,
        adults: 2,
        childAges: [],
        infantAges: [],
      });
      findings.push(
        ...inspectAccommodation(result as unknown as { groups?: { offers?: Record<string, unknown>[] }[]; allProvidersFailed?: boolean }).map((finding) => ({
          ...finding,
          message: `${stay.label}: ${finding.message}`,
        })),
      );
      const rooms = ((result as unknown as { groups?: { offers?: { priceTotalToman?: number }[] }[] }).groups || [])
        .flatMap((group) => group.offers || [])
        .map((offer) => Number(offer.priceTotalToman))
        .filter((price) => Number.isFinite(price) && price > 0);
      if (rooms.length) {
        await recordPrice({
          key: priceWatchKey("accommodation", { city: stay.city, checkIn, checkOut, adults: 2, kind: "hotel" }),
          priceToman: Math.min(...rooms),
          offers: rooms.length,
          minGapMinutes: 300,
        });
      }
      watched.push({ label: stay.label, cheapestToman: rooms.length ? Math.min(...rooms) : null });
    } catch {
      findings.push({
        severity: "error",
        area: "accommodation",
        code: "crawl-failed",
        message: `${stay.label}: جست‌وجو خطا داد.`,
        count: 1,
      });
    }
  }

  const errors = findings.filter((finding) => finding.severity === "error").length;
  return NextResponse.json(
    {
      success: errors === 0,
      ranAt: new Date().toISOString(),
      ms: Date.now() - started,
      verdict: describeFindings(findings),
      findings,
      watched,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
