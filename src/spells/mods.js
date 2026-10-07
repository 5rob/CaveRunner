// @ts-check
// Every spell (MODS), the colour families the UI groups them by, shop prices, rarity
// tiers, and the Noita-style trigger variants built from the base spells.

// Enlarge / Shrink: the shot's size and every radius it works over
/** @param {Shot} s @param {number} k */
export const sizeBy = (s, k) => {
  s.size *= k; s.r *= k; s.explode *= k; s.pull *= k; s.eat *= k; s.bore *= k; s.pit *= k; s.pop *= k;
};

// ---- mods ----
// 'shot' mods are the projectiles. 'mod' mods change the shots cast AFTER them in
// the list, so the order you arrange them in is the whole game. 'passive' mods
// work from anywhere on the gun.
/** @type {Record<string, Mod>} */
export const MODS = {
  // Noita's Spark Bolt: a pink sparkle on a slight arc, trailing fading pink plasma,
  // nicking a speck out of the rock where it lands
  bolt:    { name: 'Bolt', kind: 'shot', glyph: '✧', col: '#ff9cf5', mana: 5,
             info: 'Cheap all-rounder. A pink sparkle on a slight arc that nicks the rock where it lands',
             dmg: 1, speed: 560, spread: 2, delay: 0.10, size: 2, life: 1.2, recoil: 6,
             grav: 110, drag: 0.35, pit: 2.5, look: 'spark', light: '255,140,245', lightR: 26 },
  spark:   { name: 'Spark', kind: 'shot', glyph: 'ϟ', col: '#ffe066', mana: 3,
             info: 'Fast, weak and nearly free. Crackles along in a zig-zag, shedding hot sparks', rech: -0.05,
             dmg: 0.5, speed: 720, spread: 5, delay: 0.05, size: 1.5, life: 0.8, recoil: 2,
             wig: 16, look: 'crackle', light: '255,230,120', lightR: 18 },
  // Noita's Magic Bolt (HEAVY_BULLET): a green-gold ball on a gentle arc spitting green and
  // yellow sparks, hitting hard enough to shove and to blow a small hole in rock
  slug:    { name: 'Slug', kind: 'shot', glyph: '⬤', col: '#b4ff5a', mana: 20,
             info: 'Slow and very heavy. A green-gold ball on a gentle arc that shoves what it hits and blows a small hole in rock',
             dmg: 4, speed: 320, spread: 1, delay: 0.26, size: 4, life: 1.6, recoil: 45,
             grav: 120, drag: 0.3, pit: 5, knock: 160, look: 'heavy', light: '150,240,90', lightR: 30 },
  // Noita's Buckshot: little green magic fireballs, lobbed, skipping once off rock and
  // popping a small hole where they finish
  buck:    { name: 'Buckshot', kind: 'shot', glyph: '⁙', col: '#8dff5a', mana: 12,
             info: 'Five lobbed green pellets in a cone. Each skips once off rock and pops a small hole',
             dmg: 0.7, speed: 460, spread: 15, delay: 0.32, size: 2, life: 0.7, count: 5, recoil: 32,
             grav: 160, bounce: 1, bounceE: 0.55, pit: 3.5, look: 'ember', light: '120,255,90', lightR: 16 },
  // Noita's Lance: a blue spear that picks up speed as it goes, shedding blue sparks
  lance:   { name: 'Lance', kind: 'shot', glyph: '➤', col: '#7ad7ff', mana: 20,
             info: 'A blue spear that speeds up as it flies. Punches through two',
             dmg: 2, speed: 700, spread: 0.6, delay: 0.28, size: 2, life: 1.2, pierce: 2, recoil: 22,
             accel: 0.5, vmax: 1100, look: 'lance', light: '155,235,255', lightR: 22 },
  // Noita's Bouncing Burst: a gold rubber ball under real gravity that keeps nine-tenths of
  // its speed every bounce, trailing fading green
  orb:     { name: 'Bounce Orb', kind: 'shot', glyph: '◍', col: '#ffd246', mana: 8,
             info: 'A rubber ball that falls, and ricochets off rock ten times hardly slowing',
             dmg: 2, speed: 420, spread: 0.6, delay: 0.14, size: 3, life: 4, bounce: 10, bounceE: 0.9,
             grav: 250, drag: 0.2, look: 'rubber', light: '255,210,70', lightR: 20, recoil: 8 },
  saw:     { name: 'Buzzsaw', kind: 'shot', glyph: '⚙', col: '#d9dde4', mana: 2,
             info: 'Cuts a circle right in front of you, and chews rock',
             dmg: 3, speed: 0, spread: 0, delay: 0, size: 15, life: 0.16, bore: 12,
             eat: 14, reach: 5, hidden: 1, recoil: 0, setDelay: 0, rech: -0.17 },
  // Noita's Bomb: a real bomb with a lit fuse. It bounces and rolls, and goes off when the
  // fuse burns down (or straight away on a creature)
  blast:   { name: 'Blast', kind: 'shot', glyph: '✹', col: '#3b3a44', mana: 28,
             info: 'A lobbed bomb with a lit fuse. Bounces and rolls, then blows a big hole. Goes off at once on a creature',
             dmg: 2, speed: 340, spread: 2, delay: 0.5, size: 3.5, life: 1.8, grav: 600,
             explode: 34, bounce: 30, bounceE: 0.4, lifeBoom: 1, look: 'bomb', light: '255,170,60', lightR: 12, recoil: 25 },

  dmg_up:  { name: 'Damage Plus', kind: 'mod', glyph: '✚', col: '#ff7a5a', mana: 5, d: 0.08,
             info: '+1.5 damage', f: s => { s.dmg += 1.5; s.recoil += 10; } },
  heavy:   { name: 'Heavy Shot', kind: 'mod', glyph: '⬇', col: '#ff7a5a', mana: 7, d: 0.17,
             info: 'x2.5 damage, x0.35 speed, big kick',
             f: s => { s.dmg *= 2.5; s.speed *= 0.35; s.size *= 1.4; s.recoil += 50; } },
  light:   { name: 'Light Shot', kind: 'mod', glyph: '⬆', col: '#7ad7ff', mana: 5, d: -0.05,
             info: 'x4 speed, x0.6 damage, tighter',
             f: s => { s.dmg *= 0.6; s.speed *= 4; s.size *= 0.7; s.spread = Math.max(0, s.spread - 6); s.recoil *= 0.5; } },
  speed:   { name: 'Speed Up', kind: 'mod', glyph: '»', col: '#7ad7ff', mana: 3,
             info: 'x2.5 speed', f: s => { s.speed *= 2.5; } },
  accel:   { name: 'Accelerating', kind: 'mod', glyph: '↗', col: '#7ad7ff', mana: 18, d: 0.13,
             info: 'starts slow, speeds up hard', f: s => { s.speed *= 0.35; s.accel = 3.6; } },
  homing:  { name: 'Homing', kind: 'mod', glyph: '◎', col: '#b57cff', mana: 40,
             info: 'curves onto enemies', f: s => { s.homing += 3.5; } },
  seeker:  { name: 'Seeker', kind: 'mod', glyph: '⊙', col: '#b57cff', mana: 60,
             info: 'hard homing, x0.8 speed', f: s => { s.homing += 10; s.speed *= 0.8; } },
  bounce:  { name: 'Bouncing', kind: 'mod', glyph: '⤢', col: '#9ef07a', mana: 6,
             info: '+5 bounces', f: s => { s.bounce += 5; } },
  pierce:  { name: 'Piercing', kind: 'mod', glyph: '⊹', col: '#9ef07a', mana: 70,
             info: '+3 pierce, x0.75 damage', f: s => { s.pierce += 3; s.dmg *= 0.75; } },
  tight:   { name: 'Reduce Spread', kind: 'mod', glyph: '│', col: '#e9ecf2', mana: 1,
             info: '-20° spread', f: s => { s.spread = Math.max(0, s.spread - 20); } },
  scatter: { name: 'Scatter', kind: 'mod', glyph: '≡', col: '#ffb347', mana: 4, d: -0.1,
             info: 'x3 shots, wide, weaker',
             f: s => { s.count *= 3; s.spread += 14; s.dmg *= 0.55; } },
  big:     { name: 'Big Shot', kind: 'mod', glyph: '⬢', col: '#ff7a5a', mana: 6, d: 0.06,
             info: 'x2 size, x1.3 damage', f: s => { s.size *= 2; s.dmg *= 1.3; s.recoil += 20; } },
  range:   { name: 'Long Range', kind: 'mod', glyph: '⟶', col: '#e9ecf2', mana: 30, d: 0.2,
             info: 'x2.5 flight time', f: s => { s.life *= 2.5; } },
  // v0.0.137: matched pairs, each the other's exact undo (×1.5 and ÷1.5)
  lifeup:  { name: 'Longer Flight', kind: 'mod', glyph: '⧗', col: '#e9ecf2', mana: 10, d: 0.05,
             info: 'x1.5 flight time (a field lasts longer too)', f: s => { s.life *= 1.5; } },
  lifedn:  { name: 'Shorter Flight', kind: 'mod', glyph: '⧖', col: '#e9ecf2', mana: 3, d: -0.05,
             info: '÷1.5 flight time (a field goes sooner too)', f: s => { s.life /= 1.5; } },
  grow:    { name: 'Enlarge', kind: 'mod', glyph: '⊞', col: '#ff7ac8', mana: 8, d: 0.05,
             info: 'x1.5 size: the shot, and every radius it works over (blasts, fields, pulls, digging)',
             f: s => { sizeBy(s, 1.5); } },
  shrink:  { name: 'Shrink', kind: 'mod', glyph: '⊟', col: '#ff7ac8', mana: 4, d: -0.03,
             info: '÷1.5 size: the shot, and every radius it works over (blasts, fields, pulls, digging)',
             f: s => { sizeBy(s, 1 / 1.5); } },
  brief:   { name: 'Short Fuse', kind: 'mod', glyph: '⟜', col: '#e9ecf2', mana: 8, d: -0.22,
             info: 'x0.45 flight time, fast cast', f: s => { s.life *= 0.45; } },
  tip:     { name: 'Explosive Tip', kind: 'mod', glyph: '✸', col: '#ff8a1f', mana: 28, d: 0.3,
             info: 'blows a hole on impact',
             f: s => { s.explode = Math.max(s.explode, 15); s.dmg += 1; s.speed *= 0.8; } },
  borer:   { name: 'Borer', kind: 'mod', glyph: '⛏', col: '#c8a06a', mana: 4, d: 0.02,
             info: 'drills through rock', f: s => { s.bore = 6; s.life *= 1.4; } },
  fast:    { name: 'Fast Cast', kind: 'mod', glyph: '≫', col: '#46c48c', mana: 3, d: -0.08,
             info: '-0.08s cast delay' },
  over:    { name: 'Overcharge', kind: 'mod', glyph: '⚡', col: '#ff7a5a', mana: 12, d: 0.2,
             info: 'x1.8 damage, slow cast', f: s => { s.dmg *= 1.8; s.recoil += 30; } },
  double:  { name: 'Double Cast', kind: 'mod', glyph: '②', col: '#ffe066', mana: 0,
             info: 'fires the next 2 shots at once', multi: 1 },
  triple:  { name: 'Triple Cast', kind: 'mod', glyph: '③', col: '#ffe066', mana: 2,
             info: 'fires the next 3 shots at once', multi: 2 },
  quad:    { name: 'Quad Cast', kind: 'mod', glyph: '④', col: '#ffe066', mana: 5,
             info: 'fires the next 4 shots at once', multi: 3 },
  cheap:   { name: 'Efficient', kind: 'mod', glyph: '◇', col: '#46c48c', mana: 0, d: 0.1,
             info: 'halves the mana cost', manaMul: 0.5 },

  trigger:  { name: 'Hair Trigger', kind: 'mod', glyph: '↺', col: '#46c48c', mana: 4, d: 0.05,
              info: '-0.15s recharge, +0.05s cast delay', rech: -0.15 },
  over_heat: { name: 'Overheat', kind: 'mod', glyph: '♨', col: '#ff7a5a', mana: 8,
              info: 'x2 damage, but x1.8 recharge', rechMul: 1.8,
              f: s => { s.dmg *= 2; s.recoil += 15; } },
  cold:     { name: 'Cold Start', kind: 'passive', glyph: '❄', col: '#46c48c', mana: 0,
              info: 'x0.55 recharge', rechMul: 0.55 },
  recharge: { name: 'Quick Recharge', kind: 'passive', glyph: '↻', col: '#46c48c', mana: 0,
              info: '-0.33s recharge', rech: -0.33 },
  battery:  { name: 'Mana Battery', kind: 'passive', glyph: '▮', col: '#46c48c', mana: 0,
              info: '+60 mana, +30 regen', manaMax: 60, manaRegen: 30 },
  // ours: the gun fires on its own, as if you never let go of the trigger (gunPassives().auto, aimAndCast)
  auto:     { name: 'Questions Later', kind: 'passive', glyph: '⇶', col: '#46c48c', mana: 0,
              info: 'Auto fire: the gun shoots on its own, as if you were holding the trigger down. Aim to steer it', auto: 1 },

  // ---- shots (Noita "Projectile" spells) ----
  // Noita's Magic Arrow: a green glowing arrow on a long shallow arc, shedding green
  // sparks, and it shoves what it hits
  arrow:   { name: 'Magic Arrow', kind: 'shot', glyph: '➣', col: '#78ff50', mana: 12,
             info: 'A green arrow on a long shallow arc. Accurate, dependable, and it knocks creatures back',
             dmg: 1.8, speed: 640, spread: 0.8, delay: 0.13, size: 2, life: 1.4, recoil: 14,
             grav: 90, knock: 120, pit: 2, look: 'arrow', light: '120,255,80', lightR: 24 },
  missile: { name: 'Magic Missile', kind: 'shot', glyph: '✦', col: '#ff9e3d', mana: 30,
             info: 'A little rocket: leaves slowly in a trail of smoke, then roars off. Explodes and sets things alight',
             dmg: 3, speed: 140, spread: 2, delay: 0.3, size: 3, life: 2, explode: 18, recoil: 30, fire: 1,
             accel: 2.6, vmax: 780, grav: 40, knock: 200, look: 'rocket', light: '255,190,80', lightR: 30 },
  fball:   { name: 'Fireball', kind: 'shot', glyph: '✷', col: '#ff7a2f', mana: 26,
             info: 'A slow, big ball of flame that droops as it flies, shedding fire and smoke. Explodes and sets things alight',
             dmg: 2.5, speed: 260, spread: 2.5, delay: 0.34, size: 4, life: 2.6,
             explode: 24, grav: 110, recoil: 26, fire: 1, look: 'flame', light: '255,140,40', lightR: 44 },
  fbolt:   { name: 'Firebolt', kind: 'shot', glyph: '❈', col: '#ff8a1f', mana: 16,
             info: 'A lobbed flame that bounces off rock four times, then explodes on whatever it hits. Sets things alight',
             dmg: 1.6, speed: 300, spread: 3, delay: 0.2, size: 2.5, life: 1.8, grav: 380,
             explode: 12, bounce: 4, bounceE: 0.7, recoil: 14, fire: 1, look: 'flame', light: '255,165,40', lightR: 26 },
  // v0.0.148 (owner): a flamethrower. A fast stream of short-lived flames the way you aim: they slow in the air,
  // rise, lick through creatures and set alight whatever they pass
  flamer:  { name: 'Flamethrower', kind: 'shot', glyph: '⟴', col: '#ff6a1f', mana: 3,
             info: 'A short spray of fire the way you aim. Slows and rises as it goes, passes through creatures and sets alight whatever it licks',
             dmg: 0.45, speed: 330, spread: 8, delay: 0.05, size: 2.5, life: 0.45, count: 2, drag: 2.5, grav: -90,
             pierce: 3, recoil: 2, fire: 1, look: 'flame', light: '255,140,40', lightR: 20 },
  // Noita's Bubble Spark: a slow glowing blue bubble, 20 soft bounces, lights the cave
  // round it, and pops a little hole when it bursts
  bubble:  { name: 'Bubble Spark', kind: 'shot', glyph: '○', col: '#46beff', mana: 5,
             info: 'A slow glowing bubble that lights the cave, bobs upward and bounces about twenty times. Hopeless at aiming',
             dmg: 1.2, speed: 260, spread: 23, delay: 0.1, size: 2.5, life: 1.7, bounce: 20, bounceE: 0.8,
             grav: -30, pit: 3.5, look: 'bubble', light: '70,190,255', lightR: 46, recoil: 3 },
  // Noita's Spitter Bolt: a pink glob spat hard that drags to a stop, droops, and
  // skitters off rock — ten little bounces, each one losing half its speed
  spit:    { name: 'Spitter Bolt', kind: 'shot', glyph: '⋄', col: '#f578dc', mana: 5,
             info: 'A quick pink glob. Slows fast, droops, and skitters off rock',
             dmg: 1.5, speed: 660, spread: 3, delay: 0.07, size: 1.8, life: 0.55, recoil: 4,
             grav: 200, drag: 2.2, bounce: 10, bounceE: 0.5, look: 'glob', light: '245,120,220', lightR: 18 },
  // Noita's Energy Orb (SLOW_BULLET): a slow pale-blue orb that shoves hard and blasts a
  // round hole where it lands
  eorb:    { name: 'Energy Orb', kind: 'shot', glyph: '◉', col: '#64beff', mana: 22,
             info: 'A slow, fat blue orb. Hits hard, shoves hard, and blasts a round hole in rock',
             dmg: 3.5, speed: 220, spread: 1, delay: 0.32, size: 5, life: 2.4, recoil: 30,
             pit: 9, knock: 220, drag: 0.15, look: 'orb', light: '100,190,255', lightR: 40 },
  // Noita's Energy Sphere (BOUNCY_ORB): a deep-blue ball that arcs and bounces five times
  esph:    { name: 'Energy Sphere', kind: 'shot', glyph: '◌', col: '#3c8cff', mana: 12,
             info: 'A fast blue ball that arcs, and bounces off rock five times',
             dmg: 1.4, speed: 480, spread: 2, delay: 0.1, size: 2.2, life: 1.8, grav: 250, drag: 0.4,
             bounce: 5, bounceE: 0.75, knock: 120, look: 'orb', light: '60,120,255', lightR: 26, recoil: 8 },
  zap:     { name: 'Lightning Bolt', kind: 'shot', glyph: '⌁', col: '#a8e4ff', mana: 34,
             info: 'The primordial force of nature. Punches through a crowd, and throws off arcs at nearby creatures and rock',
             dmg: 2.2, speed: 1400, spread: 0.5, delay: 0.3, size: 2, life: 0.5, pierce: 4, recoil: 8, arc: 1 },
  // Noita's Chain Bolt: a slow, crackling violet orb that leaps from creature to creature
  chain:   { name: 'Chain Bolt', kind: 'shot', glyph: '⋈', col: '#c880ff', mana: 28,
             info: 'A slow crackling violet orb that jumps from enemy to enemy, three times',
             dmg: 2, speed: 330, spread: 1.5, delay: 0.26, size: 2.5, life: 1.8, chain: 3, recoil: 10,
             look: 'chain', light: '250,80,255', lightR: 30 },
  void:    { name: 'Black Hole', kind: 'shot', glyph: '◯', col: '#9a6ad6', mana: 60,
             info: 'Rolls forward eating rock, hauls creatures in and swallows their shots',
             dmg: 1, speed: 140, spread: 0, delay: 0.5, size: 24, life: 3.5, eat: 19, pull: 70, recoil: 0 },
  // Noita's Digging Bolt: a short-range grinder in a puff of blue smoke that throws the
  // rock it chews back out as chips. Barely scratches a creature
  digbolt: { name: 'Digging Bolt', kind: 'shot', glyph: '▤', col: '#7ab8ff', mana: 0,
             info: 'Free, short-range, and very good at mining. Grinds rock to chips in a puff of blue smoke; only scratches creatures',
             dmg: 0.2, speed: 460, spread: 2, delay: 0.1, size: 2, life: 0.55, bore: 6, recoil: 2,
             look: 'drill', light: '90,170,255', lightR: 14 },
  glance:  { name: 'Glowing Lance', kind: 'shot', glyph: '▬', col: '#fff0a8', mana: 26,
             info: 'A shining golden spear that lights the cave and cuts straight through a line of enemies',
             dmg: 3.2, speed: 640, spread: 0.4, delay: 0.3, size: 2.5, life: 1.3, pierce: 3, recoil: 20,
             accel: 0.5, vmax: 1100, look: 'lance', light: '255,235,150', lightR: 46 },
  plasma:  { name: 'Plasma Beam', kind: 'shot', glyph: '━', col: '#ff6ad6', mana: 30,
             info: 'Hits instantly along a line, no travel time at all, and scorches a hole where it ends',
             dmg: 3, beam: 320, delay: 0.3, spread: 0.5, size: 2, life: 0.12, recoil: 6, pit: 3.5, look: 'beam' },
  // Noita's Luminous Drill: a short green flash of a beam, spraying green sparks
  ldrill:  { name: 'Luminous Drill', kind: 'shot', glyph: '▸', col: '#9dff6a', mana: 8,
             info: 'A short, instant green beam that chews through rock in a spray of green sparks',
             dmg: 1.2, beam: 95, bore: 3, delay: 0.06, spread: 1, size: 1.6, life: 0.08, recoil: 2, look: 'beam' },
  // Noita's Death Cross: a cyan glowing cross that tumbles to a stop, then goes off
  cross:   { name: 'Death Cross', kind: 'shot', glyph: '✜', col: '#23d2ff', mana: 34, look: 'cross', light: '35,210,255', lightR: 34, drag: 2.5,
             info: 'A glowing cyan cross that tumbles to a stop, then blows up in a cross',
             dmg: 2, speed: 260, spread: 1.5, delay: 0.36, size: 3, life: 2,
             fuse: 0.55, explode: 22, recoil: 12 },
  pollen:  { name: 'Pollen', kind: 'shot', glyph: '❁', col: '#d8ff6a', mana: 6,
             info: 'Puffs out, slows and floats up, then homes on a creature that comes close. Pops on contact',
             dmg: 0.8, speed: 150, spread: 20, delay: 0.06, size: 2, life: 6,
             homing: 6, drift: 1, homeR: 80, pop: 6, count: 2, recoil: 1,
             look: 'pollen', light: '216,255,106', lightR: 12 },
  disc:    { name: 'Disc Projectile', kind: 'shot', glyph: '⊘', col: '#d9dde4', mana: 20,
             info: 'A spinning sawblade that skips along the floor throwing sparks',
             dmg: 2.6, speed: 380, spread: 1, delay: 0.22, size: 4, life: 3,
             bounce: 6, bounceE: 0.85, grav: 250, drag: 0.3, knock: 90, recoil: 14, look: 'disc' },
  nuke:    { name: 'Nuke', kind: 'shot', glyph: '☢', col: '#ffe066', mana: 120,
             info: 'Take cover. It droops as it flies, dripping green, and the blast sets the cave alight',
             dmg: 8, speed: 300, spread: 1, delay: 0.9, size: 5, life: 2.5, explode: 90, recoil: 90,
             grav: 120, fire: 1, look: 'nuke', light: '180,255,90', lightR: 40 },
  meteor:  { name: 'Meteor', kind: 'shot', glyph: '☄', col: '#ff8a1f', mana: 70,
             info: 'Falls hard, digs deep and explodes. Sets things alight',
             dmg: 5, speed: 420, spread: 2, delay: 0.55, size: 5, life: 3,
             explode: 40, grav: 700, bore: 4, recoil: 50, fire: 1, look: 'flame', light: '255,150,50', lightR: 60 },
  // Noita's Teleport Bolts: harmless, and wherever the bolt stops you go
  tele:    { name: 'Teleport Bolt', kind: 'shot', glyph: '⤳', col: '#8fe8ff', mana: 40,
             info: 'Harmless. Wherever it lands or runs out, you appear there',
             dmg: 0, speed: 700, spread: 0, delay: 0.05, size: 2, life: 0.5, grav: 200, tele: 1, recoil: 0,
             look: 'sparks', light: '140,210,255', lightR: 36 },
  teleshort:{ name: 'Small Teleport Bolt', kind: 'shot', glyph: '↝', col: '#8fe8ff', mana: 20,
             info: 'A short hop. Harmless; nothing but a streak of blue sparks, and you appear wherever it stops',
             dmg: 0, speed: 1100, spread: 0, delay: 0.05, size: 1.6, life: 0.13, grav: 200, tele: 1, recoil: 0,
             look: 'sparks', light: '140,210,255', lightR: 30 },

  // ---- static projectiles: they stay where you put them and do their work over time ----
  boom:    { name: 'Explosion', kind: 'static', glyph: '✺', col: '#ff8a1f', mana: 40,
             info: 'A powerful blast, right where you aimed. It leaves fire behind',
             field: 'explode', r: 34, life: 0.1, delay: 0.4, recoil: 20, fire: 1, embers: 6 },
  // Noita's Explosion of Brimstone: the blast leaves fire behind and throws burning sparks
  brim:    { name: 'Explosion of Brimstone', kind: 'static', glyph: '✶', col: '#ff7a2f', mana: 10,
             info: 'A small, cheap blast that sets things alight and throws burning sparks. Mind your own feet',
             field: 'explode', r: 22, life: 0.1, delay: 0.25, recoil: 10, fire: 1, embers: 14 },
  crystal: { name: 'Unstable Crystal', kind: 'static', glyph: '◈', col: '#ff5a52', mana: 14,
             info: 'A mine. It waits, then goes off when something walks near',
             field: 'mine', r: 26, life: 12, delay: 0.2 },
  dormant: { name: 'Dormant Crystal', kind: 'static', glyph: '❖', col: '#ffb347', mana: 12,
             info: 'Sits harmless until another explosion sets it off',
             field: 'dormant', r: 30, life: 20, delay: 0.2 },
  stillc:  { name: 'Circle of Stillness', kind: 'static', glyph: '❅', col: '#7fd7ff', mana: 24,
             info: 'Enemies caught inside crawl, and it frosts out any fire inside it',
             field: 'slow', r: 44, life: 6, delay: 0.3 },
  shieldc: { name: 'Circle of Shielding', kind: 'static', glyph: '⊛', col: '#63c8ff', mana: 22,
             info: 'Eats enemy fire that crosses it',
             field: 'shield', r: 40, life: 6, delay: 0.3 },
  vigour:  { name: 'Circle of Vigour', kind: 'static', glyph: '✛', col: '#46c48c', mana: 30,
             info: 'Stand in it and you heal',
             field: 'heal', r: 36, life: 5, delay: 0.35 },
  storm:   { name: 'Thundercloud', kind: 'static', glyph: '⛈', col: '#a8e4ff', mana: 34,
             info: 'A dark cloud that rains lightning over everything under it, and its rain puts out fires',
             field: 'storm', r: 50, life: 6, delay: 0.4 },
  // Noita's Vacuum Field, renamed (v0.0.137): a steady strong pull, not a snap, and harmless
  vacfield:{ name: 'White Hole', kind: 'static', glyph: '⊗', col: '#9fd8ff', mana: 40,
             info: 'A tiny white hole that pulls everything close by (creatures, their shots, gold, loot) hard into its middle and holds it there. Harms nothing; walls don\'t stop it',
             field: 'vacuum', r: 64, life: 1.2, delay: 0.17 },
  glitter: { name: 'Glittering Field', kind: 'static', glyph: '❃', col: '#ffe066', mana: 36,
             info: 'Small blasts going off all over a wide patch',
             field: 'glitter', r: 64, life: 4, delay: 0.4 },

  // ---- utility ----
  refresh: { name: 'Wand Refresh', kind: 'util', glyph: '⟲', col: '#3fcf8e', mana: 20,
             info: 'Recharges the gun on the spot', act: 'refresh', d: 0.05 },
  blood:   { name: 'Blood Magic', kind: 'util', glyph: '☠', col: '#c2401f', mana: 0,
             info: 'Mana is nearly free and recharge is fast, but casting costs blood',
             act: 'blood', manaMul: 0.15, rech: -0.4, hp: 4 },
  bpower:  { name: 'Blood To Power', kind: 'util', glyph: '⊕', col: '#c2401f', mana: 10,
             info: 'Pays health for a big damage boost', act: 'bpower', hp: 8,
             f: s => { s.dmg += 2; } },
  gpower:  { name: 'Gold To Power', kind: 'util', glyph: '⛁', col: '#d8a52a', mana: 10,
             info: 'Spends some of your gold to make the shot hit harder', act: 'gpower' },
  farcast: { name: 'Long-Distance Cast', kind: 'util', glyph: '➟', col: '#f0f0f0', mana: 4,
             info: 'The shot starts well ahead of you', act: 'far', d: 0.02 },
  telecast:{ name: 'Teleporting Cast', kind: 'util', glyph: '⇝', col: '#f0f0f0', mana: 26,
             info: 'The shot starts at the nearest enemy instead of at you', act: 'tele', d: 0.04 },
  warpcast:{ name: 'Warp Cast', kind: 'util', glyph: '⇉', col: '#f0f0f0', mana: 12,
             info: 'The shot jumps forward the instant it is cast, stopped by walls',
             act: 'warp', d: 0.02 },
  sawstorm:{ name: 'Spells To Giga Sawblades', kind: 'util', glyph: '✳', col: '#d9dde4', mana: 40,
             info: 'Every shot of yours still in the air turns into a sawblade', act: 'saws', d: 0.1 },

  // ---- projectile modifiers ----
  knock:   { name: 'Knockback', kind: 'mod', glyph: '↦', col: '#ff7a5a', mana: 4, d: 0.03,
             info: 'Shoves whatever it hits', f: s => { s.knock += 260; } },
  kick:    { name: 'Recoil', kind: 'mod', glyph: '⇤', col: '#ff7a5a', mana: 2, d: -0.02,
             info: 'More kick. Handy if you like being launched',
             f: s => { s.recoil += 70; s.dmg += 0.4; } },
  damper:  { name: 'Recoil Damper', kind: 'mod', glyph: '⊖', col: '#3fcf8e', mana: 3, d: 0.02,
             info: 'Takes the shove out of a heavy gun', f: s => { s.recoil *= 0.2; } },
  crit:    { name: 'Critical Plus', kind: 'mod', glyph: '✴', col: '#ff5a52', mana: 6, d: 0.04,
             info: '+25% chance of a hit doing triple damage', f: s => { s.crit += 0.25; } },
  gravmod: { name: 'Gravity', kind: 'mod', glyph: '⇓', col: '#63c8ff', mana: 2, d: 0.02,
             info: 'Drags the shot down as it flies', f: s => { s.grav += 420; } },
  float:   { name: 'Anti-Gravity', kind: 'mod', glyph: '⇑', col: '#63c8ff', mana: 3, d: 0.02,
             info: 'Lifts the shot as it flies', f: s => { s.grav -= 340; } },
  boomer:  { name: 'Boomerang', kind: 'mod', glyph: '↩', col: '#b57cff', mana: 8, d: 0.05,
             info: 'Flies out, and halfway through its flight turns and comes back to you', f: s => { s.boomer += 3.2; s.life *= 1.5; } },
  spiral:  { name: 'Spiral Arc', kind: 'mod', glyph: '⟳', col: '#b57cff', mana: 5, d: 0.04,
             info: 'Swings side to side in a widening wave as it flies on', f: s => { s.spiral += 5.5; } },
  pong:    { name: 'Ping-Pong Path', kind: 'mod', glyph: '⇄', col: '#b57cff', mana: 6, d: 0.05,
             info: 'Flies out, snaps back a little, and on again', f: s => { s.pong += 4; s.life *= 1.4; } },
  follow:  { name: 'Follow Me', kind: 'mod', glyph: '⇜', col: '#b57cff', mana: 10, d: 0.04,
             info: 'Homing, but on you: a shot curves back round to you; a field comes to you and stays with you',
             f: s => { s.follow += 4; } },
  // owner (v0.0.155): Follow Me split in two; this half is the Gravity Gun's, a White Hole held where you aim
  followaim: { name: 'Follow This', kind: 'mod', glyph: '↬', col: '#b57cff', mana: 10, d: 0.04,
             info: 'A field hovers just ahead of your gun and goes wherever you aim (the Gravity Gun’s trick); a shot homes on that spot',
             f: s => { s.followAim += 4; } },
  orbit:   { name: 'Orbiting Arc', kind: 'mod', glyph: '◴', col: '#b57cff', mana: 9, d: 0.06,
             info: 'Circles whatever cast it: your gun, or a trigger spell\'s carrier as it flies', f: s => { s.orbit += 3.4; s.life *= 1.6; } },
  autoaim: { name: 'Auto-Aim', kind: 'mod', glyph: '✢', col: '#b57cff', mana: 7, d: 0.03,
             info: 'Snaps onto the nearest enemy the moment it leaves the barrel',
             f: s => { s.autoaim = 1; } },
  // Aim Assist (LIST3 #10): the right stick drives a pointer that snaps onto creatures and fires on its own
  // once it's on one (game/systems/gun.js aimAndCast, spells/assist.js). The pull aims at the snapped creature.
  aimassist: { name: 'Aim Assist', kind: 'mod', glyph: '⌖', col: '#b57cff', mana: 3, d: 0.02,
             info: 'The aim stick becomes a pointer that snaps onto enemies and fires when it\'s on one (no trigger ring)',
             f: s => { s.assist = 1; } },
  // Discriminate (LIST3 #11): each copy carries its own target, set once in the Bag with the world pointer
  // (spells/discrim.js: a targeted copy is its own id, 'discrim:<kind>:<id>', registered by ensureMod).
  // An unset copy does nothing; a set one makes the next spell touch only that target.
  discrim: { name: 'Discriminate', kind: 'mod', glyph: '⌾', col: '#b57cff', mana: 4, d: 0.02,
             info: 'Set its target once in the Bag (a creature, you, or an object): the next spell then only touches that, and passes through everything else',
             f: () => {} },
  nearhome:{ name: 'Short-range Homing', kind: 'mod', glyph: '⌒', col: '#b57cff', mana: 5, d: 0.02,
             info: 'Only steers once it is already close to something',
             f: s => { s.homing += 7; s.homeR = 70; } },
  flat:    { name: 'Horizontal Path', kind: 'mod', glyph: '═', col: '#ff5a52', mana: 4, d: 0.03,
             info: 'Forces the shot dead level, and it hits harder for it',
             f: s => { s.flat = 1; s.dmg *= 1.6; } },
  eater:   { name: 'Matter Eater', kind: 'mod', glyph: '▩', col: '#b57cff', mana: 14, d: 0.06,
             info: 'Eats a tunnel through rock the whole way',
             f: s => { s.eat = Math.max(s.eat, 4); } },
  lust:    { name: 'Bloodlust', kind: 'mod', glyph: '♥', col: '#ff5a52', mana: 10, d: 0.05,
             info: 'A hefty damage boost, but the shot can hurt you too',
             f: s => { s.dmg *= 2.2; s.friendly = 1; } },
  manapow: { name: 'Mana To Damage', kind: 'mod', glyph: '▰', col: '#ff5a52', mana: 0, d: 0.08,
             info: 'Burns every point of mana over 50 and turns it into damage', act: 'manapow' },
  split:   { name: 'Quantum Split', kind: 'mod', glyph: '≬', col: '#ff7ac8', mana: 8, d: 0.05,
             info: 'Splits into three weaker copies partway through its flight',
             f: s => { s.split = 3; s.dmg *= 0.6; } },
  cluster: { name: 'Clusterbolt', kind: 'mod', glyph: '⁘', col: '#ff7ac8', mana: 12, d: 0.06,
             info: 'Bursts into a spray of small explosives where it lands',
             f: s => { s.cluster = 5; } },
  bboom:   { name: 'Explosive Bounce', kind: 'mod', glyph: '✱', col: '#ff5a52', mana: 9, d: 0.05,
             info: 'Every ricochet sets off a blast',
             f: s => { s.bounceFx = 'explode'; s.bounce += 2; } },
  hspread: { name: 'Heavy Spread', kind: 'mod', glyph: '∴', col: '#3fcf8e', mana: 3, d: -0.14,
             info: 'Much faster casting, and no respect at all for where you aimed',
             f: s => { s.spread += 26; } },

  // ---- multicast ----
  oct:     { name: 'Octuple Spell', kind: 'mod', glyph: '⑧', col: '#ff7ac8', mana: 20,
             info: 'fires the next 8 shots at once', multi: 7 },
  myriad:  { name: 'Myriad Spell', kind: 'mod', glyph: '∞', col: '#ff7ac8', mana: 40,
             info: 'fires everything left on the gun at once', myriad: 1 },
  bifur:   { name: 'Formation - Bifurcated', kind: 'mod', glyph: '⋎', col: '#ff7ac8', mana: 2,
             info: 'fires the next 2 shots in a narrow V', multi: 1, form: [-11, 11] },
  trifur:  { name: 'Formation - Trifurcated', kind: 'mod', glyph: '⋔', col: '#ff7ac8', mana: 3,
             info: 'fires the next 3 shots in a fan', multi: 2, form: [-17, 0, 17] },
  behind:  { name: 'Formation - Behind Your Back', kind: 'mod', glyph: '⇅', col: '#ff7ac8', mana: 1,
             info: 'fires one ahead and one straight behind you', multi: 1, form: [0, 180] },

  // ---- the Greek letters: they copy other spells off the gun ----
  alpha:   { name: 'Alpha', kind: 'mod', off: 1, glyph: 'Α', col: '#f0f0f0', mana: 5, d: 0.02,
             info: 'also casts a copy of the first spell on the gun', copy: 'first' },
  gamma:   { name: 'Gamma', kind: 'mod', off: 1, glyph: 'Γ', col: '#f0f0f0', mana: 5, d: 0.02,
             info: 'also casts a copy of the last spell on the gun', copy: 'last' },
  tau:     { name: 'Tau', kind: 'mod', off: 1, glyph: 'Τ', col: '#f0f0f0', mana: 8, d: 0.03,
             info: 'casts the next two spells a second time', copy: 'next2' },
  omega:   { name: 'Omega', kind: 'mod', off: 1, glyph: 'Ω', col: '#f0f0f0', mana: 40, d: 0.1,
             info: 'casts a copy of every single spell on the gun', copy: 'all' },
  phi:     { name: 'Phi', kind: 'mod', off: 1, glyph: 'Φ', col: '#f0f0f0', mana: 20, d: 0.06,
             info: 'casts a copy of every shot on the gun', copy: 'shots' },
  sigma:   { name: 'Sigma', kind: 'mod', off: 1, glyph: 'Σ', col: '#f0f0f0', mana: 20, d: 0.06,
             info: 'casts a copy of every static field on the gun', copy: 'statics' },
  mu:      { name: 'Mu', kind: 'mod', off: 1, glyph: 'Μ', col: '#f0f0f0', mana: 15, d: 0.05,
             info: 'applies every modifier on the gun to this shot, wherever they sit', copy: 'mods' },
  zeta:    { name: 'Zeta', kind: 'mod', off: 1, glyph: 'Ζ', col: '#f0f0f0', mana: 12, d: 0.04,
             info: 'casts a random spell borrowed off one of your other guns', copy: 'other' },

  // ---- Add Trigger / Add Timer / Add Expiration Trigger: turn the next projectile
  // into a carrier. See the trigger variants below MOD_TIER.
  addtrig: { name: 'Add Trigger', kind: 'mod', glyph: '⊡', col: '#8fe0ff', mana: 10, d: 0.03,
             info: 'The next projectile casts the spell after it where it hits something',
             addTrig: 'hit' },
  addtimer:{ name: 'Add Timer', kind: 'mod', glyph: '◔', col: '#8fe0ff', mana: 13, d: 0.03,
             info: 'The next projectile casts the spell after it a moment after firing, or on a hit',
             addTrig: 'timer' },
  adddeath:{ name: 'Add Expiration Trigger', kind: 'mod', glyph: '✝', col: '#8fe0ff', mana: 12, d: 0.03,
             info: 'The next projectile casts the spell after it when it dies, however it dies',
             addTrig: 'expire' },
};
// Mods are coloured by what they are FOR, not one colour each: an amber shot
// needs a blue mod to speed it up, a red one to hit harder, and so on. The
// projectile colours in `col` are separate and stay distinct in flight.
/** @type {Record<string, { name: string, col: string }>} */
export const FAMILIES = {
  shots:   { name: 'Shot', col: '#ffc93c' },
  dmg:     { name: 'Damage', col: '#ff5a52' },
  vel:     { name: 'Speed & range', col: '#63c8ff' },
  path:    { name: 'Flight path', col: '#b57cff' },
  pattern: { name: 'Shot pattern', col: '#ff7ac8' },
  upkeep:  { name: 'Gun upkeep', col: '#3fcf8e' },
  field:   { name: 'Static field', col: '#2fd4c4' },
  cast:    { name: 'Casting & copies', col: '#e8e4f0' },
};
/** @type {Record<string, string>} */
export const FAMILY_OF = {
  bolt: 'shots', spark: 'shots', slug: 'shots', buck: 'shots', lance: 'shots',
  orb: 'shots', blast: 'shots', saw: 'shots',
  dmg_up: 'dmg', heavy: 'dmg', big: 'dmg', over: 'dmg', over_heat: 'dmg', tip: 'dmg',
  speed: 'vel', light: 'vel', accel: 'vel', range: 'vel', brief: 'vel',
  homing: 'path', seeker: 'path', follow: 'path', followaim: 'path', lifeup: 'vel', lifedn: 'vel', grow: 'pattern', shrink: 'pattern', bounce: 'path', pierce: 'path', borer: 'path',
  tight: 'pattern', scatter: 'pattern', double: 'pattern', triple: 'pattern', quad: 'pattern',
  fast: 'upkeep', trigger: 'upkeep', cold: 'upkeep', recharge: 'upkeep',
  cheap: 'upkeep', battery: 'upkeep', auto: 'upkeep',
  arrow: 'shots', missile: 'shots', fball: 'shots', fbolt: 'shots', flamer: 'shots', bubble: 'shots',
  spit: 'shots', eorb: 'shots', esph: 'shots', zap: 'shots', chain: 'shots', void: 'shots',
  digbolt: 'shots', glance: 'shots', plasma: 'shots', ldrill: 'shots', cross: 'shots',
  pollen: 'shots', disc: 'shots', nuke: 'shots', meteor: 'shots', tele: 'shots', teleshort: 'shots',
  boom: 'field', brim: 'field', crystal: 'field', dormant: 'field', stillc: 'field',
  shieldc: 'field', vigour: 'field', storm: 'field', vacfield: 'field', glitter: 'field',
  refresh: 'cast', farcast: 'cast', telecast: 'cast',
  warpcast: 'cast', sawstorm: 'cast', alpha: 'cast', gamma: 'cast', tau: 'cast',
  omega: 'cast', phi: 'cast', sigma: 'cast', mu: 'cast', zeta: 'cast',
  knock: 'dmg', kick: 'dmg', crit: 'dmg', flat: 'dmg', lust: 'dmg', manapow: 'dmg',
  bboom: 'dmg', bpower: 'dmg', gpower: 'dmg',
  gravmod: 'vel', float: 'vel',
  boomer: 'path', spiral: 'path', pong: 'path', orbit: 'path', autoaim: 'path', aimassist: 'path', discrim: 'path',
  nearhome: 'path', eater: 'path',
  split: 'pattern', cluster: 'pattern', oct: 'pattern', myriad: 'pattern', bifur: 'pattern',
  trifur: 'pattern', behind: 'pattern',
  damper: 'upkeep', hspread: 'upkeep', blood: 'upkeep',
  addtrig: 'cast', addtimer: 'cast', adddeath: 'cast',
};
/** @type {Record<string, string>} */
export const FIELD_WHAT = {
  explode: 'blows up on the spot',
  mine: 'waits, then detonates when something comes near',
  dormant: 'detonates when another explosion reaches it',
  slow: 'enemies inside crawl',
  shield: 'swallows enemy fire crossing it',
  heal: 'heals you while you stand in it',
  storm: 'strikes random spots inside with lightning',
  vacuum: 'pulls everything close by into its middle',
  glitter: 'small blasts going off all over it',
};
export const famOf = (/** @type {string} */ id) => FAMILIES[FAMILY_OF[id]] || FAMILIES.shots;
export const famCol = (/** @type {string} */ id) => famOf(id).col;

