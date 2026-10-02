// @ts-check
// The level's props (see DECOR in data/themes.js) at work, once a frame (decorStep): anchors,
// falling and landing, shooting them, drips, plants and web lines under the player (zfx),
// and what happens when one is blown up, shattered or a lantern pops.

import { VENT_H, propCol } from '../../art/props.js';
import { rustleStep } from '../../audio/recipes.js';
import { SFX } from '../../audio/sfx.js';
import { CELL, CH, CW, GRAVITY, PH, PW, WEB_HAND, WH } from '../../core/consts.js';
import { clamp } from '../../core/util.js';
import { HUNTERS } from '../../data/creatures.js';
import { themeFor } from '../../data/themes.js';
import { DEV, kr, spr } from '../../dev/knobs.js';
import { PLANTS, PROP_DMG, archNear, propAnchored } from '../../world/decorate.js';
import { FIRE_COLS } from '../../world/fire.js';
import { bendAwake, bendPush, bendStep, hangRootX, hangRootY, hangX, swingStep, swings, webNearU } from '../../world/sway.js';
import { stepAmbience } from './ambience.js';
import { damageEnemy } from './enemies.js';
import { ignite, setAlight, youAlight } from './fire.js';
import { burst } from './particles.js';
import { hurt } from './player.js';
import { explode, lineOfSight, solidAt } from './terrain.js';
import { webDist } from './webs.js';

/** @param {World} W @param {GameCtx} G @param {Prop} pr */
export function blowProp(W, G, pr) {
  if (pr.gone) return;
  pr.gone = true;                          // first, so a chain of blasts can't loop
  if (pr.k === 'barrel') { explode(W, G, pr.x, pr.y - 6, 105, undefined, 1); SFX.debris(pr.x, pr.y - 6); }
  else if (pr.k === 'pod') {
    SFX.pop(pr.x, pr.y - 6);
    W.clouds.push({ x: pr.x, y: pr.y - 8, r: 34, life: 4.5, max: 4.5, tick: 0 });
    burst(W, pr.x, pr.y - 6, 14, '#b6e36a');
  }
}

