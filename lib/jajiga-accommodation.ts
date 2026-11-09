import type { AccommodationOffer, AccommodationSearchInput, ProviderSearchResult } from "./accommodation-types";
import { accommodationGuests, accommodationNights } from "./accommodation-types";
import { publicProviderJson } from "./public-provider-http";
import { finiteNumber, normalizeTerm, positiveNumber, record, rows, safeImageUrl, text } from "./accommodation-provider-utils";

const API = "https://api.jajiga.com/api";
const WEB = "https://www.jajiga.com";
const PICTURES = "https://storage.jajiga.com/public/pictures/medium/";
const JAJIGA_PAGE_SIZE = 30;
/** Extra result pages read on top of the first one. */
const EXTRA_PAGES = 2;

export function normalizeJajigaRows(value: unknown, input: AccommodationSearchInput): AccommodationOffer[] {
  const nightCount = accommodationNights(input);
  const guests = accommodationGuests(input);
  return rows(value).flatMap((room): AccommodationOffer[] => {
    const id = text(room.id);
    const name = text(room.title);
    const total = positiveNumber(record(room.invoice).final);
    if (!/^\d+$/.test(id) || !name || !total) return [];
    const suppliedPath = text(room.url);
    const path = suppliedPath.startsWith("/room/")
      ? suppliedPath
      : `/room/${id}?${new URLSearchParams({ gstnum: String(guests), chin: input.checkIn, chout: input.checkOut }).toString()}`;
    const picture = rows(record(room.pictures).items)[0];
    const relativeImage = text(picture?.url).replace(/^\/+/, "");
    const imageUrl = relativeImage ? safeImageUrl(PICTURES + relativeImage, ["storage.jajiga.com"], "/public/pictures/medium/") : null;
    const rating = record(room.rating);
    const geo = record(room.geo);
    const base = finiteNumber(room.guest_number);
    const maximum = finiteNumber(room.max_guest_number);
    const bedrooms = finiteNumber(room.bedrooms);
    const properties = Array.isArray(room.properties) ? room.properties : [];
    return [{
      id: `jajiga-${id}`,
      providerPropertyId: id,
      kind: "stay",
      name,
      typeLabel: "ویلا و اقامتگاه",
      location: [text(room.province_name), text(room.city_name)].filter(Boolean).join("، ") || input.city,
      imageUrl,
      rating: positiveNumber(rating.total),
      reviewCount: Math.max(0, Math.round(finiteNumber(rating.count) || 0)),
      stars: null,
      priceTotalToman: Math.round(total),
      pricePerNightToman: Math.round(total / nightCount),
      priceBeforeDiscountToman: null,
      discountPercent: 0,
      priceIncludesVat: true,
      priceNote: "مبلغ نهایی فاکتور جستجوی جاجیگا برای همین تاریخ و ظرفیت.",
      bookingNote: suppliedPath.includes("chin=") && suppliedPath.includes("chout=")
        ? "لینک همان آگهی با تاریخ و ظرفیت جستجو باز می‌شود."
        : "لینک همان آگهی است؛ تاریخ و ظرفیت را پیش از پرداخت دوباره کنترل کنید.",
      details: [
        base !== null ? `ظرفیت ${base} نفر پایه${maximum && maximum > base ? ` + ${maximum - base} نفر اضافه` : ""}` : "",
        bedrooms !== null ? `${bedrooms} اتاق خواب` : "",
        properties.includes("is_instant") ? "رزرو آنی" : "با تأیید میزبان",
      ].filter(Boolean),
      amenities: [],
      provider: "jajiga",
      bookingUrl: `${WEB}${path}`,
      latitude: finiteNumber(geo.lat),
      longitude: finiteNumber(geo.lng),
    }];
  });
}

export async function searchJajigaAccommodation(input: AccommodationSearchInput): Promise<ProviderSearchResult> {
  const locationPayload = record(await publicProviderJson(`${API}/autocomplete`, { query: { phrase: input.city } }));
  const locations = rows(locationPayload.items).filter((item) => text(item.id) && text(item.label) && text(item.type) !== "room");
  const exact = locations.find((item) => normalizeTerm(text(item.label)) === normalizeTerm(input.city));
  const location = exact || locations[0];
  const locationId = text(location?.id);
  if (!locationId) throw new Error("JAJIGA_CITY_NOT_FOUND");
  const fetchPage = async (page: number) => {
    const payload = record(await publicProviderJson(`${API}/search`, {
      query: {
        "locations[]": [locationId],
        checkin: input.checkIn,
        checkout: input.checkOut,
        min_capacity: accommodationGuests(input),
        order: "low_price",
        page,
        per_page: JAJIGA_PAGE_SIZE,
        "with[]": ["rooms"],
      },
    }));
    return record(payload.rooms);
  };

  const first = await fetchPage(1);
  const found = Math.max(0, Math.round(finiteNumber(record(first.pagination).total) || 0));
  const offers = normalizeJajigaRows(first.items, input);
  const extraPages = Math.min(EXTRA_PAGES, Math.max(0, Math.ceil((found - offers.length) / JAJIGA_PAGE_SIZE)));
  const extra = await Promise.all(
    Array.from({ length: extraPages }, (_, index) => fetchPage(index + 2).catch(() => null)),
  );
  const merged = new Map(offers.map((offer) => [offer.id, offer]));
  for (const rooms of extra) {
    if (!rooms) continue;
    for (const offer of normalizeJajigaRows(rooms.items, input)) merged.set(offer.id, offer);
  }
  return { offers: Array.from(merged.values()), found, resolvedCity: text(location?.label) || input.city };
}
