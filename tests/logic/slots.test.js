// Save slots and the title scene (LIST4 #3, #4; the scene redone in v0.0.161): slotKey keeps slot 1
// on the old keys and gives slots 2/3 their own, slotSummary reads a run for the title's slot line,
// and the title's scene (art/titlescene.js): one runner who runs on the ground and jetpacks, through
// Mossy Caves' zones, swapping real guns (gun art + shot mods), killing only floor 1's creatures, whose
// gold he vacuums up; blasts carve the terrain and fire burns moss, timber and plants; all within caps.
const { slotKey, slotSummary, SAVE_KEY, COLLECTION_KEY, PERK_COLLECTION_KEY, SLOTS,
  titleScene, titleStep, titleCell, titleZone, titleCarve, titleIgnite, TM, TCELL, TITLE_KITS, TITLE_KINDS, ROSTERS, MODS, gunArt,
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
let jellyIn = 0, jellyWorks = 0, pulledFar = 0, pulled = 0, oddNug = 0, nugs = 0;
const flew = new Set();
for (let i = 0; i < 60 * 40; i++) {
  titleStep(S, 1 / 60);
  maxFoes = Math.max(maxFoes, S.foes.length); maxParts = Math.max(maxParts, S.parts.length);
  maxGold = Math.max(maxGold, S.coins.length); maxFire = Math.max(maxFire, S.fire.length);
  const r = S.runner, pcx = S.scroll + r.x + 6, pcy = r.y + 11;
  zones.add(titleZone(S.scroll + r.x)); kits.add(r.kit);
  for (const f of S.foes) {
    const id = f.k.id;
    seenKinds.add(id);
    // where each one first shows: a zone that's home to it (TITLE_HOME); jellyfish stay out of the works
    if (!born.has(f)) { born.add(f); const z = titleZone(f.x); if (!G.TITLE_HOME[z].some(h => h[0] === id)) badHome.push([id, z]); }
    if (id === 'meduusa' && f.x - S.scroll > 0 && f.x - S.scroll < 220) { jellyIn++; const z = titleZone(f.x); if ((z === 'timber' || z === 'paved') && Math.min(f.x % 280, 280 - f.x % 280) > 60) jellyWorks++; }
    // run by the game's brains: each has its brain state (e.je / e.sp / e.ra) after its first frame
    if (born.has(f) && (id === 'meduusa' ? f.je : id === 'hamahakki' ? f.sp : f.ra)) brains++; else noBrain++;
    // the game's aggro: never still hunting past its reach × loseAggro
    if (f.aggro && Math.hypot(pcx - f.x, pcy - f.ty) > f.k.aggro / G.DEV.zoom * G.DEV.aggro * (f.aggroM || 1) * G.DEV.loseAggro + 10) aggroFar++;   // (it and he move on after its check, in the frame)
  }
  for (const L of S.webs) if (L.owner) spun.add(L);
  // the gold: the game's nuggets (25 / 5 / 1), pulled to him only from within COIN_PULL
  for (const g of S.coins) {
    if (!flew.has(g)) { nugs++; if (![25, 5, 1].includes(g.amount)) oddNug++; }
    if (g.fly && !flew.has(g)) { flew.add(g); pulled++; if (Math.hypot(pcx - g.x, pcy - g.y) > G.COIN_PULL + 6) pulledFar++; }
    if (!g.fly && !flew.has(g)) flew.add(g), flew.delete(g);
  }
  if (r.mode === 'run' && r.ground) {
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
check('he runs on the ground and he flies', S.groundT > 6 && S.flyT > 6, { ground: S.groundT, fly: S.flyT });
check('running, his feet are on the floor', onFloor > 200 && feetOff / onFloor < 0.05, { onFloor, feetOff });
check('he stays on screen', S.runner.x > 0 && S.runner.x < 220 && S.runner.y > S.top - 40 && S.runner.y < S.bot, [S.runner.x, S.runner.y]);
check('he swaps guns', S.swaps >= 5 && kits.size >= 4, { swaps: S.swaps, kits: kits.size });
check('every gun is a real gun skin and a real shot', TITLE_KITS.every(K => gunArt(K.art) && MODS[K.mod] && MODS[K.mod].kind === 'shot'));
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
// fire on plants, the game's way: a vine burns from its tip up at firePlant, not all at once;
// an arch burns out both ways from where it caught at fireArch
{
  const P = titleScene(470, 4, 139, 295);
  for (let i = 0; i < 60 * 34 && !P.props.some(p => p.arc); i++) { P.foes.length = 0; P.spawn = 99; titleStep(P, 1 / 60); }
  const vine = P.props.find(p => !p.arc && p.st === 'vine' && p.len > 30), arch = P.props.find(p => p.arc);
  if (vine) { vine.burn = 1; }
  if (arch) { arch.burn = 1; arch.u0 = arch.u1 = 0.5; }
  const len0 = vine ? vine.len : 0;
  for (let i = 0; i < 30; i++) { P.foes.length = 0; titleStep(P, 1 / 60); }
  check('a burning vine shortens from its tip at firePlant (half a second: still there)', !!vine && !vine.gone && vine.len < len0 - 1 && Math.abs(len0 - vine.len - G.DEV.firePlantLo * 0.5) < (G.DEV.firePlantHi - G.DEV.firePlantLo) * 0.5 + 3,
    vine && { len0, len: vine.len, gone: vine.gone });
  check('a burning arch burns out both ways from where it caught', !!arch && arch.u0 < 0.5 && arch.u1 > 0.5 && !(arch.u0 <= 0 && arch.u1 >= 1), arch && { u0: arch.u0, u1: arch.u1 });
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
  const T = titleScene(470, 7, 139, 295);
  T.runner.y = G.titleFloor(T.scroll + T.runner.x + 6, T) + 30;   // deep under the floor
  titleStep(T, 1 / 60);
  check('pushed under the floor, he\'s popped back up onto it', T.runner.y + 22 <= G.titleFloor(T.scroll + T.runner.x + 6, T) + 4 && T.pops > 0, { y: T.runner.y, floor: G.titleFloor(T.scroll + T.runner.x + 6, T) });
}
// the lanterns (owner, v0.0.163): each chain hangs from rock or a frame's timber, right at its edge; a
// shot pops one into burning oil (the game's popLamp) that sets the fuel alight; one whose hold is
// blasted away falls and pops where it lands
{
  const holds = m => m === TM.ROCK || m === TM.MOSS || m === TM.BRICK || m === TM.WOOD || m === TM.CHAR || m === TM.BEAM || m === TM.BEAMD;
  const L = titleScene(470, 7, 139, 295);
  let lamps = 0, loose = 0;
  const seenL = new Set();
  for (let i = 0; i < 60 * 30; i++) {
    L.foes.length = 0; L.spawn = 99; L.runner.cd = 9; titleStep(L, 1 / 60);
    for (const p of L.props) if (p.k === 'lamp' && !seenL.has(p)) {
      seenL.add(p); lamps++;
      const c = p.ac, r = Math.floor(p.y / TCELL);
      if (!holds(titleCell(L, c, r - 1)) || holds(titleCell(L, c, r))) loose++;
    }
  }
  check('every lantern\'s chain meets rock or a beam', lamps > 4 && loose === 0, { lamps, loose });
  // shoot one
  const lp = L.props.find(p => p.k === 'lamp' && p.x > 20 && p.x < 200);
  const burnt0 = L.burnt;
  if (lp) L.shots.push({ x: lp.x, y: lp.y + lp.len + 4, vx: 1, vy: 0, size: 2, col: '#fff', look: '', life: 1, foe: false, spin: 0, grav: 0, drag: 0, explode: 0, pit: 0, fire: 0, bounce: 0, bounceE: 0, pierce: 0, dmg: 1 });
  titleStep(L, 1 / 60);
  const embers = L.parts.filter(q => q.kind === 'ember').length;
  for (let i = 0; i < 90; i++) { L.foes.length = 0; L.runner.cd = 9; titleStep(L, 1 / 60); }
  check('a shot pops a lantern into burning oil that lights the fuel', !!lp && lp.gone && embers >= 8 && L.lampsPopped > 0 && L.burnt > burnt0, { found: !!lp, gone: lp && lp.gone, embers, burnt0, burnt: L.burnt });
  // blast its hold away
  const L2 = titleScene(470, 7, 139, 295);
  let lq = null;
  for (let i = 0; i < 60 * 40 && !lq; i++) {
    L2.foes.length = 0; L2.spawn = 99; L2.runner.cd = 9; titleStep(L2, 1 / 60);
    lq = L2.props.find(p => p.k === 'lamp' && !p.gone && p.x > 60 && p.x < 200) || null;
  }
  if (lq) G.titleCarve(L2, lq.x, lq.y - 1, 5);
  let fell = false;
  for (let i = 0; i < 120 && lq && !lq.gone; i++) { L2.foes.length = 0; L2.runner.cd = 9; titleStep(L2, 1 / 60); if (lq.fall) fell = true; }
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
// fire jumps (owner, v0.0.164): a burning web line lights one it nearly touches, not one further off;
// a burning vine lights a web along it, and a burning web a vine beside it
{
  const quiet = (Q, n) => { for (let i = 0; i < n; i++) { Q.foes.length = 0; Q.spawn = 99; Q.runner.cd = 9; titleStep(Q, 1 / 60); } };
  const web = (Q, x0, y0, x1, y1) => { const L = { ax: x0, ay: y0, bx: x1, by: y1, a0x: x0, a0y: y0, b0x: x1, b0y: y1, ain: null, bin: { x: x1, y: y1 }, owner: null, sag: 0 }; Q.webs.push(L); return L; };
  const caught = L => !!(L.fu || L.out);
  const J = titleScene(470, 7, 139, 295);
  quiet(J, 30);
  const wx = J.scroll + 150, y = 220;
  const L1 = web(J, wx - 20, y, wx + 20, y), L2 = web(J, wx - 20, y + G.TITLE_JUMP - 2, wx + 20, y + G.TITLE_JUMP - 2), L3 = web(J, wx - 20, y + 25, wx + 20, y + 25);
  L1.fu = [0.5, 0.5];
  quiet(J, 120);
  check('a burning web lights the web it nearly touches', caught(L2) && L1.out, { L1: L1.fu || L1.out, L2: L2.fu || L2.out });
  check('…but not one further off', !caught(L3), L3.fu);
  // vines: two hanging ones in view, unburnt
  const V = titleScene(470, 7, 139, 295);
  let vines = [];
  for (let i = 0; i < 60 * 20 && vines.length < 2; i++) {
    quiet(V, 1);
    vines = V.props.filter(p => p.k === 'climb' && p.st === 'vine' && !p.arc && !p.host && !p.burn && p.len > 20 && p.x > 30 && p.x < 190);
    vines = vines.filter((p, k) => !vines.some((o, j) => j !== k && Math.abs(o.ox - p.ox) < 30));
  }
  const [va, vb] = vines;
  if (va && vb) {
    const Wa = web(V, va.ox + 3, va.y + 2, va.ox + 3, va.y + va.len);   // along the burning vine
    const Wb = web(V, vb.ox + 3, vb.y + 2, vb.ox + 3, vb.y + vb.len);   // along the other: lit by hand
    va.burn = 1; Wb.fu = [0.5, 0.5];
    quiet(V, 90);
    check('a burning vine lights a web along it', caught(Wa), Wa.fu);
    check('a burning web lights a vine beside it', !!vb.burn || vb.gone, { burn: vb.burn, gone: vb.gone });
  } else check('two vines in view for the fire test', false, vines.length);
}
// he waits for a creature to come near (owner, v0.0.164): none fired at past TITLE_AIM, one fired at inside it
{
  const H = titleScene(470, 7, 139, 295);
  for (let i = 0; i < 600 && !H.foes.length; i++) titleStep(H, 1 / 60);
  const f = H.foes[0], r = H.runner;
  H.foes.length = 1;
  const shotsAt = dx => {
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
