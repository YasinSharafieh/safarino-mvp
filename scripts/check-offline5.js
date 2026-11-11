const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto('https://safarino-mvp.vercel.app/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(4000);
  await ctx.setOffline(true);
  for (const path of ['/quiz', '/transport', '/offline', '/plan']) {
    const page = await ctx.newPage();
    const res = await page.goto('https://safarino-mvp.vercel.app' + path, { waitUntil: 'domcontentloaded' }).catch(() => null);
    await page.waitForTimeout(2500);
    let text = '';
    try { text = await page.innerText('body'); } catch { text = '<none>'; }
    const html = res ? (await res.text().catch(() => '')).length : 0;
    console.log(path, '→', res ? res.status() : 'failed', '| html bytes', html, '| text:', JSON.stringify(text.slice(0, 60)));
    await page.close();
  }
  await b.close();
})();
