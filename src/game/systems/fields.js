// Static fields and beams: a field cast into the world (castField, Brimstone's embers), a
// crystal's payload, and a beam walked out instantly (fireBeam); and every field at work each
// frame (stepFields, a part of step()).

import { SFX } from '../../audio/sfx.js';
import { VACUUM_WAIT } from '../../spells/mods.js';
import { FIRE_COLS, fireDouse } from '../../world/fire.js';
import { critRoll, shove } from './bullets.js';
import { damageEnemy } from './enemies.js';
import { releaseAt } from './gun.js';
import { addArc } from './lightning.js';
import { burst } from './particles.js';
import { glowDot, rnd } from './shotlooks.js';
import { dig, enemyAt, explode, solidAt } from './terrain.js';

// A beam is instant: it walks a line, damages what it touches and leaves a streak.
export function fireBeam(W, G, sh, x, y, nx, ny, bonus, pd, pc) {
  pd = pd || 1; pc = pc || 0;
  let hitAt = sh.beam;
  for (let d = 6; d <= sh.beam; d += 4) {
    const bx = x + nx * d, by = y + ny * d;
    if (sh.bore) dig(W, G, bx, by, sh.bore);
    else if (solidAt(W, bx, by)) { hitAt = d; break; }
    const j = enemyAt(W, bx, by, sh.size + 3);
    if (j >= 0) {
      damageEnemy(W, j, critRoll((sh.dmg + bonus) * pd, sh.crit + pc));
      burst(W, bx, by, 4, sh.col);
      if (sh.knock) shove(W.enemies[j], nx, ny, sh.knock);
      if (!sh.pierce) { hitAt = d; break; }
    }
  }
  W.beams.push({ x, y, nx, ny, len: hitAt, col: sh.col, w: sh.size, t: 0, look: sh.look });
  if (sh.look) {                                   // sparks off the end, and a scorched hole where it meets rock
    const ex = x + nx * hitAt, ey = y + ny * hitAt;
    for (let k = 0; k < 5; k++) glowDot(W, ex, ey, -nx * rnd(20, 80) + rnd(-50, 50), -ny * rnd(20, 80) + rnd(-50, 30),
      k ? sh.col : '#ffffff', rnd(0.8, 1.3), rnd(0.12, 0.3), 0.3);
    if (sh.pit && hitAt < sh.beam) dig(W, G, ex + nx * 2, ey + ny * 2, sh.pit);
  }
  if (sh.explode) explode(W, G, x + nx * hitAt, y + ny * hitAt, sh.explode);
  // a beam is instant, so whatever kind of carrier it is, the payload goes off at its end
  if (sh.payload && sh.payload.length) releaseAt(W, G, sh.payload, x + nx * hitAt, y + ny * hitAt, nx, ny, sh.col);
}

// Brimstone: burning sparks thrown out of the blast, lighting what they land on
export function throwEmbers(W, x, y, n) {
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 4.2, v = 60 + Math.random() * 150;
    W.dparts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 0.45,
      c: FIRE_COLS[Math.floor(Math.random() * 3)], s: 1 + Math.random() * 0.8, life: 0.7 + Math.random() * 0.6, max: 1.3,
      glow: 1, ember: 1 });
  }
}

// Static projectiles: they sit where you cast them and work over time.
export function castField(W, G, sh, x, y, ang) {
  const pay = sh.payload && sh.payload.length ? sh.payload : null;
  if (sh.field === 'explode') {
    explode(W, G, x, y, sh.r, undefined, sh.fire);
    if (sh.embers) throwEmbers(W, x, y, sh.embers);
    if (pay) releaseAt(W, G, pay, x, y, Math.cos(ang || 0), Math.sin(ang || 0), sh.col);
    return;
  }
  W.fields.push({ x, y, r: sh.r, field: sh.field, life: sh.life, max: sh.life,
    col: sh.col, dmg: sh.dmg || 1, tick: 0, payload: pay, ang: ang || 0, trig: sh.trig });
}

// a crystal "with Trigger" casts what it carries when it goes off
export const fieldPayload = (W, G, f) => {
  if (!f.payload) return;
  const list = f.payload; f.payload = null;
  releaseAt(W, G, list, f.x, f.y, Math.cos(f.ang), Math.sin(f.ang), f.col);
};

