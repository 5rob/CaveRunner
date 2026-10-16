# audio/ — layer 4: procedural sound (Web Audio, no files)

| File | Holds |
|---|---|
| `recipes.js` | The pure part (tested): `SPELL_VOICE` (spell id → voice; trigger variants use their `base`), `shotSound(sh)` (a recipe from a shot's *final* stats: pitch from speed/size, volume from dmg×count, flags for homing, grit, pierce, bounce, pellets), `BODY_VOICE`/`CREATURE_TONE` + `creatureSound(k)`, `AMB_EVENTS`, `FX_VOL`/`fxVolKey`, `knob`, `jetPitch`, `rustleStep` |
| `sfx.js` | `SFX`, the engine: a lazy `AudioContext` made in `SFX.unlock()` (App calls it on the first pointerdown/keydown), a master compressor, two buses (sfx = `DEV.vol`, ambience = `DEV.vol × DEV.amb`), distance/pan/far-muffle round `SFX.ear`, the one-shot table `FX` (`SFX.fx(name, x, y, a)`, per-name gaps `FX_GAP`, `SFX.FX_NAMES`), loops, `setAmbience(themeName)` |

| `song.js` | The title's music as data (pure, tested by `song`): A minor, Am F Dm E, 100 bpm; `songStep(s)` = what plays on 16th step s (pads, bass, kick, snare, hats, riser, arps, guitar); the solo in `SOLO` (note:16ths, `b` bend, `~` vibrato); `harmonyOf` (the second guitar, a third above); loops bars 8–39 |
| `songs.js` | Every track (v1.0.94), pure, tested by `songs`: `TRACKS` (six, cycled one a level cleared: Descent = the title's song.js, Glowworm chill 80 bpm, Afterburner exciting 128, Undertow moody 92, Surface Light happy 116, Something Below suspense 104), `BOSS_TRACK` (Colossus, 150 bpm, every boss fight), `trackById`. The five new ones are recipes (`TrackSpec`) built by `makeTrack`: chords a bar each, 16-character drum/bass patterns, an arpeggio, a lead in the solo's notation (flats too: `Bb5`), harmonised a third up (`harmonyIn`) from a bar. `musicPick(memory, levelState)`: the boss's track while a boss is alive, else `TRACKS[cleared % 6]` |
| `music.js` | The synths that play them: `makeMusic(ac, dest, track)` (any context: tools/musicwav.js renders it offline), instruments pad, bass, kick, snare, hat, ohat, riser, arp (`soft`: triangles), gtr (`drive`: low = cleaner), lead (a synth lead, `tone` 0 dark..1 bright); and `Music` live on `SFX.musicOut` (the Music slider): `Music.play(id)` crossfades to a track (the same one: nothing), `start`/`stop`. `ui/titlesound.js` asks every frame: `Music.play(musicPick(…))` (title, hub, levels, Grem) |

The per-theme ambience table `AMBIENCE` is `data/themes.js`. Calls into `SFX` are one-liners at
the events in `game/` (`SFX.cast` in `cast`/`releaseAt`, `SFX.boom` in `explode`, `SFX.creature(k,
'alert' | 'idle' | 'fire' | 'charge' | 'hurt' | 'die' | 'bite' | 'fuse')`, `SFX.ui(what, vol?)` (vol scales it: the title's gold is 0.1), `SFX.fx(…)`).

## Rules

- **Sound must never break the game.** Every public call is wrapped by `safe()`: an error goes to
  `SFX.stats.errors` and is swallowed. The tests assert that list stays empty.
- **Repeated sounds are randomised per play** (the owner's rule), not one fixed recipe: rustles,
  pops, debris, explosions and every `FX` recipe roll their pitch/timing/length each call.
- **Loops fade unless `set()` every frame.** `SFX.tick()` runs every frame, even paused, and fades
  any loop nobody set — that's how pause and dead Black Holes go quiet. The Game keeps `W.jetLoop`
  and `W.bhLoops` (bullet → loop, max 3), plus the `'portal'`, `'matter'` and `'fire'` loops.
  Ambience starts in `tick()` once unlocking finishes (resume is async).
- **The player's volume** (LIST4 #3; the Master slider of `ui/volume.js`, in the pause menu and the title's Settings): `SFX.setVolume(v)` (0..1) sets the
  `master` gain and keeps it in localStorage `VOL_KEY` (`caverunner-volume`, shared by the save slots);
  `SFX.volume` reads it; it is read when the module loads and applied when the context is made.
- **Volume knobs** (Dev → Sound): `vol`, `amb`, `jetVol`, `vSpell`, `vBoom`, `vHit`, `vEnemyFire`,
  `vEnemy`, `vWorld`, `vDrip`, `vStep`, `vUi`. Each one-shot passes `knob(key)` as `out()`'s volume;
  loops pick theirs by kind. `fxVolKey(name)` maps an `SFX.fx` name through `FX_VOL` (default
  `vWorld`): **a new fx sound that isn't world/props needs an `FX_VOL` entry.**
- `out()` drops sounds past `HEAR` or over `MAX_VOICES`; your own casts and UI sounds have priority.
- **A new spell needs a `SPELL_VOICE` entry** (the logic suite fails otherwise). A new creature
  falls back to its body's voice. A new theme needs an `AMBIENCE` entry (tested).
- **Rustle anti-spam:** `rustleStep(st, dt, touching, entered, speed)` — entering a plant or
  grabbing rustles at once, moving inside every `(0.42 − 0.24·speed)·rand` s, standing still is
  silent, and every rustle starts a random pause (≥0.16s), so a clump can't machine-gun.
- **Volumes (v0.0.174):** Master (`setVolume`), FX (`setFxVolume`: the sfx and ambience buses) and Music (`setMusicVolume`: the music bus), each in localStorage (`VOL_KEY`, `FXVOL_KEY`, `MUSVOL_KEY`); the title's ⚙ settings.
- **Writing music:** the title's is `song.js` (a bar of the solo must add up to 16); the others are recipes in `songs.js` (a new one: a `SPECS` entry with its own `id`, mood and tempo; every pattern 16 characters, every lead bar 16 sixteenths, notes in the scale you give for its harmony). Listen with `node tools/musicwav.js <id>` or `all` (→ tests/build/music-<id>.wav + .mp3 with ffmpeg). A new instrument: a function in `makeMusic`'s `I`, and its name in the `songs` suite's list.
- **Which track:** the boss's from the moment the boss appears until it's down; then the next of the six (the count is per session, it starts at the title's). A level lost doesn't move it on.
- Tests: `tests/logic/sound.test.js`, `tests/logic/song.test.js`, `tests/logic/songs.test.js`, `tests/browser/sound.test.js` (plays every voice and every
  `FX_NAMES` entry, the Black Hole loop's lifecycle).
