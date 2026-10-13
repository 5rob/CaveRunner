// (owner v1.0.74) Borer with Bounce in CaveRunner Auto (art/titlescene.js stepShots): a Borer shot drills on through
// the rock (the old game's bullets.js rule) and Bounce doesn't turn it back. One shot fired straight down into the floor.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
/** a shot of the gun [mods..., bolt] fired down into the floor; how deep it got (units under the floor) and its vy sign at the end */
function down(mods) {
  const run = G.newRun(3), pl = run.players[0], g = pl.guns[pl.active];
  g.cap = mods.length + 1; g.slots = [...mods, 'bolt'];
  G.resetGun(g);
  const S = G.levelScene(400, 5, 1, G.levelPlan(5), run.players.slice(0, 1));
  S.foes.length = 0;
  const x = 80, fy = G.titleFloor(S.scroll + x, S);
  const plan = G.gunPull(g, pl.guns);
  const s = G.planShots(plan, Math.PI / 2, x, fy - 10, S.rnd, 0)[0];
  S.shots.length = 0; S.shots.push(s);
  let deep = 0, up = false;
  for (let i = 0; i < 90 && S.shots.includes(s); i++) { G.titleStep(S, 1 / 60); S.foes.length = 0; deep = Math.max(deep, s.y - fy); if (s.vy < 0) up = true; }
  return { deep: +deep.toFixed(1), up };
}
const plain = down([]), bounce = down(['bounce']), borer = down(['borer']), both = down(['borer', 'bounce']), both2 = down(['bounce', 'borer']);
console.log({ plain, bounce, borer, both, both2 });
check('a plain bolt stops at the floor', plain.deep < 6, plain);
check('Bounce alone: turned back up', bounce.up, bounce);
check('Borer alone: drills down into the rock', borer.deep > 15, borer);
check('Borer + Bounce: still drills down, never turned back', both.deep > 15 && !both.up, both);
check('Bounce + Borer (other order): the same', both2.deep > 15 && !both2.up, both2);
console.log(fails ? `\n${fails} failed` : '\nall ok');
process.exit(fails ? 1 : 0);
