// One frame of the picture: draw(W, G). Game's loop runs it every frame (after step(), unless
// paused), and the death replay (drawReplay, systems/recorder.js) runs it with a recorded moment
// swapped into W. Moved whole out of Game in P3.4; REFACTOR.md plans its split into layers.
// It is not only a picture, so keep its order: it draws from the sim's Math.random stream,
// writes the fog memory (fogReveal) and moves the camera.

import {
  CELL, CH, COL, CW, FOG, FW, MINI_D, MMH, MMW, PH, PW, VIEW_MIN_H, VIEW_W, WH, WW
} from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { PERKS } from '../../data/perks.js';
import { themeFor } from '../../data/themes.js';
import { DEV } from '../../dev/knobs.js';
import { effRecharge, gunPassives } from '../../spells/cast.js';
import { ROOM_HH, ROOM_HW } from '../../world/level.js';
import { fogLit, roomSeen } from '../systems/fog.js';
import { maxHp } from '../systems/player.js';
import { drawAim, drawEnemies, drawJetFlame, drawPlayer, drawSilk } from './actors.js';
import {
  drawArrival, drawLoot, drawPortal, drawProps, drawRooms, drawShop, drawTerrain
} from './cave.js';
import { drawFlashes, drawMotes, drawSmoke, drawSparks, drawTrail } from './effects.js';
import { drawFog, drawGlows } from './light.js';
import { drawBeams, drawFields, drawShots } from './looks.js';

