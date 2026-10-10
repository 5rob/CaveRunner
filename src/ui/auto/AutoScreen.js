// @ts-check
// CaveRunner Auto's play screen (AUTOBATTLER.md stage 2), top to bottom: the play area (the menu's
// scene on a canvas, ui/scenecanvas.js runScene: the hub, auto/hub.js, with the run's players; ⏸ top right opens the pause
// menu), the context nav (the player row: a colour ring per player, an empty circle per locked one),
// the bag (10 rows × 7, scrolls up and down; the run's items with stack counts) and the buttons
// (B, the pill stick, A). The pill stick (PillStick, owner after stage 4a) works as the old game's left thumbstick: in the
// hub it runs and jets player 1 anywhere in the room (auto/hub.js hubStick), in a level its sideways push hurries or
// slows the team (auto/level.js levelHold; it never stops them). A at the exit pad flashes it (hubExit; stage 4 starts
// the level from there). The context nav (stage 8a, auto/nav.js, NavRow below): players → a player's Guns / Exo suit /
// Perks / Stats → the slots; B goes back up a level. In a level, rock in the way that no gun in play
// can clear (auto/clear.js, stage 5b) stops the team and pulses a "Path blocked" hint over the play area. The arena's boss
// (auto/enemies.js, stage 6) shows its health bar over the top of the play area; every player fallen takes the team home.
// The boss's loot vacuumed, LEVEL CLEARED drops in over the play area (stage 7, art/cleared.js, runScene's over).

