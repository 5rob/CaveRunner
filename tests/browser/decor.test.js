// v58: level decoration. Every floor's theme is dressed with its props, and the props work in
// the real game: a vine holds you, a mushroom throws you, a cart blows when shot, a prop
// whose rock is dug away falls, and all twelve themes run without a page error.
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

  const hop = async () => {
    await page.evaluate(() => {
      const L = window.__lvl, pt = L.portal;
      L.p.x = pt.x + pt.w / 2 - 6; L.p.y = pt.y + pt.h / 2 - 11;
      L.p.vx = 0; L.p.vy = 0; L.p.hp = 100; L.p.dead = false;
    });
    await page.waitForTimeout(700);
  };
  // stand the player beside the first prop matching `want` and keep them alive
  const goTo = (id, dx, dy) => page.evaluate(([id, dx, dy]) => {
    const L = window.__lvl, pr = L.props.find(q => q.id === id && !q.fall);
    if (!pr) return null;
    L.p.x = pr.x - 6 + dx; L.p.y = (pr.hang ? pr.y + 20 : pr.y - 22) + dy; L.p.vx = 0; L.p.vy = 0; L.p.hp = 9999;
    L.enemies.length = 0;
    return { x: pr.x, y: pr.y, id: pr.id };
  }, [id, dx || 0, dy || 0]);

  // ---- every theme gets its props, and each one draws ----
  const per = {};
  for (let f = 1; f <= 12; f++) {
    if (f > 1) await hop();
    const got = await page.evaluate(() => {
      const L = window.__lvl, ids = {};
      for (const q of L.props) ids[q.id] = (ids[q.id] || 0) + 1;
      return { floor: L.floor, ids, amb: L.amb.length, want: decorFor(L.floor).filter(d => d.kind !== 'bake' && d.kind !== 'amb').map(d => d.id) };
    });
    per[f] = got;
    check('floor ' + got.floor + ' has every prop kind its theme lists', got.want.every(id => got.ids[id] > 0), got.ids);
    // look at a prop on each floor
    const first = got.want[0];
    const at = await goTo(first, -30, 0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DIR, 'decor_f' + f + '.png') });
  }
  check('no page errors across all twelve themes', errs.length === 0, errs.slice(0, 3));

  // ---- floor 13 wraps to the mossy caves: a vine holds you up ----
  await hop();
  const vine = await goTo('vines', 0, 0);
  const hang = await page.evaluate(async () => {
    const L = window.__lvl, pr = L.props.find(q => q.id === 'vines');
    L.p.x = pr.x - 6; L.p.y = pr.y + pr.len * 0.4; L.p.vy = 0; L.p.fuel = 0; L.p.empty = true;
    const y0 = L.p.y;
    await new Promise(r => setTimeout(r, 600));
    return { y0, y1: L.p.y, climb: !!L.zfx.climb, fuel: L.p.fuel };
  });
  check('a vine holds you where you grabbed it', vine && Math.abs(hang.y1 - hang.y0) < 6 && hang.climb, hang);
  check('and you get your breath (fuel) back on it', hang.fuel > 0.2, hang.fuel);

  // ---- a prop whose rock is dug away falls ----
  const fall = await page.evaluate(async () => {
    const L = window.__lvl, pr = L.props.find(q => q.anc && q.hang && !q.fall);
    if (!pr) return null;
    L.p.x = pr.x - 6; L.p.y = pr.y + 40;
    L.dig(pr.x, pr.y - 6, 12);
    const y0 = pr.y;
    await new Promise(r => setTimeout(r, 1200));
    return { id: pr.id, y0, y1: pr.y, gone: !L.props.includes(pr), fell: !!pr.fall };
  });
  check('a hanging prop drops once its rock is dug out', fall && (fall.gone || fall.y1 > fall.y0 + 4), fall);

  // ---- floor 14 (coal seams): shooting a minecart sets it off ----
  await hop();
  const cart = await page.evaluate(async () => {
    const L = window.__lvl, pr = L.props.find(q => q.id === 'carts');
    if (!pr) return null;
    L.enemies.length = 0;
    const LO = window.__in.current.loadout, g = LO.guns[0];
    LO.sel = 0; g.manaMax = g.mana = 9999; resetGun(g);
    L.p.x = pr.x - 44; L.p.y = pr.y - 22; L.p.vx = L.p.vy = 0; L.p.hp = 9999;
    L.dig(pr.x - 30, pr.y - 12, 9);                      // a clear line to it
    const fl = L.flashes.length;
    await new Promise(r => setTimeout(r, 100));
    const gx = L.p.x + 6, gy = L.p.y + 22 * 0.4, dx = pr.x - gx, dy = pr.y - 6 - gy, d = Math.hypot(dx, dy);
    window.__in.current.right = { active: true, nx: dx / d, ny: dy / d, mag: 1, dy: 0, on: true };
    await new Promise(r => setTimeout(r, 900));
    window.__in.current.right = { active: false, nx: 1, ny: 0, mag: 0, dy: 0, on: false };
    return { gone: !L.props.includes(pr), boom: L.flashes.length > fl || pr.gone };
  });
  check('a shot minecart explodes', cart && cart.gone && cart.boom, cart);

  // ---- floor 17 (fungal grotto): a mushroom throws you up ----
  for (let i = 0; i < 3; i++) await hop();
  const pad = await page.evaluate(async () => {
    const L = window.__lvl, pr = L.props.find(q => q.id === 'shrooms');
    if (!pr) return null;
    L.enemies.length = 0;
    L.p.x = pr.x - 6; L.p.y = pr.y - 22 - 30; L.p.vy = 50; L.p.hp = 9999;
    let minVy = 0;
    for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 16)); minVy = Math.min(minVy, L.p.vy); }
    return { minVy, sq: pr.sq };
  });
  check('a bouncy mushroom launches you', pad && pad.minVy < -400, pad);

  check('still no page errors', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(fails ? fails + ' failed' : 'decor: all checks passed');
  process.exit(fails ? 1 : 0);
})();
