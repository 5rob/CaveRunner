// Level 2 stage 6: floor 2's loot (world/loot.js). Across seeds: no creatures outside the zones; about
// half the usual enemy count of loot spots, each outside the zones and their fringe, on the ground, with
// the gold its creature would drop; ~floor 1's red crystals among them, no green; one prize per zone at
// its chamber, of an allowed kind and amount; same seed, same loot; floors 1 and 3 untouched.
const G = require('../load');
const { makeLevel, rollPrize, PRIZES, enemyFor, DEV, CW, CH, CELL, GUN_DROPS, MOD_DROPS } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const usual = Math.min(Math.max(136, DEV.enemies), DEV.enemies + DEV.enemiesUp);
const cell = (lv, x, y) => Math.floor(y / CELL) * CW + Math.floor(x / CELL);
// on the ground: open where it is, rock within a few px below
const grounded = (lv, x, y, r) => {
  if (lv.mat[cell(lv, x, y)]) return false;
  for (let d = 0; d <= r + 6; d += 1) if (lv.mat[cell(lv, x, y + d)]) return true;
  return false;
};
const SEEDS = [1, 2, 3, 5, 7, 11];
let bad = [], spotsN = [], reds = [], kinds = { gold: 0, red: 0, green: 0 };
for (const seed of SEEDS) {
  const lv = makeLevel(seed, 2), m = lv.darkMask, sh = lv.darkShade;
  if (!m || !lv.dark.length) { bad.push([seed, 'no zones']); continue; }
  const outside = q => !sh[cell(lv, q.x, q.y - 3)];
  const nearPrize = q => lv.dark.some(z => z.prize && Math.hypot(q.x - z.prize.x, q.y - z.prize.y) < z.chamber.rx * CELL + 40);
  // no creatures outside the zones but the aliens' black strays (stage 7b)
  if (lv.enemies.some(e => !(e.al && e.al.black) && !m[cell(lv, e.x, e.y)]))   // (the black strays live outside)
    bad.push([seed, 'creature outside']);
  const spots = lv.tomb.loot;
  spotsN.push(spots.length);
  for (const s of spots) if (!outside(s) || !lv.mat[cell(lv, s.x, s.y + 1)] || lv.mat[cell(lv, s.x, s.y - 2)]) bad.push([seed, 'spot', s]);
  // each spot's gold: what one of the roster's creatures drops (its gold + 0..2)
  const golds = lv.roster.map(id => enemyFor(id, 2).gold);
  for (const s of spots) if (s.gold < Math.min(...golds) || s.gold > Math.max(...golds) + 2) bad.push([seed, 'gold', s.gold]);
  // the nuggets outside the prizes add up to the spots' gold, and lie on the ground outside the zones
  const loose = lv.coins.filter(c => !nearPrize(c));
  const sum = loose.reduce((a, c) => a + c.amount, 0), want = spots.reduce((a, s) => a + s.gold, 0);
  if (sum !== want) bad.push([seed, 'gold sum', sum, want]);
  for (const c of loose) if (!outside(c) || !grounded(lv, c.x, c.y, 30)) { bad.push([seed, 'nugget', Math.round(c.x), Math.round(c.y)]); break; }
  // red crystals in the wasteland, none green
  const wild = lv.pickups.filter(q => !nearPrize(q));
  reds.push(wild.filter(q => !q.green).length);
  if (wild.some(q => q.green)) bad.push([seed, 'green outside']);
  for (const q of wild) if (!outside(q) || !grounded(lv, q.x, q.y, 9)) bad.push([seed, 'crystal', q.x, q.y]);
  // each zone: one prize, allowed, at its chamber, on its floor
  for (const z of lv.dark) {
    const p = z.prize;
    if (!p || !PRIZES[p.kind] || p.n < PRIZES[p.kind][0] || p.n > PRIZES[p.kind][1]) { bad.push([seed, 'prize', p]); continue; }
    kinds[p.kind]++;
    if (Math.abs(p.x / CELL - z.chamber.x) > 2 || m[cell(lv, p.x, p.y - 2)] !== z.id + 1 || !lv.mat[cell(lv, p.x, p.y + 1)]) bad.push([seed, 'prize place', p]);
    const near = q => Math.hypot(q.x - p.x, q.y - p.y) < z.chamber.rx * CELL + 40;
    if (p.kind === 'gold') { const g = lv.coins.filter(near).reduce((a, c) => a + c.amount, 0); if (g !== p.n) bad.push([seed, 'stash', g, p.n]); }
    else { const c = lv.pickups.filter(near); if (c.length !== p.n || c.some(q => !!q.green !== (p.kind === 'green'))) bad.push([seed, 'crystals', c.length, p]); }
  }
  // same seed, same loot
  const again = makeLevel(seed, 2);
  if (JSON.stringify([again.coins, again.pickups, again.dark.map(z => z.prize)]) !== JSON.stringify([lv.coins, lv.pickups, lv.dark.map(z => z.prize)])) bad.push([seed, 'not the same']);
}
check('no creatures outside the zones; every spot, nugget, crystal and prize where it should be', !bad.length, bad.slice(0, 6));
check('about half the usual enemy count of loot spots', spotsN.every(n => n >= usual / 2 * 0.8 && n <= Math.round(usual / 2)), { spotsN, half: usual / 2 });
check('about floor 1\'s red crystals in the wasteland', reds.every(n => n === GUN_DROPS + MOD_DROPS), reds);
// the roll covers every kind and amount
const rolls = { gold: new Set(), red: new Set(), green: new Set() };
for (let i = 0; i < 300; i++) { const p = rollPrize(i / 300, (i * 0.618) % 1); rolls[p.kind].add(p.n); }
check('the prize roll: all three kinds, every crystal count, gold 1000–2000',
  rolls.red.size === 3 && rolls.green.size === 3 && Math.min(...rolls.gold) >= 1000 && Math.max(...rolls.gold) <= 2000, { red: [...rolls.red], green: [...rolls.green] });
check('rollPrize at the ends', JSON.stringify([rollPrize(0, 0), rollPrize(0.99, 0.999), rollPrize(0.5, 1)]) === JSON.stringify([{ kind: 'gold', n: 1000 }, { kind: 'green', n: 3 }, { kind: 'red', n: 6 }]));
console.log('prize kinds over the seeds', JSON.stringify(kinds));
// floors 1 and 3: no ground gold, their creatures as ever
const f1 = makeLevel(3, 1), f3 = makeLevel(3, 3);
// owner, round 2: at least one zone's prize is green crystals; the gold in a mix of all three sizes
const greens = SEEDS.map(seed => makeLevel(seed, 2)).filter(lv => lv.dark.length);
check('every floor with zones has a green crystal prize', greens.every(lv => lv.dark.some(z => z.prize && z.prize.kind === 'green')), greens.map(lv => lv.dark.map(z => z.prize && z.prize.kind)));
const sizes = new Set(greens[0].coins.map(c => c.sz));
check('the gold lies in all three nugget sizes', sizes.has(0) && sizes.has(1) && sizes.has(2), [...sizes]);
check('floors 1 and 3: no loot gold, creatures still there', f1.coins.length === 0 && f3.coins.length === 0 && f1.enemies.length > 50 && f3.enemies.length > 50);
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
