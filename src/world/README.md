# world/ — layer 3: making a floor, seeing it, burning it

All pure: the logic suites call these directly.

| File | Holds |
|---|---|
| `level.js` | `makeLevel(seed, floor, owned)`: one floor whole (terrain, shop, prize rooms, enemies (`DEV.enemies` + `DEV.enemiesUp` a floor), pickups, decoration, gold seams, nests (each with its brood `left`), `fuel`, `zone`, `tomb` (floor 2's rooms and corridors, `tomb.js`; null elsewhere), and since v130 `portals`: three exits along the top at `EXIT_X` (1/6, 1/2, 5/6 across), each a room with a ledge, joined by a passage carved after the ledges and platforms; `portal` is the middle one; the shop's way up, `shopExit`, is always over the buy machine, `VEND_BUY_X`, since v0.0.145); also run off the main thread by `game/levelgen.js`, so it must stay plain data in, plain data out; `shopPanel(cx, cy)` (the shop shell's steel, whatever the theme: roof with ceiling lights, deck floor, side columns); `ROOM_HW`/`ROOM_HH` |
| `tomb.js` | Floor 2's tomb (Level 2 stage 2): `tombPlan(seed, shopExit, exitX)` (the room list, then the corridors: `Tomb` in `types.d.ts`), `roomOpen(room, x, y)` (a pixel inside a room's shape), `roomPillars` (a pillar maze's pillars), `carveTomb(mat, plan)`, `tombRoomAt(tomb, wx, wy, CELL)` ("which room is this?", world units), `paintMasonry` (the cut-stone bake), `TOMB_TYPES`/`TOMB_SHAPES`, `TOMB_TOP` (34: the top gallery's floor, where the pads stand), `TOMB_BOTTOM` (the vestibule's floor = the top of the shop's shaft) |
| `furnish.js` | Floor 2's room kits (Level 2 stage 3): `furnishTomb(mat, img, dimg, fuel, tomb, seed)` (every room furnished for its type, its pieces listed on `room.kit`; bones along the galleries), `KIT_PAL` (the kits' colours) |
| `strata.js` | Floor 1's layered cave: `strataCave`, `paveWorks`, and the timber: `timberWorks`, `timberFrame` |
| `zones.js` | Floor 1's built-up vs natural zones: `builtAt(zone, wx, wy)`; `boxReach` (runner-box flood that keeps the main route open) |
| `decorate.js` | `decorate` (the theme's `DECOR`: bakes and props), `cullDecor`, `propAnchored`, `archCurve`/`archNear`/`archAt`, `PLANTS`, `GROVES`, `DECOR_DENSITY`, `PROP_BOX`, `PROP_DMG` |
| `veins.js` | `goldVeins` (gold seams, rock only), `ORE_GOLD` |
| `nuggets.js` | gold as nuggets: `splitGold` (a drop into big 25 / medium 5 / small 1, adding up exactly, at most `NUG_CAP`), `spillGold` (each nugget waits `SPILL_WAIT`, 0.25 s, as `nopull` before it can fly to you: close by, it was taken before it was ever drawn), `nugR`; their physics: `stepNugget` (fall, bounce, roll downhill) and `collideNuggets` (push apart), both taking a radius for crystals (v0.0.138), and `shoveNugget` (a body pushed out of a moving box: you shoving a crystal) |
| `nests.js` | `ratNests` (floor 1: a mound, a bending tunnel, a room in the rock) |
| `nav.js` | `navField` (Dijkstra out from a goal over `NAV` = 4px cells that fit a rat), `navWay` (next waypoint; extends through air to a landing) |
| `vision.js` | `rayDist`, `losClear`, `visPoly` (`VIS_RAYS`), the fog memory `fogReveal`, `fogStart`, `nestFog`; the gun light's shape (v0.0.145): `beamSide`, `beamLift` (the cone along the aim, soft sides, fading to its reach, and a round glow `DEV.beamNear` round you), `beamFan` (the line-of-sight fan out to the beam's reach, cut back to the sight radius outside the cone: the beam uncovers the fog further ahead) |
| `sway.js` | Vines and web lines that give (looks only, cheap): `bendStep`/`bendPush`/`bendAwake` (a line's one-spring bend `wx`/`wy` peaking at `wu`, `tent`), `swingStep` (a hanging vine's pendulum `sw`/`swv`), `webAt`/`webNearU`/`webPath` (a web line sagged and bent), `hangX`/`hangRootX`/`hangRootY` (where a swung vine, or a strand on a bent arch, is), `swings`; a swung vine's tail below the joint `sj` (v129: `tailStep`, verlet links `tl`; `vinePt(pr, k)` = the point k down it, `vineJoint`) |
| `ragdoll.js` | Your corpse: `ragNew` (eleven joints in the sprite's pose, `RAG_POSE`: head, chest, hip, knees, feet, elbows, hands; tipping over), `ragStep` (gravity, `RAG_SUB` substeps, sticks `RAG_STICKS` (from `RAG_BRACE` on only braces), the rock via a `solid(x, y)` test, floor friction, goes `still` after a second at rest), `ragPush` (a blast throws it), `ragHip`; `RAG_SLUMP` (it topples by itself for 1.5s, or a balanced sit never falls) |
| `shoplights.js` | A new run's dark shop (v0.0.136): `LIGHT_X` (the light sections' middles, `SHOP_SLOT` apart from the teleporter's `FIRST_X` to the end wall; every machine is the middle of one, `PERK_I` the perk machine's), `lightsNew`, `lightsStep` (section 0 on at `LIGHT_WAIT`, 2 s: v0.0.144, `ARRIVE_T` (1 s) of the teleporter charging, then a second after you're in; the next once you reach the last lit one's middle (`FIRST_TRIGGER` for the first), at least `LIGHT_RUN` apart; the rest in a run `LIGHT_REST` after the perk section, or once you leave the shop; never past `hold`, the guide's section until it has gone; `done` when all have settled), `lightNear` (the guide jumping out: the sections round it on at once), `tubeLevel` (a fluorescent start: off, on, off, then random blinks, steady by `TUBE_MAX`), `sectionLevel`, `poolEdge(i)` (where section i's pool of light ends), `shopDark` (how dark at an x: a pool of light under each lit tube, `halfW` + `POOL_FADE`, `DEV.shopGap` between; `null` = the lit shop, every tube on), `PAD_LIT` |
| `guide.js` | A new run's guide hologram (v0.0.141): `GUIDE_PAGES` (the owner's welcome, a box each), `GUIDE_RUDE`, `GUIDE_GIFTS` (the starter kit, in order; its gun's level, slots, shots a cast and recharge), `guideNew`, `guideStep` (states `wait` → `appear` → `wave` → `talk` → `give` → `leave` → `gone`, or `rude` when you walk out past `guideLitEdge` (the right edge of its pool of light, `poolEdge` in `shoplights.js`; v0.0.144, it was walking through it, which at a run left no time to see it) before `give`; it jumps out once its spot is `DEV.guideIn` (50) inside the screen's right edge (v0.0.142: it came at ~27 in, its light mostly off screen; owner: see the dark first) or you come within `GUIDE_NEAR` (30), at `guideSpot` (`GUIDE_UNDER` short of the first held section's middle: just inside the dark, under the tube that snaps on); returns events for the system), `guideX` (it slides with the hologram layer: `GUIDE_PAR`), `typedAt`/`typeTime` (a letter every 1/cps, beats after stops and commas), `pageHold`, `guideSpeech` (the box's text and how much is typed) |
| `byDistance.js` | Decorate by distance (Level 2 stage 1; a reusable tool, **not in `makeLevel` yet**): `distField(w, h, src, maxDist)` (each cell's exact straight-line distance, through rock, from the nearest source cell; Infinity past the reach; ~25 ms on a whole floor), `curveFn(curve)` (a Dev curve knob as y(x)), `scatterByDistance(opts)` (seeded points over the open cells in reach, kept with chance `density(dist / maxDist)`, never in rock or within `clear` of it, `jitter` after; each `{ x, y, dist, size, roll }`, size = sizeMin..sizeMax × `scale(x)`, `roll` a spare 0..1, e.g. fire; stops at `n`), `destructionOpts()` (floor 2's explosions: Dev → Level 2: destruction). All in grid cells; plain data |
| `fire.js` | The fire engine: `fireNew`, `fireLight`, `fireArea`, `fireNear`, `fireDouse`, `fireStep`; `FUEL_*`, `FIRE_*`, `FLAMMABLE`, `FIRE_WET` |

## Rules: generation

- **Same seed + floor + `owned` perks = the same cave.** Everything extra (decoration, gold seams,
  nests) runs on **its own RNG** from the seed, so adding to it never moves the caves, enemies or
  loot. The floor-1 layout knobs (`LV_KNOBS`) roll with the level's seeded `rnd`, so a seed plus
  the same knobs is the same cave. (Palette and roster: `data/README.md`, floor number only.)
- **The main route is guaranteed; unreachable pockets are fine** (owner's rule: digging is for
  that). `tests/logic/level.test.js` flood-fills 20 seeds. On floor 1 the spine worms are cut only
  in natural zones; their built-up stretches (`spineBuilt`) are cut as a narrow shaft only if
  `boxReach` says the shop can't reach the top without them; after that a BFS digs the shortest
  link if needed, and any hidden room the flood misses is dug to the nearest reached cell.
- **Floor 1 is zoned** (`zone`, returned on the level; null elsewhere): a big fbm thresholded at
  the `lvZoneShare` quantile, edge warped by `lvZoneRag`. Built-up (`zone = 1`) takes `strataCave`'s
  layered cave, natural keeps the noise cave with blobs, worms, ledges, frames, floats. Floor 2
  is the tomb (below); other floors are the noise cave until the owner tailors each. `strataCave`: layers built bottom-up,
  every wall-bounded stretch gets a hole up, two **vaults** hold the hidden rooms, **old workings**
  are levelled + paved stretches; a slope pass lifts roofs where it's steep. Rooms on zoned floors:
  heart and perk room in different zone types (coin toss); rooms carry `built`.
- **Timber is structural.** `timberFrame` refuses unless both posts stand on level ground and the
  roof bears on the cap (wedges fill small gaps); floor 2's `beams` bake uses it too. No timber
  piece without rock above and below. Density (owner-tuned): galleries at `lvPost` spacing;
  propped patches (`lvPropZones`) ~1× post spacing — more patches, not denser ones ("3x" was far too
  dense). Test hooks: `strataCave.last`, `timberWorks.zones`.
- **Decoration** (`decorate(mat, img, dimg, bgImg, floor, seed, keep, fuel, zone)`, driven by
  `DECOR`): *bakes* paint pixels onto rock (`img`: moss, cracks — digging erases them), into
  `dimg` (the non-colliding decoration layer between background and rock: rubble, beams, gears;
  `unDeco` wipes it) or darken `bgImg`. Only `algae` touches `mat`, and only ROCK→BRICK (still
  solid; the logic test checks the solid/open shape never changes). Everything else is a **prop**
  (`{ id, k, st, x, y, b, anc, … }`), **never in `mat`**: creatures and you pass through props;
  they act only by box overlap. `cullDecor` drops overlaps and keep-outs (plants may overlap each
  other; an arch is checked by its curve). Counts are `n * DECOR_DENSITY`; hanging `PLANTS` come in
  clumps, plus `GROVES` overgrown patches on green floors. Plant length is capped short of the shop.
  Arched vines (`ARCH_KNOBS`): natural zones, green floors, curve must be open with `arClear` below;
  an arch needs both anchors (`anc`, `anc2`); its strands hang `on` it. Lanterns (`lantern`,
  `hanglamp`) go in built-up zones.
- **Nests** (floor 1): the burrow is a real open hole, hidden only by the fog. The tunnel bends
  (no sightline down it) and `nestFog` marks the fog cells over each room so the fog's soft edge
  never spreads into them: the room shows only once a real line of sight reaches it (you dig).
  Don't paint it over with rock colour (tried in v88–v92; the owner saw solid rock with a squiggle).
- **Floor 2 is a tomb** (`tomb.js`, Level 2 stage 2): no natural cave anywhere on it. **Rooms first**: three
  exit halls (`gate`, domes over the pads, joined by the top gallery) and the `vestibule` (over the shop's way up,
  the shaft opening in its floor) are fixed; the rest are thrown in at random, big or small (`DEV.l2Big`), never
  within `l2Gap` of another, each with a **type** (hall, library, altar, orrery, pillars; shrine, ossuary, dorm,
  store: `TOMB_TYPES`) and a **shape** its type allows (`TOMB_SHAPES`: rect, ziggurat, octagon, dome, pointed
  arch, round). **Every room is mirror-symmetric about its middle `cx`** and has a flat floor (Stage 3 mirrors
  props on that): keep it so (the logic test checks every pixel). Floors are snapped to the stone courses.
  **Then the corridors**: every pair of rooms gets a route (one over the other: a shaft; side by side with near
  floors: a gallery; else an L, a gallery out of one room's side at its floor and a shaft into the other's
  middle), a spanning tree (Kruskal, cheapest first, a route through a third room costing 400 more) joins them
  all to the exits and the shop, then short clean extra links (`l2Loops`). A room the tree can't reach is left
  as rock. Corridors are cut, then pushed into their rooms only until they meet open air (short doorways; the
  rects on the plan grow to what was cut). Shafts never come up under a pad. **Shafts get ledges** (rock, every
  `l2Ledge`, side to side, only where the wall behind is whole). The prize: an altar room with the fewest ways in
  (a small room is made one if there's none); its green crystal stands on the floor in the middle.
  **The level carries the plan**: `level.tomb` (`W.tomb` in the game; null on other floors), terrain pixels.
  The shop reaching the top is checked (`boxReach`); a plain shaft is the fallback (`tomb.mended`, never seen
  in the tests). All on the tomb's own random stream and the Dev knobs (`L2_KNOBS`): same seed + knobs, same tomb.
- **Floor 2's decoration is the rooms' kits** (`furnish.js`, Level 2 stage 3); the theme's `DECOR` (coal mine:
  beams, carts, soot, lanterns, picks) is not placed there, so floor 2 has **no props**. Everything is baked:
  furniture, statues, skeletons in `dimg` (open cells only; wood, cloth and parchment pixels get `FUEL_WOOD`),
  carvings in `img` (ROCK only): a floor mosaic, glyph columns up the walls, dentils under the roof, glyphs on
  a pillar maze's pillars. Blasts and digs wipe it like any decoration (`unDeco`). **Mirrored**: every piece is
  painted as a pixel pair about the room's middle, and only where it fits on both sides (open, standing on rock),
  so a shaft hole on one side drops its twin too; the logic test checks every room's dimg is symmetric. Hung
  things need the room's own roof over them (never up a shaft). Kits: altar (stepped altar with offering and
  candles, idols, kneeling skeletons, a censer; the prize room keeps its middle for the game's altar), shrine
  (statue under a halo ring, bowl, candle, kneelers), hall (throne, long tables, benches with seated skeletons,
  banners), library (shelves of coloured spines, lectern, a reader, scroll piles), ossuary (framed skull niches
  over the back wall, skull piles), dorm (stone bunks, one or two high, bedrolls, sleepers, chests), store (a
  stone shelf of jars, urns, amphorae, crates on the floor), orrery (an armillary on a pedestal, hanging
  planets), pillars (glyph-carved pillars, skulls and bowls), gate (obelisks by the pad), vestibule (guardians);
  a tall room also gets inscribed relief tablets on its back wall and a great unlit ring hung from its roof.
  Bones scatter everywhere. Candles are paint only: **no light-emitting props on floor 2** (darkness matters to
  later stages). Its own RNG; knobs `l2Furn`, `l2Bones` (× each) and `l2Decor` (× all, 0 = bare tomb).
- **Shafts meet a room's floor against its wall** (`shaftX`/`floorOk` in `tombPlan`), never in its middle,
  so the kit's centrepiece has a floor; a corridor end goes on into the room it touches (matched by edge, not
  by which room is higher: before stage 3 an L-shaft could miss its room and leave it sealed).
