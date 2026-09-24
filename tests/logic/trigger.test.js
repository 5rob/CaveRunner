// Triggers, timers and expiration triggers, Noita-style: not a spell of their own but
// a variant of an existing one ("Bolt With Trigger") that draws the next spells as a
// payload. The payload is a little cast of its own — its own modifiers, multicasts and
// nested triggers — isolated from the rest of the pull. The things that can really
// break are runaway nesting and payload spells leaking into (or being fired by) the
// main cast, so most of this suite measures those.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8').replace(/\r\n/g, '\n');   // a Windows checkout hands us CRLF
const open = src.indexOf('<script>\n') + 9;
const js = src.slice(open, src.indexOf('</script>', open));
const upto = js.slice(0, js.indexOf('const approach = (v, t, a)'));
const shim = 'class ImageData { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w*h*4); } }\n';
const G = new Function('React', shim + upto +
  'return { MODS, ALL_IDS, SHOT_IDS, SEED_SHOTS, MOD_TIER, MOD_PRICE, FAMILY_OF, TRIG_VARIANTS, planCast, resetGun, ' +
  'castGroups, groupStats, gunRate, tracePath, modPreview, effRecharge };')({ createElement: () => {} });

let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; } else { fail++; console.log(`FAIL ${n}` + (x !== undefined ? ' -> ' + JSON.stringify(x) : '')); } };
const mk = (slots, over) => G.resetGun(Object.assign({ name: 'T', cap: slots.length,
  castDelay: 0.12, recharge: 0.4, manaMax: 9999, manaRegen: 60, spread: 0,
  multi: 1, shuffle: false, mana: 9999, speedMul: 1, slots }, over || {}));
const plan = (slots, over) => G.planCast(mk(slots, over));
const M = G.MODS;
const TRIGGERS = G.ALL_IDS.filter(id => M[id].trig);
const ADDS = G.ALL_IDS.filter(id => M[id].addTrig);

const depth = sh => (sh.payload && sh.payload.length ? 1 + Math.max(...sh.payload.map(depth)) : 0);
const size = sh => 1 + (sh.payload || []).reduce((t, q) => t + size(q), 0);
const spells = p => p.shots.reduce((t, sh) => t + size(sh), 0);
const deepest = p => p.shots.reduce((t, sh) => Math.max(t, depth(sh)), 0);

// ---- the old stand-alone carriers are gone, the variants are here ----
for (const id of ['trig', 'dtrig', 'timer']) ok(id + ' is gone', !M[id]);
ok('there are trigger variants', TRIGGERS.length === G.TRIG_VARIANTS.length && TRIGGERS.length >= 10, TRIGGERS);
ok('all three kinds exist', ['hit', 'timer', 'expire'].every(k => TRIGGERS.some(id => M[id].trig === k)));
ok('and an Add for each kind', ADDS.length === 3 && ADDS.every(id => M[id].kind === 'mod'), ADDS);
for (const id of TRIGGERS) {
  const m = M[id], b = M[m.base];
  ok(id + ' is a variant of a real spell', !!b && m.kind === b.kind, m.base);
  ok(id + ' hits like its base spell', m.dmg === b.dmg && m.speed === b.speed && m.field === b.field);
  ok(id + ' costs more than its base', m.mana > b.mana, [m.mana, b.mana]);
  ok(id + ' has a price, a tier, a family and a mark',
    !!G.MOD_PRICE[id] && !!G.MOD_TIER[id] && !!G.FAMILY_OF[id] && !!m.mark);
  ok(id + ' draws a whole number of spells', m.draw >= 1 && m.draw <= 2, m.draw);
  ok(id + ' is never a found gun\'s seed', !G.SEED_SHOTS.includes(id));
}

