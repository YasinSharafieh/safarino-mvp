/**
 * «با صدات بگو» — what one spoken sentence is allowed to fill in.
 * Every case checks that the app reads only what was really said.
 */
import assert from "node:assert/strict";
import { findCities, mergeVoiceFields, parseBudget, parseCar, parseDeparture, parseVoiceTrip } from "../lib/voice-parse";

// 1) The sentence from the brief, word for word.
const brief = parseVoiceTrip("من ۱۰ میلیون تومن پول دارم، هفته دیگه با همسرم میخوام برم یزد، ماشینمون هم پژو ۲۰۶ هست.", new Date("2026-11-05T00:00:00Z"));
assert.equal(brief.destination, "یزد", "the destination is the city they said they are going to");
assert.equal(brief.budgetMillions, 10);
assert.equal(brief.travelers, 2, "«با همسرم» really means two people");
assert.equal(brief.mode, "car");
assert.equal(brief.carName, "پژو ۲۰۶ تیپ ۲");
assert.equal(brief.departureDate, "2026-11-12", "«هفته دیگه» is seven days from today");
assert.ok(brief.read.some((entry) => entry.field === "destination" && entry.value === "یزد"));
assert.ok(brief.confidence >= 0.6);
assert.deepEqual(brief.missing.sort(), ["مبدأ", "مدت سفر"].sort(), "the two things nobody said are asked for, not invented");

// 2) Origin and destination in one sentence are told apart.
const both = parseVoiceTrip("می‌خوام از تهران برم کاشان، دو نفریم، سه روز");
assert.equal(both.origin, "تهران");
assert.equal(both.destination, "کاشان");
assert.equal(both.days, 3);
assert.equal(both.travelers, 2);

// 3) Nothing that was not said is invented.
const quiet = parseVoiceTrip("می‌خوام یه سفر برم");
assert.equal(quiet.destination, null, "no city in the sentence means no city in the form");
assert.equal(quiet.budgetMillions, null);
assert.equal(quiet.days, null);
assert.equal(quiet.departureDate, null);
assert.ok(quiet.missing.includes("مقصد"));
assert.ok(quiet.missing.includes("بودجه"));

// 4) Persian number words, both spellings of «میلیون».
assert.equal(parseBudget("بودجه‌ام بیست و پنج میلیون تومان است"), 25);
assert.equal(parseBudget("حدود ۱۵ ملیون"), 15);
assert.equal(parseBudget("۱۲٬۰۰۰٬۰۰۰ تومان".replace(/٬/g, "")), 12);
assert.equal(parseBudget("هیچی نگفتم"), null);

// 5) A car name is only read when the catalogue really has it.
assert.equal(parseCar("با پراید می‌ریم"), "پراید ۱۳۱ / ۱۱۱");
assert.equal(parseCar("با ماشین می‌ریم"), null, "«ماشین» alone names no model");

// 6) Days and dates.
assert.equal(parseDeparture("فردا حرکت می‌کنیم", new Date("2026-11-05T00:00:00Z")), "2026-11-06");
assert.equal(parseDeparture("دو هفته دیگه", new Date("2026-11-05T00:00:00Z")), "2026-11-19");
assert.equal(parseDeparture("یه روزی می‌ریم", new Date("2026-11-05T00:00:00Z")), null);

// 7) Cities are only found as whole words.
const hits = findCities("مقام و مقدم و مستند").map((hit) => hit.name);
assert.equal(hits.includes("قم"), false, "«مقام» is not the city Qom");
assert.ok(findCities("بریم قم").some((hit) => hit.name === "قم"));

// 8) The model may only fill what is still empty, and only with valid values.
const filled = mergeVoiceFields(quiet, { destination: "شیراز", budgetMillions: 18, days: 4, travelers: 3, mode: "train", origin: "تهران" });
assert.equal(filled.destination, "شیراز");
assert.equal(filled.budgetMillions, 18);
assert.equal(filled.days, 4);
assert.equal(filled.mode, "train");
assert.deepEqual(filled.missing, []);

const hallucinated = mergeVoiceFields(quiet, { destination: "آتلانتیس", budgetMillions: 9000, days: 400, mode: "موشک" });
assert.equal(hallucinated.destination, null, "a city that does not exist is refused");
assert.equal(hallucinated.budgetMillions, null);
assert.equal(hallucinated.days, null);
assert.equal(hallucinated.mode, "");

// 9) A value the traveller really said always wins over the model's.
const both2 = mergeVoiceFields(both, { destination: "مشهد", origin: "تبریز", budgetMillions: 40 });
assert.equal(both2.destination, "کاشان", "the spoken city is never overwritten");
assert.equal(both2.origin, "تهران");
assert.equal(both2.budgetMillions, 40, "a field that was missing is filled");

console.log("Voice parsing tests passed.");
