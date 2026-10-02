// Saved death replays (replay/clip.js): a clip is cut to a box round your path (clipCrop) —
// creatures, patches, fog and sounds outside it dropped — made safe to store (clipSafe), and blown
// back up to world size (clipHydrate) with the kept terrain where it was.
const R = require('../load');

let pass = 0, fail = 0;
const check = (name, ok, got) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ' -> ' + JSON.stringify(got)}`);
};
const { CW, CH, CELL, FW, FH, FOG, PW, PH } = R;

// ---- clipSafe ----
const shared = { col: '#fff' };
const loopy = { a: 1, f: () => 1, s: shared, big: new Uint8Array(200000), small: new Float32Array([1, 2]) };
loopy.me = loopy;
const safe = R.clipSafe({ list: [loopy, { s: shared }] });
check('functions are dropped', !('f' in safe.list[0]));
check('a loop stays a loop', safe.list[0].me === safe.list[0]);
check('shared stays shared', safe.list[0].s === safe.list[1].s);
check('big typed arrays inside things are dropped', safe.list[0].big === null);
check('small ones kept', safe.list[0].small[1] === 2);
let cloned = true;
try { structuredClone(safe); } catch (e) { cloned = e.message; }
check('the result survives a structured clone (what IndexedDB does)', cloned === true, cloned);

// ---- sfxArgs ----
const cast = R.sfxArgs('cast', [[{ sid: 'spark', speed: 500, dmg: 3, owner: loopy, trail: [1, 2] }], 10, 20]);
check('a cast keeps only what its sound reads', cast[0][0].sid === 'spark' && cast[0][0].speed === 500 && !('owner' in cast[0][0]), cast[0][0]);
const r = R.shotSound(cast[0][0]), r0 = R.shotSound({ sid: 'spark', speed: 500, dmg: 3 });
check('and sounds the same', JSON.stringify(r) === JSON.stringify(r0));

// ---- a fake recording: you walk right along y = 1000 for 2s, a creature near you and one far off ----
const tBase = new Uint8ClampedArray(CW * CH * 4);
for (let i = 3; i < tBase.length; i += 4) tBase[i] = 255;
for (let y = 300; y < 520; y++) for (let x = 100; x < 400; x++) tBase[(y * CW + x) * 4 + 3] = 0;   // a cave
const snaps = [];
for (let i = 0; i <= 40; i++) {
  const t = 5 + i * 0.05, px = 300 + i * 4, py = 1000;
  const S = { t, p: { x: px - PW / 2, y: py - PH / 2 }, ghost: null, time: t, flick: 1, leanX: 0, leanY: 0, glowN: 0, fireN: 0, loops: [] };
  for (const k of R.RP_LISTS) S[k] = [];
  S.enemies = [{ _r: 1, x: px + 50, y: py, ty: py, fn: () => 0 }, { _r: 2, x: px + 900, y: py, ty: py }];
  S.fire = Int32Array.from([500 * CW + 160, 50 * CW + 10]); S.fireT = Uint16Array.from([3, 4]);
  snaps.push(S);
}
const fogBase = new Uint8Array(FW * FH);
fogBase[Math.floor(500 / FOG) * FW + Math.floor(160 / FOG)] = 1;
const C = { t0: 5, t1: 7, death: 6, snaps, tBase, dBase: null, fogBase,
  fogLog: [5.5, Math.floor(480 / FOG) * FW + Math.floor(200 / FOG), 1, 5.6, 2 * FW + 2, 1],
  patches: [{ t: 5.2, c: 't', x: 150, y: 450, w: 20, h: 20, px: new Uint8ClampedArray(20 * 20 * 4) },
    { t: 5.3, c: 't', x: 5, y: 5, w: 4, h: 4, px: new Uint8ClampedArray(64) }],
  sfx: [[4, 'hit', [1, 2]], [5.5, 'boom', [300, 1000, 30]], [6.5, 'ui', ['die']]] };
const S = R.clipCrop(C, { pad: 80, scene: { floor: 3, portal: { x: 1, y: 2 } }, bg: null });
const [bx, by, bw, bh] = S.box;
check('the box takes in your whole path', bx * CELL < 300 - 80 && (bx + bw) * CELL > 460 + 80 && by * CELL < 1000 && (by + bh) * CELL > 1000, S.box);
check('but not the whole world', bw * bh < CW * CH / 4 && bh < CH / 2, S.box);
check('the camera may go pad past your path', Math.abs(S.lim[0] - (300 - 80)) < 1 && Math.abs(S.lim[2] - (460 + 80)) < 1, S.lim);
check('the near creature is kept', S.snaps[0].enemies.some(e => e._r === 1));
check('the far one is not', !S.snaps.some(s => s.enemies.some(e => e._r === 2)));
check('functions inside it are gone', !('fn' in S.snaps[0].enemies[0]));
check('burning pixels outside the box are dropped', S.snaps[0].fire.length === 1 && S.snaps[0].fireT[0] === 3, Array.from(S.snaps[0].fire));
check('the patch in the box is kept, the far one dropped', S.patches.length === 1 && S.patches[0].x === 150, S.patches.map(p => p.x));
check('fog changes outside the box are dropped', S.fogLog.length === 3, Array.from(S.fogLog));
check('sounds before the clip are dropped', S.sfx.length === 2 && S.sfx[0][1] === 'boom', S.sfx);
check('the scene comes along', S.scene.floor === 3 && S.scene.portal.y === 2);
check('the kept terrain is the box only', S.tBase.length === bw * bh * 4);
check('and it is much smaller than the world', S.tBase.length < tBase.length / 4, [S.tBase.length, tBase.length]);
let sc = true;
try { structuredClone(S); } catch (e) { sc = e.message; }
check('a cropped clip can be stored', sc === true, sc);

// ---- back to world size ----
const H = R.clipHydrate(structuredClone(S));
check('terrain comes back in place (open cave)', H.tBase[(400 * CW + 160) * 4 + 3] === 0);
check('and rock', H.tBase[(560 * CW + 200) * 4 + 3] === 255);
check('outside the box is empty', H.tBase[(10 * CW + 10) * 4 + 3] === 0);
check('fog base in place', H.fogBase[Math.floor(500 / FOG) * FW + Math.floor(160 / FOG)] === 1);
check('times and limits carried', H.t0 === 5 && H.t1 === 7 && H.death === 6 && H.lim.length === 4);
const F = R.rpFrame(H.snaps, 6.02);
check('it still plays (rpFrame)', F.enemies.length === 1 && Math.abs(F.p.x - (300 + 20.4 * 4 - PW / 2)) < 1, F.p);
check('clipBytes is in the right range', R.clipBytes(S) > S.tBase.length && R.clipBytes(S) < 4e6, R.clipBytes(S));

// ---- packing for the store: gzipped JSON, every shape back as it was ----
const odd = { n: 1.23456789, inf: Infinity, s: 'x', t: new Uint16Array([1, 65535]), m: new Map([['a', { q: 1 }]]), set: new Set([3]) };
odd.self = odd; odd.twin = [odd.m, odd.m];
const back = R.clipDec(JSON.parse(JSON.stringify(R.clipEnc({ a: odd, b: [odd] }))));
check('decimals cut to 3 places', back.a.n === 1.235, back.a.n);
check('infinity survives', back.a.inf === Infinity);
check('typed arrays come back typed', back.a.t instanceof Uint16Array && back.a.t[1] === 65535);
check('Maps and Sets come back', back.a.m instanceof Map && back.a.m.get('a').q === 1 && back.a.set.has(3));
check('loops and sharing come back', back.a.self === back.a && back.b[0] === back.a && back.a.twin[0] === back.a.twin[1] && back.a.twin[0] === back.a.m);
(async () => {
  const gz = await R.clipPack(S);
  const U = await R.clipUnpack(gz);
  check('a packed clip unpacks the same', U.t1 === S.t1 && U.snaps.length === S.snaps.length && U.tBase.length === S.tBase.length &&
    U.tBase.every((v, i) => v === S.tBase[i]) && U.snaps[3].enemies[0]._r === 1 && U.fogLog[0] === S.fogLog[0], U.snaps.length);
  check('and is much smaller', gz.size < R.clipBytes(S) / 3, [gz.size, R.clipBytes(S)]);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
