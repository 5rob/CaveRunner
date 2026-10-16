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
export const DEV_DEFAULTS = { zoom: 1.7, renderScale: 1.5, torch: 0.7, fogDark: 0.99, fogDim: 0.9, move: 1.2, sputDip: 45, aggro: 0.6, loseAggro: 2, aimDist: 44, bhPull: 65, bhSpeed: 50, vol: 1, amb: 0.4, jetVol: 0.05,
  vSpell: 0.6, vBoom: 1, vHit: 1, vEnemy: 1, vEnemyFire: 1, vWorld: 1, vDrip: 0.5, vStep: 1, vUi: 1, bagSpeed: 1,
  holoAlpha: 1, bloom: 2, bloomBlur: 35, bloomBright: 1.3, pixelFx: 1, holoPx: 1.5,
  holoMin: 0, holoMax: 1, holoFade: 3, holoC1x: 0.41, holoC1y: 0.97, holoC2x: 0.45, holoC2y: -0.02,
  guideCps: 30, guideWait: 1.4, guideIn: 50, shopGap: 0.9, shopTorch: 0.45, beamDeg: 50, beamReach: 2.2, beamNear: 0.5, beamGlow: 0.5,
  due1: 1440, enemies: ENEMY_COUNT, enemiesUp: 20, lvlBonus: LVL_SELL - LVL_BUY, lvlGrow: 3, rewardGrow: 2, killGrow: 1.35,
  runnerPx: 1, runnerLine: 0, aimPad: 5,
  ptrStart: 0.01, ptrReach: 1, ptrSize: 0.5, ptrLine: 0.75, snapR: 75, snapPull: 0.75, snapHit: 25,
  witPad: 80, witKbps: 2500,
  webSag: 0.08, bendK: 140, bendDamp: 5, bendPush: 0.3, bendGrab: 0.35, bendDip: 5, bendMax: 14,
  vineGrav: 1, vineDamp: 1.2, vinePush: 0.6, vineMax: 0.9, vineLinks: 4, vineTailDamp: 1.5 };
// g: the collapsible group the knob sits in on the Dev panel (DEV_GROUPS gives the order)
/** @type {DevRow[]} */
export const DEV_META = [
  { k: 'zoom',      g: 'view',  label: 'Camera zoom',                 min: 0.3, max: 3,  step: 0.05 },
  { k: 'renderScale', g: 'view', label: 'Draw sharpness: canvas px per screen px, at most (lower = faster, softer)', min: 0.5, max: 4, step: 0.25 },
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
  { k: 'aimPad',    g: 'player', label: 'Right stick: trigger ring’s gap inside the gauge rings (px; bigger = fires sooner)', min: 0, max: 40, step: 1 },
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
  ['enemy', 'Enemies'], ['elite', 'Elites'], ['elitefx', 'Elites: flames'], ['spider', 'Spider'], ['rat', 'Rats & nests'], ['jelly', 'Jellyfish'], ['jellycol', 'Jellyfish colours'], ['bh', 'Black Hole tweaks'], ['sound', 'Sound'], ['ui', 'Bag screen'], ['menuptr', 'Menu pointer & snapping'], ['witness', 'Witness (death replays)'], ['level', 'Level layout (floor 1)'], ['level2', 'Level 2: layout & look'], ['l2dark', 'Level 2: dark zones'], ['l2boom', 'Level 2: destruction'], ['l2alien', 'Level 2: aliens'], ['arch', 'Arched vines'], ['sway', 'Vines & webs: sway'], ['fire', 'Fire'], ['carrot', 'Carrot (suit stat)']];
