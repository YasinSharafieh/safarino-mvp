/**
 * The offline copy must help without ever lying. It may keep pages and
 * pictures; it may never keep a live price or a live search answer, must never
 * touch a POST, and must never cache a traveller's shared link.
 */
import fs from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const sw = fs.readFileSync("public/sw.js", "utf8");
const manifest = fs.readFileSync("app/manifest.ts", "utf8");
const offlinePage = fs.readFileSync("app/offline/page.tsx", "utf8");
const keeper = fs.readFileSync("components/OfflineKeeper.tsx", "utf8");
const registrar = fs.readFileSync("components/ServiceWorkerRegistrar.tsx", "utf8");
const layout = fs.readFileSync("app/layout.tsx", "utf8");
const itinerary = fs.readFileSync("app/itinerary/page.tsx", "utf8");

console.log("The worker only keeps what is safe");
check("it ignores anything that is not a GET", sw.includes('request.method !== "GET"'));
check("it never keeps api answers", sw.includes('"/api/"') && sw.includes("NEVER_CACHE"));
check("a shared plan is never kept", sw.includes('"/s/"'));
check("images are kept on purpose", sw.includes('"/api/neshan/static"') && sw.includes('"/api/provider-assets"'));
check("it caps what it keeps", sw.includes("IMAGE_LIMIT") && sw.includes("PAGES_LIMIT"));
check("it clears old versions on activate", sw.includes("caches.keys()") && sw.includes("caches.delete"));
check("it gives up on a slow network instead of hanging", sw.includes("NAVIGATION_TIMEOUT_MS") && sw.includes("Promise.race"));
check("a missing page falls back to the offline page", sw.includes("OFFLINE_URL") && sw.includes('OFFLINE_URL = "/offline.html"'));
const fallback = fs.readFileSync("public/offline.html", "utf8");
check("the fallback page needs no JavaScript", !/<script[^>]*src=/.test(fallback) && fallback.includes("<style>"));
check("the fallback page is Persian and right-to-left", fallback.includes('lang="fa"') && fallback.includes('dir="rtl"'));
check("the fallback page explains itself", fallback.includes("اینترنتی نیست"));
check("the fallback page offers the saved plan", fallback.includes('href="/itinerary"'));
check("only same-origin requests are handled", sw.includes("url.origin !== self.location.origin"));
check("it can warm the pictures before a trip", sw.includes('data.type === "warm"') && sw.includes("warmUrls"));

console.log("The offline page is honest");
check("the page exists", fs.existsSync("app/offline/page.tsx"));
check("it says there is no network", offlinePage.includes("بدون اینترنت") || offlinePage.includes("اینترنتی نیست"));
check("it shows the last saved plan from the device", offlinePage.includes("ITINERARY_STORAGE_KEY"));
check("it promises nothing live is faked", offlinePage.includes("بدون اینترنت به‌روز نمی‌شوند"));
check("it explains how to prepare next time", offlinePage.includes("ذخیره برای آفلاین"));
check("it never fetches anything itself", !offlinePage.includes("fetch("));

console.log("The app can be installed on a phone");
check("a manifest exists", fs.existsSync("app/manifest.ts"));
check("it is a standalone app", manifest.includes('display: "standalone"'));
check("it is Persian and right-to-left", manifest.includes('lang: "fa"') && manifest.includes('dir: "rtl"'));
check("it names the site", manifest.includes("سفرینو"));
check("the icons exist on disk", ["192", "512"].every((size) => fs.existsSync(`public/icons/icon-${size}.png`)));
check("there is a maskable icon", fs.existsSync("public/icons/icon-maskable-512.png"));
check("the manifest points at real icons", manifest.includes("/icons/icon-192.png") && manifest.includes("/icons/icon-maskable-512.png"));
check("the icons are real PNG files", fs.readFileSync("public/icons/icon-192.png").subarray(1, 4).toString("ascii") === "PNG");

console.log("The site registers it and offers it in the right place");
check("the worker is registered site-wide", layout.includes("ServiceWorkerRegistrar") && registrar.includes('register("/sw.js")'));
check("registration never breaks a page", registrar.includes("catch"));
check("the plan page offers to keep the trip", itinerary.includes("<OfflineKeeper") && itinerary.includes("offlineImages"));
check("the button says what it does", keeper.includes("ذخیره برای آفلاین"));
check("the offer explains what is not available offline", keeper.includes("آفلاین کار نمی‌کنند"));
check("keeping it uses the traveller's own pictures", keeper.includes("warmUrls") && keeper.includes("mode: \"no-cors\""));

console.log("The plan itself survives without a network");
check("the page keeps a copy on the device", itinerary.includes("ITINERARY_OFFLINE_KEY"));
check("it reads that copy when the network fails", itinerary.includes("restoreOfflineCopy"));
check("a saved copy is shown with its date", itinerary.includes("نسخهٔ ذخیره‌شده روی این دستگاه"));
check("it says the numbers are from that moment", itinerary.includes("نه امروز"));
const storage = fs.readFileSync("lib/itinerary-storage.ts", "utf8");
check("the key is defined once", storage.includes("ITINERARY_OFFLINE_KEY"));

console.log("The font ships with the site, so offline text still looks right");
check("the font file is local", fs.existsSync("public/fonts/Vazirmatn-Variable.woff2"));
check("the worker keeps the font", sw.includes("/fonts/Vazirmatn-Variable.woff2"));

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nOffline tests passed.");
