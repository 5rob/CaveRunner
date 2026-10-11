// CaveRunner Auto (owner, v1.0.50): a vine lit in a level burns up from its tip fast enough to see (DEV.autoVineFire ×
// the old game's speed; the title menu stays at TITLE_FIRESPEED). Every loop has a frame cap.
const G = require('../load');
G.DEV.autoFoeDmg = 0; G.DEV.autoWallMin = G.DEV.autoWallMax = 0;
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const dt = 1 / 60;

const run = G.newRun(3);
const S = G.levelScene(200, 7, 1, G.levelPlan(7, 1, 0), run.players.slice(0, 1));
for (let i = 0; i < 60; i++) G.titleStep(S, dt);
const vines = () => S.props.filter(p => p.k === 'climb' && p.st === 'vine' && !p.arc && !p.gone && !p.burn && p.len > 20);
let v = vines()[0];
for (let i = 0; i < 60 * 30 && !v; i++) { G.titleStep(S, dt); S.foes.length = 0; v = vines()[0]; }
check('a hanging vine in the level', !!v, v && v.len);
if (v) {
  const len0 = v.len;
  v.burn = 1;
  let t = 0;
  for (; t < 8 && !v.gone; t += dt) { G.titleStep(S, dt); S.foes.length = 0; }
  check('lit: it burns away within a few seconds (len0 / t, units a second)', v.gone && t < len0 / 4, { len0: Math.round(len0), t: +t.toFixed(2) });
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
