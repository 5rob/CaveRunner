// @ts-check
// Every track (v1.0.94, owner: "5 more tracks in a similar style and theme, but change up the mood and tempo for each
// so we have a range. Some chill, some moody, some exciting, some suspenseful, some happy. Also a boss fight song that
// plays during all boss fights. For each level cleared, cycle through the 6 normal music tracks"). The pure part.
// The title's track is audio/song.js (written out by hand); the others are recipes here (makeTrack): chords a bar each,
// drum and bass patterns, an arpeggio, and a lead written like the title's solo (note:16ths, b bend, ~ vibrato).
// The same instruments play them all (audio/music.js), so they sound like one game.

import { BPM, LOOP_BAR, SONG_BARS, parsePhrase, songStep } from './song.js';

/** @typedef {{ id: string, name: string, mood: string, bpm: number, bars: number, loop: number, step: (s: number) => import('./song.js').SongEv[] }} Track */
/** @typedef {{ from: number, pat: string, v?: number }} Beat */
/**
 * @typedef {{
 *   id: string, name: string, mood: string, bpm: number, bars: number, loop: number,
 *   chords: { root: number, tones: number[] }[], scale: number[], scales?: Record<number, number[]>,
 *   pad: { from: number, v: number, open: number[] },
 *   bass: Beat & { open: number, len?: number },
 *   kick?: Beat, snare?: Beat, hat?: Beat, hat2?: Beat,
 *   arp?: { from: number, pat: (number | null)[], v: number, soft?: boolean, oct?: number },
 *   arp2?: { from: number },
 *   lead?: { from: number, inst: string, phrases: string[], harm?: number, drive?: number, tone?: number, pan?: number },
 *   fills?: number[], risers?: number[],
 * }} TrackSpec
 */

// the chord's tones as the pads voice them: each moved into midi 55..66 (close, voice-led round middle C)
/** @param {{ root: number, tones: number[] }} ch */
export const voiced = ch => ch.tones.map(t => { let n = ch.root + t; while (n < 55) n += 12; while (n > 66) n -= 12; return n; }).sort((a, b) => a - b);

// a third above n in the scale (its pitch classes in rising order from the key note), like the title's second guitar
/** @param {number} n midi @param {number[]} scale @returns {number} */
export function harmonyIn(n, scale) {
  const pc = ((n % 12) + 12) % 12;
  let i = scale.indexOf(pc);
  if (i < 0) i = scale.findIndex(p => p === (pc + 11) % 12);
  const want = scale[(i + 2) % scale.length];
  let h = n + 1;
  while (((h % 12) + 12) % 12 !== want) h++;
  return h;
}

