import { NextResponse } from "next/server";
import { INLINE_URL_LIMIT, compactTrip, encodeTripToToken, saveSharedTrip } from "@/lib/share";

/**
 * Makes a shareable link for the plan the traveller is looking at.
 * Short code first; if the store is unavailable the plan travels inside the
 * link itself, so sharing still works and still shows the same numbers.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "درخواست معتبر نبود." }, { status: 400 });
  }

  const trip = compactTrip(body);
  if (!trip) {
    return NextResponse.json({ success: false, error: "برنامه‌ای برای اشتراک‌گذاری پیدا نشد." }, { status: 400 });
  }

  const code = await saveSharedTrip(trip);
  const origin = new URL(request.url).origin;

  if (code) {
    return NextResponse.json({
      success: true,
      mode: "short",
      code,
      url: `${origin}/s/${code}`,
      summary: trip,
      note: "این لینک یک تصویر ثابت از برنامه است؛ هر کسی آن را باز کند همین روزها و همین عددها را می‌بیند.",
    });
  }

  const token = encodeTripToToken(trip);
  const url = `${origin}/s/inline?d=${token}`;
  if (url.length > INLINE_URL_LIMIT) {
    return NextResponse.json({
      success: false,
      error: "برنامه برای لینک بدون سرور خیلی بزرگ است. کمی از توضیح‌ها یا روزها را کم کنید و دوباره امتحان کنید.",
    }, { status: 503 });
  }
  return NextResponse.json({
    success: true,
    mode: "inline",
    code: null,
    url,
    summary: trip,
    note: "حافظهٔ سرور در دسترس نبود، پس کل برنامه داخل خودِ لینک گذاشته شد؛ همان برنامه، لینک بلندتر.",
  });
}
