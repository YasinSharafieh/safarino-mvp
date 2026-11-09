export type AccommodationKind = "hotel" | "stay";
export type AccommodationProvider = "alibaba" | "jajiga" | "jabama" | "snapptrip" | "otaghak" | "eghamat24";

export type AccommodationSearchInput = {
  kind: AccommodationKind;
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childAges: number[];
  infantAges: number[];
};

export type AccommodationOffer = {
  id: string;
  providerPropertyId: string;
  kind: AccommodationKind;
  name: string;
  typeLabel: string;
  location: string;
  imageUrl: string | null;
  rating: number | null;
  reviewCount: number;
  stars: number | null;
  priceTotalToman: number;
  pricePerNightToman: number;
  priceBeforeDiscountToman: number | null;
  discountPercent: number;
  /** null means the public search response does not establish the VAT basis. */
  priceIncludesVat: boolean | null;
  priceNote: string;
  bookingNote: string;
  details: string[];
  amenities: string[];
  provider: AccommodationProvider;
  bookingUrl: string;
  latitude: number | null;
  longitude: number | null;
};

export type AccommodationGroup = {
  id: string;
  matchReason: "single" | "shared_inventory" | "verified_name_location";
  offers: AccommodationOffer[];
};

export type ProviderSearchStatus = {
  provider: AccommodationProvider;
  label: string;
  status: "ok" | "empty" | "unavailable" | "not_supported";
  count: number;
  found: number;
  message?: string;
};

export type ProviderSearchResult = {
  offers: AccommodationOffer[];
  found: number;
  resolvedCity: string;
};

export const PROVIDER_LABELS: Record<AccommodationProvider, string> = {
  alibaba: "علی‌بابا",
  jajiga: "جاجیگا",
  jabama: "جاباما",
  snapptrip: "اسنپ‌تریپ",
  otaghak: "اتاقک",
  eghamat24: "اقامت۲۴",
};

export const STAY_TYPE_LABELS: Record<string, string> = {
  villa: "ویلا",
  suite: "سوئیت",
  traditional: "خانه سنتی",
  cottage: "کلبه",
  apartment: "آپارتمان",
  hostel: "هاستل",
  ecotourism: "بوم‌گردی",
  complex: "مجتمع اقامتگاهی",
  residential_unit: "واحد مسکونی",
  traditional_residence: "اقامتگاه سنتی",
  inn: "مهمانپذیر",
  traveler_house: "خانه مسافر",
  apartment_hotel: "هتل آپارتمان",
  ecotourism_resorts: "بوم‌گردی",
  hotel: "هتل",
};

export function accommodationNights(input: Pick<AccommodationSearchInput, "checkIn" | "checkOut">): number {
  return Math.round((Date.parse(`${input.checkOut}T00:00:00Z`) - Date.parse(`${input.checkIn}T00:00:00Z`)) / 86_400_000);
}

export function accommodationGuests(input: Pick<AccommodationSearchInput, "adults" | "childAges" | "infantAges">): number {
  return input.adults + input.childAges.length + input.infantAges.length;
}
