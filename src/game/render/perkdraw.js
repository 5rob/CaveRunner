// CaveRunner Auto's perks in a level, drawn (auto/perks.js steps them): Permanent Shield's glow, Pinpointer's laser,
// the Angry Ghost. perkGlow goes in titleDraw's added-light pass; perkFront after it, over the dark.
import { PW, PH } from '../../core/consts.js';
import { DEV } from '../../dev/knobs.js';
import { glowAt, gunMuzzle, GUN_HELD } from '../../art/sprites.js';
import { titleSolid } from '../../art/titlescene.js';
import { perkOn } from '../../auto/perks.js';

const SHIELD_FLASH = 0.45;   // the break's flash (s)
const SHIELD_POP = 0.3;      // its coming back (s)
const LASER_MAX = 260;       // how far the laser reaches (units)

// where his laser stops: the first rock or creature along his aim (screen coords)
/** @param {import('../../art/titlescene.js').TitleScene} S @param {number} x @param {number} y @param {number} a */
export function laserEnd(S, x, y, a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  for (let d = 0; d < LASER_MAX; d += 2) {
    const px = x + dx * d, py = y + dy * d;
    if (titleSolid(S, px, py)) return { x: px, y: py, hit: true };
    for (const f of S.foes) if (f.hp > 0 && Math.hypot(f.x - S.scroll - px, f.ty - py) < f.r) return { x: px, y: py, hit: true };
  }
  return { x: x + dx * LASER_MAX, y: y + dy * LASER_MAX, hit: false };
}

/** @param {import('../../art/titlescene.js').TitleScene} S @param {import('../../art/titlescene.js').TRunner} r */
const muzzle = (S, r) => gunMuzzle(r.x + PW / 2 + Math.cos(r.ang) * 2.5, r.y + PH * 0.45, r.ang, GUN_HELD, r.kit.art);

// the added light: the shield (a light-blue glow, brightest at its rim; flashes and goes when it breaks, swells back
// when it's up again), the laser, the ghost's halo
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S */
export function perkGlow(ctx, S) {
  if (!S.team) return;
  for (const r of S.runners) {
    const pl = S.team[r.id];
    if (!pl || r.hide || r.out || pl.alive === false) continue;
    const cx = r.x + PW / 2, cy = r.y + PH / 2, R = PH * 0.95;
    if (perkOn(pl, 'shield')) {
      const since = S.t - (r.shieldHit ?? -99), up = !((r.shieldT || 0) > 0);
      if (since < SHIELD_FLASH) {
        // the break: a white-blue burst, the ring flying out and fading
        const q = since / SHIELD_FLASH, rr = R * (1 + q * 0.8);
        ctx.globalAlpha = 1 - q;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, 'rgba(200,240,255,0.5)'); g.addColorStop(0.75, 'rgba(122,215,255,0.35)'); g.addColorStop(1, 'rgba(230,250,255,0.9)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#e6faff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      } else if (up) {
        // up: dark at him, light blue towards the rim (the owner's look); swells in for SHIELD_POP once it's back
        const back = Math.min(1, (since - DEV.autoShieldT) / SHIELD_POP);
        const k = Math.max(0, back), pulse = 0.85 + 0.15 * Math.sin(S.t * 4 + r.id), rr = R * (0.7 + 0.3 * k);
        ctx.globalAlpha = k * pulse;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, 'rgba(122,215,255,0)'); g.addColorStop(0.55, 'rgba(122,215,255,0.06)');
        g.addColorStop(0.88, 'rgba(122,215,255,0.32)'); g.addColorStop(1, 'rgba(200,240,255,0.55)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (perkOn(pl, 'pinpointer')) {
      const m = muzzle(S, r), e = laserEnd(S, m.x, m.y, r.ang);
      ctx.globalAlpha = 0.55; ctx.strokeStyle = '#ff2a2a'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.globalAlpha = 1;
      if (e.hit) { glowAt(ctx, e.x, e.y, 5, 0.6, '255,40,40'); ctx.fillStyle = '#ff6a6a'; ctx.fillRect(e.x - 0.8, e.y - 0.8, 1.6, 1.6); }
    }
    if (r.ghost) {
      const g = r.ghost, fresh = Math.max(0, 1 - (S.t - g.fired) / 0.25);
      glowAt(ctx, g.x, g.y + bob(S, r), 10 + fresh * 6, 0.22 + fresh * 0.3, '201,166,255');
    }
  }
}

/** @param {import('../../art/titlescene.js').TitleScene} S @param {import('../../art/titlescene.js').TRunner} r */
const bob = (S, r) => Math.sin(S.t * 3 + r.id) * 2;

// over the dark: the ghost itself, a pale wisp (the old game's, render/actors.js)
/** @param {CanvasRenderingContext2D} ctx @param {import('../../art/titlescene.js').TitleScene} S */
export function perkFront(ctx, S) {
  for (const r of S.runners) {
    if (!r.ghost || r.hide) continue;
    const x = r.ghost.x, y = r.ghost.y + bob(S, r), w = r.face;
    ctx.globalAlpha = 0.7; ctx.fillStyle = '#c9a6ff';
    ctx.beginPath(); ctx.arc(x, y, 4.5, Math.PI, 0);
    ctx.lineTo(x + 4.5, y + 5); ctx.lineTo(x + 1.5, y + 3.5); ctx.lineTo(x - 1.5, y + 5); ctx.lineTo(x - 4.5, y + 3.5);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#3a2f52';
    ctx.fillRect(x - 2.4 + w * 0.6, y - 1, 1.2, 1.8); ctx.fillRect(x + 1.0 + w * 0.6, y - 1, 1.2, 1.8);
  }
}
