// @ts-check
// The build screen (the Bag): Editor, with the gun's stats (GunStats) and its tabs
// (GunIcon), the slot grid lit by the live fire preview (SlotGrid), the mod bag, and the
// ScrollBox grab bars both grids scroll with.

import { drawGun, drawRunner, pixelSprite } from '../art/sprites.js';
import { SFX } from '../audio/sfx.js';
import { PH, PW } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';
import { buildAdvice } from '../spells/advisor.js';
import { stackBag } from '../spells/collection.js';
import {
  fireSimGauges, fireSimNew, fireSimStep, gunModDeltas, pullSteps, statQual
} from '../spells/bagsim.js';
import { gunAccent, gunColor, gunLvCol, resetGun } from '../spells/guns.js';
import { ALL_IDS, FAMILIES, FAMILY_OF, MODS, famCol } from '../spells/mods.js';
import { holoPass } from '../game/render/guide.js';
import { FOLLOW_AHEAD, FOLLOW_PULL } from '../spells/paths.js';
import { drawLook } from '../game/render/looks.js';
import { ModCard, tgtBadge } from './cards.js';
import { h, useEffect, useMemo, useRef, useState } from './h.js';
import { GAUGE_COL, healthCol } from './hud.js';

// A gun's stats, one per line: name in its gauge colour, value red->green by how near
// perfect it is, and what the fitted mods add or take away.
export const PULL_COL = ['#ff8a1f', '#3fc9ff', '#b565ff', '#57d267', '#ff5fa2', '#ffd23c'];
export const GS_ROWS = [
  { k: 'cap', label: 'Slots', fmt: v => String(v) },
  { k: 'castDelay', label: 'Cast delay', col: GAUGE_COL.cast, fmt: v => v.toFixed(2) + 's', better: -1, dfmt: v => v.toFixed(2) + 's' },
  { k: 'recharge', label: 'Recharge', col: GAUGE_COL.rech, fmt: v => v.toFixed(2) + 's', better: -1, dfmt: v => v.toFixed(2) + 's' },
  { k: 'manaMax', label: 'Mana', col: GAUGE_COL.mana, fmt: v => String(Math.round(v)), better: 1, dfmt: v => String(Math.round(v)) },
  { k: 'manaRegen', label: 'Mana regen', col: GAUGE_COL.mana, fmt: v => Math.round(v) + '/s', better: 1, dfmt: v => String(Math.round(v)) },
  { k: 'spread', label: 'Spread', fmt: v => v.toFixed(1) + '°', better: -1, dfmt: v => v.toFixed(1) + '°' },
  { k: 'speedMul', label: 'Shot speed', fmt: v => '×' + v.toFixed(2), better: 1, dfmt: v => v.toFixed(2) },
  { k: 'multi', label: 'Per cast', fmt: v => String(v) },
  { k: 'shuffle', label: 'Order', fmt: v => (v ? 'shuffle' : 'in order') },
];
// Cast delay, recharge and mana get a thin bar under them showing the fire preview live,
// draining and refilling like the right stick's rings (the other stats have none). The
// bars are written straight to the DOM each frame, not re-rendered.
export const LIVE_BAR = { castDelay: GAUGE_COL.cast, recharge: GAUGE_COL.rech, manaMax: GAUGE_COL.mana };
/** @param {{ gun: Gun, sim: { current: import('../spells/bagsim.js').FireSim | null }, sig: string }} props */
export function GunStats({ gun, sim, sig }) {
  const d = useMemo(() => gunModDeltas(gun), [sig]);
  const bars = useRef({});
  useEffect(() => {
    let raf;
    const loop = () => {
      const S = sim.current;
      if (S) {
        const gg = fireSimGauges(S);
        // the mana row is `manaMax`, its gauge `mana` (the bar never moved under the old key)
        for (const k in LIVE_BAR) if (bars.current[k]) bars.current[k].style.width = ((k === 'manaMax' ? gg.mana : gg[k]) * 100).toFixed(1) + '%';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const bar = (k, frac, col) => h('div', { className: 'gsbar' },
    h('i', { ref: LIVE_BAR[k] ? el => { bars.current[k] = el; } : undefined, 'data-live': LIVE_BAR[k] ? k : undefined,
      style: { width: (frac * 100).toFixed(1) + '%', background: col } }));
  return h('div', { className: 'gstats' },
    gun.lvl ? h('div', { className: 'gsrow' }, h('span', null, 'Level'),
      h('b', { style: { color: gunLvCol(gun) } }, 'Lv ' + gun.lvl)) : null,
    GS_ROWS.map(r => {
      const v = r.k === 'speedMul' ? (gun.speedMul || 1) : gun[r.k];
      const dv = d[r.k] || 0, show = r.dfmt && Math.abs(dv) > 0.005;
      const q = statQual(r.k, v);
      return h('div', { key: r.k, className: 'gsrow', 'data-stat': r.k },
        h('span', r.col ? { style: { color: r.col } } : null, r.label),
        h('b', { style: { color: healthCol(q) } }, r.fmt(v)),
        show ? h('u', { className: (dv > 0) === (r.better > 0) ? 'up' : 'down' },
          (dv > 0 ? '+' : '\u2212') + r.dfmt(Math.abs(dv))) : null,
        LIVE_BAR[r.k] ? bar(r.k, 1, LIVE_BAR[r.k]) : null);
    }));
}

// the gun's picture on its button, drawn with the same sprite as the one in your hands
/** @param {{ gun: Gun }} props */
export function GunIcon({ gun }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1, W = 64, H = 32;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sc = 2.7;
    drawGun(ctx, W / 2 - 3.85 * sc, H / 2 + 1 * sc, 0, sc, gunAccent(gun));
  });
  return h('canvas', { ref, className: 'gicon' });
}

// The firing window (owner, item 4): the selected gun, side on, firing what each pull of the
// fire preview fires, in time with the slot lights (it watches the same sim: S.fired / S.shots).
// The shots fly in world units at GF_ZOOM px each, slowed to GF_SPEED so they can be seen in
// the small window, and are drawn with the game's own looks (drawLook) or its streak. One rAF,
// gone when the Bag closes.
export const GF_ZOOM = 2.2, GF_SPEED = 0.2, GF_MAX = 90;
// the gun sways up and down (owner: shows bounces and homing off), once every GF_SWAY_S s, from aiming at the
// wall's top to its bottom: GF_SWAY of the window's height in from each end (owner: "almost reach" them)
export const GF_SWAY = 0.06, GF_SWAY_S = 4;
// the firing window's wall (owner): a strip of stone at the far right, world units wide, that nothing breaks.
// Shots stop on it (or bounce off), and a trigger's payload goes off there, so you can see what it does
export const GF_WALL = 5;
// a dummy you in front of the wall (owner): shots hit it and it flashes like you do when hurt, and never dies;
// homing shots steer for it. World units: GF_DUMMY_K (owner: 2/3) of the real you, GF_DUMMY_GAP in front of the wall
// GF_DPS_S: the seconds the DPS over the dummy's head averages over (owner: red, hidden at 0)
export const GF_DPS_S = 3;
// you, at the far left, holding the gun as the aim sways (owner: Follow Me has somewhere to come back to): your box
// GF_YOU_X in from the left; the gun held at the game's own size (GF_GUN = actors.js's 0.55)
export const GF_YOU_X = 3, GF_GUN = 0.55;
// Follow Me / Follow This pull this much harder in the window than in the game: the window is ~80 units across,
// less than a fast shot travels before the pull stops it, so without it they'd hit the wall before coming back
export const GF_FOLLOW_K = 3;
// the running DPS graph across the window's top third (owner): GF_GRAPH_S seconds of history, a sample every GF_GRAPH_DT
export const GF_GRAPH_S = 5, GF_GRAPH_DT = 0.1;
export const GF_DUMMY_GAP = 6, GF_DUMMY_K = 2 / 3, DW = PW * GF_DUMMY_K, DH = PH * GF_DUMMY_K;
/** @param {{ gun: Gun, sim: { current: import('../spells/bagsim.js').FireSim | null } }} props */
export function GunFire({ gun, sim }) {
  const ref = useRef(null);
  const gref = useRef(gun);
  gref.current = gun;
  useEffect(() => {
    let raf, last = performance.now(), seen = -1, seenS = null, flash = 0;
    /** @type {any[]} */
    let shots = [], beams = [];
    /** @type {any} */
    const fw = { time: 0 };
    /** @type {any[]} */
    let booms = [];
    let H = 0;
    const dummy = { x: 0, y: 0, hitT: 0, hits: 0 };
    // where Follow Me (you) and Follow This (ahead of the gun) go, set each frame
    const youAt = { x: 0, y: 0 }, ahead = { x: 0, y: 0 };
    // its damage, for the DPS over its head: [time, dmg] per hit, the last GF_DPS_S seconds (window time)
    /** @type {number[][]} */
    let dmgLog = [];
    /** @type {number[]} */
    let graph = [];
    let graphT = 0, dpsNow = 0;
    // the dummy's own little layer, DLP pixels a world unit (shrunk to 2/3 it would blur at one), made a hologram
    // like the guide's (render/guide.js holoPass)
    const DL = document.createElement('canvas'), dlx = DL.getContext('2d', { willReadFrequently: true }), DLP = 3;
    const DLW = Math.ceil((DW + 8) * DLP), DLH = Math.ceil((DH + 6) * DLP);
    DL.width = DLW; DL.height = DLH;
    // one spell out of (x, y) heading `base` (+ its own angle and spread): a shot, a beam or a field. A payload
    // (`sub`) leaves from where its carrier went off, not the muzzle
    /** @param {any} sh @param {number} x @param {number} y @param {number} base @param {boolean} sub */
    const launch = (sh, x, y, base, sub) => {
      const n = Math.max(1, sh.count || 1);
      for (let i = 0; i < n; i++) {
        const a = base + (sh.ang || 0) + (Math.random() - 0.5) * (sh.spread || 0) * Math.PI / 180
          + (n > 1 ? (i / (n - 1) - 0.5) * (sub ? 0.5 : 0.12) : 0);
        if (sh.beam) { beams.push({ a, x, y, col: sh.col, w: sh.size || 2, t: 0.15, max: 0.15 }); continue; }
        if (sh.still) { const fr = Math.min(H / GF_ZOOM * 0.4, sh.r || 12), at = sh.follow ? youAt : sh.followAim ? ahead : null;
          beams.push({ field: 1, x: at ? at.x : sub ? x : x + fr + 6, y: at ? at.y : y, r: Math.min(H / GF_ZOOM * 0.4, sh.r || 12), col: sh.col, t: 0.5, max: 0.5 }); continue; }
        const sp = sh.speed * GF_SPEED;
        if (shots.length >= GF_MAX * 2) return;
        shots.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: sh.size, col: sh.col,
          look: sh.look, spin: Math.random() * 6, grav: sh.grav || 0, explode: sh.explode, homing: sh.homing, follow: sh.follow || 0, followAim: sh.followAim || 0,
          pull: sh.pull, eat: sh.eat, hidden: sh.hidden, life: Math.min(12, (sh.life || 1) / GF_SPEED), bounce: sh.bounce || 0, pierce: sh.pierce || 0, hit: 0, dmg: sh.dmg || 0,
          trig: sh.trig, payload: sh.payload, timer: sh.trig === 'timer' ? (sh.timer || 0.5) / GF_SPEED : 0 });
      }
    };
    // a shot's moment: 'wall' (it hit the wall), 'life' (it ran out) or 'timer' (its timer, flying on). A death
    // blasts; a trigger's payload goes off on its own kind of moment (a hit trigger: the wall; expire: any death)
    /** @param {any} b @param {string} why @param {number} back the heading its payload leaves on */
    const burst = (b, why, back) => {
      if (why !== 'timer' && b.explode) booms.push({ x: b.x, y: b.y, r: Math.min(14, 3 + b.explode * 0.25), col: b.col, t: 0.3, max: 0.3 });
      const go = b.trig === 'timer' ? why === 'timer' : b.trig === 'hit' ? why === 'wall' : b.trig === 'expire' && why !== 'timer';
      if (go && b.payload && b.payload.length) {
        for (const p of b.payload) launch(p, b.x, b.y, back, true);
        const c = ref.current; if (c) c.dataset.payloads = String(+(c.dataset.payloads || 0) + 1);   // for the suite
      }
    };
    const loop = now => {
      raf = requestAnimationFrame(loop);
      const c = ref.current, S = sim.current, g = gref.current;
      if (!c) return;
      const dt = Math.min(0.1, (now - last) / 1000) * DEV.bagSpeed;
      last = now; fw.time += dt;
      const dpr = window.devicePixelRatio || 1, W = c.clientWidth;
      H = c.clientHeight;
      if (!W || !H) return;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      }
      const ctx = c.getContext('2d');
      // you at the far left (world units), the gun at the window's 0.55 height; home (PH × 0.4) is where Follow Me goes
      const gy = H * 0.55, hW = H / GF_ZOOM, youY = gy / GF_ZOOM - PH * 0.52, youX = GF_YOU_X;
      const home = { x: youX + PW / 2, y: youY + PH * 0.4 };
      // the aim sways slowly up and down; the hand and the muzzle turn with it round you
      const reach = W / GF_ZOOM - GF_WALL - home.x;
      const aUp = Math.atan2(hW * GF_SWAY - home.y, reach), aDn = Math.atan2(hW * (1 - GF_SWAY) - home.y, reach);
      const aim = (aUp + aDn) / 2 + (aDn - aUp) / 2 * Math.sin(fw.time * 2 * Math.PI / GF_SWAY_S), ca = Math.cos(aim), sa = Math.sin(aim);
      const hx = home.x + ca * 2.5, hy = youY + PH * 0.52;      // the gun hand, at the game's gun height (render/actors.js drawAim)
      const mx = hx + (14.2 * ca + 3.2 * sa) * GF_GUN, my = hy + (14.2 * sa - 3.2 * ca) * GF_GUN;   // the muzzle
      ahead.x = home.x + ca * FOLLOW_AHEAD; ahead.y = home.y + sa * FOLLOW_AHEAD; youAt.x = home.x; youAt.y = home.y;
      if (S !== seenS) { seenS = S; seen = S ? S.fired : -1; }
      if (S && S.fired !== seen) {                    // a pull went off: its shots leave the muzzle
        seen = S.fired; flash = 0.07;
        c.dataset.pulls = String(seen);                // for the suite: how many pulls it has shown
        for (const sh of S.shots) launch(sh, mx, my, aim, false);
        if (shots.length > GF_MAX) shots.splice(0, shots.length - GF_MAX);
      }
      // move
      const wW = W / GF_ZOOM, wH = H / GF_ZOOM, wallX = wW - GF_WALL;
      dummy.x = wallX - GF_DUMMY_GAP - DW; dummy.y = gy / GF_ZOOM - DH * 0.55; dummy.hitT = Math.max(0, dummy.hitT - dt);
      const dcx = dummy.x + DW / 2, dcy = dummy.y + DH / 2;
      dmgLog = dmgLog.filter(e => e[0] > fw.time - GF_DPS_S);
      const before = shots.length;
      /** @type {any[]} */
      const live = [];
      for (const b of shots) {
        b.vy += b.grav * GF_SPEED * GF_SPEED * dt;
        // Follow Me pulls it back to you, Follow This to the spot ahead of the gun: the game's pull (spells/paths.js
        // FOLLOW_PULL, no turning), in window units (× GF_SPEED²) and GF_FOLLOW_K × harder so it fits the window
        for (const [k, t] of [[b.follow, youAt], [b.followAim, ahead]]) if (k) {
          const dx = t.x - b.x, dy = t.y - b.y, d = Math.hypot(dx, dy) || 1;
          const sp0 = b.sp0 || (b.sp0 = Math.hypot(b.vx, b.vy) || 1), a = FOLLOW_PULL * k * GF_FOLLOW_K * GF_SPEED * GF_SPEED * dt;
          b.vx += dx / d * a; b.vy += dy / d * a;
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > sp0) { b.vx *= sp0 / sp; b.vy *= sp0 / sp; }
        }
        if (b.follow && !b.back && b.age > 0.5 && Math.hypot(b.x - youAt.x, b.y - youAt.y) < 8) {   // for the suite: one came back to you
          b.back = 1; ref.current.dataset.back = String(+(ref.current.dataset.back || 0) + 1);
        }
        b.age = (b.age || 0) + dt;
        if (b.homing) {                                  // turn toward the dummy, at the shot's turn rate (slowed with the window)
          const sp = Math.hypot(b.vx, b.vy), cur = Math.atan2(b.vy, b.vx);
          let d = Math.atan2(dcy - b.y, dcx - b.x) - cur;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          const turn = b.homing * GF_SPEED * dt, na = cur + Math.max(-turn, Math.min(turn, d));
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
        b.x += b.vx * dt; b.y += b.vy * dt; b.spin += dt * 10; b.life -= dt;
        const r = Math.max(0.5, (b.size || 1) * 0.5);
        if (b.hit <= 0 && b.x + r > dummy.x && b.x - r < dummy.x + DW && b.y + r > dummy.y && b.y - r < dummy.y + DH) {
          dummy.hitT = 0.3; dummy.hits++;                // it flashes like you do when hurt, and never dies
          if (b.dmg) dmgLog.push([fw.time, b.dmg]);
          ref.current.dataset.hits = String(dummy.hits);    // for the suite
          if (b.pierce > 0) { b.pierce--; b.hit = 0.25; }
          else { burst(b, 'wall', Math.PI - Math.atan2(b.vy, b.vx)); continue; }
        }
        if (b.hit > 0) b.hit -= dt;
        if (b.x + r >= wallX && b.vx > 0) {              // the wall: bounce off it, or stop there
          b.x = wallX - r;
          if (b.bounce > 0) { b.bounce--; b.vx = -b.vx; } else { burst(b, 'wall', Math.PI - Math.atan2(b.vy, b.vx)); continue; }
        }
        if (b.timer > 0 && (b.timer -= dt) <= 0) { burst(b, 'timer', Math.atan2(b.vy, b.vx)); b.payload = null; }
        if (b.life <= 0 || b.x < -10 || b.y < -10 || b.y > wH + 10) { if (b.life <= 0) burst(b, 'life', Math.atan2(b.vy, b.vx)); continue; }
        live.push(b);
      }
      shots = live.concat(shots.slice(before));          // payloads launched this frame join after
      if (shots.length > GF_MAX) shots.splice(0, shots.length - GF_MAX);
      for (const bm of beams) bm.t -= dt;
      beams = beams.filter(bm => bm.t > 0);
      for (const o of booms) o.t -= dt;
      booms = booms.filter(o => o.t > 0);
      flash -= dt;
      // draw
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.scale(GF_ZOOM, GF_ZOOM);
      /** @type {any} */
      const G = { ctx };
      ctx.lineCap = 'round';
      for (const bm of beams) {
        ctx.globalAlpha = bm.t / bm.max;
        if (bm.field) {
          ctx.fillStyle = bm.col; ctx.globalAlpha *= 0.35;
          ctx.beginPath(); ctx.arc(bm.x, bm.y, bm.r * (1.2 - bm.t / bm.max * 0.4), 0, 6.283); ctx.fill();
        } else {                                       // a beam stops at the wall
          const ca = Math.cos(bm.a), len = ca > 0.01 ? Math.min(wW, (wallX - bm.x) / ca) : wW;
          ctx.strokeStyle = bm.col; ctx.lineWidth = bm.w;
          ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x + ca * len, bm.y + Math.sin(bm.a) * len); ctx.stroke();
        }
      }
      for (const o of booms) {                          // a blast: a ring growing and fading
        const u = 1 - o.t / o.max;
        ctx.globalAlpha = (1 - u) * 0.8; ctx.fillStyle = o.col || '#ffb347';
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (0.4 + u * 0.6), 0, 6.283); ctx.fill();
      }
      for (const b of shots) {
        ctx.globalAlpha = 1;
        if (b.hidden) continue;
        if (b.pull) {                                  // Black Hole: dark core, purple rim
          ctx.fillStyle = '#050208'; ctx.beginPath(); ctx.arc(b.x, b.y, b.eat || b.size * 0.78, 0, 6.283); ctx.fill();
          ctx.strokeStyle = '#b98aff'; ctx.lineWidth = 1.2; ctx.stroke();
          continue;
        }
        if (b.look && drawLook(fw, G, b)) continue;
        const sp = Math.hypot(b.vx, b.vy) || 1, len = Math.max(0.5, Math.min(46, sp / GF_SPEED * 0.022));
        ctx.globalAlpha = 1; ctx.strokeStyle = b.col; ctx.lineWidth = b.size * 1.7;
        ctx.beginPath(); ctx.moveTo(b.x - b.vx / sp * len, b.y - b.vy / sp * len); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // the dummy you, facing the gun, flashing while hurt (the game's own flicker)
      ctx.globalAlpha = 1;
      // a hologram like the guide's: blue, scanlines, rolling bars; a hit flickers it and tears it like a glitch
      if (dlx) {
        dlx.setTransform(1, 0, 0, 1, 0, 0); dlx.clearRect(0, 0, DLW, DLH);
        dlx.setTransform(GF_DUMMY_K * DLP, 0, 0, GF_DUMMY_K * DLP, 4 * DLP, 3 * DLP);
        const hurt = dummy.hitT > 0;
        drawRunner(dlx, 0, 0, PW, PH, -1, null, false, 0, hurt && Math.floor(dummy.hitT * 30) % 2 === 0);
        dlx.setTransform(1, 0, 0, 1, 0, 0);
        holoPass(dlx, DLW, DLH, fw.time, hurt ? 0.4 + dummy.hitT * 2 : 0);
        ctx.save();
        ctx.globalAlpha = 0.85 * (hurt && Math.floor(dummy.hitT * 30) % 2 ? 0.45 : 1);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(DL, dummy.x - 4, dummy.y - 3, DLW / DLP, DLH / DLP);
        ctx.restore();
      }
      // its DPS over its head, red; gone while nothing's hitting it
      const dps = dpsNow = dmgLog.reduce((t, e) => t + e[1], 0) / GF_DPS_S;
      ref.current.dataset.dps = dps.toFixed(1);       // for the suite
      if (dps > 0) {
        ctx.save(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.font = '700 11px ui-monospace,SFMono-Regular,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        const txt = (dps >= 10 ? Math.round(dps) : dps.toFixed(1)) + ' dps';
        const tx = Math.min(dcx * GF_ZOOM, wallX * GF_ZOOM - ctx.measureText(txt).width / 2 - 2), ty = (dummy.y - 2) * GF_ZOOM;
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(txt, tx, ty);
        ctx.fillStyle = '#ff4a4a'; ctx.fillText(txt, tx, ty);
        ctx.restore();
      }
      // you, at the far left, the gun in hand on the sway (the game's own sprite and hold)
      ctx.globalAlpha = 1;
      // exactly as render/actors.js drawPlayer draws you: the body, then the gun on its own layer, both through the
      // pixel look (DEV.runnerPx, its outline DEV.runnerLine), smooth at 0
      const hands = { gun: { x: hx, y: hy }, torch: g ? { x: home.x + ca * 7, y: hy + sa * 5 - 0.5 } : null };
      const body = (/** @type {CanvasRenderingContext2D} */ c2) => drawRunner(c2, youX, youY, PW, PH, 1, null, false, 0, false, hands);
      const gunL = (/** @type {CanvasRenderingContext2D} */ c2) => { if (g) drawGun(c2, hx, hy, aim, GF_GUN, gunAccent(g)); };
      const rpx = DEV.runnerPx, rline = DEV.runnerLine > 0;
      if (rpx > 0) {
        pixelSprite(ctx, youX - 14, youY - 8, PW + 28, PH + 16, rpx, rline, body);
        if (g) pixelSprite(ctx, youX - 14, youY - 8, PW + 28, PH + 16, rpx, false, gunL);
      } else { body(ctx); gunL(ctx); }
      // the wall: grey stone blocks, offset every other row
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#4a4f5a'; ctx.fillRect(wallX, 0, GF_WALL + 1, wH);
      ctx.fillStyle = '#5c6270';
      for (let row = 0, y = 0; y < wH; row++, y += 3)
        for (let x = wallX + (row % 2 ? 1.5 : 0); x < wW; x += 3) ctx.fillRect(x + 0.25, y + 0.25, 2.5, 2.5);
      ctx.fillStyle = '#2b2f37'; ctx.fillRect(wallX - 0.4, 0, 0.4, wH);
      ctx.restore();
      ctx.globalAlpha = 1;
      if (flash > 0) {
        ctx.globalAlpha = Math.min(1, flash / 0.07);
        ctx.fillStyle = g ? gunAccent(g) : '#fff';
        ctx.beginPath(); ctx.arc((mx + ca) * GF_ZOOM, (my + sa) * GF_ZOOM, 2.5, 0, 6.283); ctx.fill();
        ctx.globalAlpha = 1;
      }
      // the DPS graph: a thin red line over everything in the top third, oldest at the left, scaled to its peak
      for (graphT += dt; graphT >= GF_GRAPH_DT; graphT -= GF_GRAPH_DT) graph.push(dpsNow);
      const keep = Math.round(GF_GRAPH_S / GF_GRAPH_DT) + 1;
      if (graph.length > keep) graph.splice(0, graph.length - keep);
      const peak = Math.max(...graph, 0);
      if (peak > 0 && graph.length > 1) {
        const top = 4, bot = H / 3, step = W / (keep - 1), x0 = W - (graph.length - 1) * step;
        ctx.strokeStyle = '#ff4a4a'; ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.9;
        ctx.beginPath();
        graph.forEach((v, i) => { const x = x0 + i * step, y = bot - (v / peak) * (bot - top); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      c.dataset.graph = String(graph.length);          // for the suite
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return h('canvas', { ref, className: 'gfire', 'data-fire': 1 });
}

// The gun's slots as a fixed grid: a mod stays exactly where you drop it. The fire preview
// (fireSimStep, trigger held) runs here at DEV.bagSpeed × real time; each pull lights the
// slots it fired in that pull's colour. Only re-renders when the lit set changes, so the
// Editor (and the advisor) never re-render per frame.
/** @param {{ gun: Gun, tile: (id: string | null, from: { type: string, i: number }, key: number | string) => any, sig: string, sim: { current: import('../spells/bagsim.js').FireSim | null } }} props */
export function SlotGrid({ gun, tile, sig, sim }) {
  const [lit, setLit] = useState(null);
  const steps = useMemo(() => pullSteps(gun), [sig]);
  useEffect(() => {
    let raf, last = performance.now(), prev = null;
    const loop = now => {
      const S = sim.current;
      const dt = Math.min(0.1, (now - last) / 1000) * DEV.bagSpeed;
      last = now;
      if (S) {
        // small sub-steps so a very fast gun still fires every pull it should
        for (let t = dt; t > 0; t -= 0.01) fireSimStep(S, Math.min(0.01, t));
        if (S.lit !== prev) { prev = S.lit; setLit(S.lit); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pullOf = new Array(gun.slots.length).fill(-1);
  if (steps) for (const st of steps) pullOf[st.slot] = st.pull;
  const on = new Set(lit ? lit.slots : []);
  const col = lit ? PULL_COL[lit.pull % PULL_COL.length] : null;
  return h(ScrollBox, { cls: 'slotRow' }, h('div', { className: 'mgrid' },
    gun.slots.map((id, i) => {
      const el = tile(id, { type: 'slot', i }, i);
      return React.cloneElement(el, { 'data-pull': pullOf[i],
          className: el.props.className + (id && steps && pullOf[i] < 0 ? ' cold' : '') },
        ...[].concat(el.props.children),
        on.has(i) ? h('i', { className: 'pulse on', style: { background: col, borderColor: col, color: col } }) : null);
    })));
}

// A scroll box with a bar down its right side you can grab: the mod tiles take a touch for
// dragging, so with a full grid there was nothing left to scroll by. Tap the bar to jump
// there, or drag the thumb. The thumb follows the box however it scrolled.
/** @param {{ cls: string, drop?: string, children?: any }} props */
export function ScrollBox({ cls, drop, children }) {
  const ref = useRef(null);
  const [t, setT] = useState({ top: 0, size: 1, show: false, on: false });
  useEffect(() => {
    const el = ref.current;
    const measure = () => {
      const H = el.scrollHeight, c = el.clientHeight, show = H > c + 1;
      const size = show ? Math.max(0.14, c / H) : 1;
      const top = show ? el.scrollTop / (H - c) * (1 - size) : 0;
      setT(o => o.show === show && Math.abs(o.size - size) < 0.002 && Math.abs(o.top - top) < 0.002 ? o
        : Object.assign({}, o, { top, size, show }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) { ro.observe(el); if (el.firstChild) ro.observe(el.firstChild); }
    return () => { el.removeEventListener('scroll', measure); if (ro) ro.disconnect(); };
  }, []);
  const grab = e => {
    e.preventDefault(); e.stopPropagation();
    const el = ref.current, bar = e.currentTarget.getBoundingClientRect();
    const size = t.size, thumb = size * bar.height, at = bar.top + t.top * bar.height;
    // held on the thumb: keep that grip; on the track: the thumb centres under the finger
    const off = e.clientY >= at && e.clientY <= at + thumb ? e.clientY - at : thumb / 2;
    const to = y => {
      const f = (y - off - bar.top) / Math.max(1, bar.height - thumb);
      el.scrollTop = Math.max(0, Math.min(1, f)) * (el.scrollHeight - el.clientHeight);
    };
    to(e.clientY);
    setT(o => Object.assign({}, o, { on: true }));
    const move = ev => to(ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setT(o => Object.assign({}, o, { on: false }));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  return h('div', { className: 'sbwrap ' + cls.split(' ')[0] + 'W', 'data-drop': drop },
    h('div', { ref, className: cls + ' scroll', 'data-drop': drop }, children),
    t.show ? h('div', { className: 'sbar' + (t.on ? ' on' : ''), onPointerDown: grab },
      h('i', { style: { top: t.top * 100 + '%', height: t.size * 100 + '%' } })) : null);
}

// the build advisor's suggested swaps are parked (v72): the dmg/s line still shows, the
// tip buttons don't. buildAdvice and the tip code are kept; flip this to bring them back.
export const SHOW_TIPS = false;

/** @param {{ input: { current: GameInput }, close: () => void, refresh: () => void, canEdit: boolean, tabs?: any }} props */
export function Editor({ input, close, refresh, canEdit, tabs }) {
  const LO = input.current.loadout;
  useEffect(() => { SFX.fx('open'); input.current.pickTarget = null; return () => SFX.fx('close'); }, []);   // opening the Bag cancels a Discriminate pick
  const [sel, setSel] = useState(LO.sel);
  const sim = useRef(null);
  const [drag, setDrag] = useState(null);
  const [info, setInfo] = useState(null);
  const [gdrag, setGdrag] = useState(null);
  const gun = LO.guns[sel];

  // DEBUG swaps your collection for a shelf holding one of every mod, and nothing
  // you drag off it is used up. Your own bag is left completely alone while it is
  // on, so switching back hands your real mods straight back — the ones you fitted
  // to a gun stay fitted, because they live on the gun, not in the bag.
  const bagIds = LO.debug ? ALL_IDS : LO.bag;
  const takeFromBag = i => { if (!LO.debug) LO.bag.splice(i, 1); };
  const returnToBag = id => { if (!LO.debug && id) LO.bag.push(id); };

  // one-shot reorder into the 8 colour families (same grouping as the legend
  // below), not a display toggle — the bag is already player-mutable state
  // (dragging reorders it too), so this is just another way to reorder it, and
  // it keeps the sort useful as a resting order rather than something to redo
  // every time the sheet reopens. Stable sort: mods keep their relative order
  // within a family.
  const famKeys = Object.keys(FAMILIES);
  const sortBag = () => {
    if (LO.debug) return;
    const rank = id => famKeys.indexOf(FAMILY_OF[id] || 'shots');
    LO.bag.sort((a, b) => rank(a) - rank(b));
    refresh();
  };

  // move a gun to another slot, keeping whatever you had selected selected
  const moveGun = (from, to) => {
    if (from === to) return;
    const held = LO.guns[LO.sel];
    const [g] = LO.guns.splice(from, 1);
    LO.guns.splice(to, 0, g);
    if (held) LO.sel = LO.guns.indexOf(held);
    setSel(LO.sel);
    refresh();
  };

  // tap selects; hold picks the gun up and dragging drops it on another slot
  const gunPress = i => e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let dragging = false, over = i;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    const timer = setTimeout(() => {
      if (!LO.guns[i] || !canEdit) return;           // nothing to pick up, or the bag is read-only
      dragging = true;
      setGdrag({ from: i, x: sx, y: sy, over: i });
    }, 320);
    const move = ev => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 14) { cleanup(); setGdrag(null); }
        return;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      /** @type {HTMLElement | null} */
      const tab = el && el.closest ? el.closest('[data-gun]') : null;
      if (tab) over = Number(tab.dataset.gun);
      setGdrag({ from: i, x: ev.clientX, y: ev.clientY, over });
    };
    const up = () => {
      cleanup();
      setGdrag(null);
      if (dragging) { if (canEdit) moveGun(i, over); }
      else if (LO.guns[i]) { setSel(i); LO.sel = i; refresh(); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const drop = (x, y, id, from) => {
    if (!canEdit) return;                 // outside the shop (and without Tinker) the bag is read-only
    SFX.fx('place');
    const el = document.elementFromPoint(x, y);
    /** @type {HTMLElement | null} */
    const node = el && el.closest ? el.closest('[data-drop]') : null;
    const to = node && node.dataset.drop;
    const g = LO.guns[sel];
    if (!to) return;
    if (to === 'bag') {
      if (from.type === 'slot' && g) { g.slots[from.i] = null; returnToBag(id); }
    } else if (to.slice(0, 5) === 'slot:' && g) {
      const k = Number(to.slice(5));
      if (from.type === 'bag') {
        takeFromBag(from.i);
        returnToBag(g.slots[k]);
        g.slots[k] = id;
      } else if (from.i !== k) {
        const swap = g.slots[k];
        g.slots[k] = id;
        g.slots[from.i] = swap;
      }
    }
    if (g) resetGun(g);
    refresh();
  };

  const SLOP = 7;                      // move further than this and it's a drag, not a tap
  const startDrag = (id, from) => e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    setDrag({ id, from, x: sx, y: sy, armed: false });
    const move = ev => setDrag(d => d && { id: d.id, from: d.from, x: ev.clientX, y: ev.clientY,
      armed: d.armed || Math.hypot(ev.clientX - sx, ev.clientY - sy) > SLOP });
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) <= SLOP) setInfo(cur => (cur === id ? null : id));
      else drop(ev.clientX, ev.clientY, id, from);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const tile = (id, from, key, n = 1) => {
    const m = id ? MODS[id] : null;
    return h('div', {
        key,
        className: 'tile' + (m ? '' : ' hole') + (m && m.kind === 'shot' ? ' shot' : ''),
        style: m ? { borderColor: famCol(id), color: famCol(id) } : null,
        'data-drop': from.type === 'slot' ? 'slot:' + from.i : 'bag',
        'data-mod': id || undefined,
        onPointerDown: m ? startDrag(id, from) : undefined,
      },
      m ? h('span', { className: 'tg' }, m.glyph) : h('span', { className: 'tg' }, '+'),
      tgtBadge(id),
      m ? h('span', { className: 'tn' }, m.name) : null,
      m && m.mark && n < 2 ? h('span', { className: 'tmark' }, m.mark) : null,
      n > 1 ? h('span', { className: 'tcount', 'data-n': n }, h('b', null, n)) : null   // a stack: how many copies
    );
  };

  const shown = info && MODS[info];

  // the backdrop closes the card, but a tap that lands on another mod switches to it
  const behind = e => {
    e.preventDefault();
    const el = e.currentTarget;
    el.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    el.style.pointerEvents = '';
    /** @type {HTMLElement | null} */
    const tile = under && under.closest ? under.closest('[data-mod]') : null;
    const next = tile && tile.dataset.mod;
    setInfo(next && next !== info ? next : null);
  };

  // restart the fire preview whenever the gun or its build changes
  const gsig = gun ? sel + '|' + gun.slots.join() + '|' + gun.multi + '|' + gun.shuffle + '|' + gun.castDelay + '|' + gun.recharge : '';
  if (!sim.current || sim.current.sig !== gsig) sim.current = gun ? Object.assign(fireSimNew(gun), { sig: gsig }) : null;
  // the dmg/s line: worked out when the build changes, not on every touch (a drag re-renders
  // per move); the swap tips, parked, aren't worked out at all
  const adv = useMemo(() => gun ? buildAdvice(gun, bagIds, SHOW_TIPS) : null,
    [gsig, SHOW_TIPS ? bagIds.join() : '']);

  const advice = gun && adv ? (() => {
    const apply = t => e => {
      e.preventDefault();
      if (t.kind === 'move') {
        const a = gun.slots[t.slot];
        gun.slots[t.slot] = gun.slots[t.other];
        gun.slots[t.other] = a;
      } else {
        const outgoing = gun.slots[t.slot];
        const k = bagIds.indexOf(t.id);
        if (k >= 0) takeFromBag(k);
        gun.slots[t.slot] = t.id;
        returnToBag(outgoing);
      }
      resetGun(gun);
      refresh();
    };
    return h('div', { className: 'advice' },
      h('div', { className: 'diag ' + adv.limit.key },
        h('b', null, adv.now.dps.toFixed(1) + ' dmg/s'), adv.limit.text),
      SHOW_TIPS && canEdit && adv.tips.length ? h('div', { className: 'tips' },
        adv.tips.map((t, k) => h('button', { key: k, className: 'tip', onPointerDown: apply(t) },
          t.kind === 'move'
            ? 'Swap slots ' + (t.slot + 1) + ' and ' + (t.other + 1)
            : (gun.slots[t.slot] ? 'Replace slot ' + (t.slot + 1) + ' with ' : 'Slot ' +
                (t.slot + 1) + ': ') + MODS[t.id].name,
          h('b', null, '×' + t.gain.toFixed(1) + ' dmg')))) : null);
  })() : null;

  const card = shown
    ? h('div', { key: 'card' },
        h('div', { className: 'shade', onPointerDown: behind }),
        h(ModCard, { id: info, onClose: () => setInfo(null), top: true,
          // an unset Discriminate in the bag: set its target with the world pointer (game/systems/gun.js)
          act: info === 'discrim' && !LO.debug && LO.bag.includes('discrim')
            ? { label: 'Set target', run: () => { input.current.pickTarget = LO.bag.indexOf('discrim'); close(); } } : null }))
    : null;

  return h('div', { className: 'sheet' + (shown ? ' withcard' : '') },
    h('div', { className: 'shead' },
      h('h2', null, 'Guns & Mods'),
      h('span', { className: 'purse' }, LO.gold + 'g'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Done')
    ),
    h('div', { className: 'btop' },
      gun ? h(GunStats, { gun, sim, sig: gsig }) : h('div', { className: 'gstats' }, h('p', { className: 'lab' }, 'No gun in this slot')),
      h(GunFire, { gun, sim })
    ),
    gun ? h('p', { className: 'lab' }, gun.shuffle
      ? 'On the gun — order is shuffled every recharge'
      : 'On the gun — fires left to right, row by row') : null,
    gun ? h(SlotGrid, { gun, tile, sig: gsig, sim }) : null,
    advice,
    h('div', { className: 'bagHead' },
      h('p', { className: 'lab' }, LO.debug
        ? 'Debug shelf — one of every mod, never used up'
        : 'Collected mods' + (LO.bag.length ? '' : ' — none yet, find them in the cave')),
      canEdit && !LO.debug && stackBag(LO.bag).length > 1 ? h('button', { className: 'sortBag',
          onPointerDown: e => { e.preventDefault(); sortBag(); } }, 'Sort') : null),
    h(ScrollBox, { cls: 'bag' + (LO.debug ? ' debug' : ''), drop: 'bag' },
      h('div', { className: 'mgrid' }, LO.debug
        ? bagIds.map((id, i) => tile(id, { type: 'bag', i }, 'b' + i))
        // one tile per stack (owner): a drag takes one copy out of it (its first, `i`)
        : stackBag(LO.bag).map(st => tile(st.id, { type: 'bag', i: st.i }, 's' + st.key, st.n)))
    ),
    // the gun buttons: a row under the mod grid (owner, item 4; they were a 2×2 by the stats)
    h('div', { className: 'gtabs gunrow' },
        LO.guns.map((g, i) => h('button', {
            key: i,
            'data-gun': i,
            className: 'gtab' + (g ? '' : ' empty') + (i === sel ? ' on' : '') +
              (gdrag && gdrag.from === i ? ' lifted' : '') +
              (gdrag && gdrag.over === i && gdrag.from !== i ? ' target' : ''),
            onPointerDown: gunPress(i),
          },
          h('span', { className: 'gname', style: g ? { color: gunColor(g) } : null }, g ? g.name : 'Empty'),
          g ? h(GunIcon, { gun: g }) : h('span', { className: 'gsub' }, '—')
        ))),
    h('div', { className: 'info' },
      canEdit
        ? 'Drag a mod to any slot. Tap one to see what it does. Hold a gun to reorder it.'
        : 'Viewing only — reach a shop, or take the Tinker perk, to change your setup. Tap a mod to see what it does.'),
    gdrag && LO.guns[gdrag.from] ? h('div', { className: 'gghost',
      style: { left: gdrag.x, top: gdrag.y } }, LO.guns[gdrag.from].name) : null,
    drag && drag.armed ? h('div', { className: 'ghost',
      style: { left: drag.x, top: drag.y, borderColor: famCol(drag.id), color: famCol(drag.id) } },
      MODS[drag.id].glyph) : null,
    tabs || null,
    card
  );
}
