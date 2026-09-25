// The map button, the deck buttons and the see-through controls (v75).
// The map: tapping the map button pauses the run and covers the play area above the
// controls in solid black, with the revealed cave as white outlines (only what the fog has
// lifted). Tapping it again closes it and the run carries on. The deck: gun buttons ride an
// arc round the right stick, the bag mirrors the last one on the left, the map sits above it.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);

  // ---- deck layout ----
  const deck = await page.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; };
    const sticks = [...document.querySelectorAll('.sticks .stick')].map(box);
    const guns = [...document.querySelectorAll('.slots .slot')].map(box);
    return { sticks, guns, bag: box(document.querySelector('.weapon')), map: box(document.querySelector('.mapbtn')),
      W: window.innerWidth, icons: document.querySelectorAll('.slots .slot canvas').length };
  });
  const rc = deck.sticks[1];
  const dists = deck.guns.map(g => Math.hypot(g.x - rc.x, g.y - rc.y));
  check('four gun buttons', deck.guns.length === 4, deck.guns.length);
  check('they sit on an arc centred on the right stick',
    Math.max(...dists) - Math.min(...dists) < 2, dists.map(Math.round));
  check('the arc starts in the gap between the sticks',
    Math.abs(deck.guns[0].x - deck.W / 2) < 3, Math.round(deck.guns[0].x));
  check('and ends near the right edge, on screen',
    deck.guns[3].x > deck.W * 0.85 && deck.guns[3].x + deck.guns[3].w / 2 <= deck.W, Math.round(deck.guns[3].x));
  check('guns you hold show their icon', deck.icons === 2, deck.icons);
  check('the bag mirrors the last gun',
    Math.abs(deck.bag.x - (deck.W - deck.guns[3].x)) < 2 && Math.abs(deck.bag.y - deck.guns[3].y) < 2, deck.bag);
  check('the map button sits straight above the bag',
    Math.abs(deck.map.x - deck.bag.x) < 2 && deck.map.y < deck.bag.y - deck.bag.w, deck.map);

  // tapping a gun button selects it
  await page.tap('.slots .slot >> nth=1');
  await page.waitForTimeout(150);
  check('tapping a gun button holds it', await page.evaluate(() => window.__in.current.loadout.sel) === 1);

  // ---- the map ----
  // loot and a found prize room to mark on it (v80): a mod, a new gun and a thrown-back gun
  // in open air near you, and the perk room crossed out as taken
  const marks = await page.evaluate(() => {
    const L = window.__lvl, p = L.p;
    const g0 = window.__in.current.loadout.guns[0];
    L.pickups.push({ kind: 'mod', id: 'bolt', x: p.x - 60, y: p.y - 40, t: 0 },
      { kind: 'gun', gun: g0, x: p.x + 60, y: p.y - 40, t: 0 },
      { kind: 'gun', gun: g0, x: p.x + 60, y: p.y - 160, t: 0, old: true });
    const r0 = L.rooms[0], r1 = L.rooms[1];
    r0.taken = true;
    return { mod: [p.x - 60, p.y - 40], gun: [p.x + 60, p.y - 40], old: [p.x + 60, p.y - 160],
      taken: [r0.x, r0.y], open: r1 ? [r1.x, r1.y] : null, edge: [r0.x, r0.y - ROOM_HH] };
  });
  // the colour of the map pixel over a world point
  const at = ([wx, wy]) => page.evaluate(([wx, wy]) => {
    const c = document.querySelector('.view canvas');
    const dpr = window.devicePixelRatio || 1, ctlH = window.__in.current.ctlH;
    const pw = c.width / dpr, ph = (c.height - ctlH * dpr) / dpr, pad = 10;
    const MMW = Math.ceil(CW / MINI_D), MMH = Math.ceil(CH / MINI_D);
    const k = Math.min((pw - 2 * pad) / MMW, (ph - 2 * pad) / MMH);
    const mw = MMW * k, mh = MMH * k, mx0 = (pw - mw) / 2, my0 = (ph - mh) / 2;
    const x = mx0 + wx / (CW * CELL) * mw, y = my0 + wy / (CH * CELL) * mh;
    const d = c.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [wx, wy]);
  const yellow = c => c[0] > 200 && c[1] > 170 && c[2] < 120;
  const green = c => c[1] > 170 && c[0] < 140 && c[2] < 170;
  const pix = () => page.evaluate(() => {
    const c = document.querySelector('.view canvas');
    const ctlH = window.__in.current.ctlH, dpr = window.devicePixelRatio || 1;
    const hh = Math.floor(c.height - ctlH * dpr);
    const d = c.getContext('2d').getImageData(0, 0, c.width, hh).data;
    let white = 0, black = 0, dim = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) {
      n++;
      if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) white++;
      if (d[i] < 3 && d[i + 1] < 3 && d[i + 2] < 3) black++;
      if (d[i] < 70 && d[i + 1] < 70 && d[i + 2] < 70) dim++;
    }
    return { white, black: black / n, dim: dim / n };
  });

  await page.evaluate(() => { window.__lvl.fog.seen.fill(2); window.__lvl.fog.paint(); });
  await page.tap('.mapbtn');
  await page.waitForTimeout(300);
  const open = await page.evaluate(() => ({ paused: window.__in.current.paused, map: window.__in.current.mapOpen }));
  check('the map button opens the map and pauses the run', open.paused && open.map, open);
  const lit = await pix();
  check('with the fog lifted, the map draws white cave outlines', lit.white > 200, lit);
  check('on a dark background', lit.dim > 0.6, lit);
  check('that the cave shows through (80% black, not solid)', lit.black < 0.5, lit);
  const got = { mod: await at(marks.mod), gun: await at(marks.gun), old: await at(marks.old),
    edge: await at(marks.edge), taken: await at(marks.taken), open: marks.open ? await at(marks.open) : null };
  check('a mod you have seen is a green dot', green(got.mod), got.mod);
  check('a gun you have seen is a yellow dot', yellow(got.gun), got.gun);
  check('a gun you threw back is a hollow ring', !yellow(got.old), got.old);
  check('a found prize room is outlined in yellow', yellow(got.edge), got.edge);
  check('and crossed out once its prize is taken', yellow(got.taken), got.taken);
  check('an untaken one has no cross', !got.open || !yellow(got.open), got.open);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'map.png') });

  const y0 = await page.evaluate(() => window.__lvl.p.y);
  await page.waitForTimeout(400);
  check('the run is frozen under the map', await page.evaluate(() => window.__lvl.p.y) === y0);

  await page.evaluate(() => { window.__lvl.fog.seen.fill(0); window.__lvl.fog.paint(); });
  await page.waitForTimeout(200);
  const dark = await pix();
  check('with nothing revealed, the map shows nothing', dark.white < lit.white / 10, { dark, lit });
  // (anything near you is back in sight at once, so hide a gun far off)
  const far = await page.evaluate(() => { const L = window.__lvl, p = L.p, y = p.y > 1200 ? p.y - 900 : p.y + 900;
    L.pickups.push({ kind: 'gun', gun: window.__in.current.loadout.guns[0], x: p.x, y, t: 0 }); return [p.x, y]; });
  await page.waitForTimeout(150);
  const hid = { gun: await at(far), edge: await at(marks.edge) };
  check('and no loot or rooms you have not seen', !yellow(hid.gun) && !yellow(hid.edge), hid);

  await page.tap('.mapbtn');
  await page.waitForTimeout(200);
  const shut = await page.evaluate(() => ({ paused: window.__in.current.paused, map: window.__in.current.mapOpen }));
  check('tapping it again closes it and the run carries on', !shut.paused && !shut.map, shut);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
