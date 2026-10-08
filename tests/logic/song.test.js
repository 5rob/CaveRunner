// The title's music (v0.0.174, audio/song.js): the solo's bars are whole, the song builds layer by layer as the
// owner asked (pads, bass, kick, arpeggio, its harmony, the guitar solo, harmonised), loops back to bar 8, and
// every note is a real one.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

const lens = G.soloBarLengths();
check('the solo is 16 bars, each 16 sixteenths', lens.length === 16 && lens.every(l => l === 16), lens);
check('noteMidi reads names', G.noteMidi('A4') === 69 && G.noteMidi('G#5') === 80 && G.noteMidi('C4') === 60);
check('a third above in A minor: A→C, E→G, and G# over the E chord', G.harmonyOf(57, 0) === 60 && G.harmonyOf(64, 0) === 67 && G.harmonyOf(64, 3) === 68);
const bar = b => { const out = new Set(); for (let q = 0; q < 16; q++) for (const e of G.songStep(b * 16 + q)) out.add(e.i); return out; };
const has = (b, i) => bar(b).has(i);
check('bars 0–3: pads alone', [0, 1, 2, 3].every(b => [...bar(b)].join() === 'pad'), [...bar(0)]);
check('bar 4: the bass and hats come in, no kick yet', has(4, 'bass') && has(4, 'hat') && !has(4, 'kick'));
check('bar 8: the kick and snare', has(8, 'kick') && has(8, 'snare'));
const arps = b => { let n = 0; for (let q = 0; q < 16; q++) n += G.songStep(b * 16 + q).filter(e => e.i === 'arp').length; return n; };
check('the arpeggio from bar 12, harmonised from bar 16', arps(11) === 0 && arps(12) === 16 && arps(16) === 32, [arps(11), arps(12), arps(16)]);
const gtr = b => { let n = 0; for (let q = 0; q < 16; q++) n += G.songStep(b * 16 + q).filter(e => e.i === 'gtr').length; return n; };
check('the guitar solo from bar 24, a second guitar from bar 32', gtr(23) === 0 && gtr(24) > 0 && gtr(32) === 2 * (G.SOLO[2].split('|')[0].trim().split(/\s+/).filter(t => t[0] !== '-').length), [gtr(23), gtr(24), gtr(32)]);
const sig = s => JSON.stringify(G.songStep(s));
check('after bar 39 it loops back to bar 8', sig(40 * 16) === sig(8 * 16) && sig(40 * 16 + 5) === sig(8 * 16 + 5) && sig(72 * 16 + 3) === sig(8 * 16 + 3));
let bad = null;
for (let s = 0; s < 40 * 16 && !bad; s++) for (const e of G.songStep(s)) {
  const ns = e.pad || (e.n != null ? [e.n] : []);
  if (!(e.v > 0 && e.v <= 1.2) || ns.some(n => !(n >= 20 && n <= 100))) bad = { s, e };
}
check('every event a real note and volume', !bad, bad);
check('the music engine is in the source', G.source.includes('makeMusic') && G.source.includes('Music.start()'));
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('all passed');
