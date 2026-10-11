// CaveRunner Auto (stage: shots, first half): src/auto/shotfx.js and what art/scenegun.js shotsOf carries for it.
// Each shot knows its spell id; Buckshot is short-range; Magic Missile homes; each shot sheds its own trail (capped);
// Slug puffs smoke at the muzzle; a fireball throws fire drops; the disc remembers its afterimage positions.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
let seed = 7;
const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// ---- shotsOf carries (a Shot made from the mod, as planCast copies it) the spell id and the mod's light ----
const one = id => {
  const sh = Object.assign({}, G.MODS[id], { sid: id, count: G.MODS[id].count || 1, payload: null });
  return G.shotsOf(sh, 0, 100, 100, R, 0);
};
for (const id of ['bolt', 'spark', 'slug', 'buck', 'lance', 'blast', 'arrow', 'missile', 'fball', 'fbolt', 'flamer', 'bubble', 'spit', 'pollen', 'disc']) {
  const s = one(id)[0];
  check(`${id}: the scene shot knows its spell (sid)`, s.sid === id, s.sid);
}
const bolt = one('bolt')[0];
check('bolt carries its light', bolt.light === G.MODS.bolt.light && bolt.lightR === G.MODS.bolt.lightR, [bolt.light, bolt.lightR]);
const buck = one('buck')[0], bk = Object.assign({}, G.MODS.buck, { sid: 'x', count: 1, payload: null });
const plain = G.shotsOf(bk, 0, 0, 0, R, 0)[0];
check('Buckshot is short range (life × LIFE_K)', Math.abs(buck.life - plain.life * G.LIFE_K.buck) < 1e-9, [buck.life, plain.life]);
const mi = one('missile')[0];
check('Magic Missile homes (built in)', mi.homing > 0 && mi.homeR > 0, [mi.homing, mi.homeR]);

// ---- homing on the nearest creature ----
{
  const foes = [{ x: 300, ty: 100, hp: 5 }, { x: 160, ty: 40, hp: 5 }, { x: 120, ty: 100, hp: 0 }];
  const tg = G.nearestFoe(foes, 100, 100, 0, 400);
  check('nearestFoe: the nearest living one (dead ones skipped)', tg === foes[1], tg);
  check('nearestFoe: none in range -> null', G.nearestFoe(foes, 100, 100, 0, 20) === null);
  check('nearestFoe: creatures in world x, the scroll taken off', G.nearestFoe([{ x: 1100, ty: 100, hp: 1 }], 100, 100, 1000, 10) !== null);
  // fly a missile: it leaves at the angle fired (straight right), then curves onto a creature above
  const s = { x: 0, y: 100, vx: 200, vy: 0 };
  const f = { x: 200, ty: 20, hp: 5 };
  let hit = false, a0 = null;
  for (let i = 0; i < 300 && !hit; i++) {
    const age = i / 60;
    if (age > G.MISSILE_WAIT) G.steerTo(s, f.x, f.ty, G.MISSILE_TURN / 60); else a0 = Math.atan2(s.vy, s.vx);
    s.x += s.vx / 60; s.y += s.vy / 60;
    hit = Math.hypot(s.x - f.x, s.y - f.ty) < 8;
  }
  check('missile: straight out at first', a0 === 0, a0);
  check('missile: then curves onto the creature and reaches it', hit, [s.x, s.y]);
  check('steerTo keeps the speed', Math.abs(Math.hypot(s.vx, s.vy) - 200) < 1e-6);
}

