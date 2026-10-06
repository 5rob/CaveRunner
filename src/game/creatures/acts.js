// @ts-check
// ACTS: what the enemy loop does for each act (REFACTOR.md D20). One line per act; the Game
// side of each creature is its own file here (its pure brain and sprite are in creatures/).
// stepEnemies and damageEnemy (systems/enemies.js) call a hook exactly where its old inline
// branch sat:
//   pre(W, G, e, C)     before the move (a bomber's fuse)
//   move(W, G, e, C)    the act's move; true = it did its whole frame (nothing below it runs
//                       for this creature); no move = it stays put (a turret)
//   contact(W, G, e, C) hunting and touching you, before the shared bite; true = it's gone
//   fire(W, G, e, C)    after contact: shooting at you
//   die(W, e)           in damageEnemy, once it's out of the list; true = no ordinary coin
//   frame(W, G, F)      once a frame, after the creatures' shots (step's F)
// C is stepEnemies' per-enemy object: dt, pcx, pcy, i, dx, dy, dist, sees, hunting. An act
// that isn't in the table gets `chase`'s hooks.
// Every hook is a function declaration, so this table can be made at load inside the import
// cycle (enemies.js -> here -> rat.js -> systems -> enemies.js): a hoisted function is always
// there (D17, D20).

import { alienMove } from './alien.js';
import { bombBurst, bombFuse, classicMove, gunFire } from './classic.js';
import { jellyMove } from './jelly.js';
import { nestDie, nestMove, ratMove } from './rat.js';
import { spiderFrame, spiderMove } from './spider.js';

/** @type {Record<string, ActHooks>} */
export const ACTS = {
  nest: { move: nestMove, die: nestDie },
  rat: { move: ratMove },
  spider: { move: spiderMove, frame: spiderFrame },
  jelly: { move: jellyMove },
  alien: { move: alienMove },
  chase: { move: classicMove },
  bomb: { pre: bombFuse, move: classicMove, contact: bombBurst },
  shoot: { move: classicMove, fire: gunFire },
  turret: { fire: gunFire },            // holds station: the hover is all the movement it gets
};
