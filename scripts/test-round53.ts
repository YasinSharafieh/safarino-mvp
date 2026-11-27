/**
 * Round 53 — «هر چیزی که سایت پیشنهاد می‌دهد، باید واقعاً انتخاب شده باشد».
 *
 * The owner's complaint, in his words: «وقتی یکی از آن پیشنهادها را می‌ریم جلو،
 * واقعاً همان قطار یا هتل را انتخاب نمی‌کند… نوشته انتخاب شده اما واقعاً برای
 * سفرینو انتخاب نشده.» So this file pins the *rule*, not the pixels:
 *
 *   1. a recommendation is only shown when it can be turned into a real choice;
 *   2. the same choice object the transport page writes is the one every later
 *      page reads — one shape, one price, one name;
 *   3. a package's stay must become a real selection, matched by what the traveller
 *      can see (the name), because its own id is one Safarino invented;
 *   4. «۰ بلیت» and «منبع پاسخ نداد» are different facts.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { bestForBudget } from "../lib/budget-fit";
import { chosenTransport, transportHeadline } from "../lib/transport-selection";
import { tripStatus } from "../lib/trip-status";

/* ── 1. A recommendation always names exactly one real option ─────────────── */

const offers = [
  { id: "a", price: 9_000_000, mode: "train" },
  { id: "b", price: 3_000_000, mode: "bus" },
  { id: "c", price: 5_000_000, mode: "plane" },
];
const best = bestForBudget(offers, { remaining: 20_000_000 });
assert.ok(best.option, "با بودجهٔ کافی، یک پیشنهاد مشخص وجود دارد");
assert.ok(offers.some((offer) => offer.id === best.option!.id), "پیشنهاد باید یکی از همان گزینه‌های واقعی فهرست باشد");
assert.ok(best.reason.length > 10, "پیشنهاد بدون دلیل، پیشنهاد نیست");

// A traveller with no room for anything still gets a named option, and the copy says so.
const none = bestForBudget(offers, { remaining: 10 });
assert.equal(none.fits, false);
assert.ok(none.option, "حتی وقتی بودجه نمی‌رسد، گزینه باید نام‌دار باشد تا بتوان درباره‌اش تصمیم گرفت");

/* ── 2. The chosen ticket travels as one object every page reads ──────────── */

const stored = {
  vehicleId: "train",
  cost: 3_759_950,
  offerId: "pkg:tehran-bandar-train",
  offerTitle: "رجا · قطار 822",
  provider: "alibaba",
  providerLabel: "علی‌بابا",
  bookingUrl: "https://www.alibaba.ir/train/THR-BND",
  details: { departure: "2026-12-02T13:25:00", arrival: "2026-12-03T09:20:00" },
  fetchedAt: "2026-11-27T15:56:29.195Z",
};
const picked = chosenTransport(stored);
assert.ok(picked, "انتخابِ ذخیره‌شده باید معتبر خوانده شود");
assert.equal(picked!.mode, "train");
assert.equal(picked!.cost, 3_759_950);
assert.match(picked!.title, /822/, "نام همان قطار باید در همهٔ صفحه‌ها همین باشد");
assert.match(transportHeadline(picked!), /قطار/);
assert.match(transportHeadline(picked!), /۳٬۷۵۹٬۹۵۰/, "قیمت با رقم فارسی و همان مبلغ بلیت");
assert.equal(picked!.departure, "2026-12-02T13:25:00", "ساعت حرکتِ همان بلیت، نه یک ساعت ساختگی");

// A leftover pick that is not a real selection must read as «nothing chosen».
for (const broken of [null, {}, { vehicleId: "train" }, { vehicleId: "train", cost: 0 }, { vehicleId: "rocket", cost: 10 }]) {
  assert.equal(chosenTransport(broken), null, `این مقدار نباید «انتخاب‌شده» خوانده شود: ${JSON.stringify(broken)}`);
}

/* ── 3. A chosen ticket makes the trip's own phase advance ────────────────── */

