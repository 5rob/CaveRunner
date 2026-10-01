// @ts-check
// The Dev panel's knobs: DEV (the live values the game reads every frame, saved to
// localStorage), their defaults, rows and groups, and the range / colour knob tables.
// Every table registers its rows before DEV is built from the defaults below, so they all
// live here for now (REFACTOR.md, D11).

import { HEX_RE, hexMix, hsvAdjust } from '../core/util.js';

// ---- dev settings ----
// Live, tweakable knobs for testing, read by the Game every frame so a change shows at
// once, and saved to localStorage so they survive a reload and carry across sessions.
// Each has a default; clearing a field in the dev panel puts the default back. Every
// localStorage touch is wrapped: it throws in a private window and does not exist at all
// under Node (the logic tests eval this file), and a missing store just means "defaults".
/** @type {DevKnobs} */
export const DEV_DEFAULTS = { zoom: 1.6, torch: 0.5, fogDark: 0.99, fogDim: 0.85, move: 1, sputDip: 45, aggro: 0.6, loseAggro: 2, aimDist: 44, bhPull: 65, bhSpeed: 50, vol: 1, amb: 0.4, jetVol: 0.2,
  vSpell: 0.6, vBoom: 1, vHit: 1, vEnemy: 1, vEnemyFire: 1, vWorld: 1, vDrip: 1, vStep: 1, vUi: 1, bagSpeed: 1,
  holoAlpha: 1, bloom: 0.8, bloomBlur: 8, bloomBright: 1.3, pixelFx: 1, holoPx: 2,
  holoMin: 0, holoMax: 1, holoFade: 3, holoC1x: 0.25, holoC1y: 1, holoC2x: 0.5, holoC2y: 0 };
