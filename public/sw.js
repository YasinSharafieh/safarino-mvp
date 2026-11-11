/**
 * Safarino's offline worker.
 *
 * A traveller in a car, in a mountain village or in a metro tunnel still needs
 * the plan. This worker keeps three things on the device:
 *   1. the pages the traveller actually opened (so they open again with no
 *      network),
 *   2. the pictures those pages showed (places, maps),
 *   3. the app's own files and font.
 *
 * What it deliberately does NOT do:
 *   - it never caches anything from /api/ that is a search or a price, because
 *     an old price on screen would be a lie,
 *   - it never answers a POST (no booking, no shared-link creation offline),
 *   - it never serves a stale page without saying so — the pages themselves
 *     show when they were made.
 */

const VERSION = "safarino-v1";
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const IMAGE_CACHE = `${VERSION}-images`;
const OFFLINE_URL = "/offline";
const IMAGE_LIMIT = 160;
const PAGES_LIMIT = 40;
const NAVIGATION_TIMEOUT_MS = 6000;

/** Images live behind these API routes; they are safe (and useful) offline. */
const IMAGE_PREFIXES = ["/api/neshan/static", "/api/provider-assets"];
/** Nothing from these is ever kept: live searches, prices, shares, AI. */
const NEVER_CACHE = ["/api/", "/s/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(ASSET_CACHE);
      await Promise.all(
        ["/offline", "/fonts/Vazirmatn-Variable.woff2", "/manifest.webmanifest"].map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch {
            /* one missing file must not stop the worker */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGE_CACHE, ASSET_CACHE, IMAGE_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  // The page can ask for a page and its pictures to be kept before a trip.
  if (data.type === "warm" && Array.isArray(data.urls)) {
    event.waitUntil(warmUrls(data.urls.filter((url) => typeof url === "string").slice(0, 40)));
  }
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  const excess = keys.slice(0, keys.length - limit);
  await Promise.all(excess.map((request) => cache.delete(request)));
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(request, response.clone());
    void trim(cacheName, limit);
  }
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAVIGATION_TIMEOUT_MS)),
    ]);
    if (response && response.ok) {
      await cache.put(request, response.clone());
      void trim(PAGE_CACHE, PAGES_LIMIT);
    }
    return response;
  } catch {
    const hit = await cache.match(request);
    if (hit) return hit;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("آفلاین هستید و این صفحه ذخیره نشده است.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

async function warmUrls(urls) {
  for (const url of urls) {
    try {
      const absolute = new URL(url, self.location.origin);
      if (absolute.origin !== self.location.origin) continue;
      const cacheName = IMAGE_PREFIXES.some((prefix) => absolute.pathname.startsWith(prefix)) ? IMAGE_CACHE : PAGE_CACHE;
      await cacheFirst(new Request(absolute.href, { mode: "no-cors" }), cacheName, cacheName === IMAGE_CACHE ? IMAGE_LIMIT : PAGES_LIMIT);
    } catch {
      /* skip this one and continue */
    }
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const isImage = IMAGE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) || request.destination === "image";
  const isAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/");

  // Pictures: from the device first, so a place card still shows its photo.
  if (isImage) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, IMAGE_LIMIT));
    return;
  }

  // Live data, searches and personal links are never cached.
  if (NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))) return;

  if (isAsset) {
    event.respondWith(cacheFirst(request, ASSET_CACHE, 200));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});
