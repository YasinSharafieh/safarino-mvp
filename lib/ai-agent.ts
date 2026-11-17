/**
 * «همسفر کار می‌کند، نه فقط جواب می‌دهد.»
 *
 * Until now the companion could only *talk*: the page fetched the data, then
 * asked the model to phrase an answer. This file gives it hands. The model is
 * shown a small, honest set of tools — live tickets, live rooms, the trip's own
 * money, the real forecast, what the destination is known for — and it decides
 * which one to run, reads the result, and only then answers.
 *
 * The rules that keep it honest:
 *  - a tool result is the only new information the model ever gets; there is no
 *    open web and no place to invent a price from;
 *  - every tool returns a short, already-numbered summary, so the answer is
 *    built on figures the site also shows;
 *  - the loop is capped (`MAX_STEPS`) so a confused model cannot spend the
 *    credit exploring;
 *  - the finished answer goes through `verifyAnswer` (numbers) and
 *    `reviewWithModel` (claims) before it is returned. A sentence that fails is
 *    not patched — the honest local answer is used instead.
 *
 * Everything here degrades: if a provider is down, the tool says so and the
 * model is told to answer without it. If the AI credit is gone, the route falls
 * back to the deterministic answer.
 */

import { askJson, shortText } from "./ai-openrouter";
import { verifyAnswer, reviewWithModel } from "./ai-verify";
import { tripCostBreakdown } from "./trip-costs";
import { CITY_PROFILES } from "./city-profiles";
import { IRANIAN_CITIES } from "./iran-cities";
import { addDays } from "./weather";
import { affordabilityOf } from "./budget-control";

export type AgentFacts = {
  origin: string;
  destination: string;
  departureDate: string | null;
  days: number;
  travellers: number;
  children: number;
  infants: number;
  budgetToman: number;
  ticketsToman: number;
  stayToman: number;
  stayName: string;
  transportLabel: string;
  tastes: string[];
};

export type AgentStep = {
  tool: string;
  label: string;
  ok: boolean;
  /** What the traveller is shown under «چه کاری کردم». */
  summary: string;
};

export type AgentResult = {
  answer: string;
  steps: AgentStep[];
  source: "agent" | "local";
  note?: string;
  /** A concrete fix the page can offer as a button, when the agent found one. */
  action?: { kind: "budget"; millions: number; label: string } | null;
};

const MAX_STEPS = 3;

const TOOL_CATALOG = `
ابزارهای موجود (فقط همین‌ها):
1) tickets — بلیت واقعی برای مسیر و تاریخ همین سفر می‌خواند. آرگومان: {"mode":"plane"|"train"|"bus"}
2) stays — اتاق‌های واقعی مقصد برای شب‌های همین سفر می‌خواند. آرگومان: {}
3) money — تقسیم بودجه و باقی‌ماندهٔ همین سفر (بلیت، اقامت، غذا، بازدید، رفت‌وآمد شهری). آرگومان: {}
4) weather — پیش‌بینی واقعی هوا برای روزهای همین سفر. آرگومان: {}
5) destination — چیزهایی که مقصد واقعاً برایشان شناخته می‌شود. آرگومان: {"topic":"غذا"|"طبیعت"|"تاریخ"|"خرید"|"عمومی"}
6) fix_budget — وقتی پول کافی نیست، حداقل بودجهٔ لازم را حساب می‌کند تا کاربر با یک دکمه اصلاحش کند. آرگومان: {}
`.trim();

function fa(value: number) {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}
function money(value: number) {
  return `${fa(value)} تومان`;
}

type ToolOutcome = { ok: boolean; summary: string; data: unknown };

/** City coordinates for the forecast, from the app's own city table. */
function cityPoint(city: string): { latitude: number; longitude: number } | null {
  const found = IRANIAN_CITIES.find((entry) => entry.name === city);
  if (!found || typeof found.latitude !== "number" || typeof found.longitude !== "number") return null;
  return { latitude: found.latitude, longitude: found.longitude };
}

