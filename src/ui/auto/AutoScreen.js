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
// Paying (feedback round 2, payA): at a machine in the hub, "A to Pay" shows over it; A taps out one of what it takes from
// player 1's chest onto the floor in front of him, held it streams them, and a drag from where A was pressed aims them
// (direction and speed). (Stage 10a's throw from the bag tile is gone.)

import { SFX } from '../../audio/sfx.js';
import { TITLE_VW, TITLE_ZLOCK, camAt, titleCam } from '../../art/titlescene.js';
import { DEAD } from '../../core/consts.js';
import { chestOpen } from '../../auto/chests.js';
import { HUB_W, hubExit, hubLeft, hubScene, hubState, hubStick, hubStopX } from '../../auto/hub.js';
import { THROW_TAKES, hubPayAt, hubPayOne, payVel } from '../../auto/throw.js';
import { levelClearedAge, levelControl, levelDeathPrompt, levelDone, levelHold, levelLost, levelScene, levelState, levelTeleportHome } from '../../auto/level.js';
import { clearedText } from '../../art/cleared.js';
import { drawHint } from '../../game/render/hubdraw.js';
import { DEV } from '../../dev/knobs.js';
import { levelBoss } from '../../auto/enemies.js';
import { MODS, famCol } from '../../spells/mods.js';
import { HUB_MACHINES } from '../../auto/hub.js';
import { PERKS, STAT_PERKS } from '../../data/perks.js';
import { BAG_SLOTS, EXO_STATS, MAX_PLAYERS, addPlayer, bagAdd, fitExo, fitGun, fitMod, fitPerk, healRun, levelCleared, levelFailed, levelSeed, kitMissing, newRun, bagMove, rowMove, rowToBag,
  scrapAt, setActive, spend, unfitExo, unfitMod, unfitPerk } from '../../auto/run.js';
