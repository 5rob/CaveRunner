// @ts-check
// The stats meters' records (stage 5a; the meters themselves are stage 9): a ring of the last METER_SPAN seconds,
// one bucket every METER_DT. Damage dealt adds up in its bucket (meterAdd), health keeps the last reading (meterSet).
// Pure: auto-guns.test.js.

export const METER_SPAN = 30;         // seconds kept
export const METER_DT = 0.25;         // one bucket (a tick) this long

/** a ring of `span` s in `dt` s buckets, all 0 @param {number} [span] @param {number} [dt] @returns {Meter} */
export function meterNew(span = METER_SPAN, dt = METER_DT) {
  const n = Math.max(1, Math.round(span / dt));
  return { dt, n, buf: new Array(n).fill(0), i: 0, t: 0 };
}
/** add to the bucket now (damage dealt) @param {Meter} M @param {number} v */
export function meterAdd(M, v) { M.buf[M.i] += v; }
/** set the bucket now (a reading: health) @param {Meter} M @param {number} v */
export function meterSet(M, v) { M.buf[M.i] = v; }
// time on: each full tick passed moves to the next bucket, which starts at 0 (or at `carry`: a reading
// carries on until the next one)
/** @param {Meter} M @param {number} dt @param {boolean} [carry] */
export function meterStep(M, dt, carry = false) {
  M.t += dt;
  while (M.t >= M.dt) {
    M.t -= M.dt;
    const was = M.buf[M.i];
    M.i = (M.i + 1) % M.n;
    M.buf[M.i] = carry ? was : 0;
  }
}
/** the buckets, oldest first (the one now last) @param {Meter} M @returns {number[]} */
export const meterValues = M => M.buf.slice(M.i + 1).concat(M.buf.slice(0, M.i + 1));
/** everything in the ring added up (damage over the last 30 s) @param {Meter} M */
export const meterSum = M => M.buf.reduce((a, b) => a + b, 0);
