// @ts-check
// The Dev panel's knobs: DEV (the live values the game reads every frame, saved to
// localStorage), their defaults, rows and groups, and the range / colour knob tables.
// Every table registers its rows before DEV is built from the defaults below, so they all
// live here for now (REFACTOR.md, D11).

import { DEADLINE_MS, ENEMY_COUNT, LVL_SELL, LVL_BUY } from '../core/consts.js';
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
  holoMin: 0, holoMax: 1, holoFade: 3, holoC1x: 0.25, holoC1y: 1, holoC2x: 0.5, holoC2y: 0,
  guideCps: 30, guideWait: 1.4, guideIn: 50, shopGap: 0.9, shopTorch: 0.45, beamDeg: 50, beamReach: 2.2, beamNear: 0.5, beamGlow: 0.5,
  due1: 60, enemies: ENEMY_COUNT, enemiesUp: 12, lvlBonus: LVL_SELL - LVL_BUY, lvlGrow: 3, rewardGrow: 2, killGrow: 1.35,
  runnerPx: 1, runnerLine: 1,
  ptrStart: 0.12, ptrReach: 1, ptrSize: 1, ptrLine: 0.75, snapR: 28, snapPull: 0.3, snapHit: 10,
  witPad: 80, witKbps: 6000,
  webSag: 0.03, bendK: 140, bendDamp: 5, bendPush: 0.3, bendGrab: 0.35, bendDip: 5, bendMax: 14,
  vineGrav: 1, vineDamp: 1.2, vinePush: 0.6, vineMax: 0.9, vineLinks: 4, vineTailDamp: 1.5 };