// ---- trails ----
const shed = (s, secs) => { const out = []; for (let i = 0; i < secs * 60; i++) for (const p of G.autoTrail(s, 1 / 60, R)) out.push(p); return out; };
for (const id of ['bolt', 'spark', 'lance', 'blast', 'arrow', 'missile', 'fball', 'fbolt', 'bubble', 'spit', 'pollen']) {
  const s = one(id)[0];
  const ps = shed(s, 1);
  check(`${id}: sheds a trail (a second of flight)`, ps.length > 3 && ps.length < 300, ps.length);
}
{
  const sp = shed(one('spit')[0], 1);
  check('spit: pink drops that fall', sp.every(p => p.kind === 'fall') && sp.some(p => /f578dc|ffd0f2/.test(p.col)));
  const ms = shed(one('missile')[0], 1);
  check('missile: fire and smoke', ms.some(p => p.kind === 'fire') && ms.some(p => p.kind === 'smoke'));
  const fb = shed(one('fball')[0], 1);
  check('fireball: fire and smoke', fb.some(p => p.kind === 'fire') && fb.some(p => p.kind === 'smoke'));
  const b = one('blast')[0];
  const fly = shed(b, 1).filter(p => p.kind === 'smoke');
  b.vx = b.vy = 0;
  const rest = shed(b, 1).filter(p => p.kind === 'smoke');
  check('blast: smoke while thrown, and rising off the fuse at rest', fly.length > 0 && rest.length > 0 && rest.every(p => p.vy < 0), [fly.length, rest.length]);
  const ar = shed(one('arrow')[0], 0.2);
  check('arrow: a white streak along its path', ar.length > 0 && ar.every(p => /ffffff|e8ffe0/.test(p.col)));
}
check('a shot with no spell sheds nothing', G.autoTrail({ x: 0, y: 0, vx: 1, vy: 0, spin: 0, size: 2 }, 1, () => 0).length === 0);

// ---- muzzle, fire spray, disc trail ----
check('Slug: a puff of smoke at the muzzle', G.muzzleFx('slug', 0, 0, 0, R).filter(p => p.kind === 'smoke').length >= 3);
check('… and nothing for the others', G.muzzleFx('bolt', 0, 0, 0, R).length === 0);
{
  const fb = one('fball')[0], dr = G.fireSpray(fb, R);
  check('a fireball throws its fire drops where it lands', dr.length === G.SPRAY.fball && dr.every(d => d.fire && d.sid === 'fdrop' && d.vy < 0), dr.length);
  check('… and they throw none of their own', G.fireSpray(dr[0], R).length === 0);
  check('Firebolt throws fewer', G.fireSpray(one('fbolt')[0], R).length === G.SPRAY.fbolt);
  check('Flamethrower throws none (it never stops)', G.fireSpray(one('flamer')[0], R).length === 0);
}
{
  const d = one('disc')[0];
  for (let i = 0; i < 20; i++) { d.x += 3; G.keepTrail(d); }
  check('disc: remembers its last FX_TRAIL positions, newest first', d.tr.length === G.FX_TRAIL * 2 && d.tr[0] === d.x && d.tr[2] === d.x - 3, d.tr.slice(0, 4));
  const b = one('bolt')[0]; G.keepTrail(b);
  check('… only the disc', !b.tr);
}

