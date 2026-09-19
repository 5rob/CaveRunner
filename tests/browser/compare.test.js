const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { window.__lvl.p.x = 30; });

  // a known matchup: the found gun is better at some things, worse at others
  await page.evaluate(async () => {
    const LO = window.__in.current.loadout;
    const { pickups, p } = window.__lvl;
    LO.sel = 0;
    Object.assign(LO.guns[0], { name: 'Baseline', cap: 4, castDelay: 0.20, recharge: 1.00,
      manaMax: 100, manaRegen: 40, spread: 4, multi: 1, speedMul: 1, shuffle: false });
    const gp = pickups.find(q => q.kind === 'gun');
    Object.assign(gp.gun, { name: 'Contender', cap: 6, castDelay: 0.10, recharge: 1.40,
      manaMax: 200, manaRegen: 20, spread: 8, multi: 2, speedMul: 1.5, shuffle: true });
    gp.x = p.x + 6; gp.y = p.y + 11;
    await new Promise(r => setTimeout(r, 300));
  });

  const rows = () => page.evaluate(() => [...document.querySelectorAll('.pop.flow .prow')]
    .map(r => ({ label: r.querySelector('span').textContent,
                 value: r.querySelector('b').textContent,
                 cls: r.className.replace('prow', '').trim() })));
  let r = await rows();
  console.log(r.map(x => `${x.label.padEnd(15)} ${x.value.padEnd(10)} ${x.cls || '-'}`).join('\n'));
  const by = k => r.find(x => x.label === k);
  check('all stats stacked vertically', r.length === 9, r.length);
  check('more slots is green', by('slots').cls === 'up');
  check('FASTER cast delay is green (lower is better)', by('cast delay').cls === 'up', by('cast delay'));
  check('longer recharge is red (lower is better)', by('recharge').cls === 'down', by('recharge'));
  check('more mana is green', by('mana').cls === 'up');
  check('less regen is red', by('mana regen').cls === 'down');
  check('WIDER spread is red (lower is better)', by('spread').cls === 'down', by('spread'));
  check('more shots per cast is green', by('shots per cast').cls === 'up');
  check('faster shots is green', by('shot speed').cls === 'up');
  check('shuffle is red against in-order', by('cast order').cls === 'down', by('cast order'));
  check('it says what it is compared with',
    /slot 1, Baseline/.test(await page.evaluate(() => document.querySelector('.vs').textContent)),
    await page.evaluate(() => document.querySelector('.vs').textContent));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'compare.png') });

  // tapping another slot re-bases the comparison
  await page.evaluate(() => {
    const LO = window.__in.current.loadout;
    Object.assign(LO.guns[1], { name: 'Other', castDelay: 0.05, spread: 1, cap: 8 });
  });
  await page.tap('.swaprow .gtab >> nth=1');
  await page.waitForTimeout(220);
  await page.tap('.shade', { position: { x: 20, y: 20 } });
  await page.waitForTimeout(220);
  r = await rows();
  check('comparison re-bases to the tapped gun',
    /slot 2, Other/.test(await page.evaluate(() => document.querySelector('.vs').textContent)),
    await page.evaluate(() => document.querySelector('.vs').textContent));
  check('and the colours follow it', r.find(x => x.label === 'cast delay').cls === 'down' &&
    r.find(x => x.label === 'slots').cls === 'down', r.filter(x => ['cast delay','slots'].includes(x.label)));
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'compare2.png') });
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
