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
import { rewritePrompt, applyRewrites, QUIZ_TOPICS } from "../lib/quiz-ai";
import { drawQuestions } from "../lib/start-flow";
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

// ── 2) Questions are reworded, never re-invented ─────────────────────────────
const quizRoute = read("app/api/quiz/questions/route.ts");
const bank = drawQuestions(() => 0.42, 12);
check("بانک داخلی دوازده سؤال واقعی دارد", bank.length === 12, `${bank.length}`);
check("درخواست به مدل کوتاه و تک‌مرحله‌ای است", quizRoute.includes("rewritePrompt(") && !quizRoute.includes("CALLS"));

const reworded = applyRewrites(bank, {
  questions: bank.slice(0, 9).map((question) => ({ key: question.key, prompt: `یک شکل تازه برای پرسیدن: ${question.prompt}`, aside: "یک جملهٔ مقدمه" })),
});
check("لحن تازه روی همان سؤال‌ها می‌نشیند", reworded.filter((question, index) => question.prompt !== bank[index].prompt).length === 9);
check("گزینه‌ها دست‌نخورده می‌مانند", reworded.every((question, index) => question.options.length === bank[index].options.length));
check("کلید ناشناخته پذیرفته نمی‌شود", applyRewrites(bank, { questions: [{ key: "ghost_key", prompt: "سؤالی که وجود ندارد", aside: "" }] }).every((question, index) => question.prompt === bank[index].prompt));
check("پاسخ خیلی کوتاه جدی گرفته نمی‌شود", applyRewrites(bank, { questions: [{ key: bank[0].key, prompt: "چی؟", aside: "" }] })[0].prompt === bank[0].prompt);
const halfRewritten = applyRewrites(bank, {
  questions: bank.slice(0, 6).map((question) => ({ key: question.key, prompt: `با لحنی کاملاً تازه: ${question.prompt}`, aside: "" })),
});
check("لحن مدل با کلید واقعی می‌نشیند", halfRewritten[2].prompt.includes("لحنی کاملاً تازه"));

const rewriteText = rewritePrompt({ questions: [{ key: "party", prompt: "با کی می‌ری؟", aside: "همراه" }], origin: "تهران", travellers: 2 });
check("پرامپت بازنویسی کلید را می‌دهد", rewriteText.includes("party") && rewriteText.includes("با کی می‌ری؟"));
check("پرامپت بازنویسی ساختن سؤال تازه را ممنوع می‌کند", rewriteText.includes("هیچ سؤال تازه‌ای نساز"));
check("سؤال دوازده موضوع را پوشش می‌دهد", QUIZ_TOPICS.length === 12);
check("مجموعهٔ بازنویسی‌شده کش می‌شود تا نفر بعدی معطل نماند", quizRoute.includes("getProviderCache") && quizRoute.includes("setProviderCache(cacheKey"));

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
