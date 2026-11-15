/**
 * «شهر تو کجاست؟» — the home page needs an origin to build packages from.
 *
 * Three honest steps, no question asked:
 *   1. what the traveller already chose on this device (a previous visit),
 *   2. the browser's location, mapped to the nearest real Iranian city,
 *   3. the server's own guess from the network (x-vercel-ip-city), else تهران.
 *
 * The browser location is only asked once and never stored anywhere but this
 * device.
 */

import { IRANIAN_CITIES } from "./iran-cities";

const ORIGIN_KEY = "safarino-home-origin-v1";

export function nearestIranianCity(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  let best: { name: string; distance: number } | null = null;
  for (const city of IRANIAN_CITIES) {
    if (typeof city.latitude !== "number" || typeof city.longitude !== "number") continue;
    // Squared degrees are enough to pick the nearest city; no need for haversine.
    const dLat = city.latitude - latitude;
    const dLng = (city.longitude - longitude) * Math.cos((latitude * Math.PI) / 180);
    const distance = dLat * dLat + dLng * dLng;
    if (!best || distance < best.distance) best = { name: city.name, distance };
  }
  return best?.name ?? null;
}

export function readSavedOrigin(): string | null {
  try {
    const value = window.localStorage.getItem(ORIGIN_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function saveOrigin(city: string) {
  try {
    window.localStorage.setItem(ORIGIN_KEY, city);
  } catch {
    // A private window that refuses storage is not an error worth showing.
  }
}

/** Asks the browser for a one-off location and turns it into a city name. */
export function detectBrowserCity(timeoutMs = 6_000): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (value: string | null) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer);
        finish(nearestIranianCity(position.coords.latitude, position.coords.longitude));
      },
      () => {
        window.clearTimeout(timer);
        finish(null);
      },
      { timeout: timeoutMs, maximumAge: 10 * 60_000, enableHighAccuracy: false },
    );
  });
}
