/**
 * «این سفر را برایم تعریف کن» — the paragraph at the top of a shared link.
 *
 * A link is usually opened by someone who is *not* going: a parent, a friend, a
 * colleague who asked «کجا می‌روید؟». The plan is a table of places; what they
 * want first is the trip in three sentences.
 *
 * The paragraph is written from the shared plan itself — the real city, the real
 * stops, the real number of days and the real weather — and it is checked twice:
 * a model sentence may not contain a number that is not in the plan, and it may
 * not name a company that was not in it. If it fails, the locally composed
 * paragraph is used, and that one is built only from the plan's own fields.
 */

import type { ShareTrip } from "./share";
import { verifyAnswer } from "./ai-verify";
import { shortText, askJson } from "./ai-openrouter";

const fa = new Intl.NumberFormat("fa-IR");

/** The facts a shared plan can honestly speak about. */
export function shareFacts(trip: ShareTrip) {
  const stops = trip.days.flatMap((day) => day.stops.map((stop) => ({ name: stop.n, category: stop.c })));
  return {
    city: trip.city,
    days: trip.days.length,
    stops: stops.length,
    km: trip.totals.km,
    driveMinutes: trip.totals.driveMinutes,
    names: stops.slice(0, 12).map((stop) => stop.name),
    categories: Array.from(new Set(stops.map((stop) => stop.category).filter(Boolean))).slice(0, 5),
    weather: trip.weather?.days?.slice(0, 3).map((day) => day.label) || [],
    money: trip.money
      ? {
          total: trip.money.total,
          real: trip.money.real,
          estimate: trip.money.estimate,
          budget: trip.money.budget,
          remaining: trip.money.remaining,
        }
      : null,
  };
}

/** The paragraph we can always write, with no model and no risk. */
export function localIntro(trip: ShareTrip): string {
  const facts = shareFacts(trip);
  const head = `${fa.format(facts.days)} روز در ${facts.city}`;
  const stops = facts.names.length
    ? `، با ${fa.format(facts.stops)} توقف؛ از جمله ${facts.names.slice(0, 3).join("، ")}`
    : "";
  const route = facts.km > 0 ? ` مسیرها روی هم ${fa.format(Math.round(facts.km))} کیلومتر است` : "";
  const weather = facts.weather.length ? ` و هوا برای روزهای اول ${facts.weather.join("، ")} پیش‌بینی شده` : "";
  const money = facts.money?.total
    ? ` هزینهٔ برنامه‌ریزی‌شده حدود ${fa.format(facts.money.total)} تومان است`
    : "";
  return `${head}${stops}.${route}${weather}${money}. این برنامه با جاذبه‌های واقعی و فاصله‌های واقعی ساخته شده است.`;
}

export function introPrompt(trip: ShareTrip): string {
  const facts = shareFacts(trip);
  return `این یک برنامهٔ سفر واقعی است که کسی با سفرینو ساخته و برای دوستش فرستاده است:
شهر: ${facts.city} | ${facts.days} روز | ${facts.stops} توقف
توقف‌ها: ${facts.names.join("، ")}
دسته‌ها: ${facts.categories.join("، ")}
مسافت رانندگی: ${Math.round(facts.km)} کیلومتر در ${Math.round(facts.driveMinutes)} دقیقه
${facts.weather.length ? `هوا: ${facts.weather.join("، ")}` : ""}
${facts.money?.total ? `هزینهٔ برنامه: ${facts.money.total} تومان` : ""}

در دو یا سه جملهٔ فارسی، برای کسی که در این سفر نیست، حال‌وهوای این سفر را تعریف کن: چه چیزی می‌بیند، چه حسی دارد. صمیمی و کوتاه باش.
هیچ عدد تازه‌ای نساز، هیچ نام تازه‌ای اضافه نکن، هیچ قیمتی از خودت نگو و هیچ وعده‌ای （مثلاً آب‌وهوا) که در داده نیست نده.
فرمت: {"intro":"..."}`;
}

/**
 * The model paragraph, accepted only if every number in it already exists in the
 * plan and the length is sensible. Otherwise the local paragraph wins.
 */
export function acceptIntro(raw: unknown, trip: ShareTrip): { intro: string; source: "local" | "ai" } {
  const body = (raw || {}) as Record<string, unknown>;
  const text = shortText(body.intro, 420);
  if (text.length < 40) return { intro: localIntro(trip), source: "local" };
  const check = verifyAnswer(text, shareFacts(trip));
  if (!check.ok) return { intro: localIntro(trip), source: "local" };
  return { intro: text, source: "ai" };
}

/** Best effort: never throws, never blocks a share. */
export async function writeIntro(trip: ShareTrip): Promise<{ intro: string; source: "local" | "ai" }> {
  if (!process.env.OPENROUTER_API_KEY) return { intro: localIntro(trip), source: "local" };
  try {
    const raw = await askJson({
      task: "write",
      title: "Safarino Share Intro",
      system:
        "تو نویسندهٔ سفرینو هستی و برای خوانندهٔ یک لینک برنامهٔ سفر، دو جملهٔ گرم و دقیق می‌نویسی. فقط از داده‌های داده‌شده استفاده می‌کنی، هیچ عدد یا نام یا وعدهٔ تازه‌ای نمی‌سازی. فقط JSON معتبر می‌نویسی.",
      prompt: introPrompt(trip),
      maxTokens: 260,
      temperature: 0.65,
    });
    return acceptIntro(raw, trip);
  } catch {
    return { intro: localIntro(trip), source: "local" };
  }
}
