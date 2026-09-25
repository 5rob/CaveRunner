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
    L.enemies.splice(L.enemies.indexOf(g), 1);

    // 5: its tentacles sting, even when it hasn't noticed you. Held just over your head
    // so they hang down through you; aggro reach at nothing so it can't hunt.
    const ag = [DEV.jeAggroLo, DEV.jeAggroHi]; DEV.jeAggroLo = DEV.jeAggroHi = 0.001;
    stand(); p.hp = 100;
    const t = put(p.x + 6, p.y - 16);
    const pin = () => { t.x = p.x + 6; t.y = p.y - 16; t.aggro = false; if (t.je) { t.je.vx = t.je.vy = 0; t.je.rest = 9; t.je.hd = -Math.PI / 2; } };
    let stung = 0, hunted = false;
    for (let i = 0; i < 240 && p.hp >= 100; i++) { await frame(); stand(); pin(); if (t.aggro) hunted = true; }
    out.stung = 100 - p.hp; out.hunted = hunted; out.biteRange = [DEV.jeBiteLo, DEV.jeBiteHi];
    // and moved off to the side, clear of them, it doesn't
    p.hp = 100;
    t.x = p.x + 80; t.y = p.y - 16; t.hx = t.x; t.hy = t.y;
    for (let i = 0; i < 90; i++) { await frame(); stand(); t.x = p.x + 80; t.y = p.y - 16; t.aggro = false; if (t.je) { t.je.vx = t.je.vy = 0; t.je.rest = 9; } }
    out.clear = 100 - p.hp;
    L.enemies.splice(L.enemies.indexOf(t), 1);
    [DEV.jeAggroLo, DEV.jeAggroHi] = ag;

    // 6: the colour knobs repaint it: a red bell reads red on the canvas
    const cols = ['jeColTopLo', 'jeColTopHi', 'jeColBodyLo', 'jeColBodyHi', 'jeColRimLo', 'jeColRimHi'];
    const cs = cols.map(k => DEV[k]);
    const q = put(room.x + 60, room.y - 60);
    const rgbAt = () => {
      const { cam, s } = L.light, cv = document.querySelector('canvas.game');
      const px = Math.round((q.x - cam.x) * s), py = Math.round((q.y - cam.y) * s);
      const d = cv.getContext('2d').getImageData(px - 2, py - 2, 4, 4).data;
      let r = 0, gg = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; }
      return { r: r / 16, g: gg / 16 };
    };
    const hold = async () => { for (let i = 0; i < 6; i++) { await frame(); stand(); q.x = room.x + 60; q.y = room.y - 60; if (q.je) { q.je.vx = q.je.vy = 0; q.je.rest = 9; } } return rgbAt(); };
    out.green = await hold();
    cols.forEach(k => { DEV[k] = '#ff2020'; });
    out.red = await hold();
    cols.forEach((k, i) => { DEV[k] = cs[i]; });
    L.enemies.splice(L.enemies.indexOf(q), 1);
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
  check('its tentacles sting you when you touch them, by the sting knob', r.stung >= r.biteRange[0] && r.stung <= r.biteRange[1] + 0.5,
    { stung: r.stung, range: r.biteRange });
  check('even though it never noticed you', !r.hunted);
  check('and clear of them, no sting', r.clear === 0, r.clear);
  check('the default jelly is green', r.green.g > r.green.r, r.green);
  check('the colour knobs repaint it (a red bell reads red)', r.red.r > r.red.g + 40, r.red);
  check('no sound errors', r.errors.length === 0, r.errors);

  // the Dev panel: a colour picker per part, A and B, that sets the knob and resets
  await page.tap('.devbtn');
  await page.waitForTimeout(250);
  await page.tap('.devghead[data-g=jellycol]');
  await page.waitForTimeout(150);
  const pickers = await page.$$('.devrow input[type=color]');
  const want = await page.evaluate(() => DEV_META.filter(m => m.g === 'jellycol' && m.type === 'color').length);
  check('Dev → Jellyfish colours has a colour picker for every part, A and B', pickers.length === want && want >= 20, [pickers.length, want]);
  await pickers[0].fill('#ff00aa');
  const set = await page.evaluate(() => DEV.jeColTopLo);
  check('picking a colour sets the knob', set === '#ff00aa', set);
  await page.evaluate(() => { const el = document.querySelector('.devrow input[type=color]');
    el.parentNode.querySelector('.devreset').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  const back = await page.evaluate(() => DEV.jeColTopLo === DEV_DEFAULTS.jeColTopLo);
  check('and ↺ puts the default back', back);
  // the live jellyfish above the colour group, and the master sliders repainting it
  const prev = () => page.evaluate(() => {
    const c = document.querySelector('.jellyprev');
    if (!c || !c.width) return null;
    // above the rock ledge, and only the brighter pixels (the jelly, not the dark water)
    const d = c.getContext('2d').getImageData(0, 0, c.width, Math.floor(c.height * 0.8)).data;
    let gx = 0, lit = 0;
    for (let i = 0; i < d.length; i += 4) { const v = d[i + 1] - (d[i] + d[i + 2]) / 2; if (d[i] + d[i + 1] + d[i + 2] > 200) { lit++; gx += v; } }
    return { lit, green: gx / Math.max(1, lit) };
  });
  const order = await page.evaluate(() => {
    const pv = document.querySelector('.jellyprev'), hd = document.querySelector('.devghead[data-g=jellycol]');
    return !!pv && !!hd && !!(pv.compareDocumentPosition(hd) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  check('a live jellyfish box sits above the Jellyfish colours section', order);
  await page.waitForTimeout(600);
  const p0 = await prev();
  check('it draws a green jellyfish', p0 && p0.lit > 200 && p0.green > 40, p0);
  const slide = (i, v) => page.evaluate(([i, v]) => {
    const el = document.querySelectorAll('.devrow input[type=range]')[i];
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [i, v]);
  const sliders = await page.$$('.devrow input[type=range]');
  check('three master sliders: hue, saturation, brightness', sliders.length === 3, sliders.length);
  await slide(0, 180);
  await page.waitForTimeout(400);
  const p1 = await prev();
  const hue = await page.evaluate(() => DEV.jeHue);
  check('dragging hue sets the knob', hue === 180, hue);
  check('and the preview turns (green goes to magenta)', p1 && p1.green < -40, p1);
  await slide(0, 0); await slide(1, 0);
  await page.waitForTimeout(400);
  const p2 = await prev();
  check('saturation 0 greys it out', p2 && Math.abs(p2.green) < 12, p2);
  const rs = await page.evaluate(() => { const b = document.querySelectorAll('.devrow .devreset'); b[0].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return [DEV.jeHue, DEV.jeSat]; });
  check('↺ puts the sliders back', rs[0] === 0 && rs[1] === 1, rs);
  await page.evaluate(() => { try { localStorage.removeItem('caverunner-dev'); } catch (_) {} });

  await browser.close();
  if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
  console.log('\nall jelly browser checks passed');
})().catch(e => { console.error(e); process.exit(1); });
