// Screenshots for the owner (CaveRunner Auto v1.0.74 notes round): a: the title's version; b: a level, the stick pushed
// hard right (the knob over the dome's edge), the HUD's Top level, the bag's new icons (gold / crystals as their sprites,
// Slug / Bounce Orb / Energy Orb / Energy Sphere, orange fields); c: the Dev panel's mod grid, a mod picked.
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 5; localStorage.removeItem('caverunner-auto-run'); localStorage.setItem('caverunner-devshow', '1'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1500);
  const save = async (n, what, clip) => { await page.screenshot({ path: path.join(OUT, 'round-' + n + '.png'), clip }); said.push(`round-${n}.png  ${what}`); };
  await save('a-title', 'the title: the version bottom right');
  await page.evaluate(() => {
    Object.assign(DEV, { autoFoeDmg: 0 });
    const run = newRun();
    run.maps[0].level = 3; run.maps[0].best = 6;
    for (const it of [{ kind: 'gold', n: 120 }, { kind: 'red', n: 3 }, { kind: 'green', n: 2 }]) bagAdd(run, it);
    for (const id of ['slug', 'orb', 'eorb', 'esph', 'vigour', 'storm', 'shieldc', 'bounce']) bagAdd(run, { kind: 'mod', id, n: 1 });
    bagAdd(run, exoMod('hp', 2));
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(6000);
  const pill = await page.locator('.apill').boundingBox(), px = pill.x + pill.width / 2, py = pill.y + pill.height / 2;
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 110, py - 10, { steps: 4 });
  await page.waitForTimeout(300);
  await save('b-level', 'a level: "Top 7" under the level; the stick pushed hard right (the knob past the dome); the bag\'s new icons');
  await save('b-zoom', 'close up: the knob past the dome, the bag\'s icons', { x: 0, y: 560, width: 412, height: 320 });
  await page.mouse.up();
  await page.locator('.adevbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  await page.locator('.modgridbtn').dispatchEvent('pointerdown');
  await page.waitForTimeout(400);
  const t = page.locator('.mgtile[data-mod=eorb]');
  await t.dispatchEvent('pointerdown'); await t.dispatchEvent('pointerup');
  await page.waitForTimeout(300);
  await save('c-grid', 'the Dev panel\'s Mod grid: every mod by family; Energy Orb tapped (its info below); hold one to put it in the bag');
  await browser.close();
  console.log(said.join('\n'));
  console.log('saved in ' + OUT);
})().catch(e => { console.log(e); process.exit(1); });
