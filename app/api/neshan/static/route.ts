import { NextRequest, NextResponse } from "next/server";
import { neshanApiKey } from "../../../../lib/neshan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Real map image of one point, from Neshan's static map service.
 * The key stays on the server; the browser only sees the picture.
 * Used as the visual for a place that has no photograph of its own.
 */
export async function GET(request: NextRequest) {
  const key = neshanApiKey();
  if (!key) return NextResponse.json({ success: false, error: "کلید نشان تنظیم نشده است." }, { status: 503 });

  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
    return NextResponse.json({ success: false, error: "مختصات معتبر نیست." }, { status: 400 });
  }
  const zoom = Math.min(17, Math.max(11, Number(request.nextUrl.searchParams.get("zoom")) || 15));
  const width = Math.min(800, Math.max(200, Number(request.nextUrl.searchParams.get("w")) || 400));
  const height = Math.min(600, Math.max(150, Number(request.nextUrl.searchParams.get("h")) || 250));

  const url =
    `https://api.neshan.org/v5/static?latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}` +
    `&zoom=${zoom}&width=${width}&height=${height}&type=standard-day&marker=red`;

  try {
    const response = await fetch(url, {
      headers: { "Api-Key": key, Accept: "image/png" },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`NESHAN_STATIC_${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) throw new Error("NESHAN_STATIC_NOT_IMAGE");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 2_000_000) throw new Error("NESHAN_STATIC_TOO_LARGE");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // Never leave a broken picture in the page: a plain, clearly non-photo tile.
    const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#0b1a26"/><g fill="none" stroke="#1e4b60" stroke-width="2"><path d="M0 ${height * 0.3} H${width} M0 ${height * 0.65} H${width} M${width * 0.25} 0 V${height} M${width * 0.7} 0 V${height}"/></g><text x="50%" y="52%" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(width / 22)}" fill="#7dd3fc">نقشه در دسترس نیست</text></svg>`;
    return new NextResponse(placeholder, {
      headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
    });
  }
}
