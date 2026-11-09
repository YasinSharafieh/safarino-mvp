import assert from "node:assert/strict";
import { dedupeTransportOffers, citySlug, persianCityName, type TransportOffer } from "../lib/transport-types";
import { parseRouteCodes, normalizeSafar724Items } from "../lib/safar724-bus";

assert.equal(citySlug("THR"), "tehran");
assert.equal(citySlug("اصفهان"), "esfahan");
assert.equal(citySlug("مشهد"), "mashhad");
assert.equal(persianCityName("MHD"), "مشهد");

// Safar724 city codes must come from the page, never be invented.
const fakePage = String.raw`{"origin":{"engName":"tehran","faName":"تهران","code":"113000"},"destination":{"engName":"mashhad","faName":"مشهد","code":"113500"}}`;
assert.deepEqual(parseRouteCodes(fakePage, "tehran", "mashhad"), { originCode: "113000", destinationCode: "113500" });
assert.equal(parseRouteCodes(fakePage, "tehran", "shiraz"), null);

const safarItems = [
  { id: 991, price: 12_000_000, availableSeatCount: 7, departureTime: "۲۱:۳۰", arrivalTime: "06:10", departureDate: "1405/08/29", status: "Available", vehicleType: "Bus", companyPersianName: "سیر و سفر", originTerminalName: "ترمینال بیهقی", destinationTerminalName: "ترمینال امام رضا" },
  { id: 992, price: 12_000_005, availableSeatCount: 7, departureTime: "21:30", departureDate: "1405/08/29", status: "Available", vehicleType: "Bus" },
  { id: 993, price: 9_000_000, availableSeatCount: 0, departureTime: "20:00", departureDate: "1405/08/29", status: "Available", vehicleType: "Bus" },
  { id: 994, price: 9_000_000, availableSeatCount: 4, departureTime: "20:00", departureDate: "1405/08/30", status: "Available", vehicleType: "Bus" },
];
const safarOffers = normalizeSafar724Items(safarItems, "tehran", "mashhad", "2026-11-20", "https://www.safar724.com/bus/tehran-mashhad");
assert.equal(safarOffers.length, 1, "only rows that pass every check survive");
assert.equal(safarOffers[0].priceToman, 1_200_000);
assert.equal(safarOffers[0].seatsLeft, 7);
assert.equal(safarOffers[0].departure, "2026-11-20T21:30:00");
assert.ok(safarOffers[0].bookingUrl.startsWith("https://www.safar724.com/"));

const dupes: TransportOffer[] = [
  { id: "a", provider: "alibaba", mode: "bus", operator: "سیر و سفر", serviceLabel: "VIP", departure: "2026-11-20T21:30:00", arrival: null, priceToman: 1_200_000, childPriceToman: null, infantPriceToman: null, seatsLeft: 7, details: [], bookingUrl: "x", bookingNote: "" },
  { id: "b", provider: "safar724", mode: "bus", operator: "سیر و سفر", serviceLabel: "VIP", departure: "2026-11-20T21:30:00", arrival: null, priceToman: 1_205_000, childPriceToman: null, infantPriceToman: null, seatsLeft: 7, details: [], bookingUrl: "y", bookingNote: "" },
  { id: "c", provider: "safar724", mode: "bus", operator: "سیر و سفر", serviceLabel: "VIP", departure: "2026-11-20T23:30:00", arrival: null, priceToman: 1_200_000, childPriceToman: null, infantPriceToman: null, seatsLeft: 7, details: [], bookingUrl: "z", bookingNote: "" },
];
const deduped = dedupeTransportOffers(dupes);
assert.equal(deduped.removed, 1, "same operator, same minute, near price = one offer");
assert.equal(deduped.offers.length, 2, "a different departure time stays separate");

// Near-identical operator spellings across providers must collapse to one row,
// while a different class/price or a different company must stay separate.
const mk = (id: string, provider: "alibaba" | "safar724", operator: string, departure: string, price: number): TransportOffer => ({
  id, provider, mode: "bus", operator, serviceLabel: "VIP", departure, arrival: null, priceToman: price,
  childPriceToman: null, infantPriceToman: null, seatsLeft: 5, details: [], bookingUrl: `https://example.test/${id}`, bookingNote: "",
});
const nearNames = dedupeTransportOffers([
  mk("a1", "alibaba", "تعاونی ۱۱ آریا سفر", "2026-11-20T18:00:00", 1_100_000),
  mk("s1", "safar724", "آریا سفر", "2026-11-20T18:05:00", 1_150_000),
  mk("a2", "alibaba", "تعاونی ۲۲ پارس", "2026-11-20T18:00:00", 1_100_000),
  mk("s2", "safar724", "پارس ترابر", "2026-11-20T18:00:00", 1_100_000),
  mk("s3", "safar724", "آریا سفر", "2026-11-20T18:00:00", 2_600_000),
]);
assert.equal(nearNames.removed, 1, "only the near-identical operator/time/price pair collapses");
assert.equal(nearNames.offers.length, 4, "other companies and other price classes survive");
const merged = nearNames.offers.find((offer: TransportOffer) => offer.id === "a1");
assert.ok(merged?.alsoAvailableAt?.length === 1, "the second provider stays reachable through the merged row");
assert.equal(merged?.alsoAvailableAt?.[0].bookingUrl, "https://example.test/s1");
assert.equal(merged?.alsoAvailableAt?.[0].providerLabel, "سفر۷۲۴");

// The same provider repeating the exact row must not be listed twice.
const sameProvider = dedupeTransportOffers([
  mk("x1", "safar724", "تعاونی ۱۱ آریا سفر", "2026-11-20T18:00:00", 1_100_000),
  mk("x2", "safar724", "تعاونی 11 آریا سفر", "2026-11-20T18:00:00", 1_100_000),
]);
assert.equal(sameProvider.offers.length, 1, "exact repeat inside one provider collapses");
assert.equal(sameProvider.offers[0].alsoAvailableAt, undefined, "no self-link when the sources match");

// Persian digits, Arabic yeh/kaf and punctuation must not split the same company.
const spelling = dedupeTransportOffers([
  mk("p1", "alibaba", "شركت تعاوني ۱۲ سير و سفر", "2026-11-20T22:00:00", 900_000),
  mk("p2", "safar724", "سیر و سفر", "2026-11-20T21:58:00", 905_000),
]);
assert.equal(spelling.offers.length, 1, "Arabic-letter and digit spellings of one company collapse");

console.log("Transport provider parsing and deduplication tests passed.");
