import type { AccommodationOffer } from "./accommodation-types";

export const ACCOMMODATION_SELECTION_KEY = "safarino-accommodation-selection-v1";
/** Last live search, kept so the detail page can open instantly and the results survive a back navigation. */
export const ACCOMMODATION_RESULTS_KEY = "safarino-accommodation-results-v1";

export type AccommodationSelectionContext = {
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  infants: number;
  childAges: number[];
  infantAges: number[];
  fetchedAt?: string;
};

/** One selection shape shared by the results page and the detail page, so plan and PDF stay identical. */
export function buildAccommodationSelection(offer: AccommodationOffer, context: AccommodationSelectionContext) {
  return {
    status: "selected" as const,
    id: offer.id,
    kind: offer.kind,
    name: offer.name,
    typeLabel: offer.typeLabel,
    cost: offer.priceTotalToman,
    pricePerNightToman: offer.pricePerNightToman,
    city: context.city,
    checkIn: context.checkIn,
    checkOut: context.checkOut,
    nights: context.nights,
    adults: context.adults,
    children: context.children,
    infants: context.infants,
    childAges: context.childAges,
    infantAges: context.infantAges,
    bookingUrl: offer.bookingUrl,
    imageUrl: offer.imageUrl,
    provider: offer.provider,
    providerPropertyId: offer.providerPropertyId,
    priceIncludesVat: offer.priceIncludesVat,
    priceNote: offer.priceNote,
    bookingNote: offer.bookingNote,
    latitude: offer.latitude,
    longitude: offer.longitude,
    fetchedAt: context.fetchedAt || new Date().toISOString(),
  };
}

export function saveAccommodationSelection(selection: ReturnType<typeof buildAccommodationSelection>): boolean {
  try {
    window.localStorage.setItem(ACCOMMODATION_SELECTION_KEY, JSON.stringify(selection));
    return true;
  } catch {
    return false;
  }
}