// shop prices in gold
/** @type {Record<string, number>} */
export const MOD_PRICE = {
  bolt: 20, spark: 12, slug: 40, buck: 35, lance: 45, orb: 30, blast: 45,
  follow: 35, followaim: 35, lifeup: 25, lifedn: 15, grow: 30, shrink: 20,
  dmg_up: 30, heavy: 40, light: 30, speed: 25, accel: 35, homing: 70, seeker: 90,
  bounce: 25, pierce: 85, tight: 15, scatter: 35, big: 30, range: 30, brief: 20,
  tip: 55, borer: 25, fast: 30, over: 45, double: 45, triple: 60, quad: 75, cheap: 40,
  saw: 80, trigger: 35, over_heat: 45, cold: 60, recharge: 50, battery: 50, auto: 70,
  arrow: 25, missile: 60, fball: 55, fbolt: 40, flamer: 45, bubble: 15, spit: 15, eorb: 45, esph: 30,
  zap: 70, chain: 75, void: 110, digbolt: 20, glance: 55, plasma: 80, ldrill: 35,
  cross: 65, pollen: 20, disc: 40, nuke: 150, meteor: 120, tele: 45, teleshort: 30, boom: 55, brim: 20,
  crystal: 30, dormant: 25, stillc: 50, shieldc: 50, vigour: 60, storm: 85, vacfield: 60,
  glitter: 80, refresh: 55, blood: 90, bpower: 45, gpower: 50,
  farcast: 25, telecast: 65, warpcast: 40, sawstorm: 85, knock: 25, kick: 15, damper: 25,
  crit: 50, gravmod: 15, float: 20, boomer: 40, spiral: 30, pong: 35, orbit: 50,
  autoaim: 45, aimassist: 40, discrim: 40, nearhome: 35, flat: 35, eater: 60, lust: 55, manapow: 55, split: 50,
  cluster: 60, bboom: 50, hspread: 30, oct: 110, myriad: 130, bifur: 30, trifur: 45,
  behind: 25, alpha: 45, gamma: 45, tau: 70, omega: 160, phi: 95, sigma: 90, mu: 85,
  zeta: 70, addtrig: 55, addtimer: 60, adddeath: 55,
};

