import { NextResponse } from "next/server";
import { getProviderCache, providerStorageHealthy } from "../../../lib/provider-cache";
import { freshnessOf, topDemand } from "../../../lib/freshness";
import { TRANSPORT_FRESH_SECONDS } from "../../../lib/transport-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `GET /api/status` — «سایت الان چقدر تازه است؟»
 *
 * The owner's rule is that the site must always be current, and a rule the
 * traveller cannot check is only a promise. This endpoint reports, in public
 * terms, when the store was last warmed, which sources answer, and what the site
 * is being asked for right now — never a key, never a user, never a guess. It is
 * safe to be public: it contains counts and route codes only.
 */
export async function GET() {
  const [storage, lastWarm, demand] = await Promise.all([
    providerStorageHealthy(),
    getProviderCache<string>("safarino:warm-lock"),
    topDemand("ticket", 5),
  ]);

  const warmFreshness = freshnessOf("ticket", lastWarm || null);
  const openRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const upstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  return NextResponse.json(
    {
      success: true,
      checkedAt: new Date().toISOString(),
      sources: {
        alibaba: { label: "علی‌بابا", serves: "بلیت قطار، هواپیما، اتوبوس و هتل" },
        safar724: { label: "سفر۷۲۴", serves: "بلیت اتوبوس" },
        stays: { label: "جاباما · جاجیگا · اتاقک · اقامت۲۴", serves: "اقامتگاه و هتل" },
        neshan: { label: "نشان", serves: "مسیر، فاصله و ترافیک", configured: Boolean(process.env.NESHAN_API_KEY) },
        weather: { label: "Open-Meteo", serves: "هوای روزهای سفر" },
      },
      freshness: {
        ticketMinutes: Math.round(TRANSPORT_FRESH_SECONDS / 60),
        roomMinutes: 30,
        warmUp: "هر ۶ ساعت، به‌علاوهٔ گرم‌کردن تقاضامحور برای مسیرهایی که واقعاً جست‌وجو شده‌اند",
        lastWarmAt: lastWarm || null,
        lastWarmLabel: warmFreshness.label,
      },
      demand: {
        /** Only what was searched — never who searched it. */
        recent: demand.map((entry) => ({ key: entry.key.split("|")[1] || "", hits: entry.hits })),
        note: "این فهرست پاسخ‌های پرتقاضاست، نه کاربران؛ هیچ شناسه‌ای از مسافر ذخیره نمی‌شود.",
      },
      health: {
        providerStorage: storage,
        ai: openRouter ? "configured" : "off",
        cache: upstash ? "configured" : "off",
      },
      note: "همهٔ قیمت‌ها از منابع خودشان خوانده می‌شوند؛ سفرینو چیزی نمی‌سازد و ذخیره‌گاه فقط کش است.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
