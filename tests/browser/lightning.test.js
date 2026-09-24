// v62: Lightning Bolt draws as a jagged, flickering bolt and throws side arcs as it flies:
// at a creature in reach (a little damage, even off the bolt's line) or at nearby rock.
// Runs in the sandbox room, so the cave round it can't get in the way.
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
  await page.waitForTimeout(1200);

  const fire = () => page.evaluate(async () => {
    const LO = window.__in.current.loadout, L = window.__lvl;
    const g = LO.guns[0];
    g.slots = ['zap']; g.manaMax = 9999; g.mana = 9999; resetGun(g);
    LO.sel = 0;
    window.__in.current.right = { active: true, nx: 1, ny: 0, mag: 1, dy: 0, on: true };
    await new Promise(r => setTimeout(r, 40));
    window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
    let bolt = null, maxTrail = 0, maxArcs = 0;
    for (let k = 0; k < 40; k++) {                // up to ~0.7s, the bolt lives 0.5s
      bolt = bolt || L.bullets.find(x => x.arc);
      if (bolt && bolt.trail) maxTrail = Math.max(maxTrail, bolt.trail.length);
      maxArcs = Math.max(maxArcs, L.arcs.length);
      await new Promise(r => requestAnimationFrame(r));
    }
    return { fired: !!bolt, maxTrail, maxArcs };
  });

  // 1. an enemy well off the bolt's line still gets zapped by a fork
  const setup = await page.evaluate(() => {
    const L = window.__lvl, proto = L.enemies[0];
    const room = L.sandbox({ w: 400, h: 200 });
    const e = Object.assign({}, proto, { hp: 9999, hpMax: 9999, tgt: null });
    e.x = L.p.x + 120; e.y = e.ty = L.p.y - 50;   // above and ahead, not in the path
    e.k = Object.assign({}, e.k, { act: 'turret', range: 0, aggro: 0 });
    L.enemies.push(e);
    window.__e = e;
    return { room, has: !!proto };
  });
  check('sandbox up with a test creature', setup.has, setup);
  const r1 = await fire();
  const hurt = await page.evaluate(() => window.__e.hp < 9999);
  check('Lightning Bolt fired', r1.fired, r1);
  check('it carries a jagged trail to draw', r1.maxTrail > 2, r1);
  check('it throws side arcs', r1.maxArcs > 0, r1);
  check('a fork hits a creature off to the side of its path', hurt);
  await page.screenshot({ path: path.join(DIR, 'lightning.png') });

  // 2. no creatures: it still arcs to the floor it's skimming over
  await page.evaluate(() => { window.__lvl.sandbox({ w: 400, h: 200 }); });
  const r2 = await fire();
  check('with nothing to hit, it arcs to nearby rock', r2.maxArcs > 0, r2);

  check('no page errors', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
