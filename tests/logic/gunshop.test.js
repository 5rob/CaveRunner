const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { makeLevel, gunPrice, isGunShop, makeGun, gunTier, CH };')({ createElement: () => {} });

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

for (const fl of [1, 2, 3, 4, 5, 6]) {
  const L = G.makeLevel(4242 + fl, fl);
  const guns = L.stock.filter(s => s.kind === 'gun');
  const mods = L.stock.filter(s => s.kind === 'mod');
  const wantGuns = fl % 2 === 0;
  check(`floor ${fl}: ${wantGuns ? 'guns' : 'mods'} for sale`,
    L.stock[0].kind === 'heal' && L.stock.length === 5 &&
    (wantGuns ? guns.length === 4 && mods.length === 0 : mods.length === 4 && guns.length === 0),
    L.stock.map(s => s.kind));
  if (wantGuns) console.log('     ', guns.map(s => `${s.gun.name} ${s.gun.cap}sl ${s.price}g`).join(' | '));
}

// prices should track quality, not be random
const prices = [];
for (let seed = 1; seed <= 40; seed++) {
  const L = G.makeLevel(seed, 2);
  for (const s of L.stock) if (s.kind === 'gun') prices.push(s.price);
}
prices.sort((a, b) => a - b);
check('gun prices land in a sane range', prices[0] >= 45 && prices[prices.length - 1] < 700,
  { min: prices[0], med: prices[prices.length >> 1], max: prices[prices.length - 1] });

// better guns cost more
const cheapGun = { cap: 2, castDelay: 0.5, recharge: 1.4, manaMax: 90, manaRegen: 25, spread: 8, multi: 1, speedMul: 0.8, shuffle: true };
const goodGun = { cap: 8, castDelay: 0.06, recharge: 0.2, manaMax: 340, manaRegen: 110, spread: 0.5, multi: 2, speedMul: 1.4, shuffle: false };
check('a better gun costs more', G.gunPrice(goodGun) > G.gunPrice(cheapGun) * 3,
  { cheap: G.gunPrice(cheapGun), good: G.gunPrice(goodGun) });

// tier rises with the floor. Sample three quarters of the way down the cave, as a
// share of its height, so this still means "deep" when the map grows.
const DEEP = Math.round(G.CH * 0.75);
const low = [], high = [];
for (let seed = 1; seed <= 200; seed++) {
  let rs = seed % 2147483646 + 1;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  low.push(G.makeGun(rnd, G.gunTier(DEEP, 1)).cap);
  high.push(G.makeGun(rnd, G.gunTier(DEEP, 6)).cap);
}
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
check('deep guns get better as floors go by', avg(high) > avg(low) + 1,
  { floor1: +avg(low).toFixed(2), floor6: +avg(high).toFixed(2) });
const t = [1, 2, 3, 4, 5, 6].map(f => +G.gunTier(DEEP, f).toFixed(2));
check('tier climbs every floor', t.every((v, i) => i === 0 || v > t[i - 1]), t);

console.log(fails ? `\n${fails} failed` : '\nall good');
process.exit(fails ? 1 : 0);
