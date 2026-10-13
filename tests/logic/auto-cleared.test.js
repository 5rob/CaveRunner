// CaveRunner Auto's LEVEL CLEARED (AUTOBATTLER.md stage 7, src/auto/level.js phase 'cleared', src/art/cleared.js):
// after the boss is dead the team waits for its loot to be vacuumed, then (owner v1.0.74) sets off at once, the words showing;
// loot that can't be taken (a full bag) holds it only for the wait knob; a thud at each letter's landing.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV;
const dt = 1 / 30;

// a scene sat in the arena (skips the run there): phase 'arena', the boss dead
const arena = () => {
  const P = G.levelPlan(11, 0.25, 0), S = G.levelScene(190, 11, 2, P), L = G.levelState(S);
  S.scroll = P.arena.mid - G.LVL_TEAM; L.phase = 'arena'; L.arenaT = S.t; L.arrived = L.arrived.map(() => true);
  S.foes.length = 0; S.coins.length = 0; S.loot = [];
  return { P, S, L };
};
const stepUntil = (S, test, cap) => { let f = 0; for (; f < cap && !test(); f++) G.titleStep(S, dt); return f; };

// ---- loot gone: (owner v1.0.74) out to the exit at once, the words shown for the knob's time on the way ----
{
  const { S, L } = arena();
  L.bossDead = true;
  G.titleStep(S, dt);
  check('the boss dead, no loot: straight out to the exit', L.phase === 'out', L.phase);
  check('guns down', S.gunsOff === true);
  check('the words start at once', L.clearT >= 0 && G.levelClearedAge(S) >= 0, L.clearT);
  const t0 = L.clearT;
  let lands = 0;
  stepUntil(S, () => { lands += S.snd.filter(s => s.k === 'land' && s.a === 160).length; S.snd.length = 0; return G.levelClearedAge(S) < 0; }, 30 * 20);
  const shown = S.t - t0;
  check('shown for the knob\'s time (± a frame)', Math.abs(shown - D.autoClearT) < dt * 1.5, [shown, D.autoClearT]);
  check('a thud for each letter', lands === G.CLEARED_N, [lands, G.CLEARED_N]);
  check('the words gone once it\'s over', G.levelClearedAge(S) === -1);
}
// ---- loot waiting to be vacuumed: the words wait for it ----
{
  const { S, L } = arena();
  L.bossDead = true;
  const keep = D.autoClearWait;
  D.autoClearWait = 2;
  // a pickup that can't be taken (no pull; it stays): it holds the words only for the wait knob
  const it = { x: G.levelTeamX(S) + 500, y: S.top + 20, vx: 0, vy: 0, it: { kind: 'gold', n: 1 }, col: '#fff', t: 0, nopull: 999 };
  S.loot.push(it);
  G.titleStep(S, dt); G.titleStep(S, dt);
  check('loot lying: no words yet', L.phase === 'cleared' && L.clearT < 0 && G.levelClearedAge(S) === -1);
  stepUntil(S, () => L.clearT >= 0, 30 * 10);
  const waited = L.clearT - L.lootT;
  check('loot that can\'t be taken holds it only for the wait knob', L.clearT >= 0 && Math.abs(waited - 2) < dt * 2, waited);
  check('then the words, then out', stepUntil(S, () => L.phase === 'out', 30 * 10) < 30 * 10);
  D.autoClearWait = keep;
}
{
  const { S, L } = arena();
  L.bossDead = true;
  S.loot.push({ x: G.levelTeamX(S) + 40, y: 0, vx: 0, vy: 0, it: { kind: 'gold', n: 1 }, col: '#fff', t: 0, nopull: 999 });
  G.titleStep(S, dt); G.titleStep(S, dt);
  check('waiting while loot lies', L.clearT < 0);
  S.loot.length = 0;
  G.titleStep(S, dt);
  check('vacuumed: the words start', L.clearT >= 0 && L.clearT - L.lootT < 1);
}
// ---- the timing: letters land one by one, the shine after the last ----
const lt = Array.from({ length: G.CLEARED_N }, (_, i) => G.clearedLand(i));
check('the letters land one after another', lt.every((t, i) => i === 0 || t > lt[i - 1]) && lt[0] > 0, lt);
check('the shine sweeps after the last has landed, inside the default show', G.clearedShine() > lt[lt.length - 1] && G.clearedShine() + 0.7 < D.autoClearT);

console.log(fails ? `\n${fails} failed` : '\nall ok');
process.exit(fails ? 1 : 0);
