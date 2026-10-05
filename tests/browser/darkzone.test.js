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
  const look = (wx, wy) => page.evaluate(([wx, wy]) => {
    const { cam, s } = window.__lvl.light, cv = document.querySelector('canvas.game');
    const px = Math.round((wx - cam.x) * s), py = Math.round((wy - cam.y) * s), h = 10;
    if (px < h || py < h || px + h > cv.width || py + h > cv.height) return null;
    const d = cv.getContext('2d').getImageData(px - h, py - h, h * 2, h * 2).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return sum / (d.length / 4);
  }, [wx, wy]);
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
        if (ok) return { x: x * CELL - 6, y: (y + 1) * CELL - 22 - 0.5, dir, cx: x * CELL, cy: (y - 5) * CELL };
      }
    }
    return null;
  });
  check('found a zone\'s edge to stand at', !!edge, edge);
  if (edge) {
    // the same two spots (40 into the tomb behind, 40 into the zone ahead), aimed each way: the gun's light is the difference
    const T = edge.cx - edge.dir * 40, Z = edge.cx + edge.dir * 54;   // (54: past the soft edge)
    await stand(edge.x, edge.y, -edge.dir, 0);
    const tombLit = await look(T, edge.cy), zoneAway = await look(Z, edge.cy);
    await stand(edge.x, edge.y, edge.dir, 0);
    const zoneLit = await look(Z, edge.cy), tombAway = await look(T, edge.cy);
    await shot('2-edge');
    check('at the edge: the gun lights the tomb behind you', tombLit - tombAway > 12, { aimedAt: tombLit, aimedAway: tombAway });
    check('but aimed into the zone it lights nothing there', Math.abs(zoneLit - zoneAway) < 5, { aimedAt: zoneLit, aimedAway: zoneAway });
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
  check('and with the darkness off it would', bare - bareAway > 12 && deep < bare * 0.7, { aimedAt: bare, aimedAway: bareAway });
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

  // ---- the sandbox: a room, its right half a dark zone; the gun light lights the left half only ----
  const room = await page.evaluate(() => {
    const W = window.__lvl, { CW, CH, CELL } = W.world, r = W.sandbox({ w: 360, h: 120 });
    const mask = new Uint8Array(CW * CH), x0 = Math.round(r.x / CELL) + 8, x1 = Math.round(r.r / CELL) + 6;
    const y0 = Math.round(r.y / CELL) - 70, y1 = Math.round(r.y / CELL) + 8;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mask[y * CW + x] = 1;
    W.darkMask = mask; W.webbing = new Uint8Array(CW * CH);
    W.dark = [{ id: 0, cx: (x0 + x1) >> 1, cy: (y0 + y1) >> 1, r: 30, x0, y0, x1, y1, room: -1, cells: 0, chamber: { x: 0, y: 0, rx: 1, ry: 1, floor: 0 } }];
    for (let i = 0; i < W.seen.length; i++) if (W.seen[i] === 2) W.seen[i] = 1;     // remembered: only your light lights it
    W.fog.paint();
    return { x: r.x - 6, y: r.y - 22 - 0.5, cx: r.x, cy: r.y - 12 };
  });
  await page.evaluate(() => { DEV.zoom = 1; });
  await stand(room.x, room.y, 1, 0);
  const right = await look(room.cx + 70, room.cy);
  await shot('6-sandbox-right');
  await stand(room.x, room.y, -1, 0);
  const left = await look(room.cx - 70, room.cy);
  await page.evaluate(() => { window.__lvl.darkMask = null; });
  await stand(room.x, room.y, 1, 0);
  const plain = await look(room.cx + 70, room.cy);
  check('sandbox: aimed into the dark half, the gun light does nothing there', right !== null && left !== null && plain !== null && right < left * 0.4 && right < plain * 0.4, { zone: right, otherHalf: left, noZone: plain });

  await browser.close();
  console.log(`shots in ${OUT}`);
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
