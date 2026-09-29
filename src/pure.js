// Every pure part of the game, for the logic tests: tests/load.js bundles this file (with
// esbuild, to CommonJS, in memory) and hands its exports to the suites as `G`.
//
// One `export * from` line per module under src/, plus main.js's own `export { … }` list
// for what hasn't moved out yet. tools/move.js adds a line here for each module it makes.
// Not part of the game: the browser build starts from main.js and never sees this file.
export { VERSION } from './version.js';
export * from './main.js';
export * from './core/consts.js';
export * from './core/util.js';
export * from './dev/knobs.js';
export * from './data/themes.js';
export * from './data/creatures.js';
export * from './data/perks.js';
export * from './spells/mods.js';
export * from './spells/spawn.js';
export * from './spells/guns.js';
export * from './spells/cast.js';
export * from './spells/trace.js';
export * from './spells/advisor.js';
export * from './spells/bagsim.js';
export * from './world/vision.js';
export * from './world/fire.js';
export * from './world/nav.js';
export * from './world/zones.js';
export * from './world/veins.js';
