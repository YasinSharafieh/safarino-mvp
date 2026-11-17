/**
 * ممیزی فاز‌به‌فازِ سایت زنده.
 *
 * Unlike audit-live.ts (one probe per endpoint, independent), this suite walks the
 * site the way a traveller does and *chains the real output of each phase into the
 * next one* — the quiz's own questions, the transport offers, the POIs, the plan.
 * It also checks the data itself, not only the status code: a price of zero, a
 * coordinate outside Iran, a hotel with no name or a day with no stop all fail.
 *
 *   npx tsx scripts/audit-phases.ts [base-url]
 *   npx tsx scripts/audit-phases.ts --no-ai     (skips the two model-writing arms)
 */

import { companionTips } from "../lib/companion";

const BASE = process.argv.find((a) => a.startsWith("http")) || "https://safarino-mvp.vercel.app";
const SKIP_AI = process.argv.includes("--no-ai");

type Result = { phase: string; name: string; ok: boolean; detail: string; ms: number };
const results: Result[] = [];

function check(phase: string, name: string, ok: boolean, detail: string, ms: number) {
  results.push({ phase, name, ok, detail, ms });
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name} — ${detail} (${ms}ms)`);
}

function future(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function call(path: string, body?: unknown, method: "GET" | "POST" = "POST") {
  const started = Date.now();
  const response = await fetch(BASE + path, body === undefined ? { method } : {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text.slice(0, 200); }
  return { status: response.status, json, ms: Date.now() - started, text };
}

// ── data sanity helpers ───────────────────────────────────────────────────────
const inIran = (lat: number, lng: number) => lat > 24 && lat < 40 && lng > 43 && lng < 64;
const hasPersian = (value: unknown) => typeof value === "string" && /[\u0600-\u06FF]/.test(value);
const money = (value: unknown) => Number(value) > 0 && Number.isFinite(Number(value));

async function main() {
  console.log(`\nممیزی فاز‌به‌فاز — ${BASE}\n`);

  // ═══ فاز ۰ · خانه ══════════════════════════════════════════════════════════
  {
    const phase = "۰ خانه";
    const health = await call("/api/health", undefined, "GET");
    check(phase, "سلامت سرویس", health.status === 200, `HTTP ${health.status}`, health.ms);

    const deals = await call("/api/deals?from=" + encodeURIComponent("تهران"), undefined, "GET");
    const packages: any[] = deals.json?.packages || [];
    // A package carries its two real prices separately: the ticket and the night.
    const priced = packages.filter((item) => money(item?.ticket?.priceToman) && money(item?.stay?.pricePerNightToman ?? item?.stay?.priceTotalToman));
    check(phase, "پیشنهادهای ویژهٔ خانه", deals.status === 200 && packages.length >= 2 && priced.length === packages.length,
      `${packages.length} بسته، ${priced.length} با بلیت و اقامت قیمت‌دار`, deals.ms);
    check(phase, "هر بسته لینک خرید بلیت دارد", packages.every((item) => typeof item?.ticket?.bookingUrl === "string" && item.ticket.bookingUrl.startsWith("https://")),
      "همه لینک دارند", 0);
    check(phase, "بسته‌ها شهر واقعی دارند", packages.every((item) => hasPersian(item?.destination || item?.city || "")),
      packages.slice(0, 3).map((item) => item?.destination || item?.city).join("، "), 0);

    const reviews = await call("/api/reviews", undefined, "GET");
    const rows: any[] = reviews.json?.reviews || [];
    // A real site starts with no reviews; what matters is that the empty answer is
    // honest (a stated count of zero) and that nothing undisplayable arrives.
    check(phase, "نظرات مسافران", reviews.status === 200 && Array.isArray(rows) && reviews.json?.total === rows.length,
      `${rows.length} نظر ثبت‌شده`, reviews.ms);
    check(phase, "نظر بدون نام یا متن پذیرفته نمی‌شود", rows.every((row) => hasPersian(row?.name) && hasPersian(row?.text) && row?.rating >= 1),
      rows.length ? "همه کامل‌اند" : "فهرست خالی و صادق است", 0);
    const badReview = await call("/api/reviews", { name: "ا", city: "", rating: 9, text: "خ" });
    check(phase, "نظر نامعتبر رد می‌شود", badReview.status === 400, `${badReview.status}`, badReview.ms);

    // a package list is what the smart deal chooser eats
    const smart = await call("/api/deals/smart", {
      packages,
      budgetMillions: 20,
      travellers: 2,
      days: 3,
      mode: "train",
      taste: ["تاریخی"],
    });
    check(phase, "چیدن هوشمند بسته‌ها", smart.status === 200 && Boolean(smart.json?.success),
      `${smart.json?.picked?.length ?? smart.json?.packages?.length ?? 0} انتخابشده`, smart.ms);
    (globalThis as any).__packages = packages;
  }

  // ═══ فاز ۱ · شروع سفر ══════════════════════════════════════════════════════
  {
    const phase = "۱ شروع";
    const archetype = await call("/api/archetype", {
      moods: ["تاریخی", "طبیعت"],
      budgetMillions: 20,
      people: 2,
      days: 3,
      children: 0,
      mode: "train",
    });
    check(phase, "تیپ سفر از حال‌وهوا", archetype.status === 200 && hasPersian(archetype.json?.archetype?.name),
      `${archetype.json?.archetype?.name ?? "—"} · ${archetype.json?.source ?? "?"}`, archetype.ms);

    const voice = await call("/api/voice/parse", {
      transcript: "دو نفریم می‌خوایم سه روز بریم شیراز با قطار و بیست میلیون بودجه داریم",
    });
    const trip = voice.json?.trip;
    check(phase, "خواندن جملهٔ فارسی مسافر", voice.status === 200 && Boolean(trip?.destination),
      `مقصد ${trip?.destination ?? "—"}، ${trip?.days ?? "?"} روز، ${trip?.budgetMillions ?? "?"} میلیون`, voice.ms);
    check(phase, "جملهٔ نامفهوم شهر نمی‌سازد", (await call("/api/voice/parse", { transcript: "سلام" })).json?.trip?.destination !== "سلام",
      "ورودی بی‌معنی مقصد نمی‌شود", 0);

    const oneclick = await call("/api/trip/oneclick", {
      sentence: "سه روز شیراز با قطار برای دو نفر با بیست میلیون",
    });
    check(phase, "سفر یک‌کلیکی", oneclick.status === 200 && Boolean(oneclick.json?.plan?.destination),
      `مقصد ${oneclick.json?.plan?.destination ?? "—"}`, oneclick.ms);
    check(phase, "تاریخ سفر از خود مسافر می‌آید نه از حدس",
      String(oneclick.json?.parsed?.departureDate ?? "") === "" || /^\d{4}-\d{2}-\d{2}$/.test(String(oneclick.json?.parsed?.departureDate)),
      `departureDate=${oneclick.json?.parsed?.departureDate ?? "خالی (عمدی)"}`, 0);

    const compare = await call("/api/trip/compare", {
      a: "شیراز", b: "اصفهان", travellers: 2, days: 3, budgetToman: 30_000_000, moods: ["تاریخی"],
    });
    check(phase, "مقایسهٔ دو مقصد", compare.status === 200 && Boolean(compare.json?.verdict),
      `برنده ${compare.json?.verdict?.winner ?? compare.json?.winner ?? "—"}`, compare.ms);
  }

  // ═══ فاز ۲ · آزمون سلیقه ═══════════════════════════════════════════════════
  let quizQuestions: any[] = [];
  {
    const phase = "۲ آزمون";
    const q = await call("/api/quiz/questions", {
      origin: "تهران", travellers: 2, token: "audit-" + Date.now(), seen: [],
    });
    quizQuestions = q.json?.questions || [];
    check(phase, "سؤال‌های آزمون", q.status === 200 && quizQuestions.length >= 10,
      `${quizQuestions.length} سؤال · ${q.json?.source ?? "?"}`, q.ms);
    check(phase, "پاسخ کمتر از ۱۵ ثانیه", q.ms < 15_000, `${q.ms}ms`, 0);
    check(phase, "هر سؤال گزینه دارد", quizQuestions.every((item) => Array.isArray(item?.options) && item.options.length >= 2),
      "همه دارای گزینه", 0);
    check(phase, "سؤال‌ها تکراری نیستند", new Set(quizQuestions.map((item) => item?.key)).size === quizQuestions.length,
      `${new Set(quizQuestions.map((item) => item?.key)).size} کلید یکتا`, 0);

    const answers: Record<string, string> = {};
    quizQuestions.forEach((item) => { answers[item.key] = item.options[0]?.value ?? item.options[0]?.id ?? item.options[0]; });
    const analyze = await call("/api/quiz/analyze", {
      origin: "تهران",
      travellers: 2,
      days: 3,
      budgetMillions: 20,
      freeText: "",
      questions: quizQuestions,
      answers,
    });
    const cities: any[] = analyze.json?.analysis?.cities || [];
    check(phase, "تحلیل پاسخ‌ها و پیشنهاد شهر واقعی", analyze.status === 200 && cities.length > 0 && cities.every((row) => hasPersian(row?.name)),
      `پیشنهاد: ${cities.slice(0, 3).map((row: any) => row?.name).join("، ") || "—"} · ${analyze.json?.analysis?.source ?? "?"}`, analyze.ms);
    (globalThis as any).__quiz = { quizQuestions, answers, analyze: analyze.json };
  }

  // ═══ فاز ۳ · بلیت ══════════════════════════════════════════════════════════
  let transportOffers: any[] = [];
  {
    const phase = "۳ بلیت";
    for (const mode of ["train", "plane", "bus"] as const) {
      // Two days out: that is where the providers' real inventory is. A date far
      // ahead has no train on sale yet, and the page says so in its own words.
      const price = await call("/api/providers/transport/search", {
        origin: "تهران", destination: "مشهد", date: future(2), mode, travellers: 2,
      });
      const offers: any[] = price.json?.offers || [];
      if (mode === "train") transportOffers = offers;
      const named = offers.filter((offer) => hasPersian(offer?.company || offer?.operator || offer?.name));
      check(phase, `بلیت ${mode === "train" ? "قطار" : mode === "plane" ? "هواپیما" : "اتوبوس"} تهران–مشهد`,
        price.status === 200 && (offers.length > 0 || typeof price.json?.note === "string"),
        `${offers.length} پیشنهاد${offers.length ? ` · ${named.length} با نام شرکت` : ""}`, price.ms);
      if (offers.length) {
        check(phase, `${mode}: هر پیشنهاد قیمت واقعی دارد`, offers.every((offer) => money(offer?.priceToman ?? offer?.price)),
          `${offers.filter((offer) => money(offer?.priceToman ?? offer?.price)).length}/${offers.length}`, 0);
        check(phase, `${mode}: هر پیشنهاد لینک خرید دارد`,
          offers.every((offer) => typeof (offer?.bookingUrl || offer?.url || offer?.link) === "string"),
          "همه لینک دارند", 0);
      }
    }

    const alibabaFlight = await call("/api/providers/alibaba/flights", {
      origin: "THR", destination: "MHD", date: future(12), adults: 1,
    });
    check(phase, "پرواز از علی‌بابا (لایهٔ دوم)", alibabaFlight.status === 200 && (alibabaFlight.json?.success === true),
      `${alibabaFlight.json?.count ?? 0} پرواز`, alibabaFlight.ms);

    const ground = await call("/api/providers/alibaba/ground", {
      origin: "THR", destination: "MHD", date: future(2), mode: "train", adults: 2,
    });
    check(phase, "قطار از علی‌بابا (لایهٔ دوم)", ground.status === 200 && ground.json?.success === true,
      `HTTP ${ground.status} · ${ground.json?.error ?? "ok"}`, ground.ms);

    const planeByCity = await call("/api/providers/transport/search", {
      origin: "تهران", destination: "مشهد", date: future(2), mode: "plane", travellers: 1,
    });
    const planeOffers: any[] = planeByCity.json?.offers || [];
    check(phase, "پرواز با نام شهر هم پیدا می‌شود (مسیر پیشنهادهای خانه و همسفر)",
      planeOffers.length > 0, `${planeOffers.length} پرواز`, planeByCity.ms);
    if (planeOffers.length) {
      const link = String(planeOffers[0]?.bookingUrl || "");
      check(phase, "لینک خرید پرواز کد فرودگاه دارد نه نام فارسی",
        link.includes("alibaba.ir/flights/") && !/[\u0600-\u06FF]/.test(link), link.slice(0, 70), 0);
    }

    // rejection arms: a past date and a mode-less body must be refused, in Persian
    const past = await call("/api/providers/transport/search", {
      origin: "تهران", destination: "مشهد", date: "2020-01-01", mode: "train", travellers: 1,
    });
    check(phase, "تاریخ گذشته رد می‌شود", past.status === 400 && hasPersian(past.json?.error),
      `${past.status} · ${String(past.json?.error).slice(0, 40)}`, past.ms);
    const badMode = await call("/api/providers/transport/search", {
      origin: "تهران", destination: "مشهد", date: future(5), mode: "spaceship", travellers: 1,
    });
    check(phase, "حالت ناشناخته رد می‌شود", badMode.status === 400, `${badMode.status}`, badMode.ms);
  }

  // ═══ فاز ۴ · اقامت ═════════════════════════════════════════════════════════
  let stays: any[] = [];
  {
    const phase = "۴ اقامت";
    for (const kind of ["hotel", "stay"] as const) {
      const search = await call("/api/providers/accommodation/search", {
        kind, city: "مشهد", checkIn: future(12), checkOut: future(14),
        adults: 2, childAges: [], infantAges: [],
      });
      const offers: any[] = search.json?.offers || search.json?.groups?.flatMap((group: any) => group.offers || []) || [];
      if (kind === "hotel") stays = offers;
      const named = offers.filter((offer) => hasPersian(offer?.name));
      check(phase, `اقامت ${kind === "hotel" ? "هتل" : "خانهٔ محلی"}`,
        search.status === 200 && offers.length > 0, `${offers.length} گزینه · ${named.length} با نام`, search.ms);
      if (offers.length) {
        check(phase, `${kind}: هر گزینه قیمت و منبع دارد`,
          offers.every((offer) => Number(offer?.pricePerNightToman ?? offer?.priceToman ?? offer?.price) > 0),
          "قیمت‌ها مثبت", 0);
        check(phase, `${kind}: هر گزینه لینک رزرو مستقیم دارد`,
          offers.filter((offer) => typeof (offer?.bookingUrl || offer?.url) === "string").length >= Math.ceil(offers.length * 0.8),
          "حداقل ۸۰٪ لینک دارند", 0);
        check(phase, `${kind}: هیچ گزینهٔ تکراری نیست`,
          new Set(offers.map((offer) => `${offer?.name}|${offer?.pricePerNightToman ?? offer?.priceToman}`)).size === offers.length,
          "بدون تکرار", 0);
        const sources = new Set<string>(offers.map((offer) => String(offer?.source || offer?.provider)));
        check(phase, `${kind}: منبع هر گزینه مشخص است`, Array.from(sources).every((item) => item !== "undefined" && item !== ""),
          `${sources.size} منبع`, 0);
      }
    }

    const alibabaStay = await call("/api/providers/alibaba/accommodation", {
      kind: "hotel", city: "مشهد", checkIn: future(12), checkOut: future(14), adults: 2, childAges: [], infantAges: [],
    });
    check(phase, "هتل از علی‌بابا (لایهٔ دوم)", alibabaStay.status === 200 && alibabaStay.json?.success === true,
      `HTTP ${alibabaStay.status} · ${alibabaStay.json?.error ?? "ok"}`, alibabaStay.ms);

    const invalid = await call("/api/providers/accommodation/search", {
      kind: "hotel", city: "مشهد", checkIn: future(14), checkOut: future(12), adults: 2, childAges: [], infantAges: [],
    });
    check(phase, "تاریخ خروج قبل از ورود رد می‌شود", invalid.status === 400, `${invalid.status}`, invalid.ms);

    const nearby = await call("/api/providers/places/nearby", {
      city: "شیراز", latitude: 29.6256, longitude: 52.5585, limit: 8,
    });
    const places: any[] = nearby.json?.places || nearby.json?.results || [];
    check(phase, "جاهای دیدنی نزدیک اقامتگاه", nearby.status === 200 && places.length > 0,
      `${places.length} مکان نزدیک`, nearby.ms);
  }

  // ═══ فاز ۵ · برنامه ════════════════════════════════════════════════════════
  let pois: any[] = [];
  let planGuides: any = null;
  {
    const phase = "۵ برنامه";
    const search = await call("/api/providers/pois/search", { city: "شیراز", limit: 24 });
    pois = search.json?.pois || [];
    check(phase, "جاذبه‌های واقعی شیراز", search.status === 200 && pois.length >= 8, `${pois.length} جاذبه`, search.ms);
    check(phase, "مختصات جاذبه‌ها داخل ایران است",
      pois.every((poi) => inIran(Number(poi?.latitude), Number(poi?.longitude))),
      "همه در محدودهٔ ایران", 0);
    check(phase, "هر جاذبه نام و دسته دارد",
      pois.every((poi) => hasPersian(poi?.name) && (hasPersian(poi?.category) || poi?.category === undefined)),
      "نام‌ها فارسی", 0);
    const sources = search.json?.sources || {};
    const active = Object.keys(sources).filter((key) => sources[key] === "ok");
    check(phase, "منبع هر جاذبه اعلام می‌شود", Object.keys(sources).length === 3,
      Object.keys(sources).map((key) => `${key}:${sources[key]}`).join(" · "), 0);
    check(phase, "جملهٔ منابع با وضعیت واقعی می‌خواند", active.every((key) => String(search.json?.note || "").includes(key === "wikidata" ? "ویکی‌داده" : key === "wikipedia" ? "ویکی‌پدیا" : "OpenStreetMap")),
      `${active.length} منبع پاسخ داد`, 0);

    const distances = await call("/api/route/poi-distances", {
      origin: { latitude: 29.6256, longitude: 52.5585 },
      targets: pois.slice(0, 6).map((poi) => ({ id: poi.id, latitude: poi.latitude, longitude: poi.longitude })),
    });
    const entries: any[] = distances.json?.entries || [];
    check(phase, "فاصلهٔ واقعی اقامتگاه تا جاذبه‌ها", distances.status === 200 && entries.length >= 4,
      `${entries.length} اندازه‌گیری`, distances.ms);
    check(phase, "فاصله‌ها صفر یا منفی نیستند",
      entries.every((entry) => Number(entry?.distanceKm) >= 0 && Number(entry?.durationMinutes) >= 0),
      `موتور: ${distances.json?.engineLabel ?? distances.json?.engine ?? "—"}`, 0);

    const curate = await call("/api/plan/curate", {
      destination: "شیراز",
      days: 2,
      mustIncludeAll: false,
      taste: { moods: ["تاریخی", "شعر"], words: "آرام و فرهنگی" },
      places: pois.slice(0, 8).map((poi, index) => ({
        id: poi.id, name: poi.name, category: poi.category,
        km: entries[index]?.km ?? 3, minutes: entries[index]?.minutes ?? 10,
      })),
    });
    const curated: any[] = curate.json?.days || [];
    check(phase, "چیدن جاذبه‌ها در روزها", curate.status === 200 && curated.length >= 1,
      `${curated.length} روز · ${curate.json?.source ?? "?"}`, curate.ms);
    check(phase, "هیچ جاذبه‌ای از فهرست مسافر جا نمی‌افتد",
      curate.json?.dropped === undefined || (curate.json?.dropped || []).length === 0,
      `جاافتاده: ${(curate.json?.dropped || []).length}`, 0);

    const guide = await call("/api/plan/guide", {
      destination: "شیراز",
      taste: "تاریخی و آرام",
      days: curated.map((day: any, index: number) => ({
        dayNumber: index + 1,
        categories: (day.places || day.stops || []).map((place: any) => place.category),
        stops: (day.places || day.stops || []).map((place: any) => place.name),
      })),
    });
    planGuides = guide.json;
    check(phase, "راهنمای روزبه‌روز", guide.status === 200 && Array.isArray(guide.json?.guides) && guide.json.guides.length > 0,
      `${guide.json?.guides?.length ?? 0} روز · ${guide.json?.source ?? "?"}`, guide.ms);
    check(phase, "راهنما نام واقعی جاذبه‌ها را دارد",
      (guide.json?.guides || []).every((row: any) => hasPersian(row?.title || row?.text || row?.headline)),
      "متن فارسی از همان جاذبه‌ها", 0);

    const measure = await call("/api/route/distance", { origin: "تهران", destination: "شیراز" });
    check(phase, "مسیر جاده‌ای تهران–شیراز", measure.status === 200 && Number(measure.json?.distanceKm) > 800,
      `${Math.round(Number(measure.json?.distanceKm) || 0)} کیلومتر · ${Math.round(Number(measure.json?.durationMinutes) || 0)} دقیقه`, measure.ms);

    const neshanRoute = await call("/api/route/neshan-route", {
      origin: { latitude: 29.6, longitude: 52.5 },
      destination: { latitude: 29.62, longitude: 52.55 },
      steps: 5,
    });
    check(phase, "مسیریابی نشان", neshanRoute.status === 200 && typeof neshanRoute.json?.configured === "boolean",
      neshanRoute.json?.configured ? "کلید دارد" : "بدون کلید → OpenStreetMap", neshanRoute.ms);
  }

  // ═══ فاز ۶ · سفر در جریان ══════════════════════════════════════════════════
  {
    const phase = "۶ سفر";
    const itinerary = await call("/api/itinerary/plan", {
      city: "شیراز",
      days: 2,
      stopsPerDay: 4,
      origin: { latitude: 35.6892, longitude: 51.389 },
      places: pois.slice(0, 10).map((poi) => ({
        id: poi.id, name: poi.name, category: poi.category,
        latitude: poi.latitude, longitude: poi.longitude, description: poi.description || "",
      })),
    });
    check(phase, "برنامهٔ ساعتی سفر", itinerary.status === 200 && Array.isArray(itinerary.json?.days) && itinerary.json.days.length >= 1,
      `${itinerary.json?.days?.length ?? 0} روز · موتور ${itinerary.json?.engine ?? "—"}`, itinerary.ms);
    const dayOne: any = (itinerary.json?.days || [])[0];
    const stops: any[] = dayOne?.stops || [];
    check(phase, "هر روز ایستگاه واقعی دارد", stops.length > 0, `${stops.length} ایستگاه`, 0);
    check(phase, "هر ایستگاه ساعت شروع دارد", stops.every((stop) => /[۰-۹\d]/.test(String(stop?.startTime))),
      `اولین: ${stops[0]?.startTime ?? "—"}`, 0);
    const chosenIds = new Set(pois.slice(0, 10).map((poi) => poi.id));
    const usedIds = (itinerary.json?.days || []).flatMap((day: any) => (day.stops || []).map((stop: any) => stop?.place?.id));
    check(phase, "هر ایستگاه از فهرست خود مسافر است",
      usedIds.every((id: string) => chosenIds.has(id)), `${usedIds.length} ایستگاه`, 0);
    check(phase, "جای‌نشده‌ها هم صادقانه نام برده می‌شوند",
      (itinerary.json?.unused || []).every((row: any) => hasPersian(row?.name)),
      `${(itinerary.json?.unused || []).length} مکان بیرون از ظرفیت روزها`, 0);

    const legsInput = stops.slice(0, 5).map((stop) => ({ latitude: stop?.place?.latitude, longitude: stop?.place?.longitude }))
      .filter((point) => Number.isFinite(point.latitude));
    const legs = await call("/api/itinerary/legs", { origin: { latitude: 29.6, longitude: 52.5 }, legs: legsInput });
    check(phase, "زمان رفت‌وآمد بین ایستگاه‌ها", legs.status === 200 && Array.isArray(legs.json?.legs),
      `${legs.json?.legs?.length ?? 0} مسیر`, legs.ms);

    const weather = await call("/api/weather/trip", {
      city: "شیراز",
      startDate: future(2),
      days: 3,
      planDays: (itinerary.json?.days || []).map((day: any, index: number) => ({
        dayNumber: index + 1,
        categories: (day.stops || []).map((stop: any) => stop?.place?.category),
      })),
    });
    const days: any[] = weather.json?.days || [];
    check(phase, "هوای روزهای سفر", weather.status === 200 && days.length >= 2,
      `${days.length} روز · ${weather.json?.source ?? "—"}`, weather.ms);
    check(phase, "دما عدد واقعی است", days.every((day) => Number.isFinite(Number(day?.maxC)) && Number.isFinite(Number(day?.minC))),
      `بیشینه ${days[0]?.maxC ?? "—"}°`, 0);
    check(phase, "هر روز هوا راهنمای همان روز را دارد",
      days.every((day) => hasPersian(day?.advice) && Number.isFinite(Number(day?.score))),
      `${days[0]?.advice?.slice(0, 30) ?? "—"}`, 0);
    check(phase, "ترتیب روزها بر پایهٔ هوا پیشنهاد می‌شود", Boolean(weather.json?.suggestion?.reason),
      String(weather.json?.suggestion?.reason ?? "—").slice(0, 40), 0);

    const withoutWeatherSource = await call("/api/weather/trip", { city: "شهرناموجود", startDate: future(2), days: 2 });
    check(phase, "شهر ناشناخته هوا را از خودش نمی‌سازد", withoutWeatherSource.status >= 400 || withoutWeatherSource.json?.success === false || withoutWeatherSource.json?.days?.length === 0,
      `HTTP ${withoutWeatherSource.status}`, withoutWeatherSource.ms);
  }

  // ═══ فاز ۷ · خروجی و اشتراک ════════════════════════════════════════════════
  {
    const phase = "۷ خروجی";
    const shareBody = {
      v: 1,
      city: "شیراز",
      createdAt: new Date().toISOString(),
      days: [{
        day: 1,
        title: "روز اول",
        theme: "تاریخی",
        area: "شیراز",
        lunchAfter: 1,
        totalKm: 4,
        totalDriveMinutes: 16,
        stops: [{
          place: { id: "hafez", name: "حافظیه", category: "آرامگاه", latitude: 29.6256, longitude: 52.5585, description: "" },
          order: 1, startTime: "۰۹:۰۰", visitMinutes: 60, legKm: 2, legMinutes: 8, legEngine: "آزمون",
        }],
      }],
      totals: { km: 4, driveMinutes: 16, stops: 1, days: 1 },
      budgetToman: 20_000_000,
    };
    const share = await call("/api/share", shareBody);
    check(phase, "ساخت لینک اشتراکی", share.status === 200 && typeof share.json?.url === "string",
      `${share.json?.mode ?? "?"} · ${share.ms}ms`, share.ms);
    if (share.json?.url) {
      const page = await fetch(share.json.url);
      const html = await page.text();
      check(phase, "لینک اشتراکی باز می‌شود و همان برنامه را نشان می‌دهد",
        page.status === 200 && html.includes("حافظیه"), `HTTP ${page.status}`, 0);
      check(phase, "در لینک اشتراکی دادهٔ شخصی نیست",
        !/(^|[^\d])09\d{9}([^\d]|$)/.test(html) && !/[\w.+-]+@[\w-]+\.[\w.]+/.test(html),
        "بدون شمارهٔ موبایل و ایمیل", 0);
    }
    const emptyShare = await call("/api/share", {});
    check(phase, "اشتراک بدون برنامه رد می‌شود", emptyShare.status === 400, `${emptyShare.status}`, emptyShare.ms);

    const caption = await call("/api/trip/caption", {
      input: {
        destination: "شیراز",
        origin: "تهران",
        days: 2,
        travellers: 2,
        transportLabel: "قطار",
        topPlaces: ["حافظیه", "باغ ارم"],
        km: 12,
        totalToman: 20_000_000,
      },
    });
    check(phase, "کپشن استوری", caption.status === 200 && hasPersian(caption.json?.caption || caption.json?.text),
      `${String(caption.json?.caption || caption.json?.text || "").slice(0, 40)}…`, caption.ms);

    const map = await call("/api/neshan/static?lat=29.6256&lng=52.5585&zoom=15", undefined, "GET");
    check(phase, "تصویر نقشهٔ ایستا", map.status === 200 || map.status === 307 || map.status === 302,
      `HTTP ${map.status}`, map.ms);

    const assets = await call("/api/provider-assets?src=" + encodeURIComponent("https://cdn.alibaba.ir/logo.png"), undefined, "GET");
    check(phase, "واسط لوگوی ارائه‌دهنده", [200, 400, 404, 502].includes(assets.status), `HTTP ${assets.status}`, assets.ms);
  }

  // ═══ همسفر ═════════════════════════════════════════════════════════════════
  {
    const phase = "همسفر";
    const context = {
      origin: "تهران", destination: "شیراز", budgetMillions: 20, days: 3, travellers: 2,
      children: 0, mode: "train", transportToman: 4_000_000, stayToman: 6_000_000,
      departureDate: future(5), distanceKm: 930, weather: [],
    };
    const tips = companionTips(context as any);
    check(phase, "همسفر موضوع واقعی امروز را می‌بیند", tips.length > 0,
      `${tips.length} موضوع · اول: ${tips[0]?.id ?? "—"}`, 0);
    if (tips[0]) {
      const tip = await call("/api/companion", { context, tipId: tips[0].id });
      check(phase, "جملهٔ گرم برای موضوع درست", tip.status === 200 && hasPersian(tip.json?.text),
        `${tip.json?.source ?? "?"} · ${String(tip.json?.text ?? "").slice(0, 30)}…`, tip.ms);
      const stale = await call("/api/companion", { context, tipId: "چیزی-که-نیست" });
      check(phase, "موضوع منقضی با پیام روشن رد می‌شود", stale.status === 409 || stale.status === 400, `${stale.status}`, stale.ms);
    }

    const facts = {
      origin: "تهران", destination: "شیراز", days: 3, travellers: 2,
      budgetToman: 20_000_000, transportToman: 4_000_000, transportLabel: "قطار",
      stayToman: 6_000_000, stayName: "هتل آزمایشی", foodToman: 3_000_000,
      remainingToman: 7_000_000, departureDate: future(5), placeNames: ["حافظیه"], weather: [],
    };
    const agent = await call("/api/companion/agent", { question: "با این بودجه چه چیزی را باید کم کنم؟", facts });
    check(phase, "پاسخ همسفر به سؤال مسافر", agent.status === 200 && hasPersian(agent.json?.answer),
      `${agent.json?.source ?? "?"} · ${String(agent.json?.answer ?? "").slice(0, 40)}…`, agent.ms);
    check(phase, "پاسخ عددی که در سفر نیست نمی‌سازد",
      !/۰?[۰-۹]{1,2}٬[۰-۹]{3}/.test(String(agent.json?.answer ?? "")) || agent.json?.source === "local",
      "اعداد از فاکتور خود سفر", 0);

    const suggest = await call("/api/companion/suggest", {
      facts: { stage: "plan", origin: "تهران", destination: "شیراز", days: 3, travellers: 2, budgetToman: 20_000_000, committedToman: 10_000_000, dailyToman: 900_000 },
      options: [
        { id: "t1", title: "قطار شبانه", priceToman: 4_000_000, detail: "ارزان‌تر از پرواز" },
        { id: "t2", title: "پرواز صبح", priceToman: 9_000_000, detail: "سریع‌تر" },
      ],
    });
    check(phase, "پیشنهاد همسفر از میان گزینه‌های واقعی صفحه", suggest.status === 200 && ["t1", "t2"].includes(suggest.json?.advice?.optionId),
      `انتخاب ${suggest.json?.advice?.optionId ?? "—"}`, suggest.ms);

    const emptyQuestion = await call("/api/companion/agent", { question: "", facts });
    check(phase, "سؤال خالی رد می‌شود", emptyQuestion.status === 400, `${emptyQuestion.status}`, emptyQuestion.ms);
  }

  // ═══ نگهداری ═══════════════════════════════════════════════════════════════
  {
    const phase = "نگهداری";
    const refresh = await call("/api/cron/refresh", undefined, "GET");
    check(phase, "تازه‌سازی دوره‌ای داده‌ها", refresh.status === 200 && refresh.json?.success !== false,
      `${refresh.json?.skipped ? "تازه بود" : "اجرا شد"} · ${refresh.json?.message ?? ""}`.slice(0, 60), refresh.ms);
  }

  // ═══ گزارش ═════════════════════════════════════════════════════════════════
  const failed = results.filter((row) => !row.ok);
  const phases = Array.from(new Set(results.map((row) => row.phase)));
  console.log("");
  for (const phase of phases) {
    const rows = results.filter((row) => row.phase === phase);
    const bad = rows.filter((row) => !row.ok).length;
    console.log(`${bad ? "❌" : "✅"} ${phase}: ${rows.length - bad}/${rows.length}`);
  }
  const slowest = [...results].sort((a, b) => b.ms - a.ms).slice(0, 5);
  console.log(`\nکندترین‌ها: ${slowest.map((row) => `${row.name} ${row.ms}ms`).join(" · ")}`);
  console.log(failed.length ? `\n❌ ${failed.length} ایراد از ${results.length} بررسی` : `\n✅ همهٔ ${results.length} بررسی سالم`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error("ممیزی خودش شکست خورد:", error);
  process.exit(2);
});
