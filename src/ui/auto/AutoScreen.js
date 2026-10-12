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
import { TITLE_VW, camAt, camPack, camTo, titleCam } from '../../art/titlescene.js';
/** @typedef {import('../../art/titlescene.js').TitleCam} TitleCam */
import { DEAD, PH, PW } from '../../core/consts.js';
import { holoPass } from '../../game/render/guide.js';
import { chestOpen } from '../../auto/chests.js';
import { HUB_W, hubExit, hubLeft, hubMapA, hubMapPick, hubScene, hubState, hubStick, hubStopX } from '../../auto/hub.js';
import { MAP_NAMES, mapLabel, mapsOf } from '../../auto/maps.js';
import { THROW_TAKES, hubPayAt, hubPayOne, payVel } from '../../auto/throw.js';
import { hubOwed } from '../../auto/payout.js';
import { levelClearedAge, levelControl, levelDeathPrompt, levelDone, levelHold, levelLost, levelPicked, levelScene, levelState, levelTeleportHome } from '../../auto/level.js';
import { clearedText } from '../../art/cleared.js';
import { drawHint } from '../../game/render/hubdraw.js';
import { DEV } from '../../dev/knobs.js';
import { levelBoss } from '../../auto/enemies.js';
import { MODS, famCol } from '../../spells/mods.js';
import { HUB_MACHINES } from '../../auto/hub.js';
import { PERKS, STAT_PERKS } from '../../data/perks.js';
import { bagFit, EXO_STATS, MAX_PLAYERS, addPlayer, bagAdd, bagSlotOf, fitExo, fitGun, fitMod, fitPerk, healRun, levelCleared, levelFailed, levelSeed, kitMissing, newRun, bagMove, rowMove, rowToBag, gunToBag, gunMove, unfitGun,
  bagCount, scrapAt, setActive, spend, unfitExo, unfitMod, unfitPerk } from '../../auto/run.js';
