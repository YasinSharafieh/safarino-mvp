import assert from "node:assert/strict";
import type { AccommodationOffer, AccommodationSearchInput } from "../lib/accommodation-types";
import { categorizeStay } from "../lib/accommodation-types";
import { normalizeJajigaRows } from "../lib/jajiga-accommodation";
import { normalizeJabamaRows } from "../lib/jabama-accommodation";
import { normalizeOtaghakRows } from "../lib/otaghak-accommodation";
import { normalizeSnapptripRows } from "../lib/snapptrip-accommodation";
import { normalizeEghamat24Rows } from "../lib/eghamat24-accommodation";
import { deduplicateAccommodationOffers } from "../lib/accommodation-search";

const input: AccommodationSearchInput = {
  kind: "stay", city: "رامسر", checkIn: "2026-11-20", checkOut: "2026-11-22", adults: 2, childAges: [], infantAges: [],
};

const jajiga = normalizeJajigaRows([{ id: 3179488, title: "خانه ویلایی در رامسر", url: "/room/3179488?gstnum=2&chin=2026-11-20&chout=2026-11-22", city_name: "رامسر", invoice: { final: 4_000_000 }, pictures: { items: [{ url: "2026/08/03/photo.jpg" }] }, rating: { total: 4.7, count: 27 }, guest_number: 4, max_guest_number: 7, geo: { lat: 36.94, lng: 50.61 } }], input)[0];
assert.equal(jajiga.priceTotalToman, 4_000_000);
assert.equal(jajiga.pricePerNightToman, 2_000_000);
assert.equal(jajiga.bookingUrl, "https://www.jajiga.com/room/3179488?gstnum=2&chin=2026-11-20&chout=2026-11-22");
assert.equal(jajiga.imageUrl, "https://storage.jajiga.com/public/pictures/medium/2026/08/03/photo.jpg");

const jabama = normalizeJabamaRows([{ code: 800749, name: "ویلا دوخوابه هونام", type: "villa", image: "https://cdn.jabama.com/image/jabama-images/1/photo.jpg", price: { discountedPrice: 46_800_000, mainPrice: 50_000_000, isDefaultDate: false }, location: { city: "رامسر", geo: { lat: 36.88, long: 50.69 } }, rate_review: { score: 4.9, count: 30 } }], input)[0];
assert.equal(jabama.priceTotalToman, 4_680_000);
assert.equal(jabama.priceBeforeDiscountToman, 5_000_000);
assert.equal(jabama.priceIncludesVat, false);
assert.ok(jabama.bookingUrl.includes("passengersCount=2"));
assert.ok(jabama.bookingUrl.includes("/stay/villa-800749"));

const otaghak = normalizeOtaghakRows([{ roomId: 2463937, roomName: "نوروزی", roomTypeName: "ویلا", totalPrice: 3_200_000, totalPriceWithExtraPerson: 3_800_000, roomMediaTitles: { mainImageTitle: "photo.webp" }, cityFaName: "رامسر" }], input)[0];
assert.equal(otaghak.priceTotalToman, 3_800_000);
assert.equal(otaghak.imageUrl, "https://cdn.otaghak.com/otg-images-new/X500/photo.webp");
assert.ok(otaghak.bookingUrl.includes("checkIn=2026-11-20"));

const snapptrip = normalizeSnapptripRows([{
  id: 177,
  title: "بین المللی گلدن پالاس",
  accommodation_type: "هتل",
  address: "مشهد، خیابان امام رضا (ع)، میدان بسیج",
  price: 14910000,
  price_off: 16000000,
  discount_percent: 0,
  stars: 5,
  is_available: true,
  instant_book: true,
  cover_media: { media: "/domestic-hotel/galleries/hotel/177/33357.jpeg" },
  reviews: { ptp_ratings: "4.300000", ptp_reviews: "496" },
  fa_url: "هتل-بین-المللی-گلدن-پالاس",
  city_url: "مشهد",
  min_price_room_title: "یک تخته اکونومی",
  facilities: [{ title: "اینترنت رایگان و نامحدود" }],
  location: [36.272188, 59.602845],
}], { ...input, kind: "hotel", city: "مشهد" })[0];
assert.equal(snapptrip.priceTotalToman, 14_910_000, "Snapptrip price is Toman");
assert.equal(snapptrip.pricePerNightToman, 7_455_000);
assert.equal(snapptrip.imageUrl, "https://store.snapptrip.com/domestic-hotel/galleries/hotel/177/33357.jpeg");
assert.equal(snapptrip.rating, 4.3);
assert.equal(snapptrip.reviewCount, 496);
assert.equal(decodeURIComponent(snapptrip.bookingUrl), "https://www.snapptrip.com/رزرو-هتل/مشهد/هتل-بین-المللی-گلدن-پالاس");
assert.equal(snapptrip.latitude, 36.272188);

