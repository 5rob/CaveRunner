// @ts-check
// The perks (one per hidden perk room) and perkBag, which folds the ones you own into
// the single bag of multipliers and flags the game reads.

import { PLAYER_HP } from '../core/consts.js';

// ---- perks ----
// One per hidden room, yours for the rest of the run. Each is a plain bag of multipliers
// and flags — nothing clever — and perkBag() adds them up into the one object the rest of
// the game reads. That keeps every effect in one place and testable on its own: a perk
// that does nothing is a field nobody read, and the logic suite checks the fields that
// matter actually move.
/** @type {Record<string, Perk>} */
export const PERKS = {
  eye:      { name: 'All-Seeing Eye', glyph: '◉', tint: '#8fd3ff', seeAll: 1,
              info: 'The whole floor is lit. No fog anywhere, on this floor or any other.' },
  ghost:    { name: 'Angry Ghost', glyph: '☾', tint: '#c9a6ff', ghost: 1,
              info: 'A spirit trails you and fires at whatever is nearest.' },
  gold:     { name: 'Attract Gold', glyph: '◇', tint: '#ffc93c', goldPull: 3,
              info: 'Coin flies to you from three times as far away.' },
  bounce:   { name: 'Bouncing Spells', glyph: '⤢', tint: '#7ad7ff', bounce: 1,
              info: 'Every shot bounces once more than it otherwise would.' },
  close:    { name: 'Close Call', glyph: '✧', tint: '#ff8a1f', close: 1,
              info: '+40% critical chance while something is within 56 units of you.' },
  conc:     { name: 'Concentrated Spells', glyph: '✹', tint: '#ff5a52',
              dmg: 1.25, spread: 0.5, delay: 1.15, recoil: 1.25,
              info: 'A quarter more damage and half the spread, but a slower gun and a harder kick.' },
  contact:  { name: 'Contact Damage', glyph: '✺', tint: '#ff5a36', contact: 1,
              info: 'Anything that touches you is hurt by it.' },
  crit:     { name: 'Critical Hit +', glyph: '✳', tint: '#ff5a52', crit: 0.15,
              info: '+15% chance of a hit doing triple damage.' },
  eradar:   { name: 'Enemy Radar', glyph: '▲', tint: '#ff5a52', radarEnemy: 1,
              info: 'The nearest creatures are marked at the edge of the screen.' },
  health:   { name: 'Extra Health', glyph: '✚', tint: '#46c48c', hpAdd: 50,
              info: '50 more maximum health, and it comes full.' },
  holyitem: { name: 'Extra Item in Holy Mountain', glyph: '♦', tint: '#ffc93c', extraItem: 1,
              info: 'Every shop offers five things instead of four.' },
  life:     { name: 'Extra Life', glyph: '♥', tint: '#ff5a36', lives: 1,
              info: 'You get back up once, at full health, the first time you are killed.' },
  knock:    { name: 'Extra Knockback on Spells', glyph: '⟫', tint: '#e88a3c', recoil: 1.5,
              info: 'Half again the kick out of every shot — which the jetpack can work with.' },
  lev:      { name: 'Faster Levitation', glyph: '⬆', tint: '#7ad7ff', jet: 1.25,
              info: 'A quarter more thrust out of the jetpack.' },
  move:     { name: 'Faster Movement', glyph: '➤', tint: '#6db8ff', walk: 1.3,
              info: 'Walk and fly a third faster.' },
  proj:     { name: 'Faster Projectiles', glyph: '⇒', tint: '#ffc93c', speed: 1.25,
              info: 'Everything you fire travels a quarter faster.' },
  wands:    { name: 'Faster Wands', glyph: '↻', tint: '#6db8ff', delay: 0.75, rech: 0.75,
              info: 'Cast delay and recharge are three quarters of what they were.' },
  glass:    { name: 'Glass Cannon', glyph: '✷', tint: '#ff5a52', dmg: 2.5, hpMul: 0.5,
              info: 'Two and a half times the damage, and half the health to spend.' },
  greed:    { name: 'Greed', glyph: '⬤', tint: '#ffc93c', gold: 2,
              info: 'Every coin is worth double.' },
  homing:   { name: 'Homing Shots', glyph: '↝', tint: '#b57cff', homing: 3,
              info: 'Your shots bend towards whatever is nearest.' },
  invis:    { name: 'Invisibility', glyph: '☁', tint: '#9aa3ad', invis: 1,
              info: 'Creatures do not notice you until you are almost on top of them.' },
  iradar:   { name: 'Item Radar', glyph: '◆', tint: '#b57cff', radarItem: 1,
              info: 'The nearest mod lying in the cave is marked at the edge of the screen.' },
  trail:    { name: 'Levitation Trail', glyph: '≈', tint: '#ff8a1f', trail: 1,
              info: 'Flying leaves a trail of fire behind you that burns what it touches.' },
  shield:   { name: 'Permanent Shield', glyph: '⬡', tint: '#7ad7ff', shield: 1,
              info: 'A shield soaks the first hit and comes back a couple of seconds later.' },
  pinpoint: { name: 'Pinpointer', glyph: '⊙', tint: '#5ee0a0', pinpointer: 1, speed: 1.2, spread: 0.6,
              info: 'You aim at the nearest creature instead of by hand, with a sightline to it.' },
  repel:    { name: 'Projectile Repulsion Field', glyph: '⊘', tint: '#8fd3ff', repel: 1,
              info: 'Shots aimed at you are shoved aside before they arrive.' },
  tinker:   { name: 'Tinker with Wands Everywhere', glyph: '⚙', tint: '#e9ecf2', tinker: 1,
              info: 'The mod screen works out in the cave, not only in the shop.' },
  unlimited:{ name: 'Unlimited Spells', glyph: '∞', tint: '#6db8ff', mana: 0,
              info: 'Spells cost no mana at all.' },
  wradar:   { name: 'Wand Radar', glyph: '▣', tint: '#ffc93c', radarWand: 1,
              info: 'The nearest gun lying in the cave is marked at the edge of the screen.' },
  hearts:   { name: 'Stronger Hearts', glyph: '❤', tint: '#46c48c', heal: 1.5,
              info: 'Anything that heals you heals half again as much.' },
  sight:    { name: 'Trajectory Sight', glyph: '⋯', tint: '#7ad7ff', trajectory: 1,
              info: 'Shows where your next shot flies — the dotted aim line, mods and all.' },
};
export const PERK_IDS = Object.keys(PERKS);

