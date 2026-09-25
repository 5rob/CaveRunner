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
  const pix = () => page.evaluate(() => {
    const c = document.querySelector('.view canvas');
    const ctlH = window.__in.current.ctlH, dpr = window.devicePixelRatio || 1;
    const hh = Math.floor(c.height - ctlH * dpr);
    const d = c.getContext('2d').getImageData(0, 0, c.width, hh).data;
    let white = 0, black = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) {
      n++;
      if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) white++;
      if (d[i] < 3 && d[i + 1] < 3 && d[i + 2] < 3) black++;
    }
    return { white, black: black / n };
  });

  await page.evaluate(() => { window.__lvl.fog.seen.fill(2); window.__lvl.fog.paint(); });
  await page.tap('.mapbtn');
  await page.waitForTimeout(300);
  const open = await page.evaluate(() => ({ paused: window.__in.current.paused, map: window.__in.current.mapOpen }));
  check('the map button opens the map and pauses the run', open.paused && open.map, open);
  const lit = await pix();
  check('with the fog lifted, the map draws white cave outlines', lit.white > 200, lit);
  check('on a solid black background', lit.black > 0.6, lit);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'map.png') });

  const y0 = await page.evaluate(() => window.__lvl.p.y);
  await page.waitForTimeout(400);
  check('the run is frozen under the map', await page.evaluate(() => window.__lvl.p.y) === y0);

  await page.evaluate(() => { window.__lvl.fog.seen.fill(0); window.__lvl.fog.paint(); });
  await page.waitForTimeout(200);
  const dark = await pix();
  check('with nothing revealed, the map shows nothing', dark.white < lit.white / 10, { dark, lit });

  await page.tap('.mapbtn');
  await page.waitForTimeout(200);
  const shut = await page.evaluate(() => ({ paused: window.__in.current.paused, map: window.__in.current.mapOpen }));
  check('tapping it again closes it and the run carries on', !shut.paused && !shut.map, shut);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
