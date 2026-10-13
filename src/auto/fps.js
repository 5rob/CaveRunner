// @ts-check
// The play area's performance graphs (v1.0.79, the owner's performance watch; Dev mode only): frames counted in FPS_DT
// buckets, the last FPS_N kept per graph. Each bucket: frames per second, the slowest frame (ms), the scene's step and
// draw (ms, averaged), and how many shots, particles, creatures and burning cells there were (the most in the bucket).
// Pure: auto-fps.test.js. Drawn by ui/auto/AutoScreen.js (perfDraw); the step and draw times come from ui/scenecanvas.js.

export const FPS_DT = 0.25;   // one bucket (s)
export const FPS_N = 60;      // how many kept (15 s)

// the graphs, bottom up: key, label, colour, unit, how a frame's readings make a bucket ('avg', 'max'), the line's floor
// for its scale (fps: 60, so a steady 60 is a line along the top)
/** @type {{ key: string, label: string, col: string, unit: string, mode: string, floor: number }[]} */
export const PERF_ROWS = [
  { key: 'fps', label: 'fps', col: '#5ee05a', unit: '', mode: 'fps', floor: 60 },
  { key: 'worst', label: 'worst', col: '#ffc94a', unit: 'ms', mode: 'max', floor: 33 },
  { key: 'step', label: 'update', col: '#4ac3ff', unit: 'ms', mode: 'avg', floor: 8 },
  { key: 'draw', label: 'draw', col: '#b28cff', unit: 'ms', mode: 'avg', floor: 8 },
  { key: 'shots', label: 'shots', col: '#ff9a3c', unit: '', mode: 'max', floor: 10 },
  { key: 'parts', label: 'parts', col: '#ff7ad9', unit: '', mode: 'max', floor: 50 },
  { key: 'foes', label: 'foes', col: '#ff4a4a', unit: '', mode: 'max', floor: 10 },
  { key: 'burn', label: 'fire', col: '#ffe14a', unit: '', mode: 'max', floor: 50 },
];

/** @typedef {{ t0: number, last: number, n: number, acc: Record<string, number>, graphs: Record<string, number[]> }} FpsMeter */

/** @returns {FpsMeter} */
export function fpsNew() {
  /** @type {Record<string, number[]>} */
  const graphs = {};
  for (const r of PERF_ROWS) graphs[r.key] = [];
  return { t0: -1, last: -1, n: 0, acc: {}, graphs };
}
// a frame painted at `now` (ms, performance.now()) with its readings (step, draw, shots... as PERF_ROWS' keys); a bucket
// full: each graph gets its point
/** @param {FpsMeter} F @param {number} now @param {Record<string, number>} [read] */
export function fpsTick(F, now, read = {}) {
  if (F.t0 < 0) { F.t0 = F.last = now; return; }
  F.n++;
  const A = F.acc;
  read = Object.assign({}, read, { worst: now - F.last });
  F.last = now;
  for (const r of PERF_ROWS) {
    const v = read[r.key];
    if (v === undefined || r.mode === 'fps') continue;
    A[r.key] = r.mode === 'max' ? Math.max(A[r.key] || 0, v) : (A[r.key] || 0) + v;
  }
  const el = (now - F.t0) / 1000;
  if (el < FPS_DT) return;
  for (const r of PERF_ROWS) {
    const g = F.graphs[r.key];
    g.push(r.mode === 'fps' ? F.n / el : r.mode === 'avg' ? (A[r.key] || 0) / F.n : A[r.key] || 0);
    if (g.length > FPS_N) g.shift();
  }
  F.t0 = now; F.n = 0; F.acc = {};
}
