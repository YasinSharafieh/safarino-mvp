/**
 * «کدام یکی برای تو؟» — the model picks from the list that is already on screen.
 *
 * The cheapest ticket is not always the right answer: with eighty million in
 * the pocket a traveller may well want the plane, and with twelve million the
 * cheapest train is the honest suggestion. So the advice is not a rule in the
 * code — it is a real decision made over the *real* options, with the trip's
 * own numbers, and it must name one of those options or say nothing.
 *
 * Two layers, as everywhere:
 *   1. `adviceLocally` — a clear recommendation from the trip's own arithmetic,
 *      free and instant;
 *   2. the model may rewrite the *reason* (never the choice), and the rewrite is
 *      thrown away if it contains a number the trip does not have.
 */

export type AdviceOption = {
  id: string;
  title: string;
  /** Total price for the whole party, in toman. */
  priceToman: number;
  /** A short real description: company, time, room type… */
  detail?: string;
};

export type AdviceFacts = {
  stage: "transport" | "accommodation";
  origin: string;
  destination: string;
  days: number;
  travellers: number;
  children: number;
  budgetToman: number;
  /** Everything that is already committed (ticket for the room stage, …). */
  committedToman: number;
  /** Food + sightseeing + city transport for the whole trip. */
  dailyToman: number;
  departureDate?: string | null;
  tastes?: string[];
};

export type Advice = {
  optionId: string | null;
  reason: string;
  /** The share of what is left that this option eats. */
  share: number;
  tone: "fits" | "tight" | "over";
  source: "local" | "ai";
  headline: string;
};

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
const money = (value: number) => `${fa(value)} تومان`;

/**
 * The local decision. Deliberate rules, all visible in the sentence:
 *  - never exceed what is free after the daily costs;
 *  - spend up to 55% of the free money on comfort, not everything;
 *  - if nothing fits, name the cheapest and say by how much it is over.
 */
export function adviceLocally(facts: AdviceFacts, options: AdviceOption[]): Advice {
  const usable = options.filter((option) => Number.isFinite(option.priceToman) && option.priceToman > 0);
  const free = Math.max(0, facts.budgetToman - facts.committedToman - facts.dailyToman);
  if (!usable.length) {
    return {
      optionId: null,
      reason: "هنوز گزینهٔ واقعی با قیمت مشخصی برای انتخاب نیست.",
      share: 0,
      tone: "over",
      source: "local",
      headline: "گزینه‌ای برای پیشنهاد نیست",
    };
  }

  const sorted = [...usable].sort((a, b) => a.priceToman - b.priceToman);
  const affordable = sorted.filter((option) => option.priceToman <= free);

  if (!affordable.length) {
    const cheapest = sorted[0];
    return {
      optionId: cheapest.id,
      reason: `ارزان‌ترین گزینه ${cheapest.title} با ${money(cheapest.priceToman)} است، اما بعد از بلیت و خرج روزانه فقط ${money(
        free,
      )} در بودجهٔ ${money(facts.budgetToman)} تومانی می‌ماند؛ ${money(cheapest.priceToman - free)} کم است.`,
      share: free > 0 ? cheapest.priceToman / free : 1,
      tone: "over",
      source: "local",
      headline: "بودجه برای هیچ گزینه‌ای کافی نیست",
    };
  }

  // Two regimes, both stated plainly: when less than three quarters of the
  // budget is still free the trip is tight and only the cheap end is honest;
  // when it is comfortable the traveller may spend up to 55% of the free money
  // on a better seat or a better room and still have the rest of the trip paid.
  const share = free / Math.max(1, facts.budgetToman);
  const ceiling = free * (share >= 0.75 ? 0.55 : 0.25);
  const within = affordable.filter((option) => option.priceToman <= ceiling);
  // Inside the ceiling take the best one; if even that is out of reach, the
  // honest answer is the cheapest that does fit.
  const chosen = within.length ? within[within.length - 1] : sorted[0];
  const used = free > 0 ? chosen.priceToman / free : 1;

  return {
    optionId: chosen.id,
    reason: `با بودجهٔ ${money(facts.budgetToman)}، بعد از بلیت و خرج روزانه حدود ${money(free)} برای این انتخاب می‌ماند؛ ${
      chosen.title
    } با ${money(chosen.priceToman)} هم راحت‌تر از ارزان‌ترین گزینه است و هم ${money(Math.max(0, free - chosen.priceToman))} را برای بقیهٔ سفر نگه می‌دارد.`,
    share: used,
    tone: used > 0.8 ? "tight" : "fits",
    source: "local",
    headline: used > 0.8 ? "پیشنهاد، ولی بودجه را پر می‌کند" : "پیشنهاد همسفر برای تو",
  };
}

