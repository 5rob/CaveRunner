// Where the shop puts its stock.
//
// Only the heal is on a plinth now (mods come from the vending machine in the middle of the
// room, game/systems/shops.js): it sits beside the portal you arrive through, and not under
// your feet the moment you spawn — which would open a card before you had moved.
const g = require('../load');
const { makeLevel, CELL, CW, WW, SHOP_TOP, SHOP_FLOOR } = g;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// the heal, for a spread of seeds and floors
const levels = [];
for (let seed = 1; seed <= 8; seed++) {
  for (const floor of [1, 2, 3, 8]) levels.push({ seed, floor, lv: makeLevel(seed * 7919 + floor, floor) });
}
const shopOf = ({ floor, lv }) => {
  const heal = lv.stock.find(s => s.kind === 'heal');
  return { floor, lv, heal };
};
const shops = levels.map(shopOf);

// ---- the heal ----
// v0.0.141: it moved down the hall with the machines (the guide hologram's hall is between)
check('the heal stands down the hall, past the empty stretch from the way in',
  shops.every(s => s.heal.x - s.lv.arrival.x > 400),
  shops.map(s => Math.round(s.heal.x - s.lv.arrival.x)).filter(d => d <= 400));
check('and you do not spawn standing on it',
  shops.every(s => s.heal.x - s.lv.start.x > 60),
  shops.map(s => Math.round(s.heal.x - s.lv.start.x)).filter(d => d <= 60));
// ---- and they are all still where the room can reach them ----
check('every plinth is inside the shop room, on its floor',
  shops.every(s => s.lv.stock.every(i =>
    i.x > 3 * CELL && i.x < WW - 3 * CELL && i.y / CELL > SHOP_TOP && i.y / CELL < SHOP_FLOOR)),
  shops.map(s => s.lv.stock.filter(i => !(i.x > 3 * CELL && i.x < WW - 3 * CELL)).length).find(n => n));
check('the heal is free', shops.every(s => s.heal.price === 0 && s.heal.sold === false));

// ---- the shop floor can't be dug (v109): bedrock all the way across ----
{
  const lv = makeLevel(5, 1, []);
  let bad = 0;
  for (let y = SHOP_FLOOR; y < SHOP_FLOOR + 4; y++) for (let x = 0; x < CW; x++) if (lv.mat[y * CW + x] !== g.BED) bad++;
  check('the shop floor is bedrock', bad === 0, bad);
}

// ---- the level vending machines (v106): way in, heal, buy, sell, left to right, with room ----
// a machine's screen is 72 wide: at least 16 of clear wall either side of each
const { VEND_BUY_X, VEND_SELL_X } = g;
check('the machines come after the way in and the heal, buy then sell',
  shops.every(s => s.lv.arrival.x < s.heal.x && s.heal.x < VEND_BUY_X && VEND_BUY_X < VEND_SELL_X),
  { heal: shops[0].heal.x, buy: VEND_BUY_X, sell: VEND_SELL_X });
check('with space between each',
  shops.every(s => VEND_BUY_X - 36 - (s.heal.x + 13) >= 16 && VEND_SELL_X - VEND_BUY_X - 72 >= 16),
  { healEdge: shops[0].heal.x + 13, buy: VEND_BUY_X, sell: VEND_SELL_X });

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);