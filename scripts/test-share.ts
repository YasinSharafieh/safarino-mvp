/**
 * A shared plan is public: it may show the trip, and nothing else. These
 * checks guard what goes into a link, what comes back out, and what happens
 * when the store is down or the input is nonsense.
 */
import fs from "node:fs";
import {
  INLINE_URL_LIMIT,
  SHARE_MAX_DAYS,
  SHARE_MAX_STOPS_PER_DAY,
  compactTrip,
  decodeTripToken,
  encodeTripToToken,
  isValidShareCode,
  loadSharedTrip,
  makeShareCode,
  saveSharedTrip,
  shareSummary,
  telegramShareUrl,
  whatsappShareUrl,
  type ShareTrip,
} from "../lib/share";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const stop = (name: string, extra: Record<string, unknown> = {}) => ({
  place: {
    id: name,
    name,
    category: "زیارتی و مسجد",
    latitude: 36.2879,
    longitude: 59.6156,
    description: "حرم مطهر امام رضا، مهم‌ترین زیارتگاه ایران.",
    imageUrl: "https://upload.wikimedia.org/x.jpg",
    ...extra,
  },
  order: 1,
  startTime: "۰۹:۰۰",
  visitMinutes: 90,
  legKm: 1.4,
  legMinutes: 6,
  legEngine: "نشان",
});

const rawTrip = {
  success: true,
  city: "مشهد",
  days: [
    { day: 1, theme: "زیارتی", area: "مرکز شهر", lunchAfter: 2, totalKm: 5.2, totalDriveMinutes: 18, stops: [stop("حرم امام رضا"), stop("مسجد گوهرشاد")] },
    { day: 2, theme: "فرهنگی", area: "احمدآباد", lunchAfter: 1, totalKm: 8.8, totalDriveMinutes: 26, stops: [stop("موزهٔ آستان قدس")] },
  ],
  totals: { km: 14, driveMinutes: 44, stops: 3, days: 2 },
  engine: "نشان",
  note: "بر اساس جاذبه‌های واقعی.",
  unused: [{ id: "x", name: "باغ خونی" }],
  weather: {
    mode: "forecast",
    note: "منبع: Open-Meteo",
    days: [{ date: "2026-11-12", label: "مه", code: 45, maxC: 11.4, minC: 3.5, rainProbability: 50, advice: "لباس گرم بردارید.", tone: "warn", icon: "cloud" }],
    suggestion: null,
  },
  money: {
    total: 18_380_000,
    real: 6_800_000,
    estimate: 11_580_000,
    budget: 15_000_000,
    remaining: -3_380_000,
    lines: [
      { label: "اقامتگاه", amount: 4_800_000, kind: "real" },
      { label: "خوراک", amount: 5_400_000, kind: "estimate" },
      { label: "رانندگی در شهر", amount: null, kind: "missing" },
    ],
  },
  // Everything below must never reach a public link.
  apiKey: "neshan-secret-key",
  UPSTASH_REDIS_REST_TOKEN: "upstash-secret",
  origin: { latitude: 36.293323, longitude: 59.62743 },
  generatedAt: "2026-11-05T10:00:00.000Z",
  unmeasuredLegs: 0,
};

console.log("What a shared plan keeps");
const parsed = compactTrip(rawTrip);
check("a real plan compacts", parsed !== null);
if (!parsed) {
  console.log("\nCannot continue without a compacted plan.");
  process.exit(1);
}
const compact: ShareTrip = parsed;
check("the city is kept", compact.city === "مشهد");
check("both days are kept", compact.days.length === 2);
check("the stops are kept", compact.totals.stops === 3);
check("measured kilometres are kept", compact.days[0].km === 5.2 && compact.days[0].stops[0].km === 1.4);
check("the money is kept with its labels", compact.money?.lines[0].kind === "real" && compact.money?.lines[1].kind === "estimate");
check("a missing amount stays missing", compact.money?.lines[2].amount === null);
check("the weather is kept", compact.weather?.days.length === 1 && compact.weather?.mode === "forecast");
check("the version is stamped", compact.v === 1 && typeof compact.createdAt === "string");

console.log("What a shared plan must not keep");
const serialised = JSON.stringify(compact);
check("no api key", !serialised.includes("neshan-secret-key"));
check("no storage token", !serialised.includes("upstash-secret"));
check("the label of a secret is not there either", !serialised.includes("UPSTASH"));
check("no hotel pin (only real stops are published)", !serialised.includes("36.293323"));
check("only the known fields exist", Object.keys(compact).sort().join(",") === "city,createdAt,days,engine,money,note,totals,v,weather");
const stopKeys = Object.keys(compact.days[0].stops[0]).sort().join(",");
check("a stop has only its planned fields", stopKeys === "c,d,i,km,la,lo,mn,n,t,v", stopKeys);

console.log("Compacting twice changes nothing");
const twice = compactTrip(JSON.parse(JSON.stringify(compact)));
check("an already compacted plan is accepted", twice !== null);
check("the days survived the second pass", twice?.days.length === compact.days.length);
check("the stops survived the second pass", twice?.totals.stops === compact.totals.stops);
check("the kilometres survived the second pass", twice?.days[0].stops[0].km === 1.4);
check("the money survived the second pass", twice?.money?.total === compact.money?.total);

console.log("Nonsense in, nothing out");
check("an empty object is refused", compactTrip({}) === null);
check("a plan without days is refused", compactTrip({ city: "مشهد", days: [] }) === null);
check("a plan without a city is refused", compactTrip({ days: rawTrip.days }) === null);
check("text is refused", compactTrip("plan") === null);
check("null is refused", compactTrip(null) === null);
const noCoords = compactTrip({ city: "مشهد", days: [{ day: 1, stops: [{ place: { name: "بی‌مختصات" } }] }] });
check("a stop without coordinates is dropped", noCoords === null);
const outOfRange = compactTrip({ city: "مشهد", days: [{ day: 1, stops: [stop("دور", { latitude: 500, longitude: 900 })] }] });
check("impossible coordinates are dropped", outOfRange === null);