// A recipe → its track. Patterns are a bar of 16 characters: drums x (a hit), g (a soft one), X (an accent), o (an
// open hat), . nothing; the bass r (the root), o (an octave up), 5 (the fifth), each held to the next (at most len).
/** @param {TrackSpec} T @returns {Track} */
export function makeTrack(T) {
  const lead = T.lead ? T.lead.phrases.flatMap(parsePhrase) : [];
  /** @param {Beat | undefined} B @param {number} b @param {number} q */
  const hit = (B, b, q) => (B && b >= B.from ? B.pat[q] : '.');
  const songBar = (/** @type {number} */ b) => (b < T.bars ? b : T.loop + ((b - T.loop) % (T.bars - T.loop)));
  /** @param {number} s */
  const step = s => {
    const b = songBar(Math.floor(s / 16)), q = s % 16, c = b % T.chords.length, ch = T.chords[c];
    /** @type {import('./song.js').SongEv[]} */
    const E = [];
    const pads = voiced(ch), scale = (T.scales && T.scales[c]) || T.scale;
    const [o0, o1, ob] = T.pad.open;
    if (q === 0 && b >= T.pad.from) E.push({ i: 'pad', d: 16, v: T.pad.v, open: Math.min(o1, o0 + (o1 - o0) * b / ob), pad: pads });
    const bk = hit(T.bass, b, q);
    if (bk !== '.') {
      let d = 1;
      while (q + d < 16 && T.bass.pat[q + d] === '.' && d < (T.bass.len || 16)) d++;
      E.push({ i: 'bass', n: ch.root - 12 + (bk === 'o' ? 12 : bk === '5' ? 7 : 0), d, v: T.bass.v || 0.9, open: T.bass.open });
    }
    const fill = (T.fills || []).includes(b) && q >= 12;
    const k = hit(T.kick, b, q);
    if (k !== '.' && !(fill && q > 12)) E.push({ i: 'kick', v: (k === 'g' ? 0.6 : 1) * ((T.kick && T.kick.v) || 1) });
    const sn = hit(T.snare, b, q);
    if (fill) E.push({ i: 'snare', v: 0.45 + (q - 12) * 0.15 });
    else if (sn !== '.') E.push({ i: 'snare', v: (sn === 'g' ? 0.35 : 0.9) * ((T.snare && T.snare.v) || 1) });
    for (const H of [T.hat, T.hat2]) {
      const h = hit(H, b, q);
      if (h === '.' || !H) continue;
      if (H === T.hat && T.hat2 && b >= T.hat2.from) continue;       // the second pattern takes over from its bar
      E.push({ i: h === 'o' ? 'ohat' : 'hat', v: (h === 'x' ? 0.45 : 0.7) * (H.v || 1) });
    }
    if ((T.risers || []).includes(b) && q === 0) E.push({ i: 'riser', d: 16, v: 0.8 });
    const tones = [...pads, ...pads.map(n => n + 12)];
    const A = T.arp, L = T.lead;
    const ap = A && b >= A.from ? A.pat[q] : null;
    if (A && ap != null) {
      const ix = ap % tones.length, oc = A.oct ?? 12;
      const av = A.v * (L && b >= L.from ? 0.7 : 1);
      E.push({ i: 'arp', n: tones[ix] + oc, d: 1, v: av, pan: -0.45, soft: A.soft });
      if (T.arp2 && b >= T.arp2.from) E.push({ i: 'arp', n: tones[Math.min(tones.length - 1, ix + 1)] + oc, d: 1, v: av * 0.8, pan: 0.45, soft: A.soft });
    }
    if (L && b >= L.from && b < L.from + lead.length) {
      for (const nt of lead[b - L.from]) if (nt.at === q) {
        const ev = { i: L.inst, n: nt.n, d: nt.d, v: 1, pan: L.pan ?? -0.15, bend: nt.bend, vib: nt.vib, drive: L.drive, tone: L.tone };
        E.push(ev);
        if (L.harm != null && b >= L.harm) E.push({ ...ev, n: harmonyIn(nt.n, scale), v: 0.7, pan: 0.3 });
      }
    }
    return E;
  };
  return { id: T.id, name: T.name, mood: T.mood, bpm: T.bpm, bars: T.bars, loop: T.loop, step };
}

/** @param {number} root @param {number[]} tones */
const ch = (root, tones) => ({ root, tones });
const MAJ = [0, 4, 7], MIN = [0, 3, 7];
// keys as pitch classes rising from the key note (harmonyIn)
const A_MIN = [9, 11, 0, 2, 4, 5, 7], E_MIN = [4, 6, 7, 9, 11, 0, 2], FS_MIN = [6, 8, 9, 11, 1, 2, 4];
const C_MIN = [0, 2, 3, 5, 7, 8, 11], D_MAJ = [2, 4, 6, 7, 9, 11, 1], D_MIN = [2, 4, 5, 7, 9, 10, 0];