// Everything the perks you are carrying add up to. Multipliers multiply, flags stick,
// `mana: 0` means unlimited and stays unlimited however many of them you find.
/** @param {string[]} [ids] @returns {PerkBag} */
export function perkBag(ids) {
  /** @type {PerkBag} */
  const P = { dmg: 1, speed: 1, spread: 1, bounce: 0, recoil: 1, crit: 0, mana: 1,
    delay: 1, rech: 1, walk: 1, jet: 1, hpMul: 1, hpAdd: 0, heal: 1, gold: 1, goldPull: 1,
    shield: 0, lives: 0, ghost: 0, homing: 0, trail: 0, contact: 0, close: 0, invis: 0,
    repel: 0, seeAll: 0, radarEnemy: 0, radarItem: 0, radarWand: 0, tinker: 0,
    extraItem: 0, pinpointer: 0, trajectory: 0 };
  for (const id of ids || []) {
    const k = PERKS[id];
    if (!k) continue;
    P.dmg *= k.dmg || 1; P.speed *= k.speed || 1; P.spread *= k.spread || 1;
    P.recoil *= k.recoil || 1; P.delay *= k.delay || 1; P.rech *= k.rech || 1;
    P.walk *= k.walk || 1; P.jet *= k.jet || 1; P.hpMul *= k.hpMul || 1;
    P.heal *= k.heal || 1; P.gold *= k.gold || 1; P.goldPull *= k.goldPull || 1;
    if (k.mana === 0) P.mana = 0; else P.mana *= k.mana || 1;
    P.bounce += k.bounce || 0; P.crit += k.crit || 0; P.hpAdd += k.hpAdd || 0;
    P.lives += k.lives || 0; P.ghost += k.ghost || 0;
    P.homing = Math.max(P.homing, k.homing || 0);
    for (const f of ['shield', 'trail', 'contact', 'close', 'invis', 'repel', 'seeAll',
      'radarEnemy', 'radarItem', 'radarWand', 'tinker', 'extraItem', 'pinpointer', 'trajectory'])
      if (k[f]) P[f] = 1;
  }
  P.maxHp = Math.max(10, Math.round((PLAYER_HP + P.hpAdd) * P.hpMul));
  return P;
}