import { loadAutoRun, saveAutoRun } from '../../auto/save.js';
import { EXO_NAMES, arcPick, gunArc, navBack, navOpen, navPath, navPick, navRow, navStart, hpFrac } from '../../auto/nav.js';
import { meterTail, nextSpan, spanLabel } from '../../auto/meters.js';
import { CARD_ICON, GunCard, ModCard, PerkCard } from '../cards.js';
import { GunIcon, GunStats, PULL_COL } from '../editor.js';
import { fireSimNew, pullSteps } from '../../spells/bagsim.js';
import { PV_GRAPH_N, PV_HIT_T, previewScene, previewState, pvSim } from '../../auto/preview.js';
import { GlyphIcon, HelmetIcon, PixIcon, TargetPic } from './icons.js';
import { discrimId, targetOf } from '../../spells/discrim.js';
import { DISCRIM_TARGETS, isAutoTarget } from '../../art/discrimicon.js';
import { PauseMenu } from '../pause.js';
import { DevPanel } from '../devpanel.js';
import { DEV_HOLD_MS, devShown, setDevShown } from '../devmode.js';
import { runScene } from '../scenecanvas.js';
import { leaveItem } from '../../art/titlescene.js';
import { drawRunner, helmetIcon } from '../../art/sprites.js';
import { sceneAddRunner } from '../../auto/addrunner.js';
import { bagFits, lootCol } from '../../auto/loot.js';
import { itemEdgeCol } from '../../auto/itemtile.js';
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
  // (feedback round 2) the Dev panel: ⏸ held DEV_HOLD_MS toggles dev mode (as the old game); on, a ⚙️ beside ⏸ opens it
  const [devOn, setDevOn] = useState(devShown);
  const [devOpen, setDevOpen] = useState(false);
  // (bug round 2) the player in manual mode (the camera's lock in a level; -1 none): his helmet in the nav wears the crosshair
  const [manual, setManual] = useState(-1);
  const [, setHpKey] = useState('');   // the players' health (the helmet rings): redraw when it moves
  pausedRef.current = paused || devOpen;
  const cvs = useRef(null);
  // (owner) the journey box: the level as a strip at its own shape, the players' helmets where they are; a tap hides it, a tap on its place brings it back
  /** @type {{ current: HTMLCanvasElement | null }} */
  const jcvs = useRef(null);
  const [jHid, setJHid] = useState(false);
  const [inLvl, setInLvl] = useState(false);
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
  // (feedback round 2) B at the player row hides the nav; a tap on the play area brings it back
  const [navHidden, setNavHidden] = useState(false);
  // (owner, v1.0.46) the bag grown up over the play area (a double tap on an empty slot; again, or B, back): its top pulled
  // up by bigBag px (a negative margin: the flex column gives it the room), 0 when it's its own size
  const [bigBag, setBigBag] = useState(0);
  const emptyTap = useRef(0);
  // (owner, v1.0.47) the play area grown down over the nav and the bag to the bag's bottom edge (a double tap on it; again,
  // or B, back): bigPlay px added to its height, taken back by a negative bottom margin, so the rest stays where it is under it
  const [bigPlay, setBigPlay] = useState(0);
  const bigPlayRef = useRef(0);
  bigPlayRef.current = bigPlay;
  const playTapT = useRef(0);
  const navRef = useRef(nav);
  navRef.current = nav;
  // stage 8b: dragging between the bag and the nav's slots, a tap's card
  const [, setV] = useState(0);
  /** @type {BagItem | null} */
  const noCard = null;
  const [card, setCard] = useState(noCard);
  /** @type {DiscrimPopAt | null} */
  const noPop = null;
  const [dpop, setDpop] = useState(noPop);   // a held Discriminate tile's target popup (owner, v1.0.71)
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
      const pk = L && scene.current ? levelPicked(scene.current) : null;
      setManual(pk ? pk.id : -1);
      setHpKey(run.players.map(q => q ? Math.round(hpFrac(q) * 100) : '').join());
      setBlocked(!!(L && L.blocked));
      setInLvl(!!L);
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
  // (owner) a pickup taken into the bag: a copy of its tile flies from where the player took it (x, y in the scene) to the
  // bag slot it went into (bagSlotOf); that slot scrolled out of sight: to the bag's nearest edge; no bag on show: none
  /** @type {Fly[]} */
  const noFlies = [];
  const [flies, setFlies] = useState(noFlies);
  const flyN = useRef(0);
  /** @param {BagItem} it @param {number} x @param {number} y */
  const flyIn = (it, x, y) => {
    const c = cvs.current, C = cam.current, bag = document.querySelector('.abag'), i = bagSlotOf(run, it);
    const tile = i >= 0 ? document.querySelector('.abag [data-slot="' + i + '"]') : null;
    if (!c || !C || !bag || !tile) return;
    const cr = c.getBoundingClientRect(), br = bag.getBoundingClientRect(), tr = tile.getBoundingClientRect();
    if (br.width < 4 || br.height < 4 || cr.width < 4) return;
    const v = camTo(C, x, y), k = cr.width / TITLE_VW, s = tr.width;
    const tx = Math.max(br.left + s / 2, Math.min(br.right - s / 2, tr.left + s / 2)), ty = Math.max(br.top + s / 2, Math.min(br.bottom - s / 2, tr.top + s / 2));
    // a new slot (the item's whole stack is this pickup) stays empty till the copy lands (owner); a stack it joined shows at once
    const fresh = !!run.bag[i] && (run.bag[i].n || 1) <= (it.n || 1);
    const f = { k: ++flyN.current, it: Object.assign({}, it), slot: i, fresh, x0: cr.left + v.x * k, y0: cr.top + v.y * k, x1: tx, y1: ty, s };
    setFlies(fs => [...fs, f]);
  };
  useEffect(() => {
    const c = cvs.current;
    if (!c) return undefined;
    return runScene(c, {
      size: () => ({ w: c.clientWidth, hh: c.clientHeight }),
      make: (w, hh, seed) => {
        // (v1.0.47 fix) a scene made while the play area is grown is still made at its own size: shrunk back, the camera
        // stays on the players
        const k = w / TITLE_VW, vh = Math.max(1, hh - bigPlayRef.current) / k;
        // the level: the run's (a test flag opens one straight away: window.__AUTO_LEVEL = its seed); full heal at its start
        if (where.current === 'level') {
          // (tall levels) a level is made at the grown play area's height (down to the bag's bottom edge) whether it's grown
          // or not: the UI open, the camera follows the pack up and down it (C.pack, art/titlescene.js camStep)
          const bag = c.parentElement && c.parentElement.parentElement && c.parentElement.parentElement.querySelector('.abag');
          const lvh = (hh + (bag ? Math.max(0, bag.getBoundingClientRect().bottom - c.getBoundingClientRect().bottom) : 0)) / k;
          healRun(run);
          saveAutoRun(run);
          const S = levelScene(lvh, window.__AUTO_LEVEL || levelSeed(run), run.players.length, undefined, run.players, run.tier, run);
          scene.current = S;
          S.onTake = (it, x, y) => flyIn(it, x, y);
          if (window.__TEST_TITLE) { window.__autoScene = S; window.__autoCam = cam; }   // the shot scripts (tools/clearshots.js) reach the level here
          const C = titleCam(hh / k / 2, lvh);
          C.pack = true; C.view = hh / k;
          camPack(C, S, 1);
          cam.current = C;
          return { S, C, warm: 0 };
        }
        // the hub: the strip, the players teleporting in, the camera on player 1
        const S = hubScene(vh, seed, run.players.length, run.tier, run.paid || (run.paid = {}), run);
        scene.current = S;
        S.onTake = (it, x, y) => flyIn(it, x, y);
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
      still: true,  // (feedback round 2) one fixed view: no pinch, drag or tap to follow
      // LEVEL CLEARED (stage 7), in the upper part of the play area
      // (feedback round 2) everyone down: "Tap A to Teleport back to Hub" (the hub's hint look), on the screen whatever the zoom
      over: (ctx, S, w, hh) => {
        const a = levelClearedAge(S); if (a >= 0) clearedText(ctx, a, DEV.autoClearT, w, hh * 0.14);
        if (jcvs.current) journeyDraw(jcvs.current, S, run);
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
    // (feedback round 2) a player in manual mode (his helmet held: the camera's lock): the stick steers him; none: it hurries or slows the team
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
    // the map machine (auto/maps.js): A picks an owned map, pays the next locked one, else nothing
    if (at === 'map') { const a = hubMapA(S); if (a === 'pick') { if (hubMapPick(S)) { SFX.fx('open'); saveAutoRun(run); setV(n => n + 1); } return; } if (a === 'no') { SFX.ui('tap'); return; } }
    const kind = THROW_TAKES[at], id = e.pointerId, x0 = e.clientX, y0 = e.clientY;
    let dx = 0, dy = 0, stream = false, acc = 0, t0 = 0, last = performance.now();
    // (owner, v1.0.45) gold held at full speed steps up: medium nuggets worth autoStreamMedN, then big ones from
    // autoStreamBigN doubling every autoStreamGrow s; each no more than the bag has and the machine still wants
    /** @param {number} [want] @param {number} [sz] */
    const one = (want = 1, sz) => {
      const n = Math.max(1, Math.min(want, bagCount(run, kind), hubOwed(S, at)));
      if (!spend(run, kind, n)) return false;
      const L = S.runners[0], v = payVel(L ? L.face : 1, dx, dy);
      hubPayOne(S, kind, v.vx, v.vy, at, n, n > 1 ? sz : undefined);
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
      const top = (now - t0) / 1000 - DEV.autoStreamRamp, big = top - DEV.autoStreamMedT - DEV.autoStreamBigT;
      const want = kind !== 'gold' || top < DEV.autoStreamMedT ? 1 : big < 0 ? DEV.autoStreamMedN : DEV.autoStreamBigN * Math.pow(2, big / DEV.autoStreamGrow);
      while (acc >= 1) { acc -= 1; if (!one(Math.round(want), big < 0 ? 1 : 0)) { acc = 0; break; } }
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
  // ⏸: the pause menu at once; held on DEV_HOLD_MS (a let-go anywhere ends it) it also toggles dev mode (the ⚙️)
  /** @param {any} e */
  const pauseDown = e => {
    e.preventDefault(); SFX.fx('open'); setPaused(true);
    const id = e.pointerId;
    const t = setTimeout(() => {
      const v = !devShown(); setDevShown(v); setDevOn(v);
      try { if (navigator.vibrate) navigator.vibrate(60); } catch (_) { /* no vibration */ }
    }, DEV_HOLD_MS);
    /** @param {any} ev */
    const up = ev => { if (ev.pointerId !== id) return; clearTimeout(t); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  // B (feedback round 2): a player steered by hand in a level: let him go (the autopilot); else back up the nav (to the
  // player row: nobody marked); at the player row: hide the nav (a tap on the play area brings it back)
  const pressB = () => {
    nothing();
    if (bigBag) { SFX.fx('close'); setBigBag(0); return; }
    if (bigPlay) { SFX.fx('close'); setBigPlay(0); return; }
    const S = scene.current, C = cam.current, n = navRef.current;
    if (S && S.lvl && S.runners.some(r => r.ctl)) { if (C) C.lock = -1; levelControl(S, -1, null); SFX.fx('close'); return; }
    if (n.level !== 'players') { const up = navBack(n); setNav(up.level === 'players' ? { ...up, p: -1 } : up); return; }
    if (!navHidden) { SFX.fx('close'); setNavHidden(true); }
  };
  /** a tap on the journey box (or its empty place): hide it, show it @param {any} e */
  const jTap = e => { e.stopPropagation(); SFX.ui('tap'); setJHid(v => !v); };
  // a tap on an empty bag slot: the second within BIG_TAP ms grows the bag up to the play area's top, or puts it back
  /** @param {any} e */
  const emptyDown = e => {
    const now = performance.now();
    if (now - emptyTap.current > BIG_TAP) { emptyTap.current = now; return; }
    emptyTap.current = 0;
    if (bigBag) { SFX.fx('close'); setBigBag(0); return; }
    const bag = e.currentTarget && e.currentTarget.closest('.abag'), play = cvs.current && cvs.current.closest('.aplay');
    if (!bag || !play) return;
    SFX.fx('open');
    setBigBag(Math.max(0, bag.getBoundingClientRect().top - play.getBoundingClientRect().top));
  };
  /** a tap on the play area: the nav back if hidden @param {any} e */
  const playTap = e => {
    if (e.target && e.target.closest && e.target.closest('.pausebtn, .adevbtn')) return;
    const now = performance.now();
    if (now - playTapT.current <= BIG_TAP) {
      playTapT.current = 0;
      if (bigPlay) { SFX.fx('close'); setBigPlay(0); return; }
      const play = e.currentTarget, bag = play && play.parentElement && play.parentElement.querySelector('.abag');
      if (play && bag) { SFX.fx('open'); setBigPlay(Math.max(0, bag.getBoundingClientRect().bottom - play.getBoundingClientRect().bottom)); }
      return;
    }
    playTapT.current = now;
    if (navHidden) { SFX.fx('open'); setNavHidden(false); }
  };
  // (feedback round 2) everyone down in a level: A sets off the teleport home (the helmet light, the blast: auto/death.js)
  const pressA = () => { SFX.ui('tap'); if (scene.current && scene.current.lvl && levelTeleportHome(scene.current)) { SFX.fx('open'); return; } if (scene.current && (hubExit(scene.current) || (!!scene.current.lvl && chestOpen(scene.current)))) SFX.fx('open'); };
  /** what the source item is: a bag slot's, or a nav slot's at the nav's level @param {DragSrc} src @returns {BagItem | null} */
  const srcItem = src => {
    if (src.from === 'bag') return run.bag[src.i] || null;
    if (src.from === 'guns') { const pl = run.players[navRef.current.p], g = pl && pl.guns[src.i]; return g ? { kind: 'gun', gun: g, n: 1 } : null; }
    const c = navRow(navRef.current, run, MAX_PLAYERS).cells[src.i];
    return (c && c.item) || null;
  };
  // a press on a tile: on the grab handle it may become a drag (past MOVE px); a release without one is a tap (its card);
  // a cancelled press (the browser took it for a scroll) does nothing
  /** @param {any} e @param {DragSrc} src @param {boolean} [force] a drag without the grab handle (a gun circle slid off) */
  const down = (e, src, force) => {
    if (press.current || !srcItem(src)) return;
    const grab = !!force || !!(e.target && e.target.closest && e.target.closest('.agrab'));
    if (grab) e.preventDefault();
    /** @type {Press} */
    const p = { id: e.pointerId, x0: e.clientX, y0: e.clientY, src, grab, drag: false };
    press.current = p;
    // (owner, v1.0.71) a Discriminate tile held DEV.autoHoldMs (not moved): its target popup, no drag, no card
    const it0 = srcItem(src), el = e.currentTarget;
    /** @param {any} ev */
    const noMenu = ev => ev.preventDefault();
    const holdT = it0 && it0.kind === 'mod' && isDiscrim(it0.id) ? setTimeout(() => {
      if (p.drag || press.current !== p) return;
      p.held = true; SFX.fx('open');
      const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : { left: p.x0, top: p.y0, width: 0, height: 0 };
      const n = navRef.current;
      setDpop({ src, pl: n.p, g: n.g == null ? -1 : n.g, x: r.left + r.width / 2, top: r.top, bottom: r.top + r.height });
    }, DEV.autoHoldMs) : 0;
    if (holdT) addEventListener('contextmenu', noMenu);
    const finish = () => {
      press.current = null;
      if (holdT) { clearTimeout(holdT); setTimeout(() => removeEventListener('contextmenu', noMenu), 400); }
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel);
    };
    /** @param {any} ev */
    const move = ev => {
      if (ev.pointerId !== p.id) return;
      if (p.held) { ev.preventDefault(); return; }
      if (!p.drag && Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) > MOVE) {
        if (holdT) clearTimeout(holdT);
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
      if (p.held) return;
      if (p.drag) drop(src, ev.clientX, ev.clientY, p);
      else if (Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) <= MOVE) { const it = srcItem(src); if (it && hasCard(it)) { SFX.ui('tap'); setCard(it); } }
    };
    /** @param {any} ev */
    const cancel = ev => { if (ev.pointerId === p.id) { finish(); setDrag(null); } };
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
  };
  /** a target picked in the popup: the copy becomes discrimId(t) (one off a stack), the run saved @param {DiscrimPopAt} at @param {DiscrimTarget} tg */
  const setTarget = (at, tg) => {
    const id = discrimId(tg);
    if (at.src.from === 'bag') {
      const it = run.bag[at.src.i];
      if (it && it.kind === 'mod' && isDiscrim(it.id) && it.id !== id) {
        if (it.n > 1) { it.n--; if (bagAdd(run, { kind: 'mod', id, n: 1 })) it.n++; }
        else it.id = id;
      }
    } else if (at.src.from === 'nav') {
      const pl = run.players[at.pl], g = pl && pl.guns[at.g];
      if (g && isDiscrim(g.slots[at.src.i])) g.slots[at.src.i] = id;
    }
    saveAutoRun(run); SFX.ui('tap'); setDpop(null); setV(v => v + 1);
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
      return { key: 'g' + s, to: 'gun', s, ok: (src.from === 'bag' && n.level === 'guns' && it.kind === 'gun') || (src.from === 'guns' && s !== src.i) };
    }
    if (src.from === 'guns') { const j = gt ? Number(gt.dataset.slot) : -1; return { key: j >= 0 ? 's' + j : 'bag', to: 'bag', s: j, ok: t.classList.contains('abag') || !!gt }; }
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
      else if (src.from === 'guns' && at.to === 'gun') done = gunMove(run, n.p, src.i, at.s);
      else if (src.from === 'guns' && at.to === 'bag') done = (at.s >= 0 && gunToBag(run, n.p, src.i, at.s)) || unfitGun(run, n.p, src.i);
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
    const x0 = e.clientX, y0 = e.clientY;
    const finish = () => { clearTimeout(timer); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cancel); };
    // (owner, v1.0.43) slid off before the hold: the gun is dragged (into the bag, or onto another gun circle: a swap)
    /** @param {any} ev */
    const move = ev => {
      if (ev.pointerId !== id || held || Math.hypot(ev.clientX - x0, ev.clientY - y0) <= MOVE) return;
      finish();
      down({ pointerId: id, clientX: x0, clientY: y0, target: null, preventDefault() {} }, { from: 'guns', i }, true);
    };
    /** @param {any} ev */
    const up = ev => { if (ev.pointerId !== id) return; finish(); if (!held) openAt(s, i); };
    /** @param {any} ev */
    const cancel = ev => { if (ev.pointerId === id) finish(); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', cancel);
  };
  // stage 9: a press on a player's helmet. Let go soon: his menu (a tap). Held DEV.autoHoldMs: in a level (feedback round 2)
  // manual mode for him (auto/level.js: the pill stick steers him, the view follows, the team behind him; B lets him go);
  // in the hub (player 1 is always steered there) his 4 guns fan out in an arc above it; slide onto one (it lights) and
  // let go: that gun fires (setActive, saved); let go on none: nothing
  /** @param {any} e @param {number} i */
  const holdHelm = (e, i) => {
    e.preventDefault();
    if (press.current || !run.players[i]) return;
    const r = e.currentTarget.getBoundingClientRect(), id = e.pointerId;
    /** @type {{ x: number, y: number }[] | null} */
    let pts = null;
    let hi = -1, roam = false;
    const timer = setTimeout(() => {
      const S = scene.current, C = cam.current;
      if (S && S.lvl) {
        roam = true; SFX.unlock(); SFX.fx('open');
        const p = S.runners.find(q => q.id === i);
        if (C && p && !p.out) { C.lock = i; levelControl(S, i, null); }
        return;
      }
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
      if (roam) return;
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
    h('div', { className: 'aplay' + (bigPlay ? ' big' : '') + (drag && drag.over && drag.over.key === 'play' && drag.over.ok ? ' drop' : ''), onPointerDown: playTap,
      style: { flexBasis: 'calc(55% + ' + bigPlay + 'px)', marginBottom: -bigPlay + 'px' } },
      h('canvas', { ref: cvs, className: 'aplaycvs' }),
      blocked ? h('div', { className: 'ablocked' }, 'Path blocked') : null,
      h('div', { className: 'atop' + (devOn ? ' dev' : '') },
        h('div', { className: 'alvlinfo' }, h('b', null, mapInfo(run).name), h('span', null, 'Level ' + mapInfo(run).level)),
        inLvl ? h('div', { className: 'ajourney' + (jHid ? ' off' : ''), onPointerDown: jTap }, h('canvas', { ref: jcvs })) : null,
        boss ? h('div', { className: 'abossbar' }, h('b', null, boss.name),
          h('div', { className: 'abosstrack' }, h('i', { style: { width: (100 * boss.hp / Math.max(1, boss.max)).toFixed(1) + '%' } }))) : null),
      devOn ? h('button', { className: 'adevbtn', title: 'Dev', onPointerDown: tap(() => { SFX.fx('open'); setDevOpen(true); }) }, '⚙️') : null,
      h('button', { className: 'pausebtn', title: 'Pause (hold 5 s: dev mode)', onPointerDown: pauseDown }, '⏸')),
    h(NavStack, { nav, run, openAt, down, drag, holdHelm, holdGun, meters, pins, metersOf, pinNav, hidden: navHidden, manual }),
    h('div', { className: 'abag' + (bigBag ? ' big' : '') + (drag && drag.over && drag.over.key === 'bag' && drag.over.ok ? ' drop' : ''), style: { marginTop: -bigBag + 'px' } },
      ...Array.from({ length: (bagFit(run), run.bag.length) }, (_, i) => h(BagSlot, { key: i, i, it: flies.some(f => f.fresh && f.slot === i) ? null : run.bag[i], down, empty: emptyDown,
        lift: !!drag && drag.src.from === 'bag' && drag.src.i === i,
        drop: !!drag && !!drag.over && drag.over.ok && drag.over.key === 's' + i }))),
    h('div', { className: 'abtns' },
      h(PillStick, { onMove: steer }),
      h('button', { className: 'abtn ab', onPointerDown: tap(pressB) }, 'B'),
      h('button', { className: 'abtn aa', onPointerDown: downA }, 'A')),
    arc ? h(GunArc, { arc, run }) : null,
    burst ? h(CoinBurst, { key: burst.k, burst }) : null,
    drag ? h(Ghost, { drag, it: srcItem(drag.src) }) : null,
    flies.map(f => h(FlyTile, { key: f.k, f, done: () => setFlies(fs => fs.filter(q => q.k !== f.k)) })),
    card ? h(CardPop, { it: card, close: () => setCard(null) }) : null,
    dpop ? h(DiscrimPop, { at: dpop, cur: (() => { const it = srcItem(dpop.src); return it ? targetOf(it.id) : null; })(), pick: tg => setTarget(dpop, tg), close: () => { SFX.fx('close'); setDpop(null); } }) : null,
    devOpen ? h(DevPanel, { input, refresh: () => setV(v => v + 1), close: () => { SFX.fx('close'); setDevOpen(false); },
      onGem: kind => { bagAdd(run, { kind, n: 1 }); saveAutoRun(run); SFX.fx('coin'); setV(v => v + 1); } }) : null,
    paused ? h(PauseMenu, { input, label: mapLabel(run), onNew: freshRun, close:() => { SFX.fx('close'); setPaused(false); } }) : null);
}

// PillState: as the old game's left stick (ui/hud.js Stick): active while held; dx, dy the finger from the middle as a
// share of the pill's half-width and half-height (so a small push up reads as up); mag their length (0-1, clamped), nx, ny
// its direction
/** @typedef {{ active: boolean, nx: number, ny: number, mag: number, dx: number, dy: number }} PillState */
const PILL_REST = { active: false, nx: 0, ny: 0, mag: 0, dx: 0, dy: 0 };
const PILL_REACH = 54;                 // the knob's reach (px): the old 150 px stick's 75 × 0.72 (ui/hud.js Stick maxD)

// The stick (owner, bug round 1: was a pill between B and A): a circle at the bar's left end, centred on the bar's middle
// and rising over the bag's corner (cut off at the bar's bottom), so there's room to push down as well as up; one outline
// round it and the bar (style.css: the ring under the bar's fill, the circle's fill over it). The knob rests at its centre
// (.apill, the maths' centre) in a shallow dark well, and follows the finger. Pointer capture, so the finger may wander off it; letting go puts the knob back and the push to rest
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
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* (a synthetic event: no capture) */ }
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
  return h('div', { className: 'astick', onPointerDown: down, onPointerMove: move, onPointerUp: end, onPointerCancel: end },
    h('i', { className: 'adomering' }), h('i', { className: 'adomefill' }),
    h('div', { ref, className: 'apill' },
      h('div', { className: 'apillknob' + (knob.jet ? ' jet' : ''), style: { transform: 'translate(' + knob.x + 'px,' + knob.y + 'px)' } })));
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
 *   meters: () => PlayerMeters | null, pins: Pin[], metersOf: (p: number) => PlayerMeters | null, pinNav: (kind: 'dmg' | 'hp', span: number) => void,
 *   hidden?: boolean, manual?: number }} props
 */
function NavStack({ nav, run, openAt, down, drag, holdHelm, holdGun, meters, pins, metersOf, pinNav, hidden, manual }) {
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
        col: MACHINE_EDGE, onLit: cls === 'anavout' ? undefined : setLit, cls, pl: run.players[it.s.p], gi: it.s.g }) : null;
    }
    const s = it.s;
    /** @param {string | number} w */
    const open = w => openAt(s, w);
    /** @param {any} e @param {number} i */
    const hg = (e, i) => holdGun(e, s, i);
    return h(NavRow, { row: navRow(s, run, MAX_PLAYERS), level: s.level, cls, pick: cur ? undefined : navPick(nav, s.level),
      open, down, drag: cls === 'anav' ? drag : null, holdHelm, holdGun: hg, meters, pinNav, manual, slide: ready.current, cold: cls === 'anav' ? cold : null, lit: cls === 'anav' && nav.level === 'gun' ? lit : null });
  };
  return h('div', { className: 'anavwrap' + (hidden ? ' hid' : '') },
    h(PinStack, { pins, run, metersOf, lift: off[0] || 0 }),
    ...items.map((it, i) => h('div', { key: it.key, className: 'anavslot' + (it.panel ? ' panel' : ''), style: { transform: 'translateY(' + (-off[i]) + 'px)' } },
      body(it, i === last ? 'anav' : it.panel ? 'up' : 'anavup', i === last))),
    ...gone.map(o => h('div', { key: 'gone-' + o.it.key + o.k, className: 'anavslot' + (o.it.panel ? ' panel' : '') }, body(o.it, 'anavout', false))));
}
// the gun panel's edge: the mod machine's colour, as the mod slots' row under it
const MACHINE_EDGE = HUB_MACHINES.mod.hue;

