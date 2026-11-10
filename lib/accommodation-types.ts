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
  /** Every public photo the provider published for this property (first one equals imageUrl). */
  images: string[];
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

/** Canonical stay categories used by the interface filter, with the exact option labels. */
export const STAY_TYPE_FILTERS: { key: string; label: string }[] = [
  { key: "villa", label: "ویلا" },
  { key: "suite", label: "سوئیت" },
  { key: "apartment", label: "آپارتمان" },
  { key: "cottage", label: "کلبه" },
  { key: "traditional", label: "خانه سنتی" },
  { key: "ecotourism", label: "بوم‌گردی" },
  { key: "complex", label: "مجتمع اقامتگاهی" },
  { key: "house", label: "خانه مسافر" },
  { key: "hostel", label: "هاستل" },
];

const STAY_TYPE_PATTERNS: [string, RegExp][] = [
  ["villa", /ویلا/],
  ["suite", /سو[ئیي]?یت|سویت|اتاق دو تخته|اتاق یک تخته/],
  ["apartment", /آپارتمان|اپارتمان/],
  ["cottage", /کلبه/],
  ["traditional", /سنتی/],
  ["ecotourism", /بوم\s*گرد|اکو|بومگرد/],
  ["complex", /مجتمع/],
  ["house", /خانه مسافر|خونه مسافر/],
  ["hostel", /هاستل/],
];

function normalizeTypeText(value: string): string {
  return value.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ").trim();
}

/**
 * Maps provider-specific stay labels and property titles onto one canonical category.
 * Providers disagree on vocabulary (e.g. جاجیگا labels everything «ویلا و اقامتگاه», اتاقک says «سوییت»),
 * so the label is read first and the property title is used only to refine a generic label.
 */
export function categorizeStay(typeLabel: string, name = ""): { key: string | null; label: string | null } {
  const label = normalizeTypeText(typeLabel);
  const name_ = normalizeTypeText(name);
  const generic = !label || label === "ویلا و اقامتگاه" || label === "اقامتگاه" || label === "واحد مسکونی";
  for (const source of generic ? [name_, label] : [label, name_]) {
    for (const [key, pattern] of STAY_TYPE_PATTERNS) {
      if (pattern.test(source)) return { key, label: STAY_TYPE_FILTERS.find((item) => item.key === key)?.label ?? null };
    }
  }
  if (/ویلا/.test(`${label} ${name_}`)) return { key: "villa", label: "ویلا" };
  return { key: null, label: null };
}