console.log("Big plans are cut, not published whole");
const manyDays = {
  city: "مشهد",
  days: Array.from({ length: 20 }, (_, index) => ({
    day: index + 1,
    stops: Array.from({ length: 20 }, (_, stopIndex) => stop(`مکان ${index + 1}-${stopIndex + 1}`)),
  })),
};
const big = compactTrip(manyDays);
check("day count is capped", big?.days.length === SHARE_MAX_DAYS, String(big?.days.length));
check("stops per day are capped", big?.days.every((day) => day.stops.length === SHARE_MAX_STOPS_PER_DAY) === true);
const longName = compactTrip({ city: "مشهد", days: [{ day: 1, stops: [stop("م".repeat(400), { description: "د".repeat(2000) })] }] });
check("a long name is shortened", (longName?.days[0].stops[0].n.length || 0) <= 91);
check("a long description is shortened", (longName?.days[0].stops[0].d?.length || 0) <= 241);

console.log("Codes are short, safe and readable");
const code = makeShareCode();
check("nine characters", code.length === 9, code);
check("only readable lowercase letters and digits", /^[a-z0-9]{9}$/.test(code));
check("no confusing letters", !/[ilo01]/.test(code), code);
check("a fixed random gives a fixed code", makeShareCode(() => 0) === "aaaaaaaaa");
check("valid codes pass", isValidShareCode("abc234xyz") && isValidShareCode(code));
check("path tricks are refused", !isValidShareCode("../etc/passwd") && !isValidShareCode("a/b") && !isValidShareCode("ABC234xyz"));
check("empty and huge codes are refused", !isValidShareCode("") && !isValidShareCode("a".repeat(400)) && !isValidShareCode(undefined));

console.log("The self-contained link works and cannot be faked");
const token = encodeTripToToken(compact);
check("the token has no unsafe characters", /^[A-Za-z0-9_-]+$/.test(token));
check("the token is short enough for messengers", token.length < INLINE_URL_LIMIT, String(token.length));
const decoded = decodeTripToken(token);
check("it comes back as the same plan", decoded?.city === compact.city && decoded?.totals.stops === compact.totals.stops);
check("Persian survives the round trip", decoded?.days[0].stops[0].n === "حرم امام رضا");
check("the money survives", decoded?.money?.total === compact.money?.total);
check("garbage is refused", decodeTripToken("not-a-token") === null && decodeTripToken("") === null && decodeTripToken(123) === null);
check("a broken body is refused", decodeTripToken(token.slice(0, 40)) === null);
check("a wrong version is refused", decodeTripToken(Buffer.from(JSON.stringify({ v: 9, days: [1] }), "utf8").toString("base64url")) === null);

async function storeChecks() {
  console.log("The store is optional, never fatal");
  const saved = await saveSharedTrip(compact, "abc234xyz");
  check("without a store it returns null instead of throwing", saved === null);
  check("loading from a store that is not there gives null", (await loadSharedTrip("abc234xyz")) === null);
  check("an invalid code never reaches the store", (await saveSharedTrip(compact, "no/slash")) === null && (await loadSharedTrip("../x")) === null);
}

async function main() {
  await storeChecks();

console.log("Messages say what the plan is");
const summary = shareSummary(compact);
check("the summary names the city", summary.includes("مشهد"));
check("the summary counts in Persian digits", !/[0-9]/.test(summary), summary);
check("the summary mentions the money", summary.includes("تومان"), summary);
const wa = whatsappShareUrl("https://safarino-mvp.vercel.app/s/abc234xyz", compact);
check("the whatsapp link is a wa.me link", wa.startsWith("https://wa.me/?text="));
check("the link travels inside the message", decodeURIComponent(wa).includes("https://safarino-mvp.vercel.app/s/abc234xyz"));
check("the wa message has no raw spaces", !wa.includes(" "));
const tg = telegramShareUrl("https://safarino-mvp.vercel.app/s/abc234xyz", compact);
check("the telegram link carries url and text", tg.startsWith("https://t.me/share/url?url=") && tg.includes("&text="));

console.log("The app publishes through the right doors");
const route = fs.readFileSync("app/api/share/route.ts", "utf8");
const page = fs.readFileSync("app/s/[code]/page.tsx", "utf8");
const card = fs.readFileSync("lib/share-card.ts", "utf8");
const component = fs.readFileSync("components/ShareTrip.tsx", "utf8");
check("the api validates before storing", route.includes("compactTrip(") && route.includes("saveSharedTrip("));
check("the api falls back to the self-contained link", route.includes("encodeTripToToken("));
check("the api never returns a secret", !route.includes("UPSTASH") && !route.includes("process.env"));
check("the shared page is rendered fresh for every visitor", page.includes('dynamic = "force-dynamic"'));
check("the shared page reads both link shapes", page.includes("loadSharedTrip(") && page.includes("decodeTripToken("));
check("a missing plan is a real 404", page.includes("notFound()"));
check("the shared page labels what is real and what is estimated", page.includes("واقعی") && page.includes("تخمین"));
check("the card is drawn locally, no external images", !card.includes("<img") && !card.includes("http://") && !card.includes("https://unpkg"));
check("the card names the site", card.includes("safarino-mvp.vercel.app"));
check("the panel talks to our own api only", component.includes('fetch("/api/share"'));
check("the panel writes nothing to storage", !component.includes("localStorage") && !component.includes("sessionStorage"));

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nSharing tests passed.");
}

void main();
