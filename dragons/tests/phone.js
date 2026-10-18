const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + require('path').resolve(__dirname, '../index.html')); await pg.waitForTimeout(1500);
  const sc = 390 / 540, oy = (844 - 960 * sc) / 2, L = (x, y) => [x * sc, oy + y * sc];
  await pg.mouse.click(...L(325, 700)); await pg.waitForTimeout(3500);
  const before = await pg.evaluate(() => [__game.state, __game.player.x | 0, __game.player.y | 0]);
  await pg.mouse.move(...L(270, 700)); await pg.mouse.down(); await pg.mouse.move(...L(200, 650), { steps: 5 });
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: '/tmp/claude-0/phone.png' });
  await pg.mouse.up();
  const after = await pg.evaluate(() => [__game.state, __game.player.x | 0, __game.player.y | 0, __game.arrows.length]);
  await pg.waitForTimeout(800);
  const shooting = await pg.evaluate(() => __game.arrows.length + __game.enemies[0].maxHp - __game.enemies[0].hp);
  console.log('before', before, 'after drag', after, 'shooting score', shooting, 'errors', errs);
  await b.close();
})();