const eghamat = normalizeEghamat24Rows([{ id: 1253, full_name: "هتل پارسیس مشهد", type: "hotel", star: "5", min_price: "40000000", original_image: "Mashhad-Parsis-66.jpg", uri: "/MashhadHotels/ParsisHotel.html", lat: 36.2896, lng: 59.6289 }], { ...input, kind: "hotel", city: "مشهد" })[0];
assert.equal(eghamat.priceTotalToman, 4_000_000);
assert.equal(eghamat.bookingUrl, "https://www.eghamat24.com/MashhadHotels/ParsisHotel.html");
assert.ok(eghamat.imageUrl?.includes("/app/public/hotel_images/original/"));

function offer(overrides: Partial<AccommodationOffer>): AccommodationOffer {
  return {
    ...jabama,
    id: "offer-base", provider: "jabama", providerPropertyId: "1", name: "ویلا نمونه", priceTotalToman: 2_000_000,
    bookingUrl: "https://www.jabama.com/stay/villa-1", latitude: 37.1, longitude: 49.1, stars: null,
    ...overrides,
  };
}

const shared = deduplicateAccommodationOffers([
  offer({ id: "jabama-42", providerPropertyId: "42", priceTotalToman: 2_000_000 }),
  offer({ id: "alibaba-stay-42", provider: "alibaba", providerPropertyId: "42", priceTotalToman: 2_100_000, bookingUrl: "https://www.alibaba.ir/accommodation/pdp/villa-42" }),
]);
assert.equal(shared.length, 1);
assert.equal(shared[0].offers.length, 2);
assert.equal(shared[0].matchReason, "shared_inventory");
assert.equal(shared[0].offers[0].provider, "jabama");
assert.ok(shared[0].offers.every((item) => item.bookingUrl.includes(item.provider === "alibaba" ? "alibaba.ir" : "jabama.com")));

// Policy: an identical distinctive name in the same city is the same property (one provider may
// simply not publish a map pin), but a merely similar name without coordinates must stay apart.
const identicalNameNoPin = deduplicateAccommodationOffers([
  offer({ id: "a", name: "ویلا نمونه", latitude: null, longitude: null, stars: null }),
  offer({ id: "b", provider: "otaghak", providerPropertyId: "b", name: "ویلا نمونه", latitude: null, longitude: null, stars: null }),
]);
assert.equal(identicalNameNoPin.length, 1, "Identical name in the same city merges even without a pin");

const similarNameNoPin = deduplicateAccommodationOffers([
  offer({ id: "c", name: "ویلا نمونه ساحلی", latitude: null, longitude: null, stars: null }),
  offer({ id: "d", provider: "otaghak", providerPropertyId: "d", name: "ویلا نمونه جنگلی", latitude: null, longitude: null, stars: null }),
]);
assert.equal(similarNameNoPin.length, 2, "A similar but different name without a pin must not merge");

const close = deduplicateAccommodationOffers([
  offer({ id: "a", name: "هتل الماس ۲ مشهد", location: "مشهد" }),
  offer({ id: "b", provider: "snapptrip", providerPropertyId: "b", name: "الماس 2", location: "مشهد", latitude: 37.10001, longitude: 49.10001 }),
]);
assert.equal(close.length, 1);
assert.equal(close[0].matchReason, "verified_name_location");

// Same name on the same pin with a one-star disagreement is one property (providers rate it differently).
const starDisagreement = deduplicateAccommodationOffers([
  offer({ id: "a", kind: "hotel", stars: 4 }),
  offer({ id: "b", provider: "snapptrip", kind: "hotel", stars: 5 }),
]);
assert.equal(starDisagreement.length, 1, "One property with two star labels still merges");

