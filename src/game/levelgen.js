// @ts-check
// The next level, made ahead of time off the main thread. makeLevel takes ~0.4s on a PC (more on a
// phone), and making it at the buy machine's flash froze the game there. So while there's no level
// (a fresh run, or just after a sale) preLevel asks a Web Worker for the floor most likely to be
// bought next, and the warp takes it (takeLevel) at the flash: nothing to make, no freeze.
//
// The worker runs this very bundle: main.js keeps its own script's text (setBundle) and, inside a
// worker, calls levelWorker() instead of mounting the page. The page's globals the bundle reads at
// load (React, ReactDOM, document, VERSION, window) get stand-ins first, as tests/load.js does. The
// Dev knobs go with each request (the worker's DEV starts at the defaults). No Worker (or it
// fails): nothing is ready, and the warp makes the level itself, as before.

import { DEV } from '../dev/knobs.js';
import { makeLevel } from '../world/level.js';

/** @type {{ src: string, worker: Worker | null, broken: boolean, n: number,
 *   pend: { id: number, floor: number, seed: number, dev: string } | null,
 *   ready: { floor: number, seed: number, dev: string, level: Level } | null, made: number }} */
export const LVLGEN = { src: '', worker: null, broken: false, n: 0, pend: null, ready: null, made: 0 };
const P = LVLGEN;              // (exported for the browser suites: made counts the worker's levels taken)

// main.js hands over its script's text, once, at load
/** @param {string} src */
export const setBundle = src => { P.src = src || ''; };

// the worker's side: make what's asked, send it back
export function levelWorker() {
  /** @type {any} */
  const S = self;
  /** @param {MessageEvent} e */
  S.onmessage = e => {
    const { id, floor, seed, dev } = e.data;
    Object.assign(DEV, JSON.parse(dev));
    const level = makeLevel(seed, floor, []);
    S.postMessage({ id, level });
  };
}

// the stand-ins the bundle needs to load inside a worker
const PRELUDE = 'var VERSION=' + JSON.stringify(typeof VERSION === 'string' ? VERSION : 'v0') + ';self.window=self;' +
  'self.React={createElement:function(){return null},createContext:function(){return {}}};' +
  'self.ReactDOM={createRoot:function(){return {render:function(){}}}};' +
  'self.document={getElementById:function(){return null},currentScript:null};\n';

function start() {
  if (P.worker || P.broken) return P.worker;
  try {
    if (!P.src || typeof Worker === 'undefined' || typeof Blob === 'undefined') throw new Error('no worker');
    const url = URL.createObjectURL(new Blob([PRELUDE + P.src], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.onmessage = e => {
      const { id, level } = e.data;
      if (!P.pend || P.pend.id !== id) return;          // asked for something else since
      P.ready = { floor: P.pend.floor, seed: P.pend.seed, dev: P.pend.dev, level };
      P.pend = null;
    };
    w.onerror = () => { P.broken = true; P.pend = null; try { w.terminate(); } catch (_) {} P.worker = null; };
    P.worker = w;
  } catch (_) { P.broken = true; }
  return P.worker;
}

// ask for floor `floor`'s level (made from `seed`), unless it's ready or on its way already
/** @param {number} floor @param {number} seed */
export function preLevel(floor, seed) {
  const dev = JSON.stringify(DEV);
  if (P.ready && P.ready.floor === floor && P.ready.dev === dev) return;
  if (P.pend && P.pend.floor === floor && P.pend.dev === dev) return;
  const w = start();
  if (!w) return;
  P.ready = null;
  P.pend = { id: ++P.n, floor, seed, dev };
  w.postMessage({ id: P.pend.id, floor, seed, dev });
}

// floor `floor`'s level if it's made (and the Dev knobs haven't changed since): it's yours, once
/** @param {number} floor @returns {{ seed: number, level: Level } | null} */
export function takeLevel(floor) {
  const r = P.ready;
  if (!r || r.floor !== floor || r.dev !== JSON.stringify(DEV)) return null;
  P.ready = null; P.made++;
  return { seed: r.seed, level: r.level };
}

// is floor `floor`'s level still being made? (the warp waits a moment for it)
/** @param {number} floor */
export const levelPending = floor => !!P.pend && P.pend.floor === floor && !P.broken;
