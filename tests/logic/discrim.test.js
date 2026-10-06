// Discriminate (LIST3 #11): the mod, a copy's target as its own id (spells/discrim.js), the Bag's
// stacks keeping targets apart, the save keeping a target, planCast handing it to the next spell only,
// and matchesTarget.
const G = require('../load');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++; console.log(`FAIL ${n}` + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
const mk = slots => G.resetGun({ name: 'T', cap: slots.length, castDelay: 0.12, recharge: 0.4, manaMax: 9999, manaRegen: 60,
  spread: 0, multi: 1, shuffle: false, mana: 9999, speedMul: 1, slots });

// the mod
const m = G.MODS.discrim;
ok('discrim is a modifier', m && m.kind === 'mod', m && m.kind);
ok('it has a price, family, tier and Noita twin', G.MOD_PRICE.discrim > 0 && G.FAMILY_OF.discrim && G.NOITA_OF.discrim && G.MOD_TIER.discrim);
ok('in ALL_IDS (it drops)', G.ALL_IDS.includes('discrim'));

// a target is its own id, made on demand
const bat = { kind: 'creature', id: 'hiisi' }, you = { kind: 'player', id: 'player' }, barrel = { kind: 'object', id: 'barrel' };
const idB = G.discrimId(bat), idY = G.discrimId(you), idO = G.discrimId(barrel);
ok('ids', idB === 'discrim:creature:hiisi' && idY === 'discrim:player:player' && idO === 'discrim:object:barrel', [idB, idY, idO]);
ok('registered with its target', G.MODS[idB] && G.MODS[idB].tgt.id === 'hiisi' && G.MODS[idB].base === 'discrim');
ok('a set copy never drops (off, not in ALL_IDS)', G.MODS[idB].off && !G.ALL_IDS.includes(idB));
ok('targetOf', G.targetOf(idB).id === 'hiisi' && G.targetOf('discrim') === null && G.targetOf('bolt') === null);
ok('ensureMod rebuilds a saved id', G.ensureMod('discrim:creature:lima') && G.MODS['discrim:creature:lima'].tgt.id === 'lima');
ok('ensureMod refuses junk', !G.ensureMod('discrim:nope:x') && !G.ensureMod('discrim:creature:') && !G.ensureMod('zzz') && !G.ensureMod(null));
ok('an icon for each', G.targetIcon(bat) && G.targetIcon(you) && G.targetIcon(barrel));
ok('names', G.targetName(bat) === 'Hiisi' && G.targetName(you) === 'You' && G.targetName(barrel) === 'Barrel', [G.targetName(bat), G.targetName(barrel)]);

// stacks: same target together, different targets (and unset) apart
const st = G.stackBag(['discrim', idB, 'discrim', idB, idY]);
ok('stackKey tells targets apart', G.stackKey(idB) !== G.stackKey(idY) && G.stackKey(idB) !== G.stackKey('discrim'));
ok('three stacks: unset ×2, hiisi ×2, you ×1', st.length === 3 && st[0].n === 2 && st[1].n === 2 && st[2].n === 1, st);

// matchesTarget
ok('matches its own', G.matchesTarget(bat, { kind: 'creature', id: 'hiisi' }));
ok('not another creature', !G.matchesTarget(bat, { kind: 'creature', id: 'lima' }));
ok('not you', !G.matchesTarget(bat, { kind: 'player', id: 'player' }));
ok('not an object with the same id', !G.matchesTarget({ kind: 'object', id: 'hiisi' }, { kind: 'creature', id: 'hiisi' }));
ok('no target matches anything', G.matchesTarget(null, { kind: 'creature', id: 'x' }));

// planCast: the next spell drawn gets the target, the one after it doesn't; unset does nothing
let p = G.planCast(Object.assign(mk(['double', idB, 'bolt', 'bolt'])));
ok('next spell carries the target', p.shots[0].only && p.shots[0].only.id === 'hiisi', p.shots[0].only);
ok('the spell after it is bare', p.shots[1].only === null, p.shots[1].only);
p = G.planCast(mk(['discrim', 'bolt']));
ok('an unset copy leaves the shot alone', p.shots[0].only === null);
ok('a bare bolt has no target', G.planCast(mk(['bolt'])).shots[0].only === null);

// the save keeps a target, on the gun and in the bag
const g = mk([idB, 'bolt']);
ok('a gun keeps its targeted copy', G.cleanGun(JSON.parse(JSON.stringify(g))).slots[0] === idB);
delete G.MODS['discrim:creature:kobold'];
const lo = G.cleanLoadout({ guns: [null, null, null, null], sel: 0, bag: ['discrim', 'discrim:creature:kobold', 'bolt'], gold: 0 });
ok('the bag keeps it (made on load)', lo.bag.includes('discrim:creature:kobold') && G.MODS['discrim:creature:kobold'], lo.bag);

console.log(`discrim: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
