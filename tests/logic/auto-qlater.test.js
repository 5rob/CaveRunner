// Questions Later in CaveRunner Auto (owner v1.0.65; art/titlescene.js stepRunnerGun): a gun with it fires in a level with
// nothing in sight; without it the player holds fire. One player, no creatures, shots counted as they leave the gun.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const keep = G.DEV.autoFoeElites;
G.DEV.autoFoeElites = 0;
/** shots fired in 8 s with no creatures, the gun with or without Questions Later @param {boolean} auto */
function shotsFired(auto) {
  const run = G.newRun(3), pl = run.players[0], g = pl.guns[pl.active];
  g.slots[0] = 'bolt';
  if (auto) { g.cap++; g.slots.push('auto'); }
  G.resetGun(g);
  const S = G.levelScene(400, 5, 1, G.levelPlan(5), run.players.slice(0, 1));
  let n = 0;
  for (let i = 0; i < 480; i++) {
    S.foes.length = 0;
    const before = S.shots.length;
    G.titleStep(S, 1 / 60);
    n += Math.max(0, S.shots.length - before);
  }
  return n;
}
const off = shotsFired(false), on = shotsFired(true);
check('no creatures, a plain gun: holds fire', off === 0, off);
check('no creatures, Questions Later: fires anyway', on >= 3, on);
G.DEV.autoFoeElites = keep;
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
