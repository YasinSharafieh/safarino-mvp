/**
 * «تیپ سفرت» — the traveller's archetype.
 *
 * This is not a personality test and nothing here is invented: the label is
 * computed from numbers the traveller has already given us (the tastes the quiz
 * read, the budget per person per day, the length of the trip, whether children
 * are travelling and the vehicle they chose). Every line of «چرا این تیپ» points
 * at one of those real inputs, and the AI only *narrates* them.
 */

export type ArchetypeInput = {
  /** Taste moods, strongest first — exactly what the quiz produced. */
  moods: string[];
  budgetMillions: number;
  people: number;
  days: number;
  children?: number;
  mode?: string;
};

export type ArchetypeBand = "economy" | "balanced" | "premium";

export type Archetype = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  band: ArchetypeBand;
  bandLabel: string;
  /** Real reasons, each one traceable to an input above. */
  why: string[];
  /** What this traveller should do differently — still tied to real inputs. */
  tips: string[];
  /** The runner-up, shown as «نزدیکترین تیپ دیگر» so nobody feels boxed in. */
  runnerUp: { name: string; emoji: string } | null;
  /** How full each day should feel, in one word. */
  pace: string;
  score: number;
};

type Definition = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  moods: Partial<Record<string, number>>;
  /** Preferred spending band; the mismatch is subtracted, never added. */
  band: ArchetypeBand;
  children?: number;
  pace: string;
  tips: string[];
};

