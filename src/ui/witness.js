// @ts-check
// Witness: the death replay's screen (the controls; the Game draws the scene): the live death's
// replay or a saved one (ui/clips.js), with Save (keep it in the Bag's Witness tab) and Video.

import { clamp } from '../core/util.js';
import { exportClip } from './clips.js';
import { h, useEffect, useRef, useState } from './h.js';

// ---- the death replay's screen ("Witness yourself"): the recorded scene fills the view — drag
// to pan, pinch (or the wheel) to zoom — with a scrub bar and the controls along the bottom.
// The Game draws it (drawReplay); this only moves input.current.replay's clock and camera.
export const RP_SPEEDS = [0.25, 0.5, 1, 2];
/** @param {{ input: { current: GameInput }, close: () => void, saved?: ClipMeta | null }} props */
export function Witness({ input, close, saved }) {
  const V = input.current.replay, W = V.clip;
  const [, bump] = useState(0);
  const [keep, setKeep] = useState(W.id ? 'saved' : '');       // '', 'saving', 'saved', 'failed'
  const [exp, setExp] = useState(null);                         // the export under way: { phase, frac }
  const [msg, setMsg] = useState('');
  const ctl = useRef({ cancelled: false });
  const redo = () => bump(n => n + 1);
  const scrub = useRef(null), pts = useRef(new Map()), pinch = useRef(null), dragging = useRef(false);
  useEffect(() => {                  // the clock and the scrub bar follow the playback
    let raf, last = '';
    const tick = () => {
      const sig = Math.round(V.t * 20) + (V.playing ? 'p' : '');
      if (sig !== last) { last = sig; redo(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const span = Math.max(0.01, W.t1 - W.t0);
  const seek = e => {
    const r = scrub.current.getBoundingClientRect();
    V.t = W.t0 + clamp((e.clientX - r.left) / r.width, 0, 1) * span;
    V.playing = false; redo();
  };
  // the scene: one finger (or the mouse) drags the camera, two pinch-zoom and drag
  const down = e => {
    e.preventDefault();
    if (exp) return;                 // the framing holds while a video records
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = null;
  };
  const move = e => {
    const P = pts.current, q = P.get(e.pointerId);
    if (!q) return;
    const u = V.unit || 1;
    if (P.size === 1) { V.cx -= (e.clientX - q.x) / u; V.cy -= (e.clientY - q.y) / u; V.follow = false; }
    q.x = e.clientX; q.y = e.clientY;
    if (P.size >= 2) {
      const [a, b] = [...P.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, L = pinch.current;
      if (L) {
        V.zoom = clamp(V.zoom * d / L.d, 0.4, 4);
        V.cx -= (mx - L.mx) / u; V.cy -= (my - L.my) / u; V.follow = false;
      }
      pinch.current = { d, mx, my };
    }
    if (!V.follow) redo();
  };
  const up = e => { pts.current.delete(e.pointerId); pinch.current = null; };
  const tap = f => e => { e.preventDefault(); if (!exp) { f(); redo(); } };
  const save = async () => {
    if (keep === 'saving' || keep === 'saved' || !input.current.saveClip) return;
    setKeep('saving');
    const m = await input.current.saveClip(W);
    if (m) { W.id = m.id; setKeep('saved'); setMsg('Saved to the Bag’s Witness tab'); } else { setKeep('failed'); setMsg('Couldn’t save it (out of space?)'); }
  };
  const video = async () => {
    if (exp) return;
    ctl.current = { cancelled: false };
    setMsg(''); setExp({ phase: 'rec', frac: 0 });
    const r = await exportClip(V, saved ? saved.name : 'death', s => setExp(s), ctl.current);
    setExp(null); setMsg(r.msg);
  };
  const rel = V.t - W.death, frac = (V.t - W.t0) / span;
  const atEnd = V.t >= W.t1 - 1e-6;
  return h('div', { className: 'witness' },
    h('div', { className: 'wscene', onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up,
        onWheel: e => { V.zoom = clamp(V.zoom * Math.exp(-e.deltaY * 0.0015), 0.4, 4); } },
      h('div', { className: 'wtitle' }, saved ? saved.name : 'WITNESS YOURSELF'),
      msg ? h('div', { className: 'wmsg', onPointerDown: e => { e.stopPropagation(); setMsg(''); } }, msg) : null),
    h('div', { className: 'wpanel', ref: el => { if (el) V.panelH = el.getBoundingClientRect().height; } },
      h('div', { className: 'wscrub', ref: scrub,
          onPointerDown: e => { e.preventDefault(); dragging.current = true;
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} seek(e); },
          onPointerMove: e => { if (dragging.current) seek(e); },
          onPointerUp: () => { dragging.current = false; }, onPointerCancel: () => { dragging.current = false; } },
        h('div', { className: 'wtrack' }),
        h('div', { className: 'wfill', style: { width: (frac * 100) + '%' } }),
        h('div', { className: 'wdeath', title: 'The moment you died',
          style: { left: ((W.death - W.t0) / span * 100) + '%' } }),
        h('div', { className: 'wthumb', style: { left: (frac * 100) + '%' } })),
      h('div', { className: 'wrow' },
        h('button', { className: 'wfirst', 'aria-label': 'Back to the start',
          onPointerDown: tap(() => { V.t = W.t0; V.playing = true; }) }, '⏮'),
        h('button', { className: 'wplay', 'aria-label': V.playing ? 'Pause' : 'Play',
          onPointerDown: tap(() => { if (!V.playing && atEnd) V.t = W.t0; V.playing = !V.playing; }) },
          V.playing ? '⏸' : '▶'),
        RP_SPEEDS.map(sp => h('button', { key: sp, className: 'wspeed' + (V.speed === sp ? ' on' : ''),
          onPointerDown: tap(() => { V.speed = sp; }) }, (sp < 1 ? String(sp).slice(1) : sp) + '×')),
        h('span', { className: 'wtime' }, (rel < 0 ? '−' : '+') + Math.abs(rel).toFixed(1) + 's')),
      h('div', { className: 'wrow' },
        h('button', { className: 'wloop' + (V.loop ? ' on' : ''), onPointerDown: tap(() => { V.loop = !V.loop; }) }, 'Loop'),
        h('button', { className: 'wfog' + (V.fog ? ' on' : ''), onPointerDown: tap(() => { V.fog = !V.fog; }) }, 'Fog'),
        h('button', { className: 'wfollow' + (V.follow ? ' on' : ''), onPointerDown: tap(() => { V.follow = true; V.zoom = 1; }) },
          'Follow'),
        h('button', { className: 'wclose', onPointerDown: e => { e.preventDefault(); if (!exp) close(); } }, 'Close')),
      h('div', { className: 'wrow' },
        saved ? null : h('button', { className: 'wsave' + (keep === 'saved' ? ' on' : ''), onPointerDown: tap(save) },
          keep === 'saving' ? 'Saving…' : keep === 'saved' ? 'Saved ✓' : '💾 Save'),
        h('button', { className: 'wvideo', onPointerDown: tap(video) }, '🎬 Export video')),
      exp ? h('div', { className: 'wexp' },
        h('span', null, (exp.phase === 'rec' ? 'Recording ' : exp.phase === 'convert' ? 'Converting (ffmpeg) ' : 'Saving ') +
          Math.round(exp.frac * 100) + '%'),
        h('div', { className: 'wexpbar' }, h('i', { style: { width: (exp.frac * 100) + '%' } })),
        exp.phase === 'rec' ? h('button', { className: 'wcancel', onPointerDown: e => { e.preventDefault(); ctl.current.cancelled = true; } }, 'Cancel') : null)
        : null));
}