export function draw(W, G) {
  // the frame: what draw's parts hand on to each other (REFACTOR.md D19). drawCamera fills
  // in the view and where you are, drawProps the theme (TH) and onView, drawAim the gun in
  // hand and the aim
  const F = { dpr: 0, playPx: 0, vw: 0, vh: 0, pcx: 0, pcy: 0, TH: null, onView: null, held: null, ax: 0, ay: 0, gy: 0 };
  drawCamera(W, G, F);                      // the view, the camera, the canvas cleared
  const { dpr, playPx, vw, vh, pcx, pcy } = F;

  drawTerrain(W, G, F);                     // background, shop wall, rock, burning pixels (cave.js)

  drawProps(W, G, F);                       // props, drips, ambience; fills TH, onView (cave.js)
  const { TH, onView } = F;

  drawPortal(W, G);                         // the exit (cave.js)

  drawSmoke(W, G);                          // smoke (effects.js)

  drawFields(W, G, F);                      // static fields (looks.js)

  drawSilk(W, G);                           // spider silk (actors.js)

  drawEnemies(W, G, F);                     // the creatures (actors.js)

  drawShots(W, G);                          // shots in flight, lightning arcs (looks.js)
  drawBeams(W, G);                          // beams (looks.js)

  drawArrival(W, G, F);                     // the way in (cave.js)

  drawShop(W, G, F);                        // the shop's stock (cave.js)

  drawLoot(W, G, F);                        // gold, guns and mods lying about (cave.js)

  drawRooms(W, G, F);                       // the hidden rooms' prizes (cave.js)

  drawTrail(W, G);                          // Levitation Trail (effects.js)

  drawSparks(W, G);                         // sparks and debris (effects.js)

  drawMotes(W, G, F);                       // magic motes (effects.js)

  drawFlashes(W, G);                        // explosion flashes (effects.js)

  drawJetFlame(W, G, F);                    // the jet flame (actors.js)

  drawAim(W, G, F);                         // the aim line; fills held, ax/ay, gy (actors.js)
  const { held, ax, ay, gy } = F;

  drawPlayer(W, G, F);                      // you, the gun, the torch, the crosshair, shield, ghost (actors.js)

  drawFog(W, G, F);                         // line of sight lifts the fog; torchlight and fog (light.js)

  drawGlows(W, G, F);                       // light over the fog (light.js)
  if (G.RPV) return;                        // a replay frame has no HUD

  // ---- HUD ----
  // The old top-left stack (floor / enemies / health / fuel / mana / gun) is gone:
  // health, mana and fuel are the rings and top-half wipe on the thumbsticks now,
  // the floor number is written big along the shop wall, and gold sits in the deck
  // between the sticks (a DOM readout in App). Only the version is drawn up here.
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cw = G.c.width / dpr;
  G.ctx.shadowColor = 'rgba(0,0,0,0.6)'; G.ctx.shadowBlur = 3;
  G.ctx.fillStyle = COL.muted;
  G.ctx.font = '500 12px system-ui, sans-serif';
  G.ctx.textAlign = 'left';
  G.ctx.fillText(VERSION, 12, 22);
  G.ctx.shadowBlur = 0;

  // hand the sticks the live health / fuel / mana so they can draw their gauges:
  // the green ring round the left stick, the amber fuel wipe in its top half, and
  // the gold ring round the right stick. Written every frame the loop draws.
  const MHP = maxHp(W, G);
  const gpas = held ? gunPassives(held) : null;
  // recharge / cast-delay "readiness": 1 when ready, dropping to 0 the moment it fires
  // and filling back over its own time — so the ring that spends the most time refilling
  // is the one gating your fire. Both normalise by their own max so the wipe is 0..1.
  const effRech = held ? Math.max(0.001, effRecharge(held) * W.pb.rech) : 1;
  G.input.current.hud = {
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
    const cwv = G.c.width / dpr, chv = playPx / dpr, m = 18;
    const nearest = list => {
      let best = null, bd = 1e18;
      for (const t of list) { const d = (t.x - pcx) * (t.x - pcx) + ((t.ty || t.y) - pcy) * ((t.ty || t.y) - pcy); if (d < bd) { bd = d; best = t; } }
      return best;
    };
    const marker = (t, col) => {
      if (!t) return;
      const sx = (t.x - W.camX) * W.unitPx, sy = ((t.ty || t.y) - W.camY) * W.unitPx;
      if (sx > m && sx < cwv - m && sy > m && sy < chv - m) {
        G.ctx.strokeStyle = col; G.ctx.lineWidth = 2; G.ctx.globalAlpha = 0.85;
        G.ctx.beginPath(); G.ctx.arc(sx, sy, 11, 0, Math.PI * 2); G.ctx.stroke();
        G.ctx.globalAlpha = 1; return;
      }
      const ex = clamp(sx, m, cwv - m), ey = clamp(sy, m, chv - m);
      const a = Math.atan2(sy - ey, sx - ex);
      G.ctx.save(); G.ctx.translate(ex, ey); G.ctx.rotate(a);
      G.ctx.fillStyle = col; G.ctx.globalAlpha = 0.9;
      G.ctx.beginPath(); G.ctx.moveTo(9, 0); G.ctx.lineTo(-7, -6); G.ctx.lineTo(-7, 6); G.ctx.closePath(); G.ctx.fill();
      G.ctx.restore(); G.ctx.globalAlpha = 1;
    };
    if (W.pb.radarEnemy) marker(nearest(W.enemies), PERKS.eradar.tint);
    if (W.pb.radarItem) marker(nearest(W.pickups.filter(q => q.kind === 'mod')), '#b57cff');
    if (W.pb.radarWand) marker(nearest(W.pickups.filter(q => q.kind === 'gun')), COL.bullet);
  }

  // pickup messages
  G.ctx.textAlign = 'center';
  const ch = playPx / dpr;
  for (let i = 0; i < W.toasts.length; i++) {
    const tm = W.toasts[i];
    G.ctx.globalAlpha = Math.min(1, tm.t * 1.5);
    G.ctx.fillStyle = COL.text;
    G.ctx.font = '600 14px system-ui, sans-serif';
    G.ctx.fillText(tm.text, cw / 2, ch - 18 - (W.toasts.length - 1 - i) * 19);
  }
  G.ctx.globalAlpha = 1;
  G.ctx.textAlign = 'left';

  G.ctx.textAlign = 'center';
  if (W.levelT < 3) {
    G.ctx.fillStyle = COL.text;
    G.ctx.globalAlpha = Math.min(1, 3 - W.levelT);
    G.ctx.font = '700 22px system-ui, sans-serif';
    G.ctx.fillText(themeFor(W.floor).name, cw / 2, 196);
    G.ctx.font = '500 14px system-ui, sans-serif';
    G.ctx.fillText('Find the green exit at the top', cw / 2, 218);
    G.ctx.fillText('Buy and fit mods here, then climb', cw / 2, 236);
    G.ctx.globalAlpha = 1;
  }
  const msgY = 196;
  G.ctx.fillStyle = COL.text;
  if (W.p.dead) {
    G.ctx.font = '700 22px system-ui, sans-serif';
    G.ctx.fillText('You were shot down', cw / 2, msgY);
    G.ctx.font = '500 14px system-ui, sans-serif';
    G.ctx.fillText('Tap the right stick to restart', cw / 2, msgY + 22);
  } else if (W.enemies.length === 0) {
    G.ctx.font = '700 18px system-ui, sans-serif';
    G.ctx.fillText('All enemies destroyed', cw / 2, msgY);
  }
  G.ctx.textAlign = 'left';
  G.ctx.shadowBlur = 0;

  // mouse reticule
  if (G.mouse.inside) {
    const mx = G.mouse.x, my = G.mouse.y;
    for (const [w, colr] of [[4, 'rgba(0,0,0,0.6)'], [2, G.mouse.down ? COL.flame2 : COL.text]]) {
      G.ctx.strokeStyle = colr; G.ctx.lineWidth = w;
      G.ctx.beginPath(); G.ctx.arc(mx, my, 9, 0, Math.PI * 2); G.ctx.stroke();
      G.ctx.beginPath();
      G.ctx.moveTo(mx - 15, my); G.ctx.lineTo(mx - 5, my);
      G.ctx.moveTo(mx + 5, my); G.ctx.lineTo(mx + 15, my);
      G.ctx.moveTo(mx, my - 15); G.ctx.lineTo(mx, my - 5);
      G.ctx.moveTo(mx, my + 5); G.ctx.lineTo(mx, my + 15);
      G.ctx.stroke();
    }
  }

  // ---- the map (toggled by the map button; the run is paused while it is up) ----
  // Covers the whole play area above the controls on solid black: the revealed cave as
  // white outlines, fitted and centred, with a yellow dot for you. Only outline cells the
  // fog has revealed are painted; the source is finer than the display and smooth-scaled,
  // so the walls read as continuous lines, not a scatter.
  if (G.input.current.mapOpen) {
    G.mini32.fill(0);
    for (let k = 0; k < W.miniEdgeIdx.length; k++) {
      const i = W.miniEdgeIdx[k];
      const tx = (i % MMW) * MINI_D, ty = ((i / MMW) | 0) * MINI_D;
      const fi = ((ty / FOG) | 0) * FW + ((tx / FOG) | 0);
      if (W.seen[fi]) G.mini32[i] = 0xe6ffffff;            // white, ~0.9 alpha
    }
    G.mctx.putImageData(G.miniImg, 0, 0);
    const pw = G.c.width / dpr, ph = playPx / dpr, pad = 10;
    G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.ctx.fillStyle = 'rgba(0,0,0,0.8)';            // a touch see-through, so the cave shows behind
    G.ctx.fillRect(0, 0, pw, ph);
    const k = Math.min((pw - 2 * pad) / MMW, (ph - 2 * pad) / MMH);
    const mw = MMW * k, mh = MMH * k, mx0 = (pw - mw) / 2, my0 = (ph - mh) / 2;
    G.ctx.imageSmoothingEnabled = true;
    G.ctx.drawImage(G.miniC, 0, 0, MMW, MMH, mx0, my0, mw, mh);
    const wW = CW * CELL, wH = CH * CELL;
    const mX = x => mx0 + (x / wW) * mw, mY = y => my0 + (y / wH) * mh;
    // the prize rooms you've found: a yellow outline, crossed out once you've had the prize
    G.ctx.strokeStyle = '#ffd23c'; G.ctx.lineWidth = 1.5;
    for (const r of W.rooms) {
      if (!roomSeen(W, r)) continue;
      const x0 = mX(r.x - ROOM_HW), y0 = mY(r.y - ROOM_HH), x1 = mX(r.x + ROOM_HW), y1 = mY(r.y + ROOM_HH);
      G.ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      if (r.taken) {
        const ix = (x1 - x0) * 0.25, iy = (y1 - y0) * 0.2;
        G.ctx.beginPath();
        G.ctx.moveTo(x0 + ix, y0 + iy); G.ctx.lineTo(x1 - ix, y1 - iy);
        G.ctx.moveTo(x1 - ix, y0 + iy); G.ctx.lineTo(x0 + ix, y1 - iy);
        G.ctx.stroke();
      }
    }
    // loot you've seen and left: green for mods, yellow for guns (a ring if you threw it back)
    for (const q of W.pickups) {
      if (q.taken || !fogLit(W, q.x, q.y)) continue;
      const col = q.kind === 'gun' ? '#ffd23c' : '#46e07a';
      G.ctx.beginPath(); G.ctx.arc(mX(q.x), mY(q.y), 2.6, 0, Math.PI * 2);
      if (q.old) { G.ctx.strokeStyle = col; G.ctx.lineWidth = 1.2; G.ctx.stroke(); }
      else { G.ctx.fillStyle = col; G.ctx.fill(); }
    }
    // you: a bigger dot with a white rim, so it can't be mistaken for a gun
    G.ctx.fillStyle = '#ffd23c'; G.ctx.strokeStyle = '#fff'; G.ctx.lineWidth = 1.5;
    G.ctx.beginPath();
    G.ctx.arc(mX(W.p.x + PW / 2), mY(W.p.y + PH / 2), 4, 0, Math.PI * 2);
    G.ctx.fill(); G.ctx.stroke();
    G.ctx.imageSmoothingEnabled = false;
  }
}

