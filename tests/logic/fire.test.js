// v86 fire: fuel is painted with the decoration (grass, moss, timber), fire spreads through
// it pixel by pixel, climbs, burns out, and dies once there's nothing left to eat.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const G = new Function('React', shim + upto +
  'return { makeLevel, fireNew, fireLight, fireArea, fireNear, fireStep, FUEL_GRASS, FUEL_MOSS, FUEL_WOOD, ' +
  'FIRE_TICK, FIRE_MAX, CW, CH, CELL, ROCK, DEV, DEV_DEFAULTS, DEV_META, MODS, CREATURES };')({ createElement: () => {} });
const { CW, CH, CELL } = G;

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log(`FAIL ${n}` + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
let rs = 12345;
const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
const idx = (x, y) => y * CW + x;
const run = (F, secs, out) => { for (let t = 0; t < secs; t += 1 / 60) G.fireStep(F, 1 / 60, out, rnd); };

// ---- the levels carry fuel, and only where it belongs ----
{
  const kinds = { 1: 0, 2: 0, 3: 0 };
  let onRockNotMoss = 0, mossInAir = 0, fuelWithoutArt = 0;
  for (const [seed, floor] of [[1, 1], [2, 1], [3, 2], [4, 5], [5, 2]]) {
    const lv = G.makeLevel(seed, floor);
    ok('level ' + seed + ' hands back a fuel map', lv.fuel && lv.fuel.length === CW * CH);
    for (let i = 0; i < lv.fuel.length; i++) {
      const f = lv.fuel[i];
      if (!f) continue;
      kinds[f]++;
      if (lv.mat[i] && f !== G.FUEL_MOSS) onRockNotMoss++;          // only moss is painted onto rock
      if (!lv.mat[i] && f === G.FUEL_MOSS) mossInAir++;
      const art = lv.mat[i] ? lv.img.data[i * 4 + 3] : lv.dimg.data[i * 4 + 3];
      if (!art) fuelWithoutArt++;
    }
  }
  ok('floors 1 and 2 have grass, moss and timber to burn', kinds[1] > 1000 && kinds[2] > 1000 && kinds[3] > 500, kinds);
  ok('only moss sits on the rock', onRockNotMoss === 0, onRockNotMoss);
  ok('moss is never in the open air', mossInAir === 0, mossInAir);
  ok('every fuel pixel has something painted there', fuelWithoutArt === 0, fuelWithoutArt);
  const salt = G.makeLevel(6, 6);                 // salt flats: pillars and bones, nothing that burns
  let saltFuel = 0; for (const f of salt.fuel) if (f) saltFuel++;
  ok('the salt flats have nothing to burn', saltFuel === 0, saltFuel);
}

// ---- a strip of grass burns end to end, and the fire dies when it runs out ----
{
  const fuel = new Uint8Array(CW * CH);
  for (let x = 100; x < 200; x++) fuel[idx(x, 500)] = G.FUEL_GRASS;
  const F = G.fireNew(fuel);
  ok('a pixel with fuel lights', G.fireLight(F, idx(100, 500), rnd));
  ok('a lit pixel does not light twice', !G.fireLight(F, idx(100, 500), rnd));
  ok('a pixel with no fuel does not light', !G.fireLight(F, idx(100, 501), rnd));
  const gone = [];
  let t = 0;
  while (F.list.length && t < 60) { G.fireStep(F, 1 / 60, i => gone.push(i), rnd); t += 1 / 60; }
  ok('the whole strip burnt', gone.length === 100, gone.length);
  ok('and it went out on its own', F.list.length === 0 && t < 60, { left: F.list.length, t });
  let left = 0; for (let x = 100; x < 200; x++) left += fuel[idx(x, 500)];
  ok('burnt pixels have no fuel left', left === 0, left);
  ok('an empty cave does nothing', G.fireStep(G.fireNew(new Uint8Array(CW * CH)), 0.2, null, rnd) === 4);
}

// ---- fire climbs: up a post much faster than down it ----
{
  const upT = [], downT = [];
  for (let trial = 0; trial < 6; trial++) {
    for (const dir of [-1, 1]) {
      const fuel = new Uint8Array(CW * CH);
      for (let k = 0; k < 60; k++) fuel[idx(300, 700 + dir * k)] = G.FUEL_WOOD;
      const F = G.fireNew(fuel);
      G.fireLight(F, idx(300, 700), rnd);
      let t = 0;
      while (!F.t[idx(300, 700 + dir * 40)] && fuel[idx(300, 700 + dir * 40)] && t < 30) { G.fireStep(F, 1 / 60, null, rnd); t += 1 / 60; }
      (dir < 0 ? upT : downT).push(t);
    }
  }
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  ok('fire climbs a post faster than it creeps down one', avg(upT) * 1.5 < avg(downT), { up: avg(upT), down: avg(downT) });
}

// ---- how long things burn, and how readily they catch: grass fast, timber slow ----
{
  const burnFor = kind => {
    const fuel = new Uint8Array(CW * CH);
    fuel[idx(50, 50)] = kind;
    const F = G.fireNew(fuel);
    G.fireLight(F, idx(50, 50), rnd);
    let t = 0;
    while (F.list.length && t < 60) { G.fireStep(F, G.FIRE_TICK, null, rnd); t += G.FIRE_TICK; }
    return t;
  };
  const gT = burnFor(G.FUEL_GRASS), mT = burnFor(G.FUEL_MOSS), wT = burnFor(G.FUEL_WOOD);
  ok('grass flashes, moss smoulders, timber burns long', gT < mT && mT < wT, { gT, mT, wT });
  ok('a grass pixel burns within its knob range', gT >= G.DEV.fireGrassLo - 0.06 && gT <= G.DEV.fireGrassHi + 0.06, gT);
  ok('a timber pixel burns within its knob range', wT >= G.DEV.fireWoodLo - 0.06 && wT <= G.DEV.fireWoodHi + 0.06, wT);
}

// ---- fire can't jump open air, but does cross a one-pixel gap ----
{
  let crossed = 0, jumped = 0;
  for (let trial = 0; trial < 10; trial++) {
    const fuel = new Uint8Array(CW * CH);
    for (let x = 100; x < 120; x++) fuel[idx(x, 300)] = G.FUEL_GRASS;
    for (let x = 121; x < 140; x++) fuel[idx(x, 300)] = G.FUEL_GRASS;    // a one-pixel gap at 120
    for (let x = 144; x < 170; x++) fuel[idx(x, 300)] = G.FUEL_GRASS;    // a four-pixel gap before this
    const F = G.fireNew(fuel);
    G.fireLight(F, idx(100, 300), rnd);
    run(F, 20);
    if (!fuel[idx(139, 300)]) crossed++;
    let far = 0; for (let x = 144; x < 170; x++) far += fuel[idx(x, 300)];
    if (far < 26) jumped++;
  }
  ok('it crosses a one-pixel gap most times', crossed >= 6, crossed);
  ok('it never jumps a four-pixel gap', jumped === 0, jumped);
}

// ---- fireArea, fireNear, and the cap ----
{
  const fuel = new Uint8Array(CW * CH);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) fuel[idx(200 + x, 200 + y)] = G.FUEL_GRASS;
  const F = G.fireNew(fuel);
  const n = G.fireArea(F, 220 * CELL, 220 * CELL, 5 * CELL, 1, rnd);
  ok('fireArea lights the disc it is given', n > 60 && n < 100, n);
  ok('fireNear sees it', G.fireNear(F, 220 * CELL, 220 * CELL, 2));
  ok('fireNear does not see it from afar', !G.fireNear(F, 300 * CELL, 300 * CELL, 6));
  ok('fireArea at zero chance lights nothing', G.fireArea(G.fireNew(fuel), 220 * CELL, 220 * CELL, 10, 0, rnd) === 0);
  const big = new Uint8Array(CW * CH).fill(G.FUEL_WOOD);
  const B = G.fireNew(big);
  G.fireArea(B, CW, CH * 0.5, 400, 1, rnd);
  run(B, 3);
  ok('never more than FIRE_MAX alight', B.list.length <= G.FIRE_MAX, B.list.length);
}

