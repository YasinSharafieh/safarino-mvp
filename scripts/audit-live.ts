/**
 * «آیا واقعاً کار می‌کند؟» — the live sweep.
 *
 * The static audit proves the addresses exist; this one calls them on the real
 * deployment and reports what came back. Every probe carries a payload that a
 * real traveller's browser would send, and the verdict is read from the answer
 * itself (`success`, an HTTP code, or a named failure), never assumed.
 *
 * Bills are kept to almost nothing: the AI probes are two of the cheapest calls,
 * the rest are cache reads and public data.
 *
 *   node --import tsx scripts/audit-live.ts [base-url]
 */

const BASE = (process.argv[2] || "https://safarino-mvp.vercel.app").replace(/\/$/, "");

type Probe = {
  name: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  /** What a healthy answer looks like, in words. */
  expect: string;
  ok: (payload: any, status: number) => boolean;
  skip?: boolean;
};

const TEHRAN = { latitude: 35.6892, longitude: 51.389 };
const SHIRAZ = { latitude: 29.5918, longitude: 52.5837 };

const probes: Probe[] = [
  { name: "سلامت سرویس", path: "/api/health", expect: "وضعیت ok", ok: (p, s) => s === 200 && (p?.status === "ok" || p?.success === true) },
  { name: "پرسش‌های آزمون سلیقه", path: "/api/quiz/questions", method: "POST", body: { origin: "تهران", travellers: 2, token: "audit", seen: [] }, expect: "۱۲ سؤال، هر کدام با گزینه‌ها", ok: (p, s) => s === 200 && Array.isArray(p?.questions) && p.questions.length >= 10 && p.questions.every((q: any) => Array.isArray(q?.options) && q.options.length >= 2) },
  {
    name: "تحلیل سلیقه",
    path: "/api/quiz/analyze",
    method: "POST",
    body: { answers: { "۱": "تاریخی", "۲": "آرام", "۳": "خانوادگی", "۴": "طبیعت" }, budgetMillions: 20, days: 3, travellers: 2 },
    expect: "چند شهر پیشنهادی",
    ok: (p, s) => s === 200 && (Array.isArray(p?.cities) || Array.isArray(p?.suggestions) || p?.success === true),
  },
  {
    name: "بلیت: قطار تهران–مشهد",
    path: "/api/providers/transport/search",
    method: "POST",
    body: { origin: "تهران", destination: "مشهد", date: nextDate(10), mode: "train", travellers: 2 },
    expect: "فهرست پیشنهاد یا پاسخ «چیزی پیدا نشد» با پیام روشن",
    ok: (p, s) => s === 200 && (Array.isArray(p?.offers) || typeof p?.note === "string" || p?.success === false),
  },
  {
    name: "اقامت: هتل مشهد",
    path: "/api/providers/accommodation/search",
    method: "POST",
    body: { kind: "hotel", city: "مشهد", checkIn: nextDate(10), checkOut: nextDate(12), adults: 2, childAges: [], infantAges: [] },
    expect: "فهرست هتل یا پاسخ روشن",
    ok: (p, s) => s === 200 && (Array.isArray(p?.groups) || Array.isArray(p?.offers) || typeof p?.note === "string"),
  },
  {
    name: "جاذبه‌های واقعی شیراز",
    path: "/api/providers/pois/search",
    method: "POST",
    body: { city: "شیراز", limit: 12 },
    expect: "جاذبه با مختصات",
    ok: (p, s) => s === 200 && Array.isArray(p?.pois) && p.pois.length > 0 && Number.isFinite(Number(p.pois[0]?.latitude)),
  },
  {
    name: "فاصلهٔ واقعی دو نقطه",
    path: "/api/route/distance",
    method: "POST",
    body: { origin: "تهران", destination: "شیراز" },
    expect: "کیلومتر و دقیقه",
    ok: (p, s) => s === 200 && Number(p?.distanceKm) > 0,
  },
  {
    name: "فاصله از اقامتگاه تا جاذبه‌ها",
    path: "/api/route/poi-distances",
    method: "POST",
    body: { origin: SHIRAZ, targets: [{ id: "a", ...SHIRAZ }] },
    expect: "یک ردیف اندازه‌گیری‌شده",
    ok: (p, s) => s === 200 && Array.isArray(p?.entries),
  },
  {
    name: "هوای روزهای سفر",
    path: "/api/weather/trip",
    method: "POST",
    body: { city: "شیراز", startDate: nextDate(2), days: 3 },
    expect: "پیش‌بینی یا میانگین چندساله",
    ok: (p, s) => s === 200 && (Array.isArray(p?.days) || p?.success === true),
  },
  {
    name: "پیشنهادهای ویژهٔ خانه",
    // A real page load from Tehran: the same query the home page sends.
    path: "/api/deals?from=%D8%AA%D9%87%D8%B1%D8%A7%D9%86",
    expect: "بستهٔ سفر واقعی یا پیام روشن",
    ok: (p, s) => s === 200 && p?.success === true && (Array.isArray(p?.packages) || typeof p?.note === "string"),
  },
  {
    name: "نقشهٔ کشف مقصد",
    path: "/api/discover/map?city=%D8%B4%DB%8C%D8%B1%D8%A7%D8%B2",
    expect: "ریدایرکت به تصویر نقشهٔ خودمان",
    ok: (_p, s) => s === 307 || s === 200,
  },
  {
    name: "نظرات مسافران",
    path: "/api/reviews",
    expect: "فهرست (حتی خالی) و میانگین",
    ok: (p, s) => s === 200 && Array.isArray(p?.reviews),
  },
  {
    name: "ساخت لینک اشتراکی",
    path: "/api/share",
    method: "POST",
    body: {
      v: 1,
      city: "شیراز",
      createdAt: new Date().toISOString(),
      days: [
        {
          day: 1,
          title: "روز اول",
          theme: "تاریخی",
          stops: [
            {
              place: { id: "hafez", name: "حافظیه", category: "آرامگاه", latitude: 29.6256, longitude: 52.5585, description: "" },
              order: 1,
              startTime: "۰۹:۰۰",
              visitMinutes: 60,
              legKm: 2,
              legMinutes: 8,
              legEngine: "آزمون",
            },
          ],
          totalKm: 2,
          totalDriveMinutes: 8,
          area: "شیراز",
          lunchAfter: 1,
        },
      ],
      totals: { km: 2, driveMinutes: 8, stops: 1, days: 1 },
      engine: "آزمون",
      note: "آزمون",
    },
    expect: "کد کوتاه و لینک",
    ok: (p, s) => s === 200 && p?.success === true && typeof p?.url === "string",
  },
  {
    name: "کپشن استوری",
    path: "/api/trip/caption",
    method: "POST",
    body: { input: { destination: "شیراز", days: 2, travellers: 2, topPlaces: ["حافظیه"] } },
    expect: "متن کپشن",
    ok: (p, s) => s === 200 && typeof p?.caption === "string" && p.caption.length > 10,
  },
  {
    name: "پیشنهاد قیمت بدنهٔ نامعتبر را رد می‌کند",
    path: "/api/trip/caption",
    method: "POST",
    body: { input: {} },
    expect: "پاسخ ۴۰۰ با پیام فارسی",
    ok: (p, s) => s === 400 && typeof p?.error === "string",
  },
  {
    name: "همسفر: پیشنهاد در صفحه",
    path: "/api/companion/suggest",
    method: "POST",
    body: {
      facts: { stage: "transport", origin: "تهران", destination: "مشهد", days: 3, travellers: 2, budgetToman: 20_000_000, committedToman: 0, dailyToman: 0 },
      options: [
        { id: "t1", title: "قطار تهران–مشهد · ۴ نفره", priceToman: 2_400_000, detail: "شرکت رجا" },
        { id: "t2", title: "اتوبوس VIP", priceToman: 1_600_000, detail: "شرکت سیروسفر" },
      ],
    },
    expect: "یک پیشنهاد با شناسهٔ واقعی",
    ok: (p, s) => s === 200 && p?.success === true && Boolean(p?.advice?.optionId) && (typeof p?.advice?.reason === "string" || typeof p?.advice?.text === "string"),
  },
];

function nextDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function run(): Promise<void> {
  console.log(`ممیزی زنده — ${BASE}\n`);
  let failed = 0;
  for (const probe of probes) {
    const started = Date.now();
    let status = 0;
    let payload: any = null;
    let raw = "";
    try {
      const response = await fetch(`${BASE}${probe.path}`, {
        method: probe.method || "GET",
        headers: probe.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: probe.method === "POST" ? JSON.stringify(probe.body ?? {}) : undefined,
        signal: AbortSignal.timeout(45_000),
      });
      status = response.status;
      raw = await response.text();
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }
    } catch (error) {
      raw = String(error);
    }
    const ms = Date.now() - started;
    let ok = false;
    try {
      ok = probe.ok(payload, status);
    } catch {
      ok = false;
    }
    if (!ok) failed += 1;
    const detail = ok
      ? `${ms}ms`
      : `HTTP ${status} · ${(raw || "").slice(0, 160)}`;
    console.log(`  ${ok ? "ok  " : "fail"} ${probe.name} — ${detail}`);
    if (!ok) console.log(`        انتظار: ${probe.expect}`);
  }
  console.log(failed ? `\n❌ ${failed} بررسی زنده شکست خورد` : `\n✅ همهٔ ${probes.length} مسیر زنده پاسخ درست دادند`);
  process.exit(failed ? 1 : 0);
}

void run();
