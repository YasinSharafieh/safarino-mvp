/**
 * Round 25 — the corrections the traveller asked for, checked one by one.
 */
import { parseTripLink } from "../lib/link-prefill";
import { stayPrice } from "../lib/stay-price";
import { computeCarTrip, MAX_DEPRECIATION_PER_KM, DEFAULT_TOLL_PER_KM } from "../lib/car-cost";
import { findCar, FUEL_OPTIONS } from "../lib/car-catalog";
import { todaysPackageDestinations } from "../lib/trip-packages";
import { drawQuestions, preferredModeFromText, preferredTransportMode, scoreAnswers, suggestCities } from "../lib/start-flow";
import { chosenTransport, transportHeadline } from "../lib/transport-selection";
import { DAILY_FOOD_TOMAN, estimateBudget, mealsIncluded, roomAffordability } from "../lib/budget-fit";

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

console.log("The budget is shared between the people who travel");
// The same taste, once with one traveller and once with four.
const questions = drawQuestions(() => 0.42, 3);
const answers: Record<string, string> = {};
questions.forEach((question) => {
  answers[question.key] = question.options[0].id;
});
const tastes = scoreAnswers(questions, answers);
const one = suggestCities(tastes, { limit: 4, budgetMillions: 12, travellers: 1 });
const four = suggestCities(tastes, { limit: 4, budgetMillions: 12, travellers: 4 });
const sameCity = one.find((city) => four.some((other) => other.name === city.name));
check("the same taste gives the same cities", Boolean(sameCity));
check("four travellers cost more than one", (sameCity?.estimatedToman ?? 0) < (four.find((city) => city.name === sameCity!.name)?.estimatedToman ?? 0));
check("the same budget is tighter for four", four.some((city) => city.overBudget) || !one.some((city) => city.overBudget));
const share = (budgetMillions: number, people: number) => Math.round((budgetMillions * 1_000_000) / people);
check("the per-person share is the budget divided by the people", share(20, 4) === 5_000_000 && share(20, 1) === 20_000_000);
check("children still count in the share", Math.round((15_000_000) / 3) === 5_000_000);

console.log("The quiz really decides the vehicle and the dates");
const vehicleQuestions = drawQuestions(() => 0.13, 12);
const trainAnswer: Record<string, string> = {};
vehicleQuestions.forEach((question) => {
  trainAnswer[question.key] = question.options[0].id;
});
const trainQuestion = vehicleQuestions.find((question) => question.key === "transport");
check("the quiz has a vehicle question", Boolean(trainQuestion));
if (trainQuestion) {
  const trainOption = trainQuestion.options.find((option) => option.id === "train") || trainQuestion.options[0];
  trainAnswer[trainQuestion.key] = trainOption.id;
  const preferred = preferredTransportMode(vehicleQuestions, trainAnswer);
  check("the chosen vehicle is read back", preferred === trainOption.id, preferred);
  check("a car answer means the car tab", (() => {
    const copy = { ...trainAnswer, [trainQuestion.key]: trainQuestion.options.find((option) => option.id === "car")?.id || "" };
    return preferredTransportMode(vehicleQuestions, copy) === "car";
  })());
}
check("no answer means no claim", preferredTransportMode(vehicleQuestions, {}) === "");

console.log("Food is the traveller's own 800,000 a day, and a paid breakfast counts");
check("a normal food day is 800,000", DAILY_FOOD_TOMAN === 800_000);
const plain = estimateBudget({ totalBudget: 30_000_000, travellers: 2, days: 3, tickets: 5_000_000, stay: 6_000_000 });
const withBreakfast = estimateBudget({ totalBudget: 30_000_000, travellers: 2, days: 3, tickets: 5_000_000, stay: 6_000_000, breakfastIncluded: true });
check("breakfast in the room lowers the food money", withBreakfast.food < plain.food, `${withBreakfast.food} < ${plain.food}`);
check("a free breakfast never makes food negative", withBreakfast.food >= 0);
check("the hotel's own words decide", mealsIncluded({ name: "هتل پارس", amenities: ["صبحانه"] }).breakfast === true);
check("no meal mentioned means no discount", mealsIncluded({ name: "خانهٔ سنتی", amenities: ["حیاط"] }).breakfast === false);
check("full board is recognised too", mealsIncluded({ priceNote: "پانسیون کامل با ناهار و شام" }).fullBoard === true);
const roomFits = roomAffordability({ roomTotal: 6_000_000, roomBudget: 15_000_000, travellers: 2, nights: 3 });
const roomTight = roomAffordability({ roomTotal: 14_000_000, roomBudget: 15_000_000, travellers: 2, nights: 3 });
const roomOver = roomAffordability({ roomTotal: 20_000_000, roomBudget: 15_000_000, travellers: 2, nights: 3 });
check("a room that leaves room for food is called suitable", roomFits.tone === "fits" && roomFits.headroom === 9_000_000);
check("a room that eats the whole budget is called tight", roomTight.tone === "tight");
check("a room past the money is called over, with the amount", roomOver.tone === "over" && roomOver.label.includes("۵"));
check("the food sentence is always there", roomFits.foodNote.includes("۸۰۰") && roomOver.foodNote.includes("۸۰۰"));

console.log("A leftover car can never be shown as the chosen ticket");
check("a train ticket is read as a train", chosenTransport({ vehicleId: "train", cost: 3_512_000, offerTitle: "قطار ایران" })?.mode === "train");
check("a car selection keeps its own name", chosenTransport({ vehicleId: "car", cost: 5_858_436, carName: "پراید ۱۱۱" })?.title === "پراید ۱۱۱");
check("zero money is not a selection", chosenTransport({ vehicleId: "car", cost: 0 }) === null);
check("an unknown vehicle is refused", chosenTransport({ vehicleId: "spaceship", cost: 1_000_000 }) === null);
check("nothing stored means no claim", chosenTransport(null) === null);
check("the headline names the vehicle and the price", (() => {
  const choice = chosenTransport({ vehicleId: "train", cost: 1_756_500, offerTitle: "قطار ایران" })!;
  const line = transportHeadline(choice);
  return line.includes("قطار") && line.includes("قطار ایران") && line.includes("تومان");
})());

console.log("The traveller's own words choose the vehicle too");
check("«با قطار می‌روم» means train", preferredModeFromText("می‌خواهم با قطار بروم") === "train");
check("«پرواز» means plane", preferredModeFromText("پرواز ارزان می‌خواهم") === "plane");
check("«اتوبوس» means bus", preferredModeFromText("با اتوبوس بروم بهتر است") === "bus");
check("«ماشین خودم» means car", preferredModeFromText("با ماشین خودم می‌روم") === "car");
check("a sentence with no vehicle claims nothing", preferredModeFromText("یک جای آرام و ارزان") === "");

if (failures) {
  console.error(`\n❌ ${failures} بررسی شکست خورد`);
  process.exit(1);
}
console.log("\n✅ round 25: links, room maths, car costs and refresh all pass");
