import type { AccommodationOffer, AccommodationSearchInput, ProviderSearchResult } from "./accommodation-types";
import { accommodationGuests, accommodationNights, STAY_TYPE_LABELS } from "./accommodation-types";
import { publicProviderJson } from "./public-provider-http";
import { finiteNumber, itemLabel, normalizeTerm, positiveNumber, record, rows, safeImageUrl, text, toman } from "./accommodation-provider-utils";
import { jalaliFromGregorian } from "./jalali";

const API = "https://gw.jabama.com";
const WEB = "https://www.jabama.com";

function unwrap(value: unknown): Record<string, unknown> {
  const envelope = record(value);
  if (envelope.success === false) throw new Error("JABAMA_UNSUCCESSFUL_RESPONSE");
  return envelope.result && typeof envelope.result === "object" ? record(envelope.result) : envelope;
}

function compactDate(value: string): number {
  return Number(value.replaceAll("-", ""));
}

function jalaliDate(value: string): string {
  const date = jalaliFromGregorian(value);
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function normalizeJabamaRows(value: unknown, input: AccommodationSearchInput): AccommodationOffer[] {
  const nightCount = accommodationNights(input);
  const guests = accommodationGuests(input);
  return rows(value).flatMap((stay): AccommodationOffer[] => {
    const code = text(stay.code);
    const name = text(stay.name);
    const type = text(stay.type) || "villa";
    const price = record(stay.price);
    const total = price.isDefaultDate === true ? null : toman(positiveNumber(price.discountedPrice) ?? positiveNumber(price.mainPrice));
    if (!/^\d+$/.test(code) || !name || !/^[a-z0-9_-]+$/i.test(type) || !total) return [];
    const before = toman(price.mainPrice);
    const location = record(stay.location);
    const geo = record(location.geo);
    const capacity = record(stay.rawCapacity);
    const fallbackCapacity = record(stay.capacity);
    const base = finiteNumber(capacity.base) ?? finiteNumber(fallbackCapacity.base);
    const extra = finiteNumber(capacity.extra) ?? finiteNumber(fallbackCapacity.extra) ?? 0;
    const bedrooms = finiteNumber(record(stay.accommodationMetrics).bedroomsCount);
    const rate = record(stay.rate_review);
    const checkIn = text(price.fa_checkin) || jalaliDate(input.checkIn);
    const checkOut = text(price.fa_checkout) || jalaliDate(input.checkOut);
    const query = new URLSearchParams({ checkIn, checkOut, passengersCount: String(guests) });
    const image = text(stay.image) || (Array.isArray(stay.images) ? text(stay.images[0]) : "");
    return [{
      id: `jabama-${code}`,
      providerPropertyId: code,
      kind: "stay",
      name,
      typeLabel: STAY_TYPE_LABELS[type] || "اقامتگاه",
      location: [text(location.province), text(location.city)].filter(Boolean).join("، ") || input.city,
      imageUrl: safeImageUrl(image, ["cdn.jabama.com"], "/image/"),
      rating: positiveNumber(rate.score),
      reviewCount: Math.max(0, Math.round(finiteNumber(rate.count) || 0)),
      stars: null,
      priceTotalToman: total,
      pricePerNightToman: Math.round(total / nightCount),
      priceBeforeDiscountToman: before && before > total ? before : null,
      discountPercent: Math.max(0, finiteNumber(price.discountPercent) || 0),
      priceIncludesVat: false,
      priceNote: "قیمت اقامت در جاباما؛ مالیات و مبلغ نهایی پرداخت را در صفحه رزرو کنترل کنید.",
      bookingNote: "لینک همان آگهی با تاریخ شمسی و تعداد مسافران این جستجو باز می‌شود.",
      details: [
        base !== null ? `ظرفیت ${base} نفر پایه${extra ? ` + ${extra} نفر اضافه` : ""}` : "",
        bedrooms !== null ? `${bedrooms} اتاق خواب` : "",
        text(stay.reservation_type) === "instant" ? "رزرو آنی" : "با تأیید میزبان",
      ].filter(Boolean),
      amenities: rows(stay.badges).map((badge) => text(badge.name) || itemLabel(badge)).filter(Boolean).slice(0, 2),
      provider: "jabama",
      bookingUrl: `${WEB}/stay/${type}-${code}?${query.toString()}`,
      latitude: finiteNumber(geo.lat) ?? finiteNumber(geo.latitude),
      longitude: finiteNumber(geo.long) ?? finiteNumber(geo.lng) ?? finiteNumber(geo.longitude),
    }];
  });
}

async function resolveJabamaLocation(city: string): Promise<{ slug: string; name: string }> {
  const fullText = await publicProviderJson(`${API}/api/taraaz/v2/search/fts`, { query: { query: city } });
  const unwrapped = unwrap(fullText);
  const candidates = rows(unwrapped.items).filter((item) => {
    const slug = text(item.url).split("?")[0];
    return text(item.type) === "plp" && /^(?:city|province)-[a-z0-9_-]+$/i.test(slug);
  });
  const exact = candidates.find((item) => normalizeTerm(text(item.title).replace(/^اقامتگاه‌های?\s*/, "")) === normalizeTerm(city));
  const selected = exact || candidates[0];
  if (selected) return { slug: text(selected.url).split("?")[0], name: text(selected.title) || city };

  const cityPayload = unwrap(await publicProviderJson(`${API}/api/taraaz/v1/area/cities/search`, { query: { q: city, page: 1 } }));
  const cityRow = rows(cityPayload.items).find((item) => normalizeTerm(text(item.nameFa)) === normalizeTerm(city)) || rows(cityPayload.items)[0];
  const slug = text(cityRow?.nameEn);
  if (!slug) throw new Error("JABAMA_CITY_NOT_FOUND");
  return { slug: `city-${slug}`, name: text(cityRow?.nameFa) || city };
}

export async function searchJabamaAccommodation(input: AccommodationSearchInput): Promise<ProviderSearchResult> {
  const location = await resolveJabamaLocation(input.city);
  const payload = unwrap(await publicProviderJson(`${API}/api/taraaz/v4/search/merchandising/legacy-plp/${location.slug}`, {
    method: "POST",
    query: { platform: "desktop", allowEmptyCity: "true", hasUnitRoom: "true", guarantees: "false" },
    body: {
      "page-size": 36,
      "page-number": 1,
      sort: "price",
      "sort-direction": "false",
      date: { start: compactDate(input.checkIn), end: compactDate(input.checkOut) },
      capacity: accommodationGuests(input),
    },
  }));
  if (record(payload.metadata).redirectCode) throw new Error("JABAMA_CITY_NOT_FOUND");
  return {
    offers: normalizeJabamaRows(payload.items, input),
    found: Math.max(0, Math.round(finiteNumber(payload.total) || 0)),
    resolvedCity: location.name,
  };
}
