// CaveRunner Auto's clearing rule (src/auto/clear.js, AUTOBATTLER.md stage 5b): canClear / bestClearer over the real
// MODS, and in a level scene (a wall of rock built across the strip in front of the team, the sandbox way): a team with
// a Buzzsaw in a gun clears it with real shots and goes on; a team of starter guns stops, blocked.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const gun = slots => ({ name: 't', cap: slots.length, castDelay: 0.2, recharge: 0.5, manaMax: 200, manaRegen: 60, spread: 0, multi: 1,
  shuffle: false, speedMul: 1, mana: 200, slots });

// ---- canClear over real mods ----
for (const id of ['saw', 'digbolt', 'ldrill', 'void', 'blast', 'nuke']) check(`${id} clears rock`, G.canClear(gun([id]), 'rock') > 0, G.canClear(gun([id]), 'rock'));
check('the borer modifier makes a bolt dig', G.canClear(gun(['borer', 'bolt']), 'rock') > 0 && G.canClear(gun(['bolt']), 'rock') === 0);
for (const id of G.STARTER_SHOTS) check(`starter shot ${id} can't clear rock`, G.canClear(gun([id]), 'rock') === 0);
check('fire burns webs and timber, not rock', G.canClear(gun(['flamer']), 'web') > 0 && G.canClear(gun(['flamer']), 'timber') > 0
  && G.canClear(gun(['flamer']), 'rock') === 0);
check('a saw breaks through webs too', G.canClear(gun(['saw']), 'web') > 0);
check('Buzzsaw beats Luminous Drill on rock', G.canClear(gun(['saw']), 'rock') > G.canClear(gun(['ldrill']), 'rock'));
check('no gun, empty gun: 0', G.canClear(null, 'rock') === 0 && G.canClear(gun([null, null]), 'rock') === 0);

const run = G.newRun(5);
const p = run.players[0];
check('a starter player has no clearer (the Buzzsaw sits in the bag)', G.bestClearer(p, 'rock') === -1);
p.guns[2] = gun(['ldrill']); p.guns[3] = gun(['saw']);
check('bestClearer picks the best of its 4 guns', G.bestClearer(p, 'rock') === 3, G.bestClearer(p, 'rock'));
const team = [G.newPlayer(0), p];
team[0].guns[0] = gun(['bolt']);
check('teamClearer: own first, else a teammate', JSON.stringify(G.teamClearer(team, 'rock', 1)) === '{"p":1,"g":3}'
  && JSON.stringify(G.teamClearer(team, 'rock', 0)) === '{"p":1,"g":3}');
p.alive = false;
check('a dead teammate doesn\'t count', G.teamClearer(team, 'rock', 0) === null);

// ---- in a level ----
// the team through its arrival, then a wall of rock (floor to roof) built across the strip WALL world units ahead
const WALL = 70, WIDE = 3;
function scene(players) {
  const S = G.levelScene(190, 11, players.length, G.levelPlan(11), players), L = G.levelState(S);
  for (let i = 0; i < 600 && L.phase === 'arrive'; i++) G.titleStep(S, 1 / 60);
  const x = G.levelTeamX(S) + WALL, c0 = Math.floor(x / G.TCELL);
  for (let c = c0; c < c0 + WIDE; c++) for (let r = 0; r < S.rows; r++) S.cells[(((c % S.ncol) + S.ncol) % S.ncol) * S.rows + r] = G.TM.ROCK;
  S.dirtyAll = true;
  return { S, L, wx: x };
}
const solidAt = (S, wx) => { let n = 0; for (let r = 0; r < S.rows; r++) if (G.titleSolid(S, wx - S.scroll, r * G.TCELL + 1)) n++; return n; };

{
  const r1 = G.newRun(7), pl = r1.players[0];
  pl.guns[1] = gun(['saw']);
  const { S, L, wx } = scene([pl]);
  const before = solidAt(S, wx + G.TCELL / 2);
  let switched = false, backTo = -1, steps = 0;
  for (; steps < 60 * 40 && G.levelTeamX(S) < wx + 80; steps++) {
    G.titleStep(S, 1 / 60);
    const r = S.runners[0];
    if (r.clr && r.clr.g === 1) switched = true;
    if (switched && !r.dig && backTo < 0) backTo = pl.active;
  }
  check('a saw gun: the runner switches to it at the wall', switched);
  check('… really cuts the wall', solidAt(S, wx + G.TCELL / 2) < before, [before, solidAt(S, wx + G.TCELL / 2)]);
  check('… and the team gets past it, never blocked', G.levelTeamX(S) >= wx + 80 && !L.blocked, [G.levelTeamX(S) - wx, steps]);
  check('… then back to its active gun', backTo === 0 && pl.active === 0);
}
{
  const r2 = G.newRun(8);
  G.bagAdd(r2, { kind: 'green', n: 1 }); G.addPlayer(r2);
  const { S, L, wx } = scene(r2.players);
  let steps = 0;
  for (; steps < 60 * 25 && !(L.blocked && S.pace === 0); steps++) G.titleStep(S, 1 / 60);
  const x0 = G.levelTeamX(S);
  for (let i = 0; i < 120; i++) G.titleStep(S, 1 / 60);
  check('starters only: blocked at the wall', L.blocked, steps);
  check('… the team stopped short of it', S.pace === 0 && G.levelTeamX(S) === x0 && x0 < wx, [x0 - wx, S.pace]);
  // (the starter shots scorch small pits where they land: the wall is chipped, never cut through)
check('… and the wall still stands', solidAt(S, wx + G.TCELL / 2) >= S.rows * 0.8, [solidAt(S, wx + G.TCELL / 2), S.rows]);
  // fit a Buzzsaw into a gun: no longer blocked, off it goes
  r2.players[1].guns[0].slots[1] = 'saw';
  for (let i = 0; i < 60 * 3; i++) G.titleStep(S, 1 / 60);
  check('a Buzzsaw fitted: unblocked, moving again', !L.blocked && S.pace > 0, S.pace);
}

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all ok');
