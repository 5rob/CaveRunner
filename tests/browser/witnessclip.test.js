// Saved death replays and the ragdoll, in a sandbox. A blast kills you: the body is a ragdoll,
// thrown away from it (not a see-through statue). The death replay's Save keeps the clip (cut to
// the box round your path) in IndexedDB; the Bag's Witness tab lists it with a thumbnail, renames
// it, plays it full screen (on its own floor's data, the camera held inside what was kept, the
// live world untouched), exports it as an MP4 with sound, and deletes it.
const { launch } = require('../chromium');
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined ? ' -> ' + JSON.stringify(x) : ''}`); };

(async () => {
  const browser = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 880 }, hasTouch: true, isMobile: true, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { fails++; console.log('PAGEERROR', e.message); });
  await page.goto('file://' + path.join(__dirname, '..', 'build', 'test.html'));
  await page.waitForTimeout(800);
  await page.evaluate(() => { DEV.zoom = 1; });
  await page.touchscreen.tap(200, 120);   // a tap anywhere: the sound unlocks
  await page.waitForTimeout(200);

  // the replay's rock comes from the terrain's pixels: check that matches the real rock
  const mat = await page.evaluate(() => {
    const L = window.__lvl; let bad = 0, n = 0;
    for (let i = 0; i < L.mat.length; i += 7) { n++; if ((L.mat[i] !== 0) !== (L.img.data[i * 4 + 3] !== 0)) bad++; }
    return { bad, n };
  });
  check('solid rock is exactly the opaque terrain pixels', mat.bad / mat.n < 0.001, mat);

  const r = await page.evaluate(async () => {
    const L = window.__lvl, p = L.p, R = L.rec;
    const frame = () => new Promise(requestAnimationFrame);
    const frames = async (n, until) => { for (let i = 0; i < n; i++) { await frame(); if (until && until()) return true; } return false; };
    const out = {};
    L.sandbox({ w: 500, h: 220 });
    await frames(30);
    p.hp = 1;
    L.explode(p.x + 12 + 6, p.y + 11, 30);                 // a blast just to your right
    out.dead = p.dead;
    await frames(2);
    out.rag = !!p.rag;
    out.boomHeard = R.sfx.some(e => e[1] === 'boom');
    out.dieHeard = R.sfx.some(e => e[1] === 'ui' && e[2][0] === 'die');
    const hip0 = p.rag && p.rag.joints[2].x;
    await frames(30);
    out.thrownLeft = !!p.rag && p.rag.joints[2].x < hip0 - 8;
    out.youFollow = !!p.rag && Math.abs(p.x + 6 - p.rag.joints[2].x) < 0.01;
    const last = R.snaps[R.snaps.length - 1].p;
    out.snapRag = !!last.rag && last.rag !== p.rag;
    out.ready = await frames(400, () => !!window.__in.current.witness);
    return out;
  });
  check('a blast kills you', r.dead);
  check('your body becomes a ragdoll', r.rag);
  check('thrown away from the blast', r.thrownLeft);
  check('you (the camera) follow the body', r.youFollow);
  check('the replay records the ragdoll', r.snapRag);
  check('the sounds are recorded (the blast, the death)', r.boomHeard && r.dieHeard, [r.boomHeard, r.dieHeard]);
  check('the death replay is offered', r.ready);

  // the dead body is drawn solid: the white suit shows bright at the chest (it used to be drawn at 35%)
  const red = await page.evaluate(() => {
    const L = window.__lvl, c = document.querySelector('canvas.game'), x = c.getContext('2d');
    const s = L.light.s, j = L.p.rag.joints;
    let best = 0;
    for (const k of [1, 2]) {
      const px = Math.round((j[k].x - L.light.cam.x) * s), py = Math.round((j[k].y - L.light.cam.y) * s);
      const d = x.getImageData(px - 2, py - 2, 5, 5).data;
      for (let i = 0; i < d.length; i += 4) best = Math.max(best, Math.min(d[i], d[i + 1], d[i + 2]));
    }
    return best;
  });
  check('the body is drawn solid (white suit shows bright)', red > 170, red);

  // ---- Save ----
  await page.tap('.witnessbtn'); await page.waitForTimeout(300);
  check('the live replay has Save and Export', !!(await page.$('.wsave')) && !!(await page.$('.wvideo')));
  await page.tap('.wsave');
  await page.waitForFunction(() => /Saved/.test((document.querySelector('.wsave') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const sv = await page.evaluate(async () => {
    const list = await new Promise(res => {
      const rq = indexedDB.open('caverunner-clips', 1);
      rq.onsuccess = () => { const t = rq.result.transaction(['meta'], 'readonly').objectStore('meta').getAll(); t.onsuccess = () => res(t.result); };
      rq.onerror = () => res(null);
    });
    const m = list && list[0];
    return { label: document.querySelector('.wsave').textContent, n: list && list.length,
      m: m && { name: m.name, bytes: m.bytes, thumb: m.thumb.slice(0, 22), secs: m.secs },
      span: window.__in.current.witness.t1 - window.__in.current.witness.t0 };
  });
  check('Save says saved', /Saved/.test(sv.label), sv.label);
  check('one clip in the store', sv.n === 1, sv.n);
  check('with a thumbnail', !!sv.m && sv.m.thumb === 'data:image/jpeg;base64', sv.m);
  check('as long as the replay', !!sv.m && Math.abs(sv.m.secs - sv.span) < 0.1, [sv.m, sv.span]);
  check('a sensible size (packed, under 2 MB)', !!sv.m && sv.m.bytes > 20e3 && sv.m.bytes < 2e6, sv.m && sv.m.bytes);
  console.log('     (clip size ' + (sv.m ? (sv.m.bytes / 1e6).toFixed(2) : '?') + ' MB)');
  await page.tap('.wclose'); await page.waitForTimeout(200);

  // ---- the Bag's Witness tab ----
  await page.tap('.dbtn.weapon'); await page.waitForTimeout(300);
  await page.tap('.btab[data-tab="witness"]');
  await page.waitForSelector('.wclip', { timeout: 5000 }).catch(() => {});
  const g = await page.evaluate(() => ({ n: document.querySelectorAll('.wclip').length,
    img: !!document.querySelector('.wclip img'), name: (document.querySelector('.wclip .wname') || {}).textContent }));
  check('the Witness tab lists the clip', g.n === 1 && g.img, g);
  await page.tap('.wclip .wren'); await page.waitForTimeout(100);
  await page.fill('.wrename input', 'Blown up');
  await page.tap('.wrename .wok'); await page.waitForTimeout(300);
  const nm = await page.evaluate(() => (document.querySelector('.wclip .wname') || {}).textContent);
  check('renaming works', nm === 'Blown up', nm);
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'witness-gallery.png') });

  // ---- play it ----
  await page.evaluate(() => {
    const L = window.__lvl;
    window.__liveRef = { enemies: L.enemies, n: L.enemies.length, px: L.p.x, mat: L.mat, floor: L.floor };
  });
  await page.tap('.wclip .wthumbimg'); await page.waitForTimeout(500);
  const pl = await page.evaluate(async () => {
    const V = window.__in.current.replay, L = window.__lvl;
    const frame = () => new Promise(requestAnimationFrame);
    const out = { open: !!document.querySelector('.witness'), title: document.querySelector('.wtitle').textContent,
      scene: !!(V && V.clip && V.clip.scene), playing: !!V && V.playing, noSave: !document.querySelector('.wsave'),
      bag: !!document.querySelector('.sheet') };
    // the camera can't leave what was kept
    V.follow = false; V.cx = -5000; V.cy = 99999; V.zoom = 0.5;
    await frame(); await frame();
    out.clamped = V.cx === V.clip.lim[0] && V.cy === V.clip.lim[3] && V.zoom === 1;
    const R = window.__liveRef;
    out.untouched = L.enemies === R.enemies && L.enemies.length === R.n && L.p.x === R.px && L.mat === R.mat && L.floor === R.floor;
    V.follow = true;
    // its sounds play as it runs past them (the blast and the death, just before V.clip.death)
    out.audio = SFX.ready;
    const n0 = SFX.stats.played;
    V.t = V.clip.death - 0.4; V.speed = 1; V.playing = true;
    for (let i = 0; i < 50; i++) await frame();
    out.played = SFX.stats.played - n0;
    return out;
  });
  check('tapping the thumbnail plays it full screen', pl.open && !pl.bag && pl.playing, pl);
  check('under its name', pl.title === 'Blown up', pl.title);
  check('it brings its own floor', pl.scene);
  check('a saved one has no Save button', pl.noSave);
  check('the camera stays inside what was kept', pl.clamped, pl);
  check('the live world is untouched', pl.untouched);
  if (pl.audio) check('its recorded sounds play back', pl.played >= 2, pl.played);
  else console.log('     (no sound in this browser: playback of sounds not checked)');
  await page.screenshot({ path: path.join(__dirname, '..', 'build', 'witness-saved.png') });

  // ---- export a video ----
  const mime = await page.evaluate(() => {
    for (const m of ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4;codecs=avc1,opus', 'video/mp4'])
      if (MediaRecorder.isTypeSupported(m)) return m;
    return '';
  });
  console.log('     (this Chrome records ' + (mime || 'no MP4: the export would go through ffmpeg') + ')');
  if (mime) {
    await page.evaluate(() => {
      window.__in.current.replay.speed = 2;
      const cs = HTMLCanvasElement.prototype.captureStream;
      HTMLCanvasElement.prototype.captureStream = function (...a) { window.__vidSize = [this.width, this.height]; return cs.apply(this, a); };
    });
    const dl = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await page.tap('.wvideo');
    await page.waitForTimeout(300);
    const during = await page.evaluate(() => !!document.querySelector('.wexp'));
    check('the export shows its progress', during);
    const d = await dl;
    check('a video file comes out', !!d);
    const shape = await page.evaluate(() => ({ v: window.__vidSize, s: [innerWidth, innerHeight] }));
    check('the video is the shape of the screen', !!shape.v && Math.abs(shape.v[0] / shape.v[1] - shape.s[0] / shape.s[1]) < 0.01, shape);
    if (d) {
      const f = path.join(__dirname, '..', 'build', 'witness-export.mp4');
      await d.saveAs(f);
      const b = fs.readFileSync(f);
      check('it is an MP4', b.slice(4, 8).toString() === 'ftyp', b.slice(0, 12).toString('latin1'));
      check('named after the clip', /Blown up\.mp4$/.test(d.suggestedFilename()), d.suggestedFilename());
      check('with a sound track', b.includes(Buffer.from('soun')), b.length);
      check('and a picture track', b.includes(Buffer.from('vide')));
      check('of a real length (> 100 kB)', b.length > 100e3, b.length);
    }
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ msg: (document.querySelector('.wmsg') || {}).textContent, onFrame: window.__in.current.replay.onFrame,
      loop: window.__in.current.replay.loop }));
    check('it says so, and the replay is back as it was', /Downloaded/.test(after.msg || '') && !after.onFrame && after.loop === true, after);
  }

  // ---- Close goes back to the tab; delete ----
  await page.tap('.wclose'); await page.waitForTimeout(300);
  const back = await page.evaluate(() => ({ tab: (document.querySelector('.btab.on') || {}).textContent, rv: window.__in.current.replay }));
  check('Close goes back to the Witness tab', back.tab === 'Witness' && back.rv === null, back);
  await page.waitForSelector('.wclip', { timeout: 5000 }).catch(() => {});
  await page.tap('.wclip .wdelask'); await page.waitForTimeout(100);
  await page.tap('.wclip .wdel'); await page.waitForTimeout(400);
  const del = await page.evaluate(() => ({ n: document.querySelectorAll('.wclip').length, empty: !!document.querySelector('.wempty') }));
  check('delete removes it', del.n === 0 && del.empty, del);

  await browser.close();
  console.log(fails ? `\n${fails} failed` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
