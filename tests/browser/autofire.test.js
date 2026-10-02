// Questions Later (the `auto` passive, src/spells/mods.js; aimAndCast in game/systems/gun.js): with
// it anywhere on the held gun, the gun fires as if the trigger were held — hands off the sticks,
// shots keep coming the way you face, or the way the stick aims. Off a gun, nothing fires.
// In a sandbox room.
const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1200);

  const run = (slots, aim) => page.evaluate(async ({ slots, aim }) => {
    const L = window.__lvl, I = window.__in.current, room = L.sandbox();
    L.enemies.length = 0; L.bullets.length = 0;
    L.p.x = room.x - 6; L.p.face = 1; L.p.hp = 9999;
    const g = Object.assign({}, I.loadout.guns[0], { slots, cap: slots.length, manaMax: 9999, mana: 9999, castDelay: 0.05, recharge: 0.1 });
    I.loadout.guns[0] = resetGun(g); I.loadout.sel = 0;
    Object.assign(I.right, aim ? { active: true, on: false, nx: aim[0], ny: aim[1], mag: 0.1 } : { active: false, on: false, mag: 0 });
    let shots = 0, left = 0, right = 0;
    const seen = new Set();
    for (let f = 0; f < 60; f++) {
      await new Promise(r => requestAnimationFrame(r));
      for (const b of L.bullets) if (!seen.has(b)) { seen.add(b); shots++; if (b.vx < 0) left++; else right++; }
    }
    Object.assign(I.right, { active: false, on: false, mag: 0 });
    return { shots, left, right, auto: gunPassives(I.loadout.guns[0]).auto };
  }, { slots, aim });

  let r = await run(['bolt', null, null], null);
  check('without it, hands off: nothing fires', r.shots === 0 && !r.auto, r);
  r = await run(['bolt', 'auto', null], null);
  check('with Questions Later on the gun, hands off: it keeps firing', r.shots >= 5 && r.auto, r);
  check('the way you face', r.right === r.shots, r);
  r = await run(['auto', null, 'bolt'], [-1, 0]);
  check('from any slot, and the stick (inside its dead zone) steers it', r.shots >= 5 && r.left === r.shots, r);
  check('it has a name, a price and a drop row', await page.evaluate(() => MODS.auto.name === 'Questions Later' && priceOf('auto') > 0 && modWeight('auto', 1) > 0));

  await browser.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
