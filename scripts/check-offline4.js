const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
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
  await p.waitForTimeout(4000);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(6000);

  await ctx.setOffline(true);
  await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
  await p.waitForTimeout(4000);
  const t = await p.innerText('body');
  console.log('--- offline itinerary page ---');
  console.log(t.slice(0, 260).replace(/\n+/g, ' | '));
  console.log('has saved-copy notice:', t.includes('نسخهٔ ذخیره‌شده روی این دستگاه'));
  console.log('has stops:', t.includes('حرم امام رضا') || t.includes('ایستگاه'));
  console.log('scrollWidth:', await p.evaluate(() => document.documentElement.scrollWidth));
  await p.screenshot({ path: '/home/user/offline-mode.png' });

  const p2 = await ctx.newPage();
  const res2 = await p2.goto('https://safarino-mvp.vercel.app/quiz', { waitUntil: 'domcontentloaded' }).catch(e => null);
  await p2.waitForTimeout(3500);
  const t2 = await p2.innerText('body').catch(e => '<no body: ' + e.message + '>');
  console.log('--- unvisited page offline ---', res2 ? res2.status() : 'failed');
  console.log(t2.slice(0, 160).replace(/\n+/g, ' | '));
  await b.close();
})();
