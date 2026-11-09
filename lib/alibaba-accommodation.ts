import { alibabaRequest } from "./alibaba-flights";
import type { AccommodationOffer, AccommodationSearchInput } from "./accommodation-types";
import { STAY_TYPE_LABELS } from "./accommodation-types";

export type { AccommodationKind, AccommodationOffer, AccommodationSearchInput } from "./accommodation-types";

const SITE_ROOT = "https://www.alibaba.ir";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toman(rial: unknown): number | null {
  const value = finiteNumber(rial);
  return value !== null && value > 0 ? Math.round(value / 10) : null;
}

function localized(value: unknown): string {
  const item = record(value);
  return text(item.fa) || text(item.en) || text(value);
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/‌/g, " ").replace(/\s+/g, " ");
}

function nights(input: AccommodationSearchInput): number {
  return Math.round((Date.parse(`${input.checkOut}T00:00:00Z`) - Date.parse(`${input.checkIn}T00:00:00Z`)) / 86_400_000);
}

function mealPlan(value: unknown): string {
  const plans: Record<string, string> = {
    BB: "همراه با صبحانه",
    HB: "همراه با صبحانه و شام",
    FB: "همراه با سه وعده غذا",
    AI: "سرویس همه‌چیز",
    RO: "بدون صبحانه",
  };
  return plans[text(value).toUpperCase()] || "";
}

function hotelBookingUrl(
  link: string,
  hotelId: string,
  cityId: string,
  countryCode: string,
  sessionId: string,
  input: AccommodationSearchInput,
): string {
  const ages = [...Array.from({ length: input.adults }, () => 30), ...input.childAges, ...input.infantAges];
  const query = new URLSearchParams({
    destinationHotel: hotelId,
    cityId,
    departing: input.checkIn,
    returning: input.checkOut,
    rooms: ages.join(","),
    destination: `Hotel_${hotelId}`,
    destinationCity: cityId,
    region: "dom",
    countryCode,
    ...(sessionId ? { sessionId } : {}),
  });
  return `${SITE_ROOT}/hotel/${link}?${query.toString()}`;
}

export function normalizeHotelRows(
  value: unknown,
  context: { input: AccommodationSearchInput; cityId: string; countryCode: string; sessionId: string },
): AccommodationOffer[] {
  const nightCount = nights(context.input);
  return rows(value).flatMap((hotel, index): AccommodationOffer[] => {
    const id = text(hotel.newHotelId) || text(hotel.hotelId) || text(hotel.id);
    const link = text(hotel.link);
    const name = localized(hotel.title) || localized(hotel.name);
    const priceTotalToman = toman(hotel.minPrice);
    if (!id || !name || !/^[\w/-]+$/.test(link) || !priceTotalToman) return [];
    const score = record(hotel.score);
    const roomNames = rows(hotel.roomNames).map((room) => localized(room) || text(room.fa)).filter(Boolean).slice(0, 2);
    const badges = rows(hotel.badges).map((badge) => text(badge.text)).filter(Boolean).slice(0, 2);
    const stars = finiteNumber(hotel.star);
    const oldPrice = toman(hotel.oldPrice);
    const coordinates = Array.isArray(record(hotel.location).coordinates) ? record(hotel.location).coordinates as unknown[] : [];
    return [{
      id: `alibaba-hotel-${id || index}`,
      providerPropertyId: id || `hotel-${index}`,
      kind: "hotel",
      name,
      typeLabel: stars ? `هتل ${stars} ستاره` : "هتل",
      location: localized(hotel.address) || localized(record(hotel.city).name) || context.input.city,
      imageUrl: text(hotel.image) || null,
      rating: finiteNumber(score.score),
      reviewCount: Math.max(0, Math.round(finiteNumber(score.count) || 0)),
      stars,
      priceTotalToman,
      pricePerNightToman: toman(hotel.pricePerNight) || Math.round(priceTotalToman / nightCount),
      priceBeforeDiscountToman: oldPrice && oldPrice !== priceTotalToman ? oldPrice : null,
      discountPercent: Math.max(0, finiteNumber(hotel.discountPercent) || 0),
      priceIncludesVat: true,
      priceNote: "قیمت اتاق علی‌بابا برای کل اقامت و ترکیب سنی مسافران این جستجو.",
      bookingNote: "همان هتل با تاریخ و سن مسافران این جستجو باز می‌شود.",
      details: [mealPlan(hotel.mealPlan), ...roomNames, ...badges].filter(Boolean),
      amenities: (Array.isArray(hotel.facilitiesName) ? hotel.facilitiesName : []).map(text).filter(Boolean).slice(0, 5),
      provider: "alibaba",
      bookingUrl: hotelBookingUrl(link, id, context.cityId, context.countryCode, context.sessionId, context.input),
      latitude: finiteNumber(coordinates[1]),
      longitude: finiteNumber(coordinates[0]),
    }];
  });
}

