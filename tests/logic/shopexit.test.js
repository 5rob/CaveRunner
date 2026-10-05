// v0.0.145: the way up out of the shop is always straight over the buy machine (owner: "so it's
// obvious to find"), on every floor and seed: the roof hole centred on VEND_BUY_X, and the only one.
const G = require('../load');
const { makeLevel, CW, CELL, SHOP_TOP, SHOP_ROOF, VEND_BUY_X } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const bad = [];
for (const floor of [1, 2, 3]) for (let seed = 1; seed <= 5; seed++) {
  const { mat, shopExit } = makeLevel(seed, floor);
  // the open columns through the roof
  const open = [];
  for (let cx = 0; cx < CW; cx++) {
    let o = true;
    for (let cy = SHOP_TOP - SHOP_ROOF; cy < SHOP_TOP; cy++) if (mat[cy * CW + cx]) { o = false; break; }
    if (o) open.push(cx);
  }
  const mid = open.length ? (open[0] + open[open.length - 1]) / 2 * CELL : -1;
  const one = open.length > 0 && open[open.length - 1] - open[0] === open.length - 1;
  if (shopExit * CELL !== VEND_BUY_X || !one || Math.abs(mid - VEND_BUY_X) > CELL) bad.push({ floor, seed, shopExit, mid, n: open.length });
}
check('every floor and seed: one hole in the roof, centred over the buy machine', bad.length === 0, bad);
process.exit(fails ? 1 : 0);
