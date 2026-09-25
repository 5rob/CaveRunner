// Floors have identities, and they have to hold still.
//
// Two things are being proved here. First, that a floor's palette and its roster of
// creatures are decided by the floor number alone and not by the level seed — that is
// what makes floor 3 the frozen one with the snipers on every run, which is the whole
// point of the change. Second, that the creatures actually differ from each other and
// get harder as you climb, rather than being one drone in sixteen hats.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } }\n';
const game = new Function('React', shim + upto +
  'return { makeLevel, themeFor, THEMES, rosterFor, ROSTERS, CREATURES, CREATURE_IDS, enemyFor, ENEMY_COUNT };')(
  { createElement: () => {} });
const { makeLevel, themeFor, THEMES, rosterFor, ROSTERS, CREATURES, CREATURE_IDS, enemyFor, ENEMY_COUNT } = game;

let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

// ---- the palette is the floor's own ----
const CHANNELS = ['bg', 'bg2', 'rock', 'moss', 'brick', 'bed'];
const okTheme = t => t && typeof t.name === 'string' && t.name.length &&
  CHANNELS.every(k => Array.isArray(t[k]) && (k === 'rock' || k === 'moss' || k === 'brick' || k === 'bed'
    ? t[k].length === 2 && t[k].every(c => Array.isArray(c) && c.length === 3 && c.every(v => v >= 0 && v <= 255))
    : t[k].length === 3 && t[k].every(v => v >= 0 && v <= 255))) &&
  Array.isArray(t.mortar) && t.mortar.length === 3;

check('every theme is a full palette', THEMES.every(okTheme), THEMES.filter(t => !okTheme(t)).map(t => t.name));
check('the themes have distinct names', new Set(THEMES.map(t => t.name)).size === THEMES.length);
check('and distinct backgrounds, so two floors cannot look alike',
  new Set(THEMES.map(t => t.bg.join(','))).size === THEMES.length);

// the same floor always gets the same palette — across calls, across seeds, across runs
let stable = true, wrapped = true, offByOne = true;
for (let f = 1; f <= THEMES.length * 2 + 3; f++) {
  const t = themeFor(f);
  if (t !== THEMES[(f - 1) % THEMES.length]) stable = false;
  if (f <= THEMES.length && !okTheme(t)) stable = false;
  if (f > THEMES.length && themeFor(f) !== themeFor(f - THEMES.length)) wrapped = false;
}
check('themeFor is a pure function of the floor', stable);
check('and wraps once the list runs out', wrapped);
check('floor 1 is the first theme, floor 2 the second',
  themeFor(1) === THEMES[0] && themeFor(2) === THEMES[1] && themeFor(1) !== themeFor(2));
check('floor 0 and negatives still land on a real theme', okTheme(themeFor(0)) && okTheme(themeFor(-5)));

// makeLevel must paint with the floor's palette, not the last one it used
let painted = 0, paintedN = 0;
for (const f of [1, 3, 7, THEMES.length + 2]) {
  const lv = makeLevel(12345, f);
  paintedN++;
  if (lv.theme === themeFor(f).name) painted++;
  // the background image is built from the theme's bg/bg2, so its darkest pixels
  // should be near the theme's bg and not some other floor's
  const bg = themeFor(f).bg;
  let close = 0, total = 0;
  for (let i = 0; i < lv.bgImg.data.length; i += 4) {
    total++;
    if (Math.abs(lv.bgImg.data[i] - bg[0]) < 12 && Math.abs(lv.bgImg.data[i + 1] - bg[1]) < 12 &&
        Math.abs(lv.bgImg.data[i + 2] - bg[2]) < 12) close++;
  }
  if (close / total > 0.05) painted++;      // some of the background is that floor's darkest shade
}
check('makeLevel paints the floor it was asked for', painted === paintedN * 2, `${painted}/${paintedN * 2}`);
check('and reports the theme name', makeLevel(1, 4).theme === themeFor(4).name, makeLevel(1, 4).theme);

// ---- rosters: 2-6 creatures, fixed to the floor ----
let sizeOk = 0, knownOk = 0, uniqueOk = 0, repeatOk = 0;
for (let f = 1; f <= 10; f++) {
  const r = rosterFor(f);
  if (r.length >= 2 && r.length <= 6) sizeOk++;
  if (r.every(id => CREATURES[id])) knownOk++;
  if (new Set(r).size === r.length) uniqueOk++;
  // the point of the exercise: same floor, same creatures, every time
  if (rosterFor(f).join() === r.join() && rosterFor(f, Math.random).join() === r.join()) repeatOk++;
}
check('floors 1-10 each have 2-6 creatures', sizeOk === 10, sizeOk);
check('all of them are real creatures', knownOk === 10);
check('and none is listed twice', uniqueOk === 10);
check('a fixed floor ignores the seed and gives the same roster', repeatOk === 10);

check('the fixed rosters are not all the same roster',
  new Set(ROSTERS.map(r => r.slice().sort().join())).size === ROSTERS.length);
check('floor 1 is the gentlest roster there is',
  ROSTERS[0].every(id => CREATURES[id].hp <= 4), ROSTERS[0]);

// past floor 10 the roster is rolled, and rolled differently as the seed changes
const seen = new Set();
for (let s = 1; s <= 40; s++) seen.add(rosterFor(11, (() => { let i = s * 7919; return () => (i = (i * 1103515245 + 12345) % 2147483648) / 2147483648; })()).join());
check('past floor 10 the roster is randomised', seen.size > 5, seen.size);
let lateOk = true;
for (let s = 0; s < 200; s++) {
  const r = rosterFor(11 + (s % 7), Math.random);
  if (r.length < 2 || r.length > 6 || new Set(r).size !== r.length || !r.every(id => CREATURES[id])) lateOk = false;
}
check('and still a legal 2-6 of real creatures', lateOk);

