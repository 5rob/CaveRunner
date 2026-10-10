// v95: the tier-1 spells reworked after Noita, in a sandbox. Each one is fired at the
// floor or along it and we check it leaves its own mark: a trail of glowing specks, a hole
// in the rock where it's meant to dig one, soft bounces, drill chips, Brimstone's fire.
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
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const frame = () => new Promise(requestAnimationFrame);
    const LO = window.__in.current.loadout, g = LO.guns[0];
    const one = async (id, nx, ny, frames, sb) => {
      const room = L.sandbox(sb);
      L.dparts.length = 0; L.sparks.length = 0; L.smoke.length = 0;
      LO.sel = 0; g.slots = [id]; g.cap = 1; g.shuffle = false; g.manaMax = g.mana = 9999;
      g.castDelay = 0.1; g.recharge = 9; resetGun(g);
      const solid0 = L.mat.reduce((a, v) => a + (v ? 1 : 0), 0);
      window.__in.current.right = { active: true, nx, ny, mag: 1, dy: 0, on: true };
      const o = { glow: 0, sparks: 0, smoke: 0, looks: new Set() };
      for (let i = 0; i < frames; i++) {
        await frame();
        if (i === 1) window.__in.current.right = { active: false, nx, ny, mag: 0, dy: 0, on: false };
        for (const b of L.bullets) if (b.look) o.looks.add(b.look);
        o.glow = Math.max(o.glow, L.dparts.filter(q => q.glow).length);
        o.sparks = Math.max(o.sparks, L.sparks.length);
        o.smoke = Math.max(o.smoke, L.smoke.length);
      }
      o.dug = solid0 - L.mat.reduce((a, v) => a + (v ? 1 : 0), 0);
      o.looks = [...o.looks];
      o.left = L.bullets.length;
      L.bullets.length = 0;
      return o;
    };
    const out = {};
    out.bolt = await one('bolt', 1, 0.3, 60);
    out.spark = await one('spark', 1, 0.15, 40);
    out.buck = await one('buck', 0.3, -1, 60, { roof: true, h: 40 });   // off the roof, down onto the floor
    out.spit = await one('spit', 1, 0.3, 40);
    out.bubble = await one('bubble', 1, -0.1, 40);
    out.arrow = await one('arrow', 1, 0.3, 60);
    out.digbolt = await one('digbolt', 0, 1, 40);
    out.teleshort = await one('teleshort', 1, 0, 20);
    // Brimstone at your feet: it burns — fuel set under it catches
    const room = L.sandbox();
    for (let x = Math.floor(room.x / 2) - 30; x < room.x / 2 + 30; x++) L.fire.fuel[(Math.floor(room.y / 2) - 1) * CW + x] = 1;
    L.dparts.length = 0;
    LO.sel = 0; g.slots = ['brim']; g.cap = 1; resetGun(g); g.mana = 9999;
    window.__in.current.right = { active: true, nx: 1, ny: 0.4, mag: 1, dy: 0, on: true };
    await frame(); await frame();
    window.__in.current.right = { active: false, nx: 1, ny: 0.4, mag: 0, dy: 0, on: false };
    let embers = 0;
    for (let i = 0; i < 20; i++) { await frame(); embers = Math.max(embers, L.dparts.filter(q => q.ember).length); }
    out.brim = { embers, burning: L.fire.list.length };
    return out;
  });
  for (const id of ['bolt', 'spark', 'buck', 'spit', 'bubble', 'arrow', 'teleshort'])
    check(id + ' flies with its own look and leaves a glowing trail', r[id].looks.length === 1 && r[id].glow > 0, r[id]);
  check('bolt nicks the floor where it lands', r.bolt.dug > 0, r.bolt.dug);
  check('buckshot pellets pop small holes', r.buck.dug > 0, r.buck.dug);
  check('arrow nicks the floor', r.arrow.dug > 0, r.arrow.dug);
  check('the digging bolt grinds rock into chips, in blue smoke', r.digbolt.dug > 0 && r.digbolt.sparks > 0 && r.digbolt.smoke > 0, r.digbolt);
  check('Brimstone throws burning sparks and sets the ground alight', r.brim.embers > 0 && r.brim.burning > 0, r.brim);

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
