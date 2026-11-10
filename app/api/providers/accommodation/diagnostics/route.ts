import { NextRequest, NextResponse } from "next/server";
import { publicProviderJson } from "../../../../../lib/public-provider-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Json = Record<string, unknown>;

function record(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}
function rows(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(record) : [];
}
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

/** Which keys carry photo lists, amenities or review text anywhere inside a raw item. */
function scan(value: unknown, path = "", depth = 0, hits: string[] = []): string[] {
  if (depth > 6 || hits.length > 120) return hits;
  if (Array.isArray(value)) {
    const label = path;
    const strings = value.filter((item) => typeof item === "string" && /^https?:\/\//.test(item)).length;
    if (strings >= 2) hits.push(`${label} => ${strings} url strings`);
    const arr = value.filter((item) => item && typeof item === "object");
    if (arr.length) hits.push(`${label} => array of objects (${arr.length}) keys: ${Object.keys(arr[0] as Json).slice(0, 8).join(",")}`);
    value.slice(0, 2).forEach((item, index) => scan(item, `${label}[${index}]`, depth + 1, hits));
    return hits;
  }
  if (!value || typeof value !== "object") return hits;
  for (const [key, item] of Object.entries(value as Json)) {
    const next = path ? `${path}.${key}` : key;
    if (/photo|image|picture|gallery|media/i.test(key)) hits.push(`${next} :: ${Array.isArray(item) ? `array(${item.length})` : typeof item}`);
    if (/amenit|facilit|feature|service|equipment/i.test(key)) hits.push(`${next} :: ${Array.isArray(item) ? `array(${item.length})` : typeof item}`);
    if (/review|comment|rating|rate/i.test(key)) hits.push(`${next} :: ${Array.isArray(item) ? `array(${item.length})` : typeof item}`);
    scan(item, next, depth + 1, hits);
  }
  return hits;
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city") || "کیش";
  const provider = request.nextUrl.searchParams.get("provider") || "jajiga";
  const output: Json = { provider, city };
  try {
    if (provider === "jajiga") {
      const locations = record(await publicProviderJson("https://api.jajiga.com/api/autocomplete", { query: { phrase: city } }));
      const location = rows(locations.items).find((item) => text(item.type) !== "room");
      const payload = record(await publicProviderJson("https://api.jajiga.com/api/search", {
        query: { "locations[]": [text(location?.id)], checkin: "2026-11-20", checkout: "2026-11-22", min_capacity: 2, order: "low_price", page: 1, per_page: 5, "with[]": ["rooms"] },
      }));
      const item = rows(record(payload.rooms).items)[0] || {};
      output.keys = Object.keys(item);
      output.hits = scan(item);
      output.pictures = record(item.pictures);
      output.sample = { title: item.title, properties: item.properties };
    } else if (provider === "otaghak") {
      const locations = await publicProviderJson("https://api.otaghak.com/api/v1/Search/GetSearchResult", { query: { input: city } });
      const location = rows(locations).find((item) => text(item.typeCode) === "city");
      const payload = record(await publicProviderJson("https://api.otaghak.com/api/v3/RoomSearch/SearchRooms", {
        method: "POST",
        body: { cities: [text(location?.cityCode)], stateCodes: [], checkIn: "2026-11-20", checkOut: "2026-11-22", person: 2, sortingType: "MinPricePriority", aroundLocations: false, skip: 0, take: 5 },
      }));
      const item = rows(payload.rooms)[0] || {};
      output.keys = Object.keys(item);
      output.hits = scan(item);
      output.sample = item;
    } else if (provider === "jabama") {
      const locations = record(await publicProviderJson("https://api.jabama.com/api/v1/filters/locations/autocomplete", { query: { term: city, locale: "fa" } }));
      output.locationKeys = Object.keys(locations);
    }
  } catch (error) {
    output.error = error instanceof Error ? error.message : "failed";
  }
  return NextResponse.json({ success: true, ...output });
}
