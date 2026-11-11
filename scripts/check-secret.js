const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('https://safarino-mvp.vercel.app/s/tjrjy3hk3', { waitUntil: 'domcontentloaded' });
  const html = await p.content();
  for (const pattern of [/UPSTASH[^"']{0,40}/i, /neshan[^"']{0,40}key/i, /NESHAN[^"']{0,30}/, /service[_-]?key/i]) {
    const m = html.match(pattern);
    console.log(pattern.source, '→', m ? JSON.stringify(m[0].slice(0, 80)) : 'none');
  }
  await b.close();
})();
