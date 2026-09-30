// @ts-check
// What draw() (render/draw.js) puts over the picture in screen space, each a part it calls in
// order with its frame object F (REFACTOR.md D19): the HUD (the version, the sticks' gauges),
// the radar perks' markers, messages, the mouse reticule and the map. A death replay stops
// before these (draw's `if (G.RPV) return;`)

import { CELL, CH, COL, CW, FOG, FW, MINI_D, MMH, MMW, PH, PW } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { PERKS } from '../../data/perks.js';
import { themeFor } from '../../data/themes.js';
import { effRecharge, gunPassives } from '../../spells/cast.js';
import { ROOM_HH, ROOM_HW } from '../../world/level.js';
import { fogLit, roomSeen } from '../systems/fog.js';
import { maxHp } from '../systems/player.js';

// The HUD, in screen space: fills in F.cw (the canvas width in css px) for the parts after it,
// writes the version top-left, and hands the sticks their gauges (G.input.current.hud)
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawHud(W, G, F) {
  const { dpr, held } = F;
  // ---- HUD ----
  // The old top-left stack (floor / enemies / health / fuel / mana / gun) is gone:
  // health, mana and fuel are the rings and top-half wipe on the thumbsticks now,
  // the floor number is written big along the shop wall, and gold sits in the deck
  // between the sticks (a DOM readout in App). Only the version is drawn up here.
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cw = F.cw = G.c.width / dpr;
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
}

// The radar perks: a ring on the nearest enemy / mod / gun, or an arrow at the screen's edge
// pointing to it
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawRadar(W, G, F) {
  const { dpr, playPx, pcx, pcy } = F;
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
}

// Messages: the toasts over the controls, the floor's name as you arrive, and the death or
// all-clear line
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawMessages(W, G, F) {
  const { dpr, playPx, cw } = F;
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
}

// The mouse reticule, while the mouse is over the canvas
/** @param {GameCtx} G */
export function drawReticule(G) {
  // mouse reticule
  if (G.mouse.inside) {
    const mx = G.mouse.x, my = G.mouse.y;
    for (const [w, colr] of [[4, 'rgba(0,0,0,0.6)'], [2, G.mouse.down ? COL.flame2 : COL.text]]) {
      // @ts-expect-error the loop's [width, colour] rows are read as a union of their elements (noise)
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
}

// The map, while it is open (the run is paused): the cave you've seen as outlines, the prize
// rooms you've found, loot you've seen, and you
/** @param {World} W @param {GameCtx} G @param {DrawFrame} F */
export function drawMap(W, G, F) {
  const { dpr, playPx } = F;
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