import { loadAutoRun, saveAutoRun } from '../../auto/save.js';
import { EXO_NAMES, arcPick, gunArc, navBack, navOpen, navPath, navPick, navRow, navStart } from '../../auto/nav.js';
import { meterTail, nextSpan, spanLabel } from '../../auto/meters.js';
import { CARD_ICON, GunCard, ModCard, PerkCard } from '../cards.js';
import { GunFire, GunIcon, GunStats, PULL_COL } from '../editor.js';
import { fireSimNew, fireSimStep, pullSteps } from '../../spells/bagsim.js';
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
  // (feedback round 2) graphs pinned above the nav (a stats graph held): player p's damage (left) or health (right) over span
  /** @type {Pin[]} */
  const noPins = [];
  const [pins, setPins] = useState(noPins);
  /** hold a graph: pin it (the newest at the bottom of its side), held again: unpin @param {number} p @param {'dmg' | 'hp'} kind @param {number} span */
  const togglePin = (p, kind, span) => setPins(ps => ps.some(q => q.p === p && q.kind === kind) ? ps.filter(q => !(q.p === p && q.kind === kind)) : [...ps, { p, kind, span }]);
  useEffect(() => {
    const paidV = { current: 0 }, bagV = { current: 0 };
    const id = setInterval(() => {
      const L = scene.current && levelState(scene.current);
      // (feedback round 2) the player picked in the play area (the camera's lock) is steered by hand
      if (L && scene.current && cam.current) levelControl(scene.current, cam.current.lock, null);
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
      keep: true,   // (feedback round 1) the play area's height shifting (the boss bar, a card) must not restart the level
      // LEVEL CLEARED (stage 7), in the upper part of the play area
      // (feedback round 2) everyone down: "Tap A to Teleport back to Hub" (the hub's hint look), on the screen whatever the zoom
      over: (ctx, S, w, hh) => {
        const a = levelClearedAge(S); if (a >= 0) clearedText(ctx, a, DEV.autoClearT, w, hh * 0.14);
        if (levelDeathPrompt(S)) { const k = w / 150; ctx.save(); ctx.scale(k, k); drawHint(ctx, w / 2 / k, hh * 0.3 / k, 'Tap A to Teleport back to Hub', S.t); ctx.restore(); }
      },
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
    // (feedback round 2) a player picked (tapped in the play area): the stick steers him; none: it hurries or slows the team
    const sel = S.lvl && cam.current ? cam.current.lock : -1;
    if (S.lvl && sel >= 0) { levelHold(S, 0); levelControl(S, sel, st); }
    else if (S.lvl) levelHold(S, st.active && st.mag > DEAD ? st.nx * (st.mag - DEAD) / (1 - DEAD) : 0);
    else hubStick(S, st);
  };
  // (feedback round 2) A at a hub machine pays it: a tap one of what it takes (THROW_TAKES) out of player 1's chest, held
  // DEV.autoPayHold a stream (autoStreamRate0 → 1 over autoStreamRamp); the finger's offset from where A was pressed
  // aims them (payVel: direction and speed; none: a hop onto the floor in front of him). Each one leaves the bag (saved).
  // Anywhere else A is A (pressA)
  /** @param {any} e */
  const downA = e => {
    e.preventDefault();
    SFX.unlock();
    const S = scene.current, at = S && !S.lvl ? hubPayAt(S) : null;
    if (!S || !at) { pressA(); return; }
    const kind = THROW_TAKES[at], id = e.pointerId, x0 = e.clientX, y0 = e.clientY;
    let dx = 0, dy = 0, stream = false, acc = 0, t0 = 0, last = performance.now();
    const one = () => {
      if (!spend(run, kind, 1)) return false;
      const L = S.runners[0], v = payVel(L ? L.face : 1, dx, dy);
      hubPayOne(S, kind, v.vx, v.vy, at);
      saveAutoRun(run); setV(n => n + 1);
      return true;
    };
    const hold = setTimeout(() => { stream = true; t0 = performance.now(); acc = 1; }, DEV.autoPayHold);
    const tick = setInterval(() => {
      const now = performance.now(), dt = (now - last) / 1000;
      last = now;
      if (!stream) return;
      const ramp = Math.min(1, (now - t0) / 1000 / DEV.autoStreamRamp);
      acc += (DEV.autoStreamRate0 + (DEV.autoStreamRate1 - DEV.autoStreamRate0) * ramp) * dt;
      while (acc >= 1) { acc -= 1; if (!one()) { acc = 0; break; } }
    }, 33);
    const finish = () => { clearTimeout(hold); clearInterval(tick); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    /** @param {any} ev */
    const move = ev => { if (ev.pointerId === id) { ev.preventDefault(); dx = ev.clientX - x0; dy = ev.clientY - y0; } };
    /** @param {any} ev */
    const up = ev => {
      if (ev.pointerId !== id) return;
      finish();
      if (!stream) { dx = ev.clientX - x0; dy = ev.clientY - y0; if (!one()) SFX.ui('tap'); }
    };
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  // B: in a level with a player picked, lets him go (back on the autopilot, the camera free); else back up the nav
  // (feedback round 2, recheck) backing out to the player row (or B there) deselects him: back on the autopilot, the camera free
  const pressB = () => {
    nothing();
    const S = scene.current, C = cam.current, n = navRef.current, up = navBack(n);
    const picked = (C && C.lock >= 0) || n.p >= 0;
    if (S && S.lvl && C && up.level === 'players' && picked) {
      C.lock = -1; levelControl(S, -1, null); SFX.fx('close');
      setNav({ ...up, p: -1 });
      return;
    }
    setNav(up);
  };
  // (feedback round 2) everyone down in a level: A sets off the teleport home (the helmet light, the blast: auto/death.js)
  const pressA = () => { SFX.ui('tap'); if (scene.current && scene.current.lvl && levelTeleportHome(scene.current)) { SFX.fx('open'); return; } if (scene.current && (hubExit(scene.current) || (!!scene.current.lvl && chestOpen(scene.current)))) SFX.fx('open'); };
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
  /** a nav circle tapped: one level down from its row's state (a raised row's: back to there, then down) @param {NavState} s @param {string | number} w */
  const openAt = (s, w) => {
    nothing();
    const next = navOpen(s, w, run);
    // (feedback round 2, recheck) in a level, a player picked by his helmet is the one the stick steers: the camera follows him
    const S = scene.current, C = cam.current;
    if (S && S.lvl && C && s.level === 'players' && next.level === 'player') {
      C.lock = next.p; if (C.z < TITLE_ZLOCK * 0.8) C.zt = TITLE_ZLOCK;
      levelControl(S, next.p, null);
    }
    setNav(next);
  };
  // (owner, feedback round 2) a gun circle (the Guns row): a tap opens it, held DEV.autoHoldMs it becomes the gun that fires
  /** @param {any} e @param {NavState} s @param {number} i */
  const holdGun = (e, s, i) => {
    e.preventDefault();
    const pl = run.players[s.p];
    if (press.current || !pl || !pl.guns[i]) return;
    const id = e.pointerId;
    let held = false;
    const timer = setTimeout(() => {
      held = true;
      SFX.unlock();
      if (setActive(run, s.p, i)) { saveAutoRun(run); SFX.fx('open'); setV(v => v + 1); }
    }, DEV.autoHoldMs);
    const finish = () => { clearTimeout(timer); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel); };
    /** @param {any} ev */
    const up = ev => { if (ev.pointerId !== id) return; finish(); if (!held) openAt(s, i); };
    /** @param {any} ev */
    const cancel = ev => { if (ev.pointerId === id) finish(); };
    addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
  };
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
      if (!pts) { openAt({ ...navRef.current, level: 'players' }, i); return; }
      setArc(null);
      if (hi >= 0 && setActive(run, i, hi)) { saveAutoRun(run); SFX.fx('open'); setV(v => v + 1); }
    };
    /** @param {any} ev */
    const cancel = ev => { if (ev.pointerId === id) { finish(); setArc(null); } };
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
  };
  /** the nav's player's meters (in a level; the hub has none) @returns {PlayerMeters | null} */
  const meters = () => metersOf(navRef.current.p);
  /** player p's meters (in a level) @param {number} p @returns {PlayerMeters | null} */
  const metersOf = p => { const L = scene.current && levelState(scene.current); return (L && L.meters[p]) || null; };
  /** @param {'dmg' | 'hp'} kind @param {number} span */
  const pinNav = (kind, span) => togglePin(navRef.current.p, kind, span);
  return h('div', { className: 'auto' },
    h('div', { className: 'aplay' + (drag && drag.over && drag.over.key === 'play' && drag.over.ok ? ' drop' : '') },
      h('canvas', { ref: cvs, className: 'aplaycvs' }),
      blocked ? h('div', { className: 'ablocked' }, 'Path blocked') : null,
      boss ? h('div', { className: 'abossbar' }, h('b', null, boss.name),
        h('div', { className: 'abosstrack' }, h('i', { style: { width: (100 * boss.hp / Math.max(1, boss.max)).toFixed(1) + '%' } }))) : null,
      h('button', { className: 'pausebtn', title: 'Pause', onPointerDown: tap(() => { SFX.fx('open'); setPaused(true); }) }, '⏸')),
    h(NavStack, { nav, run, openAt, down, drag, holdHelm, holdGun, meters, pins, metersOf, pinNav }),
    h('div', { className: 'abag' + (drag && drag.over && drag.over.key === 'bag' && drag.over.ok ? ' drop' : '') },
      ...Array.from({ length: BAG_SLOTS }, (_, i) => h(BagSlot, { key: i, i, it: run.bag[i], down,
        lift: !!drag && drag.src.from === 'bag' && drag.src.i === i,
        drop: !!drag && !!drag.over && drag.over.ok && drag.over.key === 's' + i }))),
    h('div', { className: 'abtns' },
      h('button', { className: 'abtn ab', onPointerDown: tap(pressB) }, 'B'),
      h(PillStick, { onMove: steer }),
      h('button', { className: 'abtn aa', onPointerDown: downA }, 'A')),
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

// The context nav as a stack (owner, feedback round 2): the row for the nav's level sits in the nav's place (.anav); every
// level above it stays on screen, raised above it over the play area (.anavup), its picked cell lit and the rest dimmed.
// Going down a level the rows rise (a transition on their offset) and the new one slides in from the right; B reverses it
// (the row leaving slides out, the rest drop back). A raised row still takes taps: from its own level. At a gun's mod slots
// the gun panel (GunPanel: the old Bag's stats and firing window) rises between the slots and the Guns row.
/** @typedef {import('../../auto/nav.js').NavState} NavState */
const ROW_H = 66, STACK_GAP = 6, PANEL_H = 168, LEAVE_MS = 260;
/** @typedef {{ key: string, s: NavState, panel?: boolean }} StackItem */
/**
 * @param {{ nav: NavState, run: AutoRun, openAt: (s: NavState, w: string | number) => void, down: (e: any, src: DragSrc) => void,
 *   drag: Drag | null, holdHelm: (e: any, i: number) => void, holdGun: (e: any, s: NavState, i: number) => void,
 *   meters: () => PlayerMeters | null, pins: Pin[], metersOf: (p: number) => PlayerMeters | null, pinNav: (kind: 'dmg' | 'hp', span: number) => void }} props
 */
function NavStack({ nav, run, openAt, down, drag, holdHelm, holdGun, meters, pins, metersOf, pinNav }) {
  const path = navPath(nav);
  const pl = run.players[nav.p];
  const gun = nav.level === 'gun' && pl ? pl.guns[nav.g] : null;
  /** @type {StackItem[]} */
  const items = path.map(s => ({ key: s.level, s }));
  if (gun) items.splice(items.length - 1, 0, { key: 'panel', s: nav, panel: true });
  const [lit, setLit] = useState(null);
  // (as the old Bag) a fitted mod no pull ever fires is dimmed
  const steps = gun ? pullSteps(gun) : null;
  const cold = new Set(gun && steps ? gun.slots.map((id, i) => (id && !steps.some(st => st.slot === i) ? i : -1)).filter(i => i >= 0) : []);
  // rows that just left (B, or a tap on a raised row): kept LEAVE_MS to slide out
  /** @type {{ it: StackItem, k: number }[]} */
  const noGone = [];
  const [gone, setGone] = useState(noGone);
  const prev = useRef(items);
  // rows there when the screen opens don't slide in; later ones do
  const ready = useRef(false);
  useEffect(() => { ready.current = true; }, []);
  const sig = items.map(i => i.key).join();
  useEffect(() => {
    const keys = new Set(items.map(i => i.key));
    const out = prev.current.filter(i => !keys.has(i.key));
    prev.current = items;
    if (!out.length) return;
    const k = performance.now();
    setGone(g => [...g.filter(o => !keys.has(o.it.key)), ...out.map(it => ({ it, k }))]);
    setTimeout(() => setGone(g => g.filter(o => o.k !== k)), LEAVE_MS);
  }, [sig]);
  // each item's lift above the nav's place, from the bottom up
  /** @type {number[]} */
  const off = [];
  for (let i = items.length - 1, y = 0; i >= 0; i--) { off[i] = y; y += (items[i].panel ? PANEL_H : ROW_H) + STACK_GAP; }
  const last = items.length - 1;
  /** @param {StackItem} it @param {string} cls @param {boolean} cur */
  const body = (it, cls, cur) => {
    if (it.panel) {
      const g = run.players[it.s.p] && run.players[it.s.p].guns[it.s.g];
      return g ? h(GunPanel, { gun: g, sig: it.s.p + '|' + it.s.g + '|' + g.slots.join() + '|' + g.multi + '|' + g.shuffle + '|' + g.castDelay + '|' + g.recharge,
        col: MACHINE_EDGE, onLit: cls === 'anavout' ? undefined : setLit, cls }) : null;
    }
    const s = it.s;
    /** @param {string | number} w */
    const open = w => openAt(s, w);
    /** @param {any} e @param {number} i */
    const hg = (e, i) => holdGun(e, s, i);
    return h(NavRow, { row: navRow(s, run, MAX_PLAYERS), level: s.level, cls, pick: cur ? undefined : navPick(nav, s.level),
      open, down, drag: cls === 'anav' ? drag : null, holdHelm, holdGun: hg, meters, pinNav, slide: ready.current, cold: cls === 'anav' ? cold : null, lit: cls === 'anav' && nav.level === 'gun' ? lit : null });
  };
  return h('div', { className: 'anavwrap' },
    h(PinStack, { pins, run, metersOf, lift: off[0] || 0 }),
    ...items.map((it, i) => h('div', { key: it.key, className: 'anavslot' + (it.panel ? ' panel' : ''), style: { transform: 'translateY(' + (-off[i]) + 'px)' } },
      body(it, i === last ? 'anav' : it.panel ? 'up' : 'anavup', i === last))),
    ...gone.map(o => h('div', { key: 'gone-' + o.it.key + o.k, className: 'anavslot' + (o.it.panel ? ' panel' : '') }, body(o.it, 'anavout', false))));
}
// the gun panel's edge: the mod machine's colour, as the mod slots' row under it
const MACHINE_EDGE = HUB_MACHINES.mod.hue;

// The gun panel (owner, feedback round 2): the old Bag's top (ui/editor.js) in the auto screen's colours: the gun's stats
// on the left (the live cast/recharge/mana bars), the firing window on the right. Its own fire preview (fireSimStep at
// DEV.bagSpeed, as SlotGrid) drives both and lights the mod slots below in each pull's colour (onLit).
/** @param {{ gun: Gun, sig: string, col: string, onLit?: (lit: any) => void, cls: string }} props */
function GunPanel({ gun, sig, col, onLit, cls }) {
  /** @type {{ current: import('../../spells/bagsim.js').FireSim & { sig?: string } | null }} */
  const sim = useRef(null);
  if (!sim.current || sim.current.sig !== sig) sim.current = Object.assign(fireSimNew(gun), { sig });
  const litFn = useRef(onLit);
  litFn.current = onLit;
  useEffect(() => {
    let raf = 0, last = performance.now(), prev = null;
    /** @param {number} now */
    const loop = now => {
      raf = requestAnimationFrame(loop);
      const S = sim.current, dt = Math.min(0.1, (now - last) / 1000) * DEV.bagSpeed;
      last = now;
      if (!S) return;
      for (let t = dt; t > 0; t -= 0.01) fireSimStep(S, Math.min(0.01, t));
      if (S.lit !== prev) { prev = S.lit; if (litFn.current) litFn.current(S.lit); }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); if (litFn.current) litFn.current(null); };
  }, []);
  return h('div', { className: 'agunpanel ' + cls, style: { '--pc': col } },
    h(GunStats, { gun, sim, sig }),
    h(GunFire, { gun, sim }));
}

// One row of the nav (auto/nav.js navRow): circles for choices (a player's ring and number, a menu glyph, a gun's
// sprite), square tiles for slots (the bag's tile look; a gun's mod row scrolls sideways when it has more than fit).
// Below the top the row's edge takes the tapped player's colour. Same height at every level (style.css .anavrow).
// cls: 'anav' the nav's own row, 'anavup' raised (pick: its picked cell), 'anavout' leaving. lit: the gun panel's
// pull lighting the mod slots.
/** @param {{ row: import('../../auto/nav.js').NavRow, level: string, cls: string, pick?: string | number, open: (w: string | number) => void,
 *   down: (e: any, src: DragSrc) => void, drag: Drag | null, holdHelm: (e: any, i: number) => void, holdGun: (e: any, i: number) => void,
 *   meters: () => PlayerMeters | null, lit: { slots: number[], pull: number } | null, slide?: boolean, cold?: Set<number> | null,
 *   pinNav: (kind: 'dmg' | 'hp', span: number) => void }} props */
function NavRow({ row, level, cls, pick, open, down, drag, holdHelm, holdGun, meters, lit, slide, cold, pinNav }) {
  const [slideIn] = useState(!!slide);
  const over = drag && drag.over && drag.over.ok ? drag.over.key : '';
  const on = new Set(lit ? lit.slots : []), pc = lit ? PULL_COL[lit.pull % PULL_COL.length] : '';
  /** @param {import('../../auto/nav.js').NavCell} c @param {number} i */
  const cell = (c, i) => {
    const to = c.open;
    /** @param {any} e */
    const go = e => { e.preventDefault(); if (to !== undefined) open(to); };
    /** a helmet: a tap or a hold (the gun arc) @param {any} e */
    const hold = e => holdHelm(e, i);
    /** a gun: a tap opens it, a hold makes it the active gun @param {any} e */
    const gunHold = e => holdGun(e, i);
    if (row.shape === 'slots') {
      const it = c.item || null;
      const lift = !!drag && drag.src.from === 'nav' && drag.src.i === i;
      /** @param {any} e */
      const grab = e => down(e, { from: 'nav', i });
      return h('div', { key: c.key, className: 'aslot anavs' + (it ? ' full k-' + it.kind : '') + (over === 'n' + i ? ' drop' : '') + (lift ? ' lift' : '') + (cold && cold.has(i) ? ' cold' : ''),
        style: itemEdge(it), 'data-nslot': i, onPointerDown: it ? grab : undefined },
        it ? h(ItemIcon, { it }) : null, it ? h(Grab) : null,
        on.has(i) ? h('i', { className: 'pulse on', style: { background: pc, borderColor: pc, color: pc } }) : null);
    }
    const cls2 = 'anavc' + (c.dim ? ' locked' : ' on') + (c.sel ? ' sel' : '') + (c.gun ? ' gun' : '') + (over === 'g' + i || over === 'p' + i ? ' drop' : '') +
      (pick !== undefined && to === pick ? ' pick' : '');
    const style = c.col && !c.dim ? { borderColor: c.col, boxShadow: '0 0 10px ' + (c.glow || c.col + '66') } : undefined;
    let inner = null;
    if (c.gun) inner = h(GunIcon, { gun: c.gun });
    else if (c.helm && c.col) inner = h(HelmetIcon, { col: c.col, size: 35 });     // a player: his helmet (owner)
    else if (c.icon) inner = h(PixIcon, { id: c.icon, size: 20, tint: level === 'exo' ? HUB_MACHINES.exo.hue : undefined });      // themed pixel icons, not emoji (owner)
    else if (c.glyph) inner = h('span', { className: 'anavg' }, c.glyph);
    else if (c.label) inner = h('span', { className: 'anavp', style: { background: c.col } }, c.label);
    const press = c.helm && level === 'players' ? hold : level === 'guns' && c.gun ? gunHold : go;
    return h('div', { key: c.key, className: cls2, 'data-player': level === 'players' ? i : undefined, 'data-open': c.open, 'data-gslot': level === 'guns' ? i : undefined, 'data-pslot': level === 'players' && !c.helm ? i : undefined,
      title: c.glyph ? c.label : undefined, style, onPointerDown: press }, inner);
  };
  return h('div', { className: 'anavrow ' + cls + ' l-' + level + (row.shape === 'slots' ? ' slots' : '') + (pick !== undefined ? ' picked' : '') + (slideIn ? ' slide' : ''), 'data-level': level,
    style: row.col ? { borderColor: row.col, boxShadow: '0 0 12px ' + row.col + '55' } : undefined },
    row.shape === 'stats' ? h(StatsRow, { meters, pin: pinNav }) : row.cells.map(cell));
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
// each), over the last 5 / 15 / 30 s or the whole level (a tap cycles; the span small in the corner). Redrawn 4 times a
// second. (feedback round 2) Held DEV.autoHoldMs, the graph under the finger is pinned above the nav (pin), or unpinned.
/** @param {{ meters: () => PlayerMeters | null, pin: (kind: 'dmg' | 'hp', span: number) => void }} props */
function StatsRow({ meters, pin }) {
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
  /** a tap cycles the span; a hold pins the graph under the finger @param {any} e */
  const press = e => {
    e.preventDefault(); SFX.unlock();
    /** @type {'dmg' | 'hp'} */
    const kind = e.target && e.target.closest && e.target.closest('.astatg.hp') ? 'hp' : 'dmg';
    const id = e.pointerId;
    let held = false;
    const t = setTimeout(() => { held = true; SFX.fx('open'); pin(kind, span); }, DEV.autoHoldMs);
    /** @param {any} ev */
    const up = ev => {
      if (ev.pointerId !== id) return;
      clearTimeout(t); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (!held && ev.type === 'pointerup') { SFX.ui('tap'); setSpan(nextSpan); }
    };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  return h('div', { className: 'astats', 'data-span': span, onPointerDown: press },
    h('canvas', { ref: dmg, className: 'astatg dmg' }),
    h('canvas', { ref: hp, className: 'astatg hp' }),
    h('i', { className: 'astatspan' }, spanLabel(span)));
}

// ---- feedback round 2: pinned graphs ----
/** @typedef {{ p: number, kind: 'dmg' | 'hp', span: number }} Pin */
const PIN_H = 34, PIN_GAP = 4;
// The pinned graphs, over the play area just above the player row (the nav's row at the top level; raised, lift px up, it
// carries them up with it): damage on the left, health on the right, as in the stats row; no box. Each side a stack, the newest at the bottom, the older ones risen (the nav stack's slide in and lift).
// Taps go through them (pointer-events none). A dot in the player's colour marks whose line it is
/** @param {{ pins: Pin[], run: AutoRun, metersOf: (p: number) => PlayerMeters | null, lift: number }} props */
function PinStack({ pins, run, metersOf, lift }) {
  /** @param {'dmg' | 'hp'} kind */
  const side = kind => {
    const mine = pins.filter(q => q.kind === kind);
    return mine.map((q, i) => h('div', { key: kind + q.p, className: 'apin ' + kind, 'data-p': q.p, style: { transform: 'translateY(' + (-(mine.length - 1 - i) * (PIN_H + PIN_GAP)) + 'px)' } },
      h(PinGraph, { pin: q, col: (run.players[q.p] || { col: '#fff' }).col, metersOf })));
  };
  return h('div', { className: 'apins', style: { transform: 'translateY(' + (-lift) + 'px)' } }, ...side('dmg'), ...side('hp'));
}
/** one pinned graph: its line redrawn 4 times a second @param {{ pin: Pin, col: string, metersOf: (p: number) => PlayerMeters | null }} props */
function PinGraph({ pin, col, metersOf }) {
  /** @type {{ current: HTMLCanvasElement | null }} */
  const ref = useRef(null);
  useEffect(() => {
    const draw = () => { const M = metersOf(pin.p); paintGraph(ref.current, meterTail(M && M[pin.kind], pin.span), pin.kind === 'hp' ? '#5ee05a' : '#ff4a4a'); };
    draw();
    const id = setInterval(draw, 250);
    return () => clearInterval(id);
  }, []);
  return h('div', { className: 'apinin' }, h('i', { className: 'apindot', style: { background: col } }), h('canvas', { ref, className: 'apinc' }));
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
