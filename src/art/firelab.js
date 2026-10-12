// The Dev panel's Fire sim (owner v1.0.56, laid out again v1.0.58): one long, still, lit room, the view TITLE_VW of it, panned
// by S.scroll. Each burnable kind in its own test spot LAB_SPOT wide (2/3 of the screen), LAB_GAP of bare room between so fire
// can't cross: vines (hanging as in a cave, arched ones crossing over), webs (single strands and a dense hatch), timber (the
// mine's support frames under a low roof, lanterns hanging off them), moss, grass. No players, no creatures, no scroll of
// its own; CaveRunner Auto's fire rules (S.lab: art/titlescene.js autoOn), so every knob on the page shows here. Respawn: the
// same spots, new decoration. Holding Fire (labStep): jets of flame out of the floor across the view, at random times and
// strengths (DEV.labJetGap, labJetH, labJetT), lighting what they reach (titleJet).
import { DEV } from '../dev/knobs.js';
import { archCurve } from '../world/decorate.js';
import { FRAME_W, TCELL, TITLE_VW, TM, titleJet, titleRng, titleScene, titleSurf } from './titlescene.js';

export const LAB_ROOF = 14;           // the roof's rock, down from the top
export const LAB_FLOOR = 16;          // the floor's rock, up from the bottom
export const LAB_SPOT = Math.round(TITLE_VW * 2 / 3);   // a test spot's width
export const LAB_GAP = 50;            // bare room between spots
const EDGE = 40;                      // bare room at each end
export const LAB_KINDS = ['vines', 'webs', 'timber', 'moss', 'grass'];
// each spot: its kind and left edge
export const LAB_SPOTS = LAB_KINDS.map((kind, i) => ({ kind, x0: EDGE + i * (LAB_SPOT + LAB_GAP) }));
export const LAB_W = EDGE * 2 + LAB_KINDS.length * LAB_SPOT + (LAB_KINDS.length - 1) * LAB_GAP;
const MINE_H = 46;                    // the timber spot's low roof, this far over the floor

/** @typedef {{ x: number, y: number, kind: string }} LabPt */
/** @typedef {{ x: number, h: number, t: number, max: number }} LabJet */
/** @typedef {{ S: import('./titlescene.js').TitleScene, pts: LabPt[], jets: LabJet[], next: number }} Lab */

