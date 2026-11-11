const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
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
  const body = await page.innerText('body');
  const grab = (label) => {
    const i = body.indexOf(label);
    return i >= 0 ? body.slice(i, i + 120).replace(/\n/g, ' | ') : 'MISSING';
  };
  console.log('card title:', body.includes('ریزش هزینه‌های این سفر'));
  console.log('real tags:', (body.match(/قیمت واقعی/g) || []).length, '| estimate tags:', (body.match(/تخمین با فرض شما/g) || []).length);
  console.log('total:', grab('جمع سفر (تا اینجا)'));
  console.log('budget:', grab('بودجهٔ شما'));
  console.log('remaining:', grab('باقی‌ماندهٔ بودجه'));
  console.log('stay line:', grab('هتل آپارتمان زاگرس مشهد · ۳ شب'));
  console.log('city drive line:', grab('کیلومتر اندازه‌گیری‌شده'));

  // change an assumption and watch the total move
  const food = page.locator('input[aria-label="خوراک هر نفر در روز"]').first();
  const before = await page.locator('b:has-text("تومان")').first().innerText().catch(() => '');
  await food.fill('900000');
  await page.waitForTimeout(900);
  const afterText = await page.innerText('body');
  const i = afterText.indexOf('جمع سفر (تا اینجا)');
  console.log('after raising food:', afterText.slice(i, i + 60).replace(/\n/g, ' | '));
  const saved = await page.evaluate(() => localStorage.getItem('safarino-budget-assumptions-v1'));
  console.log('assumption saved:', saved);
  await page.screenshot({ path: '/home/user/budget-itinerary.png', fullPage: false });

  // the printable book must show the same money, after the edit
  await page.goto('https://safarino-mvp.vercel.app/itinerary/print', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const printBody = await page.innerText('body');
  console.log('print has breakdown:', printBody.includes('جمع هزینه‌ها'), '| real tag:', printBody.includes('قیمت واقعی'), '| assumptions block:', printBody.includes('فرض‌های حساب‌شده'));
  const pi = printBody.indexOf('خوراک');
  console.log('print food row:', printBody.slice(pi, pi + 90).replace(/\n/g, ' | '));
  console.log('errors:', [...new Set(errors)].slice(0, 4));
  await browser.close();
})();
