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
  // reaches scale with 1/zoom; at the default 1.35 the string range (140-180 x 0.74) rolls
  // either side of the 120 this suite stands you at, so it failed about half the time
  await page.evaluate(() => { DEV.zoom = 1; });

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
    const cd0 = [DEV.spSilkCdLo, DEV.spSilkCdHi]; DEV.spSilkCdLo = DEV.spSilkCdHi = 0.5;
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
    out.slow = L.strings[0] ? L.strings[0].slow : 0; out.slowRange = [DEV.spSlowLo, DEV.spSlowHi];
    // 3: pull too far and it snaps
    if (L.strings.length) {
      // past the longest reach of every string on you (there can be more than one)
      p.x = Math.min(...L.strings.map(s => s.ax - s.max)) - 40;
      for (let i = 0; i < 5; i++) await frame();
    }
    out.snapped = L.strings.length === 0;
    [DEV.spSilkCdLo, DEV.spSilkCdHi] = cd0;

    // 4: it bites when it reaches you
    L.strings.length = 0;
    p.x = room.x - 6; p.y = room.y - 22.5; p.hp = 100; p.hitT = 0;
    const b = put(room.x + 30, room.y - 6);
    b.silkT = 999; b.aggro = true;
    for (let i = 0; i < 240 && p.hp >= 100; i++) { await frame(); p.x = room.x - 6; if (inRock(b.x, b.y)) inside++; }
    out.bit = 100 - p.hp; out.dmg = [DEV.spBiteLo, DEV.spBiteHi];
    out.insideAll = inside;
    L.enemies.splice(L.enemies.indexOf(b), 1);
    out.webs = L.webs.length;

    // 5: web lines are vines: touch one and you hang from it, the stick runs you along it,
    // pushing down lets go, and each line you push through slows you
    L.webs.length = 0; L.strings.length = 0;
    const wy = room.y - 70, web = { ax: room.l + 20, ay: wy, bx: room.r - 20, by: wy,
      a0x: room.l + 20, a0y: wy, b0x: room.r - 20, b0y: wy, ain: null, bin: null, owner: null };
    L.webs.push(web);
    const stick = (nx, ny) => { window.__in.current.left = nx || ny ? { active: true, nx, ny, mag: 1, dy: ny } : { active: false, nx: 0, ny: 0, mag: 0, dy: 0 }; };
    stick(0, 0);
    p.x = room.x - 6; p.y = wy - 3 + 4; p.vx = 0; p.vy = 0;
    for (let i = 0; i < 60; i++) await frame();
    out.latched = !!L.zfx.web;
    out.hangY = Math.round(p.y - wy);
    out.hangFell = p.y > wy + 10;
    const hx0 = p.x;
    stick(1, 0);
    const t0 = performance.now(); while (performance.now() - t0 < 500) await frame();
    out.along = Math.round(p.x - hx0); out.alongDy = Math.round(p.y - wy);
    stick(0, 1);
    for (let i = 0; i < 40; i++) await frame();
    stick(0, 0);
    for (let i = 0; i < 30; i++) await frame();
    out.letGo = !L.zfx.web && p.y > wy + 20;
    // slowed pushing through: jet sideways, held in place inside vertical lines, and read
    // the speed you're allowed to reach
    const through = async lines => {
      L.webs.length = 0;
      const x = room.l + 60;
      for (let i = 0; i < lines; i++) L.webs.push({ ax: 0, ay: 0, bx: 0, by: 0, a0x: x + i, a0y: room.y - 200, b0x: x + i, b0y: room.y, owner: null });
      window.__in.current.left = { active: true, nx: 0.8, ny: -0.6, mag: 1, dy: -0.6 };
      let n = 0, vx = 0;
      for (let i = 0; i < 40; i++) { p.x = x - PW / 2; p.y = room.y - 90; p.fuel = 1; await frame(); n = L.zfx.webs; vx = p.vx; }
      window.__in.current.left = { active: false, nx: 0, ny: 0, mag: 0, dy: 0 };
      return { n, vx: Math.round(vx) };
    };
    out.w0 = await through(0); out.w2 = await through(2);
    L.webs.length = 0;
    return out;
  });

  check('dropped in the air, the spider lands on the floor', r.landed, r);
  check('and never goes inside the rock', r.insideAll === 0, r.insideAll);
  check('it shoots a string that sticks to you', r.strung > 0, r.strung);
  check('each string slows you (×' + r.slow + ' each)', r.tied > 0 && r.tied < r.free * (Math.pow(r.slow, r.n) + 0.08), { free: Math.round(r.free), tied: Math.round(r.tied), n: r.n });
  check('pull it past its length and it snaps', r.snapped);
  check('it bites when it reaches you, for a bite damage rolled in the Dev range', r.bit >= Math.round(r.dmg[0]) && r.bit <= Math.round(r.dmg[1]), { bit: r.bit, dmg: r.dmg });
  check('each string rolls its slow from the Dev range', r.slow >= r.slowRange[0] && r.slow <= r.slowRange[1], { slow: r.slow, range: r.slowRange });

  check('touch a web line and you hang from it like a vine', r.latched && !r.hangFell, { latched: r.latched, hangY: r.hangY });
  check('the stick runs you along it, staying on the line', r.along > 25 && Math.abs(r.alongDy) < 8, { along: r.along, dy: r.alongDy });
  check('pushing down lets go', r.letGo);
  check('each line you push through slows you (×' + 0.8 + ' each)', r.w2.n === 2 && Math.abs(r.w2.vx / r.w0.vx - 0.64) < 0.08, { w0: r.w0, w2: r.w2 });

  await browser.close();
  if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
  console.log('\nall spider checks passed');
})().catch(e => { console.log('FAIL', e); process.exit(1); });
