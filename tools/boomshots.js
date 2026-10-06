// Screenshots of floor 2's wasteland (Level 2 stage 5: world/destroy.js), phone size (412 x 880 @2.625), the
// real game through the test page. Not a test: it takes the pictures and prints what each shows.
//   node tools/boomshots.js [outdir]      (default tests/build/boomshots)
// Same seed as tools/darkshots.js (Math.random seeded 11, then floor 2).
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'boomshots'));
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

  // ---- (a) the whole floor, map style: back wall, rock and decoration, the zones darkened; each blast ringed
  //      faintly (orange; red: it burnt) ----
  const url = await page.evaluate(() => {
    const W = window.__lvl, { CW, CH } = W.world, S = 1;
    const c = document.createElement('canvas'); c.width = CW * S; c.height = CH * S;
    const x = c.getContext('2d');
    const layer = im => { const t = document.createElement('canvas'); t.width = im.width; t.height = im.height; t.getContext('2d').putImageData(im, 0, 0); return t; };
    x.imageSmoothingEnabled = false;
    x.drawImage(layer(makeLevel(W.seed, 2).bgImg), 0, 0, CW * S, CH * S);
    const dark = new ImageData(CW, CH);
    for (let i = 0; i < CW * CH; i++) { const sh = W.darkShade ? W.darkShade[i] : 0; if (sh) { dark.data[i * 4 + 3] = Math.round(sh * 0.62); dark.data[i * 4 + 2] = 14; } }
    x.drawImage(layer(W.img), 0, 0, CW * S, CH * S);
    x.drawImage(layer(W.dimg), 0, 0, CW * S, CH * S);
    x.drawImage(layer(dark), 0, 0, CW * S, CH * S);
    for (const b of W.tomb.boom.list) {
      x.strokeStyle = b.fire ? 'rgba(255,60,40,0.55)' : 'rgba(255,170,40,0.45)'; x.lineWidth = 1;
      x.beginPath(); x.arc(b.x * S, b.y * S, b.r * S, 0, Math.PI * 2); x.stroke();
    }
    return c.toDataURL('image/png');
  });
  const B = await page.evaluate(() => window.__lvl.tomb.boom);
  save('a-floor', url, `the whole floor, map style: ${B.blasts} blasts (${B.fire} burnt), ringed faintly (orange; red = fire), zones darkened; ${B.bones} remains`);

  await page.evaluate(() => {
    const L = window.__lvl;
    L.seen.fill(2); L.fog.paint();
    window.__pin = null;
    const loop = () => {
      const p = window.__pin;
      if (p) { L.p.x = p.x; L.p.y = p.y; L.p.vx = L.p.vy = 0; }
      L.p.hp = 9999;
      for (const e of L.enemies) { e.x = 30; e.y = 30; e.ty = 30; e.hx = 30; e.hy = 30; }
      L.enemyShots.length = 0;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    L.pickups.length = 0;
  });
  await page.waitForTimeout(3000);           // outlast the floor's name card
  // pinned in the air at a terrain point (world units for the runner's top-left)
  const hover = async (tx, ty, ms = 900) => { await page.evaluate(([x, y]) => { window.__pin = { x, y }; }, [tx * 2 - 6, ty * 2 - 11]); await page.waitForTimeout(ms); };
  const free = list => list.filter(b => !b.inZone);
  const blasts = await page.evaluate(() => {
    const W = window.__lvl, { CW } = W.world;
    return W.tomb.boom.list.map(b => ({ ...b, inZone: !!W.darkMask[Math.floor(b.y) * CW + Math.floor(b.x)] }));
  });
  const big = free(blasts).filter(b => b.dist > 30).sort((a, b) => b.r - a.r);
  if (big[0]) { await hover(big[0].x, big[0].y); await shot('b-hole1', `a blast hole (r ${big[0].r.toFixed(0)} px, ${big[0].fire ? 'burnt' : 'no fire'}), you hovering in it: the scorch ring round its lip`); }
  const other = big.find(b => Math.hypot(b.x - big[0].x, b.y - big[0].y) > 150 && b.fire) || big[3];
  if (other) { await hover(other.x, other.y); await shot('b-hole2', `another blast hole (r ${other.r.toFixed(0)} px, ${other.fire ? 'burnt' : 'no fire'})`); }
  // bones: the densest patch of bone-white decoration outside the zones
  const bone = await page.evaluate(() => {
    const W = window.__lvl, { CW, CH } = W.world, d = W.dimg.data;
    // (not in a tomb room: their kits have bones of their own)
    const room = new Uint8Array(CW * CH);
    for (const r of W.tomb.rooms) for (let y = Math.max(0, r.y - 4); y <= r.floor + 2; y++) for (let x = Math.max(0, r.x - 4); x < Math.min(CW, r.x + r.w + 4); x++) room[y * CW + x] = 1;
    let best = null, bn = 0;
    for (let y = 40; y < CH - 200; y += 20) for (let x = 40; x < CW - 40; x += 20) {
      let n = 0;
      for (let j = -40; j < 40; j += 2) for (let i = -60; i < 60; i += 2) { const k = ((y + j) * CW + x + i) * 4; if (d[k + 3] && d[k] > 200 && d[k + 1] > 195 && !W.darkMask[(y + j) * CW + x + i] && !room[(y + j) * CW + x + i]) n++; }
      if (n > bn) { bn = n; best = { x, y }; }
    }
    return best;
  });
  if (bone) { await hover(bone.x, bone.y - 10); await shot('c-bones', 'bones and skulls sticking out of the ground (the densest patch outside the zones)'); }
  const edge = free(blasts).sort((a, b) => a.dist - b.dist || b.r - a.r)[0];
  if (edge) { await hover(edge.x, edge.y); await shot('d-edge', `next to a dark zone's edge (${edge.dist.toFixed(0)} px out), where the blasts are densest and biggest`); }

  console.log(said.join('\n'));
  await browser.close();
})();
