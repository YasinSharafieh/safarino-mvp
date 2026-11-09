import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA = "Mozilla/5.0 (compatible; Safarino/1.0; +https://safarino-mvp.vercel.app)";

async function probe(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, {
      ...init,
      headers: { "User-Agent": UA, Accept: "application/json,text/html", ...(init?.headers ?? {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    return { url: url.replace("https://service.safar724.com", "S724").replace("https://www.safar724.com", "W724"), status: response.status, body: text.slice(0, 400) };
  } catch (error) {
    return { url, status: 0, error: String(error).slice(0, 120) };
  }
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const date = typeof body.date === "string" ? body.date : "1405-08-29";
  const origin = typeof body.origin === "string" ? body.origin : "113000";
  const destination = typeof body.destination === "string" ? body.destination : "113500";

  const searches = await Promise.all([
    probe(`https://service.safar724.com/cs/api/train/route?date=${date}&origin=${origin}&destination=${destination}&vehicleType=Train`),
    probe(`https://service.safar724.com/cs/api/bus/route?date=${date}&origin=${origin}&destination=${destination}&vehicleType=Train`),
    probe(`https://service.safar724.com/cs/api/flight/route?date=${date}&origin=${origin}&destination=${destination}&vehicleType=Plane`),
    probe(`https://service.safar724.com/cs/api/bus/route?date=${date}&origin=${origin}&destination=${destination}&vehicleType=Bus`),
    probe(`https://service.safar724.com/cs/api/route?date=${date}&origin=${origin}&destination=${destination}`),
    probe(`https://www.safar724.com/bus/tehran-mashhad`),
    probe(`https://www.safar724.com/train/tehran-mashhad`),
  ]);

  return NextResponse.json({ date, searches });
}
