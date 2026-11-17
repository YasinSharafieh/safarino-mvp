/**
 * Prints the phase-coverage matrix as Persian markdown, straight from the
 * contract in `lib/phase-coverage.ts` and the real source files.
 *
 * The point: the promise «این قابلیت در این فازها هست» should be readable by a
 * person, not only checkable by a test. Run with:
 *   npx tsx scripts/coverage-report.ts > ../ماتریس-پوشش-فازها.md
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPABILITIES, PHASES, coverageRows } from "../lib/phase-coverage";

function read(path: string): string {
  try {
    return readFileSync(join(process.cwd(), path), "utf8");
  } catch {
    return "";
  }
}

function readWithComponents(path: string, depth = 2, seen = new Set<string>()): string {
  if (seen.has(path) || depth < 0) return "";
  seen.add(path);
  const source = read(path);
  if (!source || depth === 0) return source;
  const imports = Array.from(source.matchAll(/from\s+"(@\/components\/[^"]+|@\/app\/[^"]+)"/g)).map((match) => match[1]);
  let combined = source;
  for (const specifier of imports) {
    const target = `./${specifier.slice(2)}`;
    for (const extension of [".tsx", ".ts"]) {
      const body = readWithComponents(`${target}${extension}`, depth - 1, seen);
      if (body) {
        combined += `\n${body}`;
        break;
      }
    }
  }
  return combined;
}

const rows = coverageRows((path) => readWithComponents(path));
const generated = new Date().toISOString().slice(0, 10);

const lines: string[] = [];
lines.push("# ماتریس پوشش فازها — سفرینو");
lines.push("");
lines.push(`این فایل از خودِ کد ساخته می‌شود (\`lib/phase-coverage.ts\`)، نه از حافظهٔ کسی. اگر روزی قابلیتی از یک صفحه جا بیفتد، تست \`scripts/test-coverage.ts\` همان لحظه شکست می‌خورد و این جدول هم عوض می‌شود.`);
lines.push("");
lines.push(`آخرین ساخت: ${generated}`);
lines.push("");
lines.push("## فازهای سفر");
lines.push("");
lines.push("| # | فاز | آدرس | کار این فاز |");
lines.push("|---|---|---|---|");
PHASES.forEach((phase, index) => {
  lines.push(`| ${index + 1} | ${phase.id} | \`${phase.path}\` | ${phase.role} |`);
});
lines.push("");
lines.push("## قابلیت‌ها و فازهایی که در آن‌ها هست");
lines.push("");
lines.push("| قابلیت | کجا باید باشد | وضعیت | توضیح |");
lines.push("|---|---|---|---|");
for (const row of rows) {
  const where = row.capability.phases === "all" ? "همهٔ فازها (سراسری)" : row.capability.phases.join("، ");
  lines.push(`| ${row.capability.label} | ${where} | ${row.ok ? "✅ کامل" : `❌ جا افتاده در ${row.missing.join("، ")}`} | ${row.capability.note || ""} |`);
}
lines.push("");
const okCount = rows.filter((row) => row.ok).length;
lines.push(`**جمع:** ${okCount} از ${rows.length} قابلیت در همهٔ فازهای اعلام‌شده هست.`);
lines.push("");
lines.push("## قانون کار");
lines.push("");
lines.push("1. هر قابلیت جدید، همان روز در `lib/phase-coverage.ts` برای همهٔ فازهایی که معنی دارد اعلام می‌شود.");
lines.push("2. اگر جایی عمداً نیست، دلیلش در همان فایل نوشته می‌شود؛ «جا افتاده» با «تصمیم» فرق دارد.");
lines.push("3. تست پوشش قبل از هر انتشار اجرا می‌شود؛ اگر شکست بخورد، انتشار انجام نمی‌شود.");
lines.push("4. صفحه‌هایی که قابلیت را از طریق یک کامپوننت فرزند نشان می‌دهند هم پذیرفته می‌شوند (تست، importها را دنبال می‌کند).");
lines.push("");

console.log(lines.join("\n"));
