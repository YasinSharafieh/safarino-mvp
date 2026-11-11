/**
 * The Persian text must look the same on every device and must not depend on a
 * server that is blocked inside Iran. These checks keep the font local.
 */
import fs from "node:fs";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const layout = fs.readFileSync("app/layout.tsx", "utf8");
const globals = fs.readFileSync("app/globals.css", "utf8");
const card = fs.readFileSync("lib/share-card.ts", "utf8");
const fontPath = "public/fonts/Vazirmatn-Variable.woff2";

console.log("The font travels with the site");
check("the font file is in the project", fs.existsSync(fontPath));
const size = fs.existsSync(fontPath) ? fs.statSync(fontPath).size : 0;
check("it is a real font file", size > 30_000, `${Math.round(size / 1024)} KB`);
const header = fs.existsSync(fontPath) ? fs.readFileSync(fontPath).subarray(0, 4).toString("ascii") : "";
check("it is woff2", header === "wOF2", header);
check("globals.css declares it itself", globals.includes('@font-face') && globals.includes('font-family: "Vazirmatn"'));
check("the declaration points at the local file", globals.includes('url("/fonts/Vazirmatn-Variable.woff2")'));
check("every weight is covered", /font-weight:\s*100 900/.test(globals));
check("text is shown at once while it loads", globals.includes("font-display: swap"));
check("the body actually uses it", /font-family:\s*"Vazirmatn"/.test(globals));
check("the page preloads its own font", layout.includes('href="/fonts/Vazirmatn-Variable.woff2"') && layout.includes('as="font"'));

console.log("Nothing is fetched from a font server");
check("no Google Fonts stylesheet", !layout.includes("fonts.googleapis.com"));
check("no Google Fonts files", !layout.includes("fonts.gstatic.com"));
check("no third-party font anywhere in the app", !/fonts\.(googleapis|gstatic)\.com/.test(globals) && !/fonts\.(googleapis|gstatic)\.com/.test(layout));

console.log("The shared picture uses the same letters");
check("the card asks for Vazirmatn", card.includes("Vazirmatn"));
check("the card waits for the font before drawing", card.includes("waitForCardFont") && card.includes("document.fonts.load"));

console.log("Persian letters are covered by the font range");
const range = globals.match(/unicode-range:\s*([^;]+);/)?.[1] || "";
check("Arabic/Persian block is included", range.includes("U+0600-06FF"));
check("the zero-width non-joiner (نیم‌فاصله) is included", range.includes("200C"));
check("Latin letters and digits are included", range.includes("U+0000-00FF"));

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nFont tests passed.");
