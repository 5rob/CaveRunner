// @ts-check
// Dev → Fire sim (owner v1.0.56): a window on a long test room of things that burn (art/firelab.js), its worn range backdrop
// (game/render/firelabdraw.js), run by the menu scene's loop (scenecanvas.js runScene, still: our own gestures). Drag
// sideways to pan along the room; Respawn: a new line-up; Fire: lights the test object nearest the window's middle. The
// page's fire knobs sit under it (devpanel.js) and act live.
import { TITLE_VW, titleCam, titleIgnite } from '../art/titlescene.js';
import { labClamp, labNearest, labScene } from '../art/firelab.js';
import { labBack } from '../game/render/firelabdraw.js';
import { h, useEffect, useRef } from './h.js';
import { runScene } from './scenecanvas.js';

/** @typedef {{ S: import('../art/titlescene.js').TitleScene | null, pts: import('../art/firelab.js').LabPt[], again: boolean, seed: number, x: number }} SimState */

export function FireSim() {
  /** @type {{ current: HTMLCanvasElement | null }} */
  const cv = useRef(null);
  /** @type {{ current: SimState }} */
  const st = useRef({ S: null, pts: [], again: false, seed: 1 + Math.floor(Math.random() * 1e6), x: 0 });
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const k = () => c.clientWidth / TITLE_VW;
    const stop = runScene(c, {
      size: () => ({ w: c.clientWidth, hh: c.clientHeight }),
      make: (w, hh) => {
        const vh = hh * TITLE_VW / w, m = labScene(vh, st.current.seed);
        m.S.back = labBack; m.S.scroll = labClamp(st.current.x);
        st.current.S = m.S; st.current.pts = m.pts;
        if (window.__TEST) window.__firesim = st.current;     // the browser suites' and shot scripts' reach
        return { S: m.S, C: titleCam(vh / 2, vh), warm: 0 };
      },
      next: () => { if (!st.current.again) return false; st.current.again = false; return true; },
      still: true,
    });
    // one finger sideways pans along the room (the panel scrolls up and down: touch-action pan-y)
    /** @type {number | null} */
    let px = null;
    /** @param {PointerEvent} e */
    const down = e => { px = e.clientX; c.setPointerCapture(e.pointerId); };
    /** @param {PointerEvent} e */
    const move = e => {
      const S = st.current.S;
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
  const fire = () => {
    const { S, pts } = st.current;
    if (!S || !pts.length) return;
    const p = labNearest(pts, S.scroll + TITLE_VW / 2);
    titleIgnite(S, p.x - S.scroll, p.y, 6, 1);
  };
  /** @param {string} cls @param {string} label @param {() => void} fn */
  const btn = (cls, label, fn) => h('button', { className: 'dbg ' + cls, onPointerDown: (/** @type {PointerEvent} */ e) => { e.preventDefault(); fn(); } }, label);
  return h('div', { className: 'firesim' },
    h('canvas', { ref: cv, className: 'firesimcvs' }),
    h('div', { className: 'firesimbtns' }, btn('firerespawn', 'Respawn', respawn), btn('firego', 'Fire', fire)),
    h('p', { className: 'devnote' }, 'Drag the window sideways to move along the room. Fire lights the thing nearest the middle.'));
}
