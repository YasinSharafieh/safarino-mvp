const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on('console', m => console.log('  page>', m.text().slice(0, 120)));
  await p.goto('https://safarino-mvp.vercel.app/offline', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  console.log('online visit ok:', (await p.innerText('body')).includes('اینترنتی نیست'));
  const kept = await p.evaluate(async () => {
    const names = await caches.keys();
    const out = {};
    for (const n of names) { const c = await caches.open(n); out[n] = (await c.keys()).map(r => new URL(r.url).pathname).slice(0, 8); }
    return out;
  });
  console.log('cache contents:', JSON.stringify(kept));
  await ctx.setOffline(true);
  const res = await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
  await p.waitForTimeout(2500);
  const t = await p.innerText('body').catch(() => '');
  console.log('offline reload:', res ? res.status() : 'failed', '| bytes', t.length, '|', JSON.stringify(t.slice(0, 120)));
  await b.close();
})();