// g: the collapsible group the knob sits in on the Dev panel (DEV_GROUPS gives the order)
/** @type {DevRow[]} */
export const DEV_META = [
  { k: 'zoom',      g: 'view',  label: 'Camera zoom',                 min: 0.3, max: 3,  step: 0.05 },
  { k: 'aimDist',   g: 'view',  label: 'Crosshair distance',          min: 10,  max: 200, step: 2 },
  { k: 'torch',     g: 'light', label: 'Torch fall-off distance',     min: 0.2, max: 5,  step: 0.05 },
  { k: 'fogDark',   g: 'light', label: 'Fog of war darkness',         min: 0,   max: 1,  step: 0.01 },
  { k: 'fogDim',    g: 'light', label: 'Outside-torchlight darkness', min: 0,   max: 1,  step: 0.01 },
  { k: 'move',      g: 'player', label: 'Base movement speed',        min: 0.2, max: 5,  step: 0.05 },
  { k: 'sputDip',   g: 'player', label: 'Jet sputter drop',           min: 0,   max: 300, step: 5 },
  { k: 'aggro',    g: 'enemy', label: 'Enemy aggro distance',        min: 0.2, max: 5,  step: 0.05 },
  { k: 'loseAggro', g: 'enemy', label: 'Lose aggro distance (×aggro)', min: 1,  max: 10, step: 0.1 },
  { k: 'bhPull',    g: 'bh',    label: 'Black Hole max pull range',   min: 0,   max: 600, step: 5 },
  { k: 'bhSpeed',   g: 'bh',    label: 'Black Hole travel speed',     min: 0,   max: 1000, step: 5 },
  { k: 'vol',       g: 'sound', label: 'Sound volume',                min: 0,   max: 2,  step: 0.05 },
  { k: 'amb',       g: 'sound', label: 'Ambience volume (×sound)',    min: 0,   max: 3,  step: 0.05 },
  { k: 'jetVol',    g: 'sound', label: 'Jetpack volume (×sound)',     min: 0,   max: 3,  step: 0.05 },
  { k: 'vSpell',    g: 'sound', label: 'Your spells (×sound)',        min: 0,   max: 3,  step: 0.05 },
  { k: 'vBoom',     g: 'sound', label: 'Explosions (×sound)',         min: 0,   max: 3,  step: 0.05 },
  { k: 'vHit',      g: 'sound', label: 'Bullet hits (×sound)',        min: 0,   max: 3,  step: 0.05 },
  { k: 'vEnemyFire', g: 'sound', label: 'Enemy fire (×sound)',        min: 0,   max: 3,  step: 0.05 },
  { k: 'vEnemy',    g: 'sound', label: 'Creature voices (×sound)',    min: 0,   max: 3,  step: 0.05 },
  { k: 'vWorld',    g: 'sound', label: 'World, props, portals (×sound)', min: 0, max: 3, step: 0.05 },
  { k: 'vDrip',     g: 'sound', label: 'Drips & trickles (×sound)',   min: 0,   max: 3,  step: 0.05 },
  { k: 'vStep',     g: 'sound', label: 'Footsteps (×sound)',          min: 0,   max: 3,  step: 0.05 },
  { k: 'vUi',       g: 'sound', label: 'UI & pickups (×sound)',       min: 0,   max: 3,  step: 0.05 },
  { k: 'holoAlpha', g: 'fx',    label: 'Hologram master brightness',        min: 0,   max: 1,  step: 0.05 },
  { k: 'bloom',     g: 'fx',    label: 'Hologram glow strength',      min: 0,   max: 2,  step: 0.05 },
  { k: 'bloomBlur', g: 'fx',    label: 'Hologram glow size (px)',     min: 0,   max: 40, step: 1 },
  { k: 'bloomBright', g: 'fx',  label: 'Hologram glow brighten',      min: 0.5, max: 3,  step: 0.05 },
  { k: 'holoPx',    g: 'fx',    label: 'Hologram pixel size (2 = rock size)', min: 0.5, max: 8, step: 0.5 },
  { k: 'pixelFx',   g: 'fx',    label: 'Pixelated light & fog (0 smooth, 1 pixel)', min: 0, max: 1, step: 1 },
  // the flash on a kill: up to holoMax, back down to holoMin over holoFade seconds along the curve
  // (its two control points: the curve editor on the panel, not boxes)
  { k: 'holoMin',   g: 'holoflash', label: 'Brightness at rest',       min: 0,   max: 1,  step: 0.05 },
  { k: 'holoMax',   g: 'holoflash', label: 'Brightness on a kill',     min: 0,   max: 1,  step: 0.05 },
  { k: 'holoFade',  g: 'holoflash', label: 'Fade length (s)',          min: 0.05, max: 20, step: 0.05 },
  { k: 'holoC1x',   g: 'holoflash', label: 'Fade curve point 1 x', min: 0, max: 1, step: 0.01, type: 'curve' },
  { k: 'holoC1y',   g: 'holoflash', label: 'Fade curve point 1 y', min: -0.5, max: 1.5, step: 0.01, type: 'curve' },
  { k: 'holoC2x',   g: 'holoflash', label: 'Fade curve point 2 x', min: 0, max: 1, step: 0.01, type: 'curve' },
  { k: 'holoC2y',   g: 'holoflash', label: 'Fade curve point 2 y', min: -0.5, max: 1.5, step: 0.01, type: 'curve' },
  { k: 'bagSpeed',  g: 'ui',    label: 'Bag fire preview speed (×real time)', min: 0.05, max: 5, step: 0.05 },
];
export const DEV_GROUPS = [['view', 'Camera & aim'], ['light', 'Torch & fog'], ['fx', 'Hologram & glow'], ['holoflash', 'Hologram flash (on a kill)'], ['player', 'Player'],
  ['enemy', 'Enemies'], ['spider', 'Spider'], ['rat', 'Rats & nests'], ['jelly', 'Jellyfish'], ['jellycol', 'Jellyfish colours'], ['bh', 'Black Hole tweaks'], ['sound', 'Sound'], ['ui', 'Bag screen'], ['level', 'Level layout (floor 1)'], ['arch', 'Arched vines'], ['fire', 'Fire']];
