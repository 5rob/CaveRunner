# game/render/ — one frame of the picture

`draw(W, G)` (in `draw.js`) makes the frame object `F` and calls its parts back to front, each
`(W, G, F)`. The death replay runs the same `draw()` with a recorded moment swapped into `W`.

| File | Holds |
|---|---|
| `draw.js` | `draw` and `drawCamera` (fills the view `dpr`, `playPx`, `vw`/`vh` and `pcx`/`pcy`; eases the camera) |
| `light.js` (more) | `drawFog` also bakes the fog of war alone (`fogWarC`: never-seen ground, none of the torchlight's dark); where the hologram shows (`holoMask`, on the hologram's pixel grid, `holoGrid`) the fog drawn is that one, so the hologram is darkened only by the fog of war. `blurSlab` blurs both. Climbing props (`k === 'climb'`) and spider silk over the hologram are silhouettes (`holoSil`): full fog ×3, and cut from the bloom |
| `fx.js` | The FX layer, over the finished picture: `drawFx` (the hologram's bloom: `holoMask` into a `holoGrid`-size buffer, rock/decoration/shop wall/fog/below-the-floor cut out, blurred + brightened, added with `lighter`; Dev knobs `bloom`, `bloomBlur`, `bloomBright`), `drawBelow` (black below the level, `WH`) |
| `holo.js` | the hologram, made once a frame into its own layer at `DEV.holoPx` world units a pixel (default 2, the rock's), on a grid that rides with it (`holoGrid`: its fog swap and bloom use it too), scaled up crisp, and not made at all while `holoBright()` is 0 (it rests at `DEV.holoMin`, 0, and `holoLevel` flashes it to `holoMax` on a kill, fading over `holoFade` s along the Dev curve) (static from `W.time` hashes; `holoGlitch` when the number changes), then `drawHolo` (the slanted "biological entities detected" tiles, count from `bioCount`; parallax `HOLO_PAR`, halfway between the background's `BG_PAR` and the rock), called by `drawTerrain` right after the background |
| `cave.js` | `drawTerrain` (background with `BG_PAR`, the shop wall with the floor number, rock, burning pixels), `drawProps` (fills `TH`, `onView`; props, drips, ambience), `drawPortal`, `drawArrival`, `drawShop`, `drawVend`, `drawLoot` (gold, guns, mods), `drawRooms` |
| `vend.js` | `drawVend` (the two level vending machines, after `drawShop`: cabinet, and a screen cached per text + hue with its glow baked in; flicker-in on, CRT squeeze off) and `drawWarp` (the teleport's flash, sweep and bolts, after `drawGlows`), `drawRepo` (after it: the repossession's grates, red lights, fire jets); `holo.js` `drawHoloShop` puts REPOSSESSED on the shop wall |
| `shops.js` | `drawShops` (after `drawVend`): each `SHOPS` machine's cabinet, its chute, and its icon as a flickering hologram (the emoji washed in the hue, scan lines, glow; cached per icon + hue) |
| `effects.js` | `drawSmoke`, `drawTrail`, `drawSparks`, `drawMotes`, `drawFlashes` |
| `actors.js` | `drawEnemies`, `drawJetFlame`, `drawAim` (fills `held`, `ax`/`ay`, `gy`; the Trajectory Sight line), `drawPlayer` (runner, gun, torch, crosshair, shield, ghost) |
| `looks.js` | `drawFields`, `drawShots`, `drawBeams`, and the looks: `drawLook` (a shot's sprite), `drawFieldLook`, `drawBolt` (a lightning line) |
| `light.js` | `drawFog` (line of sight, `fogReveal`, the fog bake and blur), `drawGlows` (every light over the fog, `fogLit`-gated, drawn into a rock-pixel layer and added in one go, crisp or smooth by `DEV.pixelFx`; glowing particles go straight on; then the sconces) |
| `overlay.js` (screen space) | `drawHud` (the version; publishes `input.current.hud`), `drawRadar`, `drawMessages`, `drawReticule`, `drawMap` |

The order in `draw`: `drawCamera`, `drawTerrain`, `drawProps`, `drawPortal`, `drawSmoke`,
`drawFields`, `drawSilk` (`game/creatures/spider.js`), `drawEnemies`, `drawShots`, `drawBeams`,
`drawArrival`, `drawShop`, `drawLoot`, `drawRooms`, `drawTrail`, `drawSparks`, `drawMotes`,
`drawFlashes`, `drawJetFlame`, `drawAim`, `drawPlayer`, `drawFog`, `drawGlows`, `drawWarp`, `drawRepo`, `drawFx`, `drawBelow`, then
`if (G.RPV) return;` (a replay has no HUD), `drawHud`, `drawRadar`, `drawMessages`, `drawReticule`,
`drawMap`.

## Rules

- **The order is fixed**: draw writes the fog memory (`drawFog`), moves the camera (`drawCamera`)
  and draws from the simulation's `Math.random` stream (the looks, the jet flame, the beams).
- **Before the fog vs after it:** anything that must not give away unseen ground (terrain,
  burning pixels, props, creatures) is drawn before `drawFog`; lights and glows after it, only where
  `fogLit` says the ground is seen. The fog and lamp rules are in `world/README.md`.
- **The camera frames the play area above the controls**: `playPx = c.height − ctlH·dpr` (App
  measures `input.current.ctlH`); the whole canvas is still drawn. Toasts and radar markers use
  `playPx` too. `DEV.zoom` scales it all.
- **The camera eases by time, never per frame** (`W.camT`: 15% per 60th of a second). Per frame, a
  phone's uneven frames jittered you against the screen in fast flight (v113, the `camera` suite).
  You are drawn nudged by `F.snapX`/`snapY` (under a pixel) so the world's pixel rounding doesn't
  hop you either: anything drawn as part of you goes between that translate and its undo in `draw`.
- **The HUD lives on the thumbsticks** (`ui/README.md`). `drawHud` writes
  `input.current.hud = { hp, low, fuel, empty, mana, rech, cast, recharging, hasGun }` (0–1) every
  frame: `rech = 1 − rechT/(effRecharge·W.pb.rech)`, `cast = 1 − delayT/delayMax` (`delayMax` is set in
  `cast` when the delay starts). Only the version is drawn on the canvas. The floor number is painted
  big across the shop's back wall (`rgba(255,255,255,0.07)`).
- **The aim line** draws only with Trajectory Sight (`W.pb.trajectory`), and fades in with the right
  stick's push (`vis = min(1, mag/AIM_DEAD)`; mouse/keys = 1). **The crosshair** is always on: a `+`
  with its centre cut out, `DEV.aimDist` out along the aim, arms 1.25 → 3 world units, ~1.5 css px thick.
- **Shots:** `drawLook(b)` draws a shot's own look and returns false to fall back to the streak; a
  `hidden` bullet (Buzzsaw) isn't drawn. The Black Hole draws its haze + starry core (core = `b.eat`,
  so the drawn core and the dig can't drift apart).
- **The map** (`drawMap`) is a toggle (`input.current.mapOpen`: the 🗺️ button or `M`, which also
  pauses), drawn last over the play area on `rgba(0,0,0,0.8)`, fitted and centred. It samples the real
  rock in `MINI_D` (4px) blocks: `enterLevel` lists the outline cells (`W.miniEdgeIdx`: blocks holding
  both rock and open), and each frame only those whose fog cell is seen are painted into `G.mini32`,
  blitted with image smoothing on so walls read as lines. Marks: `fogLit` pickups as dots (mods green,
  guns yellow, `old` guns a hollow ring), seen rooms outlined yellow (X when taken), you a yellow dot
  with a white rim.
- A replay frame (`G.RPV`): camera from the view, the play area above the replay panel, terrain from
  `G.RT`, no aim line, the fog overlay only when the viewer's fog toggle is on.
