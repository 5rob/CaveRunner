const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { makeLevel, gunPrice, isGunShop, makeGun, caveGun, gunLevel, gunAccent, GUN_RANGE, GUN_LV_COL, CH };')({ createElement: () => {} });

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

// Dev → Spawn gun: caveGun rolls a floor's cave gun, and deeper floors roll better ones
{
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const avg = fl => { let t = 0; for (let i = 0; i < 60; i++) t += G.gunPrice(G.caveGun(fl, rnd)); return t / 60; };
  const g = G.caveGun(1, rnd);
  check('caveGun makes a gun', g && g.cap >= 1 && Array.isArray(g.slots), g && g.cap);
  const a1 = avg(1), a8 = avg(8);
  check('floor 8 spawn guns beat floor 1', a8 > a1 * 1.2, { a1: Math.round(a1), a8: Math.round(a8) });
}

// prices should track quality, not be random
const prices = [];
for (let seed = 1; seed <= 40; seed++) {
  const L = G.makeLevel(seed, 2);
  for (const s of L.stock) if (s.kind === 'gun') prices.push(s.price);
}
prices.sort((a, b) => a - b);
check('gun prices land in a sane range', prices[0] >= 45 && prices[prices.length - 1] < 1500,   // v70 widened stat ranges
  { min: prices[0], med: prices[prices.length >> 1], max: prices[prices.length - 1] });

// better guns cost more
const cheapGun = { cap: 2, castDelay: 0.5, recharge: 1.4, manaMax: 90, manaRegen: 25, spread: 8, multi: 1, speedMul: 0.8, shuffle: true };
const goodGun = { cap: 8, castDelay: 0.06, recharge: 0.2, manaMax: 340, manaRegen: 110, spread: 0.5, multi: 2, speedMul: 1.4, shuffle: false };
check('a better gun costs more', G.gunPrice(goodGun) > G.gunPrice(cheapGun) * 3,
  { cheap: G.gunPrice(cheapGun), good: G.gunPrice(goodGun) });

// gun level comes from the floor alone, and each level closes in on perfect stats
{
  let rs = 99; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const K = ['cap', 'castDelay', 'recharge', 'manaMax', 'manaRegen', 'spread', 'speedMul'];
  // "badness" per stat: 0 at the best end of its range, 1 at the worst
  const bad = (g, k) => { const [w, b] = G.GUN_RANGE[k]; return (g[k] - b) / (w - b); };
  const spreadOf = lvl => {
    const out = {};
    for (const k of K) {
      const v = []; for (let i = 0; i < 400; i++) v.push(bad(G.makeGun(rnd, lvl), k));
      v.sort((a, b) => a - b);
      out[k] = { lo: v[0], hi: v[v.length - 1], mean: v.reduce((a, b) => a + b, 0) / v.length };
    }
    return out;
  };
  const s1 = spreadOf(1), s5 = spreadOf(5), s10 = spreadOf(10);
  check('level 1 stats are wild: each covers most of its range',
    K.every(k => s1[k].hi - s1[k].lo > 0.8), K.map(k => +(s1[k].hi - s1[k].lo).toFixed(2)));
  check('level 10 stats all land in the best ~10% (cap rounds)',
    K.every(k => s10[k].hi <= (k === 'cap' ? 0.17 : 0.1001)), K.map(k => +s10[k].hi.toFixed(3)));
  check('every stat gets better on average level by level',
    K.every(k => s1[k].mean > s5[k].mean && s5[k].mean > s10[k].mean),
    K.map(k => [s1[k].mean, s5[k].mean, s10[k].mean].map(x => +x.toFixed(2))));
  // v70 ranges: slots 2-25, delay/recharge 1.5-0.01s, mana 50-1000, regen 10-500
  const g10 = Array.from({ length: 200 }, () => G.makeGun(rnd, 10));
  check('level 10 guns reach the v70 ranges', g10.every(g => g.cap >= 22 && g.cap <= 25 && g.castDelay <= 0.16 &&
    g.recharge <= 0.16 && g.manaMax >= 900 && g.manaRegen >= 450 && g.spread <= 2 && g.speedMul >= 1.85));
  const doubles = lvl => { let n = 0; for (let i = 0; i < 2000; i++) n += G.makeGun(rnd, lvl).multi > 1 ? 1 : 0; return n / 2000; };
  check('double cast ~10% at level 1, ~50% at level 10', Math.abs(doubles(1) - 0.1) < 0.03 && Math.abs(doubles(10) - 0.5) < 0.05);
  const sh = lvl => { let n = 0; for (let i = 0; i < 400; i++) n += G.makeGun(rnd, lvl).shuffle ? 1 : 0; return n; };
  check('level 10 guns never shuffle', sh(10) === 0, sh(10));
  // no cave height in it: the same floor gives the same level, bar the rare drops
  const lv = f => { const c = {}; for (let i = 0; i < 2000; i++) { const l = G.gunLevel(f, rnd); c[l] = (c[l] || 0) + 1; } return c; };
  const l3 = lv(3), rare3 = 2000 - l3[3];
  check('floor 3 guns are level 3, with ~20% rare', rare3 > 300 && rare3 < 500, l3);
  check('rare drops are above the floor and at most 10',
    Object.keys(l3).every(l => +l >= 3 && +l <= 10) && Object.keys(l3).length === 8, Object.keys(l3));
  check('floor 10 and past are always level 10', Object.keys(lv(10)).join() === '10' && Object.keys(lv(14)).join() === '10');
  check('a gun wears its level colour', G.gunAccent(G.makeGun(rnd, 7)) === G.GUN_LV_COL[6]);
  const L = G.makeLevel(777, 4);
  check('a level\'s cave guns are its level or rarer', L.pickups.filter(q => q.kind === 'gun').every(q => q.gun.lvl >= 4),
    L.pickups.filter(q => q.kind === 'gun').map(q => q.gun.lvl));
}

console.log(fails ? `\n${fails} failed` : '\nall good');
process.exit(fails ? 1 : 0);
