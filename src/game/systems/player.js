// You: the perk bag, your health (maxHp, and hurt: shields, extra lives, death) and which
// hand holds the torch; the jetpack's cough (sputterStep) and the dead stick (NO_INPUT).

import { SFX } from '../../audio/sfx.js';
import { COL, PH, PW } from '../../core/consts.js';
import { perkBag } from '../../data/perks.js';
import { clearSave } from '../../save/save.js';
import { burst, toast } from './particles.js';

// ---- perks ----
// Everything the perks you are carrying add up to, recomputed whenever the run's perk
// list changes and read all over step() and draw(). Neutral (all multipliers 1, all
// flags 0) until a perk is found, so a run with no perks behaves exactly as before.
export const refreshBag = (W, G) => { W.pb = perkBag(G.input.current.loadout.perks || []); };
// the true maximum health: the perk bag's answer plus the running +25 per heart room.
export const maxHp = (W, G) => W.pb.maxHp + (G.input.current.loadout.maxBonus || 0);

export function hurt(W, G, n) {
  if (W.p.dead || n <= 0) return;
  // Permanent Shield soaks a hit whole, then winds back up over a couple of seconds
  if (W.pb.shield && W.p.shieldReady) {
    W.p.shieldReady = false; W.p.shieldT = 2.5;
    burst(W, W.p.x + PW / 2, W.p.y + PH / 2, 10, '#7ad7ff');
    SFX.ui('shield');
    return;
  }
  W.p.hp = Math.max(0, W.p.hp - n);
  W.p.hitT = 0.3;
  if (W.p.hp > 0) SFX.ui('hurt');
  if (W.p.hp === 0) {
    // Extra Life gets you back up once, at full health
    const LO = G.input.current.loadout;
    if (W.pb.lives > (LO.usedLives || 0)) {
      LO.usedLives = (LO.usedLives || 0) + 1;
      W.p.hp = maxHp(W, G);
      W.p.shieldReady = true; W.p.shieldT = 0;
      burst(W, W.p.x + PW / 2, W.p.y + PH / 2, 24, '#ff5a36');
      SFX.ui('revive');
      toast(W, 'Back from the dead');
      G.input.current.notify();
      return;
    }
    W.p.dead = true; burst(W, W.p.x + PW / 2, W.p.y + PH / 2, 24, COL.player);
    W.strings.length = 0;
    SFX.ui('die');
    clearSave();                          // a death is final: reopening starts a new run
  }
}

// The torch hand: whichever one the gun is not in, so the two never sit on top of
// each other. Aiming behind you swaps hands, the same way the gun does.
export const torchHand = (W) => {
  const a = W.p.aim.show ? W.p.aim.nx : W.p.face;
  return { x: W.p.x + PW / 2 + (a >= 0 ? -5.5 : 5.5), y: W.p.y + 9 };
};

// ---- the jetpack ----
// Near the bottom of the tank the jet coughs: short random cut-outs, more often and a touch
// longer the closer the tank is to dry. `st` keeps the cut-out clock and how long the jet
// has been held on (which bends its pitch). Returns true while it's cut out; `st.start`
// is true on the frame a cut-out begins.
export const SPUTTER_FUEL = 0.25;
export function sputterStep(st, dt, fuel, on, rnd) {
  rnd = rnd || Math.random;
  st.start = false;
  if (!on) { st.cut = 0; st.gap = 0; st.onT = 0; return false; }
  st.onT = (st.onT || 0) + dt;
  st.cut = Math.max(0, (st.cut || 0) - dt);
  st.gap = Math.max(0, (st.gap || 0) - dt);                  // a catch of breath between coughs
  if (st.gap <= 0 && fuel < SPUTTER_FUEL) {
    const w = 1 - Math.max(0, fuel) / SPUTTER_FUEL;          // 0 at the line, 1 bone dry
    if (rnd() < dt * (1 + 7 * w)) {
      st.cut = 0.04 + rnd() * (0.05 + 0.08 * w);
      st.gap = st.cut + 0.1 + rnd() * 0.2;
      st.start = true;
    }
  }
  return st.cut > 0;
}
// the stick when nothing is pushing it (step() steers you with this once you are dead)
export const NO_INPUT = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };
