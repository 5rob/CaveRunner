// Screenshots for the owner (CaveRunner Auto, stage: perks): phone size (412 x 880 @2.625), a level, player 1 with
// Permanent Shield, Pinpointer and Angry Ghost fitted.
//   p1-shield.png   the shield up: a light-blue glow, brightest at its rim
//   p2-broken.png   just hit: the shield flashes and goes
//   p3-laser.png    Pinpointer's red laser where he aims
//   p4-ghost.png    the Angry Ghost firing at a creature
//   node tools/perkshots.js [outdir]      (default tests/build/perks)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'perks'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 5; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    DEV.autoFoeDmg = 0;
    const run = newRun(9);
    run.players[0].perks[0] = { kind: 'perk', id: 'shield' };
    run.players[0].perks[1] = { kind: 'perk', id: 'pinpoint' };
    run.players[0].perks[2] = { kind: 'perk', id: 'ghost' };
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let ok = false;
  for (let i = 0; i < 80 && !ok; i++) {
    await page.waitForTimeout(100);
    ok = await page.evaluate(() => { const S = window.__autoScene; return !!(S && levelState(S).phase === 'run'); });
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'p1-shield.png') });
  said.push(`p1-shield.png  ${ok ? '' : '(level never started) '}the shield up round player 1`);
  await page.evaluate(() => levelHurt(window.__autoScene, 0, 5));
  await page.waitForTimeout(90);
  await page.screenshot({ path: path.join(OUT, 'p2-broken.png') });
  said.push('p2-broken.png  just hit: the shield breaking (flash)');
  // a creature ahead so he aims at it (laser) and the ghost fires
  await page.evaluate(() => {
    const S = window.__autoScene, f = titleFoeAt(S, enemyFor('rotta', 1), levelTeamX(S) + 70);
    f.hp = f.hpMax = 9999;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'p3-laser.png') });
  said.push('p3-laser.png  the red laser on the creature he is aiming at');
  let fired = false;
  for (let i = 0; i < 60 && !fired; i++) {
    await page.waitForTimeout(40);
    fired = await page.evaluate(() => { const S = window.__autoScene, g = S.runners[0].ghost; return !!g && S.t - g.fired < 0.12; });
  }
  await page.screenshot({ path: path.join(OUT, 'p4-ghost.png') });
  said.push(`p4-ghost.png  ${fired ? '' : '(never caught it firing) '}the ghost firing at the creature`);
  await ctx.close();
  await browser.close();
  console.log(said.join('\n'));
})();
