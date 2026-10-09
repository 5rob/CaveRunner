// @ts-check
// The title screen (LIST4 #4): the page opens on it. A full-screen canvas runs the action scene
// (art/titlescene.js, through ui/scenecanvas.js runScene: the loop, the sound and the camera's gestures)
// under the big CAVE RUNNER and a menu window. On the CaveRunner Auto branch the window holds only
// ⚙ (the window turns into the settings: master, FX and music volume, × back; v0.0.174) and ▶ (one save:
// AutoScreen opens the run, or starts one). Root picks the title or the auto screen.
// The scene's camera (v0.0.168): pinch to zoom, drag to pan, tap a player to follow them, again to let go
// (art/titlescene.js titleCam); each visit its own seed, so its own zones.
// Its sound (v0.0.174): everything on screen with the game's own sounds (ui/titlesound.js).

import { SFX } from '../audio/sfx.js';
import { TITLE_VW, titleBottom, titleCam, titleScene, titleText } from '../art/titlescene.js';
import { App } from './app.js';
import { AutoScreen } from './auto/AutoScreen.js';
import { runScene } from './scenecanvas.js';
import { Volumes } from './volume.js';
import { h, useEffect, useRef, useState } from './h.js';

// the title's top (css px)
/** @param {number} hh the screen's height */
const TOP = hh => Math.max(28, hh * 0.05);

/** @param {{ onStart: () => void }} props */
export function Title({ onStart }) {
  const cvs = useRef(null);
  const menu = useRef(null);
  const [setup, setSetup] = useState(false);   // the window shows the settings
  useEffect(() => {
    const c = cvs.current;
    if (!c) return undefined;
    return runScene(c, {
      size: () => ({ w: window.innerWidth, hh: window.innerHeight }),
      make: (w, hh, seed) => {
        // the action keeps between the title and the menu window
        const k = w / TITLE_VW, mt = menu.current ? menu.current.getBoundingClientRect().top : hh * 0.6;
        const S = titleScene(hh / k, seed, (titleBottom(w, TOP(hh)) + 14) / k, (mt - 10) / k);
        return { S, C: titleCam((S.top + S.bot) / 2, S.bot + 10 / k) };
      },
      over: (ctx, S, w, hh) => titleText(ctx, S.t, w, TOP(hh)),
    });
  }, []);
  const start = () => { SFX.unlock(); SFX.fx('portalIn'); onStart(); };
  /** @param {boolean} on */
  const gear = on => { SFX.unlock(); SFX.fx(on ? 'open' : 'close'); setSetup(on); };
  /** @param {(e: any) => void} fn */
  const tap = fn => e => { e.preventDefault(); fn(e); };
  return h('div', { className: 'title' },
    h('canvas', { ref: cvs, className: 'titlecvs' }),
    h('div', { className: 'titlemenu' + (setup ? ' setup' : ''), ref: menu },
      setup ? h(Settings, { close: () => gear(false) }) :
        h('div', { key: 'b', className: 'tbtns' },
          h('button', { className: 'tbig tgear', title: 'Settings', onPointerDown: tap(() => gear(true)) }, h(Cog)),
          h('button', { className: 'tbig tstart', title: 'Play', onPointerDown: tap(start) }, h(PlayIcon)))));
}

// the bold play triangle and the cog, drawn (the emoji differ phone to phone)
const PlayIcon = () => h('svg', { viewBox: '0 0 40 40', width: 38, height: 38, 'aria-hidden': true },
  h('path', { d: 'M12 6 L34 20 L12 34 Z', fill: 'currentColor', stroke: 'currentColor', strokeWidth: 5, strokeLinejoin: 'round' }));
const Cog = () => h('svg', { viewBox: '0 0 40 40', width: 38, height: 38, 'aria-hidden': true },
  h('g', { fill: 'currentColor' },
    ...Array.from({ length: 8 }, (_, i) => h('rect', { key: i, x: 16.5, y: 2, width: 7, height: 10, rx: 1.5, transform: 'rotate(' + i * 45 + ' 20 20)' }))),
  h('circle', { cx: 20, cy: 20, r: 12.5, fill: 'currentColor' }),
  h('circle', { cx: 20, cy: 20, r: 5.5, fill: '#2a1a3e' }));

// The settings (v0.0.174): the three volumes (ui/volume.js), × back to the slots
/** @param {{ close: () => void }} props */
function Settings({ close }) {
  return [
    h('div', { key: 'h', className: 'tmhead tsethead' }, 'SETTINGS',
      h('button', { className: 'tclose', title: 'Close', onPointerDown: e => { e.preventDefault(); close(); } }, '×')),
    h(Volumes, { key: 'v' })];
}

// The page: the title first (every load), then CaveRunner Auto (AutoScreen; its ⏸ → Exit reloads to the
// title). The old game (App) is mounted only by the browser test page without __TEST_TITLE, so the old
// game's suites keep running on this branch.
export function Root() {
  const [play, setPlay] = useState(false);
  if (window.__TEST && !window.__TEST_TITLE) return h(App);
  return play ? h(AutoScreen) : h(Title, { onStart: () => setPlay(true) });
}