// A different name at a different pin must never merge, whatever the stars say.
const differentStars = deduplicateAccommodationOffers([
  offer({ id: "c", kind: "hotel", name: "هتل الف مشهد", stars: 4, latitude: 36.29, longitude: 59.60 }),
  offer({ id: "d", provider: "snapptrip", kind: "hotel", name: "هتل ب مشهد", stars: 5, latitude: 36.33, longitude: 59.55 }),
]);
assert.equal(differentStars.length, 2, "Different names and different pins stay apart");

assert.deepEqual(categorizeStay("ویلا و اقامتگاه", "سوئیت در جاده ماسوله - همکف"), { key: "suite", label: "سوئیت" });
assert.deepEqual(categorizeStay("سوییت", "دنج سرسبز"), { key: "suite", label: "سوئیت" });
assert.deepEqual(categorizeStay("خانه مسافر", "خانه مسافر خوشحال دوست"), { key: "house", label: "خانه مسافر" });
assert.deepEqual(categorizeStay("ویلا", "ویلا یک خوابه چلچراغ"), { key: "villa", label: "ویلا" });
assert.deepEqual(categorizeStay("اقامتگاه", "مجتمع اقامتی سیلوانه"), { key: "complex", label: "مجتمع اقامتگاهی" });
assert.equal(categorizeStay("", "اقامتگاه ساحلی").key, null);

console.log("Accommodation normalization and conservative deduplication tests passed.");

// Same property, different spelling across two providers (extra words, punctuation, Arabic letters).
const nearName = deduplicateAccommodationOffers([
  offer({ id: "h1", kind: "hotel", provider: "jabama", providerPropertyId: "h1", name: "هتل بین‌المللی پارسیس مشهد", location: "مشهد، خیابان امام رضا", latitude: 36.2896, longitude: 59.6289, stars: 5 }),
  offer({ id: "h2", kind: "hotel", provider: "eghamat24", providerPropertyId: "h2", name: "پارسیس (مشهد)", location: "مشهد", latitude: 36.2897, longitude: 59.6290, stars: 5 }),
]);
assert.equal(nearName.length, 1, "near-identical hotel names at the same spot merge");
assert.equal(nearName[0].offers.length, 2, "both purchase links stay inside the merged card");
assert.ok(nearName[0].offers.every((item) => item.bookingUrl.length > 10));

// Two genuinely different hotels in the same city must never merge, however similar the words.
const differentHotel = deduplicateAccommodationOffers([
  offer({ id: "d1", kind: "hotel", name: "هتل پارس مشهد", location: "مشهد", latitude: 36.29, longitude: 59.60, stars: 4 }),
  offer({ id: "d2", kind: "hotel", provider: "snapptrip", providerPropertyId: "d2", name: "هتل پارسیان مشهد", location: "مشهد", latitude: 36.31, longitude: 59.55, stars: 4 }),
]);
assert.equal(differentHotel.length, 2, "a different name and a different pin stay separate");

// One provider without coordinates still merges when the name and the star rating match.
const oneSideMissing = deduplicateAccommodationOffers([
  offer({ id: "m1", kind: "hotel", name: "هتل قصر طلایی مشهد", location: "مشهد", latitude: 36.3, longitude: 59.6, stars: 5 }),
  offer({ id: "m2", kind: "hotel", provider: "otaghak", providerPropertyId: "m2", name: "قصر طلایی", location: "مشهد", latitude: null, longitude: null, stars: 5 }),
]);
assert.equal(oneSideMissing.length, 1, "same name and same stars merge even without coordinates");

// Live-miss regression: the same hotel with two different address formats and a 20-metre pin drift.
const addressFormats = deduplicateAccommodationOffers([
  offer({ id: "ast1", kind: "hotel", provider: "eghamat24", providerPropertyId: "ast1", name: "هتل آپارتمان آستانه شیراز", location: "آدرس:  شیراز- خیابان حسینی- میدان آستانه", stars: 2, latitude: 29.605670834209, longitude: 52.546993405101 }),
  offer({ id: "ast2", kind: "hotel", provider: "alibaba", providerPropertyId: "ast2", name: "هتل آپارتمان آستانه شیراز", location: "شیراز", stars: 2, latitude: 29.605494087860947, longitude: 52.54700989740245 }),
]);
assert.equal(addressFormats.length, 1, "different address formats for one city do not block a merge");
assert.equal(addressFormats[0].offers.length, 2, "both booking links are preserved");

