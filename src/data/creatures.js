// @ts-check
// Who lives where: the creature types (CREATURES), which ones live on floors 1-10
// (ROSTERS, rosterFor) and one creature's floor-scaled stats (enemyFor). A floor's roster is
// picked by the floor number, never the seed.

// ---- creatures ----
// Who lives on a floor. Floors 1-10 each own a fixed roster of 2-6 of these, and the
// roster is the same on every run, so the thing that killed you on floor 6 is the
// thing you meet on floor 6 next time. Stats and gold scale with the floor a creature
// belongs to, so a floor 9 Hiisi is worth more and takes more killing than a floor 2
// one. Past floor 10 the roster is drawn at random instead, so the run keeps moving.
//
// act:  shoot   hovers, patrols, fires when it has a line on you
//       turret  holds station, longer reach, winds up before it fires
//       chase   comes at you and hurts on contact
//       bomb    comes at you and bursts on contact
//       spider  crawls rock and its own lines, bites, and strings you (see spiderStep)
//       jelly   swims in pulses, turns slowly, spits poison when its head is on you (jellyStep)
// body: which sprite draws it
// kp:   a reworked creature's Dev-knob prefix. A creature with one runs its own step
//       function, rolls its aggro reach (kp+'Aggro') and bite (kp+'Bite'/'BiteCd') off its
//       own knobs, owns its motion (no generic hover bob), and comes for you when hurt.
/** @type {Record<string, CreatureType>} */
export const CREATURES = {
  // jellyfish: pulses along wherever its head points, drag slows it, then it pulses again;
  // hunting, it lines its head up on you and spits dripping poison. Its numbers are
  // Dev-panel knobs (DEV.je*); dmg and spd here are only its defaults, for show.
  meduusa: { name: 'Myrkkymeduusa', body: 'jelly', act: 'jelly', kp: 'je', aggro: 300,
    col: { a: '#46c94f', b: '#133d1a', c: '#a6ff7c', eye: '#e4ff4a' }, glow: '110,255,90',
    hp: 2, dmg: 7, bspd: 0, range: 0, cd: 0, gold: 4, r: 9, spd: 140 },
  hiisi:  { name: 'Hiisi', body: 'drone', act: 'shoot',
    col: { a: '#4f7a52', b: '#22331f', c: '#7fb383', eye: '#ffd98a' },
    hp: 5, dmg: 10, bspd: 190, range: 230, cd: 1.5, gold: 8, r: 9, spd: 34 },
  tappura: { name: 'Tappurahiisi', body: 'drone', act: 'shoot', shots: 4,
    col: { a: '#7a5a3a', b: '#33241a', c: '#b08a5c', eye: '#ffb347' },
    hp: 6, dmg: 7, bspd: 200, range: 180, cd: 2.3, gold: 10, r: 10, spd: 30 },
  chain:  { name: 'Chaingunner', body: 'drone', act: 'shoot',
    col: { a: '#8a3f3f', b: '#3a1c1c', c: '#c06a6a', eye: '#ff8a8a' },
    hp: 7, dmg: 5, bspd: 230, range: 250, cd: 0.6, gold: 12, r: 10, spd: 32 },
  snipu:  { name: 'Snipuhiisi', body: 'drone', act: 'turret', tele: 0.55,
    col: { a: '#5a5f8a', b: '#252a44', c: '#8f95c4', eye: '#9ad4ff' },
    hp: 4, dmg: 22, bspd: 420, range: 460, cd: 3.0, gold: 14, r: 9, spd: 0 },
  // spider: lives on rock and its own silk (spiderStep); bites up close, and shoots a
  // string at you that slows you until you pull it too long and it snaps. Its speeds and
  // reaches are Dev-panel knobs (DEV.sp*); spd is the burst speed's default, for show.
  hamahakki: { name: 'Hämähäkki', body: 'spider', act: 'spider', kp: 'sp', aggro: 300,
    col: { a: '#6a4a86', b: '#2b1d38', c: '#a077c4', eye: '#ffd98a' },
    hp: 4, dmg: 12, bspd: 0, range: 0, cd: 0, gold: 6, r: 9, spd: 260 },
  // rat: runs the rock surfaces round its nest (ratStep), bites you and knocks gold out of
  // you, grabs any loose gold near it and carries it home. Its numbers are Dev knobs (DEV.ra*).
  // It is never rolled off a roster: rats only come out of nests.
  rotta: { name: 'Rotta', body: 'rat', act: 'rat', kp: 'ra', aggro: 260, noRoster: 1,
    col: { a: '#7a6a5e', b: '#3a302a', c: '#b3a291', eye: '#ff5a5a' },
    hp: 1, dmg: 4, bspd: 0, range: 0, cd: 0, gold: 2, r: 4, spd: 170 },
  // rat nest: a room in the rock at the end of a thin tunnel. Doesn't move; lets a rat out
  // now and then while it has fewer than its max out; dies to digging or blasting.
  pesa: { name: 'Rotanpesä', body: 'nest', act: 'nest', noRoster: 1,
    col: { a: '#8a6a3a', b: '#3d2c18', c: '#c49a5a', eye: '#ffd23c' },
    hp: 12, dmg: 0, bspd: 0, range: 0, cd: 0, gold: 0, r: 10, spd: 0 },
  lohkare: { name: 'Lohkare', body: 'crawler', act: 'chase', aggro: 260,
    col: { a: '#6a625a', b: '#2c2823', c: '#9d948a', eye: '#ffb347' },
    hp: 16, dmg: 18, bspd: 0, range: 0, cd: 0, gold: 20, r: 13, spd: 26 },
  mato:   { name: 'Mato', body: 'worm', act: 'chase', aggro: 320,
    col: { a: '#a2607a', b: '#40222e', c: '#d68fa8', eye: '#ffd98a' },
    hp: 6, dmg: 14, bspd: 0, range: 0, cd: 0, gold: 9, r: 8, spd: 84 },
  hurtta: { name: 'Hurtta', body: 'crawler', act: 'chase', aggro: 360,
    col: { a: '#7a4a3a', b: '#2f1a14', c: '#b3765c', eye: '#ff9a5a' },
    hp: 5, dmg: 15, bspd: 0, range: 0, cd: 0, gold: 10, r: 9, spd: 105 },
  kobold: { name: 'Kobold', body: 'crawler', act: 'chase', aggro: 300,
    col: { a: '#8a7a4a', b: '#332d18', c: '#c0ad74', eye: '#ffe066' },
    hp: 3, dmg: 8, bspd: 0, range: 0, cd: 0, gold: 5, r: 7, spd: 92 },
  konna:  { name: 'Konna', body: 'blob', act: 'chase', aggro: 260,
    col: { a: '#4a7a6a', b: '#1c332c', c: '#79b3a0', eye: '#d8ff9a' },
    hp: 6, dmg: 11, bspd: 0, range: 0, cd: 0, gold: 7, r: 10, spd: 48 },
  lima:   { name: 'Limanuljaska', body: 'blob', act: 'bomb', aggro: 300,
    col: { a: '#6fa03a', b: '#2a3d14', c: '#a6d46a', eye: '#e6ff9a' },
    hp: 5, dmg: 20, bspd: 0, range: 0, cd: 0, gold: 11, r: 10, spd: 55 },
  tuli:   { name: 'Stendari', body: 'blob', act: 'bomb', aggro: 330, fire: 1,
    col: { a: '#c05a2a', b: '#3f1c0e', c: '#ff9a5a', eye: '#ffe066' },
    hp: 6, dmg: 26, bspd: 0, range: 0, cd: 0, gold: 13, r: 10, spd: 60 },
  karpas: { name: 'Kärpässieni', body: 'blob', act: 'turret',
    col: { a: '#b04a4a', b: '#3d1616', c: '#e88a8a', eye: '#ffffff' },
    hp: 5, dmg: 12, bspd: 150, range: 300, cd: 1.9, gold: 9, r: 10, spd: 0 },
  jaatio: { name: 'Jäätiö', body: 'skull', act: 'turret', tele: 0.3,
    col: { a: '#7ab8d8', b: '#22414f', c: '#b6e2f4', eye: '#d8f4ff' },
    hp: 8, dmg: 12, bspd: 130, range: 240, cd: 1.7, gold: 15, r: 10, spd: 0 },
  skull:  { name: 'Elävät luut', body: 'skull', act: 'turret', tele: 0.35,
    col: { a: '#d8d2be', b: '#4a463c', c: '#f4f0e0', eye: '#5ee0a0' },
    hp: 7, dmg: 14, bspd: 200, range: 320, cd: 2.1, gold: 16, r: 9, spd: 0 },
};
export const CREATURE_IDS = Object.keys(CREATURES);

