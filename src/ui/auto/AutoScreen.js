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
// Stage 10a (throwPress): in the hub, gold and gems from the bag thrown up into the play area at the machines (auto/throw.js):
// a flick throws one, moved away and held streams them (the whole-stack lump was removed, feedback round 1).

import { SFX } from '../../audio/sfx.js';
import { TITLE_VW, camAt, titleCam } from '../../art/titlescene.js';
import { DEAD } from '../../core/consts.js';
import { chestOpen } from '../../auto/chests.js';
import { HUB_W, hubExit, hubLeft, hubScene, hubState, hubStick, hubStopX } from '../../auto/hub.js';
import { hubThrow, screenToWorldVel, throwable } from '../../auto/throw.js';
import { levelClearedAge, levelDone, levelHold, levelLost, levelScene, levelState } from '../../auto/level.js';
import { clearedText } from '../../art/cleared.js';
import { DEV } from '../../dev/knobs.js';
import { levelBoss } from '../../auto/enemies.js';
import { MODS, famCol } from '../../spells/mods.js';
import { HUB_MACHINES } from '../../auto/hub.js';
import { PERKS, STAT_PERKS } from '../../data/perks.js';
import { BAG_SLOTS, EXO_STATS, MAX_PLAYERS, addPlayer, bagAdd, fitExo, fitGun, fitMod, fitPerk, healRun, levelCleared, levelFailed, levelSeed, kitMissing, newRun, bagMove, rowMove, rowToBag,
  scrapAt, setActive, spend, unfitExo, unfitMod, unfitPerk } from '../../auto/run.js';
import { loadAutoRun, saveAutoRun } from '../../auto/save.js';
import { EXO_NAMES, arcPick, gunArc, navBack, navOpen, navRow, navStart } from '../../auto/nav.js';
import { meterTail, nextSpan } from '../../auto/meters.js';
import { CARD_ICON, GunCard, ModCard, PerkCard } from '../cards.js';
import { GunIcon } from '../editor.js';
import { GlyphIcon, HelmetIcon, PixIcon } from './icons.js';
import { PauseMenu } from '../pause.js';
import { runScene } from '../scenecanvas.js';
import { leaveItem } from '../../art/titlescene.js';
import { sceneAddRunner } from '../../auto/addrunner.js';
import { bagFits, lootCol } from '../../auto/loot.js';
import { h, useEffect, useRef, useState } from '../h.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

// the run on screen: the save, or a new one (saved at once, so ⏸ → Exit and back finds it)
/** @returns {AutoRun} */
function openRun() {
  const r = loadAutoRun();
  if (r) return kitMissing(r);
  const n = newRun();
  saveAutoRun(n);
  return n;
}

// ⏸ → New run (confirmed): a fresh run replaces the save, and the page reloads to the title (▶ opens it)
function freshRun() {
  saveAutoRun(newRun());
  location.reload();
}

