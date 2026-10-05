// @ts-check
// The Dev panel (the gear button): live-tweak knob rows by group (DevRow, DevPanel), the
// live jellyfish box at the top of the jelly colours group (JellyPreview), the group headers
// that open and shut on a press-and-hold (DevGroupHead), the hologram flash's fade curve
// (FadeCurve), any curve knob (CurveEdit), the elites' flames (FlamePreview, GradEditor, RampEditor), and the Spawn gun box (SpawnGun).

import { drawProp, rgbA } from '../art/props.js';
import { glowAt } from '../art/sprites.js';
import { bspline, gradAt, gradLut, gradStr, lutAt, parseGrad, parseRamp, rampAt, rampLut, rampStr } from '../art/ramps.js';
import { CELL } from '../core/consts.js';
import { bezierFade, clamp, hexArr, hexRgb, mix } from '../core/util.js';
import {
  drawJelly, jellyBell, jellyPal, jellyStep, plantGlowFill, plantWhite
} from '../creatures/jelly.js';
import { enemyFor } from '../data/creatures.js';
import { themeFor } from '../data/themes.js';
import {
  CURVES, DEV, DEV_DEFAULTS, DEV_GROUPS, DEV_META, devReport, devSet, kr, kru
} from '../dev/knobs.js';
import { h, useEffect, useRef, useState } from './h.js';