const DEFINITIONS: Definition[] = [
  {
    id: "luxury-explorer",
    name: "ماجراجوی لوکس‌پسند",
    emoji: "🧭",
    tagline: "دنبال تجربه‌ای که فقط یک بار در عمرت اتفاق می‌افتد، اما شب را راحت می‌خوابی.",
    moods: { طبیعت: 2, کویری: 3, کوهستانی: 1, ساحلی: 1, تاریخی: 1 },
    band: "premium",
    pace: "پرماجرا",
    tips: ["برای کارهای پرهیجان، اقامتگاه نزدیک‌تر به همان منطقه را انتخاب کن تا وقت جاده کمتر شود.", "یک روز از سفر را عمداً خالی بگذار؛ ماجراجویی‌ها همیشه وقت بیشتر می‌خواهند."],
  },
  {
    id: "history-keeper",
    name: "کاشف تاریخ",
    emoji: "🏛️",
    tagline: "برای تو سفر یعنی ایستادن جلوی چیزی که صدها سال ایستاده است.",
    moods: { تاریخی: 3, زیارتی: 1, شهری: 1 },
    band: "balanced",
    pace: "آرام و پربازدید",
    tips: ["دو جاذبهٔ تاریخی پشت‌سرهم را با یک کافه یا بازار وسطشان جدا کن؛ حافظه بهتر کار می‌کند.", "برای موزه‌های شلوغ، ورود صبح را انتخاب کن."],
  },
  {
    id: "calm-pilgrim",
    name: "زائر آرام",
    emoji: "🤍",
    tagline: "سفر برای تو بیشتر یک نفس عمیق است تا یک فهرست.",
    moods: { زیارتی: 3, تاریخی: 1, شهری: 1 },
    band: "balanced",
    pace: "سبک و کم‌تراکم",
    tips: ["دو زیارتگاه در یک روز را کنار هم نگذار؛ فاصلهٔ زمانی، حال سفر را نگه می‌دارد.", "اقامتگاهی نزدیک همان محله انتخاب کن تا رفت‌وآمد روزانه کم شود."],
  },
  {
    id: "budget-nature",
    name: "طبیعت‌گرد کوله‌پشتی",
    emoji: "🎒",
    tagline: "کم‌خرج می‌کنی، بیشتر می‌بینی — و این دقیقاً همان لذت است.",
    moods: { طبیعت: 3, کوهستانی: 2, کویری: 1 },
    band: "economy",
    pace: "پرمسیر و سبک",
    tips: ["روی جاده و بلیت اتوبوس صرفه‌جویی کن؛ پول را برای یک اقامت تمیز نزدیک طبیعت بگذار.", "هر روز یک نقطهٔ طبیعی بیشتر نگذار؛ رفت‌وآمد خودش نصف وقت روز است."],
  },
  {
    id: "urban-taster",
    name: "خوش‌گذران شهری",
    emoji: "🍽️",
    tagline: "شهر برای تو یعنی بازار، کافه و شبگردی — نه فقط بنای تاریخی.",
    moods: { شهری: 3, ساحلی: 1, تاریخی: 1 },
    band: "premium",
    pace: "شلوغ و شبانه",
    tips: ["اقامت را نزدیک مرکز شهر بگیر؛ برگشت شب دیروقت سخت‌ترین بخش سفر شهری است.", "یک وعدهٔ غذا را بیرون از محلهٔ توریستی امتحان کن."],
  },
  {
    id: "coast-dweller",
    name: "ساحل‌نشین آرام",
    emoji: "🌊",
    tagline: "برای تو سفر یعنی صدای آب و یک چای بعدازظهر.",
    moods: { ساحلی: 3, طبیعت: 1, شهری: 1 },
    band: "balanced",
    pace: "آهسته",
    tips: ["اقامت با دسترسی پیاده به ساحل را ترجیح بده؛ ارزشش را دارد.", "یک روز کامل را بدون برنامه بگذار — هدف همین سفر است."],
  },
  {
    id: "peak-hunter",
    name: "کوه‌نورد جسور",
    emoji: "⛰️",
    tagline: "بلندی و سرما هیچ‌وقت مانع تو نشده است.",
    moods: { کوهستانی: 3, طبیعت: 2 },
    band: "economy",
    pace: "سنگین",
    tips: ["پیش از حرکت، هوای همان روزها را ببین؛ کوه بدون پیش‌بینی، شرط می‌بندد.", "یک روز پشتیبان بعد از هر برنامهٔ کوه بگذار."],
  },
  {
    id: "desert-stargazer",
    name: "ستاره‌بین کویر",
    emoji: "🌌",
    tagline: "شب و آسمان، اصلی‌ترین جاذبهٔ سفر تو است.",
    moods: { کویری: 3, تاریخی: 1, طبیعت: 1 },
    band: "balanced",
    pace: "آرام و شبانه",
    tips: ["شب کویر سرد می‌شود؛ یک لایهٔ گرم اضافه بردار.", "برنامهٔ روز را زود تمام کن تا برای شب کویر رمقی بماند."],
  },
  {
    id: "family-planner",
    name: "برنامه‌ریز خانواده",
    emoji: "👨‍👩‍👧",
    tagline: "سفر خوب برای تو آن است که همه — کوچک و بزرگ — خسته وارد هتل نشوند.",
    moods: { شهری: 2, طبیعت: 2, تاریخی: 1, ساحلی: 1 },
    band: "balanced",
    children: 7,
    pace: "کوتاه و متنوع",
    tips: ["در هر روز حداکثر دو برنامهٔ اصلی بگذار؛ بچه‌ها با رفت‌وآمد بیشتر از دیدن خسته می‌شوند.", "جاذبهٔ سرپوشیده را کنار جاذبهٔ بیرونی بگذار تا اگر هوا بد شد، برنامه داغان نشود."],
  },
  {
    id: "smart-saver",
    name: "سفر ارزانِ هوشمند",
    emoji: "🧮",
    tagline: "هر تومان را دوبار حساب می‌کنی و همین باعث می‌شود بیشتر سفر کنی.",
    moods: { شهری: 1, طبیعت: 1, تاریخی: 1, کویری: 1 },
    band: "economy",
    pace: "متعادل",
    tips: ["سفر با قطار یا اتوبوس برای این بودجه، جای بیشتری برای اقامت باز می‌کند.", "برای غذا، یک وعدهٔ روزانه را از بازار محلی بگیر."],
  },
];

const BAND_LABEL: Record<ArchetypeBand, string> = {
  economy: "بودجهٔ همراه",
  balanced: "بودجهٔ متعادل",
  premium: "بودجهٔ آزاد",
};

function bandOf(perPersonPerDay: number): ArchetypeBand {
  if (perPersonPerDay < 1_200_000) return "economy";
  if (perPersonPerDay < 3_000_000) return "balanced";
  return "premium";
}

function fa(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(value));
}

/**
 * The archetype, computed from the real trip. Deterministic: the same trip
 * always gives the same label, so it never looks like a random horoscope.
 */
