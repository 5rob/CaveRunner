const { launch } = require('../chromium');
const path = require('path');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const b = await launch();
  const c = await b.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true });
  const page = await c.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGE ERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(1600);

  // ---- enemies move: patrollers around where they spawned, chasers at you ----
  // Enemies are creatures now, and they do not all move the same way. The ones with
  // a gun patrol their patch; the ones that come at you are allowed to leave it.
  const spread = await page.evaluate(() => new Promise(res => {
    // floor 1 has no gun-toting patrollers since v81 (the jellyfish replaced Heikkohiisi),
    // so make a few of its creatures Hiisi, where they stand, to measure the patrol on
    for (const e of window.__lvl.enemies.slice(0, 8)) { e.k = enemyFor('hiisi', 1); e.r = e.k.r; e.hx = e.x; e.hy = e.y; e.tgt = null; }
    const es = window.__lvl.enemies.slice(0, 24).map(e => ({ e, act: e.k.act, hx: e.hx, hy: e.hy, far: 0, moved: 0, px: e.x, py: e.y }));
    let n = 0;
    const tick = () => {
      for (const s of es) {
        s.far = Math.max(s.far, Math.hypot(s.e.x - s.hx, s.e.y - s.hy));
        s.moved += Math.hypot(s.e.x - s.px, s.e.y - s.py);
        s.px = s.e.x; s.py = s.e.y;
      }
      if (++n < 300) requestAnimationFrame(tick);
      else {
        const med = a => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0;
        const pat = es.filter(s => s.act === 'shoot');
        res({ n: es.length, pat: pat.length,
              medMoved: med(pat.map(s => s.moved)), maxFar: Math.max(0, ...pat.map(s => s.far)) });
      }
    };
    requestAnimationFrame(tick);
  }));
  check('there are patrolling enemies to measure', spread.pat > 0, spread);
  check('enemies wander off their spawn point', spread.medMoved > 20, spread);
  check('but they never leave their patch', spread.maxFar < 90, spread.maxFar);

  // a chaser closes the distance when you are inside its aggro range. Dropped next to
  // the player, then taken back out again so it cannot shoot up the rest of the run.
  const chase = await page.evaluate(() => new Promise(res => {
    const L = window.__lvl, p = L.p;
    const i = L.enemies.findIndex(e => e.k.act === 'chase');
    if (i < 0) return res({ none: true });
    const e = L.enemies[i];
    e.x = p.x + 110; e.y = p.y - 40; e.ty = e.y; e.hx = e.x; e.hy = e.y; e.tgt = null;
    const d0 = Math.hypot(e.x - p.x, e.ty - p.y);
    let n = 0;
    const tick = () => {
      if (++n < 80) return requestAnimationFrame(tick);
      const d1 = Math.hypot(e.x - p.x, e.ty - p.y);
      L.enemies.splice(L.enemies.indexOf(e), 1);        // put it back out of the way
      p.hp = 100; p.dead = false; p.hitT = 0;
      res({ id: e.k.id, d0: Math.round(d0), d1: Math.round(d1) });
    };
    requestAnimationFrame(tick);
  }));
  check('a chaser closes on you when you are in reach',
    chase.none || chase.d1 < chase.d0 - 15, chase);

  // ---- a gun needs an interact tap now, and one you declined stays quiet ----
  // put a gun under the player's feet. `fresh` also clears any cooldown on it.
  const drop = async fresh => page.evaluate(f => {
    const L = window.__lvl, q = L.pickups.find(g => g.kind === 'gun');
    q.x = L.p.x + 4; q.y = L.p.y + 6;
    if (f) q.cool = 0;
    return { name: q.gun.name, cool: q.cool };
  }, fresh);
  const interact = () => page.evaluate(() => { window.__in.current.interact = true; });

  await drop(true);
  await page.waitForTimeout(300);
  check('walking onto a gun shows its card, not the chooser',
    (await page.$('.pop.ingame')) !== null && (await page.$('.sheet')) === null);
  await interact();
  await page.waitForTimeout(250);
  check('interacting opens the chooser', !!(await page.$('.sheet')));
  await page.evaluate(() => [...document.querySelectorAll('.done')].find(x => /Leave/.test(x.textContent)).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(250);
  check('leaving it closes the chooser', (await page.$('.sheet')) === null);
  const cool = await page.evaluate(() => window.__lvl.pickups.find(g => g.kind === 'gun').cool);
  check('and starts a cooldown', cool > 1.4 && cool <= 2, cool);
  await drop();                                    // still standing on it, cooldown untouched
  await page.waitForTimeout(400);
  check('its card is hidden while the cooldown runs', (await page.$('.pop.ingame')) === null,
    await page.evaluate(() => window.__lvl.pickups.find(g => g.kind === 'gun').cool));
  await interact();
  await page.waitForTimeout(300);
  check('interacting does nothing while it is quiet', (await page.$('.sheet')) === null);
  await page.waitForTimeout(1700);
  await drop(false);
  await page.waitForTimeout(300);
  check('once it expires the card is back', !!(await page.$('.pop.ingame')));
  await interact();
  await page.waitForTimeout(250);
  check('and interacting opens it again', !!(await page.$('.sheet')));
  await page.evaluate(() => [...document.querySelectorAll('.done')].find(x => /Leave/.test(x.textContent)).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(250);

  // ---- buying a gun in the shop ----
  await page.evaluate(() => {
    const L = window.__lvl, LO = window.__in.current.loadout;
    LO.gold = 500;
    const gun = L.pickups.find(g => g.kind === 'gun').gun;
    L.stock[1] = { kind: 'gun', gun, x: L.p.x, y: L.p.y + 4, price: 120, sold: false };
    L.pickups.length = 0;
    window.__in.current.sig = '';
  });
  await page.waitForTimeout(400);
  const buyTxt = await page.evaluate(() => { const e = document.querySelector('.pbuy'); return e && e.textContent; });
  check('a gun plinth offers a buy price', /Buy.*120g/.test(buyTxt || ''), buyTxt);
  const card = await page.evaluate(() => { const e = document.querySelector('.pop.ingame .ptitle'); return e && e.textContent; });
  check('and shows its stats while you stand there', /For sale/.test(card || ''), card);
  await interact();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({
    gold: window.__in.current.loadout.gold,
    sold: window.__lvl.stock[1].sold,
    onFloor: window.__lvl.pickups.filter(q => q.kind === 'gun').length,
    card: !!document.querySelector('.pop.ingame'),
    chooser: !!document.querySelector('.sheet'),
  }));
  check('buying takes the gold and marks it sold', after.gold === 380 && after.sold, after);
  // buying is one interact tap; it drops the gun at your feet and shows its card —
  // taking it off the ground is a further, separate interact, same as any other pickup
  check('the gun drops at the plinth, showing its card', after.onFloor === 1 && after.card && !after.chooser, after);
  await interact();
  await page.waitForTimeout(250);
  check('interacting again opens the chooser', !!(await page.$('.sheet')));
  await page.evaluate(() => [...document.querySelectorAll('.done')].find(x => /Leave/.test(x.textContent)).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(250);

  // ---- All mods shelf, toggled from the Dev panel (was the DEBUG button in the sheet) ----
  await page.evaluate(() => {
    const LO = window.__in.current.loadout;
    LO.bag.length = 0; LO.bag.push('bounce', 'homing');
    LO.guns[0].slots = ['bolt', null, null, null];
    LO.debug = false;
    window.__in.current.notify();
  });
  await page.tap('.weapon');
  await page.waitForTimeout(400);
  const nBag = await page.$$eval('.bag .tile', t => t.length);
  check('the bag starts with just your mods', nBag === 2, nBag);
  await page.tap('.sheet .done');            // close the sheet to reach the Dev button
  await page.waitForTimeout(200);
  // the debug shelf lives behind the Dev window now, as "All mods"
  await page.tap('.devbtn');
  await page.waitForTimeout(200);
  check('the Dev panel opens', !!(await page.$('.devpanel')));
  // the panel now also carries Restart run, so just prove All mods is one of its buttons
  check('and it offers an All mods button',
    (await page.$$eval('.devpanel .dbg', b => b.map(x => x.textContent))).includes('All mods'));
  await page.tap('.devpanel .dbg');
  await page.waitForTimeout(150);
  check('All mods turns the shelf on', await page.evaluate(() => window.__in.current.loadout.debug === true));
  await page.tap('.devpanel .done');
  await page.waitForTimeout(200);
  await page.tap('.weapon');
  await page.waitForTimeout(400);
  const nDbg = await page.$$eval('.bag .tile', t => t.length);
  const allMods = await page.evaluate(() => ALL_IDS.length);   // `off` mods are never shown
  check('All mods shows one of every mod', nDbg === allMods, { nDbg, allMods });
  check('and marks the shelf', await page.$$eval('.bag', b => b[0].className.includes('debug')));

  // drag a shelf mod onto the gun twice: infinite uses, real bag untouched
  const dragTo = async (bagIdx, slotIdx) => {
    const src = (await page.$$('.bag .tile'))[bagIdx];
    const dst = (await page.$$('.slotRow .tile'))[slotIdx];
    await src.scrollIntoViewIfNeeded();
    const a = await src.boundingBox(), d = await dst.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(220);
  };
  const shelfIds = await page.$$eval('.bag .tile', t => t.map(x => x.dataset.mod));
  const pick = shelfIds.indexOf('scatter');
  await dragTo(pick, 1);
  await dragTo(await page.$$eval('.bag .tile', t => t.map(x => x.dataset.mod)).then(a => a.indexOf('scatter')), 2);
  const st = await page.evaluate(() => ({
    slots: window.__in.current.loadout.guns[0].slots.slice(),
    bag: window.__in.current.loadout.bag.slice(),
    tiles: document.querySelectorAll('.bag .tile').length,
  }));
  check('a shelf mod can be fitted over and over', st.slots[1] === 'scatter' && st.slots[2] === 'scatter', st.slots);
  check('the shelf never runs down', st.tiles === allMods, st.tiles);
  check('and your real collection is untouched', JSON.stringify(st.bag) === JSON.stringify(['bounce', 'homing']), st.bag);

  // turn it back off, again from the Dev panel
  await page.tap('.sheet .done');
  await page.waitForTimeout(200);
  await page.tap('.devbtn');
  await page.waitForTimeout(200);
  await page.tap('.devpanel .dbg');
  await page.waitForTimeout(150);
  check('All mods turns back off', await page.evaluate(() => window.__in.current.loadout.debug === false));
  await page.tap('.devpanel .done');
  await page.waitForTimeout(200);
  await page.tap('.weapon');
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => ({
    tiles: [...document.querySelectorAll('.bag .tile')].map(t => t.dataset.mod),
    slots: window.__in.current.loadout.guns[0].slots.slice(),
  }));
  check('switching All mods off hands your mods back', JSON.stringify(off.tiles) === JSON.stringify(['bounce', 'homing']), off.tiles);
  check('and the gun keeps what you fitted', off.slots[1] === 'scatter' && off.slots[2] === 'scatter', off.slots);

  console.log(fails ? `\n${fails} failed` : '\nall good');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
