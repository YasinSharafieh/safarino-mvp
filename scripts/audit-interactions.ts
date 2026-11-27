/**
 * «همهٔ دکمه‌ها کار می‌کنند؟» — the interaction audit.
 *
 * A page can look finished and still be full of buttons that do nothing: a link
 * to an address that does not exist, a `fetch` to an API route that was renamed,
 * a button whose handler only sets state nobody reads, a `#` anchor left in a
 * hurry. This script walks the real source and checks the three links that make
 * an interface work:
 *
 *   ۱. every internal `href` points at a page that exists;
 *   ۲. every `/api/…` address used by the browser has a route file;
 *   ۳. no button is left with an empty handler, a `TODO`, or a `#` link.
 *
 * It prints what it checked, so a green run is a real answer and not a promise.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
let failures = 0;

function check(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  fail ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(ROOT, dir))) {
    const path = join(dir, entry);
    const stat = statSync(join(ROOT, path));
    if (stat.isDirectory()) walk(path, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(path);
  }
  return out;
}

/** Source with comments stripped — a comment is not a button. */
function code(path: string): string {
  return readFileSync(join(ROOT, path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

// ── What really exists ───────────────────────────────────────────────────────

const pages = walk("app")
  .filter((path) => path.endsWith("page.tsx"))
  .map((path) => path.replace(/^app/, "").replace(/\/page\.tsx$/, "") || "/");

const apiRoutes = walk("app/api")
  .filter((path) => path.endsWith("route.ts"))
  .map((path) => path.replace(/^app/, "").replace(/\/route\.ts$/, ""));

/** `/discover/شیراز` matches `/discover/[city]`. */
function pageExists(href: string): boolean {
  const clean = href.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
  if (pages.includes(clean)) return true;
  const segments = clean.split("/").filter(Boolean);
  return pages.some((page) => {
    const parts = page.split("/").filter(Boolean);
    if (parts.length !== segments.length) return false;
    return parts.every((part, index) => part.startsWith("[") || part === segments[index]);
  });
}

function apiExists(url: string): boolean {
  const clean = url.split("?")[0].replace(/\/$/, "");
  if (apiRoutes.includes(clean)) return true;
  const segments = clean.split("/").filter(Boolean);
  return apiRoutes.some((route) => {
    const parts = route.split("/").filter(Boolean);
    if (parts.length !== segments.length) return false;
    return parts.every((part, index) => part.startsWith("[") || part === segments[index]);
  });
}

// ── 1) Every internal link points somewhere real ─────────────────────────────

const clientFiles = [...walk("app"), ...walk("components")].filter((path) => path.endsWith(".tsx"));
/** Addresses can also be built in a helper the browser imports, so those count. */
const apiStringFiles = [...walk("lib")];
const broken: string[] = [];
const deadAnchors: string[] = [];
let linkCount = 0;

for (const file of clientFiles) {
  const source = code(file);
  const hrefs = Array.from(source.matchAll(/href=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/g)).map(
    (match) => match[1] ?? match[2] ?? match[3] ?? "",
  );
  for (const href of hrefs) {
    // Only static internal addresses can be checked without running the page.
    if (!href.startsWith("/")) continue;
    if (href.includes("${") || href.includes("[")) continue;
    /*
     * A `<link rel="preload" href="/fonts/…">` is a file, not a page: an address
     * with a file extension is served from `public/`, so the page map is the wrong
     * ruler for it.
     */
    if (/\.[a-z0-9]{2,5}$/i.test(href.split("?")[0])) continue;
    linkCount += 1;
    if (href === "/#" || href === "#" || href === "") {
      deadAnchors.push(`${relative(ROOT, file)} → ${href || "(empty)"}`);
      continue;
    }
    if (!pageExists(href)) broken.push(`${relative(ROOT, file)} → ${href}`);
  }
}

check("every internal link points at a page that exists", broken.length === 0, broken.slice(0, 12).join(" · ") || `${linkCount} links`);
check("no link is left as a bare «#»", deadAnchors.length === 0, deadAnchors.slice(0, 8).join(" · ") || "none");

// ── 2) Every API address the browser calls exists ────────────────────────────

const calledApis = new Map<string, string[]>();
const missingApis: string[] = [];

for (const file of [...clientFiles, ...apiStringFiles]) {
  const source = code(file);
  const urls = Array.from(source.matchAll(/["'`](\/api\/[a-zA-Z0-9/_\-[\]]*)["'`?]/g)).map((match) => match[1]);
  for (const url of urls) {
    const clean = url.replace(/\/$/, "");
    if (!calledApis.has(clean)) calledApis.set(clean, []);
    const list = calledApis.get(clean)!;
    if (!list.includes(file)) list.push(file);
    if (!apiExists(clean)) missingApis.push(`${relative(ROOT, file)} → ${clean}`);
  }
}

check("every API address called from the browser has a route file", missingApis.length === 0, missingApis.join(" · ") || `${calledApis.size} endpoints`);
check("the browser really uses a good part of the API", calledApis.size >= 12, `${calledApis.size} endpoints called`);

// ── 3) No button is left doing nothing ──────────────────────────────────────

const emptyHandlers: string[] = [];
const todoMarkers: string[] = [];

for (const file of clientFiles) {
  const source = code(file);
  if (/onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\}/.test(source)) emptyHandlers.push(`${relative(ROOT, file)} → empty onClick`);
  if (/onClick=\{\s*undefined\s*\}/.test(source)) emptyHandlers.push(`${relative(ROOT, file)} → onClick undefined`);
  if (/TODO|FIXME|coming soon|به‌زودی|not implemented|لم یتم/i.test(source)) {
    const match = /TODO|FIXME|coming soon|به‌زودی|not implemented|لم یتم/i.exec(source);
    todoMarkers.push(`${relative(ROOT, file)} → ${match?.[0]}`);
  }
}
check("no button has an empty handler", emptyHandlers.length === 0, emptyHandlers.slice(0, 8).join(" · ") || "none");
check("no screen promises something «coming soon»", todoMarkers.length === 0, todoMarkers.slice(0, 8).join(" · ") || "none");

// ── 4) A button that only sets state nobody reads ───────────────────────────

/**
 * The subtlest dead button: the handler runs, the state changes, and no part of
 * the page ever reads that state — so nothing visible happens. This is caught by
 * looking for a state variable that is assigned but never read outside its
 * setter.
 */
const unreadState: string[] = [];
for (const file of clientFiles) {
  const source = code(file);
  const declarations = Array.from(source.matchAll(/const\s+\[(\w+),\s*(set\w+)\]\s*=\s*useState/g)).map((match) => ({
    value: match[1],
    setter: match[2],
  }));
  for (const declaration of declarations) {
    // Remove the setter everywhere, and the declaration itself exactly once —
    // a dependency array such as `[reloadKey, other]` is a *read*, not the declaration.
    const withoutDeclaration = source.replace(new RegExp(`const\\s+\\[${declaration.value},\\s*${declaration.setter}\\]`), "");
    const used = withoutDeclaration.split(declaration.setter).join("");
    const reads = (used.match(new RegExp(`\\b${declaration.value}\\b`, "g")) || []).length;
    if (reads === 0) unreadState.push(`${relative(ROOT, file)} → ${declaration.value}`);
  }
}
check("no state is changed by a button and then never read", unreadState.length === 0, unreadState.slice(0, 10).join(" · ") || "none");

// ── 5) Every page has at least one way forward ──────────────────────────────

const noWayForward: string[] = [];
for (const path of pages) {
  const file = `app${path === "/" ? "" : path}/page.tsx`;
  const source = code(file);
  const hasLink = /href="\//.test(source) || /href=\{`\//.test(source) || /router\.push/.test(source);
  const imports = Array.from(source.matchAll(/from\s+"(@\/components\/[^"]+|@\/app\/[^"]+|\.\/[^"]+|\.[^"]+)"/g)).map((match) => match[1]);
  const componentLinks = imports.some((specifier) => {
    /*
     * `@/x` resolves from the repository root; `./x` and `../x` resolve from the
     * page's own folder — `/quiz` mounts `./TravelQuiz`, which lives next door.
     */
    const base = specifier.startsWith("@/")
      ? specifier.slice(2)
      : join(path === "/" ? "app" : `app${path}`, specifier).replace(/\\/g, "/");
    for (const candidate of [`${base}.tsx`, `${base}.ts`, `${base}/page.tsx`]) {
      try {
        const body = code(candidate.replace(/^\.\//, ""));
        if (/href="\//.test(body) || /router\.push/.test(body)) return true;
      } catch {
        /* try the next shape */
      }
    }
    return false;
  });
  if (!hasLink && !componentLinks && path !== "/" && !path.includes("[")) noWayForward.push(path);
}
check("every page offers a way to continue", noWayForward.length === 0, noWayForward.join(" · ") || "all pages");

// ── 6) The API the site calls is the API it serves ─────────────────────────

const unusedRoutes = apiRoutes.filter((route) => {
  const size = route.split("/").filter(Boolean).length;
  return !Array.from(calledApis.keys()).some((url) => url === route || url.startsWith(`${route}/`) || url.split("/").slice(0, size).join("/") === route);
});
const unusedServerOnly = unusedRoutes.filter((route) =>
  // Server-only or public-status endpoints. `/api/status` is read by the status
  // page on the server (it imports the same functions), so no browser calls it
  // directly — the same reason the cron and health routes are listed here.
  /^\/api\/(cron|provider-assets|providers|health|status|ai\/usage|route\/neshan-check)/.test(route),
);
const unusedReal = unusedRoutes.filter((route) => !unusedServerOnly.includes(route));
check("no user-facing API route is orphaned", unusedReal.length === 0, unusedReal.join(" · ") || "none");

console.log(
  failures
    ? `\n❌ ${failures} بررسی شکست خورد`
    : `\n✅ interaction audit: ${pages.length} صفحه، ${apiRoutes.length} مسیر API، ${linkCount} لینک داخلی — همه به جایی می‌رسند`,
);
process.exit(failures ? 1 : 0);
