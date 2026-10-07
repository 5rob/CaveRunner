// @ts-check
// The level economy: what a floor's level costs on credit, what selling it back pays, and which
// floors the buy machine will sell you. Every price climbs exponentially floor by floor
// (Dev → Level: lvlGrow for the debt, rewardGrow for the reward on top, killGrow for the kill gold, data/creatures.js
// goldScale). Floor 1 is always for sale; floor N only once floor N - 1 has been sold this run
// (LO.soldTop, the highest floor sold: a death starts a new run, and a new loadout).

import { LVL_BUY } from '../core/consts.js';
import { DEV } from '../dev/knobs.js';

export const LVL_MENU_MAX = 12;   // the buy machine picks floors up to this

// the debt a floor's level goes on: LVL_BUY (a billion) on floor 1, × lvlGrow (3) each floor up
/** @param {number} [floor] */
export const lvlBuy = (floor = 1) => Math.round(LVL_BUY * Math.pow(DEV.lvlGrow, Math.max(0, floor - 1)));

// what selling it pays: its price back, and the reward on top (Dev: lvlBonus on floor 1, 1,000, × rewardGrow, 2, a floor: 1,000, 2,000, 4,000, 8,000…)
/** @param {number} [floor] */
export const lvlSell = (floor = 1) => lvlBuy(floor) + Math.round(DEV.lvlBonus * Math.pow(DEV.rewardGrow, Math.max(0, floor - 1)));

// the reward alone: what's yours once the debt is paid
/** @param {number} [floor] */
export const lvlReward = (floor = 1) => lvlSell(floor) - lvlBuy(floor);

// can the buy machine sell you this floor? Floor 1 always; any other once the one under it was sold this run
/** @param {number} soldTop the highest floor sold this run (0: none) @param {number} floor */
export const canBuyFloor = (soldTop, floor) => floor >= 1 && floor <= (soldTop || 0) + 1;

// the highest floor the buy machine lets you pick: everything you could buy, and one more up (greyed,
// not for sale yet)
/** @param {number} soldTop */
export const pickTop = soldTop => Math.min(LVL_MENU_MAX, (soldTop || 0) + 2);

// the buy machine's pick moved one step (up +1, down -1), kept to floors 1..pickTop
/** @param {number} sel @param {number} soldTop @param {number} d */
export const stepPick = (sel, soldTop, d) => Math.max(1, Math.min(pickTop(soldTop), sel + d));