// ---- the payload attaches to the carrier, and is not also cast now ----
{
  const p = plan(['bolt_t', 'slug']);
  ok('a trigger fires one carrier, not two shots', p.shots.length === 1, p.shots.length);
  ok('the carrier is a real bolt', p.shots[0].dmg === M.bolt.dmg && p.shots[0].trig === 'hit');
  ok('and the next spell is riding on it', p.shots[0].payload && p.shots[0].payload.length === 1
    && p.shots[0].payload[0].dmg === M.slug.dmg, p.shots[0].payload);
  ok('both spells are paid for', p.cost === M.bolt_t.mana + M.slug.mana, p.cost);
  ok('and both cast delays are counted',
    Math.abs(p.delay - (0.12 + M.bolt_t.delay + M.slug.delay)) < 1e-9, p.delay);
  const bare = plan(['bolt_t']);
  ok('a trigger with nothing after it is just a bolt', bare.shots.length === 1 && !bare.shots[0].payload.length);
}
{
  const p = plan(['bolt_tt', 'bolt', 'slug']);
  ok('Double Trigger carries two spells', p.shots.length === 1 && p.shots[0].payload.length === 2,
    p.shots.map(s => (s.payload || []).length));
  ok('and pays for all three', p.cost === M.bolt_tt.mana + M.bolt.mana + M.slug.mana, p.cost);
}
{
  const t = plan(['bolt_ti', 'bolt']).shots[0];
  ok('a timer carrier knows its kind and its timer', t.trig === 'timer' && t.timer === M.bolt_ti.timer, [t.trig, t.timer]);
  ok('and flies its full life (it lets go mid-flight and carries on)', t.life === M.bolt.life, t.life);
  const d = plan(['void_d', 'nuke']).shots[0];
  ok('a Black Hole With Death Trigger carries its nuke', d.trig === 'expire' && d.payload[0].explode === M.nuke.explode);
}
{
  const p = plan(['crystal_t', 'boom']);
  ok('a crystal with trigger is a static field that carries', p.shots[0].still === 1
    && p.shots[0].payload.length === 1 && p.shots[0].payload[0].field === 'explode', p.shots[0]);
}

// ---- Add Trigger turns the next projectile into a carrier ----
{
  const p = plan(['addtrig', 'slug', 'bolt']);
  ok('Add Trigger + slug fires one slug', p.shots.length === 1 && p.shots[0].dmg === M.slug.dmg);
  ok('which carries the bolt', p.shots[0].trig === 'hit' && p.shots[0].payload.length === 1
    && p.shots[0].payload[0].dmg === M.bolt.dmg, p.shots[0].payload);
  const t = plan(['addtimer', 'slug', 'bolt']).shots[0];
  ok('Add Timer makes a timer carrier', t.trig === 'timer' && t.timer > 0, [t.trig, t.timer]);
  const e = plan(['adddeath', 'slug', 'bolt']).shots[0];
  ok('Add Expiration Trigger makes an expiration carrier', e.trig === 'expire');
  const f = plan(['addtrig', 'boom', 'bolt']);
  ok('Add Trigger skips static fields', !f.shots[0].trig, f.shots[0]);
}

// ---- payloads are isolated from the rest of the pull ----
{
  const q = plan(['dmg_up', 'bolt_t', 'bolt']);
  ok('a modifier before the trigger boosts the carrier', q.shots[0].dmg === 1 + 1.5, q.shots[0].dmg);
  ok('but not the payload', q.shots[0].payload[0].dmg === 1, q.shots[0].payload[0].dmg);
  const p = plan(['bolt_t', 'dmg_up', 'bolt']);
  ok('a modifier inside the payload boosts the payload', p.shots[0].payload[0].dmg === 1 + 1.5,
    p.shots[0].payload[0].dmg);
  ok('but not the carrier', p.shots[0].dmg === 1, p.shots[0].dmg);
  const h = plan(['bolt_t', 'heavy', 'bolt']);
  ok('speed modifiers inside reach it', h.shots[0].payload[0].speed === M.bolt.speed * 0.35,
    h.shots[0].payload[0].speed);
  const big = plan(['bolt_t', 'scatter', 'buck']);
  ok('and pellet counts', big.shots[0].payload[0].count === M.buck.count * 3, big.shots[0].payload[0].count);
  const d = plan(['double', 'bolt_t', 'dmg_up', 'bolt', 'slug']);
  ok('a payload modifier does not leak out to the next main shot',
    d.shots.length === 2 && d.shots[1].dmg === M.slug.dmg, d.shots.map(s => s.dmg));
}
{
  const p = plan(['bolt_t', 'double', 'bolt', 'slug']);
  ok('a multicast inside the payload widens the payload', p.shots.length === 1
    && p.shots[0].payload.length === 2, p.shots[0].payload.length);
  const f = plan(['bolt_t', 'trifur', 'bolt', 'bolt', 'bolt']);
  ok('a formation inside the payload fans it', JSON.stringify(f.shots[0].payload.map(s => s.ang)) === '[-17,0,17]',
    f.shots[0].payload.map(s => s.ang));
}

