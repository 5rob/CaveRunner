// Dev → Bats / Glow worms: the shared slice preview (owner): a random slice of a real Coal Seams level with the enemy under work on
// it (auto/slicelab.js), run and drawn by the game's own scene loop (ui/scenecanvas.js runScene: titleStep, titleDraw: its light,
// decorations, glow layers and effects), at the game's zoom. A free camera: drag to pan (pinch to zoom, tap a player to follow);
// double-tap goes full screen and back. One auto player crosses it, then after DEV.slicePrevWait a fresh run; New slice: another.

import { TITLE_VW, camClamp, titleCam } from '../art/titlescene.js';
import { sliceFind, sliceFocus, sliceScene, sliceStep } from '../auto/slicelab.js';
import { runScene } from './scenecanvas.js';
import { h, useEffect, useRef, useState } from './h.js';

// the level's height in world units: the game's play area (the screen less the gun row and the stick), at the game's zoom
const gameVh = () => Math.max(200, Math.round(TITLE_VW * (window.innerHeight * 0.62) / Math.max(1, window.innerWidth)));

/** @param {{ kind: import('../auto/slicelab.js').SliceKind, fresh: number }} p fresh: bumped by the New slice button */
export function SlicePreview({ kind, fresh }) {
  const ref = useRef(null);
  const [full, setFull] = useState(false);
  /** @type {{ current: { P: import('../auto/slicelab.js').SliceRun | null, again: boolean, C: any } }} */
  const st = useRef({ P: null, again: false, C: null });
  useEffect(() => { st.current.P = null; st.current.again = true; }, [fresh]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const vh = gameVh();
    const stop = runScene(c, {
      size: () => ({ w: c.clientWidth, hh: c.clientHeight }),
      make: (w, hh) => {
        const o = st.current;
        if (!o.P || o.P.kind !== kind) { const f = sliceFind(kind, vh); o.P = { kind, seed: f.seed, n: f.n, t: 0, dead: 0, wait: 0, runs: 0, done: false }; }
        const S = sliceScene(o.P, vh), view = hh / (w / TITLE_VW), C = titleCam(view / 2, vh);
        C.view = view;
        // the camera starts on the slice's enemy (drag to look round)
        C.y = sliceFocus(S, kind); camClamp(C);
        o.C = C; o.again = false;
        window.__slicePrev = { S, P: o.P, C };   // (tests, tools/coalshots.js)
        return { S, C, warm: 0 };
      },
      quiet: true, keep: true,
      step: (S, dt) => {
        const o = st.current, C = o.C, view = c.clientHeight / (c.clientWidth / TITLE_VW);
        if (C && Math.abs((C.view || 0) - view) > 0.5) { C.view = view; C.ay = view / 2; camClamp(C); }   // (full screen and back)
        if (o.P && sliceStep(o.P, S, dt)) o.again = true;
      },
      next: () => st.current.again,
    });
    // double-tap: full screen and back
    let lastUp = 0, lx = 0, ly = 0;
    /** @param {PointerEvent} e */
    const up = e => {
      const now = performance.now();
      if (now - lastUp < 320 && Math.hypot(e.clientX - lx, e.clientY - ly) < 24) { setFull(f => !f); lastUp = 0; return; }
      lastUp = now; lx = e.clientX; ly = e.clientY;
    };
    c.addEventListener('pointerup', up);
    return () => { stop(); c.removeEventListener('pointerup', up); };
  }, [kind]);
  return h('div', { className: 'sliceprev' + (full ? ' full' : '') }, h('canvas', { ref, className: 'slicecv', 'data-kind': kind }));
}
