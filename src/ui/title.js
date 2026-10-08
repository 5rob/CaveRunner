// @ts-check
// The title screen (LIST4 #4): the page opens on it. A full-screen canvas runs the action scene
// (art/titlescene.js) on one requestAnimationFrame, stopped when the title closes; over it the big
// CAVE RUNNER and a menu window: three save slots (each a summary of its run, or empty; 🗑️ then a
// red "Delete?" empties one), ▶ (continues the slot's run, or starts a new one in it) and ⚙ (the window turns
// into the settings: master, FX and music volume, × back; v0.0.174).
// Root picks the title or the game: the Game is only mounted after Start.
// The scene's camera (v0.0.168): pinch to zoom, drag to pan, tap a player to follow them, again to let go
// (art/titlescene.js titleCam); each visit its own seed, so its own zones.
// Its sound (v0.0.174): everything on screen with the game's own sounds (ui/titlesound.js).

import { SFX } from '../audio/sfx.js';
import { TITLE_VW, camAt, camClamp, camStep, camTap, titleBottom, titleCam, titleScene, titleStep, titleText } from '../art/titlescene.js';
import { titleDraw } from '../game/render/titledraw.js';
import { SLOTS, deleteSlot, getSlot, loadSlotSummary, setSlot } from '../save/save.js';
import { App } from './app.js';
import { titleSound, titleSoundStop } from './titlesound.js';
import { h, useEffect, useRef, useState } from './h.js';
import { fmtGold } from './hud.js';

// the title's top (css px)
/** @param {number} hh the screen's height */
const TOP = hh => Math.max(28, hh * 0.05);

/** @param {{ onStart: () => void }} props */
export function Title({ onStart }) {
  const cvs = useRef(null);
  const menu = useRef(null);
  const [slot, setSel] = useState(getSlot);
  const [sums, setSums] = useState(() => Array.from({ length: SLOTS }, (_, i) => loadSlotSummary(i + 1)));
  const [del, setDel] = useState(0);           // the slot whose 🗑️ was tapped once (asking "Delete?")
  const [setup, setSetup] = useState(false);   // the window shows the settings
  useEffect(() => {
    const c = cvs.current;
    if (!c) return undefined;
    const ctx = c.getContext('2d');
    let S = null, C = null, raf = 0, last = performance.now(), cw = 0, chh = 0;
    const loops = {};
    SFX.unlock();                                // the app plays at once; a browser waits for the first tap
    const seed = window.__TEST ? window.__TITLE_SEED || 7 : 1 + Math.floor(Math.random() * 1e6);
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dpr = Math.min(3, window.devicePixelRatio || 1), w = window.innerWidth, hh = window.innerHeight;
      if (w !== cw || hh !== chh) {
        cw = w; chh = hh;
        c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr);
        // the action keeps between the title and the menu window
        const k = w / TITLE_VW, mt = menu.current ? menu.current.getBoundingClientRect().top : hh * 0.6;
        S = titleScene(hh / k, seed, (titleBottom(w, TOP(hh)) + 14) / k, (mt - 10) / k);
        C = titleCam((S.top + S.bot) / 2, S.bot + 10 / k);
        if (window.__TEST) window.__title = { S, C };    // the browser suites' reach
        for (let i = 0; i < 40; i++) titleStep(S, 1 / 30);     // open on the action, not an empty cave
      }
      const now = performance.now(), dt = (now - last) / 1000;
      last = now;
      titleStep(S, dt);
      camStep(C, S, Math.min(dt, 0.1));
      titleSound(S, C, loops, Math.min(dt, 0.1));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      titleDraw(ctx, S, w, hh, C);
      titleText(ctx, S.t, w, TOP(hh));
      c.dataset.kills = String(S.kills);
      c.dataset.cam = [C.z.toFixed(2), C.x.toFixed(1), C.y.toFixed(1), C.lock].join(' ');
    };
    raf = requestAnimationFrame(frame);
    // the gestures: one finger drags (not while following a player), two pinch about their middle, a tap picks a player
    /** @type {Map<number, { x: number, y: number, x0: number, y0: number, t: number }>} */
    const P = new Map();
    let pinch = null, moved = false;
    const sk = () => cw / TITLE_VW;                                  // css px per screen unit
    /** @param {PointerEvent} e */
    const down = e => {
      e.preventDefault();
      SFX.unlock();
      P.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() });
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
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
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
      if (p && !moved && !P.size && C && performance.now() - p.t < 400) {
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
  }, []);
  const pick = n => { setSel(n); setDel(0); SFX.unlock(); SFX.fx('switch'); };
  const trash = n => {
    if (del !== n) { setDel(n); SFX.ui('poor'); return; }
    SFX.fx('shatter', null, null, 'stone');
    deleteSlot(n);
    setSums(s => s.map((v, i) => (i + 1 === n ? null : v)));
    setDel(0);
  };
  const start = () => { SFX.unlock(); SFX.fx('portalIn'); setSlot(slot); onStart(); };
  const gear = on => { SFX.unlock(); SFX.fx(on ? 'open' : 'close'); setSetup(on); setDel(0); };
  const sum = sums[slot - 1];
  /** @param {(e: any) => void} fn */
  const tap = fn => e => { e.preventDefault(); fn(e); };
  return h('div', { className: 'title' },
    h('canvas', { ref: cvs, className: 'titlecvs' }),
    h('div', { className: 'titlemenu' + (setup ? ' setup' : ''), ref: menu },
      setup ? h(Settings, { close: () => gear(false) }) : [
        h('div', { key: 'h', className: 'tmhead' }, 'SAVE SLOT'),
        ...Array.from({ length: SLOTS }, (_, i) => {
          const n = i + 1, s = sums[i];
          return h('div', { key: n, className: 'tslot' + (slot === n ? ' on' : '') + (s ? '' : ' empty'), 'data-slot': n,
            onPointerDown: tap(() => pick(n)) },
            h('b', { className: 'tsn' }, n),
            h('div', { className: 'tsinfo' },
              s ? h('span', null, 'Floor ' + s.floor) : null,
              s ? h('span', { className: 'tsgold' }, fmtGold(s.gold) + 'g') : null,
              s ? h('span', null, s.guns + (s.guns === 1 ? ' gun' : ' guns')) : null,
              s ? null : h('span', null, 'Empty — new run')),
            s ? h('button', { className: 'tdel' + (del === n ? ' ask' : ''), 'data-del': n,
              onPointerDown: e => { e.preventDefault(); e.stopPropagation(); trash(n); } }, del === n ? 'Delete?' : '🗑️') : null);
        }),
        h('div', { key: 'b', className: 'tbtns' },
          h('button', { className: 'tbig tgear', title: 'Settings', onPointerDown: tap(() => gear(true)) }, h(Cog)),
          h('button', { className: 'tbig tstart', title: sum ? 'Continue' : 'Start', 'data-new': sum ? '0' : '1', onPointerDown: tap(start) }, h(PlayIcon)))]));
}