// The Dev panel's tabs: each a page of DEV_GROUPS, in this order (a group in no tab lands on the last)
/** @type {[string, string, string[]][]} */
export const DEV_TABS = [
  ['look', 'Look', ['view', 'light', 'fx', 'holoflash', 'guide']],
  ['player', 'Player', ['player', 'carrot', 'bh', 'sound', 'ui', 'menuptr', 'aimassist', 'witness']],
  ['creatures', 'Creatures', ['enemy', 'elite', 'elitefx', 'spider', 'rat', 'jelly', 'jellycol']],
  ['world', 'World', ['level', 'arch', 'sway']],
  ['level2', 'Level 2', ['level2', 'l2dark', 'l2boom', 'l2alien']],
];
/** @param {string} g @returns {string} the tab a group sits on */
export const devTabOf = g => (DEV_TABS.find(t => t[2].includes(g)) || DEV_TABS[DEV_TABS.length - 1])[0];
// The dev values that differ from their defaults, as text to paste back to Claude so they
// can become the new defaults. Every DEV key, rows or not (v1.0.94: the Zones page's check boxes,
// zv_*, have no row); numbers rounded (a slider's float noise). The whole Copy Dev settings, with
// the parts kept outside DEV (gun presets, the Grem kit), is auto/devcopy.js devCopyText.
/** @param {number | string} v */
const shown = v => (typeof v === 'number' ? +v.toFixed(6) : v);
export function devReport() {
  const label = new Map(DEV_META.map(m => [m.k, m.label]));
  const keys = Object.keys(DEV_DEFAULTS), changed = keys.filter(k => DEV[k] !== DEV_DEFAULTS[k]);
  const lines = ['CaveRunner ' + VERSION + ' dev settings — please make these the new defaults:', ''];
  if (!changed.length) lines.push('(nothing changed — everything is at its default)');
  for (const k of changed)
    lines.push('- ' + (label.get(k) || k) + ' (DEV.' + k + '): ' + shown(DEV[k]) + '   [default ' + DEV_DEFAULTS[k] + ']');
  lines.push('', 'Unchanged: ' + (keys.filter(k => DEV[k] === DEV_DEFAULTS[k]).join(', ') || 'none'));
  return lines.join('\n');
}
/** the DEV values that differ from their defaults (what a device keeps, v1.0.94) */
export const devChanged = () => Object.fromEntries(Object.keys(DEV_DEFAULTS).filter(k => DEV[k] !== DEV_DEFAULTS[k]).map(k => [k, DEV[k]]));
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
  ['raNests',    'Nests in the built-up zones',       0, 60, 1,      4, 8],
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
  ['lvCaves',   'Big caverns',                        0, 8, 0.1,    2.5, 4.5],
  ['lvCaveW',   'Cavern half width (px)',             20, 320, 5,   120, 200],
  ['lvCaveH',   'Cavern half height (px)',            20, 320, 5,   100, 150],
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
  ['elHp',      'Health (× a normal one)',                0.5, 10, 0.1,  2.5, 4],
  ['elDmg',     'Damage (× a normal one)',                0.5, 10, 0.1,  1.5, 3],
  ['elGold',    'Gold reward (× a normal one)',           0, 20, 0.5,    4, 5],
  ['elRed',     'Red crystals dropped',                   0, 20, 1,      3, 6],
  ['elGreen',   'Green crystals dropped',                 0, 10, 1,      1, 2],
  ['elScale',   'Size (× a normal one)',                  0.5, 3, 0.05,  1, 3],
  ['elTintAmt', 'Tint strength (0 none, 1 all tint)',     0, 1, 0.05,    0.45, 0.75],
  ['elGlow',    'Highlight glow strength',                0, 1, 0.01,    0, 0],
  ['elGlowR',   'Highlight glow size (past its body)',    0, 40, 1,      2, 7],
]);
export const ELITE_COLS = colourKnobs('elite', [
  ['elTint', 'Tint and glow colour', '#fff382', '#ffe100', 'tint'],
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
DEV_DEFAULTS.elFxGrad = '0:#000000 0.384:#000000 0.444:#ffffff 0.483:#c76eff 0.518:#9d57da 0.586:#11095e 0.662:#000000 0.748:#220347 0.852:#b2a6ff 0.941:#000000 1:#230e4f 1:#230e4f';
DEV_DEFAULTS.elFxAlpha = '0:0 0.078:0.55 0.222:0.662 0.55:0.85 1:1';
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
// and its look: the palette (the Tombs theme, data/themes.js themeFor) and how much decoration
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
// Level 2: destruction (world/destroy.js, Level 2 stage 5): explosions scattered round the
// dark zones, denser and bigger near them, and bones across the wasteland. Distances in terrain pixels. destructionOpts() reads them.
DEV_DEFAULTS.l2bMaxDist = 100; DEV_DEFAULTS.l2bCount = 100; DEV_DEFAULTS.l2bFire = 30; DEV_DEFAULTS.l2bJitter = 0; DEV_DEFAULTS.l2bClear = 4; DEV_DEFAULTS.l2bBones = 90; DEV_DEFAULTS.l2bInRock = 1; DEV_DEFAULTS.l2bScorch = 1.8; DEV_DEFAULTS.l2bStreak = 1;
DEV_META.push(
  { k: 'l2bMaxDist', g: 'l2boom', label: 'Reach: most distance from a dark zone (px)', min: 1, max: 1600, step: 5 },
  { k: 'l2bCount',   g: 'l2boom', label: 'Number of explosions', min: 0, max: 2000, step: 1 },
  { k: 'l2bFire',    g: 'l2boom', label: 'Explosions that cause fire (%)', min: 0, max: 100, step: 1 },
  { k: 'l2bJitter',  g: 'l2boom', label: 'Extra position randomness (± px)', min: 0, max: 100, step: 1 },
  { k: 'l2bInRock',  g: 'l2boom', label: 'Blasts anywhere in the ring, rock too (0: open air only)', min: 0, max: 1, step: 1 },
  { k: 'l2bScorch',  g: 'l2boom', label: 'Scorch ring width (× the hole\'s radius)', min: 0, max: 4, step: 0.05 },
  { k: 'l2bStreak',  g: 'l2boom', label: 'Blast streaks: length × (0: none)', min: 0, max: 4, step: 0.05 },
  { k: 'l2bClear',   g: 'l2boom', label: 'Clearance from terrain, open air only (px)', min: 0, max: 60, step: 1 },
  { k: 'l2bBones',   g: 'l2boom', label: 'Bones and skulls in the ground, outside the zones', min: 0, max: 600, step: 1 });
export const L2B_KNOBS = rangeKnobs('l2boom', [
  ['l2bSize', 'Explosion size (px radius)', 1, 120, 1, 6, 18],
]);
curveKnobs('l2boom', 'l2bDen', 'Destruction amount (Y) by distance from a dark zone (X)', 0, 1, { y0: 1, x1: 0.33, y1: 0.67, x2: 0.66, y2: 0.33, y3: 0 });
curveKnobs('l2boom', 'l2bScale', 'Size × (Y, 0-2) by distance from a dark zone (X)', 0, 2, { y0: 2, x1: 0.33, y1: 1.4, x2: 0.66, y2: 0.7, y3: 0.25 });
// Level 2 stage 4: floor 2's dark zones (world/dark.js darkZones; their look: game/render/dark.js). Terrain px
// for sizes; how many and how big are rolled per floor on the zones' own stream
export const L2D_KNOBS = rangeKnobs('l2dark', [
  ['l2dCount', 'Dark zones on the floor', 0, 8, 1, 2, 3],
  ['l2dSize',  'Dark zone size (radius, px)', 20, 320, 1, 120, 176],     // (doubled: owner, round 5)
  ['l2dOpen',  'Share of a zone that ends up open (small alien tunnels fill it to this)', 0, 0.9, 0.01, 0.65, 0.75],
]);
DEV_DEFAULTS.l2dRough = 1; DEV_DEFAULTS.l2dFringe = 30;
DEV_META.push(
  { k: 'l2dRough',  g: 'l2dark', label: 'Rough cave walls inside (0 = smooth)', min: 0, max: 2, step: 0.05 },
  { k: 'l2dFringe', g: 'l2dark', label: 'Ragged fringe round a zone: width (px)', min: 0, max: 120, step: 1 });
DEV_DEFAULTS.l2dSpace = 120; DEV_DEFAULTS.l2dShop = 140; DEV_DEFAULTS.l2dTop = 120; DEV_DEFAULTS.l2dSilk = 1;
DEV_DEFAULTS.l2dDark = 1; DEV_DEFAULTS.l2dBands = 3; DEV_DEFAULTS.l2dHoloBlur = 0; DEV_DEFAULTS.l2dHolo = 0.8; DEV_DEFAULTS.l2dBack = 0.12; DEV_DEFAULTS.l2dBlur = 5; DEV_DEFAULTS.l2dFireR = 45;
DEV_DEFAULTS.l2dTintDepth = 12; DEV_DEFAULTS.l2dTorchDepth = 18; DEV_DEFAULTS.l2dTorchHyst = 4;   // (owner: black a short way in, most of a zone dark; the torch fails just past it)
DEV_META.push(
  { k: 'l2dSpace', g: 'l2dark', label: 'Zones apart, at least (px, plus half their sizes)', min: 0, max: 800, step: 5 },
  { k: 'l2dShop',  g: 'l2dark', label: 'Kept away from the shop (px above its roof)', min: 0, max: 600, step: 5 },
  { k: 'l2dTop',   g: 'l2dark', label: 'Kept away from the exits (px from the top)', min: 0, max: 600, step: 5 },
  { k: 'l2dSilk',  g: 'l2dark', label: 'Silk: how thick (×)', min: 0, max: 4, step: 0.05 },
  { k: 'l2dDark',  g: 'l2dark', label: 'Darkness (0 = none, 1 = pitch black)', min: 0, max: 1, step: 0.01 },
  { k: 'l2dBands', g: 'l2dark', label: 'Edge: steps of grey from clear to black (owner: 3, no blur)', min: 1, max: 12, step: 1 },
  { k: 'l2dHoloBlur', g: 'l2dark', label: 'Silk blurs the hologram behind it (0 off: faster, 1 on)', min: 0, max: 1, step: 1 },
  { k: 'l2dHolo',  g: 'l2dark', label: 'Hologram through the silk (0 = hidden, diffused)', min: 0, max: 1, step: 0.01 },
  { k: 'l2dBlur',  g: 'l2dark', label: 'Silk blur: how much it frosts the back wall (and the hologram, if on) behind it (terrain px)', min: 0, max: 12, step: 0.5 },
  { k: 'l2dBack',  g: 'l2dark', label: 'Back wall brightness behind the silk', min: 0, max: 1, step: 0.01 },
  { k: 'l2dFireR', g: 'l2dark', label: 'Fire lifts the black tint out to (px)', min: 1, max: 200, step: 1 },
  { k: 'l2dTintDepth', g: 'l2dark', label: 'Black fades in over this far into a zone (px)', min: 1, max: 160, step: 1 },
  { k: 'l2dTorchDepth', g: 'l2dark', label: 'The torch fails this far in (px; just past the fade\'s end)', min: 0, max: 200, step: 1 },
  { k: 'l2dTorchHyst', g: 'l2dark', label: 'And comes back on this much nearer the edge (px, no strobing)', min: 0, max: 40, step: 1 });
DEV_DEFAULTS.l2dFlk = 1; DEV_DEFAULTS.l2dFlkRate = 0.9; DEV_DEFAULTS.l2dFlkTears = 0.75; DEV_DEFAULTS.l2dFlkDrops = 0.9; DEV_DEFAULTS.l2dFlkFlash = 1.6; DEV_DEFAULTS.l2dFlkGlitch = 10; DEV_DEFAULTS.l2dFlkNear = 40; DEV_DEFAULTS.l2dFlkBase = 0.5;
DEV_META.push(   // the hologram glitching while you're in or near a zone (world/holoflicker.js; owner, after v0.0.148)
  { k: 'l2dFlk',       g: 'l2dark', label: 'Hologram glitches in the zones (0 off, 1 on)', min: 0, max: 1, step: 1 },
  { k: 'l2dFlkBase',   g: 'l2dark', label: 'Glitch: the hologram between bursts (× its brightness; 0 = dark till a burst)', min: 0, max: 1, step: 0.05 },
  { k: 'l2dFlkRate',   g: 'l2dark', label: 'Glitch: how often it blinks on bright (flashes a second)', min: 0, max: 8, step: 0.05 },
  { k: 'l2dFlkTears',  g: 'l2dark', label: 'Glitch: how often it tears into slices (a second)', min: 0, max: 8, step: 0.05 },
  { k: 'l2dFlkDrops',  g: 'l2dark', label: 'Glitch: how often it cuts out (a second)', min: 0, max: 8, step: 0.05 },
  { k: 'l2dFlkFlash',  g: 'l2dark', label: 'Glitch: flash brightness (× the hologram; past 1 brighter than it)', min: 0, max: 3, step: 0.05 },
  { k: 'l2dFlkGlitch', g: 'l2dark', label: 'Glitch: tearing, how far the slices jump (terrain px; 0 none)', min: 0, max: 60, step: 1 },
  { k: 'l2dFlkNear',   g: 'l2dark', label: 'Glitch starts this near a zone (px outside its box)', min: 0, max: 200, step: 1 });
curveKnobs('l2dark', 'l2dFire', 'Fire lifts the black (Y, 1 = full colour) by distance to it (X, 0 to the max)', 0, 1, { y0: 1, x1: 0.35, y1: 1, x2: 0.55, y2: 0.1, y3: 0 });
// Level 2 stage 7b: the dark zones' aliens (creatures/alien.js alienStep; spawned in world/level.js). World units
// for reaches and speeds (CELL = 2 a terrain px)
export const AL_KNOBS = rangeKnobs('l2alien', [
  ['alCount',   'Aliens per dark zone',                         0, 400, 1,     30, 60],
  ['alStrays',  'Strays per floor (black, outside the zones)',  0, 20, 1,      2, 4],
  ['alScale',   'Size × (each one rolled in this range)',        0.2, 5, 0.05,  0.6, 2.4],
  ['alBias',    'Size: lean to small (1 even; higher = more small, few big)', 1, 8, 0.1, 3, 4],
  ['alSpeed',   'Roaming: burst speed',                          10, 600, 5,    80, 240],
  ['alRoamOn',  'Roaming: burst length (s)',                     0.02, 3, 0.01, 0.15, 0.9],
  ['alRoamOff', 'Roaming: rest between (s)',                     0, 6, 0.05,    0.3, 2],
  ['alFleeSpd', 'Fleeing (and a stray sprinting home): speed',   10, 800, 5,    220, 320],
  ['alFleeR',   'Flees from fire within (world units)',          0, 600, 5,     110, 140],
  ['alHunt',    'Coming for you in the dark: speed',             10, 600, 5,    120, 200],
  ['alKeep',    'In light: keeps this far from you',             0, 300, 5,     50, 80],
  ['alAggro',   'Aggro distance (×enemy aggro)',                 0.1, 5, 0.05,  0.9, 1.1],
  ['alBoidR',   'Pack: neighbours within',                       2, 80, 1,      14, 20],
  ['alSep',     'Pack: separation weight',                       0, 5, 0.05,    1.2, 1.6],
  ['alAli',     'Pack: alignment weight',                        0, 5, 0.05,    0.5, 0.8],
  ['alCoh',     'Pack: cohesion weight',                         0, 5, 0.05,    0.4, 0.6],
  ['alBite',    'Bite damage',                                   0, 100, 1,     3, 5],
  ['alBiteCd',  'Secs between bites',                            0.1, 5, 0.05,  0.6, 1.2],
  ['alGlimpse', 'A bullet lifts the black: strength (0-1)',      0, 1, 0.01,    0.35, 0.5],
  ['alGlimpseR','A bullet lifts the black: radius (world units)',0, 200, 1,     22, 30],
]);
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
  ['fireSpread', 'Spread chance per tick',            0, 1, 0.01,    0.02, 0.6],
  ['fireGrass',  'Grass burns for (s)',               0.05, 5, 0.05, 0.4, 1.5],
  ['fireMoss',   'Moss burns for (s)',                0.05, 8, 0.05, 1, 4],
  ['fireWood',   'Timber burns for (s)',              0.1, 20, 0.1,  3, 9],
  ['fireBoom',   'Explosions light things (chance)',  0, 1, 0.05,    0.35, 0.6],
  ['fireBurn',   'A creature burns for (s)',          0, 20, 0.1,    3, 6],
  ['fireDps',    'Creature burn damage per s',        0, 20, 0.1,    1, 3],
  ['fireYou',    'You burn for (s)',                  0, 10, 0.1,    1.2, 2],
  ['fireYouDps', 'Your burn damage per s',            0, 40, 0.5,    5, 8],
  ['firePlant',  'Vines burn up at (px/s)',           1, 200, 1,     3, 7],
  ['fireArch',   'Arched vines burn along at (px/s)', 1, 400, 1,     5, 9],
]);
// The Carrot stat (an Exo Suit stat perk): one level, 0-5, stretching several reaches at once.
// Each is a multiplier: min = no Carrot fitted, max = Carrot V, levels in between evenly (carrotAt).
export const CARROT_KNOBS = rangeKnobs('carrot', [
  ['caCam',   'Camera distance (×)',       0.3, 3, 0.05,  1, 3],
  ['caTorch', 'Torchlight reach (×)',      0.3, 4, 0.05,  0.4, 1.5],
  ['caAggro', 'Enemy aggro distance (×)',  0.3, 4, 0.05,  1, 2],
  ['caAim',   'Aim line length (×)',       0.3, 4, 0.05,  0.5, 1.2],
]);
// Aim Assist (the 'aimassist' mod, LIST3 #10): the right stick drives a pointer out from your gun that
// snaps onto creatures and fires once it's on one (spells/assist.js, game/systems/gun.js aimAndCast)
Object.assign(DEV_DEFAULTS, { aaStart: 0.12, aaReach: 1, aaSnapR: 40, aaPull: 0.45, aaHit: 10, aaHold: 1.5,
  aaDelay: 0.08, aaSize: 26, aaLine: 1.25, aaDot: 2 });
