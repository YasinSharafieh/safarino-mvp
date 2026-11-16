import { NextRequest, NextResponse } from "next/server";
import { alibabaRequest } from "@/lib/alibaba-flights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** TEMPORARY: dump the raw provider rows so the field names can be fixed. */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("mode") || "train";
  const date = request.nextUrl.searchParams.get("date") || "";
  const origin = request.nextUrl.searchParams.get("origin") || "THR";
  const destination = request.nextUrl.searchParams.get("destination") || "MHD";
  const out: Record<string, unknown> = { mode, date };
  try {
    if (mode === "train") {
      const started = (await alibabaRequest("v2/train/available", {
        body: { departureDate: date, origin, destination, passengerCount: 2, isExclusiveCompartment: false, ticketType: "Family" },
      })) as Record<string, unknown>;
      const result = (await alibabaRequest(`v2/train/available/${started?.requestId}`)) as Record<string, unknown>;
      const rows = Array.isArray(result?.departing) ? result.departing : [];
      out.count = rows.length;
      out.first = rows[0];
      out.second = rows[1];
    } else if (mode === "bus") {
      const started = (await alibabaRequest("v2/bus/available", {
        body: { departureDate: date, origin: "THR", destination: "MHD", passengerCount: 2, ticketType: "Family" },
      })) as Record<string, unknown>;
      out.startKeys = Object.keys(started || {});
      const result = (await alibabaRequest(`v2/bus/available/${started?.requestId}`)) as Record<string, unknown>;
      out.resultKeys = Object.keys(result || {});
      const rows = Array.isArray(result?.departing) ? result.departing : [];
      out.count = rows.length;
      out.first = rows[0];
    } else {
      const result = (await alibabaRequest("v3/flight/available", { body: {
        origin, destination, departureDate: date, passengerCount: 2, ticketType: "Family", isExclusive: false, cabinType: "All",
      } })) as Record<string, unknown>;
      out.startKeys = Object.keys(result || {});
      const rows = Array.isArray(result?.departing) ? result.departing : Array.isArray((result as Record<string, unknown>)?.flights) ? (result as Record<string, unknown[]>).flights : [];
      out.count = Array.isArray(rows) ? rows.length : 0;
      out.first = Array.isArray(rows) ? rows[0] : null;
    }
  } catch (error) {
    out.error = error instanceof Error ? error.message : String(error);
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
