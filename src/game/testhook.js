// @ts-check
// The browser tests' way into the live level (REFACTOR.md, P3.3). Only runs when the test
// page sets `window.__TEST` (tests/build.js does); the game never does. It hands the suites
// the world object itself as `window.__lvl`, plus a few of Game's functions and the names
// they have always used for things (`seed`, `theme`, `rec`, `rt`, `fog`, `light`, `world`):
//
//   __lvl.sandbox(o)     wipes a box of the live level into a clean test room: open air, a
//                        flat floor, nothing else (no enemies, props, loot, shots), fog
//                        lifted, the player standing on the floor. Returns { x, y, l, r }:
//                        the centre x, the floor's top y, and the room's left/right edges.
//                        o: { w, h } room size in world units (default 300 x 200);
//                        o.roof: a solid brick roof over the room (something to hang things off).
//                        o.ramp: a 45° brick ramp up to the right wall over the room's right third.
//   __lvl.placeProp(pr, x, y)  a copy of prop `pr` (take one off a real floor so its shape
//                        is honest) set down at (x, y), anchored to the cell below; returns it.
//   __lvl.nextFloor()    straight on to the next floor's level, bought (the exit portal only takes
//                        you back to the shop now: game/systems/vend.js sells and buys levels).
//   See "Test mechanics in a sandbox" in CLAUDE.md for when to use these.
//
// The test page starts with the level bought (window.__TEST_VOID: not) and the pre-v0.0.142 kit,
// three guns and 40 gold (window.__TEST_EMPTY: a new run's empty hands).
//
// Nothing here changes game logic. If a test needs to reach something new, add it here rather
// than reaching into the game from the test.

import {
  BRICK, CELL, CH, CW, FH, FOG, FOG_U, FW, PH, PW, SHOP_FLOOR, SHOP_ROOF, SHOP_TOP, SHOP_Y,
  SIGHT, WH, WW
} from '../core/consts.js';
import { startingGuns } from '../spells/guns.js';
import { fogReveal, losClear, visPoly } from '../world/vision.js';

