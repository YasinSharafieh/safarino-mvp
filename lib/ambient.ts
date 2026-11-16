/**
 * «رابط کاربری تطبیق‌پذیر» — the site takes the colour of the destination.
 *
 * The base palette stays «غروب بنفش»; only the three decorative aura colours
 * move, so no button, card or text contrast ever changes and light mode keeps
 * working. Which palette a city gets is read from the city's own real profile
 * (`lib/discover`), not from a random pick.
 */

export type AmbientId = "violet" | "coast" | "desert" | "forest" | "mountain" | "heritage" | "sacred" | "city";

export type Ambient = {
  id: AmbientId;
  label: string;
  /** The three aura colours, as CSS colours with alpha. */
  colors: [string, string, string];
  /** A short line explaining why the site looks like this now. */
  why: string;
  /** Which gentle ambience fits it (played only if the traveller asked). */
  sound: "waves" | "wind" | "forest" | "city" | null;
};

const PALETTES: Record<AmbientId, Omit<Ambient, "why">> = {
  violet: { id: "violet", label: "غروب بنفش", colors: ["rgba(169,125,255,0.55)", "rgba(255,111,152,0.50)", "rgba(255,171,61,0.45)"], sound: null },
  coast: { id: "coast", label: "آبی آکوا و فیروزه‌ای", colors: ["rgba(56,200,255,0.55)", "rgba(52,235,196,0.45)", "rgba(96,165,250,0.40)"], sound: "waves" },
  desert: { id: "desert", label: "کهربایی و طلایی", colors: ["rgba(255,171,61,0.55)", "rgba(255,129,74,0.45)", "rgba(255,208,110,0.40)"], sound: "wind" },
  forest: { id: "forest", label: "سبز زمردی", colors: ["rgba(52,211,153,0.55)", "rgba(34,197,94,0.45)", "rgba(45,212,191,0.40)"], sound: "forest" },
  mountain: { id: "mountain", label: "آبی سرد کوهستان", colors: ["rgba(129,161,255,0.55)", "rgba(96,165,250,0.45)", "rgba(167,199,255,0.38)"], sound: "wind" },
  heritage: { id: "heritage", label: "مسی و برنزی", colors: ["rgba(244,164,96,0.55)", "rgba(217,119,87,0.45)", "rgba(255,205,150,0.38)"], sound: null },
  sacred: { id: "sacred", label: "فیروزه‌ای آرام", colors: ["rgba(94,234,212,0.50)", "rgba(148,163,255,0.42)", "rgba(196,235,255,0.36)"], sound: null },
  city: { id: "city", label: "بنفش شهری", colors: ["rgba(192,132,252,0.55)", "rgba(129,140,248,0.45)", "rgba(251,191,36,0.35)"], sound: "city" },
};

const MOOD_TO_AMBIENT: { mood: string; id: AmbientId }[] = [
  { mood: "ساحلی", id: "coast" },
  { mood: "کویری", id: "desert" },
  { mood: "طبیعت", id: "forest" },
  { mood: "کوهستانی", id: "mountain" },
  { mood: "تاریخی", id: "heritage" },
  { mood: "زیارتی", id: "sacred" },
  { mood: "شهری", id: "city" },
];

export function ambientFor(destination: string | null | undefined, cityMoods: string[] = []): Ambient {
  if (!destination || !cityMoods.length) {
    return { ...PALETTES.violet, why: "بدون مقصد، رنگ پایهٔ سفرینو می‌ماند." };
  }
  const match = MOOD_TO_AMBIENT.find((entry) => cityMoods.includes(entry.mood));
  const id = match?.id || "violet";
  const palette = PALETTES[id];
  return {
    ...palette,
    why:
      id === "violet"
        ? `${destination} در فهرست سفرینو سلیقهٔ ویژه‌ای ندارد؛ رنگ پایه می‌ماند.`
        : `مقصد ${destination} در فهرست سفرینو با حال‌وهوای «${cityMoods[0]}» شناخته می‌شود، پس زمینه به ${palette.label} رفت.`,
  };
}

/** The CSS variables the aura reads, so one assignment repaints the decoration. */
export function ambientCss(ambient: Ambient): Record<string, string> {
  return {
    "--glow-a": ambient.colors[0],
    "--glow-b": ambient.colors[1],
    "--glow-c": ambient.colors[2],
  };
}
