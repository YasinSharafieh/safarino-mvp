import { alibabaJalaliDate, alibabaRequest } from "./alibaba-flights";
import type { FlightSearchInput } from "./alibaba-flights";
import { resolveIranianCity } from "./iran-cities";
import { alibabaCdnUrl, alibabaTrainLogo } from "./alibaba-assets";
import { cleanFacts, flagOn, flagStated, pickFlag, pickText } from "./service-facts";

export type GroundOffer = {
  id: string;
  logoUrl: string | null;
  title: string;
  subtitle: string;
  departure: string;
  arrival: string | null;
  priceToman: number;
  seatsLeft: number;
  details: string[];
  /** The provider's own facility list, so a card can show chips, not one run-on line. */
  amenities?: string[];
  /** Station/terminal the service really leaves from and reaches. */
  originStation?: string;
  destinationStation?: string;
  /** The company alone, without the service number, for grouping and search. */
  companyName?: string;
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
    ...(input.returnDate ? { returning: alibabaJalaliDate(input.returnDate) } : {}),
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

/**
 * Everything علی‌بابا publishes about one train, in the traveller's language.
 *
 * The live payload carries far more than «company + number + price»: compartment
 * size and class, air conditioning, entertainment, free food, a wifi network
 * name, whether the seats are flat, the platform change option, the refund rule,
 * the province the service starts in, discounts. The old normaliser kept four of
 * those and dropped the rest, which is why a rich train list looked thin. Every
 * fact below is read from the provider's own response and nothing else — a
 * missing field means the chip is simply not shown.
 */
function trainFacts(train: Record<string, unknown>, company: string, wagon: string): string[] {
  const capacity = Number(train.compartmentCapacity ?? train.coupCapacity ?? train.cabinCapacity);
  const wagonClass = pickText(train, ["wagonClass", "wagonClassTitle", "classTitle", "classTypeName", "cabinClass"]);
  const seatType = pickText(train, ["seatTypeTitle", "seatTypeName", "cabinTypeTitle", "wagonTypeTitle"]);
  const province = pickText(train, ["originProvince", "provinceName", "province"]);
  const wifi = pickText(train, ["wifiName", "wifiSSID", "wifiSsid", "wifi"]);
  const maxDiscount = Number(train.maxDiscount ?? train.discountPercent ?? train.specialOfferPercent);
  const offers = Array.isArray(train.specialOfferTexts) ? train.specialOfferTexts.map((line) => String(line)).join(" ") : "";

  return cleanFacts([
    flagOn(train.isCompartment ?? train.isCoup) && Number.isFinite(capacity) && capacity > 0 ? `کوپهٔ ${capacity} نفره` : "",
    wagon,
    // A bare code such as "S" tells the traveller nothing — kept only when readable.
    wagonClass.length > 2 ? wagonClass : "",
    seatType,
    flagOn(train.hasAirCondition ?? train.hasAircondition ?? train.airCondition) ? "سرمایش و گرمایش" : "",
    flagOn(train.hasMedia ?? train.hasMediaEntertainment) ? "نمایشگر و سرگرمی" : "",
    flagOn(train.hasWifi ?? train.wifiAvailable) ? (wifi ? `وای‌فای «${wifi}»` : "وای‌فای") : "",
    flagOn(train.hasFreeFood) ? "غذای رایگان" : flagOn(train.hasFoodOffer ?? train.foodSell) ? "امکان خرید غذا" : "",
    flagOn(train.hasPowerOutlet ?? train.hasPower) ? "پریز برق" : "",
    flagOn(train.hasToilet ?? train.hasRestroom) ? "سرویس بهداشتی" : "",
    flagOn(train.isFlat ?? train.isFlatSeat ?? train.hasBed) ? "صندلی تخت‌شو" : "",
    flagOn(train.isCharter) ? "چارتری" : "",
    flagOn(train.changePlatform ?? train.canChangePlatform) ? "امکان تغییر سکو" : "",
    flagStated(train.nonRefundable) ? (flagOn(train.nonRefundable) ? "غیرقابل استرداد" : "قابل استرداد") : "",
    flagOn(train.isFullyRefundable ?? train.refundable) && !flagStated(train.nonRefundable) ? "قابل استرداد" : "",
    Number.isFinite(maxDiscount) && maxDiscount > 0 ? `${maxDiscount}٪ تخفیف` : "",
    // Provider-written discount copy is kept as-is only when it adds a number or
    // a name we did not already state above.
    offers && !/%/.test(offers) ? offers : "",
    province ? `مبدأ در استان ${province}` : "",
    company && wagon ? "" : "",
  ]);
}

export function normalizeTrains(rows: unknown): GroundOffer[] {
  return (Array.isArray(rows) ? rows : []).flatMap((value, index): GroundOffer[] => {
    if (!value || typeof value !== "object") return [];
    const train = value as Record<string, unknown>;
    const priceToman = toman(train.cost ?? train.price ?? train.priceAdult);
    const seatsLeft = Number(train.seat ?? train.remainingSeat ?? train.availableSeat);
    const departure = text(train.departureDateTime ?? train.departure);
    if (priceToman === null || priceToman <= 0 || !Number.isFinite(seatsLeft) || seatsLeft <= 0 || !departure) return [];
    const company = text(train.companyName ?? train.company) || "قطار";
    const trainNumber = text(train.trainNumber ?? train.number);
    const wagon = pickText(train, ["wagonName", "wagonType", "coupName", "cabinName"]);
    const originStation = pickText(train, ["originStationName", "orginStationName", "originStation", "orginStation", "departureStation"]);
    const destinationStation = pickText(train, ["destinationStationName", "destinationStation", "arrivalStation"]);
    return [{
      id: text(train.proposalId) || `${company}-${trainNumber}-${departure}-${index}`,
      logoUrl: alibabaTrainLogo(train.logoSuffix ?? train.companyLogo ?? train.logo),
      title: trainNumber ? `${company} · قطار ${trainNumber}` : company,
      subtitle: wagon || "گزارش‌دهنده علی‌بابا",
      departure,
      arrival: text(train.arrivalDateTime ?? train.arrival) || null,
      priceToman,
      seatsLeft: Math.round(seatsLeft),
      companyName: company,
      ...(originStation ? { originStation } : {}),
      ...(destinationStation ? { destinationStation } : {}),
      amenities: trainFacts(train, company, wagon),
      /** Kept for every existing consumer: the same facts as one ordered list. */
      details: cleanFacts([
        originStation ? `ایستگاه مبدأ: ${originStation}` : "",
        destinationStation ? `ایستگاه مقصد: ${destinationStation}` : "",
        ...trainFacts(train, company, wagon),
      ]),
    }];
  }).sort((a, b) => a.priceToman - b.priceToman);
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
    ...(input.returnDate ? { returnDate: input.returnDate } : {}),
  },
  });
  const requestId = (started as Record<string, unknown>)?.requestId;
  if (typeof requestId !== "string" && typeof requestId !== "number") {
    throw new Error("ALIBABA_MISSING_REQUEST_ID");
  }
  const result = await poll(`v2/train/available/${requestId}`);
  if (result.isCompleted !== true) throw new Error("ALIBABA_SEARCH_INCOMPLETE");
  const offers = normalizeTrains(result.departing);
  const returningOffers = input.returnDate ? normalizeTrains(result.returning) : undefined;

  return {
    provider: "alibaba",
    mode: "train",
    requestId: String(requestId),
    fetchedAt: new Date().toISOString(),
    isCompleted: result.isCompleted === true,
    count: offers.length,
    offers,
    ...(returningOffers ? { returningCount: returningOffers.length, returningOffers } : {}),
    bookingUrl: bookingUrl(input, "train"),
  };
}

