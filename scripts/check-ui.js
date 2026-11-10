const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const bad = [];
  page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 160)}`); });
  await page.goto('https://safarino-mvp.vercel.app/plan', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const imgs = await page.$$eval('img', els => els.map(e => ({ src: e.src, w: e.naturalWidth })));
  console.log('imgs:', imgs.length, 'loaded:', imgs.filter(i => i.w > 0).length, 'broken:', imgs.filter(i => i.w === 0).length);
  imgs.filter(i => i.w === 0).slice(0, 6).forEach(i => console.log('  BROKEN', decodeURIComponent(i.src.slice(0, 200))));
  [...new Set(bad)].slice(0, 8).forEach(b => console.log('  HTTP', decodeURIComponent(b)));
  await page.screenshot({ path: '/home/user/places-plan-top.png' });
  await browser.close();
})();
