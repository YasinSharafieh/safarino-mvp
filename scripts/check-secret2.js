const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('https://safarino-mvp.vercel.app/s/tjrjy3hk3', { waitUntil: 'domcontentloaded' });
  const html = await p.content();
  const m = html.match(/UPSTASH|neshan.*key/i);
  console.log('match:', m ? JSON.stringify(m[0]) : 'none');
  if (m) console.log('context:', JSON.stringify(html.slice(Math.max(0, m.index - 120), m.index + 120)));
  await b.close();
})();
