/**
 * The link «پیشنهادهای ویژه» produces must arrive as a filled-in trip.
 *
 * The parsing lives here (not inside the page) so it can be tested: only real
 * dates, a real mode and sane numbers are accepted, and anything else is left
 * for the traveller to choose instead of being guessed.
 */

export type LinkPrefill = {
  origin?: string;
  destination?: string;
  departureDate?: string;
  returnDate?: string;
  days?: number;
  travellers?: number;
  mode?: "plane" | "train" | "bus" | "car";
  roundTrip: boolean;
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

  if (!origin && !destination && !departureDate && !returnDate && !mode) return null;

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
    roundTrip,
  };
}