export function advicePrompt(facts: AdviceFacts, options: AdviceOption[], local: Advice): string {
  const stage = facts.stage === "transport" ? "بلیت سفر" : "اقامتگاه";
  return `انتخاب ${stage} برای این سفر:
مبدأ ${facts.origin} → مقصد ${facts.destination} | ${facts.days} روز | ${facts.travellers} نفر${facts.children ? ` (${facts.children} کودک)` : ""}
بودجهٔ کل: ${facts.budgetToman} تومان
هزینه‌های تعهدشده: ${facts.committedToman} تومان
خرج روزانه (غذا، گشت‌وگذار، رفت‌وآمد شهری): ${facts.dailyToman} تومان
پول آزاد برای همین انتخاب: ${Math.max(0, facts.budgetToman - facts.committedToman - facts.dailyToman)} تومان
${facts.tastes?.length ? `سلیقهٔ مسافر: ${facts.tastes.join("، ")}` : ""}

گزینه‌های واقعی (شناسه | عنوان | قیمت کل برای همهٔ نفرات | توضیح):
${options
  .slice(0, 14)
  .map((option) => `- ${option.id} | ${option.title} | ${option.priceToman} | ${option.detail || "—"}`)
  .join("\n")}

پیشنهاد محاسباتی خودمان: ${local.optionId} با این دلیل: ${local.reason}

یکی از همین شناسه‌ها را انتخاب کن (هیچ شناسهٔ تازه‌ای نساز) و در یک یا دو جملهٔ فارسی بگو چرا برای همین مسافر و همین بودجه مناسب است. اگر پیشنهاد ما منطقی نیست و گزینهٔ بهتری هست، همان را انتخاب کن و بگو چرا. هیچ عدد تازه‌ای نساز.
فرمت: {"optionId":"شناسه","reason":"..."}`;
}

/** The model may only name a real option, and its sentence may not invent numbers. */
export function acceptAdvice(raw: unknown, options: AdviceOption[], facts: AdviceFacts, local: Advice): Advice {
  const body = (raw || {}) as Record<string, unknown>;
  const id = typeof body.optionId === "string" ? body.optionId : "";
  const reason = typeof body.reason === "string" ? body.reason.replace(/\s+/g, " ").trim().slice(0, 400) : "";
  const option = options.find((entry) => entry.id === id);
  if (!option || reason.length < 20) return local;

  const known = new Set<string>();
  const add = (value: number) => {
    known.add(String(Math.round(value)));
    known.add(String(Math.round(value / 1_000)));
    known.add(String(Math.round(value / 1_000_000)));
  };
  add(facts.budgetToman);
  add(facts.committedToman);
  add(facts.dailyToman);
  add(facts.days);
  add(facts.travellers);
  for (const entry of options) add(entry.priceToman);

  const digits = reason
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[,٬]/g, "")
    .match(/\d{1,12}/g) || [];
  for (const number of digits) if (!known.has(number)) return local;

  const free = Math.max(0, facts.budgetToman - facts.committedToman - facts.dailyToman);
  const share = free > 0 ? option.priceToman / free : 1;
  return {
    optionId: option.id,
    reason,
    share,
    tone: share > 1 ? "over" : share > 0.8 ? "tight" : "fits",
    source: "ai",
    headline: share > 0.8 ? "پیشنهاد هوش مصنوعی، ولی بودجه را پر می‌کند" : "پیشنهاد هوش مصنوعی برای تو",
  };
}
