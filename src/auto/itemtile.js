// @ts-check
// CaveRunner Auto: an item drawn as its bag tile on a canvas (owner: a machine's payout comes out as the real thing, the
// rounded box and its icon), the screen's look (ui/auto/AutoScreen.js BagSlot / ItemIcon, .aslot.full in style.css):
// the box #2c1f45, its outline the item's group colour (itemEdgeCol), a mod's glyph in its family's colour, an exo
// mod's pixel map in the exo machine's colour with its roman tier, a perk's glyph in the perk machine's

import { MODS, famCol } from '../spells/mods.js';
import { PERKS, ROMAN } from '../data/perks.js';
import { glyphCanvas, pixCanvas } from '../art/itemicon.js';
import { HUB_MACHINES } from './hub.js';

// gold and gems' outline (things you spend): one light grey
export const ITEM_SPEND = '#c9cdd6';
// a tile's outline by the item's group (owner): a mod its family's colour, a gun, exo mod or perk its machine's
/** @param {BagItem} it @returns {string} */
export function itemEdgeCol(it) {
  return it.kind === 'mod' ? famCol(it.id || '') : it.kind === 'gun' ? HUB_MACHINES.gun.hue : it.kind === 'exo' ? HUB_MACHINES.exo.hue
    : it.kind === 'perk' ? HUB_MACHINES.perk.hue : ITEM_SPEND;
}

// does the item draw as a tile on the canvas (mods, exo mods, perks; guns keep their sprite, gold and gems theirs)
/** @param {BagItem} it */
export const tileItem = it => it.kind === 'mod' || it.kind === 'exo' || it.kind === 'perk';

// the tile at (x, y) (its centre), s across, in the canvas's units
/** @param {CanvasRenderingContext2D} c @param {BagItem} it @param {number} x @param {number} y @param {number} s */
export function drawItemTile(c, it, x, y, s) {
  const r = s * 0.19, lw = Math.max(0.6, s * 0.045), x0 = x - s / 2, y0 = y - s / 2;
  c.save();
  c.fillStyle = '#2c1f45'; c.strokeStyle = itemEdgeCol(it); c.lineWidth = lw;
  c.beginPath(); c.roundRect(x0 + lw / 2, y0 + lw / 2, s - lw, s - lw, r); c.fill(); c.stroke();
  /** @type {HTMLCanvasElement | null} */
  let ic = null;
  if (it.kind === 'mod') { const m = MODS[it.id || '']; ic = glyphCanvas(m ? m.glyph : '?', m ? famCol(it.id || '') : '#888'); }
  else if (it.kind === 'perk') { const pk = PERKS[it.id || '']; ic = glyphCanvas(pk ? pk.glyph : '?', pk ? HUB_MACHINES.perk.hue : '#888'); }
  else if (it.kind === 'exo') ic = pixCanvas(it.cat || 'hp', HUB_MACHINES.exo.hue);
  if (ic) {
    const k = s * 0.64;
    c.imageSmoothingEnabled = false;
    c.drawImage(ic, x - k / 2, y - k / 2, k, k);
  }
  if (it.kind === 'exo' && it.tier) {
    c.fillStyle = '#ffd23a'; c.font = '900 ' + (s * 0.19).toFixed(2) + 'px ui-monospace, monospace';
    c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillText(ROMAN[it.tier - 1] || '', x0 + s * 0.09, y0 + s * 0.07);
  }
  c.restore();
}
