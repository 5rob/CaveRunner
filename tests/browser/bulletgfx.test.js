const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__lvl.p.x = 30; });
  const setSlots = slots => page.evaluate(sl => {
    const g = window.__in.current.loadout.guns[0];
    g.cap = sl.length; g.slots = sl.slice(); g.shuffle = false; resetGun(g);
    window.__in.current.notify();
  }, slots);
  const read = () => page.evaluate(() => [...document.querySelectorAll('.slotRow .grp')].map(gp => ({
    label: gp.querySelector('.glab').textContent,
    fx: [...gp.querySelectorAll('.fx')].map(f => ({
      t: f.textContent, dir: /up/.test(f.className) ? 'up' : /down/.test(f.className) ? 'down' : '' })),
  })));

  await setSlots(['double', 'dmg_up', 'bolt', 'bolt', 'homing', 'slug']);
  await page.tap('.weapon');
  await page.waitForTimeout(320);
  let g = await read();
  console.log(JSON.stringify(g, null, 1));
  check('every pull gets a stat line', g.length === 2 && g[0].fx.length > 0 && g[1].fx.length > 0, g.map(x => x.fx.length));
  check('the multicast pull totals both bolts', g[0].fx.some(f => /dmg5/.test(f.t.replace(/\s/g, ''))), g[0].fx.map(f => f.t));
  check('and credits Damage Plus as a gain', g[0].fx.some(f => f.dir === 'up' && /dmg/.test(f.t)), g[0].fx);
  check('extra mana cost is marked as a cost', g[0].fx.some(f => f.dir === 'down' && /mana/.test(f.t)), g[0].fx);
  check('the second pull shows its own homing', g[1].fx.some(f => /homing/.test(f.t) && f.dir === 'up'), g[1].fx.map(f => f.t));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'gfx.png') });

  // an unmodified pull shows plain values with no deltas
  await setSlots(['bolt', 'bolt']);
  await page.waitForTimeout(250);
  g = await read();
  check('a bare shot shows values but no deltas', g[0].fx.every(f => f.dir === ''), g[0].fx);
  check('and still lists damage, mana and delay', g[0].fx.length === 3, g[0].fx.map(f => f.t));

  // the "never cast" group has no stat line
  await setSlots(['bolt', 'dmg_up']);
  await page.waitForTimeout(250);
  g = await read();
  check('never-cast leftovers get no stats', g[1].fx.length === 0, g[1]);

  // it updates as you drag
  await setSlots(['bolt', 'heavy', 'bolt']);
  await page.waitForTimeout(250);
  const before = (await read())[0].fx.map(f => f.t).join();
  await setSlots(['heavy', 'bolt', 'bolt']);
  await page.waitForTimeout(250);
  const after = (await read())[0].fx.map(f => f.t).join();
  check('moving a mod changes the affected group', before !== after, { before, after });
  check('and the group it joined shows the speed penalty',
    (await read())[0].fx.some(f => /speed/.test(f.t) && f.dir === 'down'), (await read())[0].fx.map(f => f.t));

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