// How rare a mod is, 1 common to 4 rare. Shops and the cave weight what they hand out by
// this, so early floors offer workhorses and the Greek letters stay a find.
/** @type {Record<string, number>} */
export const MOD_TIER = {
  lifeup: 1, lifedn: 1, grow: 1, shrink: 1, follow: 2, followaim: 2,
  bolt: 1, spark: 1, buck: 1, tight: 1, fast: 1, cheap: 1, spit: 1, bubble: 1, pollen: 1,
  digbolt: 1, arrow: 1, brim: 1, hspread: 1, damper: 1, knock: 1, kick: 1,
  gravmod: 1, float: 1, farcast: 1, bifur: 1, behind: 1, dmg_up: 1, speed: 1, brief: 1,
  slug: 2, lance: 2, orb: 2, blast: 2, heavy: 2, light: 2, accel: 2, bounce: 2, big: 2,
  range: 2, borer: 2, double: 2, over: 2, trigger: 2, esph: 2, fbolt: 2, flamer: 2, eorb: 2,
  disc: 2, glance: 2, ldrill: 2, crystal: 2, dormant: 2, boomer: 2, spiral: 2,
  pong: 2, autoaim: 2, aimassist: 2, discrim: 2, nearhome: 2, flat: 2, crit: 2, split: 2, bboom: 2, refresh: 2,
  warpcast: 2, trifur: 2, alpha: 2, gamma: 2, scatter: 2, homing: 3, tip: 3, triple: 3,
  over_heat: 3, recharge: 3, battery: 3, auto: 2, saw: 3, missile: 3, fball: 3, zap: 3, chain: 3,
  cross: 3, plasma: 3, boom: 3, stillc: 3, shieldc: 3, vigour: 3, vacfield: 3, orbit: 3,
  eater: 3, lust: 3, cluster: 3, manapow: 3, bpower: 3, gpower: 3, telecast: 3, tau: 3,
  mu: 3, phi: 3, sigma: 3, seeker: 4, pierce: 4, quad: 4, cold: 4, void: 4, nuke: 4,
  meteor: 4, storm: 4, glitter: 4, sawstorm: 4, blood: 4, oct: 4, myriad: 4, omega: 4,
  zeta: 4, addtrig: 3, addtimer: 3, adddeath: 3, tele: 2, teleshort: 1,
};
export const tierOf = (/** @type {string} */ id) => MOD_TIER[id] || 2;

