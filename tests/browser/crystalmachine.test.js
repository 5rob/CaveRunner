// Crystals as rocks, and the crystal machines (v0.0.138, src/game/systems/shops.js stepCrystals):
// you can't pick a crystal up; walking into one shoves it along; a White Hole (the Gravity Gun)
// holds it up and drags it; the mod machine sucks in a red one that comes near (not a green one),
// shakes for CYCLE seconds and pops out a new mod (added to the collection); the perk machine does
// the same with a green one and a perk. Neither machine has a menu any more (archived).
// Screenshots: crystalmachine_in.png (one rolling in), _shake1/_shake2.png (early and late in the shake),
// _pop.png (after the pop), _held.png (held up by a White Hole).
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
const DIR = path.join(__dirname, '..', 'build');
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1300);
  const frames = n => page.evaluate(async n => { for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(r)); }, n);

  // ---- 1. in a sandbox: it settles on the floor, you can't take it, you shove it ----
  let st = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox({ w: 400 });
    const LO = window.__in.current.loadout; LO.crystals = []; LO.greens = [];
    const q = { kind: 'crystal', x: room.x + 60, y: room.y - 30, floor: 1, t: 0 };
    L.pickups.push(q);
    for (let i = 0; i < 60; i++) await new Promise(r => requestAnimationFrame(r));
    const rest = { y: q.y, floorY: room.y };
    // stand right on top of it for a while
    for (let i = 0; i < 20; i++) { L.p.x = q.x - 6; L.p.y = q.y - 22; L.p.vx = L.p.vy = 0; await new Promise(r => requestAnimationFrame(r)); }
    const kept = L.pickups.includes(q) && !q.taken && LO.crystals.length === 0;
    // walk into it from the left
    L.p.x = q.x - 40; L.p.y = room.y - 22.5; L.p.vx = L.p.vy = 0;
    const x0 = q.x;
    for (let i = 0; i < 70; i++) { window.__in.current.left = { active: true, nx: 1, ny: 0, mag: 1, dy: 0 }; await new Promise(r => requestAnimationFrame(r)); }
    window.__in.current.left = { active: false, nx: 0, ny: 0, mag: 0, dy: 0 };
    return { rest, kept, moved: q.x - x0, room };
  });
  check('a dropped crystal comes to rest on the floor', Math.abs(st.rest.y + 8 - st.rest.floorY) < 4, st.rest);
  check('standing on a crystal does not pick it up', st.kept, st);
  check('walking into a crystal shoves it along', st.moved > 15, st.moved);

  // ---- 2. a White Hole holds a crystal up and drags it ----
  st = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox({ w: 400 });
    const q = { kind: 'crystal', x: room.x + 80, y: room.y - 8, floor: 1, t: 0 };
    L.pickups.push(q);
    L.p.x = room.l + 10;
    const f = { field: 'vacuum', x: room.x + 40, y: room.y - 60, r: 70, life: 4, max: 4, t: 0, col: '#fff', tick: 0 };
    L.fields.push(f);
    for (let i = 0; i < 70; i++) await new Promise(r => requestAnimationFrame(r));
    const held = Math.hypot(q.x - f.x, q.y - f.y);
    f.x -= 50;                                  // the gun swings: the hole moves and the crystal follows
    for (let i = 0; i < 60; i++) await new Promise(r => requestAnimationFrame(r));
    return { held, follow: Math.hypot(q.x - f.x, q.y - f.y), up: room.y - q.y };
  });
  check('a White Hole holds a crystal up at its middle', st.held < 12, st);
  check('and drags it where the hole goes', st.follow < 12 && st.up > 30, st);

  // ---- 3. the shop: no menu, a red crystal near the mod machine is sucked in, a shake, a mod ----
  const put = (kind, green, dx) => page.evaluate(({ kind, green, dx }) => {
    const L = window.__lvl, m = SHOPS[kind], fy = L.world.SHOP_FLOOR * L.world.CELL;
    L.fields.length = 0;
    L.p.x = m.x + 46; L.p.y = fy - 22.5; L.p.vx = L.p.vy = 0;
    const q = { kind: 'crystal', green: green || undefined, x: m.x + dx, y: fy - 8, floor: 1, t: 0 };
    L.pickups.push(q);
    return L.pickups.length - 1;
  }, { kind, green, dx });
  st = await page.evaluate(async () => {
    const L = window.__lvl, m = SHOPS.mods, fy = L.world.SHOP_FLOOR * L.world.CELL;
    L.pickups.length = 0; L.p.x = m.x - 6; L.p.y = fy - 22.5; L.p.vx = L.p.vy = 0; window.__in.current.sig = '';
    for (let i = 0; i < 15; i++) await new Promise(r => requestAnimationFrame(r));
    const card = !!document.querySelector('.buypanel');
    window.__in.current.interact = true;
    for (let i = 0; i < 10; i++) await new Promise(r => requestAnimationFrame(r));
    return { card, open: !!window.__in.current.shopOpen };
  });
  check('standing at the mod machine: no prompt, a tap opens nothing', !st.card && !st.open, st);

  // a green crystal by the mod machine: left alone
  await put('mods', true, 40);
  await frames(40);
  st = await page.evaluate(() => { const q = window.__lvl.pickups.find(q => q.kind === 'crystal'); return { found: !!q, into: q && q.into, taken: q && q.taken }; });
  check('a green crystal by the mod machine is left alone', st.found && !st.into && !st.taken, st);

  const before = await page.evaluate(() => { window.__lvl.pickups.length = 0; window.__in.current.collection.length = 0; return 0; });
  await put('mods', false, 40);
  await page.evaluate(() => { const q = window.__lvl.pickups.find(q => q.kind === 'crystal'); q.x -= 40; q.vx = 60; window.__q = q; });   // rolled in from the left
  await frames(8);
  await page.screenshot({ path: path.join(DIR, 'crystalmachine_in.png') });
  st = await page.evaluate(async () => {
    const L = window.__lvl, q = window.__q;
    for (let i = 0; i < 120 && !q.taken; i++) await new Promise(r => requestAnimationFrame(r));
    const M = L.machines.mods;
    return { taken: q.taken, shaking: !!M && M.t >= 0 };
  });
  check('a red crystal near the mod machine is sucked in, and it starts shaking', st.taken && st.shaking, st);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(DIR, 'crystalmachine_shake1.png') });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: path.join(DIR, 'crystalmachine_shake2.png') });
  st = await page.evaluate(async () => {
    const L = window.__lvl;
    for (let i = 0; i < 400 && L.machines.mods.t >= 0; i++) await new Promise(r => requestAnimationFrame(r));
    const mod = L.pickups.find(q => q.kind === 'mod');
    return { done: L.machines.mods.t < 0, mod: mod && mod.id, coll: window.__in.current.collection.slice() };
  });
  check('after the shake it pops out a mod, now unlocked', st.done && st.mod && st.coll.length === before + 1 && st.coll[0] === st.mod, st);
  await frames(20);
  await page.screenshot({ path: path.join(DIR, 'crystalmachine_pop.png') });

  // ---- 4. the perk machine and a green crystal ----
  await page.evaluate(() => { window.__lvl.pickups.length = 0; window.__in.current.perkCollection.length = 0; });
  await put('perks', true, -40);
  st = await page.evaluate(async () => {
    const L = window.__lvl;
    for (let i = 0; i < 600 && !L.pickups.some(q => q.kind === 'perk'); i++) await new Promise(r => requestAnimationFrame(r));
    const pk = L.pickups.find(q => q.kind === 'perk');
    return { perk: pk && pk.id, coll: window.__in.current.perkCollection.slice() };
  });
  check('a green crystal into the perk machine pops out a new perk', st.perk && st.coll.length === 1 && st.coll[0] === st.perk, st);

  // v0.0.139: a mod may repeat (every mod unlocked: it still pops one), a perk never does
  await page.evaluate(() => { window.__lvl.pickups.length = 0; const c = window.__in.current.collection; c.length = 0; c.push(...ALL_IDS); });
  await put('mods', false, 40);
  st = await page.evaluate(async () => {
    const L = window.__lvl;
    for (let i = 0; i < 600 && !L.pickups.some(q => q.kind === 'mod'); i++) await new Promise(r => requestAnimationFrame(r));
    const q = L.pickups.find(q => q.kind === 'mod');
    return { mod: q && q.id, n: window.__in.current.collection.length, all: ALL_IDS.length };
  });
  check('with every mod unlocked, a red crystal still pops one out (a repeat)', !!st.mod && st.n === st.all, st);
  await page.evaluate(() => { window.__lvl.pickups.length = 0; const c = window.__in.current.perkCollection; c.length = 0; c.push(...PERK_IDS); });
  await put('perks', true, -40);
  st = await page.evaluate(async () => {
    const L = window.__lvl;
    for (let i = 0; i < 300 && (L.pickups.some(q => q.kind === 'crystal') || L.machines.perks.t >= 0); i++) await new Promise(r => requestAnimationFrame(r));
    return { perk: L.pickups.some(q => q.kind === 'perk'), idle: L.machines.perks.t < 0 };
  });
  check('with every perk had, a green crystal pops no perk (one of a kind)', st.idle && !st.perk, st);

  // a crystal held up by a White Hole in the shop (by the gun machine, which takes none)
  await page.evaluate(() => {
    const L = window.__lvl, m = SHOPS.guns, fy = L.world.SHOP_FLOOR * L.world.CELL;
    L.pickups.length = 0; L.p.x = m.x - 40; L.p.y = fy - 22.5; L.p.vx = L.p.vy = 0;
    L.pickups.push({ kind: 'crystal', x: m.x + 10, y: fy - 8, floor: 1, t: 0 });
    L.fields.push({ field: 'vacuum', x: m.x, y: fy - 40, r: 60, life: 3, max: 3, t: 0, col: '#fff', tick: 0 });
  });
  await frames(50);
  await page.screenshot({ path: path.join(DIR, 'crystalmachine_held.png') });

  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
