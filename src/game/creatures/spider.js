// @ts-check
// The spider's Game side (REFACTOR.md D20; its brain, spiderStep, and its sprite, drawSpider,
// are in creatures/spider.js): its part of the enemy loop (spiderMove: the crawl, the string
// shot at you), once a frame its silk (strings in flight and on you, web lines whose rock is
// gone: spiderFrame), and drawing the silk (drawSilk, a part of draw()).

import { SFX } from '../../audio/sfx.js';
import { PH, PW } from '../../core/consts.js';
import { spiderStep } from '../../creatures/spider.js';
import { spr } from '../../dev/knobs.js';
import { webNearU, webPath } from '../../world/sway.js';
import { burst } from '../systems/particles.js';
import { lineOfSight, solidAt, solidCell } from '../systems/terrain.js';

// A spider's frame (ACTS): the move, and the string it shoots; the shared part of the loop
// runs after it
/** @param {World} W @param {GameCtx} G @param {Enemy} e @param {EnemyCtx} C */
export function spiderMove(W, G, e, C) {
  const { dt, dx, dy, dist, sees, hunting, pcx, pcy } = C, k = e.k;
  // only on rock and its own lines (spiderStep); strings you when it has a clear line
  const cold = e.chill && e.chill < 1 ? e.chill : 1;
  // on a line it rides the sag and bend (world/sway.js), which spiderStep doesn't know about:
  // take last frame's off first, then put this frame's on after
  if (e.wox || e.woy) { e.x -= e.wox || 0; e.y -= e.woy || 0; e.wox = e.woy = 0; }
  if (spiderStep(e, { solidCell: (cx, cy) => solidCell(W, cx, cy), webs: W.webs, hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
    speedMul: cold }, dt) === 'web') SFX.fx('lash', e.x, e.y);
  if (e.sp && e.sp.mode === 'line' && e.sp.line) {
    const L = e.sp.line, q = webNearU(L, e.x, e.y);
    e.wox = q.x - (L.a0x + (L.b0x - L.a0x) * q.u); e.woy = q.y - (L.a0y + (L.b0y - L.a0y) * q.u);
    e.x += e.wox; e.y += e.woy;
  }
  e.silkT = (e.silkT || 0) - dt;
  const S = e.sp;
  if (hunting && e.silkT <= 0 && S && (S.mode === 'surf' || S.mode === 'line') &&
      dist < (e.silkR || (e.silkR = spr('spSilk'))) * sees && dist > e.r + 24) {
    e.silkT = 0.4;
    if (lineOfSight(W, e.x, e.y, pcx, pcy)) {
      e.silkT = spr('spSilkCd'); e.silkR = spr('spSilk');
      const v = spr('spSilkSpd');
      W.silk.push({ x: e.x, y: e.y, ax: e.x, ay: e.y, vx: dx / dist * v, vy: dy / dist * v,
        life: 400 / v * 1.3 + 0.1 });
      SFX.creature(k, 'fire', e.x, e.y);
    }
  }
}

// Once a frame (ACTS), after the creatures' shots: the spiders' silk
/** @param {World} W @param {GameCtx} G @param {StepFrame} F */
export function spiderFrame(W, G, F) {
  const { dt } = F;
  // spider strings in flight: rock stops them, you catch them
  for (let i = W.silk.length - 1; i >= 0; i--) {
    const b = W.silk[i];
    b.life -= dt;
    let gone = b.life <= 0;
    const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
    for (let s = 0; s < sn && !gone; s++) {
      b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
      if (solidAt(W, b.x, b.y)) { gone = true; break; }
      if (!W.p.dead && b.x > W.p.x - 3 && b.x < W.p.x + PW + 3 && b.y > W.p.y - 3 && b.y < W.p.y + PH + 3) {
        gone = true;
        W.strings.push({ ax: b.ax, ay: b.ay, ox: b.x - W.p.x, oy: b.y - W.p.y, slow: spr('spSlow'), max: spr('spSilkMax') });
        SFX.fx('lash', b.x, b.y);
      }
    }
    if (gone) W.silk.splice(i, 1);
  }
  // strings on you: pulled past their length, they snap
  for (let i = W.strings.length - 1; i >= 0; i--) {
    const s = W.strings[i];
    if (Math.hypot(W.p.x + s.ox - s.ax, W.p.y + s.oy - s.ay) > s.max) {
      W.strings.splice(i, 1);
      burst(W, W.p.x + s.ox, W.p.y + s.oy, 4, '#e8e8f0');
      SFX.fx('lash', W.p.x + s.ox, W.p.y + s.oy);
    }
  }
  // a web line whose rock has been blasted away comes down (a few checked a frame)
  for (let n = Math.min(W.webs.length, 6); n > 0; n--) {
    W.webCheck = (W.webCheck + 1) % W.webs.length;
    const L = W.webs[W.webCheck];
    if ((L.bin && !solidAt(W, L.bin.x, L.bin.y)) || (L.ain && !solidAt(W, L.ain.x, L.ain.y))) {
      W.webs.splice(W.webCheck, 1);
      if (!W.webs.length) break;
    }
  }
}

// Spider silk: web lines, lines being shot, strings flying at you and stuck to you
/** @param {World} W @param {GameCtx} G */
export function drawSilk(W, G) {
  // spider silk: the web lines they travel (anchor to anchor), lines being shot, the
  // strings in flight at you and the ones stuck to you
  G.ctx.lineCap = 'round';
  G.ctx.strokeStyle = '#eef0f6';
  G.ctx.globalAlpha = 0.55; G.ctx.lineWidth = 0.7;
  G.ctx.beginPath();
  for (const L of W.webs) webPath(G.ctx, L);
  for (const e of W.enemies) {
    const sh = e.sp && e.sp.mode === 'shoot' && e.sp.shot;
    if (sh) { G.ctx.moveTo(sh.ax0, sh.ay0); G.ctx.lineTo(sh.x + sh.dx * Math.min(sh.t, sh.len), sh.y + sh.dy * Math.min(sh.t, sh.len)); }
  }
  G.ctx.stroke();
  G.ctx.globalAlpha = 0.85; G.ctx.lineWidth = 0.9;
  G.ctx.beginPath();
  for (const b of W.silk) { G.ctx.moveTo(b.ax, b.ay); G.ctx.lineTo(b.x, b.y); }
  for (const s of W.strings) { G.ctx.moveTo(s.ax, s.ay); G.ctx.lineTo(W.p.x + s.ox, W.p.y + s.oy); }
  G.ctx.stroke();
  G.ctx.globalAlpha = 1;
}
