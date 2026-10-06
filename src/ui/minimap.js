// @ts-check
// The Mini-map perk (owner): a see-through box with a thin white outline over the gun buttons, as
// wide as their arc, from just above them up to halfway up the screen. In it, what you've seen of the
// floor (the same fog memory as the map): rock black at 20%, air white at 25% (level-entry.js
// miniPicture, made once per floor), you as a white arrow along the gun's aim, red dots for creatures
// in the box, tiny crystals where they lie, and your pins (one off the box sticks to its edge, in its
// direction). Tap it: zoom out ×2, ×2 again, then back (MINI_ZOOMS).
// The fogged picture is remade only when the fog memory grows; each frame is one blit and the marks.

import { CELL, CH, CW, FH, FOG, FW } from '../core/consts.js';
import { h, useEffect, useRef, useState } from './h.js';

export const MINI_ZOOMS = [1, 2, 4];       // a tap steps to the next; the last tap comes back to 1
export const MINI_PAD = 8;                 // px between the box's bottom and the gun buttons' top
export const MINI_REACH = 1.3;             // zoom 1: the box's width shows this many of the game view's widths
export const MINI_EDGE = 9;                // px in from the edge a clamped pin sits

// The fog memory grown by MAP_SPREAD cells each way (a square), for the maps: the memory only lifts
// air and wall faces, so this shows the rock round what you saw
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

// The box, in the sticks row's coordinates (deckLayout's): the gun buttons' width, from `top` (half
// the screen's height, in those coordinates) down to MINI_PAD above the highest gun button
/** @param {{ btn: number, guns: Pt[] }} deck @param {number} top @returns {{ left: number, top: number, width: number, height: number }} */
export function miniBox(deck, top) {
  const xs = deck.guns.map(g => g.x), ys = deck.guns.map(g => g.y), r = deck.btn / 2;
  const left = Math.min(...xs) - r, right = Math.max(...xs) + r, bottom = Math.min(...ys) - r - MINI_PAD;
  return { left: Math.round(left), top: Math.round(top), width: Math.round(right - left), height: Math.max(40, Math.round(bottom - top)) };
}

// css px per world unit at zoom step z (0, 1, 2) for a box bw wide when the game shows viewW world units across
/** @param {number} bw @param {number} viewW @param {number} z */
export const miniScale = (bw, viewW, z) => bw / (Math.max(1, viewW) * MINI_REACH) / MINI_ZOOMS[z % MINI_ZOOMS.length];

// A world point in the box: you (cx, cy) in the middle, k px per world unit
/** @param {number} wx @param {number} wy @param {number} cx @param {number} cy @param {number} k @param {number} bw @param {number} bh */
export const miniAt = (wx, wy, cx, cy, k, bw, bh) => ({ x: bw / 2 + (wx - cx) * k, y: bh / 2 + (wy - cy) * k });

// A point in the box stays put; one outside slides in along the line from the middle to it until it
// sits m px inside the edge (so a pin off the box points its way). `out`: it was clamped
/** @param {number} x @param {number} y @param {number} bw @param {number} bh @param {number} m */
export function edgeClamp(x, y, bw, bh, m) {
  if (x >= m && x <= bw - m && y >= m && y <= bh - m) return { x, y, out: false };
  const dx = x - bw / 2, dy = y - bh / 2, hx = bw / 2 - m, hy = bh / 2 - m;
  const t = Math.min(dx ? hx / Math.abs(dx) : Infinity, dy ? hy / Math.abs(dy) : Infinity);
  return { x: bw / 2 + dx * t, y: bh / 2 + dy * t, out: true };
}

// you: a white arrow at (x, y) pointing along angle a
/** @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {number} a */
function arrow(c, x, y, a) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-2.5, 0); c.lineTo(-5, 5); c.closePath();
  c.fill(); c.stroke(); c.restore();
}
// a crystal: a tiny diamond in its colour
/** @param {CanvasRenderingContext2D} c @param {number} x @param {number} y @param {boolean} green */
function crystal(c, x, y, green) {
  c.fillStyle = green ? '#5ef08a' : '#ff4d5e'; c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 2.6, y); c.lineTo(x, y + 4); c.lineTo(x - 2.6, y); c.closePath();
  c.fill(); c.stroke();
}

