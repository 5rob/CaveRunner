// CaveRunner Auto stage 5a: the starter kit (auto/run.js starterKit), the stats meters' rings (auto/meters.js),
// the real-gun bridge (art/scenegun.js: gunTick / gunPull / planShots), every mod through it (each changes
// something about the shots or the gun's clocks, or is on GUN_TODO, and everything on GUN_TODO really changes
// nothing), and a sandboxed level scene: a player's active gun kills a creature by its enemyFor health, the
// damage credited to the player and in its meter.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// ---- the starter kit ----
{
  let ok = true;
  for (let i = 0; i < 60; i++) {
    const k = G.starterKit(rnd), g = k.gun, s = g.slots[0];
    if (!(g.cap === 3 && g.slots.length === 3 && !g.shuffle && g.multi === 1 && s && G.MODS[s].kind === 'shot' && G.tierOf(s) === 1
      && !G.MODS[s].bore && !G.MODS[s].tele && !G.MODS[s].trig && g.slots[1] === null && g.slots[2] === null
      && k.saw.kind === 'mod' && k.saw.id === 'saw' && g.mana === g.manaMax)) { ok = false; console.log(g); break; }
  }
  check('starterKit: 3 slots, no shuffle, a tier-1 projectile (no digger) in slot 1, a Buzzsaw for the bag', ok);
  check('the starter shots: several, none a digger', G.STARTER_SHOTS.length >= 4 && !G.STARTER_SHOTS.includes('digbolt') && !G.STARTER_SHOTS.includes('saw'), G.STARTER_SHOTS);
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(G.starterKit(rnd).gun.slots[0]);
  check('…a random one of them', seen.size === G.STARTER_SHOTS.length, [...seen]);
  const run = G.newRun(5);
  G.bagAdd(run, { kind: 'green', n: 2 });
  const p = G.addPlayer(run);
  check('newRun and addPlayer: each player its own gun, active; the Buzzsaws stack in the bag',
    !!run.players[0].guns[0] && !!p.guns[0] && p.guns[0] !== run.players[0].guns[0] && p.active === 0
    && run.bag.find(x => x && x.id === 'saw').n === 2);
  const o = G.DEV.autoGunMana; G.DEV.autoGunMana = 333;
  check('the starter gun follows its Dev knobs', G.starterKit(rnd).gun.manaMax === 333);
  G.DEV.autoGunMana = o;
}

// ---- the meters ----
{
  const M = G.meterNew(30, 0.25);
  check('a meter: 30 s of 0.25 s ticks', M.n === 120 && G.meterValues(M).length === 120 && G.meterSum(M) === 0);
  G.meterAdd(M, 5); G.meterAdd(M, 2); G.meterStep(M, 0.25); G.meterAdd(M, 1);
  const v = G.meterValues(M);
  check('damage adds up in its tick; the newest last', v[119] === 1 && v[118] === 7 && G.meterSum(M) === 8, v.slice(-3));
  G.meterStep(M, 30);
  check('…and is gone 30 s later', G.meterSum(M) === 0);
  const H = G.meterNew();
  G.meterSet(H, 100); G.meterStep(H, 0.5, true); G.meterSet(H, 80); G.meterStep(H, 0.25, true);
  const hv = G.meterValues(H);
  check('health: a reading carries on till the next', hv.slice(-4).join() === '100,100,80,80', hv.slice(-4));
}

// ---- the bridge: clocks and mana ----
{
  const g = G.resetGun({ name: 't', cap: 2, castDelay: 0.2, recharge: 0.5, manaMax: 30, manaRegen: 10, spread: 0, multi: 1,
    shuffle: false, speedMul: 1, mana: 30, slots: ['bolt', 'bolt'] });
  const cost = G.MODS.bolt.mana;
  const p1 = G.gunPull(g);
  check('a pull: shots, mana spent, the cast delay set', !!p1 && p1.shots.length === 1 && Math.abs(g.mana - (30 - cost)) < 1e-9 && g.delayT > 0);
  check('not again before the cast delay', G.gunPull(g) === null);
  G.gunTick(g, 1);
  const p2 = G.gunPull(g);
  check('the second, then the recharge (the list ran out)', !!p2 && g.rechT > 0.4);
  G.gunTick(g, 0.3);
  check('still recharging', G.gunPull(g) === null);
  const poor = G.resetGun(Object.assign({}, g, { mana: 0, manaRegen: 0, slots: ['bolt', null] }));
  poor.delayT = poor.rechT = 0;
  check('no mana: no shot, the gun stays where it was', G.gunPull(poor) === null && poor.idx === 0);
}

