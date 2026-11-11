/**
 * Safarino is going to live on its own domain and server. Nothing may assume
 * the preview address, or the day the domain changes half the site breaks.
 */
import fs from "node:fs";
import { hostReference, siteReference, siteUrl, siteUrlFrom } from "../lib/site";

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`  ${ok ? "ok  " : "fail"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures += 1;
}

const read = (path: string) => fs.readFileSync(path, "utf8");
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const files = ["app", "components", "lib"].flatMap((dir) => walk(dir));

console.log("The address is configured once, not written everywhere");
const hardcoded = files.filter((file) => /safarino-mvp\.vercel\.app/.test(read(file)) && !file.endsWith("lib/site.ts"));
check("no source file hard-codes the preview address", hardcoded.length === 0, hardcoded.join(", ") || "none");
check("the share picture names the live host", read("lib/share-card.ts").includes("window.location.host"));
check("the share link is built from the request", read("app/api/share/route.ts").includes("siteUrlFrom(request)"));
check("provider user agents come from one place", !files.some((file) => /User-Agent[^\n]*safarino-mvp/.test(read(file))));
check("the AI referer is not localhost", !read("app/api/plan/route.ts").includes("localhost:3000"));

console.log("The helpers behave");
check("without configuration there is still a safe address", siteUrl().startsWith("http"));
check("the reference looks like an address", siteReference().includes("Safarino/1.0 (") && siteReference().includes("https://"));
const host = hostReference();
check("the host has no scheme and no trailing slash", !host.includes("://") && !host.endsWith("/"), host);
process.env.NEXT_PUBLIC_SITE_URL = "https://safarino.ir/";
check("a configured address is respected", siteUrl() === "https://safarino.ir", siteUrl());
check("the configured host reaches the reference", hostReference() === "safarino.ir", hostReference());
check("a bad configured value is ignored", (() => {
  process.env.NEXT_PUBLIC_SITE_URL = "not a url";
  const value = siteUrl();
  return value !== "not a url";
})());
process.env.NEXT_PUBLIC_SITE_URL = "https://safarino.ir";
const fromRequest = siteUrlFrom(new Request("https://preview.example.com/api/share"));
check("a configured address wins over the request host", fromRequest === "https://safarino.ir", fromRequest);
delete process.env.NEXT_PUBLIC_SITE_URL;
check("without configuration the request host is used", siteUrlFrom(new Request("https://travel.example.org/api/share")) === "https://travel.example.org");

console.log("Search engines are told the right things");
check("metadata has a base address", read("app/layout.tsx").includes("metadataBase"));
check("metadata declares a canonical home", read("app/layout.tsx").includes('canonical: "/"'));
check("robots.txt is generated", fs.existsSync("app/robots.ts"));
check("sitemap.xml is generated", fs.existsSync("app/sitemap.ts"));
const robots = read("app/robots.ts");
check("robots allows the public pages", robots.includes('"/plan"') && robots.includes('"/accommodation"'));
check("robots keeps shared plans out of the index", robots.includes('"/s/"'));
check("robots hides the api", robots.includes('"/api/"'));
check("robots points at the sitemap of the configured address", robots.includes("sitemap.xml") && robots.includes("siteUrl()"));
const sitemap = read("app/sitemap.ts");
check("the sitemap lists the public pages only", sitemap.includes('path: "/"') && !sitemap.includes("/s/"));
check("the sitemap is built from the configured address", sitemap.includes("siteUrl()"));
check("a shared plan is marked private", read("app/s/[code]/page.tsx").includes("index: false"));

console.log("Nothing points at a machine only the developer can reach");
check("no localhost addresses in the app", !files.some((file) => /http:\/\/localhost/.test(read(file)) && !file.endsWith("lib/site.ts")));

if (failures) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nPublic-site tests passed.");
