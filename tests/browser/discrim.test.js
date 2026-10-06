// LIST3 #11, in a sandbox: Discriminate. An unset copy in the Bag → its card's "Set target" → the Bag
// closes and the right stick is the world pointer; let go on a creature and that copy is set on its kind
// (its tile then shows the target's icon). A shot carrying it passes the creature in front unharmed and
// hits the one it's set on. SHOTS=<dir> saves discrim-pick.png and discrim-bag.png (phone size); else
// into tests/build.
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
  await page.evaluate(async () => {
    const L = window.__lvl;
    L.guide = null;
    DEV.zoom = 1;
    window.__wait = async (cond, ms) => { for (let t = 0; t < ms; t += 50) { if (cond()) return true; await new Promise(r => setTimeout(r, 50)); } return false; };
    window.__pushTo = (tx, ty) => {
      const gx = L.p.x + PW / 2, gy = L.p.y + PH * 0.4, dx = tx - gx, dy = ty - gy, d = Math.hypot(dx, dy);
      const x0 = L.camX, y0 = L.camY, x1 = x0 + L.viewW, y1 = y0 + L.viewH;
      const far = Math.max(Math.hypot(gx - x0, gy - y0), Math.hypot(x1 - gx, gy - y0), Math.hypot(gx - x0, y1 - gy), Math.hypot(x1 - gx, y1 - gy));
      return { nx: dx / d, ny: dy / d, mag: Math.min(1, d / (far * DEV.aaReach)) };
    };
    const room = L.sandbox({ w: 360 });
    // two still creatures of different kinds in a line at the gun's height: Hiisi near, Konna far
    const mkE = (id, x) => {
      const k = Object.assign({}, enemyFor(id, 1), { kp: null, act: 'turret', spd: 0, range: 0, glow: null });
      const y = L.p.y + PH * 0.4;
      return { k, r: 8, cd: 9, touch: 9, flash: 0, phase: 0, x, y, ty: y, hp: 999, hpMax: 999, aggro: false,
        lx: x, ly: y, hx: x, hy: y, tgt: null, rest: 0, charge: 0 };
    };
    L.p.x = room.x - 120; L.p.vx = L.p.vy = 0; L.p.hp = 9999;
    window.__near = mkE('hiisi', room.x - 40); window.__far = mkE('konna', room.x + 60);
    L.enemies.push(window.__near, window.__far);
    const LO = window.__in.current.loadout, g = LO.guns[0];
    LO.sel = 0; g.slots = ['bolt']; g.cap = 2; g.shuffle = false; g.manaMax = g.mana = 9999;
    g.castDelay = 0.1; g.recharge = 0.1; resetGun(g);
    LO.bag.length = 0; LO.bag.push('discrim', 'bolt');
    window.__in.current.inShop = true;               // the Bag is editable
    await new Promise(r => setTimeout(r, 3000));      // the floor's name fades
  });

  // ---- the Bag: tap the unset copy, "Set target" ----
  await page.tap('button[aria-label="Bag"]');
  await page.waitForSelector('[data-mod="discrim"]', { timeout: 3000 });
  await page.tap('.bag [data-mod="discrim"]');
  const btn = await page.waitForSelector('.pact', { timeout: 3000 }).catch(() => null);
  check('an unset copy\'s card offers "Set target"', !!btn);
  if (btn) await btn.tap();
  const picking = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 300));
    return { pick: window.__in.current.pickTarget, sheet: !!document.querySelector('.sheet') };
  });
  check('the Bag closes and the pick starts', picking.pick === 0 && !picking.sheet, picking);

  // ---- the pointer on the far creature, then let go ----
  const on = await page.evaluate(async () => {
    const L = window.__lvl, e = window.__far, P = window.__pushTo(e.x, e.ty - 2);
    window.__in.current.right = { active: true, nx: P.nx, ny: P.ny, mag: P.mag, dy: 0, on: true };
    const snap = await window.__wait(() => L.p.assist && L.p.assist.snap && Math.abs(L.p.assist.ex - e.x) < 1, 1500);
    await new Promise(r => setTimeout(r, 300));
    return { snap, shots: L.bullets.length, a: L.p.assist };
  });
  await page.screenshot({ path: path.join(OUT, 'discrim-pick.png') });
  check('the pointer snaps onto the far creature', on.snap, on.a);
  check('nothing fires while picking', on.shots === 0, on);
  const set = await page.evaluate(async () => {
    window.__in.current.right = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };
    await new Promise(r => setTimeout(r, 300));
    return { bag: window.__in.current.loadout.bag.slice(), pick: window.__in.current.pickTarget, toast: window.__lvl.toasts.map(t => t.text) };
  });
  check('letting go sets that copy on Konna', set.bag[0] === 'discrim:creature:konna' && set.pick == null, set);
  check('a toast says so', set.toast.some(t => /Discriminate → Konna/.test(t)), set.toast);

  // ---- the Bag shows the target in its tile ----
  await page.tap('button[aria-label="Bag"]');
  await page.waitForSelector('.bag [data-mod="discrim:creature:konna"] .ttgt', { timeout: 3000 }).catch(() => null);
  const badge = await page.evaluate(() => {
    const el = document.querySelector('.bag [data-mod="discrim:creature:konna"] .ttgt');
    return el ? el.textContent : null;
  });
  await page.screenshot({ path: path.join(OUT, 'discrim-bag.png') });
  check('its tile carries the target icon', !!badge, badge);
  await page.tap('.done');

  // ---- the shot: passes Hiisi, hits Konna ----
  const shot = await page.evaluate(async () => {
    const L = window.__lvl, n = window.__near, f = window.__far, g = window.__in.current.loadout.guns[0];
    await new Promise(r => setTimeout(r, 200));
    g.slots = ['discrim:creature:konna', 'bolt']; g.cap = 2; resetGun(g);
    n.hp = f.hp = 999;
    window.__in.current.right = { active: true, nx: 1, ny: 0, mag: 1, dy: 0, on: true };
    const hit = await window.__wait(() => f.hp < 999, 2500);
    window.__in.current.right = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };
    const out = { hit, near: n.hp, far: f.hp };
    // control: a plain bolt stops on the near one
    await new Promise(r => setTimeout(r, 300));
    L.bullets.length = 0; g.slots = ['bolt']; g.cap = 1; resetGun(g); n.hp = f.hp = 999;
    window.__in.current.right = { active: true, nx: 1, ny: 0, mag: 1, dy: 0, on: true };
    out.ctl = await window.__wait(() => n.hp < 999, 2500);
    window.__in.current.right = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };
    await new Promise(r => setTimeout(r, 300));
    out.ctlFar = f.hp;
    return out;
  });
  check('the targeted shot hits Konna', shot.hit, shot);
  check('and passes Hiisi unharmed', shot.near === 999, shot);
  check('control: a plain bolt hits Hiisi', shot.ctl, shot);
  check('control: and Konna, behind it, is untouched', shot.ctlFar === 999, shot);
  check('no page errors', errs.length === 0, errs);
  await b.close();
  console.log(fails ? `discrim: ${fails} failed` : 'discrim: all passed');
  process.exit(fails ? 1 : 0);
})();
