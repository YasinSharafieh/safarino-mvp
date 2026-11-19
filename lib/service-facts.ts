/**
 * Shared helpers for the ticket providers' own vocabulary.
 *
 * علی‌بابا and سفر۷۲۴ describe a train, a flight and a bus with dozens of
 * small facts — air conditioning, a compartment size, free food, a wifi name,
 * the baggage allowance, the station it leaves from. Each provider spells the
 * same fact differently (`hasAirCondition` here, `hasAircondition` there), and
 * a value can arrive as `true`, `1`, `"1"` or `"true"`.
 *
 * Before this file existed every adapter read only the handful of keys it had
 * been written against, so a real fact that the provider did publish was
 * silently dropped and the ticket list looked poorer than the source. These
 * helpers read the same fact under every spelling the providers use, keep the
 * traveller's language, and never invent a fact that was not sent.
 */

/** Persian digits and the Persian percent sign, so «4 ستاره» reads «۴ ستاره». */
export function faDigits(value: string): string {
  return value
    .replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])
    .replace(/٪/g, "٪")
    .replace(/%/g, "٪");
}

/** A provider flag is true when it says so in any of the shapes providers use. */
export function flagOn(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  const text = String(value).trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "y";
}

/** The flag is present at all — needed to tell «no» apart from «not stated». */
export function flagStated(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return value === 0 || value === 1;
  const text = String(value).trim().toLowerCase();
  return text === "true" || text === "false" || text === "1" || text === "0" || text === "yes" || text === "no";
}

/** The first spelling that actually carries text. Objects and arrays are ignored. */
export function pickText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

/** True when any of those spellings is on — one fact, every name it travels under. */
export function pickFlag(source: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => flagOn(source[key]));
}

/**
 * The finished list of facts: nothing empty, nothing repeated, nothing that
 * merely repeats the headline (a card that says «رجا · قطار ۳۱۸» does not need
 * a chip that says «قطار ۳۱۸» again).
 */
export function cleanFacts(
  facts: (string | null | undefined | false)[],
  options: { drop?: (string | null | undefined)[] } = {},
): string[] {
  const drop = new Set(
    (options.drop || [])
      .map((value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""))
      .filter(Boolean),
  );
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const fact of facts) {
    if (typeof fact !== "string") continue;
    const value = fact.replace(/\s+/g, " ").trim();
    if (!value || drop.has(value) || seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  /**
   * «سرمایش» and «سرمایش و گرمایش» are one fact written twice. The most
   * specific wording wins, whichever order the provider sent them in — so the
   * shorter one is dropped once the longer one is present.
   */
  return unique.filter(
    (fact) => !unique.some((other) => other !== fact && other.length > fact.length && other.includes(fact)),
  );
}

/**
 * «۴ ساعت و ۳۵ دقیقه» — measured only from the two times the provider gave.
 * Returns "" when either end is missing, so nothing is ever assumed.
 */
export function journeyText(departure: string | null | undefined, arrival: string | null | undefined): string {
  if (!departure || !arrival) return "";
  const from = Date.parse(departure);
  const to = Date.parse(arrival);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return "";
  const minutes = Math.round((to - from) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const fa = (value: number) => String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  if (!hours) return `${fa(rest)} دقیقه`;
  return rest ? `${fa(hours)} ساعت و ${fa(rest)} دقیقه` : `${fa(hours)} ساعت`;
}

/**
 * An overnight train or a late bus leaves today and arrives tomorrow; the API
 * sends both dates, and the traveller should see «۰۱:۱۵ بامداد روز بعد» rather
 * than having to compare two full dates themselves.
 */
export function clockWithDay(departure: string | null | undefined, arrival: string | null | undefined): string {
  if (!departure || !arrival) return "";
  const from = Date.parse(departure);
  const to = Date.parse(arrival);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return "";
  const days = Math.round(
    (Date.parse(`${arrival.slice(0, 10)}T00:00:00Z`) - Date.parse(`${departure.slice(0, 10)}T00:00:00Z`)) / 86_400_000,
  );
  if (days <= 0) return "";
  const fa = (value: number) => String(value).replace(/[0-9]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  return `${fa(days)} روز بعد`;
}
