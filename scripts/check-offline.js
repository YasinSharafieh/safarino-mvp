const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('JS ' + e.message.slice(0, 70)));
  await p.addInitScript(() => {
    localStorage.setItem('safarino-travel-data-v1', JSON.stringify({
      origin: 'تهران', destination: 'مشهد', budget: 15, days: 3, departureDate: '2026-11-12', returnDate: '2026-11-15',
      travelers: 2, children: 0, infants: 0, tripStyle: '', quizResult: '', quizStep: 4, quizAnswers: {},
      transport: { vehicleId: 'car', cost: 2000000, provider: 'car', providerLabel: 'خودروی شخصی' },
      accommodation: { status: 'selected', id: 'e1', name: 'هتل آپارتمان زاگرس مشهد', cost: 4800000, city: 'مشهد', nights: 3, typeLabel: 'هتل آپارتمان', latitude: 36.293323, longitude: 59.62743, provider: 'eghamat24' },
    }));
  });

  await p.goto('https://safarino-mvp.vercel.app/itinerary?city=' + encodeURIComponent('مشهد') + '&days=3', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(18000);

  // worker registered and activated?
  const sw = await p.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { registered: Boolean(reg), active: Boolean(reg?.active), scope: reg?.scope };
  });
  console.log('service worker:', sw);

  const offlineBlock = await p.locator('text=نسخهٔ آفلاین').first().innerText().catch(() => '');
  console.log('offline note:', offlineBlock.slice(0, 90));

  await p.click('button:has-text("ذخیره برای آفلاین")');
  await p.waitForTimeout(6000);
  console.log('button says saved:', (await p.innerText('body')).includes('ذخیره شد'));

  // what did the worker keep?
  const kept = await p.evaluate(async () => {
    const names = await caches.keys();
    const out = {};
    for (const name of names) {
      const cache = await caches.open(name);
      out[name] = (await cache.keys()).length;
    }
    return out;
  });
  console.log('caches:', kept);

  // now cut the network entirely and reload the page
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const reload = await p.reload({ waitUntil: 'domcontentloaded' }).catch(e => ({ status: () => 'failed' }));
  await p.waitForTimeout(4000);
  const offlineBody = await p.innerText('body').catch(() => '');
  console.log('offline reload status:', typeof reload.status === 'function' ? reload.status() : reload);
  console.log('plan visible offline:', offlineBody.includes('برنامهٔ سفر مشهد') || offlineBody.includes('روز ۱'));
  console.log('offline page shown when needed:', offlineBody.includes('اینترنتی نیست') || offlineBody.includes('بدون اینترنت'));

  // a page never visited must show the offline page
  const fresh = await ctx.newPage();
  const to = await fresh.goto('https://safarino-mvp.vercel.app/quiz', { waitUntil: 'domcontentloaded' }).catch(() => null);
  await fresh.waitForTimeout(3000);
  const freshBody = await fresh.innerText('body').catch(() => '');
  console.log('unvisited page offline →', to ? to.status() : 'failed', '| offline page:', freshBody.includes('اینترنتی نیست'));
  await p.screenshot({ path: '/home/user/offline-mode.png' });
  console.log('errors:', [...new Set(errors)].slice(0, 3));
  await b.close();
})();
