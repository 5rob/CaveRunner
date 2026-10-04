// @ts-check
// The map (v0.0.141): a full-screen picture of the floor as it was made (rock and decoration in
// their colours, game/systems/level-entry.js mapPicture), fitted to the screen's height, under the
// fog memory (only what you've seen shows), with your helmet where you are and the pins you've
// dropped. One finger pans, two pinch to zoom. The map button stays on top to shut it.
// The pin button (opposite the map button): tap for the pin picker (the pins used before, then +
// to type a new one: any one character, emoji too); hold to drop the chosen pin where you stand.

import {
  ARRIVAL_X, CELL, CH, CW, FH, FOG, FW, HEAL_X, SHOP_FLOOR, VEND_BUY_X, VEND_SELL_X
} from '../core/consts.js';
import { clamp } from '../core/util.js';
import { MACHINE_W, SHOPS } from '../game/systems/shops.js';
import { h, useEffect, useRef, useState } from './h.js';

export const PIN_KEY = 'caverunner-pins';
export const PIN_DEFAULTS = ['📍', '⭐', '💀', '💰', '❓', '🏠'];
export const PIN_MAX = 23;                    // pins remembered in the picker (with + makes 4 rows of 6)
export const ZOOM_MAX = 8;                    // up to this many times the fitted size

/** the picker's pins, last used first @returns {string[]} */
export function loadPins() {
  try {
    const v = JSON.parse(localStorage.getItem(PIN_KEY) || 'null');
    if (Array.isArray(v) && v.every(s => typeof s === 'string' && s)) return v.slice(0, PIN_MAX);
  } catch (_) {}
  return PIN_DEFAULTS.slice();
}
/** @param {string[]} list */
export const savePins = list => { try { localStorage.setItem(PIN_KEY, JSON.stringify(list.slice(0, PIN_MAX))); } catch (_) {} };

// The first character someone typed: a whole emoji (flags, skin tones and joined ones included), a
// letter, a digit or a symbol ('' for none)
/** @param {string} s */
export function firstChar(s) {
  const t = (s || '').trim();
  if (!t) return '';
  if (Intl.Segmenter) for (const g of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)) return g.segment;
  return Array.from(t)[0];
}

// a pin to the front of the list, once
/** @param {string[]} list @param {string} e */
export const usePin = (list, e) => [e, ...list.filter(q => q !== e)].slice(0, PIN_MAX);

// The view: k css px per terrain pixel, (ox, oy) where the picture's top-left sits. Fitted: the
// picture's full height on screen (bar FIT_PAD top and bottom, so your helmet in the shop shows), centred across
export const FIT_PAD = 14;
/** @param {number} w @param {number} hh */
export const fitView = (w, hh) => { const k = (hh - 2 * FIT_PAD) / CH; return { k, ox: (w - CW * k) / 2, oy: FIT_PAD, k0: k }; };

// Keep the picture from being dragged off: some of it always stays on screen
/** @param {{ k: number, ox: number, oy: number, k0: number }} v @param {number} w @param {number} hh */
function keepOn(v, w, hh) {
  v.k = clamp(v.k, v.k0 * 0.6, v.k0 * ZOOM_MAX);
  const pw = CW * v.k, ph = CH * v.k, m = 60;
  v.ox = clamp(v.ox, Math.min(m - pw, (w - pw) / 2), Math.max(w - m, (w - pw) / 2));
  v.oy = clamp(v.oy, Math.min(m - ph, (hh - ph) / 2), Math.max(hh - m, (hh - ph) / 2));
}
// the view on the canvas's data-view ("k ox oy"), for the browser suite
/** @param {HTMLCanvasElement} c @param {{ k: number, ox: number, oy: number }} v */
const tell = (c, v) => { c.dataset.view = v.k.toFixed(4) + ' ' + v.ox.toFixed(1) + ' ' + v.oy.toFixed(1); };

// The shop's machines on the map (owner, v0.0.141): a coloured square each, standing on the shop floor,
// left to right: the teleporter (blue), the heal (pink), buy a level (cyan), sell it (violet), then the
// mod, gun and perk machines in their own hues (SHOPS)
/** @type {{ x: number, w: number, col: string, name: string }[]} */
export const MAP_MARKS = [
  { x: ARRIVAL_X, w: 44, col: '#4f9dff', name: 'teleporter' }, { x: HEAL_X, w: 26, col: '#ff6fae', name: 'heal' },
  { x: VEND_BUY_X, w: MACHINE_W, col: '#36e3e3', name: 'buy' }, { x: VEND_SELL_X, w: MACHINE_W, col: '#b07cff', name: 'sell' },
  ...Object.keys(SHOPS).map(k => ({ x: SHOPS[k].x, w: MACHINE_W, col: SHOPS[k].hue, name: k })),
];

