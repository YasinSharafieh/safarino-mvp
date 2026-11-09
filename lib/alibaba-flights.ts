import { alibabaCdnUrl } from "./alibaba-assets";

const API_ROOT = "https://ws.alibaba.ir/api";
const SITE_ROOT = "https://www.alibaba.ir";

export type FlightSearchInput = {
  origin: string;
  destination: string;
  date: string;
  adults: number;
  children: number;
  infants: number;
  returnDate?: string;
};

export type FlightOffer = {
  id: string;
  proposalId: string;
  logoUrl: string | null;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  departure: string;
  arrival: string;
  aircraft: string | null;
  fareClass: string | null;
  priceToman: number;
  childPriceToman: number | null;
  infantPriceToman: number | null;
  seatsLeft: number;
  baggageKg: number | null;
  refundable: boolean | null;
  charter: boolean;
  terminal: string | number | null;
};

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toman(rial: unknown): number | null {
  const value = Number(rial);
  return Number.isFinite(value) && value >= 0 ? Math.round(value / 10) : null;
}

export function alibabaJalaliDate(date: string): string {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(`${date}T00:00:00Z`));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function alibabaBookingUrl(input: FlightSearchInput): string {
  const query = new URLSearchParams({
    adult: String(input.adults),
    child: String(input.children),
    infant: String(input.infants),
    departing: alibabaJalaliDate(input.date),
    ticketType: "Family",
    isExclusive: "false",
    isForeign: "false",
    cabinType: "All",
    ...(input.returnDate ? { returning: alibabaJalaliDate(input.returnDate) } : {}),
  });
  return `${SITE_ROOT}/flights/${input.origin}-${input.destination}?${query.toString()}`;
}

export async function alibabaRequest(path: string, init?: { body?: unknown }): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${API_ROOT}/${path}`, {
        method: init?.body ? "POST" : "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
          Origin: SITE_ROOT,
          Referer: `${SITE_ROOT}/`,
          "User-Agent": "Safarino/1.0 (+https://safarino-mvp.vercel.app)",
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        throw new Error(`ALIBABA_HTTP_${response.status}`);
      }
      const payload = await response.json();
      if (payload?.success === false) throw new Error("ALIBABA_SEARCH_REJECTED");
      return payload?.result ?? payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const permanentHttpError = /^ALIBABA_HTTP_(?!429|5\d\d)/.test(message);
      const rejected = message === "ALIBABA_SEARCH_REJECTED";
      if (attempt >= 2 || permanentHttpError || rejected) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw new Error("ALIBABA_REQUEST_FAILED");
}

function normalizeFlight(raw: unknown, index: number): FlightOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const flight = raw as Record<string, unknown>;
  const priceToman = toman(flight.priceAdult);
  const seatsLeft = Number(flight.seat);
  const departure = cleanText(flight.leaveDateTime);
  const arrival = cleanText(flight.arrivalDateTime);
  if (priceToman === null || !Number.isFinite(seatsLeft) || !departure || !arrival) return null;

  const airlineCode = cleanText(flight.airlineCode);
  const flightNumber = cleanText(flight.flightNumber);
  return {
    id: cleanText(flight.flightId, `${airlineCode}${flightNumber}-${departure}-${index}`),
    proposalId: cleanText(flight.proposalId),
    logoUrl: alibabaCdnUrl(flight.airlineLogo),
    airline: cleanText(flight.airlineName, airlineCode),
    airlineCode,
    flightNumber: `${airlineCode}${flightNumber}`,
    departure,
    arrival,
    aircraft: cleanText(flight.aircraft) || null,
    fareClass: cleanText(flight.classTypeName) || null,
    priceToman,
    childPriceToman: toman(flight.priceChild),
    infantPriceToman: toman(flight.priceInfant),
    seatsLeft: Math.max(0, Math.round(seatsLeft)),
    baggageKg: Number.isFinite(Number(flight.maxAllowedBaggage)) ? Number(flight.maxAllowedBaggage) : null,
    refundable: typeof flight.isRefundable === "boolean" ? flight.isRefundable : null,
    charter: flight.isCharter === true,
    terminal: typeof flight.terminal === "string" || typeof flight.terminal === "number" ? flight.terminal : null,
  };
}

export async function searchAlibabaFlights(input: FlightSearchInput) {
  const started = await alibabaRequest("v1/flights/domestic/available", {
    body: {
      origin: input.origin.toLowerCase(),
      destination: input.destination.toLowerCase(),
      departureDate: input.date,
      adult: input.adults,
      child: input.children,
      infant: input.infants,
      ...(input.returnDate ? { returnDate: input.returnDate } : {}),
    },
  });
  const requestId = (started as Record<string, unknown>)?.requestId;
  if (typeof requestId !== "string" && typeof requestId !== "number") {
    throw new Error("ALIBABA_MISSING_REQUEST_ID");
  }

  let result: Record<string, unknown> = {};
  for (let attempt = 0; attempt < 6; attempt += 1) {
    result = (await alibabaRequest(`v1/flights/domestic/available/${requestId}`)) as Record<string, unknown>;
    if (result.isCompleted === true) break;
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 1_500));
  }

  const normalizeRows = (rows: unknown) => (Array.isArray(rows) ? rows : [])
    .map(normalizeFlight)
    .filter((flight): flight is FlightOffer => flight !== null && flight.seatsLeft > 0)
    .sort((a, b) => a.priceToman - b.priceToman);
  const flights = normalizeRows(result.departing);
  const returning = input.returnDate ? normalizeRows(result.returning) : undefined;

  return {
    provider: "alibaba",
    requestId: String(requestId),
    origin: input.origin,
    destination: input.destination,
    date: input.date,
    fetchedAt: new Date().toISOString(),
    isCompleted: result.isCompleted === true,
    count: flights.length,
    flights,
    ...(returning ? { returningCount: returning.length, returning } : {}),
    bookingUrl: alibabaBookingUrl(input),
  };
}
