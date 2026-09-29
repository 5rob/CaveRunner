// The world: the live level's state as one object, `W`. Game makes it once and every part of
// the loop reads and writes it (REFACTOR.md, Phase 3). enterLevel replaces the level-scoped
// parts on each floor; the lists are emptied in place, never replaced, because the death
// replay's recorder holds them by reference.

export function makeWorld() {
  return {
    // ---- terrain ----
    mat: null, img: null,           // the rock: solid cells, and its pixels (drawn to the terrain canvas)
    dimg: null,                     // the decoration layer's pixels (walk-through: moss, beams, rubble)
    ore: null,                      // gold seams in the rock (per terrain pixel)
    // rat burrows (a mask over each nest's room and tunnel), and the rock's change count
    // (the rats' way-finding fields rebuild when it moves; see ratSolid / navFor)
    burrow: null, terrainV: 0,

    // ---- the floor's layout (enterLevel sets all of these) ----
    floor: 1,
    start: undefined, portal: undefined, arrival: undefined,   // where you come in, the way out
    stock: undefined,               // the shop's plinths
    zone: null,                     // built-up vs natural, per terrain pixel (floor 1)
    rooms: [],                      // the perk room and the heart room
    sconces: [],                    // wall torches: by the portals and the prizes
    levelSeed: 0, levelOwned: [],   // what made this cave, for the autosave
    roster: [], themeName: '',      // this floor's creatures, and its palette
    total: undefined,               // how many creatures the floor started with
    miniEdgeIdx: [],                // the map's wall-outline cells
    matterProps: [],                // the dark matter props (their hum)
    ambKinds: [],                   // the theme's ambience particle kinds
    plantW: 255,                    // the jellies' plant glow: this floor's white point

    // ---- what's in it: new lists from each floor (and swapped for the recorded ones while
    // the death replay draws a frame) ----
    enemies: undefined,             // the creatures, nests included
    pickups: undefined,             // loot on the ground: mods, guns, hearts
    props: [],                      // the decoration that does things (see DECOR): plants, lamps, carts…
  };
}
