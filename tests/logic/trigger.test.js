// Spell With Trigger and friends: a carrier that takes the spells after it along and
// casts them where it lands. The thing that can really break here is a trigger that
// carries a trigger, so most of this suite is spent measuring how deep a payload can
// get and how many spells one pull can possibly produce.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w*h*4); } }\n';
const G = new Function('React', shim + upto +
  'return { MODS, ALL_IDS, SHOT_IDS, SEED_SHOTS, MOD_TIER, MOD_PRICE, FAMILY_OF, planCast, resetGun, ' +
  'castGroups, groupStats, gunRate, tracePath, modPreview, effRecharge };')({ createElement: () => {} });

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++; console.log(`FAIL ${n}` + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
const mk = (slots, over) => G.resetGun(Object.assign({ name: 'T', cap: slots.length,
  castDelay: 0.12, recharge: 0.4, manaMax: 9999, manaRegen: 60, spread: 0,
  multi: 1, shuffle: false, mana: 9999, speedMul: 1, slots }, over || {}));
const plan = (slots, over) => G.planCast(mk(slots, over));
const TRIGGERS = G.ALL_IDS.filter(id => G.MODS[id].payload);

// how deep the payload tree goes, and how many spells are in it altogether
const depth = sh => (sh.payload && sh.payload.length ? 1 + Math.max(...sh.payload.map(depth)) : 0);
const size = sh => 1 + (sh.payload || []).reduce((t, q) => t + size(q), 0);
const spells = p => p.shots.reduce((t, sh) => t + size(sh), 0);
const deepest = p => p.shots.reduce((t, sh) => Math.max(t, depth(sh)), 0);

// ---- the mods exist and are registered like every other mod ----
ok('there are trigger carriers at all', TRIGGERS.length === 3, TRIGGERS);
for (const id of TRIGGERS) {
  const m = G.MODS[id];
  ok(id + ' is a shot, so it takes a cast slot', m.kind === 'shot', m.kind);
  ok(id + ' has a price, a tier and a family',
    !!G.MOD_PRICE[id] && !!G.MOD_TIER[id] && !!G.FAMILY_OF[id],
    [G.MOD_PRICE[id], G.MOD_TIER[id], G.FAMILY_OF[id]]);
  ok(id + ' carries a whole number of spells', m.payload >= 1 && m.payload <= 2, m.payload);
  ok(id + ' is kept out of the seed list, so no found gun is a bare trigger',
    !G.SEED_SHOTS.includes(id), G.SEED_SHOTS.length);
}

// ---- the payload attaches to the carrier, and is not also cast now ----
{
  const p = plan(['trig', 'bolt']);
  ok('a trigger fires one carrier, not two shots', p.shots.length === 1, p.shots.length);
  ok('and the next spell is riding on it', p.shots[0].payload && p.shots[0].payload.length === 1,
    p.shots[0].payload);
  ok('the payload is a real bolt', p.shots[0].payload[0].dmg === G.MODS.bolt.dmg
    && p.shots[0].payload[0].speed > 0, p.shots[0].payload[0]);
  ok('both spells are paid for', p.cost === G.MODS.trig.mana + G.MODS.bolt.mana, p.cost);
  ok('and both cast delays are counted',
    Math.abs(p.delay - (0.12 + G.MODS.trig.delay + G.MODS.bolt.delay)) < 1e-9, p.delay);
  const bare = plan(['trig']);
  ok('a trigger with nothing after it just flies', bare.shots.length === 1
    && (!bare.shots[0].payload || !bare.shots[0].payload.length), bare.shots[0].payload);
  ok('carrying nothing costs only the carrier', bare.cost === G.MODS.trig.mana, bare.cost);
}
{
  const p = plan(['dtrig', 'bolt', 'slug']);
  ok('Double Trigger carries two spells', p.shots.length === 1 && p.shots[0].payload.length === 2,
    p.shots.map(s => (s.payload || []).length));
  ok('and pays for both', p.cost === G.MODS.dtrig.mana + G.MODS.bolt.mana + G.MODS.slug.mana, p.cost);
  const short = plan(['dtrig', 'bolt']);
  ok('Double Trigger with only one spell left takes what there is',
    short.shots[0].payload.length === 1, short.shots[0].payload.length);
}
{
  const t = plan(['timer', 'bolt']), c = plan(['trig', 'bolt']);
  ok('the timer carrier is short-lived, so it lets go in mid-air',
    t.shots[0].life < c.shots[0].life * 0.5, [t.shots[0].life, c.shots[0].life]);
  ok('and it is carrying the same payload', t.shots[0].payload.length === 1, t.shots[0].payload);
}

// ---- modifiers reach the payload ----
{
  const p = plan(['trig', 'dmg_up', 'bolt']);
  ok('a modifier drawn between carrier and payload reaches the payload',
    p.shots[0].payload[0].dmg === 1 + 1.5, p.shots[0].payload[0].dmg);
  const q = plan(['dmg_up', 'trig', 'bolt']);
  ok('a modifier before the trigger reaches the payload too',
    q.shots[0].payload[0].dmg === 1 + 1.5, q.shots[0].payload[0].dmg);
  const h = plan(['trig', 'heavy', 'bolt']);
  ok('speed modifiers reach it as well', h.shots[0].payload[0].speed === G.MODS.bolt.speed * 0.35,
    h.shots[0].payload[0].speed);
  const big = plan(['trig', 'scatter', 'buck']);
  ok('and pellet counts', big.shots[0].payload[0].count === G.MODS.buck.count * 3,
    big.shots[0].payload[0].count);
}
{
  const p = plan(['trig', 'boom']);
  ok('a static field can be a payload', p.shots[0].payload[0].still === 1
    && p.shots[0].payload[0].field === 'explode', p.shots[0].payload[0]);
  ok('and the field is not also cast at your feet', p.shots.length === 1
    && !p.shots[0].still, p.shots.map(s => s.still));
}

// ---- it must not chain: this is the one that would eat the game ----
{
  const p = plan(['trig', 'trig', 'bolt']);
  ok('a trigger carried by a trigger is just a shot', p.shots[0].payload.length === 1
    && !p.shots[0].payload[0].payload, p.shots[0].payload[0].payload);
  ok('so the payload tree is exactly one level deep', deepest(p) === 1, deepest(p));
}
for (let n = 1; n <= 8; n++) {
  const slots = new Array(n).fill('trig');
  const p = plan(slots);
  ok(n + ' triggers in a row stay one level deep', deepest(p) <= 1, deepest(p));
  ok(n + ' triggers in a row make at most one spell per slot', spells(p) <= n, spells(p));
}
{
  // the nastiest shapes we can build: every multicast and copy mod wrapped round triggers
  const nasty = [
    ['myriad', 'trig', 'bolt', 'trig', 'bolt'],
    ['omega', 'trig', 'bolt'],
    ['omega', 'dtrig', 'trig', 'bolt'],
    ['tau', 'trig', 'trig'],
    ['phi', 'trig', 'bolt', 'timer'],
    ['oct', 'trig', 'dtrig', 'timer', 'bolt'],
    ['myriad', 'omega', 'trig', 'dtrig', 'timer', 'bolt', 'trig', 'trig'],
    ['double', 'trig', 'double', 'trig', 'bolt'],
    ['mu', 'trig', 'bolt'],
    ['alpha', 'trig', 'bolt'],
    ['gamma', 'trig', 'bolt'],
  ];
  for (const slots of nasty) {
    const g = mk(slots);
    let worst = 0, most = 0, cost = 0;
    for (let pull = 0; pull < 6; pull++) {
      const p = G.planCast(g);
      worst = Math.max(worst, deepest(p));
      most = Math.max(most, spells(p));
      cost = Math.max(cost, p.cost);
      if (p.wrap) g.idx = 0;
    }
    const label = slots.join('+');
    ok(label + ': never more than one level of payload', worst <= 1, worst);
    // a pull can fire each cast slot twice at the very most (the multicast wrap-around),
    // and every one of those can be carrying one spell
    ok(label + ': the pull stays bounded by the gun', most <= slots.length * 4, most);
    ok(label + ': the mana cost stays finite', isFinite(cost) && cost < 5000, cost);
  }
}

// ---- multicast and the draw order ----
{
  const p = plan(['double', 'trig', 'bolt', 'bolt']);
  ok('a double cast over a trigger fires the carrier and the next spell after the payload',
    p.shots.length === 2, p.shots.length);
  ok('the first shot is the carrier, holding one bolt',
    p.shots[0].payload && p.shots[0].payload.length === 1, p.shots[0].payload);
  ok('the second is a plain bolt', !p.shots[1].payload && p.shots[1].dmg === G.MODS.bolt.dmg,
    [p.shots[1].dmg, p.shots[1].payload]);
}
{
  const g = mk(['bolt', 'trig']);
  const first = G.planCast(g);
  ok('a shot before the trigger fires on its own', first.shots.length === 1
    && !first.shots[0].payload, first.shots[0].payload);
  const second = G.planCast(g);
  ok('a trigger at the end of the gun does not wrap round for a payload',
    !second.shots[0].payload || !second.shots[0].payload.length, second.shots[0].payload);
}
{
  const g = mk(['trig', 'bolt', 'slug']);
  G.planCast(g);
  ok('the gun moves past the slots the trigger swallowed', g.idx === 2, g.idx);
  const next = G.planCast(g);
  ok('so the next pull is the slug', next.shots.length === 1
    && next.shots[0].dmg === G.MODS.slug.dmg, next.shots[0].dmg);
}
{
  // planCast mutates g.idx, so a previewing caller passes a copy. Make sure a trigger
  // does not smuggle a mutation back onto the real gun.
  const g = mk(['trig', 'bolt', 'slug']);
  const copy = Object.assign({}, g, { slots: g.slots.slice(), order: g.order.slice() });
  G.planCast(copy);
  ok('planning on a copy leaves the real gun where it was', g.idx === 0, g.idx);
  ok('and leaves its slots alone', g.slots.join() === 'trig,bolt,slug', g.slots);
}

// ---- the advisor has to see both sides of the bargain ----
{
  const rate = s => G.gunRate(mk(s));
  const alone = rate(['trig']), loaded = rate(['trig', 'bolt']), nuked = rate(['trig', 'nuke']);
  ok('a loaded trigger beats an empty one', loaded.dps > alone.dps, [alone.dps, loaded.dps]);
  ok('a bigger payload is worth more', nuked.dps > loaded.dps, [loaded.dps, nuked.dps]);
  ok('the payload mana is charged for', loaded.manaPerSec > alone.manaPerSec,
    [alone.manaPerSec, loaded.manaPerSec]);
  ok('the payload counts as a shot', loaded.shots === 2, loaded.shots);
  ok('every rate is a real number', [alone, loaded, nuked].every(r => isFinite(r.dps) && r.dps >= 0),
    [alone.dps, loaded.dps, nuked.dps]);
}

// ---- the build screen reads sensibly ----
{
  const g = mk(['trig', 'bolt']);
  const groups = G.castGroups(g);
  ok('trigger and payload are drawn as one group', groups.length === 1
    && groups[0].from === 0 && groups[0].to === 2, groups && groups.map(x => [x.from, x.to]));
  const rows = G.groupStats(g, groups[0]);
  const dmg = rows.find(r => r.label === 'dmg');
  ok('the group damage counts the payload', dmg && dmg.value === '1.5', dmg);
  ok('and the stat line has no nonsense in it',
    rows.every(r => r.value !== undefined && !/NaN|undefined/.test(r.value + r.delta)), rows);
  const prev = G.modPreview('trig');
  ok('the detail card says what it carries',
    prev.rows.some(r => r[0] === 'carries'), prev.rows);
}

// ---- the aim line stays honest ----
{
  // a payload changes nothing about how the carrier flies, so the traced line must be
  // identical with and without one. If that ever stops being true, the line is lying.
  const solid = (x, y) => x > 400;
  const trace = sh => { const out = []; G.tracePath(sh, 100, 100, 1, 0, solid, [], out, { x: 100, y: 100 }); return out; };
  const withPay = plan(['trig', 'bolt']).shots[0];
  const without = plan(['trig']).shots[0];
  const a = trace(withPay), b = trace(without);
  ok('the aim line for a loaded trigger matches an empty one', a.join() === b.join(),
    [a.length, b.length]);
  ok('and it is drawn all the way to the rock', a.length > 4 && Math.max(...a.filter((_, i) => i % 2 === 0)) > 380,
    a.length);
  const timerPath = trace(plan(['timer', 'bolt']).shots[0]);
  ok('the timer carrier stops short, because it goes off early',
    timerPath.length < a.length, [timerPath.length, a.length]);
  for (const id of TRIGGERS) {
    const sh = plan([id, 'bolt']).shots[0];
    const out = trace(sh);
    ok(id + ' traces to real numbers', out.every(v => isFinite(v)) && out.length >= 2, out.slice(0, 4));
  }
}

// ---- fuzz: random builds with triggers in them, planned for several pulls ----
{
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pool = G.ALL_IDS.slice();
  let worstDepth = 0, mostSpells = 0, runs = 0, threw = null;
  for (let n = 0; n < 400; n++) {
    const cap = 2 + Math.floor(rnd() * 7);
    const slots = [];
    for (let i = 0; i < cap; i++) {
      slots.push(rnd() < 0.35 ? TRIGGERS[Math.floor(rnd() * TRIGGERS.length)]
        : pool[Math.floor(rnd() * pool.length)]);
    }
    const g = mk(slots, { multi: 1 + Math.floor(rnd() * 3) });
    try {
      for (let pull = 0; pull < 4; pull++) {
        const p = G.planCast(g);
        runs++;
        worstDepth = Math.max(worstDepth, deepest(p));
        mostSpells = Math.max(mostSpells, spells(p));
        if (!isFinite(p.cost) || !isFinite(p.delay) || p.cost < 0) throw new Error('bad plan ' + slots);
        for (const sh of p.shots) {
          if (!isFinite(sh.dmg) || !isFinite(sh.speed) || !(sh.life > 0)) throw new Error('bad shot ' + slots);
          for (const ps of sh.payload || []) {
            if (!isFinite(ps.dmg) || !isFinite(ps.speed) || !(ps.life > 0)) throw new Error('bad payload ' + slots);
          }
        }
        if (p.wrap) g.idx = 0;
      }
    } catch (e) { threw = e.message; break; }
  }
  ok('400 random trigger-heavy guns plan without throwing', !threw, threw);
  ok('none of them nests a payload inside a payload', worstDepth <= 1, worstDepth);
  ok('and none of them runs away', mostSpells <= 96, mostSpells);
  console.log(`     fuzz: ${runs} pulls, deepest payload ${worstDepth}, biggest pull ${mostSpells} spells`);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
