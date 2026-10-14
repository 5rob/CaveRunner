// @ts-check
// Grem Mode's screen (owner, 2026-10-15; the rules: auto/grem.js): the title's GREM MODE button opens it. No hub, no nav, no
// saving: one player teleports straight into an endless level (auto/level.js levelScene's grem: gold the only drop, after each
// boss LEVEL CLEARED and on into more cave, the level + 1). Top to bottom: the play area (⏸ top right, the level top left), the
// gold collected (a big nugget and number, centred), the gun presets in their order (GremGuns: locked ones dim, the one being
// paid off filling its outline clockwise, a tap on an unlocked one gives it to player 1), and the stick, B and A. No bag (owner):
// the gold is kept in the run's bag (bagCount) but each pickup flies into the gold counter.
// The stick takes player 1 over by hand at once (levelControl; the camera follows him); DEV.autoCtlWait s after it's let go
// the autopilot has him again. A tap on the play area picks the creature nearest the tap (within DEV.gremPickR): every player
// aims at it (S.pick, titlescene.js titleAimPick), a see-through red ring round it. Everyone down: "Tap A to play again".

import { SFX } from '../../audio/sfx.js';
import { TITLE_VW, camAt, camPack, camTo, titleCam } from '../../art/titlescene.js';
/** @typedef {import('../../art/titlescene.js').TitleCam} TitleCam */
/** @typedef {import('../../art/titlescene.js').TitleScene} TitleScene */
import { DEAD } from '../../core/consts.js';
import { DEV } from '../../dev/knobs.js';
import { clearedText } from '../../art/cleared.js';
import { drawHint } from '../../game/render/hubdraw.js';
import { chestOpen } from '../../auto/chests.js';
import { levelClearedAge, levelControl, levelDeathPrompt, levelHold, levelLead, levelLost, levelScene, levelState, levelTeleportHome } from '../../auto/level.js';
import { bagCount, healRun, newPlayer, starterKit } from '../../auto/run.js';
import { gremFill, gremKitLoad, gremPrice, gremRun, gremTeam, gremTeamGun, gremUnlocked } from '../../auto/grem.js';
import { sceneAddRunner } from '../../auto/addrunner.js';
import { loadPresets, presetGun } from '../../save/presets.js';
import { GunIcon } from '../editor.js';
import { PauseMenu } from '../pause.js';
import { runScene } from '../scenecanvas.js';
import { NuggetIcon } from './icons.js';
import { FlyTile, PillStick } from './AutoScreen.js';
import { h, useEffect, useRef, useState } from '../h.js';

/** @param {() => void} fn @returns {(e: any) => void} */
const tap = fn => e => { e.preventDefault(); fn(); };

