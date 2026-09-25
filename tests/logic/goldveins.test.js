// v80 gold veins: seams of gold in the rock, only ever in rock, never in the shop,
// painted gold, and the same seed makes the same seams.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { makeLevel, goldVeins, CW, CH, ROCK, SHOP_TOP, SHOP_ROOF, ORE_GOLD };')({ createElement: () => {} });

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log(`FAIL ${n}` + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };

let allRock = true, belowShop = 0, withOre = 0, painted = true, embedded = 0, total = 0, exposed = 0;
for (let seed = 1; seed <= 8; seed++) {
  const lv = G.makeLevel(seed, 1 + (seed % 5));
  const { mat, ore, img } = lv;
  let n = 0;
  for (let i = 0; i < ore.length; i++) {
    if (!ore[i]) continue;
    n++;
    if (mat[i] !== G.ROCK) allRock = false;
    const y = (i / G.CW) | 0, x = i % G.CW;
    if (y >= G.SHOP_TOP - G.SHOP_ROOF) belowShop++;
    const d = img.data, k = i * 4;
    if (!(d[k] > d[k + 2] + 80 && d[k + 1] > d[k + 2] + 40)) painted = false;   // gold, not grey rock
    // an ore pixel with open air right next to it: you can see the seam from the cave
    if (!mat[i - 1] || !mat[i + 1] || !mat[i - G.CW] || !mat[i + G.CW]) exposed++;
  }
  if (n > 40) withOre++;
  total += n;
}
ok('only rock is ever gold', allRock);
ok('none of it down at the shop', belowShop === 0, belowShop);
ok('every cave has a fair bit of it', withOre === 8, withOre);
ok('it is painted gold', painted);
ok('some of it shows on a cave wall', exposed > 0, exposed);
const a = G.goldVeins(G.makeLevel(3, 2).mat, 3, 2), b = G.goldVeins(G.makeLevel(3, 2).mat, 3, 2);
ok('the same seed makes the same seams', a.every((v, i) => v === b[i]));
ok('a vein is worth something', total * G.ORE_GOLD / 8 > 20, total * G.ORE_GOLD / 8);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
