// The title's track (audio/song.js, played by audio/music.js) rendered to a file, to listen to without the game.
//   node tools/musicwav.js [seconds] [outfile]     (default: the build + one loop, 98 s; tests/build/title-music.wav)
// On a Mac it also writes a small .m4a beside it (afconvert).
const { launch } = require('../tests/chromium');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const SECS = Number(process.argv[2]) || 98;
const OUT = path.resolve(process.argv[3] || path.join(__dirname, '..', 'tests', 'build', 'title-music.wav'));
require('./build')();
require('../tests/build')();

(async () => {
  const browser = await launch();
  const page = await (await browser.newContext()).newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'tests', 'build', 'test.html'));
  await page.waitForTimeout(500);
  const b64 = await page.evaluate(async secs => {
    const sr = 44100, ac = new OfflineAudioContext(2, sr * secs, sr);
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.connect(ac.destination);
    const M = makeMusic(ac, comp);
    for (let s = 0, t = 0.05; t < secs; s++, t += STEP_SEC) M.play(s, t);
    const buf = await ac.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    const dv = new DataView(new ArrayBuffer(44 + n * 4));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true);
    dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 4, true);
    let peak = 0;
    for (let i = 0; i < n; i++) {
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
      dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    const u8 = new Uint8Array(dv.buffer);
    let bin = '';
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { data: btoa(bin), peak };
  }, SECS);
  await browser.close();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(b64.data, 'base64'));
  console.log(OUT + '  (peak ' + b64.peak.toFixed(2) + ')');
  if (process.platform === 'darwin') {
    const m4a = OUT.replace(/\.wav$/, '.m4a');
    try { execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '192000', OUT, m4a]); console.log(m4a); } catch (e) { console.log('no m4a: ' + e.message); }
  }
})().catch(e => { console.error(e); process.exit(1); });
