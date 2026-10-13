// @ts-check
// The gun panel's firing window (owner: "matching the real game 1 for 1"): a small room of the level's own scene
// (art/titlescene.js, a fixed strip: opts.hub with no hub data), so a gun fires, flies, hits, blasts, trails and lights
// in it by the very code a level runs (stepRunnerGun, stepShots, the scene's looks), at the level's speed and scale.
// One player stands at the left on a flat floor and fires the gun at a creature that takes the hits and never dies (a
// hologram of you (round 2: as the old window's; the scene holds an unseen creature for the hits, PV_HOLO_X units off the right
// wall, and the panel paints the hologram over it, flashing on hits: pv.hitT); a rock wall on the right; no creatures come,
// nothing scrolls. Blasts eat the floor and walls and they grow back cell by cell (pvRegrow, DEV.autoPvRegrow cells a second). What a gun can't do in a level (art/scenegun.js GUN_TODO) does nothing here too.
// Its step also keeps the window's numbers: the damage per second, its graph, and the slots each pull fired (pvLit).
// Pure: the logic suites call it (tests/logic/auto-preview.test.js); ui/auto/AutoScreen.js GunPanel runs it.

import { PH, PW } from '../core/consts.js';
import { enemyFor } from '../data/creatures.js';
import { MODS } from '../spells/mods.js';
import { DEV } from '../dev/knobs.js';
import { gunPassives } from '../spells/cast.js';
import { resetGun } from '../spells/guns.js';
import { TCELL, TM, stepRunnerGun, titleFoeAt, titleScene } from '../art/titlescene.js';

export const PV_HP = 1e9;        // the target's health (it never goes down: topped up each step)
export const PV_DPS_S = 2;       // the damage per second over the last this many seconds
export const PV_GRAPH_DT = 0.1;  // the graph's bucket (s; the old window's GF_GRAPH_DT)
export const PV_GRAPH_N = 100;   // and how many it keeps (10 s; it carries on over gun changes to compare)
export const PV_HOLO_X = 30;     // the hologram's middle this far in from the right wall (room for orbit shots round it)
export const PV_HIT_T = 0.3;     // a hit lights the hologram this long (s)

/** @typedef {{ dx: number, dy: number, foe?: Enemy, cells: Uint8Array, hitT: number, regrow: number, log: number[][], dealt: number,
 *   graph: number[], gmark: number[], mark: boolean, graphT: number, dps: number, pulls: number, lit: { slots: number[], pull: number, t: number } | null, fy: number }} PreviewState */

// a copy of the player for the window: his perks, all his guns copied fresh (the window never spends the real gun's mana or
// moves its place in the list), the one shown active
/** @param {RunPlayer} pl @param {number} gi @returns {RunPlayer} */
export function previewPlayer(pl, gi) {
  const guns = pl.guns.map(g => (g ? resetGun(Object.assign({}, g, { slots: g.slots.slice(), mana: undefined, pulls: 0, skipRech: false })) : g));
  return Object.assign({}, pl, { guns, active: gi, alive: true });
}

// The window's scene: vw × vh world units (the level's scale: the caller works them out from its canvas), player pl's gun gi
/** @param {number} vw @param {number} vh @param {RunPlayer} pl @param {number} gi @param {number} [seed] @returns {import('../art/titlescene.js').TitleScene} */
export function previewScene(vw, vh, pl, gi, seed = 7) {
  const nc = Math.max(8, Math.ceil(vw / TCELL)), fr = Math.max(4, Math.floor(vh / TCELL) - 2), fy = fr * TCELL;
  // rock below the floor, a one-cell roof, a cell of wall at the left and two at the right (inside the view)
  const wallC = Math.max(4, Math.floor(vw / TCELL) - 2);
  /** @param {number} c @param {number} r */
  const cell = (c, r) => (r >= fr || r < 1 || c < 1 || c >= wallC ? TM.ROCK : TM.AIR);
  /** @type {PreviewState} */
  const pv = { dx: 0, dy: 0, cells: new Uint8Array(0), hitT: 0, regrow: 0, log: [], dealt: 0,
    graph: [], gmark: [], mark: false, graphT: 0, dps: 0, pulls: 0, lit: null, fy };
  const S = titleScene(vh, seed, TCELL, fy, { runners: 1, hub: { w: nc, cell, step: previewStep, pv }, team: [previewPlayer(pl, gi)] });
  const r = S.runners[0];
  r.x = TCELL + 4; r.y = fy - PH; r.vx = r.vy = 0; r.ground = true; r.stand = true; r.face = 1; r.ang = 0; r.flame = 0;
  // the hologram stands on the floor, a full-size you (PW x PH); its creature (a rat: no glow of its own, never drawn) as big
  pv.dx = Math.max(r.x + PW + 30, wallC * TCELL - PV_HOLO_X); pv.dy = fy - PH / 2;
  pv.foe = titleFoeAt(S, Object.assign({}, enemyFor('rotta', 1), { hp: PV_HP, r: (PW + PH) / 4 }), pv.dx);
  pinFoe(pv);
  pv.cells = S.cells.slice();
  return S;
}
/** @param {import('../art/titlescene.js').TitleScene} S @returns {PreviewState | null} */
export const previewState = S => (S.hub && S.hub.pv) || null;

