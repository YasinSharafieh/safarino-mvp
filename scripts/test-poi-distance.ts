/**
 * Tests for the distance engine: Neshan first, OpenStreetMap routing second,
 * labelled straight line last. No network is required — the Neshan and OSRM
 * responses are simulated exactly as their documented payloads look.
 *
 * Run with: npx tsx scripts/test-poi-distance.ts
 */

import { computePoiDistances, haversineKm, usableCoordinates } from "../lib/poi-distance";
import { neshanConfigured, neshanStatusFromHttp, neshanStatusNote } from "../lib/neshan";

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const origin = { latitude: 36.2972, longitude: 59.6067 }; // مشهد, a real pin
const targets = [
  { id: "a", latitude: 36.2878, longitude: 59.6153 },
  { id: "b", latitude: 36.3, longitude: 59.59 },
];

const realFetch = global.fetch;
function stubFetch(handler: (url: string) => { status: number; body: unknown }) {
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input.url);
    const { status, body } = handler(url);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

async function main() {
  console.log("Coordinate and straight-line maths");
  check("rejects a zero pin", !usableCoordinates({ latitude: 0, longitude: 0 }));
  check("rejects a point outside Iran", !usableCoordinates({ latitude: 51.5, longitude: -0.12 }));
  check("accepts a real Iranian pin", usableCoordinates(origin));
  const straight = haversineKm(origin, targets[0]);
  check("haversine returns a plausible kilometre value", straight > 1 && straight < 3, String(straight));

  console.log("Engine order: Neshan when configured");
  process.env.NESHAN_API_KEY = "test-key-not-real";
  check("key is detected", neshanConfigured());
  let sawNeshanHeader = false;
  stubFetch((url) => {
    if (!url.includes("api.neshan.org/v1/distance-matrix")) return { status: 404, body: {} };
    return {
      status: 200,
      body: {
        status: "Ok",
        rows: [
          {
            elements: [
              { status: "Ok", duration: { value: 699, text: "۱۲ دقیقه" }, distance: { value: 8332, text: "۸ کیلومتر" } },
              { status: "NoRoute" },
            ],
          },
        ],
        origin_addresses: ["36.297200,59.606700"],
        destination_addresses: ["36.287800,59.615300", "36.300000,59.590000"],
      },
    };
  });
  const neshanResult = await computePoiDistances(origin, targets, { cacheSeconds: 0 });
  check("engine is neshan", neshanResult.engine === "neshan", neshanResult.engine);
  check("distance is converted from metres", neshanResult.entries[0]?.distanceKm === 8.3, String(neshanResult.entries[0]?.distanceKm));
  check("duration is converted from seconds", neshanResult.entries[0]?.durationMinutes === 12, String(neshanResult.entries[0]?.durationMinutes));
  check("NoRoute is reported, never invented", neshanResult.failedIds.join(",") === "b", neshanResult.failedIds.join(","));
  check("a key is never echoed in the note", !neshanResult.note.includes("test-key"), neshanResult.note);

  console.log("Falls back to OpenStreetMap routing when Neshan refuses the key");
  stubFetch((url) => {
    if (url.includes("api.neshan.org")) return { status: 480, body: { status: "KeyNotFound" } };
    if (url.includes("router.project-osrm.org")) {
      return { status: 200, body: { distances: [[4200, 3100]], durations: [[600, 450]] } };
    }
    return { status: 404, body: {} };
  });
  const osrmResult = await computePoiDistances(origin, targets, { cacheSeconds: 0 });
  check("engine is osrm", osrmResult.engine === "osrm", osrmResult.engine);
  check("both distances survive", osrmResult.entries.length === 2, String(osrmResult.entries.length));
  check("note explains the Neshan refusal", osrmResult.note.includes("کلید نشان"), osrmResult.note);
  check("HTTP 480 maps to unauthorized", neshanStatusFromHttp(480) === "unauthorized");
  check("HTTP 482 maps to rate limiting", neshanStatusFromHttp(482) === "rate_limited");

  console.log("Falls back to a labelled straight line when routing is unreachable");
  stubFetch(() => {
    throw new Error("network down");
  });
  const offline = await computePoiDistances(origin, targets, { cacheSeconds: 0 });
  check("engine is straight-line", offline.engine === "straight-line", offline.engine);
  check("the label says it is not a driving route", offline.note.includes("خط مستقیم"), offline.note);
  check("every target still gets a distance", offline.entries.length === 2);

  console.log("Bad origin never produces a number");
  const badOrigin = await computePoiDistances({ latitude: 0, longitude: 0 }, targets);
  check("no entries", badOrigin.entries.length === 0);
  check("explains why", badOrigin.note.includes("مختصات اقامتگاه"), badOrigin.note);

  console.log("A keyless result is never reused once a key exists");
  process.env.NESHAN_API_KEY = "test-key-not-real";
  let called = "";
  stubFetch((url) => {
    called = url.includes("api.neshan.org") ? "neshan" : "osrm";
    if (url.includes("api.neshan.org")) {
      return { status: 200, body: { status: "Ok", rows: [{ elements: [{ status: "Ok", distance: { value: 5000 }, duration: { value: 600 } }, { status: "Ok", distance: { value: 7000 }, duration: { value: 800 } }] }] } };
    }
    return { status: 200, body: { distances: [[1000, 2000]], durations: [[100, 200]] } };
  });
  const withKey = await computePoiDistances(origin, targets, { cacheSeconds: 3600 });
  check("with a key the engine is neshan", withKey.engine === "neshan", withKey.engine);
  check("the Neshan request was actually made", called === "neshan", called);

  console.log("Status notes");
  check("missing key is explained in Persian", neshanStatusNote("not_configured").includes("نشان"));

  global.fetch = realFetch;
  delete process.env.NESHAN_API_KEY;

  if (failures) {
    console.log(`\n${failures} distance test(s) failed.`);
    process.exit(1);
  }
  console.log("\nDistance engine tests passed.");
}

main().catch((error) => {
  global.fetch = realFetch;
  console.error(error);
  process.exit(1);
});