// A live jellyfish for Dev → Jellyfish colours: the real jellyStep and drawJelly in a
// little walled box — a mossy ledge of floor-1 rock and two hanging vines for its glow and
// plant glow (plantGlowFill) to light, a roam spot circling the middle so it keeps pulsing,
// turning and trailing, a puff of spores on every pulse, and a spit now and then so the
// spit and drip colours show too. Every frame reads DEV, so a change shows at once.
export function JellyPreview() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !c.getContext) return;
    const ctx = c.getContext('2d');
    const WU = 110, LEDGE = 8;                          // world units across; rock at the bottom
    const k = enemyFor('meduusa', 1);
    let HU = 60;
    const e = { x: WU / 2, y: 26, hx: WU / 2, hy: 26, r: k.r, phase: 0 };
    const solid = (cx, cy) => cx < 0 || cy < 0 || cx * CELL >= WU || (cy + 1) * CELL > HU - LEDGE;
    let raf, last = performance.now(), t = 0, spitT = 1.2, glob = null;
    const drops = [], spores = [];
    const TH = themeFor(1), sporeCol = rgbA(TH.moss[1]);
    // the art: a ledge with a fringe of moss along its top, and two vines from the roof
    const artC = document.createElement('canvas'), artCtx = artC.getContext('2d', { willReadFrequently: true });
    const glowC = document.createElement('canvas'), glowCtx = glowC.getContext('2d');
    const tufts = Array.from({ length: WU }, () => ({ h: Math.random() < 0.15 ? 0 : 1 + Math.floor(Math.random() * 3), c: Math.random() }));
    const vines = [{ k: 'climb', st: 'vine', x: 11, y: 0, len: 34, seed: 0.37 }, { k: 'climb', st: 'vine', x: WU - 13, y: 0, len: 27, seed: 0.81 }];
    const drop = (x, y, vx, vy, P, g) => { if (drops.length < 120) { const l = 0.5 + Math.random() * 0.5;
      drops.push({ x, y, vx, vy, g, life: l, max: l, c: Math.random() < 0.35 ? P.drip2 : P.drip, s: 1.1 + Math.random() * 0.8 }); } };
    const tick = now => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const dpr = window.devicePixelRatio || 1, cw = Math.round(c.clientWidth * dpr), ch = Math.round(c.clientHeight * dpr);
      if (!cw || !ch) return;
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      const sc = cw / WU; HU = ch / sc;
      const S = e.je;
      if (S) { S.rx = WU / 2 + Math.cos(t * 0.55) * WU * 0.24; S.ry = (HU - LEDGE) * 0.36 + Math.sin(t * 0.8) * 5; S.roamR = 1e9; S.roamSpd = 0; }
      const pulse = jellyStep(e, { solidCell: solid, hunting: false, goal: null, rnd: Math.random }, dt) === 'pulse';
      const P = jellyPal(e.je.u.col);
      // a puff of spores out of the rim, back the way it pushes (as puffSpores in the game)
      if (pulse) {
        const S2 = e.je, B = jellyBell(e.r, S2.shape, kru('jeSquash', S2.u.sq)), c0 = Math.cos(S2.hd), s0 = Math.sin(S2.hd);
        for (let i = 0, n = Math.round(kr('jeSpores')); i < n && spores.length < 80; i++) {
          const lx = (Math.random() * 2 - 1) * B.rw * 0.7, r = Math.random();
          const a = S2.hd + Math.PI + (Math.random() * 2 - 1) * kr('jeSporeSpread') * Math.PI / 180, v = kr('jeSporeSpd');
          spores.push({ x: e.x - lx * s0 - B.rim * c0, y: e.y + lx * c0 - B.rim * s0, vx: (r - 0.5) * 8, vy: 0, wob: r * 9,
            life: 5 + r * 3, max: 8, kx: Math.cos(a) * v, ky: Math.sin(a) * v, kd: kr('jeSporeDrag') });
        }
      }
      for (let i = spores.length - 1; i >= 0; i--) {
        const q = spores[i];
        q.x += Math.sin(t * 1.3 + q.wob) * 6 * dt + (q.vx + q.kx) * dt; q.y += (q.vy + q.ky) * dt;
        const kk = Math.exp(-q.kd * dt); q.kx *= kk; q.ky *= kk;
        if ((q.life -= dt) <= 0 || q.x < 0 || q.x > WU || q.y < 0 || solid(Math.floor(q.x / CELL), Math.floor(q.y / CELL))) spores.splice(i, 1);
      }
      // a spit from its head across the box, dripping, splatting on whatever it meets
      if ((spitT -= dt) <= 0 && !glob) {
        spitT = 2.2;
        const a = e.je.hd, v = 70;
        glob = { x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, da: 0,
          size: kr('jeShotSize'), drip: kr('jeDrip'), g: kr('jeDripG'), n: Math.round(kr('jeSplat')), sv: kr('jeSplatSpd') };
      }
      if (glob) {
        glob.x += glob.vx * dt; glob.y += glob.vy * dt;
        for (glob.da += glob.drip * dt; glob.da >= 1; glob.da--) drop(glob.x, glob.y + glob.size * 0.5, glob.vx * 0.08, 8 + Math.random() * 18, P, glob.g);
        if (solid(Math.floor(glob.x / CELL), Math.floor(glob.y / CELL))) {
          const sp = Math.hypot(glob.vx, glob.vy) || 1;
          for (let i = 0; i < glob.n; i++) {
            const a = Math.random() * 6.28, v = glob.sv * (0.4 + Math.random() * 0.6);
            drop(glob.x - glob.vx * dt, glob.y - glob.vy * dt, Math.cos(a) * v - glob.vx / sp * v * 0.5, Math.sin(a) * v - glob.vy / sp * v * 0.5 - v * 0.3, P, glob.g);
          }
          glob = null;
        }
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const q = drops[i];
        q.vy += q.g * dt;
        const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
        if (solid(Math.floor(nx / CELL), Math.floor(ny / CELL))) { q.vx *= 0.3; q.vy = 0; } else { q.x = nx; q.y = ny; }
        if ((q.life -= dt) <= 0) drops.splice(i, 1);
      }
      // the box: dark water-cave, a ledge of rock, the jelly, its spit, and the glow on top
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      const aw = WU, ah = Math.ceil(HU), top = HU - LEDGE;
      if (artC.width !== aw || artC.height !== ah) { artC.width = aw; artC.height = ah; glowC.width = aw; glowC.height = ah; }
      artCtx.setTransform(1, 0, 0, 1, 0, 0); artCtx.clearRect(0, 0, aw, ah);
      artCtx.fillStyle = 'rgb(62,56,54)'; artCtx.fillRect(0, top, aw, LEDGE + 1);
      artCtx.fillStyle = 'rgb(96,84,74)'; artCtx.fillRect(0, top, aw, 1.2);
      tufts.forEach((q, x) => {
        if (!q.h) return;
        artCtx.fillStyle = rgbA(mix(TH.moss[0], TH.moss[1], q.c)); artCtx.fillRect(x, top - q.h + 1, 1, q.h);
        artCtx.fillStyle = rgbA(TH.moss[1]); artCtx.fillRect(x, top - q.h + 1, 1, 1);
      });
      // @ts-expect-error the preview's stand-in vines: only what drawProp reads for a vine (noise)
      for (const v of vines) drawProp(artCtx, v, t, TH);
      ctx.imageSmoothingEnabled = false;            // pixel art, like the terrain
      ctx.drawImage(artC, 0, 0);
      drawJelly(ctx, e.x, e.y, e.r, t, 0, false, k.col, e.je);
      if (glob) {
        const z = glob.size;
        ctx.save(); ctx.translate(glob.x, glob.y); ctx.rotate(Math.atan2(glob.vy, glob.vx));
        ctx.fillStyle = P.spitEdge; ctx.beginPath(); ctx.ellipse(0, 0, z * 1.45, z * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.spit; ctx.beginPath(); ctx.ellipse(-z * 0.08, 0, z * 1.2, z * 0.82, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.spitShine; ctx.beginPath(); ctx.arc(z * 0.3, -z * 0.28, z * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      for (const q of drops) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      const u = e.je.u, a = kru('jeGlow', u.glow) * (1 + kru('jeFlare', u.flare) * e.je.shape), rgb = hexRgb(P.glow);
      glowAt(ctx, e.x, e.y, kru('jeGlowR', u.glowR), a, rgb);
      glowAt(ctx, e.x, e.y, e.r * 1.6, a * 1.4, rgb);
      if (glob) glowAt(ctx, glob.x, glob.y, glob.size * 6, 0.3, rgb);
      ctx.fillStyle = sporeCol;
      for (const q of spores) { ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3)); ctx.fillRect(q.x - 0.65, q.y - 0.65, 1.3, 1.3); }
      ctx.globalAlpha = 1;
      // the plant glow: the same comp the game runs, on this box's own art
      const art = artCtx.getImageData(0, 0, aw, ah).data;
      const white = plantWhite(art);                 // the box's own brightest green
      const reach = kru('jeGlowR', u.glowR) * kru('jePlantReach', u.plant), out = glowCtx.createImageData(aw, ah);
      if (reach > 2 && plantGlowFill(out.data, art, aw, ah, { ox: 0, oy: 0, px: 1, cx: e.x, cy: e.y, reach, white,
        top: kru('jePlantTop', u.plant) / 100, strength: kru('jePlantGlow', u.plant), t: t * kru('jePlantTwinkle', u.plant),
        size: kru('jePlantSize', u.plant), rgb: hexArr(P.glow) })) {
        glowCtx.putImageData(out, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(glowC, 0, 0);
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return h('canvas', { ref, className: 'jellyprev' });
}

// The hologram flash's fade, as a curve you shape: brightness (top = on a kill, bottom = at rest)
// over the fade's length, from the top left to the bottom right, bent by two handles. Drag
// anywhere: the nearer handle follows. A dot runs along it at the real speed, and the red box
// beside the axis shows the brightness it gives. Saves as DEV.holoC1x..holoC2y
const FC = { x0: 12, x1: 188, top: 26, bot: 106, lo: -0.3, hi: 1.3 };   // the plot, in the svg's units
const KEYS = [['holoC1x', 'holoC1y'], ['holoC2x', 'holoC2y']];
/** @param {number} u */ const fcX = u => FC.x0 + u * (FC.x1 - FC.x0);
/** @param {number} v */ const fcY = v => FC.bot - v * (FC.bot - FC.top);
export function FadeCurve() {
  const [, bump] = useState(0);
  const svg = useRef(null), dot = useRef(null), lamp = useRef(null), drag = useRef(-1);
  useEffect(() => {
    let raf, t0 = performance.now(), seen = '';
    const tick = now => {
      raf = requestAnimationFrame(tick);
      const key = DEV.holoMin + ',' + DEV.holoMax + ',' + DEV.holoFade;   // the boxes below changed: redraw the labels
      if (key !== seen) { seen = key; bump(n => n + 1); }
      const len = Math.max(0.05, DEV.holoFade), s = ((now - t0) / 1000) % (len + 0.6), u = Math.min(1, s / len);
      const v = bezierFade(u, DEV.holoC1x, DEV.holoC1y, DEV.holoC2x, DEV.holoC2y);
      const b = clamp(DEV.holoMin + (DEV.holoMax - DEV.holoMin) * v, 0, 1);
      if (dot.current) { dot.current.setAttribute('cx', String(fcX(u))); dot.current.setAttribute('cy', String(fcY(v))); }
      if (lamp.current) lamp.current.setAttribute('opacity', b.toFixed(3));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  /** @param {PointerEvent} e */
  const at = e => {
    const s = svg.current, m = s && s.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { u: clamp((p.x - FC.x0) / (FC.x1 - FC.x0), 0, 1), v: clamp((FC.bot - p.y) / (FC.bot - FC.top), FC.lo, FC.hi) };
  };
  /** @param {PointerEvent} e */
  const move = e => {
    const p = drag.current >= 0 && at(e);
    if (!p) return;
    const [kx, ky] = KEYS[drag.current];
    devSet(kx, Math.round(p.u * 100) / 100); devSet(ky, Math.round(p.v * 100) / 100);
    bump(n => n + 1);
  };
  const H = KEYS.map(([kx, ky]) => ({ x: fcX(DEV[kx]), y: fcY(DEV[ky]) }));
  const P0 = { x: fcX(0), y: fcY(1) }, P3 = { x: fcX(1), y: fcY(0) };
  const path = 'M' + P0.x + ' ' + P0.y + ' C' + H[0].x + ' ' + H[0].y + ' ' + H[1].x + ' ' + H[1].y + ' ' + P3.x + ' ' + P3.y;
  const reset = () => { for (const [kx, ky] of KEYS) { devSet(kx, DEV_DEFAULTS[kx]); devSet(ky, DEV_DEFAULTS[ky]); } bump(n => n + 1); };
  return h('div', { className: 'fadecurve' },
    h('svg', { ref: svg, viewBox: '0 0 200 132', className: 'fcsvg',
      onPointerDown: e => {
        e.preventDefault();
        const s = svg.current, m = s && s.getScreenCTM();
        if (!m) return;
        const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        drag.current = Math.hypot(p.x - H[0].x, p.y - H[0].y) <= Math.hypot(p.x - H[1].x, p.y - H[1].y) ? 0 : 1;
        s.setPointerCapture(e.pointerId);
        move(e);
      },
      onPointerMove: move,
      onPointerUp: () => { drag.current = -1; }, onPointerCancel: () => { drag.current = -1; } },
      h('rect', { x: FC.x0, y: FC.top, width: FC.x1 - FC.x0, height: FC.bot - FC.top, className: 'fcbox' }),
      h('text', { x: FC.x0 + 2, y: FC.top - 4, className: 'fctxt' }, 'kill: ' + DEV.holoMax),
      h('text', { x: FC.x0 + 2, y: FC.bot + 12, className: 'fctxt' }, 'rest: ' + DEV.holoMin),
      h('text', { x: FC.x1 - 2, y: FC.bot + 12, className: 'fctxt', textAnchor: 'end' }, DEV.holoFade + 's'),
      h('line', { x1: P0.x, y1: P0.y, x2: H[0].x, y2: H[0].y, className: 'fcarm' }),
      h('line', { x1: P3.x, y1: P3.y, x2: H[1].x, y2: H[1].y, className: 'fcarm' }),
      h('path', { d: path, className: 'fcline' }),
      h('circle', { ref: dot, r: 2.5, className: 'fcdot' }),
      H.map((q, i) => h('circle', { key: i, cx: q.x, cy: q.y, r: 5, className: 'fchandle' })),
      h('rect', { ref: lamp, x: FC.x1 - 22, y: 4, width: 20, height: 14, rx: 2, fill: '#ff0000' })),
    h('button', { className: 'devreset fcreset', 'aria-label': 'Default curve', onPointerDown: e => { e.preventDefault(); reset(); } }, '↺'));
}

// A curve knob (dev/knobs.js curveKnobs) shaped by hand: y over x = 0..1, from the start point on the
// left to the end point on the right, bent by two handles. Drag anywhere: the nearest of the four
// follows (the end points only up and down). Saves as DEV[p+'0'], p+'C1x'… p+'1'.
/** @param {{ p: string, label: string, lo: number, hi: number }} props */
export function CurveEdit({ p, label, lo, hi }) {
  const [, bump] = useState(0);
  const svg = useRef(null), drag = useRef(-1);
  /** @param {number} u */ const cx = u => FC.x0 + u * (FC.x1 - FC.x0);
  /** @param {number} v */ const cy = v => FC.bot - (v - lo) / (hi - lo) * (FC.bot - FC.top);
  const K = [[null, p + '0', 0], [p + 'C1x', p + 'C1y'], [p + 'C2x', p + 'C2y'], [null, p + '1', 1]];
  const H = K.map(([kx, ky, fx]) => ({ x: cx(kx ? DEV[kx] : Number(fx)), y: cy(DEV[ky]) }));
  /** @param {PointerEvent} e */
  const at = e => {
    const s = svg.current, m = s && s.getScreenCTM();
    if (!m) return null;
    const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { sx: q.x, sy: q.y, u: clamp((q.x - FC.x0) / (FC.x1 - FC.x0), 0, 1), v: clamp(lo + (FC.bot - q.y) / (FC.bot - FC.top) * (hi - lo), lo, hi) };
  };
  /** @param {PointerEvent} e */
  const move = e => {
    const q = drag.current >= 0 && at(e);
    if (!q) return;
    const [kx, ky] = K[drag.current];
    if (kx) devSet(String(kx), Math.round(q.u * 100) / 100);
    devSet(String(ky), Math.round(q.v * 100) / 100);
    bump(n => n + 1);
  };
  const path = 'M' + H[0].x + ' ' + H[0].y + ' C' + H[1].x + ' ' + H[1].y + ' ' + H[2].x + ' ' + H[2].y + ' ' + H[3].x + ' ' + H[3].y;
  const reset = () => { for (const [kx, ky] of K) { if (kx) devSet(String(kx), DEV_DEFAULTS[kx]); devSet(String(ky), DEV_DEFAULTS[ky]); } bump(n => n + 1); };
  return h('div', { className: 'fadecurve', 'data-curve': p },
    h('p', { className: 'devlbl' }, label),
    h('svg', { ref: svg, viewBox: '0 0 200 132', className: 'fcsvg',
      onPointerDown: e => {
        e.preventDefault();
        const q = at(e);
        if (!q) return;
        let best = 0;
        H.forEach((c, i) => { if (Math.hypot(q.sx - c.x, q.sy - c.y) < Math.hypot(q.sx - H[best].x, q.sy - H[best].y)) best = i; });
        drag.current = best;
        svg.current.setPointerCapture(e.pointerId);
        move(e);
      },
      onPointerMove: move,
      onPointerUp: () => { drag.current = -1; }, onPointerCancel: () => { drag.current = -1; } },
      h('rect', { x: FC.x0, y: FC.top, width: FC.x1 - FC.x0, height: FC.bot - FC.top, className: 'fcbox' }),
      h('text', { x: FC.x0 + 2, y: FC.top - 4, className: 'fctxt' }, 'y ' + hi),
      h('text', { x: FC.x0 + 2, y: FC.bot + 12, className: 'fctxt' }, 'x 0, y ' + lo),
      h('text', { x: FC.x1 - 2, y: FC.bot + 12, className: 'fctxt', textAnchor: 'end' }, 'x 1 (the reach)'),
      h('line', { x1: H[0].x, y1: H[0].y, x2: H[1].x, y2: H[1].y, className: 'fcarm' }),
      h('line', { x1: H[3].x, y1: H[3].y, x2: H[2].x, y2: H[2].y, className: 'fcarm' }),
      h('path', { d: path, className: 'fcline' }),
      H.map((c, i) => h('circle', { key: i, cx: c.x, cy: c.y, r: 5, className: 'fchandle' }))),
    h('button', { className: 'devreset fcreset', 'aria-label': 'Default curve', onPointerDown: e => { e.preventDefault(); reset(); } }, '↺'));
}

// ---- Dev → Elites: flames (v0.0.137) ----
// The point under a pointer in an svg's own units
/** @param {SVGSVGElement} s @param {PointerEvent} e */
const svgPt = (s, e) => { const m = s && s.getScreenCTM(); return m ? new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()) : null; };
const toHex = (/** @type {number[]} */ c) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

// A little elite on fire: a body drifting side to side so the trail shows, throwing the real
// flames (stepEliteFire's rules, the live knobs) and drawn the game's way (drawEliteFire's rules)
export function FlamePreview() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !c.getContext) return;
    const ctx = c.getContext('2d');
    /** @type {Particle[]} */
    const fx = [];
    const e = { x: 60, ty: 56, r: 7, fxAcc: 0, px: 60, py: 56 };
    let raf, last = performance.now(), t = 0;
    const tick = now => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const cw = c.clientWidth, ch = c.clientHeight, dpr = window.devicePixelRatio || 1;
      if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
      const sc = c.height / 80, wu = c.width / sc;          // 80 world units tall, as wide as it is
      e.x = wu / 2 + Math.sin(t * 0.9) * wu * 0.3; e.ty = 56 + Math.sin(t * 1.7) * 5;
      const vx = (e.x - e.px) / (dt || 1), vy = (e.ty - e.py) / (dt || 1); e.px = e.x; e.py = e.ty;
      for (e.fxAcc += kr('elFxRate') * dt; e.fxAcc >= 1; e.fxAcc--) {
        const a = Math.random() * 6.283, rr = e.r * kr('elFxBody') * Math.sqrt(Math.random()), life = kr('elFxLife');
        fx.push({ x: e.x + Math.cos(a) * rr, y: e.ty + Math.sin(a) * rr, vx, vy, life, max: life, rise: kr('elFxRise'),
          wave: kr('elFxWave'), hz: kr('elFxWaveHz'), drag: kr('elFxDrag'), s: kr('elFxSize'), ph: Math.random() * 6.283, age: 0 });
      }
      for (let i = fx.length - 1; i >= 0; i--) {
        const q = fx[i]; q.age += dt;
        const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k;
        q.x += (q.vx + Math.sin(q.age * q.hz * 6.283 + q.ph) * q.wave) * dt; q.y += (q.vy - q.rise) * dt;
        if ((q.life -= dt) <= 0) fx.splice(i, 1);
      }
      if (fx.length > 500) fx.splice(0, fx.length - 500);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      const cols = gradLut(DEV.elFxGrad), al = rampLut(DEV.elFxAlpha);
      ctx.globalCompositeOperation = 'lighter';
      for (const q of fx) {
        const u = 1 - q.life / q.max, a = lutAt(al, u);
        if (a <= 0.01) continue;
        ctx.globalAlpha = a; ctx.fillStyle = lutAt(cols, u);
        ctx.fillRect(Math.round(q.x) - q.s / 2, Math.round(q.y) - q.s / 2, q.s, q.s);
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.fillStyle = '#5a4a6a'; ctx.beginPath(); ctx.arc(e.x, e.ty, e.r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(e.x - 3, e.ty - 2, 2, 2); ctx.fillRect(e.x + 1, e.ty - 2, 2, 2);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return h('canvas', { ref, className: 'flameprev' });
}

// The flames' colour over a particle's life: a bar showing the gradient, its stops as handles
// under it. Drag a handle sideways to move it; tap the bar to add a stop there (in the colour it
// already is); tap a handle to pick its colour or delete it. Saves DEV.elFxGrad (art/ramps.js).
export function GradEditor() {
  const [, bump] = useState(0);
  const [sel, setSel] = useState(-1);
  const svg = useRef(null), drag = useRef(-1);
  const G = parseGrad(DEV.elFxGrad);
  const save = (/** @type {GradStop[]} */ g, /** @type {number} */ keep) => {
    const s = g[keep], out = g.slice().sort((a, b) => a.t - b.t);
    devSet('elFxGrad', gradStr(out)); setSel(s ? out.indexOf(s) : -1); bump(n => n + 1);
    return s ? out.indexOf(s) : -1;
  };
  const X0 = 8, X1 = 192, tOf = (/** @type {number} */ x) => clamp((x - X0) / (X1 - X0), 0, 1);
  return h('div', { className: 'gradedit' },
    h('svg', { ref: svg, viewBox: '0 0 200 44', className: 'fcsvg',
      onPointerDown: e => {
        e.preventDefault();
        const p = svgPt(svg.current, e);
        if (!p) return;
        let i = -1, bd = 7;
        G.forEach((s, k) => { const d = Math.abs(X0 + s.t * (X1 - X0) - p.x); if (p.y > 22 && d < bd) { bd = d; i = k; } });
        if (i < 0) {                                  // a new stop, the colour the bar already is there
          const t = tOf(p.x);
          G.push({ t, c: toHex(gradAt(G, t)) });
          i = save(G, G.length - 1);
        } else setSel(i);
        drag.current = i;
        svg.current.setPointerCapture(e.pointerId);
      },
      onPointerMove: e => {
        if (drag.current < 0) return;
        const p = svgPt(svg.current, e);
        if (!p) return;
        G[drag.current].t = tOf(p.x);
        drag.current = save(G, drag.current);
      },
      onPointerUp: () => { drag.current = -1; }, onPointerCancel: () => { drag.current = -1; } },
      h('defs', null, h('linearGradient', { id: 'elfxg', x1: 0, x2: 1, y1: 0, y2: 0 },
        G.map((s, k) => h('stop', { key: k, offset: s.t, stopColor: s.c })))),
      h('rect', { x: X0, y: 4, width: X1 - X0, height: 18, rx: 3, fill: 'url(#elfxg)' }),
      G.map((s, k) => { const x = X0 + s.t * (X1 - X0);
        return h('path', { key: k, d: 'M' + x + ' 24 l5 8 v8 h-10 v-8 z', fill: s.c,
          stroke: k === sel ? '#fff' : 'rgba(255,255,255,0.45)', strokeWidth: k === sel ? 1.6 : 0.8 }); })),
    sel >= 0 && G[sel] ? h('div', { className: 'gradsel' },
      h('span', null, 'Stop at ' + Math.round(G[sel].t * 100) + '%'),
      h('input', { type: 'color', value: G[sel].c, onChange: e => { G[sel].c = e.target.value; save(G, sel); } }),
      G.length > 1 ? h('button', { className: 'devreset', onPointerDown: e => { e.preventDefault();
        G.splice(sel, 1); devSet('elFxGrad', gradStr(G)); setSel(-1); bump(n => n + 1); } }, 'Delete') : null) : null,
    h('div', { className: 'gradsel' }, h('span', null, sel >= 0 ? '' : 'Tap the bar to add a stop, drag one to move it'),
      h('button', { className: 'devreset', 'aria-label': 'Default gradient', onPointerDown: e => { e.preventDefault();
        devSet('elFxGrad', DEV_DEFAULTS.elFxGrad); setSel(-1); bump(n => n + 1); } }, '↺')));
}

// The flames' opacity over a particle's life: a B-spline through draggable control points (life
// left to right, opacity bottom to top), the dashed line joining them, and a dot running along it
// at the real speed. Drag a point; tap empty space to add one there; tap a point to select it and
// Delete. Saves DEV.elFxAlpha (art/ramps.js).
export function RampEditor() {
  const [, bump] = useState(0);
  const [sel, setSel] = useState(-1);
  const svg = useRef(null), drag = useRef(-1), dot = useRef(null);
  const R = parseRamp(DEV.elFxAlpha);
  const B = { x0: 10, x1: 190, top: 8, bot: 98 };
  const px = (/** @type {number} */ x) => B.x0 + x * (B.x1 - B.x0), py = (/** @type {number} */ y) => B.bot - y * (B.bot - B.top);
  useEffect(() => {
    let raf, t0 = performance.now();
    const tick = now => {
      raf = requestAnimationFrame(tick);
      const len = Math.max(0.05, (DEV.elFxLifeLo + DEV.elFxLifeHi) / 2), u = (((now - t0) / 1000) % (len + 0.4)) / len;
      if (dot.current && u <= 1) { dot.current.setAttribute('cx', String(px(u))); dot.current.setAttribute('cy', String(py(rampAt(parseRamp(DEV.elFxAlpha), u)))); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const save = (/** @type {RampPt[]} */ r, /** @type {number} */ keep) => {
    const p = r[keep], out = r.slice().sort((a, b) => a.x - b.x);
    devSet('elFxAlpha', rampStr(out)); setSel(p ? out.indexOf(p) : -1); bump(n => n + 1);
    return p ? out.indexOf(p) : -1;
  };
  const at = e => { const p = svgPt(svg.current, e); return p && { x: clamp((p.x - B.x0) / (B.x1 - B.x0), 0, 1), y: clamp((B.bot - p.y) / (B.bot - B.top), 0, 1), sx: p.x, sy: p.y }; };
  const curve = bspline(R);
  let d = '';
  for (let i = 0; i < curve.length; i += 2) d += (i ? ' L' : 'M') + px(curve[i]).toFixed(1) + ' ' + py(curve[i + 1]).toFixed(1);
  return h('div', { className: 'rampedit' },
    h('svg', { ref: svg, viewBox: '0 0 200 112', className: 'fcsvg',
      onPointerDown: e => {
        e.preventDefault();
        const p = at(e);
        if (!p) return;
        let i = -1, bd = 9;
        R.forEach((q, k) => { const dd = Math.hypot(px(q.x) - p.sx, py(q.y) - p.sy); if (dd < bd) { bd = dd; i = k; } });
        if (i < 0) { R.push({ x: p.x, y: p.y }); i = save(R, R.length - 1); }
        else setSel(i);
        drag.current = i;
        svg.current.setPointerCapture(e.pointerId);
      },
      onPointerMove: e => {
        if (drag.current < 0) return;
        const p = at(e);
        if (!p) return;
        R[drag.current].x = p.x; R[drag.current].y = p.y;
        drag.current = save(R, drag.current);
      },
      onPointerUp: () => { drag.current = -1; }, onPointerCancel: () => { drag.current = -1; } },
      h('rect', { x: B.x0, y: B.top, width: B.x1 - B.x0, height: B.bot - B.top, className: 'fcbox' }),
      h('text', { x: B.x0 + 2, y: B.top + 7, className: 'fctxt' }, 'opaque'),
      h('text', { x: B.x0 + 2, y: B.bot + 10, className: 'fctxt' }, 'born'),
      h('text', { x: B.x1 - 2, y: B.bot + 10, className: 'fctxt', textAnchor: 'end' }, 'gone'),
      h('polyline', { points: R.map(q => px(q.x) + ',' + py(q.y)).join(' '), className: 'fcarm', fill: 'none' }),
      h('path', { d, className: 'fcline' }),
      h('circle', { ref: dot, r: 2.5, className: 'fcdot', cx: -10, cy: -10 }),
      R.map((q, k) => h('circle', { key: k, cx: px(q.x), cy: py(q.y), r: 4.5, className: 'fchandle',
        style: k === sel ? { stroke: '#fff' } : null }))),
    h('div', { className: 'gradsel' },
      sel >= 0 && R[sel] ? h('span', null, 'Point: life ' + Math.round(R[sel].x * 100) + '%, opacity ' + Math.round(R[sel].y * 100) + '%')
        : h('span', null, 'Tap to add a point, drag to move'),
      sel >= 0 && R.length > 2 ? h('button', { className: 'devreset', onPointerDown: e => { e.preventDefault();
        R.splice(sel, 1); devSet('elFxAlpha', rampStr(R)); setSel(-1); bump(n => n + 1); } }, 'Delete') : null,
      h('button', { className: 'devreset', 'aria-label': 'Default ramp', onPointerDown: e => { e.preventDefault();
        devSet('elFxAlpha', DEV_DEFAULTS.elFxAlpha); setSel(-1); bump(n => n + 1); } }, '↺')));
}

// One tweakable value in the dev panel: a labelled number box prefilled with the live
// value, its default shown as the placeholder. Committing an empty box restores the
// default; anything else is parsed, clamped to the knob's range and saved at once.
/** @param {{ meta: DevRow }} props */
export function DevRow({ meta }) {
  const [val, setVal] = useState(String(DEV[meta.k]));
  if (meta.type === 'curve' || meta.type === 'grad' || meta.type === 'ramp') return null;   // shaped on their editors, not typed
  if (meta.type === 'slider') {
    // a slider: changes live as you drag, the number beside the label; ↺ puts the default back
    const set = v => { devSet(meta.k, v); setVal(String(v)); };
    return h('div', { className: 'devrow' },
      h('label', null, meta.label, h('span', { className: 'devval' }, String(DEV[meta.k]))),
      h('input', { type: 'range', min: meta.min, max: meta.max, step: meta.step, value: DEV[meta.k],
        onChange: e => set(parseFloat(e.target.value)) }),
      h('button', { className: 'devreset', 'aria-label': 'Default', onPointerDown: () => set(DEV_DEFAULTS[meta.k]) }, '↺'));
  }
  if (meta.type === 'color') {
    // a colour: changes live as you pick; ↺ puts the default back
    const set = v => { devSet(meta.k, v); setVal(v); };
    return h('div', { className: 'devrow' },
      h('label', null, meta.label),
      h('input', { type: 'color', value: DEV[meta.k], onChange: e => set(e.target.value) }),
      h('button', { className: 'devreset', 'aria-label': 'Default', onPointerDown: () => set(DEV_DEFAULTS[meta.k]) }, '↺'));
  }
  const commit = () => {
    const s = val.trim();
    let v;
    if (s === '') v = DEV_DEFAULTS[meta.k];
    else { v = parseFloat(s); if (!isFinite(v)) { setVal(String(DEV[meta.k])); return; } }
    v = Math.max(meta.min, Math.min(meta.max, v));
    devSet(meta.k, v);
    setVal(String(v));
  };
  return h('div', { className: 'devrow' },
    h('label', null, meta.label),
    h('input', { type: 'number', inputMode: 'decimal', step: meta.step,
      value: val, placeholder: String(DEV_DEFAULTS[meta.k]),
      onChange: e => setVal(e.target.value),
      onBlur: commit,
      onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } } })
  );
}

// A group's header: press and hold it (HOLD_MS) to open or shut the group, so a finger scrolling
// the panel can't flip one by landing on it. A bar fills along it while held; moving the finger
// off (or more than HOLD_SLOP px) lets go without flipping it.
export const HOLD_MS = 400, HOLD_SLOP = 10;
/** @param {{ g: string, name: string, shut: boolean, toggle: (g: string) => void }} props */
export function DevGroupHead({ g, name, shut, toggle }) {
  const [held, setHeld] = useState(false);
  const T = useRef({ id: 0, x: 0, y: 0 });
  const stop = () => { clearTimeout(T.current.id); T.current.id = 0; setHeld(false); };
  useEffect(() => () => clearTimeout(T.current.id), []);
  return h('button', { className: 'devghead' + (shut ? '' : ' open') + (held ? ' holding' : ''), 'data-g': g,
    style: { '--hold': HOLD_MS + 'ms' },
    onPointerDown: e => {
      T.current.x = e.clientX; T.current.y = e.clientY;
      clearTimeout(T.current.id);
      setHeld(true);
      T.current.id = setTimeout(() => { T.current.id = 0; setHeld(false); toggle(g); }, HOLD_MS);
    },
    onPointerMove: e => { if (T.current.id && Math.hypot(e.clientX - T.current.x, e.clientY - T.current.y) > HOLD_SLOP) stop(); },
    onPointerUp: stop, onPointerCancel: stop, onPointerLeave: stop,
    onContextMenu: e => e.preventDefault() },
    h('span', { className: 'devcaret' }, shut ? '▸' : '▾'), name);
}

// The dev window: it pauses the run but the game keeps drawing behind a light backdrop,
// so the look-of-it knobs (zoom, torch, fog) preview live as you type. Holds the toggle
// buttons — "All mods" is the old DEBUG shelf — and the saved, persisted variables.
/** @param {{ input: { current: GameInput }, refresh: () => void, close: () => void, onRestart: () => void, onSpawnGun: () => void }} props */
export function DevPanel({ input, refresh, close, onRestart, onSpawnGun }) {
  const LO = input.current.loadout;
  const [, bump] = useState(0);
  const [copied, setCopied] = useState(null);     // null, or the text + whether it copied
  // which groups are open: remembered on this device only, all shut the first time
  const [openG, setOpenG] = useState(() => { try { return JSON.parse(localStorage.getItem('caverunner-devgroups')) || {}; } catch (_) { return {}; } });
  const toggleG = g => {
    // @ts-expect-error document.activeElement is an Element; the focused box is an HTMLElement (noise)
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // commit a half-typed box
    const o = Object.assign({}, openG, { [g]: !openG[g] });
    setOpenG(o);
    try { localStorage.setItem('caverunner-devgroups', JSON.stringify(o)); } catch (_) {}
  };
  const copyAll = () => {
    // @ts-expect-error document.activeElement is an Element; the focused box is an HTMLElement (noise)
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // commit a half-typed box
    const text = devReport();
    const fallback = () => {
      let ok = false;
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch (_) {}
      setCopied({ text, ok });
    };
    try {
      navigator.clipboard.writeText(text).then(() => setCopied({ text, ok: true }), fallback);
    } catch (_) { fallback(); }
  };
  return h('div', { className: 'devwrap' },
    h('div', { className: 'devback', onPointerDown: e => { e.preventDefault(); close(); } }),
    h('div', { className: 'devpanel scroll' },
      h('div', { className: 'devhead' },
        h('h2', null, 'Dev'),
        h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Done')),
      h('div', { className: 'devbtns' },
        h('button', { className: 'dbg' + (LO.debug ? ' on' : ''),
          onPointerDown: e => { e.preventDefault(); LO.debug = !LO.debug; refresh(); bump(n => n + 1); } },
          'All mods'),
        h('button', { className: 'dbg restart',
          onPointerDown: e => { e.preventDefault(); onRestart(); } }, 'Restart run'),
        h('button', { className: 'dbg spawngun',
          onPointerDown: e => { e.preventDefault(); onSpawnGun(); } }, 'Spawn gun'),
        h('button', { className: 'dbg newcave',
          onPointerDown: e => { e.preventDefault(); input.current.newCave = true; close(); } }, 'New cave'),
        h('button', { className: 'dbg floor2',
          onPointerDown: e => { e.preventDefault(); input.current.newCave = 2; close(); } }, 'Floor 2')),
      DEV_GROUPS.map(([g, name]) => {
        const shut = !openG[g];
        return h('div', { key: g, className: 'devgroup' },
          h(DevGroupHead, { g, name, shut, toggle: toggleG }),
          shut ? null : h('div', { className: 'devvars' },
            g === 'jellycol' ? h(JellyPreview) : null,        // the live jelly its colours paint
            g === 'holoflash' ? h(FadeCurve) : null,
            CURVES.filter(c => c.g === g).map(c => h(CurveEdit, { key: c.p, p: c.p, label: c.label, lo: c.lo, hi: c.hi })),
            g === 'elitefx' ? [h(FlamePreview, { key: 'fp' }), h('p', { key: 'gl', className: 'devlbl' }, 'Colour over life'), h(GradEditor, { key: 'ge' }),
              h('p', { key: 'rl', className: 'devlbl' }, 'Opacity over life'), h(RampEditor, { key: 're' })] : null,
            DEV_META.filter(m => m.g === g).map(m => h(DevRow, { key: m.k, meta: m }))));
      }),
      h('p', { className: 'devnote' },
        'Values save on their own and stick across reloads and sessions. Leave a box empty to put its default back.'),
      h('button', { className: 'dbg devcopy', onPointerDown: e => { e.preventDefault(); copyAll(); } },
        'Copy all dev settings to clipboard'),
      copied ? h('p', { className: 'devnote' }, copied.ok ? 'Copied — paste it to Claude.'
        : 'Could not reach the clipboard — press and hold the text below to copy it.') : null,
      copied && !copied.ok ? h('textarea', { className: 'devcopytext', readOnly: true, value: copied.text }) : null
    )
  );
}

/** @param {{ input: { current: GameInput }, close: () => void }} props */
export function SpawnGun({ input, close }) {
  const [lvl, setLvl] = useState(String(input.current.floor || 1));
  const spawn = () => {
    input.current.spawnGun = Math.max(1, Math.floor(Number(lvl) || 1));
    close();
  };
  return h('div', { className: 'devwrap' },
    h('div', { className: 'devback', onPointerDown: e => { e.preventDefault(); close(); } }),
    h('div', { className: 'devpanel spawnpanel' },
      h('div', { className: 'devhead' },
        h('h2', null, 'Spawn gun'),
        h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Cancel')),
      h('div', { className: 'devrow' },
        h('label', null, 'Level'),
        h('input', { className: 'spawnlvl', type: 'number', min: 1, inputMode: 'numeric', value: lvl,
          onChange: e => setLvl(e.target.value) })),
      h('button', { className: 'dbg spawngo', onPointerDown: e => { e.preventDefault(); spawn(); } }, 'Spawn')));
}
