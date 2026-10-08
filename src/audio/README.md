# audio/ — layer 4: procedural sound (Web Audio, no files)

| File | Holds |
|---|---|
| `recipes.js` | The pure part (tested): `SPELL_VOICE` (spell id → voice; trigger variants use their `base`), `shotSound(sh)` (a recipe from a shot's *final* stats: pitch from speed/size, volume from dmg×count, flags for homing, grit, pierce, bounce, pellets), `BODY_VOICE`/`CREATURE_TONE` + `creatureSound(k)`, `AMB_EVENTS`, `FX_VOL`/`fxVolKey`, `knob`, `jetPitch`, `rustleStep` |
| `sfx.js` | `SFX`, the engine: a lazy `AudioContext` made in `SFX.unlock()` (App calls it on the first pointerdown/keydown), a master compressor, two buses (sfx = `DEV.vol`, ambience = `DEV.vol × DEV.amb`), distance/pan/far-muffle round `SFX.ear`, the one-shot table `FX` (`SFX.fx(name, x, y, a)`, per-name gaps `FX_GAP`, `SFX.FX_NAMES`), loops, `setAmbience(themeName)` |

| `song.js` | The title's music as data (pure, tested by `song`): A minor, Am F Dm E, 100 bpm; `songStep(s)` = what plays on 16th step s (pads, bass, kick, snare, hats, riser, arps, guitar); the solo in `SOLO` (note:16ths, `b` bend, `~` vibrato); `harmonyOf` (the second guitar, a third above); loops bars 8–39 |
| `music.js` | The synths that play it: `makeMusic(ac, dest)` (any context: tools/musicwav.js renders it offline to a .wav/.m4a), and `Music` (start/stop, live on `SFX.musicOut`, the Music slider; the title starts it, `ui/titlesound.js`) |

The per-theme ambience table `AMBIENCE` is `data/themes.js`. Calls into `SFX` are one-liners at
the events in `game/` (`SFX.cast` in `cast`/`releaseAt`, `SFX.boom` in `explode`, `SFX.creature(k,
'alert' | 'idle' | 'fire' | 'charge' | 'hurt' | 'die' | 'bite' | 'fuse')`, `SFX.ui(…)`, `SFX.fx(…)`).

## Rules

- **Sound must never break the game.** Every public call is wrapped by `safe()`: an error goes to
  `SFX.stats.errors` and is swallowed. The tests assert that list stays empty.
- **Repeated sounds are randomised per play** (the owner's rule), not one fixed recipe: rustles,
  pops, debris, explosions and every `FX` recipe roll their pitch/timing/length each call.
- **Loops fade unless `set()` every frame.** `SFX.tick()` runs every frame, even paused, and fades
  any loop nobody set — that's how pause and dead Black Holes go quiet. The Game keeps `W.jetLoop`
  and `W.bhLoops` (bullet → loop, max 3), plus the `'portal'`, `'matter'` and `'fire'` loops.
  Ambience starts in `tick()` once unlocking finishes (resume is async).
- **The player's volume** (LIST4 #3, the pause menu's slider): `SFX.setVolume(v)` (0..1) sets the
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
- **Writing music:** change `song.js` (a bar of the solo must add up to 16), listen with `node tools/musicwav.js`.
- Tests: `tests/logic/sound.test.js`, `tests/logic/song.test.js`, `tests/browser/sound.test.js` (plays every voice and every
  `FX_NAMES` entry, the Black Hole loop's lifecycle).
