// @ts-check
// CaveRunner Auto (stage: shots, first half): what each shot sheds as it flies in a level, pure. Each mod is
// known by its spell id (`sid`, carried from planCast's Shot by art/scenegun.js shotsOf). The scene
// (art/titlescene.js stepShots) pushes what these return into S.parts (under its own cap); the sprites and
// lights are game/render/autolooks.js. Particle kinds: 'glow' (an added speck that fades), 'fall' (the same,
// falling), 'smoke' (a dark puff that swells), 'fire' (rises, white → orange → red).

export const FX_ROOM = 60;          // trails stop while the scene has fewer than this many particles of room
export const FX_TRAIL = 8;          // positions a shot remembers for its afterimages (Disc Projectile)
export const MISSILE_TURN = 3.2;    // Magic Missile: how hard it turns onto its creature (rad/s)
export const MISSILE_WAIT = 0.12;   // s it flies straight out first
/** @type {Record<string, number>} */
export const SPRAY = { fball: 6, fbolt: 3 };   // fire drops a fireball throws where it lands
/** @type {Record<string, number>} */
export const LIFE_K = { buck: 0.45 };          // short range: Buckshot's life × this

/** @param {string} col @param {number} x @param {number} y @param {number} vx @param {number} vy @param {number} life @param {number} r @param {string} kind @returns {import('../art/titlescene.js').TPart} */
const P = (col, x, y, vx, vy, life, r, kind) => ({ x, y, vx, vy, life, max: life, r, col, kind });

// the particles shot `s` sheds this frame (dt s), R the scene's random
/** @param {import('../art/titlescene.js').TShot} s @param {number} dt @param {() => number} R @returns {import('../art/titlescene.js').TPart[]} */
export function autoTrail(s, dt, R) {
  /** @type {import('../art/titlescene.js').TPart[]} */
  const out = [];
  const sp = Math.hypot(s.vx, s.vy) || 1, ux = s.vx / sp, uy = s.vy / sp;
  /** @param {number} n */
  const ch = n => R() < n * dt;
  /** @param {number} a @param {number} b */
  const rr = (a, b) => a + R() * (b - a);
  switch (s.sid) {
    case 'bolt':      // Noita's spark bolt (the game's v95 look): fading pink plasma, white flecks
      for (let k = 0; k < 2; k++) if (ch(45)) out.push(P(R() < 0.3 ? '#ffffff' : R() < 0.6 ? '#ff9cf5' : '#d86ad0',
        s.x - ux * rr(0, 4) + rr(-1, 1), s.y - uy * rr(0, 4) + rr(-1, 1), rr(-8, 8), rr(-8, 8), rr(0.15, 0.45), rr(0.8, 1.5), 'glow'));
      break;
    case 'spark':     // hot yellow sparks spat backward that drop away
      if (ch(40)) out.push(P(R() < 0.5 ? '#fff6c0' : '#ffd23c', s.x, s.y, -ux * 40 + rr(-50, 50), -uy * 40 + rr(-60, 10), rr(0.15, 0.35), rr(0.7, 1.1), 'fall'));
      break;
    case 'buck':      // the odd metal glint
      if (ch(8)) out.push(P('#e8ecf4', s.x, s.y, rr(-10, 10), rr(-10, 10), 0.1, 0.7, 'glow'));
      break;
    case 'lance':     // blue light peeling off the blade
      if (ch(30)) out.push(P(R() < 0.3 ? '#ffffff' : '#7ad7ff', s.x - ux * rr(0, 12), s.y - uy * rr(0, 12), rr(-10, 10), rr(-10, 10), rr(0.15, 0.35), rr(0.6, 1), 'glow'));
      break;
    case 'blast': {   // smoke behind it as it's thrown; smoke up off the fuse once it rests
      const fx = s.x + Math.cos(s.spin * 0.5 - 1.2) * s.size * 1.7, fy = s.y + Math.sin(s.spin * 0.5 - 1.2) * s.size * 1.7;
      if (sp > 25) { if (ch(30)) out.push(P('#4a4652', s.x - ux * s.size, s.y - uy * s.size, rr(-4, 4), rr(-8, 0), rr(0.5, 0.9), rr(1, 1.8), 'smoke')); }
      else if (ch(9)) out.push(P('#5a5660', fx, fy, rr(-3, 3), rr(-22, -12), rr(0.9, 1.4), rr(0.8, 1.4), 'smoke'));
      if (ch(30)) out.push(P(R() < 0.4 ? '#ffffff' : '#ffb347', fx, fy, rr(-25, 25), rr(-40, 0), rr(0.08, 0.2), rr(0.5, 0.9), 'fall'));
      break;
    }
    case 'arrow': {   // a white streak fading off its path: specks laid along this frame's flight
      const n = Math.min(4, Math.max(1, Math.round(sp * dt / 2)));
      for (let k = 0; k < n; k++) { const f = k / n;
        out.push(P(k % 2 ? '#ffffff' : '#e8ffe0', s.x - s.vx * dt * f, s.y - s.vy * dt * f, 0, 0, 0.22, 0.7, 'glow')); }
      break;
    }
    case 'missile':   // a hot rocket trail: fire at the nozzle going to smoke fast, and a long rope of smoke
      if (ch(60)) out.push(P('#ffb02e', s.x - ux * 4, s.y - uy * 4, -ux * rr(20, 60) + rr(-10, 10), -uy * rr(20, 60) + rr(-10, 10), rr(0.06, 0.14), rr(1, 1.8), 'fire'));
      if (ch(28)) out.push(P('#5a5652', s.x - ux * 5, s.y - uy * 5, rr(-3, 3), rr(-4, 1), rr(1.2, 1.8), rr(0.8, 1.3), 'smoke'));
      break;
    case 'fball': case 'fbolt': case 'flamer': {   // flames licking off it, and smoke
      const big = s.sid === 'fball';
      if (ch(big ? 55 : s.sid === 'flamer' ? 14 : 35)) out.push(P('#ff9a2e', s.x + rr(-s.size, s.size) * 0.6, s.y + rr(-s.size, s.size) * 0.6,
        -ux * 25 + rr(-12, 12), -uy * 25 - rr(5, 25), rr(0.15, 0.35), rr(1, 1.5 + s.size * 0.3), 'fire'));
      if (ch(big ? 14 : s.sid === 'flamer' ? 2 : 6)) out.push(P('#3a3430', s.x - ux * s.size, s.y - uy * s.size, rr(-4, 4), rr(-14, -4), rr(0.8, 1.2), rr(1, 0.8 + s.size * 0.4), 'smoke'));
      break;
    }
    case 'bubble':    // twinkles shed off the skin
      if (ch(12)) out.push(P(R() < 0.5 ? '#ffffff' : '#9fdcff', s.x + rr(-4, 4), s.y + rr(-4, 4), rr(-6, 6), rr(-18, -6), rr(0.3, 0.6), rr(0.6, 1), 'glow'));
      break;
    case 'spit':      // pink drops falling off it (the jellyfish's spit)
      if (ch(30)) out.push(P(R() < 0.3 ? '#ffd0f2' : '#f578dc', s.x + rr(-1, 1), s.y + rr(-1, 1), s.vx * 0.1 + rr(-8, 8), rr(0, 15), rr(0.35, 0.7), rr(0.8, 1.3), 'fall'));
      break;
    case 'pollen':    // a faint trail of specks
      if (ch(10)) out.push(P(R() < 0.5 ? '#f4ffb0' : '#d8ff6a', s.x, s.y, rr(-4, 4), rr(-4, 4), rr(0.4, 0.8), rr(0.5, 0.9), 'glow'));
      break;
  }
  return out;
}