DEV_META.push(
  { k: 'aaStart', g: 'aimassist', label: 'Stick push before the pointer comes out (of its reach)', min: 0, max: 0.9, step: 0.01 },
  { k: 'aaReach', g: 'aimassist', label: 'Pointer reach (× distance from the gun to the far screen corner)', min: 0.2, max: 3, step: 0.05 },
  { k: 'aaSnapR', g: 'aimassist', label: 'Snap reach (world units from a creature’s edge)', min: 0, max: 200, step: 1 },
  { k: 'aaPull',  g: 'aimassist', label: 'Snap pull (0 none, 1 right onto its middle)', min: 0, max: 1, step: 0.01 },
  { k: 'aaHit',   g: 'aimassist', label: 'Counts as on a creature within (world units of its edge)', min: 0, max: 80, step: 1 },
  { k: 'aaHold',  g: 'aimassist', label: 'Stickiness: stays on its creature out to this × the snap-on distance', min: 1, max: 4, step: 0.05 },
  { k: 'aaDelay', g: 'aimassist', label: 'Fires this long after snapping on (s)', min: 0, max: 1, step: 0.01 },
  { k: 'aaSize',  g: 'aimassist', label: 'Ring size (px across)', min: 6, max: 80, step: 1 },
  { k: 'aaLine',  g: 'aimassist', label: 'Ring line width (px)', min: 0.25, max: 4, step: 0.25 },
  { k: 'aaDot',   g: 'aimassist', label: 'Centre dot when snapped (px, 0 none)', min: 0, max: 6, step: 0.5 });
DEV_GROUPS.push(['aimassist', 'Aim Assist']);
// CaveRunner Auto's economy (auto/run.js, AUTOBATTLER.md section 6): the machines' prices and scrap
Object.assign(DEV_DEFAULTS, { autoGunBase: 100, autoGunGrow: 1.35, autoExoPrice: 175, autoScrap: 25,
  autoRed: 40, autoGreen: 150, autoModGold: 15 });
DEV_META.push(
  { k: 'autoGunBase',  g: 'auto', label: 'Gun machine: price at tier 1 (gold)', min: 5, max: 2000, step: 5 },
  { k: 'autoGunGrow',  g: 'auto', label: 'Gun machine: price × each tier up', min: 1, max: 4, step: 0.05 },
  { k: 'autoExoPrice', g: 'auto', label: 'Exo machine: price (% of the gun price)', min: 1, max: 300, step: 1 },
  { k: 'autoScrap',    g: 'auto', label: 'Scrap: a gun, exo mod or perk gives (% of its price)', min: 0, max: 100, step: 1 },
  { k: 'autoRed',      g: 'auto', label: 'Scrap: a red gem (gold × the tier’s gold scale)', min: 0, max: 1000, step: 1 },
  { k: 'autoGreen',    g: 'auto', label: 'Scrap: a green gem (gold × the tier’s gold scale)', min: 0, max: 2000, step: 1 },
  { k: 'autoModGold',  g: 'auto', label: 'Scrap: a gun mod (gold × the tier’s gold scale)', min: 0, max: 500, step: 1 });
DEV_GROUPS.push(['auto', 'Auto: economy']);
// CaveRunner Auto's hub (auto/hub.js, stage 3b): the team walking between the stops
// (player 1 moves on the old game's own numbers, core/consts.js WALK / JET / GRAVITY, feedback round 1)
Object.assign(DEV_DEFAULTS, { autoHubWalk: 150, autoHubSpace: 16, autoHubDemoNear: 100 });
DEV_META.push(
  { k: 'autoHubWalk',  g: 'autohub', label: 'The others’ walk speed to their place in line (world units / s)', min: 10, max: 400, step: 5 },
  { k: 'autoHubSpace', g: 'autohub', label: 'Players line up this far apart (world units)', min: 4, max: 40, step: 1 },
  { k: 'autoHubDemoNear', g: 'autohub', label: 'A crystal machine plays its demo with you this near (world units; the old shop’s 100)', min: 20, max: 240, step: 5 });
DEV_GROUPS.push(['autohub', 'Auto: hub']);
// Grem Mode (auto/grem.js): the unlocks' prices (each dearer than the last), how fast the creatures toughen, the gold, the dark
Object.assign(DEV_DEFAULTS, { gremPrice: 100, gremGrow: 1.5, gremHard: 0.25, gremGold: 2, gremDark: 0.85, gremPickR: 40, gremChestSize: 2, gremChestGlow: 1, gremBossT: 3.2, gremGoT: 1.6, gremDmgScale: 1, gremGoldWait: 0.6 });
DEV_META.push(
  { k: 'gremPrice', g: 'grem', label: 'The first unlock costs (gold)', min: 5, max: 10000, step: 5 },
  { k: 'gremGrow',  g: 'grem', label: 'Each unlock after it costs × this more', min: 1, max: 4, step: 0.05 },
  { k: 'gremHard',  g: 'grem', label: 'Creatures toughen per level × (1 = as CaveRunner Auto)', min: 0, max: 1, step: 0.05 },
  { k: 'gremGold',  g: 'grem', label: 'Gold drops × (kills and chests)', min: 1, max: 10, step: 0.5 },
  { k: 'gremDark',  g: 'grem', label: 'The dark × (1 = as CaveRunner Auto; owner: 0.85, 15% brighter)', min: 0, max: 1, step: 0.05 },
  { k: 'gremChestSize', g: 'grem', label: 'Chests × bigger', min: 1, max: 4, step: 0.25 },
  { k: 'gremChestGlow', g: 'grem', label: 'Chests: the green light pulsing behind (0 off)', min: 0, max: 1, step: 0.05 },
  { k: 'gremBossT', g: 'grem', label: 'The boss comes in under its name for (s; then the fight)', min: 0.5, max: 8, step: 0.1 },
  { k: 'gremGoT', g: 'grem', label: 'GO! shows for (s)', min: 0.5, max: 5, step: 0.1 },
  { k: 'gremDmgScale', g: 'grem', label: 'Guns grow with the level: share of the creatures’ health growth (1 all, 0 none)', min: 0, max: 2, step: 0.05 },
  { k: 'gremGoldWait', g: 'grem', label: 'Gold bounces this long before it flies to you (s)', min: 0, max: 3, step: 0.05 },
  { k: 'gremPickR', g: 'grem', label: 'A tap picks the creature nearest it within (world units; the screen is 220 across)', min: 5, max: 220, step: 5 });
DEV_GROUPS.push(['grem', 'Grem Mode']);
// CaveRunner Auto's maps (auto/maps.js): the map machine's prices, and how much harder each map starts
Object.assign(DEV_DEFAULTS, { autoMapPrice: 1000000, autoMapGrow: 1, autoMapStep: 5 });
DEV_META.push(
  { k: 'autoMapPrice', g: 'automaps', label: 'Map machine: the second map’s price (gold)', min: 1000, max: 10000000, step: 1000 },
  { k: 'autoMapGrow',  g: 'automaps', label: 'Map machine: price × each map after the second', min: 1, max: 10, step: 0.1 },
  { k: 'autoMapStep',  g: 'automaps', label: 'Each map starts this many tiers harder than the one before', min: 0, max: 50, step: 1 });
DEV_GROUPS.push(['automaps', 'Auto: maps']);
// CaveRunner Auto's level (auto/level.js, auto/pilot.js, stage 4a): its length and the team's pace
Object.assign(DEV_DEFAULTS, { autoLvlMin: 2, autoLvlPace: 1, autoLvlPaceTop: 3, autoLvlPaceLv: 20, autoLvlHurry: 1.75, autoLvlSlow: 0.3, autoLvlElite: 0.4, autoLvlChest: 0.75,
  autoLvlEliteR: 120, autoLvlChestR: 50, autoLvlBossT: 120, autoLvlEase: 2, autoClearT: 3, autoClearWait: 4 });
DEV_META.push(
  { k: 'autoLvlMin',    g: 'autolevel', label: 'Level length (minutes at normal pace)', min: 0.2, max: 20, step: 0.1 },
  { k: 'autoLvlPace',   g: 'autolevel', label: 'Normal pace at level 1 (× the menu’s scroll, 34 world units / s)', min: 0.1, max: 4, step: 0.05 },
  { k: 'autoLvlPaceTop', g: 'autolevel', label: 'Normal pace rises evenly to this (× the menu’s scroll) …', min: 0.1, max: 6, step: 0.05 },
  { k: 'autoLvlPaceLv', g: 'autolevel', label: '… by this level (held after)', min: 2, max: 100, step: 1 },
  { k: 'autoLvlHurry',  g: 'autolevel', label: 'Stick pushed all the way right hurries to (× pace)', min: 1, max: 4, step: 0.05 },
  { k: 'autoLvlSlow',   g: 'autolevel', label: 'Stick pushed all the way left slows to (× pace; never stops)', min: 0.05, max: 1, step: 0.05 },
  { k: 'autoLvlElite',  g: 'autolevel', label: 'An elite alive and near slows to (× pace)', min: 0, max: 1, step: 0.05 },
  { k: 'autoLvlChest',  g: 'autolevel', label: 'Passing a chest slows to (× pace)', min: 0, max: 1, step: 0.05 },
  { k: 'autoLvlEliteR', g: 'autolevel', label: 'An elite counts as near within (world units)', min: 10, max: 400, step: 5 },
  { k: 'autoLvlChestR', g: 'autolevel', label: 'A chest counts as near within (world units)', min: 5, max: 300, step: 5 },
  { k: 'autoLvlBossT',  g: 'autolevel', label: 'Boss arena: given up after (s; a fallback if the boss can’t be reached)', min: 5, max: 600, step: 5 },
  { k: 'autoLvlEase',   g: 'autolevel', label: 'Pace changes by at most (× pace / s)', min: 0.2, max: 10, step: 0.1 },
  { k: 'autoClearT',    g: 'autolevel', label: 'LEVEL CLEARED shows for (s; then the team walks to the exit)', min: 1, max: 10, step: 0.1 },
  { k: 'autoClearWait', g: 'autolevel', label: 'LEVEL CLEARED waits for the boss’s loot at most (s; a full bag leaves it lying)', min: 0, max: 20, step: 0.5 });
// (Auto zones) which zone a point of a tall level looks like: titlescene.js titleZoneLook (the old game's warped noise zones)
Object.assign(DEV_DEFAULTS, { autoZoneWarp: 170, autoZoneScale: 150, autoZoneRag: 0.8, autoZoneIsle: 0.12, autoZoneOpen: 0, autoHardDeep: 90, autoHardEdge: 8 });
DEV_META.push(
  { k: 'autoZoneWarp',  g: 'autolevel', label: 'Zones: borders curve up to this far either way (world units; 0 straight)', min: 0, max: 400, step: 5 },
  { k: 'autoZoneScale', g: 'autolevel', label: 'Zones: the curves’ size (world units)', min: 30, max: 600, step: 5 },
  { k: 'autoZoneRag',   g: 'autolevel', label: 'Zones: how twisted the borders are (domain warp)', min: 0, max: 3, step: 0.05 },
  { k: 'autoZoneIsle',  g: 'autolevel', label: 'Zones: islands of the next zone (share of the area)', min: 0, max: 0.5, step: 0.01 },
  { k: 'autoZoneOpen',  g: 'autolevel', label: 'Zones: another zone’s look opens its own caves too (1 on; 0: shapes by x)', min: 0, max: 1, step: 1 },
  { k: 'autoHardDeep',  g: 'autolevel', label: 'Blasts bite less over this many units above the level’s bottom edge (0: off)', min: 0, max: 300, step: 5 },
  { k: 'autoHardEdge',  g: 'autolevel', label: '… and not at all in this many units at the very bottom', min: 0, max: 60, step: 1 });
