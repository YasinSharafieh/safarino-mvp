/**
 * The «travel coach» engines: the archetype, the budget gauge, the smart
 * packing list and the companion's rule engine.
 *
 * The point of every check here is the same: the app may only say what its own
 * real numbers say, and it must react differently when they change.
 */
import assert from "node:assert/strict";
import { readArchetype } from "../lib/archetype";
import { budgetGauge } from "../lib/budget-gauge";
import { companionTips, daysToDeparture } from "../lib/companion";
import { smartPacking } from "../lib/packing";
import type { WeatherDay } from "../lib/weather";

function day(partial: Partial<WeatherDay>): WeatherDay {
  return {
    date: "2026-11-10",
    code: 0,
    label: "آسمان صاف",
    icon: "☀️",
    maxC: 22,
    minC: 12,
    rainProbability: 5,
    rainMm: 0,
    windKmh: 10,
    score: 80,
    advice: "",
    tone: "good",
    ...partial,
  };
}

/* ------------------------------------------------------------ archetype */

const family = readArchetype({ moods: ["شهری", "تاریخی"], budgetMillions: 12, people: 4, days: 3, children: 2, mode: "car" });
assert.equal(family.id, "family-planner", "children move the archetype to the family one");
assert.ok(family.why.some((line) => line.includes("بچه")), "the reason names the children");
assert.ok(family.why.some((line) => line.includes("میلیون")), "the reason quotes the real budget");

const historian = readArchetype({ moods: ["تاریخی", "تاریخی", "زیارتی"], budgetMillions: 20, people: 2, days: 4, mode: "train" });
assert.equal(historian.id, "history-keeper");
assert.equal(historian.band, "balanced");
assert.ok(historian.runnerUp, "a second type is offered, so nobody feels boxed in");

const luxury = readArchetype({ moods: ["کویری", "طبیعت"], budgetMillions: 90, people: 2, days: 3, mode: "plane" });
assert.equal(luxury.band, "premium");
assert.equal(luxury.id, "luxury-explorer");

const saver = readArchetype({ moods: ["شهری"], budgetMillions: 4, people: 3, days: 4, mode: "bus" });
assert.equal(saver.band, "economy", "4 million for three people and four days is an economy trip");
assert.ok(saver.tips.length > 0);

// The same trip always gives the same type — it is arithmetic, not a horoscope.
assert.deepEqual(readArchetype({ moods: ["تاریخی"], budgetMillions: 15, people: 2, days: 3 }), readArchetype({ moods: ["تاریخی"], budgetMillions: 15, people: 2, days: 3 }));

/* ---------------------------------------------------------------- gauge */

const calm = budgetGauge({ totalMillions: 20, transportToman: 2_000_000, accommodationToman: 4_000_000, travellers: 2, days: 3 });
assert.equal(calm.zone, "calm");
assert.ok(calm.usedPct > 0 && calm.usedPct < 85);
assert.ok(calm.remainingToman > 0);
assert.ok(calm.needlePct <= 100);

const over = budgetGauge({ totalMillions: 10, transportToman: 3_000_000, accommodationToman: 12_000_000, travellers: 2, days: 3 });
assert.equal(over.zone, "over", "a stay bigger than the budget is over the line");
assert.ok(over.remainingToman < 0);
assert.equal(over.needlePct, 100, "the needle never points past the dial");

const saved = budgetGauge({
  totalMillions: 10,
  transportToman: 3_000_000,
  accommodationToman: 12_000_000,
  travellers: 2,
  days: 3,
  cheaperAlternative: { mode: "bus", priceToman: 800_000 },
});
assert.ok(saved.hint.includes("اتوبوس"), "the hint names the real cheaper option");
assert.ok(saved.hint.includes("تومان"), "and says how much it saves");

// The gauge and the rest of the app use one arithmetic: food for everyone.
assert.equal(calm.foodToman, 800_000 * 2 * 3);

/* -------------------------------------------------------------- packing */