// g: the collapsible group the knob sits in on the Dev panel (DEV_GROUPS gives the order)
/** @type {DevRow[]} */
export const DEV_META = [
  { k: 'zoom',      g: 'view',  label: 'Camera zoom',                 min: 0.3, max: 3,  step: 0.05 },
  { k: 'aimDist',   g: 'view',  label: 'Crosshair distance',          min: 10,  max: 200, step: 2 },
  { k: 'torch',     g: 'light', label: 'Torch fall-off distance',     min: 0.2, max: 5,  step: 0.05 },
  { k: 'fogDark',   g: 'light', label: 'Fog of war darkness',         min: 0,   max: 1,  step: 0.01 },
  { k: 'fogDim',    g: 'light', label: 'Outside-torchlight darkness', min: 0,   max: 1,  step: 0.01 },
  { k: 'shopGap',   g: 'light', label: 'Shop hall: darkness between the ceiling lights', min: 0, max: 1, step: 0.05 },
  { k: 'shopTorch', g: 'light', label: 'Shop hall: how much your torch lifts its dark (1 = all)', min: 0, max: 1, step: 0.05 },
  { k: 'beamDeg',   g: 'light', label: 'Gun light: cone width (degrees)', min: 10, max: 160, step: 2 },
  { k: 'beamReach', g: 'light', label: 'Gun light: how far the cone reaches (× the old torch)', min: 1, max: 5, step: 0.1 },
  { k: 'beamNear',  g: 'light', label: 'Gun light: the glow round you (× the old torch)', min: 0, max: 1, step: 0.05 },
  { k: 'beamGlow',  g: 'light', label: 'Gun light: how bright the beam itself shows', min: 0, max: 1, step: 0.05 },
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
  // a new run's guide hologram (world/guide.js): how fast its speech box types, and the pause after each box
  { k: 'guideCps',  g: 'guide', label: 'Typing speed (letters a second)', min: 2, max: 200, step: 1 },
  { k: 'guideWait', g: 'guide', label: 'Pause after each box (s, + a little per letter)', min: 0, max: 10, step: 0.1 },
  // how far on screen (world units in from the right edge; the screen is ~225 wide) its dark spot must be before its light snaps on
  { k: 'guideIn',   g: 'guide', label: 'On screen before its light comes on (units in)', min: 0, max: 200, step: 5 },
  { k: 'due1',      g: 'level', label: 'Time to repay level 1 (minutes)', min: 0.1, max: 1440, step: 1 },
  { k: 'enemies',   g: 'level', label: 'Enemies on floor 1 (next level made)', min: 0, max: 400, step: 1 },
  { k: 'enemiesUp', g: 'level', label: 'More enemies each floor after', min: 0, max: 60, step: 1 },
  { k: 'lvlBonus',  g: 'level', label: 'Level reward: yours after the debt is paid (gold)', min: 0, max: 1000000, step: 100 },
  { k: 'lvlGrow',   g: 'level', label: 'Level price (debt): × each floor up', min: 1, max: 10, step: 0.05 },
  { k: 'rewardGrow', g: 'level', label: 'Level reward: × each floor up', min: 1, max: 20, step: 0.05 },
  { k: 'killGrow',  g: 'level', label: 'Kill gold: × each floor up', min: 1, max: 4, step: 0.05 },
  { k: 'runnerPx',  g: 'player', label: 'Player pixel size (world units, 0 = smooth)', min: 0, max: 3, step: 0.25 },
  { k: 'runnerLine', g: 'player', label: 'Player dark outline (0 off, 1 on)', min: 0, max: 1, step: 1 },
  // the vending menus' right-stick pointer (ui/vendshop.js useMenuNav, menuPointer, snapTo)
  { k: 'ptrStart',  g: 'menuptr', label: 'Stick push before the pointer comes out (of its reach)', min: 0, max: 0.9, step: 0.01 },
  { k: 'ptrReach',  g: 'menuptr', label: 'Pointer reach (× distance to the far screen corner)', min: 0.2, max: 3, step: 0.05 },
  { k: 'ptrSize',   g: 'menuptr', label: 'Ring size (× the knob)', min: 0.2, max: 3, step: 0.05 },
  { k: 'ptrLine',   g: 'menuptr', label: 'Ring line width (px)', min: 0.25, max: 4, step: 0.25 },
  { k: 'snapR',     g: 'menuptr', label: 'Snap reach (px from a button’s edge)', min: 0, max: 120, step: 1 },
  { k: 'snapPull',  g: 'menuptr', label: 'Snap pull (0 none, 1 right onto its middle)', min: 0, max: 1, step: 0.01 },
  { k: 'snapHit',   g: 'menuptr', label: 'Counts as on a button within (px of its edge)', min: 0, max: 60, step: 1 },
  // a saved death replay keeps only what's round your path: this far past it the camera may still go
  { k: 'witPad',    g: 'witness', label: 'Saved replay: how far the camera may stray from you (world units)', min: 0, max: 300, step: 10 },
  { k: 'witKbps',   g: 'witness', label: 'Exported video quality (kbit/s)', min: 500, max: 20000, step: 500 },
  // vines and web lines that give (world/sway.js): lines bend on one spring, hanging vines swing
  { k: 'webSag',    g: 'sway', label: 'Web line sag at rest (× its width)', min: 0, max: 0.3, step: 0.005 },
  { k: 'bendK',     g: 'sway', label: 'Lines: springiness (higher = quicker wobble)', min: 10, max: 600, step: 5 },
  { k: 'bendDamp',  g: 'sway', label: 'Lines: settling (higher = settles sooner)', min: 0, max: 30, step: 0.5 },
  { k: 'bendPush',  g: 'sway', label: 'Lines: push from flying through (× your speed)', min: 0, max: 1, step: 0.05 },
  { k: 'bendGrab',  g: 'sway', label: 'Lines: bounce when you grab one (× your speed)', min: 0, max: 1, step: 0.05 },
  { k: 'bendDip',   g: 'sway', label: 'Lines: dip under your weight (world units)', min: 0, max: 30, step: 0.5 },
  { k: 'bendMax',   g: 'sway', label: 'Lines: most they bend (world units)', min: 0, max: 60, step: 1 },
  { k: 'vineGrav',  g: 'sway', label: 'Hanging vines: swing pull (× gravity)', min: 0, max: 3, step: 0.05 },
  { k: 'vineDamp',  g: 'sway', label: 'Hanging vines: settling (higher = settles sooner)', min: 0, max: 10, step: 0.1 },
  { k: 'vinePush',  g: 'sway', label: 'Hanging vines: push from flying through (× your speed)', min: 0, max: 2, step: 0.05 },
  { k: 'vineMax',   g: 'sway', label: 'Hanging vines: widest swing (radians)', min: 0, max: 1.5, step: 0.05 },
  { k: 'vineLinks', g: 'sway', label: 'Hanging vines: links below your grip (more = floppier)', min: 1, max: 8, step: 1 },
  { k: 'vineTailDamp', g: 'sway', label: 'Hanging vines: the part below your grip settles (higher = sooner)', min: 0, max: 10, step: 0.1 },
  { k: 'bagSpeed',  g: 'ui',    label: 'Bag fire preview speed (×real time)', min: 0.05, max: 5, step: 0.05 },
];
export const DEV_GROUPS = [['view', 'Camera & aim'], ['light', 'Torch & fog'], ['fx', 'Hologram & glow'], ['holoflash', 'Hologram flash (on a kill)'], ['guide', 'Guide hologram (new run)'], ['player', 'Player'],
  ['enemy', 'Enemies'], ['elite', 'Elites'], ['elitefx', 'Elites: flames'], ['spider', 'Spider'], ['rat', 'Rats & nests'], ['jelly', 'Jellyfish'], ['jellycol', 'Jellyfish colours'], ['bh', 'Black Hole tweaks'], ['sound', 'Sound'], ['ui', 'Bag screen'], ['menuptr', 'Menu pointer & snapping'], ['witness', 'Witness (death replays)'], ['level', 'Level layout (floor 1)'], ['level2', 'Level 2: layout & look'], ['l2dark', 'Level 2: dark zones'], ['l2boom', 'Level 2: destruction'], ['arch', 'Arched vines'], ['sway', 'Vines & webs: sway'], ['fire', 'Fire'], ['carrot', 'Carrot (suit stat)']];
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
  ['raMax',      'Rats out of a nest at once',        1, 20, 1,      3, 7],
  ['raBrood',    'Rats a nest holds in all',          0, 60, 1,      4, 6],
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
export const spr = kr;
// a Carrot knob at suit level lvl (0 none … 5 = Carrot V): its min, its max, or evenly between
/** @param {string} k @param {number} lvl */
export const carrotAt = (k, lvl) => kru(k, Math.max(0, Math.min(1, (lvl || 0) / 5)));                                  // the spider's code calls it this

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
// Elites: a few boosted creatures a floor (data/creatures.js eliteOf; world/level.js picks them).
// Each elite rolls once where it sits in its looks and toughness (u), so min to max spans the elites
// on a floor; the rewards are rolled fresh when one dies.
export const ELITE_KNOBS = rangeKnobs('elite', [
  ['elCount',   'Elites per floor',                       0, 40, 1,      2, 4],
  ['elHp',      'Health (× a normal one)',                0.5, 10, 0.1,  2.5, 2.5],
  ['elDmg',     'Damage (× a normal one)',                0.5, 10, 0.1,  1.5, 1.5],
  ['elGold',    'Gold reward (× a normal one)',           0, 20, 0.5,    4, 4],
  ['elRed',     'Red crystals dropped',                   0, 20, 1,      3, 5],
  ['elGreen',   'Green crystals dropped',                 0, 10, 1,      1, 1],
  ['elScale',   'Size (× a normal one)',                  0.5, 3, 0.05,  1, 1],
  ['elTintAmt', 'Tint strength (0 none, 1 all tint)',     0, 1, 0.05,    0.45, 0.45],
  ['elGlow',    'Highlight glow strength',                0, 1, 0.01,    0.22, 0.22],
  ['elGlowR',   'Highlight glow size (past its body)',    0, 40, 1,      6, 6],
]);
export const ELITE_COLS = colourKnobs('elite', [
  ['elTint', 'Tint and glow colour', '#ffc93c', '#ffc93c', 'tint'],
]);
// The elites' flames (v0.0.137): each elite gives off fire particles from its body, the torch's
// flame turned into a spawner. Every number a range rolled per particle; the colour over a
// particle's life is a gradient (elFxGrad) and its opacity a B-spline ramp (elFxAlpha), both
// shaped on the panel's editors (ui/devpanel.js GradEditor, RampEditor) and kept as strings
// (art/ramps.js). Rate 0 turns them off.
export const ELITE_FX_KNOBS = rangeKnobs('elitefx', [
  ['elFxRate',  'Particles a second (0 = off)',             0, 300, 1,     70, 100],
  ['elFxLife',  'Length of fire (s a particle lives)',      0.05, 3, 0.05, 0.35, 0.7],
  ['elFxRise',  'Rise speed',                               0, 200, 1,     22, 40],
  ['elFxWave',  'Wavyness (side-to-side, units/s)',         0, 100, 1,     8, 20],
  ['elFxWaveHz', 'Wavyness: swings a second',               0, 20, 0.1,    3, 6],
  ['elFxDrag',  'Air resistance (how fast it sheds the elite\'s speed)', 0, 20, 0.1, 2.5, 4],
  ['elFxSize',  'Particle size',                            0.5, 6, 0.1,   1.5, 2.5],
  ['elFxBody',  'Spawn spread (0 middle, 1 its edge)',      0, 1.5, 0.05,  0.7, 1.1],
]);
DEV_DEFAULTS.elFxGrad = '0:#ffffff 0.18:#fff0a0 0.45:#ff9a2a 0.75:#d0301a 1:#401018';
DEV_DEFAULTS.elFxAlpha = '0:0 0.08:1 0.55:0.85 1:0';
DEV_META.push({ k: 'elFxGrad', g: 'elitefx', label: 'Colour over life (gradient)', type: 'grad' },
  { k: 'elFxAlpha', g: 'elitefx', label: 'Opacity over life (ramp)', type: 'ramp' });