async function runTickets(facts: AgentFacts, args: Record<string, unknown>): Promise<ToolOutcome> {
  const mode = args.mode === "train" || args.mode === "bus" ? args.mode : "plane";
  if (!facts.departureDate) {
    return { ok: false, summary: "تاریخ سفر هنوز انتخاب نشده، پس بلیتی خوانده نشد.", data: null };
  }
  try {
    const { searchTransport } = await import("./transport-search");
    const { payload } = await searchTransport({
      mode,
      origin: facts.origin,
      destination: facts.destination,
      date: facts.departureDate,
      adults: facts.travellers,
      children: facts.children,
      infants: facts.infants,
    });
    const offers = (payload.offers || []).slice(0, 40);
    if (!offers.length) {
      return {
        ok: false,
        summary: `${mode === "plane" ? "هواپیما" : mode === "train" ? "قطار" : "اتوبوس"} برای این مسیر و تاریخ بلیت موجودی برنگرداند.`,
        data: null,
      };
    }
    const priced = offers
      .map((offer) => ({ offer, total: offer.priceToman * facts.travellers }))
      .sort((a, b) => a.total - b.total)
      .slice(0, 6)
      .map(({ offer, total }) => ({
        title: `${offer.operator} ${offer.serviceLabel}`.trim(),
        provider: offer.provider,
        total,
        seatsLeft: offer.seatsLeft,
      }));
    return {
      ok: true,
      summary: priced.map((item, index) => `${index + 1}) ${item.title} — ${money(item.total)}`).join(" | "),
      data: { mode, count: offers.length, options: priced, fetchedAt: payload.fetchedAt },
    };
  } catch {
    return { ok: false, summary: "منبع بلیت الان جواب نداد.", data: null };
  }
}

async function runStays(facts: AgentFacts): Promise<ToolOutcome> {
  const nights = Math.max(1, facts.days - 1);
  const checkIn = facts.departureDate || addDays(new Date().toISOString().slice(0, 10), 1);
  try {
    const { searchMultiProviderAccommodation } = await import("./accommodation-search");
    const result = await searchMultiProviderAccommodation({
      kind: "hotel",
      city: facts.destination,
      checkIn,
      checkOut: addDays(checkIn, nights),
      adults: facts.travellers,
      children: facts.children,
      rooms: 1,
    } as never);
    const offers = ((result as { groups?: { offers: { name: string; priceTotalToman: number; provider: string }[] }[] }).groups || [])
      .flatMap((group) => group.offers || [])
      .slice(0, 60);
    if (!offers.length) {
      return { ok: false, summary: "برای این شهر اتاقی در منابع برنگشت.", data: null };
    }
    const cheapest = [...offers].sort((a, b) => a.priceTotalToman - b.priceTotalToman).slice(0, 5);
    return {
      ok: true,
      summary: cheapest.map((offer) => `${offer.name} — ${money(offer.priceTotalToman)} برای ${nights} شب`).join(" | "),
      data: { options: cheapest.map((offer) => ({ name: offer.name, total: offer.priceTotalToman, provider: offer.provider })), nights },
    };
  } catch {
    return { ok: false, summary: "منبع اقامت الان جواب نداد.", data: null };
  }
}

function runMoney(facts: AgentFacts): ToolOutcome {
  const breakdown = tripCostBreakdown({
    totalBudget: facts.budgetToman,
    travellers: facts.travellers + facts.children + facts.infants,
    days: facts.days,
    nights: Math.max(1, facts.days - 1),
    city: facts.destination,
    tickets: facts.ticketsToman,
    stay: facts.stayToman,
  });
  return {
    ok: true,
    summary:
      `بلیت ${money(breakdown.tickets)}، اقامت ${money(breakdown.stay)}، غذا ${money(breakdown.food)}، ` +
      `بازدید ${money(breakdown.activities)}، رفت‌وآمد شهری ${money(breakdown.localTransport)}؛ ` +
      `باقی‌مانده ${money(breakdown.remaining)} از ${money(breakdown.totalBudget)}.`,
    data: breakdown,
  };
}

async function runWeather(facts: AgentFacts): Promise<ToolOutcome> {
  const point = cityPoint(facts.destination);
  if (!point) return { ok: false, summary: "مختصات این مقصد را نداریم، پس هوا خوانده نشد.", data: null };
  try {
    const { tripWeather } = await import("./weather");
    const result = await tripWeather({ ...point, startDate: facts.departureDate, days: facts.days });
    if (!result.days.length) return { ok: false, summary: "پیش‌بینی هوا برنگشت.", data: null };
    return {
      ok: true,
      summary: result.days
        .slice(0, 7)
        .map((day, index) => `روز ${index + 1}: ${day.label} ${day.maxC ?? "?"}°/${day.minC ?? "?"}°`)
        .join(" | "),
      data: { mode: result.mode, days: result.days.slice(0, 7).map((day, index) => ({ day: index + 1, label: day.label, maxC: day.maxC, minC: day.minC })) },
    };
  } catch {
    return { ok: false, summary: "سرویس هوا در دسترس نبود.", data: null };
  }
}