/** @type {TrackSpec[]} */
const SPECS = [
  { // chill: slow, soft, clean guitar; half-time drums
    id: 'glowworm', name: 'Glowworm', mood: 'chill', bpm: 80, bars: 32, loop: 8,
    chords: [ch(41, [0, 4, 7, 11]), ch(40, [0, 3, 7, 10]), ch(38, [0, 3, 7, 10]), ch(36, [0, 4, 7, 11])],   // Fmaj7 Em7 Dm7 Cmaj7
    scale: A_MIN,
    pad: { from: 0, v: 0.65, open: [0.1, 0.55, 8] },
    bass: { from: 8, pat: 'r.......r.....5.', open: 0.15, v: 0.8 },
    kick: { from: 8, pat: 'x.........g.....', v: 0.7 },
    snare: { from: 8, pat: '........x.......', v: 0.55 },
    hat: { from: 8, pat: '..x...x...x...x.', v: 0.7 },
    arp: { from: 4, pat: [0, null, 2, null, 4, null, 3, null, 5, null, 4, null, 2, null, 1, null], v: 0.75, soft: true },
    lead: { from: 16, inst: 'gtr', drive: 5, harm: 24, phrases: [
      'A4:6 C5:2 E5:8~ | D5:4 B4:4 G4:8~ | F4:2 A4:2 C5:4 D5:4 F5:4 | E5:12~ -:4',
      'E5:2 F5:2 A5:4 C6:8~ | B5:4 G5:4 E5:4 D5:4 | F5:6 E5:2 D5:4 A4:4 | D5:2 E5:2 G4:4 C5:8~',
      'A4:6 C5:2 E5:8~ | D5:4 B4:4 G4:8~ | F4:2 A4:2 C5:4 D5:4 F5:4 | E5:12~ -:4',
      'E5:2 F5:2 A5:4 C6:8~ | B5:4 G5:4 E5:4 D5:4 | F5:6 E5:2 D5:4 A4:4 | D5:2 E5:2 G4:4 C5:8~',
    ] },
    fills: [15, 31], risers: [],
  },
  { // exciting: fast, four on the floor, a galloping bass, the guitar early
    id: 'afterburner', name: 'Afterburner', mood: 'exciting', bpm: 128, bars: 28, loop: 4,
    chords: [ch(42, MIN), ch(38, MAJ), ch(45, MAJ), ch(40, MAJ)],     // F#m D A E
    scale: FS_MIN,
    pad: { from: 0, v: 0.55, open: [0.3, 0.9, 4] },
    bass: { from: 0, pat: 'r.rrr.rrr.rrr.ro', open: 0.8, len: 2 },
    kick: { from: 2, pat: 'x...x...x...x...' },
    snare: { from: 4, pat: '....x.......x...' },
    hat: { from: 0, pat: 'x.o.x.o.x.o.x.o.' },
    hat2: { from: 4, pat: 'xxoxxxoxxxoxxxox' },
    arp: { from: 4, pat: [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2], v: 0.75 },
    arp2: { from: 8 },
    lead: { from: 12, inst: 'gtr', harm: 20, phrases: [
      'F#5:2 A5:2 C#6:2 A5:2 F#5:2 A5:2 C#6:4 | D6:6b A5:2 F#5:4 D5:4 | E5:2 A5:2 C#6:2 E6:2 C#6:4 A5:4 | B5:2 G#5:2 E5:2 G#5:2 B5:8b~',
      'C#6:4b E6:4 F#6:4 E6:2 C#6:2 | D6:4 C#6:2 B5:2 A5:4 F#5:4 | A5:2 C#6:2 E6:4b C#6:4 A5:4 | G#5:2 B5:2 E6:2 G#6:2 F#6:2 E6:2 B5:4',
      'F#6:1 E6:1 C#6:1 A5:1 F#6:1 E6:1 C#6:1 A5:1 F#6:4b~ E6:4 | D6:1 C#6:1 A5:1 F#5:1 D6:1 C#6:1 A5:1 F#5:1 A5:8~ | E5:1 A5:1 C#6:1 E6:1 A6:4b E6:2 C#6:2 A5:4 | G#5:1 B5:1 E6:1 G#6:1 B6:4b~ G#6:4 E6:4',
      'A6:4b F#6:4 C#6:4 A5:4 | F#6:6~ E6:2 D6:4 A5:4 | C#6:4 E6:4 A6:8~ | G#6:4b E6:4 B5:4 G#5:4',
    ] },
    fills: [3, 11, 19, 27], risers: [11],
  },
  { // moody: dark, half-time, a slow bending guitar
    id: 'undertow', name: 'Undertow', mood: 'moody', bpm: 92, bars: 32, loop: 8,
    chords: [ch(40, MIN), ch(36, [0, 4, 7, 11]), ch(45, MIN), ch(47, MAJ)],   // Em Cmaj7 Am B
    scale: E_MIN, scales: { 3: [4, 6, 7, 9, 11, 0, 3] },
    pad: { from: 0, v: 0.7, open: [0.1, 0.6, 8] },
    bass: { from: 4, pat: 'r.r.r.r.r.r.r.ro', open: 0.35 },
    kick: { from: 8, pat: 'x.....x...x.....' },
    snare: { from: 8, pat: '........x.......' },
    hat: { from: 4, pat: 'x.x.x.x.x.x.x.x.', v: 0.8 },
    arp: { from: 12, pat: [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 1, 4, 3, 2, 1], v: 0.6 },
    lead: { from: 16, inst: 'gtr', harm: 24, phrases: [
      '-:2 B4:2 E5:4 G5:4 F#5:2 E5:2 | G5:6b E5:2 B4:8~ | C5:2 E5:2 A5:4 G5:2 E5:2 C5:4 | D#5:4 F#5:4 B5:8b~',
      'B5:4 A5:2 G5:2 F#5:4 E5:4 | G5:2 F#5:2 E5:4 B4:8~ | A4:2 C5:2 E5:2 A5:2 C6:4b B5:4 | F#5:8~ D#5:4 B4:4',
      'E6:8b~ D6:2 B5:2 G5:2 E5:2 | G5:2 B5:2 E6:4 D6:4 B5:4 | C6:6~ B5:2 A5:4 E5:4 | F#5:2 A5:2 B5:4 D#6:8~',
      'E6:4 B5:4 G5:4 E5:4 | E5:2 G5:2 B5:4 G5:8~ | A5:4 G5:4 E5:4 C5:4 | B4:12b~ -:4',
    ] },
    fills: [15, 23, 31], risers: [15],
  },
  { // happy: major key, bright and bouncy, a synth lead
    id: 'surface', name: 'Surface Light', mood: 'happy', bpm: 116, bars: 32, loop: 8,
    chords: [ch(38, MAJ), ch(45, MAJ), ch(47, MIN), ch(43, MAJ)],     // D A Bm G
    scale: D_MAJ,
    pad: { from: 0, v: 0.6, open: [0.4, 0.95, 8] },
    bass: { from: 4, pat: 'r.o.r.o.r.o.r.o.', open: 0.6 },
    kick: { from: 8, pat: 'x...x...x...x...' },
    snare: { from: 8, pat: '....x.......x..g' },
    hat: { from: 4, pat: '..x...x...x...x.' },
    hat2: { from: 16, pat: 'x.o.x.o.x.o.x.ox' },
    arp: { from: 0, pat: [0, 2, 4, 2, 1, 3, 5, 3, 0, 2, 4, 2, 5, 4, 3, 2], v: 0.7 },
    arp2: { from: 12 },
    lead: { from: 16, inst: 'lead', tone: 1, harm: 24, phrases: [
      'F#5:2 A5:2 D6:4 C#6:2 A5:2 F#5:4 | E5:2 A5:2 C#6:4 E6:4 C#6:4 | D6:4 B5:4 F#5:2 B5:2 D6:4 | B5:4 A5:4 G5:2 A5:2 B5:4',
      'A5:6b~ F#5:2 D5:4 F#5:4 | E5:4 A5:4 C#6:8~ | B5:2 C#6:2 D6:4 F#6:4 E6:4 | D6:4 B5:4 G5:4 A5:4',
      'D6:2 E6:2 F#6:4b A6:8~ | G6:2 F#6:2 E6:4 C#6:4 A5:4 | B5:2 D6:2 F#6:4 E6:2 D6:2 B5:4 | G5:2 B5:2 D6:4 E6:4b D6:4',
      'F#6:4 E6:4 D6:4 A5:4 | C#6:4b E6:4 A6:8~ | F#6:4 D6:4 B5:4 F#5:4 | G5:4 A5:4 B5:2 C#6:2 A5:4',
    ] },
    fills: [15, 23, 31], risers: [15],
  },
  { // suspenseful: a pulse on one note, a heartbeat kick, a ticking hat, a slow dark synth line
    id: 'below', name: 'Something Below', mood: 'suspense', bpm: 104, bars: 32, loop: 4,
    chords: [ch(36, MIN), ch(36, MIN), ch(37, MAJ), ch(43, MAJ)],     // Cm Cm Db G
    scale: C_MIN,
    pad: { from: 0, v: 0.65, open: [0.05, 0.4, 16] },
    bass: { from: 0, pat: 'rrrrrrrrrrrrrrrr', open: 0.12, v: 0.75 },
    kick: { from: 4, pat: 'x..x............', v: 0.85 },
    snare: { from: 16, pat: '............g...' },
    hat: { from: 4, pat: 'x...x...x...x...', v: 0.9 },
    hat2: { from: 16, pat: 'x.x.x.x.x.x.x.x.' },
    arp: { from: 8, pat: [5, null, null, null, null, null, 4, null, null, null, null, null, 5, null, 3, null], v: 0.7, soft: true },
    lead: { from: 16, inst: 'lead', tone: 0.3, phrases: [
      'G5:16~ | Ab5:8~ G5:8 | F5:12~ Ab5:4 | G5:8~ B4:8~',
      'C6:8~ Eb6:8 | D6:4 C6:4 B5:8~ | Ab5:8~ F5:8 | G5:16b~',
      'Eb5:4 G5:4 C6:4 Eb6:4 | D6:12~ C6:4 | Db6:8~ C6:4 Ab5:4 | B5:8~ D6:8~',
      'G6:16b~ | F6:4 Eb6:4 D6:4 C6:4 | Db6:8 F5:8 | G5:8~ B5:8',
    ] },
    fills: [], risers: [15, 31],
  },
];

