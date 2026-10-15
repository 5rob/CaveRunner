// @ts-check
// Grem Mode's screen (owner, 2026-10-15; the rules: auto/grem.js): the title's GREM MODE button opens it. No hub, no nav, no
// saving: one player teleports straight into an endless level (auto/level.js levelScene's grem: gold the only drop, after each
// boss LEVEL CLEARED and on into more cave, the level + 1). Top to bottom: the play area (⏸ top right, the level top left), the
// gold collected (a big nugget and number, centred), the gun presets in their order (GremGuns, one row scrolling sideways:
// locked ones dim, the one being paid off filling its outline clockwise, a freshly unlocked one flashing NEW till it's tapped;
// a tap on an unlocked one gives it to the picked player; the 3 extra players are unlocks on the same row, spread among the
// guns: owner v1.0.90, auto/grem.js gremUnlocks), the players' helmets (GremHelms: no health rings, players take no damage in
// Grem; the picked one ringed white; a tap picks him; split either side of the stick), and the stick, centred at the bottom
// (it steers the picked player). No A or B (owner v1.0.90): a tap on the play area opens a chest in reach. No bag (owner):
// the gold is kept in the run's bag (bagCount) but each pickup flies into the gold counter.
// The stick takes player 1 over by hand at once (levelControl; the camera follows him); DEV.autoCtlWait s after it's let go
// the autopilot has him again. A tap on the play area picks the creature nearest the tap (within DEV.gremPickR): every player
// aims at it (S.pick, titlescene.js titleAimPick), a see-through red ring round it. Everyone down (no damage: shouldn't
// happen): "Tap to play again".

import { SFX } from '../../audio/sfx.js';
import { TITLE_COLS, TITLE_VW, camAt, camPack, camTo, titleCam } from '../../art/titlescene.js';
/** @typedef {import('../../art/titlescene.js').TitleCam} TitleCam */
/** @typedef {import('../../art/titlescene.js').TitleScene} TitleScene */
import { DEAD } from '../../core/consts.js';
import { DEV } from '../../dev/knobs.js';
import { clearedText } from '../../art/cleared.js';
import { drawHint } from '../../game/render/hubdraw.js';
import { chestOpen } from '../../auto/chests.js';
import { levelClearedAge, levelControl, levelDeathPrompt, levelHold, levelLead, levelLost, levelScene, levelState, levelTeleportHome } from '../../auto/level.js';
import { bagCount, healRun, newPlayer, starterKit } from '../../auto/run.js';
import { gremFill, gremKitLoad, gremOpen, gremPrice, gremRun, gremTeamGun, gremUnlocked, gremUnlocks } from '../../auto/grem.js';
import { sceneAddRunner } from '../../auto/addrunner.js';
import { loadPresets, presetGun } from '../../save/presets.js';
import { GunIcon } from '../editor.js';
import { PauseMenu } from '../pause.js';
import { runScene } from '../scenecanvas.js';
import { HelmetIcon, NuggetIcon } from './icons.js';
import { FlyTile, PillStick } from './AutoScreen.js';
import { h, useEffect, useRef, useState } from '../h.js';

/** @param {() => void} fn @returns {(e: any) => void} */
const tap = fn => e => { e.preventDefault(); fn(); };