export function readArchetype(input: ArchetypeInput): Archetype {
  const people = Math.max(1, Math.round(input.people || 1));
  const days = Math.max(1, Math.round(input.days || 1));
  const budgetToman = Math.max(0, Math.round((input.budgetMillions || 0) * 1_000_000));
  const perPersonPerDay = budgetToman / (people * days);
  const band = bandOf(perPersonPerDay);
  const children = Math.max(0, Math.round(input.children || 0));
  const moods = input.moods.slice(0, 3);

  const scored = DEFINITIONS.map((definition, index) => {
    let score = 0;
    moods.forEach((mood, position) => {
      const weight = definition.moods[mood];
      // The strongest taste counts three times, the second twice, the third once.
      if (weight) score += weight * (3 - position);
    });
    // The strongest taste decides more than the budget does: someone who said
    // «تاریخی» first should not be labelled «خوش‌گذران شهری» just because they
    // have money to spend.
    if (moods.length && (definition.moods[moods[0]] || 0) >= 3) score += 3;
    if (definition.band === band) score += 3;
    if (children > 0 && definition.children) score += definition.children;
    if (children === 0 && definition.children) score -= 4;
    if (input.mode === "car" && (definition.id === "budget-nature" || definition.id === "peak-hunter")) score += 1;
    if (input.mode === "plane" && definition.id === "luxury-explorer") score += 0.5;
    return { definition, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index);

  const best = scored[0];
  const second = scored[1];

  const why: string[] = [];
  if (moods.length) why.push(`سلیقه‌ات را «${moods.join("، ")}» خواندیم — قوی‌ترینش ${moods[0]}.`);
  why.push(
    `بودجه‌ات ${fa(input.budgetMillions)} میلیون تومان برای ${fa(people)} نفر و ${fa(days)} روز است؛ یعنی حدود ${fa(perPersonPerDay)} تومان هر نفر هر روز.`,
  );
  if (children > 0) why.push(`با ${fa(children)} بچه سفر می‌کنی، پس تیپ‌هایی که برای خانواده ساخته شده‌اند وزن بیشتری گرفتند.`);
  if (input.mode === "car") why.push("با ماشین شخصی می‌روی، پس مسیرهای بیرون‌شهری برایت ارزان‌تر و انعطاف‌پذیرتر است.");
  if (input.mode === "plane") why.push("با هواپیما می‌روی، پس وقت رسیدن کوتاه است و روز اول سفر عملاً کامل در اختیار تو است.");
  if (input.mode === "train") why.push("با قطار می‌روی؛ سفر زمینی طولانی‌تر است ولی بودجهٔ اقامت را نمی‌خورد.");
  if (input.mode === "bus") why.push("با اتوبوس می‌روی؛ ارزان‌ترین حالت برای همین مسیر، که پول بیشتری برای دیدن باقی می‌گذارد.");

  const tips = [...best.definition.tips];
  if (band === "economy") tips.push("اگر بودجه کمی تنگ شد، اول از اقامت کم کن نه از بلیت؛ خستگی جاده کل سفر را خراب می‌کند.");
  if (band === "premium") tips.push("بودجه‌ات جا دارد؛ یک تجربهٔ ویژه (تور، راهنما یا اقامت خاص) را از قبل رزرو کن، نه در لحظهٔ آخر.");

  return {
    id: best.definition.id,
    name: best.definition.name,
    emoji: best.definition.emoji,
    tagline: best.definition.tagline,
    band,
    bandLabel: BAND_LABEL[band],
    why: why.slice(0, 5),
    tips: tips.slice(0, 3),
    runnerUp: second ? { name: second.definition.name, emoji: second.definition.emoji } : null,
    pace: best.definition.pace,
    score: Math.round(best.score * 10) / 10,
  };
}

/** What the app says when the model is not available — still personal, still real. */
export function localArchetypeNote(archetype: Archetype, input: ArchetypeInput): string {
  const taste = input.moods.slice(0, 2).join(" و ") || "سلیقه‌ات";
  return `بر اساس ${taste} و بودجه‌ای که گفتی، تیپ تو «${archetype.name}» است. ${archetype.tagline} برنامه‌ای که چیدیم با همین بودجه و همین تعداد نفرات جور است.`;
}
