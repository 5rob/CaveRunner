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
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