- **Cut stone** (`paintMasonry`): rock within `l2Mason` px of open air, block by block (courses `l2Course`
  high, `l2Block` long, every other course offset half a block), is painted in the floor's brick and mortar
  colours (`L2_LOOK`), a lit edge on floors and a shadow under roofs; past it the raw rock. Only the paint: `mat`
  stays ROCK (diggable, gold seams). The background gets dark block joints too.
- **Decorate by distance** (`byDistance.js`): the caller hands a source mask (floor 2: its dark zones), the terrain and a seed or its own `rnd`; same inputs, same points, so it fits the own-RNG rule. Keep it generic (an options object); a new use is a new options set (Dev knobs + a curve or two), not a new scatter.
- **Gold seams** mark ROCK only, above the shop, near open cave; dug-out ore pixels become coins in
  the game (`dropOre`, `game/systems/terrain.js`).
- **Nav:** costs 1 along rock, 8 up through air, 3 across, 1 down; web cells count as ground (the
  owner likes rats on webs). A hairline crack isn't a way.

## Rules: vision and the fog of war

The reveal is `drawFog` (`game/render/light.js`, every frame); lit glows are `drawGlows` there,
gated by `fogLit` (`game/systems/fog.js`).

- **`rayDist` / `visPoly` / `losClear` are exact, and that is the point.** They march cell
  boundary to cell boundary (a fixed step jumps a one-cell wall), and `losClear` is the same march,
  so a line of sight and a bullet stop agree. `visPoly` runs every frame: anything added to it costs
  60× a second. Widening `SIGHT` a lot lets the fan leak a cell round a corner: a `VIS_RAYS`
  (density) trade-off, not a reveal bug.
