// CaveRunner Auto, stage 12: a player added mid-scene (a green gem dragged onto an empty player circle: run.js
// addPlayer). His runner teleports in beside the team, hub or level, wherever they are: the screen's flash, a burst
// of sparks, lightning down onto him and the pad's arc sound. In a level he fires his own gun at once (the scene's
// S.team is the run's players, so his starter gun is already in it) and gets his meters.
import { DEV } from '../dev/knobs.js';
import { PH, PW } from '../core/consts.js';
import { titleFloor, titleRunner, zapArc } from '../art/titlescene.js';
import { HUB_W, hubState } from './hub.js';
import { meterNew } from './meters.js';
import { levelState } from './level.js';

/** player i's runner into a live scene, next to player 1 (up to 4): the runner, or null
 * @param {import('../art/titlescene.js').TitleScene} S @returns {import('../art/titlescene.js').TRunner | null} */
export function sceneAddRunner(S) {
  const i = S.runners.length, lead = S.runners[0];
  if (i >= 4 || !lead) return null;
  const H = hubState(S), L = levelState(S);
  let cx, fy;
  if (H) {
    // in the hub: his place in the line behind the leader
    cx = Math.max(10, Math.min(HUB_W - 10, H.lx - H.dir * DEV.autoHubSpace * i));
    fy = H.fy;
  } else {
    // in a level: a step behind player 1 (screen x), on the floor there
    cx = lead.x + PW / 2 - 10 - 4 * i;
    fy = titleFloor(S.scroll + cx, S);   // runners stand in screen x, the floor is the world's
  }
  const r = titleRunner(S, i, cx - PW / 2, fy - PH);
  r.mode = 'run'; r.ground = true; r.face = lead.face; r.ang = lead.ang;
  if (H) { r.stand = true; H.arrived[i] = true; }
  if (L) {
    L.arrived[i] = true;
    L.meters[i] = { dmg: meterNew(), hp: meterNew(), dealt: 0 };
    r.retarget = 0; r.modeT = 0.6 + i * 0.5;
  }
  S.runners.push(r);
  arrive(S, cx, fy - PH / 2);
  return r;
}

// the teleport's look and sound where he lands (the pads' arrival, plus lightning from above)
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} cx @param {number} cy */
function arrive(S, cx, cy) {
  S.flash = Math.max(S.flash, 0.5);
  for (let k = 0; k < 18; k++) {
    const a = S.rnd() * Math.PI * 2, sp = 20 + S.rnd() * 60;
    S.parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.5, max: 0.5, r: 1.2,
      col: k % 3 ? '#7cc8ff' : '#e6f6ff', kind: 'spark' });
  }
  for (let k = 0; k < 3; k++) zapArc(S, cx + (S.rnd() - 0.5) * 16, cy - 40, cx + (S.rnd() - 0.5) * 6, cy + PH / 2, k ? '#7cc8ff' : '#e6f6ff');
  S.snd.push({ k: 'arc', x: cx, y: cy });
}
