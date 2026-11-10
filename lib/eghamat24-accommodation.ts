import type { AccommodationOffer, AccommodationSearchInput, ProviderSearchResult } from "./accommodation-types";
import { accommodationNights, STAY_TYPE_LABELS } from "./accommodation-types";
import { publicProviderJson } from "./public-provider-http";
import { finiteNumber, normalizeTerm, positiveNumber, record, rows, safeImageUrl, text, toman } from "./accommodation-provider-utils";

const SITE = "https://www.eghamat24.com";
const IMAGE_ROOT = `${SITE}/app/public/hotel_images/original/`;

function valueOf(payload: unknown): Record<string, unknown> {
  const envelope = record(payload);
  if (finiteNumber(envelope.code) && finiteNumber(envelope.code)! >= 400) throw new Error("EGHAMAT24_UNSUCCESSFUL_RESPONSE");
  return record(envelope.value);
}

export function normalizeEghamat24Rows(value: unknown, input: AccommodationSearchInput): AccommodationOffer[] {
  const nightCount = accommodationNights(input);
  return rows(value).flatMap((property): AccommodationOffer[] => {
    const id = text(property.id);
    const name = text(property.full_name);
    const uri = text(property.uri);
    const total = toman(property.min_price);
    if (!/^\d+$/.test(id) || !name || !total || !/^\/[A-Za-z0-9_]+(?:Hotels|Stays)\/[A-Za-z0-9_]+\.html$/.test(uri)) return [];
    const stars = finiteNumber(property.star);
    const type = text(property.type);
    const imageName = text(property.original_image).replace(/^\/+/, "");
    const typeLabel = input.kind === "hotel"
      ? stars ? `${STAY_TYPE_LABELS[type] || "هتل"} ${stars} ستاره` : STAY_TYPE_LABELS[type] || "هتل"
      : STAY_TYPE_LABELS[type] || "اقامتگاه";
    return [{
      id: `eghamat24-${id}`,
      providerPropertyId: id,
      kind: input.kind,
      name,
      typeLabel,
      location: text(property.address) || input.city,
      imageUrl: imageName ? safeImageUrl(IMAGE_ROOT + encodeURIComponent(imageName), ["www.eghamat24.com"], "/app/public/hotel_images/original/") : null,
      images: imageName
        ? [safeImageUrl(IMAGE_ROOT + encodeURIComponent(imageName), ["www.eghamat24.com"], "/app/public/hotel_images/original/")].filter((value): value is string => Boolean(value))
        : [],
      rating: positiveNumber(property.rating),
      reviewCount: Math.max(0, Math.round(finiteNumber(property.comment_count) || 0)),
      stars,
      priceTotalToman: total,
      pricePerNightToman: Math.round(total / nightCount),
      priceBeforeDiscountToman: null,
      discountPercent: Math.max(0, finiteNumber(property.discount_percent) || 0),
      priceIncludesVat: null,
      priceNote: "شروع قیمت اتاق‌های موجود اقامت۲۴ برای کل اقامت؛ نوع اتاق، ظرفیت و مالیات نهایی را کنترل کنید.",
      bookingNote: "لینک دقیق همان اقامتگاه است؛ تاریخ، اتاق متناسب با مسافران و مبلغ نهایی را در صفحه رزرو تأیید کنید.",
      details: [text(property.grade) ? "اطلاعات رسمی اقامت۲۴" : "", input.kind === "stay" ? typeLabel : ""].filter(Boolean),
      amenities: [],
      provider: "eghamat24",
      bookingUrl: `${SITE}${uri}`,
      latitude: finiteNumber(property.lat),
      longitude: finiteNumber(property.lng),
    }];
  });
}

export async function searchEghamat24Accommodation(input: AccommodationSearchInput): Promise<ProviderSearchResult> {
  const locations = rows(valueOf(await publicProviderJson(`${SITE}/locations`, {
    headers: { Accept: "*/*", Referer: `${SITE}/` },
  })).locations).filter((item) => text(item.type) !== "country");
  const wanted = normalizeTerm(input.city);
  const exact = locations.filter((item) => normalizeTerm(text(item.name)) === wanted || normalizeTerm(text(item.english_name)) === wanted);
  const location = exact.find((item) => text(item.type) === "city") || exact[0] || locations.find((item) => normalizeTerm(`${text(item.name)} ${text(item.english_name)}`).includes(wanted));
  const slug = text(location?.english_name);
  if (!slug) throw new Error("EGHAMAT24_CITY_NOT_FOUND");
  const result = valueOf(await publicProviderJson(`${SITE}/search/get-properties-v2`, {
    query: {
      destination_name: slug,
      check_in: input.checkIn,
      length_of_stay: accommodationNights(input),
      group_type: input.kind,
    },
    headers: { Accept: "*/*", Referer: `${SITE}/` },
  }));
  const available = rows(result.properties);
  return {
    offers: normalizeEghamat24Rows(available, input),
    found: Math.max(available.length, Math.round(finiteNumber(result.total) || 0)),
    resolvedCity: text(location?.name) || input.city,
  };
}
