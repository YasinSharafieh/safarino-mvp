/**
 * «نیم‌فاصله و حروف درست».
 *
 * Attraction names and descriptions arrive from Wikipedia, Wikidata and Neshan
 * — real sources, but each with its own spelling habits: Arabic «ي» and «ك»,
 * «می شود» with a space, «باغ ها» without a half-space. Safarino shows the real
 * text, it just typesets it properly before it reaches the screen.
 *
 * The rules are deliberately conservative: only patterns that are wrong in
 * Persian are touched, so a place name is never reworded, only re-spaced.
 */

const ZWNJ = "\u200c";

const PREFIXES = ["می", "نمی"];
const PLURAL_SUFFIXES = ["", "ی", "یم", "یت", "یش", "یمان", "یتان", "یشان", "های", "هایی", "هایم", "هایت", "هایش", "هایمان", "هایتان", "هایشان"];

export function faText(input: string | null | undefined): string {
  if (!input) return "";
  let text = String(input);

  // The two Arabic letters that Persian never uses.
  text = text.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/ة/g, "ه");
  // A stray Arabic comma or semicolon next to Persian words.
  text = text.replace(/\s*،\s*/g, "، ").replace(/\s*؛\s*/g, "؛ ");

  // «می شود» → «می‌شود», «نمی توانم» → «نمی‌توانم»
  for (const prefix of PREFIXES) {
    text = text.replace(new RegExp(`(^|[\\s«"'(])${prefix}\\s+(?=[\\u0600-\\u06FF])`, "g"), `$1${prefix}${ZWNJ}`);
  }

  // «باغ ها» → «باغ‌ها», «خانه های» → «خانه‌های»
  for (const suffix of PLURAL_SUFFIXES) {
    const tail = suffix ? `\\s+${suffix}` : "\\s+ها";
    const replace = suffix ? `${ZWNJ}${suffix.startsWith("ها") ? suffix : `ها${suffix}`}` : `${ZWNJ}ها`;
    text = text.replace(new RegExp(`([\\u0600-\\u06FF]{2,})${tail}(?![\\u0600-\\u06FF])`, "g"), `$1${replace}`);
  }

  // «بزرگ تر» → «بزرگ‌تر», «بزرگ ترین» → «بزرگ‌ترین»
  text = text.replace(/([\u0600-\u06FF]{2,})\s+تر(?![ا-ی])/g, `$1${ZWNJ}تر`);
  text = text.replace(/([\u0600-\u06FF]{2,})\s+ترین(?![ا-ی])/g, `$1${ZWNJ}ترین`);

  // No double spaces, no space before a full stop.
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\s+([.،؛:!؟])/g, "$1").trim();
  return text;
}

/** For a list of names (attractions, providers, cities). */
export function faTextList(items: readonly (string | null | undefined)[]): string[] {
  return items.map((item) => faText(item)).filter(Boolean);
}
