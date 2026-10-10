// @ts-check
// A death in CaveRunner Auto's level (feedback round 2: "port from old version the ragdoll after being killed"). Pure.
// A fallen player becomes the old game's ragdoll (world/ragdoll.js), lying against the level's rock (titleSolid) in world
// coordinates, so it scrolls away with the cave like anything left behind. When the whole team has fallen: the scroll
// eases to a stop over DEV.autoDeathStop s, then "Tap A to Teleport back to Hub" (deathPrompt; leveldraw.js paints it).
// A (level.js levelTeleportHome → deathTeleport): the last one's helmet light blinks fast for DEV.autoTpBlink s, then a
// big blast at it, and DEV.autoTpBoomWait s later L.failed (level.js levelLost: home to the hub, the screen's `next`).

import { PW, PH } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { ragNew, ragPush, ragStep } from '../world/ragdoll.js';
import { titleSolid } from '../art/titlescene.js';

/** @typedef {import('../art/titlescene.js').TitleScene} DScene */
/** @typedef {import('../art/titlescene.js').TRunner} DRunner */
/** the level's death state (in LevelState: deadT the time all had fallen, pace0 the scroll's pace then, lastI the last to
 * fall, tpT when A was pressed, boomed once the blast has gone off)
 * @typedef {{ deadT?: number, pace0?: number, lastI?: number, tpT?: number, boomed?: boolean, failed: boolean }} DeathState */

// player r has fallen: his body goes limp where he was, moving as he was (his speed through the world)
/** @param {DScene} S @param {DRunner} r */
export function deathFall(S, r) {
  r.rag = ragNew(r.x + S.scroll, r.y, PW, r.face || 1, r.wvx || 0, r.vy || 0, S.rnd);
  r.hide = true; r.ctl = null; r.flame = 0;
}

// the bodies, a frame: against the rock, the runner's box kept on the hip (screen x) so the camera can follow one
/** @param {DScene} S @param {number} dt */
export function deathRags(S, dt) {
  /** @param {number} x @param {number} y */
  const solid = (x, y) => titleSolid(S, x - S.scroll, y);
  for (const r of S.runners) {
    if (!r.out || !r.rag) continue;
    const hip = r.rag.joints[2];
    if (hip.x - S.scroll > -120) ragStep(r.rag, dt, solid);   // (long gone off the left: left lying)
    r.hide = true;
    r.x = hip.x - S.scroll - PW / 2; r.y = hip.y - 15; r.vx = 0; r.vy = 0;
  }
}

// One frame of the team's death (level.js levelStep, every frame): the slow stop, the blink, the blast, home
/** @param {DScene} S @param {DeathState} L @param {number} dt */
export function deathStep(S, L, dt) {
  deathRags(S, dt);
  const all = S.runners.length > 0 && S.runners.every(r => r.out);
  if (!all) return false;
  if (L.deadT == null) {
    L.deadT = S.t; L.pace0 = S.pace || 0;
    let last = 0;
    S.runners.forEach((r, i) => { if ((r.outT || 0) >= (S.runners[last].outT || 0)) last = i; });
    L.lastI = last;
  }
  const u = Math.min(1, (S.t - L.deadT) / DEV.autoDeathStop);
  S.pace = (L.pace0 || 0) * (1 - u) * (1 - u);              // eased out: slowing to a stop
  const r = S.runners[L.lastI || 0];
  if (L.tpT == null) { if (r) r.lamp = false; return true; }
  const a = S.t - L.tpT, B = DEV.autoTpBlink;
  // the helmet light: faster and faster
  if (r) r.lamp = a < B && Math.floor(a * (10 + 14 * a / B)) % 2 === 0;
  if (a >= B && !L.boomed) { L.boomed = true; deathBlast(S, r); }
  if (a >= B + DEV.autoTpBoomWait) L.failed = true;
  return true;
}

// where the last one's helmet is (screen x, y), or null
/** @param {DScene} S @param {DRunner | undefined} r */
export function deathHelmet(S, r) {
  if (!r || !r.rag) return r ? { x: r.x + PW / 2, y: r.y + 5 } : null;
  const h = r.rag.joints[0];
  return { x: h.x - S.scroll, y: h.y };
}

// the big blast at his body: booms, fire, sparks, smoke, chunks, the shake and flash, the sound; the bodies thrown
/** @param {DScene} S @param {DRunner | undefined} r */
function deathBlast(S, r) {
  const h = deathHelmet(S, r);
  if (!h) return;
  const R = DEV.autoTpBoomR, rnd = S.rnd, x = h.x, y = h.y + PH * 0.3;
  S.booms.push({ x, y, r: R, t: 0, max: 0.6 }, { x: x - R * 0.3, y: y - R * 0.2, r: R * 0.6, t: 0, max: 0.45 }, { x: x + R * 0.3, y: y + R * 0.1, r: R * 0.6, t: 0, max: 0.5 });
  /** @param {number} n @param {string} col @param {number} spd @param {string} kind @param {number} life */
  const burst = (n, col, spd, kind, life) => {
    for (let i = 0; i < n && S.parts.length < 400; i++) {
      const an = rnd() * Math.PI * 2, v = spd * (0.3 + rnd() * 0.7), l = life * (0.6 + rnd() * 0.6);
      S.parts.push({ x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - (kind === 'smoke' ? 20 : 0), life: l, max: l, r: kind === 'smoke' ? 3 + rnd() * 3 : 1 + rnd() * 1.5, col, kind });
    }
  };
  burst(40, '#ffd27a', 220, 'fire', 0.7);
  burst(20, '#ffffff', 320, 'spark', 0.4);
  burst(10, '#3a3346', 50, 'smoke', 1.6);
  burst(10, r ? r.col : '#888', 160, 'chunk', 1.1);
  S.shake = Math.max(S.shake, 9); S.flash = Math.max(S.flash, 0.8);
  if (S.snd.length < 80) S.snd.push({ k: 'boom', x, y, a: R * 2 });
  for (const q of S.runners) if (q.rag) ragPush(q.rag, x + S.scroll, y, R * 1.2, 900);
}

// the prompt "Tap A to Teleport back to Hub" shows: everyone down, the scroll stopped, A not pressed yet
/** @param {DScene} S @param {DeathState} L */
export const deathPrompt = (S, L) => L.deadT != null && L.tpT == null && S.t - L.deadT >= DEV.autoDeathStop;

// A pressed: the teleport home starts (the blink) if the prompt was up. true: it took the press
/** @param {DScene} S @param {DeathState} L */
export function deathTeleport(S, L) {
  if (!deathPrompt(S, L)) return false;
  L.tpT = S.t;
  return true;
}