// ---- decoration, pass 3: the props at work ----
/** @param {World} W @param {Prop} pr @param {number} pad */
// (a hanging vine is where its swing, and the arch it hangs off, have carried it at your height)
export const pOver = (W, pr, pad) => {
  const sx = pr.sw || pr.on ? hangX(pr, W.p.y + PH / 2) : 0, sy = pr.on ? hangRootY(pr) : 0;
  return W.p.x + PW > pr.x + sx + pr.l - pad && W.p.x < pr.x + sx + pr.r + pad &&
    W.p.y + PH > pr.y + sy + pr.t0 - pad && W.p.y < pr.y + sy + pr.b + pad;
};
// A line that gives (a web line, an arched vine: world/sway.js), once a frame: held, it dips under
// you at your hands (u along it), with a bounce from how fast you grabbed it; let go or pushed,
// it springs back and sleeps once still
/** @param {World} W @param {Prop | WebLine} o @param {boolean} held @param {number} u @param {number} dt */
function lineSway(W, o, held, u, dt) {
  if (held) {
    if (!o.wh) { o.wvx = (o.wvx || 0) + W.p.vx * DEV.bendGrab; o.wvy = (o.wvy || 0) + W.p.vy * DEV.bendGrab; }
    o.wu = clamp(u, 0.05, 0.95);
  }
  o.wh = held;
  if (held || bendAwake(o)) bendStep(o, 0, held ? DEV.bendDip : 0, DEV.bendK, DEV.bendDamp, DEV.bendMax, dt);
}
// a loud noise: every creature within earshot comes looking, and shooters get ready
/** @param {World} W @param {number} x @param {number} y */
export function alertAt(W, x, y) {
  W.rings.push({ x, y, t: 0 });
  for (const e of W.enemies) {
    if (Math.hypot(e.x - x, e.ty - y) > 320) continue;
    if (HUNTERS[e.k.act]) e.aggro = true;
    else e.cd = Math.min(e.cd, 0.3);
  }
}
// what a breakable prop is made of, for the sound it breaks with
export const MATERIAL = { icicle: 'ice', geode: 'crystal', salt: 'salt', bone: 'bone', obsidian: 'glass', shard: 'glass' };
/** @param {World} W @param {Prop} pr @param {number} [n] */
export function shatter(W, pr, n) {
  SFX.fx('shatter', pr.x, pr.y + (pr.t0 + pr.b) / 2, MATERIAL[pr.st] || 'stone');
  burst(W, pr.x, pr.y + (pr.t0 + pr.b) / 2, n || 10, propCol(pr, themeFor(W.floor)));
  pr.gone = true;
}
// a lantern shot (or dropped, or blasted): the glass goes and its burning oil is thrown
// out in blobs that light whatever burnable they fall through or land on
/** @param {World} W @param {GameCtx} G @param {Prop} pr */
export function popLamp(W, G, pr) {
  if (pr.gone) return;
  pr.gone = true;
  let x = pr.x, y = pr.y;
  if (pr.st === 'hanglamp') y += pr.len + 4.5; else x -= pr.side * 5;
  SFX.fx('shatter', x, y, 'glass');
  SFX.fx('whoosh', x, y);
  burst(W, x, y, 6, '#fff2c0');
  for (let k = 0; k < 16; k++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 3.4, v = 50 + Math.random() * 120;
    W.dparts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 0.45,
      c: FIRE_COLS[Math.floor(Math.random() * 3)], s: 1.2 + Math.random() * 0.9, life: 1.2 + Math.random() * 0.8, max: 2,
      glow: 1, ember: 1 });
  }
  ignite(W, G, x, y, 6, 0.8);
}
// a prop whose rock has gone hits the ground: it breaks, blows, or settles there
/** @param {World} W @param {GameCtx} G @param {Prop} pr */
export function landProp(W, G, pr) {
  pr.fall = false; pr.vy = 0;
  if (pr.k === 'barrel' || pr.k === 'pod') { blowProp(W, G, pr); return; }
  if (pr.k === 'lamp' && pr.st !== 'cap') { popLamp(W, G, pr); return; }
  const stands = !pr.hang && !pr.side && (pr.k === 'cover' || pr.k === 'pad' || pr.k === 'noise' ||
    pr.k === 'spike' || pr.k === 'lamp' || pr.k === 'tendril' || pr.k === 'vent');
  if (!stands) { shatter(W, pr); return; }
  SFX.fx('propLand', pr.x, pr.y);
  const cy = Math.floor((pr.y + pr.b + 1) / CELL);
  pr.y = cy * CELL - pr.b;
  pr.anc = [Math.floor(pr.x / CELL), cy];
}
/** @param {Prop} pr */
export function spawnDrip(pr) {
  const r = Math.random, st = pr.st;
  if (st === 'water') return { x: pr.x + (r() - 0.5) * 2, y: pr.y + 3, vx: 0, vy: 0, g: 0.9, c: '#7ec8ff', s: 1.5, life: 3, max: 3, splash: 1, snd: 'drip' };
  if (st === 'lava') return { x: pr.x + (r() - 0.5) * 2, y: pr.y + 3, vx: 0, vy: 0, g: 0.8, c: '#ff7a2a', s: 2, life: 3, max: 3, dmg: PROP_DMG.lava, glow: 1, splash: 1, snd: 'sizzle' };
  if (st === 'soot') return { x: pr.x + (r() - 0.5) * 10, y: pr.y + 1, vx: 0, vy: 12 + r() * 14, g: 0.01, c: 'rgba(16,16,20,0.8)', s: 1.3 + r(), life: 3.5, max: 3.5, wob: r() * 9 };
  if (st === 'crystal') return { x: pr.x + (r() - 0.5) * 14, y: pr.y + 2, vx: 0, vy: 6 + r() * 10, g: 0.004, c: r() < 0.5 ? '#e0b0ff' : '#b070ff', s: 1 + r() * 0.6, life: 4, max: 4, wob: r() * 9, glow: 1 };
  if (st === 'cascade') return { x: pr.x + (r() - 0.5) * 9, y: pr.y + 2, vx: (r() - 0.5) * 6, vy: 50 + r() * 40, g: 0.9, c: 'rgba(150,205,255,0.75)', s: 1.6 + r(), life: 2.5, max: 2.5, splash: 1, snd: 'splash' };
  if (st === 'steam') {
    const s = -pr.side, oil = r() < 0.15;
    return oil ? { x: pr.x + s * 8, y: pr.y + 2, vx: s * 10, vy: 0, g: 0.8, c: '#3a2c1a', s: 1.6, life: 2, max: 2 }
      : { x: pr.x + s * 9, y: pr.y, vx: s * (40 + r() * 40), vy: -8 - r() * 20, g: -0.01, c: 'rgba(220,226,232,0.45)', s: 2 + r() * 2, life: 1.1, max: 1.1, grow: 1 };
  }
}
export const DRIP_RATE = { water: 0.7, lava: 1.1, soot: 6, crystal: 3, cascade: 45, steam: 10 };

