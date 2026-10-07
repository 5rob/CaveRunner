// Buffs and nerfs (owner, v0.0.155): every number of the NEXT mod drawn × 1.5 / 2 / 5 or × 0.75 / 0.5 / 0.2,
// whatever it is: a shot's own stats, a modifier's effect, another buff's ×. Whole-number stats round.
const G = require('../load');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++; console.log(`FAIL ${n}` + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const mk = (slots, over) => G.resetGun(Object.assign({ name: 'T', cap: slots.length,
  castDelay: 0.12, recharge: 0.4, manaMax: 9999, manaRegen: 60, spread: 0,
  multi: 1, shuffle: false, mana: 9999, speedMul: 1, slots }, over || {}));
const shot = slots => G.planCast(mk(slots)).shots[0];
const B = G.MODS.bolt;

ok('six of them, all modifiers', ['buff15', 'buff2', 'buff5', 'nerf75', 'nerf50', 'nerf20'].every(id => G.MODS[id] && G.MODS[id].kind === 'mod' && G.MODS[id].boost));
const bare = shot(['bolt']);
ok('Buff ×2: the bolt’s damage ×2', near(shot(['buff2', 'bolt']).dmg, bare.dmg * 2), shot(['buff2', 'bolt']).dmg);
ok('... and its speed and size', near(shot(['buff2', 'bolt']).speed, bare.speed * 2) && near(shot(['buff2', 'bolt']).size, bare.size * 2));
ok('Nerf ×0.5: half the damage', near(shot(['nerf50', 'bolt']).dmg, bare.dmg * 0.5));
ok('Buff ×5', near(shot(['buff5', 'bolt']).dmg, bare.dmg * 5));
ok('its mana too', near(G.planCast(mk(['buff2', 'bolt'])).cost, G.MODS.buff2.mana + B.mana * 2), G.planCast(mk(['buff2', 'bolt'])).cost);

// only the next mod: [buff][A][B] in a Double Cast, B bare
const p = G.planCast(mk(['double', 'buff2', 'bolt', 'bolt']));
ok('only the next one', p.shots.length === 2 && near(p.shots[0].dmg, bare.dmg * 2) && near(p.shots[1].dmg, bare.dmg), p.shots.map(s => s.dmg));

// a modifier's effect: Damage Plus adds 1.5, buffed ×2 adds 3
const plus = shot(['dmg_up', 'bolt']).dmg - bare.dmg;
ok('Buff ×2 on Damage Plus doubles what it adds', near(shot(['buff2', 'dmg_up', 'bolt']).dmg - bare.dmg, plus * 2), shot(['buff2', 'dmg_up', 'bolt']).dmg);
ok('... and the shot after the modifier isn’t buffed itself', near(shot(['buff2', 'dmg_up', 'bolt']).speed, bare.speed));

// a buff buffed: ×2 of a ×2 is ×4
ok('Buff ×2 then Buff ×2: ×4', near(shot(['buff2', 'buff2', 'bolt']).dmg, bare.dmg * 4), shot(['buff2', 'buff2', 'bolt']).dmg);
ok('Buff ×2 then Nerf ×0.5: even', near(shot(['buff2', 'nerf50', 'bolt']).dmg, bare.dmg));

// whole numbers round: Buckshot's pellets
const buck = shot(['buck']).count;
ok('pellets round, never to none', shot(['nerf20', 'buck']).count === Math.max(1, Math.round(buck * 0.2)) && shot(['buff15', 'buck']).count === Math.round(buck * 1.5), { buck, n20: shot(['nerf20', 'buck']).count });
// a Double Cast nerfed to nothing still fires its own spell
ok('a nerfed multicast still casts', G.planCast(mk(['nerf20', 'double', 'bolt', 'bolt'])).shots.length >= 1);
// a buff at the end of the pull is wasted (like a modifier)
ok('a trailing buff does nothing to the next pull', near(G.planCast(mk(['bolt', 'buff5'])).shots[0].dmg, bare.dmg));
ok('the table is untouched', G.MODS.bolt.dmg === B.dmg && !G.MODS.bolt.boosted);

console.log(fail ? `${fail} FAILED` : `${pass} passed, 0 failed`);
process.exit(fail ? 1 : 0);
