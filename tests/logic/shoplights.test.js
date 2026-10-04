// v0.0.136: a new run's dark shop (world/shoplights.js), the machines evenly spaced one light
// section each, and spilled gold waiting SPILL_WAIT before it can be picked up.
const G = require('../load');
const { LIGHT_X, LIGHT_WAIT, FIRST_TRIGGER, TUBE_MAX, lightsNew, lightsStep, lightNear, tubeLevel, shopDark,
  SHOP_SLOT, VEND_BUY_X, VEND_SELL_X, SHOP_MACHINE_X, HEAL_X, WW, spillGold, SPILL_WAIT } = G;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// ---- the machines: SHOP_SLOT apart, each the middle of a light section ----
const xs = [VEND_BUY_X, VEND_SELL_X, ...SHOP_MACHINE_X];
check('buy, sell, mods, guns, perks, evenly spaced', xs.every((x, i) => !i || x - xs[i - 1] === SHOP_SLOT), xs);
check('each one under its own light', xs.every(x => LIGHT_X.includes(x)), LIGHT_X);
// v0.0.141: they stand at the far right, the heal just before them, an empty hall from the way in
check('the machines out to the end wall', SHOP_MACHINE_X[2] + 30 < WW && SHOP_MACHINE_X[2] + SHOP_SLOT > WW - 40, SHOP_MACHINE_X);
check('the heal just before the buy machine, far from the way in', HEAL_X > 500 && HEAL_X < VEND_BUY_X - 50, HEAL_X);
const PI = LIGHT_X.indexOf(SHOP_MACHINE_X[2]);

// ---- a tube stutters on, then stays on ----
for (let seed = 1; seed <= 12; seed++) {
  const lv = []; for (let t = 0; t < TUBE_MAX; t += 0.01) lv.push(tubeLevel(t, seed));
  let flips = 0; for (let i = 1; i < lv.length; i++) if ((lv[i] > 0.3) !== (lv[i - 1] > 0.3)) flips++;
  if (flips < 2 || tubeLevel(TUBE_MAX, seed) !== 1 || tubeLevel(-0.1, seed) !== 0) check('tube ' + seed + ' flickers then settles', false, { flips });
}
check('the tubes flicker on and settle', true);
check('the same seed flickers the same way', tubeLevel(0.3, 4) === tubeLevel(0.3, 4));

// ---- walking along ----
const L = lightsNew(10);
let t = 10;
const run = (to, x, inShop = true) => { let out; for (; t < to; t += 1 / 60) out = lightsStep(L, t, x, inShop); return out; };
run(10 + LIGHT_WAIT - 0.05, 34);
check('dark for the first 2 s', L.on.every(v => v < 0));
check('everywhere', shopDark(L, 64, t) === 1 && shopDark(L, 400, t) === 1);
run(12.5, 34);
check('then the teleporter', L.on[0] === 12 && L.on[1] < 0, L.on);
run(14, 34);
check('lit where they stand, not past them', shopDark(L, 64, t) === 0 && shopDark(L, 300, t) === 1);
check('standing on the pad lights nothing more', L.on[1] < 0);
run(14.5, FIRST_TRIGGER + 2);
check('walk off the pad: the next stretch of hall', L.on[1] >= 0 && L.on[2] < 0, L.on);
run(15, LIGHT_X[1]);
check('at its middle: the next', L.on[2] >= 0 && L.on[3] < 0, L.on);
// running far ahead still lights them one at a time
const before = L.on.filter(v => v >= 0).length;
run(15 + 1 / 60 * 3, LIGHT_X[5]);
check('one section at a time, however fast you go', L.on.filter(v => v >= 0).length <= before + 1, L.on);
run(18, LIGHT_X[PI]);
check('on up to the perk machine', L.on[PI] >= 0, L.on);
let done = false;
for (; t < 40 && !done; t += 1 / 60) done = lightsStep(L, t, LIGHT_X[PI], true).done;
check('the rest of the hall comes on by itself, and it’s done', done && L.on.every(v => v >= 0), L.on);
// leaving the shop lights the rest too
{
  const M = lightsNew(0); let d = false, u = 0;
  for (; u < 2.5; u += 1 / 60) lightsStep(M, u, 34, true);
  for (; u < 20 && !d; u += 1 / 60) d = lightsStep(M, u, 34, false).done;
  check('fly out of the shop: the rest comes on', d, M.on);
}

// ---- the guide holds the hall (world/guide.js) ----
{
  const M = lightsNew(0); let u = 0;
  for (; u < 6; u += 1 / 60) lightsStep(M, u, LIGHT_X[4], true, 2);
  check('while the guide is to come, nothing past its section lights, however far you go', M.on[0] >= 0 && M.on[1] >= 0 && M.on.slice(2).every(v => v < 0), M.on);
  const lit = lightNear(M, LIGHT_X[2] + 20, u);
  check('it jumps out: the section where it stands snaps on', lit.includes(2) && M.on[2] === u, { lit, on: M.on });
  for (; u < 12; u += 1 / 60) lightsStep(M, u, LIGHT_X[4], true, M.on.indexOf(-1));
  check('and nothing more while it talks', M.on.slice(lit[lit.length - 1] + 1).every(v => v < 0), M.on);
  for (; u < 16; u += 1 / 60) lightsStep(M, u, LIGHT_X[4], true, Infinity);
  check('once it has gone the hall lights on as you go', M.on[4] >= 0, M.on);
}

// ---- gold spilled from a kill or a dig waits before it can be taken ----
const coins = [];
spillGold(coins, 100, 100, 37);
check('spilled gold waits ' + SPILL_WAIT + ' s before it flies to you', coins.length > 0 && coins.every(c => c.nopull === SPILL_WAIT && SPILL_WAIT === 0.25), coins.map(c => c.nopull));
check('the pickup loop honours the wait', /if \(d < pull && !W\.p\.dead && !\(g\.nopull > 0\)\)/.test(G.source));

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
