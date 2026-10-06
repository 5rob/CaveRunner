// The Mini-map perk's pure parts (ui/minimap.js): the perk, the box over the gun buttons, the zoom
// steps, the world → box transform and a pin off the box sticking to its edge
const G = require('../load');
const { perkBag, PERKS, deckLayout, miniBox, miniScale, miniAt, edgeClamp, MINI_PAD, MINI_ZOOMS } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

check('a perk: Mini-map', !!PERKS.minimap && !PERKS.minimap.stat);
check('the bag carries it', perkBag(['minimap']).minimap === 1 && perkBag([]).minimap === 0);

const deck = deckLayout(412, 150, 4);
const B = miniBox(deck, -300);
const xs = deck.guns.map(g => g.x), top = Math.min(...deck.guns.map(g => g.y)) - deck.btn / 2;
check('the box spans the gun buttons', Math.abs(B.left - (Math.min(...xs) - deck.btn / 2)) < 1 && Math.abs(B.left + B.width - (Math.max(...xs) + deck.btn / 2)) < 1, B);
check('its bottom MINI_PAD above them', Math.abs(B.top + B.height - (top - MINI_PAD)) < 1, B);
check('its top where asked', B.top === -300);

check('zooms: 1, ×2, ×4', MINI_ZOOMS.join() === '1,2,4');
const k0 = miniScale(200, 400, 0), k1 = miniScale(200, 400, 1), k2 = miniScale(200, 400, 2);
check('each step out halves the scale', Math.abs(k0 / k1 - 2) < 1e-9 && Math.abs(k1 / k2 - 2) < 1e-9);
check('zoom 1 shows a little more than the game view', 200 / k0 > 400 && 200 / k0 < 400 * 1.6, 200 / k0);
check('the step wraps (a fourth tap is zoom 1)', miniScale(200, 400, 3) === k0);

const me = miniAt(100, 200, 100, 200, k0, 200, 300);
check('you are in the middle', me.x === 100 && me.y === 150);
const p = miniAt(150, 180, 100, 200, 0.5, 200, 300);
check('a point 50 right, 20 up, at 0.5 px a unit', p.x === 125 && p.y === 140, p);

const inside = edgeClamp(30, 40, 200, 300, 9);
check('a point in the box stays put', !inside.out && inside.x === 30 && inside.y === 40);
const below = edgeClamp(100, 5000, 200, 300, 9);
check('one far below sits on the bottom edge, straight down', below.out && below.x === 100 && below.y === 291, below);
const right = edgeClamp(2000, 150, 200, 300, 9);
check('one far right sits on the right edge', right.out && right.x === 191 && right.y === 150, right);
const diag = edgeClamp(-1000, -1000, 200, 300, 9);
check('one up-left hits the edge it reaches first, on the line to it', diag.out && Math.abs(diag.x - 9) < 1e-9 && diag.y > 9 && diag.y < 150 &&
  Math.abs((diag.y - 150) / (diag.x - 100) - (-1150) / (-1100)) < 1e-9, diag);
check('the map still has spread (moved to minimap.js)', typeof G.spread === 'function' && G.MAP_SPREAD === 2);
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
