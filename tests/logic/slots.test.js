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
let maxFoes = 0, maxParts = 0, maxGold = 0, maxFire = 0, onFloor = 0, feetOff = 0;
const zones = new Set(), kits = new Set(), seenKinds = new Set(), born = new Set(), badHome = [];
let jellyIn = 0, jellyWorks = 0;
for (let i = 0; i < 60 * 40; i++) {
  titleStep(S, 1 / 60);
  maxFoes = Math.max(maxFoes, S.foes.length); maxParts = Math.max(maxParts, S.parts.length);
  maxGold = Math.max(maxGold, S.nuggets.length); maxFire = Math.max(maxFire, S.fire.length);
  const r = S.runner;
  zones.add(titleZone(S.scroll + r.x)); kits.add(r.kit);
  for (const f of S.foes) {
    seenKinds.add(f.k);
    // where each one first shows: a zone that's home to it (TITLE_HOME); jellyfish stay out of the works
    if (!born.has(f)) { born.add(f); const z = titleZone(S.scroll + f.x); if (!G.TITLE_HOME[z].some(h => h[0] === f.k)) badHome.push([f.k, z]); }
    if (f.k === 'meduusa' && f.x > 0 && f.x < 220) { jellyIn++; const z = titleZone(S.scroll + f.x); if ((z === 'timber' || z === 'paved') && Math.min((S.scroll + f.x) % 280, 280 - (S.scroll + f.x) % 280) > 60) jellyWorks++; }
  }
  if (r.mode === 'run' && r.ground) {
    // feet on the floor: the cell just under his feet is solid, the one at his shins isn't rock
    onFloor++;
    const c = Math.floor((S.scroll + r.x + 6) / TCELL), fr = Math.floor((r.y + 22 + 0.5) / TCELL);
    if (!titleCell(S, c, fr) || titleCell(S, c, fr - 3) === TM.ROCK) feetOff++;
  }
}
check('the title scene kills creatures', S.kills >= 15, S.kills);
check('and drops gold', S.gold >= 30, S.gold);
check('he vacuums the gold up', S.got >= S.gold * 0.6, { got: S.got, gold: S.gold });
check("only floor 1's creatures (its roster and its rats)", [...seenKinds].every(k => TITLE_KINDS.includes(k))
  && TITLE_KINDS.every(k => k === 'rotta' || ROSTERS[0].includes(k)) && seenKinds.has('rotta') && seenKinds.size >= 2, [...seenKinds]);
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
check('spiders walk the web lines', S.lineT > 3, S.lineT);
check('blasts and fire cut web lines', S.cut > 0, S.cut);
check('spiders let themselves down on silk threads', S.dropT > 1, S.dropT);
// a thread drop on its own: down, a hang, back up to the roof where it started
{
  const T = titleScene(470, 3, 139, 295), spd = T.foes.find(f => f.k === 'hamahakki') || null;
  const f = spd || { x: 100, y: 0, vx: 0, vy: 0, r: 4, hp: 4, k: 'hamahakki', flash: 0, phase: 0, cd: 0, surf: -1, spd: 16, br: { mode: 'surf', on: 1, nx: 0, ny: 1, side: 1 } };
  if (!spd) T.foes.push(f);
  f.hp = 1e9; f.L = null; f.surf = -1; f.br.mode = 'surf'; f.x = 200; f.y = G.titleCeil(T.scroll + 200, T) + f.r * 0.9; f.walkT = 0;   // from the right: the whole drop on screen
  let deepest = 0, back = false, tries = 0;
  // force the roll: step until it drops (the roll is 35% per look)
  for (let i = 0; i < 60 * 30 && !back; i++) {
    T.foes = T.foes.filter(q => q === f); T.spawn = 99;
    titleStep(T, 1 / 60);
    if (f.drop) { if (!tries) f.drop.max = Math.min(f.drop.max, 24); tries++; deepest = Math.max(deepest, f.drop.len); }
    else if (tries && f.br.mode === 'surf' && f.surf < 0) back = true;
  }
  check('a thread drop goes down a way and comes back up to the roof', deepest > 15 && back && f.x > 0, { deepest, back, tries });
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
const A = titleScene(470, 3, 139, 295), A2 = titleScene(470, 3, 139, 295);
for (let i = 0; i < 300; i++) { titleStep(A, 1 / 60); titleStep(A2, 1 / 60); }
check('same seed, same scene', A.kills === A2.kills && A.runner.x === A2.runner.x && A.carved === A2.carved);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
