import type { AccommodationOffer, AccommodationSearchInput, ProviderSearchResult } from "./accommodation-types";
import { accommodationGuests, accommodationNights } from "./accommodation-types";
import { publicProviderJson } from "./public-provider-http";
import { finiteNumber, normalizeTerm, positiveNumber, record, rows, safeImageUrl, text } from "./accommodation-provider-utils";

const OTAGHAK_PAGE_SIZE = 36;
/** Extra result pages read on top of the first one. */
const EXTRA_PAGES = 2;
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
    const mediaTitles = record(room.roomMediaTitles);
    const imageNames = [
      text(mediaTitles.mainImageTitle),
      ...rows(mediaTitles.galleryImages).map((item) => text(item.galleryImagesTitle)),
    ].map((value) => value.replace(/^\/+/, "")).filter(Boolean);
    const images = Array.from(new Set(imageNames))
      .map((name) => safeImageUrl(IMAGES + name, ["cdn.otaghak.com"], "/otg-images-new/X500/"))
      .filter((value): value is string => Boolean(value));
    const imageName = imageNames[0] || "";
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
      images,
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
  const fetchPage = async (skip: number) => record(await publicProviderJson(`${API}/api/v3/RoomSearch/SearchRooms`, {
    method: "POST",
    body: {
      cities: [cityCode],
      stateCodes: [],
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      person: accommodationGuests(input),
      sortingType: "MinPricePriority",
      aroundLocations: false,
      skip,
      take: OTAGHAK_PAGE_SIZE,
    },
  }));

  const first = await fetchPage(0);
  const found = Math.max(0, Math.round(finiteNumber(first.count) || 0));
  const offers = normalizeOtaghakRows(first.rooms, input);
  const extraPages = Math.min(EXTRA_PAGES, Math.max(0, Math.ceil((found - offers.length) / OTAGHAK_PAGE_SIZE)));
  const extra = await Promise.all(
    Array.from({ length: extraPages }, (_, index) => fetchPage(OTAGHAK_PAGE_SIZE * (index + 1)).catch(() => null)),
  );
  const merged = new Map(offers.map((offer) => [offer.id, offer]));
  for (const payload of extra) {
    if (!payload) continue;
    for (const offer of normalizeOtaghakRows(payload.rooms, input)) merged.set(offer.id, offer);
  }
  return { offers: Array.from(merged.values()), found, resolvedCity: text(location?.name) || input.city };
}
