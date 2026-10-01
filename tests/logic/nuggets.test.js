// Gold nuggets (world/nuggets.js): a drop splits into big, medium and small nuggets that add up to
// it exactly; loose nuggets fall onto the rock, roll down a slope, stop on the flat, and push each
// other apart so a heap never sits in one spot.
const { splitGold, spillGold, stepNugget, collideNuggets, nugR, NUGGETS, NUG_CAP } = require('../load');

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const sum = a => a.reduce((s, v) => s + v, 0);

// ---- the split ----
let exact = true, sizes = new Set(), capped = true;
for (let amt = 0; amt <= 400; amt++) for (let k = 0; k < 6; k++) {
  const s = splitGold(amt);
  if (sum(s) !== amt) exact = false;
  if (s.length > NUG_CAP) capped = false;
  if (amt >= 30) s.forEach(v => sizes.add(nugR(v)));
}
check('every split adds up to the drop exactly', exact);
check('never more than NUG_CAP nuggets', capped);
check('three sizes turn up', sizes.size === 3, [...sizes]);
const mixes = new Set();
for (let k = 0; k < 40; k++) mixes.add(splitGold(57).join(','));
check('the same drop splits differently from time to time', mixes.size > 1, [...mixes]);
check('a big drop is mostly big nuggets', splitGold(300).filter(v => v >= NUGGETS[0].v).length >= 10, splitGold(300));
check('a huge drop still adds up', sum(splitGold(100000)) === 100000);
const list = [];
spillGold(list, 50, 50, 83);
check('spillGold puts the whole amount in the list', sum(list.map(c => c.amount)) === 83, list.length);

// ---- the physics: a flat floor at y = 200, and a 45° slope rising to the right from x = 100 ----
const flat = (x, y) => y >= 200;
const slope = (x, y) => y >= 200 || (x > 100 && y >= 200 - (x - 100));
const run = (coins, solid, secs) => { for (let f = 0; f < secs * 60; f++) { for (const c of coins) stepNugget(c, 1 / 60, solid); collideNuggets(coins, solid); } };

let c = { x: 50, y: 100, amount: 1, t: 1 };
run([c], flat, 3);
check('a nugget falls and rests on the floor', Math.abs(c.y + nugR(1) - 200) <= 1.5 && c.ground, c);
check('and stops there', Math.abs(c.vx || 0) < 0.5, c);

c = { x: 160, y: 120, amount: 5, t: 1 };
run([c], slope, 4);
check('on a slope it rolls down to the flat', c.x < 104 && c.y > 190, { x: c.x, y: c.y });
check('and it turned as it rolled', Math.abs(c.a) > 1, c.a);

const heap = [];
for (let k = 0; k < 30; k++) heap.push({ x: 60 + (k % 3) * 0.1, y: 150 - k * 0.2, amount: [1, 5, 25][k % 3], t: k * 0.37 });
run(heap, flat, 6);
let worst = 0;
for (let i = 0; i < heap.length; i++) for (let j = i + 1; j < heap.length; j++) {
  const a = heap[i], b = heap[j], d = Math.hypot(a.x - b.x, a.y - b.y), min = nugR(a.amount) + nugR(b.amount);
  worst = Math.max(worst, (min - d) / min);
}
check('thirty dropped on one spot spread out (overlap under 25%)', worst < 0.25, worst);
const xs = heap.map(h => h.x);
check('they spread sideways', Math.max(...xs) - Math.min(...xs) > 40, Math.max(...xs) - Math.min(...xs));
check('none fell through the floor', heap.every(h => h.y < 200), Math.max(...heap.map(h => h.y)));

console.log(fails ? `\n${fails} failed` : '\nall good');
process.exit(fails ? 1 : 0);