// the bold play triangle and the cog, drawn (the emoji differ phone to phone)
const PlayIcon = () => h('svg', { viewBox: '0 0 40 40', width: 38, height: 38, 'aria-hidden': true },
  h('path', { d: 'M12 6 L34 20 L12 34 Z', fill: 'currentColor', stroke: 'currentColor', strokeWidth: 5, strokeLinejoin: 'round' }));
const Cog = () => h('svg', { viewBox: '0 0 40 40', width: 38, height: 38, 'aria-hidden': true },
  h('g', { fill: 'currentColor' },
    ...Array.from({ length: 8 }, (_, i) => h('rect', { key: i, x: 16.5, y: 2, width: 7, height: 10, rx: 1.5, transform: 'rotate(' + i * 45 + ' 20 20)' }))),
  h('circle', { cx: 20, cy: 20, r: 12.5, fill: 'currentColor' }),
  h('circle', { cx: 20, cy: 20, r: 5.5, fill: '#2a1a3e' }));

// The settings (v0.0.174): the three volumes, each kept (audio/sfx.js), × back to the slots
/** @param {{ close: () => void }} props */
function Settings({ close }) {
  const [v, setV] = useState(() => ({ master: SFX.volume, fx: SFX.fxVolume, music: SFX.musicVolume }));
  const SET = { master: SFX.setVolume, fx: SFX.setFxVolume, music: SFX.setMusicVolume };
  /** @param {'master' | 'fx' | 'music'} k @param {string} label */
  const row = (k, label) => {
    /** @param {any} e */
    const slide = e => {
      const x = Number(e.target.value) / 100;
      SET[k](x);
      setV(o => ({ ...o, [k]: x }));
      if (k !== 'music') SFX.fx('reelTick');
    };
    return h('label', { key: k, className: 'pvol tvol', 'data-vol': k },
      h('span', null, label, h('b', null, Math.round(v[k] * 100) + '%')),
      h('input', { type: 'range', min: 0, max: 100, step: 1, value: Math.round(v[k] * 100), className: 'volslider', onInput: slide, onChange: slide }));
  };
  return [
    h('div', { key: 'h', className: 'tmhead tsethead' }, 'SETTINGS',
      h('button', { className: 'tclose', title: 'Close', onPointerDown: e => { e.preventDefault(); close(); } }, '×')),
    row('master', 'Master'), row('fx', 'FX'), row('music', 'Music')];
}

// The page: the title first (every load), then the game. The browser test page skips the title
// (window.__TEST) unless a suite asks for it (window.__TEST_TITLE).
export function Root() {
  const [play, setPlay] = useState(() => !!window.__TEST && !window.__TEST_TITLE);
  return play ? h(App) : h(Title, { onStart: () => setPlay(true) });
}
