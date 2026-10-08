// Save slots and the title scene (LIST4 #3, #4; the scene redone in v0.0.161): slotKey keeps slot 1
// on the old keys and gives slots 2/3 their own, slotSummary reads a run for the title's slot line,
// and the title's scene (art/titlescene.js): four players (v0.0.165; one before) who run on the ground and jetpack, through
// Mossy Caves' zones, swapping real guns (gun art + a shot mod + modifiers), killing only floor 1's creatures, whose
// gold he vacuums up; blasts carve the terrain and fire burns moss, timber and plants; all within caps.
const { slotKey, slotSummary, SAVE_KEY, COLLECTION_KEY, PERK_COLLECTION_KEY, SLOTS,
  titleScene, titleStep, titleCell, titleZone, titleCarve, titleIgnite, TM, TCELL, TITLE_SHOTS, TITLE_MODS, TITLE_KINDS, ROSTERS, MODS, gunArt,
  TITLE_FOES, TITLE_PARTS, TITLE_GOLD, TITLE_FIRE } = require('../load');
const G = require('../load');

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`);
};

check('three slots', SLOTS === 3);
check('slot 1 keeps the old keys', slotKey(SAVE_KEY, 1) === 'caverunner-save' && slotKey(COLLECTION_KEY, 1) === 'caverunner-collection'
  && slotKey(PERK_COLLECTION_KEY, 1) === 'caverunner-perkcollection');
check('slot 2 and 3 add -2 / -3', slotKey(SAVE_KEY, 2) === 'caverunner-save-2' && slotKey(PERK_COLLECTION_KEY, 3) === 'caverunner-perkcollection-3');
check('a bad slot is slot 1', slotKey(SAVE_KEY, 0) === SAVE_KEY && slotKey(SAVE_KEY, 9) === SAVE_KEY && slotKey(SAVE_KEY, NaN) === SAVE_KEY);

check('no save: empty slot', slotSummary(null) === null && slotSummary('junk') === null && slotSummary('{}') === null);
const run = JSON.stringify({ ver: 'x', floor: 4, hp: 30, loadout: { guns: [{ name: 'Pistol', slots: ['bolt', null] }, null, { name: 'B', slots: [null] }, null],
  sel: 0, bag: ['bolt', 'bolt'], gold: 1234.7 } });
const s = slotSummary(run);
check('summary: floor, gold, guns, mods', s && s.floor === 4 && s.gold === 1234 && s.guns === 2 && s.mods === 3, s);

// the band a 412x880 phone gives it (ui/title.js)
const S = titleScene(470, 7, 139, 295);
let maxFoes = 0, maxParts = 0, maxGold = 0, maxFire = 0, onFloor = 0, feetOff = 0, brains = 0, noBrain = 0, aggroFar = 0;
const zones = new Set(), kits = new Set(), seenKinds = new Set(), born = new Set(), badHome = [], spun = new Set();
let overlap = 0, tight = 0, pairs = 0;
let jellyIn = 0, jellyWorks = 0, pulledFar = 0, pulled = 0, oddNug = 0, nugs = 0;
const flew = new Set();
for (let i = 0; i < 60 * 40; i++) {
  titleStep(S, 1 / 60);
  maxFoes = Math.max(maxFoes, S.foes.length); maxParts = Math.max(maxParts, S.parts.length);
  maxGold = Math.max(maxGold, S.coins.length); maxFire = Math.max(maxFire, S.fire.length);
  const r = S.runner;
  // the player nearest a world point (each creature hunts, each nugget flies to, its nearest)
  const near = (x, y) => S.runners.reduce((b, q) => (Math.hypot(S.scroll + q.x + 6 - x, q.y + 11 - y) < Math.hypot(S.scroll + b.x + 6 - x, b.y + 11 - y) ? q : b));
  const at = (x, y) => { const q = near(x, y); return [S.scroll + q.x + 6, q.y + 11]; };
  // the players never overlap, and seldom stand tight together (owner, v0.0.167)
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    const A = S.runners[a], B = S.runners[b], dx = Math.abs(A.x - B.x), dy = Math.abs(A.y - B.y);
    pairs++;
    if (dx < 12 - 0.5 && dy < 22 - 0.5) overlap++;
    if (Math.hypot(dx, dy * 0.6) < 14) tight++;
  }
  zones.add(titleZone(S.scroll + r.x)); for (const q of S.runners) kits.add(q.kit.name);
  for (const f of S.foes) {
    const id = f.k.id;
    seenKinds.add(id);
    // where each one first shows: a zone that's home to it (TITLE_HOME); jellyfish stay out of the works
    if (!born.has(f)) { born.add(f); const z = titleZone(f.x); if (!G.TITLE_HOME[z].some(h => h[0] === id)) badHome.push([id, z]); }
    if (id === 'meduusa' && f.x - S.scroll > 0 && f.x - S.scroll < 220) { jellyIn++; const z = titleZone(f.x); if ((z === 'timber' || z === 'paved') && Math.min(f.x % 280, 280 - f.x % 280) > 60) jellyWorks++; }
    // run by the game's brains: each has its brain state (e.je / e.sp / e.ra) after its first frame
    if (born.has(f) && (id === 'meduusa' ? f.je : id === 'hamahakki' ? f.sp : f.ra)) brains++; else noBrain++;
    // the game's aggro: never still hunting past its reach × loseAggro
    const [pcx, pcy] = at(f.x, f.ty);
    if (f.aggro && Math.hypot(pcx - f.x, pcy - f.ty) > f.k.aggro / G.DEV.zoom * G.DEV.aggro * (f.aggroM || 1) * G.DEV.loseAggro + 10) aggroFar++;   // (it and he move on after its check, in the frame)
  }
  for (const L of S.webs) if (L.owner) spun.add(L);
  // the gold: the game's nuggets (25 / 5 / 1), pulled to him only from within COIN_PULL
  for (const g of S.coins) {
    if (!flew.has(g)) { nugs++; if (![25, 5, 1].includes(g.amount)) oddNug++; }
    const [gx, gy] = at(g.x, g.y);
    if (g.fly && !flew.has(g)) { flew.add(g); pulled++; if (Math.hypot(gx - g.x, gy - g.y) > G.COIN_PULL + 6) pulledFar++; }
    if (!g.fly && !flew.has(g)) flew.add(g), flew.delete(g);
  }
  if (r.mode === 'run' && r.ground && !r.dig) {
    // feet on the floor: the cell just under his feet is solid, the one at his shins isn't rock
    onFloor++;
    const c = Math.floor((S.scroll + r.x + 6) / TCELL), fr = Math.floor((r.y + 22 + 0.5) / TCELL);
    if (!titleCell(S, c, fr) || titleCell(S, c, fr - 3) === TM.ROCK) feetOff++;
  }
}
check('the title scene kills creatures', S.kills >= 10, S.kills);
check('and drops gold', S.gold >= 20, S.gold);
check('he collects the gold that comes near him', S.got > 0 && S.gotN > 3, { got: S.got, n: S.gotN, gold: S.gold });
check('the gold is the game\'s nuggets (25 / 5 / 1)', nugs > 10 && oddNug === 0, { nugs, oddNug });
check('gold flies to him only from within the game\'s pull distance', pulled > 3 && pulledFar === 0, { pulled, pulledFar });
check("only floor 1's creatures (its roster and its rats)", [...seenKinds].every(k => TITLE_KINDS.includes(k))
  && TITLE_KINDS.every(k => k === 'rotta' || ROSTERS[0].includes(k)) && seenKinds.has('rotta') && seenKinds.size >= 2, [...seenKinds]);
check('they run on the game\'s own brains (jellyStep, spiderStep, ratStep)', brains > 1000 && noBrain < brains * 0.05, { brains, noBrain });
check('aggro as the game: none hunts him from past its reach × loseAggro', aggroFar === 0, aggroFar);
check('spiders spin their own lines', spun.size > 0, spun.size);
check('within its caps', maxFoes <= TITLE_FOES && maxParts <= TITLE_PARTS && maxGold <= TITLE_GOLD && maxFire <= TITLE_FIRE, { maxFoes, maxParts, maxGold, maxFire });
check('the players never overlap (they collide)', overlap / pairs < 0.003, { overlap, pairs });
check('…and keep a little apart (seldom tight together)', tight / pairs < 0.03, { tight, pairs });
check('they run on the ground and they fly', S.groundT > 6 && S.flyT > 6, { ground: S.groundT, fly: S.flyT });
check('now and then they saw tunnels through the rock', S.digs >= 3 && S.digT > 2, { digs: S.digs, digT: S.digT });
{
  // each player switches between running and flying on its own clock (owner, v0.0.166: they all switched together)
  const sw = S.runners.map(q => q.switches), all = sw.flat();
  let together = 0;
  for (const t of sw[0]) if (sw.slice(1).every(o => o.some(u => Math.abs(u - t) < 0.4))) together++;
  check('they switch between running and flying at their own times', all.length > 16 && together <= 1, { per: sw.map(a => a.length), together, ground: S.groundT, fly: S.flyT, dig: S.digT, digs: S.digs, modes: S.runners.map(q => [q.mode, q.modeT.toFixed(1), q.dig.toFixed(1)]) });
}
check('running, his feet are on the floor', onFloor > 200 && feetOff / onFloor < 0.05, { onFloor, feetOff, ground: S.groundT, fly: S.flyT, dig: S.digT, digs: S.digs, why: S.digWhy, sw: S.runners.map(q => q.switches.length) });
check('he stays on screen', S.runner.x > 0 && S.runner.x < 220 && S.runner.y > S.top - 40 && S.runner.y < S.bot, [S.runner.x, S.runner.y]);
check('they swap guns, many different ones', S.swaps >= 12 && kits.size >= 15, { swaps: S.swaps, kits: kits.size });
check('every gun is a real gun skin, a real shot and real modifiers', TITLE_SHOTS.every(k => MODS[k] && MODS[k].kind === 'shot') && TITLE_MODS.every(k => MODS[k] && MODS[k].kind === 'mod')
  && S.runners.every(q => gunArt(q.kit.art) && TITLE_SHOTS.includes((q.keep || q.kit).shot)));
{
  const R = G.titleRng(5), names = new Set(), shots = new Set();
  let modded = 0;
  for (let i = 0; i < 400; i++) { const K = G.titleKit(R); names.add(K.name); shots.add(K.shot); if (K.mods.length) modded++; }
  check('a gun: any of the shots, often with modifiers', shots.size === TITLE_SHOTS.length && modded > 250 && names.size > 150, { shots: shots.size, modded, names: names.size });
}
check('four players, each its own colour, spread out', S.runners.length === 4 && new Set(S.runners.map(q => q.col)).size === 4
  && S.runners.every(q => q.x > 0 && q.x < 220 && q.y > S.top - 40 && q.y < S.bot), S.runners.map(q => [q.x, q.y]));
check('it travels through the zones', ['moss', 'webs', 'timber', 'paved', 'grove'].every(z => zones.has(z)), [...zones]);
// v0.0.161 feedback: ragged zone borders, a low timber works, the spiders' webs
{
  const { titleZoneAt, ZBLEND, TITLE_ZLEN, TIMBER_H, titleCeil, titleFloor } = G;
  let near = 0, frayed = 0, far = 0, wrong = 0;
  for (let wx = 0; wx < TITLE_ZLEN * 5; wx += 2) for (let y = 140; y < 300; y += 4) {
    const d = Math.min(wx % TITLE_ZLEN, TITLE_ZLEN - wx % TITLE_ZLEN);
    if (d < ZBLEND * 0.6) { near++; if (titleZoneAt(wx, y) !== titleZone(wx)) frayed++; }
    if (d > ZBLEND + 8) { far++; if (titleZoneAt(wx, y) !== titleZone(wx)) wrong++; }
  }
  check('zone borders fray (noise), and only near the border', frayed / near > 0.15 && wrong === 0, { frayed, near, wrong, far });
  const B = { top: 139, bot: 295 }, mid = TITLE_ZLEN * 2.5;
  check('the timber works are low: the frames\' height', titleZone(mid) === 'timber' && Math.abs(titleFloor(mid, B) - titleCeil(mid, B) - TIMBER_H) < 0.01,
    titleFloor(mid, B) - titleCeil(mid, B));
}
check('each creature comes only into its own zones', badHome.length === 0 && born.size > 20, { bad: badHome.slice(0, 5), born: born.size });
check('jellyfish stay out of the works', jellyWorks / jellyIn < 0.02, { jellyWorks, jellyIn });
check('spiders ride web lines', S.lineT > 1, S.lineT);
check('blasts and fire cut web lines', S.cut > 0, S.cut);
// fire on plants, the game's way: a vine burns from its tip up at firePlant × TITLE_FIRESPEED (owner, v0.0.165:
// a tenth), not all at once; an arch that catches is cut there (v0.0.165), each side hanging from its end, swinging
// down and burning up from the cut
{
  const P = titleScene(470, 4, 139, 295);
  P.still = true;   // (no one sawing through what's measured)
  for (let i = 0; i < 60 * 34 && !P.props.some(p => p.arc && p.x > 0 && p.x < 180); i++) { P.foes.length = 0; P.spawn = 99; titleStep(P, 1 / 60); }
  const vine = P.props.find(p => !p.arc && p.st === 'vine' && !p.host && p.len > 30), arch = P.props.find(p => p.arc && p.x > 0 && p.x < 180);
  if (vine) { vine.burn = 1; }
  const ends = arch && [[arch.ox, arch.y], [arch.ox + arch.arc[arch.arc.length - 1][0], arch.y + arch.arc[arch.arc.length - 1][1]]];
  if (arch) { arch.burn = 1; arch.u0 = arch.u1 = 0.5; }
  const len0 = vine ? vine.len : 0, T = 3, lo = G.DEV.firePlantLo * G.TITLE_FIRESPEED * T, hi = G.DEV.firePlantHi * G.TITLE_FIRESPEED * T;
  for (let i = 0; i < 60 * T; i++) { P.foes.length = 0; P.spawn = 99; titleStep(P, 1 / 60); }
  check('a burning vine shortens from its tip at a tenth of firePlant (3 s: still there)', !!vine && !vine.gone && len0 - vine.len > lo - 1 && len0 - vine.len < hi + 1,
    vine && { len0, len: vine.len, gone: vine.gone, lo, hi });
  const pieces = arch ? P.props.filter(p => p.st === 'vine' && p.links && ends.some(([x, y]) => Math.abs(p.ox - x) < 0.5 && Math.abs(p.y - y) < 0.5)) : [];
  const hang = pieces.map(p => { const q = G.vinePt(p, p.len); return { burn: p.burn, drop: !!p.drop, below: q.y, across: q.x, len: p.len }; });
  check('a burning arch is cut: each side hangs from its end, burning', !!arch && arch.gone && pieces.length === 2 && pieces.every(p => p.burn && !p.drop), { hang, arch: arch && { ox: arch.ox, y: arch.y, gone: arch.gone, ends }, linked: P.props.filter(p => p.links).map(p => [p.ox, p.y, p.st, p.drop, p.len, p.burn]) });
  check('…swung down under their weight (tips below their ends: a long one may still be swinging)', hang.length === 2 && hang.every(h => h.below > h.len * 0.3), hang);
}
// he never stays in the rock (owner saw him stuck under the floor): a safety net pops him back up
{
  let inRock = 0, steps = 0;
  for (const seed of [7, 11, 23]) {
    const T = titleScene(470, seed, 139, 295);
    for (let i = 0; i < 60 * 30; i++) {
      titleStep(T, 1 / 60); steps++;
      if (G.titleSolid(T, T.runner.x + 6, T.runner.y + 11)) inRock++;
    }
  }
  check('his middle is never left in the rock', inRock / steps < 0.002, { inRock, steps });
  // pushed into the rock (owner, v0.0.166: no more teleporting): out comes the Buzzsaw and he cuts his way out
  const T = titleScene(470, 7, 139, 295), ru = T.runner;
  ru.y = G.titleFloor(T.scroll + ru.x + 6, T) + 20;   // under the floor
  titleStep(T, 1 / 60);
  const y1 = ru.y, sawing = ru.dig > 0 && ru.kit.shot === 'saw';
  let out = false, back = false;
  for (let i = 0; i < 60 * 12 && !back; i++) { T.foes.length = 0; T.spawn = 99; titleStep(T, 1 / 60); if (!G.titleSolid(T, ru.x + 6, ru.y + 11)) out = true; if (!ru.dig) back = true; }
  check('pushed into the rock, he saws (no teleport) and gets out, his gun back', sawing && Math.abs(y1 - (G.titleFloor(T.scroll, T) + 20)) < 30 && T.pops === 0 && out && back && ru.kit.shot !== 'saw',
    { sawing, pops: T.pops, out, back, kit: ru.kit.shot });
}
// the lanterns (owner, v0.0.163): each chain hangs from rock or a frame's timber, right at its edge; a
// shot pops one into burning oil (the game's popLamp) that sets the fuel alight; one whose hold is
// blasted away falls and pops where it lands
{
  const holds = m => m === TM.ROCK || m === TM.MOSS || m === TM.BRICK || m === TM.WOOD || m === TM.CHAR || m === TM.BEAM || m === TM.BEAMD;
  const L = titleScene(470, 7, 139, 295);
  L.still = true;
  let lamps = 0, loose = 0;
  const seenL = new Set();
  for (let i = 0; i < 60 * 30; i++) {
    L.foes.length = 0; L.spawn = 99; L.runners.forEach(q => { q.cd = 9; }); titleStep(L, 1 / 60);
    for (const p of L.props) if (p.k === 'lamp' && !seenL.has(p)) {
      seenL.add(p); lamps++;
      const c = p.ac, r = Math.floor(p.y / TCELL);
      if (!holds(titleCell(L, c, r - 1)) || holds(titleCell(L, c, r))) loose++;
    }
  }
  check('every lantern\'s chain meets rock or a beam', lamps > 4 && loose === 0, { lamps, loose });
  // shoot one (on screen: go on until one is)
  for (let i = 0; i < 60 * 30 && !L.props.some(p => p.k === 'lamp' && !p.gone && !p.fall && p.x > 20 && p.x < 200); i++) { L.foes.length = 0; L.spawn = 99; L.runners.forEach(q => { q.cd = 9; }); titleStep(L, 1 / 60); }
  const lp = L.props.find(p => p.k === 'lamp' && !p.gone && !p.fall && p.x > 20 && p.x < 200);
  const burnt0 = L.burnt;
  if (lp) L.shots.push({ x: lp.x, y: lp.y + lp.len + 4, vx: 1, vy: 0, size: 2, col: '#fff', look: '', life: 1, foe: false, spin: 0, grav: 0, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0, pierce: 0, dmg: 1 });
  titleStep(L, 1 / 60);
  const embers = L.parts.filter(q => q.kind === 'ember').length;
  for (let i = 0; i < 90; i++) { L.foes.length = 0; L.runners.forEach(q => { q.cd = 9; }); titleStep(L, 1 / 60); }
  check('a shot pops a lantern into burning oil that lights the fuel', !!lp && lp.gone && embers >= 8 && L.lampsPopped > 0 && L.burnt > burnt0, { found: !!lp, gone: lp && lp.gone, embers, burnt0, burnt: L.burnt });
  // blast its hold away
  const L2 = titleScene(470, 7, 139, 295);
  L2.still = true;
  let lq = null;
  for (let i = 0; i < 60 * 40 && !lq; i++) {
    L2.foes.length = 0; L2.spawn = 99; L2.runners.forEach(q => { q.cd = 9; }); titleStep(L2, 1 / 60);
    lq = L2.props.find(p => p.k === 'lamp' && !p.gone && p.x > 60 && p.x < 200) || null;
  }
  if (lq) G.titleCarve(L2, lq.x, lq.y - 1, 5);
  let fell = false;
  for (let i = 0; i < 120 && lq && !lq.gone; i++) { L2.foes.length = 0; L2.runners.forEach(q => { q.cd = 9; }); titleStep(L2, 1 / 60); if (lq.fall) fell = true; }
  check('its hold blasted away, a lantern falls and pops', !!lq && fell && lq.gone, { found: !!lq, fell, gone: lq && lq.gone });
}
check('shots carve the terrain', S.carved > 30, S.carved);
check('and fire burns', S.burnt > 10, S.burnt);
// a blast by hand: a hole in the floor where it was
const B = titleScene(470, 5, 139, 295);
const floorAt = () => { const c = Math.floor((B.scroll + 100) / TCELL); for (let r = 75; r < B.rows; r++) if (titleCell(B, c, r)) return r * TCELL; return -1; };
const y0 = floorAt();
const n = titleCarve(B, 100, y0 + 2, 8);
check('a blast removes terrain', n > 20 && floorAt() > y0 + 6, { n, y0, y1: floorAt() });
// a flame on moss: it catches
const C = titleScene(470, 9, 139, 295);
let mossAt = null;
for (let c = C.gen - 100; c < C.gen && !mossAt; c++) for (let r = 100; r < C.rows; r++) if (titleCell(C, c, r) === TM.MOSS) { mossAt = { c, r }; break; }
if (mossAt) titleIgnite(C, (mossAt.c + 0.5) * TCELL - C.scroll, (mossAt.r + 0.5) * TCELL, 3);
check('moss catches fire', !!mossAt && C.fire.length > 0, mossAt);
// fire jumps (owner, v0.0.164): a burning piece of silk lights a web it hangs along, not one further off; a
// burning vine lights a web along it, and a burning web a vine beside it. Lit webs are cut (v0.0.165): into two
// burning halves, which hang from an end on the roof and fall from one in the air
{
  const quiet = (Q, n) => { for (let i = 0; i < n; i++) { Q.foes.length = 0; Q.spawn = 99; Q.still = true; titleStep(Q, 1 / 60); } };
  const web = (Q, x0, y0, x1, y1) => { const L = { ax: x0, ay: y0, bx: x1, by: y1, a0x: x0, a0y: y0, b0x: x1, b0y: y1, ain: null, bin: { x: x1, y: y1 }, owner: null, sag: 0 }; Q.webs.push(L); return L; };
  const caught = L => !!(L.fu || L.out);
  const J = titleScene(470, 7, 139, 295);
  quiet(J, 30);
  const wx = J.scroll + 150, y = 200;
  J.props.push({ k: 'climb', st: 'silk', ox: wx, x: 0, y, len: 30, seed: 0, side: 1, burn: 1 });
  const L2 = web(J, wx + 2, y, wx + 2, y + 30), L3 = web(J, wx + 25, y, wx + 25, y + 30);
  quiet(J, 180);
  check('burning silk lights the web it hangs along', caught(L2), L2.out);
  check('…but not one further off', !caught(L3), L3.out);
  // a web from the roof to the roof, lit: two burning halves hang from its ends; one in the air: they fall
  const K = titleScene(470, 7, 139, 295);
  quiet(K, 30);
  const x0 = K.scroll + 60, x1 = K.scroll + 100, c0 = G.titleCeil(x0, K) + 0.6, c1 = G.titleCeil(x1, K) + 0.6;
  const R1 = web(K, x0, c0, x1, c1), A1 = web(K, x0, 225, x1, 225);
  R1.fu = [0.5, 0.5]; A1.fu = [0.5, 0.5];
  quiet(K, 2);
  const silk = K.props.filter(p => p.st === 'silk');
  const roof = silk.filter(p => Math.abs(p.y - c0) < 0.1 || Math.abs(p.y - c1) < 0.1), air = silk.filter(p => p.y > 220);
  check('a lit web is cut into two burning halves', R1.out && A1.out && roof.length === 2 && roof.every(p => p.burn), roof.map(p => ({ y: p.y, burn: p.burn, drop: p.drop })));
  check('…held at the roof they hang; in the air they fall', roof.every(p => !p.drop) && air.length === 2 && air.every(p => p.drop), { roof: roof.map(p => p.drop), air: air.map(p => p.drop) });
  // vines: two hanging ones in view, unburnt, apart
  const V = titleScene(470, 7, 139, 295);
  let vines = [];
  for (let i = 0; i < 60 * 40 && vines.length < 2; i++) {   // (as far as the grove if need be)
    quiet(V, 1);
    vines = [];
    for (const p of V.props.filter(p => p.k === 'climb' && p.st === 'vine' && !p.arc && !p.host && !p.links && !p.burn && p.len > 20 && p.x > 30 && p.x < 190).sort((a, b) => a.ox - b.ox))
      if (!vines.length || p.ox - vines[vines.length - 1].ox > 30) vines.push(p);
  }
  const [va, vb] = vines;
  if (va && vb) {
    const Wa = web(V, va.ox + 3, va.y + 2, va.ox + 3, va.y + va.len);   // along the burning vine
    const Wb = web(V, vb.ox + 3, vb.y + 2, vb.ox + 3, vb.y + vb.len);   // along the other: lit by hand
    va.burn = 1; Wb.fu = [0.5, 0.5];
    quiet(V, 240);
    check('a burning vine lights a web along it', caught(Wa), Wa.out);
    check('a burning web lights a vine beside it', !!vb.burn || vb.gone, { burn: vb.burn, gone: vb.gone });
  } else check('two vines in view for the fire test', false, vines.length);
}
// the players push the vines they pass (the game's vinePush, swingStep): a vine one runs through swings
{
  const Q = titleScene(470, 7, 139, 295);
  let swung = 0, touched = 0;
  for (let i = 0; i < 60 * 20; i++) {
    titleStep(Q, 1 / 60);
    for (const p of Q.props) if (p.k === 'climb' && !p.arc && !p.links && !p.host && p.sw && Math.abs(p.sw) > 0.05) swung++;
    for (const L of Q.webs) if (L.wx || L.wy) touched++;
  }
  check('vines swing as the players pass them', swung > 10, { swung, touched });
}
// he waits for a creature to come near (owner, v0.0.164): none fired at past TITLE_AIM, one fired at inside it
{
  const H = titleScene(470, 7, 139, 295);
  for (let i = 0; i < 600 && !H.foes.length; i++) titleStep(H, 1 / 60);
  const f = H.foes[0], r = H.runner;
  H.foes.length = 1;
  const shotsAt = dx => {
    for (const q of H.runners) if (q !== r) { q.cd = 9; q.swapT = 9; }   // just player 1
    r.x = 40; r.cd = 0; r.swap = 0; r.swapT = 9;
    f.x = H.scroll + r.x + dx; f.y = f.ty = r.y; f.hp = f.hpMax;
    const n0 = H.shots.length + H.zaps.length;
    H.spawn = 99; titleStep(H, 1 / 60);
    return H.shots.length + H.zaps.length - n0;
  };
  const far = shotsAt(G.TITLE_AIM + 25), near = shotsAt(G.TITLE_AIM - 30);
  check('he holds fire on a creature past TITLE_AIM, fires on one inside it', !!f && far <= 0 && near > 0, { far, near });
}
const A = titleScene(470, 3, 139, 295), A2 = titleScene(470, 3, 139, 295);
for (let i = 0; i < 300; i++) { titleStep(A, 1 / 60); titleStep(A2, 1 / 60); }
check('same seed, same scene', A.kills === A2.kills && A.runner.x === A2.runner.x && A.carved === A2.carved);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
