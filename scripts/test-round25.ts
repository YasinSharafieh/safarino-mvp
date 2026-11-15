/**
 * Round 25 — the corrections the traveller asked for, checked one by one.
 */
import { parseTripLink } from "../lib/link-prefill";
import { stayPrice } from "../lib/stay-price";
import { computeCarTrip, MAX_DEPRECIATION_PER_KM, DEFAULT_TOLL_PER_KM } from "../lib/car-cost";
import { findCar, FUEL_OPTIONS } from "../lib/car-catalog";
import { todaysPackageDestinations } from "../lib/trip-packages";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

console.log("A package link carries the bus and the hotel it was built from");
const ticket = {
  mode: "bus",
  operator: "شرکت اتوبوسرانی ایران",
  service: "VIP",
  priceToman: 1_200_000,
  provider: "alibaba",
  providerLabel: "علی‌بابا",
  bookingUrl: "https://www.alibaba.ir/bus/xyz",
  departure: "2026-11-20T21:30:00",
  arrival: "2026-11-21T05:10:00",
};
const stay = {
  name: "هتل پارس",
  typeLabel: "هتل ۳ ستاره",
  location: "مرکز شهر",
  provider: "snapptrip",
  providerLabel: "اسنپ‌تریپ",
  photo: null,
  rating: 8.4,
  pricePerNightToman: 1_500_000,
  priceTotalToman: 3_000_000,
  bookingUrl: "https://snapptrip.com/hotel/1",
  nights: 2,
};
const search = `?from=${encodeURIComponent("تهران")}&to=${encodeURIComponent("مشهد")}&date=2026-11-20&return=2026-11-22&mode=bus&adults=2&nights=2&pkg=test-1&tkt=${encodeURIComponent(JSON.stringify(ticket))}&stay=${encodeURIComponent(JSON.stringify(stay))}`;
const prefill = parseTripLink(search);
check("the link is understood", Boolean(prefill));
check("the package id survives", prefill?.packageId === "test-1");
check("the ticket survives", prefill?.ticket?.mode === "bus" && prefill?.ticket?.priceToman === 1_200_000);
check("the room survives", prefill?.stay?.name === "هتل پارس" && prefill?.stay?.priceTotalToman === 3_000_000);
check("the dates survive", prefill?.departureDate === "2026-11-20" && prefill?.returnDate === "2026-11-22");
check("a broken ticket block is ignored, the route is not", parseTripLink(`?from=تهران&to=یزد&tkt=%7Bbroken`)?.destination === "یزد");
check("a ticket without a booking link is refused", parseTripLink(`?from=تهران&tkt=${encodeURIComponent(JSON.stringify({ ...ticket, bookingUrl: "javascript:alert(1)" }))}`)?.ticket === undefined);
check("an enormous payload is refused", parseTripLink(`?from=تهران&stay=${"a".repeat(4000)}`)?.stay === undefined);
check("an ordinary link still works", parseTripLink("?from=تهران&to=شیراز&date=2026-12-01")?.destination === "شیراز");

console.log("A room price is multiplied by people and nights, and it is visible");
const hotel = stayPrice({ priceTotalToman: 6_000_000, pricePerNightToman: 3_000_000, people: 2, nights: 2, kind: "hotel" });
check("per person per night is a third of the nightly total for two guests", hotel.perPersonPerNight === 1_500_000, String(hotel.perPersonPerNight));
check("the multiplication really adds up", hotel.perPersonPerNight * hotel.people * hotel.nights === hotel.total);
check("the sentence shows the whole arithmetic", hotel.formula.includes("×") && hotel.formula.includes("۲ نفر"));
check("provider totals that do not add up are flagged", stayPrice({ priceTotalToman: 10_000_000, pricePerNightToman: 3_000_000, people: 2, nights: 2 }).consistent === false);
const villa = stayPrice({ priceTotalToman: 8_000_000, pricePerNightToman: 4_000_000, people: 4, nights: 2, kind: "stay" });
check("a villa is priced per unit, not per person", villa.perUnit === true && villa.formula.includes("هر شب"));
check("one guest for one night is simply the nightly price", stayPrice({ priceTotalToman: 1_500_000, pricePerNightToman: 1_500_000, people: 1, nights: 1 }).perPersonPerNight === 1_500_000);

console.log("The car cost is believable again");
check("free petrol is 10,000 a litre", FUEL_OPTIONS.find((option) => option.id === "free")?.pricePerLiter === 10_000);
check("quota petrol is cheaper", FUEL_OPTIONS.find((option) => option.id === "quota")!.pricePerLiter < 10_000);
const benz = findCar("benz-e")!;
const pride = findCar("pride")!;
const expensive = computeCarTrip({ car: benz, roadDistanceKm: 600, roundTrip: true, days: 3, cityKmPerDay: 35, passengers: 2, fuelPricePerLiter: 10_000 });
const cheap = computeCarTrip({ car: pride, roadDistanceKm: 600, roundTrip: true, days: 3, cityKmPerDay: 35, passengers: 2, fuelPricePerLiter: 10_000 });
const wear = (cost: typeof expensive) => cost.lines.find((line) => line.id === "depreciation")!.amount;
check("a luxury car no longer costs tens of millions in wear", wear(expensive) / (expensive.totalKm || 1) <= MAX_DEPRECIATION_PER_KM + 1, String(wear(expensive)));
check("a 1,300 km trip by luxury car stays under 15 million", expensive.total < 15_000_000, String(expensive.total));
check("a Pride trip is cheaper than a luxury one", cheap.total < expensive.total);
check("the capped line says so", expensive.lines.find((line) => line.id === "depreciation")!.formula.includes("سقف"));
check("tolls follow the road distance", Math.round(computeCarTrip({ car: pride, roadDistanceKm: 900, roundTrip: false, days: 1, cityKmPerDay: 0, passengers: 1, fuelPricePerLiter: 10_000 }).lines.find((line) => line.id === "tolls")!.amount) === 900 * DEFAULT_TOLL_PER_KM);
check("no measured road means an openly incomplete total", computeCarTrip({ car: pride, roadDistanceKm: 0, roundTrip: true, days: 2, cityKmPerDay: 20, passengers: 1, fuelPricePerLiter: 10_000 }).missingDistance === true);

console.log("Refreshing the home page really brings something else");
const base = new Date("2026-11-15T10:00:00Z");
const todayCities = todaysPackageDestinations("تهران", 4, base, 0).map((entry) => entry.city);
const refreshedCities = todaysPackageDestinations("تهران", 4, base, 1).map((entry) => entry.city);
check("the list rotates when refreshed", todayCities.join("|") !== refreshedCities.join("|"));
const nextPress = todaysPackageDestinations("تهران", 4, base, 4).map((entry) => entry.city);
check("a second press shares no card with the first", nextPress.every((city) => !todayCities.includes(city)), nextPress.join("، "));
check("the traveller's own city is never a destination", !todayCities.includes("تهران") && !refreshedCities.includes("تهران"));
check("four distinct destinations each time", new Set(todayCities).size === 4 && new Set(refreshedCities).size === 4);

if (failures) {
  console.error(`\n❌ ${failures} بررسی شکست خورد`);
  process.exit(1);
}
console.log("\n✅ round 25: links, room maths, car costs and refresh all pass");
