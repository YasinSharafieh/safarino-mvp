/**
 * Round 44 — three defects the phase-by-phase sweep found, and the rules that keep
 * them fixed.
 *
 *   ۱. پرواز برای هیچ مسیری پیدا نمی‌شد. صفحهٔ بلیت کد فرودگاه می‌فرستاد، ولی
 *      «پیشنهادهای ویژه» خانه و همسفر نام شهر («تهران») می‌فرستادند و علی‌بابا
 *      نام شهر را نمی‌فهمد؛ حالا تبدیل در یک جا انجام می‌شود.
 *   ۲. سؤال‌های آزمون هیچ‌وقت از مدل نمی‌آمد: یک درخواست ۱۲ سؤالی از سقف
 *      توکن‌های مدل بزرگ‌تر بود، JSON نصفه می‌شد و بانک داخلی جواب می‌داد.
 *   ۳. «یک جمله» «شیراز» را نمی‌فهمید: الگوی «از» انتهای «شیراز» را مبدأ
 *      حساب می‌کرد و شهر را از جمله پاک می‌کرد.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseTripSentence, localProposal, acceptProposal } from "../lib/one-click";
import { questionsPrompt, QUIZ_TOPICS, sanitizeQuestions } from "../lib/quiz-ai";
import { resolveIranianCity, transportCityCode } from "../lib/iran-cities";

let failures = 0;
function check(label: string, value: boolean, detail?: string) {
  if (value) console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures += 1;
    console.log(`  fail ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

console.log("۴۴ — پرواز، سؤال و یک جمله");

// ── 1) A city name always reaches the provider as an airport code ────────────
const tehran = resolveIranianCity("تهران");
const shiraz = resolveIranianCity("شیراز");
check("تهران کد فرودگاه دارد", Boolean(tehran) && transportCityCode(tehran!, "plane") === "THR");
check("شیراز کد فرودگاه دارد", Boolean(shiraz) && transportCityCode(shiraz!, "plane") === "SYZ");

const flightsLib = read("lib/alibaba-flights.ts");
check("کتابخانهٔ پرواز نام شهر را خودش تبدیل می‌کند", flightsLib.includes("resolvedFlightInput"));
check("درخواست پرواز با کد فرودگاه ساخته می‌شود", /searchAlibabaFlights\(rawInput[\s\S]{0,120}resolvedFlightInput\(rawInput\)/.test(flightsLib));
check("لینک رزرو هم کد فرودگاه می‌گیرد", /const route = resolvedFlightInput\(input\);\n  return `\$\{SITE_ROOT\}\/flights\/\$\{route\.origin\}/.test(flightsLib));

const transportLib = read("lib/transport-search.ts");
check("جست‌وجوی بلیت کد را در یک جا می‌سازد", transportLib.includes("function providerCodes"));
check("هر سه وسیله با کد فرستاده می‌شوند", (transportLib.match(/origin: providerInput\.origin/g) || []).length >= 3);
check("لینک اطلاعات بلیت با کد ساخته می‌شود", transportLib.includes('infoUrl(legacy, "plane", providerInput)'));

// ── 2) The question set is written inside the models' real ceiling ───────────
const quizRoute = read("app/api/quiz/questions/route.ts");
check("درخواست‌ها به سه بخش کوچک شکسته شده‌اند", /const CALLS = \[/.test(quizRoute) && (quizRoute.match(/count: 4/g) || []).length === 3);
check("هر درخواست زیر سقف ۹۰۰ توکن است", quizRoute.includes("maxTokens: 900"));
check("سؤال دوازده موضوع را پوشش می‌دهد", QUIZ_TOPICS.length === 12);
check("موضوع‌ها بین سه درخواست تقسیم شده‌اند", QUIZ_TOPICS.slice(0, 4).every((topic) => QUIZ_TOPICS.includes(topic)));

const fourQuestions = questionsPrompt({ origin: "تهران", travellers: 2, version: "v1", avoidPrompts: [], count: 4, topics: QUIZ_TOPICS.slice(0, 4) });
check("پرامپت تعداد خواسته‌شده را می‌گوید", fourQuestions.includes("۴ سؤال"));
check("پرامپت فقط موضوع‌های همان بخش را می‌خواهد", fourQuestions.includes("با چه کسی سفر می‌کند") && !fourQuestions.includes("چقدر شلوغی را می‌پسندد"));
check("پرامپت پیش‌فرض همان دوازده سؤال است", questionsPrompt({ origin: "", travellers: 1, version: "v", avoidPrompts: [] }).includes("۱۲ سؤال"));
check("پاسخ کوتاه مدل پذیرفته می‌شود", sanitizeQuestions([
    {
      key: "a",
      prompt: "با کی می‌ری؟",
      options: [
        { id: "a", label: "تنها", weights: { "شهری": 1 } },
        { id: "b", label: "خانواده", weights: { "طبیعت": 1 } },
        { id: "c", label: "دوستان", weights: { "شهری": 2 } },
        { id: "d", label: "همکار", weights: { "تاریخی": 1 } },
      ],
    },
  ], 6).length === 1);
check("مجموعهٔ نوشته‌شده کش می‌شود تا نفر بعدی معطل نماند", quizRoute.includes("getProviderCache") && quizRoute.includes("setProviderCache(cacheKey"));

// ── 3) One sentence: Persian numbers and cities that end in «از» ─────────────
const spoken = parseTripSentence("سه روز شیراز با قطار برای دو نفر با بیست میلیون");
check("شیراز از جمله خوانده می‌شود", spoken.destination === "شیراز", String(spoken.destination));
check("«سه روز» عدد می‌شود", spoken.days === 3, String(spoken.days));
check("«دو نفر» عدد می‌شود", spoken.travelers === 2, String(spoken.travelers));
check("«بیست میلیون» بودجه می‌شود", spoken.budgetMillions === 20, String(spoken.budgetMillions));
check("هیچ واقعیتی جا نمی‌افتد", spoken.missing.length === 0, spoken.missing.join("، "));

const digits = parseTripSentence("۵ روز با بچه، ۴۰ میلیون، از تهران");
check("با رقم هم همان نتیجه", digits.origin === "تهران" && digits.days === 5 && digits.budgetMillions === 40);
check("«با بچه» یک کودک و دو مسافر می‌شود", digits.children === 1 && digits.travelers === 2);
check("مقصد از خودمان ساخته نمی‌شود", digits.destination === null);

const other = parseTripSentence("یک هفته ساحل و آفتاب، ۶۰ میلیون، ۲ نفر، به کیش");
check("کیش با حرف اضافهٔ «به» خوانده می‌شود", other.destination === "کیش" && other.days === 7);

const proposal = localProposal(spoken, "");
check("پیشنهاد محلی همان شیراز را نگه می‌دارد", proposal.destination === "شیراز");
check("چیزی که مسافر گفت «فرض» حساب نمی‌شود", proposal.assumed.length === 0, proposal.assumed.join(" / "));

const modelPick = acceptProposal({ destination: "اصفهان", reason: "برای معماری و تاریخ ایران مناسب‌ترین انتخاب است." }, digits, localProposal(digits, "تهران"));
check("وقتی مسافر شهر را نگفته، انتخاب مدل از فهرست واقعی پذیرفته می‌شود", modelPick.destination === "اصفهان" && modelPick.source === "ai");
check("یادداشت فرض‌ها با شهر واقعی یکی است", modelPick.assumed.some((line) => line.includes("اصفهان")) && !modelPick.assumed.some((line) => line.includes("مشهد")));

const namedCity = parseTripSentence("سه روز شیراز با قطار");
const kept = acceptProposal({ destination: "اصفهان", reason: "این شهر برای معماری و تاریخ ایران بسیار مناسب است." }, namedCity, localProposal(namedCity, "تهران"));
check("شهر مسافر هرگز با انتخاب مدل عوض نمی‌شود", kept.destination === "شیراز");
const invented = acceptProposal({ destination: "آتلانتیس", reason: "شهری که وجود ندارد ولی خیلی خوب است." }, digits, localProposal(digits, "تهران"));
check("شهر ساختگی رد می‌شود", invented.destination !== "آتلانتیس");

check("متن نامفهوم ادعای فهمیدن نمی‌کند", parseTripSentence("سلام").understanding.includes("نفهمیدم"));

console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ round 44: پروازها کد فرودگاه می‌گیرند، سؤال‌ها داخل سقف نوشته می‌شوند، و یک جمله واقعاً خوانده می‌شود");
process.exit(failures ? 1 : 0);
