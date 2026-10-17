// Screenshots of Grem's Dev ⏭ (skip the level, its gold paid): the top before (⏭ left of ⚙️) and after a press
//   node tools/gremskipshots.js [outdir]      (default tests/build/autoshots)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; localStorage.setItem('caverunner-devshow', '1'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3500);
  const before = await page.evaluate(() => ({ tier: window.__gremScene.tier, gold: document.querySelector('.ggold').dataset.gold, skip: !!document.querySelector('.gskip') }));
  await page.screenshot({ path: path.join(OUT, 'grem-skip-a.png') });
  await page.locator('.gskip').dispatchEvent('pointerdown');
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => ({ tier: window.__gremScene.tier, gold: document.querySelector('.ggold').dataset.gold }));
  await page.screenshot({ path: path.join(OUT, 'grem-skip-b.png') });
  // the boss waiting in its arena as the team comes up to it (v2.0.16)
  await page.evaluate(() => { const S = window.__gremScene, L = S.lvl.data; DEV.autoFoeDmg = 0; S.scroll = L.plan.arena.mid - TITLE_VW * 1.1; });
  await page.waitForTimeout(4000);
  const boss = await page.evaluate(() => { const S = window.__gremScene, L = S.lvl.data; return { b: L.boss ? !!L.boss.waiting : null, phase: L.phase, sc: Math.round(S.scroll), mid: Math.round(L.plan.arena.mid), gen: S.gen * 4 }; });
  await page.screenshot({ path: path.join(OUT, 'grem-boss-wait.png') });
  console.log(JSON.stringify({ before, after, boss }) + '\n' + path.join(OUT, 'grem-boss-wait.png') + '\n' + path.join(OUT, 'grem-skip-a.png') + '\n' + path.join(OUT, 'grem-skip-b.png'));
  await browser.close();
})();