function runDestination(facts: AgentFacts, args: Record<string, unknown>): ToolOutcome {
  const profile = CITY_PROFILES.find((entry) => entry.name === facts.destination);
  if (!profile) return { ok: false, summary: "برای این مقصد پروفایل شناخته‌شده‌ای نداریم.", data: null };
  const topic = shortText(args.topic, 20);
  return {
    ok: true,
    summary: `${profile.tagline} | دیدنی‌ها: ${profile.highlights.slice(0, 4).join("، ")} | مناسب برای: ${profile.bestFor
      .slice(0, 3)
      .join("، ")} | بهترین فصل: ${profile.bestSeason}${topic ? ` | موضوع پرسیده‌شده: ${topic}` : ""}`,
    data: profile,
  };
}

function runFixBudget(facts: AgentFacts): ToolOutcome {
  const committed = facts.ticketsToman + facts.stayToman;
  const affordability = affordabilityOf({
    totalBudgetToman: facts.budgetToman,
    travellers: facts.travellers + facts.children + facts.infants,
    days: facts.days,
    city: facts.destination,
    itemToman: committed,
    itemLabel: "بلیت و اقامت انتخاب‌شده",
  });
  if (affordability.fits) {
    return { ok: true, summary: `با ${money(facts.budgetToman)} همه‌چیز جا می‌شود؛ لازم نیست بودجه را عوض کنی.`, data: affordability };
  }
  return {
    ok: true,
    summary: `${money(affordability.shortfallToman)} کم است؛ با بودجهٔ ${fa(affordability.neededBudgetMillions)} میلیون تومان جا می‌شود.`,
    data: affordability,
  };
}

const TOOL_LABELS: Record<string, string> = {
  tickets: "خواندن بلیت‌های واقعی",
  stays: "خواندن اتاق‌های واقعی",
  money: "حساب کردن پول سفر",
  weather: "خواندن پیش‌بینی هوا",
  destination: "بررسی مقصد",
  fix_budget: "حساب کردن بودجهٔ لازم",
};

export async function runAgentTool(name: string, args: Record<string, unknown>, facts: AgentFacts): Promise<ToolOutcome> {
  switch (name) {
    case "tickets":
      return runTickets(facts, args);
    case "stays":
      return runStays(facts);
    case "money":
      return runMoney(facts);
    case "weather":
      return runWeather(facts);
    case "destination":
      return runDestination(facts, args);
    case "fix_budget":
      return runFixBudget(facts);
    default:
      return { ok: false, summary: `ابزار «${shortText(name, 30)}» وجود ندارد.`, data: null };
  }
}