DEV_GROUPS.push(['autolevel', 'Auto: level']);
// (feedback round 2) manual mode (a helmet held in a level, auto/level.js roamStep): the view follows the steered player at
// autoRoamCam × his offset from the middle (world units / s per world unit: slower the nearer he is); he can go back at
// most autoRoamBack screens behind the furthest the level got (capped by what the scene keeps: titlescene.js TITLE_BACK)
Object.assign(DEV_DEFAULTS, { autoRoamCam: 2.5, autoRoamBack: 1.5 });
DEV_META.push(
  { k: 'autoRoamCam',  g: 'autolevel', label: 'Manual mode: the view follows the steered player at (× his offset from the middle, per s)', min: 0.2, max: 10, step: 0.1 },
  { k: 'autoRoamBack', g: 'autolevel', label: 'Manual mode: he can roam back at most (screens behind the furthest point)', min: 0, max: 1.6, step: 0.05 });
// CaveRunner Auto's blocked zones (auto/blocked.js, stage 6b)
Object.assign(DEV_DEFAULTS, { autoBlockN: 2, autoBlockMin: 0.2, autoBlockMax: 1, autoBlockFull: 0.85, autoBlockThin: 16, autoBlockWide: 0.75, autoWebSlow: 0.2, autoWebHalt: 0.25, autoWallMin: 20, autoWallMax: 35 });
DEV_META.push(
  { k: 'autoWallMin',   g: 'autoblocks', label: 'The level’s first wall: at least this many seconds in at full hurry (normal pace: × the hurry knob)', min: 0, max: 120, step: 1 },
  { k: 'autoWallMax',   g: 'autoblocks', label: '… and at most this many (each level picks between; both 0: no planted wall)', min: 0, max: 180, step: 1 },
  { k: 'autoBlockN',    g: 'autoblocks', label: 'Blocked zones a level (a fraction: a chance of one more)', min: 0, max: 8, step: 0.1 },
  { k: 'autoBlockMin',  g: 'autoblocks', label: 'Severity: at least (0 a low lump … 1 blocked all the way)', min: 0, max: 1, step: 0.05 },
  { k: 'autoBlockMax',  g: 'autoblocks', label: 'Severity: at most', min: 0, max: 1, step: 0.05 },
  { k: 'autoBlockFull', g: 'autoblocks', label: 'Severity from which it’s blocked all the way (no jetting over)', min: 0.1, max: 1, step: 0.05 },
  { k: 'autoBlockThin', g: 'autoblocks', label: 'Thinnest blockage (world units)', min: 6, max: 80, step: 2 },
  { k: 'autoBlockWide', g: 'autoblocks', label: 'Widest blockage (share of its zone)', min: 0.1, max: 1, step: 0.05 },
  { k: 'autoWebSlow',   g: 'autoblocks', label: 'Each web line a player is caught in slows him by (× pace; they multiply)', min: 0, max: 0.9, step: 0.01 },
  { k: 'autoWebHalt',   g: 'autoblocks', label: 'Slowed below this the team halts (clears the webs, or is blocked)', min: 0, max: 1, step: 0.01 });
DEV_GROUPS.push(['autoblocks', 'Auto: blocks']);
// (owner, after v1.0.74) orb webs in the spiders' zone (world/orbweb.js, placed by art/titlescene.js)
Object.assign(DEV_DEFAULTS, { autoOrbChance: 0.25, autoOrbMax: 5, autoOrbSpokes: 9, autoOrbRMin: 30, autoOrbR: 150, autoOrbGap: 5 });
DEV_META.push(
  { k: 'autoOrbChance', g: 'autoorb', label: 'Orb web: chance at each spot in the webs zone (× its density)', min: 0, max: 1, step: 0.01 },
  { k: 'autoOrbMax',    g: 'autoorb', label: 'Orb webs at once at most', min: 0, max: 10, step: 1 },
  { k: 'autoOrbSpokes', g: 'autoorb', label: 'Orb web: spokes tried', min: 5, max: 16, step: 1 },
  { k: 'autoOrbRMin',   g: 'autoorb', label: 'Orb web: size, smallest (its longest spoke, world units)', min: 15, max: 250, step: 1 },
  { k: 'autoOrbR',      g: 'autoorb', label: 'Orb web: size, largest (its longest spoke, world units)', min: 15, max: 250, step: 1 },
  { k: 'autoOrbGap',    g: 'autoorb', label: 'Orb web: spiral spacing (world units)', min: 2, max: 15, step: 0.5 });
DEV_GROUPS.push(['autoorb', 'Auto: orb webs']);
// (owner, after v1.0.74) the spider zone (art/titlescene.js spiderRock): its scattered rock; and mines the spiders took over
Object.assign(DEV_DEFAULTS, { autoSpiderRock: 0.28, autoSpiderMine: 0.35 });
DEV_META.push(
  { k: 'autoSpiderRock', g: 'zone_spider', label: 'Spider zone: boulders in its open air (share; more: more rock)', min: 0, max: 0.6, step: 0.01 },
  { k: 'autoSpiderMine', g: 'autozones', label: 'Spider web filled: chance a zone that may have it does (Zones page; was mines only)', min: 0, max: 1, step: 0.05 });
// (Dev → Zones, ui/zonesim.js) the zone variants: which zone kinds may have each (art/titlescene.js zoneMay; DEV.zv_<variant>_<zone>, 1 / 0,
// the page's check boxes, not rows), and how often heavy vegetation comes up where it may
Object.assign(DEV_DEFAULTS, { autoVegChance: 0.35, zv_veg_moss: 1, zv_veg_webs: 0, zv_veg_timber: 0, zv_veg_paved: 0, zv_veg_grove: 0, zv_veg_winding: 0, zv_veg_spider: 1,
  zv_spid_moss: 1, zv_spid_webs: 0, zv_spid_timber: 1, zv_spid_paved: 0, zv_spid_grove: 0, zv_spid_winding: 0 });
DEV_META.push({ k: 'autoVegChance', g: 'autozones', label: 'Heavy vegetation: chance a zone that may have it does (the spider zone: its vines look, 30%)', min: 0, max: 1, step: 0.05 });
DEV_GROUPS.push(['autozones', 'Auto: zone variants']);
// (Dev → Zones) each zone kind's own layout and looks (art/titlescene.js zk: DEV.zl_<zone>_<k>), shown in its card on that page
// (group zone_<zone>): what a zone rolls, scaled or moved; the variants' rows (veg*, spidOrb) under that variant's row. Defaults:
// the old numbers. (The kinds: art/titlescene.js TITLE_ZONES, which this layer can't import)
export const ZONE_KINDS = [['moss', 'Mossy caves'], ['webs', 'Webs'], ['timber', 'Mine works'], ['paved', 'Brick works'], ['grove', 'Grove'], ['winding', 'Winding caves'], ['spider', 'Spider zone']];
/** @type {[string, number, string, number, number, number][]} key, default, label, min, max, step */
export const ZONE_KNOBS = [
  ['len', 1, 'Length (× the length it rolls)', 0.3, 3, 0.05],
  ['roof', 0, 'Roof: lower (+) / higher (−) (world units)', -80, 80, 1],
  ['floor', 0, 'Floor: lower (+) / higher (−) (world units)', -80, 80, 1],
  ['hillsC', 1, 'Roof: how hilly (×)', 0, 4, 0.05],
  ['hillsF', 1, 'Floor: how hilly (×)', 0, 4, 0.05],
  ['close', 1, 'Hills: how close together (×; more: bumpier)', 0.2, 4, 0.05],
  ['dens', 1, 'Plants and webs: density (×)', 0, 3, 0.05],
  ['plants', 1, 'Hanging vines, roots, mycelium: how many (×)', 0, 6, 0.1],
  ['plantLen', 1, 'Hanging vines, roots, mycelium: length (×)', 0.2, 4, 0.05],
  ['vegPatch', 0.5, 'Heavy vegetation: share of the zone in patches', 0, 1, 0.05],
  ['vegThick', 1, 'Heavy vegetation: how thick (×)', 0, 3, 0.05],
  ['vegLen', 1, 'Heavy vegetation: vine length (×)', 0.2, 1.9, 0.05],
  ['spidOrb', 3, 'Spider web filled: orb webs (× the Webs zone chance)', 0, 12, 0.25],
];
for (const [z, name] of ZONE_KINDS) {
  for (const [k, d, label, min, max, step] of ZONE_KNOBS) { DEV_DEFAULTS['zl_' + z + '_' + k] = d; DEV_META.push({ k: 'zl_' + z + '_' + k, g: 'zone_' + z, label, min, max, step, type: 'slider' }); }
  DEV_GROUPS.push(['zone_' + z, 'Zone: ' + name]);
}
// (owner's Copy Dev settings, v1.0.95) one zone's own numbers, over the shared defaults above
Object.assign(DEV_DEFAULTS, { zl_moss_vegPatch: 0.8, zl_moss_vegThick: 0.55, zl_moss_vegLen: 0.95, zl_moss_spidOrb: 10, zl_webs_dens: 0 });
// CaveRunner Auto's starter gun (auto/run.js starterKit, stage 5a): its numbers, for each new player
Object.assign(DEV_DEFAULTS, { autoGunDelay: 0.25, autoGunRech: 0.8, autoGunMana: 120, autoGunRegen: 40, autoGunSpread: 4 });
DEV_META.push(
  { k: 'autoGunDelay',  g: 'autoguns', label: 'Starter gun: cast delay (s)', min: 0.02, max: 2, step: 0.01 },
  { k: 'autoGunRech',   g: 'autoguns', label: 'Starter gun: recharge (s)', min: 0.05, max: 3, step: 0.05 },
  { k: 'autoGunMana',   g: 'autoguns', label: 'Starter gun: mana', min: 20, max: 1000, step: 10 },
  { k: 'autoGunRegen',  g: 'autoguns', label: 'Starter gun: mana back a second', min: 5, max: 500, step: 5 },
  { k: 'autoGunSpread', g: 'autoguns', label: 'Starter gun: spread (degrees)', min: 0, max: 30, step: 1 });