// ---- triggers nest, like in Noita, but can't run away ----
{
  const p = plan(['bolt_t', 'bolt_t', 'bolt']);
  ok('a trigger in a payload carries its own payload', depth(p.shots[0]) === 2
    && p.shots[0].payload[0].payload[0].dmg === M.bolt.dmg, depth(p.shots[0]));
}
for (let n = 1; n <= 10; n++) {
  const p = plan(new Array(n).fill('bolt_t'));
  ok(n + ' triggers in a row nest no deeper than the cap', deepest(p) <= 7, deepest(p));
  ok(n + ' triggers in a row stay bounded', spells(p) <= n * 2 + 1, spells(p));
}
{
  const nasty = [
    ['myriad', 'bolt_t', 'bolt', 'bolt_t', 'bolt'],
    ['oct', 'bolt_t', 'bolt_tt', 'bolt_ti', 'bolt'],
    ['double', 'bolt_tt', 'double', 'bolt_tt', 'bolt'],
    ['bolt_tt', 'bolt_tt', 'bolt_tt', 'bolt_tt'],
    ['addtrig', 'addtrig', 'bolt_tt', 'addtimer', 'bolt'],
    ['quad', 'bolt_tt', 'quad', 'bolt_tt', 'quad', 'bolt_tt'],
    ['omega', 'bolt_t', 'bolt'],      // the Greek letters are off, but still must not explode
  ];
  for (const slots of nasty) {
    const g = mk(slots);
    let most = 0, cost = 0;
    for (let pull = 0; pull < 6; pull++) {
      const p = G.planCast(g);
      most = Math.max(most, spells(p));
      cost = Math.max(cost, p.cost);
      if (p.wrap) g.idx = 0;
    }
    const label = slots.join('+');
    ok(label + ': the pull stays bounded by the gun', most <= slots.length * 4, most);
    ok(label + ': the mana cost stays finite', isFinite(cost) && cost < 5000, cost);
  }
}

// ---- draw order ----
{
  const p = plan(['double', 'bolt_t', 'bolt', 'slug']);
  ok('a double cast over a trigger fires the carrier and the spell after the payload',
    p.shots.length === 2 && p.shots[0].payload.length === 1 && p.shots[1].dmg === M.slug.dmg,
    p.shots.map(s => s.dmg));
}
{
  const g = mk(['bolt_t', 'bolt', 'slug']);
  G.planCast(g);
  ok('the gun moves past the slots the trigger swallowed', g.idx === 2, g.idx);
  const next = G.planCast(g);
  ok('so the next pull is the slug', next.shots.length === 1 && next.shots[0].dmg === M.slug.dmg);
}
{
  const g = mk(['slug', 'bolt_t']);
  G.planCast(g);
  const second = G.planCast(g);
  ok('a trigger at the end of the gun wraps round for its payload, as in Noita',
    second.shots[0].payload.length === 1 && second.shots[0].payload[0].dmg === M.slug.dmg, second.shots[0].payload);
  ok('and that pull starts the recharge', second.wrap === true);
}
{
  const g = mk(['bolt_t', 'bolt', 'slug']);
  const copy = Object.assign({}, g, { slots: g.slots.slice(), order: g.order.slice() });
  G.planCast(copy);
  ok('planning on a copy leaves the real gun where it was', g.idx === 0, g.idx);
}

