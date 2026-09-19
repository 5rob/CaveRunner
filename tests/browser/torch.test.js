// The torch. Four things, all of them measured off the real canvas rather than asserted
// from the code: the light falls off to near dark by the top of the screen, it breathes
// with the flame, a wall puts the far side of it in shadow, and an enemy behind that wall
// is not drawn at all.
//
// Every brightness here is read straight out of the game canvas at a world point, which
// is why the light hook exposes the camera and the draw scale — the test has to know
// where a world point landed on the screen to go and look at it.
//
// Three things about the measuring are worth knowing before changing any of it:
//   * The line the light is read along runs upward and 60 units to the player's right.
//     Upward because the view is 360 world units across and only about 535 tall; to the
//     right because the HUD in the top left is drawn over the fog and reads as light.
//   * The floor is cleared of creatures and pickups, but the creatures are *moved*, not
//     removed: an empty enemy list draws "All enemies destroyed" across the middle of
//     the screen in white.
//   * Nothing is measured in the first three seconds, while the floor's name card is up.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const OUT = path.join(__dirname, '..', 'build');
const DS = [50, 100, 150, 200, 250];      // how far up the line the light is read
const OFF = 60;                           // world units right of the player that line sits

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1300);

  // The measuring kit, installed in the page once:
  //   __sample  average and peak brightness of a box of the game canvas around a world
  //             point, or null if that point is off the canvas — so a sample that fell
  //             off the screen can never pass as "very dark"
  //   __run     brightness at a list of distances up the line
  //   __wear    how many pixels in a box on the line are wearing a creature's own colours
  //   __wall    drop a slab of rock across the line, the way a dig would
  //   __anchor  the player's live centre, which every one of them measures from
  await page.evaluate(({ OFF }) => {
    window.__anchor = () => {
      const { p } = window.__lvl;
      return { x: p.x + 6, y: p.y + 11 };
    };
    window.__line = d => { const a = window.__anchor(); return { x: a.x + OFF, y: a.y - d }; };
    window.__sample = (wx, wy, half) => {
      const { cam, s } = window.__lvl.light;
      const cv = document.querySelector('canvas.game');
      const px = Math.round((wx - cam.x) * s), py = Math.round((wy - cam.y) * s);
      if (px < half || py < half || px + half > cv.width || py + half > cv.height) return null;
      const d = cv.getContext('2d').getImageData(px - half, py - half, half * 2, half * 2).data;
      let sum = 0, mx = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
        sum += l; n++; if (l > mx) mx = l;
      }
      return { mean: sum / n, max: mx };
    };
    window.__run = (ds, half) => ds.map(d => {
      const q = window.__line(d), s = window.__sample(q.x, q.y, half);
      return s ? s.mean : null;
    });
    window.__wear = (col, d, half) => {
      const { cam, s } = window.__lvl.light;
      const cv = document.querySelector('canvas.game');
      const q = window.__line(d);
      const px = Math.round((q.x - cam.x) * s), py = Math.round((q.y - cam.y) * s);
      const p = cv.getContext('2d').getImageData(px - half, py - half, half * 2, half * 2).data;
      const want = [col.a, col.b, col.c].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
      let n = 0;
      for (let i = 0; i < p.length; i += 4) {
        for (const w of want) {
          if (Math.abs(p[i] - w[0]) < 30 && Math.abs(p[i + 1] - w[1]) < 30 && Math.abs(p[i + 2] - w[2]) < 30) { n++; break; }
        }
      }
      return n;
    };
    // A wall is built to the side of the line, not across it: it stands 30 units to the
    // player's right, from `from` to `to` units up. Every ray from the player out to the
    // line has to cross that vertical span, so one slab shadows the whole line past it —
    // while the nearest sample, which crosses above the wall's top, stays lit.
    window.__wall = (from, to) => {
      const { mat, world } = window.__lvl;
      const { CW, CH, CELL } = world;
      const a = window.__anchor();
      const wx = Math.floor((a.x + 30) / CELL);
      let n = 0;
      for (let t = 0; t < 3; t++)                            // three cells thick
        for (let d = from; d <= to; d += CELL) {
          const cx = wx + t, cy = Math.floor((a.y - d) / CELL);
          if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) continue;
          if (!mat[cy * CW + cx]) { mat[cy * CW + cx] = 1; n++; }
        }
      return n;
    };
  }, { OFF });

  // ---- somewhere to stand: a clear spot with every point the light is read at in plain
  // sight of it. Away from the map's left and right edges, so the camera is not clamped
  // and the player sits in the middle ----
  const spot = await page.evaluate(({ OFF, DS }) => {
    const { mat } = window.__lvl;
    const { CW, CH, CELL } = window.__lvl.world;
    const solid = (x, y) => {
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      return cx < 0 || cy < 0 || cx >= CW || cy >= CH || mat[cy * CW + cx] !== 0;
    };
    const los = (ax, ay, bx, by) => {
      const dx = bx - ax, dy = by - ay, n = Math.ceil(Math.hypot(dx, dy) / 2);
      for (let i = 1; i <= n; i++) if (solid(ax + dx * i / n, ay + dy * i / n)) return false;
      return true;
    };
    let tried = 0;
    for (let cy = 400; cy < CH - 700; cy += 4) {
      for (let cx = 220; cx < CW - 220; cx += 4) {
        let ok = true;                                       // room to stand: 11 cells each way
        for (let dy = -5; dy <= 5 && ok; dy++)
          for (let dx = -5; dx <= 5; dx++) if (solid((cx + dx) * CELL, (cy + dy) * CELL)) { ok = false; break; }
        if (!ok) continue;
        tried++;
        const px = cx * CELL + CELL / 2, py = cy * CELL + CELL / 2;
        if (!DS.every(d => los(px, py, px + OFF, py - d))) continue;    // every sample in plain sight
        return { x: px, y: py };
      }
    }
    return { none: tried };
  }, { OFF, DS });
  check('found somewhere with a clear line to read the light along', !spot.none, spot);
  if (spot.none) { await browser.close(); process.exit(1); }

  // Stand there and stay there: nothing may move for any of this to mean anything. Every
  // sample hangs off the player's live position, so the pin only has to be close.
  await page.evaluate(async ({ x, y }) => {
    const { p } = window.__lvl;
    p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.hp = 9999;
    window.__pin = { x, y };
    const loop = () => {
      p.x = window.__pin.x; p.y = window.__pin.y; p.vx = 0; p.vy = 0; p.hp = 9999;
      if (!window.__stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    await new Promise(r => setTimeout(r, 500));
  }, { x: spot.x - 6, y: spot.y - 11 });

  // And clear the floor of everything drawn over the terrain, which would read as light
  // in a sample box. The creatures are moved off to a corner rather than spliced out of
  // the list, because an empty list puts "All enemies destroyed" across the middle of the
  // screen — in white, over the fog.
  const cleared = await page.evaluate(() => {
    const L = window.__lvl;
    window.__foe = null;
    const loop = () => {
      for (const e of L.enemies) {
        if (e === window.__foe) continue;
        e.x = 20; e.y = 20; e.hp = e.hpMax;
      }
      const f = window.__foe;
      if (f) { const q = window.__line(90); f.x = q.x; f.y = q.y; f.hp = f.hpMax; }
      L.enemyShots.length = 0;
      if (!window.__stopAway) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const gone = { pickups: L.pickups.splice(0), coins: L.coins.splice(0),
      bullets: L.bullets.splice(0), flashes: L.flashes.splice(0),
      fields: L.fields.splice(0), beams: L.beams.splice(0) };
    return Object.values(gone).reduce((a, v) => a + v.length, 0);
  });
  // outlast the floor's name card, which is drawn in white across the middle of the screen
  await page.waitForTimeout(2500);
  const view = await page.evaluate(() => {
    const { light } = window.__lvl;
    const a = window.__anchor(), q = window.__line(0);
    return { above: a.y - light.cam.y, right: q.x - light.cam.x, r: light.r };
  });
  console.log(`  ${cleared} things taken off the floor; the line runs ${view.right.toFixed(0)} units right of ` +
    `the camera and ${view.above.toFixed(0)} up, and the light reaches ${view.r.toFixed(0)}`);

  const run = (ds) => page.evaluate(ds => window.__run(ds, 9), ds);
  const show = (a) => a.map((v, i) => `${DS[i]}u ${v === null ? 'off' : v.toFixed(1)}`).join(', ');
  // The mask is painted rgb(9,10,14) (see paintFog), so nothing it covers can read below
  // about 11 however dark the fog is. That is the floor under every number here, and the
  // ratios below are taken above it — otherwise "much darker" is capped at about half.
  const MASK = 11;
  const above = v => Math.max(0, v - MASK);

  // ---- 1. the falloff ----
  // Read twice: lit, and then with a wall through every ray that reaches the line, so the
  // difference between the two is the light alone. One pass on its own would be a
  // measurement of the rock as much as of the torch — the terrain is a different colour
  // at every sample.
  const profile = await run(DS);
  console.log('  lit along the line: ' + show(profile));
  check('every sample landed on the canvas', profile.every(v => v !== null), profile);

  // ---- 2. the light breathes with the flame ----
  // Nothing moves for this: the player is pinned, the floor is empty and the camera has
  // settled, so the only thing left that can change what a pixel looks like is the torch.
  const frames = await page.evaluate(() => new Promise(done => {
    const out = [];
    const tick = () => { out.push({ flick: window.__lvl.light.flick, r: window.__lvl.light.r });
      if (out.length < 45) requestAnimationFrame(tick); else done(out); };
    requestAnimationFrame(tick);
  }));
  const flickMin = Math.min(...frames.map(f => f.flick)), flickMax = Math.max(...frames.map(f => f.flick));
  const rMin = Math.min(...frames.map(f => f.r)), rMax = Math.max(...frames.map(f => f.r));
  console.log(`  over ${frames.length} frames the flame ran ${flickMin.toFixed(3)}..${flickMax.toFixed(3)}, ` +
    `so the light reached ${rMin.toFixed(0)}..${rMax.toFixed(0)} units`);
  check('the flame flickers', flickMax - flickMin > 0.04, { flickMin, flickMax });
  check('and the light it casts moves with it', rMax - rMin > 8, { rMin, rMax });

  // the same flicker, in the pixels, which is the whole point of it
  const pairs = await page.evaluate(() => new Promise(done => {
    const out = [];
    const tick = () => {
      out.push({ flick: window.__lvl.light.flick, px: window.__run([130], 7)[0] });
      if (out.length < 45) requestAnimationFrame(tick); else done(out);
    };
    requestAnimationFrame(tick);
  }));
  const bright = pairs.map(p => p.px);
  const bMin = Math.min(...bright), bMax = Math.max(...bright);
  console.log(`  the same point on screen ran ${bMin.toFixed(2)}..${bMax.toFixed(2)} while nothing else moved`);
  check('the flicker reaches the pixels', bMax - bMin > 0.4, { bMin: +bMin.toFixed(2), bMax: +bMax.toFixed(2) });
  const n = pairs.length;
  const mf = pairs.reduce((a, p) => a + p.flick, 0) / n, mb = bright.reduce((a, b) => a + b, 0) / n;
  let cov = 0, vf = 0, vb = 0;
  for (const p of pairs) { const a = p.flick - mf, b = p.px - mb; cov += a * b; vf += a * a; vb += b * b; }
  const corr = cov / Math.sqrt(vf * vb || 1);
  console.log(`  correlation between flame height and screen brightness: ${corr.toFixed(2)}`);
  check('and the brighter frames are the ones with the taller flame', corr > 0.3, +corr.toFixed(2));

  // ---- 3. a creature out in the open, wearing its own colours ----
  const foe = await page.evaluate(() => {
    const e = window.__lvl.enemies[0];
    window.__foe = e;
    return { col: e.k.col, r: e.r, body: e.k.body };
  });
  await page.waitForTimeout(300);
  check('there is a creature to hide', !!foe, { body: foe.body, r: foe.r });

  // How many pixels in the box around it are wearing its own colours. It is the only
  // thing on screen that does, and anything behind the mask has had its brightness taken
  // out, so a colour match is the sprite and nothing else.
  const wear = () => page.evaluate(col => window.__wear(col, 90, 33), foe.col);
  const shown = await wear();
  console.log(`  the creature's own colours in the box around it: ${shown} pixels with nothing in the way`);

  // ---- 4. a wall beside the line, and what is behind it ----
  const cells = await page.evaluate(() => window.__wall(5, 260));
  await page.waitForTimeout(250);
  const dark = await run(DS);
  console.log('  unlit, same points : ' + show(dark));
  const light = profile.map((v, i) => v - dark[i]);          // the torch's own contribution
  const L = (a) => a.map((v, i) => `${DS[i]}u ${v.toFixed(1)}`).join(', ');
  console.log('  light alone        : ' + L(light));
  check('the wall landed on the terrain', cells > 20, cells);
  check('and it took most of the light away near your feet',
    light[0] > above(profile[0]) * 0.5, `${light[0].toFixed(1)} of ${above(profile[0]).toFixed(1)}`);
  check('and it falls off all the way to nothing by the top of the screen',
    light[4] < light[0] * 0.35,
    `${light[0].toFixed(1)} at 50 units -> ${light[4].toFixed(1)} at 250, ` +
    `${(light[4] / light[0] * 100).toFixed(0)}% of the light is left`);
  // loosely, because the two readings at a point are two readings of the mask's own edge
  // as much as of the light: within a couple of units the shape has to be one-way
  check('and the light only falls away going up the line',
    light.every((v, i) => i === 0 || v <= light[i - 1] + 3), L(light));
  const hidden = await wear();
  console.log(`  and the creature behind it: ${shown} -> ${hidden} pixels of its own colours`);
  check('an enemy behind a wall is not drawn at all', hidden < shown * 0.2, `${shown} -> ${hidden}`);
  await page.screenshot({ path: path.join(OUT, 'torch_shadow.png') });

  await page.evaluate(() => { window.__stopAway = true; window.__stop = true; });
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();