// @ts-check
// The menu scene on a canvas (shared by the title, ui/title.js, and CaveRunner Auto's play area,
// ui/auto/AutoScreen.js): one requestAnimationFrame that steps, sounds and paints the scene
// (art/titlescene.js, game/render/titledraw.js, ui/titlesound.js), and the camera's gestures: one
// finger drags (not while following a player), two pinch about their middle, a tap picks a player.
// Pointer positions are taken relative to the canvas, so it works anywhere on the page.

import { SFX } from '../audio/sfx.js';
import { TITLE_VW, camAt, camClamp, camStep, camTap, titleStep } from '../art/titlescene.js';
import { titleDraw } from '../game/render/titledraw.js';
import { titleSound, titleSoundStop } from './titlesound.js';

/** @typedef {import('../art/titlescene.js').TitleScene} TitleScene */
/** @typedef {import('../art/titlescene.js').TitleCam} TitleCam */

/**
 * @typedef {{
 *   size: () => { w: number, hh: number },
 *   make: (w: number, hh: number, seed: number) => { S: TitleScene, C: TitleCam, warm?: number },
 *   over?: (ctx: CanvasRenderingContext2D, S: TitleScene, w: number, hh: number) => void,
 *   paused?: () => boolean,
 * }} SceneOpts
 */

// Start the scene on canvas c; returns the stop function (for a useEffect's cleanup).
// size: the canvas's css size now; make: a new scene and camera for that size (called again on a resize; warm: how
// many 1/30 s steps it opens on, default 40; the hub's teleport-in opens on 0);
// over: paints on top (the title's words); paused: true holds the scene (still painted).
/** @param {HTMLCanvasElement} c @param {SceneOpts} o @returns {() => void} */
export function runScene(c, o) {
  const ctx = c.getContext('2d');
  /** @type {TitleScene | null} */
  let S = null;
  /** @type {TitleCam | null} */
  let C = null;
  let raf = 0, last = performance.now(), cw = 0, chh = 0;
  const loops = {};
  SFX.unlock();                                // the app plays at once; a browser waits for the first tap
  const seed = window.__TEST ? window.__TITLE_SEED || 7 : 1 + Math.floor(Math.random() * 1e6);
  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dpr = Math.min(3, window.devicePixelRatio || 1), { w, hh } = o.size();
    if (w < 1 || hh < 1) return;
    if (w !== cw || hh !== chh || !S || !C) {
      cw = w; chh = hh;
      c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr);
      const m = o.make(w, hh, seed);
      S = m.S; C = m.C;
      if (window.__TEST) window.__title = { S, C };    // the browser suites' reach
      for (let i = 0; i < (m.warm ?? 40); i++) titleStep(S, 1 / 30);     // open on the action, not an empty cave
    }
    const now = performance.now(), dt = (now - last) / 1000;
    last = now;
    if (!(o.paused && o.paused())) {
      titleStep(S, dt);
      camStep(C, S, Math.min(dt, 0.1));
      titleSound(S, C, loops, Math.min(dt, 0.1));
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    titleDraw(ctx, S, w, hh, C);
    if (o.over) o.over(ctx, S, w, hh);
    c.dataset.kills = String(S.kills);
    c.dataset.t = S.t.toFixed(2);
    c.dataset.cam = [C.z.toFixed(2), C.x.toFixed(1), C.y.toFixed(1), C.lock].join(' ');
  };
  raf = requestAnimationFrame(frame);
  /** @type {Map<number, { x: number, y: number, x0: number, y0: number, t: number }>} */
  const P = new Map();
  /** @type {{ d: number, z: number, at: { x: number, y: number } } | null} */
  let pinch = null;
  let moved = false;
  const sk = () => cw / TITLE_VW;                                  // css px per screen unit
  /** @param {PointerEvent} e */
  const at = e => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  /** @param {PointerEvent} e */
  const down = e => {
    e.preventDefault();
    SFX.unlock();
    const q = at(e);
    P.set(e.pointerId, { x: q.x, y: q.y, x0: q.x, y0: q.y, t: performance.now() });
    if (P.size === 1) moved = false;
    if (P.size === 2 && C) {
      const [a, b] = [...P.values()], mx = (a.x + b.x) / 2 / sk(), my = (a.y + b.y) / 2 / sk();
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: C.z, at: camAt(C, mx, my) };
      moved = true;
    }
  };
  /** @param {PointerEvent} e */
  const move = e => {
    const p = P.get(e.pointerId);
    if (!p || !C) return;
    const q = at(e), dx = q.x - p.x, dy = q.y - p.y;
    p.x = q.x; p.y = q.y;
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 10) moved = true;
    if (pinch && P.size >= 2) {
      const [a, b] = [...P.values()], mx = (a.x + b.x) / 2 / sk(), my = (a.y + b.y) / 2 / sk();
      C.z = pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d; C.zt = 0;
      camClamp(C);
      if (C.lock < 0) { C.x = pinch.at.x - (mx - TITLE_VW / 2) / C.z; C.y = pinch.at.y - (my - C.ay) / C.z; }
      camClamp(C);
    } else if (P.size === 1 && moved && C.lock < 0) {
      C.x -= dx / sk() / C.z; C.y -= dy / sk() / C.z;
      camClamp(C);
    }
  };
  /** @param {PointerEvent} e */
  const up = e => {
    const p = P.get(e.pointerId);
    P.delete(e.pointerId);
    if (P.size < 2) pinch = null;
    if (p && !moved && !P.size && C && S && performance.now() - p.t < 400) {
      const q = camAt(C, p.x / sk(), p.y / sk());
      const was = C.lock;
      camTap(C, S, q.x, q.y, 16 / sk());
      if (C.lock !== was) SFX.fx(C.lock < 0 ? 'close' : 'open');
    }
  };
  c.addEventListener('pointerdown', down);
  c.addEventListener('pointermove', move);
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', up);
  return () => {
    cancelAnimationFrame(raf);
    titleSoundStop(loops);
    c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move);
    c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up);
  };
}