// The gun panel (owner, feedback round 2): the old Bag's top (ui/editor.js) in the auto screen's colours: the gun's stats
// on the left (the live cast/recharge/mana bars), the firing window on the right. (owner: "matching the real game 1 for 1") The
// window is the level's own scene (auto/preview.js previewScene, run by runScene: quiet, still): the player fires the gun at a
// target that never dies, by the level's code at the level's speed and scale (PreviewWindow). Its step feeds the stat bars
// (pvSim), the damage per second over the target and its graph, and lights the mod slots below in each pull's colour (onLit).
// (owner, round 2) A double tap on the window grows it left over the stats (.big: the stats hidden), again shrinks it back; the
// room is made again at the new size, the player at its new left edge.
/** @param {{ gun: Gun, sig: string, col: string, onLit?: (lit: any) => void, cls: string, pl: RunPlayer, gi: number }} props */
function GunPanel({ gun, sig, col, onLit, cls, pl, gi }) {
  /** @type {{ current: import('../../spells/bagsim.js').FireSim & { sig?: string } | null }} */
  const sim = useRef(null);
  if (!sim.current || sim.current.sig !== sig) sim.current = Object.assign(fireSimNew(gun), { sig });
  const [big, setBig] = useState(false);
  const flip = () => setBig(b => !b);
  return h('div', { className: 'agunpanel ' + cls + (big ? ' big' : ''), style: { '--pc': col } },
    h(GunStats, { gun, sim, sig }),
    h(PreviewWindow, { sim, sig, onLit, pl, gi, flip }));
}

