export type Raw = Record<string, unknown>;

export function record(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
}

export function rows(value: unknown): Raw[] {
  return Array.isArray(value) ? value.map(record) : [];
}

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

export function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function positiveNumber(value: unknown): number | null {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function toman(rial: unknown): number | null {
  const value = positiveNumber(rial);
  return value === null ? null : Math.round(value / 10);
}

export function normalizeTerm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[۰-۹٠-٩]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10))
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, " ")
    .replace(/[‌\u200e\u200f]/g, "")
    .replace(/\s+/g, " ");
}

export function localized(value: unknown): string {
  const item = record(value);
  return text(item.fa) || text(item.en) || text(value);
}

export function safeImageUrl(value: unknown, hosts: readonly string[], pathPrefix = "/"): string | null {
  const source = text(value);
  if (!source || source.length > 4096) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port) return null;
    if (!url.pathname.startsWith(pathPrefix) || !/\.(?:png|jpe?g|webp)$/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function itemLabel(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const item = record(value);
  return localized(item.title) || localized(item.name) || text(item.text) || text(item.key);
}