// Floor 2 (v129; the tomb since Level 2 stage 2, world/tomb.js): its layout's numbers, ranges like
// floor 1's, rolled once per tomb on its own generator (room sizes and corridor widths per room and
// corridor), so a seed plus the same knobs is the same tomb. Terrain pixels (a world unit is half one).
// A change shows on the next cave: Dev → New cave (or Floor 2, to go there).
export const L2_KNOBS = rangeKnobs('level2', [
  ['l2Rooms',   'Rooms (how many it tries to fit)',          4, 120, 1,      70, 80],
  ['l2Big',     'Large rooms: share (0-1)',                  0, 1, 0.05,     0.3, 0.3],
  ['l2SmallW',  'Small rooms: width (px)',                   20, 140, 2,     48, 80],
  ['l2SmallH',  'Small rooms: height (px)',                  18, 90, 2,      32, 48],
  ['l2BigW',    'Large rooms: width (px)',                   50, 400, 2,     110, 200],
  ['l2BigH',    'Large rooms: height (px)',                  30, 200, 2,     60, 108],
  ['l2Gap',     'Rock between rooms, at least (px)',         4, 80, 1,       12, 16],
  ['l2Hall',    'Galleries (level corridors): height (px)',  13, 40, 1,      16, 20],
  ['l2Shaft',   'Shafts (upright corridors): width (px)',    10, 40, 2,      14, 18],
  ['l2Ledge',   'Shafts: a ledge every (px)',                10, 200, 2,     28, 36],
  ['l2Loops',   'Extra links (loops, 0-1)',                  0, 1, 0.05,     0.35, 0.35],
  ['l2Course',  'Cut stone: course height (px)',             3, 12, 1,       6, 6],
  ['l2Block',   'Cut stone: block length (px)',              4, 40, 1,       14, 14],
  ['l2Mason',   'Cut stone: how deep into the rock (px)',    0, 30, 1,       6, 6],
  ['l2Furn',    'Room kits: furniture amount (×)',           0, 3, 0.05,     1, 1],
  ['l2Bones',   'Room kits: skeletal remains (×)',           0, 3, 0.05,     1, 1],
]);
// and its look: the palette (the Coal seams theme, data/themes.js themeFor) and how much decoration
/** @type {[key: string, label: string, def: string][]} */
export const L2_LOOK = [
  ['l2Bg',     'Background (far)',   '#0c0d11'], ['l2Bg2',    'Background (near)', '#1c1e24'],
  ['l2Rock1',  'Rock (dark)',        '#2c2c32'], ['l2Rock2',  'Rock (light)',      '#4a4a52'],
  ['l2Moss1',  'Moss (dark)',        '#2e4a34'], ['l2Moss2',  'Moss (light)',      '#54744a'],
  ['l2Brick1', 'Brick (dark)',       '#403e42'], ['l2Brick2', 'Brick (light)',     '#605c62'],
  ['l2Mortar', 'Mortar',             '#262428'],
  ['l2Bed1',   'Bedrock (dark)',     '#18181c'], ['l2Bed2',   'Bedrock (light)',   '#28282e'],
];
for (const [k, label, def] of L2_LOOK) {
  DEV_DEFAULTS[k] = def;
  DEV_META.push({ k, g: 'level2', label: 'Colour: ' + label, type: 'color' });
}
DEV_DEFAULTS.l2Decor = 1;
DEV_META.push({ k: 'l2Decor', g: 'level2', label: 'Decoration amount (× the room kits, all of it; 0 = bare tomb)', min: 0, max: 4, step: 0.05 });
// Curve knobs: a cubic bezier from (0, start y) to (1, end y), bent by two control points, shaped
// on the panel's CurveEdit (ui/devpanel.js; every row is type 'curve', so no boxes). curveKnobs(group,
// p, label, lo, hi, def) registers p+'0' (start y), p+'C1x', p+'C1y', p+'C2x', p+'C2y', p+'1' (end y);
// lo..hi is the y range the editor shows. kcurve(p) is the curve as plain numbers (core/util.js bezierAt).
/** @param {string} g @param {string} p @param {string} label @param {number} lo @param {number} hi @param {Curve} def */
export function curveKnobs(g, p, label, lo, hi, def) {
  /** @type {[string, string, number, number, number][]} */
  const rows = [['0', 'start y', def.y0, lo, hi], ['C1x', 'point 1 x', def.x1, 0, 1], ['C1y', 'point 1 y', def.y1, lo, hi],
    ['C2x', 'point 2 x', def.x2, 0, 1], ['C2y', 'point 2 y', def.y2, lo, hi], ['1', 'end y', def.y3, lo, hi]];
  for (const [s, what, v, min, max] of rows) {
    DEV_DEFAULTS[p + s] = v;
    DEV_META.push({ k: p + s, g, label: label + ': ' + what, min, max, step: 0.01, type: 'curve' });
  }
  CURVES.push({ g, p, label, lo, hi });
}
/** every curve knob, for the panel: its group, key prefix, label and y range @type {{ g: string, p: string, label: string, lo: number, hi: number }[]} */
export const CURVES = [];
/** @param {string} p @returns {Curve} */
export const kcurve = p => ({ y0: DEV[p + '0'], x1: DEV[p + 'C1x'], y1: DEV[p + 'C1y'], x2: DEV[p + 'C2x'], y2: DEV[p + 'C2y'], y3: DEV[p + '1'] });
// Level 2: destruction (world/byDistance.js, not in the cave yet): explosions scattered round the
// dark zones, denser and bigger near them. Distances in terrain pixels. destructionOpts() reads them.
DEV_DEFAULTS.l2bMaxDist = 200; DEV_DEFAULTS.l2bCount = 60; DEV_DEFAULTS.l2bFire = 30; DEV_DEFAULTS.l2bJitter = 0; DEV_DEFAULTS.l2bClear = 4;
DEV_META.push(
  { k: 'l2bMaxDist', g: 'l2boom', label: 'Reach: most distance from a dark zone (px)', min: 1, max: 1600, step: 5 },
  { k: 'l2bCount',   g: 'l2boom', label: 'Number of explosions', min: 0, max: 2000, step: 1 },
  { k: 'l2bFire',    g: 'l2boom', label: 'Explosions that cause fire (%)', min: 0, max: 100, step: 1 },
  { k: 'l2bJitter',  g: 'l2boom', label: 'Extra position randomness (± px)', min: 0, max: 100, step: 1 },
  { k: 'l2bClear',   g: 'l2boom', label: 'Clearance from terrain (px)', min: 0, max: 60, step: 1 });
