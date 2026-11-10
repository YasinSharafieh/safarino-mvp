/**
 * Tests for the saved-answer store and the refresh policy:
 * a fresh copy is used as-is, an expired copy is served instantly while a
 * refresh runs, and a failed crawl never destroys what was already saved.
 *
 * Run with: npx tsx scripts/test-snapshot-store.ts
 */

let failures = 0;
function check(label: string, condition: boolean, detail = "") {
  if (condition) console.log(`  ok   ${label}`);
  else { failures += 1; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const realFetch = global.fetch;
const store = new Map<string, string>();

/** Stands in for Upstash Redis in exactly the commands provider-cache uses. */
function fakeUpstash(url: string, body: string): unknown {
  const parts = JSON.parse(body) as string[];
  const [command, key, value, , ttl] = parts;
  if (command === "GET") return store.has(key) ? store.get(key) : null;
  if (command === "SET") { store.set(key, value); return "OK"; }
  if (command === "INCR") { store.set(key, String(Number(store.get(key) || 0) + 1)); return Number(store.get(key)); }
  if (command === "EXPIRE") return 1;
  if (command === "DEL") { store.delete(key); return 1; }
  return null;
}

async function main() {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test";
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input.url);
    const result = fakeUpstash(url, String(init?.body || "[]"));
    return new Response(JSON.stringify({ result }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const { readWithRefresh, readFreshSnapshot, readStaleSnapshot, writeSnapshot, snapshotKey } = await import("../lib/snapshot-store");

  console.log("Key building");
  const first = snapshotKey("accommodation", { city: "مشهد", kind: "hotel", adults: 2 });
  const second = snapshotKey("accommodation", { adults: 2, kind: "hotel", city: "مشهد" });
  check("the same request gives the same key whatever the order", first === second, `${first} vs ${second}`);
  check("different requests give different keys", snapshotKey("accommodation", { city: "شیراز" }) !== snapshotKey("accommodation", { city: "مشهد" }));

  console.log("Writing keeps two copies");
  const base = snapshotKey("test", { id: 1 });
  await writeSnapshot(base, { hello: "world" }, 1_800, 86_400);
  check("fresh copy is readable", (await readFreshSnapshot<{ hello: string }>(base))?.hello === "world");
  check("last copy is readable", (await readStaleSnapshot<{ hello: string }>(base))?.value.hello === "world");

  console.log("Fresh hit never crawls");
  let crawls = 0;
  const fresh = await readWithRefresh<{ hello: string }>(base, async () => { crawls += 1; return { hello: "new" }; }, { ttlSeconds: 60 });
  check("source is fresh-cache", fresh.source === "fresh-cache", fresh.source);
  check("no crawl happened", crawls === 0, String(crawls));
  check("the saved value is returned", fresh.snapshot?.value.hello === "world");

  console.log("Expired copy is served instantly and refreshed in the background");
  const staleBase = snapshotKey("test", { id: 2 });
  store.clear();
  await writeSnapshot(staleBase, { value: "old" }, 60, 86_400);
  store.delete(`${staleBase}:fresh`); // simulate the short TTL running out
  let backgroundCrawls = 0;
  const stale = await readWithRefresh<{ value: string }>(staleBase, async () => { backgroundCrawls += 1; return { value: "new" }; }, { ttlSeconds: 60 });
  check("source is stale-cache", stale.source === "stale-cache", stale.source);
  check("old data is served without waiting", stale.snapshot?.value.value === "old");
  await stale.refreshed?.();
  check("the refresh ran once", backgroundCrawls === 1, String(backgroundCrawls));
  check("the saved copy is now the new one", (await readFreshSnapshot<{ value: string }>(staleBase))?.value === "new");

  console.log("A failed refresh keeps the last good answer");
  const failBase = snapshotKey("test", { id: 3 });
  store.clear();
  await writeSnapshot(failBase, { value: "good" }, 60, 86_400);
  store.delete(`${failBase}:fresh`);
  const failing = await readWithRefresh<{ value: string }>(failBase, async () => { throw new Error("provider down"); }, { ttlSeconds: 60 });
  await failing.refreshed?.();
  const stillThere = await readStaleSnapshot<{ value: string }>(failBase);
  check("the old answer survived a failed crawl", stillThere?.value.value === "good", JSON.stringify(stillThere?.value));

  console.log("An empty crawl result never overwrites a good answer");
  const nullBase = snapshotKey("test", { id: 4 });
  store.clear();
  await writeSnapshot(nullBase, { value: "kept" }, 60, 86_400);
  store.delete(`${nullBase}:fresh`);
  const empty = await readWithRefresh<{ value: string }>(nullBase, async () => null, { ttlSeconds: 60 });
  await empty.refreshed?.();
  check("still the old answer", (await readStaleSnapshot<{ value: string }>(nullBase))?.value.value === "kept");

  console.log("Nothing saved yet means a real crawl");
  store.clear();
  const coldBase = snapshotKey("test", { id: 5 });
  const cold = await readWithRefresh<{ value: string }>(coldBase, async () => ({ value: "live" }), { ttlSeconds: 60 });
  check("source is live", cold.source === "live", cold.source);
  check("no snapshot is returned", cold.snapshot === null);

  global.fetch = realFetch;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  if (failures) { console.log(`\n${failures} snapshot test(s) failed.`); process.exit(1); }
  console.log("\nSnapshot store tests passed.");
}

main().catch((error) => { global.fetch = realFetch; console.error(error); process.exit(1); });
