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

  return NextResponse.json({
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
