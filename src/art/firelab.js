// The Dev panel's Fire sim (owner v1.0.56): one long, still, lit room (LAB_W across, the view TITLE_VW of it, panned by
// S.scroll) with a random line-up of things that burn: vines hanging from the roof, arched vines, web lines, moss on the
// floor, a timber crate, a timber frame, grass. No players, no creatures, no scroll of its own. CaveRunner Auto's fire
// rules (S.lab: art/titlescene.js autoOn), so every knob on the page shows here. Each test object has an ignition point
// (its foot, or where it meets the floor): the page's Fire button lights the one nearest the view's middle (labNearest,
// titleIgnite). Respawn: a new seed.
import { DEV } from '../dev/knobs.js';
import { archCurve } from '../world/decorate.js';
import { TCELL, TITLE_VW, TM, titleRng, titleScene } from './titlescene.js';

export const LAB_W = 1500;            // the room's length (world units)
export const LAB_ROOF = 14;           // the roof's rock, down from the top
export const LAB_FLOOR = 16;          // the floor's rock, up from the bottom
const GAP = 120;                      // a test object every this far
const KINDS = ['vines', 'arch', 'webs', 'moss', 'crate', 'frame', 'grass', 'mix'];

/** @typedef {{ x: number, y: number, kind: string }} LabPt */
/** @typedef {{ x0: number, x1: number, y0: number, y1: number, m: number }} LabBox */

