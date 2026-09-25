// Pollen (v74) in a sandbox: it pops a small crater when it lands on rock (no tunnelling),
// ignores a creature outside its lock radius, and homes onto one inside it.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(800);

  const r = await page.evaluate(async () => {
    const L = window.__lvl, W = L.world;
    const proto = L.enemies[0];
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const room = L.sandbox();
    const LO = window.__in.current.loadout, g = LO.guns[0];
    LO.sel = 0; g.slots = ['pollen']; g.cap = 1; g.shuffle = false; g.manaMax = g.mana = 9999;
    g.castDelay = 0.1; g.recharge = 5; resetGun(g);
    const fire = async (nx, ny) => {
      window.__in.current.right = { active: true, nx, ny, mag: 1, dy: 0, on: true };
      await wait(80);
      window.__in.current.right = { active: false, nx, ny, mag: 0, dy: 0, on: false };
    };
    const out = {};
    // 1: straight down at the floor -> pops, digs a little, no tunnel
    const fl = L.flashes.length;
    await fire(0.3, 1);
    for (let i = 0; i < 120 && (L.bullets.length || L.flashes.length === fl); i++) await new Promise(requestAnimationFrame);
    out.popped = L.flashes.length > fl;
    out.gone = L.bullets.length === 0;
    out.depth = out.popped ? Math.round(L.flashes[L.flashes.length - 1].y - room.y) : null;
    // 2: a creature far off (200 away) is ignored; one close (60 away) is homed on
    const put = (x, y) => { const e = Object.assign({}, proto, { x, y, ty: y, hp: 999, max: 999, tgt: null, aggro: false });
      e.k = Object.assign({}, proto.k, { act: 'turret', range: 0 }); L.enemies.push(e); return e; };
    await wait(5200); resetGun(g);
    const far = put(room.x + 210, room.y - 60);
    await fire(-1, -0.2);                           // away from it
    await wait(1500);
    out.farHp = far.hp;
    out.farLive = L.bullets.length;
    L.enemies.length = 0; L.bullets.length = 0;
    await wait(3700); resetGun(g);
    const near = put(room.x - 75, room.y - 120);   // off the flight line, above where it settles
    await fire(-1, -0.2);                           // floats up into range of it
    for (let i = 0; i < 360 && near.hp === 999 && L.enemies.includes(near); i++) await new Promise(requestAnimationFrame);
    out.nearHp = near.hp; out.nearGone = !L.enemies.includes(near);
    return out;
  });
  check('Pollen pops on rock', r.popped && r.gone, r);
  check('it does not bore down through the floor', r.depth != null && r.depth < 12, r.depth);
  check('a creature outside the lock radius is left alone', r.farHp === 999, r);
  check('a creature inside the lock radius gets homed on and hit', r.nearHp < 999 || r.nearGone, r);

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