// ---- a pixel put out from outside (dug away) drops off the list ----
{
  const fuel = new Uint8Array(CW * CH);
  fuel[idx(10, 10)] = G.FUEL_WOOD;
  const F = G.fireNew(fuel);
  G.fireLight(F, idx(10, 10), rnd);
  F.t[idx(10, 10)] = 0; fuel[idx(10, 10)] = 0;       // what dig() does
  let outs = 0;
  G.fireStep(F, G.FIRE_TICK, () => outs++, rnd);
  ok('a dug-out fire drops off the list without burning out', F.list.length === 0 && outs === 0, { n: F.list.length, outs });
}

// ---- what sets things alight ----
for (const id of ['fball', 'fbolt', 'meteor', 'missile']) ok(id + ' is a fire spell', G.MODS[id].fire === 1);
ok('Firebolt with Trigger keeps its fire', G.MODS.fbolt_t && G.MODS.fbolt_t.fire === 1);
ok('a plain bolt is not', !G.MODS.bolt.fire);
ok('Stendari is a fire bomber', G.CREATURES.tuli.fire === 1);
ok('every fire knob is a Dev range', ['fireSpread', 'fireGrass', 'fireMoss', 'fireWood', 'fireBoom', 'fireBurn', 'fireDps',
  'fireYou', 'fireYouDps', 'firePlant'].every(k => G.DEV_META.some(m => m.k === k + 'Lo' && m.g === 'fire') &&
  G.DEV_DEFAULTS[k + 'Lo'] <= G.DEV_DEFAULTS[k + 'Hi']));

console.log(fail ? `${pass} passed, ${fail} failed` : `fire: all ${pass} checks passed`);
process.exit(fail ? 1 : 0);