const rainy = smartPacking({ destination: "رشت", days: 3, weatherMode: "forecast", month: 11, weather: [day({ code: 63, rainProbability: 85 }), day({ code: 61, rainProbability: 70 }), day({})] });
assert.ok(rainy.items.some((item) => item.id === "pack-umbrella"), "rain in the forecast puts an umbrella in the bag");
assert.ok(rainy.items.find((item) => item.id === "pack-umbrella")!.reason.includes("۲"), "the reason counts the rainy days");
assert.ok(rainy.basis.includes("Open-Meteo"));

const coldCar = smartPacking({ destination: "همدان", days: 2, weatherMode: "forecast", mode: "car", month: 1, weather: [day({ code: 73, minC: -4, maxC: 2 })] });
assert.ok(coldCar.items.some((item) => item.id === "pack-chains"), "snow and a car means tyre chains");
assert.ok(coldCar.items.some((item) => item.id === "pack-car-docs"));

const hotDay = smartPacking({ destination: "یزد", days: 2, weatherMode: "forecast", month: 7, weather: [day({ code: 0, minC: 26, maxC: 41 })] });
assert.ok(hotDay.items.some((item) => item.id === "pack-sun"));
assert.ok(!hotDay.items.some((item) => item.id === "pack-umbrella"), "a dry trip does not get an umbrella");

const noWeather = smartPacking({ destination: "کیش", days: 2, weatherMode: "none", month: 7, weather: [] });
assert.ok(noWeather.basis.includes("در دسترس نبود"), "no forecast is admitted, not faked");
assert.ok(noWeather.items.some((item) => item.id === "pack-season-hot"), "the season still gives useful advice");

const withKids = smartPacking({ destination: "اصفهان", days: 3, weatherMode: "forecast", children: 2, weather: [day({})] });
assert.ok(withKids.items.some((item) => item.id === "pack-kids-meds"));

/* ------------------------------------------------------------ companion */

// Nothing at all known yet: the orb still has something useful to say.
const empty = companionTips({ budgetMillions: 15, days: 3, travellers: 2 });
assert.equal(empty.length, 1);
assert.equal(empty[0].id, "start");

const overspent = companionTips({ budgetMillions: 8, days: 3, travellers: 2, transportToman: 2_000_000, stayToman: 9_000_000, mode: "car", distanceKm: 620 });
const ids = overspent.map((tip) => tip.id);
assert.equal(ids[0], "budget-over", "the loudest problem speaks first");
assert.ok(ids.includes("mode-car"), "the chosen vehicle is acknowledged");
assert.ok(overspent[0].body.includes("تومان"));

const soon = companionTips({ budgetMillions: 20, days: 3, travellers: 2, transportToman: 1_000_000, stayToman: 2_000_000, departureDate: "2026-11-07", todayIso: "2026-11-05" });
assert.ok(soon.some((tip) => tip.id === "departure-soon"));
assert.equal(daysToDeparture("2026-11-07", "2026-11-05"), 2);
assert.equal(daysToDeparture("", "2026-11-05"), null);

const stormy = companionTips({
  budgetMillions: 25,
  days: 3,
  travellers: 2,
  transportToman: 1_000_000,
  stayToman: 2_000_000,
  mode: "car",
  weather: [{ code: 73, minC: -3, maxC: 1, rainProbability: 80 }],
});
assert.ok(stormy.some((tip) => tip.id === "weather-snow"));
assert.ok(stormy.some((tip) => tip.id === "weather-car-cold"), "snow plus a car adds a road warning");

// The same trip with no weather never claims anything about the weather.
const noWeatherTips = companionTips({ budgetMillions: 25, days: 3, travellers: 2, transportToman: 1_000_000, stayToman: 2_000_000, mode: "car", weather: [] });
assert.ok(!noWeatherTips.some((tip) => tip.id.startsWith("weather-")), "no forecast, no weather claims");

// A tip never repeats itself.
const unique = new Set(overspent.map((tip) => tip.id));
assert.equal(unique.size, overspent.length);

console.log("Travel coach tests passed.");
