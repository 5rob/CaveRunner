import {
  AIM_DEAD, AIM_RING, AIR_ACC, BCELL, BED, BH, BRICK, BW, CELL, CH, CLIMB, COIN_PULL, COL, CW,
  DEAD, ENEMY_COUNT, FH, FOG, FOG_DARK, FOG_DIM, FOG_U, FUEL_DRAIN, FUEL_REGEN, FUEL_RESTART, FW,
  GRAVITY, GROUND_ACC, GUN_DROPS, JET, JET_ACC, KNOB, LAMP_REACH, MINI_D, MMH, MMW, MOD_DROPS,
  PATROL_R, PH, PICKUP_COOL, PICKUP_GAP, PLAYER_HP, PW, ROCK, SHOP_FLOOR, SHOP_ROOF, SHOP_TOP,
  SHOP_Y, SIGHT, START_GOLD, VIEW_MIN_H, VIEW_W, WALK, WEB_HAND, WH, WW
} from './core/consts.js';
import { angDiff, approach, clamp, hexArr, hexRgb, mix, mixHex, rr, turn } from './core/util.js';
import { HUNTERS, NATURAL_ONLY, enemyFor, rosterFor } from './data/creatures.js';
import { PERKS, PERK_IDS, perkBag } from './data/perks.js';
import { AMBIENCE, decorFor, themeFor } from './data/themes.js';
import {
  DEV, DEV_DEFAULTS, DEV_GROUPS, DEV_META, JE_COLS, devReport, devSet, jcol, kr, kru, spr
} from './dev/knobs.js';
import { buildAdvice, modPreview } from './spells/advisor.js';
import {
  fireSimGauges, fireSimNew, fireSimStep, gunModDeltas, pullSteps, statQual
} from './spells/bagsim.js';
import { effRecharge, gunPassives, planCast } from './spells/cast.js';
import {
  GUN_LV_MAX, caveGun, gunAccent, gunColor, gunLevel, gunLvCol, gunPrice, isGunShop, makeGun,
  resetGun, shuffleOrder, startingGuns
} from './spells/guns.js';
import {
  ALL_IDS, FAMILIES, FAMILY_OF, MODS, VACUUM_WAIT, famCol, famOf, priceOf
} from './spells/mods.js';
import { rollMod } from './spells/spawn.js';
import {
  DRIFT_ACC, DRIFT_CHASE, DRIFT_R, bhSp, driftStep, tracePath, wigTurn
} from './spells/trace.js';
import {
  FIRE_COLS, FIRE_WET, FLAMMABLE, FUEL_GRASS, FUEL_MOSS, FUEL_WOOD, fireArea, fireDouse,
  fireNear, fireNew, fireStep
} from './world/fire.js';
import { NAV, navField, navWay } from './world/nav.js';
import { ORE_GOLD, goldVeins } from './world/veins.js';
import {
  VIS_RAYS, fogReveal, fogStart, losClear, nestFog, rayDist, visPoly
} from './world/vision.js';
import { boxReach, builtAt } from './world/zones.js';
import { ratNests } from './world/nests.js';

const { useRef, useEffect, useState, useMemo } = React;
const h = React.createElement;
// Near the bottom of the tank the jet coughs: short random cut-outs, more often and a touch
// longer the closer the tank is to dry. `st` keeps the cut-out clock and how long the jet
// has been held on (which bends its pitch). Returns true while it's cut out; `st.start`
// is true on the frame a cut-out begins.
const SPUTTER_FUEL = 0.25;
function sputterStep(st, dt, fuel, on, rnd) {
  rnd = rnd || Math.random;
  st.start = false;
  if (!on) { st.cut = 0; st.gap = 0; st.onT = 0; return false; }
  st.onT = (st.onT || 0) + dt;
  st.cut = Math.max(0, (st.cut || 0) - dt);
  st.gap = Math.max(0, (st.gap || 0) - dt);                  // a catch of breath between coughs
  if (st.gap <= 0 && fuel < SPUTTER_FUEL) {
    const w = 1 - Math.max(0, fuel) / SPUTTER_FUEL;          // 0 at the line, 1 bone dry
    if (rnd() < dt * (1 + 7 * w)) {
      st.cut = 0.04 + rnd() * (0.05 + 0.08 * w);
      st.gap = st.cut + 0.1 + rnd() * 0.2;
      st.start = true;
    }
  }
  return st.cut > 0;
}
// The jet's roar climbs the longer you hold it, levelling off after 3 seconds.
function jetPitch(onT) { return 1 + 0.7 * Math.min(Math.max(onT, 0), 3) / 3; }
// one jelly's palette at its colour fraction u
function jellyPal(u) {
  const P = {};
  for (const [k, , , , f] of JE_COLS) P[f] = jcol(k, u);
  return P;
}
const NO_INPUT = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };

// ---- shared creature movement ----
// Pieces more than one creature is built from: the spider and the jellyfish use them now,
// and the next creature reworked should reach for these before writing its own. All pure.

// The roam spot: a point that wanders slowly round home (e.hx, e.hy) and turns back
// whenever it strays past the roam radius. A roaming creature heads for it. Keeps rx, ry,
// ra, roamR, roamSpd on the creature's state R; radius and drift speed are the creature's
// knobs pre+'RoamR' / pre+'RoamSpd', rolled again each time it turns back. ok(x, y), if
// given, is where the spot may go: it turns back toward home at the edge of that too.
function roamStep(R, e, dt, rnd, pre, ok) {
  if (R.rx === undefined) { R.rx = e.hx; R.ry = e.hy; R.ra = rnd() * 6.28; }
  R.ra += (rnd() - 0.5) * 3 * dt;
  if (!R.roamR) { R.roamR = kr(pre + 'RoamR', rnd); R.roamSpd = kr(pre + 'RoamSpd', rnd); }
  if (Math.hypot(R.rx - e.hx, R.ry - e.hy) > R.roamR) {
    R.ra = Math.atan2(e.hy - R.ry, e.hx - R.rx);
    R.roamR = kr(pre + 'RoamR', rnd); R.roamSpd = kr(pre + 'RoamSpd', rnd);
  }
  const nx = R.rx + Math.cos(R.ra) * R.roamSpd * dt, ny = R.ry + Math.sin(R.ra) * R.roamSpd * dt;
  if (ok && !ok(nx, ny) && ok(R.rx, R.ry)) { R.ra = Math.atan2(e.hy - R.ry, e.hx - R.rx); return; }
  R.rx = nx; R.ry = ny;
}

// a heading `a` turned toward `to` by at most `max` radians: a turn-rate limit. Kept
// within ±π so it never winds up.
function turnToward(a, to, max) {
  const d = angDiff(to, a), r = a + Math.max(-max, Math.min(max, d));
  return r > Math.PI ? r - 2 * Math.PI : r < -Math.PI ? r + 2 * Math.PI : r;
}

// Move a free-flying body by its velocity (V.vx, V.vy) in steps short enough that it
// can't pass through a thin wall, and bounce it off rock: anything nearer than r pushes
// it straight back out, and the part of its velocity going into the rock is turned round
// and scaled by `bounce` (0 stops dead against it, 1 is a perfect bounce). surfNormal's
// smoothed normal means it glances off lumpy rock rather than snagging on a pixel.
// true if it touched rock.
function flyMove(e, V, dt, r, solidCell, bounce) {
  const n = Math.max(1, Math.ceil(Math.hypot(V.vx, V.vy) * dt / CELL));
  let hit = false;
  for (let i = 0; i < n; i++) {
    e.x += V.vx * dt / n; e.y += V.vy * dt / n;
    const s = surfNormal(e.x, e.y, r + CELL, solidCell);
    if (!s || s.d >= r) continue;
    hit = true;
    // right on the rock there's no nearest-point direction; the smoothed normal still knows
    const ox = s.d > 0.5 ? s.px : s.x, oy = s.d > 0.5 ? s.py : s.y;
    e.x += ox * (r - s.d); e.y += oy * (r - s.d);
    const into = V.vx * ox + V.vy * oy;
    if (into < 0) { V.vx -= (1 + bounce) * into * ox; V.vy -= (1 + bounce) * into * oy; }
  }
  return hit;
}

// ---- the spider (Hämähäkki) ----
// It lives on the rock and on its own silk and nowhere else. On rock it slides along the
// surface: the "normal" is the average direction from the rock in a small disc round it
// to its centre, which smooths the pixel steps away, so it glides round bumps and
// corners instead of snagging on single pixels. It moves in short fast bursts with rests
// between (rests long when roaming, short when it has you). At the start of each burst
// it looks at where it wants to be: if that's off the surface (dot with the normal ≥
// the Dev 'Web instead of walk above dot' knob) it rides a nearby line that heads that way, or else shoots a new line at
// the rock over there and crosses on it. Lines stay. Pure, so the logic tests can run it
// on a hand-made grid. Nearly every number is a Dev-panel range (SP_KNOBS, rolled by spr);
// SPIDER holds only the body's own geometry.
const SPIDER = { hold: 6, feel: 14, step: 1.5, fall: 900 };

// the smoothed surface normal at (x, y): points away from the rock, null if there's no
// rock within R. Also the nearest rock: d is the distance to it, (px, py) the way out.
function surfNormal(x, y, R, solidCell) {
  const cx0 = Math.floor(x / CELL), cy0 = Math.floor(y / CELL), rc = Math.ceil(R / CELL);
  let nx = 0, ny = 0, n = 0, d = Infinity, px = 0, py = -1;
  for (let dy = -rc; dy <= rc; dy++) for (let dx = -rc; dx <= rc; dx++) {
    const wx = (cx0 + dx + 0.5) * CELL - x, wy = (cy0 + dy + 0.5) * CELL - y;
    if (wx * wx + wy * wy > R * R) continue;
    if (!solidCell(cx0 + dx, cy0 + dy)) continue;
    nx -= wx; ny -= wy; n++;
    // the nearest point of this cell's box
    const qx = Math.max(wx - CELL / 2, Math.min(0, wx + CELL / 2)), qy = Math.max(wy - CELL / 2, Math.min(0, wy + CELL / 2));
    const q = Math.hypot(qx, qy);
    if (q < d) { d = q; if (q > 1e-6) { px = -qx / q; py = -qy / q; } }
  }
  if (!n) return null;
  const l = Math.hypot(nx, ny);
  return l < 1e-6 ? { x: px, y: py, d, px, py } : { x: nx / l, y: ny / l, d, px, py };
}

// sit the spider at `hold` off the nearest rock: pushed straight out of anything closer
// (so a spike or a step just lifts it over, like a ball rolling on it), pulled in along
// the smoothed normal if it has drifted off. false if there's no rock to sit on.
function spiderSeat(e, S, solidCell, maxMove) { return surfSeat(e, S, solidCell, maxMove, SPIDER.hold, SPIDER.feel); }
// the same for any surface crawler: hold is how far off the rock it sits, feel how far it feels
function surfSeat(e, S, solidCell, maxMove, hold, feel) {
  let n = surfNormal(e.x, e.y, feel, solidCell);
  if (!n) return false;
  if (n.d < hold) {
    const m = hold - n.d;
    e.x += n.px * m; e.y += n.py * m;
    n = surfNormal(e.x, e.y, feel, solidCell) || n;
  } else {
    const m = Math.min(maxMove, n.d - hold);
    e.x -= n.x * m; e.y -= n.y * m;
  }
  S.nx = n.x; S.ny = n.y; S.py = n.py;          // py: straight out from the nearest rock
  return true;
}

const segNear = (L, x, y) => {
  const vx = L.bx - L.ax, vy = L.by - L.ay, ll = vx * vx + vy * vy || 1;
  const u = Math.max(0, Math.min(1, ((x - L.ax) * vx + (y - L.ay) * vy) / ll));
  return { u, d: Math.hypot(L.ax + vx * u - x, L.ay + vy * u - y) };
};

// a new line from (x, y) toward the rock along (dx, dy), or null if no rock within reach.
// Tries straight at it first, then fans out a little.
function spiderAim(x, y, dx, dy, reach, solidCell) {
  for (const a of [0, 0.22, -0.22, 0.45, -0.45]) {
    const c = Math.cos(a), s = Math.sin(a), ux = dx * c - dy * s, uy = dx * s + dy * c;
    const d = rayDist(x, y, ux, uy, reach, solidCell);
    if (d < reach && d > SPIDER.hold * 2.5) return { dx: ux, dy: uy, len: d };
  }
  return null;
}

// One frame of one spider. env: { solidCell, webs, goal: {x,y}, hunting, rnd, speed,
// reach }. Moves e, may push a line onto env.webs. Returns 'web' on the frame a shot
// line lands (for a sound), else null.
function spiderStep(e, env, dt) {
  const { solidCell, webs, rnd } = env;
  const S = e.sp || (e.sp = { mode: 'fall', vy: 0, nx: 0, ny: -1, on: 0, rest: rnd() * 0.5,
    side: 1, line: null, u: 0, dir: 1, shot: null, rx: e.hx, ry: e.hy, ra: rnd() * 6.28, high: false });
  // the roam point drifts slowly round home, and is pulled back if it wanders too far
  S.webT = (S.webT || 0) - dt;
  roamStep(S, e, dt, rnd, 'sp');
  const goal = env.hunting ? env.goal : { x: S.rx, y: S.ry };
  let out = null;

  if (S.mode === 'fall') {
    S.vy = Math.min(S.vy + SPIDER.fall * dt, 600);
    const n = Math.max(1, Math.ceil(S.vy * dt / SPIDER.step));
    for (let i = 0; i < n; i++) {
      e.y += S.vy * dt / n;
      if (e.y > CH * CELL) { e.y = CH * CELL; break; }
      if (surfNormal(e.x, e.y, SPIDER.hold + 1, solidCell)) {
        spiderSeat(e, S, solidCell, SPIDER.hold);
        S.mode = 'surf'; S.vy = 0; S.on = 0; S.rest = 0.1;
        break;
      }
    }
    return null;
  }

  if (S.mode === 'shoot') {
    const sh = S.shot;
    sh.t += sh.spd * dt;
    if (sh.t < sh.len) return null;
    // the line lands: it only holds if the rock is still there
    const hx = sh.x + sh.dx * sh.len, hy = sh.y + sh.dy * sh.len;
    const inx = hx + sh.dx * 1.2, iny = hy + sh.dy * 1.2;
    S.mode = sh.from; S.shot = null;
    if (!solidCell(Math.floor(inx / CELL), Math.floor(iny / CELL))) return null;
    const L = { ax: sh.x, ay: sh.y, bx: hx - sh.dx * SPIDER.hold, by: hy - sh.dy * SPIDER.hold,
      a0x: sh.ax0, a0y: sh.ay0, b0x: hx, b0y: hy, ain: sh.ain, bin: { x: inx, y: iny }, owner: e };
    webs.push(L);
    // an old line of this spider's goes, unless something is riding it
    const mine = webs.filter(w => w.owner === e);
    if (mine.length > Math.round(spr('spMaxLines', rnd))) {
      const old = mine.find(w => w !== S.line);
      if (old) webs.splice(webs.indexOf(old), 1);
    }
    S.mode = 'line'; S.line = L; S.u = 0; S.dir = 1;
    return 'web';
  }

  // on a line whose rock has gone: drop
  if (S.mode === 'line' && webs.indexOf(S.line) < 0) { S.mode = 'fall'; S.line = null; S.vy = 0; return null; }
  // on rock that has been dug away from under it: drop
  if (S.mode === 'surf' && !surfNormal(e.x, e.y, SPIDER.hold + 2, solidCell)) { S.mode = 'fall'; S.vy = 0; return null; }

  // resting: count down, then start a burst and decide where it goes. Nothing worth doing
  // (already there, right under it): look again shortly — never sit with no clock running
  if (S.on <= 0) {
    if ((S.rest -= dt) > 0) return null;
    S.on = spr(env.hunting ? 'spHuntOn' : 'spRoamOn', rnd);
    // this burst's own numbers
    S.spd = env.speed || spr('spSpeed', rnd); S.arrive = env.hunting ? spr('spArrive', rnd) : 3;
    S.dot = spr('spDot', rnd);
    decide();
    if (S.mode === 'shoot') return null;
    if (S.on <= 0) { S.rest = 0.1 + rnd() * 0.2; return null; }
  }
  if (S.mode === 'shoot') return null;

  const speed = (S.spd || spr('spSpeed', rnd)) * (env.speedMul || 1);
  const dist = speed * Math.min(dt, S.on);
  S.on -= dt;
  const n = Math.max(1, Math.ceil(dist / SPIDER.step));
  for (let i = 0; i < n && S.mode !== 'shoot'; i++) {
    const st = dist / n;
    if (S.mode === 'surf') {
      const tx = -S.ny * S.side, ty = S.nx * S.side;
      e.x += tx * st; e.y += ty * st;
      if (!spiderSeat(e, S, solidCell, st * 2)) {
        // stepped off the edge of nothing: curl back round toward where the rock was
        e.x -= S.nx * st * 2; e.y -= S.ny * st * 2;
        if (!spiderSeat(e, S, solidCell, st * 2)) { S.mode = 'fall'; S.vy = 0; break; }
      }
      // came round a corner and now faces the goal off the surface: look again
      const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy) || 1;
      const high = (gx * S.nx + gy * S.ny) / gd >= S.dot;
      if (high && !S.high) { S.high = true; decide(); }
      else if (!high) S.high = false;
      // there, or just walked past the closest it gets on this surface: stop
      if (gd < (S.arrive || 3) || (-S.ny * gx + S.nx * gy) * S.side < 0) { S.on = 0; break; }
    } else if (S.mode === 'line') {
      const L = S.line, len = Math.hypot(L.bx - L.ax, L.by - L.ay) || 1;
      const ux = (L.bx - L.ax) / len * S.dir, uy = (L.by - L.ay) / len * S.dir;
      // hanging: going further along would take it away from the goal
      if (!S.go && (goal.x - e.x) * ux + (goal.y - e.y) * uy <= 0) { S.on = 0; break; }
      S.u += S.dir * st / len;
      if (S.u >= 1 || S.u <= 0) {
        S.u = S.u >= 1 ? 1 : 0;
        e.x = S.u ? L.bx : L.ax; e.y = S.u ? L.by : L.ay;
        S.mode = 'surf'; S.line = null; S.go = false;
        if (!spiderSeat(e, S, solidCell, SPIDER.hold)) { S.mode = 'fall'; S.vy = 0; break; }
        decide();
        continue;
      }
      e.x = L.ax + (L.bx - L.ax) * S.u; e.y = L.ay + (L.by - L.ay) * S.u;
    }
  }
  if (S.on <= 0 && S.rest <= 0) S.rest = spr(env.hunting ? 'spHuntOff' : 'spRoamOff', rnd);
  return out;

  // where to go this burst: along the rock, onto a line, or shoot a new one
  function decide() {
    const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy);
    if (gd < (S.arrive || 3)) { S.on = 0; return; }
    const dx = gx / gd, dy = gy / gd;
    const tryLine = () => {
      let best = null, bd = spr('spGrab', rnd);
      for (const L of webs) {
        if (L === S.line) continue;
        const q = segNear(L, e.x, e.y);
        if (q.d > bd) continue;
        const len = Math.hypot(L.bx - L.ax, L.by - L.ay) || 1;
        const ux = (L.bx - L.ax) / len, uy = (L.by - L.ay) / len, al = ux * dx + uy * dy;
        if (Math.abs(al) < 0.5) continue;
        if ((al > 0 && q.u > 0.97) || (al < 0 && q.u < 0.03)) continue;   // nowhere left to go on it
        best = { L, u: q.u, dir: al > 0 ? 1 : -1 }; bd = q.d;
      }
      if (!best) return false;
      S.mode = 'line'; S.line = best.L; S.u = best.u; S.dir = best.dir;
      e.x = best.L.ax + (best.L.bx - best.L.ax) * best.u; e.y = best.L.ay + (best.L.by - best.L.ay) * best.u;
      return true;
    };
    const tryShoot = from => {
      // a roaming spider spins a new line now and then, not every hop; hunting, much more often
      if (S.webT > 0 || (!env.hunting && gd < 40)) return false;
      const a = spiderAim(e.x, e.y, dx, dy, env.reach || spr('spWeb', rnd), solidCell);
      if (!a) return false;
      let ax0 = e.x, ay0 = e.y, ain = null;
      if (from === 'surf') {
        const d = rayDist(e.x, e.y, -S.nx, -S.ny, SPIDER.feel + 4, solidCell);
        ax0 = e.x - S.nx * d; ay0 = e.y - S.ny * d;
        ain = { x: e.x - S.nx * (d + 1.2), y: e.y - S.ny * (d + 1.2) };
      }
      S.webT = spr(env.hunting ? 'spHuntWeb' : 'spRoamWeb', rnd);
      S.shot = { spd: spr('spLineSpd', rnd), x: e.x, y: e.y, dx: a.dx, dy: a.dy, len: a.len, t: 0, from, ax0, ay0, ain };
      S.mode = 'shoot';
      return true;
    };
    if (S.mode === 'surf') {
      const dot = dx * S.nx + dy * S.ny;
      S.high = dot >= (S.dot || 0.6);
      if (S.high && (tryLine() || tryShoot('surf'))) return;
      const t = -S.ny * dx + S.nx * dy;
      if (Math.abs(t) * gd < 4) { S.on = 0; return; }   // right under it already
      S.side = t > 0 ? 1 : -1;
    } else if (S.mode === 'line') {
      const L = S.line, len = Math.hypot(L.bx - L.ax, L.by - L.ay) || 1;
      const al = ((L.bx - L.ax) * dx + (L.by - L.ay) * dy) / len;
      S.go = false;
      if (Math.abs(al) > 0.3) { S.dir = al > 0 ? 1 : -1; return; }
      // the goal is off to the side of this line: another line, a new one, or the nearer end
      if (tryLine() || tryShoot('line')) return;
      const da = Math.hypot(goal.x - L.ax, goal.y - L.ay), db = Math.hypot(goal.x - L.bx, goal.y - L.by);
      S.dir = db < da ? 1 : -1;
      S.go = true;
    }
  }
}

// ---- the rat (Rotta) and its nest (Rotanpesä) ----
// A rat runs the rock surfaces the way the spider does (surfSeat keeps it sat on the rock,
// sliding round bumps), in short bursts with rests between, but it has no silk: when where it
// wants to be is up off the surface and near enough, it jumps there, and it drops off
// anything it finds itself hanging under. Its nest is a room in the rock at the end of a
// tunnel too thin for you (path, room first, mouth last); in there it just follows the path.
// What it wants (you, loose gold, home, or its roam spot) is the Game's call: env.goal.
// env.home: wants to go in, so reaching the mouth takes it down the tunnel. Returns 'home'
// the moment it reaches the nest room, 'out' as it comes out of the hole, 'jump' on a jump.
// Pure; the numbers are Dev ranges (RA_KNOBS).
const RAT = { hold: 3.5, feel: 9, step: 1, fall: 900, ceil: 0.55, tunnel: 0.6 };
// v95: can a rat stand here? Rock under it or beside it (the nearest rock not overhead —
// that's a ceiling, and it drops off those), or a web line under its feet.
// (The reach is generous: a rat running a path rides a little off bumpy rock, and a dip in
// the floor isn't a cliff. Open air means nothing within a rat-and-a-half.)
function ratFooting(x, y, solidCell, onWeb) {
  const n = surfNormal(x, y, RAT.hold + 5, solidCell);
  return (n && n.py <= RAT.ceil) || !!(onWeb && onWeb(x, y));
}
// a hop that lands on `goal`: time of flight from how far, the lift to make up the drop.
// Higher and higher arcs until one clears the rock (round the edge of a slab, not into it).
// Sets the rat flying and returns 'jump', or null if no arc gets there.
function ratJump(e, S, goal, env, rnd) {
  const solidCell = env.solidCell, gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy);
  const v = kr('raJump', rnd), cap = v * 1.4, x0 = e.x + S.nx * 1.5, y0 = e.y + S.ny * 1.5;
  for (const T of [Math.max(0.18, Math.min(0.6, gd / v)), 0.4, 0.55, 0.7]) {
    let vx = gx / T, vy = gy / T - 0.5 * RAT.fall * T;
    const sp = Math.hypot(vx, vy);
    if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
    let ok = true;
    for (let k = 1; k <= 16 && ok; k++) {
      const t = T * k / 16, px = x0 + vx * t, py = y0 + vy * t + 0.5 * RAT.fall * t * t;
      if (Math.hypot(px - goal.x, py - goal.y) < RAT.hold + 3) break;
      for (const [ox, oy] of [[0, 0], [2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]])
        if (solidCell(Math.floor((px + ox) / CELL), Math.floor((py + oy) / CELL))) { ok = false; break; }
    }
    if (!ok) continue;
    S.vx = vx; S.vy = vy; e.x = x0; e.y = y0;
    S.mode = 'air'; S.on = 0; S.rest = 0.05;
    if (Math.abs(S.vx) > 1) S.face = S.vx > 0 ? 1 : -1;
    return 'jump';
  }
  return null;
}
// v95: roaming rats spread out. A push away from every other loose rat nearer than `D`,
// harder the closer it is (0 at D, 1 on top of it, summed). Pure; the Game adds it to the
// rat's roam spot, so the pack fans out round the nest instead of moving as one lump.
function ratSpread(e, others, D) {
  let x = 0, y = 0;
  for (const o of others) {
    if (o === e) continue;
    const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy);
    if (d >= D) continue;
    const f = 1 - d / D;
    if (d > 0.01) { x += dx / d * f; y += dy / d * f; }
    else { const a = e.phase != null ? e.phase : 1; x += Math.cos(a) * f; y += Math.sin(a) * f; }
  }
  return { x, y };
}
// the point `d` along a path of points, and which way it's heading there
function pathAt(P, d) {
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], l = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= l || i === P.length - 1) {
      const u = l ? Math.max(0, Math.min(1, d / l)) : 0;
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dx: (b.x - a.x) / (l || 1), dy: (b.y - a.y) / (l || 1) };
    }
    d -= l;
  }
  return { x: P[0].x, y: P[0].y, dx: 0, dy: -1 };
}
const pathLen = P => { let l = 0; for (let i = 1; i < P.length; i++) l += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y); return l; };

function ratStep(e, env, dt) {
  const { solidCell, rnd } = env;
  const S = e.ra || (e.ra = { mode: 'air', vx: 0, vy: 0, nx: 0, ny: -1, on: 0, rest: rnd() * 0.3, side: 1, face: 1, s: 0, dir: 1, wait: 0 });
  const goal = env.goal;
  const P = env.path, speed = (env.speed || kr('raSpeed', rnd)) * (env.speedMul || 1);

  if (S.noT > 0) S.noT -= dt;
  if (S.mode === 'tunnel') {
    if (!P) { S.mode = 'air'; S.vx = S.vy = 0; return null; }
    if (S.wait > 0) { S.wait -= dt; return null; }
    const L = S.len || (S.len = pathLen(P));
    S.s += S.dir * speed * RAT.tunnel * dt;
    if (S.s <= 0) {                       // down in the nest
      S.s = 0; S.dir = 1; S.wait = kr('raNestRest', rnd);
      e.x = P[0].x; e.y = P[0].y;
      return 'home';
    }
    if (S.s >= L) {                       // out of the hole
      const m = P[P.length - 1];
      e.x = m.x; e.y = m.y;
      S.mode = 'surf'; S.on = 0; S.rest = 0.05 + rnd() * 0.2;
      if (!surfSeat(e, S, solidCell, RAT.hold, RAT.hold, RAT.feel)) { S.mode = 'air'; S.vx = S.vy = 0; }
      return 'out';
    }
    const q = pathAt(P, S.s);
    e.x = q.x; e.y = q.y; S.face = q.dx * S.dir >= 0 ? 1 : -1;
    S.nx = 0; S.ny = -1;
    return null;
  }

  // at the hole, wanting in: down the tunnel (landing on it counts too)
  if (env.home && P) {
    const m = P[P.length - 1];
    if (Math.hypot(m.x - e.x, m.y - e.y) < 12) { S.mode = 'tunnel'; S.len = pathLen(P); S.s = S.len; S.dir = -1; S.wait = 0; S.vx = S.vy = 0; return null; }
  }

  // with a way found (env.follow: goal is a waypoint off navField), it just runs the way,
  // pushed out of the rock and settled onto floors as it goes, so it can't wedge or fall
  // off anything: the path already knows what a rat can climb
  if (env.follow && goal && S.mode !== 'air') {             // (mid-jump or falling: physics first)
    if (S.mode !== 'path') { S.mode = 'path'; S.vx = S.vy = 0; }
    const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy), go = Math.min(gd, speed * dt);
    const rock = (x, y) => solidCell(Math.floor(x / CELL), Math.floor(y / CELL));
    // v95: no walking on thin air. It needs rock under or beside it (not just overhead) or a
    // web line to stand on; the way across or up through open air is a jump, and off an edge
    // it falls. (Before, a path through air was run like floor, so rats floated.)
    if (!ratFooting(e.x, e.y, solidCell, env.onWeb)) { S.mode = 'air'; S.vx = gd ? gx / gd * speed * 0.4 : 0; S.vy = 0; return null; }
    if (env.air && gd > RAT.hold + 2) {                  // only when the next step really has nothing under it
      const f = Math.min(gd, 6) / gd;
      if (!ratFooting(e.x + gx * f, e.y + gy * f, solidCell, env.onWeb)) { const j = ratJump(e, S, goal, env, rnd); if (j) return j; }
    }
    if (gd > 0.01) {                       // never a step into the rock (small steps, so not over a thin wall either)
      const k = Math.max(1, Math.ceil(go / 0.8)), mx = gx / gd * go / k, my = gy / gd * go / k;
      let moved = false;
      for (let q = 0; q < k; q++) {
        if (!rock(e.x + mx, e.y + my)) { e.x += mx; e.y += my; moved = true; }
        else if (!rock(e.x + mx, e.y)) { e.x += mx; moved = true; }
        else if (!rock(e.x, e.y + my)) { e.y += my; moved = true; }
        else break;
        // walked off the edge of its footing: it falls from here, carried on by its run
        if (!ratFooting(e.x, e.y, solidCell, env.onWeb)) { S.mode = 'air'; S.vx = gx / gd * speed * 0.6; S.vy = 0; return null; }
      }
      if (Math.abs(gx) > 0.5) S.face = gx > 0 ? 1 : -1;
      // boxed in on that line: a little hop to come at it again
      S.blockT = moved ? 0 : (S.blockT || 0) + dt;
      if (S.blockT > 0.3) { S.blockT = 0; S.mode = 'air'; S.vx = (rnd() - 0.5) * 120; S.vy = -160; return null; }
    }
    const n = surfNormal(e.x, e.y, RAT.feel, solidCell);
    if (n) {
      if (n.d < RAT.hold && n.d > 0.01 && !rock(e.x + n.px * (RAT.hold - n.d), e.y + n.py * (RAT.hold - n.d))) {
        e.x += n.px * (RAT.hold - n.d); e.y += n.py * (RAT.hold - n.d);
      } else if (n.d >= RAT.hold && n.py < -0.5 && n.d < RAT.hold + 7 && gy > -2) {   // not climbing: down onto the floor
        const m = Math.min(n.d - RAT.hold, 80 * dt); e.x -= n.px * m; e.y -= n.py * m;
      }
      S.nx = n.x; S.ny = n.y; S.py = n.py;
    } else { S.nx = 0; S.ny = -1; S.py = -1; }
    return null;
  }
  if (S.mode === 'path') { S.mode = 'air'; S.vx = S.vy = 0; }   // lost the way: plain physics again

  if (S.mode === 'air') {
    S.vy = Math.min(S.vy + RAT.fall * dt, 600);
    const n = Math.max(1, Math.ceil(Math.hypot(S.vx, S.vy) * dt / RAT.step));
    for (let i = 0; i < n; i++) {
      e.x += S.vx * dt / n; e.y += S.vy * dt / n;
      if (e.y > CH * CELL) { e.y = CH * CELL; break; }
      // falling onto a web line with somewhere to be: it catches hold and runs on along it
      if (S.vy > 0 && env.follow && env.onWeb && env.onWeb(e.x, e.y)) { S.mode = 'path'; S.vx = S.vy = 0; return 'land'; }
      const s = surfNormal(e.x, e.y, RAT.hold + 0.5, solidCell);
      if (!s) continue;
      if (s.py > RAT.ceil) {              // bumped its head (the nearest rock is above): out, and on down
        e.x += s.px * (RAT.hold + 0.5 - s.d); e.y += s.py * (RAT.hold + 0.5 - s.d);
        S.vy = Math.max(S.vy, 0); S.vx *= 0.5;
        continue;
      }
      surfSeat(e, S, solidCell, RAT.hold, RAT.hold, RAT.feel);
      S.mode = 'surf'; S.vx = S.vy = 0; S.on = 0; S.rest = Math.min(S.rest, 0.05);
      return 'land';
    }
    return null;
  }

  // on rock that has been dug out from under it, or hanging off a ceiling: drop
  // (a ceiling is where the nearest rock is overhead: the averaged normal misreads a crack)
  if (!surfNormal(e.x, e.y, RAT.hold + 2, solidCell) || S.py > RAT.ceil) { S.mode = 'air'; S.vx = S.vy = 0; return null; }

  // Roaming it scurries in bursts with rests between; with a job on (you, gold, home) it
  // runs flat out and only stops to pick a new way (raHuntOff is 0 by default)
  if (S.on <= 0) {
    if ((S.rest -= dt) > 0) return null;
    S.on = kr(env.hunting ? 'raHuntOn' : 'raRoamOn', rnd);
    S.spd = speed; S.arrive = env.arrive != null ? env.arrive : 3;
    S.dot = kr('raDot', rnd);
    const j = decide();
    if (j) return j;
    if (S.on <= 0) { S.rest = env.hunting ? 0.03 : 0.1 + rnd() * 0.2; return null; }
  }
  const dist = S.spd * Math.min(dt, S.on);
  S.on -= dt;
  const n = Math.max(1, Math.ceil(dist / RAT.step));
  for (let i = 0; i < n; i++) {
    const st = dist / n, tx = -S.ny * S.side, ty = S.nx * S.side;
    e.x += tx * st; e.y += ty * st;
    if (!surfSeat(e, S, solidCell, st * 2, RAT.hold, RAT.feel)) {
      e.x -= S.nx * st * 2; e.y -= S.ny * st * 2;
      if (!surfSeat(e, S, solidCell, st * 2, RAT.hold, RAT.feel)) { S.mode = 'air'; S.vx = tx * S.spd * 0.5; S.vy = 0; break; }
    }
    // walked up under an overhang: it drops, and won't try that way again for a bit
    if (S.py > RAT.ceil) { S.mode = 'air'; S.vx = tx * S.spd * 0.3; S.vy = 0; S.noSide = S.side; S.noT = 1.5; break; }
    if (Math.abs(tx) > 0.2) S.face = tx > 0 ? 1 : -1;
    if (!goal) continue;
    const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy) || 1;
    if (gd < S.arrive || (-S.ny * gx + S.nx * gy) * S.side < 0) { S.on = 0; break; }
    // came round onto a surface where it's now up off the rock: look again (maybe jump)
    const high = (gx * S.nx + gy * S.ny) / gd >= S.dot;
    if (high && !S.high) { S.high = true; const j = decide(); if (j) return j; if (S.on <= 0) break; }
    else if (!high) S.high = false;
  }
  if (S.on <= 0 && S.rest <= 0) S.rest = kr(env.hunting ? 'raHuntOff' : 'raRoamOff', rnd);
  return null;

  // this burst: run along the rock toward the goal, or jump at it if it's up off the rock
  function decide() {
    if (!goal) { S.on = 0; return null; }
    const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy);
    if (gd < S.arrive) { S.on = 0; return null; }
    const dx = gx / gd, dy = gy / gd, t = -S.ny * dx + S.nx * dy;
    // the way it wants to run is the way it just fell off an overhang: jump for it if it can, else turn back
    const barred = S.noT > 0 && (t > 0 ? 1 : -1) === S.noSide;
    if ((barred || (env.jump !== false && dx * S.nx + dy * S.ny >= S.dot)) && gd < kr('raJumpR', rnd)) {
      const j = ratJump(e, S, goal, env, rnd);
      if (j) return j;
    }
    if (barred) { S.side = -S.noSide; return null; }
    if (Math.abs(t) * gd < 2) { S.on = 0; return null; }
    S.side = t > 0 ? 1 : -1;
    return null;
  }
}

// ---- the jellyfish (Myrkkymeduusa) ----
// Swims the way a jelly does. Its head (the top of the bell) is its heading, and the
// heading turns no faster than the turn-rate knob. Now and then it pulses: a short, hard
// push along wherever the head points — but only once the head is near enough on where
// it's going, so a big turn is made first, drifting. Then it coasts, water drag bleeding
// the speed away and a little sinking, until the next pulse. Roaming it heads for a roam
// spot round home (roamStep); with aggro it heads for you until it's in spitting range,
// then hangs there turning its head onto you. The spitting is the Game's job: jellyStep
// reports S.inRange and S.aimed. S.shape is the bell, 1 thin (just pushed, fast) to 0 flat
// (slowed, stopped), weighted to the thin side so it only flattens right near the stop.
// The tentacles are a few points each, dragged behind the rim follow-the-leader style.
// Pure, so the logic suite runs it on a hand-made grid; the numbers are Dev ranges (JE_KNOBS).
const JELLY = { hitR: 0.8 };            // collision radius, × body r

// the bell at shape s (0 flat .. 1 thin) and squash q (how much the shape changes), body r.
// top is the head end, rim the open end, in the jelly's own frame (head up). Shared by the
// tentacle roots (jellyStep) and the sprite (drawJelly), so the two always agree.
function jellyBell(r, s, q) {
  const t = Math.max(0, Math.min(1.5, s * q));
  const w = r * (1.15 - 0.36 * t), h = r * (0.95 + 0.6 * t);
  return { w, h, rw: w * (0.96 - 0.24 * t), top: -h * 0.62, rim: h * 0.38 };
}

// One frame of one jelly. env: { solidCell, goal: {x,y}, hunting, rnd, speedMul, rangeMul,
// stay }. stay(x, y), if given, is where it may swim (the natural zones): its roam spot keeps
// inside, and from inside it never pulses toward a spot its glide would carry it out of —
// hunting you into a built-up corridor, it hangs at the edge and spits from there.
// Returns 'pulse' on the frame a pulse starts, else null.
function jellyStep(e, env, dt) {
  const { solidCell, rnd } = env;
  let S = e.je;
  if (!S) {
    // looks are rolled once, as fractions of their knob ranges (kru), so each jelly is its
    // own but a Dev-panel change still shows on every one at once
    S = e.je = { hd: -Math.PI / 2 + (rnd() - 0.5) * 0.6, vx: 0, vy: 0, push: 0, pushA: 0,
      rest: rnd() * 1.5, shape: 0, vref: Math.max(1, kr('jeRoamPush', rnd)), t: rnd() * 10, tent: [],
      u: { thin: rnd(), sq: rnd(), len: rnd(), wave: rnd(), sag: rnd(), glow: rnd(), glowR: rnd(), flare: rnd(), col: rnd(), plant: rnd() } };
    feel(false);
    const nt = Math.round(kr('jeTents', rnd));
    for (let i = 0; i < nt; i++) {
      const T = [], nv = Math.max(2, Math.round(kr('jeVerts', rnd)));
      for (let j = 0; j < nv; j++) T.push({ x: NaN, y: NaN });        // laid out behind the rim below
      S.tent.push(T);
    }
  }
  const mul = env.speedMul || 1;
  let hunt = !!(env.hunting && env.goal);
  S.t += dt;
  roamStep(S, e, dt, rnd, 'je', env.stay);
  // strayed into a built-up zone: it forgets you and heads home
  const lost = !!(env.stay && !env.stay(e.x, e.y));
  if (lost) hunt = false;
  if (hunt && !S.range) S.range = kr('jeRange', rnd);
  if (!hunt) S.range = 0;
  const goal = hunt ? env.goal : lost ? { x: e.hx, y: e.hy } : { x: S.rx, y: S.ry };
  const gx = goal.x - e.x, gy = goal.y - e.y, gd = Math.hypot(gx, gy);
  const range = S.range * (env.rangeMul || 1);
  // turn, no faster than the limit. Idle with nowhere to be, it rights itself, head up
  const want = !hunt && gd < 12 ? -Math.PI / 2 : Math.atan2(gy, gx);
  S.hd = turnToward(S.hd, want, S.turn * Math.PI / 180 * mul * dt);
  const off = Math.abs(angDiff(want, S.hd)) * 180 / Math.PI;
  S.inRange = hunt && gd < range;
  S.aimed = hunt && off < S.aimTol;
  let out = null;
  if (S.push > 0) {
    // mid-pulse: thrust along the head (the whole pulse adds up to the rolled push speed)
    const a = S.pushA * mul * Math.min(dt, S.push);
    S.vx += Math.cos(S.hd) * a; S.vy += Math.sin(S.hd) * a;
    S.push -= dt;
  } else if ((S.rest -= dt) <= 0) {
    // ready: pulse only if there's somewhere to go and the head is (nearly) on it
    const v = (hunt ? gd > range : gd > 10) && off < S.tol ? kr(hunt ? 'jeHuntPush' : 'jeRoamPush', rnd) : 0;
    // where this pulse would glide it to (drag bleeds speed exponentially, so a speed v
    // carries it v / drag), no further than where it's going, plus the drift it already has
    const dg = Math.max(0.1, S.drag), glide = Math.min(gd, 160, Math.max(20, v / dg));
    const stay = env.stay, out0 = stay && !lost &&
      !stay(e.x + Math.cos(S.hd) * glide + S.vx / dg, e.y + Math.sin(S.hd) * glide + S.vy / dg);
    if (v > 0 && !out0) {
      const pt = kr('jePushT', rnd);
      S.push = pt; S.pushA = v / Math.max(pt, 0.001); S.vref = Math.max(v, 1);
      S.rest = kr(hunt ? 'jeHuntRest' : 'jeRoamRest', rnd);
      feel(hunt);
      out = 'pulse';
    } else S.rest = 0.05 + rnd() * 0.1;       // look again shortly
  }
  // the water: drag slows it (exponentially — quick at first, then a long glide) and it sinks
  const k = Math.exp(-S.drag * dt);
  S.vx *= k; S.vy = S.vy * k + S.sink * dt;
  flyMove(e, S, dt, e.r * JELLY.hitR, solidCell, S.bounce);
  // the bell: thin at speed, flat at rest, weighted to the thin side
  const f = Math.min(1, Math.hypot(S.vx, S.vy) / S.vref);
  S.shape = 1 - Math.pow(1 - f, kru('jeThin', S.u.thin));
  // tentacles: the first point rides the rim, the rest follow at a fixed spacing, swaying
  // sideways a little and drooping, so they stream out behind a push and hang when it rests
  const B = jellyBell(e.r, S.shape, kru('jeSquash', S.u.sq));
  const c = Math.cos(S.hd), s = Math.sin(S.hd), n = S.tent.length;
  const len = kru('jeTentLen', S.u.len), wave = kru('jeWave', S.u.wave), sag = kru('jeSag', S.u.sag);
  for (let i = 0; i < n; i++) {
    const T = S.tent[i], seg = len / (T.length - 1);
    const lx = n > 1 ? (i / (n - 1) - 0.5) * 1.4 * B.rw : 0;
    T[0].x = e.x - lx * s - B.rim * c; T[0].y = e.y + lx * c - B.rim * s;   // (lx, rim) in the jelly's frame
    if (isNaN(T[1].x)) for (let j = 1; j < T.length; j++) { T[j].x = T[0].x - c * seg * j; T[j].y = T[0].y - s * seg * j; }
    for (let j = 1; j < T.length; j++) {
      const q = T[j], pq = T[j - 1];
      const sw = Math.sin(S.t * 3.1 + i * 0.5 - j * 0.9) * wave * dt * j / (T.length - 1);   // near in step, so they don't cross
      q.x -= s * sw; q.y += c * sw + sag * dt;
      const dx = q.x - pq.x, dy = q.y - pq.y, d = Math.hypot(dx, dy) || 1;
      q.x = pq.x + dx / d * seg; q.y = pq.y + dy / d * seg;
    }
  }
  return out;

  // this pulse's own feel: how fast it turns, how true it must face, drag, sink, bounce, aim
  function feel(h) {
    S.turn = kr('jeTurn', rnd); S.tol = kr('jePushTol', rnd); S.drag = kr('jeDrag', rnd);
    S.sink = kr('jeSink', rnd); S.bounce = kr('jeBounce', rnd); S.aimTol = kr('jeAimTol', rnd);
    S.range = h ? kr('jeRange', rnd) : 0;
  }
}

// Does the line from (ax, ay) to (bx, by) pass through the box x0..x1, y0..y1? Clips the
// line to the box one edge at a time (Liang–Barsky) — exact, so a thin tentacle crossing
// a corner of you counts, and one passing close by doesn't.
function segHitsBox(ax, ay, bx, by, x0, y0, x1, y1) {
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dy, ay - y0) && clip(dy, y1 - ay);
}
// where a jelly's tentacles cross the box (the middle of the first segment that does), or null
function tentacleTouch(S, x0, y0, x1, y1) {
  if (!S || !S.tent) return null;
  for (const T of S.tent) for (let j = 1; j < T.length; j++) {
    const a = T[j - 1], b = T[j];
    if (!isNaN(a.x) && segHitsBox(a.x, a.y, b.x, b.y, x0, y0, x1, y1)) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  return null;
}

// ---- the jellyfish's plant glow ----
// Green vegetation near a jelly glows and twinkles in its colour, built the way the owner
// (a VFX compositor) laid it out: take the art round the jelly, pull the green channel,
// levels it so only the top 25% of the floor's green is left (black point at 75% of the
// white point), × a ramp from the jelly out to its reach, × an animated soft noise (the
// twinkle), × the jelly's glow colour, and add that on top of the level. One change to a
// straight green pull: pixels where green isn't the strongest channel are held out —
// otherwise the gold seams (255,210,60) and pale flowers, bright in green too, set the
// white point and take the top 25%, and the moss gets none of it.
const TW_N = 64;
const TW_TILE = (() => {
  let q = 12345; const a = new Float32Array(TW_N * TW_N);
  for (let i = 0; i < a.length; i++) { q = (q * 16807) % 2147483647; a[i] = q / 2147483647; }
  return a;
})();
// smooth value noise, 0..1, repeating every 64
function twNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % TW_N) + TW_N) % TW_N, y0 = ((yi % TW_N) + TW_N) % TW_N, x1 = (x0 + 1) % TW_N, y1 = (y0 + 1) % TW_N;
  const a = TW_TILE[y0 * TW_N + x0], b = TW_TILE[y0 * TW_N + x1], c = TW_TILE[y1 * TW_N + x0], d = TW_TILE[y1 * TW_N + x1];
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
// the twinkle at world (x, y), time t: two layers of that noise drifting past each other,
// multiplied, the contrast pushed so it reads as soft points coming and going. 0..1.
function twinkle(x, y, t, size) {
  const u = x / size, v = y / size;
  const n = twNoise(u + t * 0.37, v - t * 0.23) * twNoise(u * 1.7 - t * 0.31 + 17, v * 1.7 + t * 0.29 + 5);
  const k = Math.min(1, Math.max(0, (n - 0.12) / 0.45));
  return k * k * (3 - 2 * k);
}
// the white point: the floor's brightest green (its 99.9th percentile, so a stray pixel
// can't set it) among mostly-opaque pixels where green is the strongest channel. A faint
// anti-aliased edge (alpha 1/255 comes back as junk like 0,255,0) must not count.
function plantWhite(...datas) {
  const hist = new Uint32Array(256);
  let n = 0;
  for (const d of datas) if (d) for (let i = 0; i < d.length; i += 4)
    if (d[i + 3] >= 128 && d[i + 1] >= d[i] && d[i + 1] >= d[i + 2]) { hist[d[i + 1]]++; n++; }
  if (!n) return 255;
  for (let g = 0, c = 0; g < 256; g++) { c += hist[g]; if (c >= n * 0.999) return Math.max(1, g); }
  return 255;
}
// The comp for one box of art (RGBA `art`, w×h, each pixel `o.px` world units, top-left
// at world (o.ox, o.oy)) lit by a jelly at (o.cx, o.cy): writes out (RGBA, same size) with
// the colour o.rgb at alpha = key × ramp × twinkle × strength. o.lit(x, y), if given, holds
// out ground you haven't seen. Returns how many pixels glow.
function plantGlowFill(out, art, w, h, o) {
  const black = o.white * (1 - o.top), span = Math.max(1, o.white - black);
  const r = o.rgb[0], g = o.rgb[1], b = o.rgb[2];
  let any = 0;
  for (let y = 0; y < h; y++) {
    const wy = o.oy + (y + 0.5) * o.px, dy = wy - o.cy;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, G = art[i + 1];
      out[i + 3] = 0;
      if (!art[i + 3] || G <= black || G < art[i] || G < art[i + 2]) continue;      // the green key
      const wx = o.ox + (x + 0.5) * o.px, dx = wx - o.cx;
      const ramp = 1 - Math.sqrt(dx * dx + dy * dy) / o.reach;                        // × the ramp
      if (ramp <= 0 || (o.lit && !o.lit(wx, wy))) continue;
      const a = Math.min(1, (G - black) / span) * ramp * twinkle(wx, wy, o.t, o.size) * o.strength * art[i + 3] / 255;
      if (a < 0.004) continue;
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = Math.min(255, a * 255);
      any++;
    }
  }
  return any;
}

// ---- sprites ----
// Everything is drawn from primitives at world scale (the player is 12x22 units),
// so it stays crisp at any zoom and there are no images to load.

// A gun, grip at the origin, barrel down +x. Scaled so the same drawing works for
// the one in your hands and the little one lying on the cave floor.
function drawGun(ctx, x, y, ang, sc, accent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (Math.cos(ang) < 0) ctx.scale(1, -1);     // aiming left: flip, don't hang upside down
  ctx.scale(sc, sc);
  ctx.fillStyle = '#20242c';                    // stock and grip
  rr(ctx, -6.5, -4.6, 4.5, 3.6, 1.2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-1.4, -1.2); ctx.lineTo(1.8, -1.2); ctx.lineTo(0.9, 4.6); ctx.lineTo(-2.2, 4.2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3c424e';                    // magazine
  ctx.beginPath();
  ctx.moveTo(2.2, -1); ctx.lineTo(5, -1); ctx.lineTo(4.4, 3.4); ctx.lineTo(1.8, 3.4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4a515f';                    // receiver
  rr(ctx, -4.4, -5.2, 10.5, 4.4, 1.3); ctx.fill();
  ctx.fillStyle = '#5f6878';                    // barrel
  rr(ctx, 5.5, -4.4, 7.5, 2.4, 1); ctx.fill();
  ctx.fillStyle = '#343a45';                    // sight
  rr(ctx, 0.5, -6.6, 2.4, 1.6, 0.6); ctx.fill();
  ctx.fillStyle = accent || COL.bullet;         // muzzle and a flash of the gun's colour
  rr(ctx, 12.4, -5, 1.8, 3.6, 0.7); ctx.fill();
  rr(ctx, -3.4, -4.4, 2.6, 2.6, 0.8); ctx.fill();
  ctx.restore();
}

// The runner: jetpack on the back, sealed helmet, legs that actually move.
function drawRunner(ctx, x, y, w, hh, face, gait, air, jet, flash) {
  const suit = flash ? '#ffffff' : '#ff5a36';
  const dark = flash ? '#d8dde6' : '#c33a1f';
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.scale(face, 1);
  // jetpack
  ctx.fillStyle = '#2b3039';
  rr(ctx, -6.2, 6.5, 4.4, 9, 1.6); ctx.fill();
  ctx.fillStyle = '#ff8a1f';
  rr(ctx, -5.6, 8.4, 3.2, 1.4, 0.6); ctx.fill();
  ctx.fillStyle = '#1b1f26';
  rr(ctx, -5.4, 15, 3, 2.2, 0.8); ctx.fill();
  if (jet > 0) {                                  // the nozzle glows when it is lit
    ctx.fillStyle = COL.flame2;
    rr(ctx, -5.2, 16.4, 2.6, 1.6, 0.8); ctx.fill();
  }
  // legs: a stride on the ground, tucked up in the air
  ctx.fillStyle = dark;
  const swing = air ? -1.4 : gait * 2.6;
  const lift = air ? 2 : 0;
  rr(ctx, -3.4 + swing, 15.5 - lift * 0.5, 3, 6.5 - lift, 1.2); ctx.fill();
  rr(ctx, 0.4 - swing, 15.5 - lift, 3, 6.5 - lift * 0.6, 1.2); ctx.fill();
  ctx.fillStyle = '#24282f';                      // boots
  rr(ctx, -3.6 + swing, 20.2 - lift * 1.2, 3.6, 1.8, 0.7); ctx.fill();
  rr(ctx, 0.2 - swing, 20.2 - lift * 1.4, 3.6, 1.8, 0.7); ctx.fill();
  // torso
  ctx.fillStyle = suit;
  rr(ctx, -3.8, 6, 7.6, 10.5, 2.6); ctx.fill();
  ctx.fillStyle = dark;
  rr(ctx, -3.8, 12.4, 7.6, 2.2, 1); ctx.fill();   // belt
  // arm reaching for the gun
  ctx.fillStyle = suit;
  rr(ctx, 1, 8.4, 5, 2.8, 1.3); ctx.fill();
  // helmet
  ctx.fillStyle = flash ? '#ffffff' : '#d7dbe3';
  ctx.beginPath(); ctx.arc(0, 4.4, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d2733';                      // visor
  rr(ctx, -0.6, 1.9, 4.6, 4.2, 1.8); ctx.fill();
  ctx.fillStyle = 'rgba(126,214,255,0.75)';       // glint
  rr(ctx, 1.4, 2.7, 1.8, 1.4, 0.6); ctx.fill();
  ctx.restore();
}

// The torch in the runner's free hand. `flick` is the very same number the lamp is drawn
// with, so the flame and the light it throws gutter together and the cave reads as
// torchlight rather than as a dimmer switch. The embers are the loop's particles.
// A teardrop of fire: a round base at (bx, by) of radius r, drawn out to a point at (tx, ty).
// The tip is wherever the flame is being dragged, so one shape covers upright and leaning.
function flameDrop(ctx, bx, by, tx, ty, r) {
  const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const px = -uy, py = ux, a = Math.atan2(py, px);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.quadraticCurveTo(bx + px * r * 1.15 + ux * L * 0.35, by + py * r * 1.15 + uy * L * 0.35, bx + px * r, by + py * r);
  ctx.arc(bx, by, r, a, a + Math.PI);
  ctx.quadraticCurveTo(bx - px * r * 1.15 + ux * L * 0.35, by - py * r * 1.15 + uy * L * 0.35, tx, ty);
  ctx.fill();
}
// The flame itself, three layers, its tip pushed by (lx, ly) — the drag of moving — and a
// small lick of its own. s scales the whole thing (the wall torches are smaller).
function drawFlame(ctx, fx, fy, lx, ly, s, flick, time) {
  const wob = Math.sin(time * 17) * 0.6 + Math.sin(time * 29) * 0.35;
  const h = 9.5 * s * (0.85 + 0.2 * flick);
  ctx.fillStyle = COL.flame;
  ctx.globalAlpha = 0.9;
  flameDrop(ctx, fx, fy, fx + lx * s + wob * s, fy - h + ly * s, 2.9 * s);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COL.flame2;
  flameDrop(ctx, fx, fy + 0.3 * s, fx + (lx * 0.6 + wob * 0.5) * s, fy - h * 0.6 + ly * 0.6 * s, 1.7 * s);
  ctx.fillStyle = '#fff6d8';
  flameDrop(ctx, fx, fy + 0.6 * s, fx + lx * 0.3 * s, fy - h * 0.28 + ly * 0.3 * s, 0.8 * s);
}
// A soft warm glow at (x, y): additive, so it brightens whatever is under it. Used for the
// halo round a flame and for the torch's small second light round the player.
function glowAt(ctx, x, y, r, a, rgb) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
  g.addColorStop(0.45, 'rgba(' + rgb + ',' + (a * 0.4) + ')');
  g.addColorStop(1, 'rgba(' + rgb + ',0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// The torch in the runner's free hand. `flick` is the very same number the lamp is drawn
// with, so the flame and the light it throws gutter together and the cave reads as
// torchlight rather than as a dimmer switch. (lx, ly) drags the flame about as you move.
function drawTorch(ctx, x, y, face, flick, embers, lx, ly, time) {
  const fx = x + face * 1.6, fy = y - 7;           // the flame rides above the fist
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5b4630'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(x, y + 2.5); ctx.lineTo(fx, fy); ctx.stroke();
  ctx.strokeStyle = '#8a6b45'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y + 2.5); ctx.lineTo(fx, fy); ctx.stroke();
  drawFlame(ctx, fx, fy - 1, lx, ly, 1, flick, time);
  ctx.restore();
  for (const q of embers) {
    ctx.globalAlpha = Math.max(0, q.life / q.max) * 0.85;
    ctx.fillStyle = q.c;
    ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
  }
  ctx.globalAlpha = 1;
}
// A smaller torch in an iron bracket on the wall, either side of a portal or a room's prize.
// Its flame sways a little on its own; ph keeps neighbours out of step.
function drawSconce(ctx, x, y, time, ph) {
  const s = 0.72, fl = 0.9 + 0.1 * Math.sin(time * 13 + ph) * Math.sin(time * 7.3 + ph * 2);
  ctx.save();
  ctx.fillStyle = '#2b2a30';
  ctx.fillRect(x - 2.5, y + 5, 5, 2);               // the wall plate
  ctx.fillRect(x - 0.8, y + 1, 1.6, 5);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5b4630'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 3); ctx.stroke();
  ctx.fillStyle = '#3a3840';
  ctx.fillRect(x - 2.2, y - 3.5, 4.4, 2);           // the cup
  drawFlame(ctx, x, y - 4, Math.sin(time * 1.9 + ph) * 1.2, 0, s, fl, time + ph);
  ctx.restore();
}

// The enemies, one sprite per body. Every one of them takes the same colour set
// ({ a main, b dark, c light, eye }) so a creature's identity is carried by shape and
// colour together, and a flash on hit is the same white for all of them.
//
// The drone: a hovering gunner with one big eye that follows you around.
function drawDrone(ctx, x, y, r, lx, ly, time, phase, flash, col) {
  const shell = flash ? '#f4f0ff' : col.b;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lx * 0.22);
  // thruster wash underneath
  const puff = 0.55 + 0.25 * Math.sin(time * 9 + phase);
  ctx.globalAlpha = 0.3 * puff;
  ctx.fillStyle = col.a;
  ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * 0.45, r * 0.8 * puff, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  // stubby fins, drawn first so they read as sticking out of the hull
  ctx.fillStyle = flash ? '#e6e0f5' : col.b;
  rr(ctx, -r * 1.52, -r * 0.4, r * 0.62, r * 0.9, r * 0.22); ctx.fill();
  rr(ctx, r * 0.9, -r * 0.4, r * 0.62, r * 0.9, r * 0.22); ctx.fill();
  rr(ctx, -r * 0.34, r * 0.5, r * 0.68, r * 0.5, r * 0.18); ctx.fill();    // vent
  // hull
  ctx.fillStyle = shell;
  rr(ctx, -r * 1.05, -r * 0.78, r * 2.1, r * 1.5, r * 0.62); ctx.fill();
  ctx.strokeStyle = flash ? '#ffffff' : col.a;
  ctx.lineWidth = r * 0.14;
  rr(ctx, -r * 1.05, -r * 0.78, r * 2.1, r * 1.5, r * 0.62); ctx.stroke();
  ctx.fillStyle = flash ? '#ffffff' : col.c;
  rr(ctx, -r * 0.72, -r * 0.7, r * 1.44, r * 0.46, r * 0.22); ctx.fill();  // canopy
  ctx.restore();
  // the eye sits in the hull and swivels to keep you in view
  const ex = x + lx * r * 0.34, ey = y + ly * r * 0.26;
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = col.a;
  ctx.beginPath(); ctx.arc(ex, ey, r * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = flash ? '#ffffff' : col.eye;
  ctx.beginPath(); ctx.arc(ex, ey, r * 0.36, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1526';
  ctx.beginPath(); ctx.arc(ex + lx * r * 0.15, ey + ly * r * 0.15, r * 0.16, 0, Math.PI * 2); ctx.fill();
}

// The spider: eight legs planted on the rock (or gripping its line), body turned so its
// underside faces the surface it's on. Legs scuttle while it bursts, sit still at rest.
function drawSpider(ctx, x, y, r, time, phase, flash, col, S) {
  let nx = 0, ny = -1, side = 1, moving = false;
  if (S) {
    if (S.mode === 'line' && S.line) {
      const L = S.line, len = Math.hypot(L.bx - L.ax, L.by - L.ay) || 1;
      nx = -(L.by - L.ay) / len; ny = (L.bx - L.ax) / len;
      if (ny > 0) { nx = -nx; ny = -ny; }                  // hang under the line
      side = S.dir * ((L.bx - L.ax) >= 0 ? 1 : -1);
    } else if (S.mode === 'surf' || S.mode === 'shoot') { nx = S.nx; ny = S.ny; side = S.side; }
    moving = S.on > 0 && S.mode !== 'shoot';
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(nx, -ny));
  const t = moving ? time * 38 + phase : phase;
  ctx.strokeStyle = flash ? '#ffffff' : col.b;
  ctx.lineWidth = r * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 4; i++) {
    const o = (i - 1.5) * r * 0.28, sw = Math.sin(t + i * 1.7) * r * 0.22;
    for (const s of [-1, 1]) {
      const fx = s * (r * (0.75 + Math.abs(i - 1.5) * 0.35)) + sw * s;
      ctx.beginPath();
      ctx.moveTo(o * 0.5, 0);
      ctx.lineTo(o * 0.5 + fx * 0.55, -r * 0.55 - Math.abs(sw) * 0.3);   // knee, up
      ctx.lineTo(o * 0.5 + fx, r * 0.62);                               // foot, on the rock
      ctx.stroke();
    }
  }
  ctx.fillStyle = flash ? '#f4f0ff' : col.b;
  ctx.beginPath(); ctx.ellipse(-side * r * 0.45, -r * 0.05, r * 0.62, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : col.a;
  ctx.beginPath(); ctx.ellipse(-side * r * 0.45, -r * 0.12, r * 0.48, r * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#f4f0ff' : col.b;
  ctx.beginPath(); ctx.ellipse(side * r * 0.3, 0, r * 0.38, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : col.eye;
  for (const [ex, ey, er] of [[0.5, -0.1, 0.1], [0.42, 0.06, 0.08], [0.58, 0.08, 0.07], [0.36, -0.14, 0.07]]) {
    ctx.beginPath(); ctx.arc(side * r * ex, r * ey, r * er, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// The jellyfish: a see-through green bell pointing its head along its heading — thin and
// tall just after a pulse, flat and wide as it slows (S.shape through jellyBell) — with a
// scalloped rim, four bright poison loops inside and a pale crown, trailing its tentacles
// (S.tent, world points from jellyStep). The glow it throws on the cave is added after the
// fog, in the Game's draw.
// a rat: a low grey-brown body along the rock (its "up" is the rock's normal), pointed snout,
// round ear, long pink tail, legs scurrying while it runs; a coin in its mouth if it has one
function drawRat(ctx, x, y, r, time, phase, flash, col, S, carry) {
  const air = !S || S.mode === 'air', nx = air ? 0 : S.nx, ny = air ? -1 : S.ny, f = S ? S.face : 1;
  const moving = S && (S.on > 0 || S.mode === 'air' || S.mode === 'path' || (S.mode === 'tunnel' && !(S.wait > 0)));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(nx, -ny));                  // local up = the surface normal
  ctx.scale(f, 1);
  const run = moving ? Math.sin(time * 38 + phase) : 0, bob = moving ? Math.abs(run) * 0.4 : 0;
  ctx.translate(0, r * 0.35 - bob);
  // tail
  ctx.strokeStyle = flash ? '#fff' : '#d9a0a0'; ctx.lineWidth = 0.7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-r * 1.1, 0);
  ctx.quadraticCurveTo(-r * 2.1, -r * (0.2 + 0.4 * Math.sin(time * 6 + phase)), -r * 2.9, r * 0.3 * Math.sin(time * 4 + phase));
  ctx.stroke();
  // legs
  ctx.strokeStyle = flash ? '#fff' : col.b; ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, r * 0.2); ctx.lineTo(-r * 0.6 - run * r * 0.4, r * 0.6 + bob);
  ctx.moveTo(r * 0.5, r * 0.2); ctx.lineTo(r * 0.5 + run * r * 0.4, r * 0.6 + bob);
  ctx.stroke();
  // body and head
  ctx.fillStyle = flash ? '#fff' : col.a;
  ctx.beginPath(); ctx.ellipse(-r * 0.15, -r * 0.2, r * 1.15, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(r * 0.6, -r * 0.65); ctx.quadraticCurveTo(r * 1.5, -r * 0.5, r * 1.75, -r * 0.05);
  ctx.lineTo(r * 0.55, r * 0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = flash ? '#fff' : col.c;
  ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.5, r * 0.7, r * 0.2, -0.1, 0, Math.PI * 2); ctx.fill();
  // ear, eye, nose
  ctx.fillStyle = flash ? '#fff' : '#c98f8f';
  ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.8, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col.eye; ctx.fillRect(r * 1.0, -r * 0.5, r * 0.25, r * 0.25);
  ctx.fillStyle = '#e88a9a'; ctx.fillRect(r * 1.62, -r * 0.18, r * 0.25, r * 0.22);
  if (carry > 0) {
    // the coin in its teeth: the same size and look as gold on the ground, kept upright
    ctx.translate(r * 2.1, r * 0.1);
    ctx.scale(f, 1); ctx.rotate(-Math.atan2(nx, -ny));
    ctx.fillStyle = '#d8a52a';
    ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.flame2;
    ctx.beginPath(); ctx.ellipse(-0.8, -0.8, 1.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
// a rat nest: a bowl of straw and twigs in its little room, with the gold the rats brought
// home glinting in it
function drawNest(ctx, x, y, r, time, flash, col, N) {
  ctx.save();
  ctx.translate(x, y + r * 0.35);
  ctx.fillStyle = flash ? '#fff' : col.b;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  const coins = N ? Math.min(12, Math.ceil(N.stash / 5)) : 0;
  for (let k = 0; k < coins; k++) {
    const a = k * 2.4, d = (k % 4) * r * 0.16;
    ctx.fillStyle = (Math.sin(time * 3 + k) > 0.8) ? '#fff2a0' : '#ffd23c';
    ctx.beginPath(); ctx.arc(Math.cos(a) * d * 1.6, -r * 0.2 + Math.sin(a) * d * 0.5, r * 0.16, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = flash ? '#fff' : col.c; ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2, b = a + 0.9 + (k % 3) * 0.3;
    ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.45 - r * 0.05);
    ctx.lineTo(Math.cos(b) * r * 0.8, Math.sin(b) * r * 0.4 + r * 0.05);
  }
  ctx.stroke();
  ctx.strokeStyle = flash ? '#fff' : col.a; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * 0.95, r * 0.35, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
  ctx.fillStyle = '#e8e0cc';                        // a bone or two
  ctx.fillRect(-r * 0.9, -r * 0.3, r * 0.6, r * 0.12); ctx.fillRect(r * 0.4, -r * 0.45, r * 0.12, r * 0.5);
  ctx.restore();
}
function drawJelly(ctx, x, y, r, time, phase, flash, col, S) {
  const P = jellyPal(S ? S.u.col : 0.5);                  // Dev → Jellyfish colours
  const sh = Math.max(0, Math.min(1, (S ? S.shape : 0) + 0.05 * Math.sin(time * 2.2 + phase)));
  const B = jellyBell(r, sh, S ? kru('jeSquash', S.u.sq) : 1);
  // tentacles behind the bell: each one a single smooth ribbon, thick at the rim and
  // tapering to a point, so there are no beads where the segments meet
  if (S) {
    ctx.fillStyle = flash ? '#ffffff' : P.tent;
    ctx.globalAlpha = 0.6;
    for (const T of S.tent) {
      const n = T.length, L = [], R = [];
      for (let j = 0; j < n; j++) {
        const a = T[Math.max(0, j - 1)], b = T[Math.min(n - 1, j + 1)];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const hw = r * 0.09 * (1 - j / (n - 1)) + 0.15;
        L.push({ x: T[j].x - dy / d * hw, y: T[j].y + dx / d * hw });
        R.push({ x: T[j].x + dy / d * hw, y: T[j].y - dx / d * hw });
      }
      const side = (P, back) => {             // a curve through the midpoints: smooth, not angular
        const Q = back ? P.slice().reverse() : P;
        ctx.lineTo(Q[0].x, Q[0].y);
        for (let j = 1; j < n - 1; j++) ctx.quadraticCurveTo(Q[j].x, Q[j].y, (Q[j].x + Q[j + 1].x) / 2, (Q[j].y + Q[j + 1].y) / 2);
        ctx.lineTo(Q[n - 1].x, Q[n - 1].y);
      };
      ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y);
      side(L, false); side(R, true);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((S ? S.hd : -Math.PI / 2) + Math.PI / 2);        // head (local up) along the heading
  // the bell's outline at scale k, shifted oy, with a scalloped margin `lap` deep (0: none)
  const bell = (k, oy, lap) => {
    const w = B.w * k, h = B.h * k, rw = B.rw * k, top = B.top * k + oy, rim = B.rim * k + oy;
    ctx.beginPath();
    ctx.moveTo(-rw, rim);
    ctx.bezierCurveTo(-w * 1.08, rim - h * 0.5, -w * 0.72, top, 0, top);
    ctx.bezierCurveTo(w * 0.72, top, w * 1.08, rim - h * 0.5, rw, rim);
    if (lap) for (let i = 0; i < 5; i++) {
      const x0 = rw - 2 * rw * i / 5, x1 = rw - 2 * rw * (i + 1) / 5;
      ctx.quadraticCurveTo((x0 + x1) / 2, rim + lap * (1 + 0.35 * Math.sin(time * 5 + i * 1.3 + phase)), x1, rim);
    }
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(0, B.top, 0, B.rim);
  g.addColorStop(0, flash ? '#ffffff' : P.top);
  g.addColorStop(0.55, flash ? '#ffffff' : P.body);
  g.addColorStop(1, flash ? '#f4f0ff' : P.rim);
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = g;
  bell(1, 0, r * 0.2 * (1 - 0.5 * sh)); ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = flash ? '#ffffff' : P.edge; ctx.lineWidth = r * 0.08; ctx.stroke();
  // the inner bell, paler
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = flash ? '#ffffff' : P.inner;
  bell(0.6, -B.h * 0.06, 0); ctx.fill();
  // four poison loops, brightest mid-pulse
  ctx.globalAlpha = 0.55 + 0.45 * sh;
  ctx.strokeStyle = flash ? '#ffffff' : P.loops; ctx.lineWidth = r * 0.08;
  const gy = (B.top + B.rim) / 2 + B.h * 0.12;
  for (let i = 0; i < 4; i++) {
    const gx = (i - 1.5) * B.w * 0.34;
    ctx.beginPath(); ctx.arc(gx, gy - Math.abs(i - 1.5) * r * 0.08, r * 0.09, Math.PI, 2 * Math.PI); ctx.stroke();
  }
  // a wet highlight on the crown
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = P.shine;
  ctx.beginPath(); ctx.ellipse(-B.w * 0.32, B.top + B.h * 0.24, B.w * 0.16, B.h * 0.09, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// The crawler: a low body on six legs that scuttle as it walks. Spiders, hounds,
// kobolds and the armoured Lohkare all wear this one.
function drawCrawler(ctx, x, y, r, lx, ly, time, phase, flash, col) {
  const s = Math.sin(time * 7 + phase);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = flash ? '#ffffff' : col.b;
  ctx.lineWidth = r * 0.2; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const o = (i - 1) * r * 0.5, sw = s * r * 0.26 * (i % 2 ? 1 : -1);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(o * 0.6, 0);
      ctx.lineTo(o * 0.6 + side * r * 0.8, side * r * 0.5 + sw);
      ctx.lineTo(o * 0.6 + side * r * 1.3, side * r * 0.95 - sw * 0.5);
      ctx.stroke();
    }
  }
  ctx.fillStyle = flash ? '#f4f0ff' : col.b;
  ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : col.a;
  ctx.beginPath(); ctx.ellipse(0, -r * 0.12, r * 0.82, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (const side of [-1, 1]) {
    ctx.fillStyle = flash ? '#ffffff' : col.eye;
    ctx.beginPath(); ctx.arc(x + lx * r * 0.35 + side * r * 0.3, y + ly * r * 0.25, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The blob: a wobbling sac with two eyes. Slimes, toads and the fungal turret.
function drawBlob(ctx, x, y, r, lx, ly, time, phase, flash, col) {
  const wob = 1 + 0.09 * Math.sin(time * 3.4 + phase);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = col.a;
  ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 0.72, r * 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = flash ? '#f4f0ff' : col.b;
  ctx.beginPath(); ctx.ellipse(0, r * 0.18, r * 1.0, r * 0.92 * wob, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : col.a;
  ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.76, r * 0.66 * wob, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#1b1526';
    ctx.beginPath(); ctx.arc(x + lx * r * 0.3 + side * r * 0.26, y + r * 0.12 + ly * r * 0.18,
      r * 0.15, 0, Math.PI * 2); ctx.fill();
  }
}

// The skull: bone, a jaw, and a halo of whatever it is made of. The Jäätiö and the
// living bones are both this, one frozen blue and one bare.
function drawSkull(ctx, x, y, r, lx, ly, time, phase, flash, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lx * 0.18);
  ctx.globalAlpha = 0.26 + 0.1 * Math.sin(time * 4 + phase);
  ctx.fillStyle = col.a;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = flash ? '#ffffff' : col.a;
  ctx.beginPath(); ctx.ellipse(0, -r * 0.15, r * 0.85, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  rr(ctx, -r * 0.55, r * 0.4, r * 1.1, r * 0.55, r * 0.2); ctx.fill();      // jaw
  ctx.fillStyle = '#1b1526';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * r * 0.34, -r * 0.18, r * 0.24, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = col.eye;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.arc(side * r * 0.34 + lx * r * 0.1, -r * 0.18 + ly * r * 0.1,
      r * 0.11, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// The worm: a chain of segments that trails behind wherever the head is pointing.
function drawWorm(ctx, x, y, r, lx, ly, time, phase, flash, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.atan2(ly, lx));
  for (let i = 4; i >= 0; i--) {
    const t = i / 4, off = -r * 1.5 * i * 0.62, w = r * (1 - t * 0.4);
    ctx.fillStyle = flash ? '#ffffff' : (i % 2 ? col.b : col.a);
    ctx.beginPath();
    ctx.ellipse(off, Math.sin(time * 6 + phase - i * 0.7) * r * 0.34, w * 0.62, w, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1b1526';
  ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Whatever this enemy is, plus the ring that warns you a charged shot is coming.
function drawEnemy(ctx, e, time) {
  const k = e.k, flash = e.flash > 0;
  const x = e.x, y = e.ty, r = e.r, lx = e.lx, ly = e.ly;
  if (k.body === 'spider') drawSpider(ctx, x, y, r, time, e.phase, flash, k.col, e.sp);
  else if (k.body === 'rat') drawRat(ctx, x, y, r, time, e.phase, flash, k.col, e.ra, e.carry);
  else if (k.body === 'nest') drawNest(ctx, x, y, r, time, flash, k.col, e.nest);
  else if (k.body === 'jelly') drawJelly(ctx, x, y, r, time, e.phase, flash, k.col, e.je);
  else if (k.body === 'crawler') drawCrawler(ctx, x, y, r, lx, ly, time, e.phase, flash, k.col);
  else if (k.body === 'blob') drawBlob(ctx, x, y, r, lx, ly, time, e.phase, flash, k.col);
  else if (k.body === 'skull') drawSkull(ctx, x, y, r, lx, ly, time, e.phase, flash, k.col);
  else if (k.body === 'worm') drawWorm(ctx, x, y, r, lx, ly, time, e.phase, flash, k.col);
  else drawDrone(ctx, x, y, r, lx, ly, time, e.phase, flash, k.col);
  if (e.charge > 0 && k.tele) {
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = k.col.eye;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, e.r + 4 + e.charge * 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Gold for the deck readout: a bare number under 1000, and thousands truncated (not
// rounded) to one decimal with a "k" — 999 -> "999", 1234 -> "1.2k", 2000 -> "2k".
// Pure and above makeLevel so the logic suite can load it.
function fmtGold(g) {
  g = Math.max(0, Math.floor(g || 0));
  if (g < 1000) return String(g);
  return (Math.floor(g / 100) / 10).toString() + 'k';
}

// Where the round deck buttons sit, in css px relative to the sticks row's top-left (the
// row is W wide, the two sticks `size` across, spaced evenly). The gun buttons ride an arc
// centred on the right stick: from the top of the gap between the sticks, clockwise over
// the top, to near the right edge. The bag mirrors the last gun on the left, and the map
// button sits straight above the bag. Returns centres plus the button diameter.
function deckLayout(W, size, n) {
  n = n || 4;
  const g = (W - 2 * size) / 3;
  const rc = { x: 2 * g + 1.5 * size, y: size / 2 };
  const btn = Math.round(Math.max(34, Math.min(46, size * 0.24)));
  const sx = W / 2, sy = size * 0.05 + 10;             // the old gold spot
  const R = Math.max(Math.hypot(sx - rc.x, sy - rc.y), size / 2 + btn / 2 + 4);
  const a0 = Math.atan2(sy - rc.y, sx - rc.x);
  const xmax = W - btn / 2 - 4;
  const a1 = Math.max(a0 + 0.3, -Math.acos(Math.max(-1, Math.min(1, (xmax - rc.x) / R))));
  const guns = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (n > 1 ? i / (n - 1) : 0);
    guns.push({ x: rc.x + Math.cos(a) * R, y: rc.y + Math.sin(a) * R });
  }
  const last = guns[n - 1];
  const bag = { x: W - last.x, y: last.y };
  const map = { x: bag.x, y: bag.y - btn - 8 };
  return { btn, R, rc, guns, bag, map };
}
// v59: three times as much of everything as v58 had, and vines come in clumps and groves
const DECOR_DENSITY = 3;
const GROVES = 14;                     // patches of thick growth per floor, on the green themes
const PLANTS = { vine: 1, myc: 1, root: 1, kelp: 1 };   // the hanging plants (not chains, not ice)
const HEAR_FIRE = 320;                                  // how far off a blaze's crackle carries
// the hit box of each prop kind about its attach point (x, y), in world units: [l, t, r, b].
// Ceiling props hang down from y, floor props stand up from it, wall props sit beside it.
const PROP_BOX = {
  drop:   { icicle: [-4, 0, 4, 16], geode: [-7, 0, 7, 12] },
  spike:  [-6, -10, 6, 0],
  barrel: [-9, -12, 9, 0],
  lamp:   { lantern: [-5, -7, 5, 7], cap: [-6, -10, 6, 0], hanglamp: [-4, 0, 4, 16] },
  vent:   [-5, -3, 5, 0],
  pad:    [-10, -11, 10, 0],
  pod:    [-5, -11, 5, 0],
  noise:  { skulls: [-8, -7, 8, 0], stone: [-5, -10, 5, 10] },
  shard:  [-3, -5, 3, 5],
  eyes:   [-7, -4, 7, 4],
  cover:  { statue: [-8, -28, 8, 0], pillar: [-7, -30, 7, 0], monolith: [-7, -34, 7, 0] },
  matter: [-12, -12, 12, 12],
  tendril: [-4, -8, 4, 0],
  drip:   [-3, 0, 3, 4],
};
// what a hazard does to you when it lands a hit, and how often
const PROP_DMG = { spike: 8, drop: 12, vent: 7, tendril: 8, matter: 4, lava: 5, cloud: 3 };

// Pass 2 and 3 for one level. Pure: reads `mat`, paints into the three images, and returns
// the props and the theme's ambient effects. Its own random stream, so adding it changed
// nothing about the cave, the enemies or the loot a seed already made. `keep` is a list of
// {x, y, r} spots (portals, loot, rooms) no prop may sit on.
// A mine's timber set (v85): two posts from the floor to the roof and a cap beam along the
// roof between them, packed tight with wedges wherever the roof lifts away from it. It is
// all measured off the rock at the spot — each post stands on level ground and meets rock
// overhead, and the roof bears on the cap along nearly its whole length — so a set always
// looks like it's holding something up. Anywhere that can't take one is refused (false).
// `set(x, y, rgb)` paints the decoration layer; `y` is a row in the open air between the
// posts; `fy` (optional) is the floor row the posts must stand on; `old` adds moss and rot;
// `maxH` the tallest post (64 by default).
function timberFrame(mat, set, R, T, xa, xb, y, old, fy, maxH) {
  const solid = (x, yy) => x < 0 || yy < 0 || x >= CW || yy >= CH || mat[yy * CW + x] !== 0;
  const down = x => { let k = y; while (k < y + 70 && !solid(x, k + 1)) k++; return solid(x, k + 1) ? k + 1 : -1; };
  const up = x => { let k = y; while (k > y - 70 && !solid(x, k - 1)) k--; return solid(x, k - 1) ? k - 1 : -1; };
  if (xb - xa < 10 || solid(xa, y) || solid(xb, y)) return false;
  const fa = down(xa), fa2 = down(xa + 1), fb = down(xb), fb2 = down(xb - 1);
  const ca = up(xa), ca2 = up(xa + 1), cb = up(xb), cb2 = up(xb - 1);
  if ([fa, fa2, fb, fb2, ca, ca2, cb, cb2].some(v => v < 0)) return false;
  if (Math.abs(fa - fa2) > 1 || Math.abs(fb - fb2) > 1) return false;       // not on a lip
  if (fy != null && (Math.abs(fa - fy) > 3 || Math.abs(fb - fy) > 3)) return false;
  const topA = Math.max(ca, ca2) + 1, topB = Math.max(cb, cb2) + 1;          // first open row under the roof
  const hA = Math.min(fa, fa2) - topA, hB = Math.min(fb, fb2) - topB;
  if (Math.min(hA, hB) < 12 || Math.max(hA, hB) > (maxH || 64)) return false;
  const capY = x => Math.round(topA + (topB - topA) * (Math.max(xa, Math.min(xb, x)) - xa) / (xb - xa));
  const roof = [];
  let loose = 0;
  for (let x = xa; x <= xb; x++) {
    if (solid(x, y)) return false;                   // a pillar between the posts
    const r = up(x);
    if (r < 0) return false;
    const gap = capY(x) - (r + 1);                   // open rows between the roof and the cap
    if (gap < -2 || gap > 8) return false;
    if (gap > 3) loose++;
    roof.push(r);
  }
  if (loose > (xb - xa + 1) * 0.3) return false;
  const wood = old ? [86, 64, 44] : [112, 80, 50];
  const J = (c, f, j) => [c[0] * f + (R() - 0.5) * j, c[1] * f + (R() - 0.5) * j, c[2] * f + (R() - 0.5) * j];
  const moss = () => mix(T.moss[0], T.moss[1], R());
  // wedges packed between the roof and the cap
  for (let x = xa; x <= xb; x++) for (let yy = roof[x - xa] + 1; yy < capY(x); yy++) set(x, yy, J(wood, 0.5, 8));
  // the cap, two rows, running a little past each post
  for (let x = xa - 2; x <= xb + 2; x++) {
    const cy = capY(x);
    set(x, cy, J(wood, 0.95, 10));
    set(x, cy + 1, J(wood, 0.7, 10));
    if (old && R() < 0.22) { const n = 1 + Math.floor(R() * 4); for (let k = 0; k < n; k++) set(x, cy + 2 + k, moss()); }
  }
  // the posts, lit on the left, and a footing block under each
  for (const [px, top, bot] of [[xa, topA, Math.min(fa, fa2)], [xb - 1, topB, Math.min(fb, fb2)]]) {
    const rot = old && R() < 0.5 ? top + 4 + Math.floor(R() * (bot - top - 8)) : -99;
    for (let yy = top + 2; yy < bot; yy++) {
      const f = Math.abs(yy - rot) < 2 ? 0.6 : 1;
      set(px, yy, J(wood, f, 10));
      set(px + 1, yy, J(wood, 0.76 * f, 10));
    }
    for (let dx = -1; dx <= 2; dx++) set(px + dx, bot - 1, J(wood, 0.58, 8));
    if (old) for (let yy = bot - 1; yy > bot - 7; yy--) if (R() < 0.5 * (yy - bot + 7) / 6) set(px + (R() < 0.5 ? 0 : 1), yy, moss());
  }
  // knee braces from each post up under the cap
  if (Math.min(hA, hB) >= 16) for (let k = 0; k <= 5; k++) {
    set(xa + 2 + k, capY(xa + 2 + k) + 2 + (5 - k), J(wood, 0.66, 8));
    set(xb - 2 - k, capY(xb - 2 - k) + 2 + (5 - k), J(wood, 0.66, 8));
  }
  return true;
}

// `fuel` (optional) gets the fuel kind of every pixel painted: whatever FU is at the time
// (see the fire section) — grass, moss and timber burn, everything else paints a 0.
// An arched vine's curve (v87): hung from (ax, ay) to (bx, by), `slack` times as long as the
// straight line between them, so it sags. A parabola under the chord, its depth set so the
// curve's length comes out near slack × chord (for a shallow sag, length ≈ c(1 + 8/3 (s/c)²)).
// n + 1 points, world units.
function archCurve(ax, ay, bx, by, slack, n) {
  const c = Math.hypot(bx - ax, by - ay), s = c * Math.sqrt(3 * Math.max(0, slack - 1) / 8);
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t + 4 * s * t * (1 - t) });
  }
  return pts;
}
// the nearest point on arched vine pr to (x, y): { x, y, d, k } (k = the segment it's on)
function archNear(pr, x, y) {
  const A = pr.arc;
  let best = null;
  for (let k = 0; k + 1 < A.length; k++) {
    const ax = pr.x + A[k][0], ay = pr.y + A[k][1], bx = pr.x + A[k + 1][0], by = pr.y + A[k + 1][1];
    const vx = bx - ax, vy = by - ay, ll = vx * vx + vy * vy || 1;
    const u = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / ll));
    const qx = ax + vx * u, qy = ay + vy * u, d = Math.hypot(qx - x, qy - y);
    if (!best || d < best.d) best = { x: qx, y: qy, d, k };
  }
  return best;
}
// a point on arched vine pr (world units) at fraction u of the way along its points
function archAt(pr, u) {
  const A = pr.arc, f = Math.max(0, Math.min(1, u)) * (A.length - 1), k = Math.min(A.length - 2, Math.floor(f)), t = f - k;
  return { x: pr.x + A[k][0] + (A[k + 1][0] - A[k][0]) * t, y: pr.y + A[k][1] + (A[k + 1][1] - A[k][1]) * t };
}

function decorate(mat, img, dimg, bgImg, floor, seed, keep, fuel, zone) {
  let rs = (Math.imul(seed | 0, 7919) + floor * 104729 >>> 0) % 2147483646 + 1;
  const R = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const T = themeFor(floor), list = decorFor(floor);
  const d = img.data, dd = dimg.data, bd = bgImg.data;
  const inb = (cx, cy) => cx >= 0 && cy >= 0 && cx < CW && cy < CH;
  const solidC = (cx, cy) => inb(cx, cy) && (mat[cy * CW + cx] === ROCK || mat[cy * CW + cx] === BRICK);
  const openC = (cx, cy) => inb(cx, cy) && !mat[cy * CW + cx];
  const put = (arr, i, c, a) => { arr[i * 4] = c[0]; arr[i * 4 + 1] = c[1]; arr[i * 4 + 2] = c[2]; arr[i * 4 + 3] = a == null ? 255 : a; };
  let FU = 0;                                         // the fuel kind of what's being painted
  const tset = (cx, cy, c) => { if (solidC(cx, cy)) { put(d, cy * CW + cx, c); if (fuel) fuel[cy * CW + cx] = FU; } };      // onto the rock
  const dset = (cx, cy, c, a) => { if (openC(cx, cy)) { put(dd, cy * CW + cx, c, a); if (fuel) fuel[cy * CW + cx] = FU; } }; // the decoration layer
  const jit = (c, j) => [c[0] + (R() - 0.5) * j, c[1] + (R() - 0.5) * j, c[2] + (R() - 0.5) * j];
  const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const pick = (a, b) => mix(a, b, R());

  // ---- where things can go: one scan of the cave, above the shop ----
  const Y0 = 40, Y1 = SHOP_TOP - 14;
  const sites = { floor: [], ceil: [], wall: [], air: [] };
  const openRun = (cx, cy, dir, n) => { for (let k = 1; k <= n; k++) if (!openC(cx, cy + dir * k)) return false; return true; };
  for (let cy = Y0; cy < Y1; cy++) for (let cx = 8; cx < CW - 8; cx++) {
    const i = cy * CW + cx;
    if (mat[i]) continue;
    if (solidC(cx, cy + 1) && openRun(cx, cy, -1, 12)) sites.floor.push(i);
    if (solidC(cx, cy - 1) && openRun(cx, cy, 1, 12)) sites.ceil.push(i);
    if (!(cy & 1)) {
      const s = solidC(cx - 1, cy) ? -1 : solidC(cx + 1, cy) ? 1 : 0;
      if (s && solidC(cx + s, cy - 3) && solidC(cx + s, cy + 3) && openC(cx - s * 6, cy) && openC(cx - s * 3, cy))
        sites.wall.push(i * 2 + (s > 0 ? 1 : 0));
    }
    if (cx % 5 === 0 && cy % 5 === 0 && openC(cx - 12, cy) && openC(cx + 12, cy) && openC(cx, cy - 12) &&
        openC(cx, cy + 12) && openC(cx - 8, cy - 8) && openC(cx + 8, cy + 8) && openC(cx + 8, cy - 8) && openC(cx - 8, cy + 8))
      sites.air.push(i);
  }
  // a level stretch of floor `w` cells either side, with the air above it clear
  const flatAt = (cx, cy, w) => {
    for (let dx = -w; dx <= w; dx++)
      if (!solidC(cx + dx, cy + 1) || !openC(cx + dx, cy) || !openC(cx + dx, cy - 3)) return false;
    return true;
  };
  // a dip: the floor climbs at least two cells within a few cells on both sides
  const pitAt = (cx, cy) => {
    const side = s => { for (let k = 3; k <= 14; k++) if (solidC(cx + s * k, cy - 2)) return true; return false; };
    return side(-1) && side(1);
  };
  // how far the floor runs level either side, capped, for the width of a zone
  const runOf = (cx, cy, s, cap) => {
    let k = 0;
    while (k < cap && solidC(cx + s * (k + 1), cy + 1) && openC(cx + s * (k + 1), cy)) k++;
    return k;
  };
  const upTo = (cx, cy, cap) => { let k = 0; while (k < cap && openC(cx, cy - k - 1)) k++; return k; };
  const downTo = (cx, cy, cap) => { let k = 0; while (k < cap && openC(cx, cy + k + 1)) k++; return k; };

  // ---- pass 2 bakes ----
  const bake = {
    moss(cx, cy) {                       // a thick soft patch on the ground, grass tufts on top
      const w = 5 + Math.floor(R() * 8);
      for (let dx = -w; dx <= w; dx++) {
        const deep = Math.round((2 + R() * 3) * (1 - Math.abs(dx) / (w + 1)) + 1);
        FU = FUEL_MOSS;
        for (let k = 1; k <= deep; k++) tset(cx + dx, cy + k, jit(pick(T.moss[0], T.moss[1]), 14));
        FU = FUEL_GRASS;
        if (R() < 0.35) { const tall = 1 + (R() < 0.4); for (let k = 0; k < tall; k++) dset(cx + dx, cy - k, jit(T.moss[1], 20)); }
      }
      FU = 0;
    },
    rubble(cx, cy) {                     // a mound of broken brick with moss grown over it
      const w = 3 + Math.floor(R() * 4), hh = 2 + R() * 2.5;
      for (let dx = -w; dx <= w; dx++) {
        const top = Math.round((1 - (dx / (w + 1)) ** 2) * hh);
        for (let k = 0; k < top; k++) {
          const mossy = k === top - 1 && R() < 0.7;
          const c = mossy ? pick(T.moss[0], T.moss[1])
            : R() < 0.2 ? T.mortar : pick(T.brick[0], T.brick[1]);
          FU = mossy ? FUEL_GRASS : 0;
          dset(cx + dx, cy - k, jit(c, 12));
        }
      }
      FU = 0;
    },
    beams(cx, cy) {                      // pit props: a timber set, only where the roof will bear on it
      FU = FUEL_WOOD;
      const ok = timberFrame(mat, dset, R, T, cx - 8, cx + 8, cy - 3, false, cy + 1);
      FU = 0;
      if (!ok) return false;
    },
    pickaxe(cx, cy) {                    // head buried in the rock, the haft sticking out
      const s = R() < 0.5 ? -1 : 1, haft = [104, 74, 46], iron = [120, 124, 132];
      FU = FUEL_WOOD;
      for (let k = 0; k < 7; k++) dset(cx + s * k, cy - k, jit(haft, 12));
      FU = 0;
      for (let k = -2; k <= 2; k++) tset(cx + k, cy + 1 + (Math.abs(k) === 2), jit(iron, 16));
      tset(cx, cy + 2, iron);
    },
    cracks(cx, cy, c) {                  // a dry crack wandering down into the ground
      c = c || shade(T.mortar, 0.8);
      let x = cx, y = cy + 1;
      for (let k = 0; k < 8 + R() * 8; k++) {
        tset(x, y, jit(c, 8));
        if (R() < 0.15) { let bx = x, by = y; for (let j = 0; j < 4; j++) { bx += R() < 0.5 ? -1 : 1; by++; tset(bx, by, jit(c, 8)); } }
        y++; x += Math.floor(R() * 3) - 1;
      }
    },
    fissure(cx, cy, side) {              // glowing neon cracks, into the floor or into a wall
      const glow = T.moss[1], halo = T.moss[0];
      let x = side ? cx + side : cx, y = side ? cy : cy + 1;
      for (let k = 0; k < 10 + R() * 10; k++) {
        tset(x, y, glow);
        if (side) { tset(x, y - 1, halo); tset(x, y + 1, halo); x += side; y += Math.floor(R() * 3) - 1; }
        else { tset(x - 1, y, halo); tset(x + 1, y, halo); y++; x += Math.floor(R() * 3) - 1; }
      }
    },
    bones(cx, cy) {                      // a bone half sunk in the ground
      const len = 4 + Math.floor(R() * 4), bone = [222, 214, 192];
      for (let k = 0; k < len; k++) { dset(cx + k, cy, jit(bone, 12)); tset(cx + k, cy + 1, jit(shade(bone, 0.85), 12)); }
      dset(cx - 1, cy - 1, bone); dset(cx + len, cy - 1, bone);
    },
    pillar(cx, cy) {                     // a salt column from the floor to the roof, behind you
      const hgt = upTo(cx, cy, 90);
      if (hgt < 20 || hgt >= 90) return false;
      const w = 2 + Math.floor(R() * 3), top = cy - hgt;
      for (let y = top; y <= cy; y++) {
        const flare = Math.max(0, 3 - Math.min(y - top, cy - y));
        for (let dx = -w - flare; dx <= w + flare; dx++) {
          const c = dx < 0 ? T.moss[1] : dx === 0 ? [236, 232, 214] : T.moss[0];
          dset(cx + dx, y, jit(shade(c, 0.72), 8));
        }
      }
    },
    gear(cx, cy) {                       // a big rusted cog set into the back wall
      const r = 5 + Math.floor(R() * 9), teeth = 8 + Math.floor(R() * 5), rust = shade(T.rock[1], 0.7);
      const ph = R() * 6.28;
      for (let dy = -r - 2; dy <= r + 2; dy++) for (let dx = -r - 2; dx <= r + 2; dx++) {
        const dist = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
        const tooth = Math.cos((a + ph) * teeth) > 0.3 ? 2 : 0;
        const rim = dist <= r + tooth && dist >= r - 2;
        const spoke = dist < r - 2 && (Math.abs(Math.sin((a + ph) * 2)) < 0.18 || dist < 2.5);
        if (rim || spoke) dset(cx + dx, cy + dy, jit(shade(rust, rim && tooth ? 0.85 : 1), 12));
      }
    },
    ribs(cx, cy) {                       // a ribcage arching over the floor, behind you
      const hgt = upTo(cx, cy, 80);
      if (hgt < 24) return false;
      const bone = [214, 206, 184], H = Math.min(hgt - 2, 36);
      for (let k = 0; k < 4; k++) {
        const a = 16 - k * 3, b = H - k * 5, ox = cx + k * 4 - 6, f = 0.78 - k * 0.1;
        for (let t = 0; t <= 60; t++) {
          const th = Math.PI * t / 60, x = ox + Math.cos(th) * a, y = cy - Math.sin(th) * b;
          dset(Math.round(x), Math.round(y), jit(shade(bone, f), 8));
          dset(Math.round(x) + 1, Math.round(y), jit(shade(bone, f * 0.85), 8));
        }
      }
    },
    charred(cx, cy) {                    // a burnt log or a heap of cinders
      const len = 3 + Math.floor(R() * 5);
      for (let k = 0; k < len; k++) {
        dset(cx + k, cy, R() < 0.12 ? [190, 84, 30] : jit([34, 28, 26], 10));
        if (R() < 0.5) dset(cx + k, cy - 1, jit([48, 42, 40], 10));
      }
    },
    soot(bx, by) {                       // a soot stain darkening the back wall
      const r = 5 + R() * 10;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = Math.round(bx + dx), y = Math.round(by + dy), f = 1 - Math.hypot(dx, dy) / r;
        if (f <= 0 || x < 0 || y < 0 || x >= BW || y >= BH) continue;
        const k = (y * BW + x) * 4, m = 1 - 0.55 * f;
        bd[k] *= m; bd[k + 1] *= m; bd[k + 2] *= m;
      }
    },
    algae(cx, cy) {                      // the ground here was laid as brick once, long ago
      const w = 6 + Math.floor(R() * 9);
      for (let dx = -w; dx <= w; dx++) for (let k = 1; k <= 7; k++) {
        const x = cx + dx, y = cy + k;
        if (!inb(x, y) || mat[y * CW + x] !== ROCK) continue;
        mat[y * CW + x] = BRICK;                    // brick for rock: just as solid
        const kk = x + (y % 2) * 3;
        const top = !mat[(y - 1) * CW + x] || (y > 1 && !mat[(y - 2) * CW + x]);
        put(d, y * CW + x, top ? jit(pick(T.moss[0], T.moss[1]), 16)
          : kk % 6 === 0 ? T.mortar : jit(pick(T.brick[0], T.brick[1]), 8));
      }
    },
  };

  // ---- pass 3 props ----
  const props = [], baked = {}, amb = [];
  const boxOf = (kind, style, side) => {
    let b = PROP_BOX[kind];
    if (b && !Array.isArray(b)) b = b[style];
    b = b ? b.slice() : [-4, -4, 4, 4];
    if (side === 'ceil' && kind === 'spike') b = [b[0], 0, b[2], -b[1]];   // hanging the other way
    return b;
  };
  // the first ceiling (open cell, rock above, room below) in column cx within `span` rows of cy
  const ceilNear = (cx, cy, span) => {
    for (let k = 0; k <= span; k++) for (const y of k ? [cy - k, cy + k] : [cy]) {
      if (y < Y0 || y >= Y1 || cx < 8 || cx >= CW - 8) continue;
      if (openC(cx, y) && solidC(cx, y - 1) && openRun(cx, y, 1, 12)) return y;
    }
    return -1;
  };
  // one prop of kind `it` at cell (cx, cy), or null if the spot doesn't suit it
  function makeProp(it, cx, cy, at, side) {
    const x = at === 'wall' ? (side < 0 ? cx : cx + 1) * CELL : (cx + 0.5) * CELL;
    const y = at === 'floor' || it.at === 'flat' || it.at === 'pit' ? (cy + 1) * CELL : at === 'ceil' ? cy * CELL : (cy + 0.5) * CELL;
    const pr = { id: it.id, k: it.kind, st: it.style, x, y, t: R() * 10, seed: R() };
    if (at === 'ceil') pr.anc = [cx, cy - 1];
    else if (at === 'wall') { pr.anc = [cx + side, cy]; pr.side = side; }
    else if (at === 'floor' || it.at === 'flat' || it.at === 'pit') pr.anc = [cx, cy + 1];
    pr.hang = at === 'ceil' ? 1 : 0;
    let box = boxOf(it.kind, it.style, at);
    if (it.kind === 'climb') {
      if (at === 'wall') {                   // a frozen fall runs down the wall face
        let k = 0; while (k < 50 && solidC(cx + side, cy + k + 1) && openC(cx, cy + k + 1)) k++;
        if (k < 10) return null;
        pr.len = k * CELL;
        box = side < 0 ? [0, -4, 7, pr.len] : [-7, -4, 0, pr.len];
      } else {                               // plants hang anywhere from a short tuft to long
        const room = downTo(cx, cy, 90);
        if (room < 12) return null;
        const most = Math.min(64, SHOP_TOP - 16 - cy);          // never down into the shop
        if (most < 8) return null;
        pr.len = Math.round(Math.max(8, Math.min(room * (0.25 + R() * 0.55), most)) * CELL);
        box = [-5, 0, 5, pr.len];
      }
    } else if (it.kind === 'zone') {
      const cap = it.at === 'pit' ? 10 : 16;
      const lft = runOf(cx, cy, -1, cap), rgt = runOf(cx, cy, 1, cap);
      if (lft + rgt < 6) return null;
      box = [-lft * CELL, -5, (rgt + 1) * CELL, 1];
      pr.x = cx * CELL; pr.anc = [cx, cy + 1];
    } else if (it.kind === 'drip' && at === 'wall') {
      box = side < 0 ? [0, -4, 8, 4] : [-8, -4, 0, 4];
    } else if (it.kind === 'lamp' && at === 'wall') {
      box = side < 0 ? [0, -7, 9, 7] : [-9, -7, 0, 7];
    } else if (it.kind === 'noise' && at === 'wall') {
      box = side < 0 ? [0, -10, 10, 10] : [-10, -10, 0, 10];
    } else if (it.kind === 'shard' && at === 'wall') {
      box = side < 0 ? [0, -4, 6, 4] : [-6, -4, 0, 4];
    }
    if (it.kind === 'cover') pr.hp = it.hp || 0;          // 0: it can't be broken
    if (it.kind === 'tendril') pr.ang = -Math.PI / 2 + (R() - 0.5) * 1.2;
    pr.l = box[0]; pr.t0 = box[1]; pr.r = box[2]; pr.b = box[3];
    return pr;
  }
  const plant = it => it.kind === 'climb' && PLANTS[it.style];
  // a few more of the same plant hanging right beside one, so a vine is never on its own
  const clump = (it, cx, cy, n) => {
    for (let k = 0; k < n; k++) {
      const sx = cx + Math.round((R() - 0.5) * 18), sy = ceilNear(sx, cy, 6);
      const pr = sy >= 0 && makeProp(it, sx, sy, 'ceil', 0);
      if (pr) props.push(pr);
    }
  };
  function place(it) {
    const want = it.n * DECOR_DENSITY, got = [];
    const pool = it.at === 'surf' ? null : it.at === 'flat' || it.at === 'pit' ? sites.floor : sites[it.at];
    for (let a = 0; a < want * 40 && got.length < want; a++) {
      let at = it.at, i, side = 0;
      if (at === 'bg') {                       // anywhere on the back wall
        const bx = R() * BW, by = R() * (SHOP_TOP / 4 - 10);
        if (bake[it.style](bx, by) !== false) got.push(1);
        continue;
      }
      if (at === 'surf') at = R() < 0.5 ? 'floor' : 'wall';
      if (it.both && R() < 0.4) at = 'ceil';
      const src = at === 'floor' || at === 'ceil' || at === 'wall' || at === 'air' ? sites[at] : pool;
      if (!src.length) break;
      i = src[Math.floor(R() * src.length)];
      if (at === 'wall') { side = i & 1 ? 1 : -1; i >>= 1; }
      const cx = i % CW, cy = (i / CW) | 0;
      if (it.at === 'flat' && !flatAt(cx, cy, it.w || 3)) continue;
      if (it.at === 'pit' && !pitAt(cx, cy)) continue;
      // keep the same kind spread out over the cave
      const x = (cx + 0.5) * CELL, y = cy * CELL;
      const gap = it.kind === 'bake' ? 14 : 40;
      if (got.some(g => Math.abs(g.x - x) < gap && Math.abs(g.y - y) < gap)) continue;
      if (it.kind === 'bake') {
        if (bake[it.style](cx, cy, it.style === 'fissure' && at === 'wall' ? side : undefined) === false) continue;
        got.push({ x, y });
        continue;
      }
      const pr = makeProp(it, cx, cy, at, side);
      if (!pr) continue;
      got.push({ x, y });
      props.push(pr);
      if (plant(it)) clump(it, cx, cy, 1 + Math.floor(R() * 3));
    }
    baked[it.id] = it.kind === 'bake' ? got.length : 0;
  }
  for (const it of list) {
    if (it.kind === 'amb') { amb.push(it.style); baked[it.id] = 0; continue; }
    place(it);
  }

  // ---- groves: patches of thick growth, densest in the middle and thinning outwards ----
  // Each is a ceiling spot with a radius. Hanging plants are dropped at a distance picked
  // uniformly from 0..r, which crowds them toward the middle (the same count spread over a
  // ring that grows with distance), and the overgrowth bake paints moss, grass, drapes and
  // leaves with a chance that fades to nothing at the edge.
  const green = list.find(plant);
  baked.groves = 0;
  if (green && sites.ceil.length) {
    const groves = [];
    for (let a = 0; a < 600 && groves.length < GROVES; a++) {
      const i = sites.ceil[Math.floor(R() * sites.ceil.length)];
      const cx = i % CW, cy = (i / CW) | 0;
      if (groves.some(g => Math.hypot(g.cx - cx, g.cy - cy) < 100)) continue;
      groves.push({ cx, cy, r: 32 + R() * 34 });
    }
    for (const g of groves) {
      overgrow(g.cx, g.cy, g.r * 1.5);
      const n = 14 + Math.floor(R() * 12);
      for (let k = 0, got = 0; k < n * 4 && got < n; k++) {
        const d = g.r * R(), a = R() * 6.283;
        const sx = Math.round(g.cx + Math.cos(a) * d), sy = ceilNear(sx, Math.round(g.cy + Math.sin(a) * d * 0.6), 24);
        const pr = sy >= 0 && makeProp(green, sx, sy, 'ceil', 0);
        if (pr) { props.push(pr); got++; }
      }
    }
    baked.groves = groves.length;
  }

  // ---- arched vines (v87): a long vine slung between two ceiling spots over an open pocket,
  // thick with leaves, with strands hanging off it. They come in clusters, and on a zoned
  // floor only in the natural zones (the built-up corridors are too low for them).
  baked.arches = 0;
  if (green && sites.ceil.length) {
    const K = k => kr(k, R), cnt = v => Math.floor(v) + (R() < v % 1 ? 1 : 0);
    const nat = (cx, cy) => !zone || !zone[cy * CW + cx];
    const spots = [], nC = cnt(Math.max(0, K('arVines')));
    for (let tries = 0; spots.length < nC && tries < nC * 80 + 80; tries++) {
      const i = sites.ceil[Math.floor(R() * sites.ceil.length)];
      const cx = i % CW, cy = (i / CW) | 0;
      if (!nat(cx, cy) || spots.some(g => Math.hypot(g.cx - cx, g.cy - cy) < 80)) continue;
      const want = Math.max(1, cnt(K('arCluster')));
      let got = 0;
      for (let t = 0; t < want * 30 && got < want; t++) {
        const ax = got ? cx + Math.round((R() - 0.5) * 50) : cx, ay = got ? ceilNear(ax, cy, 24) : cy;
        if (ay < 0 || !nat(ax, ay)) continue;
        const span = K('arSpan'), bx = Math.round(ax + (R() < 0.5 ? -1 : 1) * span);
        const by = ceilNear(bx, Math.round(ay + K('arRise') * span * (R() < 0.5 ? -1 : 1)), Math.round(span * 0.25) + 4);
        if (by < 0 || !nat(bx, by)) continue;
        if (archProp(ax, ay, bx, by, K, cnt, nat)) { got++; baked.arches++; }
      }
      if (got) spots.push({ cx, cy });
    }
  }
  // one arch from ceiling spot (ax, ay) to (bx, by), terrain pixels, and its strands; null if
  // it would pass through rock or doesn't hang over enough open air
  function archProp(ax, ay, bx, by, K, cnt, nat) {
    const A = { x: (ax + 0.5) * CELL, y: ay * CELL }, B = { x: (bx + 0.5) * CELL, y: by * CELL };
    const slack = K('arSlack'), chord = Math.hypot(B.x - A.x, B.y - A.y);
    const n = Math.max(8, Math.min(40, Math.round(chord / 6)));
    const pts = archCurve(A.x, A.y, B.x, B.y, slack, n);
    // walk it half a pixel at a time: all of it in open air, in a natural zone
    let low = pts[0], alen = 0;
    for (let k = 0; k < n; k++) {
      const p = pts[k], q = pts[k + 1], l = Math.hypot(q.x - p.x, q.y - p.y), m = Math.max(1, Math.ceil(l * 2 / CELL));
      alen += l;
      for (let j = 0; j <= m; j++) {
        const x = p.x + (q.x - p.x) * j / m, y = p.y + (q.y - p.y) * j / m;
        const cx = Math.floor(x / CELL);
        if (!openC(cx, Math.floor(y / CELL)) || !openC(cx, Math.floor((y + 1) / CELL)) || !nat(cx, Math.floor(y / CELL))) return null;
      }
      if (q.y > low.y) low = q;
    }
    const lx = Math.floor(low.x / CELL), ly = Math.floor(low.y / CELL);
    if (downTo(lx, ly, 150) < K('arClear') || ly >= SHOP_TOP - 24) return null;
    const pr = { id: 'arch', k: 'climb', st: green.style, x: A.x, y: A.y, t: R() * 10, seed: R(), hang: 1,
      anc: [ax, ay - 1], anc2: [bx, by - 1], arc: pts.map(p => [p.x - A.x, p.y - A.y]),
      thick: Math.max(1, Math.round(K('arThick'))), alen };
    let l = 0, r = 0, t0 = 0, b = 0;
    for (const [x, y] of pr.arc) { l = Math.min(l, x); r = Math.max(r, x); t0 = Math.min(t0, y); b = Math.max(b, y); }
    props.push(pr);
    // strands hanging off it, spaced at random along it
    const ns = cnt(K('arStrands') * alen / (10 * CELL));
    for (let s = 0; s < ns; s++) {
      const u = R(), q = archAt(pr, u);
      q.u = u;
      const room = downTo(Math.floor(q.x / CELL), Math.floor(q.y / CELL), 90);
      const len = Math.round(Math.min(K('arStrandLen'), room * 0.7, SHOP_TOP - 20 - q.y / CELL) * CELL);
      if (len < 4) continue;
      props.push({ id: 'archStrand', k: 'climb', st: green.style, x: q.x, y: q.y, t: R() * 10, seed: R(), hang: 1,
        len, on: pr, u: q.u, l: -5, t0: 0, r: 5, b: len });
      b = Math.max(b, q.y - A.y + len);
    }
    pr.l = l - 4; pr.r = r + 4; pr.t0 = t0 - 3; pr.b = b + 3;
    return pr;
  }
  // thick growth round (gx, gy) out to radius rr, fading with distance
  function overgrow(gx, gy, rr) {
    const leaf = T.moss[1], dark = shade(T.moss[0], 0.8);
    const bloom = [[236, 214, 120], [226, 140, 170], [240, 240, 230]];
    for (let y = Math.max(Y0, Math.round(gy - rr)); y <= Math.min(Y1, Math.round(gy + rr)); y++)
      for (let x = Math.max(4, Math.round(gx - rr)); x <= Math.min(CW - 5, Math.round(gx + rr)); x++) {
        const f = 1 - Math.hypot(x - gx, (y - gy) * 1.3) / rr;
        if (f <= 0 || !openC(x, y)) continue;
        const p = Math.pow(f, 1.2);
        FU = FUEL_MOSS;
        if (solidC(x, y + 1)) {                    // floor: moss into the rock, grass on top
          if (R() < p) { tset(x, y + 1, jit(pick(T.moss[0], T.moss[1]), 16)); if (R() < p) tset(x, y + 2, jit(dark, 12)); }
          FU = FUEL_GRASS;
          if (R() < p * 0.85) {
            const tall = 1 + Math.floor(R() * (1 + 4 * f));
            for (let k = 0; k < tall; k++) dset(x, y - k, jit(k === tall - 1 ? leaf : pick(T.moss[0], leaf), 18));
            if (R() < 0.06 * f) dset(x, y - tall, bloom[Math.floor(R() * bloom.length)]);
          }
        } else if (solidC(x, y - 1)) {             // ceiling: moss drapes hanging down
          if (R() < p) tset(x, y - 1, jit(pick(T.moss[0], T.moss[1]), 16));
          FU = FUEL_GRASS;
          if (R() < p * 0.75) {
            const len = 1 + Math.floor(R() * (2 + 9 * f));
            for (let k = 0; k < len; k++) dset(x, y + k, jit(k > len - 2 ? leaf : dark, 14));
          }
        } else if ((solidC(x - 1, y) || solidC(x + 1, y)) && R() < p * 0.5) {
          FU = FUEL_GRASS;
          dset(x, y, jit(pick(T.moss[0], leaf), 16));   // wall: creeping leaves
        }
        FU = 0;
      }
  }
  // lanterns all through the built-up zones (v88): on the walls, and hung off the roof on a
  // chain. Shoot one and it pops, throwing burning oil (see popLamp in the Game).
  baked.lanterns = 0;
  if (zone && (sites.ceil.length || sites.wall.length)) {
    const want = Math.round(kr('lvLamps', R)), got = [];
    const isB = (cx, cy) => zone[cy * CW + cx] === 1;
    for (let a = 0; a < want * 40 && got.length < want; a++) {
      const wall = sites.wall.length && (R() < 0.35 || !sites.ceil.length);
      let i = wall ? sites.wall[Math.floor(R() * sites.wall.length)] : sites.ceil[Math.floor(R() * sites.ceil.length)], side = 0;
      if (wall) { side = i & 1 ? 1 : -1; i >>= 1; }
      const cx = i % CW, cy = (i / CW) | 0;
      if (!isB(cx, cy) || got.some(g => Math.hypot(g.x - cx, g.y - cy) < 36)) continue;
      let pr;
      if (wall) pr = makeProp({ id: 'lanterns', kind: 'lamp', style: 'lantern', at: 'wall' }, cx, cy, 'wall', side);
      else {
        const room = downTo(cx, cy, 60);
        if (room < 18) continue;
        pr = makeProp({ id: 'hanglamps', kind: 'lamp', style: 'hanglamp', at: 'ceil' }, cx, cy, 'ceil', 0);
        if (pr) { pr.len = Math.round((2 + R() * Math.min(7, room * 0.3)) * CELL); pr.b = pr.len + 9; }
      }
      if (!pr) continue;
      got.push({ x: cx, y: cy });
      props.push(pr);
    }
    baked.lanterns = got.length;
  }
  return { props: cullDecor(props, keep || []), amb, baked };
}
// Load-time cleanup: drop any prop whose box overlaps one already kept (first placed wins),
// or that sits on a keep-out spot, so nothing starts life clipped into something else.
function cullDecor(props, keep) {
  const out = [];
  const pad = 3;
  const dropped = new Set();
  for (const pr of props) {
    if (pr.arc) {                          // an arched vine: its curve, not its big box
      if (pr.arc.some(([x, y]) => keep.some(k => Math.hypot(pr.x + x - k.x, pr.y + y - k.y) < k.r) ||
        out.some(o => o.k !== 'climb' && pr.x + x > o.x + o.l - pad && pr.x + x < o.x + o.r + pad &&
          pr.y + y > o.y + o.t0 - pad && pr.y + y < o.y + o.b + pad))) { dropped.add(pr); continue; }
      out.push(pr);
      continue;
    }
    if (pr.on && dropped.has(pr.on)) continue;
    const x0 = pr.x + pr.l - pad, x1 = pr.x + pr.r + pad, y0 = pr.y + pr.t0 - pad, y1 = pr.y + pr.b + pad;
    if (keep.some(k => k.x + k.r > x0 && k.x - k.r < x1 && k.y + k.r > y0 && k.y - k.r < y1)) continue;
    // plants may hang through each other (that's what a clump is); nothing else may overlap
    if (out.some(o => !(o.k === 'climb' && pr.k === 'climb') && !o.arc &&
      o.x + o.l < x1 && o.x + o.r > x0 && o.y + o.t0 < y1 && o.y + o.b > y0)) continue;
    out.push(pr);
  }
  return out;
}
// is a prop's anchoring rock still there? The cell it hangs off, or either neighbour, so a
// one-pixel nick doesn't drop it — you have to really cut it loose.
function propAnchored(pr, mat) {
  if (pr.on) return !pr.on.fall && !pr.on.gone;          // a strand hangs off its arched vine
  if (pr.anc2 && !propAnchored({ anc: pr.anc2 }, mat)) return false;   // an arch needs both ends
  if (!pr.anc) return true;
  const [cx, cy] = pr.anc;
  for (let dx = -1; dx <= 1; dx++) {
    const x = cx + dx;
    if (x >= 0 && x < CW && cy >= 0 && cy < CH && mat[cy * CW + x]) return true;
  }
  return false;
}

// ---- drawing the props ----
const rgbA = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')';
const rgbS = c => (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0);
// the colour a prop breaks into
function propCol(pr, T) {
  return { icicle: '#bfe6ff', icefall: '#bfe6ff', geode: '#c58cff', salt: '#e8e2cc', bone: '#e6dcc4',
    obsidian: '#4a3050', cart: '#8a5a3a', statue: rgbA(T.rock[1]), pillar: rgbA(T.brick[1]),
    monolith: rgbA(T.bg2), skulls: '#e6dcc4', stone: '#c58cff', shard: rgbA(T.moss[1]),
    chain: '#8a7a6a', lantern: '#ffb050', crystal: '#d6a0ff', lava: '#ff7a2a' }[pr.st] || rgbA(T.moss[1]);
}
// An arched vine (v87): a few twisted stems along the curve, swaying a little in the middle
// (never at the ends, which are held), thick with leaves. The strands hanging off it are
// ordinary vine props. While it burns, the burnt stretch (u0..u1) is gone.
function drawArch(ctx, pr, time, T) {
  const A = pr.arc, n = A.length - 1, x = pr.x, y = pr.y;
  const col = pr.st === 'root' ? mix(T.moss[0], [200, 190, 160], 0.4) : T.moss[0];
  const sway = k => Math.sin(time * 0.9 + pr.seed * 6 + k * 0.35) * 0.8 * Math.sin(Math.PI * k / n);
  const gone = k => pr.burn && k / n > pr.u0 && k / n < pr.u1;
  const fr = v => v - Math.floor(v);
  for (let s = 0; s < pr.thick; s++) {
    ctx.strokeStyle = rgbA(mix(col, [0, 0, 0], 0.18 * s));
    ctx.lineWidth = pr.st === 'root' ? 1.8 : 1.2;
    ctx.beginPath();
    let pen = false;
    for (let k = 0; k <= n; k++) {
      if (gone(k)) { pen = false; continue; }
      const tw = pr.thick > 1 ? Math.sin(k * 1.3 + s * 2.1 + pr.seed * 9) * 0.9 : 0;
      const px = x + A[k][0], py = y + A[k][1] + sway(k) + tw;
      if (pen) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      pen = true;
    }
    ctx.stroke();
  }
  // leaves: several per segment, either side of the stems, hanging down a little
  ctx.fillStyle = rgbA(T.moss[1]);
  for (let k = 0; k < n; k++) {
    if (gone(k) || gone(k + 1)) continue;
    for (let j = 0; j < 3; j++) {
      const h = fr(Math.sin(k * 12.9898 + j * 78.233 + pr.seed * 437) * 43758.5);
      const t = (j + h) / 3, s = (k + j) % 2 ? 1 : -1;
      const lx = x + A[k][0] + (A[k + 1][0] - A[k][0]) * t;
      const ly = y + A[k][1] + (A[k + 1][1] - A[k][1]) * t + sway(k + t) + 1 + h * 1.5;
      ctx.beginPath();
      ctx.ellipse(lx + s * (1 + h), ly, 1.9, 0.9, s * (0.5 + h * 0.6), 0, 6.29); ctx.fill();
    }
  }
}
// One prop, in world units, before the fog. Anything that glows gets its light added after
// the fog in propGlow, so the light shows in the dark but the prop itself stays hidden.
function drawProp(ctx, pr, time, T) {
  const x = pr.x, y = pr.y, st = pr.st;
  ctx.save();
  if (pr.shake > 0) ctx.translate(Math.sin(time * 90) * 0.8, 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const tri = (ax, ay, bx, by, cx, cy) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); };
  switch (pr.k) {
    case 'climb': {
      if (pr.arc) { drawArch(ctx, pr, time, T); break; }
      const len = pr.len, sw = st === 'kelp' ? 5 : st === 'chain' ? 0.8 : 1.6;
      const off = k => Math.sin(time * (st === 'kelp' ? 1.6 : 1.1) + pr.seed * 6 + k * 0.08) * sw * (k / len);
      if (st === 'icefall') {
        const x0 = pr.side < 0 ? x : x - 7;
        ctx.fillStyle = 'rgba(170,215,240,0.5)'; ctx.fillRect(x0, y - 4, 7, len + 4);
        ctx.strokeStyle = 'rgba(235,250,255,0.55)'; ctx.lineWidth = 0.8;
        for (let k = 0; k < 3; k++) { const lx = x0 + 1.5 + k * 2; ctx.beginPath(); ctx.moveTo(lx, y - 2); ctx.lineTo(lx + Math.sin(k + pr.seed * 9) * 0.8, y + len); ctx.stroke(); }
        ctx.fillStyle = 'rgba(190,230,255,0.75)';
        for (let k = 0; k < 3; k++) tri(x0 + k * 2.3, y + len, x0 + k * 2.3 + 2.3, y + len, x0 + k * 2.3 + 1.1, y + len + 3 + (k % 2) * 2);
        break;
      }
      if (st === 'chain') {
        ctx.strokeStyle = '#6f635a'; ctx.lineWidth = 0.9;
        for (let k = 0; k < len; k += 3.2) {
          const lx = x + off(k), vert = Math.round(k / 3.2) % 2 === 0;
          ctx.beginPath(); ctx.ellipse(lx, y + k + 1.6, vert ? 1 : 1.8, vert ? 2 : 1.1, 0, 0, 6.29); ctx.stroke();
        }
        break;
      }
      if (st === 'myc') {
        for (let s = -1; s <= 1; s++) {
          ctx.strokeStyle = rgbA(T.moss[1], 0.45 + 0.15 * s); ctx.lineWidth = 0.6;
          const l = len * (0.75 + 0.2 * Math.sin(s * 3 + pr.seed * 9));
          ctx.beginPath(); ctx.moveTo(x + s * 1.6, y);
          for (let k = 0; k <= l; k += 4) ctx.lineTo(x + s * 1.6 + off(k) + Math.sin(k * 0.3 + s) * 0.6, y + k);
          ctx.stroke();
          ctx.fillStyle = rgbA(T.moss[1], 0.8);
          ctx.beginPath(); ctx.arc(x + s * 1.6 + off(l), y + l, 1, 0, 6.29); ctx.fill();
        }
        break;
      }
      const col = st === 'root' ? mix(T.moss[0], [200, 190, 160], 0.4) : T.moss[0];
      ctx.strokeStyle = rgbA(col); ctx.lineWidth = st === 'root' ? 2.2 : st === 'kelp' ? 1.8 : 1.3;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k <= len; k += 3) ctx.lineTo(x + off(k) + (st === 'root' ? Math.sin(k * 0.4 + pr.seed * 5) * 0.8 : 0), y + k);
      ctx.stroke();
      ctx.fillStyle = rgbA(T.moss[1]);
      for (let k = 4, s = 1; k < len; k += st === 'kelp' ? 7 : 5, s = -s) {
        const lx = x + off(k);
        if (st === 'root') { ctx.fillRect(lx - 1.4, y + k, 2.8, 1.4); continue; }
        ctx.beginPath();
        ctx.ellipse(lx + s * 2, y + k, st === 'kelp' ? 3 : 1.8, 0.9, s * 0.5, 0, 6.29); ctx.fill();
      }
      break;
    }
    case 'drip': {
      if (st === 'steam') {                     // a pipe out of the wall
        const s = -pr.side, x0 = s > 0 ? x : x - 8;
        ctx.fillStyle = '#5a4a3e'; ctx.fillRect(x0, y - 2, 8, 4);
        ctx.fillStyle = '#7a6452'; ctx.fillRect(x0 + (s > 0 ? 6 : 0), y - 3, 2, 6);
        break;
      }
      if (st === 'sparks') {
        ctx.fillStyle = '#35333a'; ctx.fillRect(x - 3, y, 6, 4);
        ctx.strokeStyle = '#6a6a70'; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(x + 1, y + 4); ctx.quadraticCurveTo(x + 3, y + 8, x + 1.5, y + 10); ctx.stroke();
        break;
      }
      if (st === 'crystal') {
        ctx.fillStyle = rgbA(T.moss[1], 0.9);
        tri(x - 2.5, y, x - 0.5, y, x - 1.5, y + 5); tri(x, y, x + 2.5, y, x + 1.2, y + 4);
        break;
      }
      const c = st === 'lava' ? [255, 110, 40] : st === 'soot' ? [22, 22, 26] : st === 'cascade' ? [140, 200, 255] : [120, 190, 255];
      ctx.fillStyle = rgbA(c, st === 'cascade' ? 0.8 : 0.85);
      if (st === 'cascade') { ctx.fillRect(x - 5, y, 10, 1.6); break; }
      const g = st === 'soot' ? 0 : ((pr.acc || 0) % 1);
      ctx.beginPath(); ctx.ellipse(x, y + 0.8 + g * 1.5, 1.2 + g * 0.5, 0.9 + g * 1.2, 0, 0, 6.29); ctx.fill();
      break;
    }
    case 'drop': {
      if (st === 'icicle') {
        ctx.fillStyle = 'rgba(190,230,255,0.9)'; tri(x - 3.5, y, x + 3.5, y, x + 0.3, y + 16);
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; tri(x - 1.8, y, x - 0.6, y, x - 0.2, y + 10);
      } else {
        ctx.fillStyle = rgbA(mix(T.rock[0], [0, 0, 0], 0.3)); ctx.beginPath(); ctx.ellipse(x, y + 1.5, 7, 3, 0, 0, 6.29); ctx.fill();
        const cs = [[-4.5, 8], [-1.5, 12], [1.8, 10], [4.6, 7]];
        cs.forEach(([dx, l], k) => { ctx.fillStyle = rgbA(k % 2 ? T.moss[1] : T.moss[0]); tri(x + dx - 1.8, y + 2, x + dx + 1.8, y + 2, x + dx, y + l); });
      }
      break;
    }
    case 'spike': {
      if (pr.hang) { ctx.translate(0, 2 * y); ctx.scale(1, -1); }
      const base = st === 'obsidian' ? [44, 28, 48] : st === 'salt' ? [226, 220, 198] : [222, 212, 188];
      const hs = [[-4, 7], [0, 10], [4, 6]];
      for (const [dx, hgt] of hs) {
        ctx.fillStyle = rgbA(base); tri(x + dx - 2.4, y, x + dx + 2.4, y, x + dx, y - hgt);
        ctx.fillStyle = st === 'obsidian' ? 'rgba(200,110,255,0.55)' : 'rgba(255,255,255,0.45)';
        tri(x + dx - 0.6, y, x + dx + 0.4, y, x + dx, y - hgt + 1);
        if (st === 'bone') { ctx.fillStyle = rgbA(base); ctx.beginPath(); ctx.arc(x + dx, y - 0.5, 1.8, 0, 6.29); ctx.fill(); }
      }
      break;
    }
    case 'barrel': {                           // a minecart full of blasting powder
      ctx.fillStyle = '#2a2a30';
      ctx.beginPath(); ctx.arc(x - 5, y - 2.2, 2.2, 0, 6.29); ctx.arc(x + 5, y - 2.2, 2.2, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#b2362c';
      for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * 3.5 - 1, y - 13 + Math.abs(k), 2, 4);
      ctx.fillStyle = '#6e4a32'; ctx.beginPath(); ctx.moveTo(x - 9, y - 10); ctx.lineTo(x + 9, y - 10); ctx.lineTo(x + 7.5, y - 3.5); ctx.lineTo(x - 7.5, y - 3.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8c8f96'; ctx.fillRect(x - 9, y - 10.5, 18, 1.3); ctx.fillRect(x - 8, y - 6.5, 16, 1);
      ctx.fillStyle = '#ffd23c'; ctx.font = '700 5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - 4.6);
      break;
    }
    case 'lamp': {
      if (st === 'cap') {
        ctx.fillStyle = rgbA(mix(T.moss[1], [240, 240, 240], 0.5)); ctx.fillRect(x - 1, y - 6, 2, 6);
        ctx.fillStyle = rgbA(T.moss[1]); ctx.beginPath(); ctx.ellipse(x, y - 6, 5, 3.4, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x - 2.5, y - 8, 1, 1); ctx.fillRect(x + 1.5, y - 7.5, 1, 1);
        break;
      }
      if (st === 'hanglamp') {                 // on a chain from the roof, swinging a touch
        const sw = Math.sin(time * 1.3 + pr.seed * 30) * 0.06, bx = x + Math.sin(sw) * pr.len, by = y + Math.cos(sw) * pr.len;
        ctx.strokeStyle = '#5a5048'; ctx.lineWidth = 0.8; ctx.setLineDash([1.2, 0.8]);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#4a3a2a'; ctx.fillRect(bx - 3, by, 6, 1.5); ctx.fillRect(bx - 2.5, by + 7.5, 5, 1.5);
        ctx.fillStyle = '#ffcc70'; ctx.fillRect(bx - 2, by + 1.5, 4, 6);
        ctx.fillStyle = '#fff2c0'; ctx.fillRect(bx - 0.7, by + 3, 1.4, 3);
        ctx.fillStyle = '#4a3a2a'; ctx.fillRect(bx - 2.6, by + 1.5, 0.8, 6); ctx.fillRect(bx + 1.8, by + 1.5, 0.8, 6);
        break;
      }
      const s = -pr.side, lx = x + s * 5;
      ctx.strokeStyle = '#4a3e36'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(lx, y - 5); ctx.lineTo(lx, y - 3); ctx.stroke();
      ctx.fillStyle = '#5c4632'; ctx.fillRect(lx - 2.5, y - 3, 5, 7);
      ctx.fillStyle = '#ffcc70'; ctx.fillRect(lx - 1.5, y - 2, 3, 4.5);
      break;
    }
    case 'vent': {
      ctx.fillStyle = '#1a1010'; ctx.beginPath(); ctx.ellipse(x, y - 0.5, 5, 1.8, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = pr.warn || pr.on ? '#ff8a3a' : 'rgba(255,110,40,0.5)';
      ctx.fillRect(x - 2.5, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1.2, 1.2, 1);
      break;
    }
    case 'pad': {                               // a bouncy mushroom, squashed as it throws you
      const sq = Math.max(0, pr.sq || 0) / 0.3, hh = 8 * (1 - 0.4 * sq), ww = 10 * (1 + 0.25 * sq);
      ctx.fillStyle = rgbA(mix(T.moss[1], [240, 230, 220], 0.6)); ctx.fillRect(x - 1.8, y - hh, 3.6, hh);
      ctx.fillStyle = rgbA(T.moss[0]); ctx.beginPath(); ctx.ellipse(x, y - hh, ww, 5, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (const [dx, dy] of [[-5, -2], [0, -3.8], [4.5, -1.8]]) { ctx.beginPath(); ctx.arc(x + dx * ww / 10, y - hh + dy, 0.9, 0, 6.29); ctx.fill(); }
      break;
    }
    case 'zone': {
      const x0 = x + pr.l, w = pr.r - pr.l;
      if (st === 'ice') { ctx.fillStyle = 'rgba(190,230,255,0.6)'; ctx.fillRect(x0, y - 1.6, w, 1.6); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(x0 + 2, y - 1.6, w - 4, 0.5); }
      else if (st === 'snow' || st === 'ash') {
        ctx.fillStyle = st === 'snow' ? 'rgba(236,244,255,0.95)' : rgbA(mix(T.rock[1], [90, 90, 90], 0.5));
        ctx.beginPath(); ctx.moveTo(x0, y);
        for (let k = 0; k <= w; k += 2) ctx.lineTo(x0 + k, y - 1 - 3.2 * Math.sin(Math.PI * k / w) - Math.sin(k * 0.7 + pr.seed * 9) * 0.5);
        ctx.lineTo(x0 + w, y); ctx.closePath(); ctx.fill();
      } else if (st === 'slime' || st === 'puddle' || st === 'acid') {
        const c = st === 'slime' ? [110, 200, 90] : st === 'puddle' ? [70, 130, 190] : [150, 168, 60];
        ctx.fillStyle = rgbA(c, st === 'puddle' ? 0.6 : 0.7); ctx.fillRect(x0, y - 2.5, w, 2.5);
        ctx.fillStyle = rgbA(mix(c, [255, 255, 255], 0.4), 0.7);
        const nb = Math.max(1, Math.floor(w / 8));
        for (let k = 0; k < nb; k++) {
          const ph = (time * (st === 'acid' ? 0.9 : 0.4) + k * 0.37 + pr.seed) % 1;
          ctx.beginPath(); ctx.arc(x0 + (k + 0.5) * w / nb, y - 2.5 - ph * 2, 0.6 + ph * 0.6, 0, 6.29); ctx.fill();
        }
      } else if (st === 'glass') {
        for (let k = 0; k < w; k += 2.2) {
          const s = Math.sin(k * 12.9 + pr.seed * 78) * 43758.5 % 1;
          ctx.fillStyle = 'rgba(200,240,255,' + (0.35 + Math.abs(s) * 0.4) + ')';
          tri(x0 + k, y, x0 + k + 1.6, y, x0 + k + 0.6 + s, y - 1.5 - Math.abs(s) * 2);
        }
      } else if (st === 'log') {
        ctx.fillStyle = '#2c2220'; ctx.fillRect(x0 + 1, y - 4, w - 2, 4);
        ctx.fillStyle = 'rgba(255,' + Math.round(100 + 40 * Math.sin(time * 3 + pr.seed * 9)) + ',40,0.8)';
        for (let k = 4; k < w - 3; k += 5) ctx.fillRect(x0 + k, y - 2.8 + (k % 2), 1.6, 0.8);
      }
      break;
    }
    case 'pod': {
      const b = 1 + 0.06 * Math.sin(time * 3 + pr.seed * 9);
      ctx.fillStyle = rgbA(T.moss[0]); ctx.fillRect(x - 0.6, y - 3, 1.2, 3);
      ctx.fillStyle = '#9cc44a'; ctx.beginPath(); ctx.ellipse(x, y - 6, 4.4 * b, 5 * b, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#d8f07a';
      ctx.beginPath(); ctx.arc(x - 1.5, y - 7, 0.9, 0, 6.29); ctx.arc(x + 1.6, y - 5, 0.8, 0, 6.29); ctx.fill();
      break;
    }
    case 'noise': {
      if (st === 'skulls') {
        for (const [dx, dy] of [[-4.5, -2.2], [0, -2.4], [4.5, -2.2], [-2.2, -5.8], [2.3, -5.6]]) {
          ctx.fillStyle = '#ded4bc'; ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.3, 0, 6.29); ctx.fill();
          ctx.fillStyle = '#2a2622'; ctx.fillRect(x + dx - 1.3, y + dy - 0.4, 0.9, 0.9); ctx.fillRect(x + dx + 0.4, y + dy - 0.4, 0.9, 0.9);
        }
      } else {
        const s = -pr.side, cx = x + s * 4;
        ctx.fillStyle = rgbA(mix(T.rock[1], T.moss[0], 0.4));
        ctx.beginPath(); ctx.ellipse(cx, y, 4, 9, 0, 0, 6.29); ctx.fill();
        ctx.strokeStyle = rgbA(T.moss[1], 0.5 + 0.5 * Math.max(0, pr.ring || 0)); ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(cx, y - 6); ctx.lineTo(cx - 1.5, y - 1); ctx.lineTo(cx + 1.2, y + 2); ctx.lineTo(cx, y + 6); ctx.stroke();
      }
      break;
    }
    case 'shard': {
      ctx.fillStyle = rgbA(T.moss[1], 0.85);
      const dir = pr.side ? -pr.side : 0;
      if (dir) { tri(x, y - 2, x, y + 2, x + dir * 5, y - 0.5); tri(x, y + 1, x, y + 3.5, x + dir * 3, y + 3); }
      else { tri(x - 2, y, x + 1, y, x - 1, y - 5); tri(x, y, x + 3, y, x + 2.4, y - 3.5); }
      break;
    }
    case 'cover': {
      if (pr.hitT > 0) ctx.translate(Math.sin(time * 80) * 0.6, 0);
      if (st === 'statue') {                  // a drowned figure on a plinth, streaked with algae
        ctx.fillStyle = rgbA(T.rock[0]); ctx.fillRect(x - 8, y - 6, 16, 6);
        ctx.fillStyle = rgbA(T.rock[1]); ctx.beginPath(); ctx.moveTo(x - 5, y - 6); ctx.lineTo(x - 4, y - 20); ctx.lineTo(x + 4, y - 20); ctx.lineTo(x + 5, y - 6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 23.5, 3.6, 0, 6.29); ctx.fill();
        ctx.fillStyle = rgbA(T.moss[0], 0.8);
        ctx.fillRect(x - 3, y - 20, 1, 12); ctx.fillRect(x + 1.5, y - 17, 1, 9); ctx.fillRect(x - 1, y - 26, 2, 1.2);
      } else if (st === 'pillar') {           // cracks spread as it takes hits
        ctx.fillStyle = rgbA(T.brick[1]); ctx.fillRect(x - 5, y - 27, 10, 27);
        ctx.fillStyle = rgbA(T.brick[0]); ctx.fillRect(x - 7, y - 30, 14, 3); ctx.fillRect(x - 7, y - 3, 14, 3);
        ctx.strokeStyle = '#1e1a1a'; ctx.lineWidth = 0.7;
        const dmg = 4 - Math.max(0, pr.hp);
        for (let k = 0; k < dmg; k++) { const cy = y - 8 - k * 6; ctx.beginPath(); ctx.moveTo(x - 5, cy); ctx.lineTo(x - 1, cy - 2); ctx.lineTo(x + 1, cy + 1); ctx.lineTo(x + 5, cy - 1); ctx.stroke(); }
      } else {                                // a monolith that won't hold still
        const sk = Math.sin(time * 0.8 + pr.seed * 9) * 0.08;
        ctx.transform(1, 0, sk, 1, -sk * y, 0);
        ctx.fillStyle = rgbA(mix(T.bg2, [0, 0, 0], 0.2)); ctx.fillRect(x - 6, y - 34, 12, 34);
        ctx.fillStyle = rgbA(T.moss[1], 0.5 + 0.3 * Math.sin(time * 2 + pr.seed * 7));
        ctx.fillRect(x - 0.6, y - 28, 1.2, 8); ctx.fillRect(x - 3, y - 24.6, 6, 1.2);
      }
      break;
    }
    case 'matter': {
      const by = y + Math.sin(time * 1.3 + pr.seed * 9) * 3;
      ctx.fillStyle = '#050208'; ctx.beginPath(); ctx.arc(x, by, 6.5, 0, 6.29); ctx.fill();
      ctx.strokeStyle = 'rgba(160,90,255,0.7)'; ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) { const a = time * 2.4 + k * 2.09; ctx.beginPath(); ctx.arc(x, by, 8 + k, a, a + 1.4); ctx.stroke(); }
      break;
    }
    case 'tendril': {
      ctx.fillStyle = '#2a1640'; ctx.beginPath(); ctx.ellipse(x, y - 1.5, 4, 2.5, 0, 0, 6.29); ctx.fill();
      const ext = Math.max(4, pr.ext || 0), a = pr.aimA != null ? pr.aimA : pr.ang;
      const tx = x + Math.cos(a) * ext, ty = y - 2 + Math.sin(a) * ext;
      const wob = Math.sin(time * 5 + pr.seed * 9) * ext * 0.2;
      const mx = (x + tx) / 2 + Math.cos(a + 1.57) * wob, my = (y + ty) / 2 + Math.sin(a + 1.57) * wob;
      ctx.strokeStyle = '#3e2066'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.quadraticCurveTo(mx, my, tx, ty); ctx.stroke();
      ctx.strokeStyle = rgbA(T.moss[1], 0.8); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo((mx + tx) / 2, (my + ty) / 2); ctx.lineTo(tx, ty); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}
// The light a prop gives off, drawn after the fog with 'lighter'. Lanterns, glowing caps,
// a vent in full roar, shards catching your torch, eyes in the dark.
function propGlow(ctx, pr, time, T, pdist, torchR) {
  const x = pr.x, y = pr.y;
  if (pr.k === 'lamp') {
    const f = 0.85 + 0.15 * Math.sin(time * 9 + pr.seed * 20) * Math.sin(time * 4.3 + pr.seed * 7);
    if (pr.st === 'cap') glowAt(ctx, x, y - 7, 30, 0.2 * f, rgbS(T.moss[1]));
    else if (pr.st === 'hanglamp') {
      const sw = Math.sin(time * 1.3 + pr.seed * 30) * 0.06, bx = x + Math.sin(sw) * pr.len, by = y + Math.cos(sw) * pr.len + 4.5;
      glowAt(ctx, bx, by, 52, 0.17 * f, '255,160,70'); glowAt(ctx, bx, by, 9, 0.4 * f, '255,210,130');
    }
    else { const lx = x - pr.side * 5; glowAt(ctx, lx, y, 46, 0.16 * f, '255,160,70'); glowAt(ctx, lx, y, 8, 0.4 * f, '255,210,130'); }
  } else if (pr.k === 'vent' && (pr.on || pr.warn)) {
    glowAt(ctx, x, y - (pr.on ? 28 : 3), pr.on ? 44 : 12, pr.on ? 0.35 : 0.25, '255,120,40');
    if (pr.on) {
      const g = ctx.createLinearGradient(0, y - VENT_H, 0, y);
      g.addColorStop(0, 'rgba(255,90,30,0)'); g.addColorStop(0.5, 'rgba(255,140,50,0.55)'); g.addColorStop(1, 'rgba(255,230,150,0.9)');
      ctx.fillStyle = g;
      const w = 4 + Math.sin(time * 40) * 0.8;
      ctx.fillRect(x - w, y - VENT_H, w * 2, VENT_H);
    }
  } else if (pr.k === 'shard' && pdist < torchR) {
    const g = (1 - pdist / torchR) * Math.pow(0.5 + 0.5 * Math.sin(time * 5 + pr.seed * 40), 6);
    if (g > 0.03) {
      ctx.fillStyle = 'rgba(255,255,255,' + g + ')';
      ctx.fillRect(x - 4, y - 0.4, 8, 0.8); ctx.fillRect(x - 0.4, y - 4, 0.8, 8);
      glowAt(ctx, x, y, 7, 0.5 * g, rgbS(T.moss[1]));
    }
  } else if (pr.k === 'eyes') {
    // they fade out as you come near, so you never quite catch what's watching
    const a = eyesAlpha(pdist) * (Math.sin(time * 0.9 + pr.seed * 40) > 0.96 ? 0.1 : 1) *
      (0.55 + 0.25 * Math.sin(time * 1.7 + pr.seed * 9));
    if (a > 0.02) {
      const c = pr.seed < 0.5 ? '255,60,70' : rgbS(T.moss[1]);
      ctx.fillStyle = 'rgba(' + c + ',' + a + ')';
      ctx.fillRect(x - 4, y - 0.6, 2, 1.2); ctx.fillRect(x + 2, y - 0.6, 2, 1.2);
      glowAt(ctx, x, y, 9, 0.25 * a, c);
    }
  } else if (pr.k === 'matter') {
    glowAt(ctx, x, y + Math.sin(time * 1.3 + pr.seed * 9) * 3, 26, 0.12, '140,70,255');
  } else if (pr.k === 'drip' && pr.st === 'lava') {
    glowAt(ctx, x, y + 2, 10, 0.3, '255,110,40');
  }
}
// eyes are gone by the time you're 60 units off, and fully there from 180
const eyesAlpha = d => Math.max(0, Math.min(1, (d - 60) / 120));
const VENT_H = 64;                     // how tall a scorched vent's fire pillar stands

// ---- sound ----
// Every sound is synthesised on the spot with the Web Audio API — there are no sound files.
// First the pure part (which voice a spell, creature or floor speaks with, and how its stats
// bend it; tested under Node), then SFX, the engine, which only touches the browser once the
// first tap has unlocked audio. The style is a blend: retro oscillator sweeps for the magic,
// filtered noise and crackle for the organic parts (fire, rock, breath, water).

// A spell's voice is its theme. Anything a trigger variant is built from speaks with its base.
const SPELL_VOICE = {
  bolt: 'magic', spark: 'magic', spit: 'magic', arrow: 'magic',
  lance: 'pierce', glance: 'pierce',
  slug: 'heavy', eorb: 'energy', esph: 'energy',
  buck: 'scatter', orb: 'bubble', bubble: 'bubble',
  saw: 'saw', disc: 'saw',
  blast: 'lob', cross: 'lob', nuke: 'lob',
  missile: 'fire', fball: 'fire', fbolt: 'fire', meteor: 'fire',
  zap: 'thunder', chain: 'thunder',
  void: 'void', digbolt: 'dig', plasma: 'beam', ldrill: 'beam', pollen: 'spore',
  tele: 'energy', teleshort: 'energy',
  // statics: the explosions make their bang when they go off, so casting one is silent
  boom: 'none', brim: 'none', crystal: 'crystal', dormant: 'crystal', glitter: 'crystal',
  stillc: 'aura', shieldc: 'aura', vigour: 'aura', storm: 'thunder', vacfield: 'void',
};
const SPELL_VOICES = ['magic', 'pierce', 'heavy', 'energy', 'scatter', 'bubble', 'saw', 'lob',
  'fire', 'thunder', 'void', 'dig', 'beam', 'spore', 'crystal', 'aura', 'none'];
const clampS = (v, a, b) => Math.max(a, Math.min(b, v));
// The recipe for one planned shot, from its FINAL stats — after every modifier has had its
// go. The theme gives it its character; the stats bend it: faster is higher, bigger is lower
// and longer, harder-hitting is louder, homing warbles, explosive/boring shots get grit,
// piercing ones a bright edge, bouncing ones a little "boing", pellets a flam.
function shotSound(sh) {
  const id = sh.sid, m = id && MODS[id];
  const v = SPELL_VOICE[(m && m.base) || id] || (sh.still ? 'aura' : 'magic');
  if (sh.still) {
    const r = sh.r || 30;
    return { v, pitch: clampS(Math.pow(40 / r, 0.4), 0.5, 1.8), vol: 0.6, dur: 1, n: 1,
      wob: 0, grit: 0, bright: 0, boing: 0 };
  }
  const speed = sh.beam ? 700 : sh.speed > 0 ? sh.speed : 500;
  const size = Math.max(0.8, sh.size || 2);
  const count = Math.max(1, Math.round(sh.count || 1));
  return {
    v,
    pitch: clampS(Math.pow(speed / 500, 0.3) * Math.pow(2.5 / size, 0.4), 0.35, 2.4),
    vol: clampS(0.35 + 0.16 * Math.log2(1 + Math.max(0.3, sh.dmg || 0) * count), 0.25, 1),
    dur: clampS(Math.pow(size / 2.5, 0.3), 0.7, 1.8),
    n: Math.min(3, count),
    wob: (sh.homing || 0) + (sh.spiral || 0) + (sh.orbit || 0) + (sh.boomer || 0) + (sh.pong || 0) > 0 ? 1 : 0,
    grit: sh.explode || sh.bore || sh.eat || sh.cluster ? 1 : 0,
    bright: sh.pierce > 0 || sh.crit > 0 ? 1 : 0,
    boing: sh.bounce > 0 ? 1 : 0,
  };
}

// Creatures speak by body, with a few overrides where the body alone would be wrong.
const BODY_VOICE = { drone: 'gibber', crawler: 'chitter', spider: 'chitter', worm: 'slither', blob: 'gurgle', jelly: 'gurgle', skull: 'rattle',
  rat: 'chitter', nest: 'chitter' };
const CREATURE_TONE = { lohkare: 'growl', hurtta: 'growl', jaatio: 'icy', tuli: 'ember', karpas: 'spore' };
const CREATURE_VOICES = ['gibber', 'chitter', 'slither', 'gurgle', 'rattle', 'growl', 'icy', 'ember', 'spore'];
function creatureSound(k) {
  const v = CREATURE_TONE[k.id] || BODY_VOICE[k.body] || 'chitter';
  // small things squeak, big ones rumble; quick ones are a touch higher again
  const r = k.r || 9, spd = k.spd || 40;
  const pitch = clampS(Math.pow(9 / r, 0.9) * (spd > 80 ? 1.2 : 1), 0.45, 2);
  return { v, pitch };
}
const AMB_EVENTS = ['drip', 'critter', 'wind', 'trickle', 'rumble', 'creak', 'chime', 'crack',
  'crackle', 'hiss', 'puff', 'bloop', 'hum', 'clank', 'rattle', 'whisper'];

// Which Dev volume knob each SFX.fx sound answers to (anything not listed is world/props).
const FX_VOL = { step: 'vStep', land: 'vStep', ignite: 'jetVol',
  open: 'vUi', close: 'vUi', switch: 'vUi', ready: 'vUi', prompt: 'vUi', place: 'vUi', coinland: 'vUi',
  crit: 'vSpell', chainhop: 'vSpell', split: 'vSpell', cluster: 'vSpell', refresh: 'vSpell', drain: 'vSpell',
  gspend: 'vSpell', saws: 'vSpell', warp: 'vSpell', healtick: 'vSpell', shieldUp: 'vSpell', ghost: 'vSpell',
  absorb: 'vEnemyFire', fizzle: 'vEnemyFire', drip: 'vDrip', sizzle: 'vDrip', splash: 'vDrip' };
function fxVolKey(name) { return FX_VOL[name] || 'vWorld'; }
const knob = k => (DEV[k] == null ? 1 : DEV[k]);

// Brushing through hanging plants. Called once a frame with what you are touching; returns
// how hard to rustle this frame (0 = stay quiet). Grabbing on or pushing into a new plant
// rustles at once; moving about inside them rustles now and then, more often the faster you
// go; hanging still is silent. After any rustle there is a short random pause, so a big clump
// of vines is a run of rustles rather than one per vine per frame. `st` keeps the pause.
function rustleStep(st, dt, touching, entered, speed, rnd) {
  rnd = rnd || Math.random;
  st.t = Math.max(0, (st.t || 0) - dt);
  if (!touching || st.t > 0) return 0;
  const s = clampS(speed / 220, 0, 1);
  if (entered) { st.t = 0.16 + rnd() * 0.12; return Math.max(0.55, s); }
  if (speed < 25) return 0;
  st.t = (0.42 - 0.24 * s) * (0.8 + rnd() * 0.5);
  return 0.3 + 0.5 * s;
}

// The engine. Nothing in here runs until the game calls it, and every call is wrapped so a
// browser without Web Audio (or one that refuses it) just plays in silence.
const SFX = (() => {
  let ac = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null, crackBuf = null;
  let voices = 0, hooked = false;
  const MAX_VOICES = 28, HEAR = 650;
  const gates = {};
  const ear = { x: 0, y: 0 };
  const loops = new Set();
  let amb = null, ambWant = null;
  const stats = { played: 0, errors: [] };        // for the tests: sounds played, and any that broke

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const gate = (key, ms) => { const t = now(); if (gates[key] && t - gates[key] < ms) return false; gates[key] = t; return true; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  // a broken sound must never break the game: it is noted (the tests read it) and skipped
  const safe = fn => function () {
    try { return fn.apply(null, arguments); } catch (e) { if (stats.errors.length < 20) stats.errors.push(String(e && e.message)); return null; }
  };

  function unlock() {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5;
        comp.attack.value = 0.003; comp.release.value = 0.25;
        master = ac.createGain(); master.gain.value = 1;
        sfxBus = ac.createGain(); sfxBus.gain.value = DEV.vol;
        ambBus = ac.createGain(); ambBus.gain.value = DEV.vol * DEV.amb;
        sfxBus.connect(master); ambBus.connect(master);
        master.connect(comp); comp.connect(ac.destination);
        // two seconds of white noise, and of crackle: silence broken by sparse sharp pops
        const n = ac.sampleRate * 2;
        noiseBuf = ac.createBuffer(1, n, ac.sampleRate);
        const nd = noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) nd[i] = Math.random() * 2 - 1;
        crackBuf = ac.createBuffer(1, n, ac.sampleRate);
        const cd = crackBuf.getChannelData(0);
        for (let i = 0; i < n; i++) if (Math.random() < 0.0016) {
          const amp = (Math.random() < 0.2 ? 1 : 0.35) * (Math.random() < 0.5 ? -1 : 1), len = 20 + Math.random() * 60;
          for (let j = 0; j < len && i + j < n; j++) cd[i + j] += amp * (1 - j / len) * (Math.random() * 2 - 1);
        }
      }
      if (ac.state === 'suspended') ac.resume();
      if (!hooked) {
        hooked = true;
        // put the app away and the sound stops with it
        document.addEventListener('visibilitychange', () => {
          try { if (document.visibilityState === 'hidden') ac.suspend(); else ac.resume(); } catch (_) {}
        });
      }
      if (ambWant && !amb) setAmbience(ambWant);
    } catch (_) {}
  }
  const live = () => ac && ac.state === 'running';

  // Where a sound is heard from: quieter and duller with distance, panned left or right of
  // you. Returns the node to plug the sound into, or null if it is too far off (or there are
  // already too many sounds going). x == null means "at you": full volume, centre.
  function out(x, y, dur, prio, bus, vol) {
    if (!live()) return null;
    if (voices >= MAX_VOICES && !prio) return null;
    let g = 1, pan = 0, cut = 0;
    if (x != null) {
      const dx = x - ear.x, dy = y - ear.y, d = Math.hypot(dx, dy);
      if (d > HEAR) return null;
      g = 1 / (1 + (d / 170) * (d / 170));
      if (g < 0.02) return null;
      pan = clampS(dx / 260, -0.85, 0.85);
      if (d > 120) cut = 16000 / (1 + (d - 120) / 50);
    }
    voices++; stats.played++;
    setTimeout(() => { voices--; }, (dur + 0.15) * 1000);
    const gn = ac.createGain(); gn.gain.value = g * (vol == null ? 1 : vol);
    if (ac.createStereoPanner) { const pn = ac.createStereoPanner(); pn.pan.value = pan; gn.connect(pn); pn.connect(bus || sfxBus); }
    else gn.connect(bus || sfxBus);
    if (!cut) return gn;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(400, cut); f.connect(gn);
    return f;
  }
  const lp = (dest, freq, q) => { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; f.Q.value = q || 0.7; f.connect(dest); return f; };
  function env(g, t, dur, peak, att) {
    peak = Math.max(0.0002, peak);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(att + 0.01, dur));
  }
  // one oscillator: a pitch sweep f0 -> f1 under a quick-attack, falling envelope, with an
  // optional vibrato [rate Hz, depth Hz]
  function tone(dest, type, f0, f1, t, dur, peak, att, vib) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    if (vib) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = vib[0]; lg.gain.value = vib[1];
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    env(g, t, dur, peak, att || 0.005);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  // filtered noise (or crackle): the organic half — breath, fire, rock, water, wind
  function hiss(dest, t, dur, peak, type, f0, f1, q, crackle, att) {
    const s = ac.createBufferSource(); s.buffer = crackle ? crackBuf : noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain(); env(g, t, dur, peak, att || 0.004);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  // a retro zap: a square wave whose pitch jumps about at random, falling overall
  function zap(dest, t, dur, peak, hi, lo) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square';
    for (let s = 0; s <= dur; s += 0.012) o.frequency.setValueAtTime(lo + (hi - lo) * (1 - s / dur) * Math.random(), t + s);
    env(g, t, dur, peak, 0.002);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function bell(dest, f, t, dur, peak) {
    [1, 2.76, 5.4].forEach((m, i) => tone(dest, 'sine', f * m, f * m, t, dur / (i + 1), peak / (i + 1), 0.002));
  }

  // ---- the spell voices: (dest, start, pitch, volume, length) ----
  const VOICE = {
    magic(d, t, P, V, D) {
      tone(d, 'triangle', 950 * P, 380 * P, t, 0.13 * D, 0.5 * V);
      tone(d, 'square', 475 * P, 190 * P, t, 0.09 * D, 0.1 * V);
      hiss(d, t, 0.07 * D, 0.25 * V, 'bandpass', 2600 * P, 1200 * P, 1.2);
    },
    pierce(d, t, P, V, D) {
      tone(d, 'sawtooth', 1500 * P, 500 * P, t, 0.1 * D, 0.22 * V);
      hiss(d, t, 0.15 * D, 0.35 * V, 'highpass', 5000, 2500, 0.7);
      tone(d, 'sine', 2400 * P, 2300 * P, t, 0.05, 0.18 * V);
    },
    heavy(d, t, P, V, D) {
      tone(d, 'sine', 170 * P, 50 * P, t, 0.28 * D, 0.9 * V, 0.003);
      tone(d, 'square', 85 * P, 42 * P, t, 0.16 * D, 0.12 * V);
      hiss(d, t, 0.14 * D, 0.5 * V, 'lowpass', 900, 200, 0.8);
    },
    energy(d, t, P, V, D) {
      tone(d, 'sine', 260 * P, 380 * P, t, 0.3 * D, 0.6 * V, 0.02, [16, 30 * P]);
      tone(d, 'square', 130 * P, 190 * P, t, 0.22 * D, 0.07 * V);
      hiss(d, t, 0.2 * D, 0.15 * V, 'bandpass', 800 * P, 1600 * P, 3);
    },
    scatter(d, t, P, V, D) {
      hiss(d, t, 0.2 * D, 0.9 * V, 'lowpass', 3000, 500, 0.8);
      tone(d, 'square', 150 * P, 55 * P, t, 0.12 * D, 0.22 * V);
      hiss(d, t, 0.05, 0.35 * V, 'highpass', 4000, 4000, 0.7);
    },
    bubble(d, t, P, V, D) {
      tone(d, 'sine', 320 * P, 1000 * P, t, 0.09 * D, 0.55 * V, 0.004);
      tone(d, 'sine', 480 * P, 1400 * P, t + 0.05, 0.07 * D, 0.3 * V, 0.004);
    },
    saw(d, t, P, V, D) {
      tone(d, 'square', 1900 * P, 1500 * P, t, 0.16 * D, 0.1 * V);
      tone(d, 'square', 2470 * P, 2000 * P, t, 0.16 * D, 0.08 * V);
      hiss(d, t, 0.18 * D, 0.45 * V, 'bandpass', 6000, 3500, 4);
      hiss(d, t, 0.1, 0.3 * V, 'lowpass', 700, 300, 1, true);
    },
    lob(d, t, P, V, D) {
      tone(d, 'sine', 240 * P, 85 * P, t, 0.16 * D, 0.8 * V, 0.003);
      hiss(d, t, 0.1, 0.35 * V, 'lowpass', 1400, 300);
      tone(d, 'triangle', 120 * P, 60 * P, t, 0.2 * D, 0.22 * V);
    },
    fire(d, t, P, V, D) {
      hiss(d, t, 0.38 * D, 0.7 * V, 'bandpass', 500 * P, 2400 * P, 1.4, false, 0.04);
      hiss(d, t, 0.3 * D, 0.7 * V, 'bandpass', 3000, 2000, 1, true);
      tone(d, 'sine', 110 * P, 60 * P, t, 0.3 * D, 0.35 * V, 0.02);
    },
    thunder(d, t, P, V, D) {
      hiss(d, t, 0.28 * D, 1.0 * V, 'highpass', 1400, 900, 0.7, true);
      zap(d, t, 0.14 * D, 0.14 * V, 2600 * P, 200 * P);
      tone(d, 'sine', 70, 40, t, 0.3 * D, 0.6 * V, 0.003);
    },
    // Black Hole: a deep falling sub, two low saws beating against each other, a slow
    // inward rush of air and a spit of crackle — and it keeps it up while it lives (loop)
    void(d, t, P, V, D) {
      tone(d, 'sine', 80, 30, t, 1.0 * D, 0.9 * V, 0.03);
      const f = lp(d, 320);
      tone(f, 'sawtooth', 55, 41, t, 0.9 * D, 0.2 * V, 0.05);
      tone(f, 'sawtooth', 56.7, 42, t, 0.9 * D, 0.2 * V, 0.05);
      hiss(d, t, 0.9 * D, 0.6 * V, 'bandpass', 1700, 900, 0.9, true);
      hiss(d, t, 0.55, 0.3 * V, 'bandpass', 300, 2400, 2, false, 0.35);
    },
    dig(d, t, P, V, D) {
      hiss(d, t, 0.12 * D, 0.7 * V, 'lowpass', 1200, 300, 1, true);
      hiss(d, t, 0.08 * D, 0.4 * V, 'lowpass', 800, 200);
      tone(d, 'square', 120 * P, 70 * P, t, 0.08, 0.15 * V);
    },
    beam(d, t, P, V, D) {
      tone(lp(d, 2400), 'sawtooth', 650 * P, 520 * P, t, 0.22 * D, 0.3 * V, 0.005, [34, 40 * P]);
      tone(d, 'sine', 1300 * P, 1100 * P, t, 0.2 * D, 0.28 * V);
      hiss(d, t, 0.18 * D, 0.2 * V, 'bandpass', 3000 * P, 1200 * P, 5);
    },
    spore(d, t, P, V, D) {
      hiss(d, t, 0.18 * D, 0.45 * V, 'bandpass', 1300 * P, 700 * P, 2.5, false, 0.02);
      hiss(d, t + 0.07, 0.14 * D, 0.3 * V, 'bandpass', 1700 * P, 900 * P, 2.5, false, 0.02);
      tone(d, 'sine', 520 * P, 720 * P, t, 0.12, 0.12 * V);
    },
    crystal(d, t, P, V, D) {
      bell(d, 1250 * P, t, 0.7 * D, 0.35 * V);
      hiss(d, t, 0.04, 0.2 * V, 'highpass', 7000, 7000);
    },
    aura(d, t, P, V) {
      [1, 1.26, 1.5].forEach(m => tone(d, 'sine', 330 * P * m, 333 * P * m, t, 0.9, 0.16 * V, 0.25));
      hiss(d, t, 0.8, 0.1 * V, 'highpass', 6000, 9000, 0.7, false, 0.3);
    },
    none() {},
  };
  // one planned shot's sound: its theme, then the stat-driven extras on top
  function playShot(r, x, y, delay) {
    if (r.v === 'none') return;
    // your own gun always gets through the voice cap; a trigger's payload out there may not
    const d = out(x, y, r.v === 'void' ? 1.3 : 0.6, x == null, null, knob('vSpell'));
    if (!d) return;
    const t0 = ac.currentTime + (delay || 0), P = r.pitch * rnd(0.95, 1.05), V = r.vol * 0.55, D = r.dur;
    for (let k = 0; k < r.n; k++) VOICE[r.v](d, t0 + k * 0.018, P * (1 + k * 0.04), V / (1 + k * 0.6), D);
    if (r.wob) tone(d, 'sine', 700 * P, 500 * P, t0, 0.22 * D, 0.13 * V, 0.01, [9, 60]);
    if (r.grit) hiss(d, t0, 0.1, 0.3 * V, 'lowpass', 900, 250, 1, true);
    if (r.bright) tone(d, 'square', 3200, 3000, t0, 0.03, 0.1 * V);
    if (r.boing) tone(d, 'triangle', 500 * P, 1100 * P, t0 + 0.08 * D, 0.07, 0.16 * V);
  }
  // a cast: every shot planned for this pull, but each theme only once (a Myriad of bolts
  // is one bolt sound, louder, not twenty of them on top of each other)
  function cast(shots, x, y) {
    const seen = {};
    let k = 0;
    for (const sh of shots) {
      const r = shotSound(sh);
      if (seen[r.v]) { seen[r.v].vol = Math.min(1, seen[r.v].vol + 0.08); continue; }
      if (++k > 4) break;
      seen[r.v] = r;
    }
    let i = 0;
    for (const v in seen) playShot(seen[v], x, y, i++ * 0.012);
  }

  // ---- impacts ----
  function hit(x, y) {
    if (!gate('hit', 35)) return;
    const d = out(x, y, 0.2, false, null, knob('vHit')); if (!d) return;
    const t = ac.currentTime;
    tone(d, 'sine', rnd(240, 290), 110, t, 0.08, 0.4);
    hiss(d, t, 0.06, 0.45, 'bandpass', 1400, 700, 1.5);
  }
  function rock(x, y) {
    if (!gate('rock', 45)) return;
    const d = out(x, y, 0.1, false, null, knob('vHit')); if (!d) return;
    const t = ac.currentTime;
    hiss(d, t, 0.05, 0.28, 'highpass', 2500, 1800, 0.8, true);
    tone(d, 'square', 180, 120, t, 0.03, 0.05);
  }
  function bounce(x, y) {
    if (!gate('bounce', 50)) return;
    const d = out(x, y, 0.1, false, null, knob('vHit')); if (!d) return;
    tone(d, 'triangle', 600, 950, ac.currentTime, 0.06, 0.18);
  }
  // every blast is a little different: its pitch, length, brightness and crackle tail are
  // rolled each time, so a chain of them doesn't sound like one sample on repeat
  function boom(x, y, R) {
    const big = R >= 40;
    if (!gate(big ? 'bigboom' : 'boom', big ? 60 : 30)) return;
    const s = clampS(R / 30, 0.3, 3.2), P = rnd(0.82, 1.18), L = rnd(0.85, 1.2);
    const d = out(x, y, 0.8 + 0.6 * s * L, big, null, knob('vBoom')); if (!d) return;
    const t = ac.currentTime;
    hiss(d, t, (0.25 + 0.45 * s) * L, rnd(0.8, 1), 'lowpass', 2600 / Math.pow(s, 0.4) * P, rnd(110, 200), rnd(0.5, 1));
    tone(d, 'sine', 95 / Math.pow(s, 0.2) * P, rnd(26, 36), t, (0.3 + 0.4 * s) * L, 0.9, 0.003);
    if (R >= 18 && Math.random() < 0.85) hiss(d, t + rnd(0.02, 0.08), (0.4 + 0.5 * s) * L, rnd(0.3, 0.5), 'bandpass', rnd(2000, 3000), rnd(900, 1500), 0.8, true);
    if (R >= 60) hiss(d, t + 0.1, 1.6 * L, 0.5, 'lowpass', 300 * P, 80, 0.7, false, 0.2);
  }
  // what a minecart throws about when it goes up: wood and iron clattering down after the bang
  function debris(x, y) {
    const d = out(x, y, 1.2, false, null, knob('vBoom')); if (!d) return;
    const t = ac.currentTime, n = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      const tt = t + rnd(0.12, 0.8), metal = Math.random() < 0.4;
      if (metal) tone(d, 'square', rnd(600, 1400), rnd(500, 1200), tt, rnd(0.04, 0.12), rnd(0.03, 0.07));
      hiss(d, tt, rnd(0.02, 0.07), rnd(0.15, 0.4), 'bandpass', rnd(1500, 5000), rnd(1000, 3000), rnd(1, 4), Math.random() < 0.6);
    }
  }
  // a spore pod bursting: a wet pop and a breath of spores, rolled fresh each time
  function pop(x, y) {
    const d = out(x, y, 1.2, false, null, knob('vBoom')); if (!d) return;
    const t = ac.currentTime, P = rnd(0.8, 1.25);
    tone(d, 'sine', 220 * P, 55 * P, t, rnd(0.12, 0.2), 0.7, 0.003);
    hiss(d, t, rnd(0.06, 0.12), 0.6, 'bandpass', rnd(600, 1300), rnd(250, 500), rnd(1.5, 3));
    hiss(d, t + rnd(0.03, 0.08), rnd(0.6, 1.1), rnd(0.12, 0.2), 'highpass', rnd(2500, 4000), rnd(5000, 7000), 0.7, false, rnd(0.08, 0.2));
    for (let i = 0; i < 3; i++) tone(d, 'sine', rnd(250, 500), rnd(500, 1000), t + rnd(0.05, 0.3), 0.05, 0.1, 0.004);
  }
  // Foliage rustle, strength 0..1. Nothing is fixed: how many leaf-crackles, when they land,
  // their pitch and sharpness, and the swish under them are all rolled every time, so
  // climbing through a heap of vines never repeats itself. The plant sets the range: fungus
  // is soft and low, roots are dry and woody, kelp is wet.
  const RUSTLE = {
    vine: { lo: 1800, hi: 4800, swish: [1400, 4200], wet: 0 },
    myc:  { lo: 900, hi: 2600, swish: [800, 2200], wet: 0 },
    root: { lo: 1200, hi: 3200, swish: [900, 2600], wet: 0, creak: 1 },
    kelp: { lo: 500, hi: 1800, swish: [400, 1400], wet: 1 },
  };
  function rustle(x, y, str, style) {
    if (!gate('rustle', 60)) return;
    const R = RUSTLE[style] || RUSTLE.vine;
    const d = out(x, y, 0.5, false, null, knob('vWorld')); if (!d) return;
    const t = ac.currentTime, v = clampS(str, 0.2, 1);
    const up = Math.random() < 0.5, a = rnd(R.swish[0], R.swish[1]), b = rnd(R.swish[0], R.swish[1]) * (up ? 1.5 : 0.6);
    hiss(d, t, rnd(0.1, 0.26) * (0.6 + v * 0.6), rnd(0.12, 0.22) * v, 'bandpass', a, b, rnd(0.6, 1.4), false, rnd(0.015, 0.05));
    const n = 2 + Math.floor(Math.random() * (2 + v * 3));
    for (let i = 0; i < n; i++)
      hiss(d, t + rnd(0, 0.2), rnd(0.02, 0.07), rnd(0.1, 0.3) * v, 'bandpass', rnd(R.lo, R.hi), rnd(R.lo, R.hi), rnd(0.8, 2.5), Math.random() < 0.55);
    if (R.wet) tone(d, 'sine', rnd(180, 300), rnd(400, 700), t + rnd(0, 0.1), 0.07, 0.08 * v, 0.004);
    if (R.creak && Math.random() < 0.35) tone(lp(d, 800, 5), 'sawtooth', rnd(110, 160), rnd(90, 130), t, rnd(0.15, 0.3), 0.05 * v, 0.03);
  }
  function arc(x, y, big) {
    if (!gate('arc', big ? 90 : 45)) return;
    const d = out(x, y, 0.35, false, null, knob('vHit')); if (!d) return;
    const t = ac.currentTime;
    hiss(d, t, big ? 0.3 : 0.07, big ? 0.8 : 0.45, 'highpass', 2500, 1500, 0.8, true);
    zap(d, t, 0.06, 0.08, 3000, 600);
    if (big) tone(d, 'sine', 90, 40, t, 0.35, 0.5, 0.003);
  }

  // ---- creatures: (k = creature, what = alert|idle|fire|charge|hurt|die|bite|fuse) ----
  function creature(k, what, x, y, extra) {
    if (what === 'hurt' && !gate('churt', 90)) return;
    if (what === 'idle' && !gate('idle', 250)) return;
    if (what === 'fire' && !gate('cfire', 60)) return;
    const { v, pitch: P } = creatureSound(k);
    const long = what === 'die' || what === 'alert' || what === 'charge';
    const d = out(x, y, long ? 1 : 0.45, false, null,
      knob(what === 'fire' || what === 'charge' || what === 'fuse' ? 'vEnemyFire' : 'vEnemy')); if (!d) return;
    const t = ac.currentTime, R = rnd(0.92, 1.08);
    const clicks = (n, gap, f, pk) => { for (let i = 0; i < n; i++) hiss(d, t + i * gap * rnd(0.7, 1.3), 0.014, pk, 'bandpass', f * rnd(0.85, 1.15), f, 6); };
    const bloop = (tt, f, pk) => tone(d, 'sine', f, f * 2.4, tt, 0.07, pk, 0.004);
    const squelch = pk => { hiss(d, t, 0.22, pk, 'lowpass', 1400, 200, 2); tone(d, 'sine', 260 * P, 60 * P, t, 0.22, pk * 0.8); };
    if (what === 'charge') {                         // a sniper winding up: the warning is the point
      const dur = extra || 0.5;
      tone(d, 'sine', 380 * P, 1700 * P, t, dur, 0.28, dur * 0.8);
      tone(d, 'square', 190 * P, 850 * P, t, dur, 0.04, dur * 0.8);
      return;
    }
    if (what === 'fire') {
      if (v === 'spore') { hiss(d, t, 0.2, 0.5, 'bandpass', 900, 500, 2.5, false, 0.02); tone(d, 'sine', 300, 180, t, 0.12, 0.2); return; }
      if (v === 'icy') { bell(d, 1600 * R, t, 0.5, 0.25); hiss(d, t, 0.15, 0.3, 'highpass', 5000, 3000); return; }
      if (v === 'rattle') { tone(d, 'sine', 420 * R, 240, t, 0.2, 0.4, 0.01); hiss(d, t, 0.18, 0.35, 'bandpass', 900, 400, 2); return; }
      tone(d, 'square', 900 * P * R, 300 * P, t, 0.1, 0.2);            // a goblin's gun: retro pew
      hiss(d, t, 0.06, 0.3, 'bandpass', 2000, 900, 1.2);
      return;
    }
    if (what === 'bite') {
      hiss(d, t, 0.09, 0.6, 'lowpass', 1600, 400, 1.5, true);
      tone(d, 'triangle', 220 * P, 110 * P, t, 0.1, 0.35);
      return;
    }
    if (what === 'fuse') { tone(d, 'square', 1200 * R, 1200 * R, t, 0.04, 0.12); hiss(d, t, 0.1, 0.2, 'highpass', 4000, 4000, 0.7, true); return; }
    const alert = what === 'alert', die = what === 'die', hurtS = what === 'hurt';
    const pk = die ? 0.6 : alert ? 0.5 : hurtS ? 0.35 : 0.22;
    switch (v) {
      case 'gibber': {                               // goblin chatter: squawky square syllables
        if (die) { tone(d, 'square', 600 * P, 120 * P, t, 0.35, 0.18, 0.005, [30, 60]); hiss(d, t, 0.2, 0.25, 'bandpass', 1200, 500, 2); break; }
        if (hurtS) { tone(d, 'square', 700 * P * R, 420 * P, t, 0.07, 0.14); break; }
        const n = alert ? 2 : 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const f = rnd(380, 680) * P, tt = t + i * 0.09;
          tone(lp(d, 2400), 'square', f, alert ? f * 1.6 : f * rnd(0.8, 1.2), tt, 0.08, pk * 0.35, 0.005, [22, 40 * P]);
        }
        break;
      }
      case 'chitter': {                              // spiders and kobolds: dry clicks
        if (die) { clicks(8, 0.025, 3200 * P, 0.4); squelch(0.4); break; }
        clicks(hurtS ? 3 : alert ? 7 : 3, 0.028, 3500 * P * R, pk * 1.4);
        if (alert) tone(d, 'triangle', 1800 * P, 2600 * P, t, 0.12, 0.08);
        break;
      }
      case 'growl': {                                // the big ones: a low, rough growl
        const g = lp(d, 520);
        const len = die ? 0.7 : alert ? 0.55 : hurtS ? 0.18 : 0.35;
        tone(g, 'sawtooth', 95 * P * R, (die ? 45 : 75) * P, t, len, pk * 0.7, 0.04, [13, 9]);
        tone(g, 'sawtooth', 97.5 * P * R, (die ? 46 : 77) * P, t, len, pk * 0.5, 0.04);
        hiss(d, t, len, pk * 0.35, 'lowpass', 500, 250, 1, false, 0.04);
        break;
      }
      case 'slither': {                              // the worm: wet hiss and a thin squeal
        if (die) { tone(d, 'sine', 1400 * P, 300 * P, t, 0.4, 0.2, 0.01, [18, 50]); squelch(0.4); break; }
        hiss(d, t, alert ? 0.4 : 0.25, pk, 'bandpass', 1800 * R, 900, 3, false, 0.03);
        if (alert || hurtS) tone(d, 'sine', 900 * P, 1500 * P, t, 0.15, 0.12, 0.01, [20, 60]);
        break;
      }
      case 'ember':                                  // the fire bomber: gurgle plus embers
        hiss(d, t, 0.3, pk * 0.6, 'bandpass', 2600, 1800, 1, true);
        // falls through to the gurgle
      case 'gurgle': {                               // blobs: wet bubbling
        if (die) { squelch(0.6); bloop(t + 0.05, 180 * P, 0.25); break; }
        const n = alert ? 4 : 2;
        for (let i = 0; i < n; i++) bloop(t + i * rnd(0.05, 0.1), rnd(160, 320) * P, pk * 0.7);
        break;
      }
      case 'spore':                                  // the mushroom: soft puffs
        if (die) { squelch(0.4); break; }
        hiss(d, t, 0.25, pk, 'bandpass', 1100, 600, 2.5, false, 0.03);
        break;
      case 'icy':                                    // the ice skull: glassy
        if (die) { bell(d, 900, t, 1, 0.3); clicks(10, 0.02, 5000, 0.3); break; }
        bell(d, rnd(1800, 2600), t, 0.5, pk * 0.5);
        break;
      case 'rattle':                                 // living bones: rattle and a hollow moan
        clicks(die ? 14 : alert ? 8 : 5, 0.022, 2300 * R, pk * 1.2);
        if (alert || die) tone(d, 'sine', 330 * R, die ? 160 : 300, t, die ? 0.9 : 0.6, 0.14, 0.2, [5, 12]);
        break;
    }
  }

  // ---- you: pickups, the shop, damage, the portal ----
  let coinStreak = 0, coinT = 0;
  function ui(what) {
    if (what === 'hurt' && !gate('phurt', 120)) return;
    if (what === 'empty' && !gate('empty', 250)) return;
    const d = out(null, null, 1.3, true, null, knob(what === 'sputter' ? 'jetVol' : 'vUi')); if (!d) return;
    const t = ac.currentTime;
    const arp = (notes, gap, type, pk, len) => notes.forEach((f, i) => tone(d, type, f, f, t + i * gap, len || 0.14, pk, 0.004));
    switch (what) {
      case 'coin': {
        const n = now();
        coinStreak = n - coinT < 600 ? Math.min(coinStreak + 1, 14) : 0; coinT = n;
        const s = Math.pow(1.06, coinStreak);
        tone(d, 'triangle', 1568 * s, 1568 * s, t, 0.06, 0.2, 0.002);
        tone(d, 'square', 2093 * s, 2093 * s, t + 0.05, 0.12, 0.07, 0.002);
        break;
      }
      case 'mod': arp([523, 659, 784, 1047], 0.055, 'triangle', 0.25); bell(d, 2093, t + 0.22, 0.5, 0.08); break;
      case 'gun':
        arp([196, 294, 392], 0.06, 'square', 0.08);
        hiss(d, t, 0.03, 0.4, 'bandpass', 4000, 4000, 3); hiss(d, t + 0.09, 0.03, 0.4, 'bandpass', 3000, 3000, 3);
        break;
      case 'buy':
        [0, 0.05, 0.1].forEach(o => tone(d, 'triangle', 1568 + o * 3000, 1568 + o * 3000, t + o, 0.06, 0.15, 0.002));
        arp([392, 523, 659], 0.06, 'triangle', 0.2, 0.18);
        break;
      case 'poor': tone(d, 'square', 180, 150, t, 0.14, 0.12); tone(d, 'square', 140, 120, t + 0.12, 0.16, 0.12); break;
      case 'heal':
        tone(d, 'sine', 400, 900, t, 0.45, 0.3, 0.05, [7, 15]);
        hiss(d, t, 0.5, 0.1, 'highpass', 6000, 9000, 0.7, false, 0.2);
        break;
      case 'perk':
        [523, 659, 784, 988, 1319].forEach((f, i) => bell(d, f, t + i * 0.09, 0.8, 0.14));
        [262, 330, 392].forEach(f => tone(d, 'sine', f, f, t + 0.1, 1.1, 0.1, 0.2));
        break;
      case 'heart':
        tone(d, 'sine', 90, 55, t, 0.12, 0.7); tone(d, 'sine', 90, 55, t + 0.2, 0.14, 0.6);
        [330, 415, 494].forEach(f => tone(d, 'sine', f, f, t + 0.35, 0.9, 0.12, 0.15));
        break;
      case 'portal':
        hiss(d, t, 0.9, 0.35, 'bandpass', 200, 3000, 3, false, 0.3);
        tone(d, 'sine', 150, 600, t, 0.8, 0.3, 0.2, [6, 10]);
        bell(d, 1047, t + 0.6, 0.9, 0.12);
        break;
      case 'hurt':
        tone(d, 'square', 300, 120, t, 0.14, 0.14);
        hiss(d, t, 0.1, 0.35, 'lowpass', 1500, 300, 1);
        tone(d, 'sine', 110, 60, t, 0.12, 0.5);
        break;
      case 'shield': bell(d, 1500, t, 0.4, 0.2); hiss(d, t, 0.1, 0.2, 'highpass', 5000, 3000); break;
      case 'die':
        tone(lp(d, 1400), 'sawtooth', 440, 40, t, 1.2, 0.3, 0.01, [8, 20]);
        hiss(d, t, 0.5, 0.4, 'lowpass', 1600, 150, 1);
        tone(d, 'sine', 120, 35, t, 0.8, 0.6);
        break;
      case 'revive': arp([262, 392, 523, 784, 1047], 0.07, 'triangle', 0.25, 0.2); break;
      case 'empty': tone(d, 'square', 110, 90, t, 0.05, 0.12); hiss(d, t, 0.02, 0.2, 'highpass', 3000, 3000); break;
      case 'sputter': for (let i = 0; i < 4; i++) hiss(d, t + i * 0.07, 0.05, 0.3, 'bandpass', 700, 400, 2, true); break;
      case 'beat': tone(d, 'sine', 70, 45, t, 0.1, 0.45); tone(d, 'sine', 70, 45, t + 0.16, 0.1, 0.3); break;
    }
  }

  // ---- everything else: one table of small sounds, each rolled fresh every time it plays.
  // fx(name, x, y, a): x == null plays it at you; `a` is whatever that sound needs (a surface,
  // a material, a strength). Each has its own minimum gap so a burst of them can't pile up.
  const FX_GAP = { whoosh: 140, step: 60, land: 90, fizzle: 70, absorb: 80, crit: 60, chainhop: 50, coverHit: 60,
    coinland: 60, healtick: 350, drip: 90, sizzle: 90, splash: 110, sparks: 120, steam: 200, whirl: 400,
    prompt: 150, place: 60, switch: 80, ready: 150, shatter: 40, ignite: 300, open: 150, close: 150 };
  // a footstep or landing, by what you're standing on
  function surfaceHit(d, t, surf, v) {
    switch (surf) {
      case 'snow': hiss(d, t, rnd(0.07, 0.12), 0.45 * v, 'lowpass', rnd(2200, 3000), rnd(600, 900), 1, true); break;
      case 'ice':
        tone(d, 'sine', rnd(1800, 2600), rnd(1400, 2000), t, rnd(0.03, 0.06), 0.06 * v);
        hiss(d, t, 0.03, 0.2 * v, 'highpass', 4000, 3000, 0.8, true);
        break;
      case 'slime':
        hiss(d, t, rnd(0.08, 0.13), 0.4 * v, 'lowpass', rnd(800, 1100), 250, 2);
        tone(d, 'sine', rnd(160, 220), rnd(400, 600), t + 0.02, 0.06, 0.12 * v, 0.004);
        break;
      case 'puddle':
        hiss(d, t, rnd(0.1, 0.16), 0.45 * v, 'bandpass', rnd(1300, 1900), rnd(500, 800), 1.2);
        tone(d, 'sine', rnd(250, 400), rnd(600, 900), t + rnd(0.02, 0.06), 0.05, 0.1 * v, 0.004);
        break;
      case 'ash': hiss(d, t, rnd(0.08, 0.14), 0.3 * v, 'lowpass', rnd(900, 1400), 400, 0.8, false, 0.01); break;
      case 'glass':
        hiss(d, t, 0.05, 0.3 * v, 'highpass', 4000, 3500, 0.8, true);
        for (let i = 0; i < 3; i++) tone(d, 'sine', rnd(3500, 6000), rnd(3500, 6000), t + rnd(0, 0.05), 0.03, 0.05 * v, 0.002);
        break;
      case 'log': case 'acid': hiss(d, t, rnd(0.15, 0.25), 0.25 * v, 'highpass', rnd(2500, 3500), 4000, 0.7, true); break;
      default:                                        // bare rock: a gritty scuff
        hiss(d, t, rnd(0.03, 0.06), 0.35 * v, 'bandpass', rnd(700, 1500), rnd(500, 900), rnd(0.8, 1.6), Math.random() < 0.6);
        tone(d, 'sine', rnd(90, 120), 60, t, 0.04, 0.2 * v);
    }
  }
  function tinkles(d, t, n, lo, hi, pk, spread) {
    for (let i = 0; i < n; i++) tone(d, 'sine', rnd(lo, hi), rnd(lo, hi) * rnd(0.9, 1.05), t + rnd(0, spread), rnd(0.04, 0.12), pk * rnd(0.5, 1), 0.002);
  }
  const FX = {
    // stepping into the exit: the air is drawn in, a falling shimmer, and a soft whump
    portalIn(d, t) {
      hiss(d, t, 0.7, 0.4, 'bandpass', rnd(2800, 3600), rnd(180, 260), 2.5, false, 0.45);
      tone(d, 'sine', rnd(850, 1000), rnd(110, 140), t, 0.75, 0.25, 0.05, [rnd(5, 8), 18]);
      [1568, 1319, 1047, 784].forEach((f, i) => bell(d, f * rnd(0.98, 1.02), t + 0.08 * i, 0.5, 0.08));
      tone(d, 'sine', rnd(75, 90), 38, t + 0.62, 0.35, 0.7, 0.01);
      hiss(d, t + 0.62, 0.3, 0.3, 'lowpass', 700, 150, 0.8);
    },
    // coming out of the way-in: an exhale of air and a rising sparkle
    portalOut(d, t) {
      hiss(d, t, 0.9, 0.35, 'bandpass', rnd(250, 350), rnd(2200, 3000), 2, false, 0.03);
      const notes = [523, 659, 784, 988, 1175, 1319];
      for (let i = 0; i < 4; i++) bell(d, notes[Math.floor(Math.random() * notes.length)] * 2, t + 0.12 + i * rnd(0.06, 0.1), 0.6, 0.06);
      tone(d, 'sine', rnd(180, 220), rnd(450, 550), t, 0.5, 0.15, 0.1);
    },
    step(d, t, surf) { surfaceHit(d, t, surf, rnd(0.55, 0.8)); },
    land(d, t, a) {
      const v = clampS((a.v - 150) / 500, 0.35, 1);
      tone(d, 'sine', rnd(100, 140), rnd(40, 55), t, 0.1 + 0.08 * v, 0.7 * v, 0.003);
      surfaceHit(d, t, a.s, v * 1.2);
      if (v > 0.6 && (!a.s || a.s === 'rock')) hiss(d, t + 0.03, 0.2, 0.25 * v, 'lowpass', 1600, 400, 1, true);
    },
    ignite(d, t) {
      hiss(d, t, rnd(0.12, 0.2), 0.45, 'bandpass', rnd(300, 450), rnd(1000, 1400), 1.2, true);
      hiss(d, t, 0.08, 0.3, 'lowpass', 900, 300);
    },
    switch(d, t) {
      tone(d, 'square', rnd(1600, 2000), 1400, t, 0.02, 0.05);
      hiss(d, t, 0.03, 0.3, 'bandpass', rnd(2500, 3500), 2500, 3);
      hiss(d, t + rnd(0.06, 0.09), 0.03, 0.3, 'bandpass', rnd(1800, 2400), 1800, 3);
      tone(d, 'sine', 220, 160, t + 0.07, 0.04, 0.12);
    },
    ready(d, t) { tone(d, 'triangle', 1320 * rnd(0.98, 1.02), 1320, t, 0.04, 0.07); tone(d, 'triangle', 1760 * rnd(0.98, 1.02), 1760, t + 0.045, 0.06, 0.06); },
    open(d, t) { hiss(d, t, rnd(0.1, 0.15), 0.18, 'bandpass', rnd(900, 1300), rnd(2200, 2800), 1.5, false, 0.03); tone(d, 'sine', 700, 900, t, 0.04, 0.06); },
    close(d, t) { hiss(d, t, rnd(0.1, 0.15), 0.18, 'bandpass', rnd(2200, 2800), rnd(900, 1300), 1.5, false, 0.03); tone(d, 'sine', 900, 700, t, 0.04, 0.06); },
    place(d, t) { tone(d, 'triangle', rnd(850, 1000), 700, t, 0.03, 0.12); tone(d, 'sine', rnd(180, 220), 120, t, 0.06, 0.25); },
    prompt(d, t) { tone(d, 'sine', 1047 * rnd(0.98, 1.02), 1047, t, 0.06, 0.07); tone(d, 'sine', 1568, 1568, t + 0.05, 0.08, 0.05); },
    // something breaking. a = what it's made of
    shatter(d, t, m) {
      if (m === 'ice' || m === 'glass') {
        hiss(d, t, 0.06, 0.5, 'highpass', 3000, 2000, 0.8, true);
        tinkles(d, t + 0.01, 6 + Math.floor(Math.random() * 7), 2500, 6500, 0.12, 0.35);
      } else if (m === 'crystal') {
        hiss(d, t, 0.08, 0.4, 'highpass', 2500, 1500, 0.8, true);
        for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) bell(d, rnd(1400, 3400), t + rnd(0, 0.25), rnd(0.4, 0.8), 0.08);
      } else if (m === 'salt') {
        hiss(d, t, rnd(0.15, 0.25), 0.45, 'highpass', 2500, 1800, 0.9, true);
        tinkles(d, t, 3, 3000, 5000, 0.07, 0.15);
      } else if (m === 'bone') {
        hiss(d, t, 0.04, 0.4, 'bandpass', 2200, 1500, 2, true);
        for (let i = 0; i < 8; i++) hiss(d, t + rnd(0.02, 0.35), 0.015, rnd(0.15, 0.35), 'bandpass', rnd(1500, 3200), 1500, 5);
      } else {                                        // stone: a crumble and falling rubble
        hiss(d, t, rnd(0.4, 0.6), 0.6, 'lowpass', rnd(800, 1100), 150, 0.8, true);
        tone(d, 'sine', rnd(90, 120), 40, t, 0.3, 0.6, 0.004);
        for (let i = 0; i < 5; i++) tone(d, 'sine', rnd(120, 220), 60, t + rnd(0.1, 0.5), 0.06, rnd(0.1, 0.25), 0.003);
      }
    },
    coverHit(d, t) { tone(d, 'sine', rnd(160, 210), 90, t, 0.06, 0.4); hiss(d, t, 0.05, 0.3, 'bandpass', rnd(900, 1500), 600, 1.5, true); },
    iceCreak(d, t) {
      hiss(d, t, 0.3, 0.3, 'highpass', 2200, 1500, 0.8, true, 0.02);
      for (let i = 0; i < 3; i++) tone(d, 'sine', rnd(2600, 3400), rnd(1200, 1800), t + i * rnd(0.07, 0.12), 0.05, 0.05);
    },
    propLand(d, t) { tone(d, 'sine', rnd(110, 150), 50, t, 0.1, 0.4); hiss(d, t, 0.08, 0.3, 'lowpass', 1200, 300, 1, true); },
    skulls(d, t) {
      hiss(d, t, rnd(0.12, 0.18), 0.5, 'lowpass', 1800, 600, 1, true);
      for (let i = 0; i < 7; i++) hiss(d, t + rnd(0.02, 0.4), 0.015, rnd(0.15, 0.35), 'bandpass', rnd(1600, 3000), 1600, 5);
    },
    resonate(d, t) {                                  // a resonance stone: a long, shivering gong
      const f = rnd(170, 260);
      bell(d, f, t, 2.4, 0.35);
      tone(d, 'sine', f * 1.005, f, t, 2.2, 0.15, 0.02, [rnd(4, 7), 3]);
    },
    ventWarn(d, t) {
      hiss(d, t, 0.75, 0.3, 'highpass', rnd(1500, 2200), rnd(3500, 4500), 0.8, false, 0.55);
      tone(d, 'sine', 55, 70, t, 0.7, 0.15, 0.5);
    },
    ventFire(d, t) {
      hiss(d, t, rnd(0.9, 1.1), 0.7, 'bandpass', rnd(350, 450), rnd(800, 1000), 0.9, false, 0.04);
      hiss(d, t, 0.9, 0.5, 'bandpass', 2600, 2000, 1, true, 0.05);
      tone(d, 'sine', rnd(60, 75), 50, t, 0.9, 0.35, 0.05);
    },
    shroom(d, t) {
      tone(d, 'sine', rnd(130, 190), rnd(480, 720), t, rnd(0.15, 0.22), 0.5, 0.004);
      hiss(d, t, 0.08, 0.3, 'lowpass', 800, 300, 2);
    },
    lash(d, t) { hiss(d, t, 0.09, 0.45, 'highpass', rnd(1200, 1800), rnd(5000, 7000), 0.8, false, 0.06); hiss(d, t + 0.09, 0.03, 0.5, 'bandpass', 3000, 2000, 1.5, true); },
    eyes(d, t) {
      for (let i = 0; i < 3; i++) hiss(d, t + i * rnd(0.1, 0.18), rnd(0.08, 0.14), 0.12, 'bandpass', rnd(900, 1500) * (1 + i * 0.25), rnd(1500, 2400), 8, false, 0.03);
    },
    sparks(d, t) { hiss(d, t, rnd(0.1, 0.2), 0.4, 'highpass', 3000, 2200, 0.8, true); zap(d, t, 0.05, 0.05, 4000, 1500); },
    steam(d, t) { hiss(d, t, rnd(0.3, 0.8), rnd(0.15, 0.25), 'highpass', rnd(2500, 3500), rnd(3000, 5000), 0.7, false, rnd(0.03, 0.1)); },
    drip(d, t) { const f = rnd(1300, 2400); tone(d, 'sine', f, f * rnd(1.4, 1.8), t, 0.05, 0.09, 0.002); },
    sizzle(d, t) { hiss(d, t, rnd(0.2, 0.35), 0.35, 'highpass', rnd(2500, 3500), 4500, 0.7, true); tone(d, 'sine', rnd(200, 300), 120, t, 0.05, 0.1); },
    splash(d, t) { hiss(d, t, rnd(0.06, 0.12), 0.25, 'bandpass', rnd(1000, 2500), rnd(600, 1200), 1.2); },
    whirl(d, t) {
      hiss(d, t, 1.1, 0.25, 'bandpass', rnd(350, 500), rnd(1300, 1700), 3, false, 0.45);
      hiss(d, t + 0.3, 0.9, 0.15, 'bandpass', rnd(1300, 1700), rnd(350, 500), 3, false, 0.3);
    },
    fizzle(d, t) { hiss(d, t, 0.05, 0.25, 'highpass', 3000, 2000, 0.8, true); tone(d, 'sine', rnd(700, 900), 300, t, 0.04, 0.08); },
    absorb(d, t) { tone(d, 'sine', rnd(500, 700), rnd(1200, 1600), t, 0.08, 0.2); hiss(d, t, 0.1, 0.15, 'highpass', 5000, 8000, 0.7); },
    crit(d, t) { tone(d, 'triangle', rnd(1900, 2100), 2700, t, 0.08, 0.2); tone(d, 'square', 4000, 4200, t, 0.03, 0.06); },
    chainhop(d, t) { zap(d, t, 0.06, 0.1, 3500, 900); hiss(d, t, 0.06, 0.35, 'highpass', 2500, 1800, 0.8, true); },
    split(d, t) { tone(d, 'sine', 1200, rnd(1700, 2000), t, 0.1, 0.18); tone(d, 'sine', 1200, rnd(800, 950), t, 0.1, 0.18); },
    cluster(d, t) { for (let i = 0; i < 4; i++) tone(d, 'sine', rnd(250, 450), rnd(80, 120), t + rnd(0, 0.12), 0.06, 0.3, 0.003); },
    refresh(d, t) { tone(lp(d, 1400), 'sawtooth', rnd(200, 260), rnd(1000, 1300), t, 0.3, 0.2, 0.02); bell(d, 1760, t + 0.28, 0.5, 0.1); },
    warp(d, t) { tone(d, 'sine', 2000, 250, t, 0.12, 0.2); tone(d, 'sine', 250, 2000, t + 0.04, 0.12, 0.15); hiss(d, t, 0.15, 0.15, 'bandpass', 1500, 4000, 3); },
    saws(d, t) { for (let i = 0; i < 3; i++) hiss(d, t + i * 0.05, 0.15, 0.3, 'bandpass', rnd(5000, 7000), 3500, 4); tone(d, 'square', 2200, 1800, t, 0.2, 0.06); },
    gspend(d, t) { for (let i = 0; i < 3; i++) tone(d, 'triangle', 2093 - i * 300, 1800 - i * 300, t + i * 0.05, 0.06, 0.12, 0.002); },
    drain(d, t) { tone(d, 'sine', rnd(800, 1000), 200, t, 0.3, 0.2, 0.01, [14, 40]); },
    healtick(d, t) { tone(d, 'sine', 880 * rnd(0.98, 1.02), 880, t, 0.15, 0.08, 0.01); tone(d, 'sine', 1320, 1320, t + 0.05, 0.15, 0.05, 0.01); },
    ghost(d, t) { tone(d, 'sine', rnd(1300, 1500), rnd(650, 750), t, 0.14, 0.12, 0.01, [20, 30]); hiss(d, t, 0.1, 0.08, 'bandpass', 2000, 1200, 3, false, 0.02); },
    shieldUp(d, t) { bell(d, 1760, t, 0.5, 0.1); hiss(d, t, 0.25, 0.07, 'highpass', 6000, 9000, 0.7, false, 0.1); },
    whoosh(d, t) {                                             // something catching fire
      hiss(d, t, rnd(0.3, 0.5), rnd(0.35, 0.5), 'bandpass', rnd(280, 450), rnd(1300, 2200), 0.7, false, rnd(0.03, 0.08));
      hiss(d, t + rnd(0.03, 0.08), rnd(0.2, 0.35), 0.25, 'highpass', rnd(2200, 3000), 3600, 0.7, true);
    },
    coinland(d, t) { tone(d, 'sine', rnd(2600, 3600), rnd(2600, 3600), t, 0.04, 0.08, 0.002); },
  };
  function fx(name, x, y, a) {
    const f = FX[name];
    if (!f || !gate('fx:' + name, FX_GAP[name] || 40)) return;
    const d = out(x, y, name === 'resonate' ? 2.6 : 1.2, x == null, null, knob(fxVolKey(name))); if (!d) return;
    f(d, ac.currentTime, a);
  }

  // ---- loops: the jetpack, and a Black Hole while it lives. set() every frame you want it;
  // tick() fades any loop nobody set this frame (a pause, a dead bullet) ----
  function loop(kind) {
    if (!live() || loops.size > 8) return null;
    const g = ac.createGain(); g.gain.value = 0;
    let pn = null;
    if (ac.createStereoPanner) { pn = ac.createStereoPanner(); g.connect(pn); pn.connect(sfxBus); } else g.connect(sfxBus);
    const srcs = [];
    const noise = (crackle, type, f, q, gain) => {
      const s = ac.createBufferSource(); s.buffer = crackle ? crackBuf : noiseBuf; s.loop = true;
      const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const gg = ac.createGain(); gg.gain.value = gain;
      s.connect(fl); fl.connect(gg); gg.connect(g); s.start(0, Math.random() * 1.5); srcs.push(s);
      return fl;
    };
    const osc = (type, f, gain, dest) => {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
      const gg = ac.createGain(); gg.gain.value = gain; o.connect(gg); gg.connect(dest || g); o.start(); srcs.push(o);
      return o;
    };
    let jetF = null;
    if (kind === 'jet') {
      jetF = noise(false, 'bandpass', 700, 0.9, 1.2);         // the roar
      noise(true, 'bandpass', 1800, 0.8, 0.5);                // and the spit of the flame
    } else if (kind === 'portal') {                            // the exit's hum: two beating tones and a shimmer
      const trem = ac.createGain(); trem.gain.value = 0.7; trem.connect(g);
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 0.6; lg.gain.value = 0.3;
      l.connect(lg); lg.connect(trem.gain); l.start(); srcs.push(l);
      osc('sine', 110, 0.35, trem); osc('sine', 165.7, 0.25, trem); osc('triangle', 220.4, 0.06, trem);
      noise(false, 'bandpass', 1600, 7, 0.5);
    } else if (kind === 'fire') {                              // a blaze: crackle over a low roar
      noise(true, 'highpass', 1500, 0.7, 0.8);
      noise(true, 'bandpass', 650, 0.8, 0.55);
      noise(false, 'lowpass', 260, 0.7, 0.9);
    } else if (kind === 'matter') {                            // dark matter: a low, uneasy warble
      osc('sine', 68, 0.5); osc('sine', 71.5, 0.5);
      const f = noise(false, 'bandpass', 300, 3, 0.6);
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 0.35; lg.gain.value = 180;
      l.connect(lg); lg.connect(f.frequency); l.start(); srcs.push(l);
    } else {                                                   // 'void'
      osc('sine', 42, 0.9);
      const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; f.connect(g);
      osc('sawtooth', 55, 0.25, f); osc('sawtooth', 56.3, 0.25, f);
      noise(true, 'bandpass', 1800, 0.9, 0.8);
      noise(false, 'bandpass', 480, 2, 0.35);
    }
    const h = {
      last: now(),
      set(level, x, y, pitch) {
        h.last = now();
        let v = level * knob(kind === 'jet' ? 'jetVol' : kind === 'void' ? 'vSpell' : 'vWorld'), pan = 0;
        if (x != null) {
          const dx = x - ear.x, d = Math.hypot(dx, y - ear.y);
          v *= d > HEAR ? 0 : 1 / (1 + (d / 170) * (d / 170));
          pan = clampS(dx / 260, -0.85, 0.85);
        }
        g.gain.setTargetAtTime(v, ac.currentTime, jetF ? 0.012 : 0.05);   // the jet cuts out sharp
        if (pn) pn.pan.setTargetAtTime(pan, ac.currentTime, 0.05);
        if (jetF) jetF.frequency.setTargetAtTime(pitch ? 500 * pitch : 500 + 700 * level, ac.currentTime, 0.05);
      },
      stop() {
        loops.delete(h);
        try { g.gain.setTargetAtTime(0, ac.currentTime, 0.06); } catch (_) {}
        setTimeout(() => { for (const s of srcs) try { s.stop(); } catch (_) {} try { g.disconnect(); } catch (_) {} }, 400);
      },
    };
    loops.add(h);
    return h;
  }

  // ---- ambience: the floor's bed and drone, and its one-shots going off round you ----
  function setAmbience(name) {
    ambWant = name;
    if (!live()) return;
    if (amb) {
      const old = amb; amb = null;
      old.g.gain.setTargetAtTime(0, ac.currentTime, 0.6);
      setTimeout(() => old.srcs.forEach(s => { try { s.stop(); } catch (_) {} }), 3000);
    }
    const A = AMBIENCE[name];
    if (!A) return;
    const g = ac.createGain(); g.gain.value = 0; g.connect(ambBus);
    g.gain.setTargetAtTime(1, ac.currentTime, 1.2);
    const srcs = [];
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = A.bed[0]; f.Q.value = 0.7;
    // the bed breathes: a very slow wobble on its brightness
    const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 0.07; lg.gain.value = A.bed[0] * 0.45;
    l.connect(lg); lg.connect(f.frequency); l.start();
    const bg = ac.createGain(); bg.gain.value = A.bed[1];
    s.connect(f); f.connect(bg); bg.connect(g); s.start();
    srcs.push(s, l);
    if (A.drone) for (const [m, pk] of [[1, 0.035], [1.5, 0.012]]) {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = A.drone * m;
      const og = ac.createGain(); og.gain.value = pk; o.connect(og); og.connect(g); o.start(); srcs.push(o);
    }
    amb = { g, srcs, A, name };
  }
  function envSound(kind, x, y) {
    // the ambience's drips and trickles also answer to the Drips knob
    const d = out(x, y, 2.5, false, ambBus, kind === 'drip' || kind === 'trickle' ? knob('vDrip') : 1); if (!d) return;
    const t = ac.currentTime;
    switch (kind) {
      case 'drip': { const f = rnd(1300, 2200); tone(d, 'sine', f, f * 1.6, t, 0.05, 0.15, 0.002); tone(d, 'sine', f, f * 1.6, t + 0.2, 0.05, 0.035, 0.002); break; }
      case 'critter': for (let i = 0; i < 3; i++) tone(d, 'sine', rnd(3000, 4200), rnd(3000, 4200), t + i * 0.07, 0.03, 0.08, 0.003); break;
      case 'wind': hiss(d, t, 2.2, 0.3, 'bandpass', rnd(300, 500), rnd(700, 1000), 1.5, false, 0.8); break;
      case 'trickle': for (let i = 0; i < 9; i++) tone(d, 'triangle', rnd(1500, 3200), rnd(1200, 2600), t + rnd(0, 0.8), 0.025, 0.07, 0.002); break;
      case 'rumble': hiss(d, t, 2, 0.6, 'lowpass', 180, 90, 0.7, false, 0.5); tone(d, 'sine', 38, 32, t, 1.8, 0.25, 0.5); break;
      case 'creak': tone(lp(d, 900, 6), 'sawtooth', rnd(80, 110), rnd(60, 80), t, 0.9, 0.22, 0.15, [5, 6]); break;
      case 'chime': bell(d, rnd(1800, 3000), t, 1.4, 0.12); break;
      case 'crack': hiss(d, t, 0.08, 0.35, 'highpass', 3000, 2000, 0.8, true); tone(d, 'sine', 2800, 900, t, 0.12, 0.1); break;
      case 'crackle': hiss(d, t, rnd(0.3, 0.7), 0.35, 'bandpass', 2600, 2000, 1, true); break;
      case 'hiss': hiss(d, t, 1, 0.13, 'highpass', 3000, 4500, 0.7, false, 0.35); break;
      case 'puff': hiss(d, t, 0.35, 0.28, 'bandpass', 900, 500, 2.5, false, 0.06); break;
      case 'bloop': tone(d, 'sine', 200, 520, t, 0.1, 0.18, 0.005); tone(d, 'sine', 260, 640, t + 0.13, 0.08, 0.12, 0.005); break;
      case 'hum': tone(d, 'sine', 110, 112, t, 2.2, 0.08, 0.9); tone(d, 'sine', 165, 166, t, 2.2, 0.05, 0.9); break;
      case 'clank': tone(d, 'square', 300, 290, t, 0.3, 0.06); tone(d, 'square', 447, 440, t, 0.25, 0.05); hiss(d, t, 0.05, 0.3, 'bandpass', 3000, 3000, 4); break;
      case 'rattle': for (let i = 0; i < 6; i++) hiss(d, t + i * rnd(0.03, 0.05), 0.012, 0.25, 'bandpass', 2500, 2500, 6); break;
      case 'whisper':
        hiss(d, t, 1.4, 0.12, 'bandpass', 1200, 2400, 6, false, 0.5);
        hiss(d, t + 0.2, 1.2, 0.08, 'bandpass', 1800, 1000, 6, false, 0.5);
        break;
    }
  }
  // called every frame the game runs: each of the floor's one-shots rolls its dice, and
  // what goes off lands somewhere round you, off to one side or the other
  function ambTick(dt) {
    if (!amb || !live()) return;
    for (const k in amb.A.ev) if (Math.random() < amb.A.ev[k] * dt) {
      const a = Math.random() * Math.PI * 2, r = rnd(80, 320);
      envSound(k, ear.x + Math.cos(a) * r, ear.y + Math.sin(a) * r * 0.6);
    }
  }
  // every frame, running or paused: the volume knobs, and silence for loops nobody is feeding
  function tick() {
    if (!ac) return;
    sfxBus.gain.value = DEV.vol; ambBus.gain.value = DEV.vol * DEV.amb;
    // unlocking finishes a moment after the tap, so the floor's ambience starts from here
    if (ambWant && !amb && live()) setAmbience(ambWant);
    const t = now();
    for (const h of loops) if (t - h.last > 100) { try { h.set(0); } catch (_) {} }
  }

  return {
    unlock, tick: safe(tick), ear: (x, y) => { ear.x = x; ear.y = y; },
    cast: safe(cast), hit: safe(hit), rock: safe(rock), bounce: safe(bounce), boom: safe(boom), arc: safe(arc),
    debris: safe(debris), pop: safe(pop), rustle: safe(rustle), fx: safe(fx), FX_NAMES: Object.keys(FX),
    creature: safe(creature), ui: safe(ui), loop: safe(loop), setAmbience: safe(setAmbience),
    ambTick: safe(ambTick), env: safe(envSound), stats,
    get ready() { return !!live(); },
    get ambience() { return amb ? amb.name : null; },
    get loops() { return loops.size; },
  };
})();

// ---- autosave ----
// The run is kept in localStorage under SAVE_KEY and read back on the next launch. In the
// Android app the page is always served from the same address, so the save survives a game
// update too. A save from an older version may name mods or perks that no longer exist, or
// miss gun fields added since: cleanLoadout / cleanGun drop the unknowns and fill the gaps,
// so an old save always loads. The exact cave is only restored when the version matches —
// after an update the generator may have changed, so you get a fresh cave on the same floor.
const SAVE_KEY = 'caverunner-save';
const GUN_DEFAULTS = { name: 'Gun', castDelay: 0.2, recharge: 0.5, manaMax: 100, manaRegen: 30,
  spread: 0, multi: 1, shuffle: false, speedMul: 1, hue: 0 };
function cleanGun(g) {
  if (!g || typeof g !== 'object' || !Array.isArray(g.slots) || !g.slots.length) return null;
  const out = Object.assign({}, GUN_DEFAULTS, g);
  out.slots = g.slots.map(id => (id && MODS[id] ? id : null));
  out.cap = out.slots.length;
  out.mana = Math.max(0, Math.min(Number(g.mana) || 0, out.manaMax));
  return resetGun(out);
}
function cleanLoadout(lo) {
  lo = lo && typeof lo === 'object' ? lo : {};
  const guns = [0, 1, 2, 3].map(i => cleanGun((lo.guns || [])[i]));
  if (!guns.some(Boolean)) return null;               // nothing to fight with: not a usable save
  const num = (v, d) => (Number.isFinite(v) ? v : d);
  let sel = num(lo.sel, 0);
  if (!guns[sel]) sel = guns.findIndex(Boolean);
  return {
    guns, sel,
    bag: (Array.isArray(lo.bag) ? lo.bag : []).filter(id => MODS[id]),
    perks: (Array.isArray(lo.perks) ? lo.perks : []).filter(id => PERKS[id]),
    gold: Math.max(0, num(lo.gold, START_GOLD)),
    maxBonus: Math.max(0, num(lo.maxBonus, 0)),
    usedLives: Math.max(0, num(lo.usedLives, 0)),
    debug: !!lo.debug,
  };
}
// Turn the stored text back into a run, or null if there isn't a usable one.
function readSave(raw) {
  let s;
  try { s = JSON.parse(raw); } catch (_) { return null; }
  if (!s || typeof s !== 'object') return null;
  const loadout = cleanLoadout(s.loadout);
  if (!loadout) return null;
  const floor = Math.max(1, Math.floor(Number(s.floor) || 1));
  const out = { loadout, floor, hp: Number.isFinite(s.hp) && s.hp > 0 ? s.hp : null, level: null };
  // the cave itself only comes back on the same version, where the seed makes the same cave
  const L = s.level;
  if (s.ver === VERSION && L && Number.isFinite(L.seed)) {
    out.level = {
      seed: L.seed,
      owned: (Array.isArray(L.owned) ? L.owned : []).filter(id => PERKS[id]),
      alive: Array.isArray(L.alive) ? L.alive : null,
      sold: Array.isArray(L.sold) ? L.sold : [],
      rooms: Array.isArray(L.rooms) ? L.rooms : [],
      pickups: Array.isArray(L.pickups) ? L.pickups.map(q => {
        if (!q || typeof q !== 'object') return null;
        if (q.kind === 'mod') return MODS[q.id] ? q : null;
        if (q.kind === 'gun') { const gun = cleanGun(q.gun); return gun ? Object.assign({}, q, { gun }) : null; }
        return null;
      }).filter(Boolean) : null,
    };
  }
  return out;
}
const loadSave = () => { try { return readSave(localStorage.getItem(SAVE_KEY)); } catch (_) { return null; } };
const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} };
// a prize room's half-size in world units, shell included (makeLevel's rx/ry + sh, in pixels)
const ROOM_HW = 23 * CELL, ROOM_HH = 15 * CELL;                   // gold per vein pixel dug out (before the floor's lift)

// ---- floor 1: a layered cave (v85) ----
// Noita's Mines are flat-ish layers of rock stacked up the map with corridors between them,
// holes to move between layers, the odd wall making a dead end, and loops where two holes
// join the same corridors. This builds that from rules rather than drawn tiles:
//   1. layers, bottom (the slab over the shop) to top. Each corridor's roof is measured off
//      the floor under it (headroom, squeezes, stalactite teeth never below the squeeze),
//      so every corridor fits the runner by construction. The next layer's top is its own
//      wavy line, kept at least 5 rows thick. Two layers are made thick in one spot to hold
//      the hidden rooms (vaults).
//   2. walls across corridors (dead ends), then holes: every stretch of corridor between
//      walls gets a hole up, so everything joins the top; extra holes make loops. A stretch
//      that can't get one loses a wall instead.
//   3. old workings: stretches of corridor flattened level, floor and roof, blended into the
//      natural cave at each end (paved and timbered later: paveWorks, timberWorks).
//   4. rasterised, then caverns cut through several layers (broken bits of strata left
//      floating, stalactites and stalagmites), then small bubbles in the rock.
// Returns what makeLevel needs: route points for re-clearing, vaults for the rooms, works.
// N = { vn, fbm, ok } (the level's seeded noise; ok(x, y), if given, is where built-up
// features may go — makeLevel's zones — so workings and vaults land whole inside one).
function strataCave(mat, rnd, N, shopExit) {
  const { vn, fbm } = N, ok = N.ok || (() => true);
  const K = k => kr(k, rnd);
  const cnt = k => { const v = Math.max(0, K(k)); return Math.floor(v) + (rnd() < v % 1 ? 1 : 0); };
  const X0 = 4, X1 = CW - 5;
  const sm = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const yBase = SHOP_TOP - SHOP_ROOF - 24;          // the lowest corridor's floor; the shop shaft opens into it
  const hFloor = Math.max(12, Math.min(DEV.lvSqueezeLo, DEV.lvSqueezeHi, DEV.lvHeadLo, DEV.lvHeadHi));
  const line = (base, amp, sy) => {                  // swell + ripple + tilt, plus a slow field shared by neighbours
    const a = new Float32Array(CW), ph = rnd() * 50, tilt = (rnd() - 0.5) * 2 * amp;
    for (let x = 0; x < CW; x++)
      a[x] = base + amp * (2 * vn(x / 95 + ph, sy) - 1) + 0.45 * amp * (2 * vn(x / 28 + ph * 3, sy + 40) - 1)
        + tilt * (x / CW - 0.5) + 1.2 * amp * (2 * vn(x / 230 + 700, base / 240 + 700) - 1);
    return a;
  };

  // 1. layers and corridors. layers[i].top is corridor i's floor (first rock row);
  //    layers[i].bot is corridor i-1's roof (last rock row). Corridor i sits on layer i.
  const vaultAt = [];                                 // heights to put the two vaults near
  for (let k = 0; k < 40 && vaultAt.length < 2; k++) {
    const y = 160 + rnd() * (yBase - 420);
    if (vaultAt.every(v => Math.abs(v.y - y) > 300)) vaultAt.push({ y, done: false });
  }
  const layers = [{ top: line(yBase, 2, 3.7), bot: null, holes: [] }];
  const cors = [], vaults = [];
  for (let i = 0; ; i++) {
    const floorL = layers[i].top, H = K('lvHead'), sq = [];
    for (let n = cnt('lvSqz'); n-- > 0;) sq.push({ x: X0 + 20 + rnd() * (X1 - X0 - 40), w: 10 + rnd() * 22, h: K('lvSqueeze') });
    const ph = rnd() * 80, ceil = new Float32Array(CW);
    let cMin = 1e9, cSum = 0;
    for (let x = 0; x < CW; x++) {
      let h = H * (1 + 0.3 * (2 * vn(x / 60 + ph, i * 2.3) - 1));
      for (const s of sq) { const t = 1 - Math.abs(x - s.x) / s.w; if (t > 0) h += (Math.min(h, s.h) - h) * sm(t * 1.6); }
      const drip = Math.max(0, vn(x / 6 + ph, i * 4.1 + 11) - 0.62) * 22;   // teeth hanging off the layer above
      h = Math.max(hFloor, h - drip);
      ceil[x] = floorL[x] - h - 1;
      if (x >= X0 && x <= X1) { cMin = Math.min(cMin, ceil[x]); cSum += ceil[x]; }
    }
    const T = K('lvThick');
    if (cMin - T - Math.max(DEV.lvHeadLo, DEV.lvHeadHi) < 16) {
      // no room for another layer: this corridor runs up to the roof of the map
      for (let x = 0; x < CW; x++) ceil[x] = 4 + 4 * vn(x / 20 + ph, 99);
      cors.push({ i, floor: floorL, ceil, walls: [], top: true });
      break;
    }
    cors.push({ i, floor: floorL, ceil, walls: [] });
    const nt = line(cSum / (X1 - X0 + 1) - T, K('lvWave'), i * 3.1 + 7);
    for (let x = 0; x < CW; x++) nt[x] = Math.max(8, Math.min(nt[x], ceil[x] - 5));
    const L = { top: nt, bot: ceil, holes: [], vault: null };
    // a vault: this layer made 38 rows thick over one span, for a hidden room to sit in
    const want = vaultAt.find(v => !v.done && cSum / (X1 - X0 + 1) - T < v.y);
    if (want && i > 0) {
      want.done = true;
      let vx = Math.round(60 + rnd() * (CW - 120));
      for (let t = 0; t < 30 && !(ok(vx - 50, ceil[vx] - 19) && ok(vx + 50, ceil[vx] - 19) && ok(vx, ceil[vx] + 8)); t++)
        vx = Math.round(60 + rnd() * (CW - 120));
      let cm = 1e9;
      for (let x = vx - 34; x <= vx + 34; x++) cm = Math.min(cm, ceil[x]);
      cm = Math.floor(cm);
      // the corridor above rides up over it; a gentle rise, or the step is too steep to climb
      for (let x = Math.max(0, vx - 80); x <= Math.min(CW - 1, vx + 80); x++) {
        const t = sm((80 - Math.abs(x - vx)) / 46), lift = t * (ceil[x] - (cm - 38));
        nt[x] = Math.max(8, Math.min(nt[x], ceil[x] - Math.max(5, lift)));
      }
      L.vault = { x: vx, a: vx - 34, b: vx + 34, y: cm - 19, below: i };
      vaults.push(L.vault);
    }
    layers.push(L);
  }

  // 2. walls across corridors, then the holes between them
  for (const c of cors) {
    if (c.top) continue;
    for (let n = cnt('lvWalls'), tries = 0; n > 0 && tries < 40; tries++) {
      const x = X0 + 50 + rnd() * (X1 - X0 - 100), w = 8 + rnd() * 16;
      if (c.i === 0 && Math.abs(x - shopExit) < 40) continue;
      if (c.walls.some(q => Math.abs(q.x - x) < 70)) continue;
      c.walls.push({ x, w, a: x - w / 2 - 2, b: x + w / 2 + 2 });
      n--;
    }
    c.walls.sort((p, q) => p.x - q.x);
  }
  const segs = c => {
    const out = [];
    let a = X0;
    for (const w of c.walls) { out.push({ a, b: Math.floor(w.a) - 1 }); a = Math.ceil(w.b) + 1; }
    out.push({ a, b: X1 });
    return out;
  };
  const hits = (list, a, b, m) => list.some(q => a < q.b + m && b > q.a - m);
  const clash = (j, a, b) => {
    const L = layers[j], below = cors[j - 1], above = cors[j];
    return hits(L.holes, a, b, 16) || hits(below.walls, a, b, 6) || (above && hits(above.walls, a, b, 6)) ||
      (L.vault && hits([L.vault], a, b, 8));
  };
  layers[0].holes.push({ a: shopExit - 10, b: shopExit + 10 });          // down into the shop's shaft
  for (let j = 1; j < layers.length; j++) {
    const below = cors[j - 1];
    placing: for (;;) {
      layers[j].holes.length = 0;
      for (const s of segs(below)) {
        let ok = false;
        for (let t = 0; t < 40 && !ok; t++) {
          const hw = Math.max(12, Math.min(K('lvHoleW'), s.b - s.a - 10));
          const a = s.a + 5 + rnd() * Math.max(0, s.b - s.a - 10 - hw), b = a + hw;
          if (!clash(j, a, b)) { layers[j].holes.push({ a, b }); ok = true; }
        }
        if (!ok) {                                   // no way up from here: knock a wall of it down
          const w = below.walls.find(q => Math.abs(q.b + 1 - s.a) < 3) || below.walls.find(q => Math.abs(q.a - 1 - s.b) < 3);
          below.walls.splice(below.walls.indexOf(w), 1);
          continue placing;
        }
      }
      break;
    }
    for (let n = cnt('lvHoles'), t = 0; n > 0 && t < 40; t++) {
      const hw = K('lvHoleW'), a = X0 + 8 + rnd() * (X1 - X0 - 16 - hw);
      if (!clash(j, a, a + hw)) { layers[j].holes.push({ a, b: a + hw }); n--; }
    }
  }

  // 3. old workings: a stretch of corridor levelled, floor and roof, blending out at the ends
  const works = [];
  for (let n = cnt('lvWorks'), tries = 0; n > 0 && tries < 400; tries++) {
    const ci = Math.floor(rnd() * cors.length), c = cors[ci];
    if (c.top) continue;
    const ss = segs(c), s = ss[Math.floor(rnd() * ss.length)];
    if (s.b - s.a < 60) continue;
    const len = Math.min(K('lvWorkW'), s.b - s.a - 8);
    const x0 = Math.round(s.a + 4 + rnd() * (s.b - s.a - 8 - len)), x1 = Math.round(x0 + len);
    if (works.some(w => w.ci === ci && x0 < w.x1 + 40 && x1 > w.x0 - 40)) continue;
    if (vaults.some(v => (v.below === ci || v.below === ci - 1) && x0 < v.b + 24 && x1 > v.a - 24)) continue;
    if (tries < 250 && hits(layers[ci].holes, x0, x1, 4)) continue;   // a gallery floor with no hole in it, if it can
    const fs = Array.from(c.floor.slice(x0, x1 + 1)).sort((p, q) => p - q);
    let Lf = Math.round(fs[fs.length >> 1]);
    const under = layers[ci].bot, over = layers[ci + 1].top;
    let maxOver = 0;
    for (let x = Math.max(0, x0 - 28); x <= Math.min(CW - 1, x1 + 28); x++) {
      if (under) Lf = Math.min(Lf, Math.floor(under[x]) - 6);
      maxOver = Math.max(maxOver, over[x]);
    }
    const Hw = Math.round(Math.min(K('lvWorkH'), Lf - 1 - (maxOver + 6)));
    if (Hw < Math.max(16, hFloor)) continue;
    const Lc = Lf - Hw - 1;
    if (!(ok(x0, Lf - 4) && ok(x1, Lf - 4) && ok((x0 + x1) / 2, Lc + 2) && ok(x0 - 28, Lf - 4) && ok(x1 + 28, Lf - 4))) continue;
    for (let x = Math.max(s.a, x0 - 28); x <= Math.min(s.b, x1 + 28); x++) {
      const t = x < x0 ? sm((x - (x0 - 28)) / 28) : x > x1 ? sm((x1 + 28 - x) / 28) : 1;
      c.floor[x] += (Lf - c.floor[x]) * t;
      c.ceil[x] += (Lc - c.ceil[x]) * t;
    }
    works.push({ ci, x0, x1, fy: Lf, cy: Lc });
    n--;
  }

  // a sloping corridor needs more headroom than a level one (the runner is a box, and a
  // box going uphill needs its height plus the rise across its width): lift the roof where
  // it's steep, never thinning the layer above under 4 rows
  for (let pass = 0; pass < 2; pass++) for (const c of cors) {
    if (c.top) continue;
    const over = layers[c.i + 1].top;
    for (let x = X0 + 4; x <= X1 - 4; x++) {
      const sl = Math.max(Math.abs(c.floor[x + 4] - c.floor[x - 4]), Math.abs(c.ceil[x + 4] - c.ceil[x - 4])) / 8;
      const need = hFloor + 8 * sl;
      if (c.floor[x] - c.ceil[x] - 1 < need) c.ceil[x] = Math.max(over[x] + 4, c.floor[x] - need - 1);
    }
  }

  // 4. rasterise: all rock, then the corridors (walls pinched in the middle), then the holes
  mat.fill(ROCK, 0, SHOP_FLOOR * CW);
  for (const c of cors) {
    for (let x = X0; x <= X1; x++) {
      const y0 = Math.max(3, Math.floor(c.ceil[x]) + 1), y1 = Math.ceil(c.floor[x]) - 1;
      for (let y = y0; y <= y1; y++) {
        let open = true;
        for (const w of c.walls) {
          const t = (y - y0) / Math.max(1, y1 - y0);
          const hw = w.w / 2 * (0.55 + 0.9 * Math.abs(t - 0.5)) + 3 * (vn(x / 4 + w.x, y / 4) - 0.5);
          if (Math.abs(x - w.x) < hw) { open = false; break; }
        }
        if (open) mat[y * CW + x] = 0;
      }
    }
  }
  layers.forEach((L, j) => {
    for (const h of L.holes) {
      for (let x = Math.floor(h.a) - 4; x <= Math.ceil(h.b) + 4; x++) {
        if (x < X0 || x > X1) continue;
        const yT = Math.floor(L.top[x]), yB = j ? Math.ceil(L.bot[x]) : yBase + 8;
        for (let y = yT; y <= yB; y++) {
          const rim = Math.max(0, 3 - Math.min(y - yT, yB - y));      // a little funnel at each lip
          const ja = 2.5 * (vn(y / 5, h.a) - 0.5), jb = 2.5 * (vn(y / 5, h.b + 50) - 0.5);
          if (x >= h.a - rim + ja && x <= h.b + rim + jb) mat[y * CW + x] = 0;
        }
      }
    }
  });

  // caverns: whole stacks of layers fallen in, with broken bits of them left hanging
  const keepOut = [...works.map(w => ({ a: w.x0 - 24, b: w.x1 + 24, t: w.cy - 12, u: w.fy + 12 })),
    ...vaults.map(v => ({ a: v.a - 16, b: v.b + 16, t: v.y - 30, u: v.y + 30 }))];
  const inKeep = (x, y, m) => keepOut.some(k => x > k.a - m && x < k.b + m && y > k.t - m && y < k.u + m);
  const caves = [];
  for (let n = cnt('lvCaves'), tries = 0; n > 0 && tries < 80; tries++) {
    const rx = K('lvCaveW'), ry = K('lvCaveH');
    const cx = X0 + rx * 0.6 + rnd() * Math.max(0, X1 - X0 - rx * 1.2);
    const cy = 90 + ry * 0.5 + rnd() * Math.max(0, yBase - 160 - ry);
    if (keepOut.some(k => k.a < cx + rx * 1.2 && k.b > cx - rx * 1.2 && k.t < cy + ry * 1.2 && k.u > cy - ry * 1.2)) continue;
    if (caves.some(q => Math.hypot((q.cx - cx) / (q.rx + rx), (q.cy - cy) / (q.ry + ry)) < 0.6)) continue;
    caves.push({ cx, cy, rx, ry, k: caves.length });
    n--;
  }
  const inCave = (x, y) => caves.some(q => ((x - q.cx) / q.rx) ** 2 + ((y - q.cy) / q.ry) ** 2 < 1.1);
  for (const q of caves) {
    const ya = Math.max(8, Math.floor(q.cy - q.ry * 1.4)), yb = Math.min(yBase - 4, Math.ceil(q.cy + q.ry * 1.4));
    const xa = Math.max(X0, Math.floor(q.cx - q.rx * 1.4)), xb = Math.min(X1, Math.ceil(q.cx + q.rx * 1.4));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const i = y * CW + x;
      if (!mat[i]) continue;
      const d = ((x - q.cx) / q.rx) ** 2 + ((y - q.cy) / q.ry) ** 2 + (fbm(x / 40 + q.k * 13, y / 40) - 0.5) * 0.6;
      if (d >= 1) continue;
      if (vn(x / 30 + 300 + q.k * 7, y / 7 + 300) > 0.8 - 0.14 * d) continue;   // a broken bit of layer stays
      mat[i] = 0;
    }
    // stalactites and stalagmites
    for (let m = 5 + Math.floor(rnd() * 8); m-- > 0;) {
      const x = Math.round(q.cx + (rnd() * 2 - 1) * q.rx * 0.8), y = Math.round(q.cy);
      if (x < X0 + 4 || x > X1 - 4 || mat[y * CW + x]) continue;
      let yr = y, yf = y;
      while (yr > 4 && !mat[(yr - 1) * CW + x]) yr--;
      while (yf < yBase && !mat[(yf + 1) * CW + x]) yf++;
      const room = yf - yr + 1;
      if (room < 50) continue;
      const hang = rnd() < 0.6, len = Math.min(room * (hang ? 0.4 : 0.25), (hang ? 10 : 6) + rnd() * (hang ? 30 : 16));
      const w = 2.5 + rnd() * 4;
      for (let k = 0; k < len; k++) {
        const half = w * Math.pow(1 - k / len, 0.8) + (vn(k / 3, x) - 0.5) * 1.5;
        const yy = hang ? yr + k : yf - k;
        for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++)
          if (Math.abs(dx) <= half) mat[yy * CW + x + dx] = ROCK;
      }
    }
  }
  // bubbles in the rock
  for (let y = 8; y < yBase - 2; y += 1) for (let x = X0; x <= X1; x++) {
    const i = y * CW + x;
    if (!mat[i] || ((x | y) & 1)) continue;            // sampled on a 2px grid, the pixel and its three neighbours
    if (fbm(x / 26 + 900, y / 18 + 900) >= 0.24 || inKeep(x, y, 6)) continue;
    mat[i] = mat[i + 1] = mat[i + CW] = mat[i + CW + 1] = 0;
  }

  // route: a tube down the middle of every stretch of corridor and up through every hole,
  // re-cleared after rooms and smoothing so nothing laid later can seal a way through
  const routePath = [], points = [{ x: shopExit, y: SHOP_TOP - 30 }];
  const mid = (c, x) => (c.floor[x] + c.ceil[x]) / 2;
  for (const c of cors) for (const s of segs(c)) {
    for (let x = s.a + 6; x <= s.b - 6; x += 3) {
      const y = mid(c, x);
      if (!inCave(x, y)) routePath.push({ x, y, r: Math.min(5, Math.floor((c.floor[x] - c.ceil[x] - 2) / 2)) });
    }
    const xm = Math.round((s.a + s.b) / 2);
    points.push({ x: xm, y: mid(c, xm) });
  }
  layers.forEach((L, j) => {
    if (!j) return;
    for (const h of L.holes) {
      const x = Math.round((h.a + h.b) / 2), ya = mid(cors[j - 1], x), yb = mid(cors[j], x);
      for (let y = ya; y >= yb; y -= 3) if (!inCave(x, y)) routePath.push({ x, y, r: Math.min(5, Math.floor((h.b - h.a - 2) / 2)) });
    }
  });
  points.push({ x: CW / 2, y: 22 });
  // each vault gets its doorway: a spot in the corridor under it, clear of that corridor's walls
  for (const v of vaults) {
    const c = cors[v.below];
    for (let t = 0; t < 20; t++) {
      const px = Math.round(Math.max(X0 + 10, Math.min(X1 - 10, v.x + (rnd() < 0.5 ? -1 : 1) * (48 + rnd() * 24))));
      if (hits(c.walls, px, px, 6) || !ok(px, mid(c, px))) continue;
      v.px = px; v.py = mid(c, px);
      break;
    }
  }
  strataCave.last = { layers, cors, caves };     // for the tests
  return { routePath, points, vaults: vaults.filter(v => v.px != null), works, layers: layers.length };
}

// The old workings' floors: worn paving, with gaps where stones have gone. After smoothing,
// which would turn brick back into rock.
function paveWorks(mat, works, vn) {
  for (const w of works)
    for (let x = w.x0; x <= w.x1; x++) {
      if (vn(x / 7, w.fy) < 0.3) continue;
      for (let y = w.fy; y < w.fy + 3; y++) if (mat[y * CW + x] === ROCK) mat[y * CW + x] = BRICK;
    }
}

// The old workings' timber: sets along the gallery at the post spacing, each one measured
// off the rock by timberFrame, and the odd prop lying on the floor. It comes in patches
// (v85, owner: "lots of support in some areas, none or minimal in others", then "way too
// dense … a third of that, but the propped areas more common"): several propped patches,
// most round a working, where the galleries keep every bay and the natural tunnels get
// timber sets too wherever the rock will take one, spaced at the post spacing. Outside them
// the galleries keep a sparse, half-rotted run of sets and the natural cave has none.
function timberWorks(mat, dimg, works, T, R, fuel, ok) {
  const dd = dimg.data;
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= CW || y >= CH || mat[y * CW + x]) return;
    const k = (y * CW + x) * 4;
    dd[k] = c[0]; dd[k + 1] = c[1]; dd[k + 2] = c[2]; dd[k + 3] = 255;
    if (fuel) fuel[y * CW + x] = FUEL_WOOD;
  };
  let sets = 0;
  const zones = [];
  const zn = kr('lvPropZones', R), zc = Math.floor(zn) + (R() < zn % 1 ? 1 : 0);
  for (let k = 0; k < zc; k++) {
    const w = works.length && R() < 0.8 ? works[Math.floor(R() * works.length)] : null;
    zones.push({ x: w ? (w.x0 + w.x1) / 2 : 20 + R() * (CW - 40), y: w ? w.fy - 10 : 60 + R() * (SHOP_TOP - 140),
      r: kr('lvPropR', R), d: Math.max(1, kr('lvPropDense', R)) });
  }
  const zoneAt = (x, y) => zones.find(z => Math.hypot(x - z.x, y - z.y) < z.r);
  for (const w of works) {
    const xs = [];
    for (let x = w.x0 + 3 + R() * 6; x < w.x1 - 3;) {
      xs.push(Math.round(x));
      const z = zoneAt(x, w.fy);
      x += Math.max(12, kr('lvPost', R) / (z ? z.d : 1));
    }
    for (let k = 0; k + 1 < xs.length; k++) {
      if (!zoneAt(xs[k], w.fy) && R() < kr('lvPropRot', R)) continue;
      if (timberFrame(mat, set, R, T, xs[k], xs[k + 1], w.fy - 5, true, w.fy)) sets++;
    }
    if (R() < 0.4) {                                  // a fallen prop
      const len = 10 + Math.floor(R() * 10), x0 = Math.round(w.x0 + R() * Math.max(1, w.x1 - w.x0 - len));
      for (let k = 0; k < len; k++) {
        set(x0 + k, w.fy - 1, [70 + R() * 10, 52 + R() * 8, 36]);
        if (k > 2 && k < len - 2) set(x0 + k, w.fy - 2, [84 + R() * 10, 62 + R() * 8, 42]);
      }
    }
  }
  // the natural tunnels in a patch: walk each floor in it and put a set wherever one fits,
  // side by side at the patch's spacing
  for (const z of zones) {
    const used = [];
    for (let y = Math.max(20, Math.floor(z.y - z.r)); y < Math.min(SHOP_TOP - 20, z.y + z.r); y++) {
      for (let x = Math.max(6, Math.floor(z.x - z.r)); x < Math.min(CW - 30, z.x + z.r); x++) {
        if (mat[y * CW + x] || !mat[(y + 1) * CW + x] || Math.hypot(x - z.x, y - z.y) > z.r) continue;
        if (works.some(w => x > w.x0 - 34 && x < w.x1 + 30 && y > w.cy && y <= w.fy)) continue;   // galleries have their own
        if (ok && !(ok(x, y) && ok(x + 20, y))) continue;                       // built-up zones only
        const wd = 12 + Math.floor(R() * 8), gap = Math.max(4, kr('lvPost', R) / z.d - wd);
        if (used.some(u => Math.abs(u.y - y) < 10 && x < u.b + gap && x + wd > u.a - gap)) continue;
        if (timberFrame(mat, set, R, T, x, x + wd, y - 4, true, y + 1, 36)) { used.push({ a: x, b: x + wd, y }); sets++; x += wd; }
      }
    }
  }
  timberWorks.zones = zones;                       // for the tests
  return sets;
}

// ---- the death replay ("Witness yourself", v90) ----
// The Game keeps the last few seconds as snapshots, RP_HZ a second: a copy of everything draw()
// reads in a box round you. On the death screen the replay feeds them back through draw(),
// blended between snapshots so slow motion stays smooth. Terrain isn't in the snapshots: it's a
// base picture from the start of the window plus the patches dug or burnt since (rpCut/rpPaste),
// and the fog is a base plus a log of the cells that changed.
const RP_HZ = 20;                  // snapshots a second
const RP_BEFORE = 10;              // seconds shown before the death
const RP_AFTER = 3;                // and after it: the recording runs on this long
const RP_KEEP = RP_BEFORE + 0.5;   // seconds kept while you're alive
const RP_W = 320, RP_H = 440;      // half-size of the box round you that gets recorded (world units)
// the lists draw() reads that go into a snapshot (enemies, pickups and props are handled the same)
const RP_LISTS = ['bullets', 'enemyShots', 'smoke', 'sparks', 'flashes', 'coins', 'fields', 'beams', 'arcs',
  'torchP', 'motes', 'burns', 'webs', 'silk', 'strings', 'dparts', 'amb', 'clouds', 'rings', 'devils',
  'enemies', 'pickups', 'props'];
// single numbers draw() reads, blended between snapshots
const RP_NUMS = ['time', 'flick', 'leanX', 'leanY', 'glowN'];
// nested state worth copying (creature brains the sprites read, tentacles, lightning trails, the
// aim); any other object inside an entity is shared, not copied
const RP_DEEP = { sp: 1, ra: 1, je: 1, nest: 1, shot: 1, tent: 1, trail: 1, aim: 1 };
// fields that slide between snapshots; everything else jumps at the halfway point
const RP_LERP = { x: 1, y: 1, ty: 1, lx: 1, ly: 1, vx: 1, vy: 1, nx: 1, ny: 1, jx: 1, jy: 1, ox: 1, oy: 1,
  life: 1, t: 1, age: 1, r: 1, size: 1, shape: 1, flame: 1, fuel: 1, hp: 1, charge: 1, len: 1, hitT: 1 };
const RP_ANGLE = { hd: 1 };        // angles blend the short way round
const rpPlain = v => v !== null && typeof v === 'object' &&
  (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype);
// a snapshot copy of one entity: its own fields, plus copies of the RP_DEEP parts; `id` ties
// the copies of one entity together across snapshots
function rpClone(o, id) {
  const c = {};
  for (const k in o) {
    const v = o[k];
    c[k] = RP_DEEP[k] && rpPlain(v) ? rpCopy(v) : v;
  }
  if (id !== undefined) c._r = id;
  return c;
}
function rpCopy(v) {
  return Array.isArray(v) ? v.map(rpCopy) : rpPlain(v) ? rpClone(v) : v;
}
// one entity at fraction u of the way from snapshot copy a to b
function rpLerp(a, b, u) {
  if (!b || a === b) return a;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return u < 0.5 ? a : b;
    return a.map((x, i) => rpLerp(x, b[i], u));
  }
  if (!rpPlain(a) || !rpPlain(b)) return u < 0.5 ? a : b;
  const c = Object.assign({}, u < 0.5 ? a : b);
  for (const k in c) {
    const va = a[k], vb = b[k];
    if (typeof va === 'number' && typeof vb === 'number') {
      if (RP_LERP[k]) c[k] = va + (vb - va) * u;
      else if (RP_ANGLE[k]) c[k] = va + angDiff(vb, va) * u;
    } else if (RP_DEEP[k] && va && vb && typeof va === 'object') c[k] = rpLerp(va, vb, u);
  }
  return c;
}
// a whole list at fraction u: matched entities blend; one that only exists in the earlier
// snapshot shows until halfway, one born in the later shows from halfway
function rpList(A, B, u) {
  const out = [], mb = new Map();
  for (const o of B) mb.set(o._r, o);
  for (const a of A) {
    const b = mb.get(a._r);
    if (b) { out.push(rpLerp(a, b, u)); mb.delete(a._r); }
    else if (u < 0.5) out.push(a);
  }
  if (u >= 0.5) for (const b of mb.values()) out.push(b);
  return out;
}
// the two snapshots either side of time t, and how far between them
function rpAt(snaps, t) {
  let lo = 0, hi = snaps.length - 1;
  if (t <= snaps[0].t) return { a: snaps[0], b: snaps[0], u: 0 };
  if (t >= snaps[hi].t) return { a: snaps[hi], b: snaps[hi], u: 0 };
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (snaps[m].t <= t) lo = m; else hi = m; }
  const a = snaps[lo], b = snaps[hi];
  return { a, b, u: (t - a.t) / (b.t - a.t || 1) };
}
// the whole scene at time t, ready to swap in for the live one
function rpFrame(snaps, t) {
  const { a, b, u } = rpAt(snaps, t), F = { near: u < 0.5 ? a : b };
  for (const k of RP_LISTS) F[k] = rpList(a[k], b[k], u);
  for (const k of RP_NUMS) F[k] = a[k] + (b[k] - a[k]) * u;
  F.p = rpLerp(a.p, b.p, u);
  F.ghost = a.ghost && b.ghost ? rpLerp(a.ghost, b.ghost, u) : F.near.ghost;
  return F;
}
// terrain patches: copy a rectangle out of (and back into) a W-wide RGBA pixel array
function rpCut(data, W, x, y, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let r = 0; r < h; r++) out.set(data.subarray(((y + r) * W + x) * 4, ((y + r) * W + x + w) * 4), r * w * 4);
  return out;
}
function rpPaste(data, W, P) {
  for (let r = 0; r < P.h; r++) data.set(P.px.subarray(r * P.w * 4, (r + 1) * P.w * 4), ((P.y + r) * W + P.x) * 4);
}
// the dirty rectangles of one snapshot ([which, x, y, w, h]), clipped to the W x H map and
// merged per layer into one box when that box isn't much bigger than the pieces
function rpMerge(rects, W, H) {
  const out = [];
  for (const which of ['t', 'd']) {
    const rs = [];
    for (const [c, x, y, w, h] of rects) {
      if (c !== which) continue;
      const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
      if (x1 > x0 && y1 > y0) rs.push([x0, y0, x1, y1]);
    }
    if (!rs.length) continue;
    let area = 0, X0 = W, Y0 = H, X1 = 0, Y1 = 0;
    for (const [x0, y0, x1, y1] of rs) {
      area += (x1 - x0) * (y1 - y0);
      X0 = Math.min(X0, x0); Y0 = Math.min(Y0, y0); X1 = Math.max(X1, x1); Y1 = Math.max(Y1, y1);
    }
    if ((X1 - X0) * (Y1 - Y0) <= Math.max(4096, area * 3)) out.push([which, X0, Y0, X1 - X0, Y1 - Y0]);
    else for (const [x0, y0, x1, y1] of rs) out.push([which, x0, y0, x1 - x0, y1 - y0]);
  }
  return out;
}

function makeLevel(seed, floor, owned) {
  floor = floor || 1;
  const have = new Set(owned || []);     // perks you are already carrying, so a room is
                                         // never a wasted trip if it can help it
  const hash = (x, y) => {
    let v = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    v ^= v >>> 16;
    return (v >>> 0) / 4294967296;
  };
  const vn = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y) => 0.55 * vn(x, y) + 0.3 * vn(x * 2 + 17, y * 2 + 31) + 0.15 * vn(x * 4 + 53, y * 4 + 7);
  let rs = seed % 2147483646 + 1;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 12; i++) rnd();     // this generator starts cold on small seeds

  const mat = new Uint8Array(CW * CH);
  const inside = (x, y) => x >= 0 && y >= 0 && x < CW && y < CH;
  const disc = (ex, ey, r, v) => {
    const r2 = r * r;
    for (let y = Math.floor(ey - r); y <= Math.ceil(ey + r); y++)
      for (let x = Math.floor(ex - r); x <= Math.ceil(ex + r); x++)
        if (inside(x, y) && (x - ex) * (x - ex) + (y - ey) * (y - ey) <= r2) mat[y * CW + x] = v;
  };

  // 1. solid ground with caves eaten out of it.
  //    A slow "openness" noise decides whether an area is cramped or vast.
  //    All three fields are far smoother than one pixel, so they are sampled on a
  //    coarse lattice and interpolated: an fbm per pixel was over half the cost of
  //    generating a level, and the map is four times the area it used to be.
  const lattice = (step, fn) => {
    const gw = Math.ceil(CW / step) + 2, gh = Math.ceil(CH / step) + 2;
    const g = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++)
      for (let i = 0; i < gw; i++) g[j * gw + i] = fn(i * step, j * step);
    return { g, gw, inv: 1 / step };
  };
  const at = (L, x, y) => {
    const fx = x * L.inv, fy = y * L.inv;
    const xi = fx | 0, yi = fy | 0, u = fx - xi, v = fy - yi, i = yi * L.gw + xi;
    const a = L.g[i], b = L.g[i + 1], c = L.g[i + L.gw], d2 = L.g[i + L.gw + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d2) * u * v;
  };
  // Floor 1 mixes two caves in zones (v87). A big, slow noise over the whole map picks, pixel
  // by pixel, built-up (strataCave: layers, old workings, timber, vaults) or natural (the
  // noise cave below, with its ledges, frames and platforms). Both are built whole and
  // stitched along the zone edge, which a small warp roughs up and the smoothing pass melts.
  // Every other floor is the natural cave alone, until it gets its own treatment.
  const layered = floor === 1;
  const openL = lattice(8, (x, y) => fbm(x / 160 + 500, y / 160 + 500));
  const pocketL = lattice(4, (x, y) => fbm(x / 60, y / 60));
  const tunnelL = lattice(4, (x, y) => fbm(x / 90 + 200, y / 90 + 200));
  for (let cy = 0; cy < CH; cy++) {
    for (let cx = 0; cx < CW; cx++) {
      const open = Math.min(1, Math.max(0, (at(openL, cx, cy) - 0.42) / 0.16));
      const pocket = at(pocketL, cx, cy) < 0.34 + 0.24 * open;
      const tunnel = Math.abs(at(tunnelL, cx, cy) - 0.5) < 0.018 + 0.018 * open;
      mat[cy * CW + cx] = pocket || tunnel ? 0 : ROCK;
    }
  }

  // the zones: zone[i] = 1 where the map is built-up. The threshold is the share asked for,
  // measured over the cave, so "half" really is about half.
  let zone = null;
  if (layered) {
    const zs = kr('lvZoneSize', rnd), share = kr('lvZoneShare', rnd), rag = kr('lvZoneRag', rnd), ph = rnd() * 100;
    const zoneL = lattice(8, (x, y) => fbm(x / zs + 1300 + ph, y / zs + 1300));
    const warpX = lattice(4, (x, y) => vn(x / 14 + 1700, y / 14 + 1700));
    const warpY = lattice(4, (x, y) => vn(x / 14 + 1900, y / 14 + 1900));
    const vals = [];
    for (let y = 0; y < SHOP_TOP - SHOP_ROOF; y += 8) for (let x = 0; x < CW; x += 8) vals.push(at(zoneL, x, y));
    vals.sort((a, b) => a - b);
    const thr = share <= 0 ? Infinity : share >= 1 ? -Infinity : vals[Math.min(vals.length - 1, Math.floor((1 - share) * vals.length))];
    zone = new Uint8Array(CW * CH);
    for (let y = 0; y < SHOP_FLOOR; y++) for (let x = 0; x < CW; x++) {
      const wx = Math.max(0, Math.min(CW - 1, x + rag * (2 * at(warpX, x, y) - 1)));
      const wy = Math.max(0, Math.min(CH - 1, y + rag * (2 * at(warpY, x, y) - 1)));
      if (at(zoneL, wx, wy) > thr) zone[y * CW + x] = 1;
    }
  }
  const built = (x, y) => {
    if (!zone) return false;
    x = Math.round(x); y = Math.round(y);
    return x >= 0 && y >= 0 && x < CW && y < CH && zone[y * CW + x] === 1;
  };

  // 2. main route from bottom to top: chambers linked by winding tunnels
  //    that are always wide enough to fly through (side pockets still need blasting)
  const shopExit = 40 + Math.floor(rnd() * (CW - 80));   // the one way out of the shop
  // the built-up cave is built whole in its own buffer, and stitched in below
  const lay = layered ? new Uint8Array(CW * CH) : null;
  const strata = layered ? strataCave(lay, rnd, { vn, fbm, ok: built }, shopExit) : null;
  const points = [{ x: shopExit, y: SHOP_TOP - 30 }];
  const hops = 12;                                       // the cave is twice as tall now
  for (let i = 1; i <= hops; i++) {
    points.push({ x: 40 + rnd() * (CW - 80), y: CH - 26 - (CH - 60) * i / (hops + 1) + (rnd() - 0.5) * 40 });
  }
  points.push({ x: CW / 2, y: 22 });

  const blob = (ex, ey, r) => {
    const r2 = r * 1.3;
    for (let y = Math.floor(ey - r2); y <= ey + r2; y++)
      for (let x = Math.floor(ex - r2); x <= ex + r2; x++) {
        if (!inside(x, y)) continue;
        const a = Math.atan2(y - ey, x - ex);
        const wob = r * (0.75 + 0.5 * vn(Math.cos(a) * 1.5 + ex, Math.sin(a) * 1.5 + ey));
        if (Math.hypot(x - ex, (y - ey) * 1.4) <= wob) mat[y * CW + x] = 0;
      }
  };
  const routePath = [];   // remembered so smoothing can't pinch the links shut
  // keep: the list its path is remembered in. The main route (spine) is only cut through
  // natural zones at first; its built-up stretches go in spineBuilt, cut later only if the
  // layered corridors don't already carry you across (see "the way through" below).
  const spineBuilt = [];
  const worm = (x, y, tx, ty, r, maxSteps, keep, spine) => {
    let ang = tx !== null ? Math.atan2(ty - y, tx - x) : rnd() * Math.PI * 2;
    for (let s = 0; s < maxSteps; s++) {
      if (spine && built(x, y)) spineBuilt.push({ x, y, r: Math.min(r, 7) - 1 });
      else {
        disc(x, y, r, 0);
        if (keep) keep.push({ x, y, r: r - 1 });
      }
      if (tx !== null && Math.hypot(tx - x, ty - y) < 3) break;
      const want = tx !== null ? Math.atan2(ty - y, tx - x) : ang;
      let diff = want - ang;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      ang += diff * 0.12 + (rnd() - 0.5) * 0.9;
      x += Math.cos(ang) * 1.5; y += Math.sin(ang) * 1.5;
      x = Math.max(6, Math.min(CW - 7, x)); y = Math.max(6, Math.min(CH - 12, y));
    }
  };
  for (let i = 1; i < points.length - 1; i++) {
    if (rnd() < 0.7) blob(points[i].x, points[i].y, 16 + rnd() * 30);
  }
  // side branches and dead ends (natural zones only: they're cut before the stitch)
  const side = [];
  for (let i = 0; i < 48; i++) {
    worm(10 + rnd() * (CW - 20), 20 + rnd() * (CH - 60), null, null, 5 + rnd() * 6, 40 + rnd() * 150, side);
  }
  for (const c of side) if (!built(c.x, c.y)) routePath.push(c);
  // the stitch: built-up zones take the layered cave, with its own links through them
  if (layered) {
    for (let i = 0; i < SHOP_FLOOR * CW; i++) if (zone[i]) mat[i] = lay[i];
    for (const c of strata.routePath) if (built(c.x, c.y)) routePath.push(c);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const r = rnd() < 0.4 ? 7 + rnd() * 2 : 11 + rnd() * 6;   // tight ones are still snug, but you fit
    worm(a.x, a.y, b.x, b.y, r, 2000, routePath, true);
  }
  // the built-up bits that survived the stitch whole: old workings and the vaults
  const works = strata ? strata.works.filter(w => built(w.x0, w.fy - 4) && built(w.x1, w.fy - 4) &&
    built((w.x0 + w.x1) / 2, w.cy + 2)) : [];
  const vaults = strata ? strata.vaults.filter(v => built(v.a, v.y) && built(v.b, v.y) && built(v.px, v.py)) : [];

  // 3. smooth everything into natural shapes. Same 3x3 majority as always, but the
  //    column sums are shared along the row instead of re-read nine times a pixel.
  const src = new Uint8Array(CW * CH), col = new Uint8Array(CW);
  for (let pass = 0; pass < 4; pass++) {
    src.set(mat);
    for (let cy = 1; cy < CH - 1; cy++) {
      const r0 = (cy - 1) * CW, r1 = cy * CW, r2 = (cy + 1) * CW;
      for (let cx = 0; cx < CW; cx++)
        col[cx] = (src[r0 + cx] ? 1 : 0) + (src[r1 + cx] ? 1 : 0) + (src[r2 + cx] ? 1 : 0);
      for (let cx = 1; cx < CW - 1; cx++)
        mat[r1 + cx] = col[cx - 1] + col[cx] + col[cx + 1] >= 5 ? ROCK : 0;
    }
  }
  for (const c of routePath) disc(c.x, c.y, c.r, 0);
  paveWorks(mat, works, vn);

  // solid floor and the exit room at the top
  for (let cy = SHOP_FLOOR; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = ROCK;
  const carve = (ex, ey, rx, ry, maxY) => {
    for (let y = Math.max(0, ey - ry); y <= Math.min(maxY, ey + ry); y++)
      for (let x = Math.max(0, ex - rx); x <= Math.min(CW - 1, ex + rx); x++) {
        const dx = (x - ex) / rx, dy = (y - ey) / ry;
        if (dx * dx + dy * dy <= 1) mat[y * CW + x] = 0;
      }
  };
  carve(CW / 2, 22, 40, 16, CH);

  const emptyRatio = (x0, y0, w, hh) => {
    let e = 0, n = 0;
    for (let y = y0; y < y0 + hh; y++)
      for (let x = x0; x < x0 + w; x++) { n++; if (inside(x, y) && !mat[y * CW + x]) e++; }
    return e / n;
  };
  const slab = (x0, y0, w, hh) => {
    for (let y = y0; y < y0 + hh; y++)
      for (let x = x0; x < x0 + w; x++) if (inside(x, y)) mat[y * CW + x] = BRICK;
  };

  // 4. built ledges sticking out of cave walls
  // (natural zones only: in a built-up zone the ledges are the layers, and these read as hovering)
  let ledges = 0;
  for (let a = 0; a < 2400 && ledges < 120; a++) {
    const x = 10 + Math.floor(rnd() * (CW - 20)), y = 20 + Math.floor(rnd() * (SHOP_TOP - 50));
    if (mat[y * CW + x] || built(x, y)) continue;
    const dir = rnd() < 0.5 ? -1 : 1;
    let wx = x, dist = 0;
    while (dist < 50 && inside(wx, y) && !mat[y * CW + wx]) { wx += dir; dist++; }
    if (dist >= 50 || dist < 8) continue;
    const len = Math.min(dist + 4, 14 + Math.floor(rnd() * 26));
    const x0 = dir < 0 ? wx - 3 : wx - len + 4;
    if (emptyRatio(dir < 0 ? wx + 1 : x0, y - 12, len - 4, 12) < 0.9) continue;
    if (built(x0, y) || built(x0 + len, y)) continue;
    slab(x0, y, len, 4);
    ledges++;
  }

  // 5. old brick frames half buried in the rock
  for (let i = 0; i < 36; i++) {
    const fw = 30 + Math.floor(rnd() * 40), fh = 20 + Math.floor(rnd() * 20);
    const fx = 8 + Math.floor(rnd() * (CW - 16 - fw)), fy = 60 + Math.floor(rnd() * (SHOP_TOP - 120));
    if (built(fx, fy) || built(fx + fw, fy) || built(fx, fy + fh) || built(fx + fw, fy + fh)) continue;
    const rockRatio = 1 - emptyRatio(fx, fy, fw, fh);
    if (rockRatio < 0.25 || rockRatio > 0.85) continue;
    const gap = Math.floor(rnd() * 4);   // which side gets a doorway
    slab(fx, fy, fw, 4);
    slab(fx, fy + fh - 4, fw, 4);
    slab(fx, fy, 4, fh);
    slab(fx + fw - 4, fy, 4, fh);
    if (gap === 0) for (let y = fy; y < fy + 4; y++) for (let x = fx + 8; x < fx + 22; x++) mat[y * CW + x] = 0;
    if (gap === 1) for (let y = fy + 4; y < fy + fh - 4; y++) for (let x = fx; x < fx + 4; x++) mat[y * CW + x] = 0;
    if (gap === 2) for (let y = fy + 4; y < fy + fh - 4; y++) for (let x = fx + fw - 4; x < fx + fw; x++) mat[y * CW + x] = 0;
  }

  // 6. a few floating platforms in the big open spaces
  let floats = 0;
  for (let a = 0; a < 1600 && floats < 40; a++) {
    const len = 18 + Math.floor(rnd() * 22);
    const x0 = 8 + Math.floor(rnd() * (CW - 16 - len)), y0 = 40 + Math.floor(rnd() * (SHOP_TOP - 80));
    if (built(x0 - 12, y0) || built(x0 + len + 12, y0)) continue;
    if (emptyRatio(x0 - 12, y0 - 18, len + 24, 34) < 0.98) continue;
    slab(x0, y0, len, 4);
    floats++;
  }

  // clear a doorway wherever a ledge, frame or platform landed across a link
  for (const c of routePath) disc(c.x, c.y, Math.min(c.r, 7), 0);

  // ---- the shop: an enclosed room the full width of the level, one hole in the roof ----
  for (let cy = SHOP_TOP; cy < SHOP_FLOOR; cy++)
    for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = 0;
  for (let cy = SHOP_TOP - SHOP_ROOF; cy < SHOP_TOP; cy++)
    for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = BRICK;
  for (let cy = SHOP_FLOOR; cy < SHOP_FLOOR + 4; cy++)
    for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = BRICK;
  // the way up, and a short shaft so the cave above is always reachable
  for (let cy = SHOP_TOP - SHOP_ROOF - 26; cy < SHOP_TOP; cy++)
    for (let cx = shopExit - 9; cx <= shopExit + 9; cx++)
      if (inside(cx, cy)) mat[cy * CW + cx] = 0;

  // exit ledge
  slab(CW / 2 - 24, 34, 48, 3);

  // ---- hidden rooms ----
  // One perk and one heart, each cut out of whatever rock is there and lined with brick
  // the way the shop is, so it reads as somewhere somebody built. The tunnel runs back to
  // a point on the main route, which is the only thing in a level guaranteed to be
  // reachable — a room carved into the rock on its own would be a room nobody ever finds.
  const rect = (x0, y0, w, h, v) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) if (inside(x, y)) mat[y * CW + x] = v;
  };
  const tunnelTo = (x0, y0, x1, y1, r) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) disc(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, r, 0);
  };
  // On a zoned floor (v88) the two rooms are one in each kind of zone, which one is a coin
  // toss: want = true puts it in a built-up zone (a vault if one's left), false in a natural
  // one. On other floors `want` is ignored.
  const makeRoom = want => {
    for (let tries = 0; tries < 80; tries++) {
      // a built-up zone keeps a thick bit of layer for a room (a vault), and a spot in the
      // corridor under it for the tunnel to come out; with no vault left, the old way
      const v = !layered || want ? vaults.shift() : null;
      const p0 = v ? { x: v.px, y: v.py } : points[1 + Math.floor(rnd() * (points.length - 2))];
      const a = rnd() * Math.PI * 2, d = 50 + rnd() * 100;
      const ex = v ? v.x : Math.round(Math.max(40, Math.min(CW - 40, p0.x + Math.cos(a) * d)));
      const ey = v ? v.y : Math.round(Math.max(70, Math.min(SHOP_TOP - 70, p0.y + Math.sin(a) * d)));
      const rx = 20, ry = 12, sh = 3;
      // the wrong kind of zone (all four corners and the middle must match): try again,
      // unless it's the last go
      if (layered && !v && tries < 79 &&
          [[0, 0], [-rx, -ry], [rx, -ry], [-rx, ry], [rx, ry]].some(([dx, dy]) => built(ex + dx, ey + dy) !== !!want)) continue;
      rect(ex - rx - sh, ey - ry - sh, (rx + sh) * 2, (ry + sh) * 2, BRICK);   // the shell
      rect(ex - rx, ey - ry, rx * 2, ry * 2, 0);                               // and the room
      const back = Math.atan2(p0.y - ey, p0.x - ex);
      tunnelTo(ex + Math.cos(back) * (rx - 2), ey + Math.sin(back) * (ry - 2), p0.x, p0.y, 7);
      rect(ex - rx, ey - ry, rx * 2, ry * 2, 0);         // the tunnel may have eaten an edge
      return { x: ex * CELL, y: ey * CELL };
    }
    return null;
  };
  const heartBuilt = layered ? rnd() < 0.5 : false;
  const perkRoom = makeRoom(!heartBuilt);
  const heartRoom = makeRoom(heartBuilt);
  // and clear the route again: a room's shell is solid brick and can land straight across
  // the one tunnel the whole level hangs off. Above the shop only, or the same pass would
  // punch extra holes in the shop roof, which is laid down after the first one.
  for (const c of routePath)
    if (c.y < SHOP_TOP - SHOP_ROOF - 9) disc(c.x, c.y, Math.min(c.r, 7), 0);
  // the way through (zoned floors): can the runner get from the shop to the exit room? If
  // the built-up zones' own corridors don't join up the natural stretches of the main route,
  // the route is cut through them too, as a narrow natural shaft down through the layers.
  // Then each hidden room: one whose tunnel ends in a stretch the stitch cut off gets dug on
  // to the nearest place you can reach.
  if (layered) {
    const sx = 17, sy = SHOP_FLOOR - 12;
    let R = boxReach(mat, sx, sy);
    if (!R.top && spineBuilt.length) {
      for (const c of spineBuilt) { disc(c.x, c.y, c.r + 1, 0); routePath.push(c); }
      R = boxReach(mat, sx, sy);
    }
    // still cut off (it happens: a layer that closed over after smoothing): dig the shortest
    // way from anywhere you can get to, to anywhere the exit room can get to
    if (!R.top) {
      const E = boxReach(mat, CW / 2 - 3, 20);
      const prev = new Int32Array(CW * CH).fill(-1), q = new Int32Array(CW * CH);
      let h = 0, t = 0, hit = -1;
      for (let i = 0; i < CW * CH; i++) if (R.ok[i] === 2) { prev[i] = i; q[t++] = i; }
      while (h < t && hit < 0) {
        const i = q[h++], x = i % CW, y = (i / CW) | 0;
        if (E.ok[i] === 2) { hit = i; break; }
        for (const j of [x > 4 ? i - 1 : -1, x < CW - 11 ? i + 1 : -1, y > 4 ? i - CW : -1, y < SHOP_TOP - SHOP_ROOF - 16 ? i + CW : -1])
          if (j >= 0 && prev[j] < 0) { prev[j] = i; q[t++] = j; }
      }
      for (let i = hit, k = 0; i >= 0 && prev[i] !== i; i = prev[i], k++)
        if (k % 3 === 0) { const x = i % CW, y = (i / CW) | 0; disc(x + 3, y + 5, 7, 0); routePath.push({ x: x + 3, y: y + 5, r: 6 }); }
      R = boxReach(mat, sx, sy);
    }
    for (const r of [perkRoom, heartRoom]) {
      if (!r) continue;
      const cx = Math.round(r.x / CELL), cy = Math.round(r.y / CELL);
      let got = false;
      for (let dy = -5; dy <= 5 && !got; dy++) for (let dx = -5; dx <= 5; dx++) if (R.ok[(cy + dy) * CW + cx + dx] === 2) { got = true; break; }
      if (got) continue;
      let bi = -1, bd = Infinity;
      for (let i = 0; i < (SHOP_TOP - SHOP_ROOF - 14) * CW; i++) {
        if (R.ok[i] !== 2) continue;
        const d = (i % CW - cx) ** 2 + (((i / CW) | 0) - cy) ** 2;
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi >= 0) tunnelTo(cx, cy, bi % CW + 3, ((bi / CW) | 0) + 5, 7);
    }
  }
  // and lay the roof back down. A disc is round, so clearing the route anywhere near the
  // roof opens a few columns of it, and a shell across the shaft plugs it: either way the
  // roof stops being a roof. Whatever happened up here, the shop has one hole in it.
  for (let cy = SHOP_TOP - SHOP_ROOF; cy < SHOP_TOP; cy++)
    for (let cx = 0; cx < CW; cx++) mat[cy * CW + cx] = BRICK;
  for (let cy = SHOP_TOP - SHOP_ROOF - 26; cy < SHOP_TOP; cy++)
    for (let cx = shopExit - 9; cx <= shopExit + 9; cx++)
      if (inside(cx, cy)) mat[cy * CW + cx] = 0;
  // rat nests (v88): floor 1 only, most in the built-up zones. Their own random stream, so
  // the rest of the level is what the seed always made. Away from the rooms and the portals.
  let nests = [];
  if (layered) {
    let ns = (Math.imul(seed | 0, 48271) + 7) >>> 0;
    ns = ns % 2147483646 + 1;
    const nr = () => (ns = (ns * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 8; i++) nr();
    const nk = [{ x: CW / 2, y: 22, r: 70 }, { x: shopExit, y: SHOP_TOP - 30, r: 50 },
      ...[perkRoom, heartRoom].filter(Boolean).map(r => ({ x: r.x / CELL, y: r.y / CELL, r: 45 }))];
    nests = ratNests(mat, nr, zone, nk, Math.round(kr('raNests', nr)), Math.round(kr('raNestsWild', nr)));
  }
  const nearNest = (cx, cy) => nests.some(n => Math.hypot(n.x - cx, n.y - cy) < 20 || Math.hypot(n.mouth.x - cx, n.mouth.y - cy) < 10);
  // which perk is in it: anything you have not got, if the run of the pool allows
  let perkId = null;
  if (perkRoom) {
    const fresh = PERK_IDS.filter(k => !have.has(k));
    const pool = fresh.length ? fresh : PERK_IDS;
    perkId = pool[Math.floor(rnd() * pool.length)];
  }
  const rooms = [];
  if (perkRoom) rooms.push({ kind: 'perk', id: perkId, x: perkRoom.x, y: perkRoom.y, taken: false, built: built(perkRoom.x / CELL, perkRoom.y / CELL) });
  if (heartRoom) rooms.push({ kind: 'heart', x: heartRoom.x, y: heartRoom.y, taken: false, built: built(heartRoom.x / CELL, heartRoom.y / CELL) });

  // unbreakable border
  for (let cy = 0; cy < CH; cy++)
    for (let cx = 0; cx < CW; cx++)
      if (cx < 3 || cx >= CW - 3 || cy < 3 || cy >= CH - 3) mat[cy * CW + cx] = BED;
  // colour the terrain (the rock mottle rides the same interpolated lattice).
  // The palette is the floor's own, so the same floor always looks the same.
  const T = themeFor(floor);
  const tintL = lattice(4, (x, y) => fbm(x / 6 + 100, y / 6 + 100));
  const img = new ImageData(CW, CH);
  const d = img.data;
  for (let cy = 0; cy < CH; cy++) {
    for (let cx = 0; cx < CW; cx++) {
      const i = cy * CW + cx, m = mat[i];
      if (!m) continue;
      const r1 = hash(cx * 7 + 3, cy * 13 + 5);
      let c;
      if (m === ROCK) {
        const exposed = cy > 1 && (mat[i - CW] === 0 || mat[i - 2 * CW] === 0);
        c = exposed ? mix(T.moss[0], T.moss[1], r1)
                    : mix(T.rock[0], T.rock[1], at(tintL, cx, cy));
      } else if (m === BRICK) {
        const k = cx + (cy % 2) * 3;
        if (k % 6 === 0) c = T.mortar;
        else {
          c = mix(T.brick[0], T.brick[1], hash(Math.floor(k / 6), cy));
          if (cy > 0 && mat[i - CW] === 0) c = c.map(v => v * 1.18);
        }
      } else {
        c = mix(T.bed[0], T.bed[1], r1);
      }
      const j = (r1 - 0.5) * 10;
      d[i * 4] = c[0] + j; d[i * 4 + 1] = c[1] + j; d[i * 4 + 2] = c[2] + j; d[i * 4 + 3] = 255;
    }
  }

  // the rat nests' mounds: fresh-dug earth, not moss
  for (const n of nests) for (const i of n.mound) {
    if (mat[i] !== ROCK) continue;
    const r1 = hash(i % CW * 3 + 5, ((i / CW) | 0) * 7 + 1), c = mix([92, 70, 48], [128, 98, 66], r1);
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2];
  }
  // background
  const bgImg = new ImageData(BW, BH);
  for (let y = 0; y < BH; y++)
    for (let x = 0; x < BW; x++) {
      const t = Math.pow(fbm(x / 10 + 300, y / 10 + 300), 1.6);
      const c = mix(T.bg, T.bg2, Math.min(1, t * 1.3));
      // big, slow blotches of shadow over the pattern, so the back wall has some depth
      const big = fbm(x / 34 + 700, y / 34 + 500);
      const shade = 1 - 0.55 * Math.max(0, Math.min(1, (big - 0.35) / 0.3));
      const j = (hash(x + 900, y + 900) - 0.5) * 4, k = (y * BW + x) * 4;
      bgImg.data[k] = c[0] * shade + j; bgImg.data[k + 1] = c[1] * shade + j; bgImg.data[k + 2] = c[2] * shade + j; bgImg.data[k + 3] = 255;
    }

  const startCX = 14;                                  // far left of the shop room
  const start = { x: startCX * CELL, y: SHOP_FLOOR * CELL - PH };
  const arrival = { x: (startCX + 3) * CELL, y: (SHOP_FLOOR - 13) * CELL };

  // shop stock: the free heal, and the four things you came for. The four sit in one row
  // across the middle of the room so you can read them all without walking the width of
  // it; the heal stays on its own beside the portal you arrive through, where you land.
  const stock = [];
  const offer = [], taken = {};
  // five things for sale if you are carrying Extra Item in Holy Mountain, four otherwise
  const items = have.has('holyitem') ? 5 : 4;
  for (let i = 0; i < items; i++) {
    const id = rollMod(rnd, floor, taken);
    taken[id] = 1;
    offer.push(id);
  }
  const shelf = (SHOP_FLOOR - 13) * CELL;
  const gunShop = isGunShop(floor);
  // the free heal, just along from the portal you arrive through. Far enough along that
  // you are not standing on it the moment you land.
  stock.push({ kind: 'heal', x: arrival.x + 62, y: shelf, price: 0, sold: false });
  const PLINTH_GAP = 64;                 // world units between the ones in the row
  for (let i = 0; i < items; i++) {
    const x = WW / 2 + (i - (items - 1) / 2) * PLINTH_GAP;
    if (gunShop) {
      // shop guns are the floor's own level
      const gun = makeGun(rnd, Math.min(GUN_LV_MAX, floor));
      stock.push({ kind: 'gun', gun, x, y: shelf, price: gunPrice(gun), sold: false });
    } else {
      const id = offer[i];
      stock.push({ kind: 'mod', id, x, y: shelf, price: priceOf(id), sold: false });
    }
  }
  const portal = { x: WW / 2 - 10, y: 34 * CELL - 30, w: 20, h: 30 };

  // enemies in open spaces. Each one is drawn off this floor's roster, so the mix you
  // meet is the floor's own and stays the same run to run.
  const clear = (cx, cy, r) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= CW || y >= CH || mat[y * CW + x]) return false;
      }
    return true;
  };
  const enemies = [];
  const roster = rosterFor(floor, rnd);
  const wanted = Math.min(136, ENEMY_COUNT + (floor - 1) * 12);
  // a creature that only lives in the natural zones (the jellies: the built-up corridors are
  // too tight to swim) and was rolled for a built-up spot keeps its turn for the next spot,
  // so the floor's mix stays the same
  let waiting = null, waits = 0;
  for (let a = 0; a < 20000 && enemies.length < wanted; a++) {
    const cx = 8 + Math.floor(rnd() * (CW - 16)), cy = 50 + Math.floor(rnd() * (SHOP_TOP - 70));
    if (!clear(cx, cy, 8) || nearNest(cx, cy)) continue;
    const x = cx * CELL, y = cy * CELL;
    if (Math.hypot(x - start.x, y - start.y) < 200) continue;
    if (enemies.some(e => Math.hypot(e.x - x, e.y - y) < 90)) continue;
    const k = waiting || enemyFor(roster[Math.floor(rnd() * roster.length)], floor);
    waiting = null;
    if (NATURAL_ONLY[k.act] && built(cx, cy)) { if (++waits < 300) waiting = k; continue; }
    waits = 0;
    enemies.push({ x, y, ty: y, r: k.r, phase: rnd() * 6.28, hp: k.hp, hpMax: k.hp,
      cd: 1 + rnd() * 2, flash: 0, lx: 0, ly: 1, hx: x, hy: y, tgt: null, rest: rnd() * 3,
      k, touch: 0, charge: 0 });
  }
  // the nests, as creatures that never move: in world units, the path room → mouth
  for (const n of nests) {
    const k = enemyFor('pesa', floor), x = n.x * CELL, y = n.y * CELL;
    enemies.push({ x, y, ty: y, r: k.r, phase: 0, hp: k.hp, hpMax: k.hp, cd: 0, flash: 0, lx: 0, ly: 1,
      hx: x, hy: y, tgt: null, rest: 0, k, touch: 0, charge: 0,
      nest: { path: n.path.map(q => ({ x: (q.x + 0.5) * CELL, y: (q.y + 0.5) * CELL })),
        mouth: { x: (n.mouth.x + 0.5) * CELL, y: (n.mouth.y + 0.5) * CELL }, built: n.built,
        t: 0.5 + (n.x % 7) * 0.4, stash: 0, max: 0 } });
  }

  // guns and mods to find: the higher up the cave, the better the roll.
  // Half the mods there used to be, and they have to sit far enough apart that the
  // few of them are spread over the whole cave rather than bunched in one corner.
  const pickups = [];
  // the first floor under a spot, so a pickup sits on the ground rather than hanging in
  // the air wherever an open cell happened to be
  let gunsLeft = GUN_DROPS, modsLeft = MOD_DROPS;
  for (let a = 0; a < 20000 && gunsLeft + modsLeft > 0; a++) {
    const cx = 8 + Math.floor(rnd() * (CW - 16)), cy = 30 + Math.floor(rnd() * (SHOP_TOP - 60));
    if (!clear(cx, cy, 6) || nearNest(cx, cy)) continue;
    // and drop it onto the first floor below, but only as far as the open box it was
    // picked for — further than that and it lands in a crack you cannot stand next to.
    // Nothing to land on inside the box means this spot is no good and another is tried.
    let gy = cy;
    while (gy - cy < 6 && !mat[(gy + 1) * CW + cx]) gy++;
    if (!mat[(gy + 1) * CW + cx]) continue;
    const x = cx * CELL, y = (gy + 1) * CELL - 9;
    if (Math.hypot(x - start.x, y - start.y) < 200) continue;
    if (pickups.some(q => Math.hypot(q.x - x, q.y - y) < PICKUP_GAP)) continue;
    if (gunsLeft && (!modsLeft || rnd() < gunsLeft / (gunsLeft + modsLeft))) {
      gunsLeft--;
      pickups.push({ kind: 'gun', x, y, gun: makeGun(rnd, gunLevel(floor, rnd)), t: rnd() * 6.28 });
    } else {
      modsLeft--;
      pickups.push({ kind: 'mod', x, y, id: rollMod(rnd, floor), t: rnd() * 6.28 });
    }
  }

  // pass 2 and 3: decoration, on its own random stream so the cave above is untouched
  const dimg = new ImageData(CW, CH);
  const fuel = new Uint8Array(CW * CH);                 // what burns, and how (see fireStep)
  if (strata) timberWorks(mat, dimg, works, T, rnd, fuel, built);
  const keep = [{ x: start.x, y: start.y, r: 40 }, { x: arrival.x, y: arrival.y, r: 50 },
    { x: portal.x + portal.w / 2, y: portal.y + portal.h / 2, r: 50 },
    ...rooms.map(r => ({ x: r.x, y: r.y, r: 70 })), ...pickups.map(q => ({ x: q.x, y: q.y, r: 22 })),
    ...nests.map(n => ({ x: n.mouth.x * CELL, y: n.mouth.y * CELL, r: 18 }))];
  const deco = decorate(mat, img, dimg, bgImg, floor, seed, keep, fuel, zone);
  // gold seams, painted over whatever the decoration left on the rock
  const ore = goldVeins(mat, seed, floor);
  for (let i = 0; i < ore.length; i++) {
    if (!ore[i] || mat[i] !== ROCK) { ore[i] = 0; continue; }
    fuel[i] = 0;                                          // a seam painted over moss
    const r1 = hash(i % CW * 5 + 11, ((i / CW) | 0) * 3 + 7), k = i * 4;
    const glint = r1 > 0.9 ? 1.25 : 0.8 + r1 * 0.3;
    d[k] = Math.min(255, 222 * glint); d[k + 1] = Math.min(255, 168 * glint); d[k + 2] = 48 * glint; d[k + 3] = 255;
  }

  // the burrows are real holes, hidden only by the fog (the tunnel bends, so no sightline
  // runs down it): clear any decoration the bakes put in them so they read as open
  for (const n of nests) {
    const R = n.r + 3, clear = (x, y) => {
      const i = y * CW + x;
      if (x < 0 || y < 0 || x >= CW || y >= CH || mat[i]) return;
      dimg.data[i * 4 + 3] = 0; fuel[i] = 0;
    };
    for (let y = n.y - R; y <= n.y + R; y++) for (let x = n.x - R; x <= n.x + R; x++) clear(x, y);
    for (const q of n.path) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) clear(Math.round(q.x) + dx, Math.round(q.y) + dy);
  }

  return { mat, img, bgImg, dimg, ore, fuel, props: deco.props, amb: deco.amb, start, portal, enemies, pickups, stock, shopExit, arrival,
    rooms, roster, theme: T.name, works, zone, nests };
}

// The pure part of this file, for the logic tests: src/pure.js re-exports it (and every
// module), and tests/load.js bundles that. It shrinks as the code moves out into modules
// (REFACTOR.md, P1.5); the browser build ignores it.
export {
  useRef, useEffect, useState, useMemo, h, SPUTTER_FUEL, sputterStep, jetPitch, twinkle,
  jellyPal, makeLevel, NO_INPUT, spiderStep, ratStep, roamStep, turnToward, flyMove, surfNormal,
  SPIDER, spiderSeat, surfSeat, segNear, spiderAim, RAT, ratFooting, ratJump, ratSpread, pathAt,
  pathLen, JELLY, jellyBell, jellyStep, segHitsBox, tentacleTouch, TW_N, TW_TILE, twNoise,
  plantWhite, plantGlowFill, drawGun, drawRunner, flameDrop, drawFlame, glowAt, drawTorch,
  drawSconce, drawDrone, drawSpider, drawRat, drawNest, drawJelly, drawCrawler, drawBlob,
  drawSkull, drawWorm, drawEnemy, fmtGold, deckLayout, DECOR_DENSITY, GROVES, PLANTS, HEAR_FIRE,
  PROP_BOX, PROP_DMG, timberFrame, archCurve, archNear, archAt, decorate, cullDecor,
  propAnchored, rgbA, rgbS, propCol, drawArch, drawProp, propGlow, VENT_H, eyesAlpha,
  SPELL_VOICE, SPELL_VOICES, clampS, shotSound, BODY_VOICE, CREATURE_TONE, CREATURE_VOICES,
  creatureSound, AMB_EVENTS, FX_VOL, fxVolKey, knob, rustleStep, SFX, SAVE_KEY, GUN_DEFAULTS,
  cleanGun, cleanLoadout, readSave, loadSave, clearSave, ROOM_HW, ROOM_HH, strataCave, paveWorks,
  timberWorks, RP_HZ, RP_BEFORE, RP_AFTER, RP_KEEP, RP_W, RP_H, RP_LISTS, RP_NUMS, RP_DEEP,
  RP_LERP, RP_ANGLE, rpPlain, rpClone, rpCopy, rpLerp, rpList, rpAt, rpFrame, rpCut, rpPaste,
  rpMerge
};

function Game({ input }) {
  const cv = useRef(null);
  useEffect(() => {
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
    let seen = fogStart(), deepFog = null;
    // the minimap: an MMW x MMH canvas of white cave outlines, smooth-scaled into the
    // bottom-left of the view. miniEdgeIdx lists the wall-outline cells (static per floor);
    // each frame only the ones the fog has revealed are painted white, the rest cleared.
    const miniC = document.createElement('canvas');
    miniC.width = MMW; miniC.height = MMH;
    const mctx = miniC.getContext('2d');
    const miniImg = new ImageData(MMW, MMH);
    const mini32 = new Uint32Array(miniImg.data.buffer);
    let miniEdgeIdx = [];

    let mat, img, start, portal, enemies, pickups, stock, arrival, total, floor = 1, zone = null;
    const natural = (x, y) => !builtAt(zone, x, y);      // jellies keep to the natural zones
    let ore = null, oreBank = 0;                     // gold seams in the rock, and the loose change
    let levelSeed = 0, levelOwned = [];              // what made this cave, for the autosave
    // sound: the jetpack's roar, each live Black Hole's drone, the low-health heartbeat
    let jetLoop = null, beatT = 0, wasEmpty = false;
    const jetSt = { cut: 0, onT: 0, start: false };   // the jet's cough clock and how long it's been held
    const bhLoops = new Map();
    const plantsNow = new Set(), rustle = { t: 0 };  // the plants you're brushing, and the rustle pause
    let portalLoop = null, matterLoop = null, matterProps = [], wasJet = false, stepT = 0, lastNear = '';
    let plantsLast = new Set();
    let rooms = [];                                  // the perk room and the heart room
    let sconces = [];                                // wall torches: by the portals and the prizes
    let roster = [], themeName = '';                 // this floor's creatures, and its palette

    const p = { x: 0, y: 0, vx: 0, vy: 0, onGround: false, face: 1, jet: 0,
      fuel: 1, empty: false, sput: false, flame: 0, cough: 0, hp: PLAYER_HP, hitT: 0, dead: false, kick: 0,
      shieldReady: true, shieldT: 0,        // Permanent Shield: up, and its recharge clock
      jx: 0, jy: 0, aim: { on: false, show: false, nx: 1, ny: 0 } };
    const bullets = [], enemyShots = [], smoke = [], sparks = [], flashes = [], toasts = [], coins = [];
    const fields = [], beams = [];                   // static projectiles, and instant beam streaks
    const arcs = [];                                 // lightning forks: jagged lines that flash and fade
    const torchP = [];                               // the embers the torch throws off
    // soft magic particles: the Black Hole's trail ('drift'), motes sucked into the exit
    // portal ('in') and motes wafting out of the arrival portal ('out')
    const motes = [];
    let portalAcc = 0;
    // ---- level decoration (see DECOR): the props, the decoration layer, their particles,
    // the theme's ambience, spore clouds and noise rings. zfx is what the props did to you
    // this frame (slowed, slick, holding a vine, gravity flipped), read by next frame's steering.
    let props = [], ambKinds = [], dimg = null;
    let plantW = 255, pgArt = null, pgC = null, pgCtx = null;   // the jellies' plant glow (plantGlow)
    const decoC = document.createElement('canvas');
    decoC.width = CW; decoC.height = CH;
    const dctx = decoC.getContext('2d');
    const dparts = [], amb = [], clouds = [], rings = [], devils = [];
    let decoFrame = 0, viewW = VIEW_W, viewH = VIEW_MIN_H, dripHurt = 0;
    let zfx = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
    // the hand torch's flame lean: a sprung offset dragged opposite to how you move,
    // the same way the jet flame swings, so the fire trails behind you
    let leanX = 0, leanY = 0, leanVX = 0, leanVY = 0, glowN = 0;
    const aimPath = [];                              // scratch buffer for the aim line
    let smokeAcc = 0, time = 0, levelT = 0, camX = 0, camY = 0, camReady = false;
    // the torch: one flicker number drives both the flame and the lamp, so the light
    // in the cave breathes exactly as much as the fire does
    let flick = 1, flickN = 0, torchT = 0, torchAcc = 0, torchR = SIGHT, visPts = [];

    // The torch hand: whichever one the gun is not in, so the two never sit on top of
    // each other. Aiming behind you swaps hands, the same way the gun does.
    const torchHand = () => {
      const a = p.aim.show ? p.aim.nx : p.face;
      return { x: p.x + PW / 2 + (a >= 0 ? -5.5 : 5.5), y: p.y + 9 };
    };
    // ---- perks ----
    // Everything the perks you are carrying add up to, recomputed whenever the run's perk
    // list changes and read all over step() and draw(). Neutral (all multipliers 1, all
    // flags 0) until a perk is found, so a run with no perks behaves exactly as before.
    let pb = perkBag([]);
    const refreshBag = () => { pb = perkBag(input.current.loadout.perks || []); };
    // the true maximum health: the perk bag's answer plus the running +25 per heart room.
    const maxHp = () => pb.maxHp + (input.current.loadout.maxBonus || 0);
    // the ghost companion (Angry Ghost) and the fire trail (Levitation Trail), if owned
    let ghost = null;
    const burns = [];
    // fire (v86, see fireStep): what's alight in the cave, the plants and carts it can take,
    // the burning pixels on view this frame (for the glow after the fog), and its crackle
    let fire = fireNew(new Uint8Array(CW * CH)), firePlants = [], fireArches = [], fireCarts = [], firePropN = -1, firePropLast = null, fireLoop = null, fireN = 0;
    const fireVis = [];
    // the spiders' silk: webs are the lines they travel on (they stay), silk the strings in
    // flight at you, strings the ones stuck to you (each slows you; pull one too long, it snaps)
    const webs = [], silk = [], strings = [];
    // rat burrows (a mask over each nest's room and tunnel), the rock's change count, and the
    // shared way-to-you field the hunting rats follow (see ratSolid / navFor)
    let burrow = null, terrainV = 0;
    const navYou = {};
    let webCheck = 0, webLetGo = 0;
    // how far a point is from a web line (anchor to anchor, as drawn), and where on it is closest
    const webNear = (L, x, y) => {
      const vx = L.b0x - L.a0x, vy = L.b0y - L.a0y, ll = vx * vx + vy * vy || 1;
      const u = Math.max(0, Math.min(1, ((x - L.a0x) * vx + (y - L.a0y) * vy) / ll));
      return { x: L.a0x + vx * u, y: L.a0y + vy * u };
    };
    const webDist = (L, x, y) => { const q = webNear(L, x, y); return Math.hypot(q.x - x, q.y - y); };

    const toast = text => { toasts.push({ text, t: 2.2 }); if (toasts.length > 3) toasts.shift(); };
    let best = 0, raf, last = performance.now();

    // ---- the death replay's recorder (see RP_HZ) ----
    // REC.snaps: what draw() reads round you, RP_HZ a second. Terrain: tBase/dBase are the rock
    // and decoration pixels as of the oldest snapshot, patches the rectangles changed since
    // (caught by wrapping the two canvases' putImageData, which every dig/blast/burn goes
    // through). Fog: fogBase + fogLog (time, cell, value). While you're alive only the last
    // RP_KEEP seconds are kept (older patches fold into the base); from the death it runs
    // RP_AFTER more seconds and stops.
    const RP_ARR = { bullets, enemyShots, smoke, sparks, flashes, coins, fields, beams, arcs, torchP, motes,
      burns, webs, silk, strings, dparts, amb, clouds, rings, devils };
    const rid = new WeakMap();
    let ridN = 0;
    const idOf = o => { let i = rid.get(o); if (i === undefined) rid.set(o, i = ++ridN); return i; };
    const REC = { t: 0, acc: 0, snaps: [], patches: [], dirty: [], fogLog: [], tBase: null, dBase: null,
      fogBase: null, fogPrev: null, deathT: -1, done: false };
    for (const [cx, which] of [[tctx, 't'], [dctx, 'd']]) {
      const put = cx.putImageData.bind(cx);
      cx.putImageData = (im, dx, dy, x, y, w, h) => {
        if (w === undefined) return put(im, dx, dy);
        put(im, dx, dy, x, y, w, h);
        if (REC.tBase && !REC.done) REC.dirty.push([which, x, y, w, h]);
      };
    }
    function recReset() {
      REC.t = 0; REC.acc = 0; REC.snaps = []; REC.patches = []; REC.dirty = []; REC.fogLog = [];
      REC.tBase = img.data.slice(); REC.dBase = dimg ? dimg.data.slice() : null;
      REC.fogBase = seen.slice(); REC.fogPrev = seen.slice();
      REC.deathT = -1; REC.done = false;
      RT.n = 0; RT.at = -1;
      input.current.witness = null;
    }
    function recSample() {
      const pcx = p.x + PW / 2, pcy = p.y + PH / 2;
      const grab = (list, m, ty) => {
        const out = [];
        for (const o of list) {
          const x = o.x !== undefined ? o.x : o.a0x !== undefined ? o.a0x : o.ax;
          const y = ty && o[ty] !== undefined ? o[ty] : o.y !== undefined ? o.y : o.a0y !== undefined ? o.a0y : o.ay;
          if (x === undefined || (Math.abs(x - pcx) < RP_W + m && Math.abs(y - pcy) < RP_H + m)) out.push(rpClone(o, idOf(o)));
        }
        return out;
      };
      const S = { t: REC.t, time, flick, leanX, leanY, glowN, fireN, p: rpClone(p),
        ghost: ghost ? rpClone(ghost) : null };
      for (const k in RP_ARR) S[k] = grab(RP_ARR[k], 40);
      S.enemies = grab(enemies, 40, 'ty'); S.pickups = grab(pickups, 40); S.props = grab(props, 120);
      // the burning pixels in the box, and how much fuel each has left
      const fi = [];
      for (const i of fire.list) {
        const x = (i % CW) * CELL, y = ((i / CW) | 0) * CELL;
        if (Math.abs(x - pcx) < RP_W && Math.abs(y - pcy) < RP_H) fi.push(i);
      }
      S.fire = Int32Array.from(fi);
      S.fireT = Uint16Array.from(fi, i => fire.t[i]);
      REC.snaps.push(S);
      // terrain changed since the last snapshot, as it stands now
      if (REC.dirty.length) {
        for (const [w, x, y, ww, hh] of rpMerge(REC.dirty, CW, CH)) {
          const src = w === 't' ? img : dimg;
          if (src) REC.patches.push({ t: REC.t, c: w, x, y, w: ww, h: hh, px: rpCut(src.data, CW, x, y, ww, hh) });
        }
        REC.dirty.length = 0;
      }
      for (let i = 0; i < seen.length; i++)
        if (seen[i] !== REC.fogPrev[i]) { REC.fogLog.push(REC.t, i, seen[i]); REC.fogPrev[i] = seen[i]; }
      if (REC.deathT >= 0) return;
      // alive: drop what's older than RP_KEEP, folding its terrain and fog into the base
      const cut = REC.t - RP_KEEP;
      let n = 0;
      while (n < REC.snaps.length && REC.snaps[n].t < cut) n++;
      if (n) REC.snaps.splice(0, n);
      n = 0;
      while (n < REC.patches.length && REC.patches[n].t < cut) {
        const P = REC.patches[n++], base = P.c === 't' ? REC.tBase : REC.dBase;
        if (base) rpPaste(base, CW, P);
      }
      if (n) REC.patches.splice(0, n);
      n = 0;
      while (n < REC.fogLog.length && REC.fogLog[n] < cut) { REC.fogBase[REC.fogLog[n + 1]] = REC.fogLog[n + 2]; n += 3; }
      if (n) REC.fogLog.splice(0, n);
    }
    // every stepped frame: keep the clock, snapshot RP_HZ a second, and stop RP_AFTER after a death
    function recFrame(dt) {
      if (REC.done || !REC.tBase) return;
      REC.t += dt;
      if (p.dead && REC.deathT < 0) REC.deathT = REC.t;
      if ((REC.acc -= dt) > 0) return;
      REC.acc = Math.max(0, REC.acc + 1 / RP_HZ);
      recSample();
      if (REC.deathT >= 0 && REC.t >= REC.deathT + RP_AFTER) {
        REC.done = true;
        input.current.witness = { t0: Math.max(REC.snaps[0].t, REC.deathT - RP_BEFORE), t1: REC.t, death: REC.deathT };
        input.current.notify();
      }
    }

    // ---- the replay's player: rebuilds the terrain and fog for time T and draws the recorded
    // scene through draw() itself, swapped in for the live world and swapped back after ----
    let RPV = null;                       // while draw() is drawing a replay frame: the view
    const RT = { tC: null, dC: null, n: 0, at: -1, fog: null, fireT: null };
    function rpTerrain(T) {
      if (!RT.tC) {
        RT.tC = document.createElement('canvas'); RT.tC.width = CW; RT.tC.height = CH;
        RT.dC = document.createElement('canvas'); RT.dC.width = CW; RT.dC.height = CH;
        RT.fireT = new Uint16Array(CW * CH);
      }
      const tc = RT.tC.getContext('2d'), dc = RT.dC.getContext('2d');
      if (RT.at < 0 || (RT.n > 0 && REC.patches[RT.n - 1].t > T)) {     // first look, or scrubbed back
        tc.putImageData(new ImageData(REC.tBase, CW, CH), 0, 0);
        dc.clearRect(0, 0, CW, CH);
        if (REC.dBase) dc.putImageData(new ImageData(REC.dBase, CW, CH), 0, 0);
        RT.n = 0;
      }
      while (RT.n < REC.patches.length && REC.patches[RT.n].t <= T) {
        const P = REC.patches[RT.n++];
        (P.c === 't' ? tc : dc).putImageData(new ImageData(P.px, P.w, P.h), P.x, P.y);
      }
      RT.at = T;
      if (!RT.fog || RT.fog.length !== REC.fogBase.length) RT.fog = new Uint8Array(REC.fogBase.length);
      RT.fog.set(REC.fogBase);
      const L = REC.fogLog;
      for (let n = 0; n < L.length && L[n] <= T; n += 3) RT.fog[L[n + 1]] = L[n + 2];
    }
    function drawReplay(V) {
      const W = input.current.witness;
      V.t = clamp(V.t, W.t0, W.t1);
      const F = rpFrame(REC.snaps, V.t);
      rpTerrain(V.t);
      if (!V.fog) RT.fog.fill(1);          // fog off: everything counts as seen, and no overlay
      if (V.follow) { V.cx = F.p.x + PW / 2; V.cy = F.p.y + PH / 2; }
      const near = F.near;
      for (let k = 0; k < near.fire.length; k++) RT.fireT[near.fire[k]] = near.fireT[k];
      // swap the recording in
      const keepL = {};
      for (const k in RP_ARR) { const L = RP_ARR[k]; keepL[k] = L.splice(0, L.length, ...F[k]); }
      const keep = { enemies, pickups, props, fire, firePlants, seen, ghost, time, flick, leanX, leanY, glowN,
        fireN, camX, camY, unitPx, torchR, visPts, viewW, viewH, p: Object.assign({}, p) };
      enemies = F.enemies; pickups = F.pickups; props = F.props; firePlants = [];
      fire = { list: near.fire, t: RT.fireT }; seen = RT.fog;
      ghost = F.ghost; time = F.time; flick = F.flick; leanX = F.leanX; leanY = F.leanY; glowN = F.glowN; fireN = near.fireN;
      Object.assign(p, F.p);
      RPV = V;
      try { draw(); } finally {
        // and the live world back, exactly as it was
        RPV = null;
        for (const k in RP_ARR) { const L = RP_ARR[k]; L.splice(0, L.length, ...keepL[k]); }
        ({ enemies, pickups, props, fire, firePlants, seen, ghost, time, flick, leanX, leanY, glowN,
          fireN, camX, camY, unitPx, torchR, visPts, viewW, viewH } = keep);
        Object.assign(p, keep.p);
        for (let k = 0; k < near.fire.length; k++) RT.fireT[near.fire[k]] = 0;
      }
    }

    // a floor is a fresh cave with its own shop at the bottom; you keep everything else
    // `back` is a saved cave to rebuild (same seed, same perks owned on the way in), with
    // what was already taken, sold and killed stripped back out of it
    function enterLevel(back) {
      refreshBag();
      levelSeed = back ? back.seed : 1 + Math.floor(Math.random() * 2147483000);
      levelOwned = back ? back.owned : (input.current.loadout.perks || []).slice();
      const level = makeLevel(levelSeed, floor, levelOwned);
      level.enemies.forEach((e, i) => { e.sid = i; });
      if (back) {
        if (back.alive) { const live = new Set(back.alive); level.enemies = level.enemies.filter(e => live.has(e.sid)); }
        back.sold.forEach(i => { if (level.stock[i]) level.stock[i].sold = true; });
        back.rooms.forEach(i => { if (level.rooms && level.rooms[i]) level.rooms[i].taken = true; });
        if (back.pickups) level.pickups = back.pickups;
      }
      mat = level.mat; img = level.img; ore = level.ore || null;
      // minimap outlines for this floor: scan the real terrain in MINI_D x MINI_D blocks;
      // a block is an outline if a wall runs through it (it holds both rock and open), which
      // traces the cave walls continuously at a much finer grain than the fog grid.
      miniEdgeIdx = [];
      for (let my = 0; my < MMH; my++) for (let mx = 0; mx < MMW; mx++) {
        let solid = 0, open = 0;
        for (let dy = 0; dy < MINI_D; dy++) {
          const ty = my * MINI_D + dy;
          if (ty >= CH) break;
          for (let dx = 0; dx < MINI_D; dx++) {
            const tx = mx * MINI_D + dx;
            if (tx >= CW) break;
            if (mat[ty * CW + tx]) solid++; else open++;
          }
        }
        if (solid && open) miniEdgeIdx.push(my * MMW + mx);
      }
      start = level.start; portal = level.portal; arrival = level.arrival;
      enemies = level.enemies; pickups = level.pickups; stock = level.stock;
      rooms = level.rooms || []; zone = level.zone || null;
      props = level.props || []; ambKinds = level.amb || []; dimg = level.dimg;
      plantW = plantWhite(img.data, dimg && dimg.data);    // the jellies' plant glow keys off this
      dctx.putImageData(dimg, 0, 0);
      dparts.length = amb.length = clouds.length = rings.length = devils.length = 0;
      zfx = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
      {
        const pcx0 = portal.x + portal.w / 2, pcy0 = portal.y + portal.h / 2;
        sconces = [[pcx0 - 26, pcy0 - 2], [pcx0 + 26, pcy0 - 2],
          [arrival.x - 26, arrival.y - 2], [arrival.x + 26, arrival.y - 2]];
        for (const r of rooms) sconces.push([r.x - 28, r.y - 2], [r.x + 28, r.y - 2]);
        sconces = sconces.map(([x, y], i) => ({ x, y, ph: i * 1.7 }));
      }
      roster = level.roster; themeName = level.theme;
      SFX.setAmbience(themeName);
      for (const h of bhLoops.values()) h.stop();
      bhLoops.clear();
      total = enemies.length;
      ghost = pb.ghost ? { x: level.start.x, y: level.start.y, cd: 0 } : null;
      burns.length = 0;
      webs.length = silk.length = strings.length = 0;
      // the rat burrows (see ratSolid): each room and tunnel, bar nothing — the hole too
      burrow = null; navYou.F = null;
      if (level.nests && level.nests.length) {
        burrow = new Uint8Array(CW * CH);
        for (const n of level.nests) {
          const mark = (x, y, r) => {
            for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++)
              if (xx >= 0 && yy >= 0 && xx < CW && yy < CH && Math.hypot(xx + 0.5 - x, yy + 0.5 - y) <= r && !mat[yy * CW + xx]) burrow[yy * CW + xx] = 1;
          };
          mark(n.x + 0.5, n.y + 0.5, n.r + 3);
          for (const q of n.path) mark(q.x + 0.5, q.y + 0.5, 2.6);
        }
      }
      fire = fireNew(level.fuel || new Uint8Array(CW * CH));
      firePropN = -1;                         // fireFrame lists the plants and carts that burn
      p.burn = 0; p.burnAcc = 0;
      tctx.putImageData(img, 0, 0);
      bgctx.putImageData(level.bgImg, 0, 0);
      p.x = start.x; p.y = start.y; p.vx = 0; p.vy = 0;
      p.fuel = 1; p.empty = false; p.kick = 0;
      bullets.length = enemyShots.length = smoke.length = 0;
      sparks.length = flashes.length = coins.length = arcs.length = 0;
      torchP.length = 0; motes.length = 0;
      camReady = false; best = 0;
      levelT = 0;                             // the floor's name card gets its three seconds
      seen = fogStart(); deepFog = nestFog(level.nests);
      if (pb.seeAll) seen.fill(2);            // All-Seeing Eye lights the whole floor
      paintFog();                             // otherwise every floor starts dark again
      recReset();                             // the death replay starts afresh each floor
      matterProps = props.filter(pr => pr.k === 'matter');
      // out of the way-in, a moment after the way-out's whump
      setTimeout(() => SFX.fx('portalOut', arrival.x, arrival.y), 260);
    }

    // ---- autosave: the run as it stands, written every couple of seconds and whenever the
    // app is put away, so closing it mid-floor loses almost nothing. A dead run is wiped. ----
    function saveRun() {
      if (p.dead) return;
      const pk = pickups.filter(q => !q.taken && (q.kind === 'mod' || q.kind === 'gun'))
        .map(q => (q.kind === 'mod' ? { kind: 'mod', id: q.id, x: q.x, y: q.y, t: q.t }
          : { kind: 'gun', gun: q.gun, x: q.x, y: q.y, t: q.t, old: !!q.old }));
      const data = { ver: VERSION, floor, hp: p.hp, loadout: input.current.loadout,
        level: { seed: levelSeed, owned: levelOwned, alive: enemies.map(e => e.sid),
          sold: stock.map((it, i) => (it.sold ? i : -1)).filter(i => i >= 0),
          rooms: rooms.map((r, i) => (r.taken ? i : -1)).filter(i => i >= 0),
          pickups: pk } };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) {}
    }

    // Wall torches and lanterns follow the same rule as the loot: they show once the fog
    // over them has lifted (`fogLit`), and never clear it themselves — v59 let them clear
    // a circle round themselves, which lit up every prize room on the map from the start.
    const fogLit = (x, y) => {
      const cx = clamp(Math.floor(x / FOG_U), 0, FW - 1), cy = clamp(Math.floor(y / FOG_U), 0, FH - 1);
      if (deepFog && deepFog[cy * FW + cx]) return seen[cy * FW + cx] > 0;   // a nest room: no soft edge
      // the fog bake's one-cell soft edge counts, so a torch shows exactly when an item there would
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < FW && ny < FH && seen[ny * FW + nx]) return true;
      }
      return false;
    };
    // a prize room counts as found once any of it has been in your line of sight
    const roomSeen = r => {
      for (let y = r.y - ROOM_HH; y <= r.y + ROOM_HH; y += FOG_U)
        for (let x = r.x - ROOM_HW; x <= r.x + ROOM_HW; x += FOG_U) {
          const cx = clamp(Math.floor(x / FOG_U), 0, FW - 1), cy = clamp(Math.floor(y / FOG_U), 0, FH - 1);
          if (seen[cy * FW + cx]) return true;
        }
      return false;
    };
    // Repaint the whole overlay mask from the reveal grid. FW x FH is a few thousand
    // cells, and it only runs on the frames where you actually light something new.
    function paintFog() {
      const d = fogImg.data, dim = Math.round(255 * FOG_DIM), dark = Math.round(255 * FOG_DARK);
      for (let i = 0, k = 0; i < FW * FH; i++, k += 4) {
        d[k] = 9; d[k + 1] = 10; d[k + 2] = 14;
        d[k + 3] = seen[i] === 2 ? 0 : seen[i] ? dim : dark;
      }
    }
    {
      // picking up where the last session left off, if App found a save
      const sv = input.current.saved;
      input.current.saved = null;
      if (sv) {
        floor = sv.floor;
        enterLevel(sv.level);
        if (sv.hp) p.hp = Math.min(sv.hp, maxHp());
      } else enterLevel();
    }
    const saveTick = setInterval(saveRun, 2000);
    const saveHidden = () => { if (document.visibilityState === 'hidden') saveRun(); };
    document.addEventListener('visibilitychange', saveHidden);
    window.addEventListener('pagehide', saveRun);
    input.current.saveRun = saveRun;

    const resize = () => {
      const r = c.parentElement.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(c.parentElement);
    window.addEventListener('resize', resize);

    // ---- mouse ----
    const mouse = input.current.mouse;
    let unitPx = 1;   // css pixels per world unit, set while drawing
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

    // ---- terrain queries ----
    const solidCell = (cx, cy) =>
      cx < 0 || cy < 0 || cx >= CW || cy >= CH || mat[cy * CW + cx] !== 0;
    const solidAt = (x, y) => solidCell(Math.floor(x / CELL), Math.floor(y / CELL));
    const boxHit = (x, y) => {
      const x0 = Math.floor(x / CELL), x1 = Math.floor((x + PW - 0.001) / CELL);
      const y0 = Math.floor(y / CELL), y1 = Math.floor((y + PH - 0.001) / CELL);
      for (let cy = y0; cy <= y1; cy++) {
        if (cy < 0 || cy >= CH) return true;
        for (let cx = x0; cx <= x1; cx++) {
          if (cx < 0 || cx >= CW || mat[cy * CW + cx]) return true;
        }
      }
      return false;
    };
    const lineOfSight = (x0, y0, x1, y1) => losClear(x0, y0, x1, y1, solidCell);
    const enemyAt = (x, y, pad) => {
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (Math.hypot(x - e.x, y - e.ty) < e.r + pad) return j;
      }
      return -1;
    };

    // one drop of goo: falls under its own gravity g, lands and sits a moment on rock
    function goo(x, y, vx, vy, g, c, size, c2) {
      if (sparks.length > 800) return;
      const life = 0.5 + Math.random() * 0.5;
      sparks.push({ x, y, vx, vy, life, max: life, c: Math.random() < 0.35 ? (c2 || '#c8ff8a') : c,
        size: size || 1.1 + Math.random() * 0.8, heavy: 1, g });
    }
    // a poison spit bursting: a little ring of goo thrown out, a bit back the way it came
    function splat(b, x, y) {
      const sp = Math.hypot(b.vx, b.vy) || 1;
      for (let i = 0; i < b.splat; i++) {
        const a = Math.random() * 6.28, v = b.splatV * (0.4 + Math.random() * 0.6);
        goo(x, y, Math.cos(a) * v - b.vx / sp * v * 0.5, Math.sin(a) * v - b.vy / sp * v * 0.5 - v * 0.3,
          b.dripG, b.dripCol || b.col, 1.3 + Math.random(), b.dripCol2);
      }
      SFX.fx('splash', x, y);
    }
    function burst(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, sp = 60 + Math.random() * 160;
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45, max: 0.45, c: color, size: 3 });
      }
    }
    function hurt(n) {
      if (p.dead || n <= 0) return;
      // Permanent Shield soaks a hit whole, then winds back up over a couple of seconds
      if (pb.shield && p.shieldReady) {
        p.shieldReady = false; p.shieldT = 2.5;
        burst(p.x + PW / 2, p.y + PH / 2, 10, '#7ad7ff');
        SFX.ui('shield');
        return;
      }
      p.hp = Math.max(0, p.hp - n);
      p.hitT = 0.3;
      if (p.hp > 0) SFX.ui('hurt');
      if (p.hp === 0) {
        // Extra Life gets you back up once, at full health
        const LO = input.current.loadout;
        if (pb.lives > (LO.usedLives || 0)) {
          LO.usedLives = (LO.usedLives || 0) + 1;
          p.hp = maxHp();
          p.shieldReady = true; p.shieldT = 0;
          burst(p.x + PW / 2, p.y + PH / 2, 24, '#ff5a36');
          SFX.ui('revive');
          toast('Back from the dead');
          input.current.notify();
          return;
        }
        p.dead = true; burst(p.x + PW / 2, p.y + PH / 2, 24, COL.player);
        strings.length = 0;
        SFX.ui('die');
        clearSave();                          // a death is final: reopening starts a new run
      }
    }
    // one pull of an enemy's trigger: aimed at the player, and a shotgun type throws
    // its pellets in a cone. Refuses the shot if the player has broken line of sight
    // since it decided to take it.
    function fireEnemyShot(e, tx, ty) {
      const k = e.k;
      if (!lineOfSight(e.x, e.ty, tx, ty)) return;
      const base = Math.atan2(ty - e.ty, tx - e.x);
      SFX.creature(k, 'fire', e.x, e.ty);
      for (let s = 0; s < k.shots; s++) {
        const cone = k.shots > 1 ? (s - (k.shots - 1) / 2) * 0.15 : 0;
        const a = base + cone + (Math.random() - 0.5) * 0.22;
        enemyShots.push({ x: e.x + Math.cos(a) * (e.r + 4), y: e.ty + Math.sin(a) * (e.r + 4),
          vx: Math.cos(a) * k.bspd, vy: Math.sin(a) * k.bspd, life: 2.5,
          col: k.col.a, dmg: k.dmg, size: k.body === 'blob' ? 4 : 3, fire: k.fire });
      }
    }
    function damageEnemy(j, dmg) {
      const e = enemies[j];
      e.hp -= dmg; e.flash = 0.08;
      if (e.k.kp) e.aggro = true;          // hurt a spider or a jelly and it comes for you
      if (e.hp > 0) { if (dmg >= 0.5) SFX.creature(e.k, 'hurt', e.x, e.ty); return; }
      burst(e.x, e.ty, 16, e.je ? jcol('jeColBody', e.je.u.col) : e.k.col.a);
      SFX.creature(e.k, 'die', e.x, e.ty);
      enemies.splice(j, 1);
      e.dead = true;                        // its rats find out they've no home to go to
      if (e.nest) {
        // a nest: its own gold and everything its rats brought home, in a little shower
        const all = Math.round(kr('raNestGold') * pb.gold) + e.nest.stash;
        const n = Math.max(1, Math.min(14, Math.ceil(all / 8)));
        for (let k = 0; k < n; k++)
          coins.push({ x: e.x + (Math.random() - 0.5) * 8, y: e.y, amount: Math.floor(all / n) + (k < all % n ? 1 : 0),
            t: Math.random() * 6.28, vx: (Math.random() - 0.5) * 100, vy: -80 - Math.random() * 80 });
        SFX.fx('coinland', e.x, e.y);
        return;
      }
      coins.push({ x: e.x, y: e.ty,
        amount: Math.round((e.k.gold + Math.floor(Math.random() * 3)) * pb.gold),
        t: Math.random() * 6.28, vy: -60 - Math.random() * 40 });
      // a rat drops what it was carrying home
      if (e.carry > 0) coins.push({ x: e.x, y: e.ty, amount: e.carry, t: Math.random() * 6.28,
        vx: (Math.random() - 0.5) * 60, vy: -90 - Math.random() * 40 });
    }
    // ---- rats ----
    // A rat's view of the terrain: rock, plus the burrows (so it runs over a hole rather than
    // falling in and wedging in a tunnel it only ever walks as a path). burrow is per floor.
    const ratSolid = (cx, cy) => solidCell(cx, cy) || (burrow !== null && burrow[cy * CW + cx] === 1);
    // a goal's distance field, kept on `o` and made again when the goal moves or the rock changes
    // a spider's web line under a rat's feet counts as ground: rats run along webs
    const onWebIn = list => (x, y) => { for (const L of list) if (webDist(L, x, y) < 3) return true; return false; };
    const ratOnWeb = onWebIn(webs);
    function navFor(o, goal, R) {
      // (the rock changing only counts once a second, or a drill would rebuild them every frame)
      if (!o.F || (o.v !== terrainV && time - o.t > 1) || Math.hypot(goal.x - o.fx, goal.y - o.fy) > (o === navYou ? 12 : 6) ||
          (o === navYou && time - o.t > 0.4) || (o.wn !== webs.length && time - o.t > 1)) {
        // only the web lines that cross the field's square, so a floor of webs costs nothing
        const half = (R + 1) * NAV * CELL, near = webs.filter(L =>
          Math.max(L.a0x, L.b0x) > goal.x - half && Math.min(L.a0x, L.b0x) < goal.x + half &&
          Math.max(L.a0y, L.b0y) > goal.y - half && Math.min(L.a0y, L.b0y) < goal.y + half);
        o.F = navField(ratSolid, goal.x, goal.y, R, near.length ? onWebIn(near) : null);
        o.v = terrainV; o.fx = goal.x; o.fy = goal.y; o.t = time; o.wn = webs.length;
      }
      return o.F;
    }
    // a new rat, down in nest `n`'s room, on its way out up the tunnel
    function spawnRat(n) {
      const k = enemyFor('rotta', floor), P = n.nest.path, m = n.nest.mouth;
      const e = { x: P[0].x, y: P[0].y, ty: P[0].y, r: k.r, phase: Math.random() * 6.28, hp: 1, hpMax: 1,
        cd: 0, flash: 0, lx: 0, ly: 1, hx: m.x, hy: m.y, tgt: null, rest: 0, k, touch: 0, charge: 0,
        home: n, path: P, carry: 0 };
      e.ra = { mode: 'tunnel', vx: 0, vy: 0, nx: 0, ny: -1, on: 0, rest: 0, side: 1, face: 1, s: 0, dir: 1, wait: 0 };
      enemies.push(e);
      return e;
    }
    // a rat that's stuck with a job on: a hop in some direction; the third time, a carrier
    // slips into a crack and goes home underground, anyone else forgets it for a while
    function unstick(e, S, home) {
      e.stN = (e.stN || 0) + 1;
      if (e.stN >= 3 && home) {
        burst(e.x, e.y, 6, '#6a5a48');
        S.mode = 'tunnel'; S.len = pathLen(e.path); S.s = S.len * 0.7; S.dir = -1; S.wait = 0;
        e.stN = 0;
      } else if (e.stN >= 3) { e.giveUp = 4; e.aggro = false; e.stN = 0; }
      else {
        S.mode = 'air'; S.vx = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 80); S.vy = -150 - Math.random() * 120;
        e.x += S.nx * 1.5; e.y += S.ny * 1.5;
      }
    }
    // One rat's frame. What it wants, in order: home, if it has gold in its mouth; any loose
    // gold it can smell; you, if it has noticed you; else its roam spot round the nest.
    // Reaching you it bites, and knocks gold out of you over its head (triple bite if you've
    // none); reaching gold it picks it up; reaching the nest room it drops it off.
    function ratFrame(e, dt, dist, hunting, pcx, pcy) {
      const N = e.home && !e.home.dead ? e.home : null, k = e.k;
      const wake = N ? N.nest.wake || 520 : 520;
      const S = e.ra;
      // far off and not falling: asleep, so a floor full of rats costs nothing
      if (dist > wake * 1.3 && S && S.mode !== 'air') return;
      let goal = null, home = false, fast = false, jump = true, want = null;
      if (e.giveUp > 0) e.giveUp -= dt;
      if (e.carry > 0 && N) { goal = N.nest.mouth; home = true; fast = true; }
      else if (e.giveUp > 0) {
        const R = e.roam || (e.roam = {});
        roamStep(R, e, dt, Math.random, 'ra');
        goal = { x: R.rx, y: R.ry }; jump = false;
      } else {
        let bd = e.smell || (e.smell = kr('raSmell'));
        for (const g of coins) {
          if (g.nopull > 0 && g.vy < 0) continue;            // still on its way up
          const d = Math.hypot(g.x - e.x, g.y - e.y);
          if (d < bd) { bd = d; want = g; }
        }
        if (want) { goal = want; fast = true; }
        else if (hunting) { goal = { x: pcx, y: p.y + PH - 2 }; fast = true; }
        else {
          const R = e.roam || (e.roam = {});
          roamStep(R, e, dt, Math.random, 'ra');
          // keep apart from the other loose rats: the push walks this rat's roam spot away
          // from the crowd, so the pack fans out round the nest
          const D = e.spread || (e.spread = kr('raSpread')), sp = ratSpread(e, enemies.filter(o => o.ra && o.ra.mode !== 'tunnel' &&
            Math.abs(o.x - e.x) < D && Math.abs(o.y - e.y) < D), D);
          R.rx += sp.x * D * 1.5 * dt; R.ry += sp.y * D * 1.5 * dt;
          goal = { x: R.rx + sp.x * D, y: R.ry + sp.y * D }; jump = false;
        }
      }
      if (!e.arrive || Math.random() < dt) e.arrive = kr('raArrive');
      // with a job on, it follows the way there (navField) rather than a straight line
      let way = goal, follow = false, air = false;
      if (fast && S && S.mode !== 'tunnel') {
        const F = home ? navFor(N.nest, goal, 100) : want ? navFor(want, goal, 36) : navFor(navYou, goal, 56);
        const w = F && navWay(F, e.x, e.y, 1);
        if (w) { way = w.dist > 2 ? w : goal; follow = true; air = w.air && w.dist > 2; }
        // v95: getting no nearer along the way for 4s (hopping back and forth over a gap it
        // can't clear) counts as stuck, the same as standing still
        const job = home ? N : want || navYou;
        if (w && (e.jobO !== job || w.dist < e.bestD - 3)) { e.jobO = job; e.bestD = w.dist; e.bestT = 0; }
        else if (w && (e.bestT += dt) > 4) { e.bestT = 0; e.bestD = w.dist; unstick(e, S, home); }
      }
      const cold = e.chill && e.chill < 1 ? e.chill : 1;
      const ev = ratStep(e, { solidCell: ratSolid, rnd: Math.random, goal: way, hunting: fast, home, path: e.path, follow, air, onWeb: ratOnWeb,
        speedMul: cold, arrive: way === goal && !want && hunting ? e.arrive : 3, jump }, dt);
      // stuck (wedged, or running on the spot) with a job on: a hop in some direction
      if (fast && (S.mode === 'surf' || S.mode === 'path')) {
        e.stT = (e.stT || 0) + dt;
        if (e.stT > 1.2) {
          if (Math.hypot(e.x - (e.stX || 0), e.y - (e.stY || 0)) < 6 && Math.hypot(goal.x - e.x, goal.y - e.y) > 14) unstick(e, S, home);
          else if (!(e.bestT > 0)) e.stN = 0;
          e.stT = 0; e.stX = e.x; e.stY = e.y;
        }
      }
      if (ev === 'home') {
        if (N && e.carry > 0) { N.nest.stash += e.carry; SFX.fx('coinland', e.x, e.y); }
        if (N) e.carry = 0;
      } else if (ev === 'jump') SFX.creature(k, 'alert', e.x, e.y);
      if (e.ra.mode === 'tunnel') return;
      // wedged in the rock or pushed off the map somehow: back out of its hole (or gone)
      const inRock = e.x < 0 || e.x >= WW || e.y < 0 || e.y >= WH || ratSolid(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      e.rockT = inRock ? (e.rockT || 0) + dt : 0;
      if (e.rockT > 0.5) {
        e.rockT = 0;
        if (N) { e.ra.mode = 'tunnel'; e.ra.len = pathLen(e.path); e.ra.s = e.ra.len * 0.8; e.ra.dir = 1; e.ra.wait = 0; }
        else { const j = enemies.indexOf(e); if (j >= 0) enemies.splice(j, 1); }
        return;
      }
      // a coin in reach: in its mouth
      if (want && Math.hypot(want.x - e.x, want.y - e.y) < e.r + 5) {
        const i = coins.indexOf(want);
        if (i >= 0) { coins.splice(i, 1); e.carry = (e.carry || 0) + want.amount; SFX.fx('coinland', e.x, e.y); }
      }
      // you, in reach: a bite, and a coin knocked out of you over its head
      if (hunting && !want && !(e.giveUp > 0) && !(e.carry > 0 && N) && dist < e.r + 12 && e.touch <= 0 && !p.dead) {
        const LO = input.current.loadout, broke = !(LO.gold > 0);
        hurt(Math.round(kr('raBite') * (broke ? kr('raBroke') : 1)));
        e.touch = kr('raBiteCd');
        SFX.creature(k, 'bite', e.x, e.y);
        if (!broke) {
          const amt = Math.min(LO.gold, Math.max(1, Math.round(kr('raSteal'))));
          LO.gold -= amt;
          input.current.notify();
          const side = e.x >= pcx ? 1 : -1;
          coins.push({ x: pcx, y: p.y + 4, amount: amt, t: Math.random() * 6.28,
            vx: side * kr('raPopX'), vy: -kr('raPopY'), pop: 1, nopull: 0.7 });
          SFX.ui('coin');
        }
      }
    }

    // clear rock without the bang, for drilling shots
    function dig(x, y, R) {
      const cx0 = x / CELL, cy0 = y / CELL, rc = R / CELL;
      const minX = Math.max(0, Math.floor(cx0 - rc)), maxX = Math.min(CW - 1, Math.ceil(cx0 + rc));
      const minY = Math.max(0, Math.floor(cy0 - rc)), maxY = Math.min(CH - 1, Math.ceil(cy0 + rc));
      const d = img.data;
      let changed = false, nOre = 0;
      for (let cy = minY; cy <= maxY; cy++)
        for (let cx = minX; cx <= maxX; cx++) {
          const i = cy * CW + cx;
          if (!mat[i] || mat[i] === BED) continue;
          if (Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) > rc) continue;
          if (ore && ore[i]) { ore[i] = 0; nOre++; }
          fire.fuel[i] = 0; fire.t[i] = 0;
          mat[i] = 0; d[i * 4 + 3] = 0; changed = true;
        }
      if (burrow) for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++)
        if (burrow[cy * CW + cx] && Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) <= rc) { burrow[cy * CW + cx] = 0; changed = true; }
      if (changed) terrainV++;
      if (changed) tctx.putImageData(img, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
      unDeco(cx0, cy0, rc, minX, minY, maxX, maxY);
      if (nOre) dropOre(x, y, nOre);
    }
    // a gold seam cut or blown open: bits of gold tumble out, as much as the rock you took.
    // Fractions carry over in oreBank, so nibbling a seam with a drill pays the same as a blast.
    function dropOre(x, y, n) {
      oreBank += n * ORE_GOLD * (1 + (floor - 1) * 0.3) * pb.gold;
      let bits = Math.min(12, Math.floor(oreBank / 2));
      if (!bits) return;
      const each = Math.floor(oreBank / bits);
      oreBank -= each * bits;
      for (let k = 0; k < bits; k++)
        coins.push({ x: x + (Math.random() - 0.5) * 6, y, amount: each, t: Math.random() * 6.28,
          vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80 });
      SFX.fx('coinland', x, y);
    }
    // wipe the decoration layer inside a cleared circle, so baked rubble, beams and pillars
    // go with the rock round them
    function unDeco(cx0, cy0, rc, minX, minY, maxX, maxY) {
      const dd = dimg.data;
      let changed = false;
      for (let cy = minY; cy <= maxY; cy++)
        for (let cx = minX; cx <= maxX; cx++) {
          const k = (cy * CW + cx) * 4;
          if (!dd[k + 3] || Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) > rc) continue;
          dd[k + 3] = 0; changed = true;
          fire.fuel[k >> 2] = 0; fire.t[k >> 2] = 0;
        }
      if (changed) dctx.putImageData(dimg, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
    }

    // lay solid brick down, the opposite of dig()
    function paint(x, y, w, hh) {
      const x0 = Math.max(1, Math.round(x / CELL - w / 2)), x1 = Math.min(CW - 2, x0 + w);
      const y0 = Math.max(1, Math.round(y / CELL)), y1 = Math.min(CH - 2, y0 + hh);
      const d = img.data;
      for (let cy = y0; cy < y1; cy++)
        for (let cx = x0; cx < x1; cx++) {
          const i = cy * CW + cx;
          if (mat[i]) continue;
          mat[i] = BRICK;
          const k = i * 4;
          d[k] = 132; d[k + 1] = 99; d[k + 2] = 71; d[k + 3] = 255;
        }
      if (x1 > x0 && y1 > y0) tctx.putImageData(img, 0, 0, x0, y0, x1 - x0, y1 - y0);
    }

    // ---- casting ----
    // Walk the gun's slot list from where it left off. Modifiers pile up and apply
    // to the shots that come after them; running off the end triggers the recharge.
    function cast(g, gx, gy, nx, ny) {
      const pas = gunPassives(g);
      const wrap = () => {
        g.idx = 0;
        g.rechT = g.skipRech ? 0 : effRecharge(g) * pb.rech;   // Faster Wands shortens it
        g.rechLen = g.rechT;
        g.skipRech = false;
        shuffleOrder(g);
      };
      const plan = planCast(g, input.current.loadout.guns);
      if (!plan.shots.length) { wrap(); return; }        // modifiers with nothing to modify
      const cost = pb.mana === 0 ? 0 : plan.cost;        // Unlimited Spells: nothing costs mana
      if (g.mana < cost) { g.idx = plan.start; g.delayT = 0.12; g.delayMax = 0.12; SFX.ui('empty'); return; }
      g.mana -= cost;

      const base = Math.atan2(ny, nx);
      const acts = plan.acts || [];
      let bonus = 0;                                   // damage bought with something else

      if (plan.hp && !p.dead) hurt(plan.hp);
      if (acts.includes('refresh')) { g.skipRech = true; SFX.fx('refresh'); }
      if (acts.includes('manapow')) {
        SFX.fx('drain');
        const spare = Math.max(0, g.mana - 50);
        g.mana -= spare; bonus += spare / 12;
      }
      if (acts.includes('gpower')) {
        const LO2 = input.current.loadout;
        const spend = Math.floor(LO2.gold * 0.05);
        LO2.gold -= spend; bonus += spend / 8;
        if (spend) { input.current.notify(); SFX.fx('gspend'); }
      }
      if (acts.includes('saws')) {
        SFX.fx('saws');
        for (const b of bullets) {
          b.dmg = Math.max(b.dmg, 3); b.size = 5; b.bore = 4; b.col = '#d9dde4';
          b.life = Math.max(b.life, 1.2); b.bounce = Math.max(b.bounce, 4); b.explode = 0;
        }
      }

      // where the shots come into the world. A spot buried in rock would eat the
      // whole cast, so anything that moves the origin backs off to clear ground.
      let ox = gx, oy = gy;
      const clearSpot = (tx, ty) => {
        for (let k = 0; k <= 10; k++) {
          const t = k / 10;
          const cx = tx + (gx - tx) * t, cy = ty + (gy - ty) * t;
          if (!solidAt(cx, cy)) return [cx, cy];
        }
        return [gx, gy];
      };
      if (acts.includes('far')) [ox, oy] = clearSpot(gx + nx * 95, gy + ny * 95);
      if (acts.includes('tele')) {
        let best = null, bd = 420;
        for (const e of enemies) {
          const d = Math.hypot(e.x - gx, e.ty - gy);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) [ox, oy] = clearSpot(best.x - nx * 14, best.ty - ny * 14);
      }
      const warp = acts.includes('warp');
      if (warp || acts.includes('far') || acts.includes('tele')) SFX.fx('warp', ox, oy);

      for (const sh of plan.shots) spawnShot(sh, ox, oy, base, bonus, warp, 30);
      SFX.cast(plan.shots, ox === gx && oy === gy ? null : ox, oy);
      let kick = 0;
      for (const sh of plan.shots) kick += sh.recoil;
      if (kick && !p.dead) {
        kick = Math.min(220, kick * 1.4 * pb.recoil);   // Knockback / Concentrated add kick
        p.vx -= Math.cos(base) * kick;
        p.vy -= Math.sin(base) * kick;
      }
      g.delayT = plan.delay * pb.delay;                 // Concentrated slows, Faster Wands quickens
      g.delayMax = Math.max(g.delayT, 0.001);           // for the cast-delay ring on the stick
      if (plan.wrap) wrap();
    }

    // One planned shot into the world: pellets, spread, auto-aim, beams and all. It is
    // its own function because a trigger's payload comes through here too, from
    // wherever the carrier stopped. `fd` is how far ahead of the origin a static field
    // lands: a barrel's length out of the gun, and nothing at all off a trigger.
    function spawnShot(sh, ox, oy, base, bonus, warp, fd) {
      if (sh.still) { castField(sh, ox + Math.cos(base) * fd, oy + Math.sin(base) * fd, base); return; }
      const n = Math.min(24, Math.max(1, Math.round(sh.count)));
      const off = (sh.ang || 0) * Math.PI / 180;
      // perk touches: Glass/Concentrated damage, Critical/Close-Call chance, Faster
      // Projectiles speed, Bouncing/Homing paths. Close Call only counts if something is
      // right on top of you, so it is worked out once per cast, not once per pellet.
      const pd = pb.dmg;
      let pc = pb.crit;
      if (pb.close && enemies.some(e => Math.hypot(e.x - ox, e.ty - oy) < 56)) pc += 0.4;
      for (let i = 0; i < n; i++) {
        let a = base + off + (Math.random() - 0.5) * sh.spread * pb.spread * Math.PI / 180;
        if (sh.autoaim) {
          let best = null, bd = 320;
          for (const e of enemies) {
            const d = Math.hypot(e.x - ox, e.ty - oy);
            if (d < bd) { bd = d; best = e; }
          }
          if (best) a = Math.atan2(best.ty - oy, best.x - ox);
        }
        if (sh.flat) a = Math.cos(a) >= 0 ? 0 : Math.PI;
        if (sh.beam) { fireBeam(sh, ox, oy, Math.cos(a), Math.sin(a), bonus, pd, pc); continue; }
        const reach = sh.reach != null ? sh.reach : 10;
        let bx = ox + Math.cos(a) * reach, by = oy + Math.sin(a) * reach;
        if (warp) {                                   // jump forward, but not into rock
          for (let step = 0; step < 14; step++) {
            const tx = bx + Math.cos(a) * 10, ty = by + Math.sin(a) * 10;
            if (solidAt(tx, ty)) break;
            bx = tx; by = ty;
          }
        }
        bullets.push({ x: bx, y: by,
          vx: Math.cos(a) * sh.speed * pb.speed * bhSp(sh), vy: Math.sin(a) * sh.speed * pb.speed * bhSp(sh),
          life: sh.life, dmg: (sh.dmg + bonus) * pd, size: sh.size, col: sh.col, spin: 0,
          homing: Math.max(sh.homing, pb.homing), bounce: sh.bounce + pb.bounce, pierce: sh.pierce,
          explode: sh.explode, grav: sh.grav, accel: sh.accel, bore: sh.bore, hit: null,
          knock: sh.knock, crit: sh.crit + pc, boomer: sh.boomer, spiral: sh.spiral,
          pong: sh.pong, orbit: sh.orbit, homeR: sh.homeR, eat: sh.eat, pull: sh.pull,
          split: sh.split, cluster: sh.cluster, bounceFx: sh.bounceFx,
          friendly: sh.friendly, chain: sh.chain, fuse: sh.fuse,
          payload: sh.payload && sh.payload.length ? sh.payload : null, hidden: sh.hidden, arc: sh.arc,
          drift: sh.drift, pop: sh.pop, tele: sh.tele, fire: sh.fire,
          drag: sh.drag, bounceE: sh.bounceE, pit: sh.pit, wig: sh.wig, look: sh.look,
          light: sh.light, lightR: sh.lightR, vmax: sh.vmax, lifeBoom: sh.lifeBoom,
          trig: sh.trig, timer: sh.trig === 'timer' ? sh.timer : null,
          ox: bx, oy: by, age: 0, born: sh.life });
      }
    }

    // A carrier lets go of its payload: 'hit' on the first thing it touches, 'timer'
    // when its timer runs out (or on a hit first), 'expire' when it dies. It fires once;
    // anything in the payload that is itself a carrier takes its own payload along.
    function firePayload(b) {
      const list = b.payload;
      b.payload = null;
      const sp = Math.hypot(b.vx, b.vy);
      const nx = sp ? b.vx / sp : Math.cos(b.ang || 0), ny = sp ? b.vy / sp : Math.sin(b.ang || 0);
      releaseAt(list, b.x, b.y, nx, ny, b.col);
    }
    function releaseAt(list, x, y, nx, ny, col) {
      const x0 = x, y0 = y;
      // it may have stopped inside the rock, so back up along its own track until
      // there is open ground for the payload to come out into
      for (let k = 0; k < 6 && solidAt(x + nx * 10, y + ny * 10); k++) { x -= nx * 4; y -= ny * 4; }
      const base = Math.atan2(ny, nx);
      for (const sh of list) spawnShot(sh, x, y, base, 0, false, 0);
      SFX.cast(list, x0, y0);
      burst(x0, y0, 5, col);
    }

    // Lightning. A zig-zag between points: each leg is split into short kinks knocked
    // sideways, so a straight line reads as a crackling bolt.
    function jag(pts, amp) {
      // thin the path to points ~12 apart first, so a slow bolt's crowded trail still kinks
      const th = [pts[0]];
      for (let k = 1; k < pts.length; k++) {
        const q = th[th.length - 1];
        if (k === pts.length - 1 || Math.hypot(pts[k].x - q.x, pts[k].y - q.y) >= 12) th.push(pts[k]);
      }
      pts = th;
      const out = [pts[0]];
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], c = pts[k], dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1;
        const n = Math.max(1, Math.round(d / 9)), px = -dy / d, py = dx / d;
        for (let s = 1; s < n; s++) {
          const f = s / n, o = (Math.random() - 0.5) * 2 * amp;
          out.push({ x: a.x + dx * f + px * o, y: a.y + dy * f + py * o });
        }
        out.push(c);
      }
      return out;
    }
    function addArc(pts, col, w, max) { arcs.push({ pts: jag(pts, 4), col, w, t: 0, max }); }
    // A lightning bolt remembers its last stretch of path (drawn as the bolt) and every
    // few hundredths of a second throws a fork: at a creature in reach and in sight
    // (a little damage), else at a nearby bit of rock (just the flash).
    function lightningStep(b, dt) {
      const tr = b.trail || (b.trail = [{ x: b.ox, y: b.oy }]);
      tr.push({ x: b.x, y: b.y });
      let len = 0;
      for (let k = tr.length - 1; k > 0; k--) {
        len += Math.hypot(tr[k].x - tr[k - 1].x, tr[k].y - tr[k - 1].y);
        if (len > 110) { tr.splice(0, k - 1); break; }
      }
      if ((b.arcT = (b.arcT || 0) - dt) > 0) return;
      b.arcT = 0.035 + Math.random() * 0.04;
      const R = 90, near = [];
      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (Math.hypot(e.x - b.x, e.ty - b.y) < R && lineOfSight(b.x, b.y, e.x, e.ty)) near.push(j);
      }
      if (near.length && Math.random() < 0.75) {
        const j = near[Math.floor(Math.random() * near.length)], e = enemies[j];
        addArc([{ x: b.x, y: b.y }, { x: e.x, y: e.ty }], b.col, 1, 0.14);
        SFX.arc(e.x, e.ty);
        burst(e.x, e.ty, 3, b.col);
        damageEnemy(j, b.dmg * 0.3);
        return;
      }
      // no creature: try a few random directions for rock close by
      for (let k = 0; k < 4; k++) {
        const a = Math.random() * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        const d = rayDist(b.x, b.y, dx, dy, 70, solidCell);
        if (d < 70 && d > 6) {
          const hx = b.x + dx * d, hy = b.y + dy * d;
          addArc([{ x: b.x, y: b.y }, { x: hx, y: hy }], b.col, 0.8, 0.12);
          SFX.arc(hx, hy);
          burst(hx, hy, 2, b.col);
          return;
        }
      }
    }

    // A beam is instant: it walks a line, damages what it touches and leaves a streak.
    function fireBeam(sh, x, y, nx, ny, bonus, pd, pc) {
      pd = pd || 1; pc = pc || 0;
      let hitAt = sh.beam;
      for (let d = 6; d <= sh.beam; d += 4) {
        const bx = x + nx * d, by = y + ny * d;
        if (sh.bore) dig(bx, by, sh.bore);
        else if (solidAt(bx, by)) { hitAt = d; break; }
        const j = enemyAt(bx, by, sh.size + 3);
        if (j >= 0) {
          damageEnemy(j, critRoll((sh.dmg + bonus) * pd, sh.crit + pc));
          burst(bx, by, 4, sh.col);
          if (sh.knock) shove(enemies[j], nx, ny, sh.knock);
          if (!sh.pierce) { hitAt = d; break; }
        }
      }
      beams.push({ x, y, nx, ny, len: hitAt, col: sh.col, w: sh.size, t: 0, look: sh.look });
      if (sh.look) {                                   // sparks off the end, and a scorched hole where it meets rock
        const ex = x + nx * hitAt, ey = y + ny * hitAt;
        for (let k = 0; k < 5; k++) glowDot(ex, ey, -nx * rnd(20, 80) + rnd(-50, 50), -ny * rnd(20, 80) + rnd(-50, 30),
          k ? sh.col : '#ffffff', rnd(0.8, 1.3), rnd(0.12, 0.3), 0.3);
        if (sh.pit && hitAt < sh.beam) dig(ex + nx * 2, ey + ny * 2, sh.pit);
      }
      if (sh.explode) explode(x + nx * hitAt, y + ny * hitAt, sh.explode);
      // a beam is instant, so whatever kind of carrier it is, the payload goes off at its end
      if (sh.payload && sh.payload.length) releaseAt(sh.payload, x + nx * hitAt, y + ny * hitAt, nx, ny, sh.col);
    }

    // Clusterbolt: the shot bursts into a handful of small explosive bolts
    function spray(b) {
      SFX.fx('cluster', b.x, b.y);
      const n = Math.min(8, b.cluster);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 140 + Math.random() * 120;
        bullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.5 + Math.random() * 0.3, dmg: Math.max(0.6, b.dmg * 0.3), size: 2,
          col: b.col, spin: 0, homing: 0, bounce: 0, pierce: 0, explode: 9,
          grav: 300, accel: 0, bore: 0, hit: null, age: 0 });
      }
      burst(b.x, b.y, 8, b.col);
    }
    // ---- v95 spell looks: what each Noita-style shot sheds as it flies, bounces and dies.
    // Trails are glowing dparts (drawn after the fog, only where it has lifted), chips are
    // sparks, puffs are smoke. `look` is set on the spell in MODS.
    const glowDot = (x, y, vx, vy, c, s, life, g) =>
      dparts.push({ x, y, vx, vy, g: g || 0, c, s, life, max: life, glow: 1 });
    const rnd = (a, b) => a + Math.random() * (b - a);
    function shotTrail(b, dt) {
      const L = b.look, sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
      const chance = n => Math.random() < n * dt;
      if (L === 'spark') {                    // fading pink plasma, a few specks a frame
        if (chance(70)) glowDot(b.x + rnd(-1, 1), b.y + rnd(-1, 1), rnd(-8, 8), rnd(-8, 8),
          Math.random() < 0.3 ? '#ffffff' : Math.random() < 0.6 ? '#ff9cf5' : '#d86ad0', rnd(0.8, 1.5), rnd(0.12, 0.5));
      } else if (L === 'crackle') {           // hot yellow sparks that drop away
        if (chance(22)) glowDot(b.x, b.y, -ux * 40 + rnd(-50, 50), -uy * 40 + rnd(-60, 20),
          Math.random() < 0.5 ? '#fff6c0' : '#ffd23c', rnd(0.7, 1.1), rnd(0.15, 0.35), 0.5);
      } else if (L === 'ember') {             // green flames licking off the pellet
        if (chance(40)) glowDot(b.x + rnd(-1, 1), b.y + rnd(-1, 1), -ux * 20 + rnd(-10, 10), -uy * 20 - rnd(5, 25),
          Math.random() < 0.4 ? '#e6ffc8' : '#8dff5a', rnd(0.7, 1.3), rnd(0.1, 0.25), -0.02);
      } else if (L === 'glob') {              // the odd pink drip
        if (chance(10)) glowDot(b.x, b.y, b.vx * 0.2, b.vy * 0.2, '#f578dc', rnd(0.8, 1.2), rnd(0.3, 0.6), 0.6);
      } else if (L === 'bubble') {            // tiny fizz off the skin
        if (chance(6)) glowDot(b.x + rnd(-3, 3), b.y + rnd(-3, 3), rnd(-6, 6), rnd(-20, -8),
          '#bfe8ff', rnd(0.6, 1), rnd(0.3, 0.6));
      } else if (L === 'arrow') {             // green sparks hanging in the air behind it
        if (chance(35)) glowDot(b.x - ux * 3, b.y - uy * 3, rnd(-6, 6), rnd(-6, 6),
          Math.random() < 0.3 ? '#e8ffd8' : '#78ff50', rnd(0.7, 1.2), rnd(0.5, 1.1), 0.03);
      } else if (L === 'drill') {             // a puff of blue smoke
        if (chance(18)) smoke.push({ x: b.x, y: b.y, vx: rnd(-10, 10), vy: rnd(-12, 4), r: rnd(1.2, 2.2),
          life: 0.5, max: 0.5, c: '#4e7fc8', a: 0.4 });
      } else if (L === 'sparks') {            // it IS its trail: a streak of blue sparks
        const n = Math.min(8, Math.max(1, Math.round(sp * dt / 3)));
        for (let k = 0; k < n; k++) {
          const f = k / n;
          glowDot(b.x - b.vx * dt * f + rnd(-1, 1), b.y - b.vy * dt * f + rnd(-1, 1), rnd(-15, 15), rnd(-15, 15),
            Math.random() < 0.3 ? '#ffffff' : '#8fe8ff', rnd(0.8, 1.4), rnd(0.3, 0.6));
        }
      } else if (L === 'heavy') {             // Magic Bolt: green and yellow sparks spat backward
        if (chance(45)) glowDot(b.x, b.y, -ux * rnd(20, 60) + rnd(-25, 25), -uy * rnd(20, 60) + rnd(-25, 25),
          Math.random() < 0.5 ? '#c8ff5a' : '#ffe84a', rnd(0.8, 1.3), rnd(0.2, 0.45), 0.3);
      } else if (L === 'lance') {             // sparks of its own colour peeling off the shaft
        if (chance(40)) glowDot(b.x - ux * rnd(0, 8), b.y - uy * rnd(0, 8), rnd(-12, 12), rnd(-12, 12),
          Math.random() < 0.3 ? '#ffffff' : b.col, rnd(0.7, 1.1), rnd(0.2, 0.5), 0.05);
      } else if (L === 'rubber') {            // fading green plasma
        if (chance(30)) glowDot(b.x, b.y, rnd(-5, 5), rnd(-5, 5), Math.random() < 0.5 ? '#9ef07a' : '#5ad05a', rnd(0.8, 1.3), rnd(0.2, 0.45));
      } else if (L === 'bomb') {              // the fuse fizzing
        const fx = b.x + Math.cos(b.spin * 0.5 - 1.2) * b.size, fy = b.y + Math.sin(b.spin * 0.5 - 1.2) * b.size;
        if (chance(40)) glowDot(fx, fy, rnd(-30, 30), rnd(-50, 0), Math.random() < 0.4 ? '#ffffff' : '#ffb347', rnd(0.6, 1), rnd(0.1, 0.25), 0.4);
      } else if (L === 'rocket') {            // exhaust: sparks and a rope of grey smoke
        if (chance(50)) glowDot(b.x - ux * 4, b.y - uy * 4, -ux * rnd(30, 90) + rnd(-15, 15), -uy * rnd(30, 90) + rnd(-15, 15),
          FIRE_COLS[Math.floor(Math.random() * 3)], rnd(0.8, 1.3), rnd(0.08, 0.2));
        if (chance(25)) smoke.push({ x: b.x - ux * 5, y: b.y - uy * 5, vx: rnd(-6, 6), vy: rnd(-8, 2), r: rnd(1.2, 2.4),
          life: 0.9, max: 0.9, c: '#5a5652', a: 0.4 });
      } else if (L === 'flame') {             // fire licking up off it, and smoke off the big ones
        const big = b.size >= 4;
        if (chance(big ? 70 : 40)) glowDot(b.x + rnd(-b.size, b.size), b.y + rnd(-b.size, b.size), -ux * 20 + rnd(-15, 15), -uy * 20 - rnd(10, 40),
          FIRE_COLS[Math.floor(Math.random() * 3)], rnd(0.8, 1.2 + b.size * 0.2), rnd(0.12, 0.35), -0.03);
        if (chance(big ? 14 : 5)) smoke.push({ x: b.x, y: b.y, vx: rnd(-6, 6), vy: rnd(-14, -4), r: rnd(1.5, 1 + b.size * 0.6),
          life: 1, max: 1, c: '#3a3430', a: 0.35 });
      } else if (L === 'orb') {               // fading plasma of its colour
        if (chance(35)) glowDot(b.x + rnd(-b.size, b.size) * 0.6, b.y + rnd(-b.size, b.size) * 0.6, rnd(-6, 6), rnd(-6, 6),
          Math.random() < 0.3 ? '#e8f4ff' : b.col, rnd(0.8, 1.4), rnd(0.2, 0.5));
      } else if (L === 'chain') {             // bright violet sparks jumping off it
        if (chance(35)) glowDot(b.x, b.y, rnd(-60, 60), rnd(-60, 60), Math.random() < 0.3 ? '#ffffff' : '#e0a0ff', rnd(0.7, 1.1), rnd(0.08, 0.2));
      } else if (L === 'cross') {             // cyan plasma off its arms
        if (chance(25)) { const a = b.spin * 0.8 + Math.floor(Math.random() * 4) * 1.571;
          glowDot(b.x + Math.cos(a) * b.size * 1.6, b.y + Math.sin(a) * b.size * 1.6, rnd(-6, 6), rnd(-6, 6), b.col, rnd(0.8, 1.2), rnd(0.2, 0.4)); }
      } else if (L === 'nuke') {              // dripping radioactive green, and smoke
        if (chance(20)) glowDot(b.x, b.y + b.size * 0.6, b.vx * 0.1, b.vy * 0.1, Math.random() < 0.5 ? '#b4ff5a' : '#6adf3a', rnd(1, 1.6), rnd(0.5, 0.9), 0.6);
        if (chance(10)) smoke.push({ x: b.x - ux * 6, y: b.y - uy * 6, vx: rnd(-5, 5), vy: rnd(-10, 0), r: rnd(2, 3), life: 1, max: 1, c: '#4a4a40', a: 0.35 });
      } else if (L === 'pollen') {            // yellow dust drifting off it
        if (chance(8)) glowDot(b.x + rnd(-2, 2), b.y + rnd(-2, 2), rnd(-5, 5), rnd(-8, 2),
          '#e8ff9a', rnd(0.6, 0.9), rnd(0.4, 0.8), -0.01);
      }
    }
    function shotBounce(b) {
      const L = b.look;
      if (L === 'glob') for (let k = 0; k < 2; k++)
        glowDot(b.x, b.y, rnd(-40, 40), rnd(-50, -10), '#f578dc', 1, rnd(0.15, 0.3), 0.6);
      else if (L === 'bubble') glowDot(b.x, b.y, 0, 0, '#bfe8ff', 1.4, 0.12);
      else if (L === 'ember') for (let k = 0; k < 3; k++)
        glowDot(b.x, b.y, rnd(-60, 60), rnd(-60, -10), '#8dff5a', 1, rnd(0.1, 0.25), 0.4);
      else if ((L === 'disc' || L === 'flame' || L === 'rubber' || L === 'orb') && Math.hypot(b.vx, b.vy) > 60)
        for (let k = 0; k < (L === 'disc' ? 5 : 2); k++)            // a saw skipping off rock throws sparks
          glowDot(b.x, b.y, rnd(-70, 70), rnd(-80, -10), L === 'disc' ? (Math.random() < 0.5 ? '#ffe7a0' : '#ffb347') : L === 'flame' ? '#ffb347' : b.col,
            rnd(0.7, 1.1), rnd(0.1, 0.25), 0.5);
    }
    function shotDeath(b) {
      const L = b.look;
      if (L === 'bubble') {                   // it pops: a ring of droplets
        SFX.pop(b.x, b.y);
        for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283;
          glowDot(b.x + Math.cos(a) * b.size, b.y + Math.sin(a) * b.size, Math.cos(a) * 45, Math.sin(a) * 45,
            '#bfe8ff', 1, rnd(0.15, 0.3), 0.3); }
      } else if (L === 'spark' || L === 'arrow' || L === 'crackle') {
        const c = L === 'spark' ? '#ff9cf5' : L === 'arrow' ? '#78ff50' : '#ffe066';
        for (let k = 0; k < 5; k++) glowDot(b.x, b.y, rnd(-70, 70), rnd(-70, 40), k ? c : '#ffffff', 1, rnd(0.12, 0.3), 0.3);
      } else if (L === 'glob') {
        for (let k = 0; k < 4; k++) glowDot(b.x, b.y, rnd(-50, 50), rnd(-60, 0), '#f578dc', 1.1, rnd(0.2, 0.4), 0.6);
      } else if (L === 'orb' || L === 'chain' || L === 'rubber' || L === 'heavy') {   // bursts into its own sparks
        for (let k = 0; k < 7; k++) glowDot(b.x, b.y, rnd(-80, 80), rnd(-80, 60), k ? b.col : '#ffffff', rnd(0.8, 1.3), rnd(0.15, 0.35), 0.3);
      }
    }
    // a digging bolt chewing rock: chips of whatever it's chewing thrown back out
    function shotGrind(b, x, y) {
      if (b.look !== 'drill' || Math.random() < 0.5) return;
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      if (cx < 0 || cy < 0 || cx >= CW || cy >= CH || !mat[cy * CW + cx]) return;
      const k = (cy * CW + cx) * 4, d = img.data, sp = Math.hypot(b.vx, b.vy) || 1;
      sparks.push({ x, y, vx: -b.vx / sp * rnd(40, 110) + rnd(-50, 50), vy: -b.vy / sp * rnd(40, 110) - rnd(20, 70),
        life: rnd(0.4, 0.8), max: 0.8, c: 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')', size: rnd(1, 1.8), heavy: true });
    }
    // Brimstone: burning sparks thrown out of the blast, lighting what they land on
    function throwEmbers(x, y, n) {
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 4.2, v = 60 + Math.random() * 150;
        dparts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 0.45,
          c: FIRE_COLS[Math.floor(Math.random() * 3)], s: 1 + Math.random() * 0.8, life: 0.7 + Math.random() * 0.6, max: 1.3,
          glow: 1, ember: 1 });
      }
    }
    // Death Cross: four arms of blast rather than one round crater
    function explodeCross(b) {
      const R = b.explode || 20;
      explode(b.x, b.y, R * 0.6);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        explode(b.x + dx * R * 0.9, b.y + dy * R * 0.9, R * 0.55);
    }

    const critRoll = (dmg, chance) => (chance && Math.random() < chance ? (SFX.fx('crit'), dmg * 3) : dmg);
    const shove = (e, nx, ny, force) => {
      e.x += nx * force * 0.03; e.y += ny * force * 0.03; e.tgt = null;
    };

    // Static projectiles: they sit where you cast them and work over time.
    function castField(sh, x, y, ang) {
      const pay = sh.payload && sh.payload.length ? sh.payload : null;
      if (sh.field === 'explode') {
        explode(x, y, sh.r, undefined, sh.fire);
        if (sh.embers) throwEmbers(x, y, sh.embers);
        if (pay) releaseAt(pay, x, y, Math.cos(ang || 0), Math.sin(ang || 0), sh.col);
        return;
      }
      fields.push({ x, y, r: sh.r, field: sh.field, life: sh.life, max: sh.life,
        col: sh.col, dmg: sh.dmg || 1, tick: 0, payload: pay, ang: ang || 0, trig: sh.trig });
    }
    // Teleport Bolt: put you where the bolt stopped. It may have stopped against rock, so
    // back up along its own track (and nudge up/down) until your whole body fits; if
    // nowhere near fits, it fizzles and you stay put.
    function teleportTo(b) {
      if (p.dead) return;
      const sp = Math.hypot(b.vx, b.vy), nx = sp ? b.vx / sp : 0, ny = sp ? b.vy / sp : 0;
      for (let back = 0; back <= 40; back += 3)
        for (const dy of [0, -4, 4, -8, 8, -12, 12, -16, 16]) {
          const x = b.x - nx * back - PW / 2, y = b.y - ny * back - PH / 2 + dy;
          if (x < CELL * 3 || y < CELL * 3 || x + PW > WW - CELL * 3 || y + PH > WH - CELL * 3) continue;
          if (boxHit(x, y)) continue;
          burst(p.x + PW / 2, p.y + PH / 2, 10, b.col);
          p.x = x; p.y = y; p.vx = 0; p.vy = 0;
          burst(p.x + PW / 2, p.y + PH / 2, 12, b.col);
          SFX.fx('warp', p.x + PW / 2, p.y + PH / 2);
          return;
        }
      burst(b.x, b.y, 4, b.col);
      SFX.fx('fizzle', b.x, b.y);
    }
    // a crystal "with Trigger" casts what it carries when it goes off
    const fieldPayload = f => {
      if (!f.payload) return;
      const list = f.payload; f.payload = null;
      releaseAt(list, f.x, f.y, Math.cos(f.ang), Math.sin(f.ang), f.col);
    };

    // ---- fire (v86): the cave's fire runs in fireStep; this is what it does to the level ----
    // A pixel whose fuel is spent: grass and timber go (a fleck of ash now and then stays),
    // moss leaves the rock under it scorched. Changed areas are put back once a frame.
    const fireBox = { t: [CW, CH, -1, -1], d: [CW, CH, -1, -1] };
    const growBox = (b, x, y) => { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; };
    function fireOut(i) {
      const x = i % CW, y = (i / CW) | 0, k = i * 4, r = Math.random();
      if (mat[i]) {
        const d = img.data;
        d[k] = 34 + r * 16; d[k + 1] = 28 + r * 12; d[k + 2] = 24 + r * 10;
        growBox(fireBox.t, x, y);
      } else if (dimg) {
        const dd = dimg.data;
        if (r < 0.16) { const a = 30 + r * 120; dd[k] = a; dd[k + 1] = a * 0.9; dd[k + 2] = a * 0.85; }
        else dd[k + 3] = 0;
        growBox(fireBox.d, x, y);
      }
    }
    function flushFire() {
      for (const [b, c, im] of [[fireBox.t, tctx, img], [fireBox.d, dctx, dimg]]) {
        if (b[2] < b[0] || !im) continue;
        c.putImageData(im, 0, 0, b[0], b[1], b[2] - b[0] + 1, b[3] - b[1] + 1);
        b[0] = CW; b[1] = CH; b[2] = -1; b[3] = -1;
      }
    }
    // a plant catches: it burns up from its tip toward the rock it hangs from
    function catchPlant(pr) {
      if (pr.burn || pr.gone) return;
      pr.burn = 1;
      SFX.fx('whoosh', pr.x, pr.y + pr.len);
    }
    // an arched vine catches at fraction u along it; the fire runs out both ways from there
    function catchArch(pr, u) {
      if (pr.burn || pr.gone) return;
      pr.burn = 1; pr.u0 = pr.u1 = u;
      const q = archAt(pr, u);
      SFX.fx('whoosh', q.x, q.y);
    }
    // a web line catches: it flares along its length and is gone
    function burnWeb(w) {
      const L = webs[w];
      for (let u = 0; u <= 1; u += 0.1)
        dparts.push({ x: L.a0x + (L.b0x - L.a0x) * u, y: L.a0y + (L.b0y - L.a0y) * u, vx: (Math.random() - 0.5) * 20,
          vy: -20 - Math.random() * 30, g: -0.02, c: Math.random() < 0.5 ? '#ffd35a' : '#ff8a2a', s: 1.4, life: 0.4, max: 0.4, glow: 1 });
      webs.splice(w, 1);
      SFX.fx('whoosh', (L.a0x + L.b0x) / 2, (L.a0y + L.b0y) / 2);
    }
    // everything that burns within r of (x, y) catches at `chance`: grass, moss and timber
    // pixels, plants, web lines — and a minecart goes up
    function ignite(x, y, r, chance) {
      fireList();
      const n = fireArea(fire, x, y, r, chance);
      for (const pr of firePlants)
        if (!pr.gone && !pr.burn && x > pr.x - 5 - r && x < pr.x + 5 + r && y > pr.y - r && y < pr.y + pr.len + r &&
          Math.random() < chance) catchPlant(pr);
      for (let w = webs.length - 1; w >= 0; w--) if (webDist(webs[w], x, y) < r + 2 && Math.random() < chance) burnWeb(w);
      for (const pr of fireArches) {
        if (pr.gone || pr.burn || x < pr.x + pr.l - r || x > pr.x + pr.r + r || y < pr.y + pr.t0 - r || y > pr.y + pr.b + r) continue;
        const q = archNear(pr, x, y);
        if (q.d < r + 3 && Math.random() < chance) catchArch(pr, q.k / (pr.arc.length - 1));
      }
      for (const pr of fireCarts)
        if (!pr.gone && x > pr.x + pr.l - r && x < pr.x + pr.r + r && y > pr.y + pr.t0 - r && y < pr.y + pr.b + r &&
          Math.random() < chance) blowProp(pr);
      if (n > 4) SFX.fx('whoosh', x, y);
      return n;
    }
    function setAlight(e) {
      if (!(e.burn > 0)) SFX.fx('whoosh', e.x, e.ty);
      e.burn = Math.max(e.burn || 0, kr('fireBurn'));
    }
    function youAlight() {
      if (p.dead) return;
      if (!(p.burn > 0)) { SFX.fx('whoosh', p.x + PW / 2, p.y + PH / 2); strings.length = 0; }   // spider silk burns off
      p.burn = Math.max(p.burn || 0, kr('fireYou'));
    }
    // a blast's heat: fuel round it catches, and creatures (and you) in it may go up
    function fireBlast(x, y, R, hot) {
      const ch = hot ? 0.9 : kr('fireBoom');
      ignite(x, y, R * 1.3, ch);
      for (const e of enemies) if (Math.hypot(e.x - x, e.ty - y) < R + e.r && Math.random() < ch) setAlight(e);
      if (!p.dead && Math.hypot(p.x + PW / 2 - x, p.y + PH / 2 - y) < R + 6 && Math.random() < ch * 0.5) youAlight();
    }
    // a flame licking up off a burning spot
    const flameAt = (x, y, sp) => dparts.push({ x, y, vx: (Math.random() - 0.5) * 16, vy: -30 - Math.random() * (sp || 40),
      g: -0.03, c: Math.random() < 0.4 ? '#ffd35a' : Math.random() < 0.6 ? '#ff8a2a' : '#e8461c', s: 1 + Math.random() * 1.2,
      life: 0.25 + Math.random() * 0.3, max: 0.55, glow: 1 });
    const fireSmoke = (x, y) => smoke.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: -25 - Math.random() * 20,
      r: 2 + Math.random() * 2.5, life: 1.4, max: 1.4, c: '#2a2624', a: 0.35 });
    // One frame of fire: the cave's fire moves on, plants, webs and carts catch off it,
    // burning creatures (and you) take damage and spread it, flames and smoke come off
    // what's on view, and the crackle sits at the nearest blaze.
    // the props that burn, relisted whenever props came or went (a test room, a drop)
    function fireList() {
      if (props.length === firePropN && props[props.length - 1] === firePropLast) return;
      firePropN = props.length; firePropLast = props[props.length - 1];
      firePlants = props.filter(pr => pr.k === 'climb' && FLAMMABLE[pr.st] && !pr.arc);
      fireArches = props.filter(pr => pr.arc && FLAMMABLE[pr.st]);
      fireCarts = props.filter(pr => pr.k === 'barrel');
    }
    function fireFrame(dt, pcx, pcy) {
      fireList();
      const ticks = fireStep(fire, dt, fireOut);
      fireN += ticks;
      const L = fire.list, any = L.length > 0;
      if (ticks && any) {
        for (let k = fireN & 3; k < firePlants.length; k += 4) {       // a quarter of the plants a tick
          const pr = firePlants[k];
          if (pr.gone || pr.burn) continue;
          for (let yy = pr.y + 2; yy < pr.y + pr.len; yy += 8) if (fireNear(fire, pr.x, yy, 2)) { catchPlant(pr); break; }
        }
        for (const pr of fireArches) {
          if (pr.gone || pr.burn) continue;
          const n = pr.arc.length - 1;
          for (let k = 0; k <= n; k += 2) { const q = archAt(pr, k / n); if (fireNear(fire, q.x, q.y, 2)) { catchArch(pr, k / n); break; } }
        }
        for (let w = webs.length - 1; w >= 0; w--) {
          const W = webs[w];
          for (let u = 0; u <= 1; u += 0.25)
            if (fireNear(fire, W.a0x + (W.b0x - W.a0x) * u, W.a0y + (W.b0y - W.a0y) * u, 2)) { burnWeb(w); break; }
        }
        for (const pr of fireCarts) if (!pr.gone && fireNear(fire, pr.x, pr.y - 4, 8)) blowProp(pr);
      }
      // burning plants: the fire climbs from the tip to the rock, lighting what's round it
      for (const pr of firePlants) {
        if (!pr.burn || pr.gone) continue;
        pr.len -= kr('firePlant') * dt; pr.b = Math.max(0, pr.len);
        const ty = pr.y + Math.max(0, pr.len);
        if (Math.random() < dt * 30) flameAt(pr.x + (Math.random() - 0.5) * 4, ty);
        if (Math.random() < dt * 4) fireSmoke(pr.x, ty);
        if (ticks) {
          fireArea(fire, pr.x, ty, 5, 0.3);
          for (const o of firePlants)
            if (!o.burn && !o.gone && Math.abs(o.x - pr.x) < 10 && ty > o.y - 4 && ty < o.y + o.len + 4 && Math.random() < 0.25) catchPlant(o);
          if (!p.dead && zfx.climb === pr) youAlight();
        }
        if (pr.len < 4) { pr.gone = true; fireArea(fire, pr.x, pr.y, 6, 1); }
      }
      // burning arched vines: the fire runs both ways along it from where it caught, lighting
      // the strands as it reaches them, and the vine is gone when it meets both ends
      for (const pr of fireArches) {
        if (!pr.burn || pr.gone) continue;
        const du = kr('fireArch') * dt / Math.max(1, pr.alen);
        pr.u0 = Math.max(0, pr.u0 - du); pr.u1 = Math.min(1, pr.u1 + du);
        for (const u of [pr.u0, pr.u1]) {
          const q = archAt(pr, u);
          if (Math.random() < dt * 30) flameAt(q.x + (Math.random() - 0.5) * 4, q.y);
          if (Math.random() < dt * 4) fireSmoke(q.x, q.y);
          if (ticks) fireArea(fire, q.x, q.y, 5, 0.3);
        }
        if (ticks) {
          for (const o of firePlants) if (o.on === pr && !o.burn && !o.gone && o.u >= pr.u0 && o.u <= pr.u1) catchPlant(o);
          if (!p.dead && zfx.climb === pr) youAlight();
        }
        if (pr.u0 <= 0 && pr.u1 >= 1) pr.gone = true;
      }
      // burning creatures: hurt in chunks (so they flash, not flicker), spread it where they go
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (ticks && any && !(e.burn > 0) && fireNear(fire, e.x, e.ty, e.r * 0.7)) setAlight(e);
        if (!(e.burn > 0)) continue;
        e.burn -= dt;
        e.burnAcc = (e.burnAcc || 0) + kr('fireDps') * dt;
        if (Math.random() < dt * 40) flameAt(e.x + (Math.random() - 0.5) * e.r * 1.4, e.ty + (Math.random() - 0.3) * e.r);
        if (Math.random() < dt * 6) fireSmoke(e.x, e.ty - e.r);
        if (ticks) ignite(e.x, e.ty + e.r * 0.4, e.r * 0.8, 0.35);
        if (!p.dead && Math.hypot(e.x - pcx, e.ty - pcy) < e.r + 8 && Math.random() < dt * 2) youAlight();
        if (e.burnAcc >= 0.5 || e.burn <= 0) { const d = e.burnAcc; e.burnAcc = 0; if (d > 0 && enemies[j] === e) damageEnemy(j, d); }
      }
      // you: fire underfoot or round you lights you; water, snow or slime puts you out
      if (!p.dead) {
        if (ticks && any && !(p.burn > 0) && (fireNear(fire, pcx, p.y + PH - 3, 3) || fireNear(fire, pcx, pcy, 3))) youAlight();
        if (p.burn > 0 && FIRE_WET[zfx.surface]) { p.burn = 0; p.burnAcc = 0; SFX.fx('sizzle', pcx, p.y + PH); }
        if (p.burn > 0) {
          p.burn -= dt;
          p.burnAcc = (p.burnAcc || 0) + kr('fireYouDps') * dt;
          if (Math.random() < dt * 40) flameAt(p.x + Math.random() * PW, p.y + PH * (0.2 + Math.random() * 0.8));
          if (Math.random() < dt * 6) fireSmoke(pcx, p.y);
          if (ticks) fireArea(fire, pcx, p.y + PH - 2, 5, 0.3);
          if (p.burnAcc >= 2 || p.burn <= 0) { const d = Math.round(p.burnAcc); p.burnAcc -= d; if (d > 0) hurt(d); }
        }
      } else p.burn = 0;
      // flames and smoke off the burning pixels you can see, and the crackle at the nearest blaze
      if (any) {
        const x0 = camX / CELL - 4, x1 = (camX + viewW) / CELL + 4, y0 = camY / CELL - 4, y1 = (camY + viewH) / CELL + 4;
        const want = Math.min(20, Math.ceil(L.length * dt * 2.5));
        for (let a = 0, got = 0; a < want * 3 && got < want && dparts.length < 700; a++) {
          const i = L[(Math.random() * L.length) | 0], x = i % CW, y = (i / CW) | 0;
          if (x < x0 || x > x1 || y < y0 || y > y1) continue;
          got++;
          flameAt((x + Math.random()) * CELL, y * CELL);
          if (Math.random() < 0.12) fireSmoke(x * CELL, y * CELL - 3);
        }
        const st = Math.max(1, Math.floor(L.length / 300));
        let bd = HEAR_FIRE, bx = 0, by = 0, near = 0;
        for (let k = 0; k < L.length; k += st) {
          const x = (L[k] % CW) * CELL, y = ((L[k] / CW) | 0) * CELL, d = Math.hypot(x - pcx, y - pcy);
          if (d < 220) near += st;
          if (d < bd) { bd = d; bx = x; by = y; }
        }
        if (bd < HEAR_FIRE) {
          if (!fireLoop && SFX.ready) fireLoop = SFX.loop('fire');
          if (fireLoop) fireLoop.set(Math.min(1, 0.35 + near / 300) * 0.7, bx, by);
        }
      }
      flushFire();
    }
    // `splash` set = a small pop (Pollen): enemies take that instead, and it never hurts you.
    // Any other blast can set things alight (fireBoom); `hot` (fire spells, minecarts) nearly always does.
    function explode(x, y, R, splash, hot) {
      SFX.boom(x, y, R);
      const cx0 = x / CELL, cy0 = y / CELL, rc = R / CELL, ring = rc + 2.5;
      const minX = Math.max(0, Math.floor(cx0 - ring)), maxX = Math.min(CW - 1, Math.ceil(cx0 + ring));
      const minY = Math.max(0, Math.floor(cy0 - ring)), maxY = Math.min(CH - 1, Math.ceil(cy0 + ring));
      const d = img.data;
      let debris = 0, nOre = 0;
      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          const i = cy * CW + cx, m = mat[i];
          if (!m) continue;
          const dist = Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0);
          const k = i * 4;
          if (dist <= rc && m !== BED) {
            if (debris < 40 && Math.random() < 0.08) {
              debris++;
              const f = 0.5 + Math.random();
              sparks.push({ x: cx * CELL, y: cy * CELL,
                vx: (cx - cx0) / rc * 220 * f, vy: ((cy - cy0) / rc * 220 - 140) * f,
                life: 0.8 + Math.random() * 0.4, max: 1.2, c: `rgb(${d[k]},${d[k + 1]},${d[k + 2]})`, size: 2, heavy: true });
            }
            if (ore && ore[i]) { ore[i] = 0; nOre++; }
            fire.fuel[i] = 0; fire.t[i] = 0;
            mat[i] = 0;
            d[k + 3] = 0;
          } else if (dist <= ring) {
            d[k] *= 0.72; d[k + 1] *= 0.72; d[k + 2] *= 0.72;   // scorch the crater edge
          }
        }
      }
      tctx.putImageData(img, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
      unDeco(cx0, cy0, rc, minX, minY, maxX, maxY);
      if (nOre) dropOre(x, y, nOre);
      if (burrow) for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++)
        if (Math.hypot(cx + 0.5 - cx0, cy + 0.5 - cy0) <= rc) burrow[cy * CW + cx] = 0;
      terrainV++;
      // a blast knocks the props about: carts and pods go off, pillars crack, icicles let go
      for (const pr of props) {
        if (pr.gone || Math.abs(pr.x - x) > R + 40 || Math.abs(pr.y - y) > R + 40) continue;
        const bx = clamp(x, pr.x + pr.l, pr.x + pr.r), by = clamp(y, pr.y + pr.t0, pr.y + pr.b);
        if (Math.hypot(bx - x, by - y) < R + 6) pr.hurt = (pr.hurt || 0) + 2;
      }

      flashes.push({ x, y, r: R, t: 0 });
      for (let i = 0; i < (splash != null ? 2 : 10); i++) {
        smoke.push({ x: x + (Math.random() - 0.5) * R, y: y + (Math.random() - 0.5) * R,
          vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40 - 20,
          r: 4 + Math.random() * 5, life: 1.2, max: 1.2 });
      }
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j], dist = Math.hypot(e.x - x, e.ty - y);
        if (dist < R + e.r) damageEnemy(j, splash != null ? splash : dist < R * 0.5 ? 3 : 2);
      }
      if (splash != null) return;
      fireBlast(x, y, R, hot);
      const pcx = p.x + PW / 2, pcy = p.y + PH / 2;
      const dist = Math.hypot(pcx - x, pcy - y), reach = R + 10;
      if (dist < reach && !p.dead) {
        const f = 1 - dist / reach;
        hurt(Math.round(25 * f));
        const nx = (pcx - x) / (dist || 1), ny = (pcy - y) / (dist || 1);
        p.vx += nx * 500 * f;
        p.vy += ny * 500 * f - 150 * f;
        p.kick = 0.25;
      }
    }

    // ---- decoration, pass 3: the props at work ----
    const pOver = (pr, pad) => p.x + PW > pr.x + pr.l - pad && p.x < pr.x + pr.r + pad &&
      p.y + PH > pr.y + pr.t0 - pad && p.y < pr.y + pr.b + pad;
    // a loud noise: every creature within earshot comes looking, and shooters get ready
    function alertAt(x, y) {
      rings.push({ x, y, t: 0 });
      for (const e of enemies) {
        if (Math.hypot(e.x - x, e.ty - y) > 320) continue;
        if (HUNTERS[e.k.act]) e.aggro = true;
        else e.cd = Math.min(e.cd, 0.3);
      }
    }
    // what a breakable prop is made of, for the sound it breaks with
    const MATERIAL = { icicle: 'ice', geode: 'crystal', salt: 'salt', bone: 'bone', obsidian: 'glass', shard: 'glass' };
    function shatter(pr, n) {
      SFX.fx('shatter', pr.x, pr.y + (pr.t0 + pr.b) / 2, MATERIAL[pr.st] || 'stone');
      burst(pr.x, pr.y + (pr.t0 + pr.b) / 2, n || 10, propCol(pr, themeFor(floor)));
      pr.gone = true;
    }
    function blowProp(pr) {
      if (pr.gone) return;
      pr.gone = true;                          // first, so a chain of blasts can't loop
      if (pr.k === 'barrel') { explode(pr.x, pr.y - 6, 105, undefined, 1); SFX.debris(pr.x, pr.y - 6); }
      else if (pr.k === 'pod') {
        SFX.pop(pr.x, pr.y - 6);
        clouds.push({ x: pr.x, y: pr.y - 8, r: 34, life: 4.5, max: 4.5, tick: 0 });
        burst(pr.x, pr.y - 6, 14, '#b6e36a');
      }
    }
    // a lantern shot (or dropped, or blasted): the glass goes and its burning oil is thrown
    // out in blobs that light whatever burnable they fall through or land on
    function popLamp(pr) {
      if (pr.gone) return;
      pr.gone = true;
      let x = pr.x, y = pr.y;
      if (pr.st === 'hanglamp') y += pr.len + 4.5; else x -= pr.side * 5;
      SFX.fx('shatter', x, y, 'glass');
      SFX.fx('whoosh', x, y);
      burst(x, y, 6, '#fff2c0');
      for (let k = 0; k < 16; k++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 3.4, v = 50 + Math.random() * 120;
        dparts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 0.45,
          c: FIRE_COLS[Math.floor(Math.random() * 3)], s: 1.2 + Math.random() * 0.9, life: 1.2 + Math.random() * 0.8, max: 2,
          glow: 1, ember: 1 });
      }
      ignite(x, y, 6, 0.8);
    }
    // a prop whose rock has gone hits the ground: it breaks, blows, or settles there
    function landProp(pr) {
      pr.fall = false; pr.vy = 0;
      if (pr.k === 'barrel' || pr.k === 'pod') { blowProp(pr); return; }
      if (pr.k === 'lamp' && pr.st !== 'cap') { popLamp(pr); return; }
      const stands = !pr.hang && !pr.side && (pr.k === 'cover' || pr.k === 'pad' || pr.k === 'noise' ||
        pr.k === 'spike' || pr.k === 'lamp' || pr.k === 'tendril' || pr.k === 'vent');
      if (!stands) { shatter(pr); return; }
      SFX.fx('propLand', pr.x, pr.y);
      const cy = Math.floor((pr.y + pr.b + 1) / CELL);
      pr.y = cy * CELL - pr.b;
      pr.anc = [Math.floor(pr.x / CELL), cy];
    }
    function spawnDrip(pr) {
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
    const DRIP_RATE = { water: 0.7, lava: 1.1, soot: 6, crystal: 3, cascade: 45, steam: 10 };

    function decorStep(dt, pcx, pcy) {
      decoFrame++;
      plantsNow.clear();
      const z = { slow: 1, slick: 0, climb: null, rev: 0, web: null, webs: 0, webMul: 1 };
      // the runtime anchor check, staggered: a thirtieth of the props each frame, so each one
      // finds out within half a second that the rock it hung off has been blown away
      for (let i = decoFrame % 30; i < props.length; i += 30) {
        const pr = props[i];
        if (!pr.gone && !pr.fall && (pr.anc || pr.on) && !propAnchored(pr, mat)) { pr.fall = true; pr.vy = 0; pr.anc = null; pr.on = null; }
      }
      for (let i = props.length - 1; i >= 0; i--) {
        const pr = props[i];
        if (pr.gone) { props.splice(i, 1); continue; }
        if (pr.fall) {                           // physics hand-off: it drops
          pr.vy = Math.min(pr.vy + GRAVITY * 0.8 * dt, 700);
          pr.y += pr.vy * dt;
          if (pr.y > WH) { pr.gone = true; continue; }
          if (pr.vy > 120 && (pr.k === 'drop' || pr.k === 'spike' || pr.k === 'cover' || pr.k === 'noise')) {
            if (!p.dead && pOver(pr, 0)) { hurt(PROP_DMG.drop); shatter(pr, 14); continue; }
            for (let j = enemies.length - 1; j >= 0; j--) {
              const e = enemies[j];
              if (Math.abs(e.x - pr.x) < e.r + 4 && Math.abs(e.ty - (pr.y + pr.b)) < e.r + 4) { damageEnemy(j, 4); shatter(pr, 14); break; }
            }
            if (pr.gone) continue;
          }
          if (solidAt(pr.x, pr.y + pr.b + 1)) landProp(pr);
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
          for (const b of bullets) {
            if (b.life <= 0 || b.x + b.size < x0 || b.x - b.size > x1 || b.y + b.size < y0 || b.y - b.size > y1) continue;
            if (b.pull || b.eat || b.bore) {          // rolls on through, but only counts once
              const seen = b.propHit || (b.propHit = new Set());
              if (!seen.has(pr)) { seen.add(pr); pr.hurt = (pr.hurt || 0) + 1; }
            } else { pr.hurt = (pr.hurt || 0) + 1; burst(b.x, b.y, 3, b.col); b.life = 0; b.struck = 1; }
          }
          if (tough) for (let k = enemyShots.length - 1; k >= 0; k--) {
            const es = enemyShots[k];
            if (es.x > x0 && es.x < x1 && es.y > y0 && es.y < y1) { burst(es.x, es.y, 3, es.col); SFX.fx('coverHit', es.x, es.y); enemyShots.splice(k, 1); }
          }
        }
        if (pr.hurt) {
          const n = pr.hurt; pr.hurt = 0;
          if (pr.k === 'barrel' || pr.k === 'pod') { blowProp(pr); continue; }
          if (pr.k === 'lamp') { popLamp(pr); continue; }
          if (pr.k === 'noise' && pr.st === 'stone') { alertAt(pr.x, pr.y); pr.ring = 1; SFX.fx('resonate', pr.x, pr.y); }
          if (pr.k === 'spike' && pr.st === 'salt') { shatter(pr, 10); continue; }
          if (pr.k === 'drop') { pr.fall = true; pr.vy = 0; pr.anc = null; continue; }
          if (pr.k === 'cover' && pr.hp > 0) {
            pr.hp -= n; pr.hitT = 0.15;
            SFX.fx('coverHit', pr.x, pr.y + (pr.t0 + pr.b) / 2);
            if (pr.hp <= 0) { shatter(pr, 22); continue; }
          }
        }
        if (pr.ring > 0) pr.ring -= dt;
        const me = !p.dead;
        switch (pr.k) {
          case 'climb':
            if (pr.arc) {                          // an arched vine: latch on like a web line
              if (!me || !pOver(pr, 0)) break;
              const R = pr.grab || (pr.grab = kr('arGrab'));
              const d = archNear(pr, pcx, p.y + WEB_HAND).d, d2 = archNear(pr, pcx, pcy).d;
              if (Math.min(d, d2) < R + 3) plantsNow.add(pr);
              if (d <= R && (!z.arch || d < z.archD)) { z.arch = pr; z.archD = d; }
              break;
            }
            if (me && pOver(pr, 0)) z.climb = pr;
            if (me && PLANTS[pr.st] && pOver(pr, 1)) plantsNow.add(pr);
            break;
          case 'drip':
            if (pr.st === 'sparks') {
              pr.t -= dt;
              if (pr.t <= 0) {
                pr.t = 1.2 + Math.random() * 2.6;
                SFX.fx('sparks', pr.x, pr.y);
                for (let k = 0; k < 10; k++) dparts.push({ x: pr.x, y: pr.y + 4, vx: (Math.random() - 0.5) * 170,
                  vy: -20 + Math.random() * 90, g: 0.5, c: Math.random() < 0.5 ? '#ffe27a' : '#fff6c8', s: 1.2, life: 0.5, max: 0.5, glow: 1 });
              }
            } else {
              // each drip keeps its own random clock, so they never fall in step
              const rate = DRIP_RATE[pr.st];
              if (pr.dn == null) { pr.di = (0.3 + Math.random() * 1.4) / rate; pr.dn = Math.random() * pr.di; }
              pr.dn -= dt;
              if (pr.st === 'steam' && (pr.hs = (pr.hs || Math.random() * 3) - dt) <= 0) { pr.hs = 1.5 + Math.random() * 3; SFX.fx('steam', pr.x, pr.y); }
              while (pr.dn <= 0) { pr.di = (0.3 + Math.random() * 1.4) / rate; pr.dn += pr.di; dparts.push(spawnDrip(pr)); }
              pr.acc = 1 - pr.dn / pr.di;                // how far the next drop has swelled (the sprite reads it)
            }
            break;
          case 'drop':                             // an icicle lets go when you walk under it
            if (pr.st === 'icicle' && !pr.shake && me && Math.abs(pcx - pr.x) < 18 && pcy > pr.y &&
                pcy - pr.y < 170 && lineOfSight(pr.x, pr.y + 18, pcx, pcy)) { pr.shake = 0.35; SFX.fx('iceCreak', pr.x, pr.y); }
            if (pr.shake > 0 && (pr.shake -= dt) <= 0) { pr.fall = true; pr.vy = 0; pr.anc = null; }
            break;
          case 'spike':
            if (me && pOver(pr, -1) && pr.cd <= 0) {
              hurt(pr.st === 'salt' ? 4 : PROP_DMG.spike); pr.cd = 0.7;
              p.vy = pr.hang ? 160 : -280; burst(pcx, pr.hang ? p.y : p.y + PH, 5, '#ff5a5a');
            }
            break;
          case 'vent': {
            pr.t += dt;
            const ph = pr.t % 3.6, wasOn = pr.on, wasWarn = pr.warn;
            pr.on = ph > 2.6; pr.warn = ph > 1.9 && !pr.on;
            if (pr.warn && !wasWarn) SFX.fx('ventWarn', pr.x, pr.y);
            if (pr.on && !wasOn) SFX.fx('ventFire', pr.x, pr.y - 20);
            if (pr.warn && Math.random() < dt * 14) smoke.push({ x: pr.x, y: pr.y - 2, vx: (Math.random() - 0.5) * 10,
              vy: -30, r: 2 + Math.random() * 2, life: 0.8, max: 0.8 });
            if (pr.on) {
              if (Math.random() < dt * 40) dparts.push({ x: pr.x + (Math.random() - 0.5) * 6, y: pr.y - 4, vx: (Math.random() - 0.5) * 20,
                vy: -140 - Math.random() * 80, g: 0, c: Math.random() < 0.5 ? '#ffb050' : '#ff7a2a', s: 1.6, life: 0.4, max: 0.4, glow: 1 });
              if (me && pr.cd <= 0 && p.x + PW > pr.x - 6 && p.x < pr.x + 6 && p.y < pr.y && p.y + PH > pr.y - VENT_H) { hurt(PROP_DMG.vent); youAlight(); pr.cd = 0.4; }
              if ((pr.ecd = (pr.ecd || 0) - dt) <= 0) {
                pr.ecd = 0.4;
                for (let yy = 4; yy < VENT_H; yy += 12) ignite(pr.x, pr.y - yy, 6, 0.5);   // and it lights what hangs over it
                for (let j = enemies.length - 1; j >= 0; j--) {
                  const e = enemies[j];
                  if (Math.abs(e.x - pr.x) < e.r + 6 && e.ty < pr.y && e.ty > pr.y - VENT_H) { setAlight(e); damageEnemy(j, 1); }
                }
              }
            }
            break;
          }
          case 'pad':                               // a bouncy mushroom throws you up
            if (pr.sq > 0) pr.sq -= dt;
            if (me && p.vy >= 0 && Math.abs(pcx - pr.x) < 11 && p.y + PH > pr.y - 12 && p.y + PH < pr.y + 2) {
              p.vy = -680; p.onGround = false; pr.sq = 0.3;
              SFX.fx('shroom', pr.x, pr.y);
              burst(pr.x, pr.y - 8, 5, propCol(pr, themeFor(floor)));
            }
            break;
          case 'zone': {
            const on = me && p.onGround && p.x + PW > pr.x + pr.l && p.x < pr.x + pr.r && Math.abs(p.y + PH - pr.y) < 5;
            const st = pr.st, moving = Math.abs(p.vx) > 30;
            if (st === 'slime') for (const e of enemies)
              if (e.x > pr.x + pr.l && e.x < pr.x + pr.r && e.ty > pr.y - 30 && e.ty < pr.y) e.chill = 0.45;
            if (!on) { pr.stand = 0; break; }
            z.surface = st;
            if (st === 'ice') z.slick = 1;
            else if (st === 'snow') z.slow = Math.min(z.slow, 0.55);
            else if (st === 'slime') z.slow = Math.min(z.slow, 0.45);
            else if (st === 'puddle') {
              z.slow = Math.min(z.slow, 0.7);
              if (moving && Math.random() < dt * 20) dparts.push({ x: pcx, y: pr.y - 2, vx: (Math.random() - 0.5) * 60,
                vy: -60 - Math.random() * 60, g: 0.9, c: 'rgba(150,200,255,0.8)', s: 1.3, life: 0.6, max: 0.6 });
            } else if (st === 'acid') { if (pr.cd <= 0) { hurt(3); pr.cd = 0.5; } }
            else if (st === 'glass') {
              if (Math.abs(p.vx) > 80 && pr.cd <= 0) { hurt(2); pr.cd = 0.35; burst(pcx, pr.y - 1, 3, '#d8f4ff'); }
            } else if (st === 'log') {
              pr.stand = (pr.stand || 0) + dt;
              if (pr.stand > 0.8 && pr.cd <= 0) { hurt(3); pr.cd = 0.5; }
            } else if (st === 'ash' && moving && Math.random() < dt * 30) {
              smoke.push({ x: pcx + (Math.random() - 0.5) * 8, y: pr.y - 2, vx: -p.vx * 0.2 + (Math.random() - 0.5) * 20,
                vy: -15 - Math.random() * 20, r: 1.5 + Math.random() * 2, life: 0.9, max: 0.9 });
            }
            break;
          }
          case 'noise':                              // skulls crunch underfoot
            if (pr.st === 'skulls' && me && pr.cd <= 0 && pOver(pr, 0)) {
              alertAt(pr.x, pr.y); pr.cd = 3; burst(pr.x, pr.y - 4, 6, '#e6dcc4');
              SFX.fx('skulls', pr.x, pr.y);
            }
            break;
          case 'eyes':                               // eyes in the dark whisper as you first come near
            if (me && !pr.heard && Math.hypot(pcx - pr.x, pcy - pr.y) < 170) { pr.heard = 1; SFX.fx('eyes', pr.x, pr.y); }
            break;
          case 'matter': {                           // gravity turns over near it
            const by = pr.y + Math.sin(time * 1.3 + pr.seed * 9) * 3, dd = Math.hypot(pcx - pr.x, pcy - by);
            if (me && dd < 48) z.rev = Math.max(z.rev, 1 - dd / 48);
            if (me && dd < 12 && pr.cd <= 0) { hurt(PROP_DMG.matter); pr.cd = 0.5; }
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
                hurt(PROP_DMG.tendril); pr.cd = 0.8; p.vx += Math.cos(pr.aimA) * 220; p.kick = 0.15;
              }
            }
            break;
          }
        }
      }
      // spore clouds from burst pods
      for (let i = clouds.length - 1; i >= 0; i--) {
        const cl = clouds[i];
        cl.life -= dt; cl.tick -= dt;
        if (cl.tick <= 0) {
          cl.tick = 0.4;
          if (!p.dead && Math.hypot(pcx - cl.x, pcy - cl.y) < cl.r) hurt(PROP_DMG.cloud);
          for (let j = enemies.length - 1; j >= 0; j--)
            if (Math.hypot(enemies[j].x - cl.x, enemies[j].ty - cl.y) < cl.r + enemies[j].r) damageEnemy(j, 1);
        }
        if (cl.life <= 0) clouds.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].t += dt) > 0.9) rings.splice(i, 1);
      // drips, sparks, steam and splashes
      dripHurt -= dt;
      for (let i = dparts.length - 1; i >= 0; i--) {
        const q = dparts[i];
        q.life -= dt;
        q.vy += GRAVITY * q.g * dt;
        if (q.wob != null) q.vx = Math.sin(time * 2 + q.wob) * 6;
        if (q.grow) q.s += dt * 3;
        q.x += q.vx * dt; q.y += q.vy * dt;
        let dead = q.life <= 0;
        // burning oil from a lantern: lights what it passes through, and where it lands
        if (q.ember) {
          const ex = Math.floor(q.x / CELL), ey = Math.floor(q.y / CELL);
          if (ex >= 0 && ey >= 0 && ex < CW && ey < CH && fire.fuel[ey * CW + ex]) ignite(q.x, q.y, 2, 0.6);
          if (!p.dead && q.x > p.x && q.x < p.x + PW && q.y > p.y && q.y < p.y + PH) { youAlight(); dead = true; }
          if (!dead && solidAt(q.x, q.y)) ignite(q.x - q.vx * dt, q.y - q.vy * dt, 4, 0.85);
        }
        if (!dead && solidAt(q.x, q.y)) {
          dead = true;
          if (q.snd) SFX.fx(q.snd, q.x, q.y);
          if (q.splash) for (let k = 0; k < 2; k++) dparts.push({ x: q.x, y: q.y - 2, vx: (Math.random() - 0.5) * 50,
            vy: -30 - Math.random() * 40, g: 0.8, c: q.c, s: 1, life: 0.35, max: 0.35, glow: q.glow });
        }
        if (!dead && q.dmg && !p.dead && q.x > p.x && q.x < p.x + PW && q.y > p.y && q.y < p.y + PH) {
          if (dripHurt <= 0) { hurt(q.dmg); dripHurt = 0.4; }
          dead = true;
        }
        if (dead) dparts.splice(i, 1);
      }
      if (dparts.length > 700) dparts.splice(0, dparts.length - 700);
      stepAmbience(dt);
      // foliage: grabbing a vine, or pushing into a plant you weren't already in, rustles;
      // an arched vine in reach beats the strands hanging off it (let go with a push down, and
      // a strand under you catches you instead)
      if (webLetGo > 0) z.arch = null;
      if (z.arch) z.climb = z.arch;
      // moving through them rustles now and then; rustleStep keeps a big clump from spamming
      let entered = !!(z.climb && PLANTS[z.climb.st] && z.climb !== zfx.climb), style = null;
      for (const pr of plantsNow) if (!plantsLast.has(pr)) { entered = true; style = pr.st; }
      const str = rustleStep(rustle, dt, plantsNow.size > 0, entered, Math.hypot(p.vx, p.vy));
      if (str) {
        const pr = style ? null : plantsNow.values().next().value;
        SFX.rustle(pcx, pcy, str, style || (pr && pr.st) || 'vine');
      }
      plantsLast = new Set(plantsNow);
      // spider web lines: each one you're touching slows you, and like a vine you latch on
      // to the nearest (unless you've just let go of one)
      if (!p.dead) {
        let wd = Infinity;
        for (const L of webs) {
          const R = L.grab || (L.grab = spr('webGrab'));
          if (pcx < Math.min(L.a0x, L.b0x) - R || pcx > Math.max(L.a0x, L.b0x) + R ||
              pcy < Math.min(L.a0y, L.b0y) - R - PH / 2 || pcy > Math.max(L.a0y, L.b0y) + R + PH / 2) continue;
          const d = webDist(L, pcx, p.y + WEB_HAND);
          const d2 = webDist(L, pcx, pcy);
          if (Math.min(d, d2) > R) continue;
          z.webs++;
          z.webMul *= L.slow || (L.slow = spr('webSlow'));
          if (d <= R && d < wd) { wd = d; z.web = L; }
        }
        if (webLetGo > 0) z.web = null;
        if (z.web && !z.climb) z.climb = z.web;
        else if (z.climb !== z.web) z.web = null;
      }
      zfx = z;
    }

    // ---- the theme's ambience, pooled round the camera rather than tied to a spot ----
    const AMB_RATE = { spores: 5, frost: 3, embers: 8, motes: 4, ashfall: 55 };
    const AMB_MAX = { spores: 40, frost: 20, embers: 60, motes: 50, ashfall: 280 };
    // one of the Luminescent Spores that drift about the green floors. The jellies puff the
    // very same thing out of their rims (puffSpores), so it is made in one place
    const spore = (x, y, r) => ({ kind: 'spores', x, y, vx: (r - 0.5) * 8, vy: 0, wob: r * 9, life: 5 + r * 3, max: 8,
      c: rgbA(themeFor(floor).moss[1]), s: 1.3, glow: 1 });
    // a jelly's pulse blows a puff of spores out of its rim, back the way it pushes; drag
    // (kx, ky fading at kd) settles them, then they drift like any other spore
    function puffSpores(e) {
      if (e.x < camX - 150 || e.x > camX + viewW + 150 || e.y < camY - 150 || e.y > camY + viewH + 150) return;
      const S = e.je, B = jellyBell(e.r, S.shape, kru('jeSquash', S.u.sq));
      const c = Math.cos(S.hd), sn = Math.sin(S.hd), n = Math.round(kr('jeSpores'));
      for (let i = 0; i < n && amb.length < 500; i++) {
        const lx = (Math.random() * 2 - 1) * B.rw * 0.7;
        const q = spore(e.x - lx * sn - B.rim * c, e.y + lx * c - B.rim * sn, Math.random());
        const a = S.hd + Math.PI + (Math.random() * 2 - 1) * kr('jeSporeSpread') * Math.PI / 180, v = kr('jeSporeSpd');
        q.kx = Math.cos(a) * v; q.ky = Math.sin(a) * v; q.kd = kr('jeSporeDrag');
        amb.push(q);
      }
    }
    // The jellyfish's plant glow in the game (the comp is plantGlowFill): the art round a
    // jelly — the rock with its baked moss over the decoration layer, and the hanging plants
    // drawn over both at terrain resolution and read back — keyed, ramped, twinkled and
    // added on top in its colour. Only on ground you've seen.
    const pgGlow = document.createElement('canvas'), pgGlowCtx = pgGlow.getContext('2d');
    const seenAt = (x, y) => seen[clamp(Math.floor(y / FOG_U), 0, FH - 1) * FW + clamp(Math.floor(x / FOG_U), 0, FW - 1)] !== 0;
    function plantGlow(e, TH) {
      const u = e.je.u, reach = kru('jeGlowR', u.glowR) * kru('jePlantReach', u.plant);
      const strength = kru('jePlantGlow', u.plant);
      if (reach < 2 || strength <= 0) return;
      const bx0 = clamp(Math.floor((e.x - reach) / CELL), 0, CW - 1), by0 = clamp(Math.floor((e.y - reach) / CELL), 0, CH - 1);
      const bx1 = clamp(Math.ceil((e.x + reach) / CELL), 1, CW), by1 = clamp(Math.ceil((e.y + reach) / CELL), 1, CH);
      const w = bx1 - bx0, h = by1 - by0;
      if (w <= 0 || h <= 0) return;
      if (!pgArt || pgArt.length < w * h * 4) pgArt = new Uint8ClampedArray(w * h * 4);
      const x0w = bx0 * CELL, y0w = by0 * CELL, x1w = bx1 * CELL, y1w = by1 * CELL;
      // the hanging plants in reach, drawn at terrain resolution and read back
      let pd = null;
      const plants = props.filter(pr => pr.k === 'climb' && PLANTS[pr.st] &&
        pr.x + pr.r > x0w && pr.x + pr.l < x1w && pr.y + pr.b > y0w && pr.y + pr.t0 < y1w);
      if (plants.length) {
        if (!pgC) { pgC = document.createElement('canvas'); pgCtx = pgC.getContext('2d', { willReadFrequently: true }); }
        if (pgC.width < w || pgC.height < h) { pgC.width = Math.max(pgC.width, w); pgC.height = Math.max(pgC.height, h); }
        pgCtx.setTransform(1, 0, 0, 1, 0, 0); pgCtx.clearRect(0, 0, w, h);
        pgCtx.setTransform(1 / CELL, 0, 0, 1 / CELL, -bx0, -by0);
        for (const pr of plants) drawProp(pgCtx, pr, time, TH);
        pd = pgCtx.getImageData(0, 0, w, h).data;
      }
      // compose the art: rock over the decoration layer, the plants over both
      const T = img.data, D = dimg ? dimg.data : null, A = pgArt;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const si = ((by0 + y) * CW + bx0 + x) * 4, o = (y * w + x) * 4;
        let r = 0, g = 0, b = 0, a = 0;
        if (T[si + 3]) { r = T[si]; g = T[si + 1]; b = T[si + 2]; a = 255; }
        else if (D && D[si + 3]) { r = D[si]; g = D[si + 1]; b = D[si + 2]; a = D[si + 3]; }
        if (pd && pd[o + 3]) {
          const pa = pd[o + 3] / 255;
          if (a) { r += (pd[o] - r) * pa; g += (pd[o + 1] - g) * pa; b += (pd[o + 2] - b) * pa; a = Math.max(a, pd[o + 3]); }
          else { r = pd[o]; g = pd[o + 1]; b = pd[o + 2]; a = pd[o + 3]; }
        }
        A[o] = r; A[o + 1] = g; A[o + 2] = b; A[o + 3] = a;
      }
      const out = new ImageData(w, h);
      if (!plantGlowFill(out.data, A, w, h, { ox: x0w, oy: y0w, px: CELL, cx: e.x, cy: e.y, reach, white: plantW,
        top: kru('jePlantTop', u.plant) / 100, strength, t: time * kru('jePlantTwinkle', u.plant),
        size: kru('jePlantSize', u.plant), rgb: hexArr(jcol('jeColGlow', u.col)), lit: seenAt })) return;
      if (pgGlow.width < w || pgGlow.height < h) { pgGlow.width = Math.max(pgGlow.width, w); pgGlow.height = Math.max(pgGlow.height, h); }
      pgGlowCtx.putImageData(out, 0, 0);
      const sm = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(pgGlow, 0, 0, w, h, x0w, y0w, w * CELL, h * CELL);
      ctx.imageSmoothingEnabled = sm;
    }
    function stepAmbience(dt) {
      const x0 = camX - 30, y0 = camY - 30, w = viewW + 60, h = viewH + 60;
      const T = themeFor(floor);
      for (const kind of ambKinds) {
        if (kind === 'devils') {
          if (devils.length < 2 && Math.random() < dt * 0.4) {
            let x = x0 + Math.random() * w, y = y0 + Math.random() * h, k = 0;
            while (k++ < 120 && !solidAt(x, y + 1)) y += 2;
            if (k < 120 && !solidAt(x, y - 30)) devils.push({ x, y, vx: (Math.random() < 0.5 ? -1 : 1) * (15 + Math.random() * 20), life: 6 + Math.random() * 3, max: 9 });
          }
          continue;
        }
        const n = amb.reduce((a, q) => a + (q.kind === kind), 0);
        let want = AMB_RATE[kind] * dt;
        while (want > 0 && n < AMB_MAX[kind]) {
          if (Math.random() >= want) break;
          want -= 1;
          const x = x0 + Math.random() * w, y = y0 + Math.random() * h;
          if (solidAt(x, y)) continue;
          const r = Math.random();
          if (kind === 'spores') amb.push(spore(x, y, r));
          else if (kind === 'frost') {
            const dir = floor % 2 ? 1 : -1;
            amb.push({ kind, x, y, vx: dir * (100 + r * 60), vy: (r - 0.5) * 10, life: 0.9 + r * 0.5, max: 1.4, c: 'rgba(215,238,255,0.5)', s: 1, streak: 10 });
          } else if (kind === 'embers') amb.push({ kind, x, y, vx: 0, vy: -20 - r * 30, wob: r * 9, life: 3 + r * 2, max: 5, c: r < 0.5 ? '#ffb050' : '#ff7a2a', s: 1.2, glow: 1 });
          else if (kind === 'motes') amb.push({ kind, x, y, vx: (r - 0.5) * 6, vy: (Math.random() - 0.5) * 4, wob: r * 9, life: 6 + r * 3, max: 9, c: 'rgba(235,225,200,0.8)', s: 1 });
          else if (kind === 'ashfall') amb.push({ kind, x, y, vx: 8, vy: 20 + r * 22, wob: r * 9, life: 4 + r * 3, max: 7, c: 'rgba(150,146,142,0.75)', s: 1 + r });
        }
      }
      for (let i = amb.length - 1; i >= 0; i--) {
        const q = amb[i];
        q.life -= dt;
        if (q.wob != null) q.x += Math.sin(time * 1.3 + q.wob) * 6 * dt;
        if (q.kx || q.ky) {                             // a puff's kick, dying away under drag
          q.x += q.kx * dt; q.y += q.ky * dt;
          const k = Math.exp(-q.kd * dt); q.kx *= k; q.ky *= k;
        }
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.life <= 0 || solidAt(q.x, q.y) || q.x < x0 - 200 || q.x > x0 + w + 200 || q.y < y0 - 200 || q.y > y0 + h + 200) amb.splice(i, 1);
      }
      for (let i = devils.length - 1; i >= 0; i--) {
        const dv = devils[i];
        dv.life -= dt;
        const nx = dv.x + dv.vx * dt;
        if (solidAt(nx + Math.sign(dv.vx) * 6, dv.y - 4)) dv.vx = -dv.vx; else dv.x = nx;
        if (!solidAt(dv.x, dv.y + 2)) dv.y += 40 * dt;
        else if (solidAt(dv.x, dv.y)) dv.y -= 2;
        if (dv.life <= 0) devils.splice(i, 1);
      }
    }

    function step(dt) {
      time += dt;
      levelT += dt;
      // a toast raised while the game was paused (picking a mod up, say) waits here,
      // because nothing runs on a paused frame
      if (input.current.pendingToast) { toast(input.current.pendingToast); input.current.pendingToast = null; }
      input.current.floor = floor;
      if (input.current.newCave) {                // Dev → New cave: this floor again, freshly rolled
        input.current.newCave = false;
        enterLevel();
        toast('New cave');
        return;
      }
      if (input.current.spawnGun) {               // Dev → Spawn gun: drop one just in front of you
        const gun = caveGun(input.current.spawnGun, Math.random);
        input.current.spawnGun = 0;
        pickups.push({ kind: 'gun', x: p.x + PW / 2 + p.face * 22, y: p.y + PH - 9, gun, t: 0 });
        toast('Spawned ' + gun.name);
      }
      const LO = input.current.loadout;
      // perks: keep the current maximum health honest, wind the shield back up, and never
      // let a shrunken cap (Glass Cannon) leave the bar reading over full
      const MHP = maxHp();
      if (p.hp > MHP) p.hp = MHP;
      if (pb.shield && !p.shieldReady) { p.shieldT -= dt; if (p.shieldT <= 0) { p.shieldReady = true; SFX.fx('shieldUp'); } }
      // movement: thumbstick first, otherwise keyboard (full strength)
      let L = input.current.left;
      if (!L.active) {
        const keys = input.current.keys;
        const kx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
        if (kx || keys.w) {
          const ny = keys.w ? -1 : 0, len = Math.hypot(kx, ny);
          L = { active: true, nx: kx / len, ny: ny / len, mag: 1, dy: keys.w ? -1 : 1, on: true };
        }
      }
      if (p.dead) L = NO_INPUT;
      p.jx = L.nx; p.jy = L.ny;

      // ---- jetpack and fuel ----
      const raw = L.active ? L.mag : 0;
      const mag = raw > DEAD ? (raw - DEAD) / (1 - DEAD) : 0;
      const wantJet = mag > 0 && L.dy < 0;
      if (p.empty && p.fuel >= FUEL_RESTART) p.empty = false;
      const jet = wantJet && !p.empty;
      // holding a vine (or chain, root, frozen fall): no jet means you hang on and get your
      // breath back; the stick climbs you up and down
      const climbing = zfx.climb && !jet && !p.dead;
      p.jet = jet ? mag : 0;
      // low on fuel it coughs: the flame, smoke and roar cut out for a blink, you drop a
      // little, and it spits a grey puff
      p.sput = sputterStep(jetSt, dt, p.fuel, jet);
      p.flame = p.sput ? 0 : p.jet;
      if (p.sput) p.cough = 0.15;
      else p.cough = Math.max(0, p.cough - dt);
      if (jetSt.start) {
        p.vy += DEV.sputDip;
        for (let i = 0; i < 3; i++)
          smoke.push({ x: p.x + PW / 2 + (Math.random() - 0.5) * 6, y: p.y + PH + 2,
            vx: (Math.random() - 0.5) * 40, vy: 20 + Math.random() * 30,
            r: 2.5 + Math.random() * 2, life: 0.7 + Math.random() * 0.4, max: 1.1, c: '#6f767e', a: 0.8 });
      }
      if (jet) {
        p.fuel -= FUEL_DRAIN * (0.5 + 0.5 * mag) * dt;
        if (p.fuel <= 0) { p.fuel = 0; p.empty = true; }
      } else if (p.onGround || climbing) {
        p.fuel = Math.min(1, p.fuel + FUEL_REGEN * dt);
      }

      // ---- steering ----
      const pcx0 = p.x + PW / 2;
      p.kick -= dt;
      const k = p.kick > 0 ? 0.15 : 1;   // let explosions push you around briefly
      // each spider string on you slows you, and so does each web line you're pushing through
      const tied = strings.reduce((m, s) => m * s.slow, 1) * zfx.webMul;
      webLetGo -= dt;
      if (jet && p.sput) {
        // coughing: steer on, but no lift for the blink
        p.vx = approach(p.vx, L.nx * mag * JET * pb.walk * DEV.move * tied, JET_ACC * dt * k);
        p.vy = Math.min(p.vy + GRAVITY * dt, 900);
      } else if (jet) {
        p.vx = approach(p.vx, L.nx * mag * JET * pb.walk * DEV.move * tied, JET_ACC * dt * k);
        const ty = L.ny * mag * JET * pb.jet * DEV.move * tied;    // Faster Levitation lifts harder
        // rising beats a fall instantly (except just after a cough, which it has to climb
        // back out of); only an explosion still throws you around
        if (ty < p.vy && p.kick <= 0 && p.cough <= 0) p.vy = ty;
        else p.vy = approach(p.vy, ty, JET_ACC * dt * k);
        if (zfx.rev) p.vy -= GRAVITY * zfx.rev * dt;          // dark matter lifts you
      } else if (climbing && zfx.arch && p.kick <= 0) {
        // hanging from an arched vine: the stick runs you along its curve, hands on it. Push
        // down (not along it) to let go.
        const W = zfx.arch, hy = p.y + WEB_HAND, q = archNear(W, pcx0, hy);
        const a = W.arc[q.k], b = W.arc[q.k + 1], ul = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const ux = (b[0] - a[0]) / ul, uy = (b[1] - a[1]) / ul;
        const along = mag > 0 ? (L.nx * ux + L.ny * uy) * mag : 0;
        if (mag > 0.5 && L.ny > 0.7 && Math.abs(along) < 0.5) { webLetGo = 0.35; p.vy = 40; }
        else {
          const v = along * (W.climb || (W.climb = kr('arClimb'))) * tied;
          p.vx = approach(p.vx, ux * v + (q.x - pcx0) * 14, 1800 * dt);
          p.vy = approach(p.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
        }
      } else if (climbing && zfx.web && p.kick <= 0) {
        // hanging from a spider's web line: the stick runs you along it, hands on the line.
        // Push down (not along it) to let go.
        const W = zfx.web, wl = Math.hypot(W.b0x - W.a0x, W.b0y - W.a0y) || 1;
        let ux = (W.b0x - W.a0x) / wl, uy = (W.b0y - W.a0y) / wl;
        const along = mag > 0 ? (L.nx * ux + L.ny * uy) * mag : 0;
        if (mag > 0.5 && L.ny > 0.7 && Math.abs(along) < 0.5) { webLetGo = 0.35; p.vy = 40; }
        else {
          const v = along * (W.climb || (W.climb = spr('webClimb'))) * tied, hy = p.y + WEB_HAND, q = webNear(W, pcx0, hy);
          p.vx = approach(p.vx, ux * v + (q.x - pcx0) * 14, 1800 * dt);
          p.vy = approach(p.vy, uy * v + (q.y - hy) * 14, 1800 * dt);
        }
      } else {
        // decoration underfoot: snow, slime and puddles slow you, ice takes your grip away
        const target = mag > 0 ? L.nx * mag * WALK * pb.walk * DEV.move * zfx.slow * tied : 0;
        p.vx = approach(p.vx, target, (p.onGround ? GROUND_ACC * (zfx.slick ? 0.08 : 1) : AIR_ACC) * dt * k);
        if (climbing && p.kick <= 0) p.vy = approach(p.vy, mag > 0 ? L.ny * mag * CLIMB * tied : 0, 1800 * dt);
        else p.vy = Math.min(p.vy + GRAVITY * dt * (1 - 2 * zfx.rev), 900);   // dark matter flips it
      }

      // ---- move against the pixel terrain ----
      const wasGround = p.onGround, fallV = p.vy;
      let n = Math.ceil(Math.abs(p.vx * dt));
      if (n > 0) {
        const sx = p.vx * dt / n;
        for (let i = 0; i < n; i++) {
          if (!boxHit(p.x + sx, p.y)) { p.x += sx; continue; }
          let moved = false;
          const maxUp = wasGround ? 6 : 3;          // walk up small bumps and slopes
          for (let up = 1; up <= maxUp; up++) {
            if (!boxHit(p.x + sx, p.y - up)) { p.x += sx; p.y -= up; moved = true; break; }
          }
          if (!moved) { p.vx = 0; break; }
        }
      }
      n = Math.ceil(Math.abs(p.vy * dt));
      if (n > 0) {
        const sy = p.vy * dt / n;
        for (let i = 0; i < n; i++) {
          if (!boxHit(p.x, p.y + sy)) { p.y += sy; continue; }
          if (sy > 0) p.y = Math.floor((p.y + sy + PH - 0.001) / CELL) * CELL - PH;
          else p.y = (Math.floor((p.y + sy) / CELL) + 1) * CELL;
          if (boxHit(p.x, p.y)) p.y -= sy;   // fallback
          p.vy = 0;
          break;
        }
      }
      // stick to the ground when walking down slopes
      if (wasGround && !jet && p.vy >= 0 && p.kick <= 0 && !boxHit(p.x, p.y + 1)) {
        for (let dn = 1; dn <= 6; dn++) {
          if (boxHit(p.x, p.y + dn + 1)) { p.y += dn; p.vy = 0; break; }
        }
      }
      // never stay stuck inside terrain
      if (boxHit(p.x, p.y)) {
        for (let up = 1; up <= 40; up++) if (!boxHit(p.x, p.y - up)) { p.y -= up; break; }
      }
      if (p.y > WH) { p.x = start.x; p.y = start.y; p.vx = 0; p.vy = 0; }
      p.onGround = boxHit(p.x, p.y + 0.5);
      // footsteps and landings, in the sound of whatever you're standing on
      if (!p.dead) {
        if (p.onGround && !wasGround && fallV > 200) SFX.fx('land', null, null, { v: fallV, s: zfx.surface });
        if (p.onGround && Math.abs(p.vx) > 40) {
          if ((stepT -= dt * Math.abs(p.vx) / 40) <= 0) { stepT = 1; SFX.fx('step', null, null, zfx.surface); }
        } else stepT = Math.min(stepT, 0.35);
      }

      const pcx = p.x + PW / 2, pcy = p.y + PH / 2;
      if (!p.dead && pcx > portal.x && pcx < portal.x + portal.w &&
          pcy > portal.y && pcy < portal.y + portal.h) {
        floor++;
        enterLevel();
        saveRun();
        SFX.fx('portalIn');
        toast('Floor ' + floor);
        input.current.notify();
        return;
      }

      // ---- aiming: thumbstick first, otherwise mouse ----
      const gx = pcx, gy = p.y + PH * 0.4;
      const TR = input.current.right;
      let R = { on: false, show: false, nx: p.face, ny: 0 };
      // line shows as soon as you touch the stick, fading in with the push: 0 at the centre,
      // full at the trigger ring (vis is what the Trajectory Sight line reads)
      if (TR.active) R = { on: TR.on, show: true, nx: TR.nx, ny: TR.ny, vis: Math.min(1, TR.mag / AIM_DEAD) };
      else if (mouse.inside) {
        const dx = camX + mouse.x / unitPx - gx, dy = camY + mouse.y / unitPx - gy, d = Math.hypot(dx, dy);
        if (d > 1) R = { on: mouse.down, show: true, nx: dx / d, ny: dy / d };
      }
      // Pinpointer aims for you: the gun locks onto the nearest creature and you only
      // decide whether to fire. It replaces hand-aiming — the stick becomes a trigger.
      if (pb.pinpointer && !p.dead) {
        let best = null, bd = 1e9;
        for (const e of enemies) {
          const d = Math.hypot(e.x - gx, e.ty - gy);
          if (d < bd && lineOfSight(gx, gy, e.x, e.ty)) { bd = d; best = e; }
        }
        if (best) {
          const a = Math.atan2(best.ty - gy, best.x - gx);
          R = { on: R.on || (TR.active && TR.on), show: true, nx: Math.cos(a), ny: Math.sin(a), vis: R.vis };
        }
      }
      if (p.dead) R.on = false;
      p.aim = R;

      if (R.show) p.face = R.nx >= 0 ? 1 : -1;
      else if (Math.abs(p.vx) > 10) p.face = p.vx > 0 ? 1 : -1;

      // every gun you carry ticks down and tops up its mana, holstered or not
      for (const g of LO.guns) {
        if (!g) continue;
        const pas = gunPassives(g);
        const recharging = g.rechT > 0;
        g.delayT -= dt; g.rechT -= dt;
        if (recharging && g.rechT <= 0 && g === LO.guns[LO.sel] && (g.rechLen || 0) >= 0.45) SFX.fx('ready');
        g.mana = Math.min(g.manaMax + pas.manaMax, g.mana + (g.manaRegen + pas.manaRegen) * dt);
      }
      const gun = LO.guns[LO.sel];
      if (R.on && gun && gun.delayT <= 0 && gun.rechT <= 0) cast(gun, gx, gy, R.nx, R.ny);

      // ---- shots ----
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.life -= dt; b.spin += dt * 12; b.age = (b.age || 0) + dt;
        let dead = b.life <= 0, boom = false;
        if (dead && b.lifeBoom && b.explode) { dead = false; boom = true; }   // a bomb's fuse burns down
        if (b.fuse && b.age >= b.fuse) { boom = b.explode ? true : false; if (!b.explode) dead = true;
          else { explodeCross(b); dead = true; boom = false; } }
        if (b.grav) b.vy += b.grav * dt;
        if (b.drag) { const k = Math.exp(-b.drag * dt); b.vx *= k; b.vy *= k; }
        if (b.accel) { const f = 1 + b.accel * dt; b.vx *= f; b.vy *= f; }
        if (b.vmax) { const v = Math.hypot(b.vx, b.vy); if (v > b.vmax) { b.vx *= b.vmax / v; b.vy *= b.vmax / v; } }
        if (b.wig) turn(b, wigTurn(b.wig, b.age, dt));
        if (b.look) shotTrail(b, dt);
        // paths: each one bends the velocity, and tracePath draws the same bends
        if (b.spiral) turn(b, b.spiral * dt);
        if (b.pong && Math.floor(b.age / 0.45) % 2 === 1) { b.vx = -b.vx; b.vy = -b.vy; b.age += dt; }
        if (b.orbit) turn(b, b.orbit * dt);
        if (b.boomer) {
          const want = Math.atan2(p.y + PH / 2 - b.y, p.x + PW / 2 - b.x);
          turn(b, clamp(angDiff(want, Math.atan2(b.vy, b.vx)), -b.boomer * dt, b.boomer * dt));
        }
        if (b.eat) dig(b.x, b.y, b.eat);
        if (b.fire) ignite(b.x, b.y, b.size + 2, 0.5);     // a fire spell lights what it flies through
        if (b.arc) lightningStep(b, dt);
        // a timer lets its payload go in mid-air, and the carrier flies on
        if (b.payload && b.timer != null && (b.timer -= dt) <= 0) firePayload(b);
        if (b.pull) {
          // Black Hole: heavy gravity. It reaches ~2.2x its pull stat and drags harder the
          // closer you are, so creatures get hauled in and held in the middle of it. It
          // swallows enemy shots that come near, and grinds anything in it every 0.3s.
          const reach = DEV.bhPull * b.pull / 70;          // Dev knob: max pull range
          for (const e of enemies) {
            const dx = b.x - e.x, dy = b.y - e.ty, d = Math.hypot(dx, dy) || 1;
            if (d < reach) {
              const f = Math.min(d / dt, 60 + 420 * (1 - d / reach));   // never overshoot the centre
              e.x += dx / d * f * dt; e.y += dy / d * f * dt; e.tgt = null;
            }
          }
          for (let k = enemyShots.length - 1; k >= 0; k--) {
            const es = enemyShots[k];
            const dx = b.x - es.x, dy = b.y - es.y, d = Math.hypot(dx, dy) || 1;
            if (d < b.size + 6) { burst(es.x, es.y, 3, '#c58cff'); SFX.fx('absorb', es.x, es.y); enemyShots.splice(k, 1); continue; }
            if (d < reach) { es.vx += dx / d * 900 * dt; es.vy += dy / d * 900 * dt; }
          }
          if ((b.grind = (b.grind || 0) + dt) > 0.3) { b.grind = 0; b.hit = null; }
          // the trail of magic it leaves behind
          if (Math.random() < 0.9) {
            const a = Math.random() * 6.28, rr = b.size * (0.6 + Math.random() * 0.5);
            const life = 0.6 + Math.random() * 0.7;
            motes.push({ kind: 'drift', x: b.x + Math.cos(a) * rr, y: b.y + Math.sin(a) * rr,
              vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life, max: life,
              s: 0.8 + Math.random() * 1.6, c: Math.random() < 0.3 ? '#f0e0ff' : Math.random() < 0.6 ? '#c58cff' : '#8a5cff' });
          }
        }
        if (b.split && b.age > 0.28) {                   // one clean split, partway along
          b.split = 0;
          SFX.fx('split', b.x, b.y);
          for (const turnBy of [-0.3, 0.3]) {
            const c = Object.assign({}, b, { hit: null, split: 0, age: 0 });
            const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx) + turnBy;
            c.vx = Math.cos(a) * sp; c.vy = Math.sin(a) * sp;
            bullets.push(c);
          }
        }
        if (b.drift) {
          // Pollen: drags to a stop and floats; locks onto the first creature in range
          // it can see, then speeds back up and homes. Loses the lock if that one dies.
          if (b.lock && enemies.indexOf(b.lock) < 0) b.lock = null;
          if (!b.lock) {
            const d = driftStep(b.vx, b.vy, dt); b.vx = d[0]; b.vy = d[1];
            let bd = b.homeR || DRIFT_R;
            for (const e of enemies) {
              const dd = Math.hypot(e.x - b.x, e.ty - b.y);
              if (dd < bd && lineOfSight(b.x, b.y, e.x, e.ty)) { bd = dd; b.lock = e; }
            }
          }
          if (b.lock) {
            const e = b.lock, sp = Math.min(DRIFT_CHASE, Math.hypot(b.vx, b.vy) + DRIFT_ACC * dt);
            const want = Math.atan2(e.ty - b.y, e.x - b.x);
            const ang = Math.hypot(b.vx, b.vy) < 5 ? want
              : Math.atan2(b.vy, b.vx) + clamp(angDiff(want, Math.atan2(b.vy, b.vx)), -b.homing * dt, b.homing * dt);
            b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
          }
        }
        if (b.homing && !b.drift) {
          let best = null, bd = b.homeR || 260;
          for (const e of enemies) {
            const d = Math.hypot(e.x - b.x, e.ty - b.y);
            if (d < bd) { bd = d; best = e; }
          }
          if (best) {
            const sp = Math.hypot(b.vx, b.vy) || 1;
            let ang = Math.atan2(b.vy, b.vx);
            let diff = Math.atan2(best.ty - b.y, best.x - b.x) - ang;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            ang += clamp(diff, -b.homing * dt, b.homing * dt);
            b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
          }
        }
        const sn = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2));
        for (let st = 0; st < sn && !dead && !boom; st++) {
          const nx = b.x + b.vx * dt / sn, ny = b.y + b.vy * dt / sn;
          const j = enemyAt(nx, ny, b.size + 1);
          if (j >= 0 && !(b.hit && b.hit.has(enemies[j]))) {
            const e = enemies[j];
            const sp = Math.hypot(b.vx, b.vy) || 1;
            damageEnemy(j, critRoll(b.dmg, b.crit));
            if (b.fire) setAlight(e);
            burst(nx, ny, 4, b.col);
            SFX.hit(nx, ny);
            if (b.knock) shove(e, b.vx / sp, b.vy / sp, b.knock);
            b.x = nx; b.y = ny;
            if (b.payload && b.trig !== 'expire') firePayload(b);   // a trigger goes off on a hit
            if (b.chain > 0) {                            // hop to the next one along
              (b.hit || (b.hit = new Set())).add(e);
              let best = null, bd = 150;
              for (const o of enemies) {
                if (b.hit.has(o)) continue;
                const d = Math.hypot(o.x - nx, o.ty - ny);
                if (d < bd) { bd = d; best = o; }
              }
              if (best) {
                b.chain--;
                SFX.fx('chainhop', nx, ny);
                const a = Math.atan2(best.ty - ny, best.x - nx);
                b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
                b.life = Math.max(b.life, 0.4);
                continue;
              }
            }
            if (b.cluster) { spray(b); dead = true; break; }
            if (b.explode) { boom = true; break; }
            if (b.pop) { explode(nx, ny, b.pop, b.dmg * 0.5); dead = true; break; }
            if (b.pull) { (b.hit || (b.hit = new Set())).add(e); continue; }   // a black hole rolls on
            if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = new Set())).add(e); }
            else { dead = true; break; }
          }
          if (b.friendly && !p.dead && nx > p.x - 2 && nx < p.x + PW + 2 &&
              ny > p.y - 2 && ny < p.y + PH + 2) {
            burst(nx, ny, 5, b.col); hurt(Math.round(b.dmg * 2)); dead = true; break;
          }
          if (solidAt(nx, ny)) {
            if (b.payload && b.trig !== 'expire') firePayload(b);   // so does touching rock
            if (b.bounce > 0 && !b.bore && !b.eat) {
              b.bounce--;
              const hx = solidAt(nx, b.y), hy = solidAt(b.x, ny);
              if (hx || !hy) b.vx = -b.vx;
              if (hy || !hx) b.vy = -b.vy;
              const be = b.bounceE || 0.92;
              b.vx *= be; b.vy *= be;
              const slow = Math.hypot(b.vx, b.vy) < 60;
              if (slow && b.lifeBoom) b.bounce++;         // a bomb at rest doesn't use up its bounces
              if (!slow) SFX.bounce(b.x, b.y);
              if (b.look) shotBounce(b);
              if (b.bounceFx === 'explode') explode(b.x, b.y, Math.max(10, b.explode || 12));
              break;                      // stay put: b.x/b.y are still outside the rock
            }
            b.x = nx; b.y = ny;
            if (b.bore > 0) { if (b.look) shotGrind(b, nx, ny); dig(nx, ny, b.bore); continue; }
            // Matter Eater / Black Hole: eat straight through the rock, digging as it goes,
            // so a fast shot can't outrun the small hole its per-frame eat carves ahead
            if (b.eat > 0) { dig(nx, ny, b.eat); continue; }
            if (b.cluster) { spray(b); dead = true; break; }
            if (b.explode) { boom = true; break; }
            if (b.pop) { explode(b.x, b.y, b.pop, b.dmg * 0.5); dead = true; break; }
            if (b.pit) dig(nx, ny, b.pit);                // Noita's small hole where a shot lands
            burst(b.x, b.y, 3, b.col);
            SFX.rock(b.x, b.y);
            dead = true;
            break;
          }
          b.x = nx; b.y = ny;
        }
        if (boom) { explode(b.x, b.y, b.explode, undefined, b.fire); dead = true; }
        if (dead && b.fire) ignite(b.x, b.y, b.size + 6, 0.9);
        // an expiration trigger goes off however it dies; a trigger stopped by a prop counts as a hit
        if (dead && b.payload && (b.trig === 'expire' || b.struck)) firePayload(b);
        if (dead && b.tele) teleportTo(b);            // Teleport Bolt: you go where it stopped
        if (dead && b.arc && b.trail) {               // the bolt's path lingers for a blink
          b.trail.push({ x: b.x, y: b.y });
          addArc(b.trail, b.col, 1.4, 0.16);
        }
        if (dead && b.look) shotDeath(b);
        if (dead) bullets.splice(i, 1);
      }
      for (let i = arcs.length - 1; i >= 0; i--) if ((arcs[i].t += dt) > arcs[i].max) arcs.splice(i, 1);

      // ---- sound, once a frame: where you are listening from, the jetpack, each live
      // Black Hole's drone, the floor's ambience, and a heartbeat when you're nearly dead ----
      SFX.ear(pcx, pcy);
      if (!jetLoop && SFX.ready) jetLoop = SFX.loop('jet');
      if (jetLoop) jetLoop.set(p.dead ? 0 : Math.min(1, p.flame) * 0.35, null, null,
        (1 + 0.49 * Math.min(1, p.flame)) * jetPitch(jetSt.onT));   // tone: thrust, then how long it's held
      if (p.empty && !wasEmpty) SFX.ui('sputter');
      wasEmpty = p.empty;
      for (const b of bullets) if (b.pull) {
        let h = bhLoops.get(b);
        if (!h && bhLoops.size < 3 && SFX.ready) { h = SFX.loop('void'); if (h) bhLoops.set(b, h); }
        if (h) h.set(0.5, b.x, b.y);
      }
      for (const [b, h] of bhLoops) if (!bullets.includes(b)) { h.stop(); bhLoops.delete(b); }
      SFX.ambTick(dt);
      if (!portalLoop && SFX.ready) portalLoop = SFX.loop('portal');
      if (portalLoop) portalLoop.set(0.55, portal.x + portal.w / 2, portal.y + portal.h / 2);
      if (matterProps.length) {
        let best = null, bd = 300;
        for (const pr of matterProps) { const d = Math.hypot(pr.x - pcx, pr.y - pcy); if (!pr.gone && d < bd) { bd = d; best = pr; } }
        if (best && !matterLoop && SFX.ready) matterLoop = SFX.loop('matter');
        if (matterLoop && best) matterLoop.set(0.6, best.x, best.y);
      }
      if (p.jet > 0 && !wasJet) SFX.fx('ignite');
      wasJet = p.jet > 0;
      for (const dv of devils) if ((dv.snd = (dv.snd || 0) - dt) <= 0) { dv.snd = 0.9 + Math.random() * 0.8; SFX.fx('whirl', dv.x, dv.y - 14); }
      if (!p.dead && p.hp / MHP < 0.3 && (beatT -= dt) <= 0) { beatT = 0.55 + 1.5 * p.hp / MHP; SFX.ui('beat'); }

      // ---- static fields ----
      for (let i = fields.length - 1; i >= 0; i--) {
        const f = fields[i];
        f.life -= dt; f.tick -= dt;
        const near = j => Math.hypot(enemies[j].x - f.x, enemies[j].ty - f.y) < f.r;
        if (f.field === 'slow' || f.field === 'storm') {
          // Stillness frosts and the thundercloud's rain soaks: any fire under them goes out
          if ((f.dT = (f.dT || 0) - dt) <= 0) { f.dT = 0.15;
            if (fireDouse(fire, f.x, f.y, f.r) && Math.random() < 0.5) SFX.fx('steam', f.x, f.y);
            for (const e of enemies) if (e.burn > 0 && Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.burn = 0;
            if (p.burn > 0 && Math.hypot(pcx - f.x, pcy - f.y) < f.r) p.burn = 0; }
          if (f.field === 'slow' && Math.random() < dt * 14) { const a = Math.random() * 6.283, r = Math.random() * f.r;
            glowDot(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, rnd(-4, 4), rnd(4, 12), Math.random() < 0.5 ? '#ffffff' : '#bfe8ff', rnd(0.7, 1.1), rnd(0.4, 0.9)); }
        }
        if (f.field === 'heal' && Math.random() < dt * 10) { const a = Math.random() * 6.283, r = Math.random() * f.r;
          glowDot(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 0, rnd(-18, -8), Math.random() < 0.5 ? '#9dff9a' : '#46c48c', rnd(0.8, 1.2), rnd(0.4, 0.8)); }
        if (f.field === 'mine') {
          f.near = enemies.some(e => Math.hypot(e.x - f.x, e.ty - f.y) < f.r * 2.2);
          let trip = f.life <= 0;
          for (let j = 0; j < enemies.length && !trip; j++) if (near(j)) trip = true;
          if (trip) { explode(f.x, f.y, f.r); fieldPayload(f); fields.splice(i, 1); continue; }
        } else if (f.field === 'dormant') {
          // set off by any blast of yours, which is the whole point of it
          for (const fl of flashes) {
            if (Math.hypot(fl.x - f.x, fl.y - f.y) < fl.r + f.r * 0.5) {
              explode(f.x, f.y, f.r * 1.6); fieldPayload(f); fields.splice(i, 1); f.life = -1; break;
            }
          }
          if (f.life < 0) continue;
        } else if (f.field === 'slow') {
          for (const e of enemies) if (Math.hypot(e.x - f.x, e.ty - f.y) < f.r) e.chill = 0.2;
        } else if (f.field === 'shield') {
          for (let k = enemyShots.length - 1; k >= 0; k--) {
            const b = enemyShots[k];
            if (Math.hypot(b.x - f.x, b.y - f.y) < f.r) { burst(b.x, b.y, 3, f.col); SFX.fx('absorb', b.x, b.y); enemyShots.splice(k, 1); }
          }
        } else if (f.field === 'heal') {
          if (Math.hypot(pcx - f.x, pcy - f.y) < f.r && p.hp < MHP && f.tick <= 0) {
            f.tick = 0.4; p.hp = Math.min(MHP, p.hp + 4 * pb.heal); input.current.notify(); SFX.fx('healtick');
          }
        } else if (f.field === 'storm') {
          if (f.tick <= 0) {
            f.tick = 0.22;
            const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
            const sx = f.x + Math.cos(a) * rr, sy = f.y + Math.sin(a) * rr;
            for (let j = enemies.length - 1; j >= 0; j--)
              if (Math.hypot(enemies[j].x - sx, enemies[j].ty - sy) < 22) damageEnemy(j, 2);
            burst(sx, sy, 6, '#a8e4ff');
            addArc([{ x: sx + rnd(-8, 8), y: f.y - f.r * 0.85 }, { x: sx, y: sy }], '#a8e4ff', 1.2, 0.14);   // down from the cloud
            SFX.arc(sx, sy, true);
          }
        } else if (f.field === 'vacuum') {
          // Noita's Vacuum Field: a blink after it appears, everything in reach is warped
          // straight to the middle, through walls — creatures, shots (theirs and yours),
          // gold and loot. Once, then it's gone.
          if (!f.done && f.max - f.life >= VACUUM_WAIT) {
            f.done = true;
            const inR = (x, y) => Math.hypot(x - f.x, y - f.y) < f.r;
            for (const e of enemies) if (inR(e.x, e.ty)) { e.y += f.y - e.ty; e.x = f.x; e.tgt = null; }
            for (const b of bullets) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
            for (const b of enemyShots) if (inR(b.x, b.y)) { b.x = f.x; b.y = f.y; }
            for (const g of coins) if (inR(g.x, g.y)) { g.x = f.x; g.y = f.y; }
            for (const q of pickups) if (!q.taken && inR(q.x, q.y)) { q.x = f.x; q.y = f.y; }
            burst(f.x, f.y, 14, f.col);
            SFX.fx('warp', f.x, f.y);
          }
        } else if (f.field === 'glitter') {
          if (f.tick <= 0) {
            f.tick = 0.16;
            const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
            explode(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, 9);
          }
        }
        if (f.life <= 0) fields.splice(i, 1);
      }
      for (let i = beams.length - 1; i >= 0; i--) if ((beams[i].t += dt) > 0.12) beams.splice(i, 1);

      // ---- pickups: just cooldown upkeep and clearing what was taken. Whether one is
      // near enough to show its card, and whether you actually take it, is decided
      // below together with the shop — both go through the same interact tap now. ----
      for (let i = pickups.length - 1; i >= 0; i--) {
        const q = pickups[i];
        if (q.taken) { pickups.splice(i, 1); continue; }
        if (q.cool > 0) q.cool -= dt;
      }
      // ---- gold ----
      for (let i = coins.length - 1; i >= 0; i--) {
        const g = coins[i];
        const dx = pcx - g.x, dy = pcy - g.y, d = Math.hypot(dx, dy) || 1;
        const pull = COIN_PULL * pb.goldPull;    // Attract Gold reaches further
        if (g.nopull > 0) g.nopull -= dt;        // gold a rat just knocked out of you flies clear first
        if (d < pull && !p.dead && !(g.nopull > 0)) {
          // inside the pull radius it flies to you, straight through rock
          const grab = 180 + 900 * (1 - d / pull);
          g.vx = (g.vx || 0) + (dx / d) * grab * dt * 6;
          g.vy += (dy / d) * grab * dt * 6;
          g.vx *= 0.88; g.vy *= 0.88;
          g.x += g.vx * dt; g.y += g.vy * dt;
          if (d < 12) {
            LO.gold += g.amount;
            coins.splice(i, 1);
            SFX.ui('coin');
            input.current.notify();
          }
          continue;
        }
        if (g.pop) {
          // knocked out of you: flies in an arc, bounces a few times and skids to a stop
          g.vx *= Math.exp(-0.6 * dt);
          g.vy += 420 * dt;
          const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
          if (solidAt(nx, g.y)) g.vx *= -0.4; else g.x = nx;
          if (solidAt(g.x, ny + 3)) {
            if (g.vy > 70) { g.vy = -g.vy * 0.42; g.vx *= 0.7; SFX.fx('coinland', g.x, g.y); }
            else { g.vy = 0; g.vx *= Math.exp(-8 * dt); if (Math.abs(g.vx) < 4) { g.vx = 0; g.pop = 0; } }
          } else if (solidAt(g.x, ny - 3) && g.vy < 0) g.vy = 0;
          else g.y = ny;
          continue;
        }
        g.vx = (g.vx || 0) * 0.9;
        g.vy += 320 * dt;
        const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
        if (!solidAt(nx, g.y)) g.x = nx;
        if (solidAt(g.x, ny + 3)) { if (g.vy > 60) SFX.fx('coinland', g.x, g.y); g.vy = 0; } else g.y = ny;
      }

      // ---- what you can interact with: a shop plinth, or something on the ground ----
      const inShop = p.y + PH > SHOP_Y;
      let near = null;                      // { src: 'shop', it } or { src: 'pickup', q }
      for (const it of stock) {
        if (it.sold) continue;
        if (Math.abs(it.x - pcx) > 15 || Math.abs(it.y - pcy) > 22) continue;
        near = { src: 'shop', it };
        break;
      }
      if (!near) for (const q of pickups) {
        if (q.cool > 0) continue;
        if (Math.abs(q.x - pcx) > 18 || Math.abs(q.y - pcy) > 20) continue;
        near = { src: 'pickup', q };
        break;
      }
      // the hidden rooms' prizes: a perk on its altar, or the +25 heart
      if (!near) for (const r of rooms) {
        if (r.taken) continue;
        if (Math.abs(r.x - pcx) > 20 || Math.abs(r.y - pcy) > 26) continue;
        near = { src: 'room', r };
        break;
      }
      const nearKey = !near ? -1 : near.src + ':' +
        (near.src === 'shop' ? stock.indexOf(near.it)
          : near.src === 'room' ? rooms.indexOf(near.r) : pickups.indexOf(near.q));
      const label = !near ? null
        : near.src === 'shop'
          ? (near.it.kind === 'heal' ? { text: 'Full heal', price: 0, can: p.hp < MHP }
            : near.it.kind === 'gun' ? { text: near.it.gun.name, gun: near.it.gun,
                price: near.it.price, can: LO.gold >= near.it.price }
            : { text: MODS[near.it.id].name, id: near.it.id, price: near.it.price,
                can: LO.gold >= near.it.price })
          : near.src === 'room'
            ? (near.r.kind === 'perk'
                ? { text: PERKS[near.r.id].name, perk: near.r.id, price: 0, can: true }
                : { text: '+25 Max Health', heart: true, price: 0, can: true })
          // things on the ground are always yours for the taking — the price is what
          // the "For sale"/"Found" split cares about, not whether you're allowed to
          : (near.q.kind === 'gun' ? { text: near.q.gun.name, gun: near.q.gun, price: 0, can: true, found: true }
            : { text: MODS[near.q.id].name, id: near.q.id, price: 0, can: true, found: true });
      // where the item sits on screen, so the panel can float its bottom edge just above
      // it (the plinth/pickup) rather than covering it. camY/unitPx are last frame's, from
      // draw(); the item is static and the camera settles, so it lands right within a frame
      // or two. In css px measured up from the bottom of the view — that's the panel's
      // `bottom`. Bucketed into the sig so the panel re-lays-out as the camera settles.
      let pbottom = 12;
      if (near) {
        const iy = near.src === 'shop' ? near.it.y : near.src === 'room' ? near.r.y : near.q.y;
        const dprc = window.devicePixelRatio || 1;
        pbottom = Math.round(Math.max(10, c.height / dprc - (iy - 16 - camY) * unitPx));
      }
      const sig = nearKey + ':' + (label && label.can ? 1 : 0) + ':' + inShop + ':' + Math.round(pbottom / 16);
      if (nearKey !== -1 && nearKey !== lastNear) SFX.fx('prompt');   // a soft blip as a card comes up
      lastNear = nearKey;
      if (sig !== input.current.sig) {
        input.current.sig = sig;
        input.current.prompt = label;
        input.current.promptBottom = pbottom;
        input.current.inShop = inShop;
        input.current.notify();
      }
      // dead: a tap on the right stick restarts the run (see the death message)
      if (p.dead && input.current.interact) {
        input.current.interact = false;
        if (input.current.requestRestart) input.current.requestRestart();
      }
      if (input.current.interact && near) {
        input.current.interact = false;
        if (near.src === 'shop') {
          const it = near.it;
          if (it.kind === 'heal') {
            if (p.hp < MHP) { p.hp = MHP; it.sold = true; toast('Patched up'); SFX.ui('heal'); }
          } else if (LO.gold < it.price) {
            toast('Not enough gold');
            SFX.ui('poor');
          } else if (it.kind === 'gun') {
            LO.gold -= it.price;
            it.sold = true;
            // it drops at the plinth, so the usual chooser decides which slot it takes
            // and "leave it" parks the gun you paid for on the floor rather than binning it
            pickups.push({ kind: 'gun', x: it.x, y: it.y, gun: it.gun, t: 0 });
            toast('Bought ' + it.gun.name);
            SFX.ui('buy');
          } else {
            LO.gold -= it.price;
            LO.bag.push(it.id);
            it.sold = true;
            toast('Bought ' + MODS[it.id].name);
            SFX.ui('buy');
          }
        } else if (near.src === 'room') {
          const r = near.r;
          if (r.kind === 'perk') {
            const before = maxHp();
            (LO.perks || (LO.perks = [])).push(r.id);
            refreshBag();
            const after = maxHp();
            if (after > before) p.hp += after - before;   // Extra Health comes full
            p.hp = Math.min(p.hp, after);                 // Glass Cannon trims it
            if (pb.seeAll) { seen.fill(2); paintFog(); }  // All-Seeing Eye lights it up now
            if (pb.ghost && !ghost) ghost = { x: pcx, y: pcy, cd: 0 };
            toast('Perk: ' + PERKS[r.id].name);
            SFX.ui('perk');
          } else {
            LO.maxBonus = (LO.maxBonus || 0) + 25;        // the heart raises the cap, no heal
            toast('+25 Max Health');
            SFX.ui('heart');
          }
          r.taken = true;
        } else {
          const q = near.q;
          if (q.kind === 'mod') {
            // a mod goes straight to the bag — the panel already showed what it is, and a
            // mod has no slot to choose, so there's no second screen for it
            LO.bag.push(q.id);
            q.taken = true; q.cool = PICKUP_COOL;
            toast('Picked up ' + MODS[q.id].name);
            SFX.ui('mod');
          } else {
            // a gun opens the chooser: compare it with yours and pick the slot to swap
            input.current.found = q;
          }
        }
        input.current.sig = '';
        input.current.notify();
      }
      input.current.interact = false;

      for (let i = toasts.length - 1; i >= 0; i--) if ((toasts[i].t -= dt) <= 0) toasts.splice(i, 1);

      decorStep(dt, pcx, pcy);

      // ---- enemies ----
      // What an enemy does is what it is. Shooters hold a hover and fire on sight,
      // turrets never move and wind up a long shot, chasers come at you and hurt on
      // contact, bombers come at you and burst. Runs backwards because a bomber
      // takes itself out of the list.
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i], k = e.k;
        e.flash -= dt;
        e.cd -= dt;
        e.touch -= dt;
        const dx = pcx - e.x, dy = pcy - e.ty, dist = Math.hypot(dx, dy) || 1;
        e.lx = dx / dist; e.ly = dy / dist;
        // Aggro (k.aggro) and firing (k.range) reaches are in world units, but the
        // camera zoom changes how much world fits on screen — zoomed in, an enemy off
        // the edge of the view could still hunt and shoot you. Scale both by 1/zoom so
        // they engage at roughly the same on-screen distance whatever the zoom.
        // Invisibility still folds in on top: creatures notice you far later.
        const sees = (pb.invis ? 0.4 : 1) / DEV.zoom;
        // aggro only on a real sightline: a chaser or bomber won't come for you through a
        // wall any more, only once it can actually see you (and within its aggro reach).
        // The range check comes first so the line-of-sight march only runs for the few
        // enemies already close enough to care.
        // DEV.aggro is an extra hand-tuning multiplier on the aggro reach, on top of the
        // zoom-relative `sees` scaling — firing range (k.range) is left alone.
        // Aggro is sticky: once a chaser/bomber has you it keeps coming (even out of the
        // initial reach and even round a wall), and only drops back to patrol once you've
        // put DEV.loseAggro times the aggro reach between you — so you can outrun it.
        const chaser = HUNTERS[k.act] && !p.dead;
        // a reworked creature rolls its own aggro reach from its knobs, once a second
        if (k.kp && ((e.aggroT = (e.aggroT || 0) - dt) <= 0)) { e.aggroM = kr(k.kp + 'Aggro'); e.aggroT = 1; }
        const reach = k.aggro * sees * DEV.aggro * (k.kp ? e.aggroM : 1);
        if (chaser) {
          if (!e.aggro) { if (dist < reach && lineOfSight(e.x, e.ty, pcx, pcy)) { e.aggro = true; SFX.creature(k, 'alert', e.x, e.ty); } }
          else if (dist > reach * DEV.loseAggro) e.aggro = false;
        } else e.aggro = false;
        const hunting = chaser && e.aggro;
        // the odd noise from anything near, seen or not: you hear the cave before you see it
        if (dist < 380 && Math.random() < 0.07 * dt) SFX.creature(k, 'idle', e.x, e.ty);
        // a bomber closing in ticks like a fuse, faster the nearer it gets
        if (hunting && k.act === 'bomb' && dist < 160 && (e.fuseT = (e.fuseT || 0) - dt) <= 0) {
          e.fuseT = 0.12 + dist / 400; SFX.creature(k, 'fuse', e.x, e.ty);
        }
        if (k.act === 'nest') {
          // lets a rat out now and then, while it has fewer than its max alive; only while
          // you're near enough for it to matter
          const N = e.nest;
          if (!N.max) { N.max = Math.round(kr('raMax')); N.wake = kr('raWake'); }
          if (dist < N.wake && (N.t -= dt) <= 0) {
            N.t = kr('raSpawn');
            let out = 0;
            for (const r of enemies) if (r.home === e) out++;
            if (out < N.max) spawnRat(e);
          }
          e.chill = 1; e.ty = e.y;
          continue;
        }
        if (k.act === 'rat') {
          ratFrame(e, dt, dist, hunting, pcx, pcy);
          e.chill = 1; e.ty = e.y;
          continue;
        }
        if (k.act === 'spider') {
          // only on rock and its own lines (spiderStep); strings you when it has a clear line
          const cold = e.chill && e.chill < 1 ? e.chill : 1;
          if (spiderStep(e, { solidCell, webs, hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
            speedMul: cold }, dt) === 'web') SFX.fx('lash', e.x, e.y);
          e.silkT = (e.silkT || 0) - dt;
          const S = e.sp;
          if (hunting && e.silkT <= 0 && S && (S.mode === 'surf' || S.mode === 'line') &&
              dist < (e.silkR || (e.silkR = spr('spSilk'))) * sees && dist > e.r + 24) {
            e.silkT = 0.4;
            if (lineOfSight(e.x, e.y, pcx, pcy)) {
              e.silkT = spr('spSilkCd'); e.silkR = spr('spSilk');
              const v = spr('spSilkSpd');
              silk.push({ x: e.x, y: e.y, ax: e.x, ay: e.y, vx: dx / dist * v, vy: dy / dist * v,
                life: 400 / v * 1.3 + 0.1 });
              SFX.creature(k, 'fire', e.x, e.y);
            }
          }
        } else if (k.act === 'jelly') {
          // swims in pulses (jellyStep); spits when its head is lined up on you, in range
          const cold = e.chill && e.chill < 1 ? e.chill : 1;
          if (jellyStep(e, { solidCell, hunting, goal: { x: pcx, y: pcy }, rnd: Math.random,
            speedMul: cold, rangeMul: sees, stay: zone ? natural : null }, dt) === 'pulse') puffSpores(e);
          const S = e.je;
          // brush its tentacles and you're stung, hunting or not (same sting knobs as the bell)
          if (!p.dead && e.touch <= 0 && dist < 180) {
            const t = tentacleTouch(S, p.x, p.y, p.x + PW, p.y + PH);
            if (t) {
              hurt(Math.round(kr('jeBite'))); e.touch = kr('jeBiteCd');
              burst(t.x, t.y, 5, jellyPal(S.u.col).tent);
              SFX.creature(k, 'bite', t.x, t.y);
            }
          }
          if (hunting && S.inRange && S.aimed && e.cd <= 0) {
            e.cd = 0.25;                                // no clear line: look again shortly
            const hx = e.x + Math.cos(S.hd) * e.r * 0.9, hy = e.y + Math.sin(S.hd) * e.r * 0.9;
            if (lineOfSight(hx, hy, pcx, pcy)) {
              e.cd = kr('jeShotCd');
              const a = Math.atan2(pcy - hy, pcx - hx) + (Math.random() * 2 - 1) * kr('jeSpread') * Math.PI / 180;
              const v = kr('jeShotSpd'), P = jellyPal(S.u.col);
              enemyShots.push({ x: hx, y: hy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 3,
                col: P.spit, edge: P.spitEdge, shine: P.spitShine, dripCol: P.drip, dripCol2: P.drip2, glow: hexRgb(P.glow),
                dmg: Math.round(kr('jeShotDmg')), size: kr('jeShotSize'), goo: 1,
                drip: kr('jeDrip'), da: 0, dripG: kr('jeDripG'), splat: Math.round(kr('jeSplat')), splatV: kr('jeSplatSpd') });
              SFX.creature(k, 'fire', e.x, e.y);
            }
          }
        } else if (k.act === 'turret') {
          // holds station: the hover is all the movement it gets
        } else if (hunting) {
          const step = k.spd * (e.chill || 1) * dt;
          const wx = e.x + dx / dist * step, wy = e.y + dy / dist * step;
          if (!solidAt(wx - e.r, wy) && !solidAt(wx + e.r, wy) &&
              !solidAt(wx, wy - e.r) && !solidAt(wx, wy + e.r)) { e.x = wx; e.y = wy; }
          else if (!solidAt(wx, e.y)) e.x = wx;            // slide along whatever it hit
          else if (!solidAt(e.x, wy)) e.y = wy;
          else { e.tgt = null; e.rest = 0; }
        } else {
          // patrol: pick a spot near home, drift to it, pause, pick another. Rock in
          // the way just means the spot was a bad idea, so it chooses a different one.
          e.rest -= dt;
          if (!e.tgt || e.rest <= 0 || Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < 6) {
            const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * PATROL_R;
            e.tgt = { x: e.hx + Math.cos(a) * r, y: e.hy + Math.sin(a) * r };
            e.rest = 2 + Math.random() * 3.5;
          }
          const tdx = e.tgt.x - e.x, tdy = e.tgt.y - e.y, td = Math.hypot(tdx, tdy) || 1;
          const step = k.spd * (e.chill || 1) * dt;
          const wx = e.x + tdx / td * step, wy = e.y + tdy / td * step;
          if (solidAt(wx - e.r, wy) || solidAt(wx + e.r, wy) ||
              solidAt(wx, wy - e.r) || solidAt(wx, wy + e.r)) { e.tgt = null; e.rest = 0; }
          else { e.x = wx; e.y = wy; }
        }
        e.chill = 1;                                  // fields re-apply it every frame
        e.ty = k.kp ? e.y : e.y + Math.sin(time * 2 + e.phase) * (hunting ? 2 : 4);

        // contact: a chaser hurts you by reaching you, a bomber goes off
        if (hunting && dist < e.r + 14 && e.touch <= 0) {
          if (k.act === 'bomb') {
            burst(e.x, e.ty, 22, k.col.a);
            SFX.boom(e.x, e.ty, 26);
            hurt(k.dmg);
            enemies.splice(i, 1);
            if (k.fire) fireBlast(e.x, e.ty, 26, 1);
            continue;
          }
          SFX.creature(k, 'bite', e.x, e.ty);
          hurt(k.kp ? Math.round(kr(k.kp + 'Bite')) : k.dmg);
          e.touch = k.kp ? kr(k.kp + 'BiteCd') : 0.9;
        }

        // firing. A turret with a wind-up shows the ring first and only shoots if it
        // still has a line on you when the ring closes.
        if (k.act === 'shoot' || k.act === 'turret') {
          if (e.charge > 0) {
            e.charge -= dt;
            if (e.charge <= 0) fireEnemyShot(e, pcx, pcy);
          } else if (!p.dead && dist < k.range * sees && e.cd <= 0) {
            e.cd = 0.4;   // re-check soon if we can't see the player
            if (lineOfSight(e.x, e.ty, pcx, pcy)) {
              e.cd = k.cd * (0.85 + Math.random() * 0.3);
              if (!e.spotted) { e.spotted = true; SFX.creature(k, 'alert', e.x, e.ty); }
              if (k.tele) { e.charge = k.tele; SFX.creature(k, 'charge', e.x, e.ty, k.tele); } else fireEnemyShot(e, pcx, pcy);
            }
          }
        }
      }
      // Contact Damage: anything touching you is hurt for it, whether or not it's hunting
      if (pb.contact && !p.dead) {
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          if (Math.hypot(e.x - pcx, e.ty - pcy) < e.r + 12) damageEnemy(i, 45 * dt);
        }
      }

      for (let i = enemyShots.length - 1; i >= 0; i--) {
        const b = enemyShots[i];
        b.life -= dt;
        // Projectile Repulsion Field: shots on their way to you are shoved aside
        if (pb.repel) {
          const rx = b.x - pcx, ry = b.y - pcy, rd = Math.hypot(rx, ry) || 1;
          if (rd < 72) { b.vx += rx / rd * 1100 * dt; b.vy += ry / rd * 1100 * dt; }
        }
        // poison spit drips as it flies
        if (b.drip) for (b.da += b.drip * dt; b.da >= 1; b.da--)
          goo(b.x + (Math.random() - 0.5) * b.size, b.y + b.size * 0.5, b.vx * 0.08, 8 + Math.random() * 18, b.dripG, b.dripCol || b.col, 0, b.dripCol2);
        let gone = b.life <= 0;
        if (b.fire) fireArea(fire, b.x, b.y, 4, 0.5);
        const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
        for (let s = 0; s < sn && !gone; s++) {
          b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
          if (solidAt(b.x, b.y)) {
            gone = true;
            if (b.splat != null) splat(b, b.x - b.vx * dt / sn, b.y - b.vy * dt / sn);
            else SFX.fx('fizzle', b.x, b.y);
            if (b.fire) ignite(b.x - b.vx * dt / sn, b.y - b.vy * dt / sn, 8, 0.9);
            break;
          }
          if (!p.dead && b.x > p.x - 2 && b.x < p.x + PW + 2 && b.y > p.y - 2 && b.y < p.y + PH + 2) {
            gone = true;
            if (b.splat != null) splat(b, b.x, b.y); else burst(b.x, b.y, 5, COL.player);
            hurt(b.dmg);
            if (b.fire) youAlight();
          }
        }
        if (gone) enemyShots.splice(i, 1);
      }
      // spider strings in flight: rock stops them, you catch them
      for (let i = silk.length - 1; i >= 0; i--) {
        const b = silk[i];
        b.life -= dt;
        let gone = b.life <= 0;
        const sn = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 2);
        for (let s = 0; s < sn && !gone; s++) {
          b.x += b.vx * dt / sn; b.y += b.vy * dt / sn;
          if (solidAt(b.x, b.y)) { gone = true; break; }
          if (!p.dead && b.x > p.x - 3 && b.x < p.x + PW + 3 && b.y > p.y - 3 && b.y < p.y + PH + 3) {
            gone = true;
            strings.push({ ax: b.ax, ay: b.ay, ox: b.x - p.x, oy: b.y - p.y, slow: spr('spSlow'), max: spr('spSilkMax') });
            SFX.fx('lash', b.x, b.y);
          }
        }
        if (gone) silk.splice(i, 1);
      }
      // strings on you: pulled past their length, they snap
      for (let i = strings.length - 1; i >= 0; i--) {
        const s = strings[i];
        if (Math.hypot(p.x + s.ox - s.ax, p.y + s.oy - s.ay) > s.max) {
          strings.splice(i, 1);
          burst(p.x + s.ox, p.y + s.oy, 4, '#e8e8f0');
          SFX.fx('lash', p.x + s.ox, p.y + s.oy);
        }
      }
      // a web line whose rock has been blasted away comes down (a few checked a frame)
      for (let n = Math.min(webs.length, 6); n > 0; n--) {
        webCheck = (webCheck + 1) % webs.length;
        const L = webs[webCheck];
        if ((L.bin && !solidAt(L.bin.x, L.bin.y)) || (L.ain && !solidAt(L.ain.x, L.ain.y))) {
          webs.splice(webCheck, 1);
          if (!webs.length) break;
        }
      }
      p.hitT -= dt;

      // ---- Angry Ghost: a spirit that trails you and fires at what's nearest ----
      if (pb.ghost) {
        if (!ghost) ghost = { x: pcx, y: pcy, cd: 0 };
        const gtx = pcx - p.face * 22, gty = p.y - 4;
        const lp = Math.min(1, dt * 4);
        ghost.x += (gtx - ghost.x) * lp; ghost.y += (gty - ghost.y) * lp;
        ghost.cd -= dt;
        if (ghost.cd <= 0 && !p.dead) {
          let best = null, bd = 340;
          for (const e of enemies) { const d = Math.hypot(e.x - ghost.x, e.ty - ghost.y); if (d < bd) { bd = d; best = e; } }
          if (best) {
            ghost.cd = 0.7;
            const a = Math.atan2(best.ty - ghost.y, best.x - ghost.x);
            bullets.push({ x: ghost.x, y: ghost.y, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480,
              life: 1.2, dmg: 2 * pb.dmg, size: 2, col: '#c9a6ff', spin: 0, homing: 3, bounce: 0,
              pierce: 0, explode: 0, grav: 0, accel: 0, bore: 0, hit: null, knock: 0, crit: 0,
              age: 0, born: 1.2 });
            SFX.fx('ghost', ghost.x, ghost.y);
          }
        }
      } else ghost = null;

      // ---- fire: the cave's, the creatures', yours ----
      fireFrame(dt, pcx, pcy);

      // ---- Levitation Trail: flying lays down fire that burns what it touches ----
      if (pb.trail && p.flame > 0 && !p.dead) {
        const bn = { x: pcx + (Math.random() - 0.5) * 6, y: p.y + PH, life: 0.7, max: 0.7 };
        burns.push(bn);
        if (burns.length > 48) burns.shift();
        fireArea(fire, bn.x, bn.y + 2, 4, 0.4);
      }
      for (let i = burns.length - 1; i >= 0; i--) {
        const bn = burns[i]; bn.life -= dt;
        for (let j = enemies.length - 1; j >= 0; j--)
          if (Math.hypot(enemies[j].x - bn.x, enemies[j].ty - bn.y) < 15) { setAlight(enemies[j]); damageEnemy(j, 22 * dt); }
        if (bn.life <= 0) burns.splice(i, 1);
      }

      // ---- jetpack smoke ----
      if (p.flame > 0) {
        let fx = -p.jx, fy = -p.jy + 0.8;
        const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
        smokeAcc += dt * (25 + 35 * p.flame);
        while (smokeAcc >= 1) {
          smokeAcc--;
          smoke.push({ x: pcx + (Math.random() - 0.5) * 5, y: p.y + PH + 3,
            vx: fx * 50 + (Math.random() - 0.5) * 20, vy: fy * 50 + (Math.random() - 0.5) * 20,
            r: 1.5 + Math.random(), life: 0.9, max: 0.9 });
        }
      }
      for (let i = smoke.length - 1; i >= 0; i--) {
        const m = smoke[i];
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.vx *= 1 - 2.5 * dt; m.vy = m.vy * (1 - 2.5 * dt) - 12 * dt;
        m.r += 5 * dt; m.life -= dt;
        if (m.life <= 0) smoke.splice(i, 1);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const q = sparks[i];
        q.vy += (q.g != null ? q.g : q.heavy ? 600 : 300) * dt;
        const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
        if (q.heavy && solidAt(nx, ny)) { q.vx *= 0.3; q.vy = 0; }
        else { q.x = nx; q.y = ny; }
        q.life -= dt;
        if (q.life <= 0) sparks.splice(i, 1);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].t += dt;
        if (flashes[i].t > 0.25) flashes.splice(i, 1);
      }

      best = Math.max(best, Math.round((start.y - p.y) / 10));

      // ---- the torch ----
      // A random walk with two sines on top, which is what makes a flame gutter rather
      // than pulse. It never goes above 1: flicker means the light dipping, and a canvas
      // globalAlpha over 1 is simply ignored.
      torchT += dt;
      flickN += (Math.random() - 0.5) * 2.6 * dt;
      flickN *= 0.94;
      flick = clamp(0.94 + flickN + 0.04 * Math.sin(torchT * 11.3) + 0.025 * Math.sin(torchT * 19.7),
        0.84, 1);
      torchAcc += dt;
      while (torchAcc > 0.04) {
        torchAcc -= 0.04;
        const th = torchHand();
        const life = 0.3 + Math.random() * 0.35;
        torchP.push({ x: th.x + (Math.random() - 0.5) * 2, y: th.y - 7,
          vx: (Math.random() - 0.5) * 10 + p.vx * 0.15, vy: -20 - Math.random() * 22,
          life, max: life, s: 1 + Math.random() * 1.3,
          c: Math.random() < 0.5 ? COL.flame2 : COL.flame });
        if (torchP.length > 60) torchP.shift();
      }
      for (let i = torchP.length - 1; i >= 0; i--) {
        const q = torchP[i];
        q.vy += 30 * dt; q.vx *= 0.98;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if ((q.life -= dt) <= 0) torchP.splice(i, 1);
      }
      // the flame's lean: spring toward "opposite your velocity", so a sudden move flings
      // it back and it wobbles upright again when you stop
      const wantX = clamp(-p.vx * 0.055, -11, 11), wantY = clamp(-p.vy * 0.03, -5, 7);
      leanVX += ((wantX - leanX) * 90 - leanVX * 9) * dt;
      leanVY += ((wantY - leanY) * 90 - leanVY * 9) * dt;
      leanX += leanVX * dt; leanY += leanVY * dt;
      // the glow gets its own quicker, deeper flicker on top of flick (the map light is untouched)
      glowN += (Math.random() - 0.5) * 6 * dt; glowN *= 0.9;

      // ---- portal motes ----
      portalAcc += dt;
      while (portalAcc > 0.05) {
        portalAcc -= 0.05;
        const ex = portal.x + portal.w / 2, ey = portal.y + portal.h / 2;
        if (Math.abs(ey - p.y) < 500) {        // the exit: scattered round it, drawn in
          const a = Math.random() * 6.28, rr = 30 + Math.random() * 38;
          const life = 1.4 + Math.random() * 0.8;
          motes.push({ kind: 'in', x: ex + Math.cos(a) * rr, y: ey + Math.sin(a) * rr * 0.9,
            tx: ex, ty: ey, vx: 0, vy: 0, life, max: life, age: 0, ph: Math.random() * 6.28,
            s: 1 + Math.random() * 1.4, c: Math.random() < 0.4 ? '#c8ffe4' : COL.portal });
        }
        if (Math.abs(arrival.y - p.y) < 500) { // the way in: breathed out, drifting away
          const a = Math.random() * 6.28, sp = 10 + Math.random() * 16;
          motes.push({ kind: 'out', x: arrival.x + (Math.random() - 0.5) * 12,
            y: arrival.y + (Math.random() - 0.5) * 18, ox: arrival.x, oy: arrival.y,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, life: 4, max: 4, age: 0,
            ph: Math.random() * 6.28, fade: 34 + Math.random() * 18,
            s: 1 + Math.random() * 1.3, c: Math.random() < 0.4 ? '#e6d4ff' : COL.enemy });
        }
      }
      for (let i = motes.length - 1; i >= 0; i--) {
        const q = motes[i];
        q.age += dt;
        if (q.kind === 'in') {
          // accelerate toward the centre, with a sideways wobble so it spirals in unevenly
          const dx = q.tx - q.x, dy = q.ty - q.y, d = Math.hypot(dx, dy) || 1;
          const pullF = 70 + 260 * q.age;
          q.vx += dx / d * pullF * dt; q.vy += dy / d * pullF * dt;
          q.vx *= 1 - 2.2 * dt; q.vy *= 1 - 2.2 * dt;
          const w = Math.sin(q.age * 7 + q.ph) * 26;
          q.x += (q.vx - dy / d * w) * dt; q.y += (q.vy + dx / d * w) * dt;
          if (d < 3) q.life = 0;
        } else if (q.kind === 'out') {
          const w = Math.sin(q.age * 2.3 + q.ph);
          q.vx += w * 18 * dt; q.vy += (Math.cos(q.age * 1.7 + q.ph) * 12 - 3) * dt;
          q.vx *= 1 - 0.4 * dt; q.vy *= 1 - 0.4 * dt;
          q.x += q.vx * dt; q.y += q.vy * dt;
          if (Math.hypot(q.x - q.ox, q.y - q.oy) > q.fade) q.life = 0;
        } else {
          q.vx *= 1 - 1.8 * dt; q.vy = q.vy * (1 - 1.8 * dt) - 6 * dt;
          q.x += q.vx * dt; q.y += q.vy * dt;
        }
        if ((q.life -= dt) <= 0) motes.splice(i, 1);
      }
      if (motes.length > 400) motes.splice(0, motes.length - 400);
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      // the controls overlay the bottom of the canvas (see-through), so the play area is the
      // part above them: scale and frame to that, but still draw (and cull) the full canvas
      const ctlPx = Math.min(c.height * 0.8, (RPV ? RPV.panelH || 0 : input.current.ctlH || 0) * dpr);   // a replay: its panel
      const playPx = c.height - ctlPx;
      const s = Math.min(c.width / VIEW_W, playPx / VIEW_MIN_H) * DEV.zoom * (RPV ? RPV.zoom : 1), vw = c.width / s, vh = c.height / s;
      const vhp = playPx / s;
      unitPx = s / dpr;
      const pcx = p.x + PW / 2, pcy = p.y + PH / 2;

      // camera (a replay's is wherever the viewer has dragged it, or on you)
      if (RPV) {
        if (RPV.follow) {                     // framed on you like the live camera, then kept as the centre
          RPV.cx = vw >= WW ? WW / 2 : clamp(RPV.cx - vw / 2, 0, WW - vw) + vw / 2;
          RPV.cy = clamp(RPV.cy - vhp * 0.55, 0, Math.max(0, WH - vhp)) + vhp / 2;
        }
        camX = RPV.cx - vw / 2; camY = RPV.cy - vhp / 2; RPV.unit = unitPx;
      } else {
        const tx = vw >= WW ? (WW - vw) / 2 : clamp(pcx - vw / 2, 0, WW - vw);
        const ty = clamp(pcy - vhp * 0.55, 0, Math.max(0, WH - vhp));
        if (!camReady) { camX = tx; camY = ty; camReady = true; }
        camX += (tx - camX) * 0.15;
        camY += (ty - camY) * 0.15;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgb(' + themeFor(floor).bg.join(',') + ')';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(s, 0, 0, s, -Math.round(camX * s), -Math.round(camY * s));

      // background and terrain (visible part only)
      // The background sits further back: it slides PARALLAX as far as the terrain does, so
      // it is shifted by the rest of the camera move. It still covers the view at every edge,
      // because the shift only ever pushes it toward the camera.
      const PARALLAX = 0.8;
      const bgox = camX * (1 - PARALLAX), bgoy = camY * (1 - PARALLAX);
      const bcx = camX - bgox, bcy = camY - bgoy;
      const bx0 = clamp(Math.floor(bcx / BCELL), 0, BW - 1), by0 = clamp(Math.floor(bcy / BCELL), 0, BH - 1);
      const bx1 = clamp(Math.ceil((bcx + vw) / BCELL) + 1, 1, BW), by1 = clamp(Math.ceil((bcy + vh) / BCELL) + 1, 1, BH);
      ctx.drawImage(bg, bx0, by0, bx1 - bx0, by1 - by0, bx0 * BCELL + bgox, by0 * BCELL + bgoy, (bx1 - bx0) * BCELL, (by1 - by0) * BCELL);
      // the shop's back wall
      if (camY + vh > SHOP_Y) {
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
        const label = 'FLOOR ' + floor;
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.font = '800 ' + Math.round(wallH * 0.62) + 'px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const margin = WW * 0.05, span = WW - margin * 2, cyText = SHOP_Y + wallH / 2 + 4;
        for (let i = 0; i < label.length; i++)
          ctx.fillText(label[i], margin + span * (i + 0.5) / label.length, cyText);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
      }

      const tx0 = clamp(Math.floor(camX / CELL), 0, CW - 1), ty0 = clamp(Math.floor(camY / CELL), 0, CH - 1);
      const tx1 = clamp(Math.ceil((camX + vw) / CELL) + 1, 1, CW), ty1 = clamp(Math.ceil((camY + vh) / CELL) + 1, 1, CH);
      viewW = vw; viewH = vh;
      // the decoration layer (pass 2): behind the rock, in front of the back wall
      ctx.drawImage(RPV ? RT.dC : decoC, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
      ctx.drawImage(RPV ? RT.tC : terrain, tx0, ty0, tx1 - tx0, ty1 - ty0, tx0 * CELL, ty0 * CELL, (tx1 - tx0) * CELL, (ty1 - ty0) * CELL);
      // the burning pixels, over the art they're eating: colour by how much fuel is left, and a
      // new flicker each fire tick. Drawn under the fog, so fire you haven't seen stays hidden;
      // the glow on top comes after the fog, only on ground you have seen (fireVis).
      fireVis.length = 0;
      if (fire.list.length) {
        const buckets = [[], [], [], []];
        for (const i of fire.list) {
          const x = i % CW, y = (i / CW) | 0;
          if (x < tx0 || x >= tx1 || y < ty0 || y >= ty1) continue;
          fireVis.push(i);
          const t = fire.t[i], h = (Math.imul(i, 2654435761) + fireN * 40503) >>> 30;
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
      const TH = themeFor(floor);
      const onView = (x, y, m) => x > camX - m && x < camX + vw + m && y > camY - m && y < camY + vh + m;
      for (const pr of props)
        if (pr.x + pr.r > camX - 70 && pr.x + pr.l < camX + vw + 70 && pr.y + pr.b > camY - 90 && pr.y + pr.t0 < camY + vh + 90)
          drawProp(ctx, pr, time, TH);
      for (const q of dparts) {
        if (q.glow) continue;
        ctx.globalAlpha = Math.min(1, q.life / q.max * 3);
        ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.lineWidth = 0.8;
      for (const q of amb) {
        if (q.glow) continue;
        ctx.globalAlpha = Math.min(1, q.life);
        if (q.streak) {
          ctx.strokeStyle = q.c; ctx.beginPath();
          ctx.moveTo(q.x - Math.sign(q.vx) * q.streak, q.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        } else { ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
      }
      ctx.fillStyle = rgbA(mix(TH.rock[1], [255, 255, 255], 0.2));
      for (const dv of devils) {                          // a dust devil: a funnel of grit
        ctx.globalAlpha = 0.7 * Math.min(1, dv.life / 1.5, (dv.max - dv.life) / 1);
        for (let k = 0; k < 24; k++) {
          const hh = k / 24 * 30, r = 1.5 + hh * 0.35, a = time * 10 + k * 1.1;
          ctx.fillRect(dv.x + Math.cos(a) * r + Math.sin(time * 3 + k) - 0.6, dv.y - hh - 0.6, 1.2, 1.2);
        }
      }
      for (const cl of clouds) {                          // a burst pod's spore cloud
        const a = Math.min(1, cl.life / 1.5) * 0.28;
        for (let k = 0; k < 5; k++) {
          const ang = k * 1.26 + time * 0.6, rr = cl.r * 0.45;
          ctx.globalAlpha = a; ctx.fillStyle = '#a8d85a';
          ctx.beginPath(); ctx.arc(cl.x + Math.cos(ang) * rr, cl.y + Math.sin(ang) * rr * 0.7, cl.r * 0.6, 0, 6.29); ctx.fill();
        }
      }
      for (const rg of rings) {                           // a noise going out
        ctx.globalAlpha = 1 - rg.t / 0.9; ctx.strokeStyle = '#f0e6ff'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(rg.x, rg.y, 8 + rg.t * 140, 0, 6.29); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // exit portal: a glowing pool with a slow swirl of dashes round its rim
      const pulse = 0.55 + 0.25 * Math.sin(time * 3);
      const pcxE = portal.x + portal.w / 2, pcyE = portal.y + portal.h / 2;
      ctx.globalAlpha = pulse * 0.35;
      ctx.fillStyle = COL.portal;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, portal.w, portal.h * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = pulse;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, portal.w / 2, portal.h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#d8fff0';
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, portal.w * 0.22, portal.h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#c8ffe4'; ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 5]); ctx.lineDashOffset = time * 12;
      ctx.beginPath(); ctx.ellipse(pcxE, pcyE, portal.w * 0.62, portal.h * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // smoke
      for (const m of smoke) {
        ctx.fillStyle = m.c || COL.smoke;
        ctx.globalAlpha = Math.max(0, m.life / m.max) * (m.a || 0.5);
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // static fields
      for (const f of fields) {
        if (f.y > camY + vh + f.r || f.y < camY - f.r) continue;
        const t = f.life / f.max;
        const beat = 0.75 + 0.25 * Math.sin(time * (f.field === 'mine' ? 7 : 3));
        ctx.globalAlpha = 0.14 * beat * (f.field === 'mine' || f.field === 'dormant' ? 2 : 1);
        ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (f.field === 'mine' ? 0.35 : 1), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.55 * beat;
        ctx.strokeStyle = f.col;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -time * 14;
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
          if (Math.sin(time * bl) > 0.3) { ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.fillRect(f.x - 0.6, f.y - 0.6, 1.2, 1.2); }
        } else if (f.field === 'dormant') {     // a dull orange crystal
          dia(3, '#b86a1c', '#ffd08a');
        } else if (f.field === 'slow') {        // an ice-white star
          ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 0.8;
          ctx.beginPath();
          for (let k = 0; k < 3; k++) { const a = k * 1.047 + time * 0.4; ctx.moveTo(f.x - Math.cos(a) * 4, f.y - Math.sin(a) * 4); ctx.lineTo(f.x + Math.cos(a) * 4, f.y + Math.sin(a) * 4); }
          ctx.stroke();
        } else if (f.field === 'shield') {      // two shimmering arcs turning against each other
          ctx.strokeStyle = f.col; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7 * beat;
          for (const [a0, sgn] of [[time * 1.3, 1], [-time * 1.7, -1]]) {
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (sgn > 0 ? 0.92 : 0.84), a0, a0 + 2.2); ctx.stroke();
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (sgn > 0 ? 0.92 : 0.84), a0 + 3.14, a0 + 5.3); ctx.stroke(); }
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#d8f0ff'; ctx.beginPath(); ctx.arc(f.x, f.y, 2.5, 0, 6.283); ctx.fill();
        } else if (f.field === 'heal') {        // a green cross
          ctx.fillStyle = f.col; ctx.fillRect(f.x - 1.2, f.y - 4, 2.4, 8); ctx.fillRect(f.x - 4, f.y - 1.2, 8, 2.4);
        } else if (f.field === 'storm') {       // the cloud itself, over the top of the circle, with rain under it
          const cy = f.y - f.r * 0.85, t = Math.min(1, (f.max - f.life) * 3, f.life * 2);
          ctx.globalAlpha = 0.85 * t;
          for (let k = 0; k < 7; k++) { const ox = (k - 3) * f.r * 0.28, oy = Math.sin(k * 1.7 + time * 0.8) * 2.5;
            ctx.fillStyle = k % 2 ? '#3a3e4a' : '#4c5160';
            ctx.beginPath(); ctx.arc(f.x + ox, cy + oy, f.r * (0.22 + 0.08 * Math.sin(k * 2.3)), 0, 6.283); ctx.fill(); }
          ctx.globalAlpha = 0.35 * t; ctx.strokeStyle = '#9ec8ff'; ctx.lineWidth = 0.6;
          ctx.beginPath();
          for (let k = 0; k < 18; k++) { const x = f.x + (((k * 37.3 + time * 15) % (f.r * 1.8)) - f.r * 0.9),
            y = cy + ((k * 23.7 + time * 160) % (f.r * 1.7));
            ctx.moveTo(x, y); ctx.lineTo(x - 0.6, y + 4); }
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (f.field === 'glitter') {     // twinkling violet motes all over
          for (let k = 0; k < 10; k++) { const a = k * 2.4 + time * 0.3, r = f.r * ((k * 0.37) % 1);
            const tw = Math.sin(time * 9 + k * 1.3); if (tw < 0.2) continue;
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
      for (const L of webs) { ctx.moveTo(L.a0x, L.a0y); ctx.lineTo(L.b0x, L.b0y); }
      for (const e of enemies) {
        const sh = e.sp && e.sp.mode === 'shoot' && e.sp.shot;
        if (sh) { ctx.moveTo(sh.ax0, sh.ay0); ctx.lineTo(sh.x + sh.dx * Math.min(sh.t, sh.len), sh.y + sh.dy * Math.min(sh.t, sh.len)); }
      }
      ctx.stroke();
      ctx.globalAlpha = 0.85; ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (const b of silk) { ctx.moveTo(b.ax, b.ay); ctx.lineTo(b.x, b.y); }
      for (const s of strings) { ctx.moveTo(s.ax, s.ay); ctx.lineTo(p.x + s.ox, p.y + s.oy); }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // enemies
      for (const e of enemies) {
        const ey = e.ty;
        if (ey > camY + vh + 20 || ey < camY - 20 || e.x < camX - 20 || e.x > camX + vw + 20) continue;
        drawEnemy(ctx, e, time);
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
          const tw = Math.sin(time * 40) > 0;
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
          if (Math.sin(time * 12) > 0) dot(b.x + ux * s * 1.2, b.y + uy * s * 1.2, 0.9, '#ff3a2a', 1);
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
      for (const b of enemyShots) {
        if (b.goo) {                           // poison spit: a wobbling glob with a wet highlight
          const s = b.size, wob = 1 + 0.12 * Math.sin(time * 30 + b.x * 0.1);
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
      for (const b of bullets) {
        if (b.hidden) continue;                 // Buzzsaw cuts without drawing a circle
        if (b.pull) {                           // Black Hole: purple haze, starry black core
          const r = b.size, core = b.eat || r * 0.78, beat = 1 + 0.06 * Math.sin(time * 6 + b.spin);
          const g = ctx.createRadialGradient(b.x, b.y, core * 0.8, b.x, b.y, r * 1.55 * beat);
          g.addColorStop(0, 'rgba(197,140,255,0.75)');
          g.addColorStop(0.3, 'rgba(150,90,255,0.35)');
          g.addColorStop(1, 'rgba(110,50,220,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.55 * beat, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#050208';
          ctx.beginPath(); ctx.arc(b.x, b.y, core, 0, Math.PI * 2); ctx.fill();
          for (let k = 0; k < 14; k++) {       // twinkling stars wheeling inside
            const tw = Math.sin(time * 8 + k * 1.7);
            if (tw < 0.1) continue;
            const ang = k * 2.4 + time * (0.5 + (k % 3) * 0.35), rad = core * (0.15 + ((k * 0.37) % 0.75));
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
      for (const a of arcs) drawBolt(a.pts, a.col, a.w, 1 - a.t / a.max);
      // instant beams, which fade over a few frames
      for (const bm of beams) {
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
      if (arrival.y < camY + vh + 40 && arrival.y > camY - 40) {
        const sway = 0.5 + 0.18 * Math.sin(time * 1.6);
        ctx.fillStyle = '#4a4550';
        ctx.fillRect(arrival.x - 16, arrival.y + 12, 32, 5);
        ctx.globalAlpha = 0.22 * sway;
        ctx.fillStyle = COL.enemy;
        ctx.beginPath(); ctx.ellipse(arrival.x, arrival.y, 17, 21, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.5 * sway;
        ctx.beginPath(); ctx.ellipse(arrival.x, arrival.y, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#6c6480'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(arrival.x, arrival.y, 13, 17, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(233,236,242,0.34)';
        ctx.font = '600 7px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WAY IN', arrival.x, arrival.y - 22);
        ctx.textAlign = 'left';
      }

      // shop stock on its plinths
      for (const it of stock) {
        if (it.y > camY + vh + 40 || it.y < camY - 40) continue;
        const bob = Math.sin(time * 2 + it.x) * 2;
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
      for (const g of coins) {
        if (g.y > camY + vh + 30 || g.y < camY - 30) continue;
        const bob = Math.sin(time * 4 + g.t) * 1.5;
        ctx.fillStyle = '#d8a52a';
        ctx.beginPath(); ctx.ellipse(g.x, g.y + bob, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.ellipse(g.x - 0.8, g.y - 0.8 + bob, 1.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      }

      // pickups
      for (const q of pickups) {
        const qy = q.y + Math.sin(time * 2 + q.t) * 3;
        if (qy > camY + vh + 30 || qy < camY - 30 || q.x < camX - 30 || q.x > camX + vw + 30) continue;
        if (q.kind === 'gun') {
          // a gun you've never held glows, with sparks streaking out of it; one you swapped
          // out and left on the ground doesn't, so you can tell new from discarded at a glance
          if (!q.old) drawGunGlow(ctx, q.x, qy, time, q.t);
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
      for (const r of rooms) {
        if (r.taken) continue;
        if (r.y > camY + vh + 40 || r.y < camY - 40 || r.x < camX - 40 || r.x > camX + vw + 40) continue;
        const bob = Math.sin(time * 2 + r.x) * 2.5;
        ctx.fillStyle = '#4a4550';
        ctx.fillRect(r.x - 12, r.y + 14, 24, 5);
        ctx.fillRect(r.x - 7, r.y + 5, 14, 10);
        if (r.kind === 'perk') {
          const pk = PERKS[r.id], col = pk.tint || COL.portal;
          ctx.globalAlpha = 0.22 + 0.12 * Math.sin(time * 3);
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(r.x, r.y + bob, 16, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = col;
          ctx.font = '700 20px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(pk.glyph, r.x, r.y + 0.5 + bob);
          ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
        } else {
          ctx.globalAlpha = 0.25 + 0.12 * Math.sin(time * 3);
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
      for (const bn of burns) {
        const t = bn.life / bn.max;
        ctx.globalAlpha = t * 0.8;
        ctx.fillStyle = t > 0.5 ? COL.flame2 : COL.flame;
        ctx.beginPath(); ctx.arc(bn.x, bn.y, 3 + (1 - t) * 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // sparks and debris
      for (const q of sparks) {
        ctx.fillStyle = q.c;
        ctx.globalAlpha = Math.max(0, q.life / q.max);
        ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      }
      ctx.globalAlpha = 1;

      // magic motes: the Black Hole's trail and the portals' drift, added on as light
      ctx.globalCompositeOperation = 'lighter';
      for (const q of motes) {
        if (q.y > camY + vh + 20 || q.y < camY - 20) continue;
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
      for (const f of flashes) {
        const t = f.t / 0.25;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = COL.flame;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + 0.5 * t), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.35 + 0.3 * t), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // jet flame
      if (p.flame > 0) {
        let fx = -p.jx, fy = -p.jy + 0.8;
        const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
        const len = 6 + p.flame * 16 + Math.random() * 3;
        const bx = pcx, by = p.y + PH - 2;
        ctx.fillStyle = COL.flame;
        ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by); ctx.lineTo(bx + fx * len, by + fy * len); ctx.fill();
        ctx.fillStyle = COL.flame2;
        ctx.beginPath(); ctx.moveTo(bx - 2, by); ctx.lineTo(bx + 2, by); ctx.lineTo(bx + fx * len * 0.55, by + fy * len * 0.55); ctx.fill();
      }

      // aim, grenade arc preview, gun
      const R = p.aim;
      const held = input.current.loadout.guns[input.current.loadout.sel];
      const ax = R.show ? R.nx : p.face, ay = R.show ? R.ny : 0;
      const gy = p.y + PH * 0.52;

      // where the next pull actually goes, mods and all — only with the Trajectory Sight perk
      const tvis = R.vis == null ? 1 : R.vis;
      if (!RPV && !p.dead && R.show && held && pb.trajectory && tvis > 0) {
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
          const tsh = Object.assign({}, sh, { bounce: sh.bounce + pb.bounce,
            homing: Math.max(sh.homing, pb.homing), speed: sh.speed * pb.speed * bhSp(sh) });
          for (const off of cone) {
            const a = Math.atan2(R.ny, R.nx) + off * Math.PI / 180;
            tracePath(tsh, pcx, gy, Math.cos(a), Math.sin(a), solidAt, enemies, aimPath,
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
      if (p.dead) ctx.globalAlpha = 0.35;
      const flashing = p.hitT > 0 && Math.floor(p.hitT * 30) % 2 === 0;
      const running = p.onGround && Math.abs(p.vx) > 15;
      const gait = running ? Math.sin(time * 15) : 0;
      drawRunner(ctx, p.x, p.y, PW, PH, p.face, gait, !p.onGround, p.flame, flashing);
      if (!p.dead) drawGun(ctx, pcx + ax * 2.5, gy, Math.atan2(ay, ax), 0.55, gunAccent(held));
      // the torch, in the hand the gun is not in
      if (!p.dead) { const th = torchHand(); drawTorch(ctx, th.x, th.y, ax >= 0 ? -1 : 1, flick, torchP, leanX, leanY, time); }
      // a small aim crosshair at DEV.aimDist out, rotating round you with the aim: a "+"
      // with the centre cut out (two short verticals, two short horizontals), drawn as thin
      // as the thumbstick lines (~1.5 css px, so 1.5/unitPx world units, whatever the zoom)
      if (!p.dead) {
        const cxp = pcx + ax * DEV.aimDist, cyp = gy + ay * DEV.aimDist;
        const inr = 1.25, outr = 3;            // gap radius, arm end (half the v55 size)
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = 1.5 / unitPx;
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
      if (pb.shield && p.shieldReady && !p.dead) {
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 4);
        ctx.strokeStyle = '#7ad7ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pcx, pcy, PW * 1.15, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Angry Ghost: a pale wisp that drifts at your shoulder
      if (pb.ghost && ghost && !p.dead) {
        const gb = Math.sin(time * 3) * 2;
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#c9a6ff';
        ctx.beginPath(); ctx.arc(ghost.x, ghost.y + gb, 6, Math.PI, 0);
        ctx.lineTo(ghost.x + 6, ghost.y + gb + 6);
        ctx.lineTo(ghost.x + 2, ghost.y + gb + 4);
        ctx.lineTo(ghost.x - 2, ghost.y + gb + 6);
        ctx.lineTo(ghost.x - 6, ghost.y + gb + 4);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#3a2f52';
        ctx.fillRect(ghost.x - 3, ghost.y + gb - 1, 1.6, 2.4);
        ctx.fillRect(ghost.x + 1.4, ghost.y + gb - 1, 1.6, 2.4);
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
      torchR = clamp(sight * LAMP_REACH * (0.5 + 0.55 * flick), 120, 1400);
      visPts = visPoly(pcx, pcy, sight, solidCell, VIS_RAYS);
      fogReveal(seen, pcx, pcy, sight, visPts, VIS_RAYS);   // line of sight lifts the fog
      if (!RPV || RPV.fog) {                                 // a replay can turn the fog off
        // bake the visible slab of the overlay every frame: the base darkness is the fog
        // state, then the lamp brightens the cells the fog has already been lifted from
        const fdat = fogImg.data;
        const dim = Math.round(255 * DEV.fogDim), dark = Math.round(255 * DEV.fogDark);
        const lr2 = torchR * torchR;
        const fx0 = clamp(Math.floor(camX / FOG_U) - 1, 0, FW - 1), fy0 = clamp(Math.floor(camY / FOG_U) - 1, 0, FH - 1);
        const fx1 = clamp(Math.ceil((camX + vw) / FOG_U) + 2, 1, FW), fy1 = clamp(Math.ceil((camY + vh) / FOG_U) + 2, 1, FH);
        for (let cy = fy0; cy < fy1; cy++) {
          const ddy = (cy + 0.5) * FOG_U - pcy;
          for (let cx = fx0; cx < fx1; cx++) {
            const i = cy * FW + cx, k = i * 4;
            fdat[k] = 9; fdat[k + 1] = 10; fdat[k + 2] = 14;
            let s = seen[i];
            // push the dark off ground you have seen: an unseen cell that borders a seen one
            // is treated as remembered (dim + lamp), so a bit more of the uncovered surface
            // shows instead of the darkness sitting right on its edge
            if (!s && !(deepFog && deepFog[i]) && ((cx > 0 && seen[i - 1]) || (cx < FW - 1 && seen[i + 1]) ||
                (cy > 0 && seen[i - FW]) || (cy < FH - 1 && seen[i + FW]) ||
                (cx > 0 && cy > 0 && seen[i - FW - 1]) || (cx < FW - 1 && cy > 0 && seen[i - FW + 1]) ||
                (cx > 0 && cy < FH - 1 && seen[i + FW - 1]) || (cx < FW - 1 && cy < FH - 1 && seen[i + FW + 1]))) s = 1;
            let a = s === 2 ? 0 : s ? dim : dark;
            if (s && a) {                        // the lamp only reaches ground the fog has lifted
              const ddx = (cx + 0.5) * FOG_U - pcx, dd2 = ddx * ddx + ddy * ddy;
              if (dd2 < lr2) {
                const t = Math.sqrt(dd2) / torchR;               // 0 at your feet, 1 at the edge
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
      const gl = clamp(0.82 + glowN + 0.08 * Math.sin(time * 23) + 0.06 * Math.sin(time * 37), 0.5, 1.1);
      const scOn = sc => !(sc.y > camY + vh + 30 || sc.y < camY - 30 || sc.x < camX - 30 || sc.x > camX + vw + 30) &&
        fogLit(sc.x, sc.y);
      for (const sc of sconces) {
        if (!scOn(sc)) continue;
        const sg = 0.85 + 0.15 * Math.sin(time * 11 + sc.ph) * Math.sin(time * 5.3 + sc.ph);
        glowAt(ctx, sc.x, sc.y - 6, 34, 0.16 * sg, '255,140,50');
        glowAt(ctx, sc.x, sc.y - 7, 9, 0.45 * sg, '255,190,90');
      }
      // lit props and glowing motes, only where the fog has lifted — except the eyes, which
      // watch from the dark
      for (const pr of props) {
        if (!(pr.k === 'lamp' || pr.k === 'vent' || pr.k === 'shard' || pr.k === 'eyes' || pr.k === 'matter' ||
          (pr.k === 'drip' && pr.st === 'lava')) || !onView(pr.x, pr.y, 60)) continue;
        if (pr.k !== 'eyes' && !fogLit(pr.x, pr.y)) continue;
        propGlow(ctx, pr, time, TH, Math.hypot(pr.x - pcx, pr.y - pcy), torchR);
      }
      // and the green round each jelly glows and twinkles in its colour (plantGlow)
      for (const e of enemies)
        if (e.je && onView(e.x, e.ty, 160) && fogLit(e.x, e.ty)) plantGlow(e, TH);
      // glowing creatures (the jellyfish) light the cave round them, flaring as they pulse.
      // Radius, brightness and flare are its kp+'GlowR' / 'Glow' / 'Flare' knobs, and like
      // every other light out here it shows only where the fog has lifted
      for (const e of enemies) {
        const k = e.k;
        if (!k.glow || !k.kp || !onView(e.x, e.ty, 120) || !fogLit(e.x, e.ty)) continue;
        const u = (e.je && e.je.u) || { glowR: 0.5, glow: 0.5, flare: 0.5 }, sh = e.je ? e.je.shape : 0;
        const a = kru(k.kp + 'Glow', u.glow) * (1 + kru(k.kp + 'Flare', u.flare) * sh);
        const rgb = e.je ? hexRgb(jcol('jeColGlow', e.je.u.col)) : k.glow;
        glowAt(ctx, e.x, e.ty, kru(k.kp + 'GlowR', u.glowR), a, rgb);
        glowAt(ctx, e.x, e.ty, e.r * 1.6, a * 1.4, rgb);
      }
      for (const b of enemyShots) if (b.glow && onView(b.x, b.y, 30) && fogLit(b.x, b.y)) glowAt(ctx, b.x, b.y, b.size * 6, 0.3, b.glow);
      // v95: your glowing shots light the cave round them (the Bubble Spark most of all)
      for (const b of bullets) if (b.light && !b.hidden && onView(b.x, b.y, 50) && fogLit(b.x, b.y))
        glowAt(ctx, b.x, b.y, b.lightR || 20, 0.28, b.light);
      // fire: the burning pixels brighten and throw a warm glow — only on ground you have seen
      if (fireVis.length) {
        ctx.fillStyle = 'rgba(255,140,50,0.32)';
        ctx.beginPath();
        for (const i of fireVis) {
          const x = (i % CW) * CELL, y = ((i / CW) | 0) * CELL;
          if (seen[clamp(Math.floor(y / FOG_U), 0, FH - 1) * FW + clamp(Math.floor(x / FOG_U), 0, FW - 1)]) ctx.rect(x, y, CELL, CELL);
        }
        ctx.fill();
        const st = Math.max(1, Math.ceil(fireVis.length / 24));
        for (let k = fireN % st; k < fireVis.length; k += st) {
          const i = fireVis[k], x = (i % CW + 0.5) * CELL, y = (((i / CW) | 0) + 0.5) * CELL;
          if (fogLit(x, y)) glowAt(ctx, x, y, 20, Math.min(0.14, 0.03 + fireVis.length / 3000) * flick, '255,120,40');
        }
      }
      for (const e of enemies)
        if (e.burn > 0 && onView(e.x, e.ty, 40) && fogLit(e.x, e.ty)) glowAt(ctx, e.x, e.ty, e.r * 2.4, 0.22 * flick, '255,130,50');
      for (const pr of firePlants)
        if (pr.burn && !pr.gone && onView(pr.x, pr.y + pr.len, 40) && fogLit(pr.x, pr.y + pr.len))
          glowAt(ctx, pr.x, pr.y + pr.len, 16, 0.2 * flick, '255,130,50');
      if (p.burn > 0 && !p.dead) glowAt(ctx, p.x + PW / 2, p.y + PH / 2, 22, 0.25 * flick, '255,130,50');
      for (const list of [dparts, amb]) for (const q of list) {
        if (!q.glow || !onView(q.x, q.y, 10) || !fogLit(q.x, q.y)) continue;
        ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3));
        ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.globalAlpha = 1;
      if (!p.dead) {
        const th = torchHand(), gfx = th.x + (ax >= 0 ? -1 : 1) * 1.6, gfy = th.y - 11;
        glowAt(ctx, gfx, gfy, 70 * (0.9 + 0.1 * gl), 0.2 * gl, '255,150,60');            // the second light
        glowAt(ctx, gfx + leanX * 0.5, gfy + leanY * 0.5, 12, 0.5 * gl, '255,190,90');   // the halo
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const sc of sconces) if (scOn(sc)) drawSconce(ctx, sc.x, sc.y, time, sc.ph);
      if (RPV) return;                        // a replay frame has no HUD

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
      const MHP = maxHp();
      const gpas = held ? gunPassives(held) : null;
      // recharge / cast-delay "readiness": 1 when ready, dropping to 0 the moment it fires
      // and filling back over its own time — so the ring that spends the most time refilling
      // is the one gating your fire. Both normalise by their own max so the wipe is 0..1.
      const effRech = held ? Math.max(0.001, effRecharge(held) * pb.rech) : 1;
      input.current.hud = {
        hp: MHP > 0 ? Math.max(0, Math.min(1, p.hp / MHP)) : 0,
        low: p.hp <= 30,
        fuel: Math.max(0, Math.min(1, p.fuel)),
        empty: !!p.empty,
        mana: held ? Math.max(0, Math.min(1, held.mana / (held.manaMax + gpas.manaMax))) : 0,
        rech: held ? (held.rechT > 0 ? clamp(1 - held.rechT / effRech, 0, 1) : 1) : 0,
        cast: held ? (held.delayT > 0 && held.delayMax ? clamp(1 - held.delayT / held.delayMax, 0, 1) : 1) : 0,
        recharging: !!(held && held.rechT > 0),
        hasGun: !!held,
      };

      // ---- radar perks: point at the nearest enemy / mod / gun still out there ----
      if (pb.radarEnemy || pb.radarItem || pb.radarWand) {
        const cwv = c.width / dpr, chv = playPx / dpr, m = 18;
        const nearest = list => {
          let best = null, bd = 1e18;
          for (const t of list) { const d = (t.x - pcx) * (t.x - pcx) + ((t.ty || t.y) - pcy) * ((t.ty || t.y) - pcy); if (d < bd) { bd = d; best = t; } }
          return best;
        };
        const marker = (t, col) => {
          if (!t) return;
          const sx = (t.x - camX) * unitPx, sy = ((t.ty || t.y) - camY) * unitPx;
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
        if (pb.radarEnemy) marker(nearest(enemies), PERKS.eradar.tint);
        if (pb.radarItem) marker(nearest(pickups.filter(q => q.kind === 'mod')), '#b57cff');
        if (pb.radarWand) marker(nearest(pickups.filter(q => q.kind === 'gun')), COL.bullet);
      }

      // pickup messages
      ctx.textAlign = 'center';
      const ch = playPx / dpr;
      for (let i = 0; i < toasts.length; i++) {
        const tm = toasts[i];
        ctx.globalAlpha = Math.min(1, tm.t * 1.5);
        ctx.fillStyle = COL.text;
        ctx.font = '600 14px system-ui, sans-serif';
        ctx.fillText(tm.text, cw / 2, ch - 18 - (toasts.length - 1 - i) * 19);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';

      ctx.textAlign = 'center';
      if (levelT < 3) {
        ctx.fillStyle = COL.text;
        ctx.globalAlpha = Math.min(1, 3 - levelT);
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.fillText(themeFor(floor).name, cw / 2, 196);
        ctx.font = '500 14px system-ui, sans-serif';
        ctx.fillText('Find the green exit at the top', cw / 2, 218);
        ctx.fillText('Buy and fit mods here, then climb', cw / 2, 236);
        ctx.globalAlpha = 1;
      }
      const msgY = 196;
      ctx.fillStyle = COL.text;
      if (p.dead) {
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.fillText('You were shot down', cw / 2, msgY);
        ctx.font = '500 14px system-ui, sans-serif';
        ctx.fillText('Tap the right stick to restart', cw / 2, msgY + 22);
      } else if (enemies.length === 0) {
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
        for (let k = 0; k < miniEdgeIdx.length; k++) {
          const i = miniEdgeIdx[k];
          const tx = (i % MMW) * MINI_D, ty = ((i / MMW) | 0) * MINI_D;
          const fi = ((ty / FOG) | 0) * FW + ((tx / FOG) | 0);
          if (seen[fi]) mini32[i] = 0xe6ffffff;            // white, ~0.9 alpha
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
        for (const r of rooms) {
          if (!roomSeen(r)) continue;
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
        for (const q of pickups) {
          if (q.taken || !fogLit(q.x, q.y)) continue;
          const col = q.kind === 'gun' ? '#ffd23c' : '#46e07a';
          ctx.beginPath(); ctx.arc(mX(q.x), mY(q.y), 2.6, 0, Math.PI * 2);
          if (q.old) { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.stroke(); }
          else { ctx.fillStyle = col; ctx.fill(); }
        }
        // you: a bigger dot with a white rim, so it can't be mistaken for a gun
        ctx.fillStyle = '#ffd23c'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mX(p.x + PW / 2), mY(p.y + PH / 2), 4, 0, Math.PI * 2);
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
          const W = input.current.witness;
          if (rv.t >= W.t1) {                  // the end: round again, or stop there
            if (rv.loop) rv.t = W.t0; else { rv.t = W.t1; rv.playing = false; }
          }
        }
        SFX.tick();
        drawReplay(rv);
      } else {
        if (!input.current.paused) { step(dt); recFrame(dt); }
        SFX.tick();
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', resize);
      clearInterval(saveTick);
      if (jetLoop) jetLoop.stop();
      if (portalLoop) portalLoop.stop();
      if (matterLoop) matterLoop.stop();
      for (const h of bhLoops.values()) h.stop();
      document.removeEventListener('visibilitychange', saveHidden);
      window.removeEventListener('pagehide', saveRun);
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

// A new gun on the ground: a soft amber glow, breathing, with sparks streaking out of it
// (drawn before the gun, so they come from behind it). Each streak rides its own clock:
// born at the middle, flying out and fading, then round again at a fresh angle.
const GLOW_STREAKS = 9;
function drawGunGlow(ctx, x, y, time, seed) {
  const breathe = 0.85 + 0.15 * Math.sin(time * 2.6 + seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const R = 20 * breathe;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, 'rgba(255,201,60,0.55)');
  g.addColorStop(0.45, 'rgba(255,170,40,0.22)');
  g.addColorStop(1, 'rgba(255,140,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'round';
  for (let k = 0; k < GLOW_STREAKS; k++) {
    const ph = (time * 0.7 + k / GLOW_STREAKS + seed) % 1;
    const lap = Math.floor(time * 0.7 + k / GLOW_STREAKS + seed);
    const a = seed * 3.1 + k * 2.39996 + lap * 1.7;      // golden-angle spread, new angle each lap
    const r0 = 4 + ph * 18, len = 3 + 5 * (1 - ph);
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
    ctx.strokeStyle = k % 3 ? '#ffc93c' : '#fff1b8';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a) * (r0 + len), y + Math.sin(a) * (r0 + len));
    ctx.stroke();
  }
  ctx.restore();
}

// the circumference of the gauge ring (r=46 in a 0..100 viewBox), used to turn a 0..1
// fraction into a stroke-dasharray so the ring is drawn only as far as the stat reaches
const GAUGE_R = 46, GAUGE_C = 2 * Math.PI * GAUGE_R;
// the three gun stats shown as rings on the right stick and colour-coded in the bag, so a
// ring and its stat read as the same thing: mana gold, recharge blue, cast delay purple
const GAUGE_COL = { mana: '#ffc93c', rech: '#7ad7ff', cast: '#c58cff', fuel: '#ff9a2e' };
// green -> amber -> red as health falls, so the colour itself reads as danger
function healthCol(frac) {
  return frac > 0.5 ? mixHex('#e6a52c', '#57d267', (frac - 0.5) * 2)
                    : mixHex('#e24a2c', '#e6a52c', frac * 2);
}
// "Tap the right stick", for the buy/take line: a thin white circle with a thin R in it.
function RKey() {
  return h('svg', { className: 'rkey', viewBox: '0 0 30 30', width: 28, height: 28, 'aria-hidden': true },
    h('circle', { cx: 15, cy: 15, r: 13.5, fill: 'none', stroke: '#fff', strokeWidth: 1 }),
    h('text', { x: 15, y: 15, textAnchor: 'middle', dominantBaseline: 'central', fill: '#fff',
      fontSize: 14, fontWeight: 300, fontFamily: 'system-ui, sans-serif' }, 'R'));
}
function Stick({ size, kind, input, refresh }) {
  const [knob, setKnob] = useState({ x: 0, y: 0, jet: false });
  // the live stat this stick shows: hp+fuel on the left, mana on the right. Read off
  // input.current.hud each animation frame, and only re-rendered when a value actually
  // moves (rounded to 1%), so the ring animates without churning the whole tree.
  const [gauge, setGauge] = useState({ ring: 1, fuel: 1, empty: false, dry: true });
  const left = kind === 'left';
  useEffect(() => {
    let raf, prev = '';
    const tick = () => {
      const s = input.current.hud;
      if (s) {
        const g = left
          ? { ring: s.hp, fuel: s.fuel, empty: s.empty, dry: false }
          : { ring: s.hasGun ? s.mana : 0, rech: s.hasGun ? s.rech : 0, cast: s.hasGun ? s.cast : 0,
              has: s.hasGun, fuel: 0, empty: false, dry: !s.hasGun || s.recharging };
        const key = Math.round(g.ring * 100) + '|' + Math.round(g.fuel * 100) + '|' +
          Math.round((g.rech || 0) * 100) + '|' + Math.round((g.cast || 0) * 100) + '|' +
          (g.has ? 1 : 0) + '|' + (g.empty ? 1 : 0) + '|' + (g.dry ? 1 : 0);
        if (key !== prev) { prev = key; setGauge(g); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [left]);
  const ref = useRef(null);
  const pid = useRef(null);
  // right stick only: true while this touch has never left the dead zone. A tap that
  // stays true until release is an interact; a drag out (even one that comes back to
  // centre) sets it false the moment it first crosses AIM_DEAD, and stays false.
  const stayed = useRef(true);

  const right = kind === 'right';
  const update = e => {
    const r = ref.current.getBoundingClientRect();
    const rad = r.width / 2;
    const dx = e.clientX - (r.left + rad), dy = e.clientY - (r.top + rad);
    const dist = Math.hypot(dx, dy);
    const maxD = rad * 0.72;
    const cl = Math.min(dist, maxD);
    const nx = dist ? dx / dist : 0, ny = dist ? dy / dist : 0;
    const mag = cl / maxD;
    const thresh = right ? AIM_DEAD : 0.15;
    if (right && mag > AIM_DEAD) stayed.current = false;
    // A card is up: left picks up, right leaves, and the one you are pointing at is the
    // one lit. Inside the dead zone neither is lit, because you have not chosen yet.
    if (right && input.current.confirmAct) {
      const side = mag > AIM_DEAD ? (nx < 0 ? 'take' : 'leave') : null;
      if (input.current.confirmAim !== side) { input.current.confirmAim = side; refresh(); }
    }
    const st = input.current[kind];
    st.active = true; st.nx = nx; st.ny = ny; st.mag = mag; st.dy = dy; st.on = mag > thresh;
    setKnob({ x: nx * cl, y: ny * cl, jet: kind === 'left' && dy < 0 && mag > DEAD });
  };
  const down = e => {
    if (pid.current !== null) return;
    pid.current = e.pointerId;
    stayed.current = true;
    try { ref.current.setPointerCapture(e.pointerId); } catch (_) {}
    update(e);
  };
  const move = e => { if (e.pointerId === pid.current) update(e); };
  const end = e => {
    if (e.pointerId !== pid.current) return;
    pid.current = null;
    const act = input.current.confirmAct;
    if (right && act) {
      // a confirmation is up, so the gesture is "point left or right and let go". The
      // side was decided while dragging, so coming back to the middle before releasing
      // picks nothing, which is the right answer — you were not pointing anywhere.
      const side = input.current.confirmAim;
      input.current.confirmAim = null;
      if (side) act[side]();
    } else if (right && stayed.current) {
      input.current.interact = true;
    }
    Object.assign(input.current[kind], { active: false, mag: 0, on: false, dy: 0 });
    setKnob({ x: 0, y: 0, jet: false });
  };

  // the circular gauges, each a thin ring wiped clockwise from the top as its stat falls.
  // Left: health at the edge, jet fuel just inside it (red track when the tank is dry).
  // Right: gold mana at the edge, then recharge and cast delay inside it, so you can see
  // which one is gating your fire.
  const rw = 3.2, sw = 1.6;
  const wipe = (r, frac, col, track) => [
    h('circle', { key: 't' + r, cx: 50, cy: 50, r, fill: 'none', stroke: track || 'rgba(0,0,0,0.35)', strokeWidth: sw }),
    h('circle', { key: 'w' + r, cx: 50, cy: 50, r, fill: 'none', stroke: col, strokeWidth: sw,
      strokeLinecap: 'round',
      strokeDasharray: (Math.max(0, Math.min(1, frac)) * 2 * Math.PI * r) + ' ' + (2 * Math.PI * r),
      transform: 'rotate(-90 50 50)' })];
  const ring = left
    ? h('svg', { className: 'gauge', viewBox: '0 0 100 100' },
        wipe(GAUGE_R, gauge.ring, healthCol(gauge.ring)),
        wipe(GAUGE_R - rw, gauge.fuel, knob.jet ? '#ffc35a' : GAUGE_COL.fuel,
          gauge.empty ? 'rgba(226,74,44,0.7)' : null))
    : h('svg', { className: 'gauge', viewBox: '0 0 100 100' },
        wipe(GAUGE_R, gauge.ring, gauge.dry ? 'rgba(255,201,60,0.28)' : GAUGE_COL.mana),
        wipe(GAUGE_R - rw, gauge.rech, gauge.has ? GAUGE_COL.rech : 'rgba(122,215,255,0.22)'),
        wipe(GAUGE_R - 2 * rw, gauge.cast, gauge.has ? GAUGE_COL.cast : 'rgba(197,140,255,0.22)'));
  return h('div', {
      ref, className: 'stick' + (knob.jet ? ' jetting' : ''),
      style: { width: size, height: size },
      onPointerDown: down, onPointerMove: move, onPointerUp: end,
      onPointerCancel: end, onLostPointerCapture: end,
    },
    // the centre line splits jet (top half) from walk
    left && h('div', { className: 'stickclip' }, h('div', { className: 'hline' })),
    ring,
    // the right stick's amber ring: the line the knob's edge crosses when the drag starts
    // counting as aiming rather than as a tap on the dead zone
    h('div', { className: 'knob', style: {
      width: (KNOB * 100) + '%', height: (KNOB * 100) + '%',
      transform: `translate(-50%,-50%) translate(${knob.x}px,${knob.y}px)` } }),
    right && h('div', { className: 'deadzone', style: {
      width: (AIM_RING * 100) + '%', height: (AIM_RING * 100) + '%' } }),
    h('span', { className: 'lbl top' }, left ? 'jet' : 'aim'),
    left && h('span', { className: 'lbl bot' }, 'walk')
  );
}

// The same detail card is used by the build screen and by the shop, so what you
// read standing on a plinth is exactly what you get once you own it.
// Tap or hold, told apart: a hold fires on its own after `ms`, a release before
// that counts as a tap, and sliding off cancels both.
function holdPress(onTap, onHold, onState, ms) {
  return e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let fired = false;
    const done = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (onState) onState(false);
    };
    const timer = setTimeout(() => { fired = true; done(); onHold(); }, ms || 450);
    const move = ev => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 14) done(); };
    const up = () => { const tap = !fired; done(); if (tap && onTap) onTap(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    if (onState) onState(true);
  };
}

// Every gun stat in one place, with which direction counts as an improvement:
// a smaller cast delay, recharge or spread is better, so those read green.
const GUN_STATS = [
  { k: 'cap', label: 'slots', better: 1, get: g => g.cap, fmt: v => String(v) },
  { k: 'delay', label: 'cast delay', better: -1, get: g => g.castDelay, fmt: v => v.toFixed(2) + 's' },
  { k: 'rech', label: 'recharge', better: -1, get: effRecharge, fmt: v => v.toFixed(2) + 's' },
  { k: 'mana', label: 'mana', better: 1,
    get: g => g.manaMax + gunPassives(g).manaMax, fmt: v => String(Math.round(v)) },
  { k: 'regen', label: 'mana regen', better: 1,
    get: g => g.manaRegen + gunPassives(g).manaRegen, fmt: v => Math.round(v) + '/s' },
  { k: 'spread', label: 'spread', better: -1, get: g => g.spread, fmt: v => v.toFixed(1) + '\u00b0' },
  { k: 'multi', label: 'shots per cast', better: 1, get: g => g.multi, fmt: v => String(v) },
  { k: 'speed', label: 'shot speed', better: 1, get: g => g.speedMul || 1, fmt: v => 'x' + v.toFixed(2) },
  { k: 'order', label: 'cast order', better: 1,
    get: g => (g.shuffle ? 0 : 1), fmt: v => (v ? 'in order' : 'shuffle') },
];

// One card for a gun: its rolled stats and the mods sitting on it.
// `split` is the gun-pickup variant: the stats collapse to wrapping chips and the
// card becomes a flex column, so the mod row at the bottom never gets pushed off.
function GunCard({ gun, label, onClose, ingame, flow, split, mark, compare, compareName }) {
  const vs = compare && compare !== gun ? compare : null;
  const stats = GUN_STATS.map(st => {
    const v = st.get(gun);
    let cls = '';
    if (vs) {
      const o = st.get(vs);
      if (Math.abs(v - o) > 1e-6) cls = (v > o) === (st.better > 0) ? ' up' : ' down';
    }
    return { st, v, cls };
  });
  return h('div', { className: 'pop scroll' + (ingame ? ' ingame' : '') + (flow ? ' flow' : '') +
      (split ? ' split' : '') + (mark ? ' ' + mark : '') },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: gunLvCol(gun) || '#c9ccd4', color: gunLvCol(gun) || '#c9ccd4' } }, '⌥'),
      h('div', { className: 'ptitle' },
        h('b', { style: { color: gunColor(gun) } }, gun.name),
        h('span', null, (label || 'Gun') + (gun.lvl ? ' · Lv ' + gun.lvl : '') + ' · ' + gun.cap + ' slots')),
      onClose ? h('button', { className: 'pclose',
        onPointerDown: e => { e.preventDefault(); onClose(); } }, '×') : null
    ),
    vs ? h('p', { className: 'vs' }, 'compared with ' + compareName) : null,
    split
      ? h('div', { className: 'stats gstats' },
          stats.map(r => h('div', { className: 'st' + r.cls, key: r.st.k },
            h('b', null, r.st.fmt(r.v)), h('span', null, r.st.label))))
      : h('div', { className: 'prows' },
          stats.map(r => h('div', { className: 'prow' + r.cls, key: r.st.k },
            h('span', null, r.st.label), h('b', null, r.st.fmt(r.v))))),
    h('div', { className: 'pdemo' },
      h('div', { className: 'dtiles' },
        gun.slots.map((id, i) => id
          ? h('div', { key: i, className: 'dtile',
              style: { borderColor: famCol(id), color: famCol(id) } },
            h('b', null, MODS[id].glyph), h('i', null, MODS[id].name))
          : h('div', { key: i, className: 'dtile off' }, h('i', null, 'empty')))),
      split && gun.slots.some(Boolean) ? null       // the split view needs the height more
        : h('span', { className: 'dnote' }, gun.slots.some(Boolean)
          ? 'cast left to right' : 'nothing fitted yet'))
  );
}

// Walked onto a gun: compare it with yours and pick which of your four it replaces, or
// leave it. Mods are taken straight (no screen); guns keep this chooser because a gun goes
// into one of four slots and is worth comparing before you commit.
function GunSwap({ input, refresh, onDone }) {
  const LO = input.current.loadout;
  useEffect(() => { SFX.fx('open'); }, []);
  const found = input.current.found;
  const [base, setBase] = useState(LO.guns[LO.sel] ? LO.sel : LO.guns.findIndex(Boolean));
  const [held, setHeld] = useState(-1);
  if (!found) return null;
  const baseGun = base >= 0 ? LO.guns[base] : null;

  const take = i => {
    const old = LO.guns[i];
    LO.guns[i] = resetGun(found.gun);   // taking a gun never changes which one you hold
    SFX.ui('gun');
    if (old) { found.gun = old; found.old = true; }   // your old gun stays here, no glow: you've had it
    else found.taken = true;
    found.cool = PICKUP_COOL;           // don't reopen the moment you step past it
    input.current.found = null;
    refresh();
    onDone();
  };
  const leave = () => {
    found.cool = PICKUP_COOL;         // same for one you looked at and walked away from
    input.current.found = null; refresh(); onDone();
  };

  // Both guns are on screen at once and split the space between them: the found one
  // above, the slot you are comparing it against below. Each card keeps its head and
  // its mod row pinned, so the mods are never the thing that falls off the bottom.
  return h('div', { className: 'sheet swapsheet' },
    h('div', { className: 'shead' },
      h('h2', null, 'Gun on the ground'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); leave(); } }, 'Leave it')
    ),
    h(GunCard, { gun: found.gun, label: 'Found', flow: true, split: true, mark: 'found',
      compare: baseGun,
      compareName: baseGun ? 'slot ' + (base + 1) + ', ' + baseGun.name : '' }),
    baseGun
      ? h(GunCard, { gun: baseGun, label: 'Slot ' + (base + 1) + ' \u00b7 yours', flow: true,
          split: true, mark: 'mine', compare: found.gun, compareName: found.gun.name })
      : h('p', { className: 'lab mine' }, base >= 0
          ? 'Slot ' + (base + 1) + ' is empty' : 'No guns to compare it with'),
    h('p', { className: 'lab hint' }, 'Hold a slot to swap it \u00b7 tap to compare it'),
    h('div', { className: 'swaprow' },
      LO.guns.map((g, i) => h('button', {
          key: i,
          className: 'gtab' + (g ? '' : ' empty') + (held === i ? ' holding' : '') +
            (base === i ? ' base' : ''),
          onPointerDown: holdPress(
            () => { if (g) setBase(i); },
            () => take(i),
            on => setHeld(on ? i : -1)),
        },
        h('span', { className: 'num' }, i + 1),
        h('span', { className: 'gname', style: g ? { color: gunColor(g) } : null }, g ? g.name : 'Empty slot'),
        h('span', { className: 'gsub' }, g ? g.slots.filter(Boolean).length + '/' + g.cap + ' mods' : 'hold to take')
      ))
    )
  );
}

function ModCard({ id, onClose, ingame, top, flow }) {
  const m = MODS[id];
  const kind = famOf(id).name + (m.kind === 'passive' ? ' \u00b7 always on' : '');
  const rows = modPreview(id).rows;
  const dtile = (did, key, faded) => h('div', {
      key, className: 'dtile' + (faded ? ' off' : ''),
      style: { borderColor: famCol(did), color: famCol(did) } },
    h('b', null, MODS[did].glyph), h('i', null, MODS[did].name));
  const drow = (ok, tiles, note, key) => h('div', { className: 'drow', key },
    h('span', { className: 'dmark ' + (ok ? 'yes' : 'no') }, ok ? '\u2713' : '\u2717'),
    h('div', null,
      h('div', { className: 'dtiles' }, tiles),
      h('span', { className: 'dnote' }, note)));
  // cast delay is walked in order, so anything that touches it needs explaining
  let timing = null;
  if (m.setDelay !== undefined) {
    timing = 'Sets the gun\u2019s cast delay to ' + m.setDelay + 's the moment it is cast, ' +
      'instead of nudging it like other mods. Anything cast AFTER it adds its own delay back ' +
      'on top, so it only pays off last \u2014 usually at the tail of a multicast group, where ' +
      'it fires alongside your real shot and leaves the gun ready immediately.';
  } else if (m.d) {
    timing = (m.d < 0 ? 'Takes ' + Math.abs(m.d) : 'Adds ' + m.d) + 's ' +
      (m.d < 0 ? 'off' : 'to') + ' the cast delay of the pull it is drawn in. ' +
      'Cast delay is the gap between shots; a mod that zeroes it outright (Buzzsaw) ' +
      'wipes this out if it comes after.';
  } else if (m.rech || m.rechMul) {
    timing = 'Recharge is the pause once the gun reaches the end of its list. This counts ' +
      'from any slot, so position does not matter for it.';
  }

  let demo;
  if (m.setDelay !== undefined) {
    demo = [drow(true, [dtile('double', 'a'), dtile('bolt', 'b'), dtile(id, 'c')],
              'the bolt fires, then this wipes the delay \u2014 shoot again at once', 1),
            drow(false, [dtile(id, 'd'), dtile('bolt', 'e', true)],
              'the bolt adds its delay back after the reset', 2)];
  } else if (m.kind === 'passive') {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b')], 'counts wherever you put it', 1),
            drow(true, [dtile('bolt', 'c'), dtile(id, 'd')], 'same here — order does not matter', 2)];
  } else if (m.kind === 'shot') {
    demo = [drow(true, [dtile('dmg_up', 'a'), dtile(id, 'b')], 'modifiers go to its left', 1),
            drow(false, [dtile(id, 'c'), dtile('dmg_up', 'd', true)], 'a modifier here comes too late', 2)];
  } else if (m.kind === 'static') {
    demo = [drow(true, [dtile('dmg_up', 'a'), dtile(id, 'b')],
              'modifiers to its left still count', 1),
            drow(true, [dtile('double', 'c'), dtile(id, 'd'), dtile('bolt', 'e')],
              'it takes a cast slot like any shot does', 2)];
  } else if (m.copy === 'mods') {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b'), dtile('heavy', 'c')],
              'the heavy shot counts even though it sits after the bolt', 1),
            drow(true, [dtile('heavy', 'd'), dtile(id, 'e'), dtile('bolt', 'f')],
              'and here too \u2014 Mu does not care where they are', 2)];
  } else if (m.copy) {
    demo = [drow(true, [dtile('bolt', 'a'), dtile(id, 'b')],
              'it copies off the gun, so give it something to copy', 1),
            drow(false, [dtile(id, 'c'), dtile('bolt', 'd', true)],
              'first in an empty gun, there is nothing to copy yet', 2)];
  } else if (m.myriad) {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b'), dtile('bolt', 'c'), dtile('slug', 'd')],
              'all three fire together on one pull', 1),
            drow(false, [dtile('bolt', 'e'), dtile(id, 'f', true)], 'nothing left after it', 2)];
  } else if (m.multi) {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b'), dtile('bolt', 'c')],
              'both bolts fire on one pull', 1),
            drow(false, [dtile('bolt', 'd'), dtile(id, 'e', true)], 'nothing after it to gather', 2)];
  } else if (m.kind === 'util' && !m.f) {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b')],
              'it fires along with the pull it is drawn in', 1),
            drow(true, [dtile('bolt', 'c'), dtile(id, 'd')], 'same pull, same effect', 2)];
  } else {
    demo = [drow(true, [dtile(id, 'a'), dtile('bolt', 'b')], 'the bolt gets the effect', 1),
            drow(false, [dtile('bolt', 'c'), dtile(id, 'd', true)], 'too late — the bolt already fired', 2)];
  }
  return h('div', { className: 'pop scroll' + (ingame ? ' ingame' : '') + (top ? ' top' : '') + (flow ? ' flow' : '') },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: famCol(id), color: famCol(id) } }, m.glyph),
      h('div', { className: 'ptitle' },
        h('b', null, m.name),
        h('span', null, kind + (m.mana ? ' \u00b7 ' + m.mana + ' mana' : ''))),
      onClose ? h('button', { className: 'pclose',
        onPointerDown: e => { e.preventDefault(); onClose(); } }, '\u00d7') : null
    ),
    m.info ? h('p', { className: 'pinfo' }, m.info) : null,
    timing ? h('p', { className: 'pnote' }, timing) : null,
    rows.length ? h('div', { className: 'prows' },
      rows.map((r, i) => h('div', { className: 'prow', key: i },
        h('span', null, r[0]), h('b', null, r[1])))) : null,
    // the placement use-example is for the editor, where you're deciding where a mod
    // goes — the shop/pickup preview leaves it off and keeps the card compact.
    ingame ? null : h('div', { className: 'pdemo' }, demo)
  );
}

// A gun's stats, one per line: name in its gauge colour, value red->green by how near
// perfect it is, and what the fitted mods add or take away.
const PULL_COL = ['#ff8a1f', '#3fc9ff', '#b565ff', '#57d267', '#ff5fa2', '#ffd23c'];
const GS_ROWS = [
  { k: 'cap', label: 'Slots', fmt: v => String(v) },
  { k: 'castDelay', label: 'Cast delay', col: GAUGE_COL.cast, fmt: v => v.toFixed(2) + 's', better: -1, dfmt: v => v.toFixed(2) + 's' },
  { k: 'recharge', label: 'Recharge', col: GAUGE_COL.rech, fmt: v => v.toFixed(2) + 's', better: -1, dfmt: v => v.toFixed(2) + 's' },
  { k: 'manaMax', label: 'Mana', col: GAUGE_COL.mana, fmt: v => String(Math.round(v)), better: 1, dfmt: v => String(Math.round(v)) },
  { k: 'manaRegen', label: 'Mana regen', col: GAUGE_COL.mana, fmt: v => Math.round(v) + '/s', better: 1, dfmt: v => String(Math.round(v)) },
  { k: 'spread', label: 'Spread', fmt: v => v.toFixed(1) + '°', better: -1, dfmt: v => v.toFixed(1) + '°' },
  { k: 'speedMul', label: 'Shot speed', fmt: v => '×' + v.toFixed(2), better: 1, dfmt: v => v.toFixed(2) },
  { k: 'multi', label: 'Per cast', fmt: v => String(v) },
  { k: 'shuffle', label: 'Order', fmt: v => (v ? 'shuffle' : 'in order') },
];
// Cast delay, recharge and mana get a thin bar under them showing the fire preview live,
// draining and refilling like the right stick's rings (the other stats have none). The
// bars are written straight to the DOM each frame, not re-rendered.
const LIVE_BAR = { castDelay: GAUGE_COL.cast, recharge: GAUGE_COL.rech, manaMax: GAUGE_COL.mana };
function GunStats({ gun, sim, sig }) {
  const d = useMemo(() => gunModDeltas(gun), [sig]);
  const bars = useRef({});
  useEffect(() => {
    let raf;
    const loop = () => {
      const S = sim.current;
      if (S) {
        const gg = fireSimGauges(S);
        for (const k in LIVE_BAR) if (bars.current[k]) bars.current[k].style.width = (gg[k] * 100).toFixed(1) + '%';
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const bar = (k, frac, col) => h('div', { className: 'gsbar' },
    h('i', { ref: LIVE_BAR[k] ? el => { bars.current[k] = el; } : undefined, 'data-live': LIVE_BAR[k] ? k : undefined,
      style: { width: (frac * 100).toFixed(1) + '%', background: col } }));
  return h('div', { className: 'gstats' },
    gun.lvl ? h('div', { className: 'gsrow' }, h('span', null, 'Level'),
      h('b', { style: { color: gunLvCol(gun) } }, 'Lv ' + gun.lvl)) : null,
    GS_ROWS.map(r => {
      const v = r.k === 'speedMul' ? (gun.speedMul || 1) : gun[r.k];
      const dv = d[r.k] || 0, show = r.dfmt && Math.abs(dv) > 0.005;
      const q = statQual(r.k, v);
      return h('div', { key: r.k, className: 'gsrow', 'data-stat': r.k },
        h('span', r.col ? { style: { color: r.col } } : null, r.label),
        h('b', { style: { color: healthCol(q) } }, r.fmt(v)),
        show ? h('u', { className: (dv > 0) === (r.better > 0) ? 'up' : 'down' },
          (dv > 0 ? '+' : '\u2212') + r.dfmt(Math.abs(dv))) : null,
        LIVE_BAR[r.k] ? bar(r.k, 1, LIVE_BAR[r.k]) : null);
    }));
}

// the gun's picture on its button, drawn with the same sprite as the one in your hands
function GunIcon({ gun }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1, W = 64, H = 32;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sc = 2.7;
    drawGun(ctx, W / 2 - 3.85 * sc, H / 2 + 1 * sc, 0, sc, gunAccent(gun));
  });
  return h('canvas', { ref, className: 'gicon' });
}

// The gun's slots as a fixed grid: a mod stays exactly where you drop it. The fire preview
// (fireSimStep, trigger held) runs here at DEV.bagSpeed × real time; each pull lights the
// slots it fired in that pull's colour. Only re-renders when the lit set changes, so the
// Editor (and the advisor) never re-render per frame.
function SlotGrid({ gun, tile, sig, sim }) {
  const [lit, setLit] = useState(null);
  const steps = useMemo(() => pullSteps(gun), [sig]);
  useEffect(() => {
    let raf, last = performance.now(), prev = null;
    const loop = now => {
      const S = sim.current;
      const dt = Math.min(0.1, (now - last) / 1000) * DEV.bagSpeed;
      last = now;
      if (S) {
        // small sub-steps so a very fast gun still fires every pull it should
        for (let t = dt; t > 0; t -= 0.01) fireSimStep(S, Math.min(0.01, t));
        if (S.lit !== prev) { prev = S.lit; setLit(S.lit); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pullOf = new Array(gun.slots.length).fill(-1);
  if (steps) for (const st of steps) pullOf[st.slot] = st.pull;
  const on = new Set(lit ? lit.slots : []);
  const col = lit ? PULL_COL[lit.pull % PULL_COL.length] : null;
  return h(ScrollBox, { cls: 'slotRow' }, h('div', { className: 'mgrid' },
    gun.slots.map((id, i) => {
      const el = tile(id, { type: 'slot', i }, i);
      return React.cloneElement(el, { 'data-pull': pullOf[i],
          className: el.props.className + (id && steps && pullOf[i] < 0 ? ' cold' : '') },
        ...[].concat(el.props.children),
        on.has(i) ? h('i', { className: 'pulse on', style: { background: col, borderColor: col, color: col } }) : null);
    })));
}

// A scroll box with a bar down its right side you can grab: the mod tiles take a touch for
// dragging, so with a full grid there was nothing left to scroll by. Tap the bar to jump
// there, or drag the thumb. The thumb follows the box however it scrolled.
function ScrollBox({ cls, drop, children }) {
  const ref = useRef(null);
  const [t, setT] = useState({ top: 0, size: 1, show: false, on: false });
  useEffect(() => {
    const el = ref.current;
    const measure = () => {
      const H = el.scrollHeight, c = el.clientHeight, show = H > c + 1;
      const size = show ? Math.max(0.14, c / H) : 1;
      const top = show ? el.scrollTop / (H - c) * (1 - size) : 0;
      setT(o => o.show === show && Math.abs(o.size - size) < 0.002 && Math.abs(o.top - top) < 0.002 ? o
        : Object.assign({}, o, { top, size, show }));
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) { ro.observe(el); if (el.firstChild) ro.observe(el.firstChild); }
    return () => { el.removeEventListener('scroll', measure); if (ro) ro.disconnect(); };
  }, []);
  const grab = e => {
    e.preventDefault(); e.stopPropagation();
    const el = ref.current, bar = e.currentTarget.getBoundingClientRect();
    const size = t.size, thumb = size * bar.height, at = bar.top + t.top * bar.height;
    // held on the thumb: keep that grip; on the track: the thumb centres under the finger
    const off = e.clientY >= at && e.clientY <= at + thumb ? e.clientY - at : thumb / 2;
    const to = y => {
      const f = (y - off - bar.top) / Math.max(1, bar.height - thumb);
      el.scrollTop = Math.max(0, Math.min(1, f)) * (el.scrollHeight - el.clientHeight);
    };
    to(e.clientY);
    setT(o => Object.assign({}, o, { on: true }));
    const move = ev => to(ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setT(o => Object.assign({}, o, { on: false }));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  return h('div', { className: 'sbwrap ' + cls.split(' ')[0] + 'W', 'data-drop': drop },
    h('div', { ref, className: cls + ' scroll', 'data-drop': drop }, children),
    t.show ? h('div', { className: 'sbar' + (t.on ? ' on' : ''), onPointerDown: grab },
      h('i', { style: { top: t.top * 100 + '%', height: t.size * 100 + '%' } })) : null);
}

// the build advisor's suggested swaps are parked (v72): the dmg/s line still shows, the
// tip buttons don't. buildAdvice and the tip code are kept; flip this to bring them back.
const SHOW_TIPS = false;

function Editor({ input, close, refresh, canEdit }) {
  const LO = input.current.loadout;
  useEffect(() => { SFX.fx('open'); return () => SFX.fx('close'); }, []);
  const [sel, setSel] = useState(LO.sel);
  const sim = useRef(null);
  const [drag, setDrag] = useState(null);
  const [info, setInfo] = useState(null);
  const [gdrag, setGdrag] = useState(null);
  const gun = LO.guns[sel];

  // DEBUG swaps your collection for a shelf holding one of every mod, and nothing
  // you drag off it is used up. Your own bag is left completely alone while it is
  // on, so switching back hands your real mods straight back — the ones you fitted
  // to a gun stay fitted, because they live on the gun, not in the bag.
  const bagIds = LO.debug ? ALL_IDS : LO.bag;
  const takeFromBag = i => { if (!LO.debug) LO.bag.splice(i, 1); };
  const returnToBag = id => { if (!LO.debug && id) LO.bag.push(id); };

  // one-shot reorder into the 8 colour families (same grouping as the legend
  // below), not a display toggle — the bag is already player-mutable state
  // (dragging reorders it too), so this is just another way to reorder it, and
  // it keeps the sort useful as a resting order rather than something to redo
  // every time the sheet reopens. Stable sort: mods keep their relative order
  // within a family.
  const famKeys = Object.keys(FAMILIES);
  const sortBag = () => {
    if (LO.debug) return;
    const rank = id => famKeys.indexOf(FAMILY_OF[id] || 'shots');
    LO.bag.sort((a, b) => rank(a) - rank(b));
    refresh();
  };

  // move a gun to another slot, keeping whatever you had selected selected
  const moveGun = (from, to) => {
    if (from === to) return;
    const held = LO.guns[LO.sel];
    const [g] = LO.guns.splice(from, 1);
    LO.guns.splice(to, 0, g);
    if (held) LO.sel = LO.guns.indexOf(held);
    setSel(LO.sel);
    refresh();
  };

  // tap selects; hold picks the gun up and dragging drops it on another slot
  const gunPress = i => e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let dragging = false, over = i;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    const timer = setTimeout(() => {
      if (!LO.guns[i] || !canEdit) return;           // nothing to pick up, or the bag is read-only
      dragging = true;
      setGdrag({ from: i, x: sx, y: sy, over: i });
    }, 320);
    const move = ev => {
      if (!dragging) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 14) { cleanup(); setGdrag(null); }
        return;
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const tab = el && el.closest ? el.closest('[data-gun]') : null;
      if (tab) over = Number(tab.dataset.gun);
      setGdrag({ from: i, x: ev.clientX, y: ev.clientY, over });
    };
    const up = () => {
      cleanup();
      setGdrag(null);
      if (dragging) { if (canEdit) moveGun(i, over); }
      else if (LO.guns[i]) { setSel(i); LO.sel = i; refresh(); }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const drop = (x, y, id, from) => {
    if (!canEdit) return;                 // outside the shop (and without Tinker) the bag is read-only
    SFX.fx('place');
    const el = document.elementFromPoint(x, y);
    const node = el && el.closest ? el.closest('[data-drop]') : null;
    const to = node && node.dataset.drop;
    const g = LO.guns[sel];
    if (!to) return;
    if (to === 'bag') {
      if (from.type === 'slot' && g) { g.slots[from.i] = null; returnToBag(id); }
    } else if (to.slice(0, 5) === 'slot:' && g) {
      const k = Number(to.slice(5));
      if (from.type === 'bag') {
        takeFromBag(from.i);
        returnToBag(g.slots[k]);
        g.slots[k] = id;
      } else if (from.i !== k) {
        const swap = g.slots[k];
        g.slots[k] = id;
        g.slots[from.i] = swap;
      }
    }
    if (g) resetGun(g);
    refresh();
  };

  const SLOP = 7;                      // move further than this and it's a drag, not a tap
  const startDrag = (id, from) => e => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    setDrag({ id, from, x: sx, y: sy, armed: false });
    const move = ev => setDrag(d => d && { id: d.id, from: d.from, x: ev.clientX, y: ev.clientY,
      armed: d.armed || Math.hypot(ev.clientX - sx, ev.clientY - sy) > SLOP });
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) <= SLOP) setInfo(cur => (cur === id ? null : id));
      else drop(ev.clientX, ev.clientY, id, from);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const tile = (id, from, key) => {
    const m = id ? MODS[id] : null;
    return h('div', {
        key,
        className: 'tile' + (m ? '' : ' hole') + (m && m.kind === 'shot' ? ' shot' : ''),
        style: m ? { borderColor: famCol(id), color: famCol(id) } : null,
        'data-drop': from.type === 'slot' ? 'slot:' + from.i : 'bag',
        'data-mod': id || undefined,
        onPointerDown: m ? startDrag(id, from) : undefined,
      },
      m ? h('span', { className: 'tg' }, m.glyph) : h('span', { className: 'tg' }, '+'),
      m ? h('span', { className: 'tn' }, m.name) : null,
      m && m.mark ? h('span', { className: 'tmark' }, m.mark) : null
    );
  };

  const shown = info && MODS[info];

  // the backdrop closes the card, but a tap that lands on another mod switches to it
  const behind = e => {
    e.preventDefault();
    const el = e.currentTarget;
    el.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    el.style.pointerEvents = '';
    const tile = under && under.closest ? under.closest('[data-mod]') : null;
    const next = tile && tile.dataset.mod;
    setInfo(next && next !== info ? next : null);
  };

  // restart the fire preview whenever the gun or its build changes
  const gsig = gun ? sel + '|' + gun.slots.join() + '|' + gun.multi + '|' + gun.shuffle + '|' + gun.castDelay + '|' + gun.recharge : '';
  if (!sim.current || sim.current.sig !== gsig) sim.current = gun ? Object.assign(fireSimNew(gun), { sig: gsig }) : null;

  const card = shown
    ? h('div', { key: 'card' },
        h('div', { className: 'shade', onPointerDown: behind }),
        h(ModCard, { id: info, onClose: () => setInfo(null), top: true }))
    : null;

  return h('div', { className: 'sheet' + (shown ? ' withcard' : '') },
    h('div', { className: 'shead' },
      h('h2', null, 'Guns & Mods'),
      h('span', { className: 'purse' }, LO.gold + 'g'),
      h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Done')
    ),
    h('div', { className: 'btop' },
      gun ? h(GunStats, { gun, sim, sig: gsig }) : h('div', { className: 'gstats' }, h('p', { className: 'lab' }, 'No gun in this slot')),
      h('div', { className: 'gtabs' },
        LO.guns.map((g, i) => h('button', {
            key: i,
            'data-gun': i,
            className: 'gtab' + (g ? '' : ' empty') + (i === sel ? ' on' : '') +
              (gdrag && gdrag.from === i ? ' lifted' : '') +
              (gdrag && gdrag.over === i && gdrag.from !== i ? ' target' : ''),
            onPointerDown: gunPress(i),
          },
          h('span', { className: 'gname', style: g ? { color: gunColor(g) } : null }, g ? g.name : 'Empty'),
          g ? h(GunIcon, { gun: g }) : h('span', { className: 'gsub' }, '—')
        )))
    ),
    gun ? h('p', { className: 'lab' }, gun.shuffle
      ? 'On the gun — order is shuffled every recharge'
      : 'On the gun — fires left to right, row by row') : null,
    gun ? h(SlotGrid, { gun, tile, sig: gsig, sim }) : null,
    gun ? (() => {
      const adv = buildAdvice(gun, bagIds);
      const apply = t => e => {
        e.preventDefault();
        if (t.kind === 'move') {
          const a = gun.slots[t.slot];
          gun.slots[t.slot] = gun.slots[t.other];
          gun.slots[t.other] = a;
        } else {
          const outgoing = gun.slots[t.slot];
          const k = bagIds.indexOf(t.id);
          if (k >= 0) takeFromBag(k);
          gun.slots[t.slot] = t.id;
          returnToBag(outgoing);
        }
        resetGun(gun);
        refresh();
      };
      return h('div', { className: 'advice' },
        h('div', { className: 'diag ' + adv.limit.key },
          h('b', null, adv.now.dps.toFixed(1) + ' dmg/s'), adv.limit.text),
        SHOW_TIPS && canEdit && adv.tips.length ? h('div', { className: 'tips' },
          adv.tips.map((t, k) => h('button', { key: k, className: 'tip', onPointerDown: apply(t) },
            t.kind === 'move'
              ? 'Swap slots ' + (t.slot + 1) + ' and ' + (t.other + 1)
              : (gun.slots[t.slot] ? 'Replace slot ' + (t.slot + 1) + ' with ' : 'Slot ' +
                  (t.slot + 1) + ': ') + MODS[t.id].name,
            h('b', null, '\u00d7' + t.gain.toFixed(1) + ' dmg')))) : null);
    })() : null,
    h('div', { className: 'bagHead' },
      h('p', { className: 'lab' }, LO.debug
        ? 'Debug shelf — one of every mod, never used up'
        : 'Collected mods' + (LO.bag.length ? '' : ' — none yet, find them in the cave')),
      canEdit && !LO.debug && LO.bag.length > 1 ? h('button', { className: 'sortBag',
          onPointerDown: e => { e.preventDefault(); sortBag(); } }, 'Sort') : null),
    h(ScrollBox, { cls: 'bag' + (LO.debug ? ' debug' : ''), drop: 'bag' },
      h('div', { className: 'mgrid' }, bagIds.map((id, i) => tile(id, { type: 'bag', i }, 'b' + i)))
    ),
    h('div', { className: 'info' },
      canEdit
        ? 'Drag a mod to any slot. Tap one to see what it does. Hold a gun to reorder it.'
        : 'Viewing only — reach a shop, or take the Tinker perk, to change your setup. Tap a mod to see what it does.'),
    gdrag && LO.guns[gdrag.from] ? h('div', { className: 'gghost',
      style: { left: gdrag.x, top: gdrag.y } }, LO.guns[gdrag.from].name) : null,
    drag && drag.armed ? h('div', { className: 'ghost',
      style: { left: drag.x, top: drag.y, borderColor: famCol(drag.id), color: famCol(drag.id) } },
      MODS[drag.id].glyph) : null,
    card
  );
}

// The card that comes up standing on a perk altar, so you know what you're taking before
// you take it. A perk is permanent, so this is the only look you get.
function PerkCard({ id, ingame, flow }) {
  const pk = PERKS[id];
  return h('div', { className: 'pop scroll' + (ingame ? ' ingame' : '') + (flow ? ' flow' : '') },
    h('div', { className: 'phead' },
      h('div', { className: 'pglyph', style: { borderColor: pk.tint, color: pk.tint } }, pk.glyph),
      h('div', { className: 'ptitle' },
        h('b', { style: { color: pk.tint } }, pk.name),
        h('span', null, 'Perk · rest of the run'))),
    h('p', { className: 'pinfo' }, pk.info));
}

// One tweakable value in the dev panel: a labelled number box prefilled with the live
// value, its default shown as the placeholder. Committing an empty box restores the
// default; anything else is parsed, clamped to the knob's range and saved at once.
// A live jellyfish for Dev → Jellyfish colours: the real jellyStep and drawJelly in a
// little walled box — a mossy ledge of floor-1 rock and two hanging vines for its glow and
// plant glow (plantGlowFill) to light, a roam spot circling the middle so it keeps pulsing,
// turning and trailing, a puff of spores on every pulse, and a spit now and then so the
// spit and drip colours show too. Every frame reads DEV, so a change shows at once.
function JellyPreview() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !c.getContext) return;
    const ctx = c.getContext('2d');
    const WU = 110, LEDGE = 8;                          // world units across; rock at the bottom
    const k = enemyFor('meduusa', 1);
    let HU = 60;
    const e = { x: WU / 2, y: 26, hx: WU / 2, hy: 26, r: k.r, phase: 0 };
    const solid = (cx, cy) => cx < 0 || cy < 0 || cx * CELL >= WU || (cy + 1) * CELL > HU - LEDGE;
    let raf, last = performance.now(), t = 0, spitT = 1.2, glob = null;
    const drops = [], spores = [];
    const TH = themeFor(1), sporeCol = rgbA(TH.moss[1]);
    // the art: a ledge with a fringe of moss along its top, and two vines from the roof
    const artC = document.createElement('canvas'), artCtx = artC.getContext('2d', { willReadFrequently: true });
    const glowC = document.createElement('canvas'), glowCtx = glowC.getContext('2d');
    const tufts = Array.from({ length: WU }, () => ({ h: Math.random() < 0.15 ? 0 : 1 + Math.floor(Math.random() * 3), c: Math.random() }));
    const vines = [{ k: 'climb', st: 'vine', x: 11, y: 0, len: 34, seed: 0.37 }, { k: 'climb', st: 'vine', x: WU - 13, y: 0, len: 27, seed: 0.81 }];
    const drop = (x, y, vx, vy, P, g) => { if (drops.length < 120) { const l = 0.5 + Math.random() * 0.5;
      drops.push({ x, y, vx, vy, g, life: l, max: l, c: Math.random() < 0.35 ? P.drip2 : P.drip, s: 1.1 + Math.random() * 0.8 }); } };
    const tick = now => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      const dpr = window.devicePixelRatio || 1, cw = Math.round(c.clientWidth * dpr), ch = Math.round(c.clientHeight * dpr);
      if (!cw || !ch) return;
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      const sc = cw / WU; HU = ch / sc;
      const S = e.je;
      if (S) { S.rx = WU / 2 + Math.cos(t * 0.55) * WU * 0.24; S.ry = (HU - LEDGE) * 0.36 + Math.sin(t * 0.8) * 5; S.roamR = 1e9; S.roamSpd = 0; }
      const pulse = jellyStep(e, { solidCell: solid, hunting: false, goal: null, rnd: Math.random }, dt) === 'pulse';
      const P = jellyPal(e.je.u.col);
      // a puff of spores out of the rim, back the way it pushes (as puffSpores in the game)
      if (pulse) {
        const S2 = e.je, B = jellyBell(e.r, S2.shape, kru('jeSquash', S2.u.sq)), c0 = Math.cos(S2.hd), s0 = Math.sin(S2.hd);
        for (let i = 0, n = Math.round(kr('jeSpores')); i < n && spores.length < 80; i++) {
          const lx = (Math.random() * 2 - 1) * B.rw * 0.7, r = Math.random();
          const a = S2.hd + Math.PI + (Math.random() * 2 - 1) * kr('jeSporeSpread') * Math.PI / 180, v = kr('jeSporeSpd');
          spores.push({ x: e.x - lx * s0 - B.rim * c0, y: e.y + lx * c0 - B.rim * s0, vx: (r - 0.5) * 8, vy: 0, wob: r * 9,
            life: 5 + r * 3, max: 8, kx: Math.cos(a) * v, ky: Math.sin(a) * v, kd: kr('jeSporeDrag') });
        }
      }
      for (let i = spores.length - 1; i >= 0; i--) {
        const q = spores[i];
        q.x += Math.sin(t * 1.3 + q.wob) * 6 * dt + (q.vx + q.kx) * dt; q.y += (q.vy + q.ky) * dt;
        const kk = Math.exp(-q.kd * dt); q.kx *= kk; q.ky *= kk;
        if ((q.life -= dt) <= 0 || q.x < 0 || q.x > WU || q.y < 0 || solid(Math.floor(q.x / CELL), Math.floor(q.y / CELL))) spores.splice(i, 1);
      }
      // a spit from its head across the box, dripping, splatting on whatever it meets
      if ((spitT -= dt) <= 0 && !glob) {
        spitT = 2.2;
        const a = e.je.hd, v = 70;
        glob = { x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, da: 0,
          size: kr('jeShotSize'), drip: kr('jeDrip'), g: kr('jeDripG'), n: Math.round(kr('jeSplat')), sv: kr('jeSplatSpd') };
      }
      if (glob) {
        glob.x += glob.vx * dt; glob.y += glob.vy * dt;
        for (glob.da += glob.drip * dt; glob.da >= 1; glob.da--) drop(glob.x, glob.y + glob.size * 0.5, glob.vx * 0.08, 8 + Math.random() * 18, P, glob.g);
        if (solid(Math.floor(glob.x / CELL), Math.floor(glob.y / CELL))) {
          const sp = Math.hypot(glob.vx, glob.vy) || 1;
          for (let i = 0; i < glob.n; i++) {
            const a = Math.random() * 6.28, v = glob.sv * (0.4 + Math.random() * 0.6);
            drop(glob.x - glob.vx * dt, glob.y - glob.vy * dt, Math.cos(a) * v - glob.vx / sp * v * 0.5, Math.sin(a) * v - glob.vy / sp * v * 0.5 - v * 0.3, P, glob.g);
          }
          glob = null;
        }
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const q = drops[i];
        q.vy += q.g * dt;
        const nx = q.x + q.vx * dt, ny = q.y + q.vy * dt;
        if (solid(Math.floor(nx / CELL), Math.floor(ny / CELL))) { q.vx *= 0.3; q.vy = 0; } else { q.x = nx; q.y = ny; }
        if ((q.life -= dt) <= 0) drops.splice(i, 1);
      }
      // the box: dark water-cave, a ledge of rock, the jelly, its spit, and the glow on top
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0d0f14'; ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      const aw = WU, ah = Math.ceil(HU), top = HU - LEDGE;
      if (artC.width !== aw || artC.height !== ah) { artC.width = aw; artC.height = ah; glowC.width = aw; glowC.height = ah; }
      artCtx.setTransform(1, 0, 0, 1, 0, 0); artCtx.clearRect(0, 0, aw, ah);
      artCtx.fillStyle = 'rgb(62,56,54)'; artCtx.fillRect(0, top, aw, LEDGE + 1);
      artCtx.fillStyle = 'rgb(96,84,74)'; artCtx.fillRect(0, top, aw, 1.2);
      tufts.forEach((q, x) => {
        if (!q.h) return;
        artCtx.fillStyle = rgbA(mix(TH.moss[0], TH.moss[1], q.c)); artCtx.fillRect(x, top - q.h + 1, 1, q.h);
        artCtx.fillStyle = rgbA(TH.moss[1]); artCtx.fillRect(x, top - q.h + 1, 1, 1);
      });
      for (const v of vines) drawProp(artCtx, v, t, TH);
      ctx.imageSmoothingEnabled = false;            // pixel art, like the terrain
      ctx.drawImage(artC, 0, 0);
      drawJelly(ctx, e.x, e.y, e.r, t, 0, false, k.col, e.je);
      if (glob) {
        const z = glob.size;
        ctx.save(); ctx.translate(glob.x, glob.y); ctx.rotate(Math.atan2(glob.vy, glob.vx));
        ctx.fillStyle = P.spitEdge; ctx.beginPath(); ctx.ellipse(0, 0, z * 1.45, z * 1.05, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.spit; ctx.beginPath(); ctx.ellipse(-z * 0.08, 0, z * 1.2, z * 0.82, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = P.spitShine; ctx.beginPath(); ctx.arc(z * 0.3, -z * 0.28, z * 0.32, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      for (const q of drops) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'lighter';
      const u = e.je.u, a = kru('jeGlow', u.glow) * (1 + kru('jeFlare', u.flare) * e.je.shape), rgb = hexRgb(P.glow);
      glowAt(ctx, e.x, e.y, kru('jeGlowR', u.glowR), a, rgb);
      glowAt(ctx, e.x, e.y, e.r * 1.6, a * 1.4, rgb);
      if (glob) glowAt(ctx, glob.x, glob.y, glob.size * 6, 0.3, rgb);
      ctx.fillStyle = sporeCol;
      for (const q of spores) { ctx.globalAlpha = Math.min(1, q.life / (q.max * 0.3)); ctx.fillRect(q.x - 0.65, q.y - 0.65, 1.3, 1.3); }
      ctx.globalAlpha = 1;
      // the plant glow: the same comp the game runs, on this box's own art
      const art = artCtx.getImageData(0, 0, aw, ah).data;
      const white = plantWhite(art);                 // the box's own brightest green
      const reach = kru('jeGlowR', u.glowR) * kru('jePlantReach', u.plant), out = glowCtx.createImageData(aw, ah);
      if (reach > 2 && plantGlowFill(out.data, art, aw, ah, { ox: 0, oy: 0, px: 1, cx: e.x, cy: e.y, reach, white,
        top: kru('jePlantTop', u.plant) / 100, strength: kru('jePlantGlow', u.plant), t: t * kru('jePlantTwinkle', u.plant),
        size: kru('jePlantSize', u.plant), rgb: hexArr(P.glow) })) {
        glowCtx.putImageData(out, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(glowC, 0, 0);
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return h('canvas', { ref, className: 'jellyprev' });
}

function DevRow({ meta }) {
  const [val, setVal] = useState(String(DEV[meta.k]));
  if (meta.type === 'slider') {
    // a slider: changes live as you drag, the number beside the label; ↺ puts the default back
    const set = v => { devSet(meta.k, v); setVal(String(v)); };
    return h('div', { className: 'devrow' },
      h('label', null, meta.label, h('span', { className: 'devval' }, String(DEV[meta.k]))),
      h('input', { type: 'range', min: meta.min, max: meta.max, step: meta.step, value: DEV[meta.k],
        onChange: e => set(parseFloat(e.target.value)) }),
      h('button', { className: 'devreset', 'aria-label': 'Default', onPointerDown: () => set(DEV_DEFAULTS[meta.k]) }, '↺'));
  }
  if (meta.type === 'color') {
    // a colour: changes live as you pick; ↺ puts the default back
    const set = v => { devSet(meta.k, v); setVal(v); };
    return h('div', { className: 'devrow' },
      h('label', null, meta.label),
      h('input', { type: 'color', value: DEV[meta.k], onChange: e => set(e.target.value) }),
      h('button', { className: 'devreset', 'aria-label': 'Default', onPointerDown: () => set(DEV_DEFAULTS[meta.k]) }, '↺'));
  }
  const commit = () => {
    const s = val.trim();
    let v;
    if (s === '') v = DEV_DEFAULTS[meta.k];
    else { v = parseFloat(s); if (!isFinite(v)) { setVal(String(DEV[meta.k])); return; } }
    v = Math.max(meta.min, Math.min(meta.max, v));
    devSet(meta.k, v);
    setVal(String(v));
  };
  return h('div', { className: 'devrow' },
    h('label', null, meta.label),
    h('input', { type: 'number', inputMode: 'decimal', step: meta.step,
      value: val, placeholder: String(DEV_DEFAULTS[meta.k]),
      onChange: e => setVal(e.target.value),
      onBlur: commit,
      onKeyDown: e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } } })
  );
}

// The dev window: it pauses the run but the game keeps drawing behind a light backdrop,
// so the look-of-it knobs (zoom, torch, fog) preview live as you type. Holds the toggle
// buttons — "All mods" is the old DEBUG shelf — and the saved, persisted variables.
function DevPanel({ input, refresh, close, onRestart, onSpawnGun }) {
  const LO = input.current.loadout;
  const [, bump] = useState(0);
  const [copied, setCopied] = useState(null);     // null, or the text + whether it copied
  // which groups are open: remembered on this device only, all shut the first time
  const [openG, setOpenG] = useState(() => { try { return JSON.parse(localStorage.getItem('caverunner-devgroups')) || {}; } catch (_) { return {}; } });
  const toggleG = g => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // commit a half-typed box
    const o = Object.assign({}, openG, { [g]: !openG[g] });
    setOpenG(o);
    try { localStorage.setItem('caverunner-devgroups', JSON.stringify(o)); } catch (_) {}
  };
  const copyAll = () => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // commit a half-typed box
    const text = devReport();
    const fallback = () => {
      let ok = false;
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch (_) {}
      setCopied({ text, ok });
    };
    try {
      navigator.clipboard.writeText(text).then(() => setCopied({ text, ok: true }), fallback);
    } catch (_) { fallback(); }
  };
  return h('div', { className: 'devwrap' },
    h('div', { className: 'devback', onPointerDown: e => { e.preventDefault(); close(); } }),
    h('div', { className: 'devpanel scroll' },
      h('div', { className: 'devhead' },
        h('h2', null, 'Dev'),
        h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Done')),
      h('div', { className: 'devbtns' },
        h('button', { className: 'dbg' + (LO.debug ? ' on' : ''),
          onPointerDown: e => { e.preventDefault(); LO.debug = !LO.debug; refresh(); bump(n => n + 1); } },
          'All mods'),
        h('button', { className: 'dbg restart',
          onPointerDown: e => { e.preventDefault(); onRestart(); } }, 'Restart run'),
        h('button', { className: 'dbg spawngun',
          onPointerDown: e => { e.preventDefault(); onSpawnGun(); } }, 'Spawn gun'),
        h('button', { className: 'dbg newcave',
          onPointerDown: e => { e.preventDefault(); input.current.newCave = true; close(); } }, 'New cave')),
      DEV_GROUPS.map(([g, name]) => {
        const shut = !openG[g];
        return h('div', { key: g, className: 'devgroup' },
          g === 'jellycol' ? h(JellyPreview) : null,          // the live jelly its colours paint
          h('button', { className: 'devghead' + (shut ? '' : ' open'), 'data-g': g,
            onPointerDown: e => { e.preventDefault(); toggleG(g); } },
            h('span', { className: 'devcaret' }, shut ? '▸' : '▾'), name),
          shut ? null : h('div', { className: 'devvars' },
            DEV_META.filter(m => m.g === g).map(m => h(DevRow, { key: m.k, meta: m }))));
      }),
      h('p', { className: 'devnote' },
        'Values save on their own and stick across reloads and sessions. Leave a box empty to put its default back.'),
      h('button', { className: 'dbg devcopy', onPointerDown: e => { e.preventDefault(); copyAll(); } },
        'Copy all dev settings to clipboard'),
      copied ? h('p', { className: 'devnote' }, copied.ok ? 'Copied — paste it to Claude.'
        : 'Could not reach the clipboard — press and hold the text below to copy it.') : null,
      copied && !copied.ok ? h('textarea', { className: 'devcopytext', readOnly: true, value: copied.text }) : null
    )
  );
}

function SpawnGun({ input, close }) {
  const [lvl, setLvl] = useState(String(input.current.floor || 1));
  const spawn = () => {
    input.current.spawnGun = Math.max(1, Math.floor(Number(lvl) || 1));
    close();
  };
  return h('div', { className: 'devwrap' },
    h('div', { className: 'devback', onPointerDown: e => { e.preventDefault(); close(); } }),
    h('div', { className: 'devpanel spawnpanel' },
      h('div', { className: 'devhead' },
        h('h2', null, 'Spawn gun'),
        h('button', { className: 'done', onPointerDown: e => { e.preventDefault(); close(); } }, 'Cancel')),
      h('div', { className: 'devrow' },
        h('label', null, 'Level'),
        h('input', { className: 'spawnlvl', type: 'number', min: 1, inputMode: 'numeric', value: lvl,
          onChange: e => setLvl(e.target.value) })),
      h('button', { className: 'dbg spawngo', onPointerDown: e => { e.preventDefault(); spawn(); } }, 'Spawn')));
}

// ---- the death replay's screen ("Witness yourself"): the recorded scene fills the view — drag
// to pan, pinch (or the wheel) to zoom — with a scrub bar and the controls along the bottom.
// The Game draws it (drawReplay); this only moves input.current.replay's clock and camera.
const RP_SPEEDS = [0.25, 0.5, 1, 2];
function Witness({ input, close }) {
  const V = input.current.replay, W = input.current.witness;
  const [, bump] = useState(0);
  const redo = () => bump(n => n + 1);
  const scrub = useRef(null), pts = useRef(new Map()), pinch = useRef(null), dragging = useRef(false);
  useEffect(() => {                  // the clock and the scrub bar follow the playback
    let raf, last = '';
    const tick = () => {
      const sig = Math.round(V.t * 20) + (V.playing ? 'p' : '');
      if (sig !== last) { last = sig; redo(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const span = Math.max(0.01, W.t1 - W.t0);
  const seek = e => {
    const r = scrub.current.getBoundingClientRect();
    V.t = W.t0 + clamp((e.clientX - r.left) / r.width, 0, 1) * span;
    V.playing = false; redo();
  };
  // the scene: one finger (or the mouse) drags the camera, two pinch-zoom and drag
  const down = e => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current = null;
  };
  const move = e => {
    const P = pts.current, q = P.get(e.pointerId);
    if (!q) return;
    const u = V.unit || 1;
    if (P.size === 1) { V.cx -= (e.clientX - q.x) / u; V.cy -= (e.clientY - q.y) / u; V.follow = false; }
    q.x = e.clientX; q.y = e.clientY;
    if (P.size >= 2) {
      const [a, b] = [...P.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, L = pinch.current;
      if (L) {
        V.zoom = clamp(V.zoom * d / L.d, 0.4, 4);
        V.cx -= (mx - L.mx) / u; V.cy -= (my - L.my) / u; V.follow = false;
      }
      pinch.current = { d, mx, my };
    }
    if (!V.follow) redo();
  };
  const up = e => { pts.current.delete(e.pointerId); pinch.current = null; };
  const tap = f => e => { e.preventDefault(); f(); redo(); };
  const rel = V.t - W.death, frac = (V.t - W.t0) / span;
  const atEnd = V.t >= W.t1 - 1e-6;
  return h('div', { className: 'witness' },
    h('div', { className: 'wscene', onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: up,
        onWheel: e => { V.zoom = clamp(V.zoom * Math.exp(-e.deltaY * 0.0015), 0.4, 4); } },
      h('div', { className: 'wtitle' }, 'WITNESS YOURSELF')),
    h('div', { className: 'wpanel', ref: el => { if (el) V.panelH = el.getBoundingClientRect().height; } },
      h('div', { className: 'wscrub', ref: scrub,
          onPointerDown: e => { e.preventDefault(); dragging.current = true;
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} seek(e); },
          onPointerMove: e => { if (dragging.current) seek(e); },
          onPointerUp: () => { dragging.current = false; }, onPointerCancel: () => { dragging.current = false; } },
        h('div', { className: 'wtrack' }),
        h('div', { className: 'wfill', style: { width: (frac * 100) + '%' } }),
        h('div', { className: 'wdeath', title: 'The moment you died',
          style: { left: ((W.death - W.t0) / span * 100) + '%' } }),
        h('div', { className: 'wthumb', style: { left: (frac * 100) + '%' } })),
      h('div', { className: 'wrow' },
        h('button', { className: 'wfirst', 'aria-label': 'Back to the start',
          onPointerDown: tap(() => { V.t = W.t0; V.playing = true; }) }, '⏮'),
        h('button', { className: 'wplay', 'aria-label': V.playing ? 'Pause' : 'Play',
          onPointerDown: tap(() => { if (!V.playing && atEnd) V.t = W.t0; V.playing = !V.playing; }) },
          V.playing ? '⏸' : '▶'),
        RP_SPEEDS.map(sp => h('button', { key: sp, className: 'wspeed' + (V.speed === sp ? ' on' : ''),
          onPointerDown: tap(() => { V.speed = sp; }) }, (sp < 1 ? String(sp).slice(1) : sp) + '×')),
        h('span', { className: 'wtime' }, (rel < 0 ? '−' : '+') + Math.abs(rel).toFixed(1) + 's')),
      h('div', { className: 'wrow' },
        h('button', { className: 'wloop' + (V.loop ? ' on' : ''), onPointerDown: tap(() => { V.loop = !V.loop; }) }, 'Loop'),
        h('button', { className: 'wfog' + (V.fog ? ' on' : ''), onPointerDown: tap(() => { V.fog = !V.fog; }) }, 'Fog'),
        h('button', { className: 'wfollow' + (V.follow ? ' on' : ''), onPointerDown: tap(() => { V.follow = true; V.zoom = 1; }) },
          'Follow'),
        h('button', { className: 'wclose', onPointerDown: e => { e.preventDefault(); close(); } }, 'Close'))));
}

function App() {
  const blank = () => ({ active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false });
  const [saved] = useState(loadSave);      // last session's run, if there is one
  const input = useRef({
    left: blank(), right: blank(),
    loadout: saved ? saved.loadout : { guns: startingGuns(), bag: [], sel: 0, gold: START_GOLD, debug: false,
      perks: [], maxBonus: 0, usedLives: 0 },
    saved,                      // handed to Game once, to rebuild the floor
    paused: false, notify: () => {}, inShop: true, prompt: null, interact: false, sig: '',
    found: null,                // a gun on the ground, waiting on the swap chooser
    confirmAct: null, confirmAim: null,   // legacy hooks still read (harmlessly) by Stick
    pendingToast: null,         // raised while paused, shown by the loop when it resumes
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0, inside: false, down: false },
  });
  const [size, setSize] = useState(150);
  const [vw, setVw] = useState(window.innerWidth);
  const [mapOpen, setMapOpen] = useState(false);
  const ctlRef = useRef(null);
  const [run, setRun] = useState(0);
  const [edit, setEdit] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [witnessOpen, setWitnessOpen] = useState(false);
  const [gunInfo, setGunInfo] = useState(-1);
  const [held, setHeld] = useState(-1);
  // null when closed; a timestamp (from the tap that opened it) while open, so
  // the Restart button's own tap can't also land on the Yes button underneath —
  // see the guard on the confirm button below
  const [confirmAt, setConfirmAt] = useState(null);
  const [, bump] = useState(0);
  const refresh = () => bump(n => n + 1);
  input.current.notify = refresh;
  const found = input.current.found;
  input.current.mapOpen = mapOpen;
  input.current.paused = edit || !!found || devOpen || spawnOpen || mapOpen || witnessOpen;

  const LO = input.current.loadout;
  // read through the ref: after a Restart the loadout object is replaced, and a
  // handler that closed over the old one silently edits a discarded loadout
  const select = i => {
    const L = input.current.loadout;
    if (L.guns[i]) { if (L.sel !== i) SFX.fx('switch'); L.sel = i; refresh(); }
  };
  const restart = () => {
    clearSave();
    input.current.saved = null;
    input.current.loadout = { guns: startingGuns(), bag: [], sel: 0, gold: START_GOLD, debug: false,
      perks: [], maxBonus: 0, usedLives: 0 };
    input.current.sig = '';
    input.current.found = null;
    input.current.witness = null; input.current.replay = null;
    setWitnessOpen(false);
    setGunInfo(-1);
    setEdit(false);
    setRun(r => r + 1);
  };
  // the game loop calls this when you tap the right stick on the death screen
  input.current.requestRestart = restart;

  useEffect(() => {
    // the circles are as big as two of them side by side will go: width is the binding
    // constraint on a phone, not height
    const fit = () => {
      // back to the size these were: the complaint was about the knob inside them, not
      // the pad. The -28 rather than -36 is because they are border-box now, which buys
      // the toolbar its 4px back and then some.
      setSize(Math.max(80, Math.floor(Math.min((window.innerWidth - 28) / 2, window.innerHeight * 0.28))));
      setVw(window.innerWidth);
    };
    fit();
    window.addEventListener('resize', fit);
    // the game frames itself to the area above the controls, so tell it how tall they are
    const ro = new ResizeObserver(() => {
      if (ctlRef.current) input.current.ctlH = ctlRef.current.getBoundingClientRect().height;
    });
    if (ctlRef.current) { ro.observe(ctlRef.current); input.current.ctlH = ctlRef.current.getBoundingClientRect().height; }
    return () => { window.removeEventListener('resize', fit); ro.disconnect(); };
  }, []);

  useEffect(() => {
    const stop = e => { if (!e.target.closest || !e.target.closest('.scroll')) e.preventDefault(); };
    // in an embedded preview the page starts without keyboard focus, so the number
    // keys go nowhere until something in here is touched
    const grab = () => { try { window.focus(); } catch (_) {} SFX.unlock(); };
    grab();
    document.addEventListener('pointerdown', grab, true);
    document.addEventListener('contextmenu', stop);
    document.addEventListener('touchmove', stop, { passive: false });

    const map = { w: 'w', arrowup: 'w', ' ': 'w', a: 'a', arrowleft: 'a', s: 's', arrowdown: 's', d: 'd', arrowright: 'd' };
    const key = down => e => {
      // never let the game read keys meant for a text field, like the dev panel's inputs
      const t = e.target;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      const k = e.key.toLowerCase();
      if (map[k]) { input.current.keys[map[k]] = down; e.preventDefault(); }
      if (!down) return;
      SFX.unlock();
      if (k >= '1' && k <= '4') select(Number(k) - 1);
      if (k === 'e' || k === 'tab') { e.preventDefault();
        if (input.current.inShop || perkBag(input.current.loadout.perks || []).tinker) setEdit(v => !v); }
      if (k === 'f') input.current.interact = true;
      if (k === 'm') setMapOpen(v => !v);
      if (k === 'escape') setEdit(false);
    };
    const kd = key(true), ku = key(false);
    const blur = () => {
      Object.keys(input.current.keys).forEach(k => { input.current.keys[k] = false; });
      input.current.mouse.down = false;
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('pointerdown', grab, true);
      document.removeEventListener('contextmenu', stop);
      document.removeEventListener('touchmove', stop);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const prompt = input.current.prompt;
  const inShop = input.current.inShop;
  const perkB = perkBag(LO.perks || []);
  const canEdit = inShop || perkB.tinker;      // Tinker with Wands Everywhere frees the editor
  const heldGun = input.current.loadout.guns[input.current.loadout.sel];
  const deck = deckLayout(vw, size, LO.guns.length);
  const btnAt = pt => ({ width: deck.btn, height: deck.btn,
    left: Math.round(pt.x - deck.btn / 2), top: Math.round(pt.y - deck.btn / 2) });

  // the death replay: offered once the recording has run on past the death (input.current.witness)
  const witness = input.current.witness;
  const openWitness = () => {
    input.current.replay = { t: witness.t0, speed: 1, playing: true, loop: true, fog: true, follow: true, zoom: 1, cx: 0, cy: 0, unit: 1 };
    setWitnessOpen(true);
  };
  const closeWitness = () => { input.current.replay = null; setWitnessOpen(false); };

  return h('div', { className: 'app' + (witnessOpen ? ' witnessing' : '') },
    h('div', { className: 'view' },
      h(Game, { key: run, input }),
      witness && !witnessOpen ? h('button', { className: 'witnessbtn',
        onPointerDown: e => { e.preventDefault(); openWitness(); } }, 'WITNESS YOURSELF') : null,
      witnessOpen && witness ? h(Witness, { input, close: closeWitness }) : null,
      // The item's card and its buy/take line are one panel now, grown up from the
      // bottom: the info you're reading and the price you're paying sit together.
      // The panel is pointer-events:none so a tap still reaches the sticks underneath;
      // buying and taking a mod is a tap on the right stick's dead zone (or the f key),
      // taken straight. A gun on the ground opens the swap chooser instead, so the panel
      // hides while that is up (the game pauses behind it).
      prompt && !found ? h('div', { className: 'buypanel',
        style: { bottom: (input.current.promptBottom || 12) + 'px',
          maxHeight: 'calc(100% - ' + ((input.current.promptBottom || 12) + 12) + 'px)' } },
        prompt.id ? h(ModCard, { id: prompt.id, ingame: true }) : null,
        prompt.perk ? h(PerkCard, { id: prompt.perk, ingame: true }) : null,
        prompt.gun ? h(GunCard, { gun: prompt.gun, label: prompt.found ? 'Found' : 'For sale',
          ingame: true, compare: heldGun, compareName: heldGun ? heldGun.name : '' }) : null,
        // shop stock is "Buy <price>"; anything you pick up for free is just "Take" —
        // the card above already names it, so a nameless item (the heal) shows its name here.
        h('div', { className: 'pbuy' + (prompt.can ? '' : ' cant'),
            'aria-label': 'Tap the right stick to ' + (prompt.price ? 'buy for ' + prompt.price + 'g' : 'take') },
          h(RKey),
          h('b', null, prompt.price ? prompt.price + 'g'
            : (prompt.id || prompt.gun || prompt.perk || prompt.heart) ? 'free' : prompt.text))) : null,
      // one gear in the top-right opens the Dev panel; Restart now lives inside it.
      h('button', { className: 'devbtn', title: 'Dev tools',
        onPointerDown: e => { e.preventDefault(); setDevOpen(true); } }, '⚙️'),
      confirmAt != null ? h('div', { className: 'confirm' },
        h('div', { className: 'shade', onPointerDown: e => { e.preventDefault(); setConfirmAt(null); } }),
        h('div', { className: 'confirmCard' },
          h('p', null, 'Restart the run? You’ll lose your guns and mods.'),
          h('div', { className: 'confirmRow' },
            h('button', { className: 'cancel',
              onPointerDown: e => { e.preventDefault(); setConfirmAt(null); } }, 'Cancel'),
            h('button', { className: 'go',
              onPointerDown: e => {
                e.preventDefault();
                // the tap that opened this dialog can land here too, on some devices,
                // as a second pointerdown a moment later — ignore anything that close
                // to the open so that one tap can never both open and confirm
                if (performance.now() - confirmAt < 400) return;
                setConfirmAt(null);
                restart();
              } }, 'Yes, restart')))) : null
    ),
    h('div', { className: 'controls', ref: ctlRef },
      (LO.perks && LO.perks.length)
        ? h('div', { className: 'perkrow' },
            LO.perks.map((id, i) => PERKS[id] ? h('span', {
                key: i, className: 'perkpip', title: PERKS[id].name,
                style: { color: PERKS[id].tint } }, PERKS[id].glyph) : null))
        : null,
      h('div', { className: 'sticks' },
        h(Stick, { size, kind: 'left', input, refresh }),
        h(Stick, { size, kind: 'right', input, refresh }),
        // gold sits in the gap between the two sticks, down level with their bottom halves.
        // "g" not "gold", and thousands truncate to a "k" (1234 -> 1.2k, 2000 -> 2k).
        h('div', { className: 'gold' }, fmtGold(LO.gold), h('span', null, 'g')),
        // the gun buttons ride an arc round the right stick; tap to hold it, hold for its card
        h('div', { className: 'slots' },
          LO.guns.map((g, i) => h('button', {
              key: i,
              className: 'dbtn slot' + (g ? '' : ' empty') + (i === LO.sel ? ' on' : '') +
                (held === i ? ' holding' : ''),
              style: btnAt(deck.guns[i]),
              title: g ? g.name + ' — hold for details' : 'Empty slot',
              onPointerDown: holdPress(
                () => select(i),
                () => { if (input.current.loadout.guns[i]) setGunInfo(i); },
                on => setHeld(on ? i : -1)),
            }, g ? h(GunIcon, { gun: g }) : null))),
        // the bag mirrors the last gun on the left, and the map toggle sits right above it
        h('button', {
            className: 'dbtn weapon' + (canEdit ? '' : ' locked'), style: btnAt(deck.bag),
            title: canEdit ? 'Bag: guns & mods' : 'Bag: guns & mods (edit in the shop or with Tinker)',
            'aria-label': 'Bag',
            onPointerDown: e => { e.preventDefault(); setMapOpen(false); setEdit(true); } },
          h('span', { className: 'emo' }, '🎒'),
          LO.bag.length ? h('b', { className: 'badge' }, LO.bag.length) : null),
        h('button', {
            className: 'dbtn mapbtn' + (mapOpen ? ' on' : ''), style: btnAt(deck.map),
            title: 'Map', 'aria-label': 'Map',
            onPointerDown: e => { e.preventDefault(); setMapOpen(v => !v); } },
          h('span', { className: 'emo' }, '🗺️'))
      )
    ),
    edit ? h(Editor, { input, refresh, canEdit, close: () => setEdit(false) }) : null,
    devOpen ? h(DevPanel, { input, refresh, close: () => setDevOpen(false),
      onRestart: () => { setDevOpen(false); setConfirmAt(performance.now()); },
      onSpawnGun: () => { setDevOpen(false); setSpawnOpen(true); } }) : null,
    spawnOpen ? h(SpawnGun, { input, close: () => setSpawnOpen(false) }) : null,
    found ? h(GunSwap, { input, refresh, onDone: () => { setGunInfo(-1); refresh(); } }) : null,
    gunInfo >= 0 && LO.guns[gunInfo]
      ? h('div', null,
          h('div', { className: 'shade', onPointerDown: e => { e.preventDefault(); setGunInfo(-1); } }),
          h(GunCard, { gun: LO.guns[gunInfo], label: 'Slot ' + (gunInfo + 1),
            onClose: () => setGunInfo(-1) }))
      : null
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(h(App));
