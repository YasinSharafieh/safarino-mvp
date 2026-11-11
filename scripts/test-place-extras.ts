/**
 * Locks the two new parts of a place card and the traveller-friendly rules:
 *  - a short, practical description from the place's own source;
 *  - a one-tap Neshan navigation link in Neshan's official format;
 *  - no screen ever asks the traveller for a Neshan key.
 */
import fs from "node:fs";
import { shortDescription } from "../lib/place-photos";
import { neshanRouteLinks, neshanPinLink, googleRouteLink } from "../lib/neshan-deeplink";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

console.log("Short description");
const long = "سی‌وسه‌پل یا پل الله‌وردی‌خان، پلی است با ۳۳ دهانه، ۲۹۵ متر طول و ۱۴ متر عرض، که بر روی زاینده‌رود در شهر اصفهان ساخته شده است. این پل در دورهٔ شاه‌عباس اول بنا شد. بخش دوم مقاله که باید حذف شود. بخش سوم هم.";
const short = shortDescription(long);
check("description is not empty", short.length > 20, `${short.length} chars`);
check("description stays short", short.length <= 301, `${short.length} chars`);
check("description never invents a full stop", short.endsWith(".") || short.endsWith("…") || short.endsWith("؟"));
check("empty input stays empty", shortDescription("") === "" && shortDescription(null) === "");
const pronunciation = shortDescription("مسجد گوهرشاد (به انگلیسی: Gohar Shad Mosque) مسجدی تاریخی در مشهد است. دومین جمله.");
check("pronunciation footnotes are removed", !pronunciation.includes("انگلیسی"), pronunciation);

console.log("Neshan navigation links (official nshn.ir format)");
const origin = { latitude: 36.293323, longitude: 59.62743 };
const destination = { latitude: 36.2878, longitude: 59.6153 };
const links = neshanRouteLinks(origin, destination);
check("link exists", Boolean(links));
check("web uses Neshan's own short domain", Boolean(links?.web.startsWith("https://nshn.ir/?")));
check("origin given in latitude,longitude order", Boolean(links?.web.includes("origin=36.293323,59.627430")));
check("destination given in latitude,longitude order", Boolean(links?.web.includes("destination=36.287800,59.615300")));
check("car is the vehicle", Boolean(links?.web.includes("vehicle=d")));
check("app deep link uses the neshan:// scheme", Boolean(links?.app.startsWith("neshan://?")));
check("no key or token in the link", Boolean(links && !/key|token|api/i.test(links.web)));

const onlyDestination = neshanRouteLinks(null, destination);
check("without a start point only the destination is sent", Boolean(onlyDestination?.web.includes("destination=") && !onlyDestination?.web.includes("origin=")));
check("bad coordinates produce no link", neshanRouteLinks(origin, { latitude: 0, longitude: 0 }) === null);

console.log("Pin and fallback links");
check("pin link uses the official point format", neshanPinLink(destination) === "https://nshn.ir/?lat=36.287800&lng=59.615300");
check("google fallback is labelled google and uses lat,lng", googleRouteLink(origin, destination).includes("google.com/maps/dir") && googleRouteLink(origin, destination).includes("saddr=36.293323,59.627430"));

console.log("The traveller is never asked for a key");
const keyCard = fs.existsSync("components/NeshanKeyCard.tsx");
const keyLib = fs.existsSync("lib/neshan-key.ts");
check("key-entry card is gone", !keyCard);
check("browser key storage is gone", !keyLib);
const pages = ["app/accommodation/[id]/page.tsx", "app/plan/page.tsx", "app/accommodation/page.tsx"];
pages.forEach((page) => {
  if (!fs.existsSync(page)) return;
  const text = fs.readFileSync(page, "utf8");
  check(`${page} has no key input`, !/neshanApiKey|NeshanKeyCard|readNeshanKey|رمز نشان/.test(text));
});

console.log("The card has both required parts");
const card = fs.readFileSync("components/PlaceCard.tsx", "utf8");
check("description block exists", card.includes("دربارهٔ این مکان"));
check("description can be expanded", card.includes("توضیحات بیشتر"));
check("navigation block exists", card.includes("<PlaceNavigator"));
const navigator = fs.readFileSync("components/PlaceNavigator.tsx", "utf8");
check("navigator offers one-tap Neshan", navigator.includes("openNeshanNavigation"));
check("navigator measures the real route on the server", navigator.includes("/api/route/neshan-route"));
check("navigator tells the traveller no sign-up is needed", navigator.includes("بدون ثبت‌نام"));

const routeApi = fs.readFileSync("app/api/route/neshan-route/route.ts", "utf8");
check("route api keeps the key on the server", routeApi.includes("resolveNeshanKey()") && !routeApi.includes("body.neshanApiKey"));

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nPlace description and navigation tests passed.");