// the boss fight (owner: "exciting and energetic, but keep to the established theme"): fast, a driving bass, the
// guitar in at once, harmonised on the way round
/** @type {TrackSpec} */
const BOSS_SPEC = {
  id: 'boss', name: 'Colossus', mood: 'boss', bpm: 150, bars: 20, loop: 4,
  chords: [ch(38, MIN), ch(46, MAJ), ch(36, MAJ), ch(45, MAJ)],       // Dm Bb C A
  scale: D_MIN, scales: { 3: [2, 4, 5, 7, 9, 10, 1] },
  pad: { from: 0, v: 0.55, open: [0.6, 1, 2] },
  bass: { from: 0, pat: 'rrrrrrrrrrrrrror', open: 0.9, len: 1 },
  kick: { from: 0, pat: 'x...x..xx...x.x.' },
  snare: { from: 2, pat: '....x.......x...' },
  hat: { from: 1, pat: 'xxoxxxoxxxoxxxox' },
  arp: { from: 2, pat: [0, 2, 4, 2, 0, 2, 4, 5, 0, 2, 4, 2, 5, 4, 2, 1], v: 0.7 },
  arp2: { from: 12 },
  lead: { from: 4, inst: 'gtr', harm: 12, phrases: [
    'D5:2 D5:1 F5:1 A5:2 D6:2 C6:2 A5:2 F5:2 A5:2 | Bb5:4b F5:2 D5:2 F5:2 Bb5:2 A5:2 F5:2 | G5:2 C6:2 E6:2 G6:2 E6:2 C6:2 G5:4 | A5:4b C#6:4 E6:4 A6:4',
    'A6:6b~ F6:2 D6:4 A5:4 | Bb5:2 D6:2 F6:4 D6:2 Bb5:2 F5:4 | E6:4b G6:4 E6:2 C6:2 G5:4 | A5:2 C#6:2 E6:2 G6:2 A6:8b~',
    'D6:1 C6:1 A5:1 F5:1 D6:1 C6:1 A5:1 F5:1 D6:1 F6:1 A6:1 F6:1 A6:4b | Bb6:2 A6:2 F6:2 D6:2 Bb5:2 D6:2 F6:4 | G6:1 F6:1 E6:1 C6:1 G6:1 F6:1 E6:1 C6:1 E6:8b~ | C#6:1 E6:1 A6:1 C#6:1 E6:1 A6:1 G6:2 A6:8~',
    'F6:4b E6:2 D6:2 A5:4 D6:4 | F6:4 D6:4 Bb5:4 F5:4 | E5:2 G5:2 C6:2 E6:2 G6:4b E6:4 | C#6:4 E6:4 A6:4b G6:4',
  ] },
  fills: [3, 11, 19], risers: [3],
};

