// The torch. Three things, all of them measured off the real canvas rather than asserted
// from the code: the light falls away with distance into the fog beyond its bubble, it
// breathes with the flame, and it does not stop at walls (the reveal respects them, the
// lamp lighting what has already been revealed does not).
//
// Every brightness here is read straight out of the game canvas at a world point, which is
// why the light hook exposes the camera and the draw scale — the test has to know where a
// world point landed on the screen to go and look at it.
//
// Three things about the measuring are worth knowing before changing any of it:
//   * The line the light is read along runs upward and 60 units to the player's right.
//     Upward because the view is only about 535 world units tall, and to the right because
//     the HUD in the top left is drawn over the fog and reads as light.
//   * The falloff is read by moving the player in 50-unit steps along that line and
//     sampling the *same world point* each time. Reading five points at once would be a
//     measurement of the rock as much as of the light, since the terrain is a different
//     colour at every one.
//   * The floor is cleared of creatures and pickups, but the creatures are *moved*, not
//     removed: an empty enemy list draws "All enemies destroyed" across the middle of the
//     screen in white. Nothing is measured in the first three seconds either, while the
//     floor's name card is up.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const OUT = path.join(__dirname, '..', 'build');
const OFF = 60;                           // world units right of the player the line sits
const STEPS = [270, 220, 170, 120, 70];   // the distance the far point is read from

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1300);

  // The measuring kit, installed in the page once:
  //   __sample  average brightness of a box of the game canvas around a world point, or
  //             null if that point is off the canvas — so a sample that fell off the
  //             screen can never pass as "very dark"
  //   __anchor  the player's live centre
  //   __line    a point on the line the light is read along
  // the distances below are laid out for a zoom of 1; the default zoom (v59: 1.35) would
  // push the far points off the top of the screen
  await page.evaluate(() => { DEV.zoom = 1; });
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
      let sum = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
      return { mean: sum / n };
    };
    // the same, averaged over a dozen frames: a single frame is bright or dim by whatever
    // the flame happened to be doing, which is a couple of units either way at mid-range
    window.__steady = (wx, wy, half) => new Promise(done => {
      const out = [];
      let frames = 0;                   // gives up after 60 frames: an off-screen point is a
      const tick = () => {              // null (a failed check), never a hang
        const s = window.__sample(wx, wy, half);
        if (s) out.push(s.mean);
        if (out.length < 14 && ++frames < 60) requestAnimationFrame(tick);
        else done(out.length >= 14 ? out.reduce((a, b) => a + b, 0) / out.length : null);
      };
      requestAnimationFrame(tick);
    });
  }, { OFF });

  // ---- somewhere to stand: a spot with room around it, away from the map's left and right
  // edges so the camera is not clamped and the player sits in the middle ----
  const spot = await page.evaluate(() => {
    const { mat } = window.__lvl;
    const { CW, CH, CELL } = window.__lvl.world;
    const solid = (cx, cy) => cx < 0 || cy < 0 || cx >= CW || cy >= CH || mat[cy * CW + cx] !== 0;
    for (let cy = 400; cy < CH - 800; cy += 5) {
      for (let cx = 220; cx < CW - 220; cx += 5) {
        let ok = true;                                       // room to stand: 11 cells each way
        for (let dy = -5; dy <= 5 && ok; dy++)
          for (let dx = -5; dx <= 5; dx++) if (solid(cx + dx, cy + dy)) { ok = false; break; }
        if (ok) return { x: cx * CELL + CELL / 2 - 6, y: cy * CELL + CELL / 2 - 11 };
      }
    }
    return null;
  });
  check('found somewhere to stand in the cave', !!spot, spot);
  if (!spot) { await browser.close(); process.exit(1); }

  // Stand there and stay there: nothing may move for any of this to mean anything.
  await page.evaluate(async ({ x, y }) => {
    const { p } = window.__lvl;
    p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.hp = 9999;
    window.__home = y;
    window.__pin = { x, y };
    const loop = () => {
      p.x = window.__pin.x; p.y = window.__pin.y; p.vx = 0; p.vy = 0; p.hp = 9999;
      if (!window.__stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    await new Promise(r => setTimeout(r, 500));
  }, spot);

  // Clear the floor of everything drawn over the terrain, which would read as light. The
  // creatures go to a corner rather than out of the list — see the note at the top.
  const cleared = await page.evaluate(() => {
    const L = window.__lvl;
    window.__foe = null;
    const loop = () => {
      for (const e of L.enemies) {
        if (e === window.__foe) continue;
        e.x = 20; e.y = 20; e.hp = e.hpMax;
      }
      const f = window.__foe;
      // ty as well as y: the sprite is drawn at ty and only step() keeps it in step with
      // y, so a creature pinned with the game paused would be drawn wherever it was last
      // seen rather than where it has been put
      if (f) { const q = window.__line(150); f.x = q.x; f.y = q.y; f.ty = q.y; f.hp = f.hpMax; }
      L.enemyShots.length = 0;
      if (!window.__stopAway) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const gone = { pickups: L.pickups.splice(0), coins: L.coins.splice(0),
      bullets: L.bullets.splice(0), flashes: L.flashes.splice(0),
      fields: L.fields.splice(0), beams: L.beams.splice(0) };
    return Object.values(gone).reduce((a, v) => a + v.length, 0);
  });
  await page.waitForTimeout(2500);          // outlast the floor's name card

  // and mark the whole map as somewhere you have been, so the fog under every sample is the
  // same shade and the only thing left varying along the line is the light
  const view = await page.evaluate(() => {
    const { light, fog } = window.__lvl;
    fog.seen.fill(1); fog.paint();
    const a = window.__anchor(), q = window.__line(0);
    return { above: a.y - light.cam.y, right: q.x - light.cam.x, r: light.r };
  });
  console.log(`  ${cleared} things taken off the floor; the line runs ${view.right.toFixed(0)} units right of ` +
    `the camera and ${view.above.toFixed(0)} up, and the light reaches ${view.r.toFixed(0)}`);

  // Everything that reads a brightness does it with the game paused. `flick` is set in
  // step(), so pausing freezes the flame at one value and the canvas then holds still:
  // without that, the flicker alone moves a mid-range sample by three or four units
  // between two readings, which is the same size as the thing being measured. The pin
  // loop is a requestAnimationFrame of its own, so the player still moves while paused.
  const pause = (on) => page.evaluate(on => { window.__in.current.paused = on; }, on);
  const look = (pt) => page.evaluate(p => window.__steady(p.x, p.y, 9), pt);
  const move = (dy) => page.evaluate(async dy => {
    window.__pin.y = window.__home + dy;
    await new Promise(r => setTimeout(r, 320));
  }, dy);

  await pause(true);

  // ---- 1. the falloff ----
  // One world point, read with the player at five distances from it. The rock under it
  // never changes, so the difference between the readings is the light and nothing else.
  const q = await page.evaluate(d => window.__line(d), STEPS[0]);
  const profile = [];
  for (const d of STEPS) {
    await move(d - STEPS[0]);                       // step the player up until q is d away
    profile.push(await look(q));
  }
  console.log('  one point, read from further and further away: ' +
    STEPS.map((d, i) => `${d}u ${profile[i] === null ? 'off' : profile[i].toFixed(1)}`).join(', '));
  check('every sample landed on the canvas', profile.every(v => v !== null), profile);
  if (profile.every(v => v !== null)) {
    check('and it only falls away with distance',
      profile.every((v, i) => i === 0 || v >= profile[i - 1] - 1), profile.map(v => +v.toFixed(1)));
    const near = profile[4], far = profile[0];
    check('it is brightest closest in', near > profile[2], profile.map(v => +v.toFixed(1)));
    // the lamp is a bubble now: it fades out into the fog rather than lighting the whole
    // screen, so a point out past its edge reads clearly darker than one at your feet
    check('and it falls off into the dark rather than lighting the whole screen',
      far < near * 0.75, `${near.toFixed(1)} at 70 units -> ${far.toFixed(1)} at 270, ` +
      `${(far / near * 100).toFixed(0)}%`);
  }

  await pause(false);

  // ---- 2. the light breathes with the flame ----
  // Nothing moves for this: the player is pinned, the floor is empty and the camera has
  // settled, so the only thing left that can change what a pixel looks like is the torch.
  await move(0);
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
  const lit = await page.evaluate(() => window.__line(150));
  const pairs = await page.evaluate(pt => new Promise(done => {
    const out = [];
    const tick = () => {
      out.push({ flick: window.__lvl.light.flick, px: window.__sample(pt.x, pt.y, 7).mean });
      if (out.length < 45) requestAnimationFrame(tick); else done(out);
    };
    requestAnimationFrame(tick);
  }), lit);
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

  // ---- 3. a wall does not stop it ----
  // Line of sight is for the map and nothing else. A slab of rock 30 units to the player's
  // right, standing between them and every point on the line, should change nothing at all
  // about how bright the line is. Paused for the whole of it, so both readings are at the
  // same height of flame: switching the game off and on between them would put the second
  // reading a flicker's worth brighter and look exactly like a wall that lit something up.
  await pause(true);
  const target = await page.evaluate(() => window.__line(150));
  const before = await look(target);
  const cells = await page.evaluate(() => {
    const { mat, world } = window.__lvl;
    const { CW, CH, CELL } = world;
    const a = window.__anchor();
    const wx = Math.floor((a.x + 30) / CELL);
    let n = 0;
    for (let t = 0; t < 3; t++)
      for (let d = 5; d <= 300; d += CELL) {
        const cx = wx + t, cy = Math.floor((a.y - d) / CELL);
        if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) continue;
        if (!mat[cy * CW + cx]) { mat[cy * CW + cx] = 1; n++; }
      }
    return n;
  });
  await page.waitForTimeout(300);
  const after = await look(target);
  console.log(`  a wall between you and that point (${cells} cells of it): ` +
    `${before.toFixed(1)} -> ${after.toFixed(1)}`);
  check('the wall landed on the terrain', cells > 20, cells);
  check('and it did not put the point in shadow', Math.abs(after - before) < 0.8,
    `${before.toFixed(1)} -> ${after.toFixed(1)}`);
  await page.screenshot({ path: path.join(OUT, 'torch_wall.png') });

  // and the same for a creature: the light is what decides what you see now, not a line of
  // sight, so one standing behind that wall is drawn like any other
  const foe = await page.evaluate(async () => {
    const e = window.__lvl.enemies[0];
    window.__foe = e;
    await new Promise(r => setTimeout(r, 300));
    return { col: e.k.col, body: e.k.body };
  });
  const shown = await page.evaluate(col => {
    const { cam, s } = window.__lvl.light;
    const cv = document.querySelector('canvas.game');
    const q = window.__line(150);
    const px = Math.round((q.x - cam.x) * s), py = Math.round((q.y - cam.y) * s), half = 33;
    const p = cv.getContext('2d').getImageData(px - half, py - half, half * 2, half * 2).data;
    const want = [col.a, col.b, col.c].map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    let k = 0;
    for (let i = 0; i < p.length; i += 4) {
      for (const w of want) {
        if (Math.abs(p[i] - w[0]) < 30 && Math.abs(p[i + 1] - w[1]) < 30 && Math.abs(p[i + 2] - w[2]) < 30) { k++; break; }
      }
    }
    return k;
  }, foe.col);
  console.log(`  the ${foe.body} behind the wall, in its own colours: ${shown} pixels on screen`);
  check('a creature behind a wall is drawn, because the light reaches it', shown > 40, shown);

  await pause(false);
  await page.evaluate(() => { window.__stopAway = true; window.__stop = true; });
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();