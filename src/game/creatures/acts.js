// ACTS: what the enemy loop does for each act (REFACTOR.md D20). One line per act; the Game
// side of each creature is its own file here (its pure brain and sprite are in creatures/).
// stepEnemies and damageEnemy (systems/enemies.js) call a hook exactly where its old inline
// branch sat:
//   move(W, G, e, C)    the act's move, at the old if/else chain; true = it did its whole
//                       frame (nothing below it runs for this creature)
//   die(W, e)           in damageEnemy, once it's out of the list; true = no ordinary coin
//   frame(W, G, F)      once a frame, after the creatures' shots (step's F)
// C is stepEnemies' per-enemy object: dt, pcx, pcy, i, dx, dy, dist, sees, hunting.
// Every hook is a function declaration, so this table can be made at load inside the import
// cycle (enemies.js -> here -> rat.js -> systems -> enemies.js): a hoisted function is always
// there (D17, D20).

import { jellyMove } from './jelly.js';
import { nestDie, nestMove, ratMove } from './rat.js';
import { spiderFrame, spiderMove } from './spider.js';

export const ACTS = {
  nest: { move: nestMove, die: nestDie },
  rat: { move: ratMove },
  spider: { move: spiderMove, frame: spiderFrame },
  jelly: { move: jellyMove },
};
