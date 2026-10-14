// Circle of Vigour in CaveRunner Auto (owner v1.0.66; art/scenegun.js vigourCircle, titlescene.js vigourStep): cast, it sits
// still on the ground (back with the scroll) and heals a hurt player inside it, never past his max. One player, no creatures,
// his gun Questions Later + Vigour so it casts with nothing in sight.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const keep = G.DEV.autoFoeElites;
G.DEV.autoFoeElites = 0;
G.DEV.autoOrbChance = 0;   // (no orb webs slowing the level, after v1.0.75)
check('Vigour is off GUN_TODO', !G.GUN_TODO.includes('vigour'));
const plan = { shots: [{ sid: 'vigour', still: true, r: 36, life: 5, col: '#46c48c' }] };
const out = G.planShots(plan, 0, 50, 60, () => 0.5, 0);
check('planShots casts it: one still circle at the gun', out.length === 1 && out[0].heal === 36 && out[0].x === 50 && out[0].vx === 0, out.map(s => [s.sid, s.heal, s.x]));

const run = G.newRun(3), pl = run.players[0], g = pl.guns[pl.active];
g.slots = ['auto', 'vigour']; g.cap = 2; G.resetGun(g);
const S = G.levelScene(400, 5, 1, G.levelPlan(5), run.players.slice(0, 1));
const max = G.playerStats(pl).maxHp;
pl.hp = 20;
let circle = null, x0 = 0, s0 = 0;
for (let i = 0; i < 600 && !circle; i++) {
  S.foes.length = 0; G.titleStep(S, 1 / 60);
  circle = S.shots.find(s => s.sid === 'vigour') || null;
  if (circle) { x0 = circle.x; s0 = S.scroll; }
}
check('in a level he casts it (Questions Later)', !!circle);
for (let i = 0; i < 30; i++) { S.foes.length = 0; G.titleStep(S, 1 / 60); }
if (circle) check('it stays on the ground: back with the scroll', Math.abs(circle.x + (S.scroll - s0) - x0) < 1, [circle.x, x0, S.scroll - s0]);
for (let i = 0; i < 300; i++) { S.foes.length = 0; G.titleStep(S, 1 / 60); }
check('he heals', pl.hp > 20, pl.hp);
for (let i = 0; i < 3000; i++) { S.foes.length = 0; G.titleStep(S, 1 / 60); }
check('never past his max', pl.hp <= max, [pl.hp, max]);
// with Follow Me: it comes to him and stays with him as the level goes on
{
  const run2 = G.newRun(3), p2 = run2.players[0], g2 = p2.guns[p2.active];
  g2.slots = ['auto', 'follow', 'vigour']; g2.cap = 3; G.resetGun(g2);
  const S2 = G.levelScene(400, 5, 1, G.levelPlan(5), run2.players.slice(0, 1)), r = S2.runners[0];
  let c = null, s1 = 0;
  for (let i = 0; i < 600 && !c; i++) { S2.foes.length = 0; G.titleStep(S2, 1 / 60); c = S2.shots.find(q => q.sid === 'vigour') || null; if (c) s1 = S2.scroll; }
  check('Follow Me + Vigour: cast, carrying follow', !!c && c.follow > 0, c && c.follow);
  for (let i = 0; i < 120; i++) { S2.foes.length = 0; G.titleStep(S2, 1 / 60); }
  if (c) { const d = Math.hypot(r.x + G.PW / 2 - c.x, r.y + G.PH / 2 - c.y); check('2 s on, the level moved on and it is still round him', d < 20 && S2.scroll - s1 > 20 && c.life > 0, [Math.round(d), Math.round(S2.scroll - s1)]); }
}
// (owner, after v1.0.81) Discriminate set on player 1 + Follow Me + Vigour on player 2's gun: it goes to player 1, not its caster
{
  const run3 = G.newRun(3); const p2x = G.newPlayer(1); p2x.guns[0] = G.scratchPistol(); p2x.active = 0; run3.players.push(p2x);
  const p2 = run3.players[1], g3 = p2.guns[p2.active];
  g3.slots = ['auto', G.discrimId({ kind: 'player', id: '1' }), 'follow', 'vigour']; g3.cap = 4; G.resetGun(g3);
  const S3 = G.levelScene(400, 5, 2, G.levelPlan(5), run3.players.slice(0, 2)), r1 = S3.runners[0], r2 = S3.runners[1];
  let c = null;
  for (let i = 0; i < 600 && !c; i++) { S3.foes.length = 0; G.titleStep(S3, 1 / 60); c = S3.shots.find(q => q.sid === 'vigour' && q.by === 1) || null; }
  check('Discriminate:P1 + Follow Me + Vigour (player 2): cast', !!c && !!c.only && c.follow > 0, c && [c.only, c.follow]);
  let near1 = 0, n = 0;
  for (let i = 0; i < 240; i++) {
    S3.foes.length = 0; G.titleStep(S3, 1 / 60);
    if (c && i > 120) { n++; const d1 = Math.hypot(r1.x + G.PW / 2 - c.x, r1.y + G.PH / 2 - c.y), d2 = Math.hypot(r2.x + G.PW / 2 - c.x, r2.y + G.PH / 2 - c.y); if (d1 < 20 && d1 <= d2 + 1) near1++; }
  }
  check('… it flies to player 1 and stays with him', n > 0 && near1 > n * 0.8, [near1, n, Math.round(r1.x), Math.round(r2.x)]);
}
G.DEV.autoFoeElites = keep;
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