// ---- every mod through the bridge ----
const R0 = () => 0.8;
const gunOf = slots => G.resetGun({ name: 'm', cap: slots.length, castDelay: 0.2, recharge: 0.5, manaMax: 5000, manaRegen: 100, spread: 0,
  multi: 1, shuffle: false, speedMul: 1, mana: 5000, slots: slots.slice() });
const strip = s => { const o = Object.assign({}, s); delete o.x; delete o.y; delete o.spin; if (o.pay) o.pay = o.pay.length; return o; };
// what the scene gets from a gun: its first pull's shots (as the scene flies them), its cast delay, recharge and mana
function sig(slots, withDelay) {
  const g = gunOf(slots), pas = G.gunPassives(g), plan = G.planCast(g);
  const shots = G.planShots(plan, 0, 0, 0, R0, 0).map(strip);
  return { n: shots.length, s: JSON.stringify(shots), clocks: JSON.stringify([withDelay ? plan.delay : 0, G.effRecharge(g), pas.manaMax, pas.manaRegen]) };
}
const base = sig(['bolt', 'bolt'], true), baseNoDelay = sig(['bolt', 'bolt'], false);
const same = [];
for (const id of G.ALL_IDS.filter(k => k !== 'bolt')) {
  const M = G.MODS[id], shot = M.kind === 'shot' || M.kind === 'static';
  let changed;
  if (shot) {
    const a = sig([id], true), b = sig(['bolt'], true);
    changed = a.n > 0 && a.s !== b.s;
  } else {
    // a modifier: its f must change the shot (a cast delay alone doesn't count for one that has an f)
    const a = sig([id, 'bolt', 'bolt'], !M.f), b = M.f ? baseNoDelay : base;
    changed = a.n > 0 && (a.s !== b.s || a.n !== b.n || a.clocks !== b.clocks);
  }
  if (!changed) same.push(id);
}
const todo = new Set(G.GUN_TODO);
const missing = same.filter(id => !todo.has(id)), stale = G.GUN_TODO.filter(id => !same.includes(id));
check('every mod changes something through the bridge, or is on GUN_TODO', missing.length === 0, missing);
check('…and nothing on GUN_TODO works already (the list stays honest)', stale.length === 0, stale);
console.log('     (GUN_TODO: ' + G.GUN_TODO.length + ' of ' + G.ALL_IDS.length + ' mods)');

// ---- a trigger's payload rides along ----
{
  const plan = G.planCast(gunOf(['bolt_t', 'spark']));
  const out = G.planShots(plan, 0, 0, 0, R0, 0);
  check('a trigger carries its payload into the scene', out.length === 1 && out[0].trig === 'hit' && out[0].pay && out[0].pay.length === 1);
}

// ---- the scene: a sandbox (a flat level strip, one creature in front), real damage ----
{
  const run = G.newRun(3);
  const pl = run.players[0];
  pl.guns[0] = gunOf(['bolt', 'bolt', 'bolt']);
  const S = G.levelScene(200, 3, 1, undefined, run.players);
  const L = G.levelState(S);
  S.lvl.step = null;                  // no phases: the team stays put on the flat start pad, shooting
  S.pace = 0; S.spawn = 1e9; S.still = false;
  const r = S.runners[0];
  r.hide = false;
  const k = G.enemyFor('rotta', 1);
  const fy = r.y + G.PH - k.r - 1;
  const foe = { x: S.scroll + r.x + 60, y: fy, ty: fy, r: k.r, phase: 0, hp: k.hp, hpMax: k.hp, cd: 99, flash: 0, lx: 0, ly: 1,
    hx: S.scroll + r.x + 60, hy: fy, tgt: null, rest: 99, k, touch: 0, charge: 0 };
  S.foes.push(foe);
  let t = 0, low = 5000;
  for (; t < 8 && foe.hp > 0; t += 1 / 60) { G.titleStep(S, 1 / 60); foe.x = foe.hx; foe.y = foe.ty = fy; G.levelMeters(S, L, 1 / 60); low = Math.min(low, pl.guns[0].mana); }
  check('the player\'s active gun kills a creature by its enemyFor health', foe.hp <= 0, { hp: foe.hp, t });
  check('…the damage credited to the player (all of its health)', Math.abs((r.dealt || 0) - k.hp) < 1e-6, r.dealt);
  check('…and in its damage meter', Math.abs(G.meterSum(L.meters[0].dmg) - k.hp) < 1e-6, G.meterSum(L.meters[0].dmg));
  check('health recorded each tick', G.meterValues(L.meters[0].hp).slice(-1)[0] === pl.hp);
  check('the gun spent mana', low < 5000, low);
}

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