// The fog memory grown by MAP_SPREAD cells each way (a square), for the map
export const MAP_SPREAD = 2;
/** @param {Uint8Array} seen @returns {Uint8Array} */
export function spread(seen) {
  const a = new Uint8Array(FW * FH), b = new Uint8Array(FW * FH), R = MAP_SPREAD;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    if (!seen[y * FW + x]) continue;
    for (let dx = Math.max(0, x - R); dx <= Math.min(FW - 1, x + R); dx++) a[y * FW + dx] = 1;
  }
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    if (!a[y * FW + x]) continue;
    for (let dy = Math.max(0, y - R); dy <= Math.min(FH - 1, y + R); dy++) b[dy * FW + x] = 1;
  }
  return b;
}

// Your helmet, size s css px, facing face: the white dome, the gold rim and dark visor on its front
/** @param {CanvasRenderingContext2D} x @param {number} cx @param {number} cy @param {number} s @param {number} face */
function helmet(x, cx, cy, s, face) {
  const r = s / 2, f = face < 0 ? -1 : 1;
  x.save();
  x.translate(cx, cy);
  x.fillStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.arc(0, 1.5, r + 2, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#eef1f6'; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#aab2c0'; x.beginPath(); x.arc(0, 0, r, f > 0 ? Math.PI * 0.55 : -Math.PI * 0.15, f > 0 ? Math.PI * 1.15 : Math.PI * 0.45); x.lineTo(0, 0); x.fill();
  x.scale(f, 1);
  x.fillStyle = '#d9a441'; x.beginPath(); x.roundRect(-r * 0.12, -r * 0.62, r * 1.02, r * 1.15, r * 0.45); x.fill();
  x.fillStyle = '#121a28'; x.beginPath(); x.roundRect(r * 0.02, -r * 0.5, r * 0.85, r * 0.9, r * 0.38); x.fill();
  x.fillStyle = '#8fe0ff'; x.fillRect(r * 0.45, -r * 0.38, r * 0.24, r * 0.24);
  x.restore();
}

/** @param {{ input: { current: GameInput } }} props */
export function MapScreen({ input }) {
  const cv = useRef(null);
  /** @type {{ current: { k: number, ox: number, oy: number, k0: number } | null }} */
  const view = useRef(null);
  useEffect(() => {
    /** @type {HTMLCanvasElement} */
    const c = cv.current;
    const ctx = c.getContext('2d');
    const fogC = document.createElement('canvas');
    fogC.width = FW; fogC.height = FH;
    const fx = fogC.getContext('2d');
    if (!ctx || !fx) return;
    let raf = 0, alive = true;
    const size = () => {
      const dpr = window.devicePixelRatio || 1, w = c.clientWidth, hh = c.clientHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr);
      if (!view.current) view.current = fitView(w, hh);
      else { view.current.k0 = (hh - 2 * FIT_PAD) / CH; keepOn(view.current, w, hh); }
    };
    size();
    // drawn every frame while open (cheap: three images and a few marks), so pins and the fog follow
    const frame = () => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const M = input.current.mapView && input.current.mapView();
      const v = view.current;
      if (!M || !v) return;
      tell(c, v);
      const dpr = window.devicePixelRatio || 1, w = c.clientWidth, hh = c.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, w, hh);
      // the picture, crisp when zoomed in, smooth when shrunk
      ctx.imageSmoothingEnabled = v.k < 1;
      ctx.drawImage(M.img, v.ox, v.oy, CW * v.k, CH * v.k);
      // the fog: a pixel a fog cell, black where never seen, laid over smooth so its edge is soft. The fog
      // memory only lifts the air and the faces of walls, so here it spreads MAP_SPREAD cells (into the rock
      // round what you saw, so walls show in their colours)
      const lift = spread(M.seen);
      const im = fx.createImageData(FW, FH), d = im.data;
      for (let i = 0; i < FW * FH; i++) { d[i * 4 + 3] = lift[i] ? 0 : 255; d[i * 4] = 5; d[i * 4 + 1] = 7; d[i * 4 + 2] = 10; }
      fx.putImageData(im, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fogC, v.ox, v.oy, FW * FOG * v.k, FH * FOG * v.k);
      // you, then the pins over you
      /** @param {number} wx @param {number} wy */
      const sp = (wx, wy) => ({ x: v.ox + wx / CELL * v.k, y: v.oy + wy / CELL * v.k });
      const me = sp(M.x, M.y), pulse = (performance.now() / 900) % 1;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - pulse)).toFixed(2) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(me.x, me.y, 9 + pulse * 14, 0, Math.PI * 2); ctx.stroke();
      // the shop's machines: squares their width, on the floor
      const fy = SHOP_FLOOR * CELL;
      for (const m of MAP_MARKS) {
        const a = sp(m.x - m.w / 2, fy - m.w), b = sp(m.x + m.w / 2, fy);
        ctx.fillStyle = m.col; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(a.x + 0.5, a.y + 0.5, b.x - a.x - 1, b.y - a.y - 1);
      }
      helmet(ctx, me.x, me.y, 16, M.face);
      ctx.font = '20px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      // a pin stands on its spot (a dot marks it), so one dropped where you are still shows
      for (const q of M.pins) {
        const p = sp(q.x, q.y);
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillText(q.e, p.x, p.y - 6);
      }
      ctx.shadowBlur = 0;
    };
    frame();
    const ro = new ResizeObserver(size); ro.observe(c);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // one finger drags, two pinch (zooming round the point between them, which also drags)
  /** @type {{ current: Map<number, { x: number, y: number }> }} */
  const pts = useRef(new Map());
  /** @param {PointerEvent} e */
  const down = e => {
    e.preventDefault();
    /** @type {HTMLCanvasElement} */
    const c = cv.current;
    try { c.setPointerCapture(e.pointerId); } catch (_) {}
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  /** @param {PointerEvent} e */
  const move = e => {
    const P = pts.current, v = view.current, was = P.get(e.pointerId);
    if (!was || !v) return;
    const before = [...P.values()].map(p => ({ ...p }));
    P.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const after = [...P.values()];
    if (after.length === 1) { v.ox += e.clientX - was.x; v.oy += e.clientY - was.y; }
    else {
      const [a0, b0] = before, [a1, b1] = after;
      const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1, d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y) || 1;
      const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }, m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
      const k = clamp(v.k * d1 / d0, v.k0 * 0.6, v.k0 * ZOOM_MAX), r = k / v.k;
      v.ox = m1.x - (m0.x - v.ox) * r; v.oy = m1.y - (m0.y - v.oy) * r; v.k = k;
    }
    /** @type {HTMLCanvasElement} */
    const c = cv.current;
    keepOn(v, c.clientWidth, c.clientHeight);
  };
  /** @param {PointerEvent} e */
  const up = e => { pts.current.delete(e.pointerId); };
  // a mouse wheel zooms too (on a PC)
  /** @param {WheelEvent} e */
  const wheel = e => {
    /** @type {HTMLCanvasElement} */
    const c = cv.current;
    const v = view.current;
    if (!v) return;
    const k = clamp(v.k * Math.exp(-e.deltaY * 0.0015), v.k0 * 0.6, v.k0 * ZOOM_MAX), r = k / v.k;
    v.ox = e.clientX - (e.clientX - v.ox) * r; v.oy = e.clientY - (e.clientY - v.oy) * r; v.k = k;
    keepOn(v, c.clientWidth, c.clientHeight);
  };
  return h('div', { className: 'mapscreen' },
    h('canvas', { ref: cv, className: 'mapcanvas', onPointerDown: down, onPointerMove: move, onPointerUp: up,
      onPointerCancel: up, onWheel: wheel }));
}

