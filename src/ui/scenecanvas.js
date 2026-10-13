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
 *   next?: (S: TitleScene) => boolean,
 *   keep?: boolean,
 *   still?: boolean,
 *   step?: (S: TitleScene, dt: number) => void,
 *   quiet?: boolean,
 *   perf?: { step: number, draw: number },
 * }} SceneOpts
 */

// Start the scene on canvas c; returns the stop function (for a useEffect's cleanup).
// size: the canvas's css size now; make: a new scene and camera for that size (called again on a resize; warm: how
// many 1/30 s steps it opens on, default 40; the hub's teleport-in opens on 0);
// over: paints on top (the title's words); paused: true holds the scene (still painted); next: true after a step
// throws the scene away and calls make again (the auto screen's hub to level and back); keep: a resize only resizes
// the canvas and the scene runs on (the auto screen: a remake restarted the level whenever the play area's height shifted);
// still: no camera gestures at all, no drag, pinch or tap to follow (the auto screen, feedback round 2: one fixed view).
// perf: filled each frame with the step and the draw (ms; the auto screen's Dev performance graphs, auto/fps.js).
// quiet: no sound and no test hook (window.__title): a second scene beside the main one (the gun panel's window, auto/preview.js).
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
    const resized = w !== cw || hh !== chh;
    if (resized) { cw = w; chh = hh; c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); }
    // keep: a resize only resizes the canvas, the scene runs on (else make again for the new size)
    if (!S || !C || (resized && !o.keep)) {
      const m = o.make(w, hh, seed);
      S = m.S; C = m.C;
      if (window.__TEST && !o.quiet) window.__title = { S, C };    // the browser suites' reach
      for (let i = 0; i < (m.warm ?? 40); i++) titleStep(S, 1 / 30);     // open on the action, not an empty cave
    }
    const now = performance.now(), dt = (now - last) / 1000;
    let t1 = now;
    last = now;
    if (!(o.paused && o.paused())) {
      // (bug round 2) a slow frame (the phone in a busy level) is stepped in pieces, not capped: titleStep takes at most
      // 0.05 s, so below 20 fps the whole scene (the steered player too) used to run slow; up to 0.2 s caught up a frame
      for (let left = Math.min(dt, 0.2); left > 1e-4; left -= 0.05) titleStep(S, Math.min(left, 0.05));
      if (o.step) o.step(S, Math.min(dt, 0.2));   // (Dev's fire sim: its flame jets)
      if (C.pack) { C.view = hh / (w / TITLE_VW); C.ay = C.view / 2; }   // the tall level's view: the canvas's height now
      camStep(C, S, Math.min(dt, 0.1));
      if (o.quiet) S.snd.length = 0; else titleSound(S, C, loops, Math.min(dt, 0.1));
      t1 = performance.now();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    titleDraw(ctx, S, w, hh, C);
    if (o.perf) { o.perf.step = t1 - now; o.perf.draw = performance.now() - t1; }
    if (o.over) o.over(ctx, S, w, hh);
    c.dataset.kills = String(S.kills);
    c.dataset.t = S.t.toFixed(2);
    c.dataset.cam = [C.z.toFixed(2), C.x.toFixed(1), C.y.toFixed(1), C.lock].join(' ');
    if (o.next && o.next(S)) S = null;          // make a new one next frame (CaveRunner Auto: hub to level and back)
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
  if (!o.still) {
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
  }
  return () => {
    cancelAnimationFrame(raf);
    titleSoundStop(loops);
    c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move);
    c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up);
  };
}
