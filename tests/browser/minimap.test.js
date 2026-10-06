// The Mini-map perk (ui/minimap.js): fitted, a box shows over the gun buttons (their width, from just
// above them to halfway up the screen); a tap steps the zoom 1 → ×2 out → ×4 out → 1; a creature in the
// box is a red dot; a pin off the box sticks to its edge. In the generated cave (the owner's screenshots:
// what it looks like there), with CAVERUNNER_SHOTS=<dir>: item12-zoom1.png, item12-zoom4-pin.png
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
const SHOTS = process.env.CAVERUNNER_SHOTS;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const b = await launch();
  const c = await b.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await c.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(DIR, 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p && window.__lvl.viewW)); i++) await page.waitForTimeout(50);
  const shot = async n => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'item12-' + n + '.png') }); };

  check('no mini-map without the perk', await page.evaluate(() => !document.querySelector('.minimap')));
  // fit it, and stand in the cave: an open spot with rock under it, half way down, seen all round
  await page.evaluate(() => {
    const L = window.__lvl, I = window.__in.current, LO = I.loadout, { CW, CELL } = L.world;
    L.guide = null;
    LO.suit = LO.suit || []; LO.suit[0] = 'minimap'; I.notify();
    let at = null;
    for (let y = 500; y < 1100 && !at; y += 3) for (let x = 60; x < CW - 60 && !at; x += 3) {
      let ok = true;
      for (let dy = -14; dy < 0 && ok; dy++) for (let dx = -5; dx <= 5 && ok; dx++) if (L.mat[(y + dy) * CW + x + dx]) ok = false;
      if (ok && L.mat[y * CW + x] && L.mat[y * CW + x - 4] && L.mat[y * CW + x + 4]) at = { x: x * CELL, y: y * CELL };
    }
    window.__at = at;
    const { FW, FH, FOG_U } = L.fog;
    const fx = Math.floor(at.x / FOG_U), fy = Math.floor(at.y / FOG_U);
    for (let y = Math.max(0, fy - 22); y < Math.min(FH, fy + 22); y++) for (let x = Math.max(0, fx - 22); x < Math.min(FW, fx + 22); x++) L.seen[y * FW + x] = 2;
    L.p.x = at.x - 6; L.p.y = at.y - 30; L.p.vx = L.p.vy = 0; L.p.hp = 99999; L.p.face = 1;
    const e = L.enemies.find(q => !q.dead);
    if (e) { L.enemies.length = 0; L.enemies.push(Object.assign(e, { x: at.x + 70, y: at.y - 60, ty: at.y - 60, hx: at.x + 70, hy: at.y - 60, hp: 9999, hpMax: 9999 })); }
    L.pickups.push({ kind: 'crystal', x: at.x - 50, y: at.y - 8, t: 0 }, { kind: 'crystal', green: true, x: at.x - 30, y: at.y - 8, t: 0 });
    I.right = { active: true, nx: 0.8, ny: -0.6, mag: 0.3, dy: 0, on: false };
  });
  await page.waitForTimeout(500);
  const geo = await page.evaluate(() => {
    const r = el => { const q = el.getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom }; };
    const m = document.querySelector('.minimap'), guns = [...document.querySelectorAll('.slots .slot')].map(r);
    return m && { m: r(m), zoom: m.dataset.zoom, k: +m.dataset.k, foes: +m.dataset.foes, H: window.innerHeight,
      gl: Math.min(...guns.map(g => g.l)), gr: Math.max(...guns.map(g => g.r)), gt: Math.min(...guns.map(g => g.t)) };
  });
  check('fitted: the mini-map shows', !!geo, geo);
  if (geo) {
    check('as wide as the gun buttons', Math.abs(geo.m.l - geo.gl) < 2 && Math.abs(geo.m.r - geo.gr) < 2, geo);
    check('its bottom a little above the gun buttons', geo.m.b < geo.gt && geo.gt - geo.m.b < 16, geo);
    check('its top halfway up the screen', Math.abs(geo.m.t - geo.H / 2) < 3, geo);
    check('zoom 1', geo.zoom === '1', geo.zoom);
    check('the creature nearby is a dot', geo.foes >= 1, geo.foes);
  }
  // a creature in a part you haven't explored shows no dot (owner)
  const hidden = await page.evaluate(async () => {
    const L = window.__lvl, { FW, FOG_U } = L.fog, e = L.enemies[0], at = window.__at;
    if (!e) return null;
    // buried in the rock under the floor: your sight never lifts the fog in there
    const keep = { x: e.x, y: e.y, ty: e.ty, hx: e.hx, hy: e.hy };
    Object.assign(e, { x: at.x + 20, y: at.y + 60, ty: at.y + 60, hx: at.x + 20, hy: at.y + 60, vx: 0, vy: 0 });
    const i = Math.floor(e.ty / FOG_U) * FW + Math.floor(e.x / FOG_U), was = L.seen[i];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) L.seen[i + dy * FW + dx] = 0;
    await new Promise(r => setTimeout(r, 300));
    const n = +document.querySelector('.minimap').dataset.foes;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) L.seen[i + dy * FW + dx] = was;
    Object.assign(e, keep);
    await new Promise(r => setTimeout(r, 300));
    return n;
  });
  check('a creature in unexplored rock shows no dot', hidden === 0, hidden);
  await page.evaluate(() => { window.__in.current.right = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false }; });
  await shot('zoom1');

  // a tap zooms out ×2, again ×2, and the third comes back
  const tap = async () => {
    const q = await page.evaluate(() => { const r = document.querySelector('.minimap').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.touchscreen.tap(q.x, q.y); await page.waitForTimeout(150);
    return page.evaluate(() => { const m = document.querySelector('.minimap'); return { z: m.dataset.zoom, k: +m.dataset.k }; });
  };
  const z2 = await tap(), z4 = await tap();
  check('a tap: zoom out ×2', z2.z === '2' && geo && Math.abs(z2.k * 2 - geo.k) < 1e-4, [z2, geo && geo.k]);
  check('another: ×4', z4.z === '4' && geo && Math.abs(z4.k * 4 - geo.k) < 1e-4, z4);

  // a pin far below sticks to the box's bottom edge, under you; one near shows where it is
  const pin = await page.evaluate(async () => {
    const L = window.__lvl, at = window.__at;
    L.pins.length = 0;
    L.pins.push({ x: L.p.x + 6, y: L.p.y + 3000, e: '⭐' }, { x: L.p.x + 40, y: L.p.y + 10, e: '📍' });
    await new Promise(r => setTimeout(r, 200));
    const m = document.querySelector('.minimap');
    return { pins: m.dataset.pins, w: m.clientWidth, h: m.clientHeight, at };
  });
  const [far, near] = (pin.pins || '').split(' ').map(s => s.split(','));
  check('the far pin is clamped to the bottom edge', far && far[2] === 'out' && Math.abs(+far[1] - (pin.h - 9)) < 2 && Math.abs(+far[0] - pin.w / 2) < 3, pin);
  check('the near pin is in the box, not clamped', near && near[2] === undefined, pin);
  await shot('zoom4-pin');
  const z1 = await tap();
  check('a third tap: back to zoom 1', z1.z === '1' && geo && Math.abs(z1.k - geo.k) < 1e-4, z1);

  // the gun buttons still work under it, and the map hides it
  await page.evaluate(() => { const r = document.querySelectorAll('.slots .slot')[1].getBoundingClientRect(); window.__g = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const g = await page.evaluate(() => window.__g);
  await page.touchscreen.tap(g.x, g.y); await page.waitForTimeout(150);
  check('a gun button still takes a tap', await page.evaluate(() => window.__in.current.loadout.sel === 1));
  const mb = await page.evaluate(() => { const r = document.querySelector('.mapbtn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.touchscreen.tap(mb.x, mb.y); await page.waitForTimeout(200);
  check('the map open: no mini-map over it', await page.evaluate(() => !document.querySelector('.minimap')));
  check('no page errors', errs.length === 0, errs);
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'all ok');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL', e); process.exit(1); });
