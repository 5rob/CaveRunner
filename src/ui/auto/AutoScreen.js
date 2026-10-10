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
import { BAG_SLOTS, EXO_STATS, MAX_PLAYERS, fitExo, fitGun, fitMod, fitPerk, healRun, levelCleared, levelFailed, levelSeed, newRun,
  unfitExo, unfitMod, unfitPerk } from '../../auto/run.js';
import { loadAutoRun, saveAutoRun } from '../../auto/save.js';
import { EXO_NAMES, navBack, navOpen, navRow, navStart } from '../../auto/nav.js';
import { GunCard, ModCard, PerkCard } from '../cards.js';
import { GunIcon } from '../editor.js';
import { GlyphIcon, HelmetIcon, PixIcon } from './icons.js';
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
  const navRef = useRef(nav);
  navRef.current = nav;
  // stage 8b: dragging between the bag and the nav's slots, a tap's card
  const [, setV] = useState(0);
  /** @type {BagItem | null} */
  const noCard = null;
  const [card, setCard] = useState(noCard);
  /** @type {Drag | null} */
  const noDrag = null;
  const [drag, setDrag] = useState(noDrag);
  /** @type {{ current: Press | null }} */
  const press = useRef(null);
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
  const pressA = () => { SFX.unlock(); SFX.ui('tap'); if (scene.current && hubExit(scene.current)) SFX.fx('open'); };
  /** what the source item is: a bag slot's, or a nav slot's at the nav's level @param {DragSrc} src @returns {BagItem | null} */
  const srcItem = src => {
    if (src.from === 'bag') return run.bag[src.i] || null;
    const c = navRow(navRef.current, run, MAX_PLAYERS).cells[src.i];
    return (c && c.item) || null;
  };
  // a press on a tile: on the grab handle it may become a drag (past MOVE px); a release without one is a tap (its card);
  // a cancelled press (the browser took it for a scroll) does nothing
  /** @param {any} e @param {DragSrc} src */
  const down = (e, src) => {
    if (press.current || !srcItem(src)) return;
    const grab = !!(e.target && e.target.closest && e.target.closest('.agrab'));
    if (grab) e.preventDefault();
    /** @type {Press} */
    const p = { id: e.pointerId, x0: e.clientX, y0: e.clientY, src, grab, drag: false };
    press.current = p;
    const finish = () => {
      press.current = null;
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel);
    };
    /** @param {any} ev */
    const move = ev => {
      if (ev.pointerId !== p.id) return;
      if (!p.drag && Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) > MOVE) {
        if (!p.grab) { if (ev.pointerType === 'mouse') finish(); return; }
        p.drag = true;
        SFX.unlock(); SFX.ui('tap');
      }
      if (p.drag) { ev.preventDefault(); setDrag({ src, x: ev.clientX, y: ev.clientY, over: dropAt(src, ev.clientX, ev.clientY), back: false }); }
    };
    /** @param {any} ev */
    const up = ev => {
      if (ev.pointerId !== p.id) return;
      finish();
      if (p.drag) drop(src, ev.clientX, ev.clientY, p);
      else if (Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) <= MOVE) { const it = srcItem(src); if (it && hasCard(it)) { SFX.ui('tap'); setCard(it); } }
    };
    /** @param {any} ev */
    const cancel = ev => { if (ev.pointerId === p.id) { finish(); setDrag(null); } };
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
  };
  /** the drop target under a point, and whether this item fits there @param {DragSrc} src @param {number} x @param {number} y @returns {DropAt | null} */
  const dropAt = (src, x, y) => {
    const el = document.elementFromPoint(x, y);
    /** @type {HTMLElement | null} */
    const t = el && el.closest('[data-nslot],[data-gslot],.abag');
    const it = srcItem(src), n = navRef.current;
    if (!t || !it) return null;
    if (t.dataset.nslot !== undefined) {
      const s = Number(t.dataset.nslot);
      const ok = src.from === 'bag' && ((n.level === 'gun' && it.kind === 'mod') || (n.level === 'cat' && it.kind === 'exo' && it.cat === n.cat) ||
        (n.level === 'perks' && it.kind === 'perk' && !!it.id && !!PERKS[it.id] && !PERKS[it.id].stat));
      return { key: 'n' + s, to: 'nav', s, ok };
    }
    if (t.dataset.gslot !== undefined) {
      const s = Number(t.dataset.gslot);
      return { key: 'g' + s, to: 'gun', s, ok: src.from === 'bag' && n.level === 'guns' && it.kind === 'gun' };
    }
    return { key: 'bag', to: 'bag', s: -1, ok: src.from === 'nav' };
  };
  /** let go: the move on the run (saved), or the ghost springs back @param {DragSrc} src @param {number} x @param {number} y @param {Press} p */
  const drop = (src, x, y, p) => {
    const at = dropAt(src, x, y), n = navRef.current;
    let done = false;
    if (at && at.ok) {
      if (src.from === 'bag' && at.to === 'nav') {
        if (n.level === 'gun') done = fitMod(run, src.i, n.p, n.g, at.s);
        else if (n.level === 'cat') done = fitExo(run, src.i, n.p, n.cat, at.s);
        else if (n.level === 'perks') done = fitPerk(run, src.i, n.p, at.s);
      } else if (src.from === 'bag' && at.to === 'gun') done = fitGun(run, src.i, n.p, at.s);
      else if (src.from === 'nav' && at.to === 'bag') {
        if (n.level === 'gun') done = unfitMod(run, n.p, n.g, src.i);
        else if (n.level === 'cat') done = unfitExo(run, n.p, n.cat, src.i);
        else if (n.level === 'perks') done = unfitPerk(run, n.p, src.i);
      }
    }
    if (done) {
      saveAutoRun(run);
      SFX.fx('open');
      setDrag(null);
      setV(v => v + 1);
      return;
    }
    // refused: back to where it came from
    setDrag({ src, x: p.x0, y: p.y0, over: null, back: true });
    setTimeout(() => setDrag(d => d && d.back ? null : d), 170);
  };
  /** a nav circle tapped: one level down @param {string | number} w */
  const openNav = w => { nothing(); setNav(n => navOpen(n, w, run)); };
  return h('div', { className: 'auto' },
    h('div', { className: 'aplay' },
      h('canvas', { ref: cvs, className: 'aplaycvs' }),
      blocked ? h('div', { className: 'ablocked' }, 'Path blocked') : null,
      boss ? h('div', { className: 'abossbar' }, h('b', null, boss.name),
        h('div', { className: 'abosstrack' }, h('i', { style: { width: (100 * boss.hp / Math.max(1, boss.max)).toFixed(1) + '%' } }))) : null,
      h('button', { className: 'pausebtn', title: 'Pause', onPointerDown: tap(() => { SFX.fx('open'); setPaused(true); }) }, '⏸')),
    h(NavRow, { row: navRow(nav, run, MAX_PLAYERS), level: nav.level, open: openNav, down, drag }),
    h('div', { className: 'abag' + (drag && drag.over && drag.over.key === 'bag' && drag.over.ok ? ' drop' : '') },
      ...Array.from({ length: BAG_SLOTS }, (_, i) => h(BagSlot, { key: i, i, it: run.bag[i], down,
        lift: !!drag && drag.src.from === 'bag' && drag.src.i === i }))),
    h('div', { className: 'abtns' },
      h('button', { className: 'abtn ab', onPointerDown: tap(() => { nothing(); setNav(navBack); }) }, 'B'),
      h(PillStick, { onMove: steer }),
      h('button', { className: 'abtn aa', onPointerDown: tap(pressA) }, 'A')),
    drag ? h(Ghost, { drag, it: srcItem(drag.src) }) : null,
    card ? h(CardPop, { it: card, close: () => setCard(null) }) : null,
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
/** @param {{ row: import('../../auto/nav.js').NavRow, level: string, open: (w: string | number) => void, down: (e: any, src: DragSrc) => void, drag: Drag | null }} props */
function NavRow({ row, level, open, down, drag }) {
  const over = drag && drag.over && drag.over.ok ? drag.over.key : '';
  /** @param {import('../../auto/nav.js').NavCell} c @param {number} i */
  const cell = (c, i) => {
    const to = c.open;
    /** @param {any} e */
    const go = e => { e.preventDefault(); if (to !== undefined) open(to); };
    if (row.shape === 'slots') {
      const it = c.item || null;
      const lift = !!drag && drag.src.from === 'nav' && drag.src.i === i;
      /** @param {any} e */
      const grab = e => down(e, { from: 'nav', i });
      return h('div', { key: c.key, className: 'aslot anavs' + (it ? ' full k-' + it.kind : '') + (over === 'n' + i ? ' drop' : '') + (lift ? ' lift' : ''),
        'data-nslot': i, onPointerDown: it ? grab : undefined },
        it ? h(ItemIcon, { it }) : null, it ? h(Grab) : null);
    }
    const cls = 'anavc' + (c.dim ? ' locked' : ' on') + (c.sel ? ' sel' : '') + (c.gun ? ' gun' : '') + (over === 'g' + i ? ' drop' : '');
    const style = c.col && !c.dim ? { borderColor: c.col, boxShadow: '0 0 10px ' + (c.glow || c.col + '66') } : undefined;
    let inner = null;
    if (c.gun) inner = h(GunIcon, { gun: c.gun });
    else if (c.helm && c.col) inner = h(HelmetIcon, { col: c.col });     // a player: his helmet (owner)
    else if (c.icon) inner = h(PixIcon, { id: c.icon, size: 28 });      // themed pixel icons, not emoji (owner)
    else if (c.glyph) inner = h('span', { className: 'anavg' }, c.glyph);
    else if (c.label) inner = h('span', { className: 'anavp', style: { background: c.col } }, c.label);
    return h('div', { key: c.key, className: cls, 'data-player': level === 'players' ? i : undefined, 'data-open': c.open, 'data-gslot': level === 'guns' ? i : undefined,
      title: c.glyph ? c.label : undefined, style, onPointerDown: go }, inner);
  };
  return h('div', { className: 'anav l-' + level + (row.shape === 'slots' ? ' slots' : ''), 'data-level': level,
    style: row.col ? { borderColor: row.col, boxShadow: '0 0 12px ' + row.col + '55' } : undefined },
    row.shape === 'stats' ? h('span', { className: 'anavsoon' }, 'Stats — soon') : row.cells.map(cell));
}

// one bag slot: empty, or the item's icon and its count
/** @param {{ i: number, it: BagItem | null, down: (e: any, src: DragSrc) => void, lift: boolean }} props */
function BagSlot({ i, it, down, lift }) {
  /** @param {any} e */
  const grab = e => down(e, { from: 'bag', i });
  return h('div', { className: 'aslot' + (it ? ' full k-' + it.kind : '') + (lift ? ' lift' : ''), 'data-slot': i,
    onPointerDown: it ? grab : undefined },
    it ? h(ItemIcon, { it }) : null, it ? h(Grab) : null,
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
  return h('span', { className: 'aglyph' }, h(GlyphIcon, { glyph: g.glyph, col: g.col }),
    g.tier ? h('i', { className: 'atier' }, ROMAN[g.tier - 1]) : null);
}

// ---- stage 8b: drag and drop, the cards ----
/** @typedef {{ from: 'bag' | 'nav', i: number }} DragSrc */
/** @typedef {{ key: string, to: 'nav' | 'gun' | 'bag', s: number, ok: boolean }} DropAt */
/** @typedef {{ src: DragSrc, x: number, y: number, over: DropAt | null, back: boolean }} Drag */
/** @typedef {{ id: number, x0: number, y0: number, src: DragSrc, grab: boolean, drag: boolean }} Press */
// a press moving this far (px) is a drag (on the handle) or not a tap
const MOVE = 6;

// the grab handle: a circle round the tile's centre, DEV.autoGrab of the tile's width in radius (touch-action none:
// only it starts a drag; the rest of the tile scrolls the bag)
function Grab() {
  const d = (200 * DEV.autoGrab).toFixed(1) + '%';
  return h('i', { className: 'agrab', style: { width: d, height: d } });
}

// the dragged item, under the finger (a refused drop slides it home: .back)
/** @param {{ drag: Drag, it: BagItem | null }} props */
function Ghost({ drag, it }) {
  if (!it) return null;
  return h('div', { className: 'aslot full aghost k-' + it.kind + (drag.back ? ' back' : ''), style: { left: drag.x + 'px', top: drag.y + 'px' } },
    h(ItemIcon, { it }));
}

/** gold and gems have no card @param {BagItem} it */
const hasCard = it => (it.kind === 'mod' && !!it.id && !!MODS[it.id]) || (it.kind === 'gun' && !!it.gun) ||
  (it.kind === 'perk' && !!it.id && !!PERKS[it.id]) || (it.kind === 'exo' && !!it.cat && !!it.tier);

// a tapped item's card (the old Bag's: ModCard, GunCard, PerkCard; an exo mod's own small one), over a shade
/** @param {{ it: BagItem, close: () => void }} props */
function CardPop({ it, close }) {
  /** @param {any} e */
  const shut = e => { e.preventDefault(); close(); };
  let c = null;
  if (it.kind === 'mod' && it.id) c = h(ModCard, { id: it.id, top: true, onClose: close });
  else if (it.kind === 'gun' && it.gun) c = h(GunCard, { gun: it.gun, label: 'Bag', onClose: close });
  else if (it.kind === 'perk' && it.id) c = h(PerkCard, { id: it.id, top: true, onClose: close });
  else if (it.kind === 'exo' && it.cat && it.tier) c = h(ExoCard, { cat: it.cat, tier: it.tier, onClose: close });
  // (into the body, as ModPop: the cards take the page's colours, not the auto screen's)
  return ReactDOM.createPortal(h('div', { className: 'modpop acard' }, h('div', { className: 'shade', onPointerDown: shut }), c), document.body);
}

// an exo mod's card: its category, tier, and what it adds (STAT_PERKS, by its tier)
/** @param {{ cat: ExoCat, tier: number, onClose: () => void }} props */
function ExoCard({ cat, tier, onClose }) {
  const S0 = STAT_PERKS[EXO_STATS[cat][0]];
  /** @param {any} e */
  const shut = e => { e.preventDefault(); onClose(); };
  return h('div', { className: 'pop scroll top aexocard' },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: S0.tint } }, h(PixIcon, { id: cat, size: 26 })),
      h('div', { className: 'ptitle' },
        h('b', { style: { color: S0.tint } }, EXO_NAMES[cat] + ' ' + ROMAN[tier - 1]),
        h('span', null, 'Exo mod · tier ' + ROMAN[tier - 1] + ' of V · fits the suit’s ' + EXO_NAMES[cat] + ' slots')),
      h('button', { className: 'pclose', onPointerDown: shut }, '×')),
    ...EXO_STATS[cat].map(st => { const S = STAT_PERKS[st]; return h('p', { key: st, className: 'pinfo' }, S.say(S.vals[tier - 1])); }));
}