function tripBrief(facts: AgentFacts): string {
  return [
    `مسیر: ${facts.origin} → ${facts.destination}`,
    `تاریخ حرکت: ${facts.departureDate || "انتخاب نشده"}`,
    `مدت: ${facts.days} روز`,
    `مسافران: ${facts.travellers} بزرگسال${facts.children ? `، ${facts.children} کودک` : ""}${facts.infants ? `، ${facts.infants} نوزاد` : ""}`,
    `بودجهٔ کل: ${facts.budgetToman} تومان`,
    `بلیت انتخاب‌شده: ${facts.ticketsToman} تومان (${facts.transportLabel})`,
    `اقامت انتخاب‌شده: ${facts.stayToman} تومان (${facts.stayName})`,
    facts.tastes.length ? `سلیقه: ${facts.tastes.join("، ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The loop. The model picks a tool or answers; tools give it real data; at most
 * `MAX_STEPS` rounds, then it must answer. The answer is verified before it
 * leaves this function.
 */
export async function runCompanionAgent(input: {
  question: string;
  facts: AgentFacts;
  /** Fallback the route already computed from the trip's own numbers. */
  localAnswer: string;
}): Promise<AgentResult> {
  const { question, facts } = input;
  const steps: AgentStep[] = [];
  const evidence: Record<string, unknown> = { facts };
  let action: AgentResult["action"] = null;

  const system = `تو «همسفر سفرینو» هستی و این بار باید *کار* کنی، نه فقط حرف بزنی.
برای هر سؤال، اگر جواب به دادهٔ واقعی نیاز دارد، اول ابزار مناسب را صدا بزن و بعد با نتیجه‌اش جواب بده.
قواعد سخت:
- هیچ قیمت، ساعت، نام هتل یا شرکت، یا آمار تازه‌ای از خودت نمی‌سازی. فقط چیزی را می‌گویی که در نتیجهٔ ابزارها یا دادهٔ سفر آمده.
- اگر ابزار جواب نداد، صریح می‌گویی «این را نتوانستم بخوانم» و بر اساس همان چیزی که داری کمک می‌کنی.
- فارسی، کوتاه (حداکثر ۳ جمله)، بدون مقدمه‌چینی.
${TOOL_CATALOG}

برای صدا زدن ابزار بنویس: {"tool":"نام","args":{...}}
برای جواب نهایی بنویس: {"answer":"..."}`;

  const transcript: string[] = [`سؤال کاربر: ${question}`];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    let raw: unknown;
    try {
      raw = await askJson({
        task: "agent",
        title: "Safarino Companion Agent",
        system,
        prompt: `${tripBrief(facts)}\n\n${transcript.join("\n\n")}\n\nحالا یا یک ابزار صدا بزن یا جواب بده.`,
        maxTokens: 300,
        temperature: 0.2,
      });
    } catch {
      return {
        answer: input.localAnswer,
        steps,
        source: "local",
        note: steps.length ? "ادامهٔ کار با هوش مصنوعی ممکن نشد؛ جمع‌بندی از حساب خودمان." : "هوش مصنوعی الان در دسترس نیست؛ پاسخ از حساب‌های خودت.",
        action,
      };
    }

    const body = (raw || {}) as Record<string, unknown>;
    const answer = shortText(body.answer, 900);
    if (answer.length >= 8) {
      const numeric = verifyAnswer(answer, evidence);
      if (!numeric.ok) {
        return {
          answer: input.localAnswer,
          steps,
          source: "local",
          note: `${numeric.reason} پس جملهٔ هوش مصنوعی را نشان نمی‌دهم و همان حساب خودمان را می‌گویم.`,
          action,
        };
      }
      const review = await reviewWithModel({ answer, evidence: JSON.stringify(evidence).slice(0, 2_400), question });
      if (!review.ok) {
        return {
          answer: input.localAnswer,
          steps,
          source: "local",
          note: `بازبین خودکار ایراد گرفت: ${review.reason}`,
          action,
        };
      }
      return {
        answer,
        steps,
        source: "agent",
        note: review.source === "model" ? "پاسخ پیش از نمایش بازبینی شد و با داده‌های واقعی خواند." : undefined,
        action,
      };
    }

    const tool = shortText(body.tool, 30);
    if (!tool) break;
    const args = (body.args && typeof body.args === "object" ? body.args : {}) as Record<string, unknown>;
    const outcome = await runAgentTool(tool, args, facts);
    steps.push({
      tool,
      label: TOOL_LABELS[tool] || tool,
      ok: outcome.ok,
      summary: outcome.summary.slice(0, 400),
    });
    evidence[tool] = outcome.data;
    if (tool === "fix_budget" && outcome.ok) {
      const data = outcome.data as { fits?: boolean; neededBudgetMillions?: number } | null;
      if (data && data.fits === false && Number(data.neededBudgetMillions) > 0) {
        action = {
          kind: "budget",
          millions: Math.round(Number(data.neededBudgetMillions)),
          label: `بودجه را به ${fa(Number(data.neededBudgetMillions))} میلیون برسان`,
        };
      }
    }
    transcript.push(`ابزار ${tool} اجرا شد → ${outcome.ok ? "موفق" : "ناموفق"}: ${outcome.summary}`);
  }

  // Out of steps without a spoken answer: the tools still did real work, so the
  // traveller is told what was found rather than nothing.
  const useful = steps.filter((step) => step.ok);
  if (useful.length) {
    const last = useful[useful.length - 1];
    return {
      answer: `${last.label}: ${last.summary}`,
      steps,
      source: "agent",
      note: "این نتیجه از دادهٔ واقعی خوانده شد؛ توضیح بیشتر می‌خواهی بپرس.",
      action,
    };
  }
  return { answer: input.localAnswer, steps, source: "local", note: "هوش مصنوعی به نتیجهٔ تازه‌ای نرسید؛ همان حساب خودمان را می‌گویم.", action };
}

/** Exported for the tests: the tool list is part of the contract. */
export const AGENT_TOOL_NAMES = Object.keys(TOOL_LABELS);
