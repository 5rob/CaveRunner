// A track (audio/songs.js, played by audio/music.js) rendered to a file, to listen to without the game.
//   node tools/musicwav.js [track] [seconds] [outfile]
// track: an id (title, glowworm, afterburner, undertow, surface, below, boss) or all; default title. seconds: default
// the build plus one loop. Writes tests/build/music-<id>.wav, and an .mp3 beside it when ffmpeg is on the PATH (an
// .m4a on a Mac: afconvert).
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const which = args[0] && isNaN(Number(args[0])) ? args.shift() : 'title';
const SECS = Number(args[0]) || 0, OUT_ARG = args[1];
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(500);
  const ids = which === 'all' ? await page.evaluate(() => [...TRACKS.map(t => t.id), 'boss']) : [which];
  for (const id of ids) await render(page, id);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });

/** @param {any} page @param {string} id */
async function render(page, id) {
  const OUT = path.resolve(OUT_ARG || path.join(__dirname, '..', 'tests', 'build', 'music-' + id + '.wav'));
  const b64 = await page.evaluate(async ([id, secsArg]) => {
    const T = trackById(id);
    const secs = secsArg || Math.ceil((2 * T.bars - T.loop) * 16 * 60 / T.bpm / 4) + 3;
    const sr = 44100, ac = new OfflineAudioContext(2, sr * secs, sr);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(ac.destination);
    const M = makeMusic(ac, comp, T);
    for (let s = 0, t = 0.05; t < secs - 2.5; s++, t += M.step) M.play(s, t);
    const buf = await ac.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    const dv = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true);
    dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 4, true);
    let peak = 0, sq = 0;
    for (let i = 0; i < n; i++) {
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      sq += L[i] * L[i];
      dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    const u8 = new Uint8Array(dv.buffer);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { data: btoa(bin), peak, rms: Math.sqrt(sq / n), secs };
  }, [id, SECS]);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(b64.data, 'base64'));
  console.log(OUT + '  (' + b64.secs + ' s, peak ' + b64.peak.toFixed(2) + ', loudness ' + b64.rms.toFixed(3) + ')');
  if (process.platform === 'darwin') {
    const m4a = OUT.replace(/\.wav$/, '.m4a');
    try { execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '192000', OUT, m4a]); console.log(m4a); } catch (e) { console.log('no m4a: ' + e.message); }
  } else {
    const mp3 = OUT.replace(/\.wav$/, '.mp3');
    try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', OUT, '-b:a', '160k', mp3]); console.log(mp3); } catch (_) { /* no ffmpeg: the .wav only */ }
  }
}
