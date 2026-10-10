// The flight-path mods in the live game (v0.0.137), in a sandbox: a boomerang flies out and comes
// back to your hand, an orbit circles your gun as you stand, ping-pong snaps back and on; and the
// Gravity Gun (a starting gun: Follow Me + White Hole) puts a small white hole just ahead of your
// gun that follows your aim and hauls a creature along with it. Screenshots: paths_gravity.png.
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1500);

  // fire one cast of `slots` from gun 0, aimed (nx, ny), in a fresh wide sandbox; follow the shot
  const fly = (slots, nx, ny, frames) => page.evaluate(async ({ slots, nx, ny, frames }) => {
    const L = window.__lvl, I = window.__in.current, g = I.loadout.guns[0];
    const room = L.sandbox({ w: 900, h: 400 });
    I.loadout.sel = 0; g.slots = slots.slice(); g.cap = slots.length; g.shuffle = false;
    g.manaMax = g.mana = 9999; g.castDelay = 5; g.recharge = 5; resetGun(g);
    // hang in mid-air (an orbit round a gun on the floor would clip the floor)
    const stay = () => { L.p.x = room.x - PW / 2; L.p.y = room.y - 150; L.p.vx = L.p.vy = 0; };
    stay();
    I.right = { active: true, nx, ny, mag: 1, dy: 0, on: true };
    for (let i = 0; i < 20 && !L.bullets.length; i++) await new Promise(requestAnimationFrame);
    I.right = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };
    const b = L.bullets[0];
    if (!b) return { track: [{ dx: NaN, dy: NaN }], alive: true, none: true };
    b.grav = 0; b.drag = 0; b.vx *= 0.5; b.vy *= 0.5;   // the path alone, kept inside the room
    const gun = () => ({ x: L.p.x + PW / 2, y: L.p.y + PH * 0.4 });
    const track = [];
    for (let i = 0; i < frames && L.bullets.includes(b); i++) {
      stay();
      track.push({ dx: b.x - gun().x, dy: b.y - gun().y });
      await new Promise(requestAnimationFrame);
    }
    return { track, alive: L.bullets.includes(b) };
  }, { slots, nx, ny, frames });

  // ---- Boomerang ----
  let r = await fly(['boomer', 'arrow'], 1, 0, 300);
  const far = Math.max(...r.track.map(q => q.dx)), last = r.track[r.track.length - 1];
  check('a boomerang flies well out', far > 150, Math.round(far));
  check('and comes back into your hand (gone, close to you)', !r.alive && Math.hypot(last.dx, last.dy) < 40, { last, alive: r.alive });

  // ---- Orbit ----
  r = await fly(['orbit', 'arrow'], 1, 0, 50);
  const tail = r.track.slice(25);
  const rad = tail.map(q => Math.hypot(q.dx, q.dy));
  check('an orbit circles your gun', tail.length > 10 && rad.every(d => Math.abs(d - 26) < 6), rad.slice(0, 4).map(d => d.toFixed(1)));

  // ---- Ping-Pong ----
  r = await fly(['pong', 'arrow'], 1, 0, 60);
  let backs = 0;
  for (let i = 1; i < r.track.length; i++) if (r.track[i].dx < r.track[i - 1].dx - 1) backs++;
  check('ping-pong snaps back as it goes', backs > 3 && r.track[r.track.length - 1].dx > 80, { backs, end: Math.round(r.track[r.track.length - 1].dx) });

  // ---- Spiral ----
  r = await fly(['spiral', 'arrow'], 1, 0, 60);
  let cross = 0;
  for (let i = 1; i < r.track.length; i++) if (Math.sign(r.track[i].dy) !== Math.sign(r.track[i - 1].dy)) cross++;
  check('a spiral swings across its line', cross >= 3, cross);

  // ---- the Gravity Gun ----
  const st = await page.evaluate(async () => {
    const L = window.__lvl, I = window.__in.current;
    const room = L.sandbox({ w: 600, h: 300 });
    DEV.zoom = 1;
    const fresh = startingGuns();
    I.loadout.guns[2] = fresh[2]; I.loadout.sel = 2; I.notify();
    const proto = makeLevel(5, 1).enemies[0];
    const e = Object.assign({}, proto, { x: room.x + 70, y: room.y - 60, ty: room.y - 60, hp: 999, max: 999, tgt: null, aggro: false });
    e.k = Object.assign({}, proto.k, { act: 'turret', range: 0, dmg: 0 });
    L.enemies.push(e);
    const out = { name: I.loadout.guns[2].name };
    const hold = (nx, ny) => { I.right = { active: true, nx, ny, mag: 1, dy: ny, on: true }; };
    const frames = async n => { for (let i = 0; i < n; i++) await new Promise(requestAnimationFrame); };
    hold(1, 0);
    await frames(40);
    const f = L.fields.find(q => q.field === 'vacuum');
    const gun = () => ({ x: L.p.x + PW / 2, y: L.p.y + PH * 0.4 });
    out.field = !!f;
    out.ahead = f ? Math.round(Math.hypot(f.x - (gun().x + FOLLOW_AHEAD), f.y - gun().y)) : -1;
    out.pulled = Math.round(e.x - (room.x + 70));
    // aim up: the white hole goes where you aim, and the creature comes along
    hold(0, -1);
    await frames(50);
    const f2 = L.fields.filter(q => q.field === 'vacuum').pop();
    out.up = f2 ? Math.round(f2.y - gun().y) : 0;
    out.eUp = Math.round(gun().y - e.ty);
    out.hp = e.hp;
    I.right = { active: false, nx: 0, ny: 0, mag: 0, dy: 0, on: false };
    return out;
  });
  check('you start with the Gravity Gun', st.name === 'Gravity Gun', st.name);
  check('it puts a White Hole just ahead of your gun', st.field && st.ahead < 10, st);
  check('which drags a creature in towards you', st.pulled < -15, st);
  check('aim up: the hole follows your aim, and carries the creature up', st.up < -20 && st.eUp > 10, st);
  check('harming nothing', st.hp === 999, st.hp);
  await page.screenshot({ path: path.join(DIR, 'paths_gravity.png') });

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
