/**
 * The checklist is quiet help: it must never lie about what is left, never
 * duplicate an item, never crash on a broken storage, and never pretend to
 * send a notification.
 */
import fs from "node:fs";
import {
  CHECKLIST_GROUPS,
  CHECKLIST_STORAGE_KEY,
  DEFAULT_CHECKLIST,
  MAX_CUSTOM_ITEMS,
  addCustomItem,
  allItems,
  checklistProgress,
  countdownLabel,
  daysUntil,
  readChecklist,
  removeCustomItem,
  resetChecklist,
  sanitizeState,
  saveChecklist,
  toggleDone,
  type ChecklistState,
} from "../lib/checklist";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const empty: ChecklistState = { done: [], custom: [] };

console.log("The built-in list is sane");
check("it is a real list", DEFAULT_CHECKLIST.length >= 15, String(DEFAULT_CHECKLIST.length));
check("every item has a title", DEFAULT_CHECKLIST.every((item) => item.title.trim().length > 2));
check("ids are unique", new Set(DEFAULT_CHECKLIST.map((item) => item.id)).size === DEFAULT_CHECKLIST.length);
const titles = DEFAULT_CHECKLIST.map((item) => item.title.replace(/\s/g, ""));
check("no duplicated titles", new Set(titles).size === titles.length);
check("every group is used", CHECKLIST_GROUPS.every((group) => DEFAULT_CHECKLIST.some((item) => item.group === group.id)));
check("every item belongs to a real group", DEFAULT_CHECKLIST.every((item) => CHECKLIST_GROUPS.some((group) => group.id === item.group)));
check("days are sensible", DEFAULT_CHECKLIST.every((item) => item.daysBefore >= 0 && item.daysBefore <= 30));
check("the essentials are there", ["id-card", "transport-ticket", "hotel-confirm", "home-power"].every((id) => DEFAULT_CHECKLIST.some((item) => item.id === id)));

console.log("Ticking items");
let state = toggleDone(empty, "id-card");
check("one item becomes done", state.done.length === 1 && state.done[0] === "id-card");
state = toggleDone(state, "id-card");
check("ticking again undoes it", state.done.length === 0);
const twice = toggleDone(toggleDone(empty, "cash"), "cash");
check("no duplicate done ids", twice.done.length === 0);

console.log("Progress is arithmetic, not a guess");
const someDone: ChecklistState = { done: ["id-card", "cash", "clothes"], custom: [] };
const progress = checklistProgress(someDone, null);
check("total is the whole list", progress.total === DEFAULT_CHECKLIST.length);
check("done counts only real items", progress.done === 3);
check("remaining is the rest", progress.remaining === progress.total - 3);
check("percent is rounded", progress.percent === Math.round((3 / DEFAULT_CHECKLIST.length) * 100), `${progress.percent}%`);
check("group totals add up", progress.byGroup.reduce((sum, group) => sum + group.total, 0) === progress.total);
check("group done adds up", progress.byGroup.reduce((sum, group) => sum + group.done, 0) === 3);
check("without a date nothing is called late", progress.dueNow.length === 0 && progress.soon.length === 0);
const allDone = checklistProgress({ done: DEFAULT_CHECKLIST.map((item) => item.id), custom: [] }, 5);
check("a finished list is 100%", allDone.percent === 100 && allDone.remaining === 0);

console.log("What matters now depends on the days left");
const weekOut = checklistProgress(empty, 7);
check("with a week left nothing is late yet", weekOut.dueNow.length === 0, String(weekOut.dueNow.length));
const threeDaysOut = checklistProgress(empty, 3);
check(
  "three days out, only what needs three days or more is due",
  threeDaysOut.dueNow.length > 0 && threeDaysOut.dueNow.every((item) => item.daysBefore >= 3),
);
check("three days out, the day-of items are still ahead", !threeDaysOut.dueNow.some((item) => item.daysBefore === 0));
const theDayBefore = checklistProgress(empty, 1);
check("the day before, the one-day items are due", theDayBefore.dueNow.some((item) => item.daysBefore === 1));
check("the day before, the day-of items still wait", !theDayBefore.dueNow.some((item) => item.daysBefore === 0));
const travelDay = checklistProgress(empty, 0);
check("on the travel day everything left is due", travelDay.dueNow.length === DEFAULT_CHECKLIST.length);
check("the next two days are shown as coming up", checklistProgress(empty, 3).soon.length > 0);
check("done items never show up as due", checklistProgress({ done: DEFAULT_CHECKLIST.map((item) => item.id), custom: [] }, 1).dueNow.length === 0);
check("a past trip does not invent urgency", checklistProgress(empty, -5).dueNow.every((item) => item.daysBefore >= 0));

