// @ts-check
// What each floor looks and sounds like: its palette (THEMES), its five decorations (DECOR)
// and its ambience (AMBIENCE). All picked by the floor number, never the seed.

import { hexArr } from '../core/util.js';
import { DEV, L2_LOOK } from '../dev/knobs.js';

// ---- level themes ----
// One palette per floor, picked by the floor number rather than rolled with the seed.
// So floor 3 is the same frozen cave on every run and every restart, which is the
// whole point: you learn "3 is the ice one" the way you learn a map, and the colour
// tells you where you are before you have read the number. Wraps at the end rather
// than running out.
export const THEMES = [
  { name: 'Mossy caves',    bg: [16, 18, 24],  bg2: [34, 37, 46],
    rock: [[62, 56, 54], [96, 84, 74]],    moss: [[62, 104, 40], [108, 150, 64]],
    brick: [[112, 84, 62], [146, 110, 78]], mortar: [66, 50, 40], bed: [[28, 28, 34], [44, 44, 52]] },
  { name: 'Coal seams',     bg: [12, 13, 17],  bg2: [28, 30, 36],
    rock: [[44, 44, 50], [74, 74, 82]],    moss: [[46, 74, 52], [84, 116, 74]],
    brick: [[64, 62, 66], [96, 92, 98]],   mortar: [38, 36, 40], bed: [[24, 24, 28], [40, 40, 46]] },
  { name: 'Frozen deep',    bg: [14, 20, 30],  bg2: [32, 44, 60],
    rock: [[62, 72, 88], [104, 118, 138]], moss: [[120, 150, 170], [176, 204, 222]],
    brick: [[86, 100, 120], [126, 142, 164]], mortar: [52, 62, 78], bed: [[26, 32, 44], [44, 52, 66]] },
  { name: 'Ember halls',    bg: [22, 12, 12],  bg2: [48, 24, 22],
    rock: [[70, 48, 44], [110, 74, 62]],   moss: [[150, 72, 36], [204, 120, 52]],
    brick: [[100, 58, 44], [138, 84, 62]], mortar: [54, 32, 26], bed: [[34, 20, 20], [56, 34, 32]] },
  { name: 'Fungal grotto',  bg: [18, 14, 26],  bg2: [42, 34, 56],
    rock: [[66, 58, 80], [104, 92, 124]],  moss: [[88, 150, 120], [140, 200, 168]],
    brick: [[92, 72, 110], [130, 104, 150]], mortar: [50, 40, 62], bed: [[30, 26, 40], [50, 44, 64]] },
  { name: 'Salt flats',     bg: [24, 24, 22],  bg2: [50, 50, 46],
    rock: [[112, 108, 96], [160, 154, 138]], moss: [[170, 164, 132], [214, 208, 178]],
    brick: [[132, 124, 104], [172, 162, 138]], mortar: [76, 72, 62], bed: [[40, 40, 36], [62, 62, 56]] },
  { name: 'Amethyst vein',  bg: [20, 14, 28],  bg2: [46, 32, 62],
    rock: [[74, 54, 92], [114, 86, 140]],  moss: [[168, 96, 190], [214, 150, 232]],
    brick: [[94, 68, 116], [134, 100, 158]], mortar: [54, 38, 68], bed: [[32, 24, 44], [54, 40, 72]] },
  { name: 'Rustworks',      bg: [18, 18, 20],  bg2: [44, 38, 34],
    rock: [[84, 62, 48], [126, 94, 70]],   moss: [[96, 124, 110], [148, 180, 162]],
    brick: [[118, 80, 52], [158, 112, 76]], mortar: [62, 44, 30], bed: [[30, 28, 28], [50, 46, 44]] },
  { name: 'Bone garden',    bg: [20, 20, 18],  bg2: [46, 46, 42],
    rock: [[108, 104, 94], [152, 146, 132]], moss: [[110, 120, 72], [158, 170, 108]],
    brick: [[124, 116, 98], [164, 154, 132]], mortar: [70, 66, 56], bed: [[38, 38, 34], [60, 58, 52]] },
  { name: 'Drowned halls',  bg: [10, 18, 22],  bg2: [24, 42, 50],
    rock: [[48, 68, 72], [82, 108, 112]],  moss: [[56, 124, 124], [104, 176, 170]],
    brick: [[62, 84, 88], [98, 124, 128]], mortar: [36, 52, 56], bed: [[22, 32, 36], [40, 54, 58]] },
  { name: 'Ash wastes',     bg: [18, 17, 17],  bg2: [42, 40, 40],
    rock: [[72, 68, 66], [110, 104, 100]], moss: [[120, 96, 80], [168, 140, 116]],
    brick: [[92, 84, 80], [130, 120, 114]], mortar: [54, 50, 48], bed: [[30, 29, 29], [50, 48, 48]] },
  { name: 'Void hollow',    bg: [8, 8, 14],    bg2: [22, 20, 38],
    rock: [[42, 38, 58], [70, 64, 94]],    moss: [[72, 180, 190], [130, 230, 236]],
    brick: [[56, 48, 78], [88, 76, 116]],  mortar: [32, 28, 46], bed: [[18, 16, 28], [34, 30, 48]] },
];
// Coal seams (floor 2) wears the Dev panel's colours (L2_LOOK, group "Level 2"; their defaults are
// its palette above), made into a theme once per change
/** @type {Record<string, [keyof Theme, number?]>} */
const L2_FIELD = { l2Bg: ['bg'], l2Bg2: ['bg2'], l2Rock1: ['rock', 0], l2Rock2: ['rock', 1], l2Moss1: ['moss', 0], l2Moss2: ['moss', 1],
  l2Brick1: ['brick', 0], l2Brick2: ['brick', 1], l2Mortar: ['mortar'], l2Bed1: ['bed', 0], l2Bed2: ['bed', 1] };