// g: what the suites reach that isn't world state: the two terrain canvases' contexts (the
// recorder's wrapped ones), and Game's functions and recorder objects
/** @typedef {{ tctx: CanvasRenderingContext2D, dctx: CanvasRenderingContext2D, paintFog: () => void, hurt: (n: number) => void, maxHp: () => number, dig: (x: number, y: number, R: number) => void, explode: (x: number, y: number, R: number, splash?: number, hot?: number) => void, recSample: () => void, ignite: (x: number, y: number, r: number, chance: number) => void, nextFloor: () => void, setAlight: (e: Enemy) => void, youAlight: () => void, REC: Recorder, RT: ReplayPlayer }} TestFns Game's functions and recorder objects, for the suites */
/** @param {World} W @param {TestFns} g */
export function testHook(W, g) {
  const { tctx, dctx, paintFog } = g;
  // the test page starts with the level already bought, so the suites have a cave to test (a run
  // in the game starts with none: buy it in the shop). window.__TEST_VOID: start the game's way
  if (!window.__TEST_VOID) W.hasLvl = true;
  // and with the old starting kit (a new run has no guns or gold since v0.0.142: most suites need
  // something to shoot). window.__TEST_EMPTY: start empty, the game's way
  const LO = window.__in && window.__in.current.loadout;
  if (LO && !window.__TEST_EMPTY && !LO.guns.some(Boolean)) { LO.guns = startingGuns(); LO.sel = 0; LO.gold = 40; }
  // A clean test room carved into the live level, far from the exit portal and above the shop.
  const sandbox = o => {
    o = o || {};
    const w = o.w || 300, h = o.h || 200;
    const cx = Math.round((W.portal.x + W.portal.w / 2 < WW / 2 ? WW * 0.72 : WW * 0.28) / CELL) * CELL;
    const fy = (SHOP_TOP - SHOP_ROOF) * CELL - 160;   /* SHOP_* are cell rows */
    const x0 = Math.max(2, Math.floor((cx - w / 2) / CELL)), x1 = Math.min(CW - 3, Math.ceil((cx + w / 2) / CELL));
    const y0 = Math.max(2, Math.floor((fy - h) / CELL)), fr = fy / CELL, y1 = Math.min(CH - 3, fr + 6);
    const d = W.img.data, dd = W.dimg.data;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * CW + x, k = i * 4;
      dd[k + 3] = 0; if (W.ore) W.ore[i] = 0; W.fire.fuel[i] = 0; W.fire.t[i] = 0;
      const ramp = o.ramp && x > x1 - (x1 - x0) / 3 && y >= fr - (x - (x1 - (x1 - x0) / 3));
      if (y < fr && !ramp) { W.mat[i] = 0; d[k + 3] = 0; }
      else { W.mat[i] = BRICK; d[k] = 132; d[k + 1] = 99; d[k + 2] = 71; d[k + 3] = 255; }
    }
    if (o.roof) for (let y = Math.max(0, y0 - 6); y < y0; y++) for (let x = x0; x <= x1; x++) {
      const i = y * CW + x, k = i * 4; W.mat[i] = BRICK; d[k] = 132; d[k + 1] = 99; d[k + 2] = 71; d[k + 3] = 255; dd[k + 3] = 0;
    }
    tctx.putImageData(W.img, 0, 0, x0, Math.max(0, y0 - 6), x1 - x0 + 1, y1 - y0 + 7);
    dctx.putImageData(W.dimg, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
    W.enemies.length = 0; W.props.length = 0; W.pickups.length = 0; W.bullets.length = 0;
    W.enemyShots.length = 0; W.webs.length = 0; W.silk.length = 0; W.strings.length = 0; W.fields.length = 0; W.dparts.length = 0; W.amb.length = 0;
    for (let y = Math.floor(y0 * CELL / FOG_U); y <= Math.floor(y1 * CELL / FOG_U); y++)
      for (let x = Math.floor(x0 * CELL / FOG_U); x <= Math.floor(x1 * CELL / FOG_U); x++) W.seen[y * FW + x] = 2;
    paintFog();
    W.p.x = cx - PW / 2; W.p.y = fy - PH - 0.5; W.p.vx = 0; W.p.vy = 0; W.p.hp = 9999; W.p.dead = false;
    return { x: cx, y: fy, l: x0 * CELL, r: x1 * CELL };
  };
  const placeProp = (pr, x, y) => {
    const q = Object.assign({}, pr, { x, y, gone: false, fall: false, vy: 0,
      anc: [Math.floor(x / CELL), Math.floor(y / CELL)] });
    W.props.push(q); return q;
  };
  Object.assign(W, {
    sandbox, placeProp,
    hurt: g.hurt, maxHp: g.maxHp, dig: g.dig, explode: g.explode, recSample: g.recSample,
    ignite: g.ignite, setAlight: g.setAlight, youAlight: g.youAlight, nextFloor: g.nextFloor,
    world: { CW, CH, CELL, WW, WH, SHOP_FLOOR, SHOP_TOP, SHOP_Y },
    fog: { get seen() { return W.seen; }, FW, FH, FOG, FOG_U, SIGHT, SHOP_TOP, SHOP_ROOF, reveal: fogReveal, paint: paintFog },
    light: { get flick() { return W.flick; }, get r() { return W.torchR; },
      get cam() { return { x: W.camX, y: W.camY }; }, get s() { return W.unitPx * (window.devicePixelRatio || 1); },
      get embers() { return W.torchP.length; }, get vis() { return W.visPts; }, visPoly, losClear },
  });
  // the old names for three world fields, and the recorder
  Object.defineProperties(W, {
    seed: { get: () => W.levelSeed, configurable: true },
    theme: { get: () => W.themeName, configurable: true },
    rec: { get: () => g.REC, configurable: true },
    rt: { get: () => g.RT, configurable: true },
  });
  return W;
}
