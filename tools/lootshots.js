// Screenshots of floor 2's loot (Level 2 stage 6: world/loot.js), phone size (412 x 880 @2.625), the real
// game through the test page. Not a test: it takes the pictures and prints what each shows.
//   node tools/lootshots.js [outdir]      (default tests/build/lootshots)
// Same seed as tools/boomshots.js (Math.random seeded 11, then floor 2). Each prize kind is forced into the
// first zone in turn (placePrize), shown with the darkness off (DEV.l2dDark = 0) and on.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'lootshots'));
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

  // ---- (a) the whole floor, map style, zones darkened; each loot spot a gold dot (ringed red: a red
  //      crystal too), each prize a square in its colour ----
  const url = await page.evaluate(() => {
    const W = window.__lvl, { CW, CH } = W.world;
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const x = c.getContext('2d');
    const layer = im => { const t = document.createElement('canvas'); t.width = im.width; t.height = im.height; t.getContext('2d').putImageData(im, 0, 0); return t; };
    x.drawImage(layer(makeLevel(W.seed, 2).bgImg), 0, 0, CW, CH);
    const dark = new ImageData(CW, CH);
    for (let i = 0; i < CW * CH; i++) { const sh = W.darkShade ? W.darkShade[i] : 0; if (sh) { dark.data[i * 4 + 3] = Math.round(sh * 0.62); dark.data[i * 4 + 2] = 14; } }
    x.drawImage(layer(W.img), 0, 0); x.drawImage(layer(W.dimg), 0, 0); x.drawImage(layer(dark), 0, 0);
    for (const s of W.tomb.loot) {
      x.fillStyle = '#ffd23a'; x.beginPath(); x.arc(s.x / 2, s.y / 2 - 3, 4, 0, 7); x.fill();
      if (s.red) { x.strokeStyle = '#ff3048'; x.lineWidth = 2; x.beginPath(); x.arc(s.x / 2, s.y / 2 - 3, 8, 0, 7); x.stroke(); }
    }
    for (const z of W.dark) {
      const p = z.prize;
      x.fillStyle = p.kind === 'gold' ? '#ffd23a' : p.kind === 'red' ? '#ff3048' : '#3dff7a';
      x.fillRect(p.x / 2 - 7, p.y / 2 - 14, 14, 14);
      x.fillStyle = '#fff'; x.font = 'bold 14px sans-serif'; x.fillText(p.kind + ' ' + p.n, p.x / 2 + 10, p.y / 2 - 2);
    }
    return c.toDataURL('image/png');
  });
  const info = await page.evaluate(() => ({ spots: window.__lvl.tomb.loot.length, reds: window.__lvl.tomb.loot.filter(s => s.red).length,
    prizes: window.__lvl.dark.map(z => z.prize.kind + ' ' + z.prize.n).join(', '), enemies: window.__lvl.enemies.length }));
  save('a-floor', url, `the whole floor, map style: ${info.spots} loot spots (gold dots; ringed red: ${info.reds} with a red crystal), prizes squared: ${info.prizes}; ${info.enemies} creatures`);

  await page.evaluate(() => {
    const L = window.__lvl;
    L.seen.fill(2); L.fog.paint();
    window.__pin = null;
    const loop = () => {
      const p = window.__pin;
      if (p) { L.p.x = p.x; L.p.y = p.y; L.p.vx = L.p.vy = 0; }
      L.p.hp = 9999;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.waitForTimeout(3000);           // outlast the floor's name card; the nuggets settle
  // pinned in the air at a world point (the runner's top-left)
  const hover = async (wx, wy, ms = 1200) => { await page.evaluate(([x, y]) => { window.__pin = { x, y }; }, [wx - 6, wy - 11]); await page.waitForTimeout(ms); };

  // ---- (b) each prize kind in the first zone's chamber, darkness off then on ----
  for (const [kind, n] of [['gold', 1500], ['red', 5], ['green', 2]]) {
    const z = await page.evaluate(([kind, n]) => {
      const W = window.__lvl, z = W.dark[0], p = z.prize, R = z.chamber.rx * 2 + 40;
      const far = q => Math.hypot(q.x - p.x, q.y - p.y) > R;
      W.coins.splice(0, W.coins.length, ...W.coins.filter(far));
      W.pickups.splice(0, W.pickups.length, ...W.pickups.filter(far));
      let s = 5; placePrize(W.coins, W.pickups, W.mat, z, { kind, n }, 2, () => (s = (s * 16807) % 2147483647) / 2147483647);
      return z.prize;
    }, [kind, n]);
    await page.evaluate(() => { DEV.l2dDark = 0; });
    await hover(z.x, z.y - 60, 1500);
    await shot(`b-${kind}-lit`, `the ${kind} prize (${n}${kind === 'gold' ? ' gold' : ' crystals'}) on a chamber's floor, darkness off`);
    await page.evaluate(() => { DEV.l2dDark = DEV_DEFAULTS.l2dDark; });
    await hover(z.x, z.y - 60, 900);
    await shot(`b-${kind}-dark`, `the same, darkness on (as played)`);
  }

  // ---- (c) loot in the wasteland: a spot with a red crystal, and a plain one ----
  const spots = await page.evaluate(() => window.__lvl.tomb.loot);
  const red = spots.find(s => s.red && s.y < 2600) || spots[0], plain = spots.find(s => !s.red && Math.hypot(s.x - red.x, s.y - red.y) > 300) || spots[1];
  await hover(red.x - 40, red.y - 40); await shot('c-loot-red', `loot in the wasteland: ${red.gold} gold as nuggets and a red crystal, where a creature would have been`);
  await hover(plain.x - 40, plain.y - 40); await shot('c-loot-gold', `another spot: ${plain.gold} gold as nuggets`);

  console.log(said.join('\n'));
  await browser.close();
})();