// the firing window: the preview scene on a canvas, at the play area's scale (css px per world unit, as the level is drawn)
// the hologram (the old window's dummy you, ui/editor.js GunFire): its own little layer, HOLO_P px a world unit, through the
// guide's hologram look (render/guide.js holoPass); dark at rest, lit and glitching for PV_HIT_T after a hit
const HOLO_P = 3;
/** @param {{ sim: { current: import('../../spells/bagsim.js').FireSim | null }, sig: string, onLit?: (lit: any) => void, pl: RunPlayer, gi: number, flip: () => void }} props */
function PreviewWindow({ sim, sig, onLit, pl, gi, flip }) {
  const tapT = useRef(0);
  /** a second tap within BIG_TAP ms: grow / shrink @param {any} e */
  const tap = e => { e.preventDefault(); const t = performance.now(); if (t - tapT.current < BIG_TAP) { tapT.current = 0; flip(); } else tapT.current = t; };
  /** @type {{ current: HTMLCanvasElement | null }} */
  const ref = useRef(null);
  const litFn = useRef(onLit);
  litFn.current = onLit;
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    /** @type {TitleCam | null} */
    let cam = null;
    let prev = null;
    const DL = document.createElement('canvas'), dlx = DL.getContext('2d', { willReadFrequently: true });
    const DLW = Math.ceil((PW + 8) * HOLO_P), DLH = Math.ceil((PH + 6) * HOLO_P);
    DL.width = DLW; DL.height = DLH;
    // the level's scale: the play area's canvas is TITLE_VW world units across
    const play = document.querySelector('.aplaycvs');
    const kpx = () => Math.max(1, (play && play.clientWidth) || window.innerWidth) / TITLE_VW;
    const stop = runScene(c, {
      size: () => ({ w: c.clientWidth, hh: c.clientHeight }),
      make: (w, hh, seed) => {
        const k = kpx(), vw = w / k, vh = hh / k, S = previewScene(vw, vh, pl, gi, seed);
        // the camera: the whole room, at k px a unit (titleDraw draws w / TITLE_VW × C.z px a unit)
        const z = TITLE_VW / vw, C = titleCam(vh * z / 2, vh);
        C.z = C.zmin = z; C.w = vw; C.x = vw / 2; C.y = vh / 2; C.lock = -1;
        cam = C;
        if (window.__TEST_TITLE) window.__pvScene = S;   // shot scripts reach the preview (tools/discrimshots.js)
        return { S, C, warm: 20 };
      },
      quiet: true, still: true,
      step: S => {
        const pv = previewState(S), p = S.team && S.team[0], g = p && p.guns[p.active];
        if (sim.current && g) pvSim(sim.current, g);
        if (pv && pv.lit !== prev) { prev = pv.lit; if (litFn.current) litFn.current(pv.lit); }
      },
      over: (ctx, S, w) => {
        const pv = previewState(S);
        if (!pv || !cam) return;
        const k = w / TITLE_VW, z = cam.z * k, at = camTo(cam, pv.dx - PW / 2, pv.dy - PH / 2), hx = at.x * k, hy = at.y * k;
        // the hologram you, facing the gun, over the scene (the dark included: it glows)
        if (dlx) {
          const hurt = pv.hitT > 0, fl = hurt && Math.floor(pv.hitT * 30) % 2 === 0;
          dlx.setTransform(1, 0, 0, 1, 0, 0); dlx.clearRect(0, 0, DLW, DLH);
          dlx.setTransform(HOLO_P, 0, 0, HOLO_P, 4 * HOLO_P, 3 * HOLO_P);
          drawRunner(dlx, 0, 0, PW, PH, -1, null, false, 0, fl);
          dlx.setTransform(1, 0, 0, 1, 0, 0);
          holoPass(dlx, DLW, DLH, S.t, hurt ? 0.4 + pv.hitT / PV_HIT_T * 0.6 : 0);
          ctx.save();
          ctx.globalAlpha = hurt ? (fl ? 1 : 0.6) : 0.4;    // dark at rest, lit when hit
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(DL, hx - 4 * z, hy - 3 * z, DLW / HOLO_P * z, DLH / HOLO_P * z);
          ctx.restore();
        }
        // its damage per second over its head (red, as the old window's; gone at 0), and the graph across the top third
        if (pv.dps > 0) {
          ctx.font = '700 11px ui-monospace,SFMono-Regular,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          const txt = (pv.dps >= 10 ? Math.round(pv.dps) : pv.dps.toFixed(1)) + ' dps', gw0 = c.clientWidth;
          const tx = Math.min(hx + PW * z / 2, gw0 - ctx.measureText(txt).width / 2 - 2), ty = Math.max(12, hy - 2);
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.strokeText(txt, tx, ty);
          ctx.fillStyle = '#ff4a4a'; ctx.fillText(txt, tx, ty); ctx.textBaseline = 'alphabetic';
        }
        const vals = pv.graph, peak = Math.max(...vals, 0), H = c.clientHeight, gw = c.clientWidth;
        if (vals.length > 1 && peak > 0) {
          const top = 4, bot = H / 3, step = gw / (PV_GRAPH_N - 1), x0 = gw - (vals.length - 1) * step;
          ctx.strokeStyle = '#ff4a4a'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7; ctx.beginPath();
          vals.forEach((v, i) => { const x = x0 + i * step, y = bot - (v / peak) * (bot - top); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
          ctx.stroke(); ctx.globalAlpha = 1;
        }
        c.dataset.hit = pv.hitT > 0 ? '1' : '0'; c.dataset.big = String(Math.round(cam.w || 0));
        c.dataset.pulls = String(pv.pulls); c.dataset.dps = pv.dps.toFixed(1); c.dataset.shots = String(S.shots.length);
      },
    });
    return () => { stop(); if (litFn.current) litFn.current(null); };
  }, [sig]);
  return h('canvas', { ref, className: 'gfire apv', onPointerDown: tap });
}

