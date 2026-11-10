const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const bad = [];
  page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(0, 110)); });
  const q = new URLSearchParams({ kind: 'hotel', city: 'مشهد', checkIn: '2026-11-20', checkOut: '2026-11-23', adults: '2' });
  await page.goto('https://safarino-mvp.vercel.app/accommodation/eghamat24-69?' + q.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(20000);
  const section = await page.$('section[aria-label="اطراف این اقامتگاه"]');
  console.log('nearby section:', Boolean(section));
  if (!section) { console.log((await page.innerText('body')).slice(0, 200)); await browser.close(); return; }
  const items = await section.$$eval('img', els => els.map(e => ({ ok: e.naturalWidth > 0, src: decodeURIComponent(e.src).slice(0, 76) })));
  console.log('nearby images:', items.length, 'loaded:', items.filter(i => i.ok).length);
  items.slice(0, 4).forEach(i => console.log('  ', i.ok ? 'ok ' : 'BAD', i.src));
  console.log('chip:', await section.$eval('span.chip', e => e.innerText).catch(() => '?'));
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(2500);
  await section.screenshot({ path: '/home/user/places-nearby-hotel.png' });
  console.log('http errors:', [...new Set(bad)].slice(0, 4));
  await browser.close();
})();
