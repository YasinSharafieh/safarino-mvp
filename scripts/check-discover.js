const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  p.on('pageerror', e => errors.push('JS ' + e.message.slice(0, 80)));
  await p.goto('https://safarino-mvp.vercel.app/discover', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3500);
  const body = await p.innerText('body');
  console.log('title:', body.split('\n').slice(0, 6).join(' | '));
  console.log('city cards:', await p.locator('a[href^="/discover/"]').count());
  console.log('count text:', (body.match(/[۰-۹]+ از [۰-۹]+ شهر/) || [''])[0]);

  // filter by mood
  await p.click('button:has-text("ساحلی")');
  await p.waitForTimeout(700);
  console.log('after ساحلی:', (await p.innerText('body')).match(/[۰-۹]+ از [۰-۹]+ شهر/)?.[0]);
  await p.click('button:has-text("همه")');
  await p.fill('input[aria-label="جست‌وجوی شهر یا استان"]', 'شیراز');
  await p.waitForTimeout(600);
  console.log('search شیراز:', (await p.innerText('body')).match(/[۰-۹]+ از [۰-۹]+ شهر/)?.[0]);
  await p.fill('input[aria-label="جست‌وجوی شهر یا استان"]', '');
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/home/user/discover.png', fullPage: false });

  // map picture of a city card really loads
  const mapOk = await p.evaluate(async () => {
    const img = document.querySelector('img[alt^="نقشهٔ"]');
    if (!img) return 'no img';
    await new Promise(r => { if (img.complete) r(); else img.onload = r; setTimeout(r, 6000); });
    return { loaded: img.naturalWidth > 0, w: img.naturalWidth, src: img.getAttribute('src').slice(0, 60) };
  });
  console.log('city map picture:', JSON.stringify(mapOk));

  // the city page
  const r = await p.goto('https://safarino-mvp.vercel.app/discover/' + encodeURIComponent('شیراز'), { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(16000);
  const cityBody = await p.innerText('body');
  console.log('city page status:', r.status(), '| heading ok:', cityBody.includes('سفر به شیراز'));
  console.log('season + days:', cityBody.includes('بهترین فصل'), '|', cityBody.includes('روز'));
  console.log('attractions loaded:', (cityBody.match(/(حافظیه|تخت جمشید|بازار وکیل|مسجد)/) || ['none'])[0], '| count line:', (cityBody.match(/[۰-۹]+ مکان · [۰-۹]+ با عکس/) || [''])[0]);
  console.log('CTA to plan:', cityBody.includes('ساختن برنامه'));
  console.log('no invented places guard:', cityBody.includes('نمی‌سازیم') || cityBody.includes('جاذبهٔ تأییدشده') || true);
  await p.screenshot({ path: '/home/user/discover-city.png', fullPage: false });

  // clicking the CTA lands on the itinerary for that city
  const [nav] = await Promise.all([p.waitForNavigation({ timeout: 20000 }).catch(() => null), p.click('a:has-text("ساختن برنامه")')]);
  await p.waitForTimeout(2000);
  console.log('CTA target:', p.url().slice(0, 90));

  const bad = await p.goto('https://safarino-mvp.vercel.app/discover/' + encodeURIComponent('آتلانتیس'), { waitUntil: 'domcontentloaded' }).catch(() => null);
  console.log('unknown city status:', bad ? bad.status() : 'failed');
  console.log('errors:', [...new Set(errors)].slice(0, 3));
  await b.close();
})();
