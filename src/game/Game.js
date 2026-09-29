// The game itself: the canvas component. One closure holds the live level and runs the
// loop (step, draw, cast, bullets, fields, the enemy loop, the recorder); App talks to it
// through the input ref. Phase 3 of REFACTOR.md takes it apart.

import { drawProp, propGlow, rgbA } from '../art/props.js';
import { drawGun, drawGunGlow, drawRunner, drawSconce, drawTorch, glowAt } from '../art/sprites.js';
import { SFX } from '../audio/sfx.js';
import {
  BCELL, BH, BW, CELL, CH, COL, CW, FH, FOG, FOG_U, FW, LAMP_REACH, MINI_D, MMH, MMW, PH, PW,
  SHOP_FLOOR, SHOP_Y, SIGHT, VIEW_MIN_H, VIEW_W, WH, WW
} from '../core/consts.js';
import { clamp, hexRgb, mix } from '../core/util.js';
import { drawEnemy } from '../creatures/draw.js';
import { PERKS } from '../data/perks.js';
import { themeFor } from '../data/themes.js';
import { DEV, jcol, kru } from '../dev/knobs.js';
import { effRecharge, gunPassives, planCast } from '../spells/cast.js';
import { gunAccent } from '../spells/guns.js';
import { MODS, famCol } from '../spells/mods.js';
import { bhSp, tracePath } from '../spells/trace.js';
import { FIRE_COLS } from '../world/fire.js';
import { ROOM_HH, ROOM_HW } from '../world/level.js';
import { VIS_RAYS, fogReveal, visPoly } from '../world/vision.js';
import { ignite, setAlight, youAlight } from './systems/fire.js';
import { fogLit, paintFog, roomSeen } from './systems/fog.js';
import { enterLevel } from './systems/level-entry.js';
import { jag } from './systems/lightning.js';
import { plantGlow } from './systems/plantglow.js';
import { hurt, maxHp, torchHand } from './systems/player.js';
import { onWebIn } from './systems/rats.js';
import { drawReplay, recFrame, recSample, recWrap } from './systems/recorder.js';
import { saveRun } from './systems/save-run.js';
import { rnd } from './systems/shotlooks.js';
import { step } from './systems/step.js';
import { dig, explode, solidAt, solidCell } from './systems/terrain.js';
import { testHook } from './testhook.js';
import { makeWorld } from './world.js';

