// The deck buttons and the map (v75; the map rebuilt in v0.0.141, ui/map.js). The deck: gun buttons
// ride an arc round the right stick, the bag mirrors the last one on the left, the map sits above
// it; the pin button mirrors the map, on the map screen only. The map: full screen, the floor's picture (rock in its
// colours) under the fog memory, your helmet where you are; the map and pin buttons stay on top;
// one finger pans, two pinch; the run is paused. Pins: tap the pin button for the picker, pick one,
// + types a new one, hold drops the chosen pin where you are. Screenshots: map-*.png.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { try { localStorage.removeItem('caverunner-pins'); } catch (_) {} });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  const shot = n => page.screenshot({ path: path.join(__dirname, '..', 'build', 'map-' + n + '.png') });

  // ---- deck layout ----
  const box = sel => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }, sel);
  const deck = await page.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; };
    return { sticks: [...document.querySelectorAll('.sticks .stick')].map(box), guns: [...document.querySelectorAll('.slots .slot')].map(box),
      bag: box(document.querySelector('.weapon')), map: box(document.querySelector('.mapbtn')), pin: document.querySelector('.pinbtn'),
      W: window.innerWidth, icons: document.querySelectorAll('.slots .slot canvas').length };
  });
  const rc = deck.sticks[1];
  const dists = deck.guns.map(g => Math.hypot(g.x - rc.x, g.y - rc.y));
  check('four gun buttons', deck.guns.length === 4, deck.guns.length);
  check('they sit on an arc centred on the right stick', Math.max(...dists) - Math.min(...dists) < 2, dists.map(Math.round));
  check('the arc starts in the gap between the sticks', Math.abs(deck.guns[0].x - deck.W / 2) < 25, Math.round(deck.guns[0].x));
  check('and ends near the right edge, on screen', deck.guns[3].x > deck.W * 0.85 && deck.guns[3].x + deck.guns[3].w / 2 <= deck.W, Math.round(deck.guns[3].x));
  check('guns you hold show their icon (pistol, pick axe, Gravity Gun)', deck.icons === 3, deck.icons);
  check('the bag mirrors the last gun', Math.abs(deck.bag.x - (deck.W - deck.guns[3].x)) < 2 && Math.abs(deck.bag.y - deck.guns[3].y) < 2, deck.bag);
  check('the map button sits straight above the bag', Math.abs(deck.map.x - deck.bag.x) < 2 && deck.map.y < deck.bag.y - deck.bag.w, deck.map);
  check('no pin button while you play', deck.pin === null);

  await page.tap('.slots .slot >> nth=1');
  await page.waitForTimeout(150);
  check('tapping a gun button holds it', await page.evaluate(() => window.__in.current.loadout.sel) === 1);

  // ---- the map, explored partway: carried up a real path through the cave (a flood fill from the
  // shop to the highest open spot you fit through), a frame a step, so the fog lifts as it does in play.
  // Caves are random: one whose way up is short is rolled again (Dev → New cave), a few times at most ----
  const plan = () => page.evaluate(() => {
    const L = window.__lvl, D = 4, gw = Math.floor(CW / D), gh = Math.floor(CH / D);
    const fits = (gx, gy) => { for (let y = gy * D - 10; y <= gy * D + 1; y++) for (let x = gx * D - 3; x <= gx * D + 3; x++) if (x < 0 || y < 0 || x >= CW || y >= CH || L.mat[y * CW + x]) return false; return true; };
    const s0 = { x: Math.round((L.p.x + PW / 2) / CELL / D), y: Math.round((L.p.y + PH - 2) / CELL / D) };
    const prev = new Int32Array(gw * gh).fill(-2), q = [s0.y * gw + s0.x];
    prev[q[0]] = -1;
    let best = q[0];
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % gw, y = (i / gw) | 0;
      if (y < ((best / gw) | 0)) best = i;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * gw + nx;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh || prev[j] !== -2 || !fits(nx, ny)) continue;
        prev[j] = i; q.push(j);
      }
    }
    const path = [];
    for (let i = best; i >= 0; i = prev[i]) path.push(i);
    window.__walk = path.reverse();
    return path.length;
  });
  for (let i = 0; i < 6 && await plan() < 150; i++) {
    await page.evaluate(() => { window.__in.current.newCave = true; });
    await page.waitForTimeout(400);
  }
  const walked = await page.evaluate(async () => {
    const L = window.__lvl, D = 4, gw = Math.floor(CW / D), go = window.__walk;
    for (let k = 0; k < go.length; k += 2) {
      const i = go[k];
      L.p.x = (i % gw) * D * CELL - PW / 2; L.p.y = ((i / gw) | 0) * D * CELL - PH; L.p.vx = L.p.vy = 0;
      await new Promise(r => requestAnimationFrame(r));
    }
    let seen = 0; for (const v of L.fog.seen) if (v) seen++;
    return { steps: go.length, seen: seen / L.fog.seen.length };
  });
  await page.tap('.mapbtn');
  await page.waitForTimeout(400);
  await shot('0-explored');
  check('walked partway up the cave: some of it seen, not all', walked.steps > 50 && walked.seen > 0.04 && walked.seen < 0.8, walked);
  const part = await page.evaluate(() => {
    const c = document.querySelector('.mapcanvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let black = 0, n = 0; for (let i = 0; i < d.length; i += 64) { n++; if (d[i] < 12 && d[i + 1] < 12 && d[i + 2] < 14) black++; }
    return black / n;
  });
  check('the map shows what you saw, the rest black', part > 0.3 && part < 0.9, part);
  await page.tap('.mapbtn');
  await page.waitForTimeout(200);

  // ---- the map ----
  await page.evaluate(() => { window.__lvl.fog.seen.fill(2); window.__lvl.fog.paint(); });
  await page.tap('.mapbtn');
  await page.waitForTimeout(300);
  const open = await page.evaluate(() => ({ paused: window.__in.current.paused, map: window.__in.current.mapOpen, el: !!document.querySelector('.mapscreen') }));
  check('the map button opens the map and pauses the run', open.paused && open.map && open.el, open);
  const cover = await page.evaluate(() => {
    const r = document.querySelector('.mapscreen').getBoundingClientRect();
    const at = sel => { const b = document.querySelector(sel).getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e && e.closest(sel) ? true : (e ? e.className : null); };
    return { full: r.left === 0 && r.top === 0 && r.width === innerWidth && r.height === innerHeight,
      map: at('.mapbtn'), pin: at('.pinbtn'), gold: document.elementFromPoint(innerWidth / 2, 30).closest('.mapscreen') ? 'covered' : 'shows',
      gun: getComputedStyle(document.querySelector('.slots')).visibility, stick: getComputedStyle(document.querySelector('.stick')).visibility };
  });
  check('it fills the whole screen', cover.full, cover);
  const pinAt = await box('.pinbtn');
  check('the pin button shows on the map, mirroring the map button', Math.abs(pinAt.x - (deck.W - deck.map.x)) < 2 && Math.abs(pinAt.y - deck.map.y) < 2, pinAt);
  check('nothing else shows over it (gold, sticks, guns)', cover.gold === 'covered' && cover.gun === 'hidden' && cover.stick === 'hidden', cover);
  check('but the map and pin buttons stay where they were, on top', cover.map === true && cover.pin === true, cover);
  // the view: fitted to the screen's height
  const view = () => page.evaluate(() => (document.querySelector('.mapcanvas').dataset.view || '').split(' ').map(Number));
  const v0 = await view();
  const CHn = await page.evaluate(() => CH);
  check('the whole floor fits the screen’s height', Math.abs(v0[0] * CHn + 2 * v0[2] - 880) < 1 && v0[2] > 0 && v0[2] < 20, v0);
  // the colour on screen over a world point
  const px = (wx, wy) => page.evaluate(([wx, wy]) => {
    const c = document.querySelector('.mapcanvas'), [k, ox, oy] = c.dataset.view.split(' ').map(Number), dpr = devicePixelRatio;
    const d = c.getContext('2d').getImageData(Math.round((ox + wx / CELL * k) * dpr), Math.round((oy + wy / CELL * k) * dpr), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [wx, wy]);
  const stats = () => page.evaluate(() => {
    const c = document.querySelector('.mapcanvas'), d = c.getContext('2d').getImageData(0, 0, c.width, Math.round(c.height * 0.8)).data;
    let black = 0, n = 0; const cols = new Set();
    for (let i = 0; i < d.length; i += 64) { n++; if (d[i] < 12 && d[i + 1] < 12 && d[i + 2] < 14) black++; cols.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); }
    return { black: black / n, colours: cols.size };
  });
  // the shop's machines: a coloured square each on the shop floor
  const marks = await page.evaluate(() => {
    const c = document.querySelector('.mapcanvas'), [k, ox, oy] = c.dataset.view.split(' ').map(Number), dpr = devicePixelRatio;
    return MAP_MARKS.map(m => { const d = c.getContext('2d').getImageData(Math.round((ox + m.x / CELL * k) * dpr), Math.round((oy + (SHOP_FLOOR * CELL - m.w / 2) / CELL * k) * dpr), 1, 1).data;
      return { name: m.name, ok: '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('') === m.col.toLowerCase() }; });
  });
  check('the teleporter, heal and every machine are coloured squares on the shop floor', marks.length === 7 && marks.every(m => m.ok), marks);
  const lit = await stats();
  check('with the fog lifted, the cave shows in its colours', lit.colours > 40 && lit.black < 0.5, lit);
  const me = await page.evaluate(() => { const L = window.__lvl; return [L.p.x + PW / 2, L.p.y + PH / 2]; });
  // the white dome within a few px of where you are
  const helm = await page.evaluate(([wx, wy]) => {
    const c = document.querySelector('.mapcanvas'), [k, ox, oy] = c.dataset.view.split(' ').map(Number), dpr = devicePixelRatio;
    const x = Math.round((ox + wx / CELL * k) * dpr), y = Math.round((oy + wy / CELL * k) * dpr), R = Math.round(6 * dpr);
    const d = c.getContext('2d').getImageData(x - R, y - R, 2 * R, 2 * R).data;
    let white = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 220 && d[i + 1] > 220 && d[i + 2] > 220) white++;
    return white;
  }, me);
  check('your helmet is where you are', helm > 20, helm);
  await shot('1-open');
  await page.evaluate(() => { window.__lvl.fog.seen.fill(0); window.__lvl.fog.paint(); });
  await page.waitForTimeout(150);
  const dark = await stats();
  check('with nothing seen, the map is black', dark.black > 0.9, dark);
  await page.evaluate(() => { const L = window.__lvl; L.fog.seen.fill(0); for (let i = 0; i < L.fog.seen.length / 2; i++) L.fog.seen[i] = 2; L.fog.paint(); });
  await page.waitForTimeout(150);
  await shot('2-half');
  const y0 = await page.evaluate(() => window.__lvl.p.y);
  await page.waitForTimeout(300);
  check('the run is frozen under the map', await page.evaluate(() => window.__lvl.p.y) === y0);

  // one finger pans
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  await touch('touchStart', [[200, 300]]);
  for (let i = 1; i <= 8; i++) await touch('touchMove', [[200 + i * 5, 300 + i * 10]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(100);
  const v1 = await view();
  check('one finger drags the map', Math.abs(v1[1] - v0[1] - 40) < 2 && Math.abs(v1[2] - v0[2] - 80) < 2, { v0, v1 });
  // two fingers pinch apart: it zooms in round the point between them
  await touch('touchStart', [[180, 400], [240, 400]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[180 - i * 6, 400], [240 + i * 6, 400]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(100);
  const v2 = await view();
  const mid = (v, sx) => (sx - v[1]) / v[0];       // the terrain x under screen x
  check('two fingers spread zoom in', v2[0] > v1[0] * 2.5, { v1, v2 });
  check('round the point between them', Math.abs(mid(v1, 210) - mid(v2, 210)) < 2, { before: mid(v1, 210), after: mid(v2, 210) });
  await shot('3-zoomed');

  // ---- pins ----
  await page.tap('.pinbtn');
  await page.waitForTimeout(150);
  const opts = await page.evaluate(() => [...document.querySelectorAll('.pinopt')].map(b => b.textContent));
  check('the pin button opens the picker: the pins, then +', opts.length >= 7 && opts[opts.length - 1] === '+', opts);
  await shot('4-picker');
  await page.tap('.pinopt[data-pin="💀"]');
  await page.waitForTimeout(150);
  check('picking one makes it the pin button’s', await page.evaluate(() => document.querySelector('.pinbtn').textContent) === '💀' && !(await page.$('.pinpick')));
  // hold to drop it where you are
  const pb = await box('.pinbtn');
  await touch('touchStart', [[pb.x, pb.y]]);
  await page.waitForTimeout(650);
  await touch('touchEnd', []);
  await page.waitForTimeout(150);
  const pins = await page.evaluate(() => { const L = window.__lvl; return { pins: L.pins, me: [L.p.x + PW / 2, L.p.y + PH / 2] }; });
  check('holding it drops the pin where you are', pins.pins.length === 1 && pins.pins[0].e === '💀' && Math.hypot(pins.pins[0].x - pins.me[0], pins.pins[0].y - pins.me[1]) < 1, pins);
  check('and no picker from the hold', !(await page.$('.pinpick')));
  // + : a new one, one character (an emoji counts as one)
  await page.tap('.pinbtn'); await page.waitForTimeout(100);
  await page.tap('.pinadd'); await page.waitForTimeout(100);
  await page.fill('.pinnew input', '🦄abc');
  check('the box keeps one character', await page.inputValue('.pinnew input') === '🦄');
  await page.tap('.pinnew button'); await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ btn: document.querySelector('.pinbtn').textContent, saved: JSON.parse(localStorage.getItem('caverunner-pins')) }));
  check('a new pin goes first in the list and onto the button', after.btn === '🦄' && after.saved[0] === '🦄' && after.saved[1] === '💀', after);
  await page.tap('.mapbtn'); await page.waitForTimeout(150);
  await page.tap('.mapbtn'); await page.waitForTimeout(250);
  await shot('5-pin');
  const shut0 = await page.evaluate(() => window.__in.current.mapOpen);
  await page.tap('.mapbtn');
  await page.waitForTimeout(200);
  const shut = await page.evaluate(() => ({ paused: window.__in.current.paused, map: window.__in.current.mapOpen, el: !!document.querySelector('.mapscreen') }));
  check('the map button closes it again and the run carries on', shut0 && !shut.paused && !shut.map && !shut.el, shut);
  check('and the pin button goes with it', !(await page.$('.pinbtn')));

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
