/**
 * Opening the real Neshan navigator for one place.
 *
 * Two links are produced, so it works on every device without any account,
 * sign-up or key from the traveller:
 *   web   — https://nshn.ir/?origin=lat,lng&destination=lat,lng&vehicle=d
 *           (Neshan's own official format: opens the web navigator in the browser)
 *   app   — neshan://?origin=…&destination=…&vehicle=d
 *           (opens the installed Neshan app directly, if there is one)
 * Both take latitude,longitude in this exact order — Neshan's own order.
 */

export type NavPoint = { latitude: number; longitude: number };

function coords(point: NavPoint): string {
  return `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
}

function valid(point: NavPoint | null | undefined): point is NavPoint {
  return Boolean(
    point &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 &&
      Math.abs(point.longitude) <= 180 &&
      !(point.latitude === 0 && point.longitude === 0),
  );
}

/** Route from the traveller's position to the place, opened in Neshan. */
export function neshanRouteLinks(origin: NavPoint | null | undefined, destination: NavPoint): { web: string; app: string } | null {
  if (!valid(destination)) return null;
  const target = valid(origin)
    ? `origin=${coords(origin)}&destination=${coords(destination)}&vehicle=d`
    : `destination=${coords(destination)}&vehicle=d`;
  return { web: `https://nshn.ir/?${target}`, app: `neshan://?${target}` };
}

/** Just the place's pin on the Neshan map, for people who want to look around first. */
export function neshanPinLink(point: NavPoint): string | null {
  if (!valid(point)) return null;
  return `https://nshn.ir/?lat=${point.latitude.toFixed(6)}&lng=${point.longitude.toFixed(6)}`;
}

/** Opens the native app when the device supports it, otherwise the web navigator. */
export function openNeshanNavigation(origin: NavPoint | null | undefined, destination: NavPoint, options: { timeoutMs?: number } = {}): void {
  const links = neshanRouteLinks(origin, destination);
  if (!links) return;
  if (typeof window === "undefined") return;
  const hiddenAt = Date.now();
  let left = false;
  const onHide = () => {
    left = true;
  };
  document.addEventListener("visibilitychange", onHide, { once: true });
  window.addEventListener("pagehide", onHide, { once: true });
  // Try the installed app first; if nothing took over, open the web navigator.
  window.location.href = links.app;
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    if (left || document.visibilityState === "hidden" || Date.now() - hiddenAt < 200) return;
    window.open(links.web, "_blank", "noopener,noreferrer");
  }, options.timeoutMs ?? 900);
}

/** A human-readable Google Maps fallback, honest about being Google. */
export function googleRouteLink(origin: NavPoint | null | undefined, destination: NavPoint): string {
  const target = valid(origin)
    ? `saddr=${coords(origin)}&daddr=${coords(destination)}`
    : `daddr=${coords(destination)}`;
  return `https://www.google.com/maps/dir/?api=1&${target}&travelmode=driving`;
}
