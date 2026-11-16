import { NextRequest, NextResponse } from "next/server";
import { alibabaRequest } from "@/lib/alibaba-flights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** TEMPORARY diagnostics: what does the train provider really send back? */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") || "";
  const origin = request.nextUrl.searchParams.get("origin") || "THR";
  const destination = request.nextUrl.searchParams.get("destination") || "MHD";
  const out: Record<string, unknown> = {};
  try {
    const started = (await alibabaRequest("v2/train/available", {
      body: {
        departureDate: date,
        origin,
        destination,
        passengerCount: 2,
        isExclusiveCompartment: false,
        ticketType: "Family",
      },
    })) as Record<string, unknown>;
    out.startKeys = Object.keys(started || {});
    out.requestId = started?.requestId ?? null;
    out.startSample = JSON.stringify(started).slice(0, 400);
    const id = started?.requestId;
    if (id !== undefined) {
      const result = (await alibabaRequest(`v2/train/available/${id}`)) as Record<string, unknown>;
      out.resultKeys = Object.keys(result || {});
      out.isCompleted = result?.isCompleted;
      for (const key of ["departing", "returning", "trains", "items", "data"]) {
        const value = (result as Record<string, unknown>)?.[key];
        if (Array.isArray(value)) {
          out[`${key}Count`] = value.length;
          out[`${key}First`] = JSON.stringify(value[0]).slice(0, 900);
        }
      }
    }
  } catch (error) {
    out.error = error instanceof Error ? error.message : String(error);
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
