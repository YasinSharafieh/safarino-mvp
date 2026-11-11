/**
 * One place that knows where the site lives.
 *
 * Today Safarino runs on a preview address; tomorrow it will have its own
 * domain and server. Nothing in the code may hard-code the address, because a
 * hard-coded address breaks links, pictures and search-engine metadata the day
 * the domain changes.
 *
 * The order is always: the configured address (NEXT_PUBLIC_SITE_URL), then the
 * request's own origin, and only at the very end a safe local default.
 */

export const DEFAULT_SITE_URL = "http://localhost:3000";

/**
 * The address configured for this deployment, with no trailing slash.
 *
 * 1. NEXT_PUBLIC_SITE_URL — the real domain, once it exists. This is the only
 *    setting that has to change when Safarino moves to its own server.
 * 2. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL — the hosting platform's own
 *    address, provided automatically, so a fresh deployment is correct even
 *    before anything is configured.
 * 3. localhost, only while developing on a laptop.
 */
export function configuredSiteUrl(): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];
  for (const candidate of candidates) {
    const value = (candidate || "").trim();
    if (!value || value === "localhost:3000") continue;
    const withScheme = /^https?:\/\//.test(value) ? value : `https://${value}`;
    const clean = withScheme.replace(/\/+$/, "");
    if (/^https?:\/\/[^\s/]+/.test(clean)) return clean;
  }
  return null;
}

/** The site address for the current request (server side). */
export function siteUrlFrom(request: Request): string {
  const configured = configuredSiteUrl();
  if (configured) return configured;
  try {
    const origin = new URL(request.url).origin;
    if (origin && origin !== "null") return origin;
  } catch {
    /* fall through to the default */
  }
  return DEFAULT_SITE_URL;
}

/** The site address used in pages and metadata (server side, no request). */
export function siteUrl(): string {
  return configuredSiteUrl() || DEFAULT_SITE_URL;
}

/** A short, human reference used in User-Agent headers sent to providers. */
export function siteReference(): string {
  const configured = configuredSiteUrl();
  const host = configured ? configured.replace(/^https?:\/\//, "") : "safarino.local";
  return `Safarino/1.0 (+https://${host})`;
}

/** The same reference without the scheme, for places that want a bare host. */
export function hostReference(): string {
  const configured = configuredSiteUrl();
  if (!configured) return "safarino.local";
  return configured.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}
