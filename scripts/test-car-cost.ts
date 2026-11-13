/**
 * The car catalogue and the car cost model.
 *
 * The promise to the traveller is that every toman in the car bill comes from a
 * formula they can read and change. These checks fix the arithmetic, the search
 * behaviour of the car picker, and the honesty rules (an unknown distance never
 * turns into a fake total).
 */

import { CARS, DEFAULT_CAR_ID, FUEL_OPTIONS, findCar, searchCars } from "../lib/car-catalog";
import { DEFAULT_CITY_KM_PER_DAY, computeCarTrip, tripSplit } from "../lib/car-cost";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}
const near = (a: number, b: number) => Math.abs(a - b) <= 1;

console.log("The car catalogue is complete and usable");
check("there are enough cars to choose from", CARS.length >= 30, String(CARS.length));
check("ids are unique", new Set(CARS.map((car) => car.id)).size === CARS.length);
check("names are unique", new Set(CARS.map((car) => car.name)).size === CARS.length);
check(
  "consumption is a real figure",
  CARS.every((car) => car.consumption >= 4 && car.consumption <= 20),
  CARS.filter((car) => car.consumption < 4 || car.consumption > 20).map((car) => car.name).join(", "),
);
check("every car has a value", CARS.every((car) => car.valueToman >= 100_000_000));
check("every car has a useful life", CARS.every((car) => car.lifeKm >= 200_000 && car.lifeKm <= 500_000));
check("every car has a service cost", CARS.every((car) => car.servicePerKm > 0));
check("every car states its segment", CARS.every((car) => ["اقتصادی", "متوسط", "شاسی‌بلند", "لوکس", "وانت و ون"].includes(car.segment)));
check("the default car exists", Boolean(findCar(DEFAULT_CAR_ID)));

console.log("The car picker searches the way a Persian user types");
check("پژو ۲۰۶ is found by «۲۰۶»", searchCars("۲۰۶").some((car) => car.name.includes("۲۰۶")));
check("تیگو is found by «تیگو»", searchCars("تیگو").some((car) => car.name.includes("تیگو")));
check("Arabic yeh and kaf are tolerated", searchCars("كوييك").some((car) => car.id === "quick"));
check("Latin digits work too", searchCars("206").some((car) => car.id === "peugeot-206"));
check("a segment word filters the list", searchCars("شاسی").every((car) => car.segment === "شاسی‌بلند"));
check("an unknown name returns nothing", searchCars("هواپیما").length === 0);
check("an empty search returns everything", searchCars("").length === CARS.length);
check("spaces are trimmed", searchCars("   ").length === CARS.length);

console.log("Fuel options are the prices on the pump");
check("two real prices plus a custom one", FUEL_OPTIONS.length === 3);
check("the quota price is 1,500", FUEL_OPTIONS[0].pricePerLiter === 1_500);
check("the free price is 3,000", FUEL_OPTIONS[1].pricePerLiter === 3_000);

console.log("The car bill adds up");
const testCar = {
  id: "test",
  name: "تست",
  detail: "تست",
  segment: "متوسط" as const,
  consumption: 10,
  valueToman: 300_000_000,
  lifeKm: 300_000,
  servicePerKm: 500,
};
const base = computeCarTrip({
  car: testCar,
  roadDistanceKm: 100,
  roundTrip: false,
  days: 1,
  cityKmPerDay: 0,
  passengers: 2,
  fuelPricePerLiter: 3_000,
  tollPerKm: 100,
  parkingPerDay: 50_000,
});
const line = (id: string) => base.lines.find((row) => row.id === id)?.amount ?? -1;
check("fuel = 100km / 100 × 10L × 3,000", near(line("fuel"), 30_000), String(line("fuel")));
check("depreciation = 300m / 300,000km × 100km", near(line("depreciation"), 100_000), String(line("depreciation")));
check("service = 500 × 100km", near(line("service"), 50_000), String(line("service")));
check("tolls = 100 × 100km", near(line("tolls"), 10_000), String(line("tolls")));
check("parking = 1 day × 50,000", near(line("parking"), 50_000), String(line("parking")));
check("total is the sum of the lines", near(base.total, 240_000), String(base.total));
check("per passenger halves it", near(base.perPassenger, 120_000), String(base.perPassenger));
check("per kilometre is total / km", near(base.perKm, 2_400), String(base.perKm));
check("ten litres are reported", near(base.litres, 10), String(base.litres));

