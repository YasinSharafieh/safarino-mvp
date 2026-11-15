/**
 * The link «پیشنهادهای ویژه» produces must arrive as a filled-in trip.
 *
 * The parsing lives here (not inside the page) so it can be tested: only real
 * dates, a real mode and sane numbers are accepted, and anything else is left
 * for the traveller to choose instead of being guessed.
 */

export type PrefilledTicket = {
  mode: "plane" | "train" | "bus";
  operator: string;
  service: string;
  priceToman: number;
  provider: string;
  providerLabel: string;
  bookingUrl: string;
  departure: string;
  arrival: string | null;
};

export type PrefilledStay = {
  name: string;
  typeLabel: string;
  location: string;
  provider: string;
  providerLabel: string;
  photo: string | null;
  rating: number | null;
  pricePerNightToman: number;
  priceTotalToman: number;
  bookingUrl: string;
  nights: number;
};

export type LinkPrefill = {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  days?: number;
  travellers?: number;
  mode?: "plane" | "train" | "bus" | "car";
  roundTrip: boolean;
  /** The home-page package this link came from, if any. */
  packageId?: string;
  /** The exact ticket and room the package was built from. */
  ticket?: PrefilledTicket;
  stay?: PrefilledStay;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/** A date that is a real calendar day, not «2026-13-45». */
function realDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(ISO) ? value : value.match(ISO_TIME)?.[1] ?? null;
  if (!match) return null;
  const date = new Date(`${match}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === match ? match : null;
}

/** A JSON parameter, decoded defensively: a broken one is simply ignored. */
function readJson(value: string | null): Record<string, unknown> | null {
  if (!value || value.length > 3_000) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const str = (value: unknown, max = 160) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const num = (value: unknown, min = 0, max = 1_000_000_000) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? Math.round(parsed) : null;
};

function readTicket(value: string | null): PrefilledTicket | null {
  const row = readJson(value);
  if (!row) return null;
  const mode = str(row.mode, 8);
  if (!["plane", "train", "bus"].includes(mode)) return null;
  const priceToman = num(row.priceToman, 1, 500_000_000);
  const bookingUrl = str(row.bookingUrl, 600);
  if (!priceToman || !/^https?:\/\//.test(bookingUrl)) return null;
  const departure = str(row.departure, 40);
  return {
    mode: mode as PrefilledTicket["mode"],
    operator: str(row.operator, 80) || (mode === "plane" ? "پرواز" : mode === "train" ? "قطار" : "اتوبوس"),
    service: str(row.service, 120),
    priceToman,
    provider: str(row.provider, 30) || "provider",
    providerLabel: str(row.providerLabel, 40) || "منبع",
    bookingUrl,
    departure: realDate(departure) && /T/.test(departure) ? departure.slice(0, 25) : "",
    arrival: str(row.arrival, 25) || null,
  };
}

function readStay(value: string | null): PrefilledStay | null {
  const row = readJson(value);
  if (!row) return null;
  const name = str(row.name, 120);
  const priceTotalToman = num(row.priceTotalToman, 1, 2_000_000_000);
  if (!name || !priceTotalToman) return null;
  return {
    name,
    typeLabel: str(row.typeLabel, 40) || "اقامتگاه",
    location: str(row.location, 120),
    provider: str(row.provider, 30) || "provider",
    providerLabel: str(row.providerLabel, 40) || "منبع",
    photo: /^(https?:\/\/|\/)/.test(str(row.photo, 600)) ? str(row.photo, 600) : null,
    rating: num(row.rating, 0, 10) ?? null,
    pricePerNightToman: num(row.pricePerNightToman, 0, 200_000_000) ?? 0,
    priceTotalToman,
    bookingUrl: /^https?:\/\//.test(str(row.bookingUrl, 600)) ? str(row.bookingUrl, 600) : "",
    nights: num(row.nights, 1, 30) ?? 1,
  };
}

export function parseTripLink(search: string): LinkPrefill | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const origin = (params.get("from") || "").trim();
  const destination = (params.get("to") || "").trim();
  const departureDate = realDate(params.get("date"));
  const returnDate = realDate(params.get("return"));
  const modeParam = (params.get("mode") || "").trim();
  const mode = ["plane", "train", "bus", "car"].includes(modeParam)
    ? (modeParam as LinkPrefill["mode"])
    : undefined;
  const nights = Number(params.get("nights"));
  const adults = Number(params.get("adults"));

  const packageId = str(params.get("pkg"), 40);
  const ticket = readTicket(params.get("tkt"));
  const stay = readStay(params.get("stay"));

  if (!origin && !destination && !departureDate && !returnDate && !mode && !ticket) return null;

  const days = Number.isFinite(nights) && nights > 0 && nights <= 30 ? Math.round(nights) + 1 : undefined;
  const travellers = Number.isFinite(adults) && adults > 0 ? Math.min(9, Math.round(adults)) : undefined;
  const roundTrip = Boolean(returnDate);

  return {
    ...(origin ? { origin } : {}),
    ...(destination ? { destination } : {}),
    ...(departureDate ? { departureDate } : {}),
    ...(returnDate ? { returnDate } : {}),
    ...(days ? { days } : {}),
    ...(travellers ? { travellers } : {}),
    ...(mode ? { mode } : {}),
    ...(packageId ? { packageId } : {}),
    ...(ticket ? { ticket } : {}),
    ...(stay ? { stay } : {}),
    roundTrip,
  };
}