/** the title's own track (audio/song.js) @type {Track} */
export const TITLE_TRACK = { id: 'title', name: 'Descent', mood: 'dark', bpm: BPM, bars: SONG_BARS, loop: LOOP_BAR, step: songStep };
/** the six the game cycles through, a level cleared each (the title's first) @type {Track[]} */
export const TRACKS = [TITLE_TRACK, ...SPECS.map(makeTrack)];
/** every boss fight @type {Track} */
export const BOSS_TRACK = makeTrack(BOSS_SPEC);
/** @param {string} id @returns {Track} */
export const trackById = id => (id === 'boss' ? BOSS_TRACK : TRACKS.find(t => t.id === id) || TITLE_TRACK);

// Which track plays (v1.0.94): the boss's while one is alive in a level; else the six in turn, the next one each time a
// level's boss goes down. m: the picker's memory (the level it last saw, whether its boss was down, levels cleared).
/** @typedef {{ L: object | null, dead: boolean, n: number }} MusicMemory */
/** @param {MusicMemory} m @param {{ boss?: object | null, bossDead?: boolean } | null} L the level's state (auto/level.js levelState), null off a level */
export function musicPick(m, L) {
  const dead = !!(L && L.bossDead);
  if (L && dead && !(L === m.L && m.dead)) m.n++;
  m.L = L; m.dead = dead;
  return L && L.boss && !dead ? BOSS_TRACK.id : TRACKS[m.n % TRACKS.length].id;
}

// ---- kept for the test suites (grem branch: the game no longer calls these; the suites set up with them) ----
/** each recipe's lead, bar by bar, in 16ths (the tests: every bar 16) @returns {Record<string, number[]>} */
export const leadBarLengths = () => Object.fromEntries([...SPECS, BOSS_SPEC].map(T => [T.id, (T.lead ? T.lead.phrases : []).flatMap(ph => ph.split('|'))
  .map(bar => bar.trim().split(/\s+/).reduce((a, t) => a + Number(t.split(':')[1].replace(/[b~]/g, '')), 0))]));
/** each recipe's patterns are a bar long @returns {string[]} the ones that aren't */
export const badPatterns = () => [...SPECS, BOSS_SPEC].flatMap(T => [T.bass, T.kick, T.snare, T.hat, T.hat2].filter(B => B && B.pat.length !== 16).map(B => T.id + ' ' + (B && B.pat)))
  .concat([...SPECS, BOSS_SPEC].filter(T => T.arp && T.arp.pat.length !== 16).map(T => T.id + ' arp'));
