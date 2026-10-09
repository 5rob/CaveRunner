// @ts-check
// CaveRunner Auto's play screen (AUTOBATTLER.md stage 2), top to bottom: the play area (the menu's
// scene on a canvas, ui/scenecanvas.js runScene: the hub, auto/hub.js, with the run's players; ⏸ top right opens the pause
// menu), the context nav (the player row: a colour ring per player, an empty circle per locked one),
// the bag (10 rows × 7, scrolls up and down; the run's items with stack counts) and the buttons
// (B, <, >, A). In the hub (stage 3b) < and > walk the team between the stops (auto/hub.js hubGo), and A at the
// exit pad flashes it (hubExit; stage 4 starts the level from there). The nav and B do nothing yet (later stages).

import { SFX } from '../../audio/sfx.js';
import { TITLE_VW, titleCam } from '../../art/titlescene.js';
import { HUB_W, hubExit, hubGo, hubScene, hubStopX } from '../../auto/hub.js';
import { levelHold, levelScene } from '../../auto/level.js';
import { MODS } from '../../spells/mods.js';
import { PERKS, STAT_PERKS } from '../../data/perks.js';
import { BAG_SLOTS, EXO_GLYPH, EXO_STATS, MAX_PLAYERS, newRun } from '../../auto/run.js';
import { loadAutoRun, saveAutoRun } from '../../auto/save.js';
import { GunIcon } from '../editor.js';
import { PauseMenu } from '../pause.js';
import { runScene } from '../scenecanvas.js';
import { h, useEffect, useRef, useState } from '../h.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

// the run on screen: the save, or a new one (saved at once, so ⏸ → Exit and back finds it)
/** @returns {AutoRun} */
function openRun() {
  const r = loadAutoRun();
  if (r) return r;
  const n = newRun();
  saveAutoRun(n);
  return n;
}

export function AutoScreen() {
  const [run] = useState(openRun);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const cvs = useRef(null);
  /** @type {{ current: import('../../art/titlescene.js').TitleScene | null }} */
  const scene = useRef(null);
  const input = useRef({ saveRun: () => saveAutoRun(run) });
  useEffect(() => {
    const c = cvs.current;
    if (!c) return undefined;
    return runScene(c, {
      size: () => ({ w: c.clientWidth, hh: c.clientHeight }),
      make: (w, hh, seed) => {
        const k = w / TITLE_VW, vh = hh / k;
        // (stage 4a, until 4b wires the hub to it) a test flag opens a level straight away: window.__AUTO_LEVEL = its seed
        if (window.__AUTO_LEVEL) {
          const S = levelScene(vh, window.__AUTO_LEVEL, run.players.length);
          scene.current = S;
          return { S, C: titleCam(vh / 2, vh), warm: 0 };
        }
        // the run is in the hub (it always is, for now): the strip, the player teleporting in, the camera on him
        const S = hubScene(vh, seed, run.players.length, run.tier);
        scene.current = S;
        const C = titleCam(vh / 2, vh);
        C.w = HUB_W; C.zmin = TITLE_VW / HUB_W; C.x = hubStopX('enter') + 40; C.lock = 0;
        return { S, C, warm: 0 };
      },
      paused: () => pausedRef.current,
    });
  }, []);
  /** @param {() => void} fn @returns {(e: any) => void} */
  const tap = fn => e => { e.preventDefault(); fn(); };
  const nothing = () => { SFX.unlock(); SFX.ui('tap'); };
  /** @param {number} dir */
  const go = dir => () => { SFX.unlock(); SFX.ui('tap'); if (scene.current && scene.current.lvl) levelHold(scene.current, dir); else if (scene.current) hubGo(scene.current, dir); };
  // in a level < and > are held (auto/pilot.js: < stops, > hurries); letting go lets go
  const letGo = () => { if (scene.current && scene.current.lvl) levelHold(scene.current, 0); };
  const press = () => { SFX.unlock(); SFX.ui('tap'); if (scene.current && hubExit(scene.current)) SFX.fx('open'); };
  return h('div', { className: 'auto' },
    h('div', { className: 'aplay' },
      h('canvas', { ref: cvs, className: 'aplaycvs' }),
      h('button', { className: 'pausebtn', title: 'Pause', onPointerDown: tap(() => { SFX.fx('open'); setPaused(true); }) }, '⏸')),
    h('div', { className: 'anav' },
      ...Array.from({ length: MAX_PLAYERS }, (_, i) => {
        const p = run.players[i];
        return h('div', { key: i, className: 'anavc' + (p ? ' on' : ' locked'), 'data-player': i,
          style: p ? { borderColor: p.col, boxShadow: '0 0 10px ' + p.col + '66' } : undefined, onPointerDown: tap(nothing) },
          p ? h('span', { className: 'anavp', style: { background: p.col } }, i + 1) : null);
      })),
    h('div', { className: 'abag' },
      ...Array.from({ length: BAG_SLOTS }, (_, i) => h(BagSlot, { key: i, i, it: run.bag[i] }))),
    h('div', { className: 'abtns' },
      h('button', { className: 'abtn ab', onPointerDown: tap(nothing) }, 'B'),
      h('button', { className: 'abtn around al', onPointerDown: tap(go(-1)), onPointerUp: letGo, onPointerLeave: letGo, onPointerCancel: letGo }, '<'),
      h('button', { className: 'abtn around ar', onPointerDown: tap(go(1)), onPointerUp: letGo, onPointerLeave: letGo, onPointerCancel: letGo }, '>'),
      h('button', { className: 'abtn aa', onPointerDown: tap(press) }, 'A')),
    paused ? h(PauseMenu, { input, label: 'Tier ' + run.tier, close: () => { SFX.fx('close'); setPaused(false); } }) : null);
}

// one bag slot: empty, or the item's icon and its count
/** @param {{ i: number, it: BagItem | null }} props */
function BagSlot({ i, it }) {
  return h('div', { className: 'aslot' + (it ? ' full k-' + it.kind : ''), 'data-slot': i },
    it ? h(ItemIcon, { it }) : null,
    it && (it.n > 1 || it.kind === 'gold' || it.kind === 'red' || it.kind === 'green') ? h('b', { className: 'acount' }, it.n) : null);
}

/** @param {{ it: BagItem }} props */
function ItemIcon({ it }) {
  if (it.kind === 'gun' && it.gun) return h(GunIcon, { gun: it.gun });
  /** @type {{ glyph: string, col: string, tier?: number } | null} */
  let g = null;
  if (it.kind === 'mod') { const m = MODS[it.id || '']; g = m ? { glyph: m.glyph, col: m.col } : { glyph: '?', col: '#888' }; }
  else if (it.kind === 'exo') { const sp = STAT_PERKS[EXO_STATS[it.cat || 'hp'][0]]; g = { glyph: EXO_GLYPH[it.cat || 'hp'], col: sp.tint, tier: it.tier }; }
  else if (it.kind === 'perk') { const pk = PERKS[it.id || '']; g = pk ? { glyph: pk.glyph, col: pk.tint } : { glyph: '?', col: '#888' }; }
  else if (it.kind === 'gold') g = { glyph: '●', col: '#ffc93c' };
  else if (it.kind === 'red') g = { glyph: '◆', col: '#ff4f5e' };
  else if (it.kind === 'green') g = { glyph: '◆', col: '#5ee05a' };
  if (!g) return null;
  return h('span', { className: 'aglyph', style: { color: g.col, textShadow: '0 0 8px ' + g.col + '99' } }, g.glyph,
    g.tier ? h('i', { className: 'atier' }, ROMAN[g.tier - 1]) : null);
}
