// The modifier rule (owner, v0.0.149): a modifier lands only on the NEXT spell drawn after
// it (the next one that takes a cast slot). Several in a row all land on that one spell.
const G = require('../load');

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++; console.log(`FAIL ${n}` + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
const mk = (slots, over) => G.resetGun(Object.assign({ name: 'T', cap: slots.length,
  castDelay: 0.12, recharge: 0.4, manaMax: 9999, manaRegen: 60, spread: 0,
  multi: 1, shuffle: false, mana: 9999, speedMul: 1, slots }, over || {}));
const bare = G.planCast(mk(['bolt'])).shots[0].dmg;
const one = G.planCast(mk(['dmg_up', 'bolt'])).shots[0].dmg;
const two = G.planCast(mk(['dmg_up', 'dmg_up', 'bolt'])).shots[0].dmg;
ok('one Damage Plus raises a bolt', one > bare, { bare, one });
ok('two stack on it', two > one, { one, two });

// [mod][A][B] in one pull: only A
let p = G.planCast(mk(['double', 'dmg_up', 'bolt', 'bolt']));
ok('double gathers two', p.shots.length === 2, p.shots.length);
ok('[mod][A][B]: A modified', p.shots[0].dmg === one, p.shots.map(s => s.dmg));
ok('[mod][A][B]: B bare', p.shots[1].dmg === bare, p.shots.map(s => s.dmg));

// [mod][mod][A][B]: both on A
p = G.planCast(mk(['double', 'dmg_up', 'dmg_up', 'bolt', 'bolt']));
ok('[mod][mod][A][B]: both on A', p.shots[0].dmg === two, p.shots.map(s => s.dmg));
ok('[mod][mod][A][B]: B bare', p.shots[1].dmg === bare, p.shots.map(s => s.dmg));

// multicast: each modifier goes to the spell right after it
p = G.planCast(mk(['triple', 'dmg_up', 'bolt', 'bolt', 'dmg_up', 'dmg_up', 'bolt'].filter(id => G.MODS[id])));
if (G.MODS.triple) {
  ok('triple: three shots', p.shots.length === 3, p.shots.length);
  ok('triple: first +1', p.shots[0].dmg === one, p.shots.map(s => s.dmg));
  ok('triple: middle bare', p.shots[1].dmg === bare, p.shots.map(s => s.dmg));
  ok('triple: last +2', p.shots[2].dmg === two, p.shots.map(s => s.dmg));
}

// a modifier at the end with nothing after it in the pull is wasted, not carried
const g = mk(['bolt', 'dmg_up']);
const first = G.planCast(g);
ok('trailing mod: the bolt before it is bare', first.shots[0].dmg === bare, first.shots[0].dmg);

// separate pulls: a modifier never reaches the next pull's spell
const g2 = mk(['dmg_up', 'bolt', 'bolt']);
const a = G.planCast(g2), b = G.planCast(g2);
ok('pull 1 modified', a.shots[0].dmg === one, a.shots[0].dmg);
ok('pull 2 bare', b.shots[0].dmg === bare, b.shots[0].dmg);

// trigger payloads: a modifier inside the payload hits only the payload's next spell
p = G.planCast(mk(['addtrig', 'bolt', 'double', 'dmg_up', 'bolt', 'bolt']));
const pl = p.shots[0].payload || [];
ok('carrier carries two', pl.length === 2, pl.length);
ok('carrier itself bare of dmg_up', p.shots[0].dmg === bare, p.shots[0].dmg);
ok('payload: first modified', pl[0] && pl[0].dmg === one, pl.map(s => s.dmg));
ok('payload: second bare', pl[1] && pl[1].dmg === bare, pl.map(s => s.dmg));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
