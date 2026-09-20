// Where the shop puts its stock.
//
// v32 pulled the four things you come to buy into one row across the middle of the room,
// so you can read them all without walking the width of the shop, and left the free heal
// on its own beside the portal you arrive through. This proves the row is actually a row,
// that the heal is actually by the portal, and that neither of them lands under your feet
// the moment you spawn — which would open a card before you had moved.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const g = new Function('React', shim + upto +
  'return { makeLevel, isGunShop, CELL, CW, WW, CH, SHOP_TOP, SHOP_FLOOR, VIEW_W, PLAYER_HP };')(
  { createElement: () => {} });
const { makeLevel, isGunShop, CELL, CW, WW, SHOP_TOP, SHOP_FLOOR, VIEW_W } = g;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// the four and the heal, told apart, for a spread of seeds on both kinds of floor
const levels = [];
for (let seed = 1; seed <= 24; seed++) {
  for (const floor of [1, 2, 3, 8]) levels.push({ seed, floor, lv: makeLevel(seed * 7919 + floor, floor) });
}
const shopOf = ({ floor, lv }) => {
  const heal = lv.stock.find(s => s.kind === 'heal');
  const row = lv.stock.filter(s => s.kind !== 'heal');
  const xs = row.map(s => s.x).sort((a, b) => a - b);
  return { floor, lv, heal, row, xs, span: xs[xs.length - 1] - xs[0], gaps: xs.slice(1).map((x, i) => x - xs[i]) };
};
const shops = levels.map(shopOf);

// ---- the row ----
check('there is always one heal and four things to buy',
  shops.every(s => s.heal && s.row.length === 4),
  shops.find(s => !s.heal || s.row.length !== 4));
check('the heal is not one of the four', shops.every(s => !s.row.includes(s.heal)));
check('the row is one row', shops.every(s => new Set(s.row.map(i => i.y)).size === 1));
check('and it fits across one screen, so you can read all four at once',
  Math.max(...shops.map(s => s.span)) < VIEW_W,
  Math.max(...shops.map(s => s.span)));
check('the four never overlap each other',
  Math.min(...shops.flatMap(s => s.gaps)) > 30,
  Math.min(...shops.flatMap(s => s.gaps)));
check('they are evenly spaced, not bunched',
  shops.every(s => Math.max(...s.gaps) - Math.min(...s.gaps) < 1),
  shops.map(s => s.gaps).find(gp => Math.max(...gp) - Math.min(...gp) >= 1));
check('the row is centred on the room',
  shops.every(s => Math.abs((s.xs[0] + s.xs[s.xs.length - 1]) / 2 - WW / 2) < 1),
  shops.map(s => Math.round((s.xs[0] + s.xs[s.xs.length - 1]) / 2)));
// the same spot on every floor and every seed: the shop should feel like the same room
check('the row is in the same place on every floor',
  new Set(shops.map(s => s.xs.join())).size === 1, [...new Set(shops.map(s => s.xs.join()))]);
check('the row is well clear of where you spawn',
  Math.min(...shops.map(s => s.xs[0] - s.lv.start.x)) > 60,
  Math.min(...shops.map(s => s.xs[0] - s.lv.start.x)));

// ---- the heal ----
check('the heal sits by the portal you arrive through',
  shops.every(s => Math.abs(s.heal.x - s.lv.arrival.x) < 90),
  shops.map(s => Math.round(Math.abs(s.heal.x - s.lv.arrival.x))).filter(d => d >= 90));
check('and it is the near side of the room, not off with the row',
  shops.every(s => s.heal.x < s.xs[0]),
  shops.map(s => [Math.round(s.heal.x), Math.round(s.xs[0])]).filter(([hx, rx]) => hx >= rx));
check('it does not sit on the portal itself',
  shops.every(s => Math.abs(s.heal.x - s.lv.arrival.x) > 34),
  shops.map(s => Math.round(Math.abs(s.heal.x - s.lv.arrival.x))).filter(d => d <= 34));
check('and you do not spawn standing on it',
  shops.every(s => s.heal.x - s.lv.start.x > 60),
  shops.map(s => Math.round(s.heal.x - s.lv.start.x)).filter(d => d <= 60));
check('nor standing on any of the row',
  shops.every(s => s.row.every(i => Math.abs(i.x - s.lv.start.x) > 60)));

// ---- and they are all still where the room can reach them ----
check('every plinth is inside the shop room, on its floor',
  shops.every(s => s.lv.stock.every(i =>
    i.x > 3 * CELL && i.x < WW - 3 * CELL && i.y / CELL > SHOP_TOP && i.y / CELL < SHOP_FLOOR)),
  shops.map(s => s.lv.stock.filter(i => !(i.x > 3 * CELL && i.x < WW - 3 * CELL)).length).find(n => n));
check('the row is nowhere near the room walls',
  shops.every(s => s.xs[0] > 60 && s.xs[s.xs.length - 1] < WW - 60));

// ---- the stock itself still makes sense ----
check('a mod floor stocks four mods and a gun floor four guns',
  shops.every(s => isGunShop(s.floor)
    ? s.row.every(i => i.kind === 'gun' && i.price > 0)
    : s.row.every(i => i.kind === 'mod' && i.price > 0 && i.id)));
check('a gun floor stocks four separate guns, not one gun four times',
  shops.filter(s => isGunShop(s.floor)).every(s => new Set(s.row.map(i => i.gun)).size === 4));
check('a mod floor never rolls the same mod twice',
  shops.filter(s => !isGunShop(s.floor)).every(s => new Set(s.row.map(i => i.id)).size === 4));
// gun names are two word-lists crossed, so a repeat name is possible and always has been.
// It is only worth knowing how often, so a change that made it common would show up here.
const gunShops = shops.filter(s => isGunShop(s.floor));
const named = gunShops.filter(s => new Set(s.row.map(i => i.gun.name)).size === 4).length;
check('and usually four different names by luck of the roll',
  named / gunShops.length > 0.7, `${named}/${gunShops.length} shop rows have four distinct names`);
check('the heal is free', shops.every(s => s.heal.price === 0 && s.heal.sold === false));

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);