- **The map only gets what was in line of sight.** `fogReveal` skips any cell the fan didn't reach
  in its direction, and takes the *shorter* of the two rays either side of a cell (interpolating
  reaches past corners, the one thing this is here to stop).
- **The lamp is masked by the fog.** It lights only cells the fog has already lifted (`W.seen`);
  never-seen cave stays dark with the lamp on it. It is **not** a blanket `destination-out`
  gradient (v38 did that and on a phone's tall screen lit the whole cave: "fog missing"). The lamp
  doesn't stop at walls; the *reveal* does. `torchR = SIGHT * LAMP_REACH`, scaled by `DEV.torch`.
  Don't turn it back into a gradient without asking.
- **Soft edge:** an unseen cell next to a seen one is *baked* as remembered (one-cell dilation —
  the bake only, never `W.seen`), and the small fog slab is blurred at source resolution
  (`fogBlurC`, cheap) before it is scaled up. No full-screen `ctx.filter` (too slow on a phone). The blur sees nothing past the level, so the
  sharp edge cells are drawn back under it (`destination-over`), or the sides go see-through.
- **One flicker, `flick`,** drives the flame, the light's reach and its brightness, clamped ≤ 1
  (a canvas `globalAlpha` over 1 is silently ignored, so an overshooting flicker stops flickering).
- **An enemy is drawn if the light reaches it** — no line-of-sight test in the draw, same as the
  lamp. `lineOfSight` is what the AI aims and shoots on, so nothing fires through a wall.
- **Torches do NOT clear fog** (v59 tried it; it gave away every prize room on arrival). Wall
  torches, lanterns and every glow drawn after the fog show only where `fogLit(W, x, y)` is true
  (the cell or an 8-neighbour `seen`: the same soft edge as the bake), so a torch shows exactly when
  loot at the same spot would. Sconces sit either side of both portals and each room prize.
- **Fire must not reveal fog** (owner). Burning pixels are drawn *before* the fog (unseen fire
  stays hidden); the bright pass and glows after it only on `seen` cells.

## Rules: fire

- `makeLevel` returns `fuel` (per terrain pixel: `FUEL_GRASS`/`FUEL_MOSS`/`FUEL_WOOD`, 0 = none),
  stamped as things are painted (`decorate`'s bakes, `timberWorks`). Moss is on rock pixels
  (`img`), grass and timber on open ones (`dimg`).
- `fireStep` ticks at `FIRE_TICK` (20 Hz): each burning pixel tries every spot within 2px
  (`FIRE_NB`, up > side > down) at `fireSpread × FIRE_CATCH[kind] × weight`, capped at `FIRE_MAX`;
  spent fuel goes to `out(i)`. `fireDouse` sets the timer to 0 in a disc (fuel stays).
- **Anything that clears pixels must zero `fuel` and the fire timer there** (`dig`, `unDeco`,
  `explode` do). Knobs: Dev → Fire (`FIRE_KNOBS`). The Game side is `game/systems/fire.js`.