// The view for this frame (F.dpr, F.playPx: the play area above the controls, F.vw/F.vh: the
// view in world units, F.pcx/F.pcy: your centre), the camera eased toward you (a replay's
// is the viewer's), and the canvas cleared to the floor's colour under the world's transform
export function drawCamera(W, G, F) {
  const dpr = F.dpr = window.devicePixelRatio || 1;
  // the controls overlay the bottom of the canvas (see-through), so the play area is the
  // part above them: scale and frame to that, but still draw (and cull) the full canvas
  const ctlPx = Math.min(G.c.height * 0.8, (G.RPV ? G.RPV.panelH || 0 : G.input.current.ctlH || 0) * dpr);   // a replay: its panel
  const playPx = F.playPx = G.c.height - ctlPx;
  const s = Math.min(G.c.width / VIEW_W, playPx / VIEW_MIN_H) * DEV.zoom * (G.RPV ? G.RPV.zoom : 1), vw = F.vw = G.c.width / s, vh = F.vh = G.c.height / s;
  const vhp = playPx / s;
  W.unitPx = s / dpr;
  const pcx = F.pcx = W.p.x + PW / 2, pcy = F.pcy = W.p.y + PH / 2;

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

  G.ctx.setTransform(1, 0, 0, 1, 0, 0);
  G.ctx.imageSmoothingEnabled = false;
  G.ctx.fillStyle = 'rgb(' + themeFor(W.floor).bg.join(',') + ')';
  G.ctx.fillRect(0, 0, G.c.width, G.c.height);
  G.ctx.setTransform(s, 0, 0, s, -Math.round(W.camX * s), -Math.round(W.camY * s));
}
