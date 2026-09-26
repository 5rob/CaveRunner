// v87 arched vines, in a sandbox: an arch slung under the room's ceiling latches you like a
// web line, the stick runs you along its curve (uphill near an end), pushing down lets go,
// fire runs along it and it's gone (its strands catch), and cut loose at one end it drops.
// Then, on the real floor 1: the jellies keep out of the built-up zones.
const { launch } = require('../chromium');
const path = require('path');
const DIR = path.join(__dirname, '..', 'build');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(DIR, 'test.html'));
  await page.waitForTimeout(1200);

  // ---- on the real floor 1 first: zones, and the jellies keep to the natural ones ----
  const live = await page.evaluate(async () => {
    const L = window.__lvl, W = L.world;
    const out = { floor: L.floor, zone: !!L.zone, arches: L.props.filter(q => q.arc).length };
    const deep = e => [[0, 0], [40, 0], [-40, 0], [0, 40], [0, -40]].every(([dx, dy]) => builtAt(L.zone, e.x + dx, e.y + dy));
    const jel = () => L.enemies.filter(e => e.k.act === 'jelly');
    out.jellies = jel().length;
    out.deepAtStart = jel().filter(deep).length;
    // let them swim for a while, with you parked in the shop out of the way
    let worst = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < 8000) {
      await new Promise(requestAnimationFrame);
      worst = Math.max(worst, jel().filter(deep).length);
    }
    out.deepWorst = worst;
    return out;
  });
  check('floor 1 has a zone map and arched vines', live.floor === 1 && live.zone && live.arches > 3, live);
  check('no jelly swims deep into a built-up zone', live.jellies > 5 && live.deepAtStart === 0 && live.deepWorst === 0, live);

  // ---- the sandbox ----
  const r = await page.evaluate(async () => {
    const L = window.__lvl, W = L.world, p = L.p;
    const frame = () => new Promise(requestAnimationFrame);
    const wait = async ms => { const t0 = performance.now(); while (performance.now() - t0 < ms) await frame(); };
    const stick = (nx, ny) => { window.__in.current.left = nx || ny ? { active: true, nx, ny, mag: 1, dy: ny } : { active: false, nx: 0, ny: 0, mag: 0, dy: 0 }; };
    const out = {};
    const mk = () => {
      const room = L.sandbox({ w: 400, h: 200, roof: true });
      const top = Math.floor((room.y - 200) / W.CELL) * W.CELL;   // the room's first open row, under its rock roof
      const A = { x: room.l + 40, y: top }, B = { x: room.r - 40, y: A.y };
      const pts = archCurve(A.x, A.y, B.x, B.y, 1.3, 30);
      let alen = 0; for (let k = 1; k < pts.length; k++) alen += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
      const pr = { id: 'arch', k: 'climb', st: 'vine', x: A.x, y: A.y, t: 0, seed: 0.3, hang: 1, thick: 3, alen,
        anc: [Math.floor(A.x / W.CELL), A.y / W.CELL - 1], anc2: [Math.floor(B.x / W.CELL), B.y / W.CELL - 1],
        arc: pts.map(q => [q.x - A.x, q.y - A.y]) };
      pr.l = -4; pr.r = B.x - A.x + 4; pr.t0 = -3; pr.b = Math.max(...pr.arc.map(a => a[1])) + 30;
      const u = 0.3, q = archAt(pr, u);
      const st = { id: 'archStrand', k: 'climb', st: 'vine', x: q.x, y: q.y, t: 0, seed: 0.5, hang: 1, len: 24, on: pr, u, l: -5, t0: 0, r: 5, b: 24 };
      L.props.push(pr, st);
      stick(0, 0);
      return { room, pr, st };
    };
    const hands = () => ({ x: p.x + W.CELL * 1.5, y: p.y + 3 });   // PW is 6 world units wide: its middle
    const put = (pr, u) => { const q = archAt(pr, u); p.x = q.x - 3; p.y = q.y - 3 + 2; p.vx = 0; p.vy = 0; p.fuel = 1; };

    // latch, hang, climb along, let go
    let { room, pr, st } = mk();
    put(pr, 0.5);
    for (let i = 0; i < 60; i++) await frame();
    out.latched = L.zfx.arch === pr;
    out.hangD = +archNear(pr, p.x + 3, p.y + 3).d.toFixed(1);
    const x0 = p.x;
    stick(1, 0); await wait(500); stick(0, 0);
    out.along = Math.round(p.x - x0); out.alongD = +archNear(pr, p.x + 3, p.y + 3).d.toFixed(1); out.still = L.zfx.arch === pr;
    put(pr, 0.8);
    for (let i = 0; i < 30; i++) await frame();
    const y0 = p.y;
    stick(1, 0); await wait(400); stick(0, 0);
    out.uphill = Math.round(y0 - p.y);
    // let go: from the flat middle (on a steep bit, down is along it — you climb down)
    put(pr, 0.5);
    for (let i = 0; i < 30; i++) await frame();
    const y1 = p.y;
    stick(0, 1);
    for (let i = 0; i < 30; i++) await frame();
    stick(0, 0);
    for (let i = 0; i < 30; i++) await frame();
    out.letGo = L.zfx.arch !== pr && p.y > y1 + 12;

    // fire runs along it, lights the strand, and it's gone
    ({ room, pr, st } = mk());
    p.x = room.r - 30;
    const q = archAt(pr, 0.6);
    L.ignite(q.x, q.y, 4, 1);
    out.caught = !!pr.burn;
    let t = 0;
    while (!pr.gone && t < 25000) { await wait(100); t += 100; }
    out.burntIn = t; out.gone = !!pr.gone; out.strandLit = !!st.burn || !!st.gone || !L.props.includes(st);

    // cut loose at one end, it drops (and the strand with it)
    ({ room, pr, st } = mk());
    p.x = room.r - 30;
    const [bx, by] = pr.anc2;
    L.dig((bx + 0.5) * W.CELL, (by + 0.5) * W.CELL, 8);
    t = 0;
    while (!pr.fall && !pr.gone && t < 3000) { await wait(50); t += 50; }
    out.dropped = !!(pr.fall || pr.gone);
    t = 0;
    while (!st.fall && !st.gone && t < 3000) { await wait(50); t += 50; }
    out.strandDropped = !!(st.fall || st.gone);
    return out;
  });
  check('touch an arched vine and you hang from it', r.latched && r.hangD < 6, r);
  check('the stick runs you along it, staying on the curve', r.along > 20 && r.alongD < 6 && r.still, r);
  check('near an end, along it is uphill', r.uphill > 5, r.uphill);
  check('pushing down lets go', r.letGo);
  check('fire catches it, runs along it and it burns away', r.caught && r.gone, { burntIn: r.burntIn });
  check('and its strands catch as the fire passes', r.strandLit);
  check('cut loose at one end, it drops', r.dropped);
  check('and its strands with it', r.strandDropped);
  check('no page errors', errs.length === 0, errs.slice(0, 3));

  await browser.close();
  if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
  console.log('\nall archvine checks passed');
})().catch(e => { console.log('FAIL', e); process.exit(1); });
