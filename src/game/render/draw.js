// @ts-check
// One frame of the picture: draw(W, G). Game's loop runs it every frame (after step(), unless
// paused), and the death replay (drawReplay, systems/recorder.js) runs it with a recorded moment
// swapped into W. It calls its parts one after another, back to front, handing each the frame
// object F (REFACTOR.md D19); the parts live in render/ by theme: cave.js (the rock and what
// sits on it), effects.js (particles), actors.js (creatures and you), looks.js (shots and
// fields), light.js (the fog and the light over it), overlay.js (HUD, messages), guide.js (a new
// run's guide hologram); and
// the spider's silk (drawSilk) with the spider, in game/creatures/spider.js.
// drawCamera, the frame's own part, is here.
// It is not only a picture, so keep its order: it draws from the sim's Math.random stream,
// writes the fog memory (fogReveal, in drawFog) and moves the camera (drawCamera).

import { PH, PW, VIEW_MIN_H, VIEW_W, WH, WW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { themeFor } from '../../data/themes.js';
import { DEV, carrotAt } from '../../dev/knobs.js';
import { drawSilk } from '../creatures/spider.js';
import { drawAim, drawEnemies, drawJetFlame, drawPlayer } from './actors.js';
import {
  drawArrival, drawLoot, drawPortal, drawProps, drawRooms, drawShop, drawTerrain
} from './cave.js';
import { drawFlashes, drawMotes, drawSmoke, drawSparks, drawTrail } from './effects.js';
import { drawBelow, drawFx } from './fx.js';
import { drawGuide, drawGuideTalk } from './guide.js';
import { drawFog, drawGlows } from './light.js';
import { drawBeams, drawFields, drawShots } from './looks.js';
import { drawHud, drawMessages, drawRadar, drawReticule } from './overlay.js';
import { drawPads } from './pads.js';
import { drawShops } from './shops.js';
import { drawTubes } from './shoplights.js';
import { drawRepo, drawVend, drawWarp } from './vend.js';

/** @param {World} W @param {GameCtx} G */
export function draw(W, G) {
  // the frame: what draw's parts hand on to each other (REFACTOR.md D19). drawCamera fills in
  // the view (dpr, playPx, vw/vh) and where you are (pcx/pcy), drawProps the theme (TH) and
  // onView, drawAim the gun in hand (held), the aim (ax/ay) and the gun's height (gy), drawHud
  // the canvas width in css px (cw)
  const F = { dpr: 0, playPx: 0, vw: 0, vh: 0, pcx: 0, pcy: 0, TH: null, onView: null, held: null, ax: 0, ay: 0,
    gy: 0, cw: 0, snapX: 0, snapY: 0 };
  drawCamera(W, G, F);                      // the view, the camera, the canvas cleared; fills dpr … pcy
  drawTerrain(W, G, F);                     // background, shop wall, rock, burning pixels (cave.js)
  drawProps(W, G, F);                       // props, drips, ambience; fills TH, onView (cave.js)
  drawPortal(W, G);                         // the exit (cave.js)
  drawSmoke(W, G);                          // smoke (effects.js)
  drawFields(W, G, F);                      // static fields (looks.js)
  drawSilk(W, G);                           // spider silk (game/creatures/spider.js)
  drawEnemies(W, G, F);                     // the creatures (actors.js)
  drawShots(W, G);                          // shots in flight, lightning arcs (looks.js)
  drawBeams(W, G);                          // beams (looks.js)
  drawArrival(W, G, F);                     // the way in (cave.js)
  drawShop(W, G, F);                        // the shop's stock (cave.js)
  drawVend(W, G, F);                        // the level vending machines (vend.js)
  drawShops(W, G, F);                       // the shop's vending machines (shops.js)
  drawGuide(W, G, F);                       // a new run's guide hologram (guide.js)
  drawLoot(W, G, F);                        // gold, guns and mods lying about (cave.js)
  drawRooms(W, G, F);                       // the hidden rooms' prizes (cave.js)
  drawTrail(W, G);                          // Levitation Trail (effects.js)
  drawSparks(W, G);                         // sparks and debris (effects.js)
  drawMotes(W, G, F);                       // magic motes (effects.js)
  drawFlashes(W, G);                        // explosion flashes (effects.js)
  G.ctx.translate(F.snapX, F.snapY);        // you, steady on screen (see drawCamera)
  drawJetFlame(W, G, F);                    // the jet flame (actors.js)
  drawAim(W, G, F);                         // the aim line; fills held, ax/ay, gy (actors.js)
  drawPlayer(W, G, F);                      // you, gun, torch, crosshair, shield, ghost (actors.js)
  G.ctx.translate(-F.snapX, -F.snapY);
  drawFog(W, G, F);                         // line of sight lifts the fog; the fog (light.js)
  drawGlows(W, G, F);                       // light over the fog (light.js)
  drawTubes(W, G, F);                       // the shop's ceiling tubes and their light (shoplights.js)
  drawPads(W, G, F);                        // the teleporter pads' beams and lightning (pads.js)
  drawWarp(W, G, F);                        // a level teleporting in or out: flash, crackle (vend.js)
  drawRepo(W, G, F);                        // repossessed: red lights, then the fire jets (vend.js)
  drawFx(W, G, F);                          // the FX layer: the hologram's bloom (fx.js)
  drawBelow(W, G, F);                       // black below the shop floor (fx.js)
  if (G.RPV) return;                        // a replay frame has no HUD
  drawHud(W, G, F);                         // the version, the sticks' gauges; fills cw (overlay.js)
  drawRadar(W, G, F);                       // radar perks (overlay.js)
  drawMessages(W, G, F);                    // toasts, the floor name, death / all clear (overlay.js)
  drawGuideTalk(W, G, F);                   // the guide's speech box (guide.js)
  drawReticule(G);                          // the mouse reticule (overlay.js)
}

// The view for this frame (F.dpr, F.playPx: the play area above the controls, F.vw/F.vh: the
// view in world units, F.pcx/F.pcy: your centre), the camera eased toward you (a replay's
// is the viewer's), and the canvas cleared to the floor's colour under the world's transform
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawCamera(W, G, F) {
  const dpr = F.dpr = window.devicePixelRatio || 1;
  // the controls overlay the bottom of the canvas (see-through), so the play area is the
  // part above them: scale and frame to that, but still draw (and cull) the full canvas
  const ctlPx = Math.min(G.c.height * 0.8, (G.RPV ? (G.RPV.full ? 0 : G.RPV.panelH || 0) : G.input.current.ctlH || 0) * dpr);   // a replay: its panel
  const playPx = F.playPx = G.c.height - ctlPx;
  // the Carrot stat pulls the live camera back (a replay keeps the viewer's own zoom)
  const s = Math.min(G.c.width / VIEW_W, playPx / VIEW_MIN_H) * DEV.zoom * (G.RPV ? G.RPV.zoom : 1 / carrotAt('caCam', W.pb.carrot)), vw = F.vw = G.c.width / s, vh = F.vh = G.c.height / s;
  const vhp = playPx / s;
  W.unitPx = s / dpr;
  const pcx = F.pcx = W.p.x + PW / 2, pcy = F.pcy = W.p.y + PH / 2;

  // camera (a replay's is wherever the viewer has dragged it, or on you)
  if (G.RPV) {
    if (G.RPV.follow) {                     // framed on you like the live camera, then kept as the centre
      G.RPV.cx = vw >= WW ? WW / 2 : clamp(G.RPV.cx - vw / 2, 0, WW - vw) + vw / 2;
      G.RPV.cy = clamp(G.RPV.cy - vhp * 0.55, 0, Math.max(0, WH - vhp)) + vhp / 2;
    }
    W.camX = G.RPV.cx - vw / 2; W.camY = G.RPV.cy - vhp / 2; G.RPV.unit = W.unitPx; G.RPV.playPx = playPx;
  } else {
    const tx = vw >= WW ? (WW - vw) / 2 : clamp(pcx - vw / 2, 0, WW - vw);
    const ty = clamp(pcy - vhp * 0.55, 0, Math.max(0, WH - vhp));
    if (!W.camReady) { W.camX = tx; W.camY = ty; W.camReady = true; W.camT = W.time; }
    // eased by the sim's clock, not per frame: 15% of the way each 60th of a second. Per frame,
    // how far it trailed you hung on each frame's length, so an uneven frame jerked you on screen
    const cdt = clamp(W.time - W.camT, 0, 0.1);
    W.camT = W.time;
    const ease = 1 - Math.pow(0.85, cdt * 60);
    W.camX += (tx - W.camX) * ease;
    W.camY += (ty - W.camY) * ease;
  }

  G.ctx.setTransform(1, 0, 0, 1, 0, 0);
  G.ctx.imageSmoothingEnabled = false;
  G.ctx.fillStyle = 'rgb(' + themeFor(W.floor).bg.join(',') + ')';
  G.ctx.fillRect(0, 0, G.c.width, G.c.height);
  const ox = Math.round(W.camX * s), oy = Math.round(W.camY * s);
  G.ctx.setTransform(s, 0, 0, s, -ox, -oy);
  // the world sits on whole pixels, so you'd hop a pixel against the screen as the rounding
  // flips: this nudge (under a pixel) puts you where your distance from the camera says
  F.snapX = (Math.round((W.p.x - W.camX) * s) + ox) / s - W.p.x;
  F.snapY = (Math.round((W.p.y - W.camY) * s) + oy) / s - W.p.y;
}