// the clearing rule (auto/clear.js, stage 5b): what counts as a gun that clears the way
Object.assign(DEV_DEFAULTS, { autoClearMin: 1, autoClearFire: 20, autoClearGap: 0.4 });
DEV_META.push(
  { k: 'autoClearMin',  g: 'autoguns', label: 'A gun clears the way from this score (bore × 3 + eat + blast ÷ 2)', min: 0.1, max: 50, step: 0.1 },
  { k: 'autoClearFire', g: 'autoguns', label: 'Fire counts this much against webs and timber (score)', min: 0, max: 100, step: 1 },
  { k: 'autoClearGap',  g: 'autoguns', label: 'Digging: the tunnel is cut while the clearing gun fired within (s)', min: 0.05, max: 3, step: 0.05 });
DEV_GROUPS.push(['autoguns', 'Auto: guns']);
// the perks that act in a level (auto/perks.js): Permanent Shield's recharge, the Angry Ghost (weaker than the old game's 2 every 0.7 s)
Object.assign(DEV_DEFAULTS, { autoShieldT: 2.5, autoGhostDmg: 1, autoGhostCd: 1.4, autoGhostRange: 150 });
DEV_META.push(
  { k: 'autoShieldT',    g: 'autoperks', label: 'Permanent Shield: back after a hit (s)', min: 0.2, max: 20, step: 0.1 },
  { k: 'autoGhostDmg',   g: 'autoperks', label: 'Angry Ghost: damage a shot', min: 0, max: 20, step: 0.1 },
  { k: 'autoGhostCd',    g: 'autoperks', label: 'Angry Ghost: a shot every (s)', min: 0.1, max: 5, step: 0.05 },
  { k: 'autoGhostRange', g: 'autoperks', label: 'Angry Ghost: range (units)', min: 20, max: 400, step: 5 });
DEV_GROUPS.push(['autoperks', 'Auto: perks']);
// the level's enemies (auto/enemies.js, stage 6): how hard they hit, the elites, the boss
Object.assign(DEV_DEFAULTS, { autoFoeGap0: 4, autoFoeGap1: 1.5, autoFoeCap0: 3, autoFoeCap1: 10, autoFoeDmg: 0.5, autoFoeElites: 2, autoBossSize: 4, autoBossHp: 12, autoBossDmg: 3, autoTierHp: 1.45, autoTierDmg: 1.15, autoOldDmg: 0.4, autoOldCd: 1.5 });
DEV_META.push(
  { k: 'autoRoamT',   g: 'autofoes', label: 'Tall levels: the team picks a new height to roam at every … s', min: 1, max: 30, step: 0.5 },
  { k: 'autoRoamHi',  g: 'autofoes', label: '… the top third, at this chance', min: 0, max: 1, step: 0.05 },
  { k: 'autoRoamMid', g: 'autofoes', label: '… the middle third, at this chance (the rest: the bottom)', min: 0, max: 1, step: 0.05 },
  { k: 'autoRoamFly', g: 'autofoes', label: '… and flights last this × longer', min: 0.5, max: 4, step: 0.1 },
  { k: 'autoRoamRun', g: 'autofoes', label: '… and walks between them last this × as long', min: 0.1, max: 2, step: 0.05 },
  { k: 'autoSpStride', g: 'autofoes', label: 'Spiders: a leg cycle every this × their size walked (smaller: faster legs)', min: 0.01, max: 0.5, step: 0.01 },
  { k: 'autoJeTurnTier', g: 'autofoes', label: 'Jellyfish turn this much faster each level past the first (× their turn rate)', min: 0, max: 1, step: 0.05 },
  { k: 'autoJeTurnMax',  g: 'autofoes', label: '… at most this × (so they never snap round)', min: 1, max: 6, step: 0.1 },
  { k: 'autoFoeGap0',   g: 'autofoes', label: 'A new creature every … s, at the level’s start (a trickle)', min: 0.2, max: 20, step: 0.1 },
  { k: 'autoFoeGap1',   g: 'autofoes', label: '… easing to every … s by the boss', min: 0.2, max: 20, step: 0.1 },
  { k: 'autoFoeCap0',   g: 'autofoes', label: 'At most … alive at the start', min: 0, max: 24, step: 1 },
  { k: 'autoFoeCap1',   g: 'autofoes', label: '… easing to at most … by the boss', min: 0, max: 24, step: 1 },
  { k: 'autoFoeDmg',    g: 'autofoes', label: 'Creatures hurt the players (× their damage)', min: 0, max: 5, step: 0.05 },
  { k: 'autoFoeElites', g: 'autofoes', label: 'Elites a level', min: 0, max: 12, step: 1 },
  { k: 'autoTierHp',    g: 'autofoes', label: 'Creatures’ health × this for each level past 1 (compounding; level 10 ≈ 28× at 1.45)', min: 1, max: 3, step: 0.05 },
  { k: 'autoTierDmg',   g: 'autofoes', label: 'Creatures’ bite × this for each level past 1 (compounding)', min: 1, max: 2, step: 0.01 },
  { k: 'autoBossSize',  g: 'autofoes', label: 'Boss size (× a normal one)', min: 1, max: 8, step: 0.25 },
  { k: 'autoBossHp',    g: 'autofoes', label: 'Boss health (× a normal one)', min: 1, max: 200, step: 1 },
  { k: 'autoBossDmg',   g: 'autofoes', label: 'Boss damage (× a normal one)', min: 0.5, max: 10, step: 0.25 },
  // (v1.0.97) levels 2+ play as the old game's floors (auto/maps.js levelLook): their shooters, turrets, chasers and bombers
  { k: 'autoOldDmg',    g: 'autofoes', label: 'Old floors: shooters, chasers and bombers hurt × this (on top of the line above)', min: 0, max: 3, step: 0.05 },
  { k: 'autoOldCd',     g: 'autofoes', label: 'Old floors: time between a shooter’s shots × this', min: 0.25, max: 5, step: 0.05 });
DEV_GROUPS.push(['autofoes', 'Auto: enemies']);
// the jetpack (art/titlescene.js jetStep, feedback round 2: the old game's flame and smoke) and a death (auto/death.js: the ragdoll,
// the slow stop, Tap A, the helmet light, the blast, home)
Object.assign(DEV_DEFAULTS, { autoMoveK: 0.75, autoJetTilt: 1, autoJetSmoke: 1, autoDeathStop: 1.5, autoTpBlink: 1, autoTpBoomWait: 0.6, autoTpBoomR: 60, autoSpStride: 0.14, autoRoamT: 8, autoRoamHi: 0.45, autoRoamMid: 0.4, autoRoamFly: 2.5, autoRoamRun: 0.4, autoJeTurnTier: 0.2, autoJeTurnMax: 2.5, autoExitNukeR: 90, autoExitNukeF: 1600, autoExitNukeWait: 3.5, autoMushT: 3.2, autoMushK: 1, autoFuelDrain: 1, autoFuelRegen: 1, autoCtlWait: 3, autoVineFire: 1, autoVineSpread: 4, autoVineJitter: 0.8, autoVineAsh: 8, autoFireJump: 2, autoFireJumpP: 0.5, autoNavCut: 0.8, autoNavGive: 1.2 });
DEV_META.push(
  { k: 'autoVineFire',   g: 'autofire', label: 'Vines burn up at this × the old game speed (the title menu: 0.1)', min: 0.1, max: 5, step: 0.1 },
  { k: 'autoVineSpread', g: 'autofire', label: 'Auto levels: the flames climb a vine this × faster than it burns away (1: only the tip burns)', min: 1, max: 40, step: 0.5 },
  { k: 'autoNavCut',     g: 'autodeath', label: 'Auto levels: rock facing back at a player more than this (its normal · the way on) he saws; less, he goes over or under', min: 0, max: 1, step: 0.05 },
  { k: 'autoNavGive',    g: 'autodeath', label: '… and saws anyway once he has tried going round it this long (s)', min: 0.2, max: 5, step: 0.1 },
  { k: 'autoVineJitter', g: 'autofire', label: 'Auto levels: the flames climbing a vine spurt and stall by this much either way (0: even)', min: 0, max: 1, step: 0.05 },
  { k: 'autoVineAsh',    g: 'autofire', label: 'Vines: the charred, crumbling end is this long (units)', min: 0, max: 20, step: 1 },
  { k: 'autoFireJump',   g: 'autofire', label: 'Vines: fire jumps sideways from a burning vine to vines and webs this near (units)', min: 2, max: 40, step: 1 },
  { k: 'autoFireJumpP',  g: 'autofire', label: '… at this chance a fire tick, from each burning stretch', min: 0, max: 1, step: 0.05 },
  { k: 'autoCtlWait',    g: 'autodeath', label: 'Manual mode: seconds of the stick at rest before the autopilot takes him back', min: 0, max: 10, step: 0.25 },
  { k: 'autoMoveK',      g: 'autodeath', label: 'Hand-steered speed (× the old game’s walk, jet, their pushes; hub and steering a player; the hub’s followers too)', min: 0.2, max: 1.5, step: 0.05 },
  { k: 'autoJetTilt',    g: 'autodeath', label: 'Jet flame: the autopilot’s tilt with its speed across (at most)', min: 0, max: 1.5, step: 0.05 },
  { k: 'autoJetSmoke',   g: 'autodeath', label: 'Jet smoke (× the old game’s rate)', min: 0, max: 3, step: 0.05 },
  { k: 'autoDeathStop',  g: 'autodeath', label: 'All fallen: the scroll eases to a stop over (s)', min: 0.1, max: 6, step: 0.1 },
  { k: 'autoTpBlink',    g: 'autodeath', label: 'Tap A: the helmet light blinks for (s)', min: 0.1, max: 4, step: 0.05 },
  { k: 'autoTpBoomWait', g: 'autodeath', label: '… then the blast, home after (s)', min: 0.1, max: 4, step: 0.05 },
  { k: 'autoTpBoomR',    g: 'autodeath', label: 'The blast’s size', min: 10, max: 200, step: 1 },
  { k: 'autoExitNukeR',  g: 'autodeath', label: 'Level exit: the nuke’s size (its blast and mushroom cloud, world units)', min: 20, max: 300, step: 5 },
  { k: 'autoExitNukeF',  g: 'autodeath', label: '… how hard it throws the players (ragdoll push)', min: 100, max: 5000, step: 50 },
  { k: 'autoExitNukeWait', g: 'autodeath', label: '… the hub this long after it (s)', min: 0.5, max: 10, step: 0.1 },
  { k: 'autoMushT',      g: 'autodeath', label: 'Nuke (the shot and the exit’s): its mushroom cloud lasts (s)', min: 0.5, max: 10, step: 0.1 },
  { k: 'autoMushK',      g: 'autodeath', label: 'Nuke shot: its mushroom cloud’s size (× its blast)', min: 0.2, max: 5, step: 0.05 },
  { k: 'autoFuelDrain',  g: 'autodeath', label: 'Jet fuel: drain (× the old game’s; a level only, auto/fuel.js)', min: 0, max: 3, step: 0.05 },
  { k: 'autoFuelRegen',  g: 'autodeath', label: 'Jet fuel: refill on the ground (× the old game’s)', min: 0.1, max: 3, step: 0.05 });
