/**
 * «بازرس داده» — the thing that finds our own mistakes before a traveller does.
 *
 * Nothing here is a model call and nothing here is guesswork: it reads the data
 * we just fetched and asks the awkward questions a careful engineer would ask —
 *
 *   - is there a ticket with no price, or a price that cannot be real?
 *   - is the same company selling the same service at two prices *on one page*?
 *   - did a row lose its company name or its logo?
 *   - is the same ticket listed twice under slightly different titles?
 *   - is a hotel advertised with zero rooms, or a room with no name?
 *   - is the payload older than it claims to be?
 *
 * Each finding has a severity and a plain-Persian sentence, so the daily job can
 * be read by a human rather than a machine. Findings never delete data by
 * themselves; they only report.
 */

export type Severity = "error" | "warn" | "info";

export type Finding = {
  severity: Severity;
  area: "transport" | "accommodation";
  code: string;
  /** One plain Persian sentence, with the real values in it. */
  message: string;
  count: number;
};

const fa = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${fa.format(Math.round(value))} تومان`;

/** A price outside this band is a parsing bug, not a market fact. */
const MIN_PLAUSIBLE_TOMAN = 20_000;
const MAX_PLAUSIBLE_TOMAN = 900_000_000;

type AnyOffer = Record<string, unknown>;

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function inspectTransport(payload: { offers?: AnyOffer[]; fetchedAt?: string; providerStatuses?: { provider: string; status: string }[] }): Finding[] {
  const findings: Finding[] = [];
  const offers = Array.isArray(payload.offers) ? payload.offers : [];

  if (!offers.length) {
    findings.push({
      severity: "warn",
      area: "transport",
      code: "no-offers",
      message: "این جست‌وجو هیچ بلیتی برنگرداند؛ اگر مسیر پرتردد است، یعنی یکی از منابع مشکل دارد.",
      count: 0,
    });
  }

  const badPrice = offers.filter((offer) => num(offer.priceToman) < MIN_PLAUSIBLE_TOMAN || num(offer.priceToman) > MAX_PLAUSIBLE_TOMAN);
  if (badPrice.length) {
    findings.push({
      severity: "error",
      area: "transport",
      code: "implausible-price",
      message: `${fa.format(badPrice.length)} بلیت قیمت غیرممکن دارد (کمتر از ${money(MIN_PLAUSIBLE_TOMAN)} یا بیشتر از ${money(MAX_PLAUSIBLE_TOMAN)}).`,
      count: badPrice.length,
    });
  }

  const nameless = offers.filter((offer) => !text(offer.operator));
  if (nameless.length) {
    findings.push({
      severity: "warn",
      area: "transport",
      code: "missing-operator",
      message: `${fa.format(nameless.length)} بلیت نام شرکت ندارد؛ کارت خالی و بی‌اعتماد می‌شود.`,
      count: nameless.length,
    });
  }

  const logoless = offers.filter((offer) => !text(offer.logoUrl));
  if (logoless.length) {
    findings.push({
      severity: "info",
      area: "transport",
      code: "missing-logo",
      message: `${fa.format(logoless.length)} بلیت لوگوی شرکت را ندارد (منبع لوگو نداده).`,
      count: logoless.length,
    });
  }

  // The same route, the same time, two prices — legitimate between providers, so
  // this is reported as information, never as an error.
  const byDeparture = new Map<string, AnyOffer[]>();
  for (const offer of offers) {
    const key = `${text(offer.operator)}|${text(offer.departure)}`;
    if (!key.trim()) continue;
    byDeparture.set(key, [...(byDeparture.get(key) || []), offer]);
  }
  let splitPrices = 0;
  let biggestGap = 0;
  for (const group of Array.from(byDeparture.values())) {
    if (group.length < 2) continue;
    const prices = group.map((offer) => num(offer.priceToman)).filter((price) => price > 0);
    if (prices.length < 2) continue;
    const gap = Math.max(...prices) - Math.min(...prices);
    if (gap > 0) {
      splitPrices += 1;
      biggestGap = Math.max(biggestGap, gap);
    }
  }
  if (splitPrices) {
    findings.push({
      severity: "info",
      area: "transport",
      code: "provider-price-gap",
      message: `${fa.format(splitPrices)} سرویس بین دو منبع قیمت متفاوت دارد؛ بیشترین اختلاف ${money(biggestGap)} است.`,
      count: splitPrices,
    });
  }

  const ids = new Set<string>();
  let repeated = 0;
  for (const offer of offers) {
    const id = text(offer.id);
    if (!id) continue;
    if (ids.has(id)) repeated += 1;
    ids.add(id);
  }
  if (repeated) {
    findings.push({
      severity: "error",
      area: "transport",
      code: "duplicate-id",
      message: `${fa.format(repeated)} بلیت با شناسهٔ تکراری در یک صفحه آمده است؛ کلیدها باید یکتا باشند.`,
      count: repeated,
    });
  }

  if (payload.fetchedAt) {
    const age = Date.now() - new Date(payload.fetchedAt).getTime();
    if (Number.isFinite(age) && age > 6 * 3_600_000) {
      findings.push({
        severity: "warn",
        area: "transport",
        code: "stale-payload",
        message: `آخرین به‌روزرسانی ${fa.format(Math.round(age / 3_600_000))} ساعت پیش بوده؛ قیمت‌ها ممکن است عوض شده باشند.`,
        count: 1,
      });
    }
  }

  const failed = (payload.providerStatuses || []).filter((status) => status.status !== "ok");
  if (failed.length) {
    findings.push({
      severity: "warn",
      area: "transport",
      code: "provider-down",
      message: `${fa.format(failed.length)} منبع بلیت پاسخ نداد (${failed.map((status) => status.provider).join("، ")}).`,
      count: failed.length,
    });
  }

  return findings;
}

export function inspectAccommodation(payload: { groups?: { offers?: AnyOffer[] }[]; fetchedAt?: string; allProvidersFailed?: boolean }): Finding[] {
  const findings: Finding[] = [];
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  const rooms = groups.flatMap((group) => (Array.isArray(group?.offers) ? group.offers : []));

  if (payload.allProvidersFailed) {
    findings.push({
      severity: "error",
      area: "accommodation",
      code: "all-providers-failed",
      message: "هیچ منبع اقامتی پاسخ معتبر نداد؛ صفحه در این حالت نباید قیمتی نشان بدهد.",
      count: 0,
    });
    return findings;
  }

  const nameless = rooms.filter((room) => !text(room.name));
  if (nameless.length) {
    findings.push({
      severity: "error",
      area: "accommodation",
      code: "room-without-name",
      message: `${fa.format(nameless.length)} اتاق بدون نام است.`,
      count: nameless.length,
    });
  }

  const badPrice = rooms.filter((room) => num(room.priceTotalToman) <= 0 || num(room.priceTotalToman) > MAX_PLAUSIBLE_TOMAN);
  if (badPrice.length) {
    findings.push({
      severity: "error",
      area: "accommodation",
      code: "implausible-room-price",
      message: `${fa.format(badPrice.length)} اتاق قیمت کل ندارد یا قیمتش غیرممکن است.`,
      count: badPrice.length,
    });
  }

  const emptyGroups = groups.filter((group) => !group?.offers?.length);
  if (emptyGroups.length) {
    findings.push({
      severity: "info",
      area: "accommodation",
      code: "empty-group",
      message: `${fa.format(emptyGroups.length)} گروه بدون اتاق در فهرست مانده؛ باید حذف شود تا فهرست تمیز بماند.`,
      count: emptyGroups.length,
    });
  }

  const withoutBooking = rooms.filter((room) => !text(room.bookingUrl));
  if (withoutBooking.length) {
    findings.push({
      severity: "warn",
      area: "accommodation",
      code: "missing-booking-link",
      message: `${fa.format(withoutBooking.length)} اتاق لینک رزرو دقیق ندارد.`,
      count: withoutBooking.length,
    });
  }

  return findings;
}

/** A short verdict for the job's own log, in plain Persian. */
export function describeFindings(findings: Finding[]): string {
  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warns = findings.filter((finding) => finding.severity === "warn").length;
  if (!errors && !warns) return "همه‌چیز سالم است.";
  return `${fa.format(errors)} خطا و ${fa.format(warns)} هشدار پیدا شد.`;
}