export const L2B_KNOBS = rangeKnobs('l2boom', [
  ['l2bSize', 'Explosion size (px radius)', 1, 120, 1, 6, 18],
]);
curveKnobs('l2boom', 'l2bDen', 'Destruction amount (Y) by distance from a dark zone (X)', 0, 1, { y0: 1, x1: 0.25, y1: 1, x2: 0.5, y2: 0, y3: 0 });
curveKnobs('l2boom', 'l2bScale', 'Size × (Y, 0-2) by distance from a dark zone (X)', 0, 2, { y0: 1.6, x1: 0.33, y1: 1.3, x2: 0.66, y2: 0.8, y3: 0.5 });
// Level 2 stage 4: floor 2's dark zones (world/dark.js darkZones; their look: game/render/dark.js). Terrain px
// for sizes; how many and how big are rolled per floor on the zones' own stream
export const L2D_KNOBS = rangeKnobs('l2dark', [
  ['l2dCount', 'Dark zones on the floor', 0, 8, 1, 2, 3],
  ['l2dSize',  'Dark zone size (radius, px)', 20, 160, 1, 60, 88],
  ['l2dOpen',  'Share of a zone that ends up open (small alien tunnels fill it to this)', 0, 0.9, 0.01, 0.65, 0.75],
]);
DEV_DEFAULTS.l2dRough = 1; DEV_DEFAULTS.l2dFringe = 30;
DEV_META.push(
  { k: 'l2dRough',  g: 'l2dark', label: 'Rough cave walls inside (0 = smooth)', min: 0, max: 2, step: 0.05 },
  { k: 'l2dFringe', g: 'l2dark', label: 'Ragged fringe round a zone: width (px)', min: 0, max: 120, step: 1 });
