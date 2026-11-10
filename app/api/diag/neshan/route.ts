import { NextRequest, NextResponse } from "next/server";
import { neshanApiKey } from "../../../../lib/neshan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** TEMPORARY probe: which Neshan services answer for the configured key. */
export async function GET(request: NextRequest) {
  const key = neshanApiKey();
  if (!key) return NextResponse.json({ success: false, error: "no key" });
  const lat = request.nextUrl.searchParams.get("lat") || "36.2972";
  const lng = request.nextUrl.searchParams.get("lng") || "59.6067";
  const out: Record<string, unknown> = {};

  async function probe(label: string, url: string, headers: Record<string, string> = {}) {
    try {
      const response = await fetch(url, { headers: { "Api-Key": key, ...headers }, signal: AbortSignal.timeout(8000), cache: "no-store" });
      const text = await response.text();
      out[label] = { status: response.status, type: response.headers.get("content-type"), bytes: text.length, sample: text.slice(0, 260) };
    } catch (error) {
      out[label] = { error: error instanceof Error ? error.message.slice(0, 80) : "failed" };
    }
  }

  for (const layer of ["historical", "interests", "natural_feature"]) {
    await probe(`nearby:${layer}`, `https://api.neshan.org/v1/nearby?location=${lat},${lng}&layer=${layer}&searchRadius=3000`);
  }
  await probe("point", "https://api.neshan.org/v1/point?hash=wXtqMQxZnBicNffFbj37mUMdyo_92YTV2jf6sB110zXQzyjSoSOcPWdzWPU4oEeL8O75AsLHWqHCd22jyD5Tlg");
  await probe("staticA", `https://api.neshan.org/v5/static?center=${lat},${lng}&zoom=15&width=400&height=250&type=standard-day`);
  await probe("staticB", `https://api.neshan.org/v4/static?type=standard-day&center=${lat},${lng}&zoom=15&width=400&height=250&marker=red`);
  await probe("staticC", `https://api.neshan.org/v5/static?center=${lat},${lng}&zoom=15&width=400&height=250&type=standard-night&marker=red`);
  await probe("reverse", `https://api.neshan.org/v5/reverse?lat=${lat}&lng=${lng}`);
  await probe("search", `https://api.neshan.org/v3/search?q=${encodeURIComponent(JSON.stringify({ term: "حرم امام رضا", center: { latitude: Number(lat), longitude: Number(lng) } }))}`);

  // Can our server reach the free photo sources at all?
  await probe("wikidata", "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q2241485&props=claims&format=json");
  await probe("commons", "https://commons.wikimedia.org/wiki/Special:FilePath/Imam%20Reza%20Shrine%202018.jpg?width=640");
  await probe("p18", "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q2241485&props=claims&format=json&formatversion=2");
  await probe("wikiThumb", `https://fa.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent("مسجد گوهرشاد")}`);
  await probe("faWiki", `https://fa.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent("حرم امام رضا")}`);

  return NextResponse.json({ success: true, probes: out });
}