// One row of the nav (auto/nav.js navRow): circles for choices (a player's ring and number, a menu glyph, a gun's
// sprite), square tiles for slots (the bag's tile look; a gun's mod row scrolls sideways when it has more than fit).
// Below the top the row's edge takes the tapped player's colour. Same height at every level (style.css .anavrow).
// cls: 'anav' the nav's own row, 'anavup' raised (pick: its picked cell), 'anavout' leaving. lit: the gun panel's
// pull lighting the mod slots.
/** @param {{ row: import('../../auto/nav.js').NavRow, level: string, cls: string, pick?: string | number, open: (w: string | number) => void,
 *   down: (e: any, src: DragSrc) => void, drag: Drag | null, holdHelm: (e: any, i: number) => void, holdGun: (e: any, i: number) => void,
 *   meters: () => PlayerMeters | null, lit: { slots: number[], pull: number } | null, slide?: boolean, cold?: Set<number> | null,
 *   pinNav: (kind: 'dmg' | 'hp', span: number) => void, manual?: number }} props */
function NavRow({ row, level, cls, pick, open, down, drag, holdHelm, holdGun, meters, lit, slide, cold, pinNav, manual }) {
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
    const cls2 = 'anavc' + (c.dim ? ' locked' : ' on') + (c.sel ? ' sel' : '') + (c.gun ? ' gun' : '') + (c.helm && level === 'players' && i === manual ? ' manual' : '') + (over === 'g' + i || over === 'p' + i ? ' drop' : '') +
      (pick !== undefined && to === pick ? ' pick' : '');
    const ring = c.helm && c.hp != null;   // a player: the ring round his helmet is his health (owner), in his colour, from the top clockwise
    const style = c.col && !c.dim ? { borderColor: ring ? undefined : c.col, boxShadow: '0 0 10px ' + (c.glow || c.col + '66'), ...(ring ? { '--hp': (c.hp * 360).toFixed(1) + 'deg', '--hc': c.col, '--fl': (0.12 + c.hp * 2.4).toFixed(2) + 's' } : {}) } : undefined;   // low: flashes red, faster toward 0 (0.72 s at a quarter, 0.12 s at none)
    let inner = null;
    if (c.gun) inner = h(GunIcon, { gun: c.gun });
    else if (c.helm && c.col) inner = [h(HelmetIcon, { key: 'h', col: c.col, size: 35 }), ring ? h('i', { key: 'r', className: 'ahp' }) : null, ring && c.hp < 0.25 ? h('i', { key: 'f', className: 'ahp ahpf' }) : null];     // a player: his helmet (owner)
    else if (c.icon) inner = h(PixIcon, { id: c.icon, size: 20, tint: level === 'exo' ? HUB_MACHINES.exo.hue : undefined });      // themed pixel icons, not emoji (owner)
    else if (c.glyph) inner = h('span', { className: 'anavg' }, c.glyph);
    else if (c.label) inner = h('span', { className: 'anavp', style: { background: c.col } }, c.label);
    const press = c.helm && level === 'players' ? hold : level === 'guns' && c.gun ? gunHold : go;
    return h('div', { key: c.key, className: cls2, 'data-player': level === 'players' ? i : undefined, 'data-open': c.open, 'data-gslot': level === 'guns' ? i : undefined, 'data-pslot': level === 'players' && !c.helm ? i : undefined,
      title: c.glyph ? c.label : undefined, style, onPointerDown: press }, ...(Array.isArray(inner) ? inner : [inner]));
  };
  return h('div', { className: 'anavrow ' + cls + ' l-' + level + (row.shape === 'slots' ? ' slots' : '') + (pick !== undefined ? ' picked' : '') + (slideIn ? ' slide' : ''), 'data-level': level,
    style: row.col ? { borderColor: row.col, boxShadow: '0 0 12px ' + row.col + '55' } : undefined },
    row.shape === 'stats' ? h(StatsRow, { meters, pin: pinNav }) : row.cells.map(cell));
}

