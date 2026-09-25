// The spider (Hämähäkki) in a sandbox: it drops onto the floor and stays on rock, strings
// you from range (each string slows you), the string snaps when you pull too far, and it
// bites when it reaches you. The pathing itself is proved on hand-made grids in
// tests/logic/spider.test.js.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(800);

  const r = await page.evaluate(async () => {
    const L = window.__lvl, W = L.world, p = L.p;
    const frame = () => new Promise(requestAnimationFrame);
    const room = L.sandbox({ w: 400, h: 200 });
    const inRock = (x, y) => L.mat[Math.floor(y / W.CELL) * W.CW + Math.floor(x / W.CELL)] !== 0;
    const k = enemyFor('hamahakki', 1);
    const put = (x, y) => { const e = { x, y, ty: y, r: k.r, phase: 0, hp: 999, hpMax: 999, cd: 0, flash: 0,
      lx: 0, ly: 1, hx: x, hy: y, tgt: null, rest: 0, k, touch: 0, charge: 0 }; L.enemies.push(e); return e; };
    const out = {};
    const walk = nx => { window.__in.current.left = nx ? { active: true, nx, ny: 0, mag: 1, dy: 0 } : { active: false, nx: 0, ny: 0, mag: 0, dy: 0 }; };
    // how far you walk in 0.5s
    const stride = async () => {
      const x0 = p.x; walk(1);
      const t0 = performance.now();
      while (performance.now() - t0 < 500) await frame();
      walk(0);
      const d = p.x - x0;
      for (let i = 0; i < 20; i++) await frame();
      return d;
    };
    p.x = room.l + 30; p.y = room.y - 22.5;
    for (let i = 0; i < 10; i++) await frame();
    out.free = await stride();
    p.x = room.l + 30; p.y = room.y - 22.5;

    // 1: dropped in the air, it lands on the floor and never enters rock
    const e = put(room.x + 60, room.y - 60);
    const cd0 = DEV.spSilkCd; DEV.spSilkCd = 0.5;
    let inside = 0, landed = false;
    for (let i = 0; i < 90; i++) {
      await frame();
      if (inRock(e.x, e.y)) inside++;
      if (e.sp && e.sp.mode === 'surf' && Math.abs(e.y - (room.y - 6)) < 3) landed = true;
    }
    out.landed = landed; out.inside = inside;

    // 2: it strings you from range; you're slower with it on
    p.x = e.x - 120; p.y = room.y - 22.5; p.hp = 9999;
    for (let i = 0; i < 300 && !L.strings.length; i++) { await frame(); p.x = e.x - 120; p.y = room.y - 22.5; if (inRock(e.x, e.y)) inside++; }
    out.strung = L.strings.length;
    L.enemies.splice(L.enemies.indexOf(e), 1);          // out of the way while we measure
    const n = L.strings.length;
    // walk back toward the anchor so the string can't snap mid-measure
    p.x = L.strings[0] ? L.strings[0].ax - 60 : p.x;
    out.tied = n ? await stride() : 0;
    out.n = n;
    out.slow = DEV.spSlow;
    // 3: pull too far and it snaps
    if (L.strings.length) {
      const s = L.strings[0];
      p.x = s.ax - DEV.spSilkMax - 40;
      for (let i = 0; i < 5; i++) await frame();
    }
    out.snapped = L.strings.length === 0;
    DEV.spSilkCd = cd0;

    // 4: it bites when it reaches you
    L.strings.length = 0;
    p.x = room.x - 6; p.y = room.y - 22.5; p.hp = 100; p.hitT = 0;
    const b = put(room.x + 30, room.y - 6);
    b.silkT = 999; b.aggro = true;
    for (let i = 0; i < 240 && p.hp >= 100; i++) { await frame(); p.x = room.x - 6; if (inRock(b.x, b.y)) inside++; }
    out.bit = 100 - p.hp; out.dmg = DEV.spBite;
    out.insideAll = inside;
    L.enemies.splice(L.enemies.indexOf(b), 1);
    out.webs = L.webs.length;
    return out;
  });

  check('dropped in the air, the spider lands on the floor', r.landed, r);
  check('and never goes inside the rock', r.insideAll === 0, r.insideAll);
  check('it shoots a string that sticks to you', r.strung > 0, r.strung);
  check('each string slows you (×' + r.slow + ' each)', r.tied > 0 && r.tied < r.free * (Math.pow(r.slow, r.n) + 0.08), { free: Math.round(r.free), tied: Math.round(r.tied), n: r.n });
  check('pull it past its length and it snaps', r.snapped);
  check('it bites when it reaches you, for the Dev bite damage', r.bit >= r.dmg, { bit: r.bit, dmg: r.dmg });

  await browser.close();
  if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
  console.log('\nall spider checks passed');
})().catch(e => { console.log('FAIL', e); process.exit(1); });
