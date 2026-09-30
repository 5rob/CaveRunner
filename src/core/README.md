# core/ — layer 1: numbers and small helpers

No imports except each other. Everything else may use these.

| File | Holds |
|---|---|
| `consts.js` | World size (`CELL`, `CW`/`CH`, `WW`, `VIEW_W`), tuning (`GRAVITY`, `WALK`, `JET`, `CLIMB`, `WEB_HAND`), the sticks (`DEAD`, `AIM_DEAD`, `KNOB`, `AIM_RING`), the shop room (`SHOP_*`), the fog grid (`FOG`, `FOG_U`, `FW`), the map grid (`MINI_D`, `MMW`/`MMH`), sight (`SIGHT`, `LAMP_REACH`, `FOG_DIM`, `FOG_DARK`), `COL` |
| `util.js` | `rr` (rounded rect), `angDiff`/`turn`, `mix`/`mixHex`/`hexMix`/`hsvAdjust`/`hexRgb`, `approach`/`clamp` |

`VERSION` is not here: it is `src/version.js`, read by the build (see CLAUDE.md).

## Rules

- **`AIM_RING` is derived**: `AIM_DEAD * 0.72 + KNOB`, the circle the knob's *edge* crosses the
  moment a drag starts to count as aiming. Change `AIM_DEAD` or `KNOB` and it follows; never
  hardcode it. (Why the knob is that big: `ui/README.md`.)
- **`SIGHT` is both the reveal radius and the lamp's size** (`torchR = SIGHT * LAMP_REACH`), and
  stays under `VIEW_W` so the cave beyond the bubble is dark. `FOG_DIM` = remembered but unlit,
  `FOG_DARK` = never seen (near black: that darkness *is* the fog of war). More in
  `world/README.md` (vision and fog).