// ---- creatures differ from one another ----
check('there are enough creatures to keep floors apart', CREATURE_IDS.length >= 12, CREATURE_IDS.length);
check('every creature has a name, a body and a colour set',
  CREATURE_IDS.every(id => {
    const c = CREATURES[id];
    return c.name && c.body && c.col && c.col.a && c.col.b && c.col.c && c.col.eye &&
      c.hp > 0 && c.dmg > 0 && c.gold > 0 && c.r > 0;
  }));
const acts = new Set(CREATURE_IDS.map(id => CREATURES[id].act));
check('they do not all behave the same way', acts.size >= 3, [...acts]);
const bodies = new Set(CREATURE_IDS.map(id => CREATURES[id].body));
check('and they do not all look the same', bodies.size >= 4, [...bodies]);
check('every body has a sprite in the game', [...bodies].every(b =>
  src.includes('draw' + b[0].toUpperCase() + b.slice(1) + '(ctx')));
check('only shooters and turrets are given a gun',
  CREATURE_IDS.every(id => {
    const c = CREATURES[id];
    return (c.act === 'shoot' || c.act === 'turret') ? c.bspd > 0 && c.range > 0 && c.cd > 0
                                                     : !c.bspd && !c.range;
  }));
check('only chasers, bombers and spiders are given an aggro range',
  CREATURE_IDS.every(id => {
    const c = CREATURES[id];
    return (c.act === 'chase' || c.act === 'bomb' || c.act === 'spider') ? c.aggro > 0 && c.spd > 0 : !c.aggro;
  }));
check('a wind-up is only on a turret', CREATURE_IDS.every(id =>
  !CREATURES[id].tele || CREATURES[id].act === 'turret'));

// ---- stats and gold climb with the floor ----
let hpUp = true, goldUp = true, dmgUp = true, noDrop = true;
for (const id of CREATURE_IDS) {
  const a = enemyFor(id, 1), b = enemyFor(id, 5), c = enemyFor(id, 10);
  if (!(a.hp <= b.hp && b.hp <= c.hp)) hpUp = false;
  if (!(a.gold <= b.gold && b.gold <= c.gold)) goldUp = false;
  if (!(a.dmg <= b.dmg && b.dmg <= c.dmg)) dmgUp = false;
  if (c.hp < a.hp || c.gold < a.gold) noDrop = false;
}
check('health climbs with the floor', hpUp);
check('gold climbs with the floor', goldUp);
check('damage climbs with the floor', dmgUp);
check('nothing gets weaker further up', noDrop);
check('a floor 10 creature is worth a lot more than a floor 1 one',
  enemyFor('hiisi', 10).gold > enemyFor('hiisi', 1).gold * 2,
  [enemyFor('hiisi', 1).gold, enemyFor('hiisi', 10).gold]);
check('the lift is real, not rounding noise: floor 1 is not already floor 10',
  CREATURE_IDS.some(id => enemyFor(id, 10).hp > enemyFor(id, 1).hp * 2));
check('gold is always worth at least 1 and health at least 1',
  CREATURE_IDS.every(id => [1, 4, 9].every(f => enemyFor(id, f).gold >= 1 && enemyFor(id, f).hp >= 1)));
check('stats stay whole numbers, so the health bar reads right',
  CREATURE_IDS.every(id => [1, 7].every(f => {
    const k = enemyFor(id, f);
    return Number.isInteger(k.hp) && Number.isInteger(k.dmg) && Number.isInteger(k.gold) && Number.isInteger(k.bspd);
  })));

// ---- and the level actually spawns them ----
let spawnOk = 0, mixed = 0, seeded = 0, counted = 0;
for (let seed = 1; seed <= 12; seed++) {
  for (const f of [1, 4, 6, 9, 12]) {
    const lv = makeLevel(seed * 31 + f, f);
    counted++;
    const ids = lv.enemies.map(e => e.k.id);
    if (ids.every(id => lv.roster.includes(id))) spawnOk++;
    if (new Set(ids).size === lv.roster.length || lv.roster.length === 1) mixed++;
    if (lv.enemies.every(e => e.hp === e.hpMax && e.hpMax === enemyFor(e.k.id, f).hp)) seeded++;
  }
}
check('every enemy on a floor comes off that floor\'s roster', spawnOk === counted, `${spawnOk}/${counted}`);
check('and the whole roster turns up, not just the first one', mixed === counted, `${mixed}/${counted}`);
check('each one is spawned with its own floor-scaled health', seeded === counted, `${seeded}/${counted}`);

const f1 = makeLevel(7, 1), f9 = makeLevel(7, 9);
check('a floor 1 level is gentler than a floor 9 one',
  Math.max(...f1.enemies.map(e => e.hp)) < Math.max(...f9.enemies.map(e => e.hp)),
  [Math.max(...f1.enemies.map(e => e.hp)), Math.max(...f9.enemies.map(e => e.hp))]);
check('deeper floors still hold more enemies', f9.enemies.length > f1.enemies.length,
  [f1.enemies.length, f9.enemies.length]);
check('the spawn count still tops out', makeLevel(3, 40).enemies.length <= 136,
  makeLevel(3, 40).enemies.length);
check('every spawned enemy can be drawn and shot',
  f9.enemies.every(e => e.k && e.k.col && e.k.col.a && e.r > 0 && e.hpMax > 0 && e.k.body));

// the aim line, homing and the field code all read e.ty, which must stay a number
check('the hover offset is still a finite number', f9.enemies.every(e => Number.isFinite(e.ty)));

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
