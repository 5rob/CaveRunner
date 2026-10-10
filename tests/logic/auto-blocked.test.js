// CaveRunner Auto's blocked zones (src/auto/blocked.js, AUTOBATTLER.md stage 6b part 1): many seeds give about
// DEV.autoBlockN blocked zones a level, every variant turns up, severity spans its knob range; in a level scene each
// variant (blocked all the way, in the first random zone) is got through by a team with a Buzzsaw gun within a frame
// budget, and stops a team of starter guns (blocked, the pilot at 0) short of it.
const G = require('../load');
G.DEV.autoWallMin = G.DEV.autoWallMax = 0;   // no planted first wall, no free stretch: these suites build their own walls
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const gun = slots => ({ name: 't', cap: slots.length, castDelay: 0.2, recharge: 0.5, manaMax: 200, manaRegen: 60, spread: 0, multi: 1,
  shuffle: false, speedMul: 1, mana: 200, slots });

// ---- the plan ----
check('every variant has a name, bases and a clearing kind', G.BLOCK_VARIANTS.every(v => v.name && v.bases.length && G.CLEAR_BLOCKS.includes(v.clears)));
check('every base zone has a variant', G.TITLE_ZONES.every(z => G.variantsFor(z).length > 0));
let blocks = 0, levels = 0, smin = 1, smax = 0, wrongBase = 0, full = 0;
const seen = new Set();
for (let seed = 1; seed <= 300; seed++) {
  const P = G.levelPlan(seed, 2);
  levels++;
  for (const Z of P.zp.z) if (Z.blk) {
    blocks++; seen.add(Z.blk.variant);
    smin = Math.min(smin, Z.blk.sev); smax = Math.max(smax, Z.blk.sev);
    if (!G.blockVariant(Z.blk.variant).bases.includes(Z.z)) wrongBase++;
    if (Z.blk.full) full++;
    if (G.zoneKind(Z) !== 'blocked') wrongBase++;
  }
}
const per = blocks / levels;
check('about DEV.autoBlockN blocked zones a level', Math.abs(per - G.DEV.autoBlockN) < 0.3, per);
check('every variant appears', G.BLOCK_VARIANTS.every(v => seen.has(v.id)), [...seen]);
check('each suits its base zone', wrongBase === 0, wrongBase);
check('severity spans its range', smin < G.DEV.autoBlockMin + 0.05 && smax > G.DEV.autoBlockMax - 0.05, [smin, smax]);
check('some blocked all the way, some not', full > 0 && full < blocks, [full, blocks]);
check('no blocks with autoBlockN 0', G.levelPlan(5, 2, 0).zp.z.every(Z => !Z.blk));
check('the rest of the level is the same with or without blocks',
  JSON.stringify(G.levelPlan(9, 2, 0).zp.z.map(Z => [Z.z, Z.x0])) === JSON.stringify(G.levelPlan(9, 2).zp.z.map(Z => [Z.z, Z.x0])));

// ---- in a level: one variant, blocked all the way, in the first random zone ----
function level(variant, players, sev = 1) {
  const plan = G.levelPlan(21, 1, 0), Z = plan.zp.z[1];
  let k = 0;
  Z.blk = G.rollBlock(() => ((k++ * 0.37) % 1), Z, variant);
  Object.assign(Z.blk, { sev, full: sev >= G.DEV.autoBlockFull });
  const S = G.levelScene(190, 21, players.length, plan, players), L = G.levelState(S);
  S.foes.length = 0;
  L.elites.length = 0;
  return { S, L, B: Z.blk };
}
const FRAMES = 60 * 40;
const t0 = Date.now();
for (const v of G.BLOCK_VARIANTS) {
  const run = G.newRun(3), pl = run.players[0];
  pl.guns[1] = gun(['saw']);
  const { S, L, B } = level(v.id, [pl]);
  let f = 0;
  for (; f < FRAMES && G.levelTeamX(S) < B.x1 + 30; f++) { G.titleStep(S, 1 / 60); S.foes.length = 0; }
  check(`${v.id}: a Buzzsaw team gets through`, G.levelTeamX(S) >= B.x1 + 30, { f, x: Math.round(G.levelTeamX(S)), x1: Math.round(B.x1), blocked: L.blocked });
  if (v.id !== 'thicket') check(`${v.id}: ... by sawing through`, S.digs > 0, S.digs);
  else check('thicket: ... the webs cut', S.cut > 0, S.cut);
}
for (const id of ['collapse', 'deadend', 'thicket', 'timberfall', 'brickwall']) {
  const run = G.newRun(3);
  const { S, L, B } = level(id, run.players);
  let f = 0;
  for (; f < FRAMES && !(L.blocked && S.pace === 0); f++) { G.titleStep(S, 1 / 60); S.foes.length = 0; }
  for (let i = 0; i < 120; i++) { G.titleStep(S, 1 / 60); S.foes.length = 0; }
  check(`${id}: a starters-only team stops, blocked`, L.blocked && S.pace === 0 && G.levelTeamX(S) < B.x1, { f, x: Math.round(G.levelTeamX(S)), x0: Math.round(B.x0), kind: L.blockKind });
}
{
  // a low one (severity 0.2): the starters jet over it
  const run = G.newRun(3);
  const { S, L, B } = level('brickwall', run.players, 0.2);
  let f = 0;
  for (; f < FRAMES && G.levelTeamX(S) < B.x1 + 30; f++) { G.titleStep(S, 1 / 60); S.foes.length = 0; }
  check('a low wall: the starters get over it', G.levelTeamX(S) >= B.x1 + 30, { f, blocked: L.blocked });
}
console.log('level runs took', Date.now() - t0, 'ms');

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all ok');
