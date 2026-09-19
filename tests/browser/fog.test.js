// Fog of war in the real game: the cave starts dark, flying through it reveals cells,
// what you revealed stays revealed while you walk away, and a new floor is dark again.
// Also times the draw loop with the fog in it, because the whole point of the coarse
// grid is that it does not cost a frame.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const OUT = path.join(__dirname, '..', 'build');

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1300);

  const lit = () => page.evaluate(() => {
    const { seen, FW, FH } = window.__lvl.fog;
    let n = 0;
    for (let i = 0; i < seen.length; i++) if (seen[i]) n++;
    return { n, total: FW * FH, FW, FH };
  });
  // how much of the cave proper (above the shop roof) is lit
  const caveLit = () => page.evaluate(() => {
    const { seen, FW, FOG, SHOP_TOP, SHOP_ROOF } = window.__lvl.fog;
    const roof = Math.floor((SHOP_TOP - SHOP_ROOF) / FOG);
    let n = 0;
    for (let y = 0; y < roof; y++) for (let x = 0; x < FW; x++) if (seen[y * FW + x]) n++;
    return { n, total: roof * FW };
  });

  const a = await lit(), ca = await caveLit();
  const base = ca.n;   // standing on the shop floor you can see a little way up the shaft
  console.log(`  grid ${a.FW}x${a.FH}; standing in the shop, ${a.n}/${a.total} cells lit, ` +
    `${base}/${ca.total} of them in the cave above the roof`);
  check('the cave above the shop is dark on arrival', base / ca.total < 0.01,
    `${base}/${ca.total} cave cells lit, ${(base / ca.total * 100).toFixed(2)}%`);
  await page.screenshot({ path: path.join(OUT, 'fog_shop.png') });

  // Somewhere in the cave with room around it to stand, so the torch has something to
  // light. The spots this suite used to teleport to were fine when a reveal was an
  // unconditional disc; a spot buried in rock now lights nothing at all.
  const caveSpot = await page.evaluate(() => {
    const { mat, world } = window.__lvl;
    const { CW, CH, CELL } = world;
    const solid = (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= CH || mat[cy * CW + cx] !== 0;
    for (let cy = 400; cy < CH - 700; cy += 6) {
      for (let cx = 220; cx < CW - 220; cx += 6) {
        let ok = true;                                     // a room: 13 cells each way
        for (let dy = -6; dy <= 6 && ok; dy++)
          for (let dx = -6; dx <= 6; dx++) if (solid(cx + dx, cy + dy)) { ok = false; break; }
        if (ok) return { x: cx * CELL + CELL / 2 - 6, y: cy * CELL + CELL / 2 - 11 };
      }
    }
    return null;
  });
  check('found an open spot in the cave to stand', !!caveSpot, caveSpot);
  if (!caveSpot) { await browser.close(); process.exit(1); }

  // up into the cave proper
  await page.evaluate(async spot => {
    const { p } = window.__lvl;
    p.x = spot.x; p.y = spot.y; p.vx = 0; p.vy = 0;
    await new Promise(r => setTimeout(r, 250));
  }, caveSpot);
  const b = await caveLit();
  check('stepping into the cave lights cells around you', b.n > base * 3, `${base} -> ${b.n} cave cells lit`);

  // ---- and every cell that just went on the map really was in sight ----
  // The map is meant to hold what the torch could see and nothing else, so: stand still
  // somewhere in the cave, wipe the grid, let it fill in from that one spot, and march a
  // line to every cell that lit. The march is the game's own losClear, cell by cell — a
  // fixed-step march is exactly the thing that tunnels through a one-pixel wall, and this
  // check would be worth nothing if it did.
  const fov = await page.evaluate(async spot => {
    const { p, world, fog, light } = window.__lvl;
    const { CW, CH, CELL } = world;
    p.x = spot.x; p.y = spot.y; p.vx = 0; p.vy = 0; p.hp = 9999;
    window.__pin = { x: p.x, y: p.y };
    const loop = () => {
      p.x = window.__pin.x; p.y = window.__pin.y; p.vx = 0; p.vy = 0; p.hp = 9999;
      if (!window.__pinStop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    await new Promise(r => setTimeout(r, 500));          // let the camera settle, then wipe
    fog.seen.fill(0);
    await new Promise(r => setTimeout(r, 300));          // 18 frames from one still spot
    const px = p.x + 6, py = p.y + 11;
    const solid = (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= CH ||
      window.__lvl.mat[cy * CW + cx] !== 0;
    const seen = fog.seen;
    let fresh = 0, blocked = 0, insideRock = 0, furthest = 0;
    for (let i = 0; i < seen.length; i++) {
      if (!seen[i]) continue;
      fresh++;
      const x = (i % fog.FW + 0.5) * fog.FOG_U, y = (Math.floor(i / fog.FW) + 0.5) * fog.FOG_U;
      furthest = Math.max(furthest, Math.hypot(x - px, y - py));
      if (solid(Math.floor(x / CELL), Math.floor(y / CELL))) { insideRock++; continue; }
      if (!light.losClear(px, py, x, y, solid)) blocked++;
    }
    return { fresh, blocked, insideRock, furthest, sight: fog.SIGHT };
  }, caveSpot);
  console.log(`  from a standstill, ${fov.fresh} cells went on the map, the furthest ${fov.furthest.toFixed(0)} ` +
    `units away of a ${fov.sight}-unit sight radius`);
  check('there was something to check', fov.fresh > 20, fov.fresh);
  check('not one of them was behind rock', fov.blocked === 0, `${fov.blocked} of ${fov.fresh}`);
  check('and the map did not reach past the sight radius', fov.furthest <= fov.sight + 1,
    `${fov.furthest.toFixed(1)} against ${fov.sight}`);
  // A cell is sixteen world units across and the grid does not know where the rock inside
  // it is, so a cell straddling a wall is explored if any part of it was visible. Worth
  // printing, not worth asserting: the line of sight above is the property that matters.
  console.log(`  ${fov.insideRock} of them have their centre inside rock, which is a cell the light ` +
    `only reached part of`);
  await page.evaluate(() => { window.__pinStop = true; });

  // remember exactly which cells are on the map now
  const mark = await page.evaluate(() => Array.from(window.__lvl.fog.seen));

  // now fly a long way off and check none of them went dark again
  await page.evaluate(async () => {
    const { p, world } = window.__lvl;
    for (const y of [0.7, 0.5, 0.3, 0.15]) {
      p.x = world.WW * 0.5; p.y = world.WH * y; p.vx = 0; p.vy = 0;
      await new Promise(r => setTimeout(r, 180));
    }
  });
  const c = await caveLit();
  const lost = await page.evaluate(m => {
    const s = window.__lvl.fog.seen;
    let n = 0;
    for (let i = 0; i < s.length; i++) if (m[i] && !s[i]) n++;
    return n;
  }, mark);
  check('flying on reveals more', c.n > b.n, `${b.n} -> ${c.n} cave cells`);
  check('and nothing you already saw went dark', lost === 0, `${lost} cells lost`);
  await page.screenshot({ path: path.join(OUT, 'fog_cave.png') });

  // the trail left behind is a corridor, not the whole map
  const d = await lit();
  const pct = d.n / d.total * 100;
  console.log(`  after crossing the map, ${pct.toFixed(1)}% of the grid is revealed`);
  check('crossing the map does not reveal all of it', pct < 60, `${pct.toFixed(1)}% lit`);

  // ---- frame cost ----
  // draw() runs off requestAnimationFrame; measure the gap between frames while flying
  const frames = await page.evaluate(async () => {
    const { p, world } = window.__lvl;
    const ts = [];
    let stop = false;
    const tick = t => { ts.push(t); if (!stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    for (let i = 0; i < 60; i++) {           // keep moving so the mask keeps repainting
      p.y -= 8; p.x += (i % 2 ? 4 : -4);
      await new Promise(r => setTimeout(r, 16));
    }
    stop = true;
    const gaps = [];
    for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1]);
    gaps.sort((x, y) => x - y);
    return { n: gaps.length, med: gaps[gaps.length >> 1], p95: gaps[Math.floor(gaps.length * 0.95)] };
  });
  console.log(`  frame gap while flying with fog on: median ${frames.med.toFixed(1)}ms, p95 ${frames.p95.toFixed(1)}ms over ${frames.n} frames`);
  check('the game still runs at frame rate with fog on', frames.p95 < 34, frames);

  // ---- a new floor starts dark again ----
  const floorBefore = await page.evaluate(() => window.__lvl.floor);
  await page.evaluate(async () => {
    const { p, portal } = window.__lvl;
    p.x = portal.x; p.y = portal.y;
    await new Promise(r => setTimeout(r, 500));
  });
  const floor = await page.evaluate(() => window.__lvl.floor);
  const e = await caveLit();
  check('the next floor is dark again', floor > floorBefore && e.n <= base,
    { floorBefore, floor, caveLit: e.n, spawnBaseline: base });

  // ---- what the overlay itself costs, on the same sizes the game uses ----
  const cost = await page.evaluate(() => {
    const { FW, FH, FOG_U, SIGHT, seen } = window.__lvl.fog;
    const { WW } = window.__lvl.world;
    const cv = document.createElement('canvas'); cv.width = FW; cv.height = FH;
    const f = cv.getContext('2d');
    const img = new ImageData(FW, FH);
    const out = document.createElement('canvas'); out.width = 420 * 2; out.height = 880 * 2;
    const o = out.getContext('2d');
    const paint = () => { const d = img.data; for (let i = 0, k = 0; i < FW * FH; i++, k += 4) { d[k] = 9; d[k+1] = 10; d[k+2] = 14; d[k+3] = seen[i] ? 133 : 245; } };
    const overlay = (px, py) => {
      f.putImageData(img, 0, 0);
      f.globalCompositeOperation = 'destination-out';
      const lx = px / FOG_U, ly = py / FOG_U, lr = SIGHT / FOG_U;
      const g = f.createRadialGradient(lx, ly, lr * 0.5, lx, ly, lr);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g; f.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
      f.globalCompositeOperation = 'source-over';
      o.imageSmoothingEnabled = true;
      o.drawImage(cv, 0, 0, 30, 30, 0, 0, 840, 1760);
    };
    const N = 300;
    let t0 = performance.now(); for (let i = 0; i < N; i++) paint(); const tp = (performance.now() - t0) / N;
    t0 = performance.now(); for (let i = 0; i < N; i++) overlay(WW / 2, 1000 + i); const to = (performance.now() - t0) / N;
    return { paint: tp, overlay: to };
  });
  console.log(`  overlay cost: repaint the mask ${cost.paint.toFixed(3)}ms, draw the overlay ${cost.overlay.toFixed(3)}ms a frame`);
  check('the overlay costs well under a frame', cost.paint + cost.overlay < 4,
    { paintMs: +cost.paint.toFixed(3), overlayMs: +cost.overlay.toFixed(3) });

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
