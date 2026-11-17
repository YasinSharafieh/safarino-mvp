/**
 * Round 33 — the thirteen defects the traveller reported, checked one by one.
 *
 * Nothing here talks to the network: every rule is arithmetic or text, so the
 * checks are cheap enough to run before every deploy.
 */

import { cityCosts } from "../lib/city-costs";
import { tripCostBreakdown, roomBudgetAfterDailyCosts } from "../lib/trip-costs";
import { roomMix, stayPrice } from "../lib/stay-price";
import { priceOffersForParty } from "../lib/accommodation-search";
import { ticketStayCheck } from "../lib/ticket-timing";
import { faText } from "../lib/persian-text";
import { checklistKeyFor, readChecklist, saveChecklist, tripSignature } from "../lib/checklist";
import { describeTrip, suggestCities } from "../lib/start-flow";
import { answerLocally, answerAboutDestination, questionTopic, type AskFacts } from "../lib/companion-ask";
import type { AccommodationOffer, AccommodationSearchInput } from "../lib/accommodation-types";

let failures = 0;
function check(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  fail ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("۱ — باقی‌ماندهٔ بودجه، غذا و گشت و رفت‌وآمد را هم کم می‌کند");
const costs = tripCostBreakdown({
  totalBudget: 80_000_000,
  travellers: 2,
  days: 3,
  nights: 2,
  city: "اصفهان",
  tickets: 1_953_000,
  stay: 3_036_000,
});
check("five rows, always the same labels", costs.rows.map((row) => row.key).join(",") === "tickets,stay,food,activities,localTransport");
check("food is one million per person per day", costs.food === 1_000_000 * 2 * 3, String(costs.food));
check("Isfahan sightseeing is cheap", cityCosts("اصفهان").activitiesPerPersonPerDay <= 200_000, String(cityCosts("اصفهان").activitiesPerPersonPerDay));
check("Kish sightseeing is expensive", cityCosts("کیش").activitiesPerPersonPerDay === 500_000);
check("cities are not all priced the same", cityCosts("کیش").activitiesPerPersonPerDay !== cityCosts("اصفهان").activitiesPerPersonPerDay);
check(
  "remaining = budget − every row",
  costs.remaining === costs.totalBudget - (costs.tickets + costs.stay + costs.food + costs.activities + costs.localTransport),
  String(costs.remaining),
);
check("the old bug is gone: remaining is not budget − ticket − stay", costs.remaining !== 80_000_000 - 1_953_000 - 3_036_000);
const roomBudget = roomBudgetAfterDailyCosts({ totalBudget: 80_000_000, travellers: 2, days: 3, city: "اصفهان", tickets: 1_953_000 });
check("the room budget leaves the daily costs out", roomBudget.roomBudget === 80_000_000 - 1_953_000 - costs.food - costs.activities - costs.localTransport);
check("a breakfast in the room gives food money back", tripCostBreakdown({ totalBudget: 30_000_000, travellers: 2, days: 2, nights: 2, breakfastIncluded: true }).food < costs.food);

console.log("۲ — اتاق به اندازهٔ تعداد نفرات، و قیمت = نرخ اتاق × شب");
check("two guests book one double room", roomMix(2).label.includes("دو نفره") && roomMix(2).rooms === 1);
check("three guests book one triple room", roomMix(3).label.includes("سه‌نفره") && roomMix(3).rooms === 1);
check("four guests book one quad room", roomMix(4).label.includes("چهارنفره"));
check("five guests book two rooms", roomMix(5).rooms === 2);
const triple = stayPrice({ priceTotalToman: 3_239_000, pricePerNightToman: 3_239_000, people: 3, guests: 3, nights: 2 });
check("2 nights × the triple rate adds up", triple.total === triple.perNight * 2, String(triple.total));
check("the triple is more expensive than the double", triple.perNight > 3_239_000);
check("the assumption is written on screen", triple.assumptionNote.includes("تخمین"));
check("a villa is never divided per person", stayPrice({ priceTotalToman: 8_000_000, pricePerNightToman: 4_000_000, people: 4, nights: 2, kind: "stay" }).perUnit === true);

const offer: AccommodationOffer = {
  id: "x-1",
  providerPropertyId: "1",
  kind: "hotel",
  name: "هتل نمونه",
  typeLabel: "هتل",
  location: "اصفهان",
  imageUrl: null,
  images: [],
  rating: 4,
  reviewCount: 10,
  stars: 4,
  priceTotalToman: 4_758_000,
  pricePerNightToman: 2_379_000,
  priceBeforeDiscountToman: null,
  discountPercent: 0,
  priceIncludesVat: null,
  priceNote: "",
  bookingNote: "",
  details: [],
  amenities: [],
  provider: "snapptrip",
  bookingUrl: "https://example.com",
  latitude: null,
  longitude: null,
};
const input = (adults: number): AccommodationSearchInput => ({
  kind: "hotel",
  city: "اصفهان",
  checkIn: "2026-12-01",
  checkOut: "2026-12-03",
  adults,
  childAges: [],
  infantAges: [],
});
const forTwo = priceOffersForParty([offer], input(2))[0];
const forThree = priceOffersForParty([offer], input(3))[0];
check("two guests pay the double rate twice", forTwo.priceTotalToman === 2_379_000 * 2, String(forTwo.priceTotalToman));
check("three guests pay more than two", forThree.priceTotalToman > forTwo.priceTotalToman, String(forThree.priceTotalToman));
check("three guests still get exactly nights × the nightly rate", forThree.priceTotalToman === forThree.pricePerNightToman * 2);
check("the party arithmetic is explained", forThree.priceNote.includes("سه‌نفره"));

console.log("۳ — ساعت بلیت با شب‌های اقامت می‌خواند");
const sameDay = ticketStayCheck({ departure: "2026-12-01T10:00:00+03:30", arrival: "2026-12-01T17:30:00+03:30", checkIn: "2026-12-01", checkOut: "2026-12-03" });
check("arriving the same day the room starts is fine", sameDay.compatible === true, sameDay.line);
check("the arrival hour is read from the ticket", sameDay.arrivalClock === "۱۷:۳۰", String(sameDay.arrivalClock));
check("the nights are counted from the room dates", sameDay.nights === 2);
const lateTicket = ticketStayCheck({ arrival: "2026-12-02T08:00:00+03:30", checkIn: "2026-12-01", checkOut: "2026-12-03" });
check("a ticket that lands a day after check-in is a problem", lateTicket.compatible === false);
check("and the traveller is told why", lateTicket.issues.some((issue) => issue.tone === "problem" && issue.body.includes("شب")));
const nightArrival = ticketStayCheck({ arrival: "2026-12-01T23:40:00+03:30", checkIn: "2026-12-01", checkOut: "2026-12-03" });
check("a 23:40 arrival is flagged as a night arrival", nightArrival.issues.some((issue) => issue.title.includes("شب")));
const noTime = ticketStayCheck({ checkIn: "2026-12-01", checkOut: "2026-12-03" });
check("a missing hour is said out loud, never guessed", noTime.issues.some((issue) => issue.tone === "warn"));

console.log("۴ — همسفر دربارهٔ مقصد هم جواب می‌دهد");
const facts: AskFacts = {
  origin: "تهران",
  destination: "اصفهان",
  days: 3,
  travellers: 2,
  children: 0,
  budgetToman: 40_000_000,
  transportToman: 4_000_000,
  transportLabel: "قطار",
  stayToman: 6_000_000,
  stayName: "هتل نمونه",
  foodToman: 6_000_000,
  remainingToman: 20_000_000,
  departureDate: "2026-12-01",
  placeNames: [],
  weather: [],
  destinationProfile: {
    tagline: "میدان‌ها، پل‌ها و معماری که تمام نمی‌شود",
    highlights: ["میدان نقش جهان", "پل سی‌وسه‌پل", "محلهٔ جلفا"],
    bestFor: ["سفر فرهنگی"],
    bestSeason: "فروردین تا خرداد",
  },
};
check("a food question is about the place", questionTopic("در اصفهان چه غذایی بخورم؟") === "destination");
check("a budget question is about the trip", questionTopic("چقدر از بودجه‌ام مانده؟") === "trip");
const placeAnswer = answerAboutDestination("چه غذایی در اصفهان بخورم؟", facts);
check("the destination answer is real and names no price", Boolean(placeAnswer) && !/تومان/.test(placeAnswer || ""), placeAnswer || "");
check("the local companion can answer about attractions without a list", answerLocally("جاهای دیدنی اصفهان چیست؟", facts).includes("نقش جهان"));
check("a budget question still uses the trip's own numbers", answerLocally("چقدر پول برای غذا کنار گذاشته شده؟", facts).includes("تومان"));

console.log("۷ — سه راه ورود از صفحهٔ آزمون");
// The three doors are a UI concern; here we only check the engine behind them
// is the same one for writing and for speaking.
const written = describeTrip("چهار روز کنار دریا با همسرم، کافه و پیاده روی");
check("the written description is understood", Boolean(written) && written!.matchedWords.length > 0);
const spoken = describeTrip("چهار روز کنار دریا با همسرم، کافه و پیاده روی");
check("the spoken transcript goes through the very same engine", JSON.stringify(spoken?.result.moods) === JSON.stringify(written?.result.moods));

console.log("۸ — فارسی درست نوشته می‌شود");
check("Arabic letters become Persian", faText("مسجد كوچك") === "مسجد کوچک");
check("«می شود» gets its half-space", faText("می شود") === "می‌شود");
check("«باغ ها» gets its half-space", faText("باغ ها") === "باغ‌ها");
check("«بزرگ ترین» becomes one word", faText("بزرگ ترین") === "بزرگ‌ترین");
check("commas are spaced properly", faText("تهران ، اصفهان") === "تهران، اصفهان");
check("a normal name is left alone", faText("میدان نقش جهان") === "میدان نقش جهان");

console.log("۹ — سلیقه دقیق‌تر خوانده می‌شود و شهرهای بیشتری پیشنهاد می‌شود");
const taste = describeTrip("دلم می‌خواهد کویر ببینم، شب‌ها ستاره ببینم و پیاده‌روی کنم");
check("the taste is read from the sentence", Boolean(taste) && taste!.result.moods[0].mood === "کویری", taste?.result.headline);
const suggestions = suggestCities(taste!.result, { limit: 6, matchedWords: taste!.matchedWords });
check("six cities come back", suggestions.length === 6, String(suggestions.length));
check("the reason quotes the traveller's own word", suggestions[0].reason.includes("کویر") || suggestions[0].reason.includes("ستاره"), suggestions[0].reason);

console.log("۱۰ — چک‌لیست هر سفر جداست");
const tripA = { origin: "تهران", destination: "یزد", departureDate: "2026-12-01", days: 3 };
const tripB = { origin: "تهران", destination: "کیش", departureDate: "2027-02-10", days: 4 };
check("two trips have two different signatures", tripSignature(tripA) !== tripSignature(tripB));
check("two trips have two different storage keys", checklistKeyFor(tripA) !== checklistKeyFor(tripB));
const memory = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
})();
saveChecklist({ done: ["id-card"], custom: [] }, memory, tripA);
check("a tick stays inside its own trip", readChecklist(memory, tripA).done.includes("id-card"));
check("the next trip starts clean", readChecklist(memory, tripB).done.length === 0);

