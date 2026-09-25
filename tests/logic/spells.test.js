const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w,h){this.width=w;this.height=h;this.data=new Uint8ClampedArray(w*h*4);} }\n';
const G = new Function('React', shim + upto +
  'return { MODS, ALL_IDS, SHOT_IDS, planCast, resetGun, modPreview, castGroups, groupStats, ' +
  'tracePath, buildAdvice, gunRate, tierOf, modWeight, rollMod, effRecharge, NOITA_SPAWN, NOITA_OF };')({ createElement: () => {} });

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++; console.log(`FAIL ${n}` + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
const mk = (slots, over) => G.resetGun(Object.assign({ name: 'T', cap: slots.length,
  castDelay: 0.12, recharge: 0.4, manaMax: 400, manaRegen: 60, spread: 0,
  multi: 1, shuffle: false, mana: 400, speedMul: 1, slots }, over || {}));

// ---- every single mod survives being planned, previewed and traced ----
for (const id of G.ALL_IDS) {
  const m = G.MODS[id];
  let plan, prev;
  try { plan = G.planCast(mk([id, 'bolt', 'bolt', 'bolt'])); } catch (e) { ok(id + ' plans', false, e.message); continue; }
  ok(id + ' plans to something sane', plan && plan.shots.length >= 0 && isFinite(plan.cost) && isFinite(plan.delay),
    plan && { n: plan.shots.length, cost: plan.cost, delay: plan.delay });
  ok(id + ' never plans a negative cost', plan.cost >= 0, plan.cost);
  ok(id + ' keeps the delay above the frame floor', plan.delay >= 0.016, plan.delay);
  for (const sh of plan.shots) {
    ok(id + ' shot has finite damage', isFinite(sh.dmg) && sh.dmg >= 0, sh.dmg);
    ok(id + ' shot has finite speed', isFinite(sh.speed), sh.speed);
    ok(id + ' shot has a usable life', isFinite(sh.life) && sh.life > 0, sh.life);
  }
  try { prev = G.modPreview(id); } catch (e) { ok(id + ' previews', false, e.message); continue; }
  ok(id + ' info card has rows', prev.rows.length > 0 || m.kind === 'mod', prev.rows.length);
  // the aim line must not throw or produce NaN for anything that flies
  const sh = plan.shots.find(x => !x.still);
  if (sh) {
    const out = [];
    try { G.tracePath(sh, 100, 100, 1, 0, () => false, [{ x: 300, y: 100, ty: 100 }], out, { x: 100, y: 100 }); }
    catch (e) { ok(id + ' traces', false, e.message); continue; }
    ok(id + ' aim line is all real numbers', out.every(v => isFinite(v)), out.slice(0, 6));
    ok(id + ' aim line has points', out.length >= 2, out.length);
  }
}

// ---- the Greek letters actually copy ----
const shotsOf = g => G.planCast(g).shots.length;
ok('Alpha adds a copy of the first spell', shotsOf(mk(['alpha', 'bolt', null, null])) === 2,
  shotsOf(mk(['alpha', 'bolt', null, null])));
ok('a shot before Alpha means Alpha is never reached that pull',
  shotsOf(mk(['bolt', 'alpha', null, null])) === 1, shotsOf(mk(['bolt', 'alpha', null, null])));
ok('Gamma adds a copy of the last spell', shotsOf(mk(['alpha' === 'x' ? 'x' : 'gamma', 'bolt', 'slug', null])) >= 2);
ok('Omega copies everything on the gun', shotsOf(mk(['omega', 'bolt', 'slug', null])) === 4,
  shotsOf(mk(['omega', 'bolt', 'slug', null])));
ok('Phi copies only the shots', shotsOf(mk(['phi', 'bolt', 'heavy', 'slug'])) === 4,
  shotsOf(mk(['phi', 'bolt', 'heavy', 'slug'])));
ok('Sigma copies only the static fields', shotsOf(mk(['sigma', 'boom', 'bolt', null])) === 3,
  shotsOf(mk(['sigma', 'boom', 'bolt', null])));
ok('Tau repeats the next two', shotsOf(mk(['tau', 'bolt', 'slug', null])) === 4,
  shotsOf(mk(['tau', 'bolt', 'slug', null])));
{
  const plain = G.planCast(mk(['bolt', 'heavy', null, null])).shots[0];
  const withMu = G.planCast(mk(['mu', 'bolt', 'heavy', null])).shots[0];
  ok('Mu applies a modifier sitting after the shot', withMu.dmg > plain.dmg * 1.9,
    { plain: plain.dmg, mu: withMu.dmg });
}
{
  const other = mk(['slug', null, null, null]);
  const g = mk(['zeta', 'bolt', null, null]);
  const n = G.planCast(g, [g, other]).shots.length;
  ok('Zeta borrows a spell off another gun', n === 2, n);
  const alone = G.planCast(mk(['zeta', 'bolt', null, null])).shots.length;
  ok('Zeta with no other gun just casts the bolt', alone === 1, alone);
}
ok('a copied Omega does not copy again (no runaway)',
  G.planCast(mk(['omega', 'omega', 'bolt', null])).shots.length < 12,
  G.planCast(mk(['omega', 'omega', 'bolt', null])).shots.length);

// ---- multicast and formations ----
ok('Octuple gathers eight', shotsOf(mk(['oct'].concat(new Array(8).fill('bolt')))) === 8,
  shotsOf(mk(['oct'].concat(new Array(8).fill('bolt')))));
ok('Myriad fires everything left', shotsOf(mk(['myriad', 'bolt', 'bolt', 'slug', 'bolt'])) === 4,
  shotsOf(mk(['myriad', 'bolt', 'bolt', 'slug', 'bolt'])));
{
  const p = G.planCast(mk(['trifur', 'bolt', 'bolt', 'bolt']));
  ok('Trifurcated fans three shots out', p.shots.length === 3 &&
    JSON.stringify(p.shots.map(s => s.ang)) === '[-17,0,17]', p.shots.map(s => s.ang));
  const b = G.planCast(mk(['behind', 'bolt', 'bolt', null]));
  ok('Behind Your Back sends one the other way',
    b.shots.length === 2 && b.shots[1].ang === 180, b.shots.map(s => s.ang));
}

// ---- utility acts reach the caller ----
for (const [id, act] of [['refresh', 'refresh'], ['farcast', 'far'], ['telecast', 'tele'],
  ['warpcast', 'warp'], ['sawstorm', 'saws'], ['gpower', 'gpower'], ['manapow', 'manapow']]) {
  const p = G.planCast(mk([id, 'bolt', null, null]));
  ok(id + ' passes its action to the game', (p.acts || []).includes(act), p.acts);
}
{
  const p = G.planCast(mk(['bpower', 'bolt', null, null]));
  ok('Blood To Power charges health', p.hp === 8, p.hp);
  ok('and it makes the shot hit harder', p.shots[0].dmg > 2.5, p.shots[0].dmg);
}
{
  const bare = G.gunRate(mk(['bolt', 'bolt', null, null]));
  const bled = G.gunRate(mk(['bpower', 'bolt', 'bpower', 'bolt']));
  ok('the advisor discounts a build that bleeds you', bled.bleed < 1, bled.bleed);
  ok('and says so', G.buildAdvice(mk(['bpower', 'bolt', 'bpower', 'bolt']), []).limit.key === 'blood',
    G.buildAdvice(mk(['bpower', 'bolt', 'bpower', 'bolt']), []).limit);
  ok('a plain gun is not accused of bleeding you', bare.bleed === 1, bare.bleed);
}

// ---- static projectiles are cast things, not modifiers ----
{
  const p = G.planCast(mk(['boom', 'bolt', null, null]));
  ok('a static field takes a cast slot', p.shots.length === 1 && p.shots[0].still === 1,
    p.shots.map(s => s.still));
  const d = G.planCast(mk(['double', 'boom', 'crystal', null]));
  ok('a multicast gathers two fields at once', d.shots.length === 2 && d.shots.every(s => s.still),
    d.shots.length);
  ok('the field carries its radius', p.shots[0].r === G.MODS.boom.r, p.shots[0].r);
}

// ---- beams ----
{
  const p = G.planCast(mk(['plasma', null, null, null]));
  ok('a beam shot carries its range', p.shots[0].beam === 320, p.shots[0].beam);
  const out = [];
  G.tracePath(p.shots[0], 0, 0, 1, 0, x => x > 150, [], out);
  ok('the aim line stops a beam at the wall', out[out.length - 2] <= 155, out[out.length - 2]);
}

// ---- drops follow Noita's spawn table (v80) ----
{
  const missing = G.ALL_IDS.filter(id => !G.NOITA_SPAWN[G.NOITA_OF[id]]);
  ok('every spell that can drop has a Noita spawn row', missing.length === 0, missing);
  ok('floor 1 is tier 0: Spark Bolt at its full 2', G.modWeight('bolt', 1) === 2, G.modWeight('bolt', 1));
  ok('Myriad (tiers 5,6,10) never drops early', G.modWeight('myriad', 1) === 0 && G.modWeight('myriad', 5) === 0,
    [G.modWeight('myriad', 1), G.modWeight('myriad', 5)]);
  ok('and does deep down', G.modWeight('myriad', 10) > 0 && G.modWeight('myriad', 11) > 0,
    [G.modWeight('myriad', 10), G.modWeight('myriad', 11)]);
  ok('Spark Bolt (tiers 0-2) is gone by floor 6', G.modWeight('bolt', 6) === 0, G.modWeight('bolt', 6));
  ok('between tiers it slides', G.modWeight('bolt', 2) < 2 && G.modWeight('bolt', 2) > 1, G.modWeight('bolt', 2));
  ok('both Teleport Bolts drop from floor 1', G.modWeight('tele', 1) > 0 && G.modWeight('teleshort', 1) > 0);
  ok('Vacuum Field waits for tier 2', G.modWeight('vacfield', 1) === 0 && G.modWeight('vacfield', 5) > 0,
    [G.modWeight('vacfield', 1), G.modWeight('vacfield', 5)]);
  let rs = 7;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
  const got = {};
  for (let i = 0; i < 4000; i++) { const id = G.rollMod(rnd, 1); got[id] = (got[id] || 0) + 1; }
  const bad = Object.keys(got).filter(id => G.modWeight(id, 1) === 0);
  ok('floor 1 only hands out what tier 0 lists', bad.length === 0, bad);
  ok('and Spark Bolt is the most common thing on it', Object.keys(got).every(id => got[id] <= got.bolt), got.bolt);
  ok('every floor has something to hand out', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 20]
    .every(f => G.ALL_IDS.some(id => G.modWeight(id, f) > 0)));
}