console.log("The countdown is honest");
check("no date means no countdown", daysUntil("") === null && daysUntil(null) === null && daysUntil("دیروز") === null);
check("today counts as zero", daysUntil("2026-11-05", new Date("2026-11-05T09:00:00")) === 0);
check("tomorrow is one day", daysUntil("2026-11-06", new Date("2026-11-05T23:30:00")) === 1);
check("a week later is seven days", daysUntil("2026-11-12", new Date("2026-11-05T10:00:00")) === 7);
check("a past date is negative", (daysUntil("2026-11-01", new Date("2026-11-05T10:00:00")) || 0) < 0);
check("the label is Persian and has no latin digits", !/[0-9]/.test(countdownLabel(7)) && countdownLabel(7).includes("۷"), countdownLabel(7));
check("the day of travel says so", countdownLabel(0).includes("امروز"));
check("no date explains itself", countdownLabel(null).includes("تاریخ حرکت"));

console.log("Items the traveller adds");
const added = addCustomItem(empty, { title: "  کتاب برای راه  ", group: "packing", daysBefore: 1 });
check("a typed item is added", added.custom.length === 1 && added.custom[0].title === "کتاب برای راه");
check("it shows up in the full list", allItems(added).some((item) => item.title === "کتاب برای راه"));
const again = addCustomItem(added, { title: "کتاب  برای راه", group: "packing", daysBefore: 1 });
check("the same item is not added twice", again.custom.length === 1);
check("an empty title is ignored", addCustomItem(empty, { title: "   ", group: "packing", daysBefore: 1 }).custom.length === 0);
const wrongGroup = addCustomItem(empty, { title: "چتر", group: "nonsense" as never, daysBefore: 1 });
check("a wrong group falls back to packing", wrongGroup.custom[0].group === "packing");
const hugeDays = addCustomItem(empty, { title: "زودتر", group: "packing", daysBefore: 400 });
check("an absurd day count is capped", hugeDays.custom[0].daysBefore === 30);
check("a long title is shortened", addCustomItem(empty, { title: "ط".repeat(300), group: "packing", daysBefore: 1 }).custom[0].title.length <= 90);
let many = empty;
for (let index = 0; index < MAX_CUSTOM_ITEMS + 5; index += 1) {
  many = addCustomItem(many, { title: `مورد ${index}`, group: "packing", daysBefore: 1 });
}
check("the custom list has a ceiling", many.custom.length === MAX_CUSTOM_ITEMS, String(many.custom.length));
const removed = removeCustomItem(added, added.custom[0].id);
check("a custom item can be removed", removed.custom.length === 0);
const removedDone = removeCustomItem(toggleDone(added, added.custom[0].id), added.custom[0].id);
check("removing it also clears its tick", removedDone.done.length === 0);
check("built-in items cannot be removed", allItems(removeCustomItem(empty, "id-card")).some((item) => item.id === "id-card"));

console.log("Storage problems are survived");
const memory = new Map<string, string>();
const store = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); } };
check("saving works", saveChecklist(toggleDone(empty, "cash"), store) === true);
check("reading gives the same state", readChecklist(store).done.includes("cash"));
memory.set(CHECKLIST_STORAGE_KEY, "{not json");
check("broken storage gives an empty list", readChecklist(store).done.length === 0);
const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
check("a blocked storage never crashes", readChecklist(blocked).done.length === 0 && saveChecklist(empty, blocked) === false);
check("no storage at all still works", readChecklist(null).done.length === 0);
check("weird stored values are cleaned", sanitizeState({ done: ["ok-1", "bad id!", 42, null], custom: [{ id: "x", title: "" }] }).done.length === 1);
check("reset empties everything", resetChecklist().done.length === 0 && resetChecklist().custom.length === 0);

console.log("The page tells the truth about reminders");
const component = fs.readFileSync("components/TripChecklist.tsx", "utf8");
const itinerary = fs.readFileSync("app/itinerary/page.tsx", "utf8");
const print = fs.readFileSync("app/itinerary/print/page.tsx", "utf8");
check("the list is on the plan page", itinerary.includes("<TripChecklist"));
check("the printed book carries it too", print.includes("چک‌لیست سفر"));
check("it says no notification is sent", component.includes("اعلان"));
check("it says it stays on the device", component.includes("همین دستگاه"));
check("it saves without ever sending the list anywhere", !component.includes("fetch("));
check("it survives an unavailable storage", component.includes("catch"));
check("days-before wording is Persian", component.includes("روز قبل"));

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nChecklist tests passed.");
