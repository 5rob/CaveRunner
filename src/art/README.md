# art/ — layer 4: sprites drawn from canvas primitives

| File | Holds |
|---|---|
| `sprites.js` | `drawRunner`, `drawGun`, `drawGunGlow` (glow + streaks on a never-held ground gun), `drawFlame` (teardrops whose tip leans to `lx, ly`), `flameDrop`, `drawTorch`, `drawSconce`, `glowAt`, `GLOW_STREAKS` |
| `props.js` | `drawProp` (every decoration prop), `drawArch` (arched vines), `propCol`, `propGlow` (the light lamps, vents, shards, eyes, dark matter and lava give off), `eyesAlpha`, `rgbA`/`rgbS`, `VENT_H` |

Creature sprites live with their creature (`creatures/`). Everything draws at world scale.

## Rules

- `drawProp` runs **before** the fog; `propGlow` adds light **after** it, only where `fogLit` says
  the ground is seen — except the eyes, which fade as you come close (`eyesAlpha`).
- The hand torch: `drawFlame`'s lean is a spring toward "opposite your velocity" (`W.leanX`/`leanY`,
  `stepTorch`); its halo, second light and the wall sconces are drawn after the fog with `lighter`,
  so the map lighting is untouched. Brightness follows `flick` (`world/README.md`).
- Ground guns glow (`drawGunGlow`, before the gun sprite) unless `q.old` — set on the gun you swap
  out in `GunSwap`, and kept by the save.
- A gun's sprite colour is `gunAccent` (its level colour; starter guns keep their family colour).
