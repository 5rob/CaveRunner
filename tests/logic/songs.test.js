// The game's tracks (v1.0.94, audio/songs.js): six to cycle through (the title's first) and the boss's, each a range
// of tempo and mood; their leads' bars are whole, their patterns a bar long, every note real; the picker plays the
// boss's while a boss is alive and moves to the next track each level cleared.
const G = require('../load');
let fails = 0;
const check = (n, ok, x) => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${x !== undefined && !ok ? ' -> ' + JSON.stringify(x) : ''}`); };

check('six tracks, the title first, and a boss track', G.TRACKS.length === 6 && G.TRACKS[0].id === 'title' && G.BOSS_TRACK.id === 'boss');
const moods = G.TRACKS.map(t => t.mood);
check('the moods: chill, moody, exciting, suspense, happy', ['chill', 'moody', 'exciting', 'suspense', 'happy'].every(m => moods.includes(m)), moods);
const bpms = new Set(G.TRACKS.map(t => t.bpm));
check('every track its own tempo', bpms.size === 6, [...bpms]);
check('the boss track is the fastest', G.TRACKS.every(t => t.bpm < G.BOSS_TRACK.bpm));
check('the title track is the hand-written one', G.TRACKS[0].step === G.songStep);
const lens = G.leadBarLengths();
const bad = Object.entries(lens).filter(([, l]) => !l.length || l.some(n => n !== 16));
check('every lead bar adds up to 16', !bad.length, bad);
check('every pattern a bar long', !G.badPatterns().length, G.badPatterns());
let wrong = null;
for (const T of [...G.TRACKS, G.BOSS_TRACK]) for (let s = 0; s < (T.bars + 8) * 16 && !wrong; s++) for (const e of T.step(s)) {
  const ns = e.pad || (e.n != null ? [e.n] : []);
  if (!(e.v > 0 && e.v <= 1.2) || ns.some(n => !(n >= 20 && n <= 100)) || (e.d != null && !(e.d >= 1))) wrong = { id: T.id, s, e };
}
check('every event a real note and volume', !wrong, wrong);
const insts = new Set();
for (const T of [...G.TRACKS, G.BOSS_TRACK]) for (let s = 0; s < T.bars * 16; s++) for (const e of T.step(s)) insts.add(e.i);
check('only instruments the synths have', [...insts].every(i => ['pad', 'bass', 'kick', 'snare', 'hat', 'ohat', 'riser', 'arp', 'gtr', 'lead'].includes(i)), [...insts]);
for (const T of [...G.TRACKS.slice(1), G.BOSS_TRACK]) {
  const sig = s => JSON.stringify(T.step(s));
  const lp = T.bars - T.loop;
  check(`${T.id}: loops back to bar ${T.loop}`, sig(T.bars * 16 + 3) === sig(T.loop * 16 + 3) && sig((T.bars + lp) * 16) === sig(T.loop * 16));
  let lead = 0;
  for (let s = 0; s < T.bars * 16; s++) lead += T.step(s).filter(e => e.i === 'gtr' || e.i === 'lead').length;
  check(`${T.id}: has a lead`, lead > 20, lead);
}
check('a third above in D minor over A: A→C#', G.harmonyIn(69, [2, 4, 5, 7, 9, 10, 1]) === 73);

// the picker
const m = { L: null, dead: false, n: 0 };
check('the title screen: the title track', G.musicPick(m, null) === 'title');
const L1 = { boss: null, bossDead: false };
check('a level before its boss: the same track', G.musicPick(m, L1) === 'title');
L1.boss = {};
check('the boss in: the boss track', G.musicPick(m, L1) === 'boss');
L1.bossDead = true;
check('the boss down: the next track', G.musicPick(m, L1) === G.TRACKS[1].id);
check('…and it stays (counted once)', G.musicPick(m, L1) === G.TRACKS[1].id && G.musicPick(m, null) === G.TRACKS[1].id && m.n === 1);
for (let i = 0; i < 5; i++) { const L = { boss: {}, bossDead: false }; G.musicPick(m, L); L.bossDead = true; G.musicPick(m, L); }
check('six levels cleared: round to the title track again', G.musicPick(m, null) === 'title' && m.n === 6, m.n);
const L2 = { boss: {}, bossDead: false };
G.musicPick(m, L2); G.musicPick(m, null);
check('a level lost (back home, the boss alive): no track skipped', G.musicPick(m, null) === 'title' && m.n === 6);
check('the game asks for it', G.source.includes('Music.play(musicPick('));
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('all passed');
