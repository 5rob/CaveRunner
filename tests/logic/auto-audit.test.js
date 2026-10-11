// CaveRunner Auto, the owner's item audit (v1.0.35, docs/auto-item-audit.html): what they binned is never handed
// out, the trigger variants are gone and the three Add Trigger mods are level-one common drops, Wand Refresh skips
// the recharge, Hair Trigger and Quick Recharge shorten it, Glass Cannon multiplies a player's damage, the
// trajectory mods are purple, Small Teleport Bolt hops 0.75 as far, Carrot is out of the exo machine.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const BIN_MODS = ['digbolt', 'glance', 'tele', 'eater', 'followaim', 'aimassist', 'farcast', 'sawstorm'];
const BIN_PERKS = ['eye', 'eradar', 'minimap', 'iradar', 'tinker', 'wradar', 'sight', 'fireimm'];

check('binned mods: kept (old saves) but never handed out', BIN_MODS.every(id => G.MODS[id] && G.MODS[id].off && !G.ALL_IDS.includes(id)));
check('trigger variants: all off', G.TRIG_VARIANTS.every(([id]) => G.MODS[id].off && !G.ALL_IDS.includes(id)));
{
  const seen = {};
  for (let fl = 1; fl <= 12; fl++) for (let i = 0; i < 400; i++) seen[G.rollMod(rnd, fl)] = 1;
  check('rollMod: no binned mod or variant on any floor', !BIN_MODS.some(id => seen[id]) && !G.TRIG_VARIANTS.some(([id]) => seen[id]));
  const trig = ['addtrig', 'addtimer', 'adddeath'];
  check('Add Trigger / Timer / Expiration: tier 1, and they drop on floor 1', trig.every(id => G.tierOf(id) === 1 && G.modWeight(id, 1) >= 1), trig.map(id => G.modWeight(id, 1)));
  let n = 0;
  for (let i = 0; i < 2000; i++) if (trig.includes(G.rollMod(rnd, 1))) n++;
  check('…common: over 5% of floor-1 drops', n > 100, n);
}
check('binned perks and Fire Immunity: never handed out', BIN_PERKS.every(id => G.PERKS[id] && G.PERKS[id].off));
{
  const got = new Set();
  for (let i = 0; i < 600; i++) got.add(G.machineItem('perk', 1, rnd).id);
  check('the perk machine never gives one', !BIN_PERKS.some(id => got.has(id)), [...got]);
}
check('Carrot: out of the exo categories', !G.EXO_CATS.includes('carrot') && G.EXO_CATS.length === 3, G.EXO_CATS);
check('trajectory mods purple (Gravity, Anti-Gravity, Horizontal Path)', ['gravmod', 'float', 'flat'].every(id => G.famCol(id) === G.FAMILIES.path.col && G.MODS[id].col === '#b57cff'));
check('Small Teleport Bolt: 0.75 of its old hop', Math.abs(G.MODS.teleshort.life * G.MODS.teleshort.speed - 0.13 * 1100 * 0.75) < 1e-6);

// ---- recharge ----
const gun = slots => { const g = G.makeGun(() => 0.5, 1); g.slots = slots.slice(); g.cap = slots.length; g.shuffle = false; g.order = null; g.idx = 0; g.recharge = 0.6; return g; };
{
  const base = G.effRecharge(gun(['bolt', null, null]));
  check('Hair Trigger shortens the recharge', G.effRecharge(gun(['trigger', 'bolt', null])) < base - 0.1, [base, G.effRecharge(gun(['trigger', 'bolt', null]))]);
  check('Quick Recharge shortens the recharge', G.effRecharge(gun(['recharge', 'bolt', null])) < base - 0.3, G.effRecharge(gun(['recharge', 'bolt', null])));
  // through the scene's gun: the list runs out → the recharge clock
  // pull until the list runs out (the cast delays waited out; mana kept full)
  const pullAll = g => {
    for (let i = 0; i < 20; i++) { g.delayT = 0; g.rechT = 0; g.mana = 999; G.gunPull(g, []); if (g.idx === 0) break; }
    return g.rechT || 0;
  };
  const a = gun(['bolt', 'bolt']), b = gun(['bolt', 'refresh', 'bolt']);
  check('the scene gun: a plain list recharges when it runs out', pullAll(a) > 0.3, a.rechT);
  check('Wand Refresh: that recharge is skipped', pullAll(b) === 0, b.rechT);
  b.slots = ['bolt', 'bolt', 'bolt']; pullAll(b);
  check('…only once (the next run-out recharges again)', b.rechT > 0.3, b.rechT);
}

// ---- Glass Cannon ----
{
  const run = G.newRun(3), pl = run.players[0];
  check('no perks: damage x1', G.perkDmg(pl) === 1);
  pl.perks[0] = { kind: 'perk', id: 'glass', n: 1 };
  check('Glass Cannon: damage x2.5', G.perkDmg(pl) === 2.5);
  pl.perks[1] = { kind: 'perk', id: 'glass', n: 1 };
  check('…twice still x2.5 (each perk once)', G.perkDmg(pl) === 2.5);
}

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all passed');