DEV_GROUPS.push(['autodeath', 'Auto: jetpack and death']);
// (owner v1.0.59) what the players shoot at in a level (art/titlescene.js stepRunnerGun): far enough to reach the roof, but nothing
// in the screen's side strips or past them
Object.assign(DEV_DEFAULTS, { autoAimR: 400, autoAimEdge: 24, autoAimLeft: 20 });
DEV_META.push(
  { k: 'autoAimR',    g: 'autoguns', label: 'Players shoot creatures this near, any way (units; a level is about 400 tall)', min: 20, max: 1000, step: 5 },
  { k: 'autoAimEdge', g: 'autoguns', label: '… but none in a strip this wide down the right side of the screen, or past it (units; the screen is 220 across)', min: 0, max: 100, step: 1 },
  { k: 'autoAimLeft', g: 'autoguns', label: '… and on the left, a hail mary at ones up to this far past the edge (units)', min: 0, max: 100, step: 1 });
// (owner v1.0.56: full controls for fire in Auto) the level's own fire knobs; the old game's (burn times, creatures) show here too
Object.assign(DEV_DEFAULTS, { autoFireSpread: 0.2, autoWebFire: 4, autoVineCatch: 0.25, autoLeafReach: 5, autoLeafLight: 0.15, autoBurnCut: 0.015, autoBurnSpin: 2.5, fireTwinkle: 1, fireFlare: 0.5 });
DEV_META.push(
  { k: 'autoFireSpread', g: 'autofire', label: 'Auto levels: fire spreads cell to cell, and onto vines and webs from burning ground, at this × the old game', min: 0, max: 3, step: 0.05 },
  { k: 'autoWebFire',    g: 'firesilk', label: 'Auto levels: silk burns up this × faster than vines', min: 0.1, max: 10, step: 0.1 },
  { k: 'autoVineCatch',  g: 'autofire', label: 'Auto levels: a vine beside a burning one catches at this chance a fire tick', min: 0, max: 1, step: 0.05 },
  { k: 'fireTwinkle',    g: 'autofire', label: 'Burning pixels twinkle at this × their own pace (0: still)', min: 0, max: 4, step: 0.05 },
  { k: 'fireFlare',      g: 'autofire', label: '… and flare bright at this chance a fire tick', min: 0, max: 0.5, step: 0.01 },
  { k: 'autoBurnCut',    g: 'autofire', label: 'Vines on fire burn right through at this chance a fire tick: the rest falls away', min: 0, max: 0.3, step: 0.005 },
  { k: 'autoBurnSpin',   g: 'autofire', label: '… a falling piece turns at up to this either way (rad/s)', min: 0, max: 10, step: 0.1 },
  { k: 'autoLeafReach',  g: 'autofire', label: 'Auto levels: a burning stem or leaf lights moss, grass and timber this near (units)', min: 0, max: 20, step: 0.5 },
  { k: 'autoLeafLight',  g: 'autofire', label: '… each of those cells at this chance a fire tick', min: 0, max: 1, step: 0.01 });
// (owner v1.0.67) burning vines and webs lost in the dark: drawn again over it, and their own light
Object.assign(DEV_DEFAULTS, { autoBurnBright: 1, autoBurnLight: 0.9, autoBurnLightR: 34, autoBurnLightGap: 14, autoBurnGlow: 0.16 });
DEV_META.push(
  { k: 'autoBurnBright',   g: 'autofire', label: 'Burning vines and webs drawn at full brightness over the dark (1 on, 0 off)', min: 0, max: 1, step: 1 },
  { k: 'autoBurnLight',    g: 'autofire', label: '… and light the cave round them this bright (0–1)', min: 0, max: 1, step: 0.05 },
  { k: 'autoBurnLightR',   g: 'autofire', label: '… this far (units), shadowed by the rock', min: 4, max: 100, step: 1 },
  { k: 'autoBurnLightGap', g: 'autofire', label: '… a light every this many units along the burning stretch (at most 6 a vine)', min: 4, max: 60, step: 1 },
  { k: 'autoBurnGlow',     g: 'autofire', label: '… and a warm orange glow round them this strong (0: none)', min: 0, max: 0.6, step: 0.01 });
DEV_GROUPS.push(['autofire', 'Auto: fire']);
// Dev → Fire sim's flame jets (art/firelab.js labStep, owner v1.0.58): Fire held, jets out of the floor
Object.assign(DEV_DEFAULTS, { labJetGap: 0.35, labJetH: 120, labJetT: 0.7 });
DEV_META.push(
  { k: 'labJetGap', g: 'firelab', label: 'Fire held: a new jet about every (s, at random)', min: 0.02, max: 3, step: 0.01 },
  { k: 'labJetH',   g: 'firelab', label: '… up to this high (units, each its own strength)', min: 5, max: 120, step: 1 },
  { k: 'labJetT',   g: 'firelab', label: '… lasting about (s)', min: 0.1, max: 4, step: 0.05 });
DEV_GROUPS.push(['firelab', 'Fire sim: flame jets']);
// (owner v1.0.60) the fire's flame specks and smoke in Auto's levels and the fire sim (art/titlescene.js flameAt, fireSmoke,
// titleJet; drawn by game/render/titledraw.js): every number a range rolled per particle, colour and opacity over life as
// gradients (shaped on the panel's editors), each particle shifted along the colour by up to ± …ColJit and its opacity
// × (1 - up to …AlphaJit); …Rate × how many
rangeKnobs('firefx', [
  ['fxFlLife', 'Flame specks: life (s)',                      0.05, 3, 0.05, 0.25, 0.55],
  ['fxFlSize', 'Flame specks: size',                          0.3, 8, 0.1,   1, 2.2],
  ['fxFlRise', 'Flame specks: rise speed',                    0, 200, 1,     30, 70],
  ['fxFlSide', 'Flame specks: sideways speed (either way)',   0, 60, 1,      0, 8],
  ['fxSmLife', 'Smoke: life (s)',                             0.1, 8, 0.05,  1.2, 1.6],
  ['fxSmSize', 'Smoke: size at the start',                    0.3, 12, 0.1,  2, 4.5],
  ['fxSmGrow', 'Smoke: grows (units a second)',               0, 30, 0.1,    4, 6],
  ['fxSmRise', 'Smoke: rise speed',                           0, 120, 1,     25, 45],
  ['fxSmSide', 'Smoke: sideways speed (either way)',          0, 40, 1,      0, 6],
]);
Object.assign(DEV_DEFAULTS, { fxFlRate: 1, fxFlColJit: 0.25, fxFlAlphaJit: 0.2, fxSmRate: 3, fxSmColJit: 0.2, fxSmAlphaJit: 0.3,
  fxFlGrad: '0:#fff0a0 0.3:#ffd35a 0.6:#ff8a2a 1:#e8461c', fxFlAlpha: '0:1 0.7:1 1:0',
  fxSmGrad: '0:#3a3430 1:#1e1c1c', fxSmAlpha: '0:0 0.159:0.285 0.547:0.342 1:0' });
DEV_META.push(
  { k: 'fxFlRate',     g: 'firefx', label: 'Flame specks: how many (× the usual)', min: 0, max: 5, step: 0.05 },
  { k: 'fxFlColJit',   g: 'firefx', label: 'Flame specks: colour randomness (each shifted along the gradient, ±)', min: 0, max: 1, step: 0.01 },
  { k: 'fxFlAlphaJit', g: 'firefx', label: 'Flame specks: opacity randomness (each up to this much fainter)', min: 0, max: 1, step: 0.01 },
  { k: 'fxSmRate',     g: 'firefx', label: 'Smoke: how much (× the usual)', min: 0, max: 5, step: 0.05 },
  { k: 'fxSmColJit',   g: 'firefx', label: 'Smoke: colour randomness (±)', min: 0, max: 1, step: 0.01 },
  { k: 'fxSmAlphaJit', g: 'firefx', label: 'Smoke: opacity randomness (each up to this much fainter)', min: 0, max: 1, step: 0.01 },
  { k: 'fxFlGrad',  g: 'firefx', label: 'Flame specks: colour over life (gradient)', type: 'grad' },
  { k: 'fxFlAlpha', g: 'firefx', label: 'Flame specks: opacity over life (ramp)', type: 'ramp' },
  { k: 'fxSmGrad',  g: 'firefx', label: 'Smoke: colour over life (gradient)', type: 'grad' },
  { k: 'fxSmAlpha', g: 'firefx', label: 'Smoke: opacity over life (ramp)', type: 'ramp' });
DEV_GROUPS.push(['firefx', 'Fire: flames and smoke']);
// (owner v1.0.61) silk's own (art/titlescene.js stepFire's burning strands; webs are cut into hanging strands when they catch): the
// same as the vines' (their defaults), plus how much it smokes and flames
Object.assign(DEV_DEFAULTS, { autoSilkSpread: 3, autoSilkJitter: 0.8, autoSilkAsh: 6, autoSilkCut: 0.1, autoSilkSpin: 2.5, autoSilkJump: 14, autoSilkJumpP: 0.5, autoSilkSmoke: 10, autoSilkFlames: 1 });
DEV_META.push(
  { k: 'autoSilkSpread', g: 'firesilk', label: 'Silk: the flames climb a strand this × faster than it burns away', min: 1, max: 40, step: 0.5 },
  { k: 'autoSilkJitter', g: 'firesilk', label: 'Silk: the climb spurts and stalls by this much either way (0: even)', min: 0, max: 1, step: 0.05 },
  { k: 'autoSilkAsh',    g: 'firesilk', label: 'Silk: the charred, crumbling end is this long (units)', min: 0, max: 20, step: 1 },
  { k: 'autoSilkCut',    g: 'firesilk', label: 'Silk: burns right through at this chance a fire tick, the rest falling away', min: 0, max: 0.3, step: 0.005 },
  { k: 'autoSilkSpin',   g: 'firesilk', label: '… a falling piece turns at up to this either way (rad/s)', min: 0, max: 10, step: 0.1 },
  { k: 'autoSilkJump',   g: 'firesilk', label: 'Silk: fire jumps sideways to vines and webs this near (units)', min: 2, max: 40, step: 1 },
  { k: 'autoSilkJumpP',  g: 'firesilk', label: '… at this chance a fire tick, from each burning stretch', min: 0, max: 1, step: 0.05 },
  { k: 'autoSilkSmoke',  g: 'firesilk', label: 'Silk: puffs of smoke a second off each burning strand', min: 0, max: 60, step: 0.5 },
  { k: 'autoSilkFlames', g: 'firesilk', label: 'Silk: flame specks (× the vines\' amount)', min: 0, max: 5, step: 0.05 });
