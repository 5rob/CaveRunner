// @ts-check
// The title's music (v0.0.174, owner: "dark synthwave, a pumping bass with an 80s kick, a 4-chord progression, builds
// from the start until an 80s electric guitar solo lays on top as it plays harmonised arpeggios"). The pure part:
// the song as data and songStep(s), what plays on 16th-note step s. The synths that play it are audio/music.js.
//
// A minor, Am | F | Dm | E (the E major chord's G# is the dark pull back home), 100 bpm, a chord a bar.
// Bars 0–3 pads alone; 4–7 the bass comes in (its filter opening) with hats; 8 the kick, snare and the bass's pump;
// 12 the arpeggio; 16 its harmony (a chord tone above, the other side); 24–39 the guitar solo, harmonised
// (a second guitar a third above) from bar 32. After bar 39 it loops back to bar 8: the build plays once.

export const BPM = 100;
export const SONG_BARS = 40;          // bars in the song; it loops back to LOOP_BAR
export const LOOP_BAR = 8;
export const STEP_SEC = 60 / BPM / 4; // one 16th note (s)

// the chords: the root (midi) and its tones above it
export const CHORDS = [
  { name: 'Am', root: 45, tones: [0, 3, 7] },
  { name: 'F', root: 41, tones: [0, 4, 7] },
  { name: 'Dm', root: 38, tones: [0, 3, 7] },
  { name: 'E', root: 40, tones: [0, 4, 7] },
];

// The solo, four 4-bar phrases (one bar a chord), in 16ths. A note: name+octave:length, then b (bent up into it
// from a tone below) and ~ (vibrato); '-' a rest. Played SOLO_SHIFT semitones from where it's written.
export const SOLO = [
  '-:4 A4:2 C5:2 D5:4 E5:4 | G5:3 E5:1 F5:4b C5:8~ | D5:2 F5:2 A5:4 G5:2 F5:2 E5:2 D5:2 | E5:2 G#5:2 B5:12b~',
  'A5:2 C6:2 B5:2 A5:2 E5:4 A5:4b | C6:6~ A5:2 F5:4 A5:4 | D6:4b C6:2 A5:2 F5:2 A5:2 D5:4 | G#5:4 B5:4 D6:4 E6:4b',
  'E6:8b~ D6:1 C6:1 B5:1 A5:1 G5:1 E5:1 D5:1 C5:1 | A4:1 C5:1 F5:1 A5:1 C6:1 F6:1 E6:2 C6:4~ A5:4 | F5:1 A5:1 D6:1 F6:1 E6:2 D6:2 A5:4b F5:4 | B5:1 G#5:1 E5:1 G#5:1 B5:1 E6:1 G#6:2 E6:8~',
  'A6:6b~ G6:2 E6:4 C6:4 | A5:4 C6:4 F6:8~ | F6:2 E6:2 D6:2 C6:2 A5:4 F5:4 | E5:4b G#5:4 B5:8~',
];
export const SOLO_SHIFT = 0;           // (v0.0.174, owner: up an octave; was -12)
export const SOLO_BAR = 24;           // the solo's first bar
export const HARM_BAR = 32;           // the second guitar joins here

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** @param {string} nm a note's name, e.g. 'G#5' @returns {number} its midi number */
export function noteMidi(nm) {
  const m = /^([A-G])(#?)(-?\d)$/.exec(nm);
  if (!m) throw new Error('bad note ' + nm);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] ? 1 : 0);
}
/** @param {number} n midi @returns {number} Hz */
export const midiHz = n => 440 * Math.pow(2, (n - 69) / 12);

/** @typedef {{ n: number, d: number, at: number, bend: boolean, vib: boolean }} SoloNote */
// a phrase, parsed: per bar, its notes (at: the 16th in the bar it starts on)
/** @param {string} ph @returns {SoloNote[][]} */
export function parsePhrase(ph) {
  return ph.split('|').map(bar => {
    let at = 0;
    /** @type {SoloNote[]} */
    const out = [];
    for (const tok of bar.trim().split(/\s+/)) {
      const m = /^([^:]+):(\d+)(b?)(~?)$/.exec(tok);
      if (!m) throw new Error('bad token ' + tok);
      const d = Number(m[2]);
      if (m[1] !== '-') out.push({ n: noteMidi(m[1]) + SOLO_SHIFT, d, at, bend: !!m[3], vib: !!m[4] });
      at += d;
    }
    return out;
  });
}
// the solo's 16 bars, parsed once
const SOLO_BARS = SOLO.flatMap(parsePhrase);
// each bar's length in 16ths (the tests: all 16)
export const soloBarLengths = () => SOLO.flatMap(ph => ph.split('|').map(b => b.trim().split(/\s+/).reduce((a, t) => a + Number(t.split(':')[1].replace(/[b~]/g, '')), 0)));

