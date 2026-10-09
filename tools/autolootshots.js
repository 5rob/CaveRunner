// Screenshots for the owner (CaveRunner Auto stage 6 part 2, drops): phone size (412 x 880 @2.625), a level of two players.
//   l1-elite.png  an elite just killed: its gold nuggets, red gems, a gun mod and an exo mod thrown up, flying to the team
//   l2-boss.png   the boss just killed in the arena: its green gem, exo mod and gold flying to the team
//   l3-bag.png    a moment later: the bag holding the new items (red gems, green, the mods, the exo mods, the gold)
//   node tools/autolootshots.js [outdir]      (default tests/build/autoshots)
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
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 5; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    DEV.autoFoeDmg = 0; DEV.autoLootMod = 100; DEV.autoLootExo = 100;
    const run = newRun(9);
    bagAdd(run, { kind: 'green', n: 1 });
    addPlayer(run);
    saveAutoRun(run);
  });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  let ok = false;
  for (let i = 0; i < 80 && !ok; i++) {
    await page.waitForTimeout(100);
    ok = await page.evaluate(() => { const S = window.__autoScene; return !!(S && levelState(S).phase === 'run'); });
  }
  // l1: an elite killed ahead of the team
  const e = await page.evaluate(() => {
    const S = window.__autoScene, x = levelTeamX(S) + 70;
    const f = titleFoeAt(S, eliteOf(enemyFor('meduusa', 2), 0.7), x);
    f.y = f.ty = S.vh * 0.45;
    titleKill(S, f);
    return S.loot.map(g => g.it.kind + (g.it.id ? ':' + g.it.id : g.it.cat ? ':' + g.it.cat : '')).join(', ');
  });
  await page.waitForTimeout(650);
  await page.screenshot({ path: path.join(OUT, 'l1-elite.png') });
  said.push(`l1-elite.png  an elite killed: ${e} + gold, flying to the team`);
  // l2: the boss killed in the arena
  await page.evaluate(() => {
    const S = window.__autoScene, L = levelState(S);
    S.scroll = L.plan.arena.mid - LVL_TEAM - 30;
    for (const r of S.runners) { r.y = titleFloor(S.scroll + r.x, S) - PH; r.vy = 0; }
  });
  let b = false;
  for (let i = 0; i < 60 && !b; i++) { await page.waitForTimeout(100); b = await page.evaluate(() => !!levelState(window.__autoScene).boss); }
  const bw = await page.evaluate(() => {
    const S = window.__autoScene, B = levelState(S).boss;
    if (!B) return 'none';
    titleKill(S, B);
    return B.k.name + ': ' + S.loot.map(g => g.it.kind).join(', ');
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'l2-boss.png') });
  said.push(`l2-boss.png  ${b ? '' : '(never got there) '}the boss killed (${bw}) + gold, flying to the team`);
  let left = 1;
  for (let i = 0; i < 40 && left; i++) { await page.waitForTimeout(100); left = await page.evaluate(() => (window.__autoScene.loot || []).length + window.__autoScene.coins.length); }
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'l3-bag.png') });
  const bag = await page.evaluate(() => JSON.parse(localStorage.getItem('caverunner-auto-run') || 'null') && [...document.querySelectorAll('.aslot.full')].map(s => s.className.replace('aslot full k-', '') + ' ' + (s.textContent || '')).join(' | '));
  said.push(`l3-bag.png  the bag after (${left} still out): ${bag}`);
  await ctx.close();
  await browser.close();
  console.log(said.join('\n'));
})();
