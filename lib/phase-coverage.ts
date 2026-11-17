/**
 * «هر قابلیت، در همهٔ فازها» — written down as a contract, checked by a test.
 *
 * The rule the owner keeps repeating is simple and correct: a feature that exists
 * on one page but not on the next one is not finished. Saying it in a message is
 * not enough, because the next change can quietly forget a page. So the rule is
 * data here, and `scripts/test-coverage.ts` reads the real source files and fails
 * if a phase is missing something it promised to show.
 *
 * Two kinds of rows:
 *  - **every phase**: the companion (it lives in the layout), the shared trip in
 *    `TravelContext`, and the budget — the three things a traveller must never
 *    lose between steps;
 *  - **declared phases**: a capability that genuinely belongs to some phases and
 *    not others, with the reason written next to it, so "missing" is a decision
 *    and not an oversight.
 */

export type Phase = {
  id: string;
  path: string;
  file: string;
  /** What this step of the journey is for, in one line. */
  role: string;
};

/** Every screen a traveller can stand on, in the order they meet it. */
export const PHASES: Phase[] = [
  { id: "home", path: "/", file: "app/page.tsx", role: "دروازه: معرفی و شروع" },
  { id: "start", path: "/start", file: "app/start/page.tsx", role: "انتخاب مسیر شروع" },
  { id: "cities", path: "/start/cities", file: "app/start/cities/page.tsx", role: "مبدأ، مقصد، تاریخ، بودجه" },
  { id: "quiz", path: "/quiz", file: "app/quiz/page.tsx", role: "کشف سلیقه وقتی مقصد معلوم نیست" },
  { id: "transport", path: "/transport", file: "app/transport/page.tsx", role: "وسلیه و بلیت" },
  { id: "accommodation", path: "/accommodation", file: "app/accommodation/page.tsx", role: "اقامتگاه یا بدون اقامت" },
  { id: "plan", path: "/plan", file: "app/plan/page.tsx", role: "برنامهٔ روزبه‌روز" },
  { id: "itinerary", path: "/itinerary", file: "app/itinerary/page.tsx", role: "سفر کامل، خرج واقعی، آماده‌سازی جاده" },
  { id: "print", path: "/itinerary/print", file: "app/itinerary/print/page.tsx", role: "نسخهٔ چاپی و PDF" },
  { id: "offline", path: "/offline", file: "app/offline/page.tsx", role: "بدون اینترنت" },
  { id: "discover", path: "/discover", file: "app/discover/page.tsx", role: "کشف مقصد" },
  { id: "discover-city", path: "/discover/[city]", file: "app/discover/[city]/page.tsx", role: "صفحهٔ یک شهر" },
  { id: "hotel", path: "/accommodation/[id]", file: "app/accommodation/[id]/page.tsx", role: "جزئیات یک اقامتگاه" },
  { id: "share", path: "/s/[code]", file: "app/s/[code]/page.tsx", role: "برنامهٔ به‌اشتراک‌گذاشته‌شده" },
];

export type Capability = {
  id: string;
  label: string;
  /** A mark that must be present in the phase's source, one of these strings. */
  markers: string[];
  /** `all` means every phase; otherwise the phases where it belongs. */
  phases: "all" | string[];
  /** Where it lives when it is global (the layout), so the test can skip pages. */
  global?: boolean;
  /** Why the other phases do not need it. */
  note?: string;
};

/**
 * The capabilities. `markers` are deliberately code-level: a page that merely
 * *looks* right but never mounts the component still fails.
 */