// The dev values that differ from their defaults, as text to paste back to Claude so they
// can become the new defaults.
export function devReport() {
  const changed = DEV_META.filter(m => DEV[m.k] !== DEV_DEFAULTS[m.k]);
  const lines = ['CaveRunner ' + VERSION + ' dev settings — please make these the new defaults:', ''];
  if (!changed.length) lines.push('(nothing changed — everything is at its default)');
  for (const m of changed)
    lines.push('- ' + m.label + ' (DEV.' + m.k + '): ' + DEV[m.k] + '   [default ' + DEV_DEFAULTS[m.k] + ']');
  lines.push('', 'Unchanged: ' + (DEV_META.filter(m => DEV[m.k] === DEV_DEFAULTS[m.k])
    .map(m => m.k).join(', ') || 'none'));
  return lines.join('\n');
}
// Creature knobs are ranges: every one has a min and a max, and each time the creature
// uses one it rolls a fresh number between them — kr(k). The owner's rule: no two bursts,
// bites or shots quite alike. Set min = max for a fixed number. rangeKnobs(group, rows)
// adds each row as a k+'Lo' / k+'Hi' default and two Dev rows in that group; every
// reworked creature gets its own table and its own group (its keys share a prefix, which
// the creature carries as `kp` — see CREATURES).
//   [key, label, lowest, highest, step, default min, default max]
/** @typedef {[key: string, label: string, min: number, max: number, step: number, lo: number, hi: number]} RangeRow */
/** @param {string} g @param {RangeRow[]} rows */
export function rangeKnobs(g, rows) {
  for (const [k, label, min, max, step, lo, hi] of rows) {
    DEV_DEFAULTS[k + 'Lo'] = lo; DEV_DEFAULTS[k + 'Hi'] = hi;
    DEV_META.push({ k: k + 'Lo', g, label: label + ' — min', min, max, step },
                  { k: k + 'Hi', g, label: label + ' — max', min, max, step });
  }
  return rows;
}
export const SP_KNOBS = rangeKnobs('spider', [
  ['spSpeed',    'Burst speed',                       20, 800, 10,   60, 200],
  ['spRoamOn',   'Roaming: burst length (s)',         0.02, 2, 0.01, 0.1, 1],
  ['spRoamOff',  'Roaming: rest between (s)',         0, 6, 0.05,    0.8, 6],
  ['spHuntOn',   'Hunting: burst length (s)',         0.02, 2, 0.01, 0.3, 1],
  ['spHuntOff',  'Hunting: rest between (s)',         0, 3, 0.01,    0.1, 3],
  ['spRoamR',    'Roam distance from home',           0, 600, 5,     80, 140],
  ['spRoamSpd',  'Roam spot drift speed',             0, 200, 1,     3, 35],
  ['spAggro',    'Aggro distance (×enemy aggro)',     0.1, 5, 0.05,  0.9, 1.1],
  ['spArrive',   'Stops this close to you',           2, 60, 1,      14, 22],
  ['spDot',      'Web instead of walk above dot',     -1, 1, 0.05,   0.7, 0.9],
  ['spGrab',     'Grabs a line within',               0, 60, 1,      8, 12],
  ['spWeb',      'Web line max reach',                20, 400, 5,    140, 200],
  ['spLineSpd',  'Web line shot speed',               50, 3000, 25,  200, 200],
  ['spRoamWeb',  'Roaming: secs between new lines',   0, 30, 0.5,    2, 10],
  ['spHuntWeb',  'Hunting: secs between new lines',   0, 10, 0.1,    0.3, 2],
  ['spMaxLines', 'Lines kept per spider',             1, 40, 1,      6, 16],
  ['spBite',     'Bite damage',                       0, 100, 1,     10, 14],
  ['spBiteCd',   'Secs between bites',                0.1, 5, 0.05,  0.7, 2],
  ['spSilk',     'String shot range',                 0, 400, 5,     60, 180],
  ['spSilkSpd',  'String shot speed',                 50, 2000, 10,  200, 600],
  ['spSilkCd',   'Secs between string shots',         0.2, 20, 0.1,  2.5, 4],
  ['spSilkMax',  'String snaps past (length)',        20, 600, 5,    170, 210],
  ['spSlow',     'Your speed ×, per string on you',   0.1, 1, 0.05,  0.7, 0.7],
  ['webSlow',    'Your speed ×, per web line you touch', 0.1, 1, 0.05, 0.7, 0.7],
  ['webGrab',    'Web line touch/latch distance',     0, 40, 1,      8, 10],
  ['webClimb',   'Climb speed along a web line',      0, 400, 5,     80, 100],
]);
// The jellyfish (Myrkkymeduusa, jellyStep). Movement, spit, and look. The look ones
// (shape, tentacles, glow) are rolled once per jelly as a fraction (kru), so each jelly
// is its own and a change on the Dev panel still shows at once.
export const JE_KNOBS = rangeKnobs('jelly', [
  ['jeRoamPush', 'Roaming: pulse push speed',         0, 600, 5,     30, 47],
  ['jeHuntPush', 'Hunting: pulse push speed',         0, 600, 5,     60, 85],
  ['jePushT',    'Pulse push time (s)',               0.02, 1, 0.01, 0.12, 0.2],
  ['jeRoamRest', 'Roaming: rest between pulses (s)',  0, 8, 0.05,    1.5, 3],
  ['jeHuntRest', 'Hunting: rest between pulses (s)',  0, 4, 0.05,    0.55, 1.5],
  ['jeDrag',     'Water drag (higher stops sooner)',  0, 10, 0.1,    1.6, 2],
  ['jeTurn',     'Turn rate (degrees/s)',             5, 720, 5,     35, 50],
  ['jePushTol',  'Only pulses facing within (deg)',   1, 180, 1,     15, 30],
  ['jeSink',     'Sinks between pulses',              0, 200, 1,     6, 10],
  ['jeBounce',   'Bounce off rock',                   0, 1, 0.05,    0.3, 0.5],
  ['jeRoamR',    'Roam distance from home',           0, 600, 5,     60, 120],
  ['jeRoamSpd',  'Roam spot drift speed',             0, 200, 1,     10, 25],
  ['jeAggro',    'Aggro distance (×enemy aggro)',     0.1, 5, 0.05,  0.9, 1.1],
  ['jeRange',    'Stops closing in at (spit range)',  10, 500, 5,    110, 150],
  ['jeAimTol',   'Spits when head within (deg)',      1, 180, 1,     12, 20],
  ['jeShotCd',   'Secs between spits',                0.1, 10, 0.05, 1.6, 2.4],
  ['jeShotSpd',  'Spit speed',                        20, 1000, 5,   65, 90],
  ['jeShotDmg',  'Spit damage',                       0, 100, 1,     6, 8],
  ['jeShotSize', 'Spit size',                         0.5, 12, 0.25, 2.5, 4],
  ['jeSpread',   'Spit aim wobble (± deg)',           0, 45, 1,      0, 10],
  ['jeDrip',     'Spit drips per second',             0, 80, 1,      20, 50],
  ['jeDripG',    'Drip fall (gravity)',               0, 1200, 10,   220, 320],
  ['jeSplat',    'Splat particles',                   0, 60, 1,      10, 16],
  ['jeSplatSpd', 'Splat spread speed',                0, 400, 5,     30, 80],
  ['jeBite',     'Sting damage on touch',             0, 100, 1,     3, 5],
  ['jeBiteCd',   'Secs between stings',               0.1, 5, 0.05,  0.8, 1.2],
  ['jeThin',     'Shape: stays thin longer (curve)',  0.3, 6, 0.1,   2.2, 2.8],
  ['jeSquash',   'Shape: how much it changes',        0, 2, 0.05,    0.9, 1.1],
  ['jeTents',    'Tentacles',                         0, 8, 1,       3, 4],
  ['jeVerts',    'Points per tentacle',               2, 10, 1,      6, 6],
  ['jeTentLen',  'Tentacle length',                   0, 120, 1,     50, 75],
  ['jeWave',     'Tentacle sway',                     0, 60, 1,      5, 9],
  ['jeSag',      'Tentacle droop',                    0, 200, 1,     0, 10],
  ['jeGlowR',    'Glow radius',                       0, 200, 2,     40, 56],
  ['jeGlow',     'Glow brightness',                   0, 1, 0.01,    0.1, 0.15],
  ['jeFlare',    'Glow flare on a pulse (×)',         0, 5, 0.05,    0.6, 1],
  ['jeSpores',   'Spores puffed out per pulse',       0, 40, 1,      4, 8],
  ['jeSporeSpd', 'Spore puff speed',                  0, 400, 5,     40, 80],
  ['jeSporeDrag', 'Spore puff drag (settles)',        0, 20, 0.1,    2.5, 3.5],
  ['jeSporeSpread', 'Spore puff spread (± deg)',      0, 180, 1,     25, 40],
  ['jePlantTop', 'Plant glow: top % of green',        1, 100, 1,     30, 40],
  ['jePlantReach', 'Plant glow reach (× glow radius)', 0, 5, 0.05,   2, 5],
  ['jePlantGlow', 'Plant glow strength',              0, 4, 0.05,    4, 4],
  ['jePlantTwinkle', 'Plant twinkle speed',           0, 10, 0.1,    1.2, 2],
  ['jePlantSize', 'Plant twinkle size',               1, 60, 1,      5, 8],
]);
// The rats and their nests (v88, ratStep / ratNests). Nests are holes in the built-up
// zones of floor 1 (and a few in the natural caves) with a thin winding tunnel down to a
// room in the rock; rats come out, bite you, knock gold out of you and carry it home.
export const RA_KNOBS = rangeKnobs('rat', [
  ['raSpeed',    'Run speed',                         20, 600, 5,    45, 60],
  ['raRoamOn',   'Roaming: burst length (s)',         0.02, 3, 0.01, 0.15, 1],
  ['raRoamOff',  'Roaming: rest between (s)',         0, 6, 0.05,    0.5, 3],
  ['raHuntOn',   'Chasing: burst length (s)',         0.02, 3, 0.01, 0.35, 0.5],
  ['raHuntOff',  'Chasing: rest between (s)',         0, 3, 0.01,    0.04, 0.4],
  ['raRoamR',    'Roam distance from its nest',       0, 600, 5,     20, 65],
  ['raRoamSpd',  'Roam spot drift speed',             0, 200, 1,     15, 30],
  ['raAggro',    'Aggro distance (×enemy aggro)',     0.1, 5, 0.05,  0.9, 1.1],
  ['raArrive',   'Stops this close to you',           0, 40, 1,      2, 3],
  ['raDot',      'Jumps instead of runs above dot',   -1, 1, 0.05,   0.5, 0.65],
  ['raJump',     'Jump speed',                        50, 800, 10,   100, 200],
  ['raJumpR',    'Jumps at things within',            10, 300, 5,    50, 75],
  ['raBite',     'Bite damage',                       0, 100, 1,     3, 5],
  ['raBiteCd',   'Secs between bites',                0.1, 5, 0.05,  0.8, 1.2],
  ['raBroke',    'Bite × when you have no gold',      1, 10, 0.5,    3, 3],
  ['raSteal',    'Gold knocked out per bite',         0, 100, 1,     3, 6],
  ['raPopX',     'Stolen gold: sideways throw',       0, 400, 5,     70, 100],
  ['raPopY',     'Stolen gold: upward throw',         0, 600, 5,     200, 250],
  ['raSmell',    'Goes for loose gold within',        0, 600, 5,     150, 220],
  ['raMax',      'Rats per nest',                     1, 20, 1,      3, 7],
  ['raSpawn',    'Secs between rats from a nest',     0.5, 60, 0.5,  6, 12],
  ['raWake',     'Nests and rats wake within',        100, 2000, 10, 480, 560],
  ['raNestRest', 'Secs a rat stays in the nest',      0, 20, 0.5,    2, 6],
  ['raNests',    'Nests in the built-up zones',       0, 60, 1,      14, 18],
  ['raNestsWild', 'Nests in the natural caves',       0, 30, 1,      2, 4],
  ['raNestGold', 'Gold in a nest when it dies',       0, 500, 5,     60, 60],
  ['raSpread',   'Roaming rats keep this far apart',  0, 200, 1,     22, 40],
]);
// one roll of a creature knob: anywhere from its min to its max (either way round).
// kru is the same at a given fraction u (0..1) — for a jelly's looks, rolled once at birth.
/** @type {(k: string, u: number) => number} */
export const kru = (k, u) => { const a = DEV[k + 'Lo'], b = DEV[k + 'Hi']; return a + u * (b - a); };
/** @type {(k: string, rnd?: Rnd) => number} */
export const kr = (k, rnd) => kru(k, (rnd || Math.random)());
export const spr = kr;                                  // the spider's code calls it this

