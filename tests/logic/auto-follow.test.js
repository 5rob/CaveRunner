// Follow Me on shots in CaveRunner Auto (owner v1.0.67; art/titlescene.js shotFollow, the old game's spells/paths.js rule): a
// shot is pulled back to its caster, slows, stops and comes straight back, never faster than it left. One player, no
// creatures, Questions Later so he fires ahead (to the right) with nothing in sight.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const keep = G.DEV.autoFoeElites;
G.DEV.autoFoeElites = 0;
check('Follow Me is off GUN_TODO', !G.GUN_TODO.includes('follow'));
/** @param {string[]} slots */
function watch(slots) {
  const run = G.newRun(3), pl = run.players[0], g = pl.guns[pl.active];
  g.slots = slots.slice(); g.cap = slots.length; G.resetGun(g);
  const S = G.levelScene(400, 5, 1, G.levelPlan(5), run.players.slice(0, 1));
  let back = 0, out = 0, fast = 0;
  for (let i = 0; i < 900; i++) {
    S.foes.length = 0; G.titleStep(S, 1 / 60);
    for (const s of S.shots) if (s.sid === 'bolt') {
      if (s.vx > 1) out++; if (s.vx < -1) back++;
      if (s.sp0 && Math.hypot(s.vx, s.vy) > s.sp0 + 0.01) fast++;
    }
  }
  return { back, out, fast };
}
const plain = watch(['auto', 'bolt']), fol = watch(['auto', 'follow', 'bolt']);
check('a plain bolt only flies out', plain.out > 0 && plain.back === 0, plain);
check('with Follow Me it comes back', fol.out > 0 && fol.back > 0, fol);
check('… never faster than it set out', fol.fast === 0, fol.fast);
G.DEV.autoFoeElites = keep;
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
