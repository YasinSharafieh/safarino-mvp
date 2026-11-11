const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push('JS ' + e.message.slice(0, 90)));
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url().slice(0, 90)); });

  await page.goto('https://safarino-mvp.vercel.app/itinerary?city=' + encodeURIComponent('مشهد') + '&days=3', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(18000);
  const text = await page.innerText('body');
  console.log('days tabs:', (text.match(/روز [۰-۹]+ ·/g) || []).length);
  console.log('has map svg:', Boolean(await page.$('svg[role="img"]')));
  console.log('nav buttons:', (await page.$$('button:has-text("مسیریابی با نشان")')).length);
  console.log('lunch note:', text.includes('ناهار'));
  await page.screenshot({ path: '/home/user/itinerary-day.png', fullPage: false });
  // switch to day 2 and screenshot
  const tabs = await page.$$('button:has-text("روز ۲")');
  if (tabs.length) { await tabs[0].click(); await page.waitForTimeout(1500); }
  await page.screenshot({ path: '/home/user/itinerary-day2.png' });

  // Open the printable version and make a real PDF
  await page.goto('https://safarino-mvp.vercel.app/itinerary?city=' + encodeURIComponent('مشهد') + '&days=3', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(15000);
  await page.goto('https://safarino-mvp.vercel.app/itinerary/print', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const printText = await page.innerText('body');
  console.log('print page has cover:', printText.includes('دفترچهٔ سفر'));
  console.log('print page has budget table:', printText.includes('جمع هزینه‌ها'));
  const imgs = await page.$$eval('img', els => els.map(e => e.naturalWidth > 0));
  console.log('print images loaded:', imgs.filter(Boolean).length, '/', imgs.length);
  await page.pdf({ path: '/home/user/safarino-itinerary-sample.pdf', format: 'A4', printBackground: true });
  await page.screenshot({ path: '/home/user/itinerary-print-preview.png' });
  console.log('errors:', [...new Set(errors)].slice(0, 5));
  await browser.close();
})();
