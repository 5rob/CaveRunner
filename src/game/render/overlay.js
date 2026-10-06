// @ts-check
// What draw() (render/draw.js) puts over the picture in screen space, each a part it calls in
// order with its frame object F (REFACTOR.md D19): the HUD (the version, the sticks' gauges),
// the radar perks' markers, messages and the mouse reticule. A death replay stops
// before these (draw's `if (G.RPV) return;`)

import { COL } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { PERKS } from '../../data/perks.js';
import { DEV } from '../../dev/knobs.js';
import { themeFor } from '../../data/themes.js';
import { effRecharge, gunPassives } from '../../spells/cast.js';
import { REPO_ALARM, REPO_FIRE } from '../systems/vend.js';
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
    G.ctx.fillText('Find the exit pad at the top', cw / 2, 218);
    G.ctx.fillText('Clear it, then sell it back in the shop', cw / 2, 236);
    G.ctx.globalAlpha = 1;
  }
  const msgY = 196;
  // repossessed: the incineration countdown, big and red
  if (W.repo && !W.p.dead && W.repo.t >= REPO_ALARM && W.repo.t < REPO_FIRE) {
    const left = Math.ceil(REPO_FIRE - W.repo.t);
    G.ctx.fillStyle = '#ff3030';
    G.ctx.globalAlpha = 0.6 + 0.4 * (1 - ((REPO_FIRE - W.repo.t) % 1));
    G.ctx.font = '600 14px system-ui, sans-serif';
    G.ctx.fillText('INCINERATION IN', cw / 2, msgY - 44);
    G.ctx.font = '800 48px system-ui, sans-serif';
    G.ctx.fillText(String(left), cw / 2, msgY + 4);
    G.ctx.globalAlpha = 1;
  }
  G.ctx.fillStyle = COL.text;
  if (W.p.dead) {
    G.ctx.font = '700 22px system-ui, sans-serif';
    G.ctx.fillText('You were shot down', cw / 2, msgY);
    G.ctx.font = '500 14px system-ui, sans-serif';
    G.ctx.fillText('Tap the right stick to restart', cw / 2, msgY + 22);
  } else if (W.hasLvl && !W.warp && !W.repo && W.enemies.length === 0 && W.total > 0) {   // (not on a floor with none to start with: floor 2's wasteland)
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

// Aim Assist's pointer (W.p.assist, set by systems/gun.js aimAndCast): the menus' thin ring, but in
// the world, drawn over the fog so it reads in the dark. On a creature it closes round it and turns
// the torch's amber, with a dot in its middle (Dev → Aim Assist: aaSize, aaLine, aaDot)
/** @param {World} W @param {GameCtx} G */
export function drawAssist(W, G) {
  const A = W.p.assist;
  if (!A || G.RPV) return;
  const u = W.unitPx, x = (A.x - W.camX) * u, y = (A.y - W.camY) * u;
  const r0 = DEV.aaSize / 2;
  const c = G.ctx;
  c.save();
  if (A.snap) {
    const ex = (A.ex - W.camX) * u, ey = (A.ey - W.camY) * u, r = Math.max(r0 * 0.7, A.er * u + 5);
    for (const [w, col] of [[DEV.aaLine + 2, 'rgba(0,0,0,0.45)'], [DEV.aaLine, 'rgba(255,190,90,0.95)']]) {
      c.strokeStyle = String(col); c.lineWidth = Number(w);
      c.beginPath(); c.arc(ex, ey, r, 0, Math.PI * 2); c.stroke();
    }
    if (DEV.aaDot > 0) { c.fillStyle = 'rgba(255,190,90,0.95)'; c.beginPath(); c.arc(ex, ey, DEV.aaDot, 0, Math.PI * 2); c.fill(); }
  } else {
    for (const [w, col] of [[DEV.aaLine + 2, 'rgba(0,0,0,0.4)'], [DEV.aaLine, 'rgba(255,255,255,0.9)']]) {
      c.strokeStyle = String(col); c.lineWidth = Number(w);
      c.beginPath(); c.arc(x, y, r0, 0, Math.PI * 2); c.stroke();
    }
  }
  c.restore();
}