DEV_GROUPS.push(['firesilk', 'Fire: webs (silk)']);
// the level's drops (auto/loot.js, stage 6 part 2): gun mods, gems and exo mods from kills
Object.assign(DEV_DEFAULTS, { autoLootMod: 6, autoLootRed: 2, autoLootExo: 7, autoLootEliteGold: 3, autoLootBossGold: 10 });
DEV_META.push(
  { k: 'autoLootMod',       g: 'autoloot', label: 'A kill drops a gun mod (% chance)', min: 0, max: 100, step: 0.5 },
  { k: 'autoLootRed',       g: 'autoloot', label: 'An elite drops red gems (count)', min: 0, max: 10, step: 1 },
  { k: 'autoLootExo',       g: 'autoloot', label: 'An elite drops an exo mod (% chance)', min: 0, max: 100, step: 1 },
  { k: 'autoLootEliteGold', g: 'autoloot', label: 'An elite’s gold (× a normal kill’s)', min: 1, max: 20, step: 0.5 },
  { k: 'autoLootBossGold',  g: 'autoloot', label: 'The boss’s gold (× a normal kill’s)', min: 1, max: 100, step: 1 });
DEV_GROUPS.push(['autoloot', 'Auto: loot']);
// the level's chests (auto/chests.js, stage 11): how many, what's in them (weights), how near A opens one
Object.assign(DEV_DEFAULTS, { autoChestN: 3, autoChestR: 40, autoChestGoldN: 25, autoChestGold: 45, autoChestMod: 25, autoChestExo: 15, autoChestRed: 10, autoChestPerk: 3, autoChestGreen: 2 });
DEV_META.push(
  { k: 'autoChestN',     g: 'autochests', label: 'Chests a level', min: 0, max: 12, step: 1 },
  { k: 'autoChestR',     g: 'autochests', label: 'Tap A opens a chest within (world units of a player)', min: 5, max: 150, step: 1 },
  { k: 'autoChestGoldN', g: 'autochests', label: 'A chest’s gold (about; × the tier’s gold scale)', min: 1, max: 200, step: 1 },
  { k: 'autoChestGold',  g: 'autochests', label: 'Holds gold (weight)', min: 0, max: 100, step: 1 },
  { k: 'autoChestMod',   g: 'autochests', label: 'Holds a gun mod (weight)', min: 0, max: 100, step: 1 },
  { k: 'autoChestExo',   g: 'autochests', label: 'Holds an exo mod (weight)', min: 0, max: 100, step: 1 },
  { k: 'autoChestRed',   g: 'autochests', label: 'Holds a red gem (weight)', min: 0, max: 100, step: 1 },
  { k: 'autoChestPerk',  g: 'autochests', label: 'Holds a perk (weight)', min: 0, max: 100, step: 1 },
  { k: 'autoChestGreen', g: 'autochests', label: 'Holds a green gem (weight)', min: 0, max: 100, step: 1 });
DEV_GROUPS.push(['autochests', 'Auto: chests']);
// CaveRunner Auto's bag (ui/auto/AutoScreen.js, stage 8b): a touch grabs an item only this near its icon's centre
Object.assign(DEV_DEFAULTS, { autoGrab: 0.45 });   // (owner, feedback round 2: was 0.35, too hard to pick up)
DEV_META.push(
  { k: 'autoGrab', g: 'autobag', label: 'Grab radius: a touch picks up an item this near its centre (× the tile width); elsewhere it scrolls', min: 0.1, max: 0.5, step: 0.01 });
// the gun panel's firing window (auto/preview.js, owner round 2): the floor and walls a blast ate grow back this many cells a second
Object.assign(DEV_DEFAULTS, { autoPvRegrow: 40 });
DEV_META.push(
  { k: 'autoPvRegrow', g: 'autobag', label: 'Gun preview: blasted floor and walls grow back this many cells (pixels) a second', min: 0, max: 400, step: 5 });
// stage 9: hold a helmet this long for its gun arc; the arc's radius (px)
Object.assign(DEV_DEFAULTS, { autoHoldMs: 350, autoArcR: 110 });
DEV_META.push(
  { k: 'autoHoldMs', g: 'autobag', label: 'Gun arc: hold a player’s helmet this long (ms) to fan out his 4 guns', min: 150, max: 1000, step: 10 },
  { k: 'autoArcR', g: 'autobag', label: 'Gun arc: its radius (px) above the helmet', min: 70, max: 160, step: 2 });
// (owner, v1.0.71) a White Hole with Discriminate:Pn pulls that player this many units a second (auto/shotfx.js vacPull)
Object.assign(DEV_DEFAULTS, { autoDiscPull: 70 });
DEV_META.push({ k: 'autoDiscPull', g: 'autobag', label: 'Discriminate: a White Hole set on a player pulls him this fast (units/s)', min: 0, max: 400, step: 5 });
DEV_GROUPS.push(['autobag', 'Auto: bag']);
// stage 10a: throwing gold and gems into the hub's machines (auto/throw.js, ui/auto/AutoScreen.js)
Object.assign(DEV_DEFAULTS, { autoThrowPull: 45, autoThrowSuck: 500, autoThrowBack: 3, autoPayReach: 30, autoPickReach: 22, autoPickMin: 1, autoPayHold: 300, autoPayK: 2,
  autoStreamRate0: 2, autoStreamRate1: 14, autoStreamRamp: 1.5,
  autoStreamMedT: 1, autoStreamMedN: 25, autoStreamBigT: 1, autoStreamBigN: 250, autoStreamGrow: 1 });
DEV_META.push(
  { k: 'autoThrowPull',   g: 'autothrow', label: 'A machine pulls in what it takes within (world units of its coin slot)', min: 5, max: 200, step: 1 },
  { k: 'autoThrowSuck',   g: 'autothrow', label: 'Its pull’s strength', min: 50, max: 3000, step: 10 },
  { k: 'autoPickReach',   g: 'autothrow', label: 'A machine’s item: picked up when a player walks within (world units)', min: 4, max: 80, step: 1 },
  { k: 'autoPickMin',     g: 'autothrow', label: 'A machine’s item: not picked up before it’s this old (s)', min: 0, max: 5, step: 0.1 },
  { k: 'autoThrowBack',   g: 'autothrow', label: 'Anything not taken flies back to the bag after (s)', min: 0.5, max: 20, step: 0.1 },
  { k: 'autoPayReach',    g: 'autothrow', label: 'Pay with A: player 1 within this of a machine (world units)', min: 5, max: 80, step: 1 },
  { k: 'autoPayHold',     g: 'autothrow', label: 'Pay with A: held this long (ms) starts the stream', min: 50, max: 1500, step: 10 },
  { k: 'autoPayK',        g: 'autothrow', label: 'Pay with A: throw speed (world units / s) per px dragged from the press', min: 0.5, max: 12, step: 0.1 },
  { k: 'autoStreamRate0', g: 'autothrow', label: 'Stream: nuggets a second at first', min: 0.5, max: 20, step: 0.5 },
  { k: 'autoStreamRate1', g: 'autothrow', label: 'Stream: nuggets a second, ramped up', min: 1, max: 60, step: 1 },
  { k: 'autoStreamRamp',  g: 'autothrow', label: 'Stream: ramps up over (s)', min: 0.1, max: 6, step: 0.1 },
  { k: 'autoStreamMedT',  g: 'autothrow', label: 'Gold stream: at full speed this long, then medium nuggets (s)', min: 0, max: 6, step: 0.1 },
  { k: 'autoStreamMedN',  g: 'autothrow', label: 'Gold stream: a medium nugget is worth', min: 2, max: 500, step: 1 },
  { k: 'autoStreamBigT',  g: 'autothrow', label: 'Gold stream: medium this long, then big nuggets (s)', min: 0, max: 6, step: 0.1 },
  { k: 'autoStreamBigN',  g: 'autothrow', label: 'Gold stream: a big nugget is worth at first', min: 10, max: 10000, step: 10 },
  { k: 'autoStreamGrow',  g: 'autothrow', label: 'Gold stream: big nuggets double in worth every (s)', min: 0.2, max: 10, step: 0.1 });
DEV_GROUPS.push(['autothrow', 'Auto: throw']);
// (Part A of the purple trajectory mods) CaveRunner Auto's own sizes for Orbiting Arc, Spiral Arc, Boomerang and Ping-Pong Path
// (auto/traj.js trajStep, flown by art/titlescene.js stepShots), each mod a group, and how its trail and glow look. The mod
// card's dev-only Edit button (ui/auto/TrajEdit.js) lists its group: TRAJ_GROUP. Sizes in the scene's units (the window is ~160 wide)
/** @type {Record<string, string>} a trajectory mod's id → its Dev group */
export const TRAJ_GROUP = { orbit: 'trajorbit', spiral: 'trajspiral', boomer: 'trajboomer', pong: 'trajpong' };
/** @param {string} g @param {string} kp @param {number} trail @param {number} glow */
const trajLook = (g, kp, trail, glow) => {
  Object.assign(DEV_DEFAULTS, { [kp + 'Trail']: trail, [kp + 'TrailA']: 0.55, [kp + 'TrailW']: 0.8, [kp + 'Glow']: glow, [kp + 'GlowA']: 0.18, [kp + 'Tint']: 0.5 });
  DEV_META.push(
    { k: kp + 'Trail',  g, label: 'Look: light trail behind it (points; 0: none)', min: 0, max: 60, step: 1, type: 'slider' },
    { k: kp + 'TrailA', g, label: 'Look: trail brightness at the shot (fades to 0 at its end)', min: 0, max: 1, step: 0.05, type: 'slider' },
    { k: kp + 'TrailW', g, label: 'Look: trail width (× the shot’s size)', min: 0.2, max: 3, step: 0.1, type: 'slider' },
    { k: kp + 'Glow',   g, label: 'Look: glow round the shot (radius; 0: none)', min: 0, max: 40, step: 1, type: 'slider' },
    { k: kp + 'GlowA',  g, label: 'Look: glow strength', min: 0, max: 0.6, step: 0.01, type: 'slider' },
    { k: kp + 'Tint',   g, label: 'Look: trail and glow colour (0: the shot’s, 1: the mod’s purple)', min: 0, max: 1, step: 0.05, type: 'slider' });
};
Object.assign(DEV_DEFAULTS, { trOrbR: 20, trOrbIn: 0.25, trOrbW: 7, trOrbLife: 1, trOrbRock: 1 });
DEV_META.push(
  { k: 'trOrbR',    g: 'trajorbit', label: 'Orbit distance (radius round the caster, units)', min: 4, max: 70, step: 1, type: 'slider' },
  { k: 'trOrbIn',   g: 'trajorbit', label: 'Swings out to it over (s)', min: 0, max: 2, step: 0.05, type: 'slider' },
  { k: 'trOrbW',    g: 'trajorbit', label: 'Orbit speed (rad/s, one Orbiting Arc; stacked copies go faster)', min: 0.5, max: 25, step: 0.5, type: 'slider' },
  { k: 'trOrbLife', g: 'trajorbit', label: 'Lifetime (× the shot’s)', min: 0.2, max: 4, step: 0.1, type: 'slider' },
  { k: 'trOrbRock', g: 'trajorbit', label: 'Passes through rock while orbiting (1 yes, 0 it dies on the wall)', min: 0, max: 1, step: 1, type: 'slider' });
