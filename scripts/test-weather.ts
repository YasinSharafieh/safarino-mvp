/**
 * Weather must be honest: a forecast only inside the forecast window, a
 * long-term average otherwise, real advice, and a suggestion that never
 * pretends a rainy day is a good day for a park.
 */
import { tripWeather, dayScore, weatherAdvice, weatherLabel, outdoorWeight, suggestDayOrder, addDays } from "../lib/weather";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}
const today = new Date(Date.now() + 3.5 * 3_600_000).toISOString().slice(0, 10);

(async () => {
  console.log("Reading the sky");
  check("clear sky in Persian", weatherLabel(0).label === "آسمان صاف");
  check("unknown code does not break", weatherLabel(1234).label.length > 0);

  console.log("Scoring a day");
  const clear = dayScore({ code: 0, maxC: 22, minC: 12, rainProbability: 0, windKmh: 8 });
  const rainy = dayScore({ code: 65, maxC: 18, minC: 12, rainProbability: 90, windKmh: 20 });
  const hot = dayScore({ code: 0, maxC: 42, minC: 28, rainProbability: 0, windKmh: 5 });
  check("a clear mild day scores highest", clear > rainy && clear > hot, `${clear} / ${rainy} / ${hot}`);
  check("rain costs a lot", clear - rainy >= 50);
  check("extreme heat is penalised", clear - hot >= 25);

  console.log("Advice is practical and Persian");
  check("rain advice mentions an umbrella", weatherAdvice({ code: 61, maxC: 15, minC: 9, rainProbability: 80, windKmh: 10 }).advice.includes("چتر"));
  check("heat advice moves the visit away from noon", weatherAdvice({ code: 0, maxC: 40, minC: 26, rainProbability: 0, windKmh: 5 }).advice.includes("صبح"));
  check("clear day advice is positive", weatherAdvice({ code: 0, maxC: 21, minC: 11, rainProbability: 0, windKmh: 6 }).tone === "good");

  console.log("Outdoor weighting of places");
  check("a park is outdoor", outdoorWeight("پارک و بوستان") === 1);
  check("a museum is indoor", outdoorWeight("موزه") < 0.2);
  check("a shrine is mostly indoor", outdoorWeight("زیارتی و مسجد") < 0.3);

  console.log("Forecast window");
  const forecast = await tripWeather({ latitude: 36.29, longitude: 59.6, startDate: addDays(today, 2), days: 3 });
  check("near dates use the real forecast", forecast.mode === "forecast", forecast.mode);
  // If the forecast service is silent, the page must still show something
  // honest (the labelled multi-year average) instead of an empty strip.
  check("three days answered, forecast or clearly-labelled average", forecast.days.length === 3, `${forecast.mode} / ${forecast.days.length}`);
  check(
    "a silent forecast is never passed off as a forecast",
    forecast.days.length === 0 || (forecast.mode === "forecast" ? true : /میانگین|پیش‌بینی در دسترس نبود/.test(forecast.note)),
    forecast.mode,
  );
  check("each day has a real date", forecast.days.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date)));
  check("each day has a score and advice", forecast.days.every((day) => typeof day.score === "number" && day.advice.length > 10));
  check("note says it is a forecast", forecast.note.includes("پیش‌بینی"));

  const far = await tripWeather({ latitude: 36.29, longitude: 59.6, startDate: addDays(today, 60), days: 2 });
  check("far dates fall back to the long-term average", far.mode === "normals", far.mode);
  check("the fallback says it is not a forecast", far.note.includes("نه پیش‌بینی"));
  check("averages still come from real years", far.days.length === 2 && far.days.every((day) => day.maxC !== null));

  const noPoint = await tripWeather({ latitude: 0, longitude: 0, days: 2 });
  check("no coordinates means no invented weather", noPoint.days.length === 0);

  console.log("Suggestion: outdoor days on the clearest dates");
  const days = [
    { dayNumber: 1, categories: ["موزه"] },
    { dayNumber: 2, categories: ["پارک و بوستان"] },
  ];
  const weather = [
    { date: "2026-11-20", code: 65, label: "باران", icon: "🌧️", maxC: 16, minC: 10, rainProbability: 90, rainMm: 12, windKmh: 20, score: 10, advice: "چتر", tone: "warn" as const },
    { date: "2026-11-21", code: 0, label: "آسمان صاف", icon: "☀️", maxC: 21, minC: 11, rainProbability: 0, rainMm: 0, windKmh: 8, score: 95, advice: "خوب", tone: "good" as const },
  ];
  const suggestion = suggestDayOrder(days, weather);
  check("the park day is moved to the clear date", suggestion.order[0] === 2, suggestion.order.join("→"));
  check("the suggestion is explained in Persian", suggestion.reason.length > 20);
  check("no change is suggested when the order already fits", suggestDayOrder([...days].reverse(), weather).changed === false);

  if (failures) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nWeather tests passed.");
})();
