import { alibabaJalaliDate, alibabaRequest } from "./alibaba-flights";
import type { FlightSearchInput } from "./alibaba-flights";
import { resolveIranianCity } from "./iran-cities";

export type GroundOffer = {
  id: string;
  title: string;
  subtitle: string;
  departure: string;
  arrival: string | null;
  priceToman: number;
  seatsLeft: number;
  details: string[];
};

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function toman(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed / 10) : null;
}

function groundCode(code: string): string {
  const city = resolveIranianCity(code);
  return city?.groundCode || city?.code || code;
}

function groundInput(input: FlightSearchInput): FlightSearchInput {
  return { ...input, origin: groundCode(input.origin), destination: groundCode(input.destination) };
}

function bookingUrl(input: FlightSearchInput, product: "train" | "bus"): string {
  const query = new URLSearchParams({
    adult: String(input.adults),
    child: String(input.children),
    infant: String(input.infants),
    departing: alibabaJalaliDate(input.date),
    ticketType: "Family",
    isExclusive: "false",
  });
  const route = groundInput(input);
  return `https://www.alibaba.ir/${product}/${route.origin}-${route.destination}?${query.toString()}`;
}

async function poll(path: string): Promise<Record<string, unknown>> {
  let result: Record<string, unknown> = {};
  for (let attempt = 0; attempt < 6; attempt += 1) {
    result = (await alibabaRequest(path)) as Record<string, unknown>;
    if (result.isCompleted === true) break;
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return result;
}

export async function searchAlibabaTrains(input: FlightSearchInput) {
  const route = groundInput(input);
  const started = await alibabaRequest("v2/train/available", {
    body: {
      departureDate: input.date,
      origin: route.origin,
      destination: route.destination,
      passengerCount: input.adults + input.children,
      isExclusiveCompartment: false,
      ticketType: "Family",
    },
  });
  const requestId = (started as Record<string, unknown>)?.requestId;
  if (typeof requestId !== "string" && typeof requestId !== "number") {
    throw new Error("ALIBABA_MISSING_REQUEST_ID");
  }
  const result = await poll(`v2/train/available/${requestId}`);
  if (result.isCompleted !== true) throw new Error("ALIBABA_SEARCH_INCOMPLETE");
  const rows = Array.isArray(result.departing) ? result.departing : [];
  const offers = rows.flatMap((value, index): GroundOffer[] => {
    if (!value || typeof value !== "object") return [];
    const train = value as Record<string, unknown>;
    const priceToman = toman(train.cost);
    const seatsLeft = Number(train.seat);
    const departure = text(train.departureDateTime);
    if (priceToman === null || !Number.isFinite(seatsLeft) || seatsLeft <= 0 || !departure) return [];
    const company = text(train.companyName) || "قطار";
    const trainNumber = text(train.trainNumber);
    return [{
      id: text(train.proposalId) || `${company}-${trainNumber}-${departure}-${index}`,
      title: trainNumber ? `${company} · قطار ${trainNumber}` : company,
      subtitle: text(train.wagonName) || "گزارش‌دهنده علی‌بابا",
      departure,
      arrival: text(train.arrivalDateTime) || null,
      priceToman,
      seatsLeft: Math.round(seatsLeft),
      details: [
        train.compartmentCapacity ? `${Number(train.compartmentCapacity)} نفره` : "",
        train.nonRefundable === true ? "غیرقابل استرداد" : "قابل استرداد",
      ].filter(Boolean),
    }];
  });

  return {
    provider: "alibaba",
    mode: "train",
    requestId: String(requestId),
    fetchedAt: new Date().toISOString(),
    isCompleted: result.isCompleted === true,
    count: offers.length,
    offers: offers.sort((a, b) => a.priceToman - b.priceToman),
    bookingUrl: bookingUrl(input, "train"),
  };
}

async function busCityCode(code: string): Promise<string> {
  const filter = encodeURIComponent(`q={ct:'${code.toLowerCase()}'}`);
  const result = await alibabaRequest(`v1/bus/stations?filter=${filter}`) as Record<string, unknown>;
  const items = Array.isArray(result.items) ? result.items : [];
  const first = items[0] as Record<string, unknown> | undefined;
  const domainCode = first?.domainCode;
  if (typeof domainCode !== "string" || !domainCode) throw new Error("ALIBABA_BUS_CITY_NOT_FOUND");
  return domainCode;
}

export async function searchAlibabaBuses(input: FlightSearchInput) {
  const route = groundInput(input);
  const [originCode, destinationCode] = await Promise.all([
    busCityCode(route.origin),
    busCityCode(route.destination),
  ]);
  const query = new URLSearchParams({
    orginCityCode: originCode,
    destinationCityCode: destinationCode,
    requestDate: input.date,
    passengerCount: String(Math.max(1, input.adults + input.children)),
    serviceType: "Bus",
  });
  const result = await alibabaRequest(`v2/bus/available?${query.toString()}`) as Record<string, unknown>;
  const rows = Array.isArray(result.availableList) ? result.availableList : [];
  const offers = rows.flatMap((value, index): GroundOffer[] => {
    if (!value || typeof value !== "object") return [];
    const bus = value as Record<string, unknown>;
    const priceToman = toman(bus.price);
    const seatsLeft = Number(bus.availableSeats);
    const departure = text(bus.departureDateTime);
    if (priceToman === null || !Number.isFinite(seatsLeft) || seatsLeft <= 0 || !departure) return [];
    return [{
      id: text(bus.proposalId) || `${originCode}-${departure}-${index}`,
      title: text(bus.companyName) || "اتوبوس",
      subtitle: text(bus.busType) || "اتوبوس بین‌شهری",
      departure,
      arrival: null,
      priceToman,
      seatsLeft: Math.round(seatsLeft),
      details: [text(bus.orginTerminal), text(bus.destinationTerminal)].filter(Boolean),
    }];
  });

  return {
    provider: "alibaba",
    mode: "bus",
    fetchedAt: new Date().toISOString(),
    isCompleted: true,
    count: offers.length,
    offers: offers.sort((a, b) => a.priceToman - b.priceToman),
    bookingUrl: bookingUrl(input, "bus"),
  };
}
