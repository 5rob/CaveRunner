// CaveRunner Auto (owner, v1.0.50): a vine lit in a level burns up from its tip fast enough to see (DEV.autoVineFire ×
// the old game's speed; the title menu stays at TITLE_FIRESPEED); the flames climb it DEV.autoVineSpread × faster (v1.0.53). Three states
// (v1.0.55): unburnt to p.lit, burning p.lit..p.ch, charred and crumbling p.ch..p.len (DEV.autoVineAsh). Every loop has a frame cap.
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
  // (v1.0.53) beside it: a vine 12 to the right (same roof) and a web line slanting past its middle 6 to the left
  const nb = { ...v, ox: v.ox + 12, seed: 0.3, burn: 0, lit: undefined };
  delete nb.sw; delete nb.tl;
  S.props.push(nb);
  const my = v.y + len0 * 0.5;
  /** @type {any} */
  const L = { ax: v.ox - 6, ay: v.y, bx: v.ox - 20, by: my + 20, a0x: v.ox - 6, a0y: v.y, b0x: v.ox - 20, b0y: my + 20, ain: { x: v.ox - 6, y: v.y - 1 }, bin: { x: v.ox - 20, y: my + 21 }, owner: null, sag: 0 };
  S.webs.push(L);
  v.burn = 1;
  let t = 0, ahead = 0, ash = 0;
  for (; t < 8 && !v.gone; t += dt) { G.titleStep(S, dt); S.foes.length = 0; if (t < 0.5) ahead = Math.max(ahead, (v.ch ?? v.len) - (v.lit ?? v.len)); ash = Math.max(ash, v.len - (v.ch ?? v.len)); }
  // (v1.0.53, owner: the fire climbs faster) the flames run up ahead of the burnt part: alight well above the tip early on
  check('fire spreads sideways: the vine beside it catches', !!nb.burn || !!nb.gone);
  check('… and the web line beside it', !!L.out);
  check('the flames climb ahead of the burnt part', ahead > Math.min(15, len0 * 0.4), +ahead.toFixed(1));
  check('(v1.0.55) a charred stretch at its end, autoVineAsh long', Math.abs(ash - G.DEV.autoVineAsh) < 1.5, +ash.toFixed(1));
  check('lit: it burns away within a few seconds (len0 / t, units a second)', v.gone && t < len0 / 4, { len0: Math.round(len0), t: +t.toFixed(2) });
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
