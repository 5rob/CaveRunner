// Screenshots of floor 2's dark zones for the owner (Level 2 stage 4), phone size (412 x 880 @2.625), the
// real game through the test page. Not a test: it takes the pictures and prints what each shows.
//   node tools/darkshots.js [outdir]      (default tests/build/darkshots; ONLY_MAP=1: the map shots alone; HOLO=1: the hologram at full brightness throughout)
// Builds index.html and the test page first. Same seed as tests/browser/darkzone.test.js (Math.random
// seeded 11, then floor 2).
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'darkshots'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.evaluate(() => { window.__lvl.guide = null; Math.random = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); window.__in.current.newCave = 2; });
  for (let i = 0; i < 60 && !(await page.evaluate(() => window.__lvl.floor === 2 && window.__lvl.dark.length > 0)); i++) await page.waitForTimeout(100);
  const said = [];
  const shot = async (n, what) => { await page.screenshot({ path: path.join(OUT, n + '.png') }); said.push(`${n}.png  ${what}`); };
  const save = (n, url, what) => { fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(url.split(',')[1], 'base64')); said.push(`${n}.png  ${what}`); };

  // ---- (a) the whole floor, map style: the real layers, the zones' darkness and fringe over them, the
  //      small tunnels marked (green: the runner fits; red: the aliens' alone) ----
  const map = mark => page.evaluate(([mark]) => {
    const W = window.__lvl, { CW, CH } = W.world, S = 2;
    const c = document.createElement('canvas'); c.width = CW * S; c.height = CH * S;
    const x = c.getContext('2d');
    const layer = im => { const t = document.createElement('canvas'); t.width = im.width; t.height = im.height; t.getContext('2d').putImageData(im, 0, 0); return t; };
    x.imageSmoothingEnabled = false;
    x.drawImage(layer(makeLevel(W.seed, 2).bgImg), 0, 0, CW * S, CH * S);
    const web = new ImageData(CW, CH), dark = new ImageData(CW, CH);
    for (let i = 0; i < CW * CH; i++) {
      if (W.webbing[i] && W.darkMask[i]) web.data.set(silkColour(W.webbing[i]), i * 4);
      const sh = W.darkShade ? W.darkShade[i] : (W.darkMask[i] ? 255 : 0);
      if (sh) { dark.data[i * 4 + 3] = Math.round(sh * 0.62); dark.data[i * 4 + 2] = 14; }
    }
    x.drawImage(layer(web), 0, 0, CW * S, CH * S);
    x.drawImage(layer(W.img), 0, 0, CW * S, CH * S);
    x.drawImage(layer(W.dimg), 0, 0, CW * S, CH * S);
    x.drawImage(layer(dark), 0, 0, CW * S, CH * S);
    if (mark) for (const z of W.dark) {
      x.strokeStyle = 'rgba(200,170,255,0.9)'; x.lineWidth = 2;
      x.beginPath(); x.ellipse(z.chamber.x * S, z.chamber.y * S, z.chamber.rx * S, z.chamber.ry * S, 0, 0, Math.PI * 2); x.stroke();
      for (const t of z.tunnels) {
        x.strokeStyle = t.fits ? 'rgba(60,255,120,0.9)' : 'rgba(255,70,60,0.9)'; x.lineWidth = 1.5;
        x.beginPath(); t.pts.forEach((p, k) => (k ? x.lineTo(p.x * S, p.y * S) : x.moveTo(p.x * S, p.y * S))); x.stroke();
      }
    }
    return c.toDataURL('image/png');
  }, [mark]);
  save('a-floor', await map(true), 'the whole floor, map style: zones and their ragged fringe darkened, chambers ringed, small tunnels marked (green: runner fits, red: aliens only)');
  // a crop of each zone from the plain map, bigger
  const zoneCrops = await page.evaluate(() => window.__lvl.dark.map(z => ({ x0: z.x0, y0: z.y0, x1: z.x1, y1: z.y1, open: z.open, tunnels: z.tunnels.length, fits: z.tunnels.filter(t => t.fits).length })));
  const plain = await map(false);
  for (let k = 0; k < zoneCrops.length; k++) {
    const z = zoneCrops[k], pad = 50;
    const url = await page.evaluate(([src, z, pad]) => new Promise(res => {
      const im = new Image();
      im.onload = () => {
        const S = 2, x0 = Math.max(0, z.x0 - pad) * S, y0 = Math.max(0, z.y0 - pad) * S, w = (z.x1 - z.x0 + pad * 2) * S, h = (z.y1 - z.y0 + pad * 2) * S;
        const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        x.drawImage(im, x0, y0, w, h, 0, 0, w * 2, h * 2);
        res(c.toDataURL('image/png'));
      };
      im.src = src;
    }), [plain, z, pad]);
    save('a-zone' + (k + 1), url, `zone ${k + 1} up close, map style (open ${(z.open * 100).toFixed(0)}%, ${z.tunnels} small tunnels, ${z.fits} the runner fits)`);
    // and its shape alone: rock pale, open black, the zone's rim outlined, the small tunnels marked
    const shape = await page.evaluate(([z, pad]) => {
      const W = window.__lvl, { CW } = W.world, S = 4, x0 = Math.max(0, z.x0 - pad), y0 = Math.max(0, z.y0 - pad), w = z.x1 - z.x0 + pad * 2, h = z.y1 - z.y0 + pad * 2;
      const im = new ImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y0 + y) * CW + x0 + x, k = (y * w + x) * 4, inz = W.darkMask[i], sh = W.darkShade ? W.darkShade[i] / 255 : 0;
        const c = W.mat[i] ? (inz ? [120, 104, 140] : [150 - 50 * sh, 140 - 50 * sh, 130 - 30 * sh]) : (inz ? [14, 10, 20] : [40 - 20 * sh, 36 - 18 * sh, 34 - 14 * sh]);
        im.data.set([c[0], c[1], c[2], 255], k);
      }
      const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').putImageData(im, 0, 0);
      const c = document.createElement('canvas'); c.width = w * S; c.height = h * S;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(t, 0, 0, w * S, h * S);
      const zz = W.dark.find(q => q.x0 === z.x0 && q.y0 === z.y0);
      for (const tn of zz.tunnels) {
        x.strokeStyle = tn.fits ? 'rgba(60,255,120,0.8)' : 'rgba(255,70,60,0.8)'; x.lineWidth = 2;
        x.beginPath(); tn.pts.forEach((p, k) => (k ? x.lineTo((p.x - x0 + 0.5) * S, (p.y - y0 + 0.5) * S) : x.moveTo((p.x - x0 + 0.5) * S, (p.y - y0 + 0.5) * S))); x.stroke();
      }
      return c.toDataURL('image/png');
    }, [z, pad]);
    save('a-zone' + (k + 1) + '-shape', shape, `zone ${k + 1}'s shape alone: rock pale (purple in the zone, the tomb's stone darker where the fringe reaches), open black, small tunnels marked (green: runner fits, red: aliens only)`);
  }

  if (process.env.ONLY_MAP) { await browser.close(); console.log(said.join('\n')); return; }   // (the map shots alone: quicker)

  // ---- in the game: you pinned, creatures parked, the fog lifted (the darkness is the zone's own) ----
  await page.evaluate(() => {
    const L = window.__lvl;
    L.seen.fill(2); L.fog.paint();
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
  const stand = async (x, y, nx, ny, ms = 1000) => { await page.evaluate(([x, y, nx, ny]) => { window.__pin = { x, y }; window.__aim = { nx, ny }; }, [x, y, nx, ny]); await page.waitForTimeout(ms); };
  const dev = o => page.evaluate(o => Object.assign(DEV, o), o);
  if (process.env.HOLO) await dev({ holoMin: 1, holoMax: 1 });
  await page.waitForTimeout(3000);           // outlast the floor's name card
  // a place to stand: open box over a floor, from terrain (x, y) searching outward
  const spotNear = (tx, ty, rmax) => page.evaluate(([tx, ty, rmax]) => {
    const W = window.__lvl, { CW, CELL } = W.world, m = W.mat;
    const free = (x, y) => { for (let j = 0; j < 11; j++) for (let i = 0; i < 6; i++) if (m[(y - j) * CW + x + i]) return false; return true; };
    for (let r = 0; r <= rmax; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = tx + dx, y = ty + dy;
      if (x < 4 || y < 14 || x > CW - 10) continue;
      if (!m[y * CW + x] && m[(y + 1) * CW + x] && m[(y + 1) * CW + x + 5] && free(x, y)) return { x: x * CELL - 0, y: (y + 1) * CELL - 22 - 0.5, tx: x, ty: y };
    }
    return null;
  }, [tx, ty, rmax]);

  // (b) at a zone's edge: on the tomb floor just outside, facing in (every such spot, the first with the
  // walk-in's spots near it chosen below)
  const edges = await page.evaluate(() => {
    const out = [];
    const W = window.__lvl, { CW, CELL } = W.world, m = W.mat, k = W.darkMask;
    const free = (x, y) => { for (let j = 0; j < 11; j++) for (let i = 0; i < 6; i++) if (m[(y - j) * CW + x + i]) return false; return true; };
    for (const z of W.dark) for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0 - 12; x <= z.x1 + 12; x++) {
      const i = y * CW + x;
      if (k[i] || m[i] || !m[i + CW] || !free(x, y)) continue;
      for (const dir of [1, -1]) {
        let ok = true;
        for (let s = 8; s <= 30 && ok; s++) { const j = i - 5 * CW + dir * s; if (!k[j] || m[j]) ok = false; }
        for (let s = 4; s <= 30 && ok; s++) { const j = i - 5 * CW - dir * s; if (k[j] || m[j]) ok = false; }
        if (ok && !out.some(e => Math.abs(e.tx - x) + Math.abs(e.ty - y) < 20)) out.push({ x: x * CELL - 6, y: (y + 1) * CELL - 22 - 0.5, dir, tx: x, ty: y, z: z.id });
      }
    }
    return out;
  });
  // standing spots at a depth into the zone, nearest (ex, ey) first
  const atDepthNear = (/** @type {number} */ lo, /** @type {number} */ hi, /** @type {number} */ ex, /** @type {number} */ ey, win = 90, air = false) => page.evaluate(([lo, hi, ex, ey, win, air]) => {
    const W = window.__lvl, { CW, CELL } = W.world, m = W.mat, dp = W.darkDepth;
    const free = (x, y) => { for (let j = 0; j < 11; j++) for (let i = 0; i < 6; i++) if (m[(y - j) * CW + x + i]) return false; return true; };
    let best = null, bd = 1e9;
    for (let y = Math.max(14, ey - win); y < ey + win; y++) for (let x = Math.max(4, ex - win); x < Math.min(CW - 10, ex + win); x++) {
      const d = dp[(y - 5) * CW + x + 3];
      if (d < lo || d > hi || m[y * CW + x] || (!air && (!m[(y + 1) * CW + x] || !m[(y + 1) * CW + x + 5])) || !free(x, y)) continue;
      const e = (x - ex) ** 2 + (y - ey) ** 2;
      if (e < bd) { bd = e; best = { x: x * CELL, y: (y + 1) * CELL - 22 - 0.5, d }; }
    }
    return best;
  }, [lo, hi, ex, ey, win, air]);
  const T = await page.evaluate(() => ({ tint: DEV.l2dTintDepth, torch: DEV.l2dTorchDepth }));
  const bands = [[1, Math.max(1, Math.round(T.tint * 0.25))], [Math.round(T.tint * 0.4), Math.round(T.tint * 0.65)], [T.tint + 1, T.torch - 1], [T.torch + 10, T.torch + 40]];
  // (round 5 on: the zones are big, shallow standing spots rare: look further out, then hover there, pinned in
  // the air, if none has a floor)
  let edge = edges[0] || null, win = 90, air = false;
  find: for (const a of [false, true]) for (const w of [90, 160]) for (const e of edges) {
    let all = true;
    for (const [lo, hi] of bands) if (!(await atDepthNear(lo, hi, e.tx, e.ty, w, a))) { all = false; break; }
    if (all) { edge = e; win = w; air = a; break find; }
  }
  if (edge) {
    await stand(edge.x, edge.y, edge.dir, 0);
    await shot('b-edge', 'at a zone\'s edge, standing in the tomb aiming in: the black fading in with depth, the torch cut where it fails');
    // walking in (round 3): standing spots at growing depth into the same zone, nearest the edge first. The black
    // fades in with depth; the torch cuts through it until l2dTorchDepth, then flickers out
    const atDepth = (/** @type {number} */ lo, /** @type {number} */ hi) => atDepthNear(lo, hi, edge.tx, edge.ty, win, air);
    const steps = [['w1-fade-start', 1, Math.max(1, Math.round(T.tint * 0.25)), 'walking in 1: just inside the edge, the black only starting'],
      ['w2-mid-fade', Math.round(T.tint * 0.4), Math.round(T.tint * 0.65), 'walking in 2: mid-fade, things half black'],
      ['w3-black-torch-on', T.tint + 1, T.torch - 1, 'walking in 3: past the fade, fully black but for what the torch still lights']];
    for (const [n, lo, hi, what] of steps) {
      const sp = await atDepth(lo, hi);
      if (!sp) { console.log('no spot at depth', lo, hi); continue; }
      await stand(sp.x, sp.y, edge.dir, 0.15, 900);
      await shot(n, what + ` (${sp.d} px in)`);
    }
    const blind = await atDepth(T.torch + 10, T.torch + 40);
    if (blind) {
      await page.evaluate(([x, y]) => { window.__pin = { x, y }; }, [blind.x, blind.y]);
      // (frames as they come: until there's one with the torch on and one with it off, at most 4)
      const seen = new Set();
      for (let k = 1, tries = 0; k <= 4 && tries < 40 && seen.size < 2; tries++) {
        await page.waitForTimeout(15);
        const t = await page.evaluate(() => ({ t: window.__lvl.torchFail.t, lit: window.__lvl.torchLit }));
        if (t.t > 0.8) { if (seen.size || !t.lit) break; continue; }   // (not crossed yet: wait for it)
        if (seen.has(t.lit) && k > 1) continue;
        seen.add(t.lit);
        const kk = k++;
        await shot('w4-torch-flicker' + kk, `walking in 4.${kk}: past ${T.torch} px in (${blind.d}), the torch flickering: ${t.t.toFixed(2)} s, ${t.lit ? 'on' : 'off'} this frame`);
      }
      await page.waitForTimeout(1000);
      await shot('w5-blind', 'walking in 5: the torch has failed, blind: only silhouettes against the silk');
      await page.evaluate(([x, y]) => { window.__pin = { x, y }; }, [edge.x, edge.y]);
      await page.waitForTimeout(1300);
    }
  } else console.log('no edge spot found');

  // (c) deep in: the chamber's floor
  const ch = await page.evaluate(() => {
    const W = window.__lvl, { CW, CELL } = W.world, c = W.dark[0].chamber;
    let best = null;
    for (let d = 0; d < c.rx && !best; d++) for (const x of [c.x - d, c.x + d]) {
      let y = c.y;
      while (y < c.floor + 3 && !W.mat[(y + 1) * CW + x]) y++;
      if (y < c.floor + 3 && W.mat[(y + 1) * CW + x + 3] && W.mat[(y + 1) * CW + x - 3]) { best = { x, y }; break; }
    }
    const b = best || { x: c.x, y: c.y };
    return { x: b.x * CELL - 6, y: (b.y + 1) * CELL - 22 - 0.5, tx: b.x, ty: b.y };
  });
  await stand(ch.x, ch.y, 1, 0);
  await shot('c-deep', 'deep in zone 1\'s chamber, the torch failed: everything a black silhouette against the dark, silk-frosted back');

  // (d) fire in the chamber
  await page.evaluate(([tx, ty]) => {
    const W = window.__lvl, { CW, CELL } = W.world;
    for (let yy = ty - 12; yy <= ty; yy++) for (let xx = tx + 10; xx < tx + 30; xx++) if (!W.mat[yy * CW + xx]) W.fire.fuel[yy * CW + xx] = 3;
    for (let k = 0; k < 4; k++) W.ignite((tx + 12 + k * 5) * CELL, (ty - 2) * CELL, 10, 1);
  }, [ch.tx, ch.ty]);
  await page.waitForTimeout(700);
  await shot('d-fire', 'the same spot with a fire lit beside you: near it the black lifts, you and the rock round it regain colour');
  await page.evaluate(() => { const W = window.__lvl; W.fire.fuel.fill(0); W.fire.list.length = 0; });
  await page.waitForTimeout(1500);

  // (e) border close-ups: three points round the zones' rims (on open tomb just outside), zoomed in
  const rims = await page.evaluate(() => {
    const W = window.__lvl, { CW } = W.world, k = W.darkMask, sh = W.darkShade, out = [];
    for (const z of W.dark) for (const a of [0.6, 2.4, 4.2]) {
      // walk out from the middle along angle a to the first cell outside the zone
      let d = 0;
      while (d < z.r * 2 && k[Math.round(z.cy + Math.sin(a) * d) * CW + Math.round(z.cx + Math.cos(a) * d)]) d++;
      out.push({ tx: Math.round(z.cx + Math.cos(a) * (d + 6)), ty: Math.round(z.cy + Math.sin(a) * (d + 6)), sh: sh ? sh[Math.round(z.cy + Math.sin(a) * (d + 6)) * CW + Math.round(z.cx + Math.cos(a) * (d + 6))] : 0 });
    }
    return out;
  });
  await dev({ zoom: 2.2 });
  let nb = 0;
  for (const r of rims) {
    if (nb >= 3) break;
    const s = await spotNear(r.tx, r.ty, 30);
    if (!s) continue;
    nb++;
    await stand(s.x, s.y, 0.7, -0.7);
    await shot('e-border' + nb, `border close-up ${nb} (zoomed): stone eaten into and webbed, tendrils and patches of dark reaching into the tomb`);
  }
  // (f) the small tunnels: the zone with most of them, at one the runner fits and one it doesn't, with the
  //     darkness off (to see the rock) and on
  const tun = await page.evaluate(() => {
    const W = window.__lvl, z = W.dark.slice().sort((a, b) => b.tunnels.length - a.tunnels.length)[0];
    const pick = f => { const t = z.tunnels.filter(t => t.fits === f).sort((a, b) => b.pts.length - a.pts.length)[0]; return t ? t.pts[t.pts.length >> 1] : null; };
    return { fit: pick(true), tight: pick(false) };
  });
  for (const [n, p] of [['f-tunnels-tight', tun.tight], ['f-tunnels-fit', tun.fit]]) {
    if (!p) continue;
    const s = await spotNear(p.x, p.y, 40);
    if (!s) continue;
    await dev({ zoom: 2.2, l2dDark: 0 });
    await stand(s.x, s.y, 1, 0);
    await shot(n + '-lit', (n.endsWith('fit') ? 'a small tunnel the runner fits through' : 'small alien tunnels, narrower than the runner') + ', the darkness switched off to show the rock (zoomed)');
    await page.evaluate(() => { DEV.l2dDark = DEV_DEFAULTS.l2dDark; });
    await page.waitForTimeout(500);
    await shot(n + '-dark', 'the same spot as it plays: dark, silhouettes against the silk');
  }
  await dev({ zoom: 1 });

  // (g)-(i) the hologram at full brightness: at the edge (sharp in the tomb, diffused behind the silk), deep
  //     in, and deep in with l2dHolo 0
  await dev({ holoMin: 1, holoMax: 1 });
  if (edge) {
    await stand(edge.x, edge.y, edge.dir, 0, 1500);
    await shot('g-holo-edge', 'the hologram at full brightness at the edge: sharp in the tomb, blurred behind the silk, rock black against it');
  }
  await stand(ch.x, ch.y, 1, 0, 1500);
  await shot('h-holo-inside', 'deep inside, the hologram at full brightness: blurred (frosted) and multiplied by the silk, silhouettes against it');
  await dev({ l2dHolo: 0 });
  await page.waitForTimeout(600);
  await shot('i-holo-off', 'the same spot with l2dHolo = 0, for comparison');
  await browser.close();
  console.log(said.map(s => path.join(OUT, s)).join('\n'));
})().catch(e => { console.log('ERROR', e); process.exit(1); });

