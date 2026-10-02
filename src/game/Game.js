// @ts-check
// The game itself: the canvas component. It makes the world (`W`, the canvases, the `G`
// context), runs the loop (step/draw, or the death replay) and is the React bridge: App
// talks to it through the input ref. What happens in a frame is in game/systems/,
// game/render/ and game/creatures/ (REFACTOR.md, Phase 3).

import { SFX } from '../audio/sfx.js';
import { BH, BW, CH, CW, FH, FW, MMH, MMW } from '../core/consts.js';
import { onWebIn } from './creatures/rat.js';
import { draw } from './render/draw.js';
import { ignite, setAlight, youAlight } from './systems/fire.js';
import { paintFog } from './systems/fog.js';
import { enterLevel } from './systems/level-entry.js';
import { voidCave } from './systems/vend.js';
import { applyPerks, hurt, maxHp, refreshBag } from './systems/player.js';
import { drawReplay, recFrame, recSample, recWrap } from './systems/recorder.js';
import { saveRun } from './systems/save-run.js';
import { step } from './systems/step.js';
import { dig, explode } from './systems/terrain.js';
import { testHook } from './testhook.js';
import { makeWorld } from './world.js';

// Game is layer 5 and may not import from ui/ (layer 6), so it takes its React helpers
// straight off the global React, as ui/h.js does (REFACTOR.md, D13).
const { useRef, useEffect } = React;
const h = React.createElement;

