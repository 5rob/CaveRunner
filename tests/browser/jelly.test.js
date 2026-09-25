// The jellyfish (Myrkkymeduusa) in a sandbox: it swims without entering rock, lines up
// on you and spits a green glob that drips as it flies, splats when it lands and hurts
// you when it hits, and it throws a green glow on the cave round it. The swimming itself
// is proved on hand-made grids in tests/logic/jelly.test.js.
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
  await page.evaluate(() => { DEV.zoom = 1; });

  const r = await page.evaluate(async () => {
    const L = window.__lvl, W = L.world, p = L.p;
    const frame = () => new Promise(requestAnimationFrame);
    const room = L.sandbox({ w: 400, h: 200 });
    const inRock = (x, y) => L.mat[Math.floor(y / W.CELL) * W.CW + Math.floor(x / W.CELL)] !== 0;
    const k = enemyFor('meduusa', 1);
    const put = (x, y) => { const e = { x, y, ty: y, r: k.r, phase: 0, hp: 999, hpMax: 999, cd: 0, flash: 0,
      lx: 0, ly: 1, hx: x, hy: y, tgt: null, rest: 0, k, touch: 0, charge: 0 }; L.enemies.push(e); return e; };
    const stand = () => { p.x = room.x - 80; p.y = room.y - 22.5; p.vx = 0; p.vy = 0; };
    const out = {};
    const green = c => /^#[0-9a-f]{6}$/i.test(c) && parseInt(c.slice(3, 5), 16) > parseInt(c.slice(1, 3), 16) + 40;

    // 1: it spits at you. A clear line, in range, hunting.
    stand(); p.hp = 100; p.hitT = 0;
    const e = put(room.x + 150, room.y - 70);         // out of range: it has to swim in first
    e.aggro = true;
    let inside = 0, shot = null, shapes = [];
    for (let i = 0; i < 700 && !shot; i++) {
      await frame(); stand();
      if (inRock(e.x, e.y)) inside++;
      if (e.je) shapes.push(e.je.shape);
      shot = L.enemyShots.find(b => b.goo) || null;
    }
    out.shot = !!shot;
    out.shotGreen = shot && green(shot.col);
    out.dripRate = shot && shot.drip;
    out.dmgRange = [DEV.jeShotDmgLo, DEV.jeShotDmgHi];
    // 2: it drips as it flies — goo particles appear under it, falling
    const sp0 = L.sparks.filter(q => q.g != null).length;
    let maxGoo = 0, fell = false, hp0 = p.hp, hit = false, splat = 0;
    for (let i = 0; i < 200 && !hit; i++) {
      await frame(); stand();
      if (inRock(e.x, e.y)) inside++;
      if (e.je) shapes.push(e.je.shape);
      const goo = L.sparks.filter(q => q.g != null);
      maxGoo = Math.max(maxGoo, goo.length);
      if (goo.some(q => q.vy > 30)) fell = true;
      if (p.hp < hp0) { hit = true; splat = goo.length; }
    }
    out.dripped = maxGoo > sp0; out.fell = fell;
    out.hit = hit; out.lost = hp0 - p.hp; out.splat = splat;
    out.inside = inside;
    out.shapeLo = Math.min(...shapes); out.shapeHi = Math.max(...shapes);
    out.tents = e.je ? e.je.tent.length : 0;

    // 3: a spit on rock splats too (no damage)
    L.enemyShots.length = 0; L.sparks.length = 0;
    L.enemies.splice(L.enemies.indexOf(e), 1);
    L.enemyShots.push({ x: room.x, y: room.y - 30, vx: 0, vy: 200, life: 3, col: k.col.a, dmg: 5, size: 3, goo: 1,
      glow: k.glow, drip: 0, da: 0, dripG: 250, splat: 12, splatV: 80 });
    for (let i = 0; i < 30 && L.enemyShots.length; i++) await frame();
    out.rockSplat = L.sparks.filter(q => q.g != null).length;

    // 4: the glow: with the glow knobs up, the cave above it is greener than with them at 0
    const g = put(room.x + 100, room.y - 60);
    const knobs = ['jeGlowLo', 'jeGlowHi', 'jeFlareLo', 'jeFlareHi'], saved = knobs.map(k => DEV[k]);
    const sample = () => {
      const { cam, s } = L.light, cv = document.querySelector('canvas.game');
      const px = Math.round((g.x - cam.x) * s), py = Math.round((g.y - 24 - cam.y) * s), half = 6;
      if (px < half || py < half || px + half > cv.width || py + half > cv.height) return null;
      const d = cv.getContext('2d').getImageData(px - half, py - half, half * 2, half * 2).data;
      let gsum = 0; for (let i = 0; i < d.length; i += 4) gsum += d[i + 1] - (d[i] + d[i + 2]) / 2;
      return gsum / (d.length / 4);
    };
    const steady = async () => {
      const v = [];
      for (let i = 0; i < 40 && v.length < 10; i++) {
        await frame(); stand(); g.x = room.x + 100; g.y = room.y - 60;
        if (g.je) { g.je.vx = g.je.vy = 0; g.je.rest = 9; }
        const s = sample(); if (s !== null) v.push(s);
      }
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    DEV.jeGlowLo = DEV.jeGlowHi = 0; DEV.jeFlareLo = DEV.jeFlareHi = 0;
    out.dark = await steady();
    DEV.jeGlowLo = DEV.jeGlowHi = 0.6;
    out.lit = await steady();
    knobs.forEach((k, i) => { DEV[k] = saved[i]; });
    out.errors = (window.SFX && SFX.stats && SFX.stats.errors || []).slice();
    return out;
  });

  check('hunting with a clear line, it spits at you', r.shot, r);
  check('the spit is green', r.shotGreen);
  check('it drips as it flies', r.dripRate > 0 && r.dripped, { rate: r.dripRate, dripped: r.dripped });
  check('and the drips fall', r.fell);
  check('the spit hurts when it hits you, by the damage knob', r.hit && r.lost >= r.dmgRange[0] && r.lost <= r.dmgRange[1] + 0.5,
    { lost: r.lost, range: r.dmgRange });
  check('and splats into a little burst of goo', r.splat >= 5, r.splat);
  check('a spit on rock splats too', r.rockSplat >= 8, r.rockSplat);
  check('the jelly never went into rock', r.inside === 0, r.inside);
  check('its bell changed shape as it swam (thin and flat)', r.shapeHi > 0.6 && r.shapeLo < 0.3, [r.shapeLo, r.shapeHi]);
  check('it has tentacles', r.tents >= 1, r.tents);
  check('it glows green on the cave round it', r.dark !== null && r.lit !== null && r.lit > r.dark + 3, { dark: r.dark, lit: r.lit });
  check('no sound errors', r.errors.length === 0, r.errors);

  await browser.close();
  if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
  console.log('\nall jelly browser checks passed');
})().catch(e => { console.error(e); process.exit(1); });