// Floors 1-10, fixed for good — that is the familiarity. Order is roughly the order
// you meet them: weak gunners and one crawler first, snipers and bombers in the
// middle, the armoured and the wind-up shooters at the top.
export const ROSTERS = [
  ['meduusa', 'hamahakki'],
  ['meduusa', 'hamahakki', 'hiisi'],
  ['hiisi', 'konna', 'hamahakki'],
  ['hiisi', 'mato', 'lima', 'kobold'],
  ['hiisi', 'karpas', 'hurtta', 'lima'],
  ['snipu', 'hiisi', 'hurtta', 'tuli', 'karpas'],
  ['snipu', 'lohkare', 'mato', 'tuli', 'kobold'],
  ['jaatio', 'chain', 'lohkare', 'hamahakki', 'hurtta', 'karpas'],
  ['jaatio', 'chain', 'snipu', 'tuli', 'lohkare', 'skull'],
  ['chain', 'snipu', 'lohkare', 'skull', 'jaatio', 'tappura'],
];
// the roster for a floor. Past the fixed ten it rolls a fresh 2-6 off the whole list,
// using the level's own seeded rnd so a floor stays consistent while you are on it.
/** @param {number} floor @param {Rnd} [rnd] @returns {string[]} */
export function rosterFor(floor, rnd) {
  if (floor >= 1 && floor <= ROSTERS.length) return ROSTERS[floor - 1].slice();
  const r = rnd || Math.random, pool = CREATURE_IDS.filter(id => !CREATURES[id].noRoster), out = [];
  const n = 2 + Math.floor(r() * 5);
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

// how much more gold is worth on a floor: a kill's reward, and the shop heal's price, both lift by it
/** @param {number} floor */
export const goldScale = floor => 1 + (floor - 1) * 0.30;

// the shop heal: the first on a floor is free, then HEAL_PRICE, times HEAL_MUL for each one after,
// all lifted by the floor like the kill gold. A new floor's shop starts the count again
export const HEAL_PRICE = 100, HEAL_MUL = 1.75;
/** @param {number} bought heals already bought on this floor @param {number} floor */
export const healPrice = (bought, floor) => bought <= 0 ? 0
  : Math.round(HEAL_PRICE * Math.pow(HEAL_MUL, bought - 1) * goldScale(floor) / 5) * 5;

// One floor's worth of one creature: the type's own numbers, lifted by the floor it
// belongs to. Health climbs hardest, gold next, damage least — a floor 10 enemy is
// worth a lot more than it hurts, or the shop heal would never keep up.
/** @param {string} id @param {number} floor @returns {CreatureKind} */
export function enemyFor(id, floor) {
  const c = CREATURES[id];
  const hp = 1 + (floor - 1) * 0.35, dmg = 1 + (floor - 1) * 0.16, gold = goldScale(floor);
  return { id, name: c.name, body: c.body, act: c.act, col: c.col,
    hp: Math.max(1, Math.round(c.hp * hp)),
    dmg: Math.max(1, Math.round(c.dmg * dmg)),
    bspd: Math.round(c.bspd * (1 + (floor - 1) * 0.05)),
    gold: Math.max(1, Math.round(c.gold * gold)),
    range: c.range, cd: c.cd, tele: c.tele || 0, shots: c.shots || 1,
    r: c.r, spd: c.spd, aggro: c.aggro || 300, kp: c.kp || null, glow: c.glow || null,
  };
}
// the acts that hunt you: they notice you on a sightline within their aggro reach, keep
// coming, and only lose you far away (see the enemy loop)
/** @type {Record<string, number>} */
export const HUNTERS = { chase: 1, bomb: 1, spider: 1, jelly: 1, rat: 1 };

// creatures (by act) that live only in the natural zones: spawned there, and they won't swim
// out into a built-up zone (jellyStep's env.stay)
/** @type {Record<string, number>} */
export const NATURAL_ONLY = { jelly: 1 };
