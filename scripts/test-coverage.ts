/**
 * The guard the owner asked for, ten times over: «همهٔ تغییرات باید در همهٔ
 * فازها باشد».
 *
 * This script does not trust anybody's memory. It opens the real page files and
 * checks that every capability declared in `lib/phase-coverage.ts` is actually
 * mounted in every phase that promised to show it. If a future change adds a
 * feature to one page and forgets the next, this test fails — before the build
 * reaches production.
 *
 * It also checks the two directions:
 *   - every phase file still exists (a renamed page cannot silently disappear);
 *   - the companion and the shared trip are global in the layout, so they really
 *     are on every screen without being repeated in every file.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAPABILITIES, PHASES, coverageRows, coverageSummary } from "../lib/phase-coverage";

const ROOT = join(process.cwd());
let failures = 0;

function check(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  fail ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/**
 * A page's real source is the page **plus the components it mounts**, because a
 * capability that lives inside `<TicketSearch />` is genuinely on the transport
 * page. Imports are followed two levels deep, which is enough for every
 * composition in this project and stops accidental recursion.
 */
function readWithComponents(path: string, depth = 2, seen = new Set<string>()): string {
  if (seen.has(path) || depth < 0) return "";
  seen.add(path);
  let source = "";
  try {
    source = read(path);
  } catch {
    return "";
  }
  if (depth === 0) return source;
  const imports = Array.from(source.matchAll(/from\s+"(@\/components\/[^"]+|@\/app\/[^"]+)"/g)).map((match) => match[1]);
  let combined = source;
  for (const specifier of imports) {
    const target = specifier.startsWith("@/") ? `./${specifier.slice(2)}` : specifier;
    for (const extension of [".tsx", ".ts"]) {
      try {
        combined += `\n${readWithComponents(`${target}${extension}`, depth - 1, seen)}`;
        break;
      } catch {
        // Try the next extension.
      }
    }
  }
  return combined;
}

console.log("پوشش فازها — هر قابلیت در هر فازی که باید");

// 1. Every declared phase file exists.
const missingFiles = PHASES.filter((phase) => {
  try {
    read(phase.file);
    return false;
  } catch {
    return true;
  }
});
check("همهٔ صفحه‌های فاز موجودند", missingFiles.length === 0, missingFiles.map((phase) => phase.file).join(", "));

// 2. The two global things really are global.
let layout = "";
try {
  layout = read("app/layout.tsx");
} catch {
  layout = "";
}
check("همسفر در layout سراسری است", layout.includes("TripCompanion"));
check("سفر مشترک در layout سراسری است", layout.includes("TravelProvider"));

/**
 * A phase's source is the page, the components it mounts, and its own sibling
 * layout (where a client page keeps its title and description).
 */
function readPhase(path: string): string {
  const withComponents = readWithComponents(path);
  try {
    return `${withComponents}\n${read(path.replace(/\/page\.tsx$/, "/layout.tsx"))}`;
  } catch {
    return withComponents;
  }
}

// 3. The matrix.
const rows = coverageRows((path) => readPhase(path));
for (const row of rows) {
  const where = row.capability.phases === "all" ? "همهٔ فازها" : row.capability.phases.join("، ");
  check(`${row.capability.label} (${where})`, row.ok, row.missing.length ? `نیست در: ${row.missing.join("، ")}` : undefined);
}

// 4. A capability declared for a phase must not silently become global.
const wronglyGlobal = CAPABILITIES.filter((capability) => capability.global && capability.phases !== "all");
check("قابلیت سراسری فقط چیزی است که واقعاً سراسری است", wronglyGlobal.length === 0, wronglyGlobal.map((entry) => entry.id).join(", "));

// 5. Every declaration names a real phase.
const unknownPhase = CAPABILITIES.flatMap((capability) =>
  capability.phases === "all" ? [] : capability.phases.filter((id) => !PHASES.some((phase) => phase.id === id)),
);
check("هیچ فاز ناشناخته‌ای در قرارداد نیست", unknownPhase.length === 0, unknownPhase.join(", "));

const summary = coverageSummary(rows);
console.log(`\n${summary.ok}/${summary.total} قابلیت در فازهای اعلام‌شده هست.`);
if (summary.failures.length) {
  for (const failure of summary.failures) console.log(`  ✗ ${failure}`);
}
console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ پوشش فازها کامل است: هر قابلیت در همان فازهایی هست که قول داده شده");
process.exit(failures ? 1 : 0);
