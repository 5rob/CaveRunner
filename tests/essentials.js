// The essentials: what `node tests/run.js` runs by default (owner, v1.0.78: the whole suite had got slow
// enough to hold development up). Every other suite in tests/logic/ and tests/browser/ is archived: still
// there, run when a change is related to it (`node tests/run.js related`, or by name), and all of them with
// `node tests/run.js all` when something still doesn't work.
//
// Picked for CaveRunner Grem (grem branch): quick, broad, never flaky. Keep it short; a suite joins only if breaking it
// would mean the game itself is broken (it can't start, save, play a level, or fire a gun).
module.exports = {
  logic: [
    'version',        // old installed apps still see updates
    'spells',         // every mod plans, previews and traces
    'cast',           // the cast rules
    'grem',           // Grem's kit, unlocks and team guns
    'auto-guns',      // the starter kit, every mod through the real gun
    'auto-level',     // a level runs start pad → arena → exit pad
    'auto-tall',      // the tall level, start → exit, camera
    'auto-zones',     // zones by height, autopilot still gets through
    'auto-blocked',   // blocked zones get cleared
    'auto-enemies',   // creatures, elites, the boss
    'auto-boss',      // a starter gun kills the boss in time
    'auto-floors',    // each level's themed floor, round again after Void Hollow
    'auto-preview',   // the gun panel matches a level
  ],
  browser: [
    'title',          // the title screen, ▶ into Grem
    'grem-tap',       // Grem plays: a tap sends the team
    'grem-dev',       // ⏸ held: the Dev panel, Grem's groups only
  ],
};