// Colour knobs: the same idea as a range, for colours. Each part has a colour A and a
// colour B, and each creature wears a blend somewhere between them, picked once when it
// is born (kcol at its own fraction u) — set both the same for one fixed colour. The Dev
// panel shows a colour picker for these (type 'color').
//   [key, label, default A, default B, field name in the creature's palette]
/** @typedef {[key: string, label: string, a: string, b: string, field: string]} ColourRow */
/** @param {string} g @param {ColourRow[]} rows */
export function colourKnobs(g, rows) {
  for (const [k, label, a, b] of rows) {
    DEV_DEFAULTS[k + 'Lo'] = a; DEV_DEFAULTS[k + 'Hi'] = b;
    DEV_META.push({ k: k + 'Lo', g, label: label + ' — A', type: 'color' },
                  { k: k + 'Hi', g, label: label + ' — B', type: 'color' });
  }
  return rows;
}
/** @type {(k: string, u: number) => string} */
export const kcol = (k, u) => hexMix(DEV[k + 'Lo'], DEV[k + 'Hi'], u);
// the jellyfish's master sliders, at the top of its colour group: they act on every part
Object.assign(DEV_DEFAULTS, { jeHue: 26, jeSat: 1.4, jeBri: 1 });
DEV_META.push(
  { k: 'jeHue', g: 'jellycol', label: 'All colours: hue shift (°)',  min: -180, max: 180, step: 1,    type: 'slider' },
  { k: 'jeSat', g: 'jellycol', label: 'All colours: saturation (×)', min: 0,    max: 3,   step: 0.05, type: 'slider' },
  { k: 'jeBri', g: 'jellycol', label: 'All colours: brightness (×)', min: 0,    max: 3,   step: 0.05, type: 'slider' });