async function hotelCity(city: string) {
  const payload = await alibabaRequest(`v3/hotel/suggest?query=${encodeURIComponent(city)}`);
  const cities = rows(record(payload).results).filter((item) => text(item.type) === "city" && text(item.countryCode) === "IR");
  const exact = cities.find((item) => normalizeTerm(text(item.displayName)) === normalizeTerm(city));
  const selected = exact || cities[0];
  const cityId = text(selected?.cityId);
  const countryCode = text(selected?.countryCode);
  if (!cityId || !countryCode) throw new Error("ALIBABA_ACCOMMODATION_CITY_NOT_FOUND");
  return { cityId, countryCode, name: text(selected.displayName) || city };
}

async function searchHotels(input: AccommodationSearchInput) {
  const city = await hotelCity(input.city);
  const place = { cityId: city.cityId, countryCode: city.countryCode };
  const started = record(await alibabaRequest(`v1/hotel/search?${new URLSearchParams(place).toString()}`, {
    body: {
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      destination: { type: "City", id: city.cityId },
      rooms: [{ adults: Array.from({ length: input.adults }, () => 30), children: [...input.childAges, ...input.infantAges] }],
    },
  }));
  const sessionId = text(started.sessionId);
  if (!sessionId) throw new Error("ALIBABA_MISSING_HOTEL_SESSION");
  const body = {
    sessionId,
    filter: [{ field: "onlyAvailable", value: [] }],
    removeOutlier: false,
    sort: { order: 1, field: "minPrice" },
    skip: 0,
    limit: 60,
  };
  let result: Record<string, unknown> = {};
  for (let attempt = 0; attempt < 10; attempt += 1) {
    result = record(await alibabaRequest(`v1/hotel/result?${new URLSearchParams(place).toString()}`, { body }));
    if ((finiteNumber(result.progress) ?? 100) >= 100) break;
    if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  if ((finiteNumber(result.progress) ?? 0) < 100) throw new Error("ALIBABA_HOTEL_SEARCH_INCOMPLETE");
  const context = { input, cityId: city.cityId, countryCode: city.countryCode, sessionId };
  return {
    offers: normalizeHotelRows(result.result, context),
    found: Math.max(0, Math.round(finiteNumber(record(result.info).totalResultNo) || 0)),
    resolvedCity: city.name,
  };
}

export function normalizeStayRows(value: unknown, input: AccommodationSearchInput): AccommodationOffer[] {
  const nightCount = nights(input);
  return rows(value).flatMap((stay): AccommodationOffer[] => {
    const id = text(stay.id);
    const code = text(stay.code);
    const type = text(stay.type);
    const name = text(stay.name);
    const price = record(stay.price);
    const priceTotalToman = toman(price.totalPrice);
    if (!id || !code || !/^[a-z0-9_-]+$/.test(type) || !name || !priceTotalToman) return [];
    const location = record(stay.location);
    const capacity = record(stay.capacity);
    const metrics = record(stay.accommodationMetrics);
    const rate = record(stay.rateReview);
    const baseGuests = finiteNumber(capacity.base);
    const extraGuests = finiteNumber(capacity.extra) || 0;
    const bedrooms = finiteNumber(metrics.bedroomsCount);
    const geo = record(location.geo);
    return [{
      id: `alibaba-stay-${code}`,
      providerPropertyId: code,
      kind: "stay",
      name,
      typeLabel: STAY_TYPE_LABELS[type] || "اقامتگاه",
      location: [text(location.province), text(location.city)].filter(Boolean).join("، ") || input.city,
      imageUrl: text(stay.image) || null,
      rating: finiteNumber(rate.score),
      reviewCount: Math.max(0, Math.round(finiteNumber(rate.count) || 0)),
      stars: null,
      priceTotalToman,
      pricePerNightToman: Math.round(priceTotalToman / nightCount),
      priceBeforeDiscountToman: null,
      discountPercent: Math.max(0, finiteNumber(price.discountPercent) || 0),
      priceIncludesVat: true,
      priceNote: "مبلغ کل اقامت در علی‌بابا، شامل مالیات بر ارزش افزوده در پاسخ جستجو.",
      bookingNote: "صفحهٔ همان آگهی باز می‌شود؛ تاریخ و مسافران را پیش از پرداخت دوباره کنترل کنید.",
      details: [
        baseGuests ? `ظرفیت ${baseGuests} نفر پایه${extraGuests ? ` + ${extraGuests} نفر اضافه` : ""}` : "",
        bedrooms !== null ? `${bedrooms} اتاق خواب` : "",
        stay.reservationType === "instant" || stay.isInstant === true ? "رزرو آنی" : "با تأیید میزبان",
      ].filter(Boolean),
      amenities: [],
      provider: "alibaba",
      bookingUrl: `${SITE_ROOT}/accommodation/pdp/${type}-${code}`,
      latitude: finiteNumber(geo.latitude) ?? finiteNumber(geo.lat),
      longitude: finiteNumber(geo.longitude) ?? finiteNumber(geo.long) ?? finiteNumber(geo.lng),
    }];
  });
}

function tehranMidnight(date: string) {
  return { seconds: Math.floor(Date.parse(`${date}T00:00:00+03:30`) / 1000), nanos: 0 };
}

async function stayPlace(city: string) {
  const payload = record(await alibabaRequest(`v2/accommodation/Available/Suggestions?Keyword=${encodeURIComponent(city)}`));
  const places = rows(payload.suggestions).filter((item) => text(item.resultType) === "plp" && text(item.url));
  const cityPlaces = places.filter((item) => text(item.url).startsWith("city-"));
  const exact = cityPlaces.find((item) => normalizeTerm(text(item.title).split("-")[0]) === normalizeTerm(city));
  const selected = exact || cityPlaces[0] || places[0];
  const slug = text(selected?.url);
  if (!slug) throw new Error("ALIBABA_ACCOMMODATION_CITY_NOT_FOUND");
  return { slug, name: text(selected.title) || city };
}

async function searchStays(input: AccommodationSearchInput) {
  const place = await stayPlace(input.city);
  const guests = input.adults + input.childAges.length + input.infantAges.length;
  const payload = record(await alibabaRequest("v2/accommodation/Available/Search", {
    body: {
      pageSize: 60,
      pageNumber: 1,
      location: place.slug,
      date: { startTime: tehranMidnight(input.checkIn), endTime: tehranMidnight(input.checkOut) },
      filters: {
        isInstant: false,
        capacity: guests,
        platform: "desktop",
        amenities: [],
        accommodationTypes: [],
        scores: [],
        guarantees: false,
      },
    },
  }));
  return {
    offers: normalizeStayRows(payload.items, input),
    found: Math.max(0, Math.round(finiteNumber(payload.total) || 0)),
    resolvedCity: place.name,
  };
}

export async function searchAlibabaAccommodation(input: AccommodationSearchInput) {
  const result = input.kind === "hotel" ? await searchHotels(input) : await searchStays(input);
  return {
    provider: "alibaba",
    kind: input.kind,
    city: result.resolvedCity,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights: nights(input),
    adults: input.adults,
    childAges: input.childAges,
    infantAges: input.infantAges,
    fetchedAt: new Date().toISOString(),
    found: result.found,
    count: result.offers.length,
    offers: result.offers,
  };
}
