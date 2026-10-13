// Screenshots for the owner (CaveRunner Auto, the round after v1.0.74): a: orb webs in a level's webs zone; b: a group of
// 4 bag tiles (2×2) dragged, the green outlines where they'd land; c: a gun in the bag tapped, its view over the play area;
// d: the Dev panel's mod grid (the trigger variants gone; the grab circles).
//   node tools/roundshots.js [outdir]      (default tests/build/autoshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 4; localStorage.removeItem('caverunner-auto-run'); localStorage.setItem('caverunner-devshow', '1'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1500);
  const save = async (n, what, clip) => { await page.screenshot({ path: path.join(OUT, 'round-' + n + '.png'), clip }); said.push(`round-${n}.png  ${what}`); };
  await page.evaluate(() => {
    Object.assign(DEV, { autoFoeDmg: 0, autoOrbChance: 1, autoOrbMax: 3 });
    const run = newRun();
    for (const id of ['slug', 'orb', 'bounce', 'eorb']) bagAdd(run, { kind: 'mod', id, n: 1 });
    // a 2×2 of mods at slots 7, 8, 14, 15
    run.bag = run.bag.map(() => null);
    run.bag[7] = { kind: 'mod', id: 'slug', n: 1 }; run.bag[8] = { kind: 'mod', id: 'orb', n: 1 };
    run.bag[14] = { kind: 'mod', id: 'bounce', n: 1 }; run.bag[15] = { kind: 'mod', id: 'eorb', n: 1 };
    const g = { ...run.players[0].guns[0], name: 'Spare gun', slots: ['bolt', 'double', 'bounce', 'spark', null, null] };
    run.bag[2] = { kind: 'gun', gun: g, n: 1 };
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(7000);
  await save('a-webs', 'orb webs in the webs zone (spokes to the rock, the spiral across them), among the old straight lines');
  await save('a-zoom', 'close up of the play area', { x: 0, y: 0, width: 412, height: 480 });
  const at = async i => { const b = await page.locator('.abag [data-slot="' + i + '"]').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  // c: tap the gun in the bag
  const pg = await at(2);
  await page.mouse.click(pg.x - 14, pg.y - 14);
  await page.waitForTimeout(500);
  await save('c-gunview', 'a gun in the bag tapped: its view fills the play area (stats left, its mods right); drag a mod into the bag to take it off');
  await page.locator('.abgclose').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  // b: pick the 2×2 (hold the first, slide over the rest), then drag it by its bottom-right tile
  const p7 = await at(7), p8 = await at(8), p14 = await at(14), p15 = await at(15), p24 = await at(24);
  await page.mouse.move(p7.x, p7.y); await page.mouse.down();
  await page.waitForTimeout(700);
  for (const p of [p8, p15, p14]) await page.mouse.move(p.x, p.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await page.mouse.move(p15.x, p15.y); await page.mouse.down();
  await page.mouse.move(p24.x, p24.y, { steps: 8 });
  await page.waitForTimeout(250);
  await save('b-group', 'the 2×2 picked and dragged by its bottom-right tile onto slot 24: green outlines on the 4 slots it will fill, still 2×2');
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.locator('.adevbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  await page.locator('.modgridbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  await save('d-grid', 'the Dev mod grid: the trigger / timer / expiration variants gone; only each tile\'s middle grabs, the rest scrolls');
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
