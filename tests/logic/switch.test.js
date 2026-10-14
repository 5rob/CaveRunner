// The Switches (owner v1.0.72; spells/cast.js planCast `sw`): Double / Triple / Quad Switch take turns between the next
// 2 / 3 / 4 mods (owner, after v1.0.82: single mods, not groups), one a pull, the others drawn past for free.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
/** @param {string[]} slots */
const gunOf = slots => G.resetGun({ name: 't', cap: slots.length, castDelay: 0.1, recharge: 0.3, manaMax: 9999, manaRegen: 0,
  spread: 0, multi: 1, shuffle: false, speedMul: 1, mana: 9999, slots: slots.slice() });
/** the spells each of n pulls casts @param {Gun} g @param {number} n */
const pulls = (g, n) => { const out = []; for (let i = 0; i < n; i++) { const p = G.planCast(g); out.push(p.defs.map(m => m.id || Object.keys(G.MODS).find(k => G.MODS[k] === m)).join('+')); if (p.wrap) g.idx = 0; } return out; };

for (const [id, n] of [['switch2', 2], ['switch3', 3], ['switch4', 4]]) check(id + ' is a pattern mod, ' + n + ' mods', G.MODS[id] && G.MODS[id].swN === n && G.FAMILY_OF[id] === 'pattern');

// a Double Switch over bolt and spark: bolt, spark, bolt, spark…
check('Double Switch alternates its two spells, one a pull', pulls(gunOf(['switch2', 'bolt', 'spark']), 4).join(' ') === 'bolt spark bolt spark', pulls(gunOf(['switch2', 'bolt', 'spark']), 4));
// (owner, after v1.0.82) it switches single mods, not groups: [switch2, homing, fast, bolt] → bolt with homing, then bolt with Fast Cast
{
  const g = gunOf(['switch2', 'homing', 'fast', 'bolt']);
  const a = G.planCast(g); g.idx = a.wrap ? 0 : g.idx;
  const b = G.planCast(g);
  check('… one modifier a pull, onto the spell after them', a.shots.length === 1 && a.defs[0] === G.MODS.bolt && a.shots[0].homing > 0
    && b.shots.length === 1 && b.defs[0] === G.MODS.bolt && !(b.shots[0].homing > 0), [a.shots.map(s => s.homing), b.shots.map(s => s.homing)]);
  check('… the mod not up costs nothing', a.cost === G.MODS.homing.mana + G.MODS.bolt.mana + G.MODS.switch2.mana && b.cost === G.MODS.fast.mana + G.MODS.bolt.mana + G.MODS.switch2.mana, [a.cost, b.cost]);
}
// passives aren't counted: [switch2, auto, bolt, spark] still takes turns between bolt and spark
check('passives are not counted', pulls(gunOf(['switch2', 'auto', 'bolt', 'spark']), 2).join(' ') === 'bolt spark', pulls(gunOf(['switch2', 'auto', 'bolt', 'spark']), 2));
// Triple: three in turn, then round again
check('Triple Switch: three in turn', pulls(gunOf(['switch3', 'bolt', 'spark', 'slug']), 6).join(' ') === 'bolt spark slug bolt spark slug', pulls(gunOf(['switch3', 'bolt', 'spark', 'slug']), 6));
check('Quad Switch: four in turn', pulls(gunOf(['switch4', 'bolt', 'spark', 'slug', 'orb']), 4).join(' ') === 'bolt spark slug orb');
// spells after the switch's groups fire on their own pulls as usual
check('a spell after its groups fires as usual', pulls(gunOf(['switch2', 'bolt', 'spark', 'orb']), 4).join(' ') === 'bolt orb spark orb', pulls(gunOf(['switch2', 'bolt', 'spark', 'orb']), 4));
// a copy of the gun (the bag's sim, the preview) never moves the real gun's turn
{
  const g = gunOf(['switch2', 'bolt', 'spark']);
  const copy = Object.assign({}, g);
  G.planCast(copy); G.planCast(copy);
  check('a copy of the gun leaves the real one\'s turn alone', G.planCast(g).defs[0] === G.MODS.bolt);
}
// short of mana: the turn rolls back with the slot
{
  const g = gunOf(['switch2', 'bolt', 'spark']);
  g.mana = 0;
  const p = G.planCast(g); g.idx = p.start; g.swc = p.swc0;
  g.mana = 9999;
  check('short of mana: the turn rolls back too', G.planCast(g).defs[0] === G.MODS.bolt);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
