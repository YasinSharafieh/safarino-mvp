const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('JS ' + e.message.slice(0, 80)));
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
  await page.waitForTimeout(8000);
  const link = await page.locator('input[aria-label="نشانی برنامهٔ به‌اشتراک‌گذاشته‌شده"]').inputValue();
  console.log('link:', link, '| length:', link.length);
  console.log('mobile scrollWidth:', await page.evaluate(() => document.documentElement.scrollWidth));

  const guest = await browser.newPage();
  const guestErrors = [];
  guest.on('pageerror', e => guestErrors.push(e.message.slice(0, 60)));
  const response = await guest.goto(link, { waitUntil: 'domcontentloaded' });
  await guest.waitForTimeout(2500);
  const body = await guest.innerText('body');
  console.log('shared page:', response.status(), '| scrollWidth:', await guest.evaluate(() => document.documentElement.scrollWidth));
  console.log('natanz text gone:', !body.includes('نطنز'), '| mashhad stops present:', body.includes('حرم امام رضا') || body.includes('مسجد گوهرشاد'));
  const descIndex = body.indexOf('مسجد امام حسن');
  console.log('that stop text:', descIndex >= 0 ? body.slice(descIndex, descIndex + 160).replace(/\n/g, ' | ') : 'not in plan');
  await guest.screenshot({ path: '/home/user/shared-plan.png', fullPage: false });
  console.log('errors:', errors.slice(0, 3), 'guest:', guestErrors.slice(0, 3));
  await browser.close();
})();
