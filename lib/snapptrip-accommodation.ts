import type { AccommodationOffer, AccommodationSearchInput, ProviderSearchResult } from "./accommodation-types";
import { accommodationNights } from "./accommodation-types";
import { publicProviderJson } from "./public-provider-http";
import { finiteNumber, normalizeTerm, positiveNumber, record, rows, safeImageUrl, text } from "./accommodation-provider-utils";

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
  const media = text(record(hotel.cover_media).media) || text(record(rows(hotel.galleries)[0]).media);
  if (!media) return null;
  const path = media.startsWith("/") ? media : `/${media}`;
  return safeImageUrl(STORE + path, ["store.snapptrip.com"], "/domestic-hotel/");
}

/** Verified on the live public response: `fa_url` is the hotel slug and `city_url` the city slug. */
function snapptripBookingUrl(hotel: Record<string, unknown>, fallbackCity: string): string | null {
  const city = text(hotel.city_url) || text(hotel.city_title) || fallbackCity;
  const slug = text(hotel.fa_url) || text(hotel.url);
  if (!slug || !city || slug.length > 300 || city.length > 80 || /[/?#]/.test(slug) || /[/?#]/.test(city)) return null;
  return `${WEB}/${encodeURIComponent("رزرو-هتل")}/${encodeURIComponent(city)}/${encodeURIComponent(slug)}`;
}

export function normalizeSnapptripRows(value: unknown, input: AccommodationSearchInput): AccommodationOffer[] {
  const nightCount = accommodationNights(input);
  return rows(value).flatMap((hotel): AccommodationOffer[] => {
    if (hotel.is_available === false) return [];
    const id = text(hotel.id);
    const name = text(hotel.title);
    // Cross-checked against Eghamat24 for the same hotel and dates: Snapptrip's public `price` is in Toman.
    const total = positiveNumber(hotel.price) ?? positiveNumber(hotel.price_off);
    const bookingUrl = snapptripBookingUrl(hotel, input.city);
    if (!/^\d+$/.test(id) || !name || !total || !bookingUrl) return [];
    const reviews = record(hotel.reviews);
    const coordinates = Array.isArray(hotel.location) ? hotel.location : [];
    const stars = finiteNumber(hotel.stars);
    const before = positiveNumber(hotel.price_off);
    const facilities = rows(hotel.facilities).map((item) => text(item.title)).filter(Boolean).slice(0, 4);
    const badges = rows(hotel.badges).map((item) => text(item.title)).filter(Boolean).slice(0, 2);
    const roomTitle = text(hotel.min_price_room_title);
    return [{
      id: `snapptrip-${id}`,
      providerPropertyId: id,
      kind: "hotel",
      name,
      typeLabel: text(hotel.accommodation_type) || (stars ? `هتل ${stars} ستاره` : "هتل"),
      location: text(hotel.address) || input.city,
      imageUrl: snapptripImage(hotel),
      rating: finiteNumber(reviews.ptp_ratings) ?? finiteNumber(hotel.user_score),
      reviewCount: Math.max(0, Math.round(finiteNumber(reviews.ptp_reviews) ?? finiteNumber(hotel.review_count) ?? 0)),
      stars,
      priceTotalToman: Math.round(total),
      pricePerNightToman: Math.round(total / nightCount),
      priceBeforeDiscountToman: before && before > total ? Math.round(before) : null,
      discountPercent: Math.max(0, finiteNumber(hotel.discount_percent) || 0),
      priceIncludesVat: null,
      priceNote: "مبلغ کل اعلام‌شده اسنپ‌تریپ برای تاریخ جستجو؛ مالیات و اتاق نهایی را در صفحه رزرو کنترل کنید.",
      bookingNote: "لینک دقیق همان هتل است؛ تاریخ و مسافران را در فرم رزرو اسنپ‌تریپ دوباره تأیید کنید.",
      details: [roomTitle ? `ارزان‌ترین اتاق: ${roomTitle}` : "", hotel.instant_book === true ? "رزرو آنی" : "", ...badges].filter(Boolean),
      amenities: facilities,
      provider: "snapptrip",
      bookingUrl,
      latitude: finiteNumber(coordinates[0]),
      longitude: finiteNumber(coordinates[1]),
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
  const city = exact || locations.find((item) => finiteNumber(item.id) !== null) || locations[0];
  const cityId = finiteNumber(city?.id);
  if (!cityId || cityId <= 0) throw new Error("SNAPPTRIP_CITY_NOT_FOUND");

  const pages = [1, 2, 3];
  const results = await Promise.all(pages.map(async (page) => {
    try {
      const payload = await publicProviderJson(`${API}/search-city`, {
        query: { city_id: cityId, date_from: input.checkIn, date_to: input.checkOut, page, order_by: "best_selling", token: "Jek", no_rooms: 1 },
        headers: HEADERS,
        timeoutMs: 20_000,
      });
      return { payload, page };
    } catch {
      return { payload: null, page };
    }
  }));
  const first = results.find((result) => result.page === 1 && result.payload);
  if (!first?.payload) throw new Error("SNAPPTRIP_SEARCH_FAILED");
  const hotels = results.flatMap((result) => (result.payload ? collection(result.payload, ["hotels", "items", "hotelsData"]) : []));
  const found = finiteNumber(record(first.payload).total) ?? hotels.length;
  return {
    offers: normalizeSnapptripRows(hotels, input),
    found: Math.max(hotels.length, Math.round(found)),
    resolvedCity: text(city?.fa_title) || text(city?.title) || input.city,
  };
}
