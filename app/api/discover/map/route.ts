import { NextRequest } from "next/server";
import { DISCOVER_CITIES, findCity } from "@/lib/discover";
import { cityCoordinate } from "@/lib/poi-search";

export const runtime = "nodejs";

/**
 * A real map picture of a recommended city, so the «کشف» cards show the place
 * itself instead of a stock photo. The Neshan key stays on the server: this
 * route only redirects the browser to Safarino's own picture proxy, which
 * already knows the coordinates it allows.
 */
export function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("city");
  const city = findCity(requested);
  if (!city) {
    return Response.json({ success: false, error: "این شهر در فهرست پیشنهادی نیست." }, { status: 404 });
  }

  const coordinate = cityCoordinate(city.name);
  if (!coordinate || !Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
    // No coordinates: say so instead of drawing a pin somewhere random.
    return Response.json({ success: false, error: "مختصات این شهر در دسترس نیست." }, { status: 503 });
  }

  const url =
    `/api/neshan/static?lat=${coordinate.latitude.toFixed(5)}&lng=${coordinate.longitude.toFixed(5)}` +
    "&zoom=12&w=640&h=320";
  return Response.redirect(new URL(url, request.nextUrl.origin), 307);
}

/** So a tool can ask which cities the map route accepts. */
export function OPTIONS() {
  return Response.json({ success: true, cities: DISCOVER_CITIES.map((city) => city.name) });
}
