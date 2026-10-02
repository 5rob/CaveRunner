// The stat perks (data/perks.js STAT_PERKS): five stats, five levels each, every level stronger and
// dearer than the one below; each fits only its own stat slot on the suit; the bag adds them up;
// a green crystal unlocks a level only after the one below it (perkRoll).
const G = require('../load');
const { PERKS, PERK_IDS, STAT_KEYS, STAT_PERKS, SUIT_SLOTS, SUIT_LEN, fitsSlot, perkBag, perkPrice, perkRoll } = G;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

check('six stats: max health, speed, fuel, recharge, gold vacuum, carrot', STAT_KEYS.join() === 'hp,walk,fuel,refuel,pull,carrot', STAT_KEYS);
check('suit: six general slots, then one per stat', SUIT_SLOTS === 6 && SUIT_LEN === 12);
for (const s of STAT_KEYS) {
  const ids = [1, 2, 3, 4, 5].map(t => 'st_' + s + t), f = STAT_PERKS[s].field;
  check(`${s}: five levels`, ids.every(id => PERKS[id] && PERKS[id].stat === s));
  const v = ids.map(id => perkBag([id])[f === 'hpAdd' ? 'maxHp' : f]);
  check(`${s}: each level stronger`, v.every((x, i) => i === 0 || x > v[i - 1]) && v[0] > (f === 'hpAdd' ? 100 : f === 'carrot' ? 0 : 1), v);
  const p = ids.map(perkPrice);
  check(`${s}: each level dearer`, p.every((x, i) => i === 0 || x > p[i - 1]), p);
  const slot = SUIT_SLOTS + STAT_KEYS.indexOf(s);
  check(`${s}: fits its own stat slot only`, ids.every(id => fitsSlot(id, slot) && !fitsSlot(id, 0) && STAT_KEYS.every((o, j) => o === s || !fitsSlot(id, SUIT_SLOTS + j))));
}
check('a general perk fits the general slots only', fitsSlot('shield', 0) && fitsSlot('shield', 5) && !fitsSlot('shield', 6));
const all = perkBag(['st_hp5', 'st_walk5', 'st_fuel5', 'st_refuel5', 'st_pull5']);
check('the bag adds them up', all.maxHp === 230 && all.walk === 1.5 && all.fuel === 2 && all.refuel === 2 && all.goldPull === 3, all);
// Carrot: the bag holds the level; each reach is its Dev min with none fitted, its max at V
const { carrotAt, DEV } = G;
check('carrot: the bag holds the level', perkBag([]).carrot === 0 && perkBag(['st_carrot3']).carrot === 3);
const ends = ['caCam', 'caTorch', 'caAggro', 'caAim'].every(k => carrotAt(k, 0) === DEV[k + 'Lo'] && carrotAt(k, 5) === DEV[k + 'Hi']
  && Math.abs(carrotAt(k, 2) - (DEV[k + 'Lo'] + 0.4 * (DEV[k + 'Hi'] - DEV[k + 'Lo']))) < 1e-9);
check('carrot: min at none, max at V, evenly between', ends);
check('carrot: the defaults stretch every reach', ['caCam', 'caTorch', 'caAggro', 'caAim'].every(k => DEV[k + 'Lo'] === 1 && DEV[k + 'Hi'] > 1));
const shot = { speed: 300, life: 10, bounce: 0 }, line = far => G.tracePath(shot, 0, 0, 1, 0, () => false, null, [], null, far).length;
check('carrot: a longer aim line', line(2) > line(1) * 1.8, [line(1), line(2)]);
check('a stat perk stacks with the old ones (Faster Movement)', Math.abs(perkBag(['st_walk1', 'move']).walk - 1.08 * 1.3) < 1e-9);

// unlocks climb a stat's levels in order
let s = 5;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const owned = [];
let order = true;
for (let i = 0; i < PERK_IDS.length; i++) {
  const id = perkRoll(rnd, owned);
  if (!id) break;
  const k = PERKS[id];
  if (k.tier > 1 && !owned.includes('st_' + k.stat + (k.tier - 1))) order = false;
  owned.push(id);
}
check('green crystals unlock a stat\'s levels in order', order);
check('and every perk in the end', owned.length === PERK_IDS.length && perkRoll(rnd, owned) === null, owned.length);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
process.exit(fails ? 1 : 0);
