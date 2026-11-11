const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    localStorage.setItem('safarino-travel-data-v1', JSON.stringify({
      origin: 'تهران', destination: 'مشهد', budget: 15, days: 3, departureDate: '2026-11-12', returnDate: '2026-11-15',
      travelers: 2, children: 0, infants: 0, tripStyle: '', quizResult: '', quizStep: 4, quizAnswers: {},
      transport: { vehicleId: 'car', cost: 2000000, provider: 'car', providerLabel: 'خودروی شخصی' },
      accommodation: { status: 'selected', id: 'e1', name: 'هتل آپارتمان زاگرس مشهد', cost: 4800000, city: 'مشهد', nights: 3, typeLabel: 'هتل آپارتمان', latitude: 36.293323, longitude: 59.62743, provider: 'eghamat24' },
    }));
  });
  await p.goto('https://safarino-mvp.vercel.app/itinerary?city=' + encodeURIComponent('مشهد') + '&days=3', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(16000);
  await p.click('button:has-text("ذخیره برای آفلاین")');
  await p.waitForTimeout(5000);
  await p.waitForTimeout(2000);
  // reload once online so the page itself is definitely in the cache
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(6000);

  await ctx.setOffline(true);
  const res = await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
  await p.waitForTimeout(4000);
  const text = await p.innerText('body').catch(() => '');
  console.log('status:', res ? res.status() : 'failed', '| bytes:', text.length);
  console.log('has plan title:', text.includes('برنامهٔ سفر مشهد'));
  console.log('has day tabs:', text.includes('روز ۱'));
  console.log('offline page?', text.includes('اینترنتی نیست'));

  const p2 = await ctx.newPage();
  await p2.goto('https://safarino-mvp.vercel.app/quiz', { waitUntil: 'domcontentloaded' }).catch(() => null);
  await p2.waitForTimeout(3500);
  const t2 = await p2.innerText('body').catch(() => '');
  console.log('unvisited offline page shows offline notice:', t2.includes('اینترنتی نیست'));
  await p2.screenshot({ path: '/home/user/offline-page.png' });
  await b.close();
})();
