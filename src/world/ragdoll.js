// @ts-check
// The runner's corpse: a rough ragdoll. Eleven joints (head, chest, hip, two knees, two feet, two
// elbows, two hands) held together by sticks, under gravity, against the rock. Pure: the Game hands it a
// `solid(x, y)` test (game/systems/player.js corpseStep) and draws it with drawRagdoll
// (art/sprites.js). Positions are world units; the pose it starts in is the sprite's.

import { GRAVITY } from '../core/consts.js';

// the joints where the sprite has them (x from the sprite's centre, facing right; y from its top)
export const RAG_POSE = [
  [0, 5],        // 0 head (the helmet's centre)
  [0, 10],       // 1 chest (the shoulders)
  [0, 15.4],     // 2 hip
  [-1.2, 18.4],  // 3 back knee
  [-1.7, 21],    // 4 back foot
  [1.8, 18.2],   // 5 front knee
  [1.7, 21],     // 6 front foot
  [4.6, 11.6],   // 7 front hand (the gun's)
  [2.2, 12.2],   // 8 front elbow
  [-2.1, 12.4],  // 9 back elbow
  [-3.6, 11],    // 10 back hand (the torch's)
];
// the sticks between them; [0, 2] keeps the neck from folding flat. The ones from RAG_BRACE on
// are only braces: they stop the legs folding up into the chest
export const RAG_STICKS = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [1, 8], [8, 7], [1, 9], [9, 10], [0, 2], [1, 3], [1, 5]];
export const RAG_BRACE = 11;
export const RAG_SUB = 4;          // substeps a frame, so a hard push can't carry a joint through a thin wall
export const RAG_ITER = 3;         // passes over the sticks each substep
export const RAG_VMAX = 900;       // the fastest a joint may go (units/s)
export const RAG_FRICTION = 0.01;  // what's left of a joint's slide along the ground after a second of it
export const RAG_SLUMP = 1.5;      // seconds the body keeps toppling over by itself (a balanced sit would never fall)
export const RAG_DRAG = 0.4;       // what's left of a joint's speed after a second in the air (it settles)

/** @typedef {{ x: number, y: number, vx: number, vy: number, ox: number, oy: number, g: number }} RagJoint */
/** @typedef {{ face: number, joints: RagJoint[], len: number[], rest: number, still: boolean, tip: number, age: number }} Ragdoll */

// A ragdoll in the sprite's pose at (x, y) (the runner box's top-left, w wide), moving at
// (vx, vy). It tips over a little on its own, and a hard shove sets it tumbling that way.
/** @param {number} x @param {number} y @param {number} w @param {number} face @param {number} vx @param {number} vy @param {() => number} [rnd] @returns {Ragdoll} */
export function ragNew(x, y, w, face, vx, vy, rnd) {
  rnd = rnd || Math.random;
  const cx = x + w / 2, sp = Math.hypot(vx, vy);
  const joints = RAG_POSE.map(([px, py], i) => {
    // the top goes with the shove more than the feet do, so the body turns over
    const up = 1 - py / 22;
    const tipX = (rnd() - 0.5) * 50 - face * 25;
    return { x: cx + px * face, y: y + py, vx: vx * (0.85 + 0.4 * up) + tipX * up + (i === 7 || i === 10 ? (rnd() - 0.5) * 80 : 0),
      vy: vy - (sp > 250 ? 60 * up : 0), ox: 0, oy: 0, g: 0 };
  });
  const len = RAG_STICKS.map(([a, b]) => Math.hypot(joints[a].x - joints[b].x, joints[a].y - joints[b].y));
  // which way it goes limp: mostly backward, the way the jetpack pulls
  const tip = rnd() < 0.75 ? -(face || 1) : face || 1;
  return { face: face || 1, joints, len, rest: 0, still: false, tip, age: 0 };
}

/** @param {RagJoint} j @param {(x: number, y: number) => boolean} solid @param {number} fr what's left of a slide along the floor */
function collide(j, solid, fr) {
  if (!solid(j.x, j.y)) return;
  if (!solid(j.ox, j.y)) { j.x = j.ox; return; }                       // a wall
  if (!solid(j.x, j.oy)) {                                             // the floor (or the roof)
    if (j.y > j.oy) j.g = 1;
    j.y = j.oy; j.x = j.ox + (j.x - j.ox) * fr;
    return;
  }
  j.x = j.ox; j.y = j.oy;
  if (solid(j.x, j.y)) j.y -= 1;                                       // buried (the rock moved): work it out upward
}

// One frame of the corpse. Once it has lain still for a second it sleeps, until pushed.
/** @param {Ragdoll} R @param {number} dt @param {(x: number, y: number) => boolean} solid */
export function ragStep(R, dt, solid) {
  if (R.still || dt <= 0) return;
  const h = dt / RAG_SUB, J = R.joints, fr = Math.pow(RAG_FRICTION, h), drag = Math.pow(RAG_DRAG, h);
  R.age += dt;
  const slump = R.age < RAG_SLUMP ? R.tip * 420 * h : 0;
  for (let s = 0; s < RAG_SUB; s++) {
    J[0].vx += slump; J[1].vx += slump * 0.5; J[2].vx -= slump * 0.75;   // a turn, not a slide
    for (const j of J) {
      j.ox = j.x; j.oy = j.y; j.g = 0;
      j.vy += GRAVITY * h; j.vx *= drag; j.vy *= drag;
      const v = Math.hypot(j.vx, j.vy);
      if (v > RAG_VMAX) { j.vx *= RAG_VMAX / v; j.vy *= RAG_VMAX / v; }
      j.x += j.vx * h; j.y += j.vy * h;
      collide(j, solid, fr);
    }
    for (let it = 0; it < RAG_ITER; it++) {
      for (let k = 0; k < RAG_STICKS.length; k++) {
        const a = J[RAG_STICKS[k][0]], b = J[RAG_STICKS[k][1]];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
        // the cross-braces ([1, 3], [1, 5]) only stop the legs folding up into the chest
        if (k >= RAG_BRACE && d >= R.len[k]) continue;
        const f = (d - R.len[k]) / d * 0.5;
        a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
      }
      for (const j of J) collide(j, solid, 1);
    }
    for (const j of J) { j.vx = (j.x - j.ox) / h; j.vy = (j.y - j.oy) / h; }
  }
  let fast = 0;
  for (const j of J) fast = Math.max(fast, Math.abs(j.vx) + Math.abs(j.vy));
  R.rest = fast < 8 ? R.rest + dt : 0;
  if (R.rest > 1) { R.still = true; for (const j of J) { j.vx = 0; j.vy = 0; } }
}

// A blast at (x, y) of radius rad throws the corpse: each joint by how close it is
/** @param {Ragdoll} R @param {number} x @param {number} y @param {number} rad @param {number} [power] */
export function ragPush(R, x, y, rad, power) {
  const P = power || 500;
  let hit = false;
  for (const j of R.joints) {
    const dx = j.x - x, dy = j.y - y, d = Math.hypot(dx, dy);
    if (d >= rad) continue;
    const f = 1 - d / rad;
    j.vx += dx / (d || 1) * P * f; j.vy += dy / (d || 1) * P * f - 150 * f;
    hit = true;
  }
  if (hit) { R.still = false; R.rest = 0; }
}

// the ragdoll's middle (the hip), for the camera and everything else that follows "you"
/** @param {Ragdoll} R */
export const ragHip = R => R.joints[2];
