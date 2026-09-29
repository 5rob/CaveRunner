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
  };
}