export const CAPABILITIES: Capability[] = [
  {
    id: "companion",
    label: "همسفر سفرینو (حباب گوشه)",
    markers: ["TripCompanion"],
    phases: "all",
    global: true,
    note: "در layout سراسری نصب است؛ پس در همهٔ فازها هست.",
  },
  {
    id: "travel-context",
    label: "سفر مشترک بین فازها",
    markers: ["TravelProvider"],
    phases: "all",
    global: true,
    note: "Provider در layout؛ انتخاب هر مرحله در مرحلهٔ بعد دیده می‌شود.",
  },
  {
    id: "budget",
    label: "بودجهٔ کل سفر (تنها یک عدد)",
    markers: ["BudgetBar"],
    phases: ["transport", "accommodation", "plan", "itinerary"],
    note: "صفحهٔ آزمون و انتخاب مسیر خودشان بودجه را به‌صورت عدد می‌پرسند؛ چاپ نسخهٔ خودش را دارد.",
  },
  {
    id: "budget-printed",
    label: "بودجه در نسخهٔ چاپی",
    markers: ["budgetPlan"],
    phases: ["print"],
  },
  {
    id: "reminders",
    label: "چه کاری عقب است",
    markers: ["TripReminders"],
    phases: ["transport", "accommodation", "plan", "itinerary"],
    note: "در فاز بلیت و اقامت به‌صورت فشرده، در سفر کامل به‌صورت کامل.",
  },
  {
    id: "advice",
    label: "پیشنهاد همسفر از میان گزینه‌های واقعی",
    markers: ["CompanionAdvice"],
    phases: ["transport", "accommodation"],
  },
  {
    id: "price-watch",
    label: "تعقیب قیمت از خواندن‌های خودمان",
    markers: ["PriceWatch"],
    phases: ["transport", "accommodation"],
  },
  {
    id: "ledger",
    label: "خرج واقعی سفر",
    markers: ["ExpenseLedger"],
    phases: ["itinerary"],
    note: "کتاب خرج متعلق به سفر است، نه به مرحلهٔ انتخاب.",
  },
  {
    id: "ledger-printed",
    label: "خرج واقعی در نسخهٔ چاپی",
    markers: ["ledgerTotals"],
    phases: ["print"],
  },
  {
    id: "offline-pack",
    label: "بستهٔ آفلاین",
    markers: ["OfflinePackCard"],
    phases: ["itinerary"],
  },
  {
    id: "offline-reader",
    label: "خواندن بستهٔ آفلاین",
    markers: ["readOfflinePack"],
    phases: ["offline"],
  },
  {
    id: "weather-order",
    label: "جابه‌جایی روزها با هوای واقعی",
    markers: ["WeatherReorder"],
    phases: ["plan"],
  },
  {
    id: "voice",
    label: "خواندن متن با صدای دستگاه",
    markers: ["SpeakButton"],
    phases: ["plan", "itinerary", "share"],
    note: "جایی که متن روایی هست: راهنمای روز، خرج‌ها، معرفی لینک.",
  },
  {
    id: "share-intro",
    label: "معرفی سفر روی لینک",
    markers: ["intro"],
    phases: ["share"],
  },
  {
    id: "taste",
    label: "سلیقه از انتخاب‌های واقعی",
    markers: ["tasteProfile"],
    phases: ["transport", "accommodation", "plan"],
    note: "ثبت در انتخاب‌ها، مصرف در پیشنهاد و برنامه.",
  },
  {
    id: "one-click",
    label: "سفر با یک جمله",
    markers: ["OneClickTrip"],
    phases: ["start"],
  },
  {
    id: "trip-status",
    label: "وضعیت سفر: کجایی، چه چیزی انتخاب کرده‌ای، قدم بعدی چیست",
    markers: ["TripStatus"],
    phases: "all",
    global: true,
    note: "در layout سراسری نصب است؛ روی نسخهٔ چاپی، خوانندهٔ آفلاین و لینک اشتراکیِ کسی دیگر خودش را نشان نمی‌دهد.",
  },
  {
    id: "page-identity",
    label: "هر صفحه عنوان و توضیح خودش را دارد (تب، جست‌وجو، پیش‌نمایش لینک)",
    markers: ["metadata", "Metadata", "generateMetadata"],
    phases: "all",
    note: "صفحه‌های کلاینتی نمی‌توانند metadata صادر کنند؛ پس عنوانشان در layout همان مسیر است و قرارداد هر دو را می‌خواند.",
  },
  {
    id: "compare",
    label: "مقایسهٔ دو شهر",
    markers: ["CityCompare"],
    phases: ["cities"],
  },
  {
    id: "timing",
    label: "زمان‌سنجی واقعی روزها (آیا این روز جا می‌شود؟)",
    markers: ["RouteTimingCard"],
    phases: ["plan", "itinerary"],
    note: "در مرحلهٔ برنامه به‌صورت یک خط فشرده، در سفر کامل با جدول روزها.",
  },
  {
    id: "timing-printed",
    label: "زمان‌سنجی در نسخهٔ چاپی",
    markers: ["timingStatusLabel"],
    phases: ["print"],
  },
  {
    id: "caption",
    label: "کپشن استوری از دادهٔ واقعی سفر",
    markers: ["StoryCaption"],
    phases: ["itinerary"],
    note: "کپشن مال صاحب سفر است؛ روی لینک اشتراکی، معرفی نوشته‌شده جایش را می‌گیرد.",
  },
  {
    id: "group",
    label: "دستیار گروه: سهم هر نفر به تومان دقیق",
    markers: ["GroupSplit"],
    phases: ["itinerary"],
    note: "تقسیم پول به گروهی معنی دارد که سفر کامل شده؛ چاپ نسخهٔ خودش را دارد.",
  },
  {
    id: "group-printed",
    label: "سهم هر نفر در نسخهٔ چاپی",
    markers: ["groupSummary"],
    phases: ["print"],
  },
  {
    id: "forecast",
    label: "پیش‌بینی قیمت از خوانده‌های خودمان",
    markers: ["forecast"],
    phases: ["transport", "accommodation"],
    note: "پیش‌بینی داخل کارت «تعقیب قیمت» می‌نشیند، پس فقط جایی هست که قیمت خوانده می‌شود.",
  },
];

export type CoverageRow = {
  capability: Capability;
  missing: string[];
  ok: boolean;
};

/** The matrix itself: which capability must appear where, and whether it does. */
export function coverageRows(readFile: (path: string) => string): CoverageRow[] {
  return CAPABILITIES.map((capability) => {
    const phases = capability.phases === "all" ? PHASES.map((phase) => phase.id) : capability.phases;
    const missing = phases.filter((phaseId) => {
      if (capability.global) return false;
      const phase = PHASES.find((entry) => entry.id === phaseId);
      if (!phase) return true;
      let source = "";
      try {
        source = readFile(phase.file);
      } catch {
        return true;
      }
      /*
       * A page's own `layout.tsx` is part of that page: a client component cannot
       * export metadata, so its title and description live next door. Reading both
       * keeps the contract honest without pretending the file must be one piece.
       */
      try {
        source += `\n${readFile(phase.file.replace(/\/page\.tsx$/, "/layout.tsx"))}`;
      } catch {
        /* no sibling layout — the page carries everything itself */
      }
      return !capability.markers.some((marker) => source.includes(marker));
    });
    return { capability, missing, ok: missing.length === 0 };
  });
}

/** A plain-Persian summary for the report and the console. */
export function coverageSummary(rows: CoverageRow[]): { total: number; ok: number; failures: string[] } {
  const failures = rows
    .filter((row) => !row.ok)
    .map((row) => `${row.capability.label}: در ${row.missing.join("، ")} نیست`);
  return { total: rows.length, ok: rows.filter((row) => row.ok).length, failures };
}
