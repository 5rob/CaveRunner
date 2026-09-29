// v96: the tier 2-4 spells reworked after Noita, in a sandbox. Each shot flies with its own
// look and sheds something (sparks, smoke, flame); the bomb waits for its fuse; the rocket
// speeds up; Stillness and the thundercloud put fires out; the crystals draw without errors.
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
    const L = window.__lvl;
    const frame = () => new Promise(requestAnimationFrame);
    const LO = window.__in.current.loadout, g = LO.guns[0];
    const arm = id => { LO.sel = 0; g.slots = [id]; g.cap = 1; g.shuffle = false; g.manaMax = g.mana = 9999;
      g.castDelay = 0.1; g.recharge = 9; resetGun(g); };
    const one = async (id, nx, ny, frames, watch) => {
      L.sandbox();
      L.dparts.length = 0; L.sparks.length = 0; L.smoke.length = 0;
      arm(id);
      window.__in.current.right = { active: true, nx, ny, mag: 1, dy: 0, on: true };
      const o = { shed: 0, looks: new Set(), flashAt: -1, speeds: [] };
      const fl = L.flashes.length;
      for (let i = 0; i < frames; i++) {
        await frame();
        if (i === 1) window.__in.current.right = { active: false, nx, ny, mag: 0, dy: 0, on: false };
        for (const b of L.bullets) { if (b.look) o.looks.add(b.look); if (watch) o.speeds.push(Math.hypot(b.vx, b.vy)); }
        o.shed = Math.max(o.shed, L.dparts.filter(q => q.glow).length + L.smoke.length + L.sparks.length);
        if (o.flashAt < 0 && L.flashes.length > fl) o.flashAt = i;
      }
      o.looks = [...o.looks];
      L.bullets.length = 0; L.fields.length = 0;
      return o;
    };
    const out = {};
    for (const [id, nx, ny, n] of [['slug', 1, -0.2, 40], ['lance', 1, -0.05, 30], ['orb', 1, -0.3, 40], ['missile', 1, -0.1, 50],
      ['fball', 1, -0.2, 40], ['fbolt', 1, -0.3, 40], ['eorb', 1, -0.1, 40], ['esph', 1, -0.3, 40], ['chain', 1, -0.1, 40],
      ['glance', 1, -0.05, 30], ['cross', 1, -0.1, 30], ['disc', 1, 0.2, 50], ['nuke', 1, -0.6, 20], ['meteor', 1, -0.5, 15], ['tele', 1, -0.3, 10]])
      out[id] = await one(id, nx, ny, n, id === 'missile');
    // the bomb: thrown along the floor it bounces and rolls, and only goes off when the fuse is done (~1.8s)
    out.blast = await one('blast', 1, 0.2, 150);
    // beams: sparks off the end
    out.plasma = await one('plasma', 1, 0.3, 6);
    // fields: Stillness and the thundercloud put fire out under them; crystals, shield, vigour, glitter draw
    const room = L.sandbox();
    arm('stillc');
    window.__in.current.right = { active: true, nx: 0.3, ny: 0.2, mag: 1, dy: 0, on: true };
    await frame(); await frame();
    window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
    const f = L.fields[0];
    // a strip of grass along the floor right under it, set alight
    const row = Math.floor(room.y / 2) - 1, fx = Math.floor(f.x / 2);
    for (let x = fx - 12; x < fx + 12; x++) L.fire.fuel[row * CW + x] = 1;
    L.ignite(f.x, room.y - 1, 26, 1);
    const inR = () => L.fire.list.filter(i => L.fire.t[i] && Math.hypot((i % CW) * 2 - f.x, Math.floor(i / CW) * 2 - f.y) < f.r * 0.9).length;
    const lit0 = inR();
    for (let i = 0; i < 20; i++) await frame();
    out.still = { lit0, after: inR(), dist: Math.round(Math.hypot(f.x - room.x, f.y - room.y)) };
    for (const id of ['crystal', 'dormant', 'shieldc', 'vigour', 'storm', 'glitter']) {
      L.sandbox(); arm(id);
      window.__in.current.right = { active: true, nx: 1, ny: -0.3, mag: 1, dy: 0, on: true };
      await frame(); await frame();
      window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
      for (let i = 0; i < 20; i++) await frame();
      out[id] = L.fields.length;
      L.fields.length = 0;
    }
    return out;
  });
  for (const id of ['slug', 'lance', 'orb', 'missile', 'fball', 'fbolt', 'eorb', 'esph', 'chain', 'glance', 'cross', 'disc', 'nuke', 'meteor', 'tele'])
    check(id + ' flies with its own look and sheds something', r[id].looks.length === 1 && r[id].shed > 0, { looks: r[id].looks, shed: r[id].shed });
  const sp = r.missile.speeds;
  check('Magic Missile speeds up after leaving', sp.length > 10 && sp[sp.length - 1] > sp[0] * 2, [sp[0], sp[sp.length - 1]]);
  check('the bomb waits for its fuse before it goes off', r.blast.flashAt > 90, r.blast.flashAt);
  check('plasma beam throws sparks off its end', r.plasma.shed > 0, r.plasma.shed);
  check('Circle of Stillness puts the fire out under it', r.still.lit0 > 10 && r.still.after < r.still.lit0 * 0.3, r.still);
  for (const id of ['crystal', 'dormant', 'shieldc', 'vigour', 'storm', 'glitter']) check(id + ' sits there and draws', r[id] === 1, r[id]);

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