// ---- the advisor sees both sides ----
{
  const rate = s => G.gunRate(mk(s));
  const alone = rate(['bolt_t']), loaded = rate(['bolt_t', 'bolt']), nuked = rate(['bolt_t', 'nuke']);
  ok('a loaded trigger beats an empty one', loaded.dps > alone.dps, [alone.dps, loaded.dps]);
  ok('a bigger payload is worth more', nuked.dps > loaded.dps, [loaded.dps, nuked.dps]);
  ok('the payload counts as a shot', loaded.shots === 2, loaded.shots);
  ok('nested payloads count too', rate(['bolt_t', 'bolt_t', 'bolt']).shots === 3);
}

// ---- the build screen reads sensibly ----
{
  const g = mk(['bolt_t', 'bolt']);
  const groups = G.castGroups(g);
  ok('trigger and payload are drawn as one group', groups.length === 1
    && groups[0].from === 0 && groups[0].to === 2, groups && groups.map(x => [x.from, x.to]));
  const rows = G.groupStats(g, groups[0]);
  ok('the stat line has no nonsense in it',
    rows.every(r => r.value !== undefined && !/NaN|undefined/.test(r.value + r.delta)), rows);
  for (const id of TRIGGERS.concat(ADDS)) {
    const prev = G.modPreview(id);
    ok(id + ' has a detail card', prev.rows.length > 0 && prev.rows.every(r => !/NaN|undefined/.test(r.join())));
  }
  ok('a variant\'s card says what it carries', G.modPreview('bolt_ti').rows.some(r => r[0] === 'carries'));
}

// ---- the aim line stays honest: a payload changes nothing about how the carrier flies ----
{
  const solid = (x, y) => x > 400;
  const trace = sh => { const out = []; G.tracePath(sh, 100, 100, 1, 0, solid, [], out, { x: 100, y: 100 }); return out; };
  const a = trace(plan(['bolt_t', 'bolt']).shots[0]), b = trace(plan(['bolt']).shots[0]);
  ok('the aim line for a loaded trigger matches its base spell', a.join() === b.join(), [a.length, b.length]);
}

// ---- disabled mods stay out of the game but in the table ----
for (const id of ['alpha', 'gamma', 'tau', 'omega', 'phi', 'sigma', 'mu', 'zeta']) {
  ok(id + ' is kept', !!M[id] && M[id].off === 1);
  ok(id + ' is never handed out', !G.ALL_IDS.includes(id));
}
for (const id of ['platform', 'wallup']) ok(id + ' is removed', !M[id]);

// ---- fuzz ----
{
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pool = G.ALL_IDS.slice();
  let most = 0, runs = 0, threw = null;
  for (let n = 0; n < 400; n++) {
    const cap = 2 + Math.floor(rnd() * 7);
    const slots = [];
    for (let i = 0; i < cap; i++) slots.push(rnd() < 0.35 ? TRIGGERS[Math.floor(rnd() * TRIGGERS.length)]
      : pool[Math.floor(rnd() * pool.length)]);
    const g = mk(slots, { multi: 1 + Math.floor(rnd() * 3) });
    const check = sh => {
      if (!isFinite(sh.dmg) || !isFinite(sh.speed) || !(sh.life > 0)) throw new Error('bad shot ' + slots);
      (sh.payload || []).forEach(check);
    };
    try {
      for (let pull = 0; pull < 4; pull++) {
        const p = G.planCast(g);
        runs++;
        most = Math.max(most, spells(p));
        if (!isFinite(p.cost) || !isFinite(p.delay) || p.cost < 0) throw new Error('bad plan ' + slots);
        p.shots.forEach(check);
        if (p.wrap) g.idx = 0;
      }
    } catch (e) { threw = e.message; break; }
  }
  ok('400 random trigger-heavy guns plan without throwing', !threw, threw);
  ok('and none of them runs away', most <= 96, most);
  console.log(`     fuzz: ${runs} pulls, biggest pull ${most} spells`);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