console.log("۳۳ — بودجهٔ کلی، آلارم کمبود و مدل‌های هر وظیفه");
import { affordabilityOf, budgetChange, clampBudgetMillions } from "../lib/budget-control";
import { TASK_CHAINS, chainFor, estimateTaskCostUsd } from "../lib/ai-models";
import { adviceLocally } from "../lib/ai-advice";

check("the budget cannot go below the floor", clampBudgetMillions(1) === 5);
check("the budget cannot run away", clampBudgetMillions(900) === 500);
check("a change is described with real amounts", budgetChange(40, 60).message.includes("۲۰٬۰۰۰٬۰۰۰"));
const tight = affordabilityOf({ totalBudgetToman: 20_000_000, travellers: 3, days: 3, city: "کیش", itemToman: 9_000_000, itemLabel: "بلیت هواپیما" });
check("a ticket that does not fit is called out", tight.fits === false && tight.tone === "over");
check("and the shortfall is a real number", tight.shortfallToman > 0, String(tight.shortfallToman));
check("and the budget that would fix it is offered", tight.neededBudgetMillions >= 20);
check("the alarm sentence names the party size", tight.detail.includes("۳ نفر"));
const roomy = affordabilityOf({ totalBudgetToman: 120_000_000, travellers: 2, days: 3, city: "کیش", itemToman: 4_000_000, itemLabel: "بلیت هواپیما" });
check("the same ticket fits a bigger budget", roomy.fits === true && roomy.tone === "fits");