/** @param {{ input: { current: GameInput }, box: { left: number, top: number, width: number, height: number } }} props */
export function MiniMap({ input, box }) {
  const cv = useRef(null);
  const [z, setZ] = useState(0);
  const zr = useRef(0);
  zr.current = z;
  useEffect(() => {
    /** @type {HTMLCanvasElement} */
    const c = cv.current;
    const ctx = c.getContext('2d');
    // the picture under the fog memory, a pixel per terrain pixel: remade when the memory grows
    const fogC = document.createElement('canvas'); fogC.width = FW; fogC.height = FH;
    const fx = fogC.getContext('2d');
    const maskC = document.createElement('canvas'); maskC.width = CW; maskC.height = CH;
    const mx = maskC.getContext('2d');
    if (!ctx || !fx || !mx) return;
    let raf = 0, alive = true, lastN = -1, lastSeen = -1;
    /** @param {MapView} M */
    const remask = M => {
      const lift = spread(M.seen), im = fx.createImageData(FW, FH), d = im.data;
      for (let i = 0; i < FW * FH; i++) d[i * 4 + 3] = lift[i] ? 255 : 0;
      fx.putImageData(im, 0, 0);
      mx.globalCompositeOperation = 'copy'; mx.drawImage(M.mini, 0, 0);
      mx.globalCompositeOperation = 'destination-in'; mx.imageSmoothingEnabled = true;
      mx.drawImage(fogC, 0, 0, FW * FOG, FH * FOG);
      mx.globalCompositeOperation = 'source-over';
    };
    const frame = () => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const M = input.current.mapView && input.current.mapView();
      if (!M) return;
      // the memory grows a cell at a time: a count of it says when to remake the picture
      let n = 0;
      for (let i = 0; i < M.seen.length; i++) n += M.seen[i] ? 1 : 0;
      if (M.mapN !== lastN || n !== lastSeen) { remask(M); lastN = M.mapN; lastSeen = n; }
      const dpr = window.devicePixelRatio || 1, bw = c.clientWidth, bh = c.clientHeight;
      if (c.width !== Math.round(bw * dpr) || c.height !== Math.round(bh * dpr)) { c.width = Math.round(bw * dpr); c.height = Math.round(bh * dpr); }
      const k = miniScale(bw, M.viewW, zr.current);
      c.dataset.k = k.toFixed(5);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, bw, bh);
      const o = miniAt(0, 0, M.x, M.y, k, bw, bh);
      ctx.imageSmoothingEnabled = k * CELL < 1;
      ctx.drawImage(maskC, o.x, o.y, CW * CELL * k, CH * CELL * k);
      // crystals where they lie, in what you've seen
      for (const q of M.items) {
        if (q.kind !== 'crystal' || q.taken || q.fly) continue;
        const cx = Math.floor(q.x / (FOG * CELL)), cy = Math.floor(q.y / (FOG * CELL));
        if (cx < 0 || cy < 0 || cx >= FW || cy >= FH || !M.seen[cy * FW + cx]) continue;
        const p = miniAt(q.x, q.y, M.x, M.y, k, bw, bh);
        if (p.x > -4 && p.y > -4 && p.x < bw + 4 && p.y < bh + 4) crystal(ctx, p.x, p.y, !!q.green);
      }
      // creatures in the box, only in what you've explored (owner)
      ctx.fillStyle = '#ff3b3b';
      let foes = 0;
      for (const e of M.foes) {
        if (e.dead) continue;
        const ex = Math.floor(e.x / (FOG * CELL)), ey = Math.floor(e.y / (FOG * CELL));
        if (ex < 0 || ey < 0 || ex >= FW || ey >= FH || !M.seen[ey * FW + ex]) continue;
        const p = miniAt(e.x, e.y, M.x, M.y, k, bw, bh);
        if (p.x < 0 || p.y < 0 || p.x > bw || p.y > bh) continue;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill(); foes++;
      }
      c.dataset.foes = String(foes);
      // you, pointing where the gun aims (else the way you face)
      arrow(ctx, bw / 2, bh / 2, M.aim.on ? Math.atan2(M.aim.ny, M.aim.nx) : (M.face < 0 ? Math.PI : 0));
      // the pins, an edge one pointing its way
      ctx.font = '13px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const at = [];
      for (const q of M.pins) {
        const p = miniAt(q.x, q.y, M.x, M.y, k, bw, bh), e = edgeClamp(p.x, p.y, bw, bh, MINI_EDGE);
        ctx.globalAlpha = e.out ? 0.8 : 1;
        ctx.fillText(q.e, e.x, e.y);
        at.push(Math.round(e.x) + ',' + Math.round(e.y) + (e.out ? ',out' : ''));
      }
      ctx.globalAlpha = 1;
      c.dataset.pins = at.join(' ');
    };
    frame();
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);
  return h('canvas', { ref: cv, className: 'minimap', 'data-zoom': MINI_ZOOMS[z],
    style: { left: box.left, top: box.top, width: box.width, height: box.height },
    onPointerDown: e => { e.preventDefault(); e.stopPropagation(); setZ(v => (v + 1) % MINI_ZOOMS.length); } });
}
