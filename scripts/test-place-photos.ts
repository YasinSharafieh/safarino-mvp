/**
 * Checks the picture pipeline: real Wikipedia/Wikimedia photos, a real Neshan
 * map image as the fallback, the image proxy allow-list, and the event filter.
 */
import { placePhoto, wikipediaPhoto, neshanStaticMapUrl, attachPlaceImages } from "../lib/place-photos";
import fs from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

(async () => {
  console.log("Photo sources");
  const haram = await placePhoto({ name: "حرم امام رضا" });
  check("Persian Wikipedia lead photo found", Boolean(haram), haram?.url.slice(0, 60));
  check("photo comes from Wikimedia", Boolean(haram && /^(https:\/\/)?(upload|thumb)\.wikimedia\.org\//.test(haram.url)), haram?.source);
  check("photo carries a credit page", Boolean(haram && haram.creditUrl.includes("wikipedia.org")));

  const missing = await wikipediaPhoto("این-مقاله-قطعا-وجود-ندارد-سفرینو-۱۲۳");
  check("unknown article yields no fake photo", missing === null);

  console.log("Map fallback");
  const mapUrl = neshanStaticMapUrl({ latitude: 36.2972, longitude: 59.6067 });
  check("map fallback points at the Safarino map proxy", mapUrl.startsWith("/api/neshan/static?"));
  check("map fallback keeps the exact coordinates", mapUrl.includes("lat=36.29720") && mapUrl.includes("lng=59.60670"));

  console.log("Every place gets a picture");
  const places = await attachPlaceImages<{ id: string; name: string; latitude: number; longitude: number; imageKind?: "photo" | "map" | "none"; imageUrl?: string | null }>([
    { id: "a", name: "مسجد گوهرشاد", latitude: 36.2878, longitude: 59.6153 },
    { id: "b", name: "جای-نامعلوم-سفرینو", latitude: 36.3, longitude: 59.6 },
  ]);
  check("known place has a real photo", places[0].imageKind === "photo", String(places[0].imageKind));
  check("unknown place falls back to a Neshan map", places[1].imageKind === "map", String(places[1].imageKind));
  check("no place is left without an image", places.every((place) => Boolean(place.imageUrl)));

  console.log("Image proxy allow-list");
  const proxy = fs.readFileSync("app/api/provider-assets/route.ts", "utf8");
  check("Wikimedia upload host allowed", proxy.includes('"upload.wikimedia.org"'));
  check("Wikimedia thumb host allowed", proxy.includes('"thumb.wikimedia.org"'));
  check("hotel CDNs still allowed", proxy.includes('"cdn.alibaba.ir"'));

  console.log("Event articles are not tourist places");
  const search = fs.readFileSync("lib/poi-search.ts", "utf8");
  check("event-name filter exists", search.includes("EVENT_NAME"));
  check("event filter is applied", search.includes("EVENT_NAME.test(candidate.name)"));

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nPlace photo tests passed.");
})();