import { SFX } from '../../audio/sfx.js';
import { TITLE_VW, titleCam } from '../../art/titlescene.js';
import { DEAD } from '../../core/consts.js';
import { HUB_W, hubExit, hubLeft, hubScene, hubStick, hubStopX } from '../../auto/hub.js';
import { levelClearedAge, levelDone, levelHold, levelLost, levelScene, levelState } from '../../auto/level.js';
import { clearedText } from '../../art/cleared.js';
import { DEV } from '../../dev/knobs.js';
import { levelBoss } from '../../auto/enemies.js';
import { MODS } from '../../spells/mods.js';
import { PERKS, STAT_PERKS } from '../../data/perks.js';
import { BAG_SLOTS, EXO_GLYPH, EXO_STATS, MAX_PLAYERS, healRun, levelCleared, levelFailed, levelSeed, newRun } from '../../auto/run.js';
import { loadAutoRun, saveAutoRun } from '../../auto/save.js';
import { navBack, navOpen, navRow, navStart } from '../../auto/nav.js';
import { GunIcon } from '../editor.js';
import { HelmetIcon, PixIcon } from './icons.js';
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
  // where the team is: the hub, or the run's level (A at the exit pad; the level's exit pad brings it home)
  const where = useRef(window.__AUTO_LEVEL ? 'level' : 'hub');
  // the level's "Path blocked" (stage 5b), read off the scene a few times a second
  const [blocked, setBlocked] = useState(false);
  // the boss's health bar (stage 6): { hp, max, name } while it's in the arena and alive
  /** @type {{ hp: number, max: number, name: string } | null} */
  const noBoss = null;
  const [boss, setBoss] = useState(noBoss);
  const [, setBagV] = useState(0);
  // the context nav (stage 8a, auto/nav.js): a tap on a circle goes down a level, B back up one
  const [nav, setNav] = useState(navStart);
  useEffect(() => {
    const id = setInterval(() => {
      const L = scene.current && levelState(scene.current);
      setBlocked(!!(L && L.blocked));
      if (L) setBagV(L.bagV);   // drops went into the bag: redraw it

      const b = scene.current ? levelBoss(scene.current) : null;
      setBoss(o => (!b && !o) || (b && o && b.hp === o.hp && b.max === o.max) ? o : b);
    }, 200);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const c = cvs.current;
    if (!c) return undefined;
    return runScene(c, {
      size: () => ({ w: c.clientWidth, hh: c.clientHeight }),
      make: (w, hh, seed) => {
        const k = w / TITLE_VW, vh = hh / k;
        // the level: the run's (a test flag opens one straight away: window.__AUTO_LEVEL = its seed); full heal at its start
        if (where.current === 'level') {
          healRun(run);
          saveAutoRun(run);
          const S = levelScene(vh, window.__AUTO_LEVEL || levelSeed(run), run.players.length, undefined, run.players, run.tier, run);
          scene.current = S;
          if (window.__TEST_TITLE) window.__autoScene = S;   // the shot scripts (tools/clearshots.js) reach the level here
          return { S, C: titleCam(vh / 2, vh), warm: 0 };
        }
        // the hub: the strip, the players teleporting in, the camera on player 1
        const S = hubScene(vh, seed, run.players.length, run.tier);
        scene.current = S;
        const C = titleCam(vh / 2, vh);
        C.w = HUB_W; C.zmin = TITLE_VW / HUB_W; C.x = hubStopX('enter') + 40; C.lock = 0;
        return { S, C, warm: 0 };
      },
      paused: () => pausedRef.current,
      // LEVEL CLEARED (stage 7), in the upper part of the play area
      over: (ctx, S, w, hh) => { const a = levelClearedAge(S); if (a >= 0) clearedText(ctx, a, DEV.autoClearT, w, hh * 0.14); },
      // through the exit pad: to the level; the level's exit pad: home, tier + 1, healed (saved); everyone fallen: home, same tier
      next: S => {
        if (where.current === 'hub' && hubLeft(S)) { where.current = 'level'; return true; }
        if (where.current === 'level' && levelDone(S)) {
          where.current = 'hub';
          window.__AUTO_LEVEL = 0;
          levelCleared(run);
          saveAutoRun(run);
          return true;
        }
        if (where.current === 'level' && levelLost(S)) {
          where.current = 'hub';
          window.__AUTO_LEVEL = 0;
          levelFailed(run);
          saveAutoRun(run);
          return true;
        }
        return false;
      },
    });
  }, []);
  /** @param {() => void} fn @returns {(e: any) => void} */
  const tap = fn => e => { e.preventDefault(); fn(); };
  const nothing = () => { SFX.unlock(); SFX.ui('tap'); };
  // the pill stick's push, to the scene: the hub's free roam, a level's pace (the push past the dead zone, sideways)
  /** @param {PillState} st */
  const steer = st => {
    const S = scene.current;
    if (!S) return;
    if (S.lvl) levelHold(S, st.active && st.mag > DEAD ? st.nx * (st.mag - DEAD) / (1 - DEAD) : 0);
    else hubStick(S, st);
  };
  const press = () => { SFX.unlock(); SFX.ui('tap'); if (scene.current && hubExit(scene.current)) SFX.fx('open'); };
  /** a nav circle tapped: one level down @param {string | number} w */
  const openNav = w => { nothing(); setNav(n => navOpen(n, w, run)); };
  return h('div', { className: 'auto' },
    h('div', { className: 'aplay' },
      h('canvas', { ref: cvs, className: 'aplaycvs' }),
      blocked ? h('div', { className: 'ablocked' }, 'Path blocked') : null,
      boss ? h('div', { className: 'abossbar' }, h('b', null, boss.name),
        h('div', { className: 'abosstrack' }, h('i', { style: { width: (100 * boss.hp / Math.max(1, boss.max)).toFixed(1) + '%' } }))) : null,
      h('button', { className: 'pausebtn', title: 'Pause', onPointerDown: tap(() => { SFX.fx('open'); setPaused(true); }) }, '⏸')),
    h(NavRow, { row: navRow(nav, run, MAX_PLAYERS), level: nav.level, open: openNav }),
    h('div', { className: 'abag' },
      ...Array.from({ length: BAG_SLOTS }, (_, i) => h(BagSlot, { key: i, i, it: run.bag[i] }))),
    h('div', { className: 'abtns' },
      h('button', { className: 'abtn ab', onPointerDown: tap(() => { nothing(); setNav(navBack); }) }, 'B'),
      h(PillStick, { onMove: steer }),
      h('button', { className: 'abtn aa', onPointerDown: tap(press) }, 'A')),
    paused ? h(PauseMenu, { input, label: 'Tier ' + run.tier, close: () => { SFX.fx('close'); setPaused(false); } }) : null);
}

// PillState: as the old game's left stick (ui/hud.js Stick): active while held; dx, dy the finger from the middle as a
// share of the pill's half-width and half-height (so a small push up reads as up); mag their length (0-1, clamped), nx, ny
// its direction
/** @typedef {{ active: boolean, nx: number, ny: number, mag: number, dx: number, dy: number }} PillState */
const PILL_REST = { active: false, nx: 0, ny: 0, mag: 0, dx: 0, dy: 0 };

