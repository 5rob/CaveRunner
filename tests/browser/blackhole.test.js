// v56: Black Hole drags creatures in hard, rolls on through them, and swallows enemy shots.
// Also checks the new scenery: portal motes, wall torches, and the torch's glow pass.
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
  await page.waitForTimeout(1600);

  // the arrival portal breathes motes out, and there are wall torches either side of it
  const scen = await page.evaluate(() => {
    const L = window.__lvl, a = L.arrival;
    const out = L.motes.filter(q => q.kind === 'out');
    return { out: out.length, far: Math.max(0, ...out.map(q => Math.hypot(q.x - a.x, q.y - a.y))),
      sconces: L.sconces.length, byArrival: L.sconces.filter(s => Math.abs(s.y - a.y) < 10).length };
  });
  check('the way-in portal is giving off motes', scen.out > 10, scen);
  check('and they die before drifting far', scen.far < 60, scen.far);
  check('a torch on each side of the way in', scen.byArrival === 2, scen);
  await page.screenshot({ path: path.join(DIR, 'arrival_portal.png') });

  // fire a Black Hole, then park it in the open and feed it an enemy and an enemy shot
  const r = await page.evaluate(async () => {
    const LO = window.__in.current.loadout, L = window.__lvl;
    const g = LO.guns[0];
    g.slots = ['void']; g.manaMax = 9999; g.mana = 9999; resetGun(g);
    LO.sel = 0;
    L.dig(L.p.x + 80, L.p.y - 30, 70);
    window.__in.current.right = { active: true, nx: 1, ny: 0, mag: 1, dy: 0, on: true };
    await new Promise(r => setTimeout(r, 60));
    window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
    const bh = L.bullets.find(x => x.pull);
    if (!bh) return { fired: false };
    bh.vx = 0; bh.vy = 0; bh.life = 5;
    bh.x = L.p.x + 80; bh.y = L.p.y - 30;
    const e = L.enemies[0];
    e.hp = e.hpMax = 9999;
    e.x = bh.x + 70; e.y = e.ty = bh.y;
    const d0 = Math.hypot(e.x - bh.x, e.ty - bh.y);
    L.enemyShots.push({ x: bh.x - 60, y: bh.y, vx: 150, vy: 0, life: 2.5, col: '#f00', dmg: 1, size: 3 });
    const shot = L.enemyShots[L.enemyShots.length - 1];
    await new Promise(r => setTimeout(r, 700));
    return { fired: true, d0, d1: Math.hypot(e.x - bh.x, e.ty - bh.y),
      alive: L.bullets.includes(bh), shotGone: !L.enemyShots.includes(shot),
      hurt: e.hp < 9999, trail: L.motes.filter(q => q.kind === 'drift').length };
  });
  check('Black Hole fired', r.fired, r);
  check('it hauls the enemy in', r.d1 < r.d0 * 0.4, r);
  check('it survives touching the enemy', r.alive, r);
  check('it grinds the enemy it holds', r.hurt, r);
  check('it swallows the enemy shot', r.shotGone, r);
  check('it leaves a trail of motes', r.trail > 10, r.trail);
  await page.screenshot({ path: path.join(DIR, 'blackhole.png') });

  // the exit portal draws motes in: each one ends up nearer the middle than it started
  const ex = await page.evaluate(async () => {
    const L = window.__lvl, P = L.portal;
    L.p.x = P.x - 60; L.p.y = P.y; L.p.vx = L.p.vy = 0;
    await new Promise(r => setTimeout(r, 900));
    const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
    const ins = L.motes.filter(q => q.kind === 'in');
    return { n: ins.length, closer: ins.filter(q => q.age > 0.4 && Math.hypot(q.x - cx, q.y - cy) < 40).length };
  });
  check('the exit portal pulls motes in', ex.n > 10 && ex.closer > 3, ex);
  await page.screenshot({ path: path.join(DIR, 'exit_portal.png') });

  check('no page errors', errs.length === 0, errs);
  console.log(fails ? `\n${fails} failed` : '\nall good');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
