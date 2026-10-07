// @ts-check
// The title screen (LIST4 #4): the page opens on it. A full-screen canvas runs the action scene
// (art/titlescene.js) on one requestAnimationFrame, stopped when the title closes; over it the big
// CAVE RUNNER and a menu window: three save slots (each a summary of its run, or empty; 🗑️ then a
// red "Delete?" empties one) and Start (continues the slot's run, or starts a new one in it).
// Root picks the title or the game: the Game is only mounted after Start.

import { SFX } from '../audio/sfx.js';
import { TITLE_VW, titleBottom, titleScene, titleStep, titleText } from '../art/titlescene.js';
import { titleDraw } from '../game/render/titledraw.js';
import { SLOTS, deleteSlot, getSlot, loadSlotSummary, setSlot } from '../save/save.js';
import { App } from './app.js';
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
  useEffect(() => {
    const c = cvs.current;
    if (!c) return undefined;
    const ctx = c.getContext('2d');
    let S = null, raf = 0, last = performance.now(), cw = 0, chh = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dpr = Math.min(3, window.devicePixelRatio || 1), w = window.innerWidth, hh = window.innerHeight;
      if (w !== cw || hh !== chh) {
        cw = w; chh = hh;
        c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr);
        // the action keeps between the title and the menu window
        const k = w / TITLE_VW, mt = menu.current ? menu.current.getBoundingClientRect().top : hh * 0.6;
        S = titleScene(hh / k, 7, (titleBottom(w, TOP(hh)) + 14) / k, (mt - 10) / k);
        for (let i = 0; i < 40; i++) titleStep(S, 1 / 30);     // open on the action, not an empty cave
      }
      const now = performance.now(), dt = (now - last) / 1000;
      last = now;
      titleStep(S, dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      titleDraw(ctx, S, w, hh);
      titleText(ctx, S.t, w, TOP(hh));
      c.dataset.kills = String(S.kills);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pick = n => { setSel(n); setDel(0); SFX.unlock(); SFX.fx('switch'); };
  const trash = n => {
    if (del !== n) { setDel(n); return; }
    deleteSlot(n);
    setSums(s => s.map((v, i) => (i + 1 === n ? null : v)));
    setDel(0);
  };
  const start = () => { SFX.unlock(); setSlot(slot); onStart(); };
  const sum = sums[slot - 1];
  /** @param {(e: any) => void} fn */
  const tap = fn => e => { e.preventDefault(); fn(e); };
  return h('div', { className: 'title' },
    h('canvas', { ref: cvs, className: 'titlecvs' }),
    h('div', { className: 'titlemenu', ref: menu },
      h('div', { className: 'tmhead' }, 'SAVE SLOT'),
      Array.from({ length: SLOTS }, (_, i) => {
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
      h('button', { className: 'tstart', onPointerDown: tap(start) }, sum ? '▶ CONTINUE' : '▶ START')));
}

// The page: the title first (every load), then the game. The browser test page skips the title
// (window.__TEST) unless a suite asks for it (window.__TEST_TITLE).
export function Root() {
  const [play, setPlay] = useState(() => !!window.__TEST && !window.__TEST_TITLE);
  return play ? h(App) : h(Title, { onStart: () => setPlay(true) });
}
