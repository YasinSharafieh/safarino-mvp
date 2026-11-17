/**
 * Round 40 — the artihmetic the traveller actually needs, checked to the toman.
 *
 * Four promises are tested here, and each one is arithmetic rather than opinion:
 *
 *   1. `route-timing` says a day fits only when the measured legs and the real
 *      clock allow it, and names the exact pair that does not fit otherwise;
 *   2. `price-forecast` refuses to predict from a thin history, never leaves the
 *      believable band, and always says how much to trust its own line;
 *   3. `story-caption` writes captions from the trip's own numbers and throws a
 *      model sentence away when it invents one;
 *   4. `group-trip` splits real money into integer toman whose parts add back up
 *      to the whole, exactly — for every member count and every awkward amount.
 */

import { clockMinutes, faClock, faDuration, itineraryDayTiming, normalizeDigits, scheduleDayTiming, timingStatusLabel, tripTiming } from "../lib/route-timing";
import { forecastFrom, forecastGap } from "../lib/price-forecast";
import { trendFrom } from "../lib/price-watch";
import { acceptCaption, captionHashtags, captionVariants, fullCaption } from "../lib/story-caption";
import { defaultMembers, groupSummary, normalizeMembers, splitAmount, weightLabel } from "../lib/group-trip";

let failures = 0;
function check(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  fail ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("۴۰ — زمان‌سنجی واقعی، پیش‌بینی صادق، کپشن واقعی و سهم دقیق هر نفر");

// ── 1) The time audit ───────────────────────────────────────────────────────────

check("Persian clock digits are read", clockMinutes("۰۹:۳۰") === 570);
check("Arabic-Indic digits are read too", clockMinutes("٠٩:٠٥") === 545);
check("a non-clock is refused", clockMinutes("ساعت نه") === null);
check("the clock is written back in Persian", faClock(570) === "۰۹:۳۰");
check("a length of day is written in words", faDuration(155) === "۲ ساعت و ۳۵ دقیقه");
check("a short length skips the hours", faDuration(40) === "۴۰ دقیقه");
check("Persian digits normalise", normalizeDigits("۱۲۳") === "123");

const realisticDay = {
  day: 1,
  title: "روز اول",
  stops: [
    { startTime: "۰۹:۰۰", visitMinutes: 90, legMinutes: 10, place: { name: "حافظیه" } },
    { startTime: "۱۱:۰۰", visitMinutes: 60, legMinutes: 20, place: { name: "بازار وکیل" } },
    { startTime: "۱۳:۳۰", visitMinutes: 45, legMinutes: 15, place: { name: "مسجد نصیرالملک" } },
  ],
};

const okDay = itineraryDayTiming(realisticDay);
check("a measured day that fits says so", okDay.status === "ok", okDay.status);
check("the real end time is start + visits + measured drives + arrival room", okDay.endMinutes === 540 + 90 + 20 + 10 + 60 + 15 + 10 + 45, String(okDay.endMinutes));
check("the first leg is the transfer from the stay, not a leg of the day", okDay.measuredLegs === 2 && okDay.totalLegs === 2);
check("drive and visit minutes are kept apart", okDay.driveMinutes === 35 && okDay.visitMinutes === 195, `${okDay.driveMinutes}/${okDay.visitMinutes}`);
check("a good day has no invented conflict", okDay.conflicts.length === 0);
check("a day with nothing in it is called empty", itineraryDayTiming({ day: 3, stops: [] }).status === "empty");
check("the label of each status is Persian", timingStatusLabel("impossible") === "جا نمی‌شود");

const impossibleDay = {
  day: 2,
  stops: [
    { startTime: "۰۹:۰۰", visitMinutes: 60, legMinutes: 10, place: { name: "کاخ گلستان" } },
    // The plan leaves 10 minutes for a drive that really takes 75.
    { startTime: "۱۰:۱۰", visitMinutes: 60, legMinutes: 75, place: { name: "برج میلاد" } },
  ],
};
const broken = itineraryDayTiming(impossibleDay);
check("a day whose drive cannot fit is impossible", broken.status === "impossible", broken.status);
check("the exact pair that cannot fit is named", broken.conflicts[0]?.from === "کاخ گلستان" && broken.conflicts[0]?.to === "برج میلاد");
check("the conflict carries the real minutes", broken.conflicts[0]?.neededMinutes === 75 && broken.conflicts[0]?.availableMinutes === 10);
check("the traveller is told in words, not numbers only", broken.notes.some((note) => note.includes("برج میلاد")));

const unmeasured = itineraryDayTiming({
  day: 4,
  stops: [
    { startTime: "۰۹:۰۰", visitMinutes: 60, legMinutes: 10, place: { name: "الف" } },
    { startTime: "۱۱:۰۰", visitMinutes: 60, legMinutes: null, place: { name: "ب" } },
  ],
});
check("a day with an unmeasured leg is called an estimate", unmeasured.status === "estimated", unmeasured.status);
check("and the estimate is admitted in words", unmeasured.notes.some((note) => note.includes("اندازه‌گیری نشده")));

const longDay = itineraryDayTiming({
  day: 5,
  stops: [
    { startTime: "۰۹:۰۰", visitMinutes: 120, legMinutes: 10, place: { name: "الف" } },
    { startTime: "۱۲:۰۰", visitMinutes: 120, legMinutes: 90, place: { name: "ب" } },
    { startTime: "۱۵:۰۰", visitMinutes: 120, legMinutes: 90, place: { name: "ج" } },
    { startTime: "۱۸:۰۰", visitMinutes: 120, legMinutes: 90, place: { name: "د" } },
    { startTime: "۲۱:۰۰", visitMinutes: 120, legMinutes: 90, place: { name: "ه" } },
  ],
});
check("a day that runs past midnight is impossible", longDay.status === "impossible", `${longDay.status} / پایان ${faClock(longDay.endMinutes)}`);

const trip = tripTiming([okDay, broken, unmeasured]);
check("the trip summary counts the impossible days", trip.impossible === 1);
check("the summary speaks about the impossible day first", trip.headline.includes("جا نمی‌شود"), trip.headline);
check("the longest day is remembered", trip.longestDay !== null);

const schedule = scheduleDayTiming({
  day: 1,
  items: [
    { time: "۰۹:۰۰", title: "موزه", type: "sightseeing" },
    { time: "۰۹:۰۵", title: "کافه", type: "food" },
  ],
});
check("two items on the same minute are flagged", schedule.notes.some((note) => note.includes("هم‌زمان")), schedule.notes[0]);
check("a schedule day is never called measured", schedule.status === "tight" || schedule.status === "estimated", schedule.status);
check("an empty schedule day is empty", scheduleDayTiming({ day: 2, items: [] }).status === "empty");

// ── 2) The price forecast ───────────────────────────────────────────────────────

const now = new Date("2026-11-05T12:00:00.000Z");
const hoursAgo = (hours: number, priceToman: number) => ({
  at: new Date(now.getTime() - hours * 3_600_000).toISOString(),
  priceToman,
  offers: 3,
});

check("two readings are not a history", forecastFrom([hoursAgo(30, 5_000_000), hoursAgo(2, 4_900_000)], { now }) === null);
check("readings squeezed into one hour prove nothing", forecastFrom([hoursAgo(1, 5_000_000), hoursAgo(0.6, 5_100_000), hoursAgo(0.2, 5_200_000)], { now }) === null);
check("the missing-forecast reason is a sentence, not a blank", forecastGap([hoursAgo(1, 5_000_000)], { now }).includes("بار خواندن"));

const rising = [hoursAgo(72, 4_000_000), hoursAgo(48, 4_400_000), hoursAgo(24, 4_800_000), hoursAgo(1, 5_200_000)];
const up = forecastFrom(rising, { now, horizonDays: 7 });
check("a rising history forecasts a rise", Boolean(up) && up!.direction === "up", up ? `${up.deltaPct}٪` : "null");
check("the forecast keeps its confidence word", Boolean(up) && ["low", "medium", "high"].includes(up!.confidence));
check("the sentence says it is our own history", Boolean(up) && up!.message.includes("خواندن") && up!.message.includes("نه وعده"), up?.message);

const falling = [hoursAgo(72, 5_000_000), hoursAgo(48, 4_700_000), hoursAgo(24, 4_400_000), hoursAgo(1, 4_100_000)];
const down = forecastFrom(falling, { now });
check("a falling history forecasts a fall", Boolean(down) && down!.direction === "down");

const spike = [hoursAgo(60, 5_000_000), hoursAgo(30, 5_050_000), hoursAgo(1, 20_000_000)];
const clamped = forecastFrom(spike, { now, horizonDays: 14 });
check("a spike cannot explode the forecast", Boolean(clamped) && clamped!.predictedToman <= 20_000_000 * 1.35, clamped ? String(clamped.predictedToman) : "null");
check("a spike is not trusted", Boolean(clamped) && clamped!.confidence !== "high", clamped?.confidence);

const trend = trendFrom(rising);
check("the price card carries the forecast with the trend", Boolean(trend && trend.forecast), trend?.forecast?.direction);
check("one reading has no forecast at all", trendFrom([{ at: now.toISOString(), priceToman: 5_000_000, offers: 2 }])?.forecast === null);

// ── 3) The story caption ────────────────────────────────────────────────────────

const captionInput = {
  destination: "شیراز",
  origin: "تهران",
  days: 4,
  travellers: 3,
  totalToman: 18_500_000,
  budgetToman: 25_000_000,
  transportLabel: "قطار",
  stayName: "هتل زندیه",
  topPlaces: ["حافظیه", "بازار وکیل", "مسجد نصیرالملک"],
  km: 42,
  dateLabel: "۱۲ آبان",
};

const variants = captionVariants(captionInput);
check("three lengths of the same caption exist", variants.length === 3 && variants.every((variant) => variant.text.length > 5));
check("the short caption carries the real days and city", variants[0].text.includes("۴") && variants[0].text.includes("شیراز"));
check("the full caption carries the real budget", variants[2].text.includes("۲۵") && variants[2].text.includes("۱۸"), variants[2].text);
check("the real place names are used, invented ones are not", variants[1].text.includes("حافظیه") && !variants[1].text.includes("تخت جمشید"));
check("hashtags come from the trip only", captionHashtags(captionInput).includes("#شیراز") && captionHashtags(captionInput).includes("#سفرینو"));
check("no hashtag is empty or broken", captionHashtags(captionInput).every((tag) => tag.length > 1));
check("a pasted caption ends with its hashtags", fullCaption(variants[1], ["#سفرینو"]).trim().endsWith("#سفرینو"));

const invented = acceptCaption({ caption: "۴ روز در شیراز بودیم و ۹۹ میلیون تومان خرج کردیم، خیلی هم عالی بود و همه‌جا را دیدیم." }, captionInput);
check("a model caption with an invented number is refused", invented.source === "local", invented.caption.slice(0, 30));
const honest = acceptCaption({ caption: "چهار روز در شیراز بودیم و از حافظیه تا بازار وکیل را دیدیم." }, captionInput);
check("a caption with no invented number is accepted", honest.source === "ai");
check("too short an answer falls back to the local caption", acceptCaption({ caption: "شیراز" }, captionInput).source === "local");

// ── 4) The group split ─────────────────────────────────────────────────────────

const two = defaultMembers(2, 0);
check("the group starts from the real travellers", two.length === 2 && two.every((member) => member.weight === 2));
check("a child counts as half a share by default", defaultMembers(1, 1)[1].weight === 1);

const sumsExactly = (total: number, members: ReturnType<typeof defaultMembers>) => {
  const split = splitAmount(total, members);
  const sum = split.rows.reduce((inner, row) => inner + row.amount, 0);
  return { split, ok: sum === total && split.total === total };
};

const awkward = [
  1_000_000, 999_999, 7, 1, 12_345_678, 250_000_001,
];
let allExact = true;
for (const total of awkward) {
  for (const members of [defaultMembers(1, 0), defaultMembers(2, 0), defaultMembers(3, 2), defaultMembers(1, 3)]) {
    const { ok } = sumsExactly(total, members);
    if (!ok) {
      allExact = false;
      console.log(`     ↳ ${total} with ${members.length} members did not add up`);
    }
  }
}
check("the parts always add up to the whole, to the toman", allExact);

const three = splitAmount(10_000_000, defaultMembers(3, 0));
check("three adults get equal integer shares", three.rows.every((row) => row.amount === 3_333_333 || row.amount === 3_333_334));
check("the left-over toman is handed out, not lost", three.rows.reduce((sum, row) => sum + row.amount, 0) === 10_000_000);
check("shares are reported as percentages", Math.abs(three.rows.reduce((sum, row) => sum + row.sharePct, 0) - 100) < 0.2);

const family = splitAmount(9_000_000, defaultMembers(2, 2));
check("an adult pays twice a child", family.rows[0].amount === family.rows[2].amount * 2, `${family.rows[0].amount} vs ${family.rows[2].amount}`);

check("a zero amount splits into zeros, not into errors", splitAmount(0, two).rows.every((row) => row.amount === 0));
check("a negative amount never steals money", splitAmount(-5, two).rows.every((row) => row.amount === 0));
const messy = normalizeMembers([{ id: "x", name: "  علی  ", weight: 99 }, { id: "x", name: "تکراری", weight: 2 }, { id: "y", name: "", weight: 2 }]);
check("a stored group is cleaned: names trimmed, weights bounded, ids unique", messy.length === 1 && messy[0].weight === 6 && messy[0].name === "علی");
check("a weight has a Persian label", weightLabel(1).includes("کودک") && weightLabel(2).includes("بزرگسال"));

const summary = groupSummary({ budget: 20_000_000, planned: 17_000_000, spent: 6_000_000 }, defaultMembers(2, 0));
check("every member has a share of all three real numbers", summary.rows.every((row) => row.budgetShare > 0 && row.plannedShare > 0 && row.spentShare > 0));
check("the group's budget is not silently changed by the split", summary.totals.budget === 20_000_000 && summary.rows.reduce((sum, row) => sum + row.budgetShare, 0) === 20_000_000);
check("over-spending by one member is flagged", groupSummary({ budget: 1_000_000, spent: 4_000_000 }, defaultMembers(2, 0)).rows.some((row) => row.overShare));
check("the group card explains how the split was made", summary.notes.some((note) => note.includes("واحد وزن")));
check("the card admits it cannot say who owes whom", summary.notes.some((note) => note.includes("بدهکار")));

console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ round 40: the timing, the forecast, the caption and the group split all add up");
process.exit(failures ? 1 : 0);
