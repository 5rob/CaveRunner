// v127 vines and web lines that give (world/sway.js), in a sandbox: a web line sags; you fly
// up through it without being held up, it wobbles the way you went and settles straight again;
// drop onto it and you hang on, it dips and you bob, then it settles at the dip, and the jetpack
// still takes you off it. A hanging vine swings when you fly past it and settles; grab one on
// the move and you swing on it, it hangs through your hands, the swing dies away under it, and
// the jetpack still takes you off it. An arched vine dips and bounces when you drop onto it.
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

  const r = await page.evaluate(async () => {
    const L = window.__lvl, W = L.world, p = L.p, PW = 12, PH = 22, WEB_HAND = 3;
    for (const k of ['webSag', 'bendK', 'bendDamp', 'bendPush', 'bendGrab', 'bendDip', 'bendMax', 'vineGrav', 'vineDamp', 'vinePush', 'vineMax']) DEV[k] = DEV_DEFAULTS[k];
    const frame = () => new Promise(requestAnimationFrame);
    const frames = async n => { for (let i = 0; i < n; i++) await frame(); };
    const stick = (nx, ny) => { window.__in.current.left = nx || ny ? { active: true, nx, ny, mag: 1, dy: ny } : { active: false, nx: 0, ny: 0, mag: 0, dy: 0 }; };
    const out = {};
    const pc = () => ({ x: p.x + PW / 2, y: p.y + PH / 2 });
    // wait (frame-counted) until f() or n frames; true if f() came true
    const until = async (f, n) => { for (let i = 0; i < n; i++) { if (f()) return true; await frame(); } return !!f(); };

    // ---- a web line ----
    let room = L.sandbox({ w: 400, h: 220 });
    const ly = room.y - 110;
    const web = { ax: room.l + 20, ay: ly, bx: room.r - 20, by: ly, a0x: room.l + 20, a0y: ly, b0x: room.r - 20, b0y: ly, ain: null, bin: null, owner: null };
    L.webs.push(web);
    stick(0, 0);
    await frames(5);
    out.sag = +(webAt(web, 0.5).y - ly).toFixed(2);
    out.sagWant = +(DEV.webSag * (web.b0x - web.a0x)).toFixed(2);

    // fly up through it
    p.x = room.x - PW / 2; p.y = ly + 40; p.vx = 0; p.vy = 0; p.fuel = 1;
    stick(0, -1);
    let most = 0, n = 0;
    while (p.y + PH > ly - 8 && n < 120) { await frame(); n++; most = Math.max(most, Math.hypot(web.wx || 0, web.wy || 0)); }
    out.throughFrames = n; out.wobble = +most.toFixed(2); out.wobbleUp = (web.wy || 0) < 0 || (web.wvy || 0) < 0;
    stick(0, 0);
    p.x = room.l + 30; p.y = room.y - 12; p.vx = 0; p.vy = 0;
    out.webSettled = await until(() => !web.wx && !web.wy && !web.wvx && !web.wvy, 400);

    // drop onto it: you hang on, it dips, you bob, it settles at the dip
    p.x = room.x - PW / 2; p.y = ly - WEB_HAND - 4; p.vx = 0; p.vy = 250; p.fuel = 1;
    out.webHeld = await until(() => L.zfx.web === web, 30);
    let lo = Infinity, hi = -Infinity, wyMost = 0;
    for (let i = 0; i < 60; i++) { await frame(); lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); wyMost = Math.max(wyMost, web.wy || 0); }
    out.webBob = +(hi - lo).toFixed(2); out.webDipMost = +wyMost.toFixed(2);
    await frames(180);
    out.webRest = +(web.wy || 0).toFixed(2); out.webStillHeld = L.zfx.web === web;
    out.handsOn = +webDist(web, p.x + PW / 2, p.y + WEB_HAND).toFixed(2);
    // the jetpack takes you off it
    stick(0, -1);
    await frames(40);
    out.webLeft = L.zfx.climb !== web && p.y + PH < ly - 5;
    stick(0, 0);
    p.x = room.l + 30; p.y = room.y - 12; p.vx = 0; p.vy = 0;
    out.webSettled2 = await until(() => !web.wx && !web.wy && !web.wvx && !web.wvy, 400);
    L.webs.length = 0;

    // ---- a hanging vine ----
    room = L.sandbox({ w: 400, h: 200, roof: true });
    const top = Math.floor((room.y - 200) / W.CELL) * W.CELL;
    const mkVine = () => {
      L.props.length = 0;
      const v = { id: 'vine', k: 'climb', st: 'vine', x: room.x, y: top, t: 0, seed: 0.4, hang: 1, len: 70, l: -5, t0: 0, r: 5, b: 70,
        anc: [Math.floor(room.x / W.CELL), top / W.CELL - 1] };
      L.props.push(v);
      return v;
    };
    let vine = mkVine();
    // fly past it, low on it
    p.x = room.x - 70; p.y = top + 30; p.vx = 0; p.vy = 0; p.fuel = 1;
    stick(1, -0.12);
    let swMost = 0, firstSign = 0;
    n = 0;
    while (pc().x < room.x + 40 && n < 150) {
      await frame(); n++;
      if (!firstSign && Math.abs(vine.sw || 0) > 0.01) firstSign = Math.sign(vine.sw);
      swMost = Math.max(swMost, Math.abs(vine.sw || 0));
    }
    out.pastFrames = n; out.pastSw = +swMost.toFixed(3); out.swungYourWay = firstSign > 0;
    stick(0, 0);
    p.x = room.l + 30; p.y = room.y - 12; p.vx = 0; p.vy = 0;
    out.vineSettled = await until(() => !vine.sw && !vine.swv, 900);

    // grab it on the move: you swing on it and it settles under its root
    vine = mkVine();
    stick(0, 0);
    p.x = room.x - PW / 2; p.y = top + 40 - WEB_HAND; p.vx = 160; p.vy = 0; p.fuel = 1;
    let held = 0, cross = 0, far = 0, side = 0, gap = 0;
    for (let i = 0; i < 420; i++) {
      await frame();
      if (L.zfx.climb === vine) held++;
      const dx = pc().x - room.x;
      far = Math.max(far, Math.abs(dx));
      if (Math.abs(dx) > 1.5) { const s = Math.sign(dx); if (side && s !== side) cross++; side = s; }
      if (i > 10 && i < 200 && p.swing) gap = Math.max(gap, Math.abs(room.x + Math.sin(vine.sw) * (p.y + WEB_HAND - top) - pc().x));
    }
    out.swingHeld = held; out.swingCross = cross; out.swingFar = +far.toFixed(1); out.vineOnHands = +gap.toFixed(2);
    out.swingRest = +Math.abs(pc().x - room.x).toFixed(2); out.stillOn = L.zfx.climb === vine;
    stick(0.7, -0.7);          // up and away: off it
    await frames(40);
    out.vineLeft = L.zfx.climb !== vine && Math.abs(pc().x - room.x) > 20;
    stick(0, 0);

    // ---- an arched vine: drop onto it ----
    room = L.sandbox({ w: 400, h: 200, roof: true });
    const A = { x: room.l + 40, y: top }, B = { x: room.r - 40, y: top };
    const pts = archCurve(A.x, A.y, B.x, B.y, 1.3, 30);
    const ar = { id: 'arch', k: 'climb', st: 'vine', x: A.x, y: A.y, t: 0, seed: 0.3, hang: 1, thick: 3, alen: 400,
      anc: [Math.floor(A.x / W.CELL), A.y / W.CELL - 1], anc2: [Math.floor(B.x / W.CELL), B.y / W.CELL - 1],
      arc: pts.map(q => [q.x - A.x, q.y - A.y]) };
    ar.l = -4; ar.r = B.x - A.x + 4; ar.t0 = -3; ar.b = Math.max(...ar.arc.map(a => a[1])) + 30;
    L.props.length = 0; L.props.push(ar);
    const mid = archAt(ar, 0.5);
    p.x = mid.x - PW / 2; p.y = mid.y - WEB_HAND - 4; p.vx = 0; p.vy = 250; p.fuel = 1;
    out.archHeld = await until(() => L.zfx.arch === ar, 30);
    let arMost = 0;
    for (let i = 0; i < 60; i++) { await frame(); arMost = Math.max(arMost, ar.wy || 0); }
    await frames(180);
    out.archDipMost = +arMost.toFixed(2); out.archRest = +(ar.wy || 0).toFixed(2);
    out.archHands = +archNear(ar, p.x + PW / 2, p.y + WEB_HAND).d.toFixed(2);
    return out;
  });
  await page.screenshot({ path: path.join(DIR, 'sway.png') });
  const dip = await page.evaluate(() => DEV.bendDip);

  check('a web line sags at rest', Math.abs(r.sag - r.sagWant) < 0.01 && r.sag > 0, r);
  check('you fly up through a web line without being held up', r.throughFrames < 60, r.throughFrames);
  check('it wobbles, pushed the way you went', r.wobble > 1 && r.wobbleUp, r);
  check('then settles straight again (and sleeps)', r.webSettled);
  check('drop onto it and you hang on', r.webHeld && r.webStillHeld, r);
  check('it dips under you and you bob', r.webDipMost > dip * 0.8 && r.webBob > 1.5, r);
  check('then it hangs at the dip, your hands on it', Math.abs(r.webRest - dip) < 0.5 && r.handsOn < 4, r);
  check('the jetpack still takes you off it', r.webLeft);
  check('and it springs back straight', r.webSettled2);
  check('a hanging vine swings when you fly past it, your way', r.pastSw > 0.05 && r.swungYourWay, r);
  check('you get past it', r.pastFrames < 120, r.pastFrames);
  check('and it comes to rest', r.vineSettled);
  check('grab a vine on the move and you swing on it', r.swingHeld > 400 && r.swingCross >= 2 && r.swingFar > 8, r);
  check('the vine hangs through your hands as you swing', r.vineOnHands < 4, r.vineOnHands);
  check('the swing dies away under its root, still holding on', r.swingRest < 3 && r.stillOn, r);
  check('the jetpack still takes you off it', r.vineLeft);
  check('an arched vine: drop onto it and you hang on', r.archHeld, r);
  check('it dips and settles at the dip, your hands on it', r.archDipMost > dip * 0.8 && Math.abs(r.archRest - dip) < 0.5 && r.archHands < 6, r);
  check('no page errors', errs.length === 0, errs.slice(0, 3));

  await browser.close();
  if (fails) { console.log(`\n${fails} failed`); process.exit(1); }
  console.log('\nall sway checks passed');
})().catch(e => { console.log('FAIL', e); process.exit(1); });
