// LIST3 #10, in a sandbox: Aim Assist. With the mod on the gun in hand the right stick is a pointer:
// pushed towards a creature it snaps on, the gun fires at it on its own and hits it; no trigger ring
// on the stick, no aim line. Pushed at empty air it doesn't fire. SHOTS=<dir> saves
// aimassist-snap.png and aimassist-free.png (phone size) for the owner; else into tests/build.
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
const OUT = process.env.SHOTS || DIR;
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
    DEV.zoom = 1;
    const e = L.enemies[0];
    window.__proto = { k: Object.assign({}, e.k, { kp: null, act: 'turret', body: 'blob', spd: 0, range: 0, glow: null }),
      r: e.r, cd: 9, touch: 9, flash: 0, phase: 0 };
    window.__wait = async (cond, ms) => { for (let t = 0; t < ms; t += 50) { if (cond()) return true; await new Promise(r => setTimeout(r, 50)); } return false; };
    // the stick push (mag) that puts the pointer on (tx, ty), from where the gun is
    window.__pushTo = (tx, ty) => {
      const gx = L.p.x + PW / 2, gy = L.p.y + PH * 0.4, dx = tx - gx, dy = ty - gy, d = Math.hypot(dx, dy);
      // the pointer's reach at a full push (assistPointer): the far view corner × aaReach
      const x0 = L.camX, y0 = L.camY, x1 = x0 + L.viewW, y1 = y0 + L.viewH;
      const far = Math.max(Math.hypot(gx - x0, gy - y0), Math.hypot(x1 - gx, gy - y0), Math.hypot(gx - x0, y1 - gy), Math.hypot(x1 - gx, y1 - gy));
      return { nx: dx / d, ny: dy / d, mag: Math.min(1, d / (far * DEV.aaReach)) };
    };
  });

  const set = await page.evaluate(async () => {
    const L = window.__lvl, room = L.sandbox({ w: 360 });
    const e = Object.assign(window.__proto, { x: room.x + 70, y: room.y - 40, ty: room.y - 40, hp: 999, hpMax: 999, aggro: false });
    L.enemies.push(e);
    window.__e = e;
    const LO = window.__in.current.loadout, g = LO.guns[0];
    LO.sel = 0; g.slots = ['aimassist', 'bolt']; g.cap = 2; g.shuffle = false; g.manaMax = g.mana = 9999;
    g.castDelay = 0.1; g.recharge = 0.1; resetGun(g);
    L.p.x = room.x - 50; L.p.vx = L.p.vy = 0; L.p.hp = 9999;
    L.pb.trajectory = 1;                               // the aim line would show, if it were drawn
    await new Promise(r => setTimeout(r, 3500));   // the floor's name fades (it covers the screenshot)
    return { room };
  });

  // ---- pushed at empty air (straight up, away from it): a free pointer, nothing fires ----
  const free = await page.evaluate(async () => {
    const L = window.__lvl, e = window.__e, P = window.__pushTo(L.p.x + PW / 2 - 40, L.p.y - 60);
    window.__in.current.right = { active: true, nx: P.nx, ny: P.ny, mag: P.mag, dy: 0, on: false };
    await new Promise(r => setTimeout(r, 400));
    const ring = document.querySelectorAll('.stick')[1].querySelector('.deadzone');
    return { assist: L.p.assist, shots: L.bullets.length, hp: e.hp, vis: L.p.aim.vis, ring: !!ring };
  });
  await page.screenshot({ path: path.join(OUT, 'aimassist-free.png') });
  check('the pointer is out and not on anything', !!free.assist && free.assist.snap === false, free.assist);
  check('nothing fires at empty air', free.shots === 0 && free.hp === 999, free);
  check('no trigger ring on the stick', free.ring === false, free);
  check('no aim line (vis 0)', free.vis === 0, free);

  // ---- pushed near the creature: snaps on, fires, hits ----
  const snap = await page.evaluate(async () => {
    const L = window.__lvl, e = window.__e, P = window.__pushTo(e.x - e.r - 4, e.ty + 3);
    window.__in.current.right = { active: true, nx: P.nx, ny: P.ny, mag: P.mag, dy: 0, on: false };
    const on = await window.__wait(() => L.p.assist && L.p.assist.snap, 1000);
    const fired = await window.__wait(() => L.bullets.length > 0, 1000);
    const hit = await window.__wait(() => e.hp < 999, 2000);
    const aim = L.p.aim, gx = L.p.x + PW / 2, gy = L.p.y + PH * 0.4, a = Math.atan2(e.ty - gy, e.x - gx);
    return { e: [e.x, e.ty, e.r], cam: [L.camX, L.camY, L.viewW, L.viewH], p: [L.p.x, L.p.y], on, fired, hit, hp: e.hp, aimErr: Math.abs(Math.atan2(aim.ny, aim.nx) - a), assist: L.p.assist };
  });
  await page.screenshot({ path: path.join(OUT, 'aimassist-snap.png') });
  check('the pointer snaps onto the creature', snap.on, snap.assist);
  check('the gun fires on its own', snap.fired, snap);
  check('and hits it', snap.hit, snap);
  check('aimed at its middle', snap.aimErr < 0.02, snap);

  // ---- let go: stops ----
  const off = await page.evaluate(async () => {
    const L = window.__lvl;
    window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
    await new Promise(r => setTimeout(r, 300));
    const n0 = L.bullets.length, hp0 = window.__e.hp;
    await new Promise(r => setTimeout(r, 500));
    return { assist: L.p.assist || null, on: L.p.aim.on, newShots: L.bullets.length > n0 && window.__e.hp < hp0 };
  });
  check('letting go: pointer gone, not firing', off.assist === null && off.on === false, off);

  check('no page errors', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fails ? fails + ' failed' : 'aimassist: all checks passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e); process.exit(1); });
