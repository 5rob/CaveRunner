// CaveRunner Auto stage 10b (src/auto/payout.js): the machines pay out. machinePay (how many are due, the change);
// machineItem's picks (seeded: the gun at the tier's level, an exo mod of the tier, a mod, a named perk); in a hub scene,
// a machine paid in full shakes for PAY_CYCLE, then its item flies to player 1 and into the bag (S.hub.take), the change
// left in H.paid (= the run's run.paid); the bag full, it waits on the floor until there's room.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

const gp = G.hubPrice('gun', 1).n, ep = G.hubPrice('exo', 2).n;
let r = G.machinePay({ paid: { gun: gp - 1 } }, 'gun', 1);
check('machinePay: short of the price, nothing due, all kept', r.n === 0 && r.left === gp - 1 && r.price === gp, r);
r = G.machinePay({ paid: { gun: gp * 2 + 7 } }, 'gun', 1);
check('machinePay: two prices and the change', r.n === 2 && r.left === 7, r);
r = G.machinePay({ paid: { exo: ep } }, 'exo', 2);
check('machinePay: the exo machine at its tier\'s price, exactly: one, no change', r.n === 1 && r.left === 0, r);
r = G.machinePay({ paid: { mod: 3, perk: 1 } }, 'mod', 1);
check('machinePay: the mod machine, 1 red each', r.n === 3 && r.left === 0, r);
check('machinePay: nothing paid, nothing due', G.machinePay({}, 'perk', 1).n === 0);

const rng = s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
const gun = G.machineItem('gun', 3, rng(7));
check('the gun machine: a gun', gun && gun.kind === 'gun' && !!gun.gun && gun.n === 1, gun && gun.kind);
const exo = G.machineItem('exo', 2, rng(7));
check('the exo machine: an exo mod of the tier, a real category', exo && exo.kind === 'exo' && exo.tier === 2 && G.EXO_CATS.includes(exo.cat), exo);
const mod = G.machineItem('mod', 1, rng(7));
check('the mod machine: a real mod', mod && mod.kind === 'mod' && !!G.MODS[mod.id], mod);
const perks = new Set();
for (let s = 1; s < 60; s++) { const p = G.machineItem('perk', 1, rng(s * 7919)); perks.add(p.id); }
check('the perk machine: named perks only (no stat perks), several', [...perks].every(id => G.PERKS[id] && !G.PERKS[id].stat) && perks.size > 3, [...perks]);
check('same seed, same item', JSON.stringify(G.machineItem('mod', 2, rng(9))) === JSON.stringify(G.machineItem('mod', 2, rng(9))));

// in a hub scene: paid in full → shakes, then the item into the bag
const run = (S, s) => { for (let i = 0; i < s * 30; i++) G.titleStep(S, 1 / 30); };
const paid = { gun: gp + 5 };
const S = G.hubScene(190, 101, 1, 1, paid), H = G.hubState(S);
const bag = [];
let room = true;
S.hub.fits = () => room;
S.hub.take = (_S, it) => { if (!room) return false; bag.push(it); return true; };
run(S, 0.5);
check('paid in full: the gun machine starts paying out (shaking)', H.vend.gun >= 0 && paid.gun === gp + 5, { vend: H.vend, paid });
run(S, G.PAY_CYCLE);
check('after PAY_CYCLE: the price comes off the run\'s paid, the change stays', H.paid === paid && paid.gun === 5 && H.vend.gun === -1, paid);
check('the gun is out (S.loot), flying', S.loot && S.loot.length === 1 && S.loot[0].it.kind === 'gun', S.loot && S.loot.length);
run(S, 3);
check('the gun flew into the bag', bag.length === 1 && bag[0].kind === 'gun' && S.loot.length === 0, bag.length);

// the bag full: it waits on the floor until there's room
room = false;
paid.mod = 1;
run(S, G.PAY_CYCLE + 3);
check('bag full: the mod waits on the floor', S.loot.length === 1 && S.loot[0].wait && bag.length === 1, S.loot.length);
room = true;
run(S, 3);
check('room again: it comes in', S.loot.length === 0 && bag.length === 2 && bag[1].kind === 'mod', bag.length);
check('paid out: the mod machine back to nothing', paid.mod === 0);

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
