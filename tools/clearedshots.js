// Screenshots for the owner (CaveRunner Auto stage 7), phone size (412 x 880 @2.625), the real page through the
// test page: a level jumped to the boss arena with the boss dead and its loot gone, LEVEL CLEARED caught at three
// moments: the letters dropping in, all landed with the last sparks, the shine sweeping across.
//   node tools/clearedshots.js [outdir]      (default tests/build/autoshots)
// Not a test: it takes the pictures and prints what each shows.
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 3; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    DEV.autoLvlMin = 0.4; DEV.autoClearT = 60;     // (held on screen: each shot sets the show's age itself)
    const run = newRun();
    addPlayer(run); addPlayer(run); addPlayer(run);
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  // wait for the team to come through, then jump to the arena: the boss dead, its loot gone
  let ok = false;
  for (let t = 0; t < 15000 && !ok; t += 250) {
    ok = await page.evaluate(() => !!(window.__title && window.__title.S.lvl && window.__title.S.lvl.data.phase === 'run'));
    if (!ok) await page.waitForTimeout(250);
  }
  if (!ok) console.log('the level never started');
  await page.evaluate(() => {
    const S = window.__title.S, L = S.lvl.data;
    S.scroll = L.plan.arena.mid - LVL_TEAM; S.foes.length = 0; S.coins.length = 0; S.loot = [];
    S.runners.forEach((r, i) => { r.x = 40 + i * 12; r.y = titleFloor(L.plan.arena.mid, S) - 22; r.vx = r.vy = 0; });
    L.phase = 'arena'; L.arenaT = S.t; L.bossDead = true;
  });
  await page.waitForTimeout(1500);
  const shot = async (n, what, age) => {
    await page.evaluate(a => { const S = window.__title.S; S.lvl.data.clearT = S.t - a; }, age);
    await page.waitForTimeout(30);
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    said.push(`${n}.png  ${what}`);
  };
  await shot('c1-dropping', 'the letters dropping in one by one (LEVEL landed, CLEARED on its way)', 0.75);
  await shot('c2-landed', 'all landed: the last letters\' spark bursts and touch-down rings', 1.3);
  await shot('c3-shine', 'the shine sweeping across the words', 1.86);
  await browser.close();
  console.log(said.join('\n'));
})();