// ---- part 2: orbs, lightning, chain, black hole, beams, cross, nuke, meteor ----
for (const id of ['eorb', 'esph', 'zap', 'chain', 'void', 'cross', 'nuke', 'meteor']) {
  const s = one(id)[0];
  check(`${id}: knows its spell, and sheds a trail`, s.sid === id && shed(s, 1).length > 0, s.sid);
}
{
  const v = one('void')[0];
  check('Black Hole carries its pull (drawn as the game\'s) and sheds its motes about every frame', v.pull > 0 && shed(v, 1).length >= 40, shed(v, 1).length);
  const pl = one('plasma')[0], ld = one('ldrill')[0];
  check('beams carry their length (capped) and angle', pl.beam === Math.min(G.SG_BEAM_MAX, G.MODS.plasma.beam) && ld.beam === G.MODS.ldrill.beam && Math.abs(pl.ang) < 0.3, [pl.beam, ld.beam, pl.ang]);
  pl.ang = 0; ld.ang = 0;
  const e = G.traceBeam(pl, (x) => x > 150);
  check('a beam stops at the first rock', e.rock && e.x > 150 && e.x < 154 && e.y === 100, e);
  const e2 = G.traceBeam(ld, () => false);
  check('… or ends at its length (the drill is short)', !e2.rock && Math.abs(e2.x - 100 - ld.beam) < 1e-9, e2);
  check('a beam sheds sparks only once it has landed', shed(pl, 1).length === 0 && (pl.bx = 150, pl.by2 = 100, shed(pl, 1).length > 0));
}
{
  const z = one('zap')[0];
  for (let i = 0; i < 30; i++) { z.x += 10; G.keepTrail(z); }
  check('zap: remembers its last stretch for the bolt', z.tr.length === G.TRAIL_N.zap * 2, z.tr.length);
  const foes = [{ x: 900, ty: 100, hp: 5 }, { x: z.x + 40, ty: 120, hp: 5 }];
  let fk = null;
  for (let i = 0; i < 200 && !fk; i++) fk = G.zapFork(z, foes, 0, 1 / 60, R);
  check('zap: forks at the nearest creature in reach', !!fk && fk[fk.length - 1].x === z.x + 40 && fk[0].x === z.x && fk.length > 2, fk && fk.length);
  check('… only a lightning bolt forks', G.zapFork(one('bolt')[0], foes, 0, 1, () => 0) === null);
  const j = G.jagPts(0, 0, 80, 0, 3, R);
  check('a jagged line keeps its ends, kinks within amp', j[0].x === 0 && j[j.length - 1].x === 80 && j.every(q => Math.abs(q.y) <= 3), j.length);
}
{
  const nb = G.bigBoomFx('nuke', 0, 0, 16, R), mb = G.bigBoomFx('meteor', 0, 0, 16, R);
  check('nuke and meteor blasts throw a capped burst of fire, smoke, debris', nb.length > 30 && nb.length <= G.BIG_BOOM_PARTS && mb.length > 30, [nb.length, mb.length]);
  check('… other blasts none', G.bigBoomFx('blast', 0, 0, 16, R).length === 0);
  check('nuke boom looks bigger and longer than a plain one', G.boomLook('nuke').k > 1 && G.boomLook('nuke').max > G.boomLook('blast').max && G.boomLook().k === 1);
}
// ---- in a level: a Plasma Beam hits the creature in front and sets it burning ----
{
  const run = G.newRun(3);
  const g = run.players[0].guns[run.players[0].active];
  g.slots = ['plasma', null, null]; G.resetGun(g);
  const S = G.levelScene(200, 3, 1, undefined, run.players);
  for (let t = 0; t < 2; t += 1 / 60) G.titleStep(S, 1 / 60);
  const r = S.runners[0];
  S.lvl.step = null; S.pace = 0; S.spawn = 1e9; S.still = false; S.foes.length = 0;
  const k = G.enemyFor('rotta', 1), fy = r.y + G.PH - k.r - 1;
  const foe = { x: S.scroll + r.x + 50, y: fy, ty: fy, r: k.r, phase: 0, hp: 9999, hpMax: 9999, cd: 99, flash: 0, lx: 0, ly: 1,
    hx: S.scroll + r.x + 50, hy: fy, tgt: null, rest: 99, k, touch: 0, charge: 0 };
  S.foes.push(foe);
  let beams = 0, burn = 0;
  for (let t = 0; t < 3; t += 1 / 60) {
    G.titleStep(S, 1 / 60); foe.x = foe.hx; foe.y = foe.ty = fy; foe.hp = Math.max(foe.hp, 1);
    beams += S.shots.filter(s => s.sid === 'plasma' && s.bx != null).length; burn = Math.max(burn, foe.burn || 0);
  }
  check('level: Plasma Beam fires as a beam and hits (and burns) the creature ahead', beams > 0 && foe.hp < 9999 && burn > 0, { beams, hp: foe.hp, burn });
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
