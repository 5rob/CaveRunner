// Screenshots for the owner (CaveRunner Auto: a machine's payout as its bag tile, and its copy flying into the bag),
// phone size (412 x 880 @2.625), the real page through the test page, the hub:
//   a) a mod, an exo mod and a perk resting on the floor by the mod machine, drawn as their bag tiles;
//   b) the mod taken by player 1: its tile's copy caught mid-flight to the bag;
//   c) the copy gone: the mod in its bag slot.
//   node tools/vendiconshots.js [outdir]      (default tests/build/vendicons)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'vendicons'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  for (let i = 0; i < 60 && !(await page.$('.auto')); i++) await page.waitForTimeout(50);
  await page.waitForTimeout(2400);
  // player 1 by the mod machine; three payouts resting on the floor past him (land: they wait there)
  await page.evaluate(() => {
    const S = window.__title.S, L = S.runners[0], x = hubStopX('mod');
    L.x = x - 30 - PW / 2; L.vx = 0;
    const mod = Object.keys(MODS).find(k => !MODS[k].off && MODS[k].glyph && MODS[k].kind !== 'shot'), perk = Object.keys(PERKS)[0];
    const its = [{ kind: 'mod', id: mod, n: 1 }, { kind: 'exo', cat: 'speed', tier: 2, n: 1 }, { kind: 'perk', id: perk, n: 1 }];
    S.loot = its.map((it, i) => ({ x: x - 8 + i * 18, y: L.y - 20, vx: 0, vy: 0, it, col: '#fff', t: 1, nopull: 0, land: 999 }));
  });
  await page.waitForTimeout(1500);
  const shot = async (n, what) => { const f = path.join(OUT, n); await page.screenshot({ path: f }); console.log(f + ' — ' + what); };
  await shot('a-floor.png', 'a mod, an exo mod (II) and a perk on the hub floor by the mod machine, each as its bag tile');
  // the mod: let it fly to him
  await page.evaluate(() => { const g = window.__title.S.loot[0]; g.land = 0; });
  let caught = false;
  for (let i = 0; i < 80 && !caught; i++) {
    caught = await page.evaluate(() => { const el = document.querySelector('.afly'), a = el && el.getAnimations()[0]; if (!a) return false; a.pause(); a.currentTime = 220; return true; });
    if (!caught) await page.waitForTimeout(25);
  }
  await shot('b-flying.png', caught ? 'the mod taken: its tile\'s copy mid-flight from player 1 to its bag slot' : 'NO FLY-COPY CAUGHT');
  await page.evaluate(() => { const el = document.querySelector('.afly'), a = el && el.getAnimations()[0]; if (a) a.play(); });
  await page.waitForTimeout(800);
  await shot('c-bag.png', 'the copy gone: the mod in its bag slot');
  await browser.close();
})().catch(e => { console.log('ERROR', e); process.exit(1); });
