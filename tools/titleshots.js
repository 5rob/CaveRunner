// Screenshots of the title screen and the pause menu (LIST4 #3, #4) for the owner, phone size
// (412 x 880 @2.625), the real game through the test page with window.__TEST_TITLE set.
//   node tools/titleshots.js [outdir]      (default tests/build/titleshots)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'titleshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => {
    window.__TEST_TITLE = true;
    // a run in slot 1 and slot 3, so the slots show summaries
    if (!sessionStorage.getItem('shots')) {
      sessionStorage.setItem('shots', '1');
      const run = (floor, gold) => JSON.stringify({ ver: 'old', floor, hp: 50, hasLvl: true,
        loadout: { guns: [{ name: 'Pistol', slots: ['bolt', null] }, { name: 'Shotgun', slots: [null] }, null, null], sel: 0, bag: [], gold } });
      localStorage.setItem('caverunner-save', run(3, 1840));
      localStorage.setItem('caverunner-save-3', run(7, 25300));
    }
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  const said = [];
  const shot = async (n, what) => { await page.screenshot({ path: path.join(OUT, n + '.png') }); said.push(`${n}.png  ${what}`); };
  await page.waitForTimeout(1500);
  await shot('a-title', 'the title: the action scene, CAVE RUNNER, the slot menu (slot 1 picked)');
  await page.waitForTimeout(1000);
  await shot('b-title-1s', 'the title a second later: the action moves on');
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(160); await page.screenshot({ path: path.join(OUT, 'strip-' + i + '.png') }); }
  said.push('strip-0..5.png  six frames 0.16 s apart');
  await page.dispatchEvent('.tdel[data-del="3"]', 'pointerdown');
  await page.waitForTimeout(300);
  await shot('c-delete', "slot 3's 🗑️ tapped once: the red Delete? asking to confirm");
  // into the game, then the pause menu
  await page.dispatchEvent('.tslot[data-slot="2"]', 'pointerdown');
  await page.dispatchEvent('.tstart', 'pointerdown');
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.waitForTimeout(1200);
  await shot('d-play', 'play, with the ⏸ button top left');
  await page.dispatchEvent('.pausebtn', 'pointerdown');
  await page.waitForTimeout(300);
  await shot('e-pause', 'the pause menu over play: Resume, Save, Volume, Exit to main menu');
  await browser.close();
  console.log('Shots in ' + OUT + ':\n' + said.join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
