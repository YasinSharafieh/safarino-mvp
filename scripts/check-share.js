const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('JS ' + e.message.slice(0, 90)));
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
  console.log('share panel:', (await page.innerText('body')).includes('فرستادن این برنامه'));

  // 1) build the short link
  await page.click('button:has-text("ساخت لینک اشتراک")');
  await page.waitForTimeout(6000);
  const link = await page.locator('input[aria-label="نشانی برنامهٔ به‌اشتراک‌گذاشته‌شده"]').inputValue().catch(() => '');
  console.log('link:', link);
  const wa = await page.locator('a:has-text("واتساپ")').getAttribute('href').catch(() => '');
  console.log('whatsapp link ok:', wa.startsWith('https://wa.me/?text='));

  // 2) the picture card
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }).catch(() => null),
    page.click('button:has-text("کارت تصویری برای واتساپ")'),
  ]);
  if (download) {
    await download.saveAs('/home/user/share-card.png');
    console.log('card downloaded:', download.suggestedFilename());
  } else {
    console.log('card: no download event (blob link path)');
  }
  await page.waitForTimeout(1500);
  console.log('card note:', (await page.innerText('body')).match(/کارت تصویری[^\n]{0,60}/g)?.slice(-1)[0] || 'none');
  await page.screenshot({ path: '/home/user/share-panel.png' });

  // 3) open the shared link as a stranger (fresh context, no storage)
  const guest = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const guestPage = await guest.newPage();
  const guestErrors = [];
  guestPage.on('pageerror', e => guestErrors.push(e.message.slice(0, 80)));
  const response = await guestPage.goto(link, { waitUntil: 'domcontentloaded' });
  await guestPage.waitForTimeout(3000);
  const body = await guestPage.innerText('body');
  console.log('shared page status:', response.status());
  console.log('shared page title ok:', body.includes('برنامهٔ سفر مشهد'), '| days shown:', (body.match(/روز ۲|روز ۳/g) || []).length > 0);
  console.log('weather on shared page:', body.includes('Open-Meteo') || body.includes('پیش‌بینی'));
  console.log('money on shared page:', body.includes('هزینهٔ تقریبی'), '| real label:', body.includes('واقعی'), '| estimate label:', body.includes('تخمین'));
  console.log('CTA to build own:', body.includes('ساخت برنامه با سفرینو'));
  console.log('no secrets in html:', !(await guestPage.content()).match(/UPSTASH|neshan.*key/i));
  await guestPage.screenshot({ path: '/home/user/shared-plan.png', fullPage: false });

  // 4) a wrong code must 404
  const bad = await guestPage.goto('https://safarino-mvp.vercel.app/s/zzzzzzzzz', { waitUntil: 'domcontentloaded' });
  console.log('unknown code status:', bad.status());
  console.log('errors:', [...new Set(errors)].slice(0, 3), 'guest errors:', guestErrors.slice(0, 3));
  await browser.close();
})();