// one bag slot: empty, or the item's icon and its count
/** @param {{ i: number, it: BagItem | null, down: (e: any, src: DragSrc) => void, lift: boolean, drop: boolean, empty: (e: any) => void }} props */
function BagSlot({ i, it, down, lift, drop, empty }) {
  /** @param {any} e */
  const grab = e => down(e, { from: 'bag', i });
  return h('div', { className: 'aslot' + (it ? ' full k-' + it.kind : '') + (lift ? ' lift' : '') + (drop ? ' drop' : ''), 'data-slot': i, style: itemEdge(it),
    onPointerDown: it ? grab : empty },
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
  const tg = it.kind === 'mod' ? targetOf(it.id) : null;   // a set Discriminate: its target's picture in the corner (v1.0.71)
  return h('span', { className: 'aglyph' }, h(GlyphIcon, { glyph: g.glyph, col: g.col }),
    g.tier ? h('i', { className: 'atier' }, ROMAN[g.tier - 1]) : null,
    tg && isAutoTarget(tg) ? h(TargetPic, { t: tg, size: 22, className: 'atgt aon' }) : null);
}

// ---- stage 8b: drag and drop, the cards ----
/** @typedef {{ from: 'bag' | 'nav' | 'guns', i: number }} DragSrc */
/** @typedef {{ key: string, to: 'nav' | 'gun' | 'bag' | 'scrap' | 'play' | 'player', s: number, ok: boolean }} DropAt */
/** @typedef {{ src: DragSrc, x: number, y: number, over: DropAt | null, back: boolean }} Drag */
/** @typedef {{ id: number, x0: number, y0: number, src: DragSrc, grab: boolean, drag: boolean, held?: boolean }} Press */
/** @typedef {{ src: DragSrc, pl: number, g: number, x: number, top: number, bottom: number }} DiscrimPopAt */
/** a Discriminate copy, set or not @param {string | null | undefined} id */
const isDiscrim = id => id === 'discrim' || (!!id && id.startsWith('discrim:'));

// (owner, v1.0.71) a held Discriminate tile's targets (art/discrimicon.js DISCRIM_TARGETS), each its own picture, in a small box
// above the tile (below it if there's no room); a tap on one sets the copy, a tap outside closes it
/** @param {{ at: DiscrimPopAt, cur: DiscrimTarget | null, pick: (t: DiscrimTarget) => void, close: () => void }} props */
function DiscrimPop({ at, cur, pick, close }) {
  const W = 3 * 58 + 16, H = 2 * 66 + 50 + 38, vw = window.innerWidth || 412;
  const left = Math.max(8, Math.min(vw - W - 8, at.x - W / 2));
  const top = at.top - H - 8 >= 8 ? at.top - H - 8 : at.bottom + 8;
  /** @param {any} e */
  const shut = e => { e.preventDefault(); e.stopPropagation(); close(); };
  /** one target's button (players: a row of four, smaller; data-tgt 'gold', 'rotta', … or 'p1'..'p4') @param {{ t: DiscrimTarget, label: string }} d */
  const btn = d => h('button', { key: d.t.kind + d.t.id, className: 'adbtn' + (d.t.kind === 'player' ? ' pl' : '') + (cur && cur.kind === d.t.kind && cur.id === d.t.id ? ' on' : ''), 'data-tgt': d.t.kind === 'player' ? 'p' + d.t.id : d.t.id, title: d.label,
    onPointerDown: (e) => { e.preventDefault(); e.stopPropagation(); pick(d.t); } }, h(TargetPic, { t: d.t, size: d.t.kind === 'player' ? 26 : 38 }), h('span', null, d.label));
  return ReactDOM.createPortal(h('div', { className: 'adpop' },
    h('div', { className: 'shade', onPointerDown: shut }),
    h('div', { className: 'adbox', style: { left: left + 'px', top: top + 'px', width: W + 'px' } },
      h('div', { className: 'adtitle' }, 'Discriminate: only…'),
      h('div', { className: 'adgrid' }, DISCRIM_TARGETS.filter(d => d.t.kind !== 'player').map(btn)),
      h('div', { className: 'adgrid p4' }, DISCRIM_TARGETS.filter(d => d.t.kind === 'player').map(btn)))),
    document.body);
}
// a press moving this far (px) is a drag (on the handle) or not a tap
const MOVE = 6;
const BIG_TAP = 350;   // (owner) two taps on empty bag slots within this (ms): the bag grows over the play area, or back

// the grab handle: a circle round the tile's centre, DEV.autoGrab of the tile's width in radius (touch-action none:
// only it starts a drag; the rest of the tile scrolls the bag)
function Grab() {
  const d = (200 * DEV.autoGrab).toFixed(1) + '%';
  return h('i', { className: 'agrab', style: { width: d, height: d } });
}

// the dragged item, under the finger (a refused drop slides it home: .back)
/** @param {{ drag: Drag, it: BagItem | null }} props */
// a tile's outline by the item's group (owner): auto/itemtile.js itemEdgeCol (the canvas's tiles share it)
/** @param {BagItem | null} it @returns {any} */
const itemEdge = it => it ? { '--ic': itemEdgeCol(it) } : undefined;

// a pickup's tile flying into its bag slot (owner): FLY_MS, eased, from the player (a little small) to the slot (its size)
/** @typedef {{ k: number, it: BagItem, slot: number, fresh: boolean, x0: number, y0: number, x1: number, y1: number, s: number }} Fly */
export const FLY_MS = 500;
/** @param {{ f: Fly, done: () => void }} props */
function FlyTile({ f, done }) {
  /** @type {{ current: HTMLDivElement | null }} */
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.animate) { done(); return undefined; }
    const a = el.animate([{ transform: 'translate(' + (f.x0 - f.x1) + 'px,' + (f.y0 - f.y1) + 'px) scale(0.55)' }, { transform: 'translate(0px,0px) scale(1)' }],
      { duration: FLY_MS, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' });
    a.onfinish = done;
    return () => a.cancel();
  }, []);
  return h('div', { ref, className: 'aslot full afly k-' + f.it.kind, 'data-fly': f.slot,
    style: { left: (f.x1 - f.s / 2) + 'px', top: (f.y1 - f.s / 2) + 'px', width: f.s + 'px', height: f.s + 'px', ...itemEdge(f.it) } }, h(ItemIcon, { it: f.it }));
}

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

