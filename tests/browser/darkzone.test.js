// Level 2 stage 4: floor 2's dark zones in the real game, phone size. Goes to floor 2 (a fixed seed),
// checks the level carries its zones (W.dark, W.darkMask, W.webbing, darkAt), and takes the owner's shots:
// the whole floor with its zones, standing at a zone's edge aiming in (the gun light dies there), deep in
// its chamber in the dark, the chamber lit by fire and by a blast, and the silk up close with the fog
// lifted. Then a sandbox check: a room half dark, the gun light lights the other half, not the dark one.
// Shots go to tests/build/dark-*.png (DARK_SHOTS=<dir> to put them elsewhere).
const { launch } = require('../chromium');
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const OUT = process.env.DARK_SHOTS || path.join(__dirname, '..', 'build');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  const shot = n => page.screenshot({ path: path.join(OUT, 'dark-' + n + '.png') });
  await page.evaluate(() => { window.__lvl.guide = null; Math.random = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); window.__in.current.newCave = 2; });
  let info = null;
  for (let i = 0; i < 40 && !(info && info.floor === 2); i++) {
    await page.waitForTimeout(100);
    info = await page.evaluate(() => { const L = window.__lvl; return { floor: L.floor, zones: L.dark.length, mask: !!L.darkMask, web: !!L.webbing, sconces: L.sconces.length }; });
  }
  check('no wall torches in the tomb (it is dark: only fire gives light; owner)', info.sconces === 0, info.sconces);
  check('floor 2 has dark zones, their mask and their silk on the world', info.floor === 2 && info.zones >= 1 && info.mask && info.web, info);

  // ---- the whole floor: background, rock, decoration, the silk; the zones' darkness laid over ----
  const full = await page.evaluate(() => {
    const W = window.__lvl, { CW, CH } = W.world;
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const x = c.getContext('2d');
    const layer = im => { const t = document.createElement('canvas'); t.width = im.width; t.height = im.height; t.getContext('2d').putImageData(im, 0, 0); return t; };
    x.imageSmoothingEnabled = false;
    x.drawImage(layer(makeLevel(W.seed, 2).bgImg), 0, 0, CW, CH);
    const web = new ImageData(CW, CH), dark = new ImageData(CW, CH);
    for (let i = 0; i < CW * CH; i++) {
      if (W.webbing[i]) { const s = silkColour(W.webbing[i]); web.data.set(s, i * 4); }
      if (W.darkMask[i]) { dark.data[i * 4 + 3] = 150; dark.data[i * 4 + 2] = 18; }
    }
    x.drawImage(layer(web), 0, 0);
    x.drawImage(layer(W.img), 0, 0);
    x.drawImage(layer(W.dimg), 0, 0);
    x.drawImage(layer(dark), 0, 0);
    x.strokeStyle = 'rgba(200,170,255,0.8)'; x.lineWidth = 1;
    for (const z of W.dark) { x.beginPath(); x.ellipse(z.chamber.x, z.chamber.y, z.chamber.rx, z.chamber.ry, 0, 0, Math.PI * 2); x.stroke(); }
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(OUT, 'dark-1-floor.png'), Buffer.from(full.split(',')[1], 'base64'));

  // ---- in the game: the fog as remembered (the gun light matters), creatures parked, you pinned ----
  await page.evaluate(() => {
    const L = window.__lvl;
    L.seen.fill(1); L.fog.paint();
    window.__aim = { nx: 1, ny: 0 }; window.__pin = null;
    const loop = () => {
      const p = window.__pin;
      if (p) { L.p.x = p.x; L.p.y = p.y; L.p.vx = L.p.vy = 0; }
      L.p.hp = 9999;
      for (const e of L.enemies) { e.x = 30; e.y = 30; e.ty = 30; e.hx = 30; e.hy = 30; }
      L.enemyShots.length = 0;
      window.__in.current.right = { active: true, on: false, nx: window.__aim.nx, ny: window.__aim.ny, mag: 0.2 };
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    L.pickups.length = 0;
  });
  const look = (wx, wy, h = 10) => page.evaluate(([wx, wy, h]) => {
    const { cam, s } = window.__lvl.light, cv = document.querySelector('canvas.game');
    const px = Math.round((wx - cam.x) * s), py = Math.round((wy - cam.y) * s);
    if (px < h || py < h || px + h > cv.width || py + h > cv.height) return null;
    const d = cv.getContext('2d').getImageData(px - h, py - h, h * 2, h * 2).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return sum / (d.length / 4);
  }, [wx, wy, h]);
  const stand = async (x, y, nx, ny) => { await page.evaluate(([x, y, nx, ny]) => { window.__pin = { x, y }; window.__aim = { nx, ny }; }, [x, y, nx, ny]); await page.waitForTimeout(900); };
  await page.waitForTimeout(3000);           // outlast the floor's name card

  // a spot at a zone's edge: on the floor just outside, the zone's open cave a few px on (left or right)
  const edge = await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, m = W.mat, k = W.darkMask;
    const free = (x, y) => { for (let j = 0; j < 11; j++) for (let i = 0; i < 6; i++) if (m[(y - j) * CW + x + i]) return false; return true; };
    for (const z of W.dark) for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0 - 12; x <= z.x1 + 12; x++) {
      const i = y * CW + x;
      if (k[i] || m[i] || !m[i + CW] || !free(x, y)) continue;
      for (const dir of [1, -1]) {
        // the zone's open cave from 8 to 30 px on, at chest height; open tomb as far behind
        let ok = true;
        for (let s = 8; s <= 30 && ok; s++) { const j = i - 5 * CW + dir * s; if (!k[j] || m[j]) ok = false; }
        for (let s = 4; s <= 30 && ok; s++) { const j = i - 5 * CW - dir * s; if (k[j] || m[j]) ok = false; }
        // (round 3) and the zone deep enough ahead that the torch fails there
        let deep = false;
        for (let s = 8; s <= 150 && ok && !deep; s++) if (W.darkDepth[i - 5 * CW + dir * s] >= DEV.l2dTorchDepth + 16) deep = true;
        if (ok && deep) return { x: x * CELL - 6, y: (y + 1) * CELL - 22 - 0.5, dir, cx: x * CELL, cy: (y - 5) * CELL };
      }
    }
    return null;
  });
  check('found a zone\'s edge to stand at', !!edge, edge);
  if (edge) {
    // the same two spots (40 into the tomb behind, 40 into the zone ahead), aimed each way: the gun's light is the difference
    // (round 3: the torch lights the first stretch in, until DEV.l2dTorchDepth: the zone spot is past that, in
    // the beam: a few degrees either side of straight ahead)
    const zp = await page.evaluate(([cx, cy, dir]) => {
      const W = window.__lvl, { CW, CELL } = W.world;
      for (let s = 30; s < 360; s += 2) for (let a = 0; a <= 0.3; a += 0.05) for (const sg of [1, -1]) {
        const x = cx + dir * Math.cos(a) * s, y = cy + Math.sin(a * sg) * s;
        if (W.darkDepth[Math.floor(y / CELL) * CW + Math.floor(x / CELL)] >= DEV.l2dTorchDepth + 24) return { x, y, nx: dir * Math.cos(a), ny: Math.sin(a * sg) };
      }
      return null;
    }, [edge.cx, edge.cy, edge.dir]);
    check('found a spot deep in the zone, in the beam', !!zp);
    if (zp) {
      const T = edge.cx - edge.dir * 40;
      await stand(edge.x, edge.y, -edge.dir, 0);
      const tombLit = await look(T, edge.cy), zoneAway = await look(zp.x, zp.y);
      await stand(edge.x, edge.y, zp.nx, zp.ny);
      const zoneLit = await look(zp.x, zp.y), tombAway = await look(T, edge.cy);
      await shot('2-edge');
      check('at the edge: the gun lights the tomb behind you', tombLit - tombAway > 12, { aimedAt: tombLit, aimedAway: tombAway });
      check('but aimed deep into the zone (past where the torch fails) it lights nothing there', Math.abs(zoneLit - zoneAway) < 5, { aimedAt: zoneLit, aimedAway: zoneAway });
    }
  }
  // deep in: the chamber's floor
  const ch = await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, z = W.dark[0], c = z.chamber;
    // a column near the middle whose floor is the chamber's (a tunnel may drop away under the very middle)
    let best = null;
    for (let d = 0; d < c.rx && !best; d++) for (const x of [c.x - d, c.x + d]) {
      let y = c.y;
      while (y < c.floor + 3 && !W.mat[(y + 1) * CW + x]) y++;
      if (y < c.floor + 3 && W.mat[(y + 1) * CW + x + 3] && W.mat[(y + 1) * CW + x - 3]) { best = { x, y }; break; }
    }
    const b = best || { x: c.x, y: c.y };
    return { x: b.x * CELL - 6, y: (b.y + 1) * CELL - 22 - 0.5, cx: b.x * CELL, cy: (b.y - 6) * CELL, tx: b.x, ty: b.y, c, inZone: darkAt(W, c.x * CELL, c.y * CELL, CELL) };
  });
  check('the zone\'s chamber is in the zone (darkAt)', ch.inZone === 0, ch.inZone);
  await stand(ch.x, ch.y, -1, 0);
  const deepAway = await look(ch.cx + 40, ch.cy);
  await stand(ch.x, ch.y, 1, 0);
  const deep = await look(ch.cx + 40, ch.cy);
  await shot('3-deep');
  await page.evaluate(() => { DEV.l2dDark = 0; });
  await stand(ch.x, ch.y, -1, 0);
  const bareAway = await look(ch.cx + 40, ch.cy);
  await stand(ch.x, ch.y, 1, 0);
  const bare = await look(ch.cx + 40, ch.cy);
  await page.evaluate(() => { DEV.l2dDark = DEV_DEFAULTS.l2dDark; });
  check('deep inside: the gun light adds nothing (aimed at a spot or away, the same)', Math.abs(deep - deepAway) < 4, { aimedAt: deep, aimedAway: deepAway });
  // (the spot lit by the gun is darker in the zone by most of what the gun adds; not a ratio: since round 2 the
  // spot can sit on a bright silk strand, faintly backlit in the dark: DEV.l2dBack)
  // (round 3: deep in, the torch itself has failed: W.torchLit)
  check('and the torch has failed there', await page.evaluate(() => window.__lvl.torchLit === 0 && window.__lvl.torchFail.inside));
  // fire in the dark: a patch of something that burns on the chamber floor, alight
  const firePatch = await page.evaluate(([tx, ty]) => {
    const W = window.__lvl, { CW, CELL } = W.world;
    let n = 0;
    for (let yy = ty - 12; yy <= ty; yy++) for (let xx = tx + 10; xx < tx + 30; xx++) if (!W.mat[yy * CW + xx]) { W.fire.fuel[yy * CW + xx] = 3; n++; }
    for (let k = 0; k < 4; k++) W.ignite((tx + 12 + k * 5) * CELL, (ty - 2) * CELL, 10, 1);
    return { n, lit: W.fire.list.length, x: (tx + 20) * CELL, y: (ty - 6) * CELL };
  }, [ch.tx, ch.ty]);
  await page.waitForTimeout(700);
  const lit = await look(firePatch.x, firePatch.y);
  await shot('4-fire');
  check('fire lights the dark', firePatch.lit > 0 && lit !== null && lit > deep * 1.5 + 4, { fire: lit, dark: deep, patch: firePatch });
  await page.evaluate(([x, y]) => { window.__lvl.explode(x - 50, y - 6, 16); }, [ch.cx, ch.cy]);
  await page.waitForTimeout(60);
  await shot('4b-blast');
  // the silk up close, the fog lifted
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const L = window.__lvl; L.seen.fill(2); L.fog.paint(); DEV.zoom = 3; });
  await stand(ch.x - 30, ch.y, -1, 0);
  await shot('5-silk-dark');
  await page.evaluate(() => { DEV.l2dDark = 0; });
  await page.waitForTimeout(400);
  await shot('5b-silk-darkness-off');
  await page.evaluate(() => { DEV.l2dDark = DEV_DEFAULTS.l2dDark; DEV.zoom = 1; });

  // ---- the hologram through the silk: diffused (a soft glow), not sharp, and not just dimmed ----
  // Its own light on screen = the frame with it at full brightness minus the frame with it off, along a
  // strip across open air (rock and you are the same in both). Sharpness: the steepest steps along it.
  const strip = (wx0, wx1, wy) => page.evaluate(([wx0, wx1, wy]) => {
    const { cam, s } = window.__lvl.light, cv = document.querySelector('canvas.game');
    const x0 = Math.max(0, Math.round((wx0 - cam.x) * s)), x1 = Math.min(cv.width - 1, Math.round((wx1 - cam.x) * s)), y = Math.round((wy - cam.y) * s);
    const d = cv.getContext('2d').getImageData(x0, y - 1, x1 - x0, 3).data, out = [];
    for (let x = 0; x < x1 - x0; x++) { let r = 0; for (let k = 0; k < 3; k++) r += d[(k * (x1 - x0) + x) * 4]; out.push(r / 3); }
    return out;
  }, [wx0, wx1, wy]);
  const holoLight = async (wx0, wx1, wy) => {
    await page.evaluate(() => { DEV.holoMin = DEV.holoMax = 1; });
    await page.waitForTimeout(500);
    const on = await strip(wx0, wx1, wy);
    await page.evaluate(() => { DEV.holoMin = DEV.holoMax = 0; });
    await page.waitForTimeout(500);
    const off = await strip(wx0, wx1, wy);
    const d = on.map((v, i) => Math.max(0, v - (off[i] || 0))), steps = [];
    for (let i = 1; i < d.length; i++) steps.push(Math.abs(d[i] - d[i - 1]));
    steps.sort((a, b) => b - a);
    const top = steps.slice(0, Math.max(1, Math.round(steps.length * 0.03)));
    return { mean: d.reduce((a, b) => a + b, 0) / Math.max(1, d.length), sharp: top.reduce((a, b) => a + b, 0) / top.length, n: d.length };
  };
  const CELL = await page.evaluate(() => window.__lvl.world.CELL);
  // outside: a wide tomb room no zone reaches (the strip spans more than a tile of the hologram)
  const hall = await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, sh = W.darkShade;
    const clear = r => { for (let y = r.y - 30; y <= r.floor + 30; y++) for (let x = r.x - 30; x < r.x + r.w + 30; x++) if (sh && sh[y * CW + x]) return false; return true; };
    const r = W.tomb.rooms.filter(r => r.dark < 0 && r.w >= 90 && r.h >= 30 && clear(r)).sort((a, b) => b.w - a.w)[0];
    return r ? { x: r.cx * CELL - 6, y: r.floor * CELL - 22.5, x0: (r.x + 6) * CELL, x1: (r.x + r.w - 6) * CELL, wy: (r.floor - 20) * CELL } : null;
  });
  check('found a wide tomb room away from the zones', !!hall, hall);
  if (hall) {
    await page.evaluate(() => { const W = window.__lvl; W.fire.fuel.fill(0); W.fire.list.length = 0; });   // (the fire above: out)
    await stand(hall.x, hall.y, 1, 0);
    const out = await holoLight(hall.x0, hall.x1, hall.wy);
    // inside: across the chamber, above your head
    const c = ch.c, cy = (c.floor - 17) * CELL;
    await stand(ch.x, ch.y, 1, 0);
    const inn = await holoLight((c.x - c.rx + 4) * CELL, (c.x + c.rx - 4) * CELL, cy);
    await page.evaluate(() => { DEV.l2dHolo = 0; });
    const none = await holoLight((c.x - c.rx + 4) * CELL, (c.x + c.rx - 4) * CELL, cy);
    await page.evaluate(() => { DEV.l2dHolo = DEV_DEFAULTS.l2dHolo; DEV.holoMin = DEV_DEFAULTS.holoMin; DEV.holoMax = DEV_DEFAULTS.holoMax; });
    console.log('hologram light along a strip (red, device px): tomb', JSON.stringify(out), 'zone', JSON.stringify(inn), 'zone with l2dHolo 0', JSON.stringify(none));
    check('the hologram is sharp in the tomb', out.sharp > 40, out);
    check('in a zone it is diffused: far lower contrast than in the tomb', inn.sharp < out.sharp * 0.4, { zone: inn.sharp, tomb: out.sharp });
    check('but it still glows there (not just dimmed away)', inn.mean > 4 && inn.mean > none.mean + 3, { glow: inn.mean, holoOff: none.mean });
  }

  // ---- round 3: silhouettes, fire lifting them, the silk multiplying, the torch failing ----
  await page.evaluate(() => { const W = window.__lvl; W.fire.fuel.fill(0); W.fire.list.length = 0; DEV.holoMin = DEV.holoMax = 0; });
  const you = () => page.evaluate(() => { const p = window.__lvl.p; return { x: p.x + 6, y: p.y + 13 }; });
  await stand(ch.x, ch.y, 1, 0);
  await page.waitForTimeout(1200);                          // (the torch has failed by now: deep in)
  let me = await you();
  const sil = await look(me.x, me.y, 4);
  await page.evaluate(() => { DEV.l2dDark = 0; });
  await page.waitForTimeout(300);
  const unBlack = await look(me.x, me.y, 4);
  await page.evaluate(() => { DEV.l2dDark = DEV_DEFAULTS.l2dDark; });
  // (as black as the fog of war's own colour over it: layer 5)
  check('deep in a zone you are a black silhouette (and not with the black off)', sil !== null && unBlack !== null && sil < 14 && unBlack > sil + 25, { silhouette: sil, blackOff: unBlack });
  // and the zone's rock is silhouette black too, all of it past the short fade in (owner, round 3): every rock
  // pixel on screen deeper than l2dTintDepth + 8, sampled on a grid
  await page.waitForTimeout(400);
  const rock = await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, { cam, s } = W.light, cv = document.querySelector('canvas.game');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, deep = DEV.l2dTintDepth + 8;
    let n = 0, dark = 0;
    for (let py = 12; py < cv.height * 0.62; py += 5) for (let px = 12; px < cv.width - 12; px += 5) {
      const i = Math.floor((cam.y + py / s) / CELL) * CW + Math.floor((cam.x + px / s) / CELL);
      if (!W.mat[i] || W.darkDepth[i] < deep) continue;
      const k = (py * cv.width + px) * 4;
      n++; if ((d[k] + d[k + 1] + d[k + 2]) / 3 < 16) dark++;
    }
    return { n, dark, share: n ? dark / n : 0 };
  });
  check('the zone\'s rock past the fade is silhouette black (95% of it near-black)', rock.n > 200 && rock.share >= 0.95, rock);
  // a fire beside you lifts the black off you
  await page.evaluate(([tx, ty]) => {
    const W = window.__lvl, { CW, CELL } = W.world;
    for (let yy = ty - 12; yy <= ty; yy++) for (let xx = tx + 6; xx < tx + 18; xx++) if (!W.mat[yy * CW + xx]) W.fire.fuel[yy * CW + xx] = 3;
    for (let k = 0; k < 3; k++) W.ignite((tx + 8 + k * 4) * CELL, (ty - 2) * CELL, 10, 1);
  }, [ch.tx, ch.ty]);
  await page.waitForTimeout(600);
  me = await you();
  const byFire = await look(me.x, me.y, 4);
  await shot('7-by-fire');
  check('by a fire your colours come back', byFire !== null && byFire > sil + 25, { byFire, silhouette: sil });
  await page.evaluate(() => { const W = window.__lvl; W.fire.fuel.fill(0); W.fire.list.length = 0; });
  // the torch: walking in it lights you until DEV.l2dTorchDepth, then flickers out; out again it flickers back
  const spots = await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, m = W.mat, dp = W.darkDepth, T = DEV.l2dTorchDepth;
    const free = (x, y) => { for (let j = 0; j < 11; j++) for (let i = 0; i < 6; i++) if (m[(y - j) * CW + x + i]) return false; return true; };
    const depthAt = (x, y) => dp[(y - 5) * CW + x + 3];
    const ok = (x, y) => !m[y * CW + x] && m[(y + 1) * CW + x] && m[(y + 1) * CW + x + 5] && free(x, y);
    const at = [];
    for (const [lo, hi] of [[0, 0], [DEV.l2dTintDepth + 1, T - 1], [T + 8, T + 40]]) {
      let best = null;
      for (const z of W.dark) for (let y = z.y0 - 30; y < z.y1 + 30 && !best; y++) for (let x = z.x0 - 30; x < z.x1 + 30; x++) {
        if (x < 4 || y < 14 || x > CW - 10 || !ok(x, y)) continue;
        const d = depthAt(x, y);
        if (d >= lo && d <= hi && (lo > 0 || !W.darkShade[(y - 5) * CW + x + 3])) { best = { x: x * CELL, y: (y + 1) * CELL - 22.5, d }; break; }
      }
      at.push(best);
    }
    return at;
  });
  check('found spots outside, short of the torch\'s failing and past it', spots.every(Boolean), spots);
  if (spots.every(Boolean)) {
    // (the torch's state each frame for ms, standing at p)
    const record = (p, ms) => page.evaluate(([x, y, ms]) => new Promise(res => {
      window.__pin = { x, y };
      const out = [], t0 = performance.now();
      const tick = () => { out.push(window.__lvl.torchLit); if (performance.now() - t0 < ms) requestAnimationFrame(tick); else res(out); };
      requestAnimationFrame(tick);
    }), [p.x, p.y, ms]);
    await record(spots[0], 1200);
    const shallow = await record(spots[1], 900);
    me = await you();
    const litMe = await look(me.x, me.y, 4);
    await page.evaluate(() => { DEV.l2dDark = 0; });
    await page.waitForTimeout(200);
    const plainMe = await look(me.x, me.y, 4);
    await page.evaluate(() => { DEV.l2dDark = DEV_DEFAULTS.l2dDark; });
    await shot('8-torch-stretch');
    check('short of the trigger depth the torch stays on', shallow.every(v => v === 1), shallow.join(''));
    check('and it lights you through the black there (not a silhouette)', litMe !== null && litMe > 25 && litMe > plainMe * 0.5, { lit: litMe, blackOff: plainMe, depth: spots[1].d });
    const goIn = await record(spots[2], 1600), n08 = Math.round(goIn.length * 0.8 / 1.6);
    const first = goIn.slice(0, n08), after = goIn.slice(n08 + 4);
    check('past it: the torch flickers (on and off), then stays out', first.includes(0) && first.includes(1) && after.length > 5 && after.every(v => v === 0), goIn.join(''));
    const goOut = await record(spots[0], 1600), m08 = Math.round(goOut.length * 0.8 / 1.6);
    check('back out: it flickers back on and stays on', goOut.slice(0, m08).includes(0) && goOut.slice(m08 + 4).every(v => v === 1), goOut.join(''));
  }
  // the silk multiplies (round 3): with the hologram up, the zone's back with the silk is never brighter than
  // without it, and darker on the whole
  await stand(ch.x, ch.y, 1, 0);
  {
    const c = ch.c, cy = (c.floor - 17) * CELL, x0 = (c.x - c.rx + 4) * CELL, x1 = (c.x + c.rx - 4) * CELL;
    await page.evaluate(() => { DEV.holoMin = DEV.holoMax = 1; });
    await page.waitForTimeout(500);
    const withSilk = await strip(x0, x1, cy);
    await page.evaluate(() => { const W = window.__lvl, { CW, CH } = W.world; W.webbing.fill(0); W.webDirty.push({ x0: 0, y0: 0, x1: CW - 1, y1: CH - 1 }); });
    await page.waitForTimeout(500);
    const noSilk = await strip(x0, x1, cy);
    await page.evaluate(() => { DEV.holoMin = DEV_DEFAULTS.holoMin; DEV.holoMax = DEV_DEFAULTS.holoMax; });
    let brighter = 0, sumW = 0, sumN = 0;
    for (let i = 0; i < Math.min(withSilk.length, noSilk.length); i++) { if (withSilk[i] > noSilk[i] + 6) brighter++; sumW += withSilk[i]; sumN += noSilk[i]; }
    check('the silk multiplies: never brighter than what is under it, darker on the whole', brighter <= withSilk.length * 0.02 && sumW < sumN, { brighter, of: withSilk.length, withSilk: sumW / withSilk.length, noSilk: sumN / noSilk.length });
  }

  // ---- the sandbox: a room, its right half a dark zone; the gun light lights the left half only ----
  const room = await page.evaluate(() => {
    const W = window.__lvl, { CW, CH, CELL } = W.world, r = W.sandbox({ w: 360, h: 120 });
    const mask = new Uint8Array(CW * CH), x0 = Math.round(r.x / CELL) + 8, x1 = Math.min(CW - 4, Math.round(r.r / CELL) + 120);   // (on into the rock: deep enough everywhere in the room's right half)
    const y0 = Math.round(r.y / CELL) - 70, y1 = Math.round(r.y / CELL) + 120;   // (deep under the floor too: the torch fails by depth, round 3)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y * CW + x] = 1;
    W.darkMask = mask; W.darkShade = null; W.darkDepth = zoneDepth(mask); W.webbing = new Uint8Array(CW * CH);
    W.dark = [{ id: 0, cx: (x0 + x1) >> 1, cy: (y0 + y1) >> 1, r: 30, x0, y0, x1, y1, room: -1, cells: 0, chamber: { x: 0, y: 0, rx: 1, ry: 1, floor: 0 } }];
    for (let i = 0; i < W.seen.length; i++) if (W.seen[i] === 2) W.seen[i] = 1;     // remembered: only your light lights it
    W.fog.paint();
    return { x: r.x - 6, y: r.y - 22 - 0.5, cx: r.x, cy: r.y - 12 };
  });
  await page.evaluate(() => { DEV.zoom = 1; DEV.holoMin = DEV.holoMax = 0; });   // (the hologram off: a kill's flash would change the picture between two looks)
  await stand(room.x, room.y, 1, 0);
  const right = await look(room.cx + 150, room.cy);      // (past the stretch in the torch still lights: round 3)
  await shot('6-sandbox-right');
  await stand(room.x, room.y, -1, 0);
  const left = await look(room.cx - 150, room.cy), rightAway = await look(room.cx + 150, room.cy);
  await stand(room.x, room.y, 1, 0);
  const leftAway = await look(room.cx - 150, room.cy);
  await page.evaluate(() => { window.__lvl.darkMask = null; });
  await stand(room.x, room.y, 1, 0);
  const plain = await look(room.cx + 150, room.cy);
  // (aimed at it or away: the difference is the gun's light; the zone's own glow, the blurred hologram, is the same both ways)
  check('sandbox: aimed into the dark half, the gun light does nothing there', right !== null && left !== null && plain !== null && Math.abs(right - rightAway) < 5 && left - leftAway > 12, { zone: right, zoneAway: rightAway, otherHalf: left, otherHalfAway: leftAway, noZone: plain });

  await browser.close();
  console.log(`shots in ${OUT}`);
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