// the room for a view vh tall: { S, pts }
/** @param {number} vh @param {number} seed @returns {{ S: import('./titlescene.js').TitleScene, pts: LabPt[] }} */
export function labScene(vh, seed) {
  const R = titleRng(seed), fy = vh - LAB_FLOOR, roof = LAB_ROOF;
  /** @type {LabPt[]} */
  const pts = [];
  /** @type {LabBox[]} */
  const boxes = [];
  /** @type {{ x: number, len: number }[]} */
  const vines = [];
  /** @type {{ ax: number, bx: number, by: number }[]} */
  const webs = [];
  /** @type {{ ax: number, bx: number }[]} */
  const arches = [];
  // a shuffled line-up, every kind once before any twice
  /** @type {string[]} */
  let bag = [];
  for (let x = 80; x < LAB_W - 60; x += GAP) {
    if (!bag.length) { bag = KINDS.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
    const kind = bag.pop() || 'vines', room = fy - roof;
    const vine = (/** @type {number} */ vx, /** @type {number} */ len) => { vines.push({ x: vx, len }); return { x: vx, y: roof + len, kind }; };
    if (kind === 'vines') {
      const n = 3 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) vine(x - 16 + i * 8 + R() * 3, room * (0.35 + R() * 0.45));
      pts.push({ x: vines[vines.length - 1].x, y: roof + vines[vines.length - 1].len, kind });
    } else if (kind === 'arch') {
      arches.push({ ax: x - 30, bx: x + 30 });
      pts.push({ x, y: roof + room * 0.45, kind });
    } else if (kind === 'webs') {
      for (let i = 0; i < 4; i++) webs.push({ ax: x - 24 + i * 12, bx: x - 34 + i * 18 + R() * 10, by: i % 2 ? fy - 0.5 : roof + 0.5 });
      pts.push({ x: x - 24 + 9, y: (roof + fy) / 2, kind });
    } else if (kind === 'moss') {
      boxes.push({ x0: x - 30, x1: x + 30, y0: fy - 6, y1: fy + 4, m: TM.MOSS });
      pts.push({ x: x - 26, y: fy - 4, kind });
    } else if (kind === 'crate') {
      boxes.push({ x0: x - 10, x1: x + 10, y0: fy - 20, y1: fy, m: TM.WOOD });
      pts.push({ x: x - 11, y: fy - 2, kind });
    } else if (kind === 'frame') {
      boxes.push({ x0: x - 22, x1: x - 18, y0: roof, y1: fy, m: TM.BEAM }, { x0: x + 18, x1: x + 22, y0: roof, y1: fy, m: TM.BEAM },
        { x0: x - 22, x1: x + 22, y0: roof, y1: roof + 4, m: TM.BEAM });
      pts.push({ x: x - 20, y: fy - 2, kind });
    } else if (kind === 'grass') {
      boxes.push({ x0: x - 30, x1: x + 30, y0: fy - 4, y1: fy, m: TM.GRASS });
      pts.push({ x: x - 28, y: fy - 2, kind });
    } else {                           // mix: moss under hanging vines and a web line across them
      boxes.push({ x0: x - 26, x1: x + 26, y0: fy - 5, y1: fy + 3, m: TM.MOSS });
      for (let i = 0; i < 3; i++) vine(x - 14 + i * 14, room * (0.55 + R() * 0.3));
      webs.push({ ax: x - 20, bx: x + 24, by: fy - 0.5 });
      pts.push({ x: x - 22, y: fy - 3, kind });
    }
  }
  const ncol = Math.ceil((LAB_W + 160) / TCELL);
  /** @type {any} the fixed strip's cells (titleScene's hub option; the hub itself is dropped after) */
  const hub = { w: ncol, cell: (/** @type {number} */ c, /** @type {number} */ r) => {
    const x = (c + 0.5) * TCELL, y = (r + 0.5) * TCELL;
    for (const b of boxes) if (x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1) return b.m;
    return y < roof || y >= fy ? TM.ROCK : TM.AIR;
  } };
  const S = titleScene(vh, seed, roof, fy, { hub, runners: 1 });
  S.hub = undefined; S.runners = []; S.runner = null; S.foes = []; S.still = true; S.pace = 0; S.spawn = Infinity; S.lab = true;
  const ar = Math.floor((roof - 1) / TCELL);
  for (const v of vines) S.props.push({ k: 'climb', st: 'vine', ox: v.x, x: 0, y: roof, len: v.len, seed: R(), side: 1, burn: 0, ac: Math.floor(v.x / TCELL), ar });
  for (const a of arches) {
    const n = 16, p = archCurve(a.ax, roof + 1, a.bx, roof + 1, 1.6 + R() * 0.6, n);
    const arch = { k: 'climb', st: 'vine', ox: a.ax, x: 0, y: roof + 1, len: 0, seed: R(), side: 1, burn: 0, ac: Math.floor(a.ax / TCELL), ar,
      arc: p.map(q => [q.x - a.ax, q.y - roof - 1]), thick: 2, t: R() * 10, span: a.bx - a.ax };
    S.props.push(arch);
    for (let s = 0; s < 4; s++) { const k = 3 + s * 3, q = p[k]; S.props.push({ k: 'climb', st: 'vine', ox: q.x, x: 0, y: q.y, len: 8 + R() * 14, seed: R(), side: 1, burn: 0, ac: arch.ac, ar, host: arch, on: arch, u: k / n }); }
  }
  for (const w of webs) {
    const ay = roof + 0.5, down = w.by > roof + 1;
    /** @type {any} */
    const L = { ax: w.ax, ay, bx: w.bx, by: w.by, a0x: w.ax, a0y: ay, b0x: w.bx, b0y: w.by, ain: { x: w.ax, y: ay - 1.5 }, bin: { x: w.bx, y: down ? w.by + 1.5 : w.by - 1.5 }, owner: null, sag: 0 };
    L.sag = DEV.webSag * Math.abs(L.b0x - L.a0x) * (down ? 1 : 2.5);
    S.webs.push(L);
  }
  S.dirtyAll = true;
  return { S, pts };
}
// the test object nearest the view's middle (world x mid)
/** @param {LabPt[]} pts @param {number} mid */
export const labNearest = (pts, mid) => pts.reduce((b, p) => (Math.abs(p.x - mid) < Math.abs(b.x - mid) ? p : b), pts[0]);
// the pan's range: the view's left edge (S.scroll) from 0 to LAB_W - TITLE_VW
/** @param {number} x */
export const labClamp = x => Math.max(0, Math.min(LAB_W - TITLE_VW, x));