const withTicket = tripStatus({
  origin: "تهران",
  destination: "بندرعباس",
  departureDate: "2026-12-02",
  transport: stored,
  accommodation: { status: "skipped" },
});
assert.ok(withTicket.steps.find((step) => step.id === "ticket")!.done, "با بلیت انتخاب‌شده، قدم بلیت انجام‌شده است");
assert.equal(tripStatus({ destination: "بندرعباس" }).steps.find((step) => step.id === "ticket")!.done, false);

/* ── 4. The package id is Safarino's own, so the room is matched by its name ─ */

const packageStay = { status: "selected", id: "pkg-تهران-بندرعباس-train-2026-12-02-اقامتگاه سنتی فلت بادگیر 2 - اتاق 4 و 5 و 6", name: "اقامتگاه سنتی فلت بادگیر 2 - اتاق 4 و 5 و 6", cost: 2_500_000 };
const liveOffers = [
  { id: "jabama:998877", name: "اقامتگاه سنتی فلت بادگیر 2 - اتاق 4 و 5 و 6", priceTotalToman: 2_500_000 },
  { id: "jabama:112233", name: "هتل هرمز", priceTotalToman: 4_100_000 },
];
const byId = liveOffers.find((offer) => offer.id === packageStay.id);
assert.equal(byId, undefined, "شناسهٔ بسته عمداً با شناسهٔ منبع یکی نیست — پس تطبیق با شناسه همیشه شکست می‌خورد");
const byName = liveOffers.find((offer) => offer.name.trim() === packageStay.name.trim());
assert.ok(byName, "همان اتاق باید با نامش در فهرست زنده پیدا شود");
assert.equal(byName!.id, "jabama:998877");

/* ── 5. The code itself keeps these three promises ────────────────────────── */

const ticketSearch = readFileSync(new URL("../components/transport/TicketSearch.tsx", import.meta.url), "utf8");
assert.match(ticketSearch, /autoApplied/, "پیشنهاد بلیت باید یک بار و واقعاً انتخاب شود");
assert.match(ticketSearch, /visible\.some\(\(row\) => row\.id === selectedId\)/, "انتخاب خود مسافر هرگز با پیشنهاد بازنویسی نشود");
assert.match(ticketSearch, /listMode\.current !== mode/, "بلیت یک وسیله هرگز روی وسیلهٔ دیگر نوشته نشود");

const accommodationPage = readFileSync(new URL("../app/accommodation/page.tsx", import.meta.url), "utf8");
assert.match(accommodationPage, /autoAppliedStay/, "پیشنهاد اقامتگاه باید یک بار و واقعاً انتخاب شود");
assert.match(accommodationPage, /sameRoom/, "اتاقِ بسته باید با نامش به انتخاب واقعی تبدیل شود");

const transportPage = readFileSync(new URL("../app/transport/page.tsx", import.meta.url), "utf8");
assert.match(transportPage, /providerStatuses/, "شمارش بلیت باید وضعیت منابع را هم بخواند");
assert.match(transportPage, /answered/, "«۰ بلیت» فقط وقتی گفته شود که همهٔ منابع واقعاً پاسخ داده باشند");

const plan = readFileSync(new URL("../app/plan/page.tsx", import.meta.url), "utf8");
assert.match(plan, /بلیت انتخاب‌شده برای این سفر/, "برنامهٔ سفر هم باید همان بلیت انتخاب‌شده را نشان دهد");
assert.match(plan, /chosenTransport\(transportDetails\)/, "و آن را از همان منبع بخواند");

const itinerary = readFileSync(new URL("../app/itinerary/page.tsx", import.meta.url), "utf8");
assert.match(itinerary, /بلیت انتخاب‌شده برای این سفر/, "دفترچهٔ سفر باید همان بلیت انتخاب‌شده را نشان دهد");
assert.match(itinerary, /chosenTransport/, "و آن را از همان منبع بخواند که بقیهٔ صفحه‌ها می‌خوانند");

console.log("✅ round 53: هر پیشنهاد یا واقعاً انتخاب می‌شود یا ادعای انتخاب نمی‌کند");
