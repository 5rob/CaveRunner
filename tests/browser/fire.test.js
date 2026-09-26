// v86 fire, in a sandbox: grass burns along and goes out, a Fireball lights it, creatures
// and you catch fire off it and take damage, a vine burns up, a web line burns away, a
// minecart in a fire goes up, and none of it throws a page error or a sound error.
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const b = await launch();
  const c = await b.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await c.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1200);

  // helpers inside the page: a patch of grass (fuel + art) and a count of what's left of it
  await page.evaluate(() => {
    const L = window.__lvl, { CW, CELL } = L.world;
    window.__grass = (x0, x1, y0, y1) => {          // world units; rows of grass above the floor
      const F = L.fire, dd = L.dimg.data;
      for (let y = Math.floor(y0 / CELL); y < Math.floor(y1 / CELL); y++)
        for (let x = Math.floor(x0 / CELL); x < Math.floor(x1 / CELL); x++) {
          const i = y * CW + x, k = i * 4;
          if (L.mat[i]) continue;
          F.fuel[i] = 1; dd[k] = 60; dd[k + 1] = 140; dd[k + 2] = 50; dd[k + 3] = 255;
        }
    };
    window.__left = (x0, x1, y0, y1) => {
      const F = L.fire, dd = L.dimg.data;
      let fuel = 0, art = 0;
      for (let y = Math.floor(y0 / CELL); y < Math.floor(y1 / CELL); y++)
        for (let x = Math.floor(x0 / CELL); x < Math.floor(x1 / CELL); x++) {
          const i = y * CW + x;
          if (F.fuel[i]) fuel++;
          if (dd[i * 4 + 3] && dd[i * 4 + 1] > 100) art++;      // still green
        }
      return { fuel, art };
    };
    window.__wait = async (cond, ms) => { for (let t = 0; t < ms; t += 50) { if (cond()) return true; await new Promise(r => setTimeout(r, 50)); } return false; };
  });
  // a creature to set alight later, copied off the real floor before the sandbox clears it
  await page.evaluate(() => {
    const vine = window.__lvl.props.find(q => q.k === 'climb' && q.st === 'vine');
    window.__vine = vine ? JSON.parse(JSON.stringify(vine)) : null;
    const e = window.__lvl.enemies[0];
    window.__proto = e ? { k: Object.assign({}, e.k, { kp: null, act: 'turret', body: 'blob', spd: 0, range: 0, glow: null }),
      r: e.r, cd: 9, touch: 9, flash: 0, phase: 0 } : null;
  });

  // ---- a strip of grass burns end to end, the art goes, and the fire dies out ----
  const strip = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox({ w: 360 });
    const x0 = room.l + 20, x1 = room.l + 170, y0 = room.y - 6, y1 = room.y;
    L.p.x = room.r - 40;                                    // well away from it
    window.__grass(x0, x1, y0, y1);
    const before = window.__left(x0, x1, y0, y1);
    L.ignite(x0 + 2, room.y - 3, 4, 1);
    const lit = L.fire.list.length;
    await new Promise(r => setTimeout(r, 1500));
    const mid = L.fire.list.length;
    const out = await window.__wait(() => L.fire.list.length === 0, 12000);
    return { before, lit, mid, out, after: window.__left(x0, x1, y0, y1) };
  });
  check('the grass catches', strip.lit > 5, strip);
  check('fire spreads through it', strip.mid > strip.lit, strip);
  check('it burns out on its own', strip.out, strip);
  check('almost all the grass is gone, fuel and art', strip.after.fuel < strip.before.fuel * 0.1 && strip.after.art < strip.before.art * 0.15, strip);

  // ---- a Fireball into the grass sets it alight ----
  const fb = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox({ w: 360 });
    window.__grass(room.l + 50, room.r - 10, room.y - 8, room.y);
    L.p.x = room.l + 30; L.p.vx = L.p.vy = 0;
    const LO = window.__in.current.loadout, g = LO.guns[0];
    LO.sel = 0; g.slots = ['fball']; g.cap = 1; g.shuffle = false; g.manaMax = g.mana = 9999;
    g.castDelay = 0.5; g.recharge = 0.5; resetGun(g);
    await new Promise(r => setTimeout(r, 100));
    window.__in.current.right = { active: true, nx: 0.8, ny: 0.6, mag: 1, dy: 0, on: true };
    await new Promise(r => setTimeout(r, 250));
    window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
    const lit = await window.__wait(() => L.fire.list.length > 10, 3000);
    return { lit, n: L.fire.list.length };
  });
  check('a Fireball sets the grass alight', fb.lit, fb);
  await page.evaluate(() => window.__wait(() => window.__lvl.fire.list.length === 0, 12000));

  // ---- a creature walking into fire catches, burns, takes damage; the fire on it goes out ----
  const cr = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox({ w: 360 });
    if (!window.__proto) return null;
    L.p.x = room.l + 10;
    window.__grass(room.x - 30, room.x + 30, room.y - 14, room.y);
    const e = Object.assign(window.__proto, { x: room.x, y: room.y - 10, ty: room.y - 10, hp: 999, aggro: false, burn: 0 });
    L.enemies.push(e);                                      // a turret with no range: it sits still in the fire
    L.ignite(room.x, room.y - 4, 10, 1);
    const caught = await window.__wait(() => e.burn > 0, 2000);
    await new Promise(r => setTimeout(r, 1500));
    const hurt = 999 - e.hp;
    e.x = room.r - 20;                                      // out of the fire e.y = e.ty = room.y - 40;
    const out = await window.__wait(() => !(e.burn > 0), 8000);
    return { caught, hurt, out };
  });
  check('a creature in the fire catches it', cr && cr.caught, cr);
  check('and burning hurts it', cr && cr.hurt > 1, cr);
  check('and it burns out in time', cr && cr.out, cr);

  // ---- you catch fire in it too, and it hurts ----
  const you = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox({ w: 360 });
    window.__grass(room.x - 40, room.x + 40, room.y - 10, room.y);
    L.p.x = room.x - 6; L.p.vx = L.p.vy = 0; L.p.hp = 100;
    L.ignite(room.x, room.y - 4, 12, 1);
    const caught = await window.__wait(() => L.p.burn > 0, 2000);
    await new Promise(r => setTimeout(r, 1200));
    return { caught, hurt: 100 - L.p.hp };
  });
  check('you catch fire standing in it', you.caught, you);
  check('and it hurts you', you.hurt >= 2, you);
  await page.evaluate(() => { const L = window.__lvl; L.p.burn = 0; L.p.hp = 9999; });

  // ---- a web line in the fire burns away ----
  const web = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox({ w: 360 });
    L.p.x = room.l + 10;
    L.webs.push({ ax: room.x - 60, ay: room.y - 70, bx: room.x + 60, by: room.y - 70,
      a0x: room.x - 60, a0y: room.y - 70, b0x: room.x + 60, b0y: room.y - 70, ain: null, bin: null });
    L.ignite(room.x, room.y - 70, 6, 1);
    return { left: L.webs.length };
  });
  check('a web line burns away', web.left === 0, web);

  // ---- floor 1 vines: a burning vine burns up and is gone ----
  const vine = await page.evaluate(async () => {
    const L = window.__lvl;
    const proto = window.__vine;
    if (!proto) return { none: true };
    const room = L.sandbox({ w: 360 });
    L.p.x = room.l + 10;
    // anchored to the floor cell under it so it isn't dropped, hanging in the air above
    const pr = L.placeProp(proto, room.x, room.y - 80);
    pr.anc = [Math.floor(room.x / L.world.CELL), Math.floor(room.y / L.world.CELL) + 1];
    pr.len = 40; pr.b = 40;
    await new Promise(r => setTimeout(r, 100));
    L.ignite(room.x, room.y - 42, 4, 1);
    const caught = !!pr.burn;
    const gone = await window.__wait(() => pr.gone, 6000);
    return { caught, gone, len: pr.len };
  });
  check('a vine catches', vine.caught, vine);
  check('and burns up to nothing', vine.gone, vine);

  // ---- floor 2 (coal seams): a minecart in a fire goes up ----
  await page.evaluate(() => { const L = window.__lvl, pt = L.portal; L.p.x = pt.x + pt.w / 2 - 6; L.p.y = pt.y + pt.h / 2 - 11; L.p.vx = L.p.vy = 0; L.p.hp = 9999; });
  await page.waitForTimeout(900);
  const cart = await page.evaluate(async () => {
    const L = window.__lvl, proto = L.props.find(q => q.k === 'barrel');
    const lvlFuel = L.fire.fuel.reduce((s, v) => s + (v ? 1 : 0), 0);
    if (!proto) return { none: true, floor: L.floor, lvlFuel };
    const room = L.sandbox({ w: 360 });
    L.p.x = room.l + 10; L.p.hp = 9999;
    const pr = L.placeProp(proto, room.x + 60, room.y);
    window.__grass(room.x - 20, room.x + 80, room.y - 6, room.y);
    L.ignite(room.x - 18, room.y - 3, 4, 1);
    const boom = await window.__wait(() => pr.gone, 8000);
    return { boom, floor: L.floor, lvlFuel };
  });
  check('floor 2 has timber to burn', cart.lvlFuel > 500, cart);
  check('a minecart in a fire goes up', cart.none || cart.boom, cart);

  // ---- a stretch of normal play with fire about: no errors ----
  await page.evaluate(() => { const L = window.__lvl; L.ignite(L.p.x + 40, L.p.y, 30, 1); });
  await page.waitForTimeout(1500);
  const sfxErr = await page.evaluate(() => (window.SFX && SFX.stats ? SFX.stats.errors : []).slice());
  check('no page errors', errs.length === 0, errs);
  check('no sound errors', sfxErr.length === 0, sfxErr);

  await b.close();
  console.log(fails ? `${fails} failed` : 'fire: all passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