async function busCityCode(code: string): Promise<string> {
  const city = resolveIranianCity(code);
  const terms = [code.toLowerCase(), city?.name].filter((value): value is string => Boolean(value));
  for (const term of Array.from(new Set(terms))) {
    const filter = encodeURIComponent(`q={ct:'${term}'}`);
    const result = await alibabaRequest(`v1/bus/stations?filter=${filter}`) as Record<string, unknown>;
    const items = Array.isArray(result.items) ? result.items : [];
    const station = items.find((value) => {
      if (!value || typeof value !== "object") return false;
      return Boolean(text((value as Record<string, unknown>).domainCode));
    }) as Record<string, unknown> | undefined;
    const domainCode = text(station?.domainCode);
    if (domainCode) return domainCode;
  }
  throw new Error("ALIBABA_BUS_CITY_NOT_FOUND");
}

async function searchBusOffers(input: FlightSearchInput): Promise<GroundOffer[]> {
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
    const priceToman = toman(bus.price ?? bus.priceToman ?? bus.cost);
    const seatsLeft = Number(bus.availableSeats ?? bus.seat ?? bus.remainingSeats);
    const departure = text(bus.departureDateTime ?? bus.departure);
    if (priceToman === null || priceToman <= 0 || !Number.isFinite(seatsLeft) || seatsLeft <= 0 || !departure) return [];
    const company = text(bus.companyName ?? bus.company) || "اتوبوس";
    const busType = text(bus.busType ?? bus.vehicleType ?? bus.busClassName) || "اتوبوس بین‌شهری";
    const originTerminal = pickText(bus, ["orginTerminal", "originTerminal", "orginTerminalName", "originTerminalName"]);
    const destinationTerminal = pickText(bus, ["destinationTerminal", "destinationTerminalName"]);
    const companyRate = Number(bus.companyRate ?? bus.rate ?? bus.score);
    const discount = Number(bus.discount ?? bus.discountPercent);
    /**
     * What the operator itself publishes about the coach: seat class, cooling,
     * wifi, a socket, the movie, blankets, whether the seats recline. The public
     * bus list used to be reduced to two terminal names, which made every row
     * look identical; these are the operator's own claims, nothing added.
     */
    const amenities = cleanFacts([
      busType,
      flagOn(bus.hasAirCondition ?? bus.hasAircondition ?? bus.airCondition) ? "سرمایش و گرمایش" : "",
      flagOn(bus.hasWifi ?? bus.wifiAvailable) ? "وای‌فای" : "",
      flagOn(bus.hasPowerOutlet ?? bus.hasPower ?? bus.hasCharger) ? "شارژ موبایل" : "",
      flagOn(bus.hasMedia ?? bus.hasVideo ?? bus.hasMovie) ? "نمایش فیلم" : "",
      flagOn(bus.hasFood ?? bus.hasSnack) ? "پذیرایی" : "",
      flagOn(bus.hasBlanket) ? "پتو" : "",
      flagOn(bus.isRecliner ?? bus.recliningSeats) ? "صندلی تخت‌شو" : "",
      flagOn(bus.isVip) ? "VIP" : "",
      Number.isFinite(discount) && discount > 0 ? `${discount}٪ تخفیف` : "",
      Number.isFinite(companyRate) && companyRate > 0 ? `امتیاز شرکت ${companyRate}` : "",
    ]);
    return [{
      // The provider id is an unreadable token; a short stable key is enough —
      // the purchase link is the dated route page, not this id.
      id: `alibaba-bus-${originCode}-${destinationCode}-${departure}-${index}`,
      logoUrl: alibabaCdnUrl(bus.logoPath ?? bus.logo ?? bus.companyLogo),
      title: company,
      subtitle: busType,
      departure,
      arrival: text(bus.arrivalDateTime ?? bus.arrival) || null,
      priceToman,
      seatsLeft: Math.round(seatsLeft),
      companyName: company,
      ...(originTerminal ? { originStation: originTerminal } : {}),
      ...(destinationTerminal ? { destinationStation: destinationTerminal } : {}),
      amenities,
      details: cleanFacts([
        originTerminal ? `مبدأ: ${originTerminal}` : "",
        destinationTerminal ? `مقصد: ${destinationTerminal}` : "",
        ...amenities,
      ]),
    }];
  });

  return offers.sort((a, b) => a.priceToman - b.priceToman);
}

export async function searchAlibabaBuses(input: FlightSearchInput) {
  const offers = await searchBusOffers(input);
  const returningOffers = input.returnDate
    ? await searchBusOffers({
        ...input,
        origin: input.destination,
        destination: input.origin,
        date: input.returnDate,
        returnDate: undefined,
      })
    : undefined;
  return {
    provider: "alibaba",
    mode: "bus",
    fetchedAt: new Date().toISOString(),
    isCompleted: true,
    count: offers.length,
    offers,
    ...(returningOffers ? { returningCount: returningOffers.length, returningOffers } : {}),
    bookingUrl: bookingUrl(input, "bus"),
  };
}