/** @param {{ input: { current: GameInput } }} props */
export function Game({ input }) {
  const cv = useRef(null);
  useEffect(() => {
    const W = makeWorld();                           // the live level (game/world.js)
    const c = cv.current, ctx = c.getContext('2d');
    const terrain = document.createElement('canvas');
    terrain.width = CW; terrain.height = CH;
    const tctx = terrain.getContext('2d');
    const bg = document.createElement('canvas');
    bg.width = BW; bg.height = BH;
    const bgctx = bg.getContext('2d');
    // the fog overlay: one pixel per fog cell, drawn scaled up over the world
    const fogC = document.createElement('canvas');
    fogC.width = FW; fogC.height = FH;
    const fctx = fogC.getContext('2d');
    const fogImg = new ImageData(FW, FH);
    // a second tiny canvas: the fog is blurred here at source resolution (cheap) and the
    // blurred copy is what gets upscaled, so the fog edge is soft without a full-screen blur
    const fogBlurC = document.createElement('canvas');
    fogBlurC.width = FW; fogBlurC.height = FH;
    const fbctx = fogBlurC.getContext('2d');
    // the minimap: an MMW x MMH canvas of white cave outlines, smooth-scaled into the
    // bottom-left of the view. miniEdgeIdx lists the wall-outline cells (static per floor);
    // each frame only the ones the fog has revealed are painted white, the rest cleared.
    const miniC = document.createElement('canvas');
    miniC.width = MMW; miniC.height = MMH;
    const mctx = miniC.getContext('2d');
    const miniImg = new ImageData(MMW, MMH);
    const mini32 = new Uint32Array(miniImg.data.buffer);

    // ---- level decoration (see DECOR): the decoration layer's canvas and the plant glow's
    // scratch. The props, their particles, decorStep's counters and what they did to you are in W.
    // the jellies' plant glow (plantGlow): the canvas its glow is drawn through; its scratch
    // (pgArt, pgC, pgCtx, made on first use) is on G
    const pgGlow = document.createElement('canvas'), pgGlowCtx = pgGlow.getContext('2d');
    const decoC = document.createElement('canvas');
    decoC.width = CW; decoC.height = CH;
    const dctx = decoC.getContext('2d');
    const aimPath = [];                              // scratch buffer for the aim line
    const mouse = input.current.mouse;               // the pointer, when it's a mouse (App's, kept by the handlers below)

    let raf, last = performance.now();

    // ---- the death replay's recorder (see RP_HZ; its functions are in systems/recorder.js) ----
    // REC.snaps: what draw() reads round you, RP_HZ a second. Terrain: tBase/dBase are the rock
    // and decoration pixels as of the oldest snapshot, patches the rectangles changed since
    // (caught by wrapping the two canvases' putImageData, which every dig/blast/burn goes
    // through). Fog: fogBase + fogLog (time, cell, value). While you're alive only the last
    // RP_KEEP seconds are kept (older patches fold into the base); from the death it runs
    // RP_AFTER more seconds and stops.
    const RP_ARR = { bullets: W.bullets, enemyShots: W.enemyShots, smoke: W.smoke, sparks: W.sparks, flashes: W.flashes, coins: W.coins, fields: W.fields, beams: W.beams, arcs: W.arcs, torchP: W.torchP, motes: W.motes,
      burns: W.burns, webs: W.webs, silk: W.silk, strings: W.strings, dparts: W.dparts, amb: W.amb, clouds: W.clouds, rings: W.rings, devils: W.devils };
    const REC = { t: 0, acc: 0, snaps: [], patches: [], dirty: [], fogLog: [], tBase: null, dBase: null,
      fogBase: null, fogPrev: null, deathT: -1, done: false };

    // ---- the replay's player (drawReplay, systems/recorder.js): rebuilds the terrain and fog for
    // time T on RT's canvases and draws the recorded scene through draw() itself, swapped in for
    // the live world and swapped back after ----
    const RT = { tC: null, dC: null, n: 0, at: -1, fog: null, fireT: null };
    // the fire's dirty boxes on the two terrain canvases (put back once a frame, see flushFire)
    const fireBox = { t: [CW, CH, -1, -1], d: [CW, CH, -1, -1] };
    // a spider's web line under a rat's feet counts as ground: rats run along webs
    const ratOnWeb = onWebIn(W.webs);
    // what the systems (game/systems/) need that isn't world state (REFACTOR.md, D16): the
    // React bridge, the canvases (tctx and dctx are the recorder's wrapped ones), the recorder,
    // the fire's dirty boxes, the rats' web test, the plant glow's scratch, the replay's view,
    // the mouse and the aim line's scratch
    /** @type {GameCtx} */
    const G = { input, c, ctx, terrain, tctx, bg, bgctx, fogC, fctx, fogImg, fogBlurC, fbctx,
      miniC, mctx, miniImg, mini32, decoC, dctx, REC, RT, fireBox, ratOnWeb, mouse, aimPath,
      pgArt: null, pgC: null, pgCtx: null, pgGlow, pgGlowCtx,
      RP_ARR, rid: new WeakMap(), ridN: 0,  // the recorder's lists (W's own arrays) and each thing's replay id
      RPV: null };                          // while draw() is drawing a replay frame: the view
    recWrap(G);                             // before anything draws on tctx/dctx

    // the browser tests' way in (game/testhook.js): only on the test page, which sets the flag
    if (window.__TEST) window.__lvl = testHook(W, { tctx, dctx, paintFog: () => paintFog(W, G), hurt: (n) => hurt(W, G, n), maxHp: () => maxHp(W, G), dig: (x, y, R) => dig(W, G, x, y, R), explode: (x, y, R, splash, hot) => explode(W, G, x, y, R, splash, hot), recSample: () => recSample(W, G),
      ignite: (x, y, r, chance) => ignite(W, G, x, y, r, chance), setAlight, youAlight: () => youAlight(W), REC, RT,
      nextFloor: () => { W.floor++; W.hasLvl = true; W.warp = null; enterLevel(W, G); saveRun(W, G); } });
    {
      // picking up where the last session left off, if App found a save
      const sv = input.current.saved;
      input.current.saved = null;
      if (sv) {
        W.floor = sv.floor;
        W.hasLvl = sv.hasLvl;
        enterLevel(W, G, sv.level);
        if (sv.hp) W.p.hp = Math.min(sv.hp, maxHp(W, G));
      } else enterLevel(W, G);
      if (!W.hasLvl) voidCave(W, G);            // a run starts with no level: buy one in the shop
    }
    const saveNow = () => saveRun(W, G);         // one function, so pagehide's listener comes off again
    const saveTick = setInterval(saveNow, 2000);
    const saveHidden = () => { if (document.visibilityState === 'hidden') saveRun(W, G); };
    document.addEventListener('visibilitychange', saveHidden);
    window.addEventListener('pagehide', saveNow);
    input.current.saveRun = saveNow;

    const resize = () => {
      const r = c.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(c.parentElement);
    window.addEventListener('resize', resize);

    // ---- mouse (the pointer's state is `mouse`, above G) ----
    const mMove = e => {
      if (e.pointerType !== 'mouse') return;
      const r = c.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.inside = true;
    };
    const mDown = e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      mMove(e); mouse.down = true;
      try { c.setPointerCapture(e.pointerId); } catch (_) {}
    };
    const mUp = e => { if (e.pointerType === 'mouse') mouse.down = false; };
    const mLeave = e => { if (e.pointerType === 'mouse' && !mouse.down) mouse.inside = false; };
    c.addEventListener('pointermove', mMove);
    c.addEventListener('pointerdown', mDown);
    c.addEventListener('pointerup', mUp);
    c.addEventListener('pointercancel', mUp);
    c.addEventListener('pointerleave', mLeave);

    const loop = t => {
      const dt = Math.max(0, Math.min(0.033, (t - last) / 1000));
      last = t;
      const rv = input.current.replay;
      if (rv && REC.done) {                   // the death replay: its own clock, the world stays put
        if (rv.playing) {
          rv.t += dt * rv.speed;
          const wit = input.current.witness;
          if (rv.t >= wit.t1) {                  // the end: round again, or stop there
            if (rv.loop) rv.t = wit.t0; else { rv.t = wit.t1; rv.playing = false; }
          }
        }
        SFX.tick();
        drawReplay(W, G, rv);
      } else {
        if (input.current.perksDirty) { input.current.perksDirty = false; applyPerks(W, G); }
        if (!input.current.paused) { step(W, G, dt); recFrame(W, G, dt); }
        SFX.tick();
        draw(W, G);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', resize);
      clearInterval(saveTick);
      if (W.jetLoop) W.jetLoop.stop();
      if (W.portalLoop) W.portalLoop.stop();
      if (W.matterLoop) W.matterLoop.stop();
      for (const h of W.bhLoops.values()) h.stop();
      document.removeEventListener('visibilitychange', saveHidden);
      window.removeEventListener('pagehide', saveNow);
      c.removeEventListener('pointermove', mMove);
      c.removeEventListener('pointerdown', mDown);
      c.removeEventListener('pointerup', mUp);
      c.removeEventListener('pointercancel', mUp);
      c.removeEventListener('pointerleave', mLeave);
      mouse.inside = false; mouse.down = false;
    };
  }, []);
  return h('canvas', { ref: cv, className: 'game' });
}