/** @param {PreviewState} pv */
function pinFoe(pv) {
  const f = pv.foe;
  if (!f) return;
  f.x = f.hx = pv.dx; f.y = f.ty = f.hy = pv.dy; f.hp = f.hpMax = PV_HP; f.aggro = false;
}

// The slots one pull fired (as the old Bag's fireSimStep lit them): from where the list stood (`start`, in `order`) to where it
// is now (to the end when it ran out), trailing modifiers that modified nothing left off
/** @param {Gun} g @param {number[]} order @param {number} start @returns {number[]} */
export function pvLit(g, order, start) {
  const end = (g.idx || 0) <= start ? order.length : g.idx || 0, slots = [];
  for (let i = start; i < end; i++) if (g.slots[order[i]]) slots.push(order[i]);
  /** @param {string} id */
  const casts = id => !!MODS[id] && (MODS[id].kind === 'shot' || MODS[id].kind === 'static');
  while (slots.length && !casts(g.slots[slots[slots.length - 1]])) slots.pop();
  return slots;
}

// One step (titleStep calls it after its own, as the hub's): the player fires as in a level, the target pinned and topped up,
// the numbers kept, the room mended
/** @param {import('../art/titlescene.js').TitleScene} S @param {number} dt */
export function previewStep(S, dt) {
  const pv = previewState(S), r = S.runners[0], pl = S.team && S.team[0];
  if (!pv || !r || !pl) return;
  if (pv.foe && !S.foes.includes(pv.foe)) S.foes.push(pv.foe);
  pv.hitT = Math.max(0, pv.hitT - dt);
  if (pv.foe && pv.foe.hp < PV_HP) pv.hitT = PV_HIT_T;    // hit since the last step: the hologram flashes
  pinFoe(pv);
  r.x = TCELL + 4; r.y = pv.fy - PH; r.vx = r.vy = 0; r.ground = true;
  const g = pl.guns[pl.active];
  if (g) {
    const order = (g.order || []).slice(), start = g.idx || 0, n0 = g.pulls || 0;
    stepRunnerGun(S, r, dt);
    if ((g.pulls || 0) > n0) { pv.lit = { slots: pvLit(g, order, start), pull: pv.pulls, t: Math.max(0.1, Math.min(g.delayMax || 0, 0.45)) }; pv.pulls++; }
    else if (pv.lit && (pv.lit.t -= dt) <= 0) pv.lit = null;
  }
  // the damage per second (the runner's damage dealt, as the level's meters read it) and its graph
  const d = (r.dealt || 0) - pv.dealt;
  pv.dealt = r.dealt || 0;
  if (d > 0) pv.log.push([S.t, d]);
  pv.log = pv.log.filter(e => e[0] > S.t - PV_DPS_S);
  pv.dps = pv.log.reduce((a, e) => a + e[1], 0) / PV_DPS_S;
  if ((pv.graphT += dt) >= PV_GRAPH_DT) { pv.graphT = 0; pv.graph.push(pv.dps); pv.gmark.push(pv.mark ? 1 : 0); pv.mark = false;
    if (pv.graph.length > PV_GRAPH_N) { pv.graph.shift(); pv.gmark.shift(); } }
  // the floor and walls grow back where blasts ate them
  pv.regrow += DEV.autoPvRegrow * dt;
  const n = Math.floor(pv.regrow);
  if (n > 0) { pv.regrow -= n; pvRegrow(S, pv, n); }
}

// Up to n cells of the room grow back (owner, round 2: slowly, pixel by pixel): each a missing cell touching rock that's whole
// (so it grows in from the edges of the hole), picked at random by the scene's own random numbers; returns how many grew
/** @param {import('../art/titlescene.js').TitleScene} S @param {PreviewState} pv @param {number} n @returns {number} */
export function pvRegrow(S, pv, n) {
  const C = S.cells, W = pv.cells, rows = S.rows, N = C.length;
  /** @param {number} j */
  const ok = j => j >= 0 && j < N && C[j] !== TM.AIR && C[j] === W[j];
  /** @type {number[]} */
  const can = [];
  for (let i = 0; i < N; i++) {
    if (C[i] === W[i]) continue;
    const r = i % rows;
    if (W[i] === TM.AIR || (r > 0 && ok(i - 1)) || (r < rows - 1 && ok(i + 1)) || ok(i - rows) || ok(i + rows)) can.push(i);
  }
  let k = 0;
  for (; k < n && can.length; k++) { const j = Math.floor(S.rnd() * can.length), i = can[j]; can[j] = can[can.length - 1]; can.pop(); C[i] = W[i]; S.burning.delete(i); }
  if (k) S.dirtyAll = true;
  return k;
}

// the old Bag's fire sim (spells/bagsim.js FireSim), as the panel's stat bars read it (fireSimGauges), filled from the window's gun
/** @param {import('../spells/bagsim.js').FireSim} sim @param {Gun} g */
export function pvSim(sim, g) {
  sim.max = g.manaMax + gunPassives(g).manaMax;
  sim.mana = g.mana == null ? sim.max : g.mana;
  sim.delayT = g.delayT || 0; sim.delayMax = g.delayMax || 0; sim.rechT = g.rechT || 0; sim.rechLen = g.rechLen || 0;
}
