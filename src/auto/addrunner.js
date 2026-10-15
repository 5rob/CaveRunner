// CaveRunner Auto, stage 12: a player added mid-scene (a green gem dragged onto an empty player circle: run.js
// addPlayer). (owner, after v1.0.78: the hub only, ui/auto/AutoScreen.js) In the hub he comes through the enter
// teleporter, its charge and flash, wherever the team is (hub.js hubLate). In a level (tests): he teleports in beside
// the team: the screen's flash, a burst of sparks, lightning down onto him and the pad's arc sound. In a level he fires his own gun at once (the scene's
// S.team is the run's players, so his starter gun is already in it) and gets his meters.
import { PH, PW } from '../core/consts.js';
import { titleFloor, titleRunner } from '../art/titlescene.js';
import { hubLate, hubState, hubStopX } from './hub.js';
import { meterNew } from './meters.js';
import { levelState, teleFx } from './level.js';

/** player i's runner into a live scene, next to player 1 (up to 4): the runner, or null
 * @param {import('../art/titlescene.js').TitleScene} S @returns {import('../art/titlescene.js').TRunner | null} */
export function sceneAddRunner(S) {
  const i = S.runners.length, lead = S.runners[0];
  if (i >= 4 || !lead) return null;
  const H = hubState(S), L = levelState(S);
  if (H) {
    // in the hub: on the enter pad, hidden till it has charged (hubLate)
    const r = titleRunner(S, i, hubStopX('enter') - PW / 2, H.fy - PH);
    r.mode = 'run'; r.ground = true; r.stand = true; r.hide = true; r.face = 1; r.ang = lead.ang; r.flame = 0;
    S.runners.push(r);
    hubLate(S, i);
    return r;
  }
  // in a level: a step behind player 1 (screen x), on the floor there
  const cx = lead.x + PW / 2 - 10 - 4 * i;
  const fy = titleFloor(S.scroll + cx, S);   // runners stand in screen x, the floor is the world's
  const r = titleRunner(S, i, cx - PW / 2, fy - PH);
  r.mode = 'run'; r.ground = true; r.face = lead.face; r.ang = lead.ang;
  if (L) {
    L.arrived[i] = true;
    L.meters[i] = { dmg: meterNew(), hp: meterNew(), dealt: 0 };
    r.retarget = 0; r.modeT = 0.6 + i * 0.5;
  }
  S.runners.push(r);
  // (Grem Mode, owner v1.0.92) the start pad's charge where he lands first, then the flash (level.js joinStep)
  if (L && L.grem) { r.hide = true; (L.joins || (L.joins = [])).push({ i, x: S.scroll + cx, fy, t: S.t }); }
  else teleFx(S, cx, fy - PH / 2);
  return r;
}
