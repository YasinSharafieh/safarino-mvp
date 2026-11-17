/**
 * «قیمت تا چند روز دیگر چه می‌شود؟» — a forecast built only from our own readings.
 *
 * Flight and hotel prices for a route wobble for real reasons (a week-end, a
 * holiday, a company putting a carriage on sale). Safarino already writes down
 * every price it actually read for a route, with the minute it read it. This file
 * fits the simplest honest line through those readings and says where the line
 * points — and, just as important, says nothing when there is not enough history.
 *
 * Rules that keep it from being a lie:
 *  - fewer than `MIN_POINTS` readings, or readings squeezed into less than
 *    `MIN_SPAN_HOURS`, produce `null` — the interface then shows no forecast;
 *  - the prediction is clamped to a believable band around the latest real price,
 *    so a wild two-point spike cannot become «قیمت سه برابر می‌شود»;
 *  - the confidence word comes from the fit (r²) and the number of readings, and
 *    is always printed next to the number;
 *  - the sentence always names it as an estimate from our own history, never as a
 *    promise about what a provider will do.
 */

export type ForecastPoint = {
  /** ISO timestamp of a real reading. */
  at: string;
  /** Cheapest total of that reading, in toman. */
  priceToman: number;
};

export type PriceForecast = {
  /** How many real readings the line was fitted to. */
  points: number;
  /** How many hours the readings cover. */
  spanHours: number;
  /** How far ahead the number is projected. */
  horizonDays: number;
  /** Predicted cheapest total in toman, at the end of the horizon. */
  predictedToman: number;
  /** Change against the latest real reading, signed. */
  deltaToman: number;
  deltaPct: number;
  direction: "up" | "down" | "flat";
  confidence: "low" | "medium" | "high";
  /** One honest Persian sentence. */
  message: string;
};

const MIN_POINTS = 3;
const MIN_SPAN_HOURS = 4;
/** At least this much time between the first and last reading, in hours, to trust r². */
const GOOD_SPAN_HOURS = 12;
/** A forecast may never leave this band around the latest real price. */
const BAND = { low: 0.7, high: 1.35 };

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));

function usable(points: ForecastPoint[], now: Date): { x: number; y: number }[] {
  const rows: { x: number; y: number }[] = [];
  for (const point of points) {
    if (!point || typeof point.at !== "string") continue;
    const price = Number(point.priceToman);
    if (!Number.isFinite(price) || price <= 0) continue;
    const at = new Date(point.at);
    if (Number.isNaN(at.getTime())) continue;
    const hours = (at.getTime() - now.getTime()) / 3_600_000;
    // Ignore readings stamped in the future — a clock that drifted is not history.
    if (hours > 1) continue;
    rows.push({ x: hours, y: price });
  }
  return rows.sort((a, b) => a.x - b.x);
}

/**
 * Fits `price = a + b·(hours before now)` and projects it `horizonDays` ahead.
 * `null` means «تاریخچه کافی نیست» and the caller must show nothing.
 */
export function forecastFrom(
  points: ForecastPoint[],
  options: { now?: Date; horizonDays?: number } = {},
): PriceForecast | null {
  const now = options.now || new Date();
  const horizonDays = Math.min(14, Math.max(1, Math.round(options.horizonDays ?? 7)));
  const rows = usable(Array.isArray(points) ? points : [], now);
  if (rows.length < MIN_POINTS) return null;

  const spanHours = Math.abs(rows[rows.length - 1].x - rows[0].x);
  if (spanHours < MIN_SPAN_HOURS) return null;

  const n = rows.length;
  const meanX = rows.reduce((sum, row) => sum + row.x, 0) / n;
  const meanY = rows.reduce((sum, row) => sum + row.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const row of rows) {
    sxx += (row.x - meanX) ** 2;
    sxy += (row.x - meanX) * (row.y - meanY);
  }
  if (sxx <= 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const targetX = horizonDays * 24;
  const rawPrediction = intercept + slope * targetX;

  const latest = rows
    .filter((row) => row.x <= 0)
    .reduce<{ x: number; y: number } | null>((best, row) => (!best || row.x > best.x ? row : best), null) || rows[rows.length - 1];

  const predicted = Math.round(
    Math.min(latest.y * BAND.high, Math.max(latest.y * BAND.low, rawPrediction)) / 1000,
  ) * 1000;

  // How well the line explains the readings (r²) — the honest word for confidence.
  let ssTot = 0;
  let ssRes = 0;
  for (const row of rows) {
    const fitted = intercept + slope * row.x;
    ssTot += (row.y - meanY) ** 2;
    ssRes += (row.y - fitted) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  const confidence: PriceForecast["confidence"] =
    n >= 5 && spanHours >= GOOD_SPAN_HOURS && r2 >= 0.5 ? "high" : n >= 4 && r2 >= 0.25 ? "medium" : "low";

  const deltaToman = predicted - latest.y;
  const deltaPct = latest.y > 0 ? Math.round((deltaToman / latest.y) * 1000) / 10 : 0;
  const direction: PriceForecast["direction"] = deltaPct > 2 ? "up" : deltaPct < -2 ? "down" : "flat";

  const confidenceWord = confidence === "high" ? "اعتماد نسبتاً بالا" : confidence === "medium" ? "اعتماد متوسط" : "اعتماد کم";
  const trendWord = direction === "up" ? "بالا می‌رود" : direction === "down" ? "پایین می‌آید" : "تقریباً ثابت می‌ماند";
  const message =
    direction === "flat"
      ? `بر پایهٔ ${fa(n)} بار خواندن در ${fa(Math.round(spanHours))} ساعت گذشته، قیمت این مسیر تقریباً ثابت مانده؛ پیش‌بینی برای ${fa(horizonDays)} روز دیگر حدود ${fa(predicted)} تومان است (${confidenceWord}).`
      : `بر پایهٔ ${fa(n)} بار خواندن در ${fa(Math.round(spanHours))} ساعت گذشته، قیمت این مسیر ${trendWord}؛ پیش‌بینی برای ${fa(horizonDays)} روز دیگر حدود ${fa(predicted)} تومان است، یعنی ${fa(Math.abs(Math.round(deltaPct)))}٪ ${direction === "up" ? "گران‌تر" : "ارزان‌تر"} (${confidenceWord}). این یک برآورد از تاریخچهٔ خوانده‌های خودمان است، نه وعدهٔ شرکت.`;

  return {
    points: n,
    spanHours: Math.round(spanHours),
    horizonDays,
    predictedToman: predicted,
    deltaToman,
    deltaPct,
    direction,
    confidence,
    message,
  };
}

/**
 * The plain reason the forecast is absent, so the interface can say «چرا عدد
 * نیست» instead of silently hiding a feature.
 */
export function forecastGap(points: ForecastPoint[], options: { now?: Date } = {}): string {
  const now = options.now || new Date();
  const rows = usable(Array.isArray(points) ? points : [], now);
  if (rows.length < MIN_POINTS) {
    return `برای پیش‌بینی حداقل ${fa(MIN_POINTS)} بار خواندن لازم است؛ تا حالا ${fa(rows.length)} بار خوانده شده.`;
  }
  const spanHours = Math.abs(rows[rows.length - 1].x - rows[0].x);
  if (spanHours < MIN_SPAN_HOURS) {
    return `خوانده‌ها در ${fa(Math.round(spanHours))} ساعت جمع شده‌اند؛ برای یک خط واقعی حداقل ${fa(MIN_SPAN_HOURS)} ساعت فاصله لازم است.`;
  }
  return "تاریخچه برای پیش‌بینی کافی نیست.";
}
