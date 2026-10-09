// Screenshots for the owner (CaveRunner Auto stage 6 part 1, enemies): phone size (412 x 880 @2.625), a level of two players.
//   e1-elite.png  an elite (its tint, glow and size: Dev → Elites) come in ahead of the team, which slows for it
//   e2-boss.png   the boss in the arena (a floor-1 kind, ×4 size), its health bar over the play area
//   node tools/enemyshots.js [outdir]      (default tests/build/autoshots)
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
  for (const n of ['e1-elite', 'e2-boss']) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 5; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      DEV.autoFoeDmg = 0;
      const run = newRun(9);
      bagAdd(run, { kind: 'green', n: 1 });
      addPlayer(run);
      const g = Object.assign({}, run.players[0].guns[0], { name: 'Buzzsaw', slots: ['saw', null, null] });
      resetGun(g);
      run.players[0].guns[1] = g;
      saveAutoRun(run);
    });
    await page.locator('.tstart').dispatchEvent('pointerdown');
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      await page.waitForTimeout(100);
      ok = await page.evaluate(() => { const S = window.__autoScene; return !!(S && levelState(S).phase === 'run'); });
    }
    let what = '';
    if (n === 'e1-elite') {
      what = await page.evaluate(() => {
        const S = window.__autoScene, L = levelState(S), x = levelTeamX(S) + 110;
        const f = titleFoeAt(S, eliteOf(enemyFor('meduusa', 2), 0.7), x);
        f.hp = f.hpMax = 9999;
        L.elites.unshift({ x, alive: true, u: 0.7, f });
        return f.k.name;
      });
      await page.waitForTimeout(1800);
      await page.evaluate(() => { const S = window.__autoScene, t0 = performance.now(); performance.now = () => t0; S.shots.length = 0; for (const f of S.foes) f.flash = 0; });
      await page.waitForTimeout(150);
      const pace = await page.evaluate(() => window.__autoScene.pace);
      said.push(`e1-elite.png  an elite ${what} ahead; the team's pace ${pace.toFixed(2)}`);
    } else {
      await page.evaluate(() => {
        const S = window.__autoScene, L = levelState(S);
        S.scroll = L.plan.arena.mid - LVL_TEAM - 30;
        for (const r of S.runners) { r.y = titleFloor(S.scroll + r.x, S) - PH; r.vy = 0; }
      });
      let b = false;
      for (let i = 0; i < 60 && !b; i++) { await page.waitForTimeout(100); b = await page.evaluate(() => !!levelState(window.__autoScene).boss); }
      what = await page.evaluate(() => { const B = levelState(window.__autoScene).boss; if (!B) return 'none'; B.hp = Math.round(B.hpMax * 0.7); B.hpMax = B.hpMax; return B.k.name + ' ' + B.hpMax + ' hp'; });
      await page.waitForTimeout(1500);
      said.push(`e2-boss.png  ${b ? '' : '(never got there) '}the boss: ${what}, its bar over the play area`);
    }
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
})();