// The pin picker: the pins used before, last first, then + (a box for one new character)
/** @param {{ pins: string[], cur: string, pick: (e: string) => void, style: Record<string, any> }} props */
export function PinPicker({ pins, cur, pick, style }) {
  const [adding, setAdding] = useState(false);
  const [txt, setTxt] = useState('');
  const box = useRef(null);
  useEffect(() => { if (adding && box.current) box.current.focus(); }, [adding]);
  const add = () => { const e = firstChar(txt); if (e) pick(e); setTxt(''); setAdding(false); };
  return h('div', { className: 'pinpick', style },
    h('div', { className: 'pingrid' },
      pins.map(e => h('button', { key: e, className: 'pinopt' + (e === cur ? ' on' : ''), 'data-pin': e,
        onPointerDown: ev => { ev.preventDefault(); pick(e); } }, e)),
      h('button', { className: 'pinopt pinadd', 'aria-label': 'New pin',
        onPointerDown: ev => { ev.preventDefault(); setAdding(v => !v); } }, '+')),
    adding ? h('form', { className: 'pinnew', onSubmit: ev => { ev.preventDefault(); add(); } },
      h('input', { ref: box, value: txt, placeholder: 'One character or emoji', 'aria-label': 'New pin',
        onChange: ev => setTxt(firstChar(ev.target.value)) }),
      h('button', { type: 'submit', onPointerDown: ev => { ev.preventDefault(); add(); } }, 'Add')) : null,
    h('div', { className: 'pinhint' }, 'Hold the pin button to drop it here'));
}