export function GremScreen() {
  const [presets] = useState(loadPresets);
  const [items] = useState(() => gremUnlocks(presets.length));   // the presets and the extra players, in unlock order
  /** @type {{ current: AutoRun }} */
  const run = useRef(gremRun(gremKitLoad()));
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const [gold, setGold] = useState(0);
  const [lvl, setLvl] = useState(1);
  /** @type {number[]} */
  const noHas = [-1];
  const [has, setHas] = useState(noHas);      // the preset each player has (-1: his starter gun)
  const [who, setWho] = useState(0);          // the picked player: the guns go to him, the stick steers him
  const whoRef = useRef(0);
  whoRef.current = who;
  /** @type {number[]} */
  const noFresh = [];
  const [fresh, setFresh] = useState(noFresh); // unlocked (items' indices) and not tapped yet: flashing NEW
  const guns = useRef(null);
  const [, setV] = useState(0);
  const unlocked = useRef(0);                 // how many of items are unlocked
  const gunsOpen = () => gremOpen(unlocked.current, presets.length).guns;
  const cvs = useRef(null);
  /** @type {{ current: TitleScene | null }} */
  const scene = useRef(null);
  /** @type {{ current: TitleCam | null }} */
  const cam = useRef(null);
  const input = useRef({});

  // preset i to player p (a fresh copy); the picked player's shows ringed on the row
  /** @param {number} p @param {number} i */
  const give = (p, i) => {
    const pl = run.current.players[p], g = presets[i] ? presetGun(presets[i]) : null;
    if (!pl || !g) return;
    pl.guns[0] = g; pl.active = 0;
    setHas(a => { const b = a.slice(); b[p] = i; return b; });
  };
  // the extra players' guns: one each of the unlocked presets, the newest first (auto/grem.js gremTeamGun)
  const dealOut = () => { for (let j = 1; j < run.current.players.length; j++) { const k = gremTeamGun(gunsOpen(), j); if (k >= 0) give(j, k); } };

  // a pickup: its tile flies into the gold counter's nugget (as AutoScreen's flyIn to a bag slot)
  /** @type {import('./AutoScreen.js').Fly[]} */
  const noFlies = [];
  const [flies, setFlies] = useState(noFlies);
  const flyN = useRef(0);
  /** @param {BagItem} it @param {number} x @param {number} y */
  const flyIn = (it, x, y) => {
    const c = cvs.current, C = cam.current, tile = document.querySelector('.grem .ggicon');
    if (!c || !C || !tile) return;
    const cr = c.getBoundingClientRect(), tr = tile.getBoundingClientRect(), v = camTo(C, x, y), k = cr.width / TITLE_VW;
    const f = { k: ++flyN.current, it: Object.assign({}, it), slot: -1, fresh: false, x0: cr.left + v.x * k, y0: cr.top + v.y * k, x1: tr.left + tr.width / 2, y1: tr.top + tr.height / 2, s: tr.width };
    setFlies(fs => [...fs, f]);
  };

  useEffect(() => {
    const id = setInterval(() => {
      const S = scene.current, R = run.current, C = cam.current;
      if (!S) return;
      const g = bagCount(R, 'gold');
      setGold(g); setLvl(R.tier);
      // gold paid off the next unlock(s): a new gun goes to player 1 (the newest), the extra players theirs; a player joins (below)
      const u = gremUnlocked(g, items.length);
      if (u > unlocked.current) {
        const was = unlocked.current, g0 = gunsOpen();
        unlocked.current = u;
        const gn = gunsOpen();
        if (gn > g0) { give(0, gn - 1); dealOut(); }
        SFX.fx('open');
        setFresh(f => [...f, ...Array.from({ length: u - was }, (_, k) => was + k)]);
        // the row scrolled to the new one
        const el = guns.current && guns.current.querySelector('[data-item="' + (u - 1) + '"]');
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
      // an extra player unlocked: he joins, teleporting in beside the team
      const L = levelState(S);
      while (L && L.phase !== 'arrive' && !L.failed && R.players.length < gremOpen(unlocked.current, presets.length).team && S.runners.length < 4) {
        const pl = newPlayer(R.players.length);
        pl.guns[0] = starterKit().gun;
        R.players.push(pl);
        const k = gremTeamGun(gunsOpen(), R.players.length - 1);
        if (k >= 0) give(R.players.length - 1, k);
        healRun({ ...R, players: [pl] });
        if (!sceneAddRunner(S)) { R.players.pop(); break; }
      }
      // hand steering over: the stick rested DEV.autoCtlWait s, the autopilot has him again (the camera lets go)
      if (C && C.lock >= 0 && !levelLead(S)) { C.lock = -1; levelControl(S, -1, null); }
      setV(n => n + 1);
    }, 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const c = cvs.current;
    if (!c) return undefined;
    return runScene(c, {
      size: () => ({ w: c.clientWidth, hh: c.clientHeight }),
      make: (w, hh, seed) => {
        const k = w / TITLE_VW, vh = Math.max(1, hh) / k, R = run.current;
        healRun(R);
        const S = levelScene(vh, window.__AUTO_LEVEL || seed, R.players.length, undefined, R.players, R.tier, R, true);
        S.onTake = (it, x, y) => flyIn(it, x, y);
        scene.current = S;
        if (window.__TEST_TITLE) window.__gremScene = S;
        const C = titleCam(vh / 2, vh);
        C.pack = true; C.view = vh;
        camPack(C, S, 1);
        cam.current = C;
        return { S, C, warm: 0 };
      },
      paused: () => pausedRef.current,
      keep: true, still: true,
      over: (ctx, S, w, hh) => {
        const a = levelClearedAge(S); if (a >= 0) clearedText(ctx, a, DEV.autoClearT, w, hh * 0.14);
        const f = S.pick, C = cam.current;
        if (f && f.hp > 0 && C) {
          // the picked creature: a see-through red ring round it, breathing a little
          const k = w / TITLE_VW, p = camTo(C, f.x - S.scroll, f.ty), r = (f.r + 5 + Math.sin(S.t * 6) * 1.2) * C.z * k;
          ctx.save(); ctx.strokeStyle = 'rgba(255,50,50,0.55)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x * k, p.y * k, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
        if (levelDeathPrompt(S)) { const k = w / 150; ctx.save(); ctx.scale(k, k); drawHint(ctx, w / 2 / k, hh * 0.3 / k, 'Tap to play again', S.t, true); ctx.restore(); }
      },
      // everyone down and the play area tapped (the blast): a fresh Grem run, back to level 1, every preset locked again
      next: S => {
        if (!levelLost(S)) return false;
        window.__AUTO_LEVEL = 0;
        run.current = gremRun(gremKitLoad());
        unlocked.current = 0; setHas([-1]); setWho(0); setFresh([]); setGold(0); setLvl(1); setFlies([]);
        return true;
      },
    });
  }, []);

  // the stick: the picked player by hand at once (past the dead zone), the camera on him; let go, he plays himself after a moment
  /** @param {import('./AutoScreen.js').PillState} st */
  const steer = st => {
    const S = scene.current, C = cam.current, w = whoRef.current, r = S && S.runners.find(q => q.id === w);
    if (!S || !S.lvl || !r || r.out) return;
    levelHold(S, 0);
    if (!(st.active && st.mag > DEAD) && !r.ctl) return;
    if (C) C.lock = w;
    levelControl(S, w, st);
  };
  // an unlock tapped (k: its place on the row): a gun to the picked player, a player picked; its NEW goes. A locked one: a tap
  /** @param {number} k */
  const pickItem = k => {
    const it = items[k];
    if (!it || k >= unlocked.current) { SFX.ui('tap'); return; }
    if ('gun' in it) { give(who, it.gun); SFX.fx('open'); } else if (run.current.players[it.player]) pickWho(it.player);
    setFresh(f => f.filter(q => q !== k));
  };
  // a helmet tapped: that player picked (a hand-steered other one let go)
  /** @param {number} i */
  const pickWho = i => {
    SFX.ui('tap');
    if (i === who) return;
    const S = scene.current, C = cam.current;
    if (S && S.runners.some(r => r.ctl)) { if (C) C.lock = -1; levelControl(S, -1, null); }
    setWho(i);
  };
  // a tap on the play area (no A in Grem, owner v1.0.90): a chest in reach opens ("Tap to open."); else the creature nearest
  // it (within DEV.gremPickR, its size added) becomes everyone's target
  /** @param {any} e */
  const playTap = e => {
    if (e.target && e.target.closest && e.target.closest('.pausebtn')) return;
    const S = scene.current, C = cam.current, c = cvs.current;
    if (!S || !C || !c) return;
    SFX.unlock();
    if (levelTeleportHome(S) || chestOpen(S)) { SFX.fx('open'); return; }
    const r = c.getBoundingClientRect(), k = r.width / TITLE_VW, q = camAt(C, (e.clientX - r.left) / k, (e.clientY - r.top) / k);
    let best = null, bd = Infinity;
    for (const f of S.foes) {
      const d = Math.hypot(f.x - S.scroll - q.x, f.ty - q.y) - f.r;
      if (f.hp > 0 && d < bd) { bd = d; best = f; }
    }
    if (best && bd <= DEV.gremPickR) { S.pick = best; SFX.ui('tap'); }
  };
  return h('div', { className: 'auto grem' },
    h('div', { className: 'aplay', onPointerDown: playTap },
      h('canvas', { ref: cvs, className: 'aplaycvs' }),
      h('div', { className: 'glvl' }, 'Level ' + lvl),
      h('button', { className: 'pausebtn', title: 'Pause', onPointerDown: e => { e.preventDefault(); SFX.fx('open'); setPaused(true); } }, '⏸')),
    h('div', { className: 'ggold', 'data-gold': gold }, h('span', { className: 'ggicon' }, h(NuggetIcon, { kind: 'gold' })), h('b', null, gold.toLocaleString())),
    h(GremGuns, { presets, items, gold, sel: has[who] ?? -1, who, fresh, pick: pickItem, box: guns }),
    h(GremHelms, { run: run.current, who, pick: pickWho }),
    h('div', { className: 'abtns gstick' }, h(PillStick, { onMove: steer })),
    flies.map(f => h(FlyTile, { key: f.k, f, done: () => setFlies(fs => fs.filter(q => q.k !== f.k)) })),
    paused ? h(PauseMenu, { input, label: 'Grem Mode · Level ' + lvl, onNew: () => location.reload(), close: () => { SFX.fx('close'); setPaused(false); } }) : null);
}

// The unlocks in their order (the presets, the 3 extra players among them: auto/grem.js gremUnlocks), one row scrolling
// sideways: unlocked ones bright (a gun: a tap gives it to the picked player, his has a white ring; a player: a tap picks
// him), a fresh one flashing NEW till it's tapped, the next one's outline filling clockwise as the gold comes in (gremFill),
// the rest dim and locked
/** @param {{ presets: GunPreset[], items: import('../../auto/grem.js').GremUnlock[], gold: number, sel: number, who: number, fresh: number[], pick: (k: number) => void, box: { current: any } }} props */
function GremGuns({ presets, items, gold, sel, who, fresh, pick, box }) {
  const u = gremUnlocked(gold, items.length);
  return h('div', { className: 'gguns', ref: box }, items.map((it, k) => {
    const f = k < u ? 1 : k === u ? gremFill(gold, k) : 0, nu = k < u && fresh.includes(k);
    const cls = 'ggun' + (k < u ? ' open' : k === u ? ' next' : ' locked') + (nu ? ' fresh' : '');
    const common = { key: k, 'data-item': k, 'data-fill': f.toFixed(3), style: { '--f': (f * 360).toFixed(1) + 'deg' }, onClick: () => pick(k) };
    const badge = nu ? h('i', { className: 'gnew' }, 'NEW') : null;
    if ('player' in it) {
      const col = TITLE_COLS[it.player % TITLE_COLS.length];
      return h('button', { ...common, className: cls + ' gplayer' + (k < u && it.player === who ? ' sel' : ''), 'data-unlock-player': it.player,
        title: 'Player ' + (it.player + 1) + (k < u ? '' : ' · ' + gremPrice(k) + ' gold') },
        h('span', { className: 'gginner' }, h(HelmetIcon, { col, size: 44 })), badge);
    }
    const p = presets[it.gun];
    return h('button', { ...common, className: cls + (it.gun === sel ? ' sel' : ''), 'data-gun': it.gun,
      title: p.name + (k < u ? '' : ' · ' + gremPrice(k) + ' gold') },
      h('span', { className: 'gginner' }, h(GunIcon, { gun: p.gun })), badge);
  }));
}

// The players' helmets (as the nav's player row, owner v1.0.90: no health rings, no damage in Grem), players 1-2 left of the
// stick's dome, 3-4 right of it; the picked one ringed white; a tap picks him
/** @param {{ run: AutoRun, who: number, pick: (i: number) => void }} props */
function GremHelms({ run, who, pick }) {
  /** @param {RunPlayer} q @param {number} i */
  const helm = (q, i) => h('button', { key: i, className: 'anavc on' + (i === who ? ' sel' : ''), 'data-player': i, onPointerDown: tap(() => pick(i)),
    style: { boxShadow: i === who ? undefined : '0 0 10px ' + q.col + '66' } },
    h(HelmetIcon, { col: q.col, size: 35 }));
  return h('div', { className: 'ghelms' },
    h('div', { className: 'ghl' }, run.players.slice(0, 2).map((q, i) => helm(q, i))),
    h('div', { className: 'ghr' }, run.players.slice(2).map((q, i) => helm(q, i + 2))));
}
