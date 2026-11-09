import assert from "node:assert/strict";
import { dedupeTransportOffers, citySlug, persianCityName, type TransportOffer } from "../lib/transport-types";
import { parseRouteCodes, normalizeSafar724Items } from "../lib/safar724-bus";
import { extractFadakPage, normalizeFadakRows } from "../lib/fadak-train";

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

const fadakHtml = `<html><body><div class="available-card"><span>۲۹ آبان</span><b>08:20</b><b>16:40</b><span>هر نفر 1,850,000 تومان</span><span>ظرفیت : 24+ صندلی</span></div><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: { pageProps: {
    route: { originKey: "tehran", destinationKey: "mashhad" },
    calendarDates: [{ goingDate: "2026-11-20", label: "۲۹ آبان" }],
    available: [{ origin: "تهران", destination: "مشهد", ownerName: "رجا", wagonName: "کوپه ۴ نفره", goingExitDate: "2026-11-20", originMoveTime: "08:20", timeOfArrivalToDestination: "16:40", price: 18_500_000, discountPrice: 18_500_000, seatCount: 40, travelDuration: 500 }],
  } },
})}</script></body></html>`;
const page = extractFadakPage(fadakHtml);
assert.ok(page);
const fadakOffers = normalizeFadakRows(page!, fadakHtml, "2026-11-20", "تهران", "مشهد", "https://www.fadaktrains.com/train/mashhad/tehran-mashhad");
assert.equal(fadakOffers.length, 1);
assert.equal(fadakOffers[0].priceToman, 1_850_000);
assert.equal(fadakOffers[0].operator, "رجا");

const mismatched = { ...page!, available: [{ ...page!.available![0], discountPrice: 19_000_000 }] };
assert.equal(normalizeFadakRows(mismatched, fadakHtml, "2026-11-20", "تهران", "مشهد", "x").length, 0, "a price that disagrees with the visible card is rejected");
const wrongDay = { ...page!, available: [{ ...page!.available![0], goingExitDate: "2026-11-21" }] };
assert.equal(normalizeFadakRows(wrongDay, fadakHtml, "2026-11-20", "تهران", "مشهد", "x").length, 0, "another date is never shown for the requested day");

const dupes: TransportOffer[] = [
  { id: "a", provider: "alibaba", mode: "bus", operator: "سیر و سفر", serviceLabel: "VIP", departure: "2026-11-20T21:30:00", arrival: null, priceToman: 1_200_000, childPriceToman: null, infantPriceToman: null, seatsLeft: 7, details: [], bookingUrl: "x", bookingNote: "" },
  { id: "b", provider: "safar724", mode: "bus", operator: "سیر و سفر", serviceLabel: "VIP", departure: "2026-11-20T21:30:00", arrival: null, priceToman: 1_205_000, childPriceToman: null, infantPriceToman: null, seatsLeft: 7, details: [], bookingUrl: "y", bookingNote: "" },
  { id: "c", provider: "safar724", mode: "bus", operator: "سیر و سفر", serviceLabel: "VIP", departure: "2026-11-20T23:30:00", arrival: null, priceToman: 1_200_000, childPriceToman: null, infantPriceToman: null, seatsLeft: 7, details: [], bookingUrl: "z", bookingNote: "" },
];
const deduped = dedupeTransportOffers(dupes);
assert.equal(deduped.removed, 1, "same operator, same minute, near price = one offer");
assert.equal(deduped.offers.length, 2, "a different departure time stays separate");

console.log("Transport provider parsing and deduplication tests passed.");