trajLook('trajorbit', 'trOrb', 16, 10);
Object.assign(DEV_DEFAULTS, { trSpHz: 2.5, trSpGrow: 7, trSpMax: 16, trSpLife: 1 });
DEV_META.push(
  { k: 'trSpHz',   g: 'trajspiral', label: 'Swings side to side this often (a second)', min: 0.2, max: 10, step: 0.1, type: 'slider' },
  { k: 'trSpGrow', g: 'trajspiral', label: 'Each swing wider by (units a second, one Spiral Arc)', min: 0, max: 60, step: 0.5, type: 'slider' },
  { k: 'trSpMax',  g: 'trajspiral', label: 'Widest swing (units either side)', min: 1, max: 60, step: 1, type: 'slider' },
  { k: 'trSpLife', g: 'trajspiral', label: 'Lifetime (× the shot’s)', min: 0.2, max: 4, step: 0.1, type: 'slider' });
trajLook('trajspiral', 'trSp', 14, 0);
Object.assign(DEV_DEFAULTS, { trBoDist: 55, trBoRock: 1, trBoOut: 0.35, trBoTurn: 10, trBoCatch: 8, trBoMax: 3, trBoLife: 1 });
DEV_META.push(
  { k: 'trBoDist',  g: 'trajboomer', label: 'Turns for home this far from its caster (units) …', min: 10, max: 150, step: 1, type: 'slider' },
  { k: 'trBoOut',   g: 'trajboomer', label: '… or after this × its lifetime, whichever is first', min: 0.05, max: 1, step: 0.05, type: 'slider' },
  { k: 'trBoTurn',  g: 'trajboomer', label: 'Turn rate on the way back (rad/s)', min: 0.5, max: 30, step: 0.5, type: 'slider' },
  { k: 'trBoCatch', g: 'trajboomer', label: 'Caught (gone) this near its caster (units)', min: 2, max: 40, step: 1, type: 'slider' },
  { k: 'trBoMax',   g: 'trajboomer', label: 'Gives up after (× its lifetime) if not back', min: 1, max: 6, step: 0.5, type: 'slider' },
  { k: 'trBoRock',  g: 'trajboomer', label: 'Passes through rock on its way back (1 yes, 0 it dies on the wall)', min: 0, max: 1, step: 1, type: 'slider' },
  { k: 'trBoLife',  g: 'trajboomer', label: 'Lifetime (× the shot’s)', min: 0.2, max: 4, step: 0.1, type: 'slider' });
trajLook('trajboomer', 'trBo', 12, 0);
Object.assign(DEV_DEFAULTS, { trPoOut: 0.3, trPoBack: 0.5, trPoLife: 1 });
DEV_META.push(
  { k: 'trPoOut',  g: 'trajpong', label: 'Flies out for (s)', min: 0.05, max: 2, step: 0.01, type: 'slider' },
  { k: 'trPoBack', g: 'trajpong', label: '… then back for (× the out time)', min: 0, max: 1.5, step: 0.05, type: 'slider' },
  { k: 'trPoLife', g: 'trajpong', label: 'Lifetime (× the shot’s)', min: 0.2, max: 4, step: 0.1, type: 'slider' });
trajLook('trajpong', 'trPo', 10, 0);
// Part B: Homing, Seeker, Short-range Homing, Auto-Aim, Gravity, Anti-Gravity, Horizontal Path (auto/traj.js)
Object.assign(DEV_DEFAULTS, { trHoTurn: 3, trHoReach: 90, trHoWait: 0.1 });
DEV_META.push(
  { k: 'trHoTurn',  g: 'trajhoming', label: 'Turns onto a creature at (rad/s, one Homing)', min: 0.2, max: 30, step: 0.2, type: 'slider' },
  { k: 'trHoReach', g: 'trajhoming', label: 'Sees creatures this near (units)', min: 10, max: 300, step: 5, type: 'slider' },
  { k: 'trHoWait',  g: 'trajhoming', label: 'Starts turning after (s)', min: 0, max: 1, step: 0.02, type: 'slider' });
trajLook('trajhoming', 'trHo', 8, 0);
Object.assign(DEV_DEFAULTS, { trSeTurn: 10, trSeReach: 220, trSeWait: 0.06, trSeSpeed: 1 });
DEV_META.push(
  { k: 'trSeTurn',  g: 'trajseeker', label: 'Turns onto its target at (rad/s, one Seeker)', min: 0.5, max: 40, step: 0.5, type: 'slider' },
  { k: 'trSeReach', g: 'trajseeker', label: 'Locks onto a creature this near (units), and keeps it till it dies', min: 20, max: 400, step: 5, type: 'slider' },
  { k: 'trSeWait',  g: 'trajseeker', label: 'Starts seeking after (s)', min: 0, max: 1, step: 0.02, type: 'slider' },
  { k: 'trSeSpeed', g: 'trajseeker', label: 'Speed once locked on (× its own)', min: 0.3, max: 3, step: 0.05, type: 'slider' });
trajLook('trajseeker', 'trSe', 12, 8);
Object.assign(DEV_DEFAULTS, { trNeTurn: 16, trNeReach: 36 });
DEV_META.push(
  { k: 'trNeTurn',  g: 'trajnear', label: 'Snaps onto a creature at (rad/s, one Short-range Homing)', min: 1, max: 60, step: 1, type: 'slider' },
  { k: 'trNeReach', g: 'trajnear', label: '… only once it is this near (units)', min: 5, max: 150, step: 1, type: 'slider' });
trajLook('trajnear', 'trNe', 6, 0);
Object.assign(DEV_DEFAULTS, { trAimReach: 170, trAimMax: 180 });
DEV_META.push(
  { k: 'trAimReach', g: 'trajaim', label: 'Aims at the nearest creature this near as it leaves the barrel (units)', min: 10, max: 400, step: 5, type: 'slider' },
  { k: 'trAimMax',   g: 'trajaim', label: '… turning at most this far from the way it was fired (degrees)', min: 0, max: 180, step: 5, type: 'slider' });
trajLook('trajaim', 'trAim', 6, 0);
Object.assign(DEV_DEFAULTS, { trGravG: 260, trGravLob: 0 });
DEV_META.push(
  { k: 'trGravG',   g: 'trajgrav', label: 'Pull down (units/s², one Gravity)', min: 0, max: 1200, step: 10, type: 'slider' },
  { k: 'trGravLob', g: 'trajgrav', label: 'Lobbed up as it leaves (degrees, toward the roof)', min: 0, max: 60, step: 1, type: 'slider' });
trajLook('trajgrav', 'trGrav', 6, 0);
Object.assign(DEV_DEFAULTS, { trFloatG: 200, trFloatLob: 0 });
DEV_META.push(
  { k: 'trFloatG',   g: 'trajfloat', label: 'Lift (units/s², one Anti-Gravity)', min: 0, max: 1200, step: 10, type: 'slider' },
  { k: 'trFloatLob', g: 'trajfloat', label: 'Aimed down as it leaves (degrees, toward the floor)', min: 0, max: 60, step: 1, type: 'slider' });
trajLook('trajfloat', 'trFloat', 6, 0);
Object.assign(DEV_DEFAULTS, { trFlatSpeed: 1, trFlatDmg: 1 });
DEV_META.push(
  { k: 'trFlatSpeed', g: 'trajflat', label: 'Speed (× its own)', min: 0.3, max: 3, step: 0.05, type: 'slider' },
  { k: 'trFlatDmg',   g: 'trajflat', label: 'Damage (× on top of the mod’s 1.6)', min: 0.2, max: 4, step: 0.05, type: 'slider' });
trajLook('trajflat', 'trFlat', 8, 0);
Object.assign(TRAJ_GROUP, { homing: 'trajhoming', seeker: 'trajseeker', nearhome: 'trajnear', autoaim: 'trajaim', gravmod: 'trajgrav', float: 'trajfloat', flat: 'trajflat' });
DEV_GROUPS.push(['trajhoming', 'Trajectory: Homing'], ['trajseeker', 'Trajectory: Seeker'], ['trajnear', 'Trajectory: Short-range Homing'], ['trajaim', 'Trajectory: Auto-Aim'],
  ['trajgrav', 'Trajectory: Gravity'], ['trajfloat', 'Trajectory: Anti-Gravity'], ['trajflat', 'Trajectory: Horizontal Path']);
DEV_GROUPS.push(['trajorbit', 'Trajectory: Orbiting Arc'], ['trajspiral', 'Trajectory: Spiral Arc'], ['trajboomer', 'Trajectory: Boomerang'], ['trajpong', 'Trajectory: Ping-Pong Path']);
// one group's changed knobs, in Copy Dev settings' shape (the mod card's Edit → Copy)
/** @param {string} g @param {string} name */
export function devReportOf(g, name) {
  const rows = DEV_META.filter(m => m.g === g), changed = rows.filter(m => DEV[m.k] !== DEV_DEFAULTS[m.k]);
  const lines = ['CaveRunner ' + VERSION + ' dev settings (' + name + ') — please make these the new defaults:', ''];
  if (!changed.length) lines.push('(nothing changed — everything is at its default)');
  for (const m of changed)
    lines.push('- ' + m.label + ' (DEV.' + m.k + '): ' + DEV[m.k] + '   [default ' + DEV_DEFAULTS[m.k] + ']');
  return lines.join('\n');
}
// before the last tab: that one also takes any group in no tab
// (owner v1.0.56) every fire knob on its own page, under the fire sim's window (ui/firesim.js)
DEV_TABS.splice(DEV_TABS.length - 1, 0, ['firesim', 'Fire sim', ['firelab', 'firefx', 'autofire', 'firesilk', 'fire']]);
DEV_TABS.splice(DEV_TABS.length - 2, 0, ['traj', 'Trajectory', ['trajorbit', 'trajspiral', 'trajboomer', 'trajpong', 'trajhoming', 'trajseeker', 'trajnear', 'trajaim', 'trajgrav', 'trajfloat', 'trajflat']]);
// (Dev → Zones) the level zones' preview (ui/zonesim.js) over their knobs
DEV_TABS.splice(DEV_TABS.length - 2, 0, ['zones', 'Zones', ['autozones', 'autoorb', 'moss', 'webs', 'timber', 'paved', 'grove', 'winding', 'spider'].map(g => (g.startsWith('auto') ? g : 'zone_' + g))]);
// (Grem Mode) the gun presets library and Grem's own page (ui/auto/presetlib.js, gremkit.js; DevPanel's pages)
DEV_TABS.splice(DEV_TABS.length - 2, 0, ['presets', 'Presets', []], ['grem', 'Grem', ['grem']]);
DEV_TABS.splice(DEV_TABS.length - 2, 0, ['auto', 'Auto', ['auto', 'autohub', 'automaps', 'autolevel', 'autoblocks', 'autoguns', 'autoperks', 'autofoes', 'autodeath', 'autoloot', 'autochests', 'autobag', 'autothrow']]);
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
  // (v1.0.94) only the changed ones: a device follows every new default for the knobs it hasn't touched
  try { localStorage.setItem(DEV_KEY, JSON.stringify(devChanged())); } catch (_) {}
}
