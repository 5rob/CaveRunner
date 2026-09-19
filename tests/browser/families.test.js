const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, colorScheme: 'dark' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    window.__lvl.p.x = 30;
    const LO = window.__in.current.loadout;
    LO.bag.push('bolt', 'slug', 'blast', 'dmg_up', 'heavy', 'speed', 'light',
      'homing', 'bounce', 'scatter', 'double', 'fast', 'cold', 'battery');
    LO.guns[0].slots = ['double', 'dmg_up', 'bolt', 'speed'];
    LO.guns[0].cap = 4; resetGun(LO.guns[0]);
    window.__in.current.notify();
  });
  await page.tap('.weapon');
  await page.waitForTimeout(320);

  const tiles = await page.evaluate(() => [...document.querySelectorAll('.bag .tile')]
    .map(t => ({ mod: t.dataset.mod, col: getComputedStyle(t).borderColor })));
  const by = {};
  for (const t of tiles) (by[t.col] = by[t.col] || []).push(t.mod);
  console.log(JSON.stringify(by, null, 1));

  const same = (...ids) => {
    const cols = new Set(ids.map(i => tiles.find(t => t.mod === i).col));
    return cols.size === 1;
  };
  const differ = (a, b) => tiles.find(t => t.mod === a).col !== tiles.find(t => t.mod === b).col;
  check('every bullet type shares one colour', same('bolt', 'slug', 'blast'), by);
  check('damage mods share another', same('dmg_up', 'heavy'));
  check('speed mods share another', same('speed', 'light'));
  check('flight mods share another', same('homing', 'bounce'));
  check('pattern mods share another', same('scatter', 'double'));
  check('upkeep mods share another', same('fast', 'cold', 'battery'));
  check('shots are not the same colour as speed mods', differ('bolt', 'speed'));
  check('damage is not the same as shots', differ('dmg_up', 'bolt'));
  check('pattern is not the same as shots', differ('scatter', 'bolt'));
  check('exactly six families on screen', Object.keys(by).length === 6, Object.keys(by).length);

  const legend = await page.evaluate(() => [...document.querySelectorAll('.lg')]
    .map(l => ({ name: l.textContent, col: getComputedStyle(l.querySelector('i')).backgroundColor })));
  // the legend covers every family the game has, not just the ones in this bag
  const families = await page.evaluate(() => Object.keys(FAMILIES).length);
  check('a legend explains every family', legend.length === families,
    { legend: legend.map(l => l.name), families });
  check('and every tile colour is in it',
    Object.keys(by).every(col => legend.some(l => l.col === col)),
    { legend: legend.map(l => l.col), tiles: Object.keys(by) });

  // the card names the family
  const b = await (await page.$$('.bag .tile'))[5].boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(220);
  const sub = await page.evaluate(() => document.querySelector('.pop:not(.ingame) .ptitle span').textContent);
  check('the card says which family a mod is in', /speed & range/i.test(sub), sub);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'families.png') });
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