export function GremScreen() {
  const [presets] = useState(loadPresets);
  /** @type {{ current: AutoRun }} */
  const run = useRef(gremRun(gremKitLoad()));
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const [gold, setGold] = useState(0);
  const [lvl, setLvl] = useState(1);
  const [sel, setSel] = useState(-1);          // the preset player 1 has (-1: his starter gun)
  const [, setV] = useState(0);
  const unlocked = useRef(0);
  const cvs = useRef(null);
  /** @type {{ current: TitleScene | null }} */
  const scene = useRef(null);
  /** @type {{ current: TitleCam | null }} */
  const cam = useRef(null);
  const input = useRef({});

  // preset i to player p (a fresh copy); player 1's pick shows on the grid
  /** @param {number} p @param {number} i */
  const give = (p, i) => {
    const pl = run.current.players[p], g = presets[i] ? presetGun(presets[i]) : null;
    if (!pl || !g) return;
    pl.guns[0] = g; pl.active = 0;
    if (p === 0) setSel(i);
  };
  // the extra players' guns: one each of the unlocked presets, the newest first (auto/grem.js gremTeamGun)
  const dealOut = () => { for (let j = 1; j < run.current.players.length; j++) { const k = gremTeamGun(unlocked.current, j); if (k >= 0) give(j, k); } };

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
      // gold paid off the next preset(s): player 1 gets the newest, the extra players theirs
      const u = gremUnlocked(g, presets.length);
      if (u > unlocked.current) { unlocked.current = u; give(0, u - 1); dealOut(); SFX.fx('open'); }
      // the extra players join at their levels (DEV.gremP2 …), teleporting in beside the team
      const L = levelState(S);
      while (L && L.phase !== 'arrive' && !L.failed && R.players.length < gremTeam(R.tier) && S.runners.length < 4) {
        const pl = newPlayer(R.players.length);
        pl.guns[0] = starterKit().gun;
        R.players.push(pl);
        const k = gremTeamGun(unlocked.current, R.players.length - 1);
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
        if (levelDeathPrompt(S)) { const k = w / 150; ctx.save(); ctx.scale(k, k); drawHint(ctx, w / 2 / k, hh * 0.3 / k, 'Tap A to play again', S.t); ctx.restore(); }
      },
      // everyone down and A pressed (the blast): a fresh Grem run, back to level 1, every preset locked again
      next: S => {
        if (!levelLost(S)) return false;
        window.__AUTO_LEVEL = 0;
        run.current = gremRun(gremKitLoad());
        unlocked.current = 0; setSel(-1); setGold(0); setLvl(1); setFlies([]);
        return true;
      },
    });
  }, []);

  // the stick: player 1 by hand at once (past the dead zone), the camera on him; let go, he plays himself after a moment
  /** @param {import('./AutoScreen.js').PillState} st */
  const steer = st => {
    const S = scene.current, C = cam.current, r = S && S.runners[0];
    if (!S || !S.lvl || !r || r.out) return;
    levelHold(S, 0);
    if (!(st.active && st.mag > DEAD) && !r.ctl) return;
    if (C) C.lock = 0;
    levelControl(S, 0, st);
  };
  const pressA = () => {
    SFX.unlock(); SFX.ui('tap');
    const S = scene.current;
    if (S && (levelTeleportHome(S) || chestOpen(S))) SFX.fx('open');
  };
  const pressB = () => {
    SFX.ui('tap');
    const S = scene.current, C = cam.current;
    if (S && S.runners.some(r => r.ctl)) { if (C) C.lock = -1; levelControl(S, -1, null); SFX.fx('close'); }
  };
  // a tap on the play area: the creature nearest it (within DEV.gremPickR, its size added) becomes everyone's target
  /** @param {any} e */
  const playTap = e => {
    if (e.target && e.target.closest && e.target.closest('.pausebtn')) return;
    const S = scene.current, C = cam.current, c = cvs.current;
    if (!S || !C || !c) return;
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
    h(GremGuns, { presets, gold, sel, pick: i => { if (i < unlocked.current) { give(0, i); SFX.fx('open'); } else SFX.ui('tap'); } }),
    h('div', { className: 'abtns' },
      h(PillStick, { onMove: steer }),
      h('button', { className: 'abtn ab', onPointerDown: tap(pressB) }, 'B'),
      h('button', { className: 'abtn aa', onPointerDown: tap(pressA) }, 'A')),
    flies.map(f => h(FlyTile, { key: f.k, f, done: () => setFlies(fs => fs.filter(q => q.k !== f.k)) })),
    paused ? h(PauseMenu, { input, label: 'Grem Mode · Level ' + lvl, onNew: () => location.reload(), close: () => { SFX.fx('close'); setPaused(false); } }) : null);
}

// The presets as Grem Mode's guns, in their order: unlocked ones bright (a tap gives it to player 1; his has a white ring),
// the next one's outline filling clockwise as the gold comes in (gremFill), the rest dim and locked
/** @param {{ presets: GunPreset[], gold: number, sel: number, pick: (i: number) => void }} props */
function GremGuns({ presets, gold, sel, pick }) {
  const u = gremUnlocked(gold, presets.length);
  if (!presets.length) return h('div', { className: 'gguns none' }, h('p', null, 'No gun presets yet: Dev → Presets'));
  return h('div', { className: 'gguns' }, presets.map((p, i) => {
    const f = i < u ? 1 : i === u ? gremFill(gold, i) : 0;
    return h('button', { key: i, className: 'ggun' + (i < u ? ' open' : i === u ? ' next' : ' locked') + (i === sel ? ' sel' : ''), 'data-gun': i, 'data-fill': f.toFixed(3),
      title: p.name + (i < u ? '' : ' · ' + gremPrice(i) + ' gold'), style: { '--f': (f * 360).toFixed(1) + 'deg' }, onPointerDown: tap(() => pick(i)) },
      h('span', { className: 'gginner' }, h(GunIcon, { gun: p.gun })));
  }));
}