// ---- new modifiers do what they say ----
const shot = slots => G.planCast(mk(slots)).shots[0];
ok('Knockback adds shove', shot(['knock', 'bolt']).knock > 0);
ok('Critical Plus adds crit chance', shot(['crit', 'bolt']).crit === 0.25, shot(['crit', 'bolt']).crit);
ok('Gravity pulls the shot down', shot(['gravmod', 'bolt']).grav > 0);
ok('Anti-Gravity lifts it', shot(['float', 'bolt']).grav < 0);
ok('Horizontal Path cancels gravity and pays damage', shot(['flat', 'esph']).grav === 0 &&
  shot(['flat', 'esph']).dmg > shot(['esph']).dmg, shot(['flat', 'esph']).grav);
ok('Short-range Homing sets a short leash', shot(['nearhome', 'bolt']).homeR === 70);
ok('Quantum Split trades damage for copies', shot(['split', 'bolt']).split === 3 &&
  shot(['split', 'bolt']).dmg < shot(['bolt']).dmg);
ok('Explosive Bounce adds bounces and a payload', shot(['bboom', 'bolt']).bounceFx === 'explode' &&
  shot(['bboom', 'bolt']).bounce >= 2);
ok('Heavy Spread trades accuracy for speed', shot(['hspread', 'bolt']).spread > 20 &&
  G.planCast(mk(['hspread', 'bolt'])).delay < G.planCast(mk(['bolt'])).delay);
ok('Recoil Damper takes the kick out', shot(['damper', 'slug']).recoil < shot(['slug']).recoil / 4);
ok('Matter Eater chews terrain', shot(['eater', 'bolt']).eat >= 4);
ok('Bloodlust can turn on you', shot(['lust', 'bolt']).friendly === 1);

// ---- the whole table still groups and costs sensibly ----
{
  const g = mk(['double', 'bolt', 'saw', 'heavy']);
  ok('cast groups still work with the bigger table', (G.castGroups(g) || []).length > 0);
  ok('group stats still work', G.groupStats(g, G.castGroups(g)[0]).length > 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