// ---- trigger, timer and expiration variants (Noita's "... With Trigger" spells) ----
// Not their own kind of thing: each is an existing spell that also carries a payload.
// When drawn it draws `draw` more casts (plus any modifiers on the way) as its payload,
// a little cast of its own, and lets it off: 'hit' on the first thing it touches, 'timer'
// after `timer` seconds (or on a hit first), 'expire' when it dies, however it dies.
// Outside modifiers don't reach the payload and payload modifiers don't leak out.
export const TRIG_KINDS = {
  hit:    { tag: 'With Trigger', mark: 'T' },
  timer:  { tag: 'With Timer', mark: '◔' },
  expire: { tag: 'With Expiration Trigger', mark: '✝' },
};
/** @type {[id: string, base: string, trig: TrigKind, extra?: Partial<Mod>][]} */
export const TRIG_VARIANTS = [
  // id, base, trigger kind, extra
  ['bolt_t',    'bolt',    'hit'],
  ['bolt_tt',   'bolt',    'hit',    { name: 'Bolt With Double Trigger', draw: 2, mana: 12, mark: 'T²' }],
  ['arrow_t',   'arrow',   'hit'],
  ['fbolt_t',   'fbolt',   'hit'],
  ['bubble_t',  'bubble',  'hit'],
  ['eorb_t',    'eorb',    'hit'],
  ['crystal_t', 'crystal', 'hit'],
  ['dormant_t', 'dormant', 'hit'],
  ['bolt_ti',   'bolt',    'timer',  { timer: 0.25 }],
  ['arrow_ti',  'arrow',   'timer',  { timer: 0.3 }],
  ['spit_ti',   'spit',    'timer',  { timer: 0.17 }],
  ['esph_ti',   'esph',    'timer',  { timer: 0.5 }],
  ['eorb_ti',   'eorb',    'timer',  { timer: 0.8 }],
  ['ldrill_ti', 'ldrill',  'timer',  { timer: 0 }],
  ['void_d',    'void',    'expire', { name: 'Black Hole With Death Trigger' }],
];
export const TIMER_ADD = 0.33;                 // how long Add Timer waits
export const VAC_PULL = 260;                   // White Hole: units/s it hauls things in at its edge (faster further in)
for (const [id, base, trig, extra] of TRIG_VARIANTS) {
  const m = MODS[base], k = TRIG_KINDS[trig];
  MODS[id] = Object.assign({}, m, {
    name: m.name + ' ' + k.tag, trig, draw: 1, base,
    mana: Math.round(m.mana * 1.3 + 5), mark: k.mark,
    info: m.info + '. ' + (trig === 'hit' ? 'Casts the next spell where it hits'
      : trig === 'timer' ? 'Casts the next spell a moment after firing'
      : 'Casts the next spell where it dies'),
  }, extra || {});
  if (extra && extra.mana) MODS[id].mana = m.mana + extra.mana;
  FAMILY_OF[id] = FAMILY_OF[base];
  MOD_PRICE[id] = Math.round((MOD_PRICE[base] || 30) * 1.4 + 15);
  MOD_TIER[id] = Math.min(4, tierOf(base) + 1);
}

export const priceOf = (/** @type {string} */ id) => MOD_PRICE[id] || 30;

for (const k of Object.keys(MODS)) MODS[k].id = k;

// `off` mods (the Greek letters, for now) stay in MODS but are never handed out
export const SHOT_IDS = Object.keys(MODS).filter(k => MODS[k].kind === 'shot' && !MODS[k].off);
// a found gun is seeded with something that hurts on its own, so never a bare trigger
export const SEED_SHOTS = SHOT_IDS.filter(k => !MODS[k].trig);
export const ALL_IDS = Object.keys(MODS).filter(k => !MODS[k].off);
