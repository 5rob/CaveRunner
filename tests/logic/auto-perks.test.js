// CaveRunner Auto's perks in a level (src/auto/perks.js, stage: perks): Permanent Shield soaks one hit then comes back
// after DEV.autoShieldT; the Angry Ghost trails him and hits a creature, weaker than his starter gun; Pinpointer is a
// flag only (look only: no speed or spread). Every loop has a frame cap.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const D = G.DEV, dt = 1 / 60;
const perk = id => ({ kind: 'perk', id });

// a quiet sandbox: the level's phases off, one tough creature held 60 units in front of runner 0
function sandbox(perks, gun) {
  const run = G.newRun(3), pl = run.players[0];
  perks.forEach((id, i) => { pl.perks[i] = perk(id); });
  if (!gun) pl.guns = pl.guns.map(() => null);
  else pl.guns[0].slots[0] = 'bolt';   // the starter's shot pinned (its random one made the comparison below swing 5–18)
  const S = G.levelScene(200, 3, 1, undefined, run.players);
  for (let i = 0; i < 240; i++) G.titleStep(S, dt);
  S.lvl.step = null; S.pace = 0; S.spawn = 1e9; S.still = false; S.foes.length = 0; S.shots.length = 0;
  const r = S.runners[0], k = G.enemyFor('rotta', 1), fy = r.y + G.PH - k.r - 1;
  const foe = { x: S.scroll + r.x + 60, y: fy, ty: fy, r: k.r, phase: 0, hp: 1e6, hpMax: 1e6, cd: 99, flash: 0, lx: 0, ly: 1,
    hx: S.scroll + r.x + 60, hy: fy, tgt: null, rest: 99, k, touch: 0, charge: 0 };
  return { run, pl, S, r, foe, fy };
}
const hold = (B, secs) => { for (let t = 0; t < secs; t += dt) { G.titleStep(B.S, dt); B.foe.x = B.foe.hx; B.foe.y = B.foe.ty = B.fy; } };

// ---- Permanent Shield ----
{
  const B = sandbox(['shield'], true), { S, pl, r } = B, hp0 = pl.hp;
  check('the shield is up', G.shieldUp(r, pl));
  G.levelHurt(S, 0, 10);
  check('a hit: soaked whole, no hp lost', pl.hp === hp0, pl.hp);
  check('… the shield is down, recharging for autoShieldT', !G.shieldUp(r, pl) && Math.abs(r.shieldT - D.autoShieldT) < 1e-9, r.shieldT);
  G.levelHurt(S, 0, 10);
  check('the next hit lands', pl.hp < hp0, pl.hp);
  hold(B, D.autoShieldT + 0.1);
  check('after autoShieldT it is back', G.shieldUp(r, pl), r.shieldT);
  const hp1 = pl.hp;
  G.levelHurt(S, 0, 10);
  check('… and soaks again', pl.hp === hp1);
  const N = sandbox([], true);
  check('no perk: no shield', !G.shieldUp(N.r, N.pl));
}

// ---- Angry Ghost ----
// what he puts out: every new shot's damage over the time (the runner wanders, so hits alone are noisy)
const fired = (B, secs, pick) => {
  const seen = new WeakSet(); let sum = 0;
  for (let t = 0; t < secs; t += dt) {
    G.titleStep(B.S, dt); B.foe.x = B.foe.hx; B.foe.y = B.foe.ty = B.fy;
    for (const s of B.S.shots) if (!seen.has(s)) { seen.add(s); if (pick(s)) sum += s.dmg; }
  }
  return sum;
};
{
  const B = sandbox(['ghost'], false), { S, r, foe } = B;
  S.foes.push(foe);
  const ghostOut = fired(B, 8, s => s.col === '#c9a6ff');
  check('the ghost is there, trailing him', !!r.ghost && Math.hypot(r.ghost.x - (r.x + G.PW / 2), r.ghost.y - r.y) < 30, r.ghost);
  const ghostDmg = foe.hpMax - foe.hp;
  check('the ghost hits the creature (no gun in his hands)', ghostDmg > 0, ghostDmg);
  check('its shots are his (they count in his damage dealt)', (r.dealt || 0) > 0, r.dealt);
  const N = sandbox([], true);
  N.S.foes.push(N.foe);
  const gunOut = fired(N, 8, s => s.real && s.by === 0);
  check('the ghost puts out less damage than his starter gun', ghostOut > 0 && ghostOut < gunOut, { ghostOut, gunOut });
  check('no ghost without the perk', !N.r.ghost);
  check('the ghost is weaker than the old game\'s (2 every 0.7 s)', D.autoGhostDmg / D.autoGhostCd < 2 / 0.7);
}

// ---- Pinpointer ----
{
  const P = G.perkBag(['pinpoint']), base = G.perkBag([]);
  check('pinpointer: the flag', P.pinpointer === 1 && G.perkOn({ perks: [perk('pinpoint')] }, 'pinpointer'));
  check('… look only: no speed or spread change', P.speed === base.speed && P.spread === base.spread, { speed: P.speed, spread: P.spread });
}

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('all ok');