const L2 = { key: '', theme: THEMES[1] }, L2_DEF = L2_LOOK.map(r => r[2]).join();
/** @param {number} floor @returns {Theme} */
export function themeFor(floor) {
  const T = THEMES[(Math.max(1, floor) - 1) % THEMES.length];
  if (T !== THEMES[1]) return T;
  const key = L2_LOOK.map(r => DEV[r[0]]).join();
  if (key === L2_DEF) return T;                  // at the defaults: the palette itself
  if (key !== L2.key) {
    /** @type {any} */
    const t = { ...T, rock: T.rock.slice(), moss: T.moss.slice(), brick: T.brick.slice(), bed: T.bed.slice() };
    for (const [k] of L2_LOOK) {
      const v = DEV[k], f = L2_FIELD[k];
      if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v) || !f) continue;
      if (f[1] == null) t[f[0]] = hexArr(v); else t[f[0]][f[1]] = hexArr(v);
    }
    L2.key = key; L2.theme = t;
  }
  return L2.theme;
}

// ---- level decoration: pass 2 (baked pixels) and pass 3 (props) ----
// Every floor's theme gets five decorations. They come in three sorts:
//   bake   pass 2, purely visual. Painted straight into pixels: onto the rock itself (moss,
//          cracks, fissures — erased for free when the rock is dug), or into the decoration
//          layer `dimg`, a full-size non-colliding image drawn between the background and the
//          rock (rubble, beams, pillars, gears, ribs). dig/explode wipe that layer too.
//   amb    pass 2, a theme-wide particle effect spawned round the camera, not tied to a spot.
//   a prop kind (pass 3), something that does something. Props are NOT in `mat`: they never
//          block movement or enemy flight, they carry their own box (l,t,r,b about x,y) and
//          the Game checks overlaps against it. Most hang off a cell of rock (`anc`); the
//          Game re-checks that cell every 30 frames and drops the prop if it's gone.
// `at` is where it goes: ceil / floor / flat (level floor, width `w` cells) / pit (a dip
// in the floor) / wall / surf (floor or wall) / air (open space).
export const DECOR = [
  [ // 1 Mossy caves
    { id: 'vines',   name: 'Hanging Vines',      at: 'ceil',  kind: 'climb', style: 'vine', n: 24 },
    { id: 'rubble',  name: 'Overgrown Rubble',   at: 'flat',  kind: 'bake',  style: 'rubble', w: 4, n: 45 },
    { id: 'drips',   name: 'Dripping Water',     at: 'ceil',  kind: 'drip',  style: 'water', n: 26 },
    { id: 'spores',  name: 'Luminescent Spores', at: 'air',   kind: 'amb',   style: 'spores' },
    { id: 'moss',    name: 'Soft Moss Patches',  at: 'floor', kind: 'bake',  style: 'moss', n: 80 } ],
  [ // 2 Coal seams
    { id: 'beams',   name: 'Wooden Support Beams', at: 'flat',  kind: 'bake',   style: 'beams', w: 9, n: 26 },
    { id: 'carts',   name: 'Explosive Minecarts',  at: 'flat',  kind: 'barrel', style: 'cart', w: 5, n: 12 },
    { id: 'soot',    name: 'Soot Falls',           at: 'ceil',  kind: 'drip',   style: 'soot', n: 22 },
    { id: 'lanterns', name: 'Rusted Lanterns',     at: 'wall',  kind: 'lamp',   style: 'lantern', n: 22 },
    { id: 'picks',   name: 'Discarded Pickaxes',   at: 'floor', kind: 'bake',   style: 'pickaxe', n: 30 } ],
  [ // 3 Frozen deep
    { id: 'icicles', name: 'Fragile Icicles',   at: 'ceil',  kind: 'drop',  style: 'icicle', n: 36 },
    { id: 'ice',     name: 'Slick Ice Patches', at: 'flat',  kind: 'zone',  style: 'ice', w: 6, n: 18 },
    { id: 'icefall', name: 'Frozen Waterfalls', at: 'wall',  kind: 'climb', style: 'icefall', n: 16 },
    { id: 'frost',   name: 'Frost Breaths',     at: 'air',   kind: 'amb',   style: 'frost' },
    { id: 'snow',    name: 'Snow Drifts',       at: 'pit',   kind: 'zone',  style: 'snow', n: 16 } ],
  [ // 4 Ember halls
    { id: 'lava',    name: 'Lava Drips',       at: 'ceil',  kind: 'drip',  style: 'lava', n: 20 },
    { id: 'vents',   name: 'Scorched Vents',   at: 'flat',  kind: 'vent',  style: 'vent', w: 3, n: 16 },
    { id: 'obsidian', name: 'Obsidian Spikes', at: 'floor', kind: 'spike', style: 'obsidian', both: 1, n: 22 },
    { id: 'embers',  name: 'Floating Embers',  at: 'air',   kind: 'amb',   style: 'embers' },
    { id: 'ash',     name: 'Ash Piles',        at: 'flat',  kind: 'zone',  style: 'ash', w: 4, n: 18 } ],
  [ // 5 Fungal grotto
    { id: 'caps',    name: 'Bioluminescent Caps', at: 'floor', kind: 'lamp',  style: 'cap', n: 30 },
    { id: 'pods',    name: 'Toxic Spore Pods',    at: 'floor', kind: 'pod',   style: 'pod', n: 16 },
    { id: 'mycel',   name: 'Hanging Mycelium',    at: 'ceil',  kind: 'climb', style: 'myc', n: 22 },
    { id: 'shrooms', name: 'Bouncy Mushrooms',    at: 'flat',  kind: 'pad',   style: 'shroom', w: 4, n: 14 },
    { id: 'slime',   name: 'Slime Puddles',       at: 'pit',   kind: 'zone',  style: 'slime', n: 16 } ],
  [ // 6 Salt flats
    { id: 'pillars', name: 'Crystallized Pillars', at: 'flat',  kind: 'bake',  style: 'pillar', w: 4, n: 18 },
    { id: 'cracks',  name: 'Cracked Earth',        at: 'floor', kind: 'bake',  style: 'cracks', n: 60 },
    { id: 'stalag',  name: 'Salt Stalagmites',     at: 'floor', kind: 'spike', style: 'salt', n: 22 },
    { id: 'devils',  name: 'Dust Devils',          at: 'air',   kind: 'amb',   style: 'devils' },
    { id: 'bones',   name: 'Desiccated Bones',     at: 'floor', kind: 'bake',  style: 'bones', n: 36 } ],
  [ // 7 Amethyst vein
    { id: 'geodes',  name: 'Ceiling Geodes',    at: 'ceil',  kind: 'drop',  style: 'geode', n: 22 },
    { id: 'shards',  name: 'Reflective Shards', at: 'surf',  kind: 'shard', style: 'shard', n: 40 },
    { id: 'stones',  name: 'Resonance Stones',  at: 'wall',  kind: 'noise', style: 'stone', n: 12 },
    { id: 'dust',    name: 'Crystal Dust',      at: 'ceil',  kind: 'drip',  style: 'crystal', n: 20 },
    { id: 'glass',   name: 'Shattered Glass',   at: 'flat',  kind: 'zone',  style: 'glass', w: 4, n: 16 } ],
  [ // 8 Rustworks
    { id: 'pipes',   name: 'Leaking Pipes',   at: 'wall', kind: 'drip',  style: 'steam', n: 18 },
    { id: 'gears',   name: 'Rusted Gears',    at: 'air',  kind: 'bake',  style: 'gear', n: 22 },
    { id: 'acid',    name: 'Corrosive Pools', at: 'pit',  kind: 'zone',  style: 'acid', n: 16 },
    { id: 'chains',  name: 'Hanging Chains',  at: 'ceil', kind: 'climb', style: 'chain', n: 22 },
    { id: 'sparks',  name: 'Sparks',          at: 'ceil', kind: 'drip',  style: 'sparks', n: 16 } ],
  [ // 9 Bone garden
    { id: 'ribs',    name: 'Ribcage Arches',   at: 'flat',  kind: 'bake',  style: 'ribs', w: 6, n: 14 },
    { id: 'skulls',  name: 'Skull Piles',      at: 'flat',  kind: 'noise', style: 'skulls', w: 3, n: 16 },
    { id: 'bspikes', name: 'Bone Spikes',      at: 'floor', kind: 'spike', style: 'bone', both: 1, n: 22 },
    { id: 'roots',   name: 'Fossilized Roots', at: 'ceil',  kind: 'climb', style: 'root', n: 22 },
    { id: 'motes',   name: 'Dust Motes',       at: 'air',   kind: 'amb',   style: 'motes' } ],
  [ // 10 Drowned halls
    { id: 'statues', name: 'Waterlogged Statues', at: 'flat',  kind: 'cover', style: 'statue', w: 4, n: 12 },
    { id: 'bricks',  name: 'Submerged Bricks',    at: 'floor', kind: 'bake',  style: 'algae', n: 40 },
    { id: 'cascade', name: 'Ceiling Cascades',    at: 'ceil',  kind: 'drip',  style: 'cascade', n: 12 },
    { id: 'kelp',    name: 'Kelp Vines',          at: 'ceil',  kind: 'climb', style: 'kelp', n: 24 },
    { id: 'puddles', name: 'Deep Puddles',        at: 'pit',   kind: 'zone',  style: 'puddle', n: 18 } ],
  [ // 11 Ash wastes
    { id: 'logs',    name: 'Smoldering Logs',    at: 'flat',  kind: 'zone',  style: 'log', w: 4, n: 16 },
    { id: 'ashfall', name: 'Heavy Ash Fall',     at: 'air',   kind: 'amb',   style: 'ashfall' },
    { id: 'cpillar', name: 'Crumbling Pillars',  at: 'flat',  kind: 'cover', style: 'pillar', w: 4, hp: 4, n: 14 },
    { id: 'charred', name: 'Charred Remains',    at: 'floor', kind: 'bake',  style: 'charred', n: 40 },
    { id: 'sootwall', name: 'Soot-Stained Walls', at: 'bg',   kind: 'bake',  style: 'soot', n: 70 } ],
  [ // 12 Void hollow
    { id: 'matter',  name: 'Floating Dark Matter', at: 'air',   kind: 'matter',  style: 'matter', n: 14 },
    { id: 'eyes',    name: 'Eerie Glowing Eyes',   at: 'air',   kind: 'eyes',    style: 'eyes', n: 30 },
    { id: 'monolith', name: 'Distorted Monoliths', at: 'flat',  kind: 'cover',   style: 'monolith', w: 4, n: 12 },
    { id: 'tendrils', name: 'Void Tendrils',       at: 'floor', kind: 'tendril', style: 'tendril', n: 18 },
    { id: 'fissures', name: 'Neon Fissures',       at: 'surf',  kind: 'bake',    style: 'fissure', n: 50 } ],
];
export const decorFor = (/** @type {number} */ floor) => DECOR[(Math.max(1, floor) - 1) % DECOR.length];

