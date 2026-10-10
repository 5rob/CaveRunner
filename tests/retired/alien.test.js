// Level 2 stage 7b: a pack of aliens flees a fire placed near it, in the sandbox (the owner's rule): 30
// aliens bunched to one side of a blast kept burning, after a second nearly all are further from it and the
// pack's middle has moved well away; and none is left stuck in rock.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  const r = await page.evaluate(() => new Promise(res => {
    const W = window.__lvl, room = W.sandbox();
    window.DEV.zoom = 1;
    W.guide = null;
    const k = window.enemyFor('alien', 2), fire = { x: room.x - 60, y: room.y - 12 };
    for (let i = 0; i < 30; i++) {
      const x = fire.x + 20 + (i % 6) * 5, y = room.y - 4 - Math.floor(i / 6) * 5;
      W.enemies.push({ x, y, ty: y, r: k.r, phase: i, hp: k.hp, hpMax: k.hp, cd: 0, flash: 0, lx: 0, ly: 1, hx: x, hy: y,
        tgt: null, rest: 0, k, touch: 0, charge: 0, al: window.alienBrain(1, Math.random) });
    }
    const mean = () => { const a = W.enemies.filter(e => e.k.act === 'alien'); return { n: a.length, d: a.reduce((s, e) => s + Math.hypot(e.x - fire.x, e.y - fire.y), 0) / a.length, x: a.reduce((s, e) => s + e.x, 0) / a.length }; };
    const d0 = W.enemies.map(e => Math.hypot(e.x - fire.x, e.y - fire.y));
    const m0 = mean();
    let f = 0;
    const loop = () => {
      W.flashes.push({ x: fire.x, y: fire.y, r: 2, t: 0 });
      W.p.hp = 9999;
      if (++f < 60) { requestAnimationFrame(loop); return; }
      const m1 = mean(), { CW, CELL } = W.world;
      const away = W.enemies.filter((e, i) => Math.hypot(e.x - fire.x, e.y - fire.y) > d0[i]).length;
      const inRock = W.enemies.filter(e => W.mat[Math.floor(e.y / CELL) * CW + Math.floor(e.x / CELL)]).length;
      res({ m0, m1, away, inRock });
    };
    requestAnimationFrame(loop);
  }));
  check('the pack runs from the fire (its middle well away)', r.m1.d > r.m0.d + 40, r);
  check('nearly every alien is further from the fire', r.away >= 26, r.away);
  check('none stuck in rock', r.inRock === 0, r.inRock);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
