import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED_HOSTS = ["www.raja.ir", "raja.ir", "mrbilit.com", "www.mrbilit.com", "safarmarket.com", "www.safarmarket.com"];

/** Temporary inspection helper: reads a public provider page from the server to see whether fares are published. */
export async function POST(request: NextRequest) {
  let body: { url?: string; pattern?: string; mode?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "bad json" }, { status: 400 });
  }
  const target = String(body.url || "");
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ success: false, error: "bad url" }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ success: false, error: "host not allowed" }, { status: 400 });
  }
  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    const text = await response.text();
    const mode = String(body.mode || "");
    const pattern = String(body.pattern || "");
    let matches: string[] = [];
    let links: string[] = [];
    if (pattern) {
      try {
        const expression = new RegExp(pattern, "g");
        let found = expression.exec(text);
        let guard = 0;
        while (found && guard < 40) {
          matches.push(found[0].slice(0, 300));
          found = expression.exec(text);
          guard += 1;
        }
      } catch {
        matches = ["bad pattern"];
      }
    }
    if (mode === "links") {
      const anchor = /href="([^"]{4,200})"/g;
      let found = anchor.exec(text);
      let guard = 0;
      const seen = new Set<string>();
      while (found && guard < 4000) {
        const href = found[1];
        if (/train/i.test(href) && !seen.has(href)) {
          seen.add(href);
          links.push(href);
        }
        found = anchor.exec(text);
        guard += 1;
      }
      links = links.slice(0, 40);
    }
    return NextResponse.json({
      success: true,
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      length: text.length,
      priceLike: (text.match(/\d{6,9}/g) || []).slice(0, 20),
      matches,
      links,
      head: matches.length || links.length ? "" : text.slice(0, 2500),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "fetch failed" }, { status: 502 });
  }
}
