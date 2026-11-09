import { NextRequest, NextResponse } from "next/server";
import { searchFadakTrains } from "../../../../../lib/fadak-train";
import { searchAlibabaTrains } from "../../../../../lib/alibaba-ground";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const date = typeof body.date === "string" ? body.date : "2026-11-20";
  const pageUrl = "https://www.fadaktrains.com/train/mashhad/tehran-mashhad";

  const raw = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Safarino/1.0)", Accept: "text/html" }, cache: "no-store" }).catch((error) => ({ status: 0, text: async () => `FETCH_FAIL ${String(error)}` } as Response));
  const html = await raw.text();
  const nextData = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  let pageProps: Record<string, unknown> | null = null;
  try {
    pageProps = nextData ? (JSON.parse(nextData[1]) as { props?: { pageProps?: Record<string, unknown> } }).props?.pageProps ?? null : null;
  } catch { pageProps = { parseError: true }; }

  const [fadak, alibaba] = await Promise.all([
    searchFadakTrains("THR", "MHD", date).catch((error) => ({ error: String(error) })),
    searchAlibabaTrains({ origin: "THR", destination: "MHD", date, adults: 2, children: 0, infants: 0 }).catch((error) => ({ error: String(error) })),
  ]);

  const apiPaths = Array.from(new Set((html.match(/\/api\/[a-zA-Z0-9/_\-\.\?=&{}]+/g) ?? []).map((value) => value.slice(0, 90)))).slice(0, 25);
  const fadakHosts = Array.from(new Set((html.match(/https?:\/\/[a-zA-Z0-9.\-]*fadak[a-zA-Z0-9.\-]*/g) ?? []))).slice(0, 15);
  const legacyGround = await fetch("https://safarino-mvp.vercel.app/api/providers/alibaba/ground", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "train", origin: "THR", destination: "MHD", date, adults: 2, children: 0, infants: 0 }),
  }).then(async (response) => ({ status: response.status, body: (await response.text()).slice(0, 300) })).catch((error) => ({ status: 0, body: String(error) }));

  const variants = [
    pageUrl,
    `${pageUrl}?date=2026-11-20`,
    `${pageUrl}?date=1405-08-29`,
    `${pageUrl}?goingDate=2026-11-20`,
    `${pageUrl}/2026-11-20`,
  ];
  const variantResults = await Promise.all(variants.map(async (url) => {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; Safarino/1.0)", Accept: "text/html" }, cache: "no-store" });
      const text = await response.text();
      const data = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(text);
      let length = null;
      let dates: string[] = [];
      try {
        const props = data ? (JSON.parse(data[1]) as { props?: { pageProps?: { available?: unknown[] } } }).props?.pageProps : null;
        length = Array.isArray(props?.available) ? props!.available!.length : null;
        dates = Array.isArray(props?.available) ? Array.from(new Set((props!.available as { goingExitDate?: string }[]).map((row) => row.goingExitDate ?? ""))).slice(0, 3) : [];
      } catch { length = -1; }
      return { url: url.replace("https://www.fadaktrains.com", ""), status: response.status, available: length, dates };
    } catch (error) {
      return { url, status: 0, error: String(error) };
    }
  }));

  const chunks = Array.from(new Set((html.match(/\/_next\/static\/chunks\/[a-zA-Z0-9._\-]+\.js/g) ?? []))).slice(0, 8);
  const chunkHits: string[] = [];
  await Promise.all(chunks.map(async (chunk) => {
    try {
      const response = await fetch(`https://www.fadaktrains.com${chunk}`, { cache: "no-store" });
      if (!response.ok) return;
      const code = await response.text();
      for (const match of code.match(/["'`](\/api\/[a-zA-Z0-9/_\-\.]+)["'`]/g) ?? []) chunkHits.push(match.replace(/["'`]/g, ""));
      for (const match of code.match(/https?:\/\/[a-zA-Z0-9.\-]*(api|gw)[a-zA-Z0-9.\-]*/g) ?? []) chunkHits.push(match);
    } catch {}
  }));

  return NextResponse.json({
    variantResults,
    chunkHits: Array.from(new Set(chunkHits)).slice(0, 30),
    apiPaths,
    fadakHosts,
    legacyGround,
    date,
    httpStatus: raw.status,
    htmlLength: html.length,
    heading: (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "").replace(/<[^>]+>/g, " ").trim().slice(0, 120),
    hasNextData: Boolean(nextData),
    pagePropKeys: pageProps ? Object.keys(pageProps) : [],
    route: pageProps?.route ?? null,
    availableLength: Array.isArray(pageProps?.available) ? (pageProps?.available as unknown[]).length : null,
    availableSample: Array.isArray(pageProps?.available) ? (pageProps?.available as unknown[]).slice(0, 2) : null,
    calendarSample: Array.isArray(pageProps?.calendarDates) ? (pageProps?.calendarDates as unknown[]).slice(0, 4) : null,
    cardCount: (html.match(/available-card/g) ?? []).length,
    fadak,
    alibaba: alibaba && typeof alibaba === "object" && "error" in alibaba ? alibaba : { count: (alibaba as { count?: number }).count, sample: (alibaba as { offers?: unknown[] }).offers?.slice(0, 2) },
  });
}