DEV_DEFAULTS.l2dSpace = 120; DEV_DEFAULTS.l2dShop = 140; DEV_DEFAULTS.l2dTop = 120; DEV_DEFAULTS.l2dSilk = 1;
DEV_DEFAULTS.l2dDark = 0.94; DEV_DEFAULTS.l2dEdge = 1.2; DEV_DEFAULTS.l2dHolo = 0.5; DEV_DEFAULTS.l2dBack = 0.3; DEV_DEFAULTS.l2dHoloBlur = 4;
DEV_META.push(
  { k: 'l2dSpace', g: 'l2dark', label: 'Zones apart, at least (px, plus half their sizes)', min: 0, max: 800, step: 5 },
  { k: 'l2dShop',  g: 'l2dark', label: 'Kept away from the shop (px above its roof)', min: 0, max: 600, step: 5 },
  { k: 'l2dTop',   g: 'l2dark', label: 'Kept away from the exits (px from the top)', min: 0, max: 600, step: 5 },
  { k: 'l2dSilk',  g: 'l2dark', label: 'Silk: how thick (×)', min: 0, max: 4, step: 0.05 },
  { k: 'l2dDark',  g: 'l2dark', label: 'Darkness (0 = none, 1 = pitch black)', min: 0, max: 1, step: 0.01 },
  { k: 'l2dEdge',  g: 'l2dark', label: 'Edge softness (fog cells of blur)', min: 0, max: 6, step: 0.1 },
  { k: 'l2dHolo',  g: 'l2dark', label: 'Hologram through the silk (0 = hidden, diffused)', min: 0, max: 1, step: 0.01 },
  { k: 'l2dHoloBlur', g: 'l2dark', label: 'How far the silk spreads the hologram\'s glow (terrain px of blur)', min: 0, max: 12, step: 0.5 },
  { k: 'l2dBack',  g: 'l2dark', label: 'Silk backlight (how much of it shows in the dark)', min: 0, max: 1, step: 0.01 });
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
// The Carrot stat (an Exo Suit stat perk): one level, 0-5, stretching several reaches at once.
// Each is a multiplier: min = no Carrot fitted, max = Carrot V, levels in between evenly (carrotAt).
export const CARROT_KNOBS = rangeKnobs('carrot', [
  ['caCam',   'Camera distance (×)',       0.3, 3, 0.05,  1, 1.35],
  ['caTorch', 'Torchlight reach (×)',      0.3, 4, 0.05,  1, 1.5],
  ['caAggro', 'Enemy aggro distance (×)',  0.3, 4, 0.05,  1, 1.25],
  ['caAim',   'Aim line length (×)',       0.3, 4, 0.05,  1, 2],
]);
export const DEV_KEY = 'caverunner-dev';
/** @type {DevKnobs} */
export const DEV = Object.assign({}, DEV_DEFAULTS);
// how long you get to repay a level bought on credit (ms): floor 1's is the Dev knob, the rest an hour
/** @param {number} floor */
export const dueMs = floor => floor === 1 ? DEV.due1 * 60000 : DEADLINE_MS;
(() => { try {
  const raw = localStorage.getItem(DEV_KEY);
  if (raw) { const o = JSON.parse(raw); for (const k in DEV_DEFAULTS) {
    const d = DEV_DEFAULTS[k], v = o[k];                      // numbers, or '#rrggbb' colours
    // numbers, '#rrggbb' colours, or a gradient / ramp string ("0:#ffffff 1:#401018", "0:0 1:1")
    if (typeof d === 'number' ? typeof v === 'number' && isFinite(v)
      : typeof v === 'string' && (HEX_RE.test(d) ? HEX_RE.test(v) : /^[\d.:#a-f\s]+$/i.test(v) && v.includes(':'))) DEV[k] = v;
  } }
} catch (_) {} })();
/** @param {string} k @param {number | string} v */
export function devSet(k, v) {
  DEV[k] = v;
  try { localStorage.setItem(DEV_KEY, JSON.stringify(DEV)); } catch (_) {}
}
