import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("src") || "";
  let imageUrl: URL;
  try {
    imageUrl = new URL(source);
  } catch {
    return NextResponse.json({ success: false, error: "آدرس تصویر معتبر نیست." }, { status: 400 });
  }
  const allowedHost =
    imageUrl.hostname === "cdn.alibaba.ir" && /^\/(?:static\/img|ostorage)\//.test(imageUrl.pathname) ||
    imageUrl.hostname === "cdn.jabama.com" && imageUrl.pathname.startsWith("/image/");
  if (
    source.length > 4096 || imageUrl.protocol !== "https:" || imageUrl.username || imageUrl.password || imageUrl.port ||
    !allowedHost || !/\.(?:png|jpe?g|webp)$/i.test(imageUrl.pathname)
  ) {
    return NextResponse.json({ success: false, error: "آدرس تصویر معتبر نیست." }, { status: 400 });
  }

  try {
    const response = await fetch(imageUrl.toString(), {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*" },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 86_400 },
    });
    if (!response.ok) throw new Error("ASSET_NOT_FOUND");
    const contentType = response.headers.get("content-type") || "";
    const length = Number(response.headers.get("content-length") || 0);
    if (!contentType.startsWith("image/") || length > 3_000_000) throw new Error("INVALID_ASSET");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 3_000_000) throw new Error("ASSET_TOO_LARGE");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "تصویر دریافت نشد." }, { status: 404 });
  }
}