// the active map and its level, top left of the play area (owner)
/** @param {AutoRun} run @returns {{ name: string, level: number }} */
function mapInfo(run) {
  const i = run.map || 0;
  return { name: MAP_NAMES[i], level: mapsOf(run)[i].level };
}
// (owner) the journey box: the whole level at its own width-to-height shape, across the play area; each player's helmet
// (the scene's sprite, pixelated) where he is in it; the fallen and the hidden left out
const HELM_PX = 12;   // a helmet in the box (px); the canvas reaches HELM_PX / 2 past the box's top and bottom (a thin box)
/** @type {Record<string, HTMLCanvasElement>} */
const helmCache = {};
/** @param {string} col @returns {HTMLCanvasElement} */
function helmSprite(col) {
  if (!helmCache[col]) {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    c.width = c.height = 24;
    if (x) helmetIcon(x, 24, col);
    helmCache[col] = c;
  }
  return helmCache[col];
}
/** @param {HTMLCanvasElement} c @param {import('../../art/titlescene.js').TitleScene} S @param {AutoRun} run */
function journeyDraw(c, S, run) {
  const L = levelState(S), box = c.parentElement;
  if (!L || !box) return;
  const W = L.plan.z1 + L.plan.z0, bw = box.clientWidth, bh = Math.max(6, bw * S.vh / W);
  if (Math.abs(box.clientHeight - bh) > 0.5) box.style.height = (bh + 4).toFixed(1) + 'px';   // (+ its 2px border each side)
  const dpr = Math.min(3, window.devicePixelRatio || 1), cw = Math.round(bw * dpr), ch = Math.round((bh + HELM_PX) * dpr), m = HELM_PX / 2 * dpr;
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = false;
  const s = HELM_PX * dpr;
  for (const r of S.runners) {
    const q = run.players[r.id];
    if (!q || r.hide || r.out) continue;
    const x = Math.max(s / 2, Math.min(cw - s / 2, (r.x + S.scroll) / W * cw)), y = m + Math.max(0, Math.min(1, r.y / S.vh)) * (ch - 2 * m);
    ctx.drawImage(helmSprite(q.col), Math.round(x - s / 2), Math.round(y - s / 2), Math.round(s), Math.round(s));
  }
}