// a puff of smoke out of the gun's tip as it fires (Slug), at angle `a`
/** @param {string} sid @param {number} x @param {number} y @param {number} a @param {() => number} R @returns {import('../art/titlescene.js').TPart[]} */
export function muzzleFx(sid, x, y, a, R) {
  /** @type {import('../art/titlescene.js').TPart[]} */
  const out = [];
  if (sid !== 'slug') return out;
  for (let k = 0; k < 5; k++) {
    const v = 20 + R() * 40, b = a + (R() - 0.5) * 0.8;
    out.push(P(R() < 0.5 ? '#8a8690' : '#6a6670', x, y, Math.cos(b) * v, Math.sin(b) * v - 6, 0.5 + R() * 0.4, 1.2 + R() * 1.2, 'smoke'));
  }
  out.push(P('#fff2c0', x, y, 0, 0, 0.06, 3, 'glow'));
  return out;
}

// the nearest living creature within maxD of screen point (x, y) (creatures keep world x: scroll subtracted), or null
/** @template {{ x: number, ty: number, hp: number }} F @param {F[]} foes @param {number} x @param {number} y @param {number} scroll @param {number} maxD @returns {F | null} */
export function nearestFoe(foes, x, y, scroll, maxD) {
  let tg = null, td = maxD;
  for (const f of foes) { const d = Math.hypot(f.x - scroll - x, f.ty - y); if (f.hp > 0 && d < td) { td = d; tg = f; } }
  return tg;
}

// a shot turned toward (tx, ty) by at most `turn` radians, its speed kept
/** @param {import('../art/titlescene.js').TShot} s @param {number} tx @param {number} ty @param {number} turn */
export function steerTo(s, tx, ty, turn) {
  const sp = Math.hypot(s.vx, s.vy) || 1, want = Math.atan2(ty - s.y, tx - s.x), a = Math.atan2(s.vy, s.vx);
  const da = Math.atan2(Math.sin(want - a), Math.cos(want - a)), na = a + Math.max(-turn, Math.min(turn, da));
  s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
}

// the fire a fireball throws where it lands: little burning drops in a fan, up and away from the hit (each lights
// what it lands in: the scene's own fire). `fire` = the drops carry fire; sid 'fdrop' so they don't spray again
/** @param {import('../art/titlescene.js').TShot} s @param {() => number} R @returns {import('../art/titlescene.js').TShot[]} */
export function fireSpray(s, R) {
  const n = SPRAY[s.sid || ''] || 0;
  /** @type {import('../art/titlescene.js').TShot[]} */
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k / Math.max(1, n - 1) - 0.5) * 2.4 + (R() - 0.5) * 0.4, v = 70 + R() * 70;
    out.push({ x: s.x - s.vx * 0.02, y: s.y - s.vy * 0.02 - 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 1.5, col: '#ff8a1f', look: 'flame', life: 0.9,
      foe: false, spin: R() * 6, grav: 260, drag: 0.5, explode: 0, pit: 0, fire: 1, bounce: 0, bounceE: 0.5, pierce: 0, dmg: 0.2,
      real: true, by: s.by, sid: 'fdrop', age: 0 });
  }
  return out;
}

// remember where the shot was (newest first), for its afterimages
/** @param {import('../art/titlescene.js').TShot} s */
export function keepTrail(s) {
  if (s.sid !== 'disc') return;
  const t = s.tr || (s.tr = []);
  t.unshift(s.x, s.y);
  if (t.length > FX_TRAIL * 2) t.length = FX_TRAIL * 2;
}