export function AutoScreen() {
  const [run] = useState(openRun);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const cvs = useRef(null);
  /** @type {{ current: import('../../art/titlescene.js').TitleScene | null }} */
  const scene = useRef(null);
  /** @type {{ current: import('../../art/titlescene.js').TitleCam | null }} */
  const cam = useRef(null);
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
  // stage 9: the gun arc (a held helmet: player p's 4 gun circles at pts, hi the one under the finger) and a scrap's
  // coin burst (at x, y on screen, k its key)
  /** @type {{ p: number, pts: { x: number, y: number }[], hi: number } | null} */
  const noArc = null;
  const [arc, setArc] = useState(noArc);
  /** @type {{ x: number, y: number, n: number, k: number } | null} */
  const noBurst = null;
  const [burst, setBurst] = useState(noBurst);
  useEffect(() => {
    const paidV = { current: 0 }, bagV = { current: 0 };
    const id = setInterval(() => {
      const L = scene.current && levelState(scene.current);
      setBlocked(!!(L && L.blocked));
      if (L) setBagV(L.bagV);   // drops went into the bag: redraw it
      // stage 13: and save it, so a quit mid-level resumes in the hub with the bag kept
      if (L && L.bagV !== bagV.current) { bagV.current = L.bagV; saveAutoRun(run); }
      // stage 10a: thrown things the machines didn't take, home: back into the bag
      const H = scene.current && !scene.current.lvl ? hubState(scene.current) : null;
      if (H && H.back.length) { for (const b of H.back.splice(0)) bagAdd(run, { kind: b.kind, n: b.n }); saveAutoRun(run); setV(v => v + 1); }
      // stage 10b: something went into a machine or a machine paid out: the run's run.paid changed, save it
      if (H && H.paidV !== paidV.current) { paidV.current = H.paidV; saveAutoRun(run); }

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
          const C = titleCam(vh / 2, vh);
          cam.current = C;
          return { S, C, warm: 0 };
        }
        // the hub: the strip, the players teleporting in, the camera on player 1
        const S = hubScene(vh, seed, run.players.length, run.tier, run.paid || (run.paid = {}));
        scene.current = S;
        if (window.__TEST_TITLE) window.__autoHub = S;   // tests and shot scripts reach the hub (stage 12)
        // stage 10b: the machines' payouts fly into the bag (titlescene.js stepLoot); the bag full, they wait on the floor
        if (S.hub) { S.hub.fits = (_S, it) => bagFits(run, it); S.hub.take = (_S, it) => { if (bagAdd(run, it)) return false; saveAutoRun(run); setV(v => v + 1); return true; }; }
        const C = titleCam(vh / 2, vh);
        C.w = HUB_W; C.zmin = TITLE_VW / HUB_W; C.x = hubStopX('enter') + 40; C.lock = 0;
        cam.current = C;
        return { S, C, warm: 0 };
      },
      paused: () => pausedRef.current,
      // LEVEL CLEARED (stage 7), in the upper part of the play area
      over: (ctx, S, w, hh) => { const a = levelClearedAge(S); if (a >= 0) clearedText(ctx, a, DEV.autoClearT, w, hh * 0.14); },
      // through the exit pad: to the level; the level's exit pad: home, tier + 1, healed (saved); everyone fallen: home, same tier
      next: S => {
        if (where.current === 'hub' && hubLeft(S)) {
          // anything still thrown (not taken) goes back into the bag
          const H = hubState(S);
          if (H) { for (const g of H.thrown) bagAdd(run, { kind: g.kind, n: g.n }); for (const b of H.back) bagAdd(run, { kind: b.kind, n: b.n }); H.thrown = []; H.back = []; saveAutoRun(run); }
          // a machine's payout still on its way (or waiting for room): into the bag if it fits
          if (S.loot) { for (const g of S.loot.splice(0)) bagAdd(run, g.it); saveAutoRun(run); }
          where.current = 'level'; return true;
        }
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
  const pressA = () => { SFX.unlock(); SFX.ui('tap'); if (scene.current && (hubExit(scene.current) || (!!scene.current.lvl && chestOpen(scene.current)))) SFX.fx('open'); };
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
    const S0 = scene.current;
    if (grab && src.from === 'bag' && throwable(srcItem(src)) && S0 && S0.hub && !S0.lvl && cvs.current && cam.current) { throwPress(e, src); return; }
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
  // stage 10a: a press on a gold or gem stack in the hub (auto/throw.js). Moved past MOVE it's a swipe: let go fast (DEV.autoFlickMin
  // px / s) it flicks one out on the finger's velocity; held still (DEV.autoStreamWait) away from the stack it streams them in
  // the direction moved, speed × the distance (autoStreamK), the rate ramping up (autoStreamRate0 → 1 over autoStreamRamp).
  // Each one thrown leaves the bag (spend) and is saved
  /** @param {any} e @param {DragSrc} src */
  const throwPress = (e, src) => {
    e.preventDefault();
    const it = run.bag[src.i], c = cvs.current, S = scene.current;
    if (!it || !c || !S) return;
    /** @type {'gold' | 'red' | 'green'} */
    const kind = it.kind === 'red' ? 'red' : it.kind === 'green' ? 'green' : 'gold';
    const id = e.pointerId, x0 = e.clientX, y0 = e.clientY;
    /** @type {Press} */
    const p = { id, x0, y0, src, grab: true, drag: false };
    press.current = p;
    let mode = 'press', fx = x0, fy = y0, stillAt = performance.now(), sx = x0, sy = y0, t0 = 0, acc = 0, last = performance.now();
    /** @type {{ x: number, y: number, t: number }[]} */
    const trail = [{ x: x0, y: y0, t: performance.now() }];
    // a finger point (css px) → the world, clamped into the play area (from below it: its bottom edge)
    /** @param {number} x @param {number} y */
    const world = (x, y) => {
      const r = c.getBoundingClientRect(), k = r.width / TITLE_VW, C = cam.current;
      const cx = Math.max(r.left + 4, Math.min(r.right - 4, x)), cy = Math.max(r.top + 4, Math.min(r.bottom - 6, y));
      return C ? camAt(C, (cx - r.left) / k, (cy - r.top) / k) : { x: 0, y: 0 };
    };
    /** one out of the bag at the finger, at (vx, vy) css px / s @param {number} vx @param {number} vy */
    const one = (vx, vy) => {
      if (!spend(run, kind, 1)) return false;
      const r = c.getBoundingClientRect(), C = cam.current, w = world(fx, fy), v = screenToWorldVel(vx, vy, r.width / TITLE_VW, C ? C.z : 1);
      hubThrow(S, kind, 1, w.x, w.y, v.vx, v.vy);
      SFX.ui('tap');
      saveAutoRun(run); setV(n => n + 1);
      return true;
    };
    // (owner, feedback round 1: the whole-stack lift, held still on it, is gone: it got in the way of spraying)
    const tick = setInterval(() => {
      const now = performance.now(), dt = (now - last) / 1000;
      last = now;
      if (mode === 'swipe' && now - stillAt > DEV.autoStreamWait && Math.hypot(fx - x0, fy - y0) > MOVE * 2) { mode = 'stream'; t0 = now; acc = 1; }
      if (mode !== 'stream') return;
      const ramp = Math.min(1, (now - t0) / 1000 / DEV.autoStreamRamp);
      acc += (DEV.autoStreamRate0 + (DEV.autoStreamRate1 - DEV.autoStreamRate0) * ramp) * dt;
      const dx = fx - x0, dy = fy - y0, d = Math.hypot(dx, dy) || 1, r = c.getBoundingClientRect(), C = cam.current;
      // the speed in world units, back to css px / s for one()
      const sp = d * DEV.autoStreamK * (r.width / TITLE_VW) * (C ? C.z : 1);
      while (acc >= 1) { acc -= 1; if (!one(dx / d * sp, dy / d * sp)) { acc = 0; break; } }
    }, 33);
    const finish = () => {
      press.current = null; clearInterval(tick);
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    };
    /** @param {any} ev */
    const move = ev => {
      if (ev.pointerId !== id) return;
      ev.preventDefault();
      fx = ev.clientX; fy = ev.clientY;
      const now = performance.now();
      trail.push({ x: fx, y: fy, t: now });
      while (trail.length > 2 && now - trail[0].t > 100) trail.shift();
      if (Math.hypot(fx - sx, fy - sy) > 6) { sx = fx; sy = fy; stillAt = now; }
      if (mode === 'press' && Math.hypot(fx - x0, fy - y0) > MOVE) { mode = 'swipe'; SFX.unlock(); }
      // stage 12: a green gem over an empty player circle stops being a throw: it's a drag (the ghost, the circle lit, drop)
      if (kind === 'green' && (mode === 'press' || mode === 'swipe')) {
        const at = dropAt(src, fx, fy);
        if (at && at.to === 'player' && at.ok) { mode = 'drag'; p.drag = true; SFX.ui('tap'); }
      }
      if (mode === 'drag') { setDrag({ src, x: fx, y: fy, over: dropAt(src, fx, fy), back: false }); return; }
    };
    /** @param {any} ev */
    const up = ev => {
      if (ev.pointerId !== id) return;
      finish();
      if (mode === 'drag') { drop(src, ev.clientX, ev.clientY, p); return; }
      if (mode === 'swipe') {
        fx = ev.clientX; fy = ev.clientY;
        const a = trail[0], dt = Math.max(0.016, (performance.now() - a.t) / 1000), vx = (fx - a.x) / dt, vy = (fy - a.y) / dt;
        if (Math.hypot(vx, vy) >= DEV.autoFlickMin) one(vx * DEV.autoFlickK, vy * DEV.autoFlickK);
      }
    };
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  /** the drop target under a point, and whether this item fits there @param {DragSrc} src @param {number} x @param {number} y @returns {DropAt | null} */
  const dropAt = (src, x, y) => {
    const el = document.elementFromPoint(x, y);
    /** @type {HTMLElement | null} */
    const t = el && el.closest('[data-nslot],[data-gslot],[data-pslot],.abag,.aplay');
    const it = srcItem(src), n = navRef.current;
    if (!t || !it) return null;
    // stage 9: a bag item onto the gold stack scraps it
    /** @type {HTMLElement | null} */
    const gt = el && el.closest('.abag [data-slot]');
    if (gt && src.from === 'bag' && it.kind !== 'gold') {
      const j = Number(gt.dataset.slot), g = run.bag[j];
      if (g && g.kind === 'gold') return { key: 's' + j, to: 'scrap', s: j, ok: true };
    }
    // stage 9: a bag item onto the play area: dropped on the ground in front of the team
    if (t.classList.contains('aplay')) return { key: 'play', to: 'play', s: -1, ok: src.from === 'bag' && !!scene.current };
    if (t.dataset.nslot !== undefined) {
      const s = Number(t.dataset.nslot);
      const rowLevel = n.level === 'gun' || n.level === 'cat' || n.level === 'perks';
      const ok = (src.from === 'nav' && rowLevel && src.i !== s) || (src.from === 'bag' && ((n.level === 'gun' && it.kind === 'mod') || (n.level === 'cat' && it.kind === 'exo' && it.cat === n.cat) ||
        (n.level === 'perks' && it.kind === 'perk' && !!it.id && !!PERKS[it.id] && !PERKS[it.id].stat)));
      return { key: 'n' + s, to: 'nav', s, ok };
    }
    // stage 12: a green gem onto an empty player circle: a new player
    if (t.dataset.pslot !== undefined) return { key: 'p' + t.dataset.pslot, to: 'player', s: Number(t.dataset.pslot), ok: src.from === 'bag' && it.kind === 'green' && run.players.length < MAX_PLAYERS };
    if (t.dataset.gslot !== undefined) {
      const s = Number(t.dataset.gslot);
      return { key: 'g' + s, to: 'gun', s, ok: src.from === 'bag' && n.level === 'guns' && it.kind === 'gun' };
    }
    // (feedback round 1) the bag slot under the finger: things go where they're put
    const bs = gt ? Number(gt.dataset.slot) : -1;
    if (src.from === 'bag') return { key: 's' + bs, to: 'bag', s: bs, ok: bs >= 0 && bs !== src.i };
    return { key: bs >= 0 ? 's' + bs : 'bag', to: 'bag', s: bs, ok: true };
  };
  /** let go: the move on the run (saved), or the ghost springs back @param {DragSrc} src @param {number} x @param {number} y @param {Press} p */
  const drop = (src, x, y, p) => {
    const at = dropAt(src, x, y), n = navRef.current, it0 = srcItem(src);
    /** @type {import('../../auto/run.js').SlotRow | null} */
    const row = n.level === 'gun' ? { gun: n.g } : n.level === 'cat' ? { cat: n.cat } : n.level === 'perks' ? { perks: true } : null;
    let done = false;
    if (at && at.ok) {
      if (src.from === 'bag' && at.to === 'nav') {
        if (n.level === 'gun') done = fitMod(run, src.i, n.p, n.g, at.s);
        else if (n.level === 'cat') done = fitExo(run, src.i, n.p, n.cat, at.s);
        else if (n.level === 'perks') done = fitPerk(run, src.i, n.p, at.s);
      } else if (src.from === 'bag' && at.to === 'play' && scene.current && it0) {
        leaveItem(scene.current, it0, lootCol(it0));
        run.bag[src.i] = null;
        done = true;
      } else if (src.from === 'bag' && at.to === 'scrap') {
        const tile = document.querySelector('.abag [data-slot="' + at.s + '"]');
        const r = tile ? tile.getBoundingClientRect() : null;
        const g = scrapAt(run, src.i);
        done = g > 0;
        if (done && r) {
          const k = Date.now();
          setBurst({ x: r.left + r.width / 2, y: r.top + r.height / 2, n: g, k });
          setTimeout(() => setBurst(b => b && b.k === k ? null : b), 900);
          SFX.ui('coin');
        }
      } else if (src.from === 'bag' && at.to === 'player') {
        const pl = addPlayer(run);
        done = !!pl;
        if (pl && scene.current) sceneAddRunner(scene.current);
      } else if (src.from === 'bag' && at.to === 'gun') done = fitGun(run, src.i, n.p, at.s);
      else if (src.from === 'bag' && at.to === 'bag') done = bagMove(run, src.i, at.s);
      else if (src.from === 'nav' && at.to === 'nav') done = !!row && rowMove(run, n.p, row, src.i, at.s);
      else if (src.from === 'nav' && at.to === 'bag' && row && at.s >= 0 && rowToBag(run, n.p, row, src.i, at.s)) done = true;
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
  // stage 9: a press on a player's helmet. Let go soon: his menu (a tap). Held DEV.autoHoldMs: his 4 guns fan out in an
  // arc above it; slide onto one (it lights) and let go: that gun fires (setActive, saved); let go on none: nothing
  /** @param {any} e @param {number} i */
  const holdHelm = (e, i) => {
    e.preventDefault();
    if (press.current || !run.players[i]) return;
    const r = e.currentTarget.getBoundingClientRect(), id = e.pointerId;
    /** @type {{ x: number, y: number }[] | null} */
    let pts = null;
    let hi = -1;
    const timer = setTimeout(() => {
      pts = gunArc(r.left + r.width / 2, r.top + r.height / 2, innerWidth, DEV.autoArcR, 30);
      SFX.unlock(); SFX.ui('tap');
      setArc({ p: i, pts, hi: -1 });
    }, DEV.autoHoldMs);
    const finish = () => {
      clearTimeout(timer);
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel);
    };
    /** @param {any} ev */
    const move = ev => {
      if (ev.pointerId !== id || !pts) return;
      ev.preventDefault();
      const k = arcPick(pts, ev.clientX, ev.clientY, 30), pl = run.players[i];
      const h2 = pl && pl.guns[k] ? k : -1;
      if (h2 !== hi) { hi = h2; setArc(a => a && { ...a, hi: h2 }); }
    };
    /** @param {any} ev */
    const up = ev => {
      if (ev.pointerId !== id) return;
      finish();
      if (!pts) { openNav(i); return; }
      setArc(null);
      if (hi >= 0 && setActive(run, i, hi)) { saveAutoRun(run); SFX.fx('open'); setV(v => v + 1); }
    };
    /** @param {any} ev */
    const cancel = ev => { if (ev.pointerId === id) { finish(); setArc(null); } };
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
  };
  /** the nav's player's meters (in a level; the hub has none) @returns {PlayerMeters | null} */
  const meters = () => { const L = scene.current && levelState(scene.current); return (L && L.meters[navRef.current.p]) || null; };
  return h('div', { className: 'auto' },
    h('div', { className: 'aplay' + (drag && drag.over && drag.over.key === 'play' && drag.over.ok ? ' drop' : '') },
      h('canvas', { ref: cvs, className: 'aplaycvs' }),
      blocked ? h('div', { className: 'ablocked' }, 'Path blocked') : null,
      boss ? h('div', { className: 'abossbar' }, h('b', null, boss.name),
        h('div', { className: 'abosstrack' }, h('i', { style: { width: (100 * boss.hp / Math.max(1, boss.max)).toFixed(1) + '%' } }))) : null,
      h('button', { className: 'pausebtn', title: 'Pause', onPointerDown: tap(() => { SFX.fx('open'); setPaused(true); }) }, '⏸')),
    h(NavRow, { row: navRow(nav, run, MAX_PLAYERS), level: nav.level, open: openNav, down, drag, holdHelm, meters }),
    h('div', { className: 'abag' + (drag && drag.over && drag.over.key === 'bag' && drag.over.ok ? ' drop' : '') },
      ...Array.from({ length: BAG_SLOTS }, (_, i) => h(BagSlot, { key: i, i, it: run.bag[i], down,
        lift: !!drag && drag.src.from === 'bag' && drag.src.i === i,
        drop: !!drag && !!drag.over && drag.over.ok && drag.over.key === 's' + i }))),
    h('div', { className: 'abtns' },
      h('button', { className: 'abtn ab', onPointerDown: tap(() => { nothing(); setNav(navBack); }) }, 'B'),
      h(PillStick, { onMove: steer }),
      h('button', { className: 'abtn aa', onPointerDown: tap(pressA) }, 'A')),
    arc ? h(GunArc, { arc, run }) : null,
    burst ? h(CoinBurst, { key: burst.k, burst }) : null,
    drag ? h(Ghost, { drag, it: srcItem(drag.src) }) : null,
    card ? h(CardPop, { it: card, close: () => setCard(null) }) : null,
    paused ? h(PauseMenu, { input, label: 'Tier ' + run.tier, onNew: freshRun, close:() => { SFX.fx('close'); setPaused(false); } }) : null);
}

// PillState: as the old game's left stick (ui/hud.js Stick): active while held; dx, dy the finger from the middle as a
// share of the pill's half-width and half-height (so a small push up reads as up); mag their length (0-1, clamped), nx, ny
// its direction
/** @typedef {{ active: boolean, nx: number, ny: number, mag: number, dx: number, dy: number }} PillState */
const PILL_REST = { active: false, nx: 0, ny: 0, mag: 0, dx: 0, dy: 0 };
const PILL_REACH = 54;                 // the knob's reach (px): the old 150 px stick's 75 × 0.72 (ui/hud.js Stick maxD)

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
    // (owner, feedback round 1) the old left stick's maths exactly (ui/hud.js Stick): one radius every way, PILL_REACH,
    // the knob free out to it (past the pill's edges)
    const r = el.getBoundingClientRect();
    const fx = e.clientX - (r.left + r.width / 2), fy = e.clientY - (r.top + r.height / 2), d = Math.hypot(fx, fy);
    const cl = Math.min(d, PILL_REACH), nx = d ? fx / d : 0, ny = d ? fy / d : 0, mag = cl / PILL_REACH;
    /** @type {PillState} */
    const st = { active: true, nx, ny, mag, dx: nx * mag, dy: ny * mag };
    onMove(st);
    setKnob({ x: nx * cl, y: ny * cl, jet: ny < 0 && mag > DEAD });
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
/** @param {{ row: import('../../auto/nav.js').NavRow, level: string, open: (w: string | number) => void, down: (e: any, src: DragSrc) => void, drag: Drag | null,
 *   holdHelm: (e: any, i: number) => void, meters: () => PlayerMeters | null }} props */
function NavRow({ row, level, open, down, drag, holdHelm, meters }) {
  const over = drag && drag.over && drag.over.ok ? drag.over.key : '';
  /** @param {import('../../auto/nav.js').NavCell} c @param {number} i */
  const cell = (c, i) => {
    const to = c.open;
    /** @param {any} e */
    const go = e => { e.preventDefault(); if (to !== undefined) open(to); };
    /** a helmet: a tap or a hold (the gun arc) @param {any} e */
    const hold = e => holdHelm(e, i);
    if (row.shape === 'slots') {
      const it = c.item || null;
      const lift = !!drag && drag.src.from === 'nav' && drag.src.i === i;
      /** @param {any} e */
      const grab = e => down(e, { from: 'nav', i });
      return h('div', { key: c.key, className: 'aslot anavs' + (it ? ' full k-' + it.kind : '') + (over === 'n' + i ? ' drop' : '') + (lift ? ' lift' : ''),
        style: itemEdge(it), 'data-nslot': i, onPointerDown: it ? grab : undefined },
        it ? h(ItemIcon, { it }) : null, it ? h(Grab) : null);
    }
    const cls = 'anavc' + (c.dim ? ' locked' : ' on') + (c.sel ? ' sel' : '') + (c.gun ? ' gun' : '') + (over === 'g' + i || over === 'p' + i ? ' drop' : '');
    const style = c.col && !c.dim ? { borderColor: c.col, boxShadow: '0 0 10px ' + (c.glow || c.col + '66') } : undefined;
    let inner = null;
    if (c.gun) inner = h(GunIcon, { gun: c.gun });
    else if (c.helm && c.col) inner = h(HelmetIcon, { col: c.col, size: 35 });     // a player: his helmet (owner)
    else if (c.icon) inner = h(PixIcon, { id: c.icon, size: 20, tint: level === 'exo' ? HUB_MACHINES.exo.hue : undefined });      // themed pixel icons, not emoji (owner)
    else if (c.glyph) inner = h('span', { className: 'anavg' }, c.glyph);
    else if (c.label) inner = h('span', { className: 'anavp', style: { background: c.col } }, c.label);
    return h('div', { key: c.key, className: cls, 'data-player': level === 'players' ? i : undefined, 'data-open': c.open, 'data-gslot': level === 'guns' ? i : undefined, 'data-pslot': level === 'players' && !c.helm ? i : undefined,
      title: c.glyph ? c.label : undefined, style, onPointerDown: c.helm && level === 'players' ? hold : go }, inner);
  };
  return h('div', { className: 'anav l-' + level + (row.shape === 'slots' ? ' slots' : ''), 'data-level': level,
    style: row.col ? { borderColor: row.col, boxShadow: '0 0 12px ' + row.col + '55' } : undefined },
    row.shape === 'stats' ? h(StatsRow, { meters }) : row.cells.map(cell));
}

// one bag slot: empty, or the item's icon and its count
/** @param {{ i: number, it: BagItem | null, down: (e: any, src: DragSrc) => void, lift: boolean, drop: boolean }} props */
function BagSlot({ i, it, down, lift, drop }) {
  /** @param {any} e */
  const grab = e => down(e, { from: 'bag', i });
  return h('div', { className: 'aslot' + (it ? ' full k-' + it.kind : '') + (lift ? ' lift' : '') + (drop ? ' drop' : ''), 'data-slot': i, style: itemEdge(it),
    onPointerDown: it ? grab : undefined },
    it ? h(ItemIcon, { it }) : null, it ? h(Grab) : null,
    it && (it.n > 1 || it.kind === 'gold' || it.kind === 'red' || it.kind === 'green') ? h('b', { className: 'acount' }, it.n) : null);
}

/** @param {{ it: BagItem }} props */
function ItemIcon({ it }) {
  if (it.kind === 'gun' && it.gun) return h(GunIcon, { gun: it.gun });
  /** @type {{ glyph: string, col: string, tier?: number } | null} */
  let g = null;
  if (it.kind === 'mod') { const m = MODS[it.id || '']; g = m ? { glyph: m.glyph, col: famCol(it.id || '') } : { glyph: '?', col: '#888' }; }   // its family's colour (owner)
  else if (it.kind === 'exo') {
    return h('span', { className: 'aglyph' }, h(PixIcon, { id: it.cat || 'hp', size: '64%', tint: HUB_MACHINES.exo.hue }), it.tier ? h('i', { className: 'atier' }, ROMAN[it.tier - 1]) : null);
  }
  else if (it.kind === 'perk') { const pk = PERKS[it.id || '']; g = pk ? { glyph: pk.glyph, col: HUB_MACHINES.perk.hue } : { glyph: '?', col: '#888' }; }   // the perk machine's (owner)
  else if (it.kind === 'gold') g = { glyph: '●', col: '#ffc93c' };
  else if (it.kind === 'red') g = { glyph: '◆', col: '#ff4f5e' };
  else if (it.kind === 'green') g = { glyph: '◆', col: '#5ee05a' };
  if (!g) return null;
  return h('span', { className: 'aglyph' }, h(GlyphIcon, { glyph: g.glyph, col: g.col }),
    g.tier ? h('i', { className: 'atier' }, ROMAN[g.tier - 1]) : null);
}

// ---- stage 8b: drag and drop, the cards ----
/** @typedef {{ from: 'bag' | 'nav', i: number }} DragSrc */
/** @typedef {{ key: string, to: 'nav' | 'gun' | 'bag' | 'scrap' | 'play' | 'player', s: number, ok: boolean }} DropAt */
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
// a tile's outline by the item's group (owner): a mod its family's colour (the old Bag's: shots yellow, trajectory
// purple, …), a gun, exo mod or perk its machine's, gold and gems (things you spend) one light grey
/** @param {BagItem | null} it @returns {any} */
const itemEdge = it => {
  if (!it) return undefined;
  const c = it.kind === 'mod' ? famCol(it.id || '') : it.kind === 'gun' ? HUB_MACHINES.gun.hue : it.kind === 'exo' ? HUB_MACHINES.exo.hue
    : it.kind === 'perk' ? HUB_MACHINES.perk.hue : ITEM_SPEND;
  return { '--ic': c };
};
const ITEM_SPEND = '#c9cdd6';

function Ghost({ drag, it }) {
  if (!it) return null;
  return h('div', { className: 'aslot full aghost k-' + it.kind + (drag.back ? ' back' : ''), style: { left: drag.x + 'px', top: drag.y + 'px', ...itemEdge(it) } },
    h(ItemIcon, { it }));
}

/** gold and gems have no card @param {BagItem} it */
const hasCard = it => (it.kind === 'mod' && !!it.id && !!MODS[it.id]) || (it.kind === 'gun' && !!it.gun) ||
  (it.kind === 'perk' && !!it.id && !!PERKS[it.id]) || (it.kind === 'exo' && !!it.cat && !!it.tier);

// a tapped item's card (the old Bag's: ModCard, GunCard, PerkCard; an exo mod's own small one), over a shade
/** @param {{ it: BagItem, close: () => void }} props */
function CardPop({ it, close }) {
  // the cards' glyphs as the screen's pixel icons while this is open (owner)
  CARD_ICON.fn = (glyph, col, kind) => h(GlyphIcon, { glyph, col: kind === 'perk' ? HUB_MACHINES.perk.hue : col });
  useEffect(() => () => { CARD_ICON.fn = null; }, []);
  /** @param {any} e */
  const shut = e => { e.preventDefault(); close(); };
  let c = null;
  if (it.kind === 'mod' && it.id) c = h(ModCard, { id: it.id, top: true, onClose: close });
  else if (it.kind === 'gun' && it.gun) c = h(GunCard, { gun: it.gun, label: 'Bag', onClose: close });
  else if (it.kind === 'perk' && it.id) c = h(PerkCard, { id: it.id, top: true, onClose: close });
  else if (it.kind === 'exo' && it.cat && it.tier) c = h(ExoCard, { cat: it.cat, tier: it.tier, onClose: close });
  // (into the body, as ModPop: the cards take the page's colours, not the auto screen's)
  return ReactDOM.createPortal(h('div', { className: 'modpop acard', style: itemEdge(it) }, h('div', { className: 'shade', onPointerDown: shut }), c), document.body);
}

// an exo mod's card: its category, tier, and what it adds (STAT_PERKS, by its tier)
/** @param {{ cat: ExoCat, tier: number, onClose: () => void }} props */
function ExoCard({ cat, tier, onClose }) {
  const S0 = STAT_PERKS[EXO_STATS[cat][0]];
  /** @param {any} e */
  const shut = e => { e.preventDefault(); onClose(); };
  return h('div', { className: 'pop scroll top aexocard' },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: S0.tint } }, h(PixIcon, { id: cat, size: '64%', tint: HUB_MACHINES.exo.hue })),
      h('div', { className: 'ptitle' },
        h('b', { style: { color: S0.tint } }, EXO_NAMES[cat] + ' ' + ROMAN[tier - 1]),
        h('span', null, 'Exo mod · tier ' + ROMAN[tier - 1] + ' of V · fits the suit’s ' + EXO_NAMES[cat] + ' slots')),
      h('button', { className: 'pclose', onPointerDown: shut }, '×')),
    ...EXO_STATS[cat].map(st => { const S = STAT_PERKS[st]; return h('p', { key: st, className: 'pinfo' }, S.say(S.vals[tier - 1])); }));
}

// ---- stage 9: the gun arc, the stats row, a scrap's coin burst ----
// a held helmet's 4 guns, fanned out above it: the nav's gun circles (each in its gun's colour, empty ones dim, the
// active one ringed white), the one under the finger lit green
/** @param {{ arc: { p: number, pts: { x: number, y: number }[], hi: number }, run: AutoRun }} props */
function GunArc({ arc, run }) {
  const row = navRow({ level: 'guns', p: arc.p, g: 0, cat: 'hp' }, run, MAX_PLAYERS);
  return h('div', { className: 'aarc' }, ...row.cells.map((c, i) => {
    const pt = arc.pts[i];
    if (!pt) return null;
    const style = { left: pt.x + 'px', top: pt.y + 'px', ...(c.col && !c.dim ? { borderColor: c.col, boxShadow: '0 0 10px ' + (c.glow || c.col) } : {}) };
    return h('div', { key: c.key, className: 'anavc gun aarcc' + (c.dim ? ' locked' : ' on') + (c.sel ? ' sel' : '') + (arc.hi === i ? ' drop' : ''),
      'data-arc': i, style }, c.gun ? h(GunIcon, { gun: c.gun }) : null);
  }));
}

// one running graph (the old Bag's DPS graph, ui/editor.js GunFire): a thin line, oldest at the left, scaled to its
// peak; all zero (the hub): a flat line along the bottom
/** @param {HTMLCanvasElement | null} c @param {number[]} vals @param {string} col */
function paintGraph(c, vals, col) {
  if (!c) return;
  const dpr = window.devicePixelRatio || 1, W = Math.max(1, Math.round(c.clientWidth * dpr)), H = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  const peak = Math.max(...vals, 0), top = 4 * dpr, bot = H - 4 * dpr, step = W / Math.max(1, vals.length - 1);
  ctx.strokeStyle = col; ctx.lineWidth = 1.5 * dpr; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.9;
  ctx.beginPath();
  vals.forEach((v, i) => { const x = i * step, y = peak > 0 ? bot - (v / peak) * (bot - top) : bot; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.stroke(); ctx.globalAlpha = 1;
  c.dataset.n = String(vals.length);
  c.dataset.peak = String(peak);
}

// the nav's Stats level: red = damage dealt, green = health (the player's meters, auto/meters.js; a 0.25 s bucket
// each), over the last 5 / 15 / 30 s (a tap cycles; the span small in the corner). Redrawn 4 times a second.
/** @param {{ meters: () => PlayerMeters | null }} props */
function StatsRow({ meters }) {
  const [span, setSpan] = useState(5);
  /** @type {{ current: HTMLCanvasElement | null }} */
  const dmg = useRef(null);
  /** @type {{ current: HTMLCanvasElement | null }} */
  const hp = useRef(null);
  useEffect(() => {
    const draw = () => {
      const M = meters();
      paintGraph(dmg.current, meterTail(M && M.dmg, span), '#ff4a4a');
      paintGraph(hp.current, meterTail(M && M.hp, span), '#5ee05a');
    };
    draw();
    const id = setInterval(draw, 250);
    return () => clearInterval(id);
  }, [span]);
  /** @param {any} e */
  const cycle = e => { e.preventDefault(); SFX.unlock(); SFX.ui('tap'); setSpan(nextSpan); };
  return h('div', { className: 'astats', 'data-span': span, onPointerDown: cycle },
    h('canvas', { ref: dmg, className: 'astatg dmg' }),
    h('canvas', { ref: hp, className: 'astatg hp' }),
    h('i', { className: 'astatspan' }, span + 's'));
}

// a scrap: coins burst out of the gold tile, and the gold it made floats up
/** @param {{ burst: { x: number, y: number, n: number } }} props */
function CoinBurst({ burst }) {
  return h('div', { className: 'acoins', style: { left: burst.x + 'px', top: burst.y + 'px' } },
    ...Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 - Math.PI / 2, d = 26 + (i % 3) * 9;
      return h('i', { key: i, style: { '--dx': (Math.cos(a) * d).toFixed(1) + 'px', '--dy': (Math.sin(a) * d - 14).toFixed(1) + 'px', animationDelay: (i % 3) * 30 + 'ms' } });
    }),
    h('b', null, '+' + burst.n));
}
