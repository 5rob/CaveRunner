// @ts-check
// Dev → Fire sim (owner v1.0.56): a window on a long test room of things that burn (art/firelab.js), its worn range backdrop
// (game/render/firelabdraw.js), run by the menu scene's loop (scenecanvas.js runScene, still: our own gestures). Drag
// sideways to pan along the room; Respawn: new decoration; Fire held: flame jets out of the floor (firelab.js labStep). The
// page's fire knobs sit under it (devpanel.js) and act live.
import { TITLE_VW, titleCam } from '../art/titlescene.js';
import { labClamp, labScene, labStep } from '../art/firelab.js';
import { labBack } from '../game/render/firelabdraw.js';
import { h, useEffect, useRef } from './h.js';
import { runScene } from './scenecanvas.js';

/** @typedef {{ L: import('../art/firelab.js').Lab | null, again: boolean, seed: number, x: number, hold: boolean }} SimState */

export function FireSim() {
  /** @type {{ current: HTMLCanvasElement | null }} */
  const cv = useRef(null);
  /** @type {{ current: SimState }} */
  const st = useRef({ L: null, again: false, seed: 1 + Math.floor(Math.random() * 1e6), x: 0, hold: false });
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const k = () => c.clientWidth / TITLE_VW;
    const stop = runScene(c, {
      size: () => ({ w: c.clientWidth, hh: c.clientHeight }),
      make: (w, hh) => {
        const vh = hh * TITLE_VW / w, m = labScene(vh, st.current.seed);
        m.S.back = labBack; m.S.scroll = labClamp(st.current.x);
        st.current.L = m;
        if (window.__TEST) window.__firesim = st.current;     // the browser suites' and shot scripts' reach
        return { S: m.S, C: titleCam(vh / 2, vh), warm: 0 };
      },
      next: () => { if (!st.current.again) return false; st.current.again = false; return true; },
      step: (_S, dt) => { if (st.current.L) labStep(st.current.L, dt, st.current.hold); },
      still: true,
    });
    // one finger sideways pans along the room (the panel scrolls up and down: touch-action pan-y)
    /** @type {number | null} */
    let px = null;
    /** @param {PointerEvent} e */
    const down = e => { px = e.clientX; c.setPointerCapture(e.pointerId); };
    /** @param {PointerEvent} e */
    const move = e => {
      const S = st.current.L && st.current.L.S;
      if (px == null || !S) return;
      const was = S.scroll;
      S.scroll = labClamp(S.scroll - (e.clientX - px) / k());
      px = e.clientX; st.current.x = S.scroll;
      for (const p of S.parts) p.x -= S.scroll - was;           // the flames and smoke (screen x) stay where they were in the room
    };
    const up = () => { px = null; };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    return () => {
      stop();
      c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up);
    };
  }, []);
  const respawn = () => { st.current.seed = 1 + Math.floor(Math.random() * 1e6); st.current.again = true; };
  // Fire: held, jets out of the floor till it's let go (anywhere: the finger may slide off the button)
  const fireOn = () => {
    st.current.hold = true;
    const off = () => { st.current.hold = false; removeEventListener('pointerup', off); removeEventListener('pointercancel', off); };
    addEventListener('pointerup', off); addEventListener('pointercancel', off);
  };
  /** @param {string} cls @param {string} label @param {() => void} fn */
  const btn = (cls, label, fn) => h('button', { className: 'dbg ' + cls, onPointerDown: (/** @type {PointerEvent} */ e) => { e.preventDefault(); fn(); } }, label);
  return h('div', { className: 'firesim' },
    h('canvas', { ref: cv, className: 'firesimcvs' }),
    h('div', { className: 'firesimbtns' }, btn('firerespawn', 'Respawn', respawn), btn('firego', 'Hold for fire', fireOn)),
    h('p', { className: 'devnote' }, 'Drag the window sideways to move along the room: vines, webs, timber, moss, grass. Hold Fire: flame jets out of the floor.'));
}
