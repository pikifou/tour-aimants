const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 1.25 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + require('path').resolve(__dirname, '../index.html'));
  await pg.waitForTimeout(3500);
  const out = process.argv[2] || '/tmp/claude-0/shots';
  require('fs').mkdirSync(out, { recursive: true });
  await pg.screenshot({ path: out + '/0_title.png' });
  const plan = JSON.parse(process.argv[3] || '[]');
  for (const step of plan) {
    await pg.evaluate(step.js);
    await pg.waitForTimeout(step.wait || 1000);
    if (step.shot) await pg.screenshot({ path: out + '/' + step.shot + '.png' });
  }
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
