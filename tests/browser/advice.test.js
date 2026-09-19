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
  await page.evaluate(() => { window.__lvl.p.x = 30; });
  const setup = (slots, bag, over) => page.evaluate(([sl, bg, ov]) => {
    const LO = window.__in.current.loadout;
    const g = LO.guns[0];
    Object.assign(g, ov || {});
    g.cap = sl.length; g.slots = sl.slice(); g.shuffle = false;
    resetGun(g);
    LO.bag.length = 0; LO.bag.push(...bg);
    LO.sel = 0;
    window.__in.current.notify();
  }, [slots, bag, over || {}]);
  const read = () => page.evaluate(() => ({
    diag: document.querySelector('.diag') && document.querySelector('.diag').textContent,
    cls: document.querySelector('.diag') && document.querySelector('.diag').className,
    tips: [...document.querySelectorAll('.tip')].map(t => t.textContent),
  }));

  // the real build from the screenshot
  await setup(['double', 'borer', 'homing', 'orb', 'saw', null, null],
    ['bolt', 'double', 'pierce', 'quad', 'big', 'dmg_up', 'spark', 'triple', 'bounce',
     'range', 'spark', 'fast', 'slug', 'bolt', 'quad', 'scatter', 'battery', 'tip'],
    { castDelay: 0.41, recharge: 1.09, manaMax: 439, manaRegen: 132, spread: 0.3, multi: 1, speedMul: 0.99, cap: 7 });
  await page.tap('.weapon');
  await page.waitForTimeout(350);
  let r = await read();
  console.log('  ', r.diag);
  for (const t of r.tips) console.log('   tip:', t);
  check('the diagnosis shows', /recharge is the limit/i.test(r.diag || ''), r.diag);
  check('with the damage rate', /dmg\/s/.test(r.diag || ''), r.diag);
  check('and is colour-coded by bottleneck', /rech/.test(r.cls || ''), r.cls);
  check('tips are offered', r.tips.length > 0 && r.tips.length <= 3, r.tips.length);
  check('each tip states its gain', r.tips.every(t => /×[\d.]+ dmg/.test(t)), r.tips);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'advice.png') });

  // tapping a tip applies it and the advice updates
  const before = await page.evaluate(() => window.__in.current.loadout.guns[0].slots.slice());
  await page.tap('.tip');
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__in.current.loadout.guns[0].slots.slice());
  check('tapping a tip applies it', JSON.stringify(before) !== JSON.stringify(after), { before, after });
  const r2 = await read();
  check('and the advice recalculates', r2.diag !== r.diag || JSON.stringify(r2.tips) !== JSON.stringify(r.tips),
    { was: r.diag, now: r2.diag });
  const dpsOf = t => parseFloat(t.match(/([\d.]+) dmg\/s/)[1]);
  check('the damage rate actually went up', dpsOf(r2.diag) > dpsOf(r.diag),
    { was: dpsOf(r.diag), now: dpsOf(r2.diag) });
  check('the mod it displaced went back to the bag',
    (await page.evaluate(() => window.__in.current.loadout.bag.length)) >= 18);

  // the ordering mistake
  await setup(['bolt', 'dmg_up'], []);
  await page.waitForTimeout(280);
  r = await read();
  check('it suggests moving a modifier in front of its shot',
    r.tips.length && /swap slots 1 and 2/i.test(r.tips[0]), r.tips);
  await page.tap('.tip');
  await page.waitForTimeout(280);
  check('and the swap happens',
    JSON.stringify(await page.evaluate(() => window.__in.current.loadout.guns[0].slots.slice())) === '["dmg_up","bolt"]',
    await page.evaluate(() => window.__in.current.loadout.guns[0].slots.slice()));

  // other diagnoses
  await setup(['dmg_up', 'homing'], []);
  await page.waitForTimeout(280);
  r = await read();
  check('a gun that cannot fire says so', /nothing on this gun fires/i.test(r.diag || ''), r.diag);
  check('and offers no tips', r.tips.length === 0, r.tips);

  await setup(['quad', 'seeker', 'slug', 'slug', 'slug', 'slug'], [],
    { manaRegen: 5, castDelay: 0.02, recharge: 0.05, cap: 6 });
  await page.waitForTimeout(280);
  r = await read();
  check('mana starvation is diagnosed', /mana is the limit/i.test(r.diag || ''), r.diag);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
