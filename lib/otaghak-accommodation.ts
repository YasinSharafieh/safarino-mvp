import type { AccommodationOffer, AccommodationSearchInput, ProviderSearchResult } from "./accommodation-types";
import { accommodationGuests, accommodationNights } from "./accommodation-types";
import { publicProviderJson } from "./public-provider-http";
import { finiteNumber, normalizeTerm, positiveNumber, record, rows, safeImageUrl, text } from "./accommodation-provider-utils";

const API = "https://core.otaghak.com";
const WEB = "https://www.otaghak.com";
const IMAGES = "https://cdn.otaghak.com/otg-images-new/X500/";

export function normalizeOtaghakRows(value: unknown, input: AccommodationSearchInput): AccommodationOffer[] {
  const nightCount = accommodationNights(input);
  return rows(value).flatMap((room): AccommodationOffer[] => {
    const id = text(room.roomId) || text(room.id);
    const name = text(room.roomName);
    const total = positiveNumber(room.totalPriceWithExtraPerson) ?? positiveNumber(room.totalPrice);
    if (!/^\d+$/.test(id) || !name || !total) return [];
    const imageName = text(record(room.roomMediaTitles).mainImageTitle).replace(/^\/+/, "");
    const base = finiteNumber(room.basePersonCount) ?? finiteNumber(room.personCapacity);
    const maximum = finiteNumber(room.personCapacity);
    const bedrooms = finiteNumber(room.bedRoom);
    const query = new URLSearchParams({ checkIn: input.checkIn, checkOut: input.checkOut });
    return [{
      id: `otaghak-${id}`,
      providerPropertyId: id,
      kind: "stay",
      name,
      typeLabel: text(room.roomTypeName) || "اقامتگاه",
      location: [text(room.stateFaName), text(room.cityFaName)].filter(Boolean).join("، ") || input.city,
      imageUrl: imageName ? safeImageUrl(IMAGES + imageName, ["cdn.otaghak.com"], "/otg-images-new/X500/") : null,
      rating: positiveNumber(room.rate),
      reviewCount: Math.max(0, Math.round(finiteNumber(room.commentsCount) || 0)),
      stars: null,
      priceTotalToman: Math.round(total),
      pricePerNightToman: Math.round(total / nightCount),
      priceBeforeDiscountToman: null,
      discountPercent: Math.max(0, finiteNumber(room.totalDiscountValue) || 0),
      priceIncludesVat: null,
      priceNote: "مبلغ کل اعلام‌شده اتاقک، با احتساب نفرات اضافه در پاسخ جستجو؛ مبنای مالیات در پاسخ عمومی مشخص نیست.",
      bookingNote: "لینک همان آگهی با تاریخ ورود و خروج باز می‌شود؛ ظرفیت و مبلغ نهایی را دوباره کنترل کنید.",
      details: [
        base !== null ? `ظرفیت ${base} نفر پایه${maximum && maximum > base ? `، حداکثر ${maximum} نفر` : ""}` : "",
        bedrooms !== null ? `${bedrooms} اتاق خواب` : "",
        room.isInstantBook === true ? "رزرو آنی" : "با تأیید میزبان",
      ].filter(Boolean),
      amenities: [],
      provider: "otaghak",
      bookingUrl: `${WEB}/room/${id}/?${query.toString()}`,
      latitude: finiteNumber(room.latitude),
      longitude: finiteNumber(room.longitude),
    }];
  });
}

export async function searchOtaghakAccommodation(input: AccommodationSearchInput): Promise<ProviderSearchResult> {
  const locationPayload = await publicProviderJson(`${API}/api/v1/Search/GetSearchResult`, { query: { input: input.city } });
  const locations = rows(locationPayload).filter((item) => text(item.typeCode) === "city" && text(item.cityCode));
  const exact = locations.find((item) => normalizeTerm(text(item.name)) === normalizeTerm(input.city));
  const location = exact || locations[0];
  const cityCode = text(location?.cityCode);
  if (!cityCode) throw new Error("OTAGHAK_CITY_NOT_FOUND");
  const payload = record(await publicProviderJson(`${API}/api/v3/RoomSearch/SearchRooms`, {
    method: "POST",
    body: {
      cities: [cityCode],
      stateCodes: [],
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      person: accommodationGuests(input),
      sortingType: "MinPricePriority",
      aroundLocations: false,
      skip: 0,
      take: 36,
    },
  }));
  return {
    offers: normalizeOtaghakRows(payload.rooms, input),
    found: Math.max(0, Math.round(finiteNumber(payload.count) || 0)),
    resolvedCity: text(location?.name) || input.city,
  };
}