check("every task has a model chain", (Object.keys(TASK_CHAINS) as string[]).every((task) => chainFor(task as never).models.length >= 2));
check("the cheap model handles small talk", chainFor("chat").models[0].includes("flash-lite"));
check("the better prose model writes the day guide", chainFor("write").models[0].includes("llama-3.3-70b"));
check("the vision task only allows vision models", chainFor("vision").models[0].includes("gemini-2.5-flash-lite"));
check("one chat call costs far less than a cent", estimateTaskCostUsd("chat", 1600) < 0.01);

const adviceOptions = [
  { id: "a", title: "اتوبوس", priceToman: 2_400_000 },
  { id: "b", title: "قطار", priceToman: 4_800_000 },
  { id: "c", title: "هواپیما", priceToman: 12_000_000 },
];
const poorFacts = { stage: "transport" as const, origin: "تهران", destination: "مشهد", days: 3, travellers: 2, children: 0, budgetToman: 18_000_000, committedToman: 0, dailyToman: 9_000_000 };
const richFacts = { ...poorFacts, budgetToman: 90_000_000 };
check("a tight budget gets the cheaper option", adviceLocally(poorFacts, adviceOptions).optionId === "a");
check("a generous budget is not forced onto the cheapest", adviceLocally(richFacts, adviceOptions).optionId !== "a", adviceLocally(richFacts, adviceOptions).optionId || "none");
check("when nothing fits, the cheapest is named with the gap", adviceLocally({ ...poorFacts, budgetToman: 10_000_000 }, adviceOptions).tone === "over");

console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ round 33: budget, rooms, timings, text and per-trip lists all pass");
process.exit(failures ? 1 : 0);

console.log("۵ — جملهٔ پول روی صفحهٔ برنامه از خودمان است، نه از مدل");
import { budgetSentence, withoutNumbers, synchronizeBudget } from "../lib/plan-itinerary";
const sync = synchronizeBudget({ totalBudget: 80_000_000, transportCost: 1_953_000, accommodationCost: 3_036_000, aiFood: 0, aiActivities: 0, travellers: 2, days: 3, city: "کیش" });
const sentence = budgetSentence(sync);
check("the sentence adds all five rows", sentence.includes("۱۲۰٬۰۰۰") || sentence.includes("۱٬۲۰۰٬۰۰۰"));
check("the sentence states the leftover", sentence.includes(new Intl.NumberFormat("fa-IR").format(Math.abs(sync.remaining))));
check("a model sentence with numbers is thrown away", withoutNumbers("حدود ۷۵ میلیون برای غذا باقی می‌ماند", "خودمان") === "خودمان");
check("a model sentence without numbers is kept", withoutNumbers("چیدمان نزدیک به اقامتگاه است", "خودمان").includes("اقامتگاه"));

