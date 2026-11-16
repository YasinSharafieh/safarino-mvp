/**
 * «خروجی استوری» — the whole trip as three vertical 9:16 cards.
 *
 * The scenes are computed here from the plan's own data (no AI, no invention),
 * so the picture can never say something the page does not say. The drawing
 * itself happens on the traveller's own device in `components/StoryExport.tsx`.
 */

export type StoryStop = { time: string; title: string };
export type StoryDay = { day: number; title: string; stops: StoryStop[] };

export type StoryInput = {
  destination: string;
  origin: string;
  days: number;
  travellers: number;
  totalToman: number;
  transportLabel: string;
  stayName: string;
  archetypeName?: string;
  budgetToman: number;
  days_: StoryDay[];
  topPlaces: string[];
};

export type StoryScene = {
  index: number;
  kicker: string;
  title: string;
  subtitle: string;
  lines: string[];
  footer: string;
};

const fa = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.round(value));
const money = (value: number) => `${fa(value)} تومان`;

/** Three scenes: the cover, the days, and the money + what to pack. */
export function storyScenes(input: StoryInput): StoryScene[] {
  const days = input.days_.slice(0, 6);
  const cover: StoryScene = {
    index: 0,
    kicker: "سفرینو · برنامهٔ سفر",
    title: input.destination || "سفر من",
    subtitle: `${fa(input.days)} روز · ${fa(input.travellers)} نفر${input.archetypeName ? ` · ${input.archetypeName}` : ""}`,
    lines: [
      `${input.origin} → ${input.destination}`,
      input.transportLabel ? `با ${input.transportLabel}` : "",
      input.stayName ? `اقامت در ${input.stayName}` : "",
    ].filter(Boolean),
    footer: "ساخته‌شده با سفرینو",
  };

  const daysScene: StoryScene = {
    index: 1,
    kicker: "روز به روز",
    title: "برنامهٔ روزها",
    subtitle: days.length ? `${fa(days.length)} روز برنامه‌ریزی‌شده` : "برنامه‌ای ثبت نشده",
    lines: days.map(
      (day) => `روز ${fa(day.day)}: ${day.stops.slice(0, 2).map((stop) => stop.title).join(" · ") || day.title}`,
    ),
    footer: input.topPlaces.length ? `جاذبه‌ها: ${input.topPlaces.slice(0, 3).join("، ")}` : "سفرینو",
  };

  const moneyScene: StoryScene = {
    index: 2,
    kicker: "بودجه و حال سفر",
    title: input.budgetToman > 0 ? money(input.budgetToman) : "بودجه",
    subtitle: input.totalToman > 0 ? `برآورد هزینهٔ انتخاب‌شده: ${money(input.totalToman)}` : "هزینه‌ها در صفحهٔ برنامه",
    lines: [
      input.budgetToman > 0 && input.totalToman > 0
        ? input.totalToman <= input.budgetToman
          ? `${money(input.budgetToman - input.totalToman)} از بودجه باقی می‌ماند`
          : `${money(input.totalToman - input.budgetToman)} بیشتر از بودجه`
        : "",
      input.topPlaces.length ? `حتماً ببین: ${input.topPlaces.slice(0, 3).join("، ")}` : "",
    ].filter(Boolean),
    footer: "@safarino",
  };

  return [cover, daysScene, moneyScene];
}

/** The canvas size every story uses (Instagram 9:16). */
export const STORY_SIZE = { width: 1080, height: 1920 };