/** @param {World} W @param {GameCtx} G @param {number} dt @param {number} pcx @param {number} pcy */
export function decorStep(W, G, dt, pcx, pcy) {
  W.decoFrame++;
  W.plantsNow.clear();
  const z = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
  // the runtime anchor check, staggered: a thirtieth of the props each frame, so each one
  // finds out within half a second that the rock it hung off has been blown away
  for (let i = W.decoFrame % 30; i < W.props.length; i += 30) {
    const pr = W.props[i];
    if (!pr.gone && !pr.fall && (pr.anc || pr.on) && !propAnchored(pr, W.mat)) { pr.fall = true; pr.vy = 0; pr.anc = null; pr.on = null; }
  }
  for (let i = W.props.length - 1; i >= 0; i--) {
    const pr = W.props[i];
    if (pr.gone) { W.props.splice(i, 1); continue; }
    if (pr.fall) {                           // physics hand-off: it drops
      pr.vy = Math.min(pr.vy + GRAVITY * 0.8 * dt, 700);
      pr.y += pr.vy * dt;
      if (pr.y > WH) { pr.gone = true; continue; }
      if (pr.vy > 120 && (pr.k === 'drop' || pr.k === 'spike' || pr.k === 'cover' || pr.k === 'noise')) {
        if (!W.p.dead && pOver(W, pr, 0)) { hurt(W, G, PROP_DMG.drop); shatter(W, pr, 14); continue; }
        for (let j = W.enemies.length - 1; j >= 0; j--) {
          const e = W.enemies[j];
          if (Math.abs(e.x - pr.x) < e.r + 4 && Math.abs(e.ty - (pr.y + pr.b)) < e.r + 4) { damageEnemy(W, j, 4); shatter(W, pr, 14); break; }
        }
        if (pr.gone) continue;
      }
      if (solidAt(W, pr.x, pr.y + pr.b + 1)) landProp(W, G, pr);
      continue;
    }
    if (Math.abs(pr.y - pcy) > 520) continue;     // only what's round you does anything
    pr.cd = (pr.cd || 0) - dt;
    if (pr.hitT > 0) pr.hitT -= dt;
    // shots: cover eats them, and carts, pods, stones, salt spikes and pillars feel them
    const tough = pr.k === 'cover', feels = tough || pr.k === 'barrel' || pr.k === 'pod' ||
      (pr.k === 'noise' && pr.st === 'stone') || (pr.k === 'spike' && pr.st === 'salt') || (pr.k === 'lamp' && pr.st !== 'cap');
    if (feels) {
      const x0 = pr.x + pr.l, x1 = pr.x + pr.r, y0 = pr.y + pr.t0, y1 = pr.y + pr.b;
      for (const b of W.bullets) {
        if (b.life <= 0 || b.x + b.size < x0 || b.x - b.size > x1 || b.y + b.size < y0 || b.y - b.size > y1) continue;
        if (b.pull || b.eat || b.bore) {          // rolls on through, but only counts once
          const seen = b.propHit || (b.propHit = new Set());
          if (!seen.has(pr)) { seen.add(pr); pr.hurt = (pr.hurt || 0) + 1; }
        } else { pr.hurt = (pr.hurt || 0) + 1; burst(W, b.x, b.y, 3, b.col); b.life = 0; b.struck = 1; }
      }
      if (tough) for (let k = W.enemyShots.length - 1; k >= 0; k--) {
        const es = W.enemyShots[k];
        if (es.x > x0 && es.x < x1 && es.y > y0 && es.y < y1) { burst(W, es.x, es.y, 3, es.col); SFX.fx('coverHit', es.x, es.y); W.enemyShots.splice(k, 1); }
      }
    }
    if (pr.hurt) {
      const n = pr.hurt; pr.hurt = 0;
      if (pr.k === 'barrel' || pr.k === 'pod') { blowProp(W, G, pr); continue; }
      if (pr.k === 'lamp') { popLamp(W, G, pr); continue; }
      if (pr.k === 'noise' && pr.st === 'stone') { alertAt(W, pr.x, pr.y); pr.ring = 1; SFX.fx('resonate', pr.x, pr.y); }
      if (pr.k === 'spike' && pr.st === 'salt') { shatter(W, pr, 10); continue; }
      if (pr.k === 'drop') { pr.fall = true; pr.vy = 0; pr.anc = null; continue; }
      if (pr.k === 'cover' && pr.hp > 0) {
        pr.hp -= n; pr.hitT = 0.15;
        SFX.fx('coverHit', pr.x, pr.y + (pr.t0 + pr.b) / 2);
        if (pr.hp <= 0) { shatter(W, pr, 22); continue; }
      }
    }
    if (pr.ring > 0) pr.ring -= dt;
    const me = !W.p.dead;
    switch (pr.k) {
      case 'climb':
        if (pr.arc) {                          // an arched vine: latch on like a web line
          const held = me && W.zfx.climb === pr && !W.p.jet;
          lineSway(W, pr, held, held ? archNear(pr, pcx, W.p.y + WEB_HAND).u : 0, dt);
          if (!me || !pOver(W, pr, 0)) break;
          // held, it can bend away faster than you follow on a long frame: hold on further out
          const R = (pr.grab || (pr.grab = kr('arGrab'))) + (held ? DEV.bendMax : 0);
          const q = archNear(pr, pcx, W.p.y + WEB_HAND), d = q.d, d2 = archNear(pr, pcx, pcy).d;
          if (Math.min(d, d2) < R + 3) {
            W.plantsNow.add(pr);
            if (!held) bendPush(pr, q.u, W.p.vx, W.p.vy, DEV.bendPush, dt);   // flying through: it gives
          }
          if (d <= R && (!z.arch || d < z.archD)) { z.arch = pr; z.archD = d; }
          break;
        }
        if (swings(pr)) {
          if (me && W.p.swing && W.zfx.climb === pr) {
            // you swing on it (movePlayer): it hangs through your hands
            const Lh = clamp(W.p.y + WEB_HAND - pr.y - hangRootY(pr), 6, pr.len);
            pr.sw = clamp(Math.asin(clamp((pcx - pr.x - hangRootX(pr)) / Lh, -1, 1)), -DEV.vineMax, DEV.vineMax);
            pr.swv = W.p.vx / Lh;
          } else {
            // brushed past (or pushed across while hanging on): it swings the way you went
            if (me && pOver(W, pr, 1)) {
              const k = Math.min(1, 10 * dt);
              pr.swv = (pr.swv || 0) + (W.p.vx * DEV.vinePush / Math.max(12, pr.len) - (pr.swv || 0)) * k;
            }
            if (pr.sw || pr.swv) swingStep(pr, pr.len * 0.6, GRAVITY * DEV.vineGrav, DEV.vineDamp, DEV.vineMax, dt);
          }
        }
        if (me && pOver(W, pr, 0)) z.climb = pr;
        if (me && PLANTS[pr.st] && pOver(W, pr, 1)) W.plantsNow.add(pr);
        break;
      case 'drip':
        if (pr.st === 'sparks') {
          pr.t -= dt;
          if (pr.t <= 0) {
            pr.t = 1.2 + Math.random() * 2.6;
            SFX.fx('sparks', pr.x, pr.y);
            for (let k = 0; k < 10; k++) W.dparts.push({ x: pr.x, y: pr.y + 4, vx: (Math.random() - 0.5) * 170,
              vy: -20 + Math.random() * 90, g: 0.5, c: Math.random() < 0.5 ? '#ffe27a' : '#fff6c8', s: 1.2, life: 0.5, max: 0.5, glow: 1 });
          }
        } else {
          // each drip keeps its own random clock, so they never fall in step
          const rate = DRIP_RATE[pr.st];
          if (pr.dn == null) { pr.di = (0.3 + Math.random() * 1.4) / rate; pr.dn = Math.random() * pr.di; }
          pr.dn -= dt;
          if (pr.st === 'steam' && (pr.hs = (pr.hs || Math.random() * 3) - dt) <= 0) { pr.hs = 1.5 + Math.random() * 3; SFX.fx('steam', pr.x, pr.y); }
          while (pr.dn <= 0) { pr.di = (0.3 + Math.random() * 1.4) / rate; pr.dn += pr.di; W.dparts.push(spawnDrip(pr)); }
          pr.acc = 1 - pr.dn / pr.di;                // how far the next drop has swelled (the sprite reads it)
        }
        break;
      case 'drop':                             // an icicle lets go when you walk under it
        if (pr.st === 'icicle' && !pr.shake && me && Math.abs(pcx - pr.x) < 18 && pcy > pr.y &&
            pcy - pr.y < 170 && lineOfSight(W, pr.x, pr.y + 18, pcx, pcy)) { pr.shake = 0.35; SFX.fx('iceCreak', pr.x, pr.y); }
        if (pr.shake > 0 && (pr.shake -= dt) <= 0) { pr.fall = true; pr.vy = 0; pr.anc = null; }
        break;
      case 'spike':
        if (me && pOver(W, pr, -1) && pr.cd <= 0) {
          hurt(W, G, pr.st === 'salt' ? 4 : PROP_DMG.spike); pr.cd = 0.7;
          W.p.vy = pr.hang ? 160 : -280; burst(W, pcx, pr.hang ? W.p.y : W.p.y + PH, 5, '#ff5a5a');
        }
        break;
      case 'vent': {
        pr.t += dt;
        const ph = pr.t % 3.6, wasOn = pr.on, wasWarn = pr.warn;
        // @ts-expect-error a vent reuses `on` as roaring, a boolean (Found along the way)
        pr.on = ph > 2.6; pr.warn = ph > 1.9 && !pr.on;
        if (pr.warn && !wasWarn) SFX.fx('ventWarn', pr.x, pr.y);
        if (pr.on && !wasOn) SFX.fx('ventFire', pr.x, pr.y - 20);
        if (pr.warn && Math.random() < dt * 14) W.smoke.push({ x: pr.x, y: pr.y - 2, vx: (Math.random() - 0.5) * 10,
          vy: -30, r: 2 + Math.random() * 2, life: 0.8, max: 0.8 });
        if (pr.on) {
          if (Math.random() < dt * 40) W.dparts.push({ x: pr.x + (Math.random() - 0.5) * 6, y: pr.y - 4, vx: (Math.random() - 0.5) * 20,
            vy: -140 - Math.random() * 80, g: 0, c: Math.random() < 0.5 ? '#ffb050' : '#ff7a2a', s: 1.6, life: 0.4, max: 0.4, glow: 1 });
          if (me && pr.cd <= 0 && W.p.x + PW > pr.x - 6 && W.p.x < pr.x + 6 && W.p.y < pr.y && W.p.y + PH > pr.y - VENT_H) { hurt(W, G, PROP_DMG.vent); youAlight(W); pr.cd = 0.4; }
          if ((pr.ecd = (pr.ecd || 0) - dt) <= 0) {
            pr.ecd = 0.4;
            for (let yy = 4; yy < VENT_H; yy += 12) ignite(W, G, pr.x, pr.y - yy, 6, 0.5);   // and it lights what hangs over it
            for (let j = W.enemies.length - 1; j >= 0; j--) {
              const e = W.enemies[j];
              if (Math.abs(e.x - pr.x) < e.r + 6 && e.ty < pr.y && e.ty > pr.y - VENT_H) { setAlight(e); damageEnemy(W, j, 1); }
            }
          }
        }
        break;
      }
      case 'pad':                               // a bouncy mushroom throws you up
        if (pr.sq > 0) pr.sq -= dt;
        if (me && W.p.vy >= 0 && Math.abs(pcx - pr.x) < 11 && W.p.y + PH > pr.y - 12 && W.p.y + PH < pr.y + 2) {
          W.p.vy = -680; W.p.onGround = false; pr.sq = 0.3;
          SFX.fx('shroom', pr.x, pr.y);
          burst(W, pr.x, pr.y - 8, 5, propCol(pr, themeFor(W.floor)));
        }
        break;
      case 'zone': {
        const on = me && W.p.onGround && W.p.x + PW > pr.x + pr.l && W.p.x < pr.x + pr.r && Math.abs(W.p.y + PH - pr.y) < 5;
        const st = pr.st, moving = Math.abs(W.p.vx) > 30;
        if (st === 'slime') for (const e of W.enemies)
          if (e.x > pr.x + pr.l && e.x < pr.x + pr.r && e.ty > pr.y - 30 && e.ty < pr.y) e.chill = 0.45;
        if (!on) { pr.stand = 0; break; }
        z.surface = st;
        if (st === 'ice') z.slick = 1;
        else if (st === 'snow') z.slow = Math.min(z.slow, 0.55);
        else if (st === 'slime') z.slow = Math.min(z.slow, 0.45);
        else if (st === 'puddle') {
          z.slow = Math.min(z.slow, 0.7);
          if (moving && Math.random() < dt * 20) W.dparts.push({ x: pcx, y: pr.y - 2, vx: (Math.random() - 0.5) * 60,
            vy: -60 - Math.random() * 60, g: 0.9, c: 'rgba(150,200,255,0.8)', s: 1.3, life: 0.6, max: 0.6 });
        } else if (st === 'acid') { if (pr.cd <= 0) { hurt(W, G, 3); pr.cd = 0.5; } }
        else if (st === 'glass') {
          if (Math.abs(W.p.vx) > 80 && pr.cd <= 0) { hurt(W, G, 2); pr.cd = 0.35; burst(W, pcx, pr.y - 1, 3, '#d8f4ff'); }
        } else if (st === 'log') {
          pr.stand = (pr.stand || 0) + dt;
          if (pr.stand > 0.8 && pr.cd <= 0) { hurt(W, G, 3); pr.cd = 0.5; }
        } else if (st === 'ash' && moving && Math.random() < dt * 30) {
          W.smoke.push({ x: pcx + (Math.random() - 0.5) * 8, y: pr.y - 2, vx: -W.p.vx * 0.2 + (Math.random() - 0.5) * 20,
            vy: -15 - Math.random() * 20, r: 1.5 + Math.random() * 2, life: 0.9, max: 0.9 });
        }
        break;
      }
      case 'noise':                              // skulls crunch underfoot
        if (pr.st === 'skulls' && me && pr.cd <= 0 && pOver(W, pr, 0)) {
          alertAt(W, pr.x, pr.y); pr.cd = 3; burst(W, pr.x, pr.y - 4, 6, '#e6dcc4');
          SFX.fx('skulls', pr.x, pr.y);
        }
        break;
      case 'eyes':                               // eyes in the dark whisper as you first come near
        if (me && !pr.heard && Math.hypot(pcx - pr.x, pcy - pr.y) < 170) { pr.heard = 1; SFX.fx('eyes', pr.x, pr.y); }
        break;
      case 'matter': {                           // gravity turns over near it
        const by = pr.y + Math.sin(W.time * 1.3 + pr.seed * 9) * 3, dd = Math.hypot(pcx - pr.x, pcy - by);
        if (me && dd < 48) z.rev = Math.max(z.rev, 1 - dd / 48);
        if (me && dd < 12 && pr.cd <= 0) { hurt(W, G, PROP_DMG.matter); pr.cd = 0.5; }
        break;
      }
      case 'tendril': {                          // lashes out on a beat
        pr.t += dt;
        const ph = (pr.t % 2.4) / 2.4;
        const was = pr.ext || 0;
        pr.ext = ph > 0.55 && ph < 0.85 ? Math.sin((ph - 0.55) / 0.3 * Math.PI) * 46 : 0;
        if (pr.ext > 0 && !was) SFX.fx('lash', pr.x, pr.y);
        pr.aimA = pr.ang + Math.sin(pr.t * 0.7) * 0.3;
        if (me && pr.ext > 18 && pr.cd <= 0) {
          const tx = pr.x + Math.cos(pr.aimA) * pr.ext, ty = pr.y - 2 + Math.sin(pr.aimA) * pr.ext;
          const vx = tx - pr.x, vy = ty - pr.y + 2, t = clamp(((pcx - pr.x) * vx + (pcy - pr.y + 2) * vy) / (vx * vx + vy * vy), 0, 1);
          if (Math.hypot(pr.x + vx * t - pcx, pr.y - 2 + vy * t - pcy) < 10) {
            hurt(W, G, PROP_DMG.tendril); pr.cd = 0.8; W.p.vx += Math.cos(pr.aimA) * 220; W.p.kick = 0.15;
          }
        }
        break;
      }
    }
  }
  // spore clouds from burst pods
  for (let i = W.clouds.length - 1; i >= 0; i--) {
    const cl = W.clouds[i];
    cl.life -= dt; cl.tick -= dt;
    if (cl.tick <= 0) {
      cl.tick = 0.4;
      if (!W.p.dead && Math.hypot(pcx - cl.x, pcy - cl.y) < cl.r) hurt(W, G, PROP_DMG.cloud);
      for (let j = W.enemies.length - 1; j >= 0; j--)
        if (Math.hypot(W.enemies[j].x - cl.x, W.enemies[j].ty - cl.y) < cl.r + W.enemies[j].r) damageEnemy(W, j, 1);
    }
    if (cl.life <= 0) W.clouds.splice(i, 1);
  }
  for (let i = W.rings.length - 1; i >= 0; i--) if ((W.rings[i].t += dt) > 0.9) W.rings.splice(i, 1);
  // drips, sparks, steam and splashes
  W.dripHurt -= dt;
  for (let i = W.dparts.length - 1; i >= 0; i--) {
    const q = W.dparts[i];
    q.life -= dt;
    q.vy += GRAVITY * q.g * dt;
    if (q.wob != null) q.vx = Math.sin(W.time * 2 + q.wob) * 6;
    if (q.grow) q.s += dt * 3;
    q.x += q.vx * dt; q.y += q.vy * dt;
    let dead = q.life <= 0;
    // burning oil from a lantern: lights what it passes through, and where it lands
    if (q.ember) {
      const ex = Math.floor(q.x / CELL), ey = Math.floor(q.y / CELL);
      if (ex >= 0 && ey >= 0 && ex < CW && ey < CH && W.fire.fuel[ey * CW + ex]) ignite(W, G, q.x, q.y, 2, 0.6);
      if (!W.p.dead && q.x > W.p.x && q.x < W.p.x + PW && q.y > W.p.y && q.y < W.p.y + PH) { youAlight(W); dead = true; }
      if (!dead && solidAt(W, q.x, q.y)) ignite(W, G, q.x - q.vx * dt, q.y - q.vy * dt, 4, 0.85);
    }
    if (!dead && solidAt(W, q.x, q.y)) {
      dead = true;
      if (q.snd) SFX.fx(q.snd, q.x, q.y);
      if (q.splash) for (let k = 0; k < 2; k++) W.dparts.push({ x: q.x, y: q.y - 2, vx: (Math.random() - 0.5) * 50,
        vy: -30 - Math.random() * 40, g: 0.8, c: q.c, s: 1, life: 0.35, max: 0.35, glow: q.glow });
    }
    if (!dead && q.dmg && !W.p.dead && q.x > W.p.x && q.x < W.p.x + PW && q.y > W.p.y && q.y < W.p.y + PH) {
      if (W.dripHurt <= 0) { hurt(W, G, q.dmg); W.dripHurt = 0.4; }
      dead = true;
    }
    if (dead) W.dparts.splice(i, 1);
  }
  if (W.dparts.length > 700) W.dparts.splice(0, W.dparts.length - 700);
  stepAmbience(W, dt);
  // foliage: grabbing a vine, or pushing into a plant you weren't already in, rustles;
  // an arched vine in reach beats the strands hanging off it (let go with a push down, and
  // a strand under you catches you instead)
  if (W.webLetGo > 0) z.arch = null;
  if (z.arch) z.climb = z.arch;
  // moving through them rustles now and then; rustleStep keeps a big clump from spamming
  let entered = !!(z.climb && PLANTS[z.climb.st] && z.climb !== W.zfx.climb), style = null;
  for (const pr of W.plantsNow) if (!W.plantsLast.has(pr)) { entered = true; style = pr.st; }
  const str = rustleStep(W.rustle, dt, W.plantsNow.size > 0, entered, Math.hypot(W.p.vx, W.p.vy));
  if (str) {
    const pr = style ? null : W.plantsNow.values().next().value;
    SFX.rustle(pcx, pcy, str, style || (pr && pr.st) || 'vine');
  }
  W.plantsLast = new Set(W.plantsNow);
  // web lines give: a little sag at rest, a dip under you while you hang on, a wobble after
  for (const L of W.webs) {
    L.sag = DEV.webSag * Math.abs(L.b0x - L.a0x);
    const held = !W.p.dead && W.zfx.web === L && W.zfx.climb === L && !W.p.jet;
    lineSway(W, L, held, held ? webNearU(L, pcx, W.p.y + WEB_HAND).u : 0, dt);
  }
  // spider web lines: each one you're touching slows you, and like a vine you latch on
  // to the nearest (unless you've just let go of one)
  if (!W.p.dead) {
    let wd = Infinity;
    for (const L of W.webs) {
      const R = (L.grab || (L.grab = spr('webGrab'))) + (L.wh ? DEV.bendMax : 0), give = (L.sag || 0) + DEV.bendMax;
      if (pcx < Math.min(L.a0x, L.b0x) - R - give || pcx > Math.max(L.a0x, L.b0x) + R + give ||
          pcy < Math.min(L.a0y, L.b0y) - R - give - PH / 2 || pcy > Math.max(L.a0y, L.b0y) + R + give + PH / 2) continue;
      const d = webDist(L, pcx, W.p.y + WEB_HAND);
      const d2 = webDist(L, pcx, pcy);
      if (Math.min(d, d2) > R) continue;
      if (!L.wh) bendPush(L, webNearU(L, pcx, pcy).u, W.p.vx, W.p.vy, DEV.bendPush, dt);   // flying through: it gives
      z.webs++;
      z.webMul *= L.slow || (L.slow = spr('webSlow'));
      if (d <= R && d < wd) { wd = d; z.web = L; }
    }
    if (W.webLetGo > 0) z.web = null;
    if (z.web && !z.climb) z.climb = z.web;
    else if (z.climb !== z.web) z.web = null;
  }
  W.zfx = z;
}