// Live case: three different Mashhad hotels whose names share one word must stay three cards,
// while each one still merges with its own duplicates on other providers.
const similarChain = deduplicateAccommodationOffers([
  offer({ id: "alamas", kind: "hotel", location: "مشهد، خیابان امام رضا", provider: "eghamat24", providerPropertyId: "alamas", name: "هتل الماس مشهد", stars: 4, latitude: 36.281804236384, longitude: 59.610812686144 }),
  offer({ id: "alamas-a", kind: "hotel", location: "مشهد، خیابان امام رضا", provider: "alibaba", providerPropertyId: "alamas-a", name: "هتل الماس مشهد", stars: 4, latitude: 36.281761233237, longitude: 59.610867756612 }),
  offer({ id: "alamas1", kind: "hotel", location: "مشهد، خیابان امام رضا", provider: "snapptrip", providerPropertyId: "alamas1", name: "الماس ۱", stars: 4, latitude: 36.281811, longitude: 59.610961 }),
  offer({ id: "novin", kind: "hotel", location: "مشهد، خیابان امام رضا", provider: "eghamat24", providerPropertyId: "novin", name: "هتل الماس نوین مشهد", stars: 4, latitude: 36.281172327117, longitude: 59.607992905522 }),
  offer({ id: "novin-a", kind: "hotel", location: "مشهد، خیابان امام رضا", provider: "alibaba", providerPropertyId: "novin-a", name: "هتل الماس نوین مشهد", stars: 4, latitude: 36.28117671872834, longitude: 59.60798455400472 }),
  offer({ id: "two", kind: "hotel", location: "مشهد، خیابان امام رضا", provider: "eghamat24", providerPropertyId: "two", name: "هتل الماس ۲ مشهد", stars: 4, latitude: 36.291000, longitude: 59.621000 }),
]);
assert.equal(similarChain.length, 3, "a second hotel sharing one word stays its own card");
const almasCard = similarChain.find((group) => group.offers.some((item) => item.id === "alamas"));
assert.equal(almasCard?.offers.length, 3, "the same building with three spellings is one card");

// Live cases: a guest house ("خانه مسافر") and a "مهمان‌پذیر" are the same property as the hotel
// listing, and a provider that sends 0 stars means "not rated", not a zero-star building.
const kindWording = deduplicateAccommodationOffers([
  offer({ id: "hermes-g", kind: "hotel", location: "مشهد، خیابان امام رضا", provider: "eghamat24", providerPropertyId: "hermes-g", name: "خانه مسافر هرمس مشهد", stars: null, latitude: 36.275656630647, longitude: 59.61080986771 }),
  offer({ id: "hermes-h", kind: "hotel", location: "مشهد، خیابان امام رضا", provider: "alibaba", providerPropertyId: "hermes-h", name: "هتل هرمس مشهد", stars: 2, latitude: 36.275328950810014, longitude: 59.61145791381735 }),
  offer({ id: "zanbaq-1", kind: "hotel", location: "مشهد، خیابان امام رضا", provider: "alibaba", providerPropertyId: "zanbaq-1", name: "هتل زنبق مشهد", stars: 0, latitude: 36.2856679412673, longitude: 59.6084133404744 }),
  offer({ id: "zanbaq-2", kind: "hotel", location: "مشهد، خیابان امام رضا", provider: "eghamat24", providerPropertyId: "zanbaq-2", name: "مهمان‌پذیر زنبق مشهد", stars: 2, latitude: 36.28553719646, longitude: 59.608457352505 }),
]);
assert.equal(kindWording.length, 2, "both pairs collapse to one card each");
assert.equal(kindWording[0].offers.length + kindWording[1].offers.length, 4);

console.log("Accommodation near-name deduplication tests passed.");