// Game is layer 5 and may not import from ui/ (layer 6), so it takes its React helpers
// straight off the global React, as ui/h.js does (REFACTOR.md, D13).
const { useRef, useEffect } = React;
const h = React.createElement;

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
    const G = { input, c, ctx, terrain, tctx, bg, bgctx, fogC, fctx, fogImg, fogBlurC, fbctx,
      miniC, mctx, miniImg, mini32, decoC, dctx, REC, RT, fireBox, ratOnWeb, mouse, aimPath,
      pgArt: null, pgC: null, pgCtx: null, pgGlow, pgGlowCtx,
      RP_ARR, rid: new WeakMap(), ridN: 0,  // the recorder's lists (W's own arrays) and each thing's replay id
      RPV: null };                          // while draw() is drawing a replay frame: the view
    recWrap(G);                             // before anything draws on tctx/dctx

    // the browser tests' way in (game/testhook.js): only on the test page, which sets the flag
    if (window.__TEST) window.__lvl = testHook(W, { tctx, dctx, paintFog: () => paintFog(W, G), hurt: (n) => hurt(W, G, n), maxHp: () => maxHp(W, G), dig: (x, y, R) => dig(W, G, x, y, R), explode: (x, y, R, splash, hot) => explode(W, G, x, y, R, splash, hot), recSample: () => recSample(W, G),
      ignite: (x, y, r, chance) => ignite(W, G, x, y, r, chance), setAlight, youAlight: () => youAlight(W), REC, RT });
    {
      // picking up where the last session left off, if App found a save
      const sv = input.current.saved;
      input.current.saved = null;
      if (sv) {
        W.floor = sv.floor;
        enterLevel(W, G, sv.level);
        if (sv.hp) W.p.hp = Math.min(sv.hp, maxHp(W, G));
      } else enterLevel(W, G);
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

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      // the controls overlay the bottom of the canvas (see-through), so the play area is the
      // part above them: scale and frame to that, but still draw (and cull) the full canvas
      const ctlPx = Math.min(c.height * 0.8, (G.RPV ? G.RPV.panelH || 0 : input.current.ctlH || 0) * dpr);   // a replay: its panel
      const playPx = c.height - ctlPx;
      const s = Math.min(c.width / VIEW_W, playPx / VIEW_MIN_H) * DEV.zoom * (G.RPV ? G.RPV.zoom : 1), vw = c.width / s, vh = c.height / s;
      const vhp = playPx / s;
      W.unitPx = s / dpr;
      const pcx = W.p.x + PW / 2, pcy = W.p.y + PH / 2;

      // camera (a replay's is wherever the viewer has dragged it, or on you)
      if (G.RPV) {
        if (G.RPV.follow) {                     // framed on you like the live camera, then kept as the centre
          G.RPV.cx = vw >= WW ? WW / 2 : clamp(G.RPV.cx - vw / 2, 0, WW - vw) + vw / 2;
          G.RPV.cy = clamp(G.RPV.cy - vhp * 0.55, 0, Math.max(0, WH - vhp)) + vhp / 2;
        }
        W.camX = G.RPV.cx - vw / 2; W.camY = G.RPV.cy - vhp / 2; G.RPV.unit = W.unitPx;
      } else {
        const tx = vw >= WW ? (WW - vw) / 2 : clamp(pcx - vw / 2, 0, WW - vw);
        const ty = clamp(pcy - vhp * 0.55, 0, Math.max(0, WH - vhp));
        if (!W.camReady) { W.camX = tx; W.camY = ty; W.camReady = true; }
        W.camX += (tx - W.camX) * 0.15;
        W.camY += (ty - W.camY) * 0.15;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgb(' + themeFor(W.floor).bg.join(',') + ')';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(s, 0, 0, s, -Math.round(W.camX * s), -Math.round(W.camY * s));

      // background and terrain (visible part only)
      // The background sits further back: it slides PARALLAX as far as the terrain does, so
      // it is shifted by the rest of the camera move. It still covers the view at every edge,
      // because the shift only ever pushes it toward the camera.
      const PARALLAX = 0.8;
      const bgox = W.camX * (1 - PARALLAX), bgoy = W.camY * (1 - PARALLAX);
      const bcx = W.camX - bgox, bcy = W.camY - bgoy;
      const bx0 = clamp(Math.floor(bcx / BCELL), 0, BW - 1), by0 = clamp(Math.floor(bcy / BCELL), 0, BH - 1);
      const bx1 = clamp(Math.ceil((bcx + vw) / BCELL) + 1, 1, BW), by1 = clamp(Math.ceil((bcy + vh) / BCELL) + 1, 1, BH);
      ctx.drawImage(bg, bx0, by0, bx1 - bx0, by1 - by0, bx0 * BCELL + bgox, by0 * BCELL + bgoy, (bx1 - bx0) * BCELL, (by1 - by0) * BCELL);
      // the shop's back wall
      if (W.camY + vh > SHOP_Y) {
        ctx.fillStyle = '#241f28';
        ctx.fillRect(0, SHOP_Y, WW, (SHOP_FLOOR * CELL) - SHOP_Y);
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        for (let bx = 0; bx < WW; bx += 24)
          for (let by = SHOP_Y; by < SHOP_FLOOR * CELL; by += 12)
            ctx.fillRect(bx + ((by / 12) % 2) * 12, by, 11, 11);
        ctx.fillStyle = 'rgba(233,236,242,0.30)';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SHOP', WW / 2, SHOP_Y + 14);
        // The floor number, huge and widely spaced along the whole back wall — just a
        // touch brighter than the wall itself, so it reads as painted-on lettering
        // rather than a label. Each glyph is placed by hand so the word spans most of
        // the wall's width no matter how many digits the floor has.
        const wallBot = SHOP_FLOOR * CELL, wallH = wallBot - SHOP_Y;
        const label = 'FLOOR ' + W.floor;
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.font = '800 ' + Math.round(wallH * 0.62) + 'px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const margin = WW * 0.05, span = WW - margin * 2, cyText = SHOP_Y + wallH / 2 + 4;
        for (let i = 0; i < label.length; i++)
          ctx.fillText(label[i], margin + span * (i + 0.5) / label.length, cyText);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }

      const tx0 = clamp(Math.floor(W.camX / CELL), 0, CW - 1), ty0 = clamp(Math.floor(W.camY / CELL), 0, CH - 1);
      const tx1 = clamp(Math.ceil((W.camX + vw) / CELL) + 1, 1, CW), ty1 = clamp(Math.ceil((W.camY + vh) / CELL) + 1, 1, CH);
      W.viewW = vw; W.viewH = vh;
      // the decoration layer (pass 2): behind the rock, in front of the back wall
      ctx.drawImage(G.RPV ? RT.dC : decoC, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
      ctx.drawImage(G.RPV ? RT.tC : terrain, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
      // the burning pixels, over the art they're eating: colour by how much fuel is left, and a
      // new flicker each fire tick. Drawn under the fog, so fire you haven't seen stays hidden;
      // the glow on top comes after the fog, only on ground you have seen (fireVis).
      W.fireVis.length = 0;
      if (W.fire.list.length) {
        const buckets = [[], [], [], []];
        for (const i of W.fire.list) {
          const x = i % CW, y = (i / CW) | 0;
          if (x < tx0 || x >= tx1 || y < ty0 || y >= ty1) continue;
          W.fireVis.push(i);
          const t = W.fire.t[i], h = (Math.imul(i, 2654435761) + W.fireN * 40503) >>> 30;
          buckets[t <= 3 ? 3 : h === 0 ? 0 : h === 3 ? 2 : 1].push(i);
        }
        for (let c = 0; c < 4; c++) {
          if (!buckets[c].length) continue;
          ctx.fillStyle = FIRE_COLS[c];
          ctx.beginPath();
          for (const i of buckets[c]) ctx.rect((i % CW) * CELL, ((i / CW) | 0) * CELL, CELL, CELL);
          ctx.fill();
        }
      }

      // the props (pass 3), their drips and the theme's ambience
      const TH = themeFor(W.floor);
      const onView = (x, y, m) => x > W.camX - m && x < W.camX + vw + m && y > W.camY - m && y < W.camY + vh + m;
      for (const pr of W.props)
        if (pr.x + pr.r > W.camX - 70 && pr.x + pr.l < W.camX + vw + 70 && pr.y + pr.b > W.camY - 90 && pr.y + pr.t0 < W.camY + vh + 90)
          drawProp(ctx, pr, W.time, TH);
      for (const q of W.dparts) {
        if (q.glow) continue;
        ctx.globalAlpha = Math.min(1, q.life / q.max * 3);
        ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.lineWidth = 0.8;
      for (const q of W.amb) {
        if (q.glow) continue;
        ctx.globalAlpha = Math.min(1, q.life);
        if (q.streak) {
          ctx.strokeStyle = q.c; ctx.beginPath();
          ctx.moveTo(q.x - Math.sign(q.vx) * q.streak, q.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        } else { ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
      }
      ctx.fillStyle = rgbA(mix(TH.rock[1], [255, 255, 255], 0.2));
      for (const dv of W.devils) {                          // a dust devil: a funnel of grit
        ctx.globalAlpha = 0.7 * Math.min(1, dv.life / 1.5, (dv.max - dv.life) / 1);
        for (let k = 0; k < 24; k++) {
          const hh = k / 24 * 30, r = 1.5 + hh * 0.35, a = W.time * 10 + k * 1.1;
          ctx.fillRect(dv.x + Math.cos(a) * r + Math.sin(W.time * 3 + k) - 0.6, dv.y - hh - 0.6, 1.2, 1.2);
        }
      }
      for (const cl of W.clouds) {                          // a burst pod's spore cloud
        const a = Math.min(1, cl.life / 1.5) * 0.28;
        for (let k = 0; k < 5; k++) {
          const ang = k * 1.26 + W.time * 0.6, rr = cl.r * 0.45;
          ctx.globalAlpha = a; ctx.fillStyle = '#a8d85a';
          ctx.beginPath(); ctx.arc(cl.x + Math.cos(ang) * rr, cl.y + Math.sin(ang) * rr * 0.7, cl.r * 0.6, 0, 6.29); ctx.fill();
        }
      }
      for (const rg of W.rings) {                           // a noise going out
        ctx.globalAlpha = 1 - rg.t / 0.9; ctx.strokeStyle = '#f0e6ff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(rg.x, rg.y, 8 + rg.t * 140, 0, 6.29); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // exit portal: a glowing pool with a slow swirl of dashes round its rim
      const pulse = 0.55 + 0.25 * Math.sin(W.time * 3);
      const pcxE = W.portal.x + W.portal.w / 2, pcyE = W.portal.y + W.portal.h / 2;
      ctx.globalAlpha = pulse * 0.35;
      ctx.fillStyle = COL.portal;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, W.portal.w, W.portal.h * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, W.portal.w / 2, W.portal.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#d8fff0';
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, W.portal.w * 0.22, W.portal.h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#c8ffe4'; ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = W.time * 12;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, W.portal.w * 0.62, W.portal.h * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // smoke
      for (const m of W.smoke) {
        ctx.fillStyle = m.c || COL.smoke;
        ctx.globalAlpha = Math.max(0, m.life / m.max) * (m.a || 0.5);
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // static fields
      for (const f of W.fields) {
        if (f.y > W.camY + vh + f.r || f.y < W.camY - f.r) continue;
        const t = f.life / f.max;
        const beat = 0.75 + 0.25 * Math.sin(W.time * (f.field === 'mine' ? 7 : 3));
        ctx.globalAlpha = 0.14 * beat * (f.field === 'mine' || f.field === 'dormant' ? 2 : 1);
        ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (f.field === 'mine' ? 0.35 : 1), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.55 * beat;
        ctx.strokeStyle = f.col;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -W.time * 14;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + 0.6 * t), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        if (!drawFieldLook(f, beat)) { ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(f.x, f.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      // v96: what sits in the middle of a field (or over it)
      function drawFieldLook(f, beat) {
        const dia = (r, c, c2) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(f.x, f.y - r * 1.4); ctx.lineTo(f.x + r, f.y);
          ctx.lineTo(f.x, f.y + r * 1.4); ctx.lineTo(f.x - r, f.y); ctx.fill();
          ctx.fillStyle = c2; ctx.beginPath(); ctx.moveTo(f.x, f.y - r * 1.4); ctx.lineTo(f.x + r * 0.45, f.y - r * 0.2);
          ctx.lineTo(f.x - r * 0.2, f.y); ctx.fill(); };
        if (f.field === 'mine') {               // a red crystal, blinking faster when something's close
          dia(3.2, '#c8302a', '#ff9a90');
          const bl = f.near ? 18 : 5;
          if (Math.sin(W.time * bl) > 0.3) { ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.fillRect(f.x - 0.6, f.y - 0.6, 1.2, 1.2); }
        } else if (f.field === 'dormant') {     // a dull orange crystal
          dia(3, '#b86a1c', '#ffd08a');
        } else if (f.field === 'slow') {        // an ice-white star
          ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 0.8;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) { const a = k * 1.047 + W.time * 0.4; ctx.moveTo(f.x - Math.cos(a) * 4, f.y - Math.sin(a) * 4); ctx.lineTo(f.x + Math.cos(a) * 4, f.y + Math.sin(a) * 4); }
          ctx.stroke();
        } else if (f.field === 'shield') {      // two shimmering arcs turning against each other
          ctx.strokeStyle = f.col; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7 * beat;
          for (const [a0, sgn] of [[W.time * 1.3, 1], [-W.time * 1.7, -1]]) {
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (sgn > 0 ? 0.92 : 0.84), a0, a0 + 2.2); ctx.stroke();
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (sgn > 0 ? 0.92 : 0.84), a0 + 3.14, a0 + 5.3); ctx.stroke(); }
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#d8f0ff'; ctx.beginPath(); ctx.arc(f.x, f.y, 2.5, 0, 6.283); ctx.fill();
        } else if (f.field === 'heal') {        // a green cross
          ctx.fillStyle = f.col; ctx.fillRect(f.x - 1.2, f.y - 4, 2.4, 8); ctx.fillRect(f.x - 4, f.y - 1.2, 8, 2.4);
        } else if (f.field === 'storm') {       // the cloud itself, over the top of the circle, with rain under it
          const cy = f.y - f.r * 0.85, t = Math.min(1, (f.max - f.life) * 3, f.life * 2);
          ctx.globalAlpha = 0.85 * t;
          for (let k = 0; k < 7; k++) { const ox = (k - 3) * f.r * 0.28, oy = Math.sin(k * 1.7 + W.time * 0.8) * 2.5;
            ctx.fillStyle = k % 2 ? '#3a3e4a' : '#4c5160';
            ctx.beginPath(); ctx.arc(f.x + ox, cy + oy, f.r * (0.22 + 0.08 * Math.sin(k * 2.3)), 0, 6.283); ctx.fill(); }
          ctx.globalAlpha = 0.35 * t; ctx.strokeStyle = '#9ec8ff'; ctx.lineWidth = 0.6;
          ctx.beginPath();
          for (let k = 0; k < 18; k++) { const x = f.x + (((k * 37.3 + W.time * 15) % (f.r * 1.8)) - f.r * 0.9),
            y = cy + ((k * 23.7 + W.time * 160) % (f.r * 1.7));
            ctx.moveTo(x, y); ctx.lineTo(x - 0.6, y + 4); }
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.field === 'glitter') {     // twinkling violet motes all over
          for (let k = 0; k < 10; k++) { const a = k * 2.4 + W.time * 0.3, r = f.r * ((k * 0.37) % 1);
            const tw = Math.sin(W.time * 9 + k * 1.3); if (tw < 0.2) continue;
            ctx.globalAlpha = tw; ctx.fillStyle = k % 3 ? '#e0a0ff' : '#ffffff';
            ctx.fillRect(f.x + Math.cos(a) * r - 0.7, f.y + Math.sin(a) * r - 0.7, 1.4, 1.4); }
          ctx.globalAlpha = 1;
        } else return false;
        return true;
      }
      ctx.globalAlpha = 1;

      // spider silk: the web lines they travel (anchor to anchor), lines being shot, the
      // strings in flight at you and the ones stuck to you
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#eef0f6';
      ctx.globalAlpha = 0.55; ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (const L of W.webs) { ctx.moveTo(L.a0x, L.a0y); ctx.lineTo(L.b0x, L.b0y); }
      for (const e of W.enemies) {
        const sh = e.sp && e.sp.mode === 'shoot' && e.sp.shot;
        if (sh) { ctx.moveTo(sh.ax0, sh.ay0); ctx.lineTo(sh.x + sh.dx * Math.min(sh.t, sh.len), sh.y + sh.dy * Math.min(sh.t, sh.len)); }
      }
      ctx.stroke();
      ctx.globalAlpha = 0.85; ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (const b of W.silk) { ctx.moveTo(b.ax, b.ay); ctx.lineTo(b.x, b.y); }
      for (const s of W.strings) { ctx.moveTo(s.ax, s.ay); ctx.lineTo(W.p.x + s.ox, W.p.y + s.oy); }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // enemies
      for (const e of W.enemies) {
        const ey = e.ty;
        if (ey > W.camY + vh + 20 || ey < W.camY - 20 || e.x < W.camX - 20 || e.x > W.camX + vw + 20) continue;
        drawEnemy(ctx, e, W.time);
        if ((e.home || e.nest) && e.hp >= e.hpMax) continue;   // rats and nests: a bar only once hurt
        const hw = 20, hx = e.x - hw / 2, hy = ey - e.r - 9;
        ctx.fillStyle = COL.barBg; ctx.fillRect(hx, hy, hw, 3);
        ctx.fillStyle = e.je ? jcol('jeColBody', e.je.u.col) : e.k.col.a;
        ctx.fillRect(hx, hy, hw * Math.max(0, e.hp / e.hpMax), 3);
      }

      // v95: the Noita-style shots' own sprites. Returns false to fall back to the streak.
      function drawLook(b) {
        const L = b.look, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp, s = b.size;
        const dot = (x, y, r, c, a) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); };
        if (L === 'spark') {                  // pink halo, white four-point twinkle
          const tw = 0.8 + 0.2 * Math.sin(b.spin * 3);
          dot(b.x, b.y, s * 1.9, b.col, 0.35);
          ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.7;
          const r = s * 2.2 * tw, a = b.spin * 0.6;
          ctx.beginPath();
          for (let k = 0; k < 2; k++) { const c = Math.cos(a + k * 1.571) * r, d = Math.sin(a + k * 1.571) * r;
            ctx.moveTo(b.x - c, b.y - d); ctx.lineTo(b.x + c, b.y + d); }
          ctx.stroke();
          dot(b.x, b.y, s * 0.8, '#ffffff', 1);
        } else if (L === 'crackle') {         // a jittering zig-zag tail, white-hot tip
          ctx.globalAlpha = 1; ctx.strokeStyle = b.col; ctx.lineWidth = 1;
          const px = -uy, py = ux; let x = b.x, y = b.y;
          ctx.beginPath(); ctx.moveTo(x, y);
          for (let k = 1; k <= 4; k++) { x = b.x - ux * k * 3.2 + px * (Math.random() - 0.5) * 4;
            y = b.y - uy * k * 3.2 + py * (Math.random() - 0.5) * 4; ctx.lineTo(x, y); }
          ctx.stroke();
          dot(b.x, b.y, s * 0.9, '#fffbe0', 1);
        } else if (L === 'ember') {           // a small magic fireball: a tail of shrinking blobs
          for (let k = 3; k >= 0; k--) dot(b.x - ux * k * 1.6, b.y - uy * k * 1.6, s * (1 - k * 0.18),
            k ? b.col : '#eaffd8', k ? 0.5 - k * 0.1 : 1);
        } else if (L === 'glob') {            // stretched by its own speed, like Noita's
          const st = 1 + Math.min(1.6, sp / 300);
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.globalAlpha = 0.45; ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.ellipse(-s * st * 0.4, 0, s * st * 1.5, s * 1.3, 0, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.ellipse(-s * st * 0.25, 0, s * st, s * 0.85, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#ffe0f6';
          ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.25, s * 0.35, 0, 6.283); ctx.fill();
          ctx.restore();
        } else if (L === 'bubble') {          // a see-through bubble, wobbling, with a shine
          const r = s * 1.6, w = 1 + 0.1 * Math.sin(b.spin * 1.7);
          ctx.save(); ctx.translate(b.x, b.y);
          ctx.globalAlpha = 0.18; ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.ellipse(0, 0, r * w, r / w, 0, 0, 6.283); ctx.fill();
          ctx.globalAlpha = 0.9; ctx.strokeStyle = b.col; ctx.lineWidth = 0.7; ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 3.6, 4.5); ctx.stroke();
          ctx.restore();
        } else if (L === 'arrow') {           // a glowing green arrow along its flight
          const len = 7 + s, hx = b.x - ux * len, hy = b.y - uy * len, px = -uy, py = ux;
          ctx.globalAlpha = 0.35; ctx.strokeStyle = b.col; ctx.lineWidth = s * 2.2;
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.globalAlpha = 1; ctx.strokeStyle = '#d8ffc8'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.moveTo(b.x + ux * 2.5, b.y + uy * 2.5);
          ctx.lineTo(b.x - ux * 2 + px * 2, b.y - uy * 2 + py * 2);
          ctx.lineTo(b.x - ux * 2 - px * 2, b.y - uy * 2 - py * 2); ctx.fill();
          ctx.strokeStyle = b.col; ctx.lineWidth = 0.8;       // fletching
          ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - ux * 2 + px * 1.8, hy - uy * 2 + py * 1.8);
          ctx.moveTo(hx, hy); ctx.lineTo(hx - ux * 2 - px * 1.8, hy - uy * 2 - py * 1.8); ctx.stroke();
        } else if (L === 'drill') {           // a spinning bit
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          const sq = Math.cos(b.spin * 2.5);
          ctx.globalAlpha = 1; ctx.fillStyle = '#3d5f9a';
          ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-2, 2.2); ctx.lineTo(-2, -2.2); ctx.fill();
          ctx.strokeStyle = b.col; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(-1 + sq, -1.8); ctx.lineTo(1 + sq, 1.2); ctx.moveTo(1.5 - sq * 0.5, -1); ctx.lineTo(2.8 - sq * 0.5, 0.6);
          ctx.stroke();
          ctx.restore();
        } else if (L === 'sparks') {          // no body at all, just its blue streak
          dot(b.x, b.y, s * 0.8, '#ffffff', 1);
        } else if (L === 'heavy') {           // Magic Bolt: a green-gold ball with a spitting tail
          for (let k = 3; k >= 0; k--) dot(b.x - ux * k * 2, b.y - uy * k * 2, s * (1 - k * 0.2) * 0.8,
            k ? b.col : '#fffbd0', k ? 0.45 - k * 0.1 : 1);
          dot(b.x, b.y, s * 1.3, b.col, 0.25);
        } else if (L === 'lance') {           // a long spear with a bright head
          const len = 12 + s * 2, tx = b.x - ux * len, ty = b.y - uy * len;
          ctx.globalAlpha = 0.3; ctx.strokeStyle = b.col; ctx.lineWidth = s * 2.4;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.globalAlpha = 1; ctx.lineWidth = s * 0.8;
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * 0.5;
          ctx.beginPath(); ctx.moveTo(b.x - ux * 4, b.y - uy * 4); ctx.lineTo(b.x + ux * 2, b.y + uy * 2); ctx.stroke();
        } else if (L === 'rubber') {          // a shiny ball, squashed along its flight
          const sq = 1 + Math.min(0.35, sp / 2000);
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.globalAlpha = 1; ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.ellipse(0, 0, s * sq, s / sq, 0, 0, 6.283); ctx.fill();
          ctx.restore();
          dot(b.x - s * 0.35, b.y - s * 0.35, s * 0.35, '#fff6d8', 1);
        } else if (L === 'bomb') {            // a black bomb, a cap, and the fizzing fuse
          const a = b.spin * 0.5 - 1.2, cx = Math.cos(a), cy = Math.sin(a);
          dot(b.x, b.y, s * 1.15, '#1e1d24', 1);
          dot(b.x - s * 0.35, b.y - s * 0.4, s * 0.3, '#6a6878', 1);
          ctx.globalAlpha = 1; ctx.strokeStyle = '#8a7a60'; ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(b.x + cx * s, b.y + cy * s); ctx.lineTo(b.x + cx * s * 1.6, b.y + cy * s * 1.6); ctx.stroke();
          const tw = Math.sin(W.time * 40) > 0;
          dot(b.x + cx * s * 1.7, b.y + cy * s * 1.7, tw ? 1 : 0.7, tw ? '#ffffff' : '#ffb347', 1);
        } else if (L === 'rocket') {          // a little rocket: body, fins, and a flickering flame
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          const fl = 2.5 + Math.random() * 2.5 + Math.min(4, sp / 200);
          ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffb347';
          ctx.beginPath(); ctx.moveTo(-3, -1.3); ctx.lineTo(-3 - fl, 0); ctx.lineTo(-3, 1.3); ctx.fill();
          ctx.fillStyle = '#fff2c0';
          ctx.beginPath(); ctx.moveTo(-3, -0.7); ctx.lineTo(-3 - fl * 0.5, 0); ctx.lineTo(-3, 0.7); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = '#d8d4dc'; ctx.fillRect(-3, -1.2, 5, 2.4);
          ctx.fillStyle = b.col; ctx.beginPath(); ctx.moveTo(2, -1.2); ctx.lineTo(4, 0); ctx.lineTo(2, 1.2); ctx.fill();
          ctx.fillStyle = '#a04030'; ctx.beginPath(); ctx.moveTo(-3, -1.2); ctx.lineTo(-4.2, -2.4); ctx.lineTo(-1.5, -1.2);
          ctx.moveTo(-3, 1.2); ctx.lineTo(-4.2, 2.4); ctx.lineTo(-1.5, 1.2); ctx.fill();
          ctx.restore();
        } else if (L === 'flame') {           // a ball of flame: flickering layers, white-hot heart
          const f = 1 + 0.15 * Math.sin(b.spin * 3.1) + 0.1 * Math.random();
          dot(b.x - ux * s * 0.5, b.y - uy * s * 0.5, s * 1.5 * f, '#e8461c', 0.45);
          dot(b.x, b.y, s * 1.1 * f, b.col, 0.85);
          dot(b.x + ux * s * 0.2, b.y + uy * s * 0.2, s * 0.65, '#ffd35a', 1);
          dot(b.x + ux * s * 0.3, b.y + uy * s * 0.3, s * 0.3, '#fffbe0', 1);
        } else if (L === 'orb') {             // a glowing energy sphere, pulsing
          const pu = 1 + 0.1 * Math.sin(b.spin * 2);
          dot(b.x, b.y, s * 1.8 * pu, b.col, 0.25);
          dot(b.x, b.y, s * pu, b.col, 0.9);
          dot(b.x, b.y, s * 0.5, '#f0f8ff', 1);
        } else if (L === 'chain') {           // a violet orb with arcs flickering round it
          dot(b.x, b.y, s * 1.8, b.col, 0.3);
          dot(b.x, b.y, s * 0.9, '#f4e0ff', 1);
          ctx.globalAlpha = 0.9; ctx.strokeStyle = b.col; ctx.lineWidth = 0.6;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) { let a = Math.random() * 6.283, r = s;
            ctx.moveTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
            for (let q = 0; q < 3; q++) { a += rnd(-0.6, 0.6); r += 1.4; ctx.lineTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r); } }
          ctx.stroke();
        } else if (L === 'cross') {           // a glowing cross, tumbling
          const r = s * 2, a = b.spin * 0.8;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
          ctx.globalAlpha = 0.35; ctx.strokeStyle = b.col; ctx.lineWidth = s * 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
          ctx.globalAlpha = 1; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = s * 0.55;
          ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
          ctx.restore();
        } else if (L === 'disc') {            // a spinning sawblade
          const r = s, a = b.spin * 2.2;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
          ctx.globalAlpha = 1; ctx.fillStyle = b.col;
          ctx.beginPath();
          for (let k = 0; k < 16; k++) { const rr = k % 2 ? r * 0.78 : r * 1.12, t = k / 16 * 6.283; ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr); }
          ctx.fill();
          ctx.fillStyle = '#6a6e78'; ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, 6.283); ctx.fill();
          ctx.restore();
        } else if (L === 'nuke') {            // a fat yellow shell with a blinking red light
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.globalAlpha = 1; ctx.fillStyle = '#e8d24a';
          ctx.beginPath(); ctx.ellipse(0, 0, s * 1.3, s * 0.85, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = '#2a2a2a';
          for (let k = 0; k < 3; k++) { const t = k * 2.094 + b.spin * 0.3;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, s * 0.6, t, t + 0.8); ctx.fill(); }
          ctx.fillStyle = '#6a6a58'; ctx.fillRect(-s * 1.7, -s * 0.8, s * 0.5, s * 1.6);
          ctx.restore();
          if (Math.sin(W.time * 12) > 0) dot(b.x + ux * s * 1.2, b.y + uy * s * 1.2, 0.9, '#ff3a2a', 1);
        } else if (L === 'pollen') {          // a fuzzy puff
          for (let k = 0; k < 7; k++) { const a = k * 0.9 + b.spin * 0.3, r = s * (0.9 + 0.3 * Math.sin(k * 2.1 + b.spin));
            dot(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 0.7, k % 2 ? b.col : '#f4ffb0', 0.9); }
          dot(b.x, b.y, s * 0.7, '#ffe98a', 1);
        } else return false;
        ctx.globalAlpha = 1;
        return true;
      }
      // a lightning line: a wide soft glow, then a thin white-hot core
      function drawBolt(pts, col, w, alpha) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
        const path = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y); ctx.stroke(); };
        ctx.strokeStyle = col;
        ctx.globalAlpha = alpha * 0.25; ctx.lineWidth = w * 5; path();
        ctx.globalAlpha = alpha * 0.7; ctx.lineWidth = w * 1.8; path();
        ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = alpha; ctx.lineWidth = w * 0.7; path();
        ctx.restore();
      }
      // projectiles
      for (const b of W.enemyShots) {
        if (b.goo) {                           // poison spit: a wobbling glob with a wet highlight
          const s = b.size, wob = 1 + 0.12 * Math.sin(W.time * 30 + b.x * 0.1);
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
          ctx.fillStyle = b.edge || '#123d18';
          ctx.beginPath(); ctx.ellipse(0, 0, s * 1.45 * wob, s * 1.05 / wob, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = b.col;
          ctx.beginPath(); ctx.ellipse(-s * 0.08, 0, s * 1.2 * wob, s * 0.82 / wob, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = b.shine || '#e6ffb8';
          ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.28, s * 0.32, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          continue;
        }
        ctx.fillStyle = b.col;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2); ctx.fill();
      }
      // shots are drawn as streaks along their own velocity, so a fast one reads
      // as a long dash and a slow heavy one as a stub
      ctx.lineCap = 'round';
      for (const b of W.bullets) {
        if (b.hidden) continue;                 // Buzzsaw cuts without drawing a circle
        if (b.pull) {                           // Black Hole: purple haze, starry black core
          const r = b.size, core = b.eat || r * 0.78, beat = 1 + 0.06 * Math.sin(W.time * 6 + b.spin);
          const g = ctx.createRadialGradient(b.x, b.y, core * 0.8, b.x, b.y, r * 1.55 * beat);
          g.addColorStop(0, 'rgba(197,140,255,0.75)');
          g.addColorStop(0.3, 'rgba(150,90,255,0.35)');
          g.addColorStop(1, 'rgba(110,50,220,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.55 * beat, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#050208';
          ctx.beginPath(); ctx.arc(b.x, b.y, core, 0, Math.PI * 2); ctx.fill();
          for (let k = 0; k < 14; k++) {       // twinkling stars wheeling inside
            const tw = Math.sin(W.time * 8 + k * 1.7);
            if (tw < 0.1) continue;
            const ang = k * 2.4 + W.time * (0.5 + (k % 3) * 0.35), rad = core * (0.15 + ((k * 0.37) % 0.75));
            const sx = b.x + Math.cos(ang) * rad, sy = b.y + Math.sin(ang) * rad, sz = 0.6 + tw * 0.9;
            ctx.globalAlpha = tw;
            ctx.fillStyle = k % 3 ? '#e6d4ff' : '#ffffff';
            ctx.fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
          }
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = '#b98aff'; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(b.x, b.y, core, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
          continue;
        }
        if (b.look && drawLook(b)) continue;
        if (b.arc && b.trail && b.trail.length > 1) {   // lightning: a fresh zig-zag every frame
          drawBolt(jag(b.trail.concat([{ x: b.x, y: b.y }]), 5), b.col, 1.6, 1);
          continue;
        }
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const len = Math.max(0.5, Math.min(46, sp * 0.022));   // length is speed alone
        const hx = b.vx / sp * len, hy = b.vy / sp * len;
        if (b.homing) {
          ctx.globalAlpha = 0.3;
          ctx.strokeStyle = COL.enemy;
          ctx.lineWidth = b.size * 1.7 + 4;
          ctx.beginPath(); ctx.moveTo(b.x - hx, b.y - hy); ctx.lineTo(b.x, b.y); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = b.col;
        ctx.lineWidth = b.size * 1.7;
        ctx.beginPath(); ctx.moveTo(b.x - hx, b.y - hy); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (b.explode) {
          ctx.fillStyle = Math.sin(b.spin) > 0 ? COL.flame2 : COL.visor;
          ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
        }
      }
      for (const a of W.arcs) drawBolt(a.pts, a.col, a.w, 1 - a.t / a.max);
      // instant beams, which fade over a few frames
      for (const bm of W.beams) {
        const fade = 1 - bm.t / 0.12;
        if (bm.look) {                          // v96: a wide wavering halo under the beam
          ctx.globalAlpha = fade * 0.18;
          ctx.strokeStyle = bm.col; ctx.lineWidth = bm.w * (7 + Math.random() * 2);
          ctx.beginPath(); ctx.moveTo(bm.x, bm.y); ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); ctx.stroke();
        }
        ctx.globalAlpha = fade * 0.35;
        ctx.strokeStyle = bm.col; ctx.lineWidth = bm.w * 3.5;
        ctx.beginPath(); ctx.moveTo(bm.x, bm.y);
        ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); ctx.stroke();
        ctx.globalAlpha = fade;
        ctx.lineWidth = bm.w * 1.2;
        ctx.beginPath(); ctx.moveTo(bm.x, bm.y);
        ctx.lineTo(bm.x + bm.nx * bm.len, bm.y + bm.ny * bm.len); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // the portal you arrived through: scenery only
      if (W.arrival.y < W.camY + vh + 40 && W.arrival.y > W.camY - 40) {
        const sway = 0.5 + 0.18 * Math.sin(W.time * 1.6);
        ctx.fillStyle = '#4a4550';
        ctx.fillRect(W.arrival.x - 16, W.arrival.y + 12, 32, 5);
        ctx.globalAlpha = 0.22 * sway;
        ctx.fillStyle = COL.enemy;
        ctx.beginPath(); ctx.ellipse(W.arrival.x, W.arrival.y, 17, 21, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.5 * sway;
        ctx.beginPath(); ctx.ellipse(W.arrival.x, W.arrival.y, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#6c6480'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(W.arrival.x, W.arrival.y, 13, 17, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(233,236,242,0.34)';
        ctx.font = '600 7px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WAY IN', W.arrival.x, W.arrival.y - 22);
        ctx.textAlign = 'left';
      }

      // shop stock on its plinths
      for (const it of W.stock) {
        if (it.y > W.camY + vh + 40 || it.y < W.camY - 40) continue;
        const bob = Math.sin(W.time * 2 + it.x) * 2;
        // the plinth: a narrow column dropping from just under the item down to the shop
        // floor (so it isn't left hovering), with a wider foot resting on the floor
        const floorY = SHOP_FLOOR * CELL;
        ctx.fillStyle = '#4a4550';
        ctx.fillRect(it.x - 6, it.y + 4, 12, Math.max(9, floorY - (it.y + 4)));
        ctx.fillRect(it.x - 11, floorY - 5, 22, 5);
        if (it.sold) {
          ctx.fillStyle = COL.muted;
          ctx.font = '600 8px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SOLD', it.x, it.y - 2);
          ctx.textAlign = 'left';
          continue;
        }
        if (it.kind === 'heal') {
          ctx.globalAlpha = 0.25; ctx.fillStyle = COL.hp;
          ctx.beginPath(); ctx.arc(it.x, it.y + bob, 13, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = COL.hp;
          ctx.fillRect(it.x - 7, it.y - 2.5 + bob, 14, 5);
          ctx.fillRect(it.x - 2.5, it.y - 7 + bob, 5, 14);
        } else if (it.kind === 'gun') {
          ctx.globalAlpha = 0.22; ctx.fillStyle = gunAccent(it.gun);
          ctx.beginPath(); ctx.arc(it.x, it.y + bob, 14, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          drawGun(ctx, it.x - 5, it.y + 1 + bob, -0.22, 0.9, gunAccent(it.gun));
          ctx.fillStyle = COL.bullet;
          ctx.font = '600 9px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(it.price + 'g', it.x, it.y - 13 + bob);
          ctx.fillStyle = COL.muted;
          ctx.font = '600 8px system-ui, sans-serif';
          ctx.fillText(it.gun.cap + ' slots', it.x, it.y + 24 + bob);
          ctx.textAlign = 'left';
        } else {
          const m = MODS[it.id];
          ctx.globalAlpha = 0.22; ctx.fillStyle = famCol(it.id);
          ctx.beginPath(); ctx.arc(it.x, it.y + bob, 13, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = famCol(it.id);
          ctx.beginPath();
          ctx.moveTo(it.x, it.y - 8 + bob); ctx.lineTo(it.x + 8, it.y + bob);
          ctx.lineTo(it.x, it.y + 8 + bob); ctx.lineTo(it.x - 8, it.y + bob);
          ctx.fill();
          ctx.fillStyle = '#12141a';
          ctx.font = '600 9px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m.glyph, it.x, it.y + 0.5 + bob);
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = COL.bullet;
          ctx.font = '600 9px system-ui, sans-serif';
          ctx.fillText(it.price + 'g', it.x, it.y - 12 + bob);
          ctx.textAlign = 'left';
        }
      }

      // gold
      for (const g of W.coins) {
        if (g.y > W.camY + vh + 30 || g.y < W.camY - 30) continue;
        const bob = Math.sin(W.time * 4 + g.t) * 1.5;
        ctx.fillStyle = '#d8a52a';
        ctx.beginPath(); ctx.ellipse(g.x, g.y + bob, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.ellipse(g.x - 0.8, g.y - 0.8 + bob, 1.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      }

      // pickups
      for (const q of W.pickups) {
        const qy = q.y + Math.sin(W.time * 2 + q.t) * 3;
        if (qy > W.camY + vh + 30 || qy < W.camY - 30 || q.x < W.camX - 30 || q.x > W.camX + vw + 30) continue;
        if (q.kind === 'gun') {
          // a gun you've never held glows, with sparks streaking out of it; one you swapped
          // out and left on the ground doesn't, so you can tell new from discarded at a glance
          if (!q.old) drawGunGlow(ctx, q.x, qy, W.time, q.t);
          drawGun(ctx, q.x - 5, qy + 1, -0.22, 0.85, gunAccent(q.gun));
        } else {
          const m = MODS[q.id];
          ctx.globalAlpha = 0.22; ctx.fillStyle = famCol(q.id);
          ctx.beginPath(); ctx.arc(q.x, qy, 12, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = famCol(q.id);
          ctx.beginPath();
          ctx.moveTo(q.x, qy - 8); ctx.lineTo(q.x + 8, qy); ctx.lineTo(q.x, qy + 8); ctx.lineTo(q.x - 8, qy);
          ctx.fill();
          ctx.fillStyle = '#12141a';
          ctx.font = '600 9px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m.glyph, q.x, qy + 0.5);
          ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        }
      }

      // the hidden rooms' prizes on their altars: a glowing perk sigil, or the +25 heart
      for (const r of W.rooms) {
        if (r.taken) continue;
        if (r.y > W.camY + vh + 40 || r.y < W.camY - 40 || r.x < W.camX - 40 || r.x > W.camX + vw + 40) continue;
        const bob = Math.sin(W.time * 2 + r.x) * 2.5;
        ctx.fillStyle = '#4a4550';
        ctx.fillRect(r.x - 12, r.y + 14, 24, 5);
        ctx.fillRect(r.x - 7, r.y + 5, 14, 10);
        if (r.kind === 'perk') {
          const pk = PERKS[r.id], col = pk.tint || COL.portal;
          ctx.globalAlpha = 0.22 + 0.12 * Math.sin(W.time * 3);
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(r.x, r.y + bob, 16, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = col;
          ctx.font = '700 20px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(pk.glyph, r.x, r.y + 0.5 + bob);
          ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        } else {
          ctx.globalAlpha = 0.25 + 0.12 * Math.sin(W.time * 3);
          ctx.fillStyle = COL.hp;
          ctx.beginPath(); ctx.arc(r.x, r.y + bob, 16, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1; ctx.fillStyle = COL.hp;
          // a plump heart
          ctx.beginPath();
          ctx.moveTo(r.x, r.y + 7 + bob);
          ctx.bezierCurveTo(r.x - 11, r.y - 2 + bob, r.x - 6, r.y - 11 + bob, r.x, r.y - 4 + bob);
          ctx.bezierCurveTo(r.x + 6, r.y - 11 + bob, r.x + 11, r.y - 2 + bob, r.x, r.y + 7 + bob);
          ctx.fill();
          ctx.fillStyle = '#0c130f';
          ctx.font = '700 8px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('+25', r.x, r.y - 14 + bob);
          ctx.textAlign = 'left';
        }
      }

      // Levitation Trail: the fire you left behind, still burning
      for (const bn of W.burns) {
        const t = bn.life / bn.max;
        ctx.globalAlpha = t * 0.8;
        ctx.fillStyle = t > 0.5 ? COL.flame2 : COL.flame;
        ctx.beginPath(); ctx.arc(bn.x, bn.y, 3 + (1 - t) * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // sparks and debris
      for (const q of W.sparks) {
        ctx.fillStyle = q.c;
        ctx.globalAlpha = Math.max(0, q.life / q.max);
        ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      }
      ctx.globalAlpha = 1;

      // magic motes: the Black Hole's trail and the portals' drift, added on as light
      ctx.globalCompositeOperation = 'lighter';
      for (const q of W.motes) {
        if (q.y > W.camY + vh + 20 || q.y < W.camY - 20) continue;
        let a;
        if (q.kind === 'in') a = Math.min(1, q.age / 0.6) * 0.9;              // fade in, never pop
        else if (q.kind === 'out') a = Math.min(1, q.age / 0.3) *
          Math.max(0, 1 - Math.hypot(q.x - q.ox, q.y - q.oy) / q.fade) * 0.9;  // fade with distance
        else a = Math.max(0, q.life / q.max) * 0.9;
        ctx.globalAlpha = a;
        ctx.fillStyle = q.c;
        ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      // explosion flashes
      for (const f of W.flashes) {
        const t = f.t / 0.25;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = COL.flame;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + 0.5 * t), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.35 + 0.3 * t), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // jet flame
      if (W.p.flame > 0) {
        let fx = -W.p.jx, fy = -W.p.jy + 0.8;
        const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
        const len = 6 + W.p.flame * 16 + Math.random() * 3;
        const bx = pcx, by = W.p.y + PH - 2;
        ctx.fillStyle = COL.flame;
        ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by); ctx.lineTo(bx + fx * len, by + fy * len); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.moveTo(bx - 2, by); ctx.lineTo(bx + 2, by); ctx.lineTo(bx + fx * len * 0.55, by + fy * len * 0.55); ctx.fill();
      }

      // aim, grenade arc preview, gun
      const R = W.p.aim;
      const held = input.current.loadout.guns[input.current.loadout.sel];
      const ax = R.show ? R.nx : W.p.face, ay = R.show ? R.ny : 0;
      const gy = W.p.y + PH * 0.52;

      // where the next pull actually goes, mods and all — only with the Trajectory Sight perk
      const tvis = R.vis == null ? 1 : R.vis;
      if (!G.RPV && !W.p.dead && R.show && held && W.pb.trajectory && tvis > 0) {
        const sim = Object.assign({}, held, { slots: held.slots.slice(),
          order: held.order.slice(), idx: held.idx });
        const plan = planCast(sim);                 // a copy, so the real gun is untouched
        const seen = {};
        let drawn = 0;
        for (const sh of plan.shots) {
          if (sh.still) {                    // a field lands in front of you, it does not fly
            const fx = pcx + R.nx * 30, fy = gy + R.ny * 30;
            ctx.globalAlpha = 0.5 * tvis; ctx.strokeStyle = sh.col; ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.arc(fx, fy, Math.max(8, sh.r), 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]); ctx.globalAlpha = 1;
            continue;
          }
          const key = [Math.round(sh.speed), Math.round(sh.grav), sh.accel, sh.bounce,
            sh.bore, sh.homing, Math.round(sh.life * 20), sh.beam, sh.spiral, sh.orbit,
            sh.pong, sh.boomer, sh.flat].join(',');
          if (seen[key] || drawn >= 3) continue;
          seen[key] = 1;
          const cone = drawn === 0 && sh.spread > 2
            ? [-sh.spread / 2, 0, sh.spread / 2] : [0];
          drawn++;
          // the perks that bend a bullet in flight bend the aim line too, or it lies
          const tsh = Object.assign({}, sh, { bounce: sh.bounce + W.pb.bounce,
            homing: Math.max(sh.homing, W.pb.homing), speed: sh.speed * W.pb.speed * bhSp(sh) });
          for (const off of cone) {
            const a = Math.atan2(R.ny, R.nx) + off * Math.PI / 180;
            tracePath(tsh, pcx, gy, Math.cos(a), Math.sin(a), (x, y) => solidAt(W, x, y), W.enemies, aimPath,
              { x: pcx, y: gy });
            ctx.fillStyle = sh.col;
            const edge = off !== 0;
            const size = edge ? 1.6 : 2.4;
            for (let i = 2; i < aimPath.length; i += edge ? 8 : 4) {
              const t = i / aimPath.length;
              ctx.globalAlpha = (edge ? 0.3 : 0.9) * (1 - 0.6 * t) * tvis;
              ctx.fillRect(aimPath[i] - size / 2, aimPath[i + 1] - size / 2, size, size);
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // player
      if (W.p.dead) ctx.globalAlpha = 0.35;
      const flashing = W.p.hitT > 0 && Math.floor(W.p.hitT * 30) % 2 === 0;
      const running = W.p.onGround && Math.abs(W.p.vx) > 15;
      const gait = running ? Math.sin(W.time * 15) : 0;
      drawRunner(ctx, W.p.x, W.p.y, PW, PH, W.p.face, gait, !W.p.onGround, W.p.flame, flashing);
      if (!W.p.dead) drawGun(ctx, pcx + ax * 2.5, gy, Math.atan2(ay, ax), 0.55, gunAccent(held));
      // the torch, in the hand the gun is not in
      if (!W.p.dead) { const th = torchHand(W); drawTorch(ctx, th.x, th.y, ax >= 0 ? -1 : 1, W.flick, W.torchP, W.leanX, W.leanY, W.time); }
      // a small aim crosshair at DEV.aimDist out, rotating round you with the aim: a "+"
      // with the centre cut out (two short verticals, two short horizontals), drawn as thin
      // as the thumbstick lines (~1.5 css px, so 1.5/unitPx world units, whatever the zoom)
      if (!W.p.dead) {
        const cxp = pcx + ax * DEV.aimDist, cyp = gy + ay * DEV.aimDist;
        const inr = 1.25, outr = 3;            // gap radius, arm end (half the v55 size)
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = 1.5 / W.unitPx;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(cxp, cyp - outr); ctx.lineTo(cxp, cyp - inr);   // top
        ctx.moveTo(cxp, cyp + inr);  ctx.lineTo(cxp, cyp + outr);  // bottom
        ctx.moveTo(cxp - outr, cyp); ctx.lineTo(cxp - inr, cyp);   // left
        ctx.moveTo(cxp + inr, cyp);  ctx.lineTo(cxp + outr, cyp);  // right
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Permanent Shield: a soft ring while it is up, gone the moment it is spent
      if (W.pb.shield && W.p.shieldReady && !W.p.dead) {
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(W.time * 4);
        ctx.strokeStyle = '#7ad7ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pcx, pcy, PW * 1.15, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Angry Ghost: a pale wisp that drifts at your shoulder
      if (W.pb.ghost && W.ghost && !W.p.dead) {
        const gb = Math.sin(W.time * 3) * 2;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#c9a6ff';
        ctx.beginPath(); ctx.arc(W.ghost.x, W.ghost.y + gb, 6, Math.PI, 0);
        ctx.lineTo(W.ghost.x + 6, W.ghost.y + gb + 6);
        ctx.lineTo(W.ghost.x + 2, W.ghost.y + gb + 4);
        ctx.lineTo(W.ghost.x - 2, W.ghost.y + gb + 6);
        ctx.lineTo(W.ghost.x - 6, W.ghost.y + gb + 4);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#3a2f52';
        ctx.fillRect(W.ghost.x - 3, W.ghost.y + gb - 1, 1.6, 2.4);
        ctx.fillRect(W.ghost.x + 1.4, W.ghost.y + gb - 1, 1.6, 2.4);
      }

      // ---- torchlight, masked by the fog of war ----
      // Line of sight is what lifts the fog: fogReveal marks every cell the fan reaches as
      // somewhere you have been, and it stays marked for the rest of the floor. The lamp
      // then lights that lifted ground — brightest at your feet, fading out to torchR — but
      // it is MASKED by the fog: a cell you have never had line of sight to stays dark even
      // with the torch right on top of it, so the cave ahead of you is a real unknown. The
      // lamp does not itself stop at walls; it is the *reveal* that respects them, so what
      // you have already uncovered round a corner still lights up. `flick` is the flame's
      // own number, so both the reach and the brightness breathe exactly as the fire does.
      const sight = SIGHT * DEV.torch;                       // dev knob scales the whole bubble
      W.torchR = clamp(sight * LAMP_REACH * (0.5 + 0.55 * W.flick), 120, 1400);
      W.visPts = visPoly(pcx, pcy, sight, (cx, cy) => solidCell(W, cx, cy), VIS_RAYS);
      fogReveal(W.seen, pcx, pcy, sight, W.visPts, VIS_RAYS);   // line of sight lifts the fog
      if (!G.RPV || G.RPV.fog) {                                 // a replay can turn the fog off
        // bake the visible slab of the overlay every frame: the base darkness is the fog
        // state, then the lamp brightens the cells the fog has already been lifted from
        const fdat = fogImg.data;
        const dim = Math.round(255 * DEV.fogDim), dark = Math.round(255 * DEV.fogDark);
        const lr2 = W.torchR * W.torchR;
        const fx0 = clamp(Math.floor(W.camX / FOG_U) - 1, 0, FW - 1), fy0 = clamp(Math.floor(W.camY / FOG_U) - 1, 0, FH - 1);
        const fx1 = clamp(Math.ceil((W.camX + vw) / FOG_U) + 2, 1, FW), fy1 = clamp(Math.ceil((W.camY + vh) / FOG_U) + 2, 1, FH);
        for (let cy = fy0; cy < fy1; cy++) {
          const ddy = (cy + 0.5) * FOG_U - pcy;
          for (let cx = fx0; cx < fx1; cx++) {
            const i = cy * FW + cx, k = i * 4;
            fdat[k] = 9; fdat[k + 1] = 10; fdat[k + 2] = 14;
            let s = W.seen[i];
            // push the dark off ground you have seen: an unseen cell that borders a seen one
            // is treated as remembered (dim + lamp), so a bit more of the uncovered surface
            // shows instead of the darkness sitting right on its edge
            if (!s && !(W.deepFog && W.deepFog[i]) && ((cx > 0 && W.seen[i - 1]) || (cx < FW - 1 && W.seen[i + 1]) ||
                (cy > 0 && W.seen[i - FW]) || (cy < FH - 1 && W.seen[i + FW]) ||
                (cx > 0 && cy > 0 && W.seen[i - FW - 1]) || (cx < FW - 1 && cy > 0 && W.seen[i - FW + 1]) ||
                (cx > 0 && cy < FH - 1 && W.seen[i + FW - 1]) || (cx < FW - 1 && cy < FH - 1 && W.seen[i + FW + 1]))) s = 1;
            let a = s === 2 ? 0 : s ? dim : dark;
            if (s && a) {                        // the lamp only reaches ground the fog has lifted
              const ddx = (cx + 0.5) * FOG_U - pcx, dd2 = ddx * ddx + ddy * ddy;
              if (dd2 < lr2) {
                const t = Math.sqrt(dd2) / W.torchR;               // 0 at your feet, 1 at the edge
                const lift = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
                a = a * (1 - lift);
              }
            }
            fdat[k + 3] = a;
          }
        }
        fctx.putImageData(fogImg, 0, 0, fx0, fy0, fx1 - fx0, fy1 - fy0);
        // blur the slab at source resolution (cheap: an 80x200 canvas), then upscale the soft
        // copy — a source-px of blur becomes ~a fog cell of blur on screen, so the fog edge
        // reads as a gradient rather than a hard line
        fbctx.clearRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
        fbctx.filter = 'blur(0.9px)';
        fbctx.drawImage(fogC, fx0, fy0, fx1 - fx0, fy1 - fy0, fx0, fy0, fx1 - fx0, fy1 - fy0);
        fbctx.filter = 'none';
        ctx.imageSmoothingEnabled = true;     // the upscale further softens the edge
        ctx.drawImage(fogBlurC, fx0, fy0, fx1 - fx0, fy1 - fy0,
          fx0 * FOG_U, fy0 * FOG_U, (fx1 - fx0) * FOG_U, (fy1 - fy0) * FOG_U);
        ctx.imageSmoothingEnabled = false;
      }

      // ---- firelight on top of the fog: the wall torches (where you have been) and the hand
      // torch's glow plus its small, warm second light round you. Additive, so it only ever
      // brightens; the map lighting under it is unchanged. The glow gutters on its own,
      // quicker and deeper than the lamp.
      ctx.globalCompositeOperation = 'lighter';
      const gl = clamp(0.82 + W.glowN + 0.08 * Math.sin(W.time * 23) + 0.06 * Math.sin(W.time * 37), 0.5, 1.1);
      const scOn = sc => !(sc.y > W.camY + vh + 30 || sc.y < W.camY - 30 || sc.x < W.camX - 30 || sc.x > W.camX + vw + 30) &&
        fogLit(W, sc.x, sc.y);
      for (const sc of W.sconces) {
        if (!scOn(sc)) continue;
        const sg = 0.85 + 0.15 * Math.sin(W.time * 11 + sc.ph) * Math.sin(W.time * 5.3 + sc.ph);
        glowAt(ctx, sc.x, sc.y - 6, 34, 0.16 * sg, '255,140,50');
        glowAt(ctx, sc.x, sc.y - 7, 9, 0.45 * sg, '255,190,90');
      }
      // lit props and glowing motes, only where the fog has lifted — except the eyes, which
      // watch from the dark
      for (const pr of W.props) {
        if (!(pr.k === 'lamp' || pr.k === 'vent' || pr.k === 'shard' || pr.k === 'eyes' || pr.k === 'matter' ||
          (pr.k === 'drip' && pr.st === 'lava')) || !onView(pr.x, pr.y, 60)) continue;
        if (pr.k !== 'eyes' && !fogLit(W, pr.x, pr.y)) continue;
        propGlow(ctx, pr, W.time, TH, Math.hypot(pr.x - pcx, pr.y - pcy), W.torchR);
      }
      // and the green round each jelly glows and twinkles in its colour (plantGlow)
      for (const e of W.enemies)
        if (e.je && onView(e.x, e.ty, 160) && fogLit(W, e.x, e.ty)) plantGlow(W, G, e, TH);
      // glowing creatures (the jellyfish) light the cave round them, flaring as they pulse.
      // Radius, brightness and flare are its kp+'GlowR' / 'Glow' / 'Flare' knobs, and like
      // every other light out here it shows only where the fog has lifted
      for (const e of W.enemies) {
        const k = e.k;
        if (!k.glow || !k.kp || !onView(e.x, e.ty, 120) || !fogLit(W, e.x, e.ty)) continue;
        const u = (e.je && e.je.u) || { glowR: 0.5, glow: 0.5, flare: 0.5 }, sh = e.je ? e.je.shape : 0;
        const a = kru(k.kp + 'Glow', u.glow) * (1 + kru(k.kp + 'Flare', u.flare) * sh);
        const rgb = e.je ? hexRgb(jcol('jeColGlow', e.je.u.col)) : k.glow;
        glowAt(ctx, e.x, e.ty, kru(k.kp + 'GlowR', u.glowR), a, rgb);
        glowAt(ctx, e.x, e.ty, e.r * 1.6, a * 1.4, rgb);
      }
      for (const b of W.enemyShots) if (b.glow && onView(b.x, b.y, 30) && fogLit(W, b.x, b.y)) glowAt(ctx, b.x, b.y, b.size * 6, 0.3, b.glow);
      // v95: your glowing shots light the cave round them (the Bubble Spark most of all)
      for (const b of W.bullets) if (b.light && !b.hidden && onView(b.x, b.y, 50) && fogLit(W, b.x, b.y))
        glowAt(ctx, b.x, b.y, b.lightR || 20, 0.28, b.light);
      // fire: the burning pixels brighten and throw a warm glow — only on ground you have seen
      if (W.fireVis.length) {
        ctx.fillStyle = 'rgba(255,140,50,0.32)';
        ctx.beginPath();
        for (const i of W.fireVis) {
          const x = (i % CW) * CELL, y = ((i / CW) | 0) * CELL;
          if (W.seen[clamp(Math.floor(y / FOG_U), 0, FH - 1) * FW + clamp(Math.floor(x / FOG_U), 0, FW - 1)]) ctx.rect(x, y, CELL, CELL);
        }
        ctx.fill();
        const st = Math.max(1, Math.ceil(W.fireVis.length / 24));
        for (let k = W.fireN % st; k < W.fireVis.length; k += st) {
          const i = W.fireVis[k], x = (i % CW + 0.5) * CELL, y = (((i / CW) | 0) + 0.5) * CELL;
          if (fogLit(W, x, y)) glowAt(ctx, x, y, 20, Math.min(0.14, 0.03 + W.fireVis.length / 3000) * W.flick, '255,120,40');
        }
      }
      for (const e of W.enemies)
        if (e.burn > 0 && onView(e.x, e.ty, 40) && fogLit(W, e.x, e.ty)) glowAt(ctx, e.x, e.ty, e.r * 2.4, 0.22 * W.flick, '255,130,50');
      for (const pr of W.firePlants)
        if (pr.burn && !pr.gone && onView(pr.x, pr.y + pr.len, 40) && fogLit(W, pr.x, pr.y + pr.len))
          glowAt(ctx, pr.x, pr.y + pr.len, 16, 0.2 * W.flick, '255,130,50');
      if (W.p.burn > 0 && !W.p.dead) glowAt(ctx, W.p.x + PW / 2, W.p.y + PH / 2, 22, 0.25 * W.flick, '255,130,50');
      for (const list of [W.dparts, W.amb]) for (const q of list) {
        if (!q.glow || !onView(q.x, q.y, 10) || !fogLit(W, q.x, q.y)) continue;
        ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3));
        ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.globalAlpha = 1;
      if (!W.p.dead) {
        const th = torchHand(W), gfx = th.x + (ax >= 0 ? -1 : 1) * 1.6, gfy = th.y - 11;
        glowAt(ctx, gfx, gfy, 70 * (0.9 + 0.1 * gl), 0.2 * gl, '255,150,60');            // the second light
        glowAt(ctx, gfx + W.leanX * 0.5, gfy + W.leanY * 0.5, 12, 0.5 * gl, '255,190,90');   // the halo
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const sc of W.sconces) if (scOn(sc)) drawSconce(ctx, sc.x, sc.y, W.time, sc.ph);
      if (G.RPV) return;                        // a replay frame has no HUD

      // ---- HUD ----
      // The old top-left stack (floor / enemies / health / fuel / mana / gun) is gone:
      // health, mana and fuel are the rings and top-half wipe on the thumbsticks now,
      // the floor number is written big along the shop wall, and gold sits in the deck
      // between the sticks (a DOM readout in App). Only the version is drawn up here.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cw = c.width / dpr;
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
      ctx.fillStyle = COL.muted;
      ctx.font = '500 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(VERSION, 12, 22);
      ctx.shadowBlur = 0;

      // hand the sticks the live health / fuel / mana so they can draw their gauges:
      // the green ring round the left stick, the amber fuel wipe in its top half, and
      // the gold ring round the right stick. Written every frame the loop draws.
      const MHP = maxHp(W, G);
      const gpas = held ? gunPassives(held) : null;
      // recharge / cast-delay "readiness": 1 when ready, dropping to 0 the moment it fires
      // and filling back over its own time — so the ring that spends the most time refilling
      // is the one gating your fire. Both normalise by their own max so the wipe is 0..1.
      const effRech = held ? Math.max(0.001, effRecharge(held) * W.pb.rech) : 1;
      input.current.hud = {
        hp: MHP > 0 ? Math.max(0, Math.min(1, W.p.hp / MHP)) : 0,
        low: W.p.hp <= 30,
        fuel: Math.max(0, Math.min(1, W.p.fuel)),
        empty: !!W.p.empty,
        mana: held ? Math.max(0, Math.min(1, held.mana / (held.manaMax + gpas.manaMax))) : 0,
        rech: held ? (held.rechT > 0 ? clamp(1 - held.rechT / effRech, 0, 1) : 1) : 0,
        cast: held ? (held.delayT > 0 && held.delayMax ? clamp(1 - held.delayT / held.delayMax, 0, 1) : 1) : 0,
        recharging: !!(held && held.rechT > 0),
        hasGun: !!held,
      };

      // ---- radar perks: point at the nearest enemy / mod / gun still out there ----
      if (W.pb.radarEnemy || W.pb.radarItem || W.pb.radarWand) {
        const cwv = c.width / dpr, chv = playPx / dpr, m = 18;
        const nearest = list => {
          let best = null, bd = 1e18;
          for (const t of list) { const d = (t.x - pcx) * (t.x - pcx) + ((t.ty || t.y) - pcy) * ((t.ty || t.y) - pcy); if (d < bd) { bd = d; best = t; } }
          return best;
        };
        const marker = (t, col) => {
          if (!t) return;
          const sx = (t.x - W.camX) * W.unitPx, sy = ((t.ty || t.y) - W.camY) * W.unitPx;
          if (sx > m && sx < cwv - m && sy > m && sy < chv - m) {
            ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
            ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 1; return;
          }
          const ex = clamp(sx, m, cwv - m), ey = clamp(sy, m, chv - m);
          const a = Math.atan2(sy - ey, sx - ex);
          ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
          ctx.fillStyle = col; ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-7, -6); ctx.lineTo(-7, 6); ctx.closePath(); ctx.fill();
          ctx.restore(); ctx.globalAlpha = 1;
        };
        if (W.pb.radarEnemy) marker(nearest(W.enemies), PERKS.eradar.tint);
        if (W.pb.radarItem) marker(nearest(W.pickups.filter(q => q.kind === 'mod')), '#b57cff');
        if (W.pb.radarWand) marker(nearest(W.pickups.filter(q => q.kind === 'gun')), COL.bullet);
      }

      // pickup messages
      ctx.textAlign = 'center';
      const ch = playPx / dpr;
      for (let i = 0; i < W.toasts.length; i++) {
        const tm = W.toasts[i];
        ctx.globalAlpha = Math.min(1, tm.t * 1.5);
        ctx.fillStyle = COL.text;
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.fillText(tm.text, cw / 2, ch - 18 - (W.toasts.length - 1 - i) * 19);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';

      ctx.textAlign = 'center';
      if (W.levelT < 3) {
        ctx.fillStyle = COL.text;
        ctx.globalAlpha = Math.min(1, 3 - W.levelT);
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.fillText(themeFor(W.floor).name, cw / 2, 196);
        ctx.font = '500 14px system-ui, sans-serif';
        ctx.fillText('Find the green exit at the top', cw / 2, 218);
        ctx.fillText('Buy and fit mods here, then climb', cw / 2, 236);
        ctx.globalAlpha = 1;
      }
      const msgY = 196;
      ctx.fillStyle = COL.text;
      if (W.p.dead) {
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.fillText('You were shot down', cw / 2, msgY);
        ctx.font = '500 14px system-ui, sans-serif';
        ctx.fillText('Tap the right stick to restart', cw / 2, msgY + 22);
      } else if (W.enemies.length === 0) {
        ctx.font = '700 18px system-ui, sans-serif';
        ctx.fillText('All enemies destroyed', cw / 2, msgY);
      }
      ctx.textAlign = 'left';
      ctx.shadowBlur = 0;

      // mouse reticule
      if (mouse.inside) {
        const mx = mouse.x, my = mouse.y;
        for (const [w, colr] of [[4, 'rgba(0,0,0,0.6)'], [2, mouse.down ? COL.flame2 : COL.text]]) {
          ctx.strokeStyle = colr; ctx.lineWidth = w;
          ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(mx - 15, my); ctx.lineTo(mx - 5, my);
          ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 15, my);
          ctx.moveTo(mx, my - 15); ctx.lineTo(mx, my - 5);
          ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 15);
          ctx.stroke();
        }
      }

      // ---- the map (toggled by the map button; the run is paused while it is up) ----
      // Covers the whole play area above the controls on solid black: the revealed cave as
      // white outlines, fitted and centred, with a yellow dot for you. Only outline cells the
      // fog has revealed are painted; the source is finer than the display and smooth-scaled,
      // so the walls read as continuous lines, not a scatter.
      if (input.current.mapOpen) {
        mini32.fill(0);
        for (let k = 0; k < W.miniEdgeIdx.length; k++) {
          const i = W.miniEdgeIdx[k];
          const tx = (i % MMW) * MINI_D, ty = ((i / MMW) | 0) * MINI_D;
          const fi = ((ty / FOG) | 0) * FW + ((tx / FOG) | 0);
          if (W.seen[fi]) mini32[i] = 0xe6ffffff;            // white, ~0.9 alpha
        }
        mctx.putImageData(miniImg, 0, 0);
        const pw = c.width / dpr, ph = playPx / dpr, pad = 10;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';            // a touch see-through, so the cave shows behind
        ctx.fillRect(0, 0, pw, ph);
        const k = Math.min((pw - 2 * pad) / MMW, (ph - 2 * pad) / MMH);
        const mw = MMW * k, mh = MMH * k, mx0 = (pw - mw) / 2, my0 = (ph - mh) / 2;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(miniC, 0, 0, MMW, MMH, mx0, my0, mw, mh);
        const wW = CW * CELL, wH = CH * CELL;
        const mX = x => mx0 + (x / wW) * mw, mY = y => my0 + (y / wH) * mh;
        // the prize rooms you've found: a yellow outline, crossed out once you've had the prize
        ctx.strokeStyle = '#ffd23c'; ctx.lineWidth = 1.5;
        for (const r of W.rooms) {
          if (!roomSeen(W, r)) continue;
          const x0 = mX(r.x - ROOM_HW), y0 = mY(r.y - ROOM_HH), x1 = mX(r.x + ROOM_HW), y1 = mY(r.y + ROOM_HH);
          ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
          if (r.taken) {
            const ix = (x1 - x0) * 0.25, iy = (y1 - y0) * 0.2;
            ctx.beginPath();
            ctx.moveTo(x0 + ix, y0 + iy); ctx.lineTo(x1 - ix, y1 - iy);
            ctx.moveTo(x1 - ix, y0 + iy); ctx.lineTo(x0 + ix, y1 - iy);
            ctx.stroke();
          }
        }
        // loot you've seen and left: green for mods, yellow for guns (a ring if you threw it back)
        for (const q of W.pickups) {
          if (q.taken || !fogLit(W, q.x, q.y)) continue;
          const col = q.kind === 'gun' ? '#ffd23c' : '#46e07a';
          ctx.beginPath(); ctx.arc(mX(q.x), mY(q.y), 2.6, 0, Math.PI * 2);
          if (q.old) { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); }
          else { ctx.fillStyle = col; ctx.fill(); }
        }
        // you: a bigger dot with a white rim, so it can't be mistaken for a gun
        ctx.fillStyle = '#ffd23c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mX(W.p.x + PW / 2), mY(W.p.y + PH / 2), 4, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.imageSmoothingEnabled = false;
      }
    }

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
        drawReplay(W, G, rv, draw);
      } else {
        if (!input.current.paused) { step(W, G, dt); recFrame(W, G, dt); }
        SFX.tick();
        draw();
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