// Each floor's palette has a sound too: a quiet bed (filtered noise, `bed: [cutoff, gain]`),
// an optional low drone in Hz, and the one-shots that go off round you now and then
// (`ev`: how many per second, on average). Keyed by theme name, so it follows themeFor.
export const AMBIENCE = {
  'Mossy caves':   { bed: [420, 0.05], drone: 55, ev: { drip: 0.5, critter: 0.15, wind: 0.06 } },
  'Coal seams':    { bed: [260, 0.06], drone: 42, ev: { trickle: 0.25, rumble: 0.08, creak: 0.07 } },
  'Frozen deep':   { bed: [1500, 0.035], drone: 0, ev: { wind: 0.18, chime: 0.2, crack: 0.06 } },
  'Ember halls':   { bed: [320, 0.06], drone: 48, ev: { crackle: 1.1, rumble: 0.07, hiss: 0.12 } },
  'Fungal grotto': { bed: [600, 0.04], drone: 62, ev: { puff: 0.3, drip: 0.35, bloop: 0.2 } },
  'Salt flats':    { bed: [2000, 0.03], drone: 0, ev: { wind: 0.22, hiss: 0.18, crack: 0.05 } },
  'Amethyst vein': { bed: [900, 0.03], drone: 70, ev: { chime: 0.45, hum: 0.08 } },
  'Rustworks':     { bed: [360, 0.05], drone: 50, ev: { creak: 0.22, clank: 0.18, hiss: 0.1 } },
  'Bone garden':   { bed: [520, 0.04], drone: 45, ev: { rattle: 0.18, wind: 0.1, whisper: 0.06 } },
  'Drowned halls': { bed: [230, 0.07], drone: 38, ev: { drip: 0.9, bloop: 0.35, trickle: 0.2 } },
  'Ash wastes':    { bed: [700, 0.05], drone: 40, ev: { wind: 0.28, crackle: 0.3, rumble: 0.05 } },
  'Void hollow':   { bed: [160, 0.05], drone: 33, ev: { whisper: 0.18, hum: 0.12, chime: 0.07 } },
};
