// Screenshots for the owner (Coal Seams, grem branch): Grem Mode started at level 2 (Dev "Start at level"), phone size, a few
// moments along the level, and close-ups of its decorations.
//   node tools/coalshots.js [outdir] [prefix] [gas|stal|ladder|bats]   (default tests/build/autoshots, coal; one of those: its shots only)
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
  for (let i = 0; ONLY !== 'stal' && ONLY !== 'ladder' && ONLY !== 'bats' && i < 400; i++) {
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
    // the tallest stretch of Cavern on the level: the view held there
    const tx = await page.evaluate(() => { const S = window.__gremScene, L = levelState(S); let b = [0, 0]; for (let x = S.scroll; x < L.plan.arena.x0 - 200; x += 10) if (titleZoneSpan(x, S).z === 'spider' && titleZoneSpan(x - 90, S).z === 'spider' && titleZoneSpan(x + 90, S).z === 'spider' && coalAt(S, x)) { const h = titleFloor(x, S) - titleCeil(x, S); if (h > b[1]) b = [x, h]; } return b[0]; });
    for (let i = 0; tx && i < 3000; i++) {
      if (await page.evaluate(x => window.__gremScene.scroll + TITLE_VW / 2 >= x, tx)) break;
      await page.waitForTimeout(100);
    }
    for (let i = 0; !tx && i < 3000; i++) {
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
    await save('t-stal-lit', 'the same screen, darkness lifted (for the shot only)');
    await save('r-stal-roof', 'close up (darkness lifted): a cluster hanging off the roof', box.up);
    await save('s-stal-floor', 'close up (darkness lifted): a cluster on the floor', box.dn);
    await browser.close(); console.log(said.join(String.fromCharCode(10))); return;
  }
  // (C3) the Cavern's ladders and timber: the view held where the most of them are on screen, then close-ups of a ladder and of
  // timber under a boulder
  if (ONLY === 'ladder') {
    await page.evaluate(() => { DEV.autoLvlPace = 4; });
    let best = { n: 0, at: 0 };
    for (let i = 0; i < 1500; i++) {
      const q = await page.evaluate(() => {
        const S = window.__gremScene; if (!S || !S.tim) return { n: 0, done: false };
        const L = levelState(S), on = (/** @type {any} */ T) => T.c0 * TCELL > S.scroll + 10 && T.c1 * TCELL < S.scroll + TITLE_VW - 10;
        const lad = (S.tim[-2] ? S.tim[-2].sets : []).filter(on).length, tim = (S.tim[-1] ? S.tim[-1].sets : []).filter(on).length;
        return { n: lad * 2 + tim, lad, at: S.scroll, done: S.scroll > L.plan.arena.x0 - 300 };
      });
      if (q.lad > 0 && q.n >= 5) { best = q; break; }
      if (q.done) break;
      await page.waitForTimeout(60);
    }
    const box = await page.evaluate(() => {
      const S = window.__gremScene, cv = document.querySelector('canvas'), b = cv.getBoundingClientRect(), k = b.width / TITLE_VW;
      S.lvl.step = null; S.pace = 0; console.log('at', S.scroll, titleZoneSpan(S.scroll + 100, S).z);
      const on = (/** @type {any} */ T) => T.c0 * TCELL > S.scroll + 10 && T.c1 * TCELL < S.scroll + TITLE_VW - 10;
      const mid = (/** @type {any} */ T) => { let y0 = 1e9, y1 = 0; for (const col of T.cols.values()) for (const r of col.keys()) { y0 = Math.min(y0, r); y1 = Math.max(y1, r); } return { x: (T.c0 + T.c1) / 2 * TCELL - S.scroll, y: (y0 + y1) / 2 * TCELL }; };
      const lad = (S.tim[-2] ? S.tim[-2].sets : []).find(on), tims = (S.tim[-1] ? S.tim[-1].sets : []).filter(on);
      const under = tims.find(T => T.mid > 0 && T.cap * TCELL > titleCeil(T.mid * TCELL, S) + 6) || tims[0];
      const clip = (/** @type {{ x: number, y: number }} */ q) => ({ x: Math.max(b.left, b.left + q.x * k - 100), y: Math.max(b.top, b.top + q.y * k - 100), width: 200, height: 200 });
      return { lad: lad ? clip(mid(lad)) : null, tim: under ? clip(mid(under)) : null };
    });
    await page.waitForTimeout(300);
    await save('a-lad', 'the Cavern on Coal Seams: ladders and timber (as played, dark)');
    await page.evaluate(() => { DEV.gremDark = 0; });
    await page.waitForTimeout(200);
    await save('b-lad-lit', 'the same screen, darkness lifted (for the shot only)');
    if (box.lad) await save('c-ladder', 'close up (darkness lifted): a ladder', box.lad);
    if (box.tim) await save('d-cavtim', 'close up (darkness lifted): Cavern timber (under a boulder where one is on screen)', box.tim);
    await browser.close(); console.log(said.join(String.fromCharCode(10))); return;
  }
  // (C4a) the bats: the view held on a roost (players not scaring them), a close-up of it lit; then Scare all: the flock in flight
  if (ONLY === 'bats') {
    await page.evaluate(() => { DEV.autoLvlPace = 3; DEV.batScare = 0; DEV.batTakeoff = 0; });
    for (let i = 0; i < 2000; i++) {
      const on = await page.evaluate(() => { const S = window.__gremScene; return !!S && !!S.bats && S.bats.roosts.some(q => q.x - S.scroll > 80 && q.x - S.scroll < 140 && q.y > 20); });
      if (on) break;
      await page.waitForTimeout(60);
    }
    const box = await page.evaluate(() => {
      const S = window.__gremScene, cv = document.querySelector('canvas'), b = cv.getBoundingClientRect(), k = b.width / TITLE_VW;
      S.lvl.step = null; S.pace = 0;
      const q = S.bats.roosts.find(q => q.x - S.scroll > 80 && q.x - S.scroll < 140 && q.y > 20); console.log('at', S.scroll, q.x, q.y);
      return { x: Math.max(b.left, b.left + (q.x - S.scroll) * k - 90), y: Math.max(b.top, b.top + q.y * k - 50), width: 180, height: 180 };
    });
    await page.waitForTimeout(300);
    await save('a-roost', 'Coal Seams: a bat roost under the rock (as played, dark)');
    await page.evaluate(() => { DEV.gremDark = 0; });
    await page.waitForTimeout(150);
    await save('b-roost-close', 'close up (darkness lifted): the roost, bats hanging folded in their slots', box);
    await page.evaluate(() => { DEV.gremDark = DEV_DEFAULTS.gremDark; BAT_CMD.scare = true; });
    await page.waitForTimeout(900);
    await save('c-flock', 'Scare all (Dev): the flock in flight (as played, dark)');
    await page.evaluate(() => { DEV.gremDark = 0; });
    await page.waitForTimeout(60);
    const fb = await page.evaluate(() => {
      const S = window.__gremScene, cv = document.querySelector('canvas'), b = cv.getBoundingClientRect(), k = b.width / TITLE_VW;
      const f = S.bats.list.filter(q => q.st === 'fly' && q.x - S.scroll > 0 && q.x - S.scroll < TITLE_VW); let x = 0, y = 0; for (const q of f) { x += q.x - S.scroll; y += q.y; }
      x /= f.length || 1; y /= f.length || 1;
      return { x: Math.max(b.left, b.left + x * k - 100), y: Math.max(b.top, b.top + y * k - 100), width: 200, height: 200 };
    });
    await save('d-flock-lit', 'the same moment, darkness lifted (for the shot only)');
    await save('e-flock-close', 'close up (darkness lifted): bats flapping in the flock', fb);
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
