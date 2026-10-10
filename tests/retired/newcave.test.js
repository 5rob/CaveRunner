// Dev → New cave: rolls this floor again with a fresh seed, closes the panel, puts you at
// the shop start, and the game runs on. Dev → Floor 2 goes to floor 2, in floor 2's Dev colours.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  const THEMES_N = await page.evaluate(() => THEMES.length);
  const before = await page.evaluate(() => {
    const L = window.__lvl; L.p.x += 40;
    let open = 0; for (let i = 0; i < L.mat.length; i++) if (!L.mat[i]) open++;
    return { seed: L.seed, floor: L.floor, open };
  });

  await page.tap('.devbtn');
  await page.waitForTimeout(150);
  check('the Dev panel has a Spawn level button', await page.$('.dbg.spawnlevel') !== null);
  await page.tap('.dbg.spawnlevel');
  await page.waitForTimeout(150);
  check('it lists every floor, yours lit', (await page.$$('.lvlgo')).length === THEMES_N && await page.$('.lvlgo.on[data-floor="1"]') !== null);
  await page.tap('.lvlgo[data-floor="1"]');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const L = window.__lvl;
    let open = 0; for (let i = 0; i < L.mat.length; i++) if (!L.mat[i]) open++;
    return { seed: L.seed, floor: L.floor, open, dev: !!document.querySelector('.devpanel'),
      paused: window.__in.current.paused, dx: Math.round(L.p.x - L.start.x) };
  });
  check('a new seed on the same floor', after.seed !== before.seed && after.floor === before.floor, { before, after });
  check('the cave itself changed', after.open !== before.open, { before: before.open, after: after.open });
  check('the panel closed and the game runs', !after.dev && after.paused === false, after);
  check('you are back at the shop start', Math.abs(after.dx) < 20, after.dx);

  // Floor 2, with a Dev colour for its background
  await page.evaluate(() => { DEV.l2Bg = '#ff00ff'; });
  await page.tap('.devbtn');
  await page.waitForTimeout(150);
  await page.tap('.dbg.spawnlevel');
  await page.waitForTimeout(150);
  await page.tap('.lvlgo[data-floor="2"]');
  await page.waitForTimeout(400);
  const two = await page.evaluate(() => ({ floor: window.__lvl.floor, theme: window.__lvl.theme, bg: themeFor(2).bg.join(),
    dev: !!document.querySelector('.devpanel') }));
  check('Floor 2 goes to floor 2', two.floor === 2 && two.theme === 'Tombs' && !two.dev, two);
  check('in its Dev colours', two.bg === '255,0,255', two.bg);
  await page.evaluate(() => { DEV.l2Bg = DEV_DEFAULTS.l2Bg; });

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
