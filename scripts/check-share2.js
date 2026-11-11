const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 200)); });
  page.on('response', async r => {
    if (r.url().includes('/api/share')) {
      console.log('RESP', r.status(), (await r.text()).slice(0, 300));
    }
  });
  page.on('requestfailed', r => { if (r.url().includes('/api/share')) console.log('REQFAIL', r.failure()?.errorText); });
  await page.addInitScript(() => {
    localStorage.setItem('safarino-travel-data-v1', JSON.stringify({
      origin: 'تهران', destination: 'مشهد', budget: 15, days: 3, departureDate: '2026-11-12', returnDate: '2026-11-15',
      travelers: 2, children: 1, infants: 0, tripStyle: '', quizResult: '', quizStep: 4, quizAnswers: {},
      transport: { vehicleId: 'car', cost: 2000000, provider: 'car', providerLabel: 'خودروی شخصی' },
      accommodation: { status: 'selected', id: 'eghamat24-69', name: 'هتل آپارتمان زاگرس مشهد', cost: 4800000, city: 'مشهد', nights: 3, typeLabel: 'هتل آپارتمان', latitude: 36.293323, longitude: 59.62743, provider: 'eghamat24' },
    }));
  });
  await page.goto('https://safarino-mvp.vercel.app/itinerary?city=' + encodeURIComponent('مشهد') + '&days=3', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(20000);
  await page.click('button:has-text("ساخت لینک اشتراک")');
  await page.waitForTimeout(12000);
  const body = await page.innerText('body');
  const i = body.indexOf('فرستادن این برنامه');
  console.log('panel text:', body.slice(i, i + 400).replace(/\n/g, ' | '));
  await browser.close();
})();
