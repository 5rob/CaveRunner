// Screenshots for the owner (v1.0.98: Grem Mode moves on to the next old floor each level cleared, the colours blended over a
// seam past the boss's arena), phone size (412 x 880 @2.625), the real page through the test page: Grem Mode with short
// stretches (DEV.autoLvlMin) and each boss knocked out as it comes in; a shot as each seam crosses the view.
//   node tools/gremseamshots.js [outdir] [seams]      (default tests/build/autoshots, 3 seams)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
const SEAMS = Number(process.argv[3] || 3);
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { DEV.autoLvlMin = 0.25; DEV.autoFoeDmg = 0; });
  await page.locator('.tgrem').dispatchEvent('pointerdown');
  for (let k = 1; k <= SEAMS; k++) {
    // the seam into floor k + 1 at the view's middle; meanwhile each boss falls as it comes in
    let got = null;
    for (let t = 0; t < 240000 && !got; t += 200) {
      got = await page.evaluate(k => {
        const S = window.__gremScene, L = S && S.lvl && S.lvl.data;
        if (!L || !S.looks || S.looks.length <= k) return null;
        if (L.boss && !L.bossDead && L.boss.hp > 0 && (L.introT == null || S.t - L.introT > DEV.gremBossT)) L.boss.hp = 0;
        const mid = S.scroll + TITLE_VW / 2, b = S.looks[k];
        return Math.abs(mid - b.x0) < 12 ? { from: S.looks[k - 1].name, to: b.name } : null;
      }, k);
      if (!got) await page.waitForTimeout(200);
    }
    if (!got) { console.log('seam ' + k + ': the wait ran out'); break; }
    const n = 'grem-seam' + k;
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    said.push(`${n}.png  the seam from ${got.from} into ${got.to} at the play area's middle`);
  }
  await browser.close();
  console.log(said.join('\n'));
})();
