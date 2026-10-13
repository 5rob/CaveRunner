// @ts-check
// The play area's FPS graph (v1.0.79, the owner's performance watch): frames counted in FPS_DT buckets, the last
// FPS_N kept (frames per second each). Pure: auto-fps.test.js. Drawn by ui/auto/AutoScreen.js (fpsDraw).

export const FPS_DT = 0.25;   // one bucket (s)
export const FPS_N = 60;      // how many kept (15 s)

/** @typedef {{ t0: number, n: number, graph: number[] }} FpsMeter */

/** @returns {FpsMeter} */
export const fpsNew = () => ({ t0: -1, n: 0, graph: [] });
// a frame painted at `now` (ms, performance.now()); a bucket full: its frames per second onto the graph
/** @param {FpsMeter} F @param {number} now */
export function fpsTick(F, now) {
  if (F.t0 < 0) { F.t0 = now; return; }
  F.n++;
  const el = (now - F.t0) / 1000;
  if (el < FPS_DT) return;
  F.graph.push(F.n / el);
  if (F.graph.length > FPS_N) F.graph.shift();
  F.t0 = now; F.n = 0;
}