// one jellyfish colour: its part's A-to-B blend at u, then the master sliders
/** @type {(k: string, u: number) => string} */
export const jcol = (k, u) => {
  const c = kcol(k, u);
  return DEV.jeHue || DEV.jeSat !== 1 || DEV.jeBri !== 1 ? hsvAdjust(c, DEV.jeHue, DEV.jeSat, DEV.jeBri) : c;
};
// the jellyfish's colours, part by part (drawJelly, its spit, its glow)
export const JE_COLS = colourKnobs('jellycol', [
  ['jeColTop',     'Bell top',                '#a6ff7c', '#b4ff9a', 'top'],
  ['jeColBody',    'Bell middle',             '#46c94f', '#3fbf6e', 'body'],
  ['jeColRim',     'Bell bottom (dark)',      '#133d1a', '#123a28', 'rim'],
  ['jeColEdge',    'Bell outline',            '#a6ff7c', '#a6ffb0', 'edge'],
  ['jeColInner',   'Inner bell',              '#a6ff7c', '#a6ff7c', 'inner'],
  ['jeColLoops',   'Poison loops',            '#e4ff4a', '#f0ff6a', 'loops'],
  ['jeColShine',   'Shine',                   '#ffffff', '#ffffff', 'shine'],
  ['jeColTent',    'Tentacles',               '#a6ff7c', '#9cffb4', 'tent'],
  ['jeColGlow',    'Glow',                    '#6eff5a', '#5affa0', 'glow'],
  ['jeColSpit',    'Spit',                    '#46c94f', '#46c94f', 'spit'],
  ['jeColSpitEdge', 'Spit edge',              '#123d18', '#123d18', 'spitEdge'],
  ['jeColSpitShine', 'Spit shine',            '#e6ffb8', '#e6ffb8', 'spitShine'],
  ['jeColDrip',    'Drips & splat',           '#46c94f', '#46c94f', 'drip'],
  ['jeColDrip2',   'Drips & splat (light)',   '#c8ff8a', '#c8ff8a', 'drip2'],
]);
// Floor 1's layered cave (strataCave). Ranges like the creatures': each layer, corridor,
// hole, cavern and working rolls its own number between min and max. Sizes are terrain
// pixels (the runner is 6 wide, 11 tall). A change shows on the next cave: Dev → New cave.
export const LV_KNOBS = rangeKnobs('level', [
  ['lvHead',    'Corridor headroom (px, runner is 11)', 12, 80, 1,  20, 32],
  ['lvSqueeze', 'Squeeze headroom (px)',              12, 30, 1,    13, 16],
  ['lvSqz',     'Squeezes per corridor',              0, 4, 0.1,    0, 1.2],
  ['lvThick',   'Layer thickness (px)',               5, 60, 1,     16, 32],
  ['lvWave',    'Layer waviness (px)',                0, 40, 1,     5, 12],
  ['lvHoles',   'Extra holes per layer (loops)',      0, 8, 0.1,    0.2, 1],
  ['lvHoleW',   'Hole width (px)',                    12, 80, 1,    18, 40],
  ['lvWalls',   'Walls per corridor (dead ends)',     0, 5, 0.1,    0, 1],
  ['lvCaves',   'Big caverns',                        0, 8, 0.1,    2.5, 3.5],
  ['lvCaveW',   'Cavern half width (px)',             20, 320, 5,   90, 170],
  ['lvCaveH',   'Cavern half height (px)',            20, 320, 5,   80, 150],
  ['lvWorks',   'Old workings (flattened stretches)', 0, 12, 0.1,   3, 5],
  ['lvWorkW',   'Old workings length (px)',           30, 400, 5,   90, 190],
  ['lvWorkH',   'Old workings headroom (px)',         14, 60, 1,    22, 30],
  ['lvPost',    'Timber post spacing (px)',           14, 120, 1,   30, 46],
  ['lvPropZones', 'Propped patches',                  0, 16, 0.1,   5, 8],
  ['lvPropR',   'Propped patch radius (px)',          20, 400, 5,   70, 140],
  ['lvPropDense', 'Timber density in a patch (×)',    0.5, 4, 0.05, 0.9, 1.15],
  ['lvPropRot', 'Bays rotted away outside patches (0-1)', 0, 1, 0.05, 0.3, 0.6],
  // v87: floor 1 is two styles in zones. A big slow noise over the map says which: built-up
  // (the layered cave above) or natural (the old noise cave). See makeLevel.
  ['lvZoneSize', 'Zone size (px)',                     60, 900, 10,  220, 320],
  ['lvZoneShare', 'Built-up share of the map (0-1)',   0, 1, 0.05,   0.4, 0.55],
  ['lvZoneRag', 'Zone edge raggedness (px)',           0, 60, 1,     8, 18],
  ['lvLamps',   'Lanterns in the built-up zones',      0, 150, 1,    40, 55],
]);
// Arched vines (v87): a long vine hung between two ceiling spots over an open pocket, sagging
// between them, thick with leaves and dangling strands. Rolled per floor / per arch with the
// decoration's own random stream. Sizes are terrain pixels (the runner is 6 wide, 11 tall).
export const ARCH_KNOBS = rangeKnobs('arch', [
  ['arVines',   'Arched vine clusters per floor',      0, 40, 0.5,   9, 13],
  ['arCluster', 'Arches per cluster',                  1, 8, 0.1,    1.5, 3.5],
  ['arSpan',    'Span between the two ends (px)',      20, 300, 5,   50, 150],
  ['arRise',    'Height difference of the ends (× span)', 0, 1, 0.05, 0, 0.35],
  ['arSlack',   'Vine length (× span)',                1, 3, 0.05,   1.1, 1.6],
  ['arClear',   'Open air under its lowest point (px)', 0, 150, 2,   18, 40],
  ['arThick',   'Twisted stems',                       1, 5, 1,      2, 3],
  ['arStrands', 'Hanging strands per 10px',            0, 6, 0.1,    0.8, 1.8],
  ['arStrandLen', 'Hanging strand length (px)',        2, 80, 1,     5, 28],
  ['arGrab',    'Grab distance (world units)',         0, 30, 1,     7, 9],
  ['arClimb',   'Climb speed along it',                0, 400, 5,    80, 100],
]);
// Fire (v86): see fireStep. Every knob a min/max range like the creatures'.
export const FIRE_KNOBS = rangeKnobs('fire', [
  ['fireSpread', 'Spread chance per tick',            0, 1, 0.01,    0.02, 0.2],
  ['fireGrass',  'Grass burns for (s)',               0.05, 5, 0.05, 0.4, 1.5],
  ['fireMoss',   'Moss burns for (s)',                0.05, 8, 0.05, 1, 4],
  ['fireWood',   'Timber burns for (s)',              0.1, 20, 0.1,  3, 9],
  ['fireBoom',   'Explosions light things (chance)',  0, 1, 0.05,    0.35, 0.6],
  ['fireBurn',   'A creature burns for (s)',          0, 20, 0.1,    3, 6],
  ['fireDps',    'Creature burn damage per s',        0, 20, 0.1,    1, 3],
  ['fireYou',    'You burn for (s)',                  0, 10, 0.1,    1.2, 2],
  ['fireYouDps', 'Your burn damage per s',            0, 40, 0.5,    5, 8],
  ['firePlant',  'Vines burn up at (px/s)',           1, 200, 1,     5, 25],
  ['fireArch',   'Arched vines burn along at (px/s)', 1, 400, 1,     5, 25],
]);
export const DEV_KEY = 'caverunner-dev';
/** @type {DevKnobs} */
export const DEV = Object.assign({}, DEV_DEFAULTS);
(() => { try {
  const raw = localStorage.getItem(DEV_KEY);
  if (raw) { const o = JSON.parse(raw); for (const k in DEV_DEFAULTS) {
    const d = DEV_DEFAULTS[k], v = o[k];                      // numbers, or '#rrggbb' colours
    if (typeof d === 'number' ? typeof v === 'number' && isFinite(v) : typeof v === 'string' && HEX_RE.test(v)) DEV[k] = v;
  } }
} catch (_) {} })();
/** @param {string} k @param {number | string} v */
export function devSet(k, v) {
  DEV[k] = v;
  try { localStorage.setItem(DEV_KEY, JSON.stringify(DEV)); } catch (_) {}
}
