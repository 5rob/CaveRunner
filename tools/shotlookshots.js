// Screenshots for the owner (CaveRunner Auto, stage: shots, first half): the shots' new looks in a level, phone size
// (412 x 880 @2.625). Each picture: 4 players, each with one shot mod, firing at creatures put just ahead.
//   s1  bolt, spark, slug, buckshot       s2  lance, blast, magic arrow, magic missile
//   s3  fireball, firebolt, flamethrower, bubble spark     s4  spitter bolt, pollen, disc
//   (second half) s5  energy orb, energy sphere, lightning bolt, chain bolt     s6  black hole, plasma beam, luminous drill,
//   death cross     s7  nuke, meteor in flight, and each one's blast (a name ending '!': the close-up is the blast)
//   node tools/shotlookshots.js [outdir]      (default tests/build/shotlooks)
// Not a test: it takes the pictures and prints what each shows.
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'tests', 'build', 'shotlooks'));
fs.mkdirSync(OUT, { recursive: true });
require('./build')();
require('../tests/build')();

const SHEETS = [
  ['s1', ['bolt', 'spark', 'slug', 'buck']],
  ['s2', ['lance', 'blast', 'arrow', 'missile']],
  ['s3', ['fball', 'fbolt', 'flamer', 'bubble']],
  ['s4', ['spit', 'pollen', 'disc', 'bolt']],
  ['s5', ['eorb', 'esph', 'zap', 'chain']],
  ['s6', ['void', 'plasma', 'ldrill', 'cross']],
  ['s7', ['nuke', 'meteor', 'nuke!', 'meteor!']],
];
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;   // node tools/shotlookshots.js <outdir> s5,s6
const BOX = { void: 64, plasma: 120, ldrill: 80, 'nuke!': 120, 'meteor!': 110, meteor: 64, nuke: 64 };   // close-up box (world units)

(async () => {
  const browser = await launch();
  const said = [];
  for (const [n, mods] of SHEETS) {
    if (ONLY && !ONLY.includes(n)) continue;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2.625 });
    await ctx.addInitScript(() => { window.__TEST_TITLE = true; window.__TITLE_SEED = 101; window.__AUTO_LEVEL = 3; localStorage.removeItem('caverunner-auto-run'); });
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', e.message));
    await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
    await page.waitForTimeout(400);
    await page.evaluate(ms => {
      DEV.autoFoeDmg = 0;
      const run = newRun();
      bagAdd(run, { kind: 'green', n: 3 });
      addPlayer(run); addPlayer(run); addPlayer(run);
      run.players.forEach((p, i) => { const id = ms[i].replace('!', ''), g = p.guns[p.active]; g.slots = [id, null, null]; g.name = id; g.manaMax = g.mana = 2000; g.manaRegen = 2000; resetGun(g); });
      saveAutoRun(run);
    }, mods);
    await page.locator('.tstart').dispatchEvent('pointerdown');
    let ok = false;
    for (let i = 0; i < 80 && !ok; i++) {
      await page.waitForTimeout(100);
      ok = await page.evaluate(() => { const S = window.__autoScene; return !!(S && levelState(S).phase === 'run'); });
    }
    await page.waitForTimeout(1500);
    // creatures ahead (tough, so they stay), a fresh pair every so often
    for (let k = 0; k < 3; k++) {
      await page.evaluate(() => {
        const S = window.__autoScene;
        for (const dx of [80, 130]) { const f = titleFoeAt(S, enemyFor('rotta', 1), levelTeamX(S) + dx); f.hp = f.hpMax = 9999; }
      });
      await page.waitForTimeout(900);
    }
    await page.screenshot({ path: path.join(OUT, n + '.png') });
    // close-ups (the shots are tiny at phone size): a 64 px box round a shot of each mod, x3, four to a sheet with names
    // close-ups cut from the play canvas in the frame a shot of that mod is in flight (they're fast and short), a 48-unit box, x4
    await page.evaluate(() => {
      const d = document.createElement('div'); d.id = 'zoomsheet';
      Object.assign(d.style, { position: 'fixed', inset: '0', background: '#0b0910', zIndex: 99999, display: 'none', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '40px 8px', alignContent: 'start', font: '16px sans-serif', color: '#fff' });
      document.body.appendChild(d);
    });
    for (const m of mods) {
      for (let i = 0; i < 200; i++) {
        const got = await page.evaluate(([m, last, B]) => {
          const S = window.__autoScene, C = window.__autoCam.current, cv = document.querySelector('.aplaycvs');
          const blast = m.endsWith('!'), id = m.replace('!', '');
          /** the spot to cut round: a shot in flight (a beam: its middle, once cast), or a nuke's / meteor's blast */
          let s = null;
          if (blast) { const b = S.booms.find(q => q.sid === id && q.t > 0.08); if (b) s = b; }
          else { const q = S.shots.find(q => q.sid === id && q.age > 0.04 && (!q.beam || q.bx != null)); if (q) s = q.beam ? { x: (q.x + q.bx) / 2, y: (q.y + q.by2) / 2 } : q; }
          if (!s && !last) return false;
          const k = cv.width / TITLE_VW, w = document.createElement('div'); w.textContent = m + (s ? '' : blast ? ' (no blast seen)' : ' (none in flight)');
          const c = document.createElement('canvas'); c.width = 192; c.height = 192; Object.assign(c.style, { width: '192px', height: '192px', display: 'block', border: '1px solid #555' });
          if (s) { const v = camTo(C, s.x, s.y), x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(cv, v.x * k - B / 2 * k, v.y * k - B / 2 * k, B * k, B * k, 0, 0, 192, 192); }
          w.appendChild(c); document.getElementById('zoomsheet').appendChild(w);
          return true;
        }, [m, i === 199, BOX[m] || 48]);
        if (got) break;
        if (i % 25 === 24) await page.evaluate(() => { const S = window.__autoScene; const f = titleFoeAt(S, enemyFor('rotta', 1), levelTeamX(S) + 90); f.hp = f.hpMax = 9999; });
        await page.waitForTimeout(40);
      }
    }
    await page.evaluate(() => { document.getElementById('zoomsheet').style.display = 'grid'; });
    await page.screenshot({ path: path.join(OUT, n + '-zoom.png') });
    said.push(`${n}.png  ${ok ? '' : '(level never started) '}${mods.map((m, i) => ['blue', 'red', 'green', 'gold'][i] + ': ' + m).join(', ')}`);
    await ctx.close();
  }
  await browser.close();
  console.log(said.join('\n'));
})();