const roundTripCost = computeCarTrip({
  car: testCar,
  roadDistanceKm: 100,
  roundTrip: true,
  days: 1,
  cityKmPerDay: 0,
  passengers: 2,
  fuelPricePerLiter: 3_000,
  tollPerKm: 100,
  parkingPerDay: 50_000,
});
check("a return trip doubles the intercity kilometres", near(roundTripCost.intercityKm, 200), String(roundTripCost.intercityKm));
check("and doubles fuel, not parking", near(roundTripCost.total, 30_000 * 2 + 100_000 * 2 + 50_000 * 2 + 10_000 * 2 + 50_000), String(roundTripCost.total));
check("parking stays per day", near(roundTripCost.lines.find((row) => row.id === "parking")!.amount, 50_000));

const cityCost = computeCarTrip({
  car: testCar,
  roadDistanceKm: 100,
  roundTrip: false,
  days: 4,
  cityKmPerDay: 10,
  passengers: 1,
  fuelPricePerLiter: 3_000,
  tollPerKm: 100,
  parkingPerDay: 0,
});
check("city driving is added to the kilometres", near(cityCost.totalKm, 140), String(cityCost.totalKm));
check("city kilometres never pay tolls", near(cityCost.lines.find((row) => row.id === "tolls")!.amount, 10_000));
check("city driving burns fuel too", near(cityCost.lines.find((row) => row.id === "fuel")!.amount, 42_000));

const unknown = computeCarTrip({
  car: testCar,
  roadDistanceKm: 0,
  roundTrip: false,
  days: 2,
  cityKmPerDay: DEFAULT_CITY_KM_PER_DAY,
  passengers: 2,
  fuelPricePerLiter: 3_000,
});
check("an unknown distance is declared, not invented", unknown.missingDistance === true);
check("and the intercity part is zero", unknown.intercityKm === 0);
check("but the city part is still shown", unknown.cityKm === DEFAULT_CITY_KM_PER_DAY * 2);

const split = tripSplit(base);
check("the split adds up to one hundred", split.intercity + split.city === 100, `${split.intercity}/${split.city}`);
check("every line says it is a calculation", base.lines.every((row) => row.source === "estimate"));
check("every line shows its formula", base.lines.every((row) => row.formula.length > 10));

const freeFuel = computeCarTrip({
  car: testCar,
  roadDistanceKm: 100,
  roundTrip: false,
  days: 1,
  cityKmPerDay: 0,
  passengers: 1,
  fuelPricePerLiter: 1_500,
});
const paidFuel = computeCarTrip({
  car: testCar,
  roadDistanceKm: 100,
  roundTrip: false,
  days: 1,
  cityKmPerDay: 0,
  passengers: 1,
  fuelPricePerLiter: 3_000,
});
check("halving the fuel price halves the fuel line", near(freeFuel.lines[0].amount * 2, paidFuel.lines[0].amount));

const edited = computeCarTrip({
  car: testCar,
  roadDistanceKm: 100,
  roundTrip: false,
  days: 1,
  cityKmPerDay: 0,
  passengers: 1,
  fuelPricePerLiter: 3_000,
  valueToman: 600_000_000,
});
check("editing the car value changes depreciation", near(edited.lines[1].amount, 200_000), String(edited.lines[1].amount));

const manyPassengers = computeCarTrip({
  car: testCar,
  roadDistanceKm: 100,
  roundTrip: false,
  days: 1,
  cityKmPerDay: 0,
  passengers: 4,
  fuelPricePerLiter: 3_000,
  tollPerKm: 100,
  parkingPerDay: 50_000,
});
const onePassenger = computeCarTrip({
  car: testCar,
  roadDistanceKm: 100,
  roundTrip: false,
  days: 1,
  cityKmPerDay: 0,
  passengers: 1,
  fuelPricePerLiter: 3_000,
  tollPerKm: 100,
  parkingPerDay: 50_000,
});
check("the car total does not change with passengers", near(manyPassengers.total, onePassenger.total), `${manyPassengers.total} vs ${onePassenger.total}`);
check("only the share per passenger does", near(manyPassengers.perPassenger, Math.round(onePassenger.total / 4)), String(manyPassengers.perPassenger));

if (failures) {
  console.error(`\n❌ ${failures} check(s) failed`);
  process.exit(1);
}
console.log("✅ car catalogue and cost model tests passed");