// ---- static fields (a part of step) ----
// Every field of yours at work, one frame (each kind by its field: Stillness and the storm
// put fire out, mines and dormant crystals go off, shields eat shots, heal, lightning,
// Vacuum Field's warp, glitter), then the beams fading.
export function stepFields(W, G, F) {
  const { dt, MHP, pcx, pcy } = F;
  for (let i = W.fields.length - 1; i >= 0; i--) {
    const f = W.fields[i];
    f.life -= dt; f.tick -= dt;
    const near = j => Math.hypot(W.enemies[j].x - f.x, W.enemies[j].ty - f.y) < f.r;
    if (f.field === 'slow' || f.field === 'storm') {
      // Stillness frosts and the thundercloud's rain soaks: any fire under them goes out
      if ((f.dT = (f.dT || 0) - dt) <= 0) { f.dT = 0.15;
        if (fireDouse(W.fire, f.x, f.y, f.r) && Math.random() < 0.5) SFX.fx('steam', f.x, f.y);
        for (const e of W.enemies) if (e.burn > 0 && Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.burn = 0;
        if (W.p.burn > 0 && Math.hypot(pcx - f.x, pcy - f.y) < f.r) W.p.burn = 0; }
      if (f.field === 'slow' && Math.random() < dt * 14) { const a = Math.random() * 6.283, r = Math.random() * f.r;
        glowDot(W, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, rnd(-4, 4), rnd(4, 12), Math.random() < 0.5 ? '#ffffff' : '#bfe8ff', rnd(0.7, 1.1), rnd(0.4, 0.9)); }
    }
    if (f.field === 'heal' && Math.random() < dt * 10) { const a = Math.random() * 6.283, r = Math.random() * f.r;
      glowDot(W, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 0, rnd(-18, -8), Math.random() < 0.5 ? '#9dff9a' : '#46c48c', rnd(0.8, 1.2), rnd(0.4, 0.8)); }
    if (f.field === 'mine') {
      f.near = W.enemies.some(e => Math.hypot(e.x - f.x, e.ty - f.y) < f.r * 2.2);
      let trip = f.life <= 0;
      for (let j = 0; j < W.enemies.length && !trip; j++) if (near(j)) trip = true;
      if (trip) { explode(W, G, f.x, f.y, f.r); fieldPayload(W, G, f); W.fields.splice(i, 1); continue; }
    } else if (f.field === 'dormant') {
      // set off by any blast of yours, which is the whole point of it
      for (const fl of W.flashes) {
        if (Math.hypot(fl.x - f.x, fl.y - f.y) < fl.r + f.r * 0.5) {
          explode(W, G, f.x, f.y, f.r * 1.6); fieldPayload(W, G, f); W.fields.splice(i, 1); f.life = -1; break;
        }
      }
      if (f.life < 0) continue;
    } else if (f.field === 'slow') {
      for (const e of W.enemies) if (Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.chill = 0.2;
    } else if (f.field === 'shield') {
      for (let k = W.enemyShots.length - 1; k >= 0; k--) {
        const b = W.enemyShots[k];
        if (Math.hypot(b.x - f.x, b.y - f.y) < f.r) { burst(W, b.x, b.y, 3, f.col); SFX.fx('absorb', b.x, b.y); W.enemyShots.splice(k, 1); }
      }
    } else if (f.field === 'heal') {
      if (Math.hypot(pcx - f.x, pcy - f.y) < f.r && W.p.hp < MHP && f.tick <= 0) {
        f.tick = 0.4; W.p.hp = Math.min(MHP, W.p.hp + 4 * W.pb.heal); G.input.current.notify(); SFX.fx('healtick');
      }
    } else if (f.field === 'storm') {
      if (f.tick <= 0) {
        f.tick = 0.22;
        const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
        const sx = f.x + Math.cos(a) * rr, sy = f.y + Math.sin(a) * rr;
        for (let j = W.enemies.length - 1; j >= 0; j--)
          if (Math.hypot(W.enemies[j].x - sx, W.enemies[j].ty - sy) < 22) damageEnemy(W, j, 2);
        burst(W, sx, sy, 6, '#a8e4ff');
        addArc(W, [{ x: sx + rnd(-8, 8), y: f.y - f.r * 0.85 }, { x: sx, y: sy }], '#a8e4ff', 1.2, 0.14);   // down from the cloud
        SFX.arc(sx, sy, true);
      }
    } else if (f.field === 'vacuum') {
      // Noita's Vacuum Field: a blink after it appears, everything in reach is warped
      // straight to the middle, through walls — creatures, shots (theirs and yours),
      // gold and loot. Once, then it's gone.
      if (!f.done && f.max - f.life >= VACUUM_WAIT) {
        f.done = true;
        const inR = (x, y) => Math.hypot(x - f.x, y - f.y) < f.r;
        for (const e of W.enemies) if (inR(e.x, e.ty)) { e.y += f.y - e.ty; e.x = f.x; e.tgt = null; }
        for (const b of W.bullets) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
        for (const b of W.enemyShots) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
        for (const g of W.coins) if (inR(g.x, g.y)) { g.x = f.x; g.y = f.y; }
        for (const q of W.pickups) if (!q.taken && inR(q.x, q.y)) { q.x = f.x; q.y = f.y; }
        burst(W, f.x, f.y, 14, f.col);
        SFX.fx('warp', f.x, f.y);
      }
    } else if (f.field === 'glitter') {
      if (f.tick <= 0) {
        f.tick = 0.16;
        const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
        explode(W, G, f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, 9);
      }
    }
    if (f.life <= 0) W.fields.splice(i, 1);
  }
  for (let i = W.beams.length - 1; i >= 0; i--) if ((W.beams[i].t += dt) > 0.12) W.beams.splice(i, 1);
}
