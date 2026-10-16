// Screenshots for the owner (Coal Seams, grem branch): Grem Mode started at level 2 (Dev "Start at level"), phone size, a few
// moments along the level, and close-ups of its decorations.
//   node tools/coalshots.js [outdir] [prefix] [gas]      (default tests/build/autoshots, coal; 'gas': the gas pockets' shots only)
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'autoshots'));
const PRE = process.argv[3] || 'coal';
const ONLY = process.argv[4] || '';
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const said = [];
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 23; });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  page.on('console', m => { if (m.text().startsWith('at ')) console.log(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { DEV.gremStartLv = 2; DEV.autoFoeDmg = 0; DEV.autoLvlPace = 1.6; });
  await page.locator('.tstart').dispatchEvent('pointerdown');
  const save = async (n, what, clip) => { await page.screenshot({ path: path.join(OUT, PRE + '-' + n + '.png'), clip }); said.push(`${PRE}-${n}.png  ${what}`); };
  const zone = () => page.evaluate(() => { const S = window.__gremScene; return S ? titleZoneSpan(S.scroll + 110, S).z : '?'; });
  // (C1) a gas pocket on screen set off: the whoomph mid-flash, then just after, the fire round it (each also a close-up)
  for (let i = 0; ONLY !== 'stal' && i < 400; i++) {
    const g = await page.evaluate(() => {
      const S = window.__gremScene, cv = document.querySelector('canvas');
      const g = S && cv && (S.gas || []).find(q => !q.gone && q.wx - S.scroll > 70 && q.wx - S.scroll < 150);
      if (!g) return null;
      S.lvl.step = null; S.pace = 0;   // (the view held still)
      const b = cv.getBoundingClientRect(), k = b.width / TITLE_VW, cx = b.left + (g.wx - S.scroll) * k, cy = b.top + g.y * k;
      g.fuse = 0.01;
      return { x: Math.max(b.left, cx - 110), y: Math.max(b.top, cy - 150), width: 220, height: 220 };
    });
    if (g) {
      await page.waitForTimeout(90);
      await save('m-gas-flash', 'a gas pocket set off: the pale blue whoomph, mid-flash');
      await save('n-gas-flash-close', 'the same moment, close up', g);
      await page.waitForTimeout(450);
      await save('o-gas-after', 'just after: the flash gone, fire round where the pocket was');
      await save('p-gas-after-close', 'the same, close up', g);
      break;
    }
    await page.waitForTimeout(200);
  }
  // (C2) the Cavern's stalactites and stalagmites: the view held on the Cavern, then close-ups of a roof and a floor cluster
  if (ONLY === 'stal') {
    await page.evaluate(() => { DEV.autoLvlPace = 4; });
    for (let i = 0; i < 3000; i++) {
      const on = await page.evaluate(() => { const S = window.__gremScene; return !!S && titleZoneSpan(S.scroll + 40, S).z === 'spider' && titleZoneSpan(S.scroll + TITLE_VW - 40, S).z === 'spider' && coalAt(S, S.scroll + 100) && titleCeil(S.scroll + 100, S) > 30; });
      if (on) break;
      await page.waitForTimeout(100);
    }
    const box = await page.evaluate(() => {
      const S = window.__gremScene, cv = document.querySelector('canvas'), b = cv.getBoundingClientRect(), k = b.width / TITLE_VW;
      S.lvl.step = null; S.pace = 0; console.log('at', S.scroll, titleZoneSpan(S.scroll + 100, S).z);
      // the column with the most hanging (and rising) point cells near it
      let up = { n: 0, x: 0, y: 0 }, dn = { n: 0, x: 0, y: 0 };
      for (let x = 30; x < TITLE_VW - 30; x += 4) {
        let h = 0, rr = 0, hy = 0, ry = 0;
        for (let dx = -16; dx <= 16; dx += 2) {
          const wx = S.scroll + x + dx, Z = titleZoneSpan(wx, S), st = stalCol(wx, Z, titleCeil(wx, S), titleFloor(wx, S), S.rows);
          for (let r = 1; r < st.length; r++) if (st[r] > 1) { if (st[r - 1] >= 1 && r * TCELL < titleCeil(wx, S) + 40) { h++; hy = r * TCELL; } if (r * TCELL > titleFloor(wx, S) - 30) { rr++; ry = r * TCELL; } }
        }
        if (h > up.n) up = { n: h, x, y: hy }; if (rr > dn.n) dn = { n: rr, x, y: ry };
      }
      const clip = (/** @type {{ x: number, y: number }} */ q) => ({ x: Math.max(b.left, b.left + q.x * k - 90), y: Math.max(b.top, b.top + q.y * k - 90), width: 180, height: 180 });
      return { up: clip(up), dn: clip(dn) };
    });
    await page.waitForTimeout(300);
    await save('q-stal', 'the Cavern on Coal Seams: stalactites off the roof and the boulders, stalagmites on the floor');
    await page.evaluate(() => { DEV.gremDark = 0; });   // (the close-ups: the darkness lifted)
    await page.waitForTimeout(200);
    await save('r-stal-roof', 'close up (darkness lifted): a cluster hanging off the roof', box.up);
    await save('s-stal-floor', 'close up (darkness lifted): a cluster on the floor', box.dn);
    await browser.close(); console.log(said.join(String.fromCharCode(10))); return;
  }
  if (ONLY === 'gas') { await browser.close(); console.log(said.join('\n')); return; }
  // shots as the level goes by: one in each zone kind met (up to 5), and their close-ups
  const got = new Set();
  for (let i = 0; i < 160 && got.size < 5; i++) {
    await page.waitForTimeout(500);
    const z = await zone();
    if (i < 8 || got.has(z)) continue;
    got.add(z);
    await save(String.fromCharCode(97 + got.size - 1) + '-' + z, 'Coal Seams, the ' + ({ timber: 'Mines', winding: 'Digging zone', spider: 'Cavern' }[z] || z) + ' (zone ' + z + ')');
    if (got.size === 3) break;
  }
  // a coal chute on screen (ideas 1, 10: rails, coal heaps, chutes are in the Mines)
  for (let i = 0; i < 200; i++) {
    const on = await page.evaluate(() => { const S = window.__gremScene; return !!S && (S.chutes || []).some(q => q.x > S.scroll + 70 && q.x < S.scroll + 150); });
    if (on) { await save('h-chute', 'the Mines: a coal chute down a hole between tunnels, rails on the floors'); break; }
    await page.waitForTimeout(250);
  }
  // a minecart on screen (then lit: its blast)
  for (let i = 0; i < 240; i++) {
    const on = await page.evaluate(() => { const S = window.__gremScene; return !!S && S.props.some(p => p.k === 'barrel' && !p.gone && p.x > 40 && p.x < 200); });
    if (on) {
      await save('d-cart', 'an explosive minecart on the floor');
      await page.evaluate(() => { const S = window.__gremScene, p = S.props.find(q => q.k === 'barrel' && !q.gone && q.x > 40 && q.x < 200); if (p) p.fuse = 0.01; });
      await page.waitForTimeout(140);
      await save('e-cart-boom', 'the same cart set off: its blast, the rock bitten, fire');
      break;
    }
    await page.waitForTimeout(250);
  }
  // (step 2) the coal seams: one lit near the middle of the view, a few seconds on, then the tunnel it burnt
  const lit = await page.evaluate(() => {
    const S = window.__gremScene, TC = TCELL;
    S.lvl.step = null; S.pace = 0;   // (the view held still to watch it burn: the level's own steering off)
    for (let k = 0; k < 400; k++) {
      const sx = 70 + (k % 20) * 4, y = S.top + Math.floor(k / 20) * 6, c = Math.floor((sx + S.scroll) / TC), r = Math.floor(y / TC);
      if (titleCell(S, c, r) === TM.COAL) { titleIgnite(S, sx, y, 3, 1); return [sx, y]; }
    }
    return null;
  });
  if (lit) {
    await page.waitForTimeout(5000);
    await save('f-coal-fire', 'a coal seam lit (5 s on): it creeps along, glowing');
    await page.waitForTimeout(9000);
    await save('g-coal-tunnel', 'later: the burnt coal is ash, open air, a tunnel through the rock');
  }
  await browser.close();
  console.log(said.join('\n'));
})();
