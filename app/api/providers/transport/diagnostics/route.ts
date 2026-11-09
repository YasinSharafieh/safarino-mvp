import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA = "Mozilla/5.0 (compatible; Safarino/1.0; +https://safarino-mvp.vercel.app)";

async function probe(label: string, url: string) {
  try {
    const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "json,text/html" }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
    const text = await response.text();
    return {
      label,
      status: response.status,
      length: text.length,
      hasNextData: /__NEXT_DATA__/.test(text),
      hasNuxt: /__NUXT__/.test(text),
      jsonLike: text.trim().startsWith("{") || text.trim().startsWith("["),
      head: text.slice(0, 200).replace(/\s+/g, " "),
    };
  } catch (error) {
    return { label, status: 0, error: String(error).slice(0, 90) };
  }
}

export async function GET() {
  const targets: [string, string][] = [
    ["mrbilit-train", "https://www.mrbilit.com/train/tehran-mashhad"],
    ["mrbilit-api", "https://api.mrbilit.com/api/v1/train/search"],
    ["ghasedak24", "https://www.ghasedak24.com/"],
    ["raja", "https://www.raja.ir/"],
    ["snapptrip-flight-host", "https://hapi.snapptrip.com/flight/api/v1/search"],
    ["safar724-bus-json", "https://service.safar724.com/cs/api/bus/route?date=1405-08-29&origin=113000&destination=113500&vehicleType=Bus"],
  ];
  const results = await Promise.all(targets.map(([label, url]) => probe(label, url)));
  return NextResponse.json({ results });
}
