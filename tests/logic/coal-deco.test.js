// Coal Seams' decorations (grem, 2026-10-16; art/titlescene.js coalDeco): level 2 plays with its own zones (Mines, the Digging
// zone, the Cavern: titlescene.js COAL_ZONES), none of Mossy Caves' moss, grass, rubble, brick ledges, plants, drips or spores,
// and the old game's mine set: timber supports, rusted lanterns, explosive minecarts, pickaxes, soot falls. A cart goes off
// when lit: a blast that bites the rock and hurts creatures. Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, TM = G.TM, TC = G.TCELL;
D.autoFoeDmg = 0;

// a Grem level started at level 2: Coal Seams from the start pad on
const run = G.newRun(9);
const S = G.levelScene(190, 23, 1, undefined, run.players, 2, run, true), L = G.levelState(S);
check('level 2 plays as Coal Seams from the start', S.looks[0].name === 'Coal Seams' && G.coalAt(S, 400) && !G.coalAt(S, L.plan.arena.x1 + 50));
S.spawn = 1e9; S.foes.length = 0;
// scroll along, counting what each fresh stretch of columns holds
const seen = new Map(), mats = new Map(), props = new Set();
const keepProps = () => { for (const p of S.props) props.add(p); };
let x = 0;
for (let i = 0; i < 4000 && S.scroll < L.plan.arena.x0 - 300; i++) {
  S.scroll += 3; G.titleStep(S, 1 / 60); S.foes.length = 0; keepProps();
  for (const r of S.runners) { r.x = 40; r.y = 10; r.out = true; }
  // the columns now on screen
  const c0 = Math.floor(S.scroll / TC), c1 = c0 + Math.floor(G.TITLE_VW / TC);
  for (let c = Math.max(c0, x); c < c1; c++) for (let r = 0; r < S.rows; r++) { const m = G.titleCell(S, c, r); mats.set(m, (mats.get(m) || 0) + 1); }
  x = Math.max(x, c1);
  for (const p of S.parts) seen.set(p.kind, (seen.get(p.kind) || 0) + 1);
}
const kinds = new Set(L.plan.zp.z.filter(z => !z.flat && z.x0 > 100 && z.x1 < L.plan.arena.x0).map(z => z.z));
check('its zones are the Mines, the Digging zone and the Cavern only', [...kinds].every(k => G.COAL_ZONES.includes(k)) && kinds.size >= 2, [...kinds]);
check('no spider zone with the vines look, no heavy vegetation', L.plan.zp.z.filter(z => z.x1 < L.plan.arena.x0).every(z => z.sv !== 'vines' && !z.veg));
check('no moss, grass or rubble cells', !(mats.get(TM.MOSS) || mats.get(TM.GRASS) || mats.get(TM.RUB) || mats.get(TM.RUBM)), { moss: mats.get(TM.MOSS), grass: mats.get(TM.GRASS), rub: mats.get(TM.RUB) });
check('no brick (ledges)', !mats.get(TM.BRICK), mats.get(TM.BRICK));
check('timber in it (supports and mine frames)', (mats.get(TM.BEAM) || 0) > 50, mats.get(TM.BEAM));
const by = k => [...props].filter(k);
check('no vines, roots, mycelium or mushrooms', !by(p => (p.k === 'climb' && p.st !== 'silk') || p.k === 'pad').length, by(p => (p.k === 'climb' && p.st !== 'silk') || p.k === 'pad').length);
check('rusted lanterns', by(p => p.k === 'lamp' && p.rust).length >= 3, by(p => p.k === 'lamp').length);
check('every lantern rusted', by(p => p.k === 'lamp' && !p.rust).length === 0);
check('explosive minecarts', by(p => p.k === 'barrel').length >= 1, by(p => p.k === 'barrel').length);
check('pickaxes', by(p => p.st === 'pickaxe').length >= 3, by(p => p.st === 'pickaxe').length);
check('soot falls, no blue drips or spores', (seen.get('soot') || 0) > 20 && !seen.get('drip') && !seen.get('spore'), [seen.get('soot'), seen.get('drip'), seen.get('spore')]);
// a cart on the floor stands on rock and the air over it is open (one still in the scene's ring of columns)
const cart = S.props.find(p => p.k === 'barrel' && !p.gone && p.ox > S.scroll - 200);
if (cart) check('a minecart sits on rock', !!G.TITLE_SOLID[G.titleCell(S, Math.floor(cart.ox / TC), Math.floor((cart.y + 0.5) / TC))] && !G.TITLE_SOLID[G.titleCell(S, Math.floor(cart.ox / TC), Math.floor((cart.y - 4) / TC))]);

// ---- a cart goes off: in a sandbox (the scene still, no creatures but one) ----
S.lvl.step = null; S.pace = 0; S.still = true; S.props.length = 0;
const wx = S.scroll + 110, fy = G.titleFloor(wx, S), r = Math.ceil(fy / TC - 0.5);
const P = { k: 'barrel', st: 'cart', ox: wx, x: wx - S.scroll, y: r * TC, len: 0, seed: 0.5, side: 1, burn: 0, ac: Math.floor(wx / TC), ar: r, fuse: 0.05 };
S.props.push(P);
const foe = G.titleFoeAt(S, G.autoFoe('hamahakki', 1), wx + 6);
foe.y = foe.ty = r * TC - 8; foe.hp = foe.hpMax = 1000;
const solidBefore = [...Array(9)].filter((_, k) => G.TITLE_SOLID[G.titleCell(S, Math.floor(wx / TC) - 4 + k, r + 1)]).length;
for (let i = 0; i < 20 && !P.gone; i++) G.titleStep(S, 1 / 60);
const solidAfter = [...Array(9)].filter((_, k) => G.TITLE_SOLID[G.titleCell(S, Math.floor(wx / TC) - 4 + k, r + 1)]).length;
check('a lit cart goes off: gone, a blast', P.gone && S.booms.length > 0);
check('… it bites the floor under it', solidAfter < solidBefore, [solidBefore, solidAfter]);
check('… and hurts a creature beside it', foe.hp < 1000, foe.hp);

// level 1 is untouched: every zone kind, Mossy's look
const S1 = G.levelScene(190, 23, 1, undefined, G.newRun(9).players, 1, G.newRun(9), true);
check('level 1 is still Mossy Caves (no Coal Seams decoration)', !G.coalAt(S1, 400) && G.coalAt(S1, G.levelState(S1).plan.arena.x1 + 50));

process.exitCode = fails ? 1 : 0;
console.log(fails ? fails + ' failed' : 'all passed');