// The pill stick: one pill between B and A; a knob in it follows the finger (clamped to the pill, a little up and down
// too). Pointer capture, so the finger may wander off it; letting go puts the knob back and the push to rest
/** @param {{ onMove: (st: PillState) => void }} props */
function PillStick({ onMove }) {
  const ref = useRef(null);
  const pid = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, jet: false });
  /** @param {any} e */
  const update = e => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect(), kr = r.height * 0.36;
    const hw = Math.max(1, r.width / 2 - kr), hh = Math.max(1, r.height / 2 - kr * 0.55);
    let dx = (e.clientX - (r.left + r.width / 2)) / hw, dy = (e.clientY - (r.top + r.height / 2)) / hh;
    const d = Math.hypot(dx, dy);
    if (d > 1) { dx /= d; dy /= d; }
    const mag = Math.min(1, d);
    /** @type {PillState} */
    const st = { active: true, nx: d ? dx / Math.max(d, 1e-6) : 0, ny: d ? dy / Math.max(d, 1e-6) : 0, mag, dx, dy };
    onMove(st);
    setKnob({ x: dx * hw, y: dy * Math.min(hh, 7), jet: dy < 0 && mag > DEAD });
  };
  /** @param {any} e */
  const down = e => {
    e.preventDefault();
    if (pid.current !== null) return;
    pid.current = e.pointerId;
    SFX.unlock();
    try { ref.current.setPointerCapture(e.pointerId); } catch (_) { /* (a synthetic event: no capture) */ }
    update(e);
  };
  /** @param {any} e */
  const move = e => { if (e.pointerId === pid.current) update(e); };
  /** @param {any} e */
  const end = e => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    onMove(PILL_REST);
    setKnob({ x: 0, y: 0, jet: false });
  };
  return h('div', { ref, className: 'apill', onPointerDown: down, onPointerMove: move, onPointerUp: end, onPointerCancel: end },
    h('div', { className: 'apillknob' + (knob.jet ? ' jet' : ''), style: { transform: 'translate(' + knob.x + 'px,' + knob.y + 'px)' } }));
}

// The context nav's row (auto/nav.js navRow): circles for choices (a player's ring and number, a menu glyph, a gun's
// sprite), square tiles for slots (the bag's tile look; a gun's mod row scrolls sideways when it has more than fit).
// Below the top the row's edge takes the tapped player's colour. Same height at every level (style.css .anav).
/** @param {{ row: import('../../auto/nav.js').NavRow, level: string, open: (w: string | number) => void }} props */
function NavRow({ row, level, open }) {
  /** @param {import('../../auto/nav.js').NavCell} c @param {number} i */
  const cell = (c, i) => {
    const to = c.open;
    /** @param {any} e */
    const go = e => { e.preventDefault(); if (to !== undefined) open(to); };
    if (row.shape === 'slots') {
      const it = c.item || null;
      return h('div', { key: c.key, className: 'aslot anavs' + (it ? ' full k-' + it.kind : ''), 'data-nslot': i },
        it ? h(ItemIcon, { it }) : null);
    }
    const cls = 'anavc' + (c.dim ? ' locked' : ' on') + (c.sel ? ' sel' : '') + (c.gun ? ' gun' : '');
    const style = c.col && !c.dim ? { borderColor: c.col, boxShadow: '0 0 10px ' + c.col + '66' } : undefined;
    let inner = null;
    if (c.gun) inner = h(GunIcon, { gun: c.gun });
    else if (c.helm && c.col) inner = h(HelmetIcon, { col: c.col });     // a player: his helmet (owner)
    else if (c.icon) inner = h(PixIcon, { id: c.icon, size: 28 });      // themed pixel icons, not emoji (owner)
    else if (c.glyph) inner = h('span', { className: 'anavg' }, c.glyph);
    else if (c.label) inner = h('span', { className: 'anavp', style: { background: c.col } }, c.label);
    return h('div', { key: c.key, className: cls, 'data-player': level === 'players' ? i : undefined, 'data-open': c.open,
      title: c.glyph ? c.label : undefined, style, onPointerDown: go }, inner);
  };
  return h('div', { className: 'anav l-' + level + (row.shape === 'slots' ? ' slots' : ''), 'data-level': level,
    style: row.col ? { borderColor: row.col, boxShadow: '0 0 12px ' + row.col + '55' } : undefined },
    row.shape === 'stats' ? h('span', { className: 'anavsoon' }, 'Stats — soon') : row.cells.map(cell));
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
  else if (it.kind === 'exo') {
    return h('span', { className: 'aglyph' }, h(PixIcon, { id: it.cat || 'hp', size: 26 }), it.tier ? h('i', { className: 'atier' }, ROMAN[it.tier - 1]) : null);
  }
  else if (it.kind === 'perk') { const pk = PERKS[it.id || '']; g = pk ? { glyph: pk.glyph, col: pk.tint } : { glyph: '?', col: '#888' }; }
  else if (it.kind === 'gold') g = { glyph: '●', col: '#ffc93c' };
  else if (it.kind === 'red') g = { glyph: '◆', col: '#ff4f5e' };
  else if (it.kind === 'green') g = { glyph: '◆', col: '#5ee05a' };
  if (!g) return null;
  return h('span', { className: 'aglyph', style: { color: g.col, textShadow: '0 0 8px ' + g.col + '99' } }, g.glyph,
    g.tier ? h('i', { className: 'atier' }, ROMAN[g.tier - 1]) : null);
}
