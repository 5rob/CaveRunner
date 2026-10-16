// Coal Seams' gas pockets (grem, chunk C1; art/titlescene.js gasBoom, stepGas): invisible methane in low corners; fire or a
// blast reaching one sets off a pale blue whoomph that hurts creatures, lights fire round it and sets off pockets near it.
// Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, TC = G.TCELL;
D.autoFoeDmg = 0;

// a Grem level at level 2 (Coal Seams): walk it, counting the pockets made
const run = G.newRun(9);
const S = G.levelScene(190, 23, 1, undefined, run.players, 2, run, true), L = G.levelState(S);
S.spawn = 1e9; S.foes.length = 0;
const made = new Set();
let dist = 0;
for (let i = 0; i < 3000 && S.scroll < L.plan.arena.x0 - 300; i++) {
  S.scroll += 3; dist += 3; G.titleStep(S, 1 / 60); S.foes.length = 0;
  for (const r of S.runners) { r.x = 40; r.y = 10; r.out = true; }
  for (const g of S.gas || []) made.add(g);
}
const per = made.size / (dist / G.TITLE_VW);
check('gas pockets in Coal Seams, about DEV.coalGas a screen (within 25%)', Math.abs(per / D.coalGas - 1) < 0.25, { n: made.size, per: +per.toFixed(2), knob: D.coalGas });
// the knob at 0.5 on another level: about that many
{
  const D0 = D.coalGas; D.coalGas = 0.5;
  const r2 = G.newRun(4), S2 = G.levelScene(190, 41, 1, undefined, r2.players, 2, r2, true), L2 = G.levelState(S2);
  S2.spawn = 1e9; S2.foes.length = 0;
  const m2 = new Set(); let d2 = 0;
  for (let i = 0; i < 3000 && S2.scroll < L2.plan.arena.x0 - 300; i++) {
    S2.scroll += 3; d2 += 3; G.titleStep(S2, 1 / 60); S2.foes.length = 0;
    for (const r of S2.runners) { r.x = 40; r.y = 10; r.out = true; }
    for (const g of S2.gas || []) m2.add(g);
  }
  const p2 = m2.size / (d2 / G.TITLE_VW);
  check('… and with the knob at 0.5 (within 40%: fewer of them)', Math.abs(p2 / 0.5 - 1) < 0.4, { n: m2.size, per: +p2.toFixed(2) });
  D.coalGas = D0;
}
const g0 = [...made].find(g => g.wx > S.scroll && g.wx < S.scroll + G.TITLE_VW);
if (g0) {
  const c = Math.floor(g0.wx / TC), r = Math.round(g0.y / TC);
  check('a pocket sits on a floor (rock under, air over)', G.TITLE_SOLID[G.titleCell(S, c, r)] && !G.TITLE_SOLID[G.titleCell(S, c, r - 1)]);
}

// ---- the sandbox: the scene still, no props, a flat stretch of floor ----
S.lvl.step = null; S.pace = 0; S.still = true; S.props.length = 0; S.foes.length = 0; S.fire.length = 0; S.burning.clear(); S.booms.length = 0;
const wx = S.scroll + 110, fy = G.titleFloor(wx, S), r = Math.ceil(fy / TC - 0.5), y = r * TC;
const foeAt = (/** @type {number} */ x) => { const f = G.titleFoeAt(S, G.autoFoe('hamahakki', 1), x); f.y = f.ty = y - 8; f.hp = f.hpMax = 1000; return f; };

// fire reaching a pocket
const A = { wx, y, r: 10 };
S.gas = [A];
const foe = foeAt(wx + 4);
G.titleIgnite(S, wx - S.scroll, y - 3, 4, 1);
for (let i = 0; i < 30 && !A.gone; i++) G.titleStep(S, 1 / 60);
check('fire reaching a pocket sets it off', !!A.gone);
check('… a pale blue whoomph (a gas boom)', S.booms.some(b => b.sid === 'gas'));
check('… it hurts a creature in it', foe.hp < 1000, foe.hp);
check('… less than a minecart\'s blast', 1000 - foe.hp <= D.coalCartDmg + 1, 1000 - foe.hp);
check('… fire round it', S.fire.length > 0, S.fire.length);

// a chain: a whoomph sets off a pocket beside it, not one far off
S.fire.length = 0; S.burning.clear(); S.booms.length = 0; S.foes.length = 0;
const B1 = { wx, y, r: 10, fuse: 0.01 }, B2 = { wx: wx + 14, y, r: 10 }, B3 = { wx: wx + 90, y, r: 10 };
S.gas = [B1, B2, B3];
for (let i = 0; i < 20; i++) G.titleStep(S, 1 / 60);
check('a whoomph sets off a pocket beside it (chain)', !!B1.gone && !!B2.gone, [!!B1.gone, !!B2.gone]);
check('… not one far off', !B3.gone);

// a minecart's blast sets one off
S.fire.length = 0; S.burning.clear(); S.booms.length = 0;
const C = { wx: wx - 10, y, r: 10 };
S.gas = [C];
S.props.push({ k: 'barrel', st: 'cart', ox: wx, x: wx - S.scroll, y, len: 0, seed: 0.5, side: 1, burn: 0, ac: Math.floor(wx / TC), ar: r, fuse: 0.01 });
for (let i = 0; i < 20 && !C.gone; i++) G.titleStep(S, 1 / 60);
check('a minecart\'s blast sets a pocket off', !!C.gone);

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