// The second guitar: a third above in the key (A natural minor; G# over the E chord), the next note of the scale but one
/** @param {number} n midi @param {number} chord the chord's index @returns {number} */
export function harmonyOf(n, chord) {
  const scale = chord === 3 ? [9, 11, 0, 2, 4, 5, 8] : [9, 11, 0, 2, 4, 5, 7];
  const pc = ((n % 12) + 12) % 12;
  let i = scale.indexOf(pc);
  if (i < 0) i = scale.findIndex(p => p === (pc + 11) % 12);   // a note outside it: harmonise the one below
  const want = scale[(i + 2) % 7];
  let h = n + 1;
  while (((h % 12) + 12) % 12 !== want) h++;
  return h;
}

// the chord's tones as the pads voice them: each moved into midi 55..66 (close, voice-led round middle C)
/** @param {number} c the chord's index */
export const padNotes = c => CHORDS[c].tones.map(t => { let n = CHORDS[c].root + t; while (n < 55) n += 12; while (n > 66) n -= 12; return n; }).sort((a, b) => a - b);

// the arpeggio's run through the chord (indices into the pad's tones over two octaves), a bar of 16ths
const ARP = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 5, 4, 3, 2];

/** @typedef {{ i: string, n?: number, d?: number, v: number, pan?: number, bend?: boolean, vib?: boolean, open?: number, pad?: number[] }} SongEv */
// the song's bar for an ever-counting bar number (past the end it loops)
/** @param {number} b */
export const songBar = b => (b < SONG_BARS ? b : LOOP_BAR + ((b - LOOP_BAR) % (SONG_BARS - LOOP_BAR)));

// What plays on 16th step s (counting from the song's start, forever): a list of events, d in 16ths
/** @param {number} s @returns {SongEv[]} */
export function songStep(s) {
  const b = songBar(Math.floor(s / 16)), q = s % 16, c = b % 4, ch = CHORDS[c];
  /** @type {SongEv[]} */
  const E = [];
  const pads = padNotes(c);
  // pads: the chord, a bar long; darker (closed) in the intro, opening up over bars 0–7
  if (q === 0) E.push({ i: 'pad', d: 16, v: b < 4 ? 0.7 : 0.6, open: Math.min(1, 0.15 + b / 8), pad: pads });
  // the bass: 8ths on the root (an octave jump on the offbeat of beat 4), from bar 4; the pump from bar 8
  if (b >= 4 && q % 2 === 0) {
    const oct = q === 14 ? 12 : 0;
    E.push({ i: 'bass', n: ch.root - 12 + oct, d: 2, v: 0.9, open: b < 8 ? 0.25 + (b - 4) * 0.12 : 0.85 });
  }
  // drums: from bar 8 the kick on every beat, the snare on 2 and 4; hats in 8ths from bar 4, 16ths from bar 16
  const fill = (b === 15 || b === 23 || b === SONG_BARS - 1) && q >= 12;
  if (b >= 8 && q % 4 === 0 && !(fill && q > 12)) E.push({ i: 'kick', v: 1 });
  if (b >= 8 && (q === 4 || q === 12) && !fill) E.push({ i: 'snare', v: 0.9 });
  if (fill) E.push({ i: 'snare', v: 0.45 + (q - 12) * 0.15 });
  if (b >= 4 && (b >= 16 ? true : q % 2 === 0)) E.push({ i: q % 4 === 2 && b >= 8 ? 'ohat' : 'hat', v: q % 4 === 2 ? 0.7 : 0.45 });
  // a rising noise into the solo
  if (b === SOLO_BAR - 1 && q === 0) E.push({ i: 'riser', d: 16, v: 0.8 });
  // the arpeggio from bar 12, its harmony (the next chord tone up, the other side) from 16; softer under the solo
  const tones = [...pads, ...pads.map(n => n + 12)];
  const av = b >= SOLO_BAR ? 0.55 : 0.8;
  if (b >= 12) E.push({ i: 'arp', n: tones[ARP[q]] + 12, d: 1, v: av, pan: -0.45 });
  if (b >= 16) E.push({ i: 'arp', n: tones[Math.min(5, ARP[q] + 1)] + 12, d: 1, v: av * 0.8, pan: 0.45 });
  // the guitar solo (bars 24–39), a third above it from bar 32
  if (b >= SOLO_BAR && b < SOLO_BAR + SOLO_BARS.length) {
    for (const nt of SOLO_BARS[b - SOLO_BAR]) if (nt.at === q) {
      E.push({ i: 'gtr', n: nt.n, d: nt.d, v: 1, pan: -0.15, bend: nt.bend, vib: nt.vib });
      if (b >= HARM_BAR) E.push({ i: 'gtr', n: harmonyOf(nt.n, c), d: nt.d, v: 0.7, pan: 0.3, bend: nt.bend, vib: nt.vib });
    }
  }
  return E;
}