// the room for a view vh tall
/** @param {number} vh @param {number} seed @returns {Lab} */
export function labScene(vh, seed) {
  const R = titleRng(seed), fy = vh - LAB_FLOOR, roof = LAB_ROOF, room = fy - roof, mroof = fy - MINE_H;
  /** @type {LabPt[]} */
  const pts = [];
  /** @type {((x: number, y: number) => number)[]} cell painters, the first that answers wins (-1: not mine) */
  const paint = [];
  /** @type {{ x: number, y: number, len: number, st: string }[]} */
  const vines = [];
  /** @type {{ ax: number, bx: number, ay: number, by: number }[]} */
  const webs = [];
  /** @type {{ ax: number, bx: number, slack: number }[]} */
  const arches = [];
  /** @type {{ x: number, y: number, len: number }[]} */
  const lamps = [];
  for (const { kind, x0 } of LAB_SPOTS) {
    const x1 = x0 + LAB_SPOT;
    if (kind === 'vines') {
      // a cave's hanging vines, every few units, long and short; and arched ones roof to roof, crossing over
      for (let x = x0 + 3; x < x1 - 3; x += 3 + R() * 5) if (R() < 0.65) vines.push({ x, y: roof, len: room * (0.12 + R() * 0.62), st: 'vine' });
      for (let i = 0; i < 3; i++) { const span = 50 + R() * 45, ax = x0 + 4 + R() * (LAB_SPOT - span - 8); arches.push({ ax, bx: ax + span, slack: 1.3 + R() * 0.7 }); }
      const mid = vines.filter(v => v.x >= x0 && v.x < x1).reduce((b, v) => (Math.abs(v.x - x0 - LAB_SPOT / 2) < Math.abs(b.x - x0 - LAB_SPOT / 2) ? v : b));
      pts.push({ x: mid.x, y: mid.y + mid.len - 1, kind });   // (the tip of the vine nearest its middle)
    } else if (kind === 'webs') {
      const wn = webs.length;
      // single strands on the left: roof to floor, slanting, and a couple roof to roof, sagging
      for (let i = 0; i < 4; i++) { const ax = x0 + 6 + i * 14 + R() * 6; webs.push({ ax, ay: roof + 0.5, bx: ax + (R() - 0.5) * 40, by: fy - 0.5 }); }
      for (let i = 0; i < 2; i++) { const ax = x0 + 4 + R() * 40; webs.push({ ax, ay: roof + 0.5, bx: ax + 20 + R() * 25, by: roof + 0.5 }); }
      // a dense hatch on the right: lines slanting both ways across each other, and some across them
      const hx = x0 + 70, hw = LAB_SPOT - 76;
      for (let i = 0; i < 8; i++) { const a = hx + i * hw / 8; webs.push({ ax: a, ay: roof + 0.5, bx: a + 26 + R() * 10, by: fy - 0.5 }); }
      for (let i = 0; i < 8; i++) { const a = hx + 30 + i * hw / 8; webs.push({ ax: a, ay: roof + 0.5, bx: a - 26 - R() * 10, by: fy - 0.5 }); }
      for (let i = 0; i < 4; i++) { const a = hx + R() * (hw - 30); webs.push({ ax: a, ay: roof + 0.5, bx: a + 24 + R() * 20, by: roof + 0.5 }); }
      for (const w of webs.slice(wn)) { w.ax = Math.max(x0 + 3, Math.min(x1 - 3, w.ax)); w.bx = Math.max(x0 + 3, Math.min(x1 - 3, w.bx)); }   // (all inside the spot)
      pts.push({ x: x0 + LAB_SPOT / 2, y: fy - 2, kind });
    } else if (kind === 'timber') {
      // the mine: a low roof over the spot, two support frames (posts, cap, knee braces, footings: titlescene.js genCol's), a
      // lantern hanging from each cap, one from the rock between
      paint.push((x, y) => (x >= x0 - 6 && x < x1 + 6 && y < mroof ? TM.ROCK : -1));
      for (const left of [x0 + 18, x1 - 18 - FRAME_W]) {
        paint.push((x, y) => {
          const uc = x - left, under = y - mroof, post = (uc >= 0 && uc < 4) || (uc >= FRAME_W - 4 && uc < FRAME_W);
          if (y < mroof || y >= fy) return -1;
          if (uc >= -4 && uc < FRAME_W + 4 && under < 4) return under < 2 ? TM.BEAM : TM.BEAMD;
          if (post) return (uc < 2 || (uc >= FRAME_W - 4 && uc < FRAME_W - 2)) ? TM.BEAM : TM.BEAMD;
          if ((uc >= 4 && uc <= 12 && Math.abs(under - 4 - (12 - uc)) < 1) || (uc >= FRAME_W - 12 && uc < FRAME_W - 4 && Math.abs(under - 4 - (uc - (FRAME_W - 12))) < 1)) return TM.BEAMD;
          if (y >= fy - 2 && ((uc >= -1 && uc < 5) || (uc >= FRAME_W - 5 && uc < FRAME_W + 1))) return TM.BEAMD;
          return -1;
        });
        lamps.push({ x: left + FRAME_W / 2, y: mroof + 4, len: 5 + R() * 6 });
      }
      lamps.push({ x: (x0 + x1) / 2, y: mroof, len: 8 + R() * 10 });
      pts.push({ x: x0 + 20, y: fy - 2, kind });
    } else if (kind === 'moss') {
      // a mossy floor, a mound, and moss along the roof's underside
      const mx = x0 + 30 + R() * 70, mw = 24 + R() * 16;
      paint.push((x, y) => {
        if (x < x0 || x >= x1) return -1;
        if (y >= fy - 4 && y < fy + 3) return TM.MOSS;
        const d = (x - mx) / mw, top = fy - 4 - 14 * Math.max(0, 1 - d * d);
        if (y >= top && y < fy) return y < top + 4 ? TM.MOSS : TM.ROCK;
        if (y >= roof && y < roof + 3 + 2 * Math.sin(x * 0.15)) return TM.MOSS;
        return -1;
      });
      pts.push({ x: x0 + 8, y: fy - 5, kind });
    } else {
      // grass: tufts along the floor, short and tall
      /** @type {number[]} */
      const tall = [];
      for (let c = Math.floor(x0 / TCELL); c < Math.ceil(x1 / TCELL); c++) tall.push(R() < 0.85 ? 2 + Math.floor(R() * R() * 9) : 0);
      paint.push((x, y) => {
        if (x < x0 || x >= x1 || y >= fy) return -1;
        const h = tall[Math.floor(x / TCELL) - Math.floor(x0 / TCELL)] || 0;
        return y >= fy - h * TCELL ? TM.GRASS : -1;
      });
      pts.push({ x: x0 + 6, y: fy - 2, kind });
    }
  }
  const ncol = Math.ceil((LAB_W + 160) / TCELL);
  /** @type {any} the fixed strip's cells (titleScene's hub option; the hub itself is dropped after) */
  const hub = { w: ncol, cell: (/** @type {number} */ c, /** @type {number} */ r) => {
    const x = (c + 0.5) * TCELL, y = (r + 0.5) * TCELL;
    for (const p of paint) { const m = p(x, y); if (m >= 0) return m; }
    return y < roof || y >= fy ? TM.ROCK : TM.AIR;
  } };
  const S = titleScene(vh, seed, roof, fy, { hub, runners: 1 });
  S.hub = undefined; S.runners = []; S.runner = null; S.foes = []; S.still = true; S.pace = 0; S.spawn = Infinity; S.lab = true;
  const ar = Math.floor((roof - 1) / TCELL);
  for (const v of vines) S.props.push({ k: 'climb', st: v.st, ox: v.x, x: 0, y: v.y, len: v.len, seed: R(), side: 1, burn: 0, ac: Math.floor(v.x / TCELL), ar });
  for (const a of arches) {
    const n = 16, p = archCurve(a.ax, roof + 1, a.bx, roof + 1, a.slack, n);
    const arch = { k: 'climb', st: 'vine', ox: a.ax, x: 0, y: roof + 1, len: 0, seed: R(), side: 1, burn: 0, ac: Math.floor(a.ax / TCELL), ar,
      arc: p.map(q => [q.x - a.ax, q.y - roof - 1]), thick: 2, t: R() * 10, span: a.bx - a.ax };
    S.props.push(arch);
    for (let s = 0; s < 5; s++) { const k = 2 + Math.floor(R() * (n - 3)), q = p[k]; S.props.push({ k: 'climb', st: 'vine', ox: q.x, x: 0, y: q.y, len: 6 + R() * 16, seed: R(), side: 1, burn: 0, ac: arch.ac, ar, host: arch, on: arch, u: k / n }); }
  }
  for (const w of webs) {
    const down = w.by > roof + 1;
    /** @type {any} */
    const L = { ax: w.ax, ay: w.ay, bx: w.bx, by: w.by, a0x: w.ax, a0y: w.ay, b0x: w.bx, b0y: w.by, ain: { x: w.ax, y: w.ay - 1.5 }, bin: { x: w.bx, y: down ? w.by + 1.5 : w.by - 1.5 }, owner: null, sag: 0 };
    L.sag = DEV.webSag * Math.abs(L.b0x - L.a0x) * (down ? 1 : 2.5);
    S.webs.push(L);
  }
  for (const l of lamps) S.props.push({ k: 'lamp', st: 'hanglamp', ox: l.x, x: 0, y: l.y, len: l.len, seed: R(), side: 1, burn: 0, ac: Math.floor(l.x / TCELL), ar: Math.floor((l.y - 1) / TCELL) });
  S.dirtyAll = true;
  return { S, pts, jets: [], next: 0 };
}
// the pan's range: the view's left edge (S.scroll) from 0 to LAB_W - TITLE_VW
/** @param {number} x */
export const labClamp = x => Math.max(0, Math.min(LAB_W - TITLE_VW, x));

// One frame of the jets (the page calls it after each step): Fire held, a new one now and then (DEV.labJetGap s apart on
// average) somewhere across the view, out of the floor there, up to DEV.labJetH high (each its own strength), for about
// DEV.labJetT s, swelling and dying away; let go, the ones going finish
/** @param {Lab} L @param {number} dt @param {boolean} hold */
export function labStep(L, dt, hold) {
  const S = L.S, R = S.rnd;
  if (hold && (L.next -= dt) <= 0) {
    L.next = DEV.labJetGap * (0.2 + R() * 1.6);
    L.jets.push({ x: S.scroll + 10 + R() * (TITLE_VW - 20), h: DEV.labJetH * (0.3 + R() * 0.9), t: 0, max: DEV.labJetT * (0.5 + R()) });
  }
  if (!hold) L.next = 0;
  for (const j of L.jets) {
    j.t += dt;
    const sx = j.x - S.scroll, fy = titleSurf(S, sx, S.vh - LAB_FLOOR - 30, 1);   // (under the mine's low roof, over the moss mound)
    titleJet(S, sx, fy, j.h * Math.sin(Math.PI * Math.min(1, j.t / j.max)), dt);
  }
  L.jets = L.jets.filter(j => j.t < j.max);
}
