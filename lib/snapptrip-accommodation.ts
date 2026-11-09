import type { AccommodationOffer, AccommodationSearchInput, ProviderSearchResult } from "./accommodation-types";
import { accommodationNights } from "./accommodation-types";
import { publicProviderJson } from "./public-provider-http";
import { finiteNumber, itemLabel, normalizeTerm, positiveNumber, record, rows, safeImageUrl, text, toman } from "./accommodation-provider-utils";

const API = "https://hapi.snapptrip.com/hotel/api/v2";
const WEB = "https://www.snapptrip.com";
const STORE = "https://store.snapptrip.com";
const HEADERS = { Referer: `${WEB}/`, Origin: WEB, channel: "web" };

function collection(payload: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(payload)) return rows(payload);
  const body = record(payload);
  for (const key of keys) if (Array.isArray(body[key])) return rows(body[key]);
  for (const wrapper of ["data", "result", "results"]) {
    const nested = body[wrapper];
    if (Array.isArray(nested)) return rows(nested);
    const nestedRecord = record(nested);
    for (const key of keys) if (Array.isArray(nestedRecord[key])) return rows(nestedRecord[key]);
  }
  return [];
}

function snapptripImage(hotel: Record<string, unknown>): string | null {
  const thumbnail = record(hotel.thumbnail);
  const raw = text(thumbnail.url) || text(hotel.image_url) || text(hotel.image);
  if (!raw) return null;
  const absolute = raw.startsWith("/") ? STORE + raw : raw;
  try {
    const host = new URL(absolute).hostname;
    if (host !== "store.snapptrip.com" && host !== "cdnsnapptrip.com") return null;
    return safeImageUrl(absolute, [host], host === "cdnsnapptrip.com" ? "/images/market/domestic-hotel/" : "/domestic-hotel/");
  } catch {
    return null;
  }
}

function snapptripBookingUrl(hotel: Record<string, unknown>, fallbackCity: string): string | null {
  const detail = record(hotel.hotelDetail);
  const page = record(detail.hotelPageUrl);
  const query = record(page.query);
  const city = text(query.cityTitle) || fallbackCity;
  const slug = text(query.hotelTitle) || text(hotel.slug);
  if (!slug || !city || slug.length > 300 || city.length > 80 || /[/?#]/.test(slug) || /[/?#]/.test(city)) return null;
  return `${WEB}/${encodeURIComponent("رزرو-هتل")}/${encodeURIComponent(city)}/${encodeURIComponent(slug)}`;
}

function rawStayTotal(hotel: Record<string, unknown>): number | null {
  const price = record(hotel.price);
  const prices = record(hotel.prices);
  const candidates = [
    hotel.price_total,
    hotel.total_price,
    hotel.min_price,
    hotel.minPrice,
    price.local_price,
    price.total,
    price.total_price,
    prices.local_price,
    prices.total,
    prices.total_price,
  ];
  for (const candidate of candidates) {
    const value = positiveNumber(candidate);
    if (value !== null) return value;
  }
  return null;
}

export function normalizeSnapptripRows(value: unknown, input: AccommodationSearchInput): AccommodationOffer[] {
  const nightCount = accommodationNights(input);
  return rows(value).flatMap((hotel): AccommodationOffer[] => {
    if (hotel.is_available === false || text(hotel.is_available).toLowerCase() === "false") return [];
    const id = text(hotel.id) || text(hotel.hotel_id) || text(record(hotel.hotelDetail).hotelId);
    const detail = record(hotel.hotelDetail);
    const name = text(hotel.title) || text(hotel.name) || text(detail.hotelTitle);
    const totalRial = rawStayTotal(hotel);
    const total = toman(totalRial);
    const bookingUrl = snapptripBookingUrl(hotel, input.city);
    if (!/^\d+$/.test(id) || !name || !total || !bookingUrl) return [];
    const reviews = record(hotel.reviews);
    const location = record(hotel.location);
    const locationArray = Array.isArray(hotel.location) ? hotel.location : [];
    const latitude = finiteNumber(location.lat) ?? finiteNumber(locationArray[0]);
    const longitude = finiteNumber(location.lng) ?? finiteNumber(locationArray[1]);
    const stars = finiteNumber(hotel.stars) ?? finiteNumber(detail.stars);
    const amenities = Array.isArray(hotel.amenities) ? hotel.amenities.map(itemLabel).filter(Boolean).slice(0, 4) : [];
    const roomTitle = text(hotel.room_title) || text(hotel.roomTitle) || text(record(hotel.room).title);
    return [{
      id: `snapptrip-${id}`,
      providerPropertyId: id,
      kind: "hotel",
      name,
      typeLabel: stars ? `هتل ${stars} ستاره` : "هتل",
      location: text(hotel.address) || text(detail.address) || input.city,
      imageUrl: snapptripImage(hotel),
      rating: finiteNumber(reviews.ptp_ratings) ?? finiteNumber(hotel.user_score) ?? finiteNumber(hotel.rating),
      reviewCount: Math.max(0, Math.round(finiteNumber(reviews.count) ?? finiteNumber(hotel.review_count) ?? 0)),
      stars,
      priceTotalToman: total,
      pricePerNightToman: Math.round(total / nightCount),
      priceBeforeDiscountToman: null,
      discountPercent: Math.max(0, finiteNumber(hotel.discount_percent) || 0),
      priceIncludesVat: null,
      priceNote: "مبلغ کل اعلام‌شده اسنپ‌تریپ برای تاریخ جستجو؛ اتاق، ظرفیت و مالیات نهایی را در صفحه رزرو کنترل کنید.",
      bookingNote: "لینک دقیق همان هتل است؛ تاریخ و مسافران را در فرم رزرو اسنپ‌تریپ دوباره تأیید کنید.",
      details: [roomTitle, "قیمت برای تاریخ جستجو"].filter(Boolean),
      amenities,
      provider: "snapptrip",
      bookingUrl,
      latitude,
      longitude,
    }];
  });
}

export async function searchSnapptripAccommodation(input: AccommodationSearchInput): Promise<ProviderSearchResult> {
  const locationsPayload = await publicProviderJson(`${API}/search-text`, {
    query: { text: input.city, token: "Jek", provider: "flightio" },
    headers: HEADERS,
  });
  const locations = collection(locationsPayload, ["cities", "items", "locations"]);
  const exact = locations.find((item) => normalizeTerm(text(item.title) || text(item.name)) === normalizeTerm(input.city));
  const city = exact || locations.find((item) => finiteNumber(item.id) !== null || finiteNumber(item.city_id) !== null) || locations[0];
  const cityId = finiteNumber(city?.id) ?? finiteNumber(city?.city_id);
  if (!cityId || cityId <= 0) throw new Error("SNAPPTRIP_CITY_NOT_FOUND");
  const payload = await publicProviderJson(`${API}/search-city`, {
    query: {
      city_id: cityId,
      date_from: input.checkIn,
      date_to: input.checkOut,
      page: 1,
      order_by: "best_selling",
      token: "Jek",
      no_rooms: 1,
    },
    headers: HEADERS,
    timeoutMs: 20_000,
  });
  const hotels = collection(payload, ["hotels", "items", "hotelsData"]);
  const body = record(payload);
  const found = finiteNumber(body.total) ?? finiteNumber(record(body.data).total) ?? hotels.length;
  return {
    offers: normalizeSnapptripRows(hotels, input),
    found: Math.max(0, Math.round(found)),
    resolvedCity: text(city?.title) || text(city?.name) || input.city,
  };
}
