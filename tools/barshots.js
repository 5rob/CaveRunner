// Screenshots for the owner (CaveRunner Auto, v1.0.44): the creatures' thin health bars and the boss's big bar across the
// top of the play area, its name above it on the left. Phone size (412 x 880 @2.625).
//   b-a-foes.png   creatures ahead, some hurt (a close-up b-a-zoom.png)     b-b-boss.png   the boss in the arena
//   node tools/barshots.js [outdir]      (default tests/build/bars)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'bars'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 3; localStorage.removeItem('caverunner-auto-run'); });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { Object.assign(DEV, { autoFoeDmg: 0, autoLvlMin: 0.35, autoWallMin: 0, autoWallMax: 0 }); saveAutoRun(newRun(4)); });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    const S = window.__autoScene;
    [['rotta', 70, 1], ['rotta', 100, 0.4], ['rotta', 135, 0.75]].forEach(([k, dx, h]) => { const f = titleFoeAt(S, enemyFor(k, 1), levelTeamX(S) + dx); f.hpMax = 999; f.hp = 999 * h; });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'b-a-foes.png') });
  // a close-up round the creatures, cut from the play canvas
  await page.evaluate(() => {
    const S = window.__autoScene, C = window.__autoCam.current, cv = document.querySelector('.aplaycvs'), k = cv.width / TITLE_VW;
    const f = S.foes.find(q => q.hpMax === 999) || S.foes[0], v = camTo(C, f.x - S.scroll, f.ty);
    const c = document.createElement('canvas'); c.id = 'zoomshot'; c.width = 380; c.height = 380;
    Object.assign(c.style, { position: 'fixed', left: '16px', top: '200px', width: '380px', height: '380px', zIndex: 99999, border: '2px solid #fff' });
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(cv, v.x * k - 50 * k, v.y * k - 50 * k, 100 * k, 100 * k, 0, 0, 380, 380);
    document.body.appendChild(c);
  });
  await page.locator('#zoomshot').screenshot({ path: path.join(OUT, 'b-a-zoom.png') });
  await page.evaluate(() => document.getElementById('zoomshot').remove());
  // the bar as the arena shows it: the boss set on the level (the screen polls levelBoss), at 65%
  await page.evaluate(() => { const S = window.__autoScene, L = levelState(S), f = titleFoeAt(S, enemyFor('rotta', 1), levelTeamX(S) + 160); f.k = { ...f.k, name: 'Rat King' }; f.hpMax = 100; f.hp = 65; L.boss = f; });
  let boss = false;
  for (let i = 0; i < 400 && !boss; i++) { await page.waitForTimeout(100); boss = !!(await page.$('.abossbar')); }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'b-b-boss.png') });
  console.log('b-a-foes.png / b-a-zoom.png  creatures with health bars (full, 40%, 75%)\nb-b-boss.png  ' + (boss ? 'the boss bar' : '(no boss reached)'));
  await browser.close();
})();
