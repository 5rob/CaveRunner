// v0.0.148, in a sandbox: the Flamethrower mod sprays fire the way you aim, setting grass and a creature alight
// and hurting it; and the Fire Immunity perk: standing in fire, you never catch. Screenshot: tests/build/flamer.png
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const b = await launch();
  const c = await b.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
  const page = await c.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(DIR, 'test.html'));
  for (let i = 0; i < 100 && !(await page.evaluate(() => window.__lvl && window.__lvl.p)); i++) await page.waitForTimeout(50);
  await page.evaluate(() => {
    const L = window.__lvl;
    L.guide = null;
    const e = L.enemies[0];
    window.__proto = e ? { k: Object.assign({}, e.k, { kp: null, act: 'turret', body: 'blob', spd: 0, range: 0, glow: null }),
      r: e.r, cd: 9, touch: 9, flash: 0, phase: 0 } : null;
    window.__wait = async (cond, ms) => { for (let t = 0; t < ms; t += 50) { if (cond()) return true; await new Promise(r => setTimeout(r, 50)); } return false; };
  });

  // ---- the spray: grass ahead and a creature in it, fired at for a second ----
  const spray = await page.evaluate(async () => {
    const L = window.__lvl, { CW, CELL } = L.world, room = L.sandbox({ w: 360 });
    let grass = 0;
    for (let y = Math.floor((room.y - 6) / CELL); y < Math.floor(room.y / CELL); y++)
      for (let x = Math.floor((room.x + 10) / CELL); x < Math.floor((room.x + 90) / CELL); x++) {
        const i = y * CW + x, k = i * 4;
        if (L.mat[i]) continue;
        L.fire.fuel[i] = 1; L.dimg.data[k] = 60; L.dimg.data[k + 1] = 140; L.dimg.data[k + 2] = 50; L.dimg.data[k + 3] = 255; grass++;
      }
    const e = window.__proto && Object.assign(window.__proto, { x: room.x + 50, y: room.y - 10, ty: room.y - 10, hp: 999, hpMax: 999, aggro: false, burn: 0 });
    if (e) L.enemies.push(e);
    const LO = window.__in.current.loadout, g = LO.guns[0];
    LO.sel = 0; g.slots = ['flamer']; g.cap = 1; g.shuffle = false; g.manaMax = g.mana = 9999;
    g.castDelay = 0.05; g.recharge = 0.05; resetGun(g);
    L.p.x = room.x - 20; L.p.vx = L.p.vy = 0; L.p.hp = 9999;
    await new Promise(r => setTimeout(r, 200));
    window.__in.current.right = { active: true, nx: 1, ny: 0.15, mag: 1, dy: 0, on: true };
    let shots = 0, maxX = 0;
    for (let t = 0; t < 900; t += 50) {
      await new Promise(r => setTimeout(r, 50));
      shots = Math.max(shots, L.bullets.filter(q => q.look === 'flame').length);
      for (const q of L.bullets) if (q.look === 'flame') maxX = Math.max(maxX, q.x - L.p.x);
    }
    return { shots, maxX: Math.round(maxX), burning: L.fire.list.length, grass, creatureBurn: e ? e.burn > 0 : null, hurt: e ? 999 - e.hp : null };
  });
  await page.screenshot({ path: path.join(DIR, 'flamer.png') });
  await page.evaluate(() => { window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false }; });
  check('a stream of flames in the air at once', spray.shots >= 5, spray);
  check('they go a short way the way you aim, not far', spray.maxX > 30 && spray.maxX < 200, spray);
  check('the grass ahead is set alight', spray.burning > 0, spray);
  check('the creature catches and is hurt', spray.creatureBurn !== false && (spray.hurt === null || spray.hurt > 0), spray);

  // ---- Fire Immunity: standing in fire, you never catch ----
  const imm = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox({ w: 360 });
    L.p.x = room.x - 6; L.p.vx = L.p.vy = 0; L.p.hp = 100; L.p.burn = 0;
    L.pb.fireImm = 1;
    for (let k = 0; k < 20; k++) L.ignite(room.x, room.y - 4, 14, 1);
    const caught = await window.__wait(() => L.p.burn > 0, 1500);
    return { caught, hp: L.p.hp };
  });
  check('with Fire Immunity you never catch fire', !imm.caught && imm.hp === 100, imm);

  check('no page errors', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fails ? fails + ' failed' : 'flamer: all checks passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
