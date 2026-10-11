// CaveRunner Auto's perks that act in a level (stage: perks): Permanent Shield, Angry Ghost, Pinpointer.
// Pure: the scene (art/titlescene.js) steps them, game/render/titledraw.js draws them.
//   shield: a ready shield soaks one hit whole (levelHurt), then comes back after DEV.autoShieldT seconds
//           (r.shieldT counts it down; r.shieldHit is when it broke, for the flash)
//   ghost:  a spirit trailing the player (r.ghost, screen coords) fires a weak shot at the nearest creature
//           (DEV.autoGhostDmg / autoGhostCd / autoGhostRange): weaker than the old game's (owner: "needs nerfing")
//   pinpointer: look only, a red laser where he's aiming
import { DEV } from '../dev/knobs.js';
import { perkBag } from '../data/perks.js';

// a player's fitted perks folded (each once), as art/scenegun.js perkDmg
/** @param {{ perks?: (BagItem | null)[] } | null | undefined} pl */
export const perksOf = pl => perkBag([...new Set(((pl && pl.perks) || []).map(it => it && it.id).filter(Boolean))].map(String));
/** @param {{ perks?: (BagItem | null)[] } | null | undefined} pl @param {'shield' | 'ghost' | 'pinpointer'} flag */
export const perkOn = (pl, flag) => !!pl && !!perksOf(pl)[flag];

// is his shield up? (fitted, and not recharging)
/** @param {{ shieldT?: number }} r @param {{ perks?: (BagItem | null)[] } | null | undefined} pl */
export const shieldUp = (r, pl) => perkOn(pl, 'shield') && !((r.shieldT || 0) > 0);

// a hit on him: true if his shield soaked it (it breaks, the recharge starts)
/** @param {{ shieldT?: number, shieldHit?: number }} r @param {{ perks?: (BagItem | null)[] } | null | undefined} pl @param {number} t the scene's time */
export function shieldSoak(r, pl, t) {
  if (!shieldUp(r, pl)) return false;
  r.shieldT = DEV.autoShieldT; r.shieldHit = t;
  return true;
}

// one step of the shield's recharge
/** @param {{ shieldT?: number }} r @param {number} dt */
export function shieldTick(r, dt) {
  if ((r.shieldT || 0) > 0) r.shieldT = Math.max(0, (r.shieldT || 0) - dt);
}

// where the ghost floats: behind his shoulder, bobbing
/** @param {{ x: number, y: number, face: number }} r @param {number} pw */
export const ghostHome = (r, pw) => ({ x: r.x + pw / 2 - r.face * 14, y: r.y - 6 });

// the creature the ghost shoots at: the nearest alive within range (foes in world x, the ghost on screen)
/** @template {{ x: number, ty: number, hp: number }} F @param {{ x: number, y: number }} g @param {F[]} foes @param {number} scroll @param {number} range @returns {F | null} */
export function ghostTarget(g, foes, scroll, range) {
  let best = null, bd = range;
  for (const f of foes) {
    const d = Math.hypot(f.x - scroll - g.x, f.ty - g.y);
    if (f.hp > 0 && d < bd) { bd = d; best = f; }
  }
  return best;
}
