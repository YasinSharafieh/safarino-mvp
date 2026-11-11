const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const errors = [];
  page.on('pageerror', e => errors.push('JS ' + e.message.slice(0, 90)));
  page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url().slice(0, 80)); });

  // Arrive as a traveller who has already chosen dates and an accommodation.
  await page.addInitScript(() => {
    const data = {
      origin: 'تهران', destination: 'مشهد', budget: 15, days: 3,
      departureDate: '2026-11-12', returnDate: '2026-11-15',
      travelers: 2, children: 0, infants: 0, tripStyle: 'فرهنگی', quizResult: '', quizStep: 4, quizAnswers: {},
      transport: null,
      accommodation: {
        status: 'selected', id: 'eghamat24-69', name: 'هتل آپارتمان زاگرس مشهد', typeLabel: 'هتل آپارتمان',
        cost: 4800000, pricePerNightToman: 1600000, city: 'مشهد', checkIn: '2026-11-12', checkOut: '2026-11-15', nights: 3,
        adults: 2, children: 0, infants: 0, latitude: 36.293323, longitude: 59.62743, provider: 'eghamat24',
      },
    };
    localStorage.setItem('safarino-travel-data-v1', JSON.stringify(data));
  });

  await page.goto('https://safarino-mvp.vercel.app/itinerary?city=' + encodeURIComponent('مشهد') + '&days=3', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(20000);
  const body = await page.innerText('body');
  console.log('weather strip:', /هوای روزهای سفر|هوای معمول/.test(body));
  console.log('advice line:', /چتر|گرم|صبح|متعادل/.test(body));
  console.log('suggestion shown:', body.includes('چیدمان بر اساس هوا'));
  const weatherCards = await page.$$('div.border-cyan-400\\/20 button');
  console.log('weather chips:', weatherCards.length);
  await page.screenshot({ path: '/home/user/weather-itinerary.png' });
  if (body.includes('چیدمان بر اساس هوا')) {
    await page.click('button:has-text("چیدمان بر اساس هوا")');
    await page.waitForTimeout(2500);
    console.log('after reorder:', (await page.innerText('body')).includes('روزها بر اساس هوا چیده شدند'));
    await page.screenshot({ path: '/home/user/weather-reordered.png' });
  }
  await page.goto('https://safarino-mvp.vercel.app/itinerary/print', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(9000);
  const printBody = await page.innerText('body');
  console.log('print has weather line:', /احتمال باران|بیشینه/.test(printBody));
  await page.pdf({ path: '/home/user/نمونه-دفترچه-سفر-مشهد.pdf', format: 'A4', printBackground: true });
  console.log('errors:', [...new Set(errors)].slice(0, 4));
  await browser.close();
})();